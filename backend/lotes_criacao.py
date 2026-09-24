from datetime import datetime
from pathlib import Path
from threading import RLock
from typing import Optional

import duckdb
from fastapi import APIRouter, HTTPException, Query
from fastapi.encoders import jsonable_encoder

from config import PARQUET_LOTES_ABERTOS

router = APIRouter(prefix="/api/zootecnico/lotes-em-criacao", tags=["Lotes em criação"])

CACHE_TABLE = "lotes_abertos_cache"
IDADE_MAXIMA = 45

DIMENSOES = {
    "tecnico": "Técnico",
    "granja": "Nome Granja",
    "galpao": "Galp",
    "linhagem": "Linhagem",
    "tipo_granja": "Tipo Granja",
}

FAIXAS_IDADE = {
    "0-7": (0, 7),
    "8-14": (8, 14),
    "15-21": (15, 21),
    "22-28": (22, 28),
    "29-35": (29, 35),
    "36-45": (36, 45),
}

FORMULAS_LOTES = [
    {
        "id": "lotes_criacao",
        "nome": "Lotes em criação",
        "unidade": "lotes",
        "formula_exibicao": "Contagem distinta de Granja + Lote + Galpão no último snapshot, com idade entre 0 e 45 dias",
        "descricao": "Quantidade de lotes únicos ainda em criação no snapshot mais recente do Parquet.",
        "formula_dax": """lotes_em_criacao =\nCALCULATE(\n    DISTINCTCOUNT(base[Chave_Lote_Granja]),\n    base[Idade Atual] >= 0,\n    base[Idade Atual] <= 45\n)""",
    },
    {
        "id": "aves_alojadas",
        "nome": "Aves Alojadas",
        "unidade": "aves",
        "formula_exibicao": "Σ(Aves Inicia) dos lotes em criação",
        "descricao": "Soma das aves iniciais dos lotes únicos presentes no snapshot mais recente.",
        "formula_dax": """aves_alojadas =\nSUMX(\n    VALUES(base[Chave_Lote_Granja]),\n    MAX(base[Aves Inicia])\n)""",
    },
    {
        "id": "aves_atuais",
        "nome": "Aves Atuais",
        "unidade": "aves",
        "formula_exibicao": "Aves Inicia − Σ(Mortes 07–42) − Σ(Descartes 07–42)",
        "descricao": "Estimativa de animais vivos até 45 dias, descontando mortalidade e descartes informados nas semanas 07 a 42.",
        "formula_dax": """aves_atuais =\n[Aves Alojadas]\n    - [Mortes 07-42]\n    - [Descartes 07-42]""",
    },
    {
        "id": "mortalidade",
        "nome": "% Mortalidade",
        "unidade": "%",
        "formula_exibicao": "Σ(Mortes 07–42) / Σ(Aves Inicia) × 100",
        "descricao": "Percentual de mortalidade acumulada dos lotes em criação. Descartes não entram no numerador desta métrica.",
        "formula_dax": """mortalidade =\nDIVIDE(\n    [Mortes 07-42],\n    [Aves Alojadas]\n) * 100""",
    },
    {
        "id": "peso_medio",
        "nome": "Peso Médio",
        "unidade": "g",
        "formula_exibicao": "Σ(Último peso disponível do lote × Aves Atuais) / Σ(Aves Atuais)",
        "descricao": "Usa o peso semanal mais recente disponível entre 42, 35, 28, 21, 14 e 7 dias; na ausência deles, usa Ps Pinto.",
        "ponderador": "Aves Atuais",
        "formula_dax": """peso_medio_geral =\nDIVIDE(\n    SUMX(base, [Último Peso Disponível] * [Aves Atuais]),\n    SUMX(base, [Aves Atuais])\n)""",
    },
]

_lock = RLock()
_con = duckdb.connect(database=":memory:")
_signature: tuple[int, int] | None = None
_columns: set[str] = set()
_loaded_at: str | None = None


def _path_sql(path: Path) -> str:
    return str(path).replace("\\", "/").replace("'", "''")


def _file_signature(path: Path) -> tuple[int, int]:
    stat = path.stat()
    return stat.st_mtime_ns, stat.st_size


def _updated_at(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime).strftime("%d/%m/%Y %H:%M:%S")


def _validate_file() -> Path:
    path = Path(PARQUET_LOTES_ABERTOS)
    if not path.exists():
        raise HTTPException(status_code=500, detail=f"Parquet de lotes abertos não encontrado: {path}")
    return path


def _load_cache(path: Path) -> None:
    global _signature, _columns, _loaded_at
    try:
        _con.execute(
            f"""
            CREATE OR REPLACE TABLE {CACHE_TABLE}_novo AS
            SELECT * FROM read_parquet('{_path_sql(path)}')
            """
        )
        _con.execute(f'DROP TABLE IF EXISTS "{CACHE_TABLE}"')
        _con.execute(f'ALTER TABLE {CACHE_TABLE}_novo RENAME TO {CACHE_TABLE}')
        _columns = {row[0] for row in _con.execute(f'DESCRIBE SELECT * FROM "{CACHE_TABLE}"').fetchall()}

        required = {
            "Data_Analise", "Data Recepcao", "Codigo Granja", "Nome Granja",
            "Num Lote", "Galp", "Aves Inicia", "Técnico", "Linhagem", "Tipo Granja",
        }
        missing = sorted(required - _columns)
        if missing:
            raise RuntimeError("Colunas obrigatórias ausentes: " + ", ".join(missing))

        _signature = _file_signature(path)
        _loaded_at = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao carregar Parquet de lotes abertos: {exc}") from exc


def _ensure_cache() -> Path:
    path = _validate_file()
    signature = _file_signature(path)
    with _lock:
        if _signature != signature or not _columns:
            _load_cache(path)
    return path


def _num(column: str) -> str:
    return f"TRY_CAST(REPLACE(TRIM(CAST(\"{column}\" AS VARCHAR)), ',', '.') AS DOUBLE)"


def _sum_existing(prefix: str) -> str:
    pieces = []
    for age in (7, 14, 21, 28, 35, 42):
        column = f"{prefix}-{age:02d}"
        if column in _columns:
            pieces.append(f"COALESCE({_num(column)}, 0)")
    return " + ".join(pieces) if pieces else "0"


def _latest_weight_expr() -> str:
    columns = [
        "Peso Med.-42", "Peso Med.-35", "Peso Med.-28",
        "Peso Med.-21", "Peso Med.-14", "Peso Med.-07", "Ps Pinto",
    ]
    available = [_num(c) for c in columns if c in _columns]
    return "COALESCE(" + ", ".join(available) + ")" if available else "NULL"


def _list(value):
    if value is None or value == "":
        return []
    if isinstance(value, (list, tuple, set)):
        return [item for item in value if item not in (None, "")]
    return [value]


def _where(filters: dict, exclude: Optional[str] = None) -> tuple[str, list]:
    conditions = []
    params = []

    for key, column in DIMENSOES.items():
        if key == exclude:
            continue
        values = _list(filters.get(key))
        if not values:
            continue
        placeholders = ", ".join("?" for _ in values)
        conditions.append(f'CAST("{column}" AS VARCHAR) IN ({placeholders})')
        params.extend(str(v) for v in values)

    if exclude != "faixa_idade":
        ranges = [_ for _ in _list(filters.get("faixa_idade")) if _ in FAIXAS_IDADE]
        if ranges:
            age_conditions = []
            for value in ranges:
                low, high = FAIXAS_IDADE[value]
                age_conditions.append("(idade_atual BETWEEN ? AND ?)")
                params.extend([low, high])
            conditions.append("(" + " OR ".join(age_conditions) + ")")

    if not conditions:
        return "", params
    return " WHERE " + " AND ".join(conditions), params


def _base_cte() -> str:
    deaths = _sum_existing("Qtde Mort Sem")
    discards = _sum_existing("Qtde Desc Sem")
    initial = f"COALESCE({_num('Aves Inicia')}, 0)"
    current = f"GREATEST(({initial}) - ({deaths}) - ({discards}), 0)"
    weight = _latest_weight_expr()

    return f"""
        WITH latest AS (
            SELECT MAX(TRY_CAST("Data_Analise" AS DATE)) AS data_analise
            FROM "{CACHE_TABLE}"
            WHERE TRY_CAST("Data_Analise" AS DATE) IS NOT NULL
        ),
        ranked AS (
            SELECT
                *,
                DATEDIFF('day', TRY_CAST("Data Recepcao" AS DATE), TRY_CAST("Data_Analise" AS DATE)) AS idade_atual,
                {initial} AS aves_alojadas,
                ({deaths}) AS mortes_acumuladas,
                ({discards}) AS descartes_acumulados,
                {current} AS aves_atuais,
                {weight} AS peso_atual,
                ROW_NUMBER() OVER (
                    PARTITION BY CAST("Codigo Granja" AS VARCHAR), CAST("Num Lote" AS VARCHAR), CAST("Galp" AS VARCHAR)
                    ORDER BY TRY_CAST("Data_Analise" AS TIMESTAMP) DESC,
                             TRY_CAST("Periodo_Arquivo_Fim" AS TIMESTAMP) DESC NULLS LAST
                ) AS rn
            FROM "{CACHE_TABLE}", latest
            WHERE TRY_CAST("Data_Analise" AS DATE) = latest.data_analise
        ),
        base AS (
            SELECT *
            FROM ranked
            WHERE rn = 1
              AND idade_atual BETWEEN 0 AND {IDADE_MAXIMA}
        )
    """


def _filters_dict(tecnico=None, granja=None, galpao=None, linhagem=None, tipo_granja=None, faixa_idade=None):
    return {
        "tecnico": tecnico,
        "granja": granja,
        "galpao": galpao,
        "linhagem": linhagem,
        "tipo_granja": tipo_granja,
        "faixa_idade": faixa_idade,
    }


@router.get("/info")
def info():
    path = _ensure_cache()
    with _lock:
        latest, count = _con.execute(
            f"""{_base_cte()}
            SELECT MAX(TRY_CAST("Data_Analise" AS DATE)), COUNT(*) FROM base
            """
        ).fetchone()
    return jsonable_encoder({
        "arquivo": path.name,
        "atualizado_em": _updated_at(path),
        "cache_carregado_em": _loaded_at,
        "data_analise": latest,
        "idade_maxima": IDADE_MAXIMA,
        "lotes_snapshot": count,
    })


@router.get("/formulas")
def formulas():
    return {"metricas": FORMULAS_LOTES}


@router.get("/filtros")
def filtros(
    tecnico: Optional[list[str]] = Query(None),
    granja: Optional[list[str]] = Query(None),
    galpao: Optional[list[str]] = Query(None),
    linhagem: Optional[list[str]] = Query(None),
    tipo_granja: Optional[list[str]] = Query(None),
    faixa_idade: Optional[list[str]] = Query(None),
):
    _ensure_cache()
    filters = _filters_dict(tecnico, granja, galpao, linhagem, tipo_granja, faixa_idade)
    response = {}

    with _lock:
        for key, column in DIMENSOES.items():
            where_sql, params = _where(filters, exclude=key)
            rows = _con.execute(
                f"""{_base_cte()}
                SELECT DISTINCT CAST("{column}" AS VARCHAR) AS valor
                FROM base
                {where_sql}
                {'AND' if where_sql else 'WHERE'} "{column}" IS NOT NULL
                  AND TRIM(CAST("{column}" AS VARCHAR)) <> ''
                ORDER BY valor
                """,
                params,
            ).fetchall()
            response[key] = [row[0] for row in rows]

        where_age, params_age = _where(filters, exclude="faixa_idade")
        available_ages = _con.execute(
            f"""{_base_cte()}
            SELECT MIN(idade_atual), MAX(idade_atual)
            FROM base {where_age}
            """,
            params_age,
        ).fetchone()

    min_age, max_age = available_ages
    response["faixa_idade"] = [
        {"valor": key, "nome": f"{low}–{high} dias"}
        for key, (low, high) in FAIXAS_IDADE.items()
        if min_age is not None and max_age is not None and high >= min_age and low <= max_age
    ]
    return response


@router.get("/resumo")
def resumo(
    tecnico: Optional[list[str]] = Query(None),
    granja: Optional[list[str]] = Query(None),
    galpao: Optional[list[str]] = Query(None),
    linhagem: Optional[list[str]] = Query(None),
    tipo_granja: Optional[list[str]] = Query(None),
    faixa_idade: Optional[list[str]] = Query(None),
):
    path = _ensure_cache()
    filters = _filters_dict(tecnico, granja, galpao, linhagem, tipo_granja, faixa_idade)
    where_sql, params = _where(filters)

    with _lock:
        metrics = _con.execute(
            f"""{_base_cte()}
            SELECT
                COUNT(*) AS lotes_criacao,
                SUM(aves_alojadas) AS aves_alojadas,
                SUM(aves_atuais) AS aves_atuais,
                CASE WHEN SUM(aves_alojadas) > 0
                    THEN SUM(mortes_acumuladas) / SUM(aves_alojadas) * 100
                    ELSE NULL END AS mortalidade,
                CASE WHEN SUM(CASE WHEN peso_atual IS NOT NULL THEN aves_atuais ELSE 0 END) > 0
                    THEN SUM(CASE WHEN peso_atual IS NOT NULL THEN peso_atual * aves_atuais ELSE 0 END)
                         / SUM(CASE WHEN peso_atual IS NOT NULL THEN aves_atuais ELSE 0 END)
                    ELSE NULL END AS peso_medio,
                MAX(TRY_CAST("Data_Analise" AS DATE)) AS data_analise
            FROM base
            {where_sql}
            """,
            params,
        ).fetchone()

        rows = _con.execute(
            f"""{_base_cte()}
            SELECT
                CAST("Codigo Granja" AS VARCHAR) AS codigo_granja,
                CAST("Nome Granja" AS VARCHAR) AS granja,
                CAST("Num Lote" AS VARCHAR) AS lote,
                CAST("Galp" AS VARCHAR) AS galpao,
                CAST("Técnico" AS VARCHAR) AS tecnico,
                CAST("Linhagem" AS VARCHAR) AS linhagem,
                CAST("Tipo Granja" AS VARCHAR) AS tipo_granja,
                idade_atual,
                aves_alojadas,
                aves_atuais,
                CASE WHEN aves_alojadas > 0 THEN mortes_acumuladas / aves_alojadas * 100 ELSE NULL END AS mortalidade,
                peso_atual
            FROM base
            {where_sql}
            ORDER BY idade_atual DESC, granja, lote, galpao
            LIMIT 500
            """,
            params,
        ).fetchall()

    columns = [
        "codigo_granja", "granja", "lote", "galpao", "tecnico", "linhagem",
        "tipo_granja", "idade_atual", "aves_alojadas", "aves_atuais", "mortalidade", "peso_atual",
    ]

    cards = {
        "lotes_criacao": metrics[0],
        "aves_alojadas": metrics[1],
        "aves_atuais": metrics[2],
        "mortalidade": metrics[3],
        "peso_medio": metrics[4],
    }

    return jsonable_encoder({
        "arquivo": path.name,
        "data_analise": metrics[5],
        "idade_maxima": IDADE_MAXIMA,
        "cards": cards,
        "lotes": [dict(zip(columns, row)) for row in rows],
    })
