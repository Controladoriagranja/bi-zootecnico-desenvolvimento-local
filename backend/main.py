from datetime import datetime
from pathlib import Path
from threading import RLock
from typing import Optional

import duckdb
from fastapi import FastAPI, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware

from config import PARQUET_BASE_DINAMICA
from metrics import METRICAS, ORDEM_INDICADORES, sql_metrica
from lotes_criacao import router as lotes_criacao_router


app = FastAPI(title="BI Zootécnico API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(lotes_criacao_router)


MESES = [
    "janeiro", "fevereiro", "março", "abril",
    "maio", "junho", "julho", "agosto",
    "setembro", "outubro", "novembro", "dezembro",
]

CACHE_TABLE = "base_dinamica_cache"

# Regra global do dashboard:
# 2022 e anos anteriores ficam fora dos filtros e cálculos.
ANO_MINIMO = 2023

# Campos reais do Parquet.
DIMENSOES = {
    "status_acerto": "Status Acerto",
    "tipo_granja": "Tipo de Granja",
    "modelo": "Modelo",
    "produtor": "Produtor",
    "tecnico": "Técnico",
    "linhagem": "Linhagem",
    "galpao": "Galpão.1",
}

# Classificação de negócio solicitada:
# se a Linhagem contém '/', consideramos Mista; caso contrário, Pura.
TIPOS_LINHAGEM = {
    "pura": "Pura",
    "mista": "Mista",
}

_cache_lock = RLock()
_cache_con = duckdb.connect(database=":memory:")
_cache_signature: tuple[int, int] | None = None
_cache_columns: set[str] = set()
_cache_data_column: str | None = None
_cache_loaded_at: str | None = None


# ============================================================
# CACHE
# ============================================================

def validar_parquet() -> Path:
    caminho = Path(PARQUET_BASE_DINAMICA)

    if not caminho.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Parquet não encontrado: {caminho}",
        )

    return caminho


def caminho_sql(caminho: Path) -> str:
    return str(caminho).replace("\\", "/").replace("'", "''")


def assinatura_arquivo(caminho: Path) -> tuple[int, int]:
    stat = caminho.stat()
    return stat.st_mtime_ns, stat.st_size


def arquivo_atualizado_em(caminho: Path) -> str:
    return datetime.fromtimestamp(
        caminho.stat().st_mtime
    ).strftime("%d/%m/%Y %H:%M:%S")


def obter_colunas_tabela(
    con: duckdb.DuckDBPyConnection,
    tabela: str,
) -> set[str]:
    return {
        linha[0]
        for linha in con.execute(
            f'DESCRIBE SELECT * FROM "{tabela}"'
        ).fetchall()
    }


def detectar_coluna_data(colunas: set[str]) -> str:
    for candidato in ("Data Abate", "Data de Abate"):
        if candidato in colunas:
            return candidato

    raise HTTPException(
        status_code=500,
        detail=(
            "Não encontrei a coluna de relacionamento com a DimCalendario. "
            "Esperado: 'Data Abate' ou 'Data de Abate'."
        ),
    )


def recarregar_cache(caminho: Path) -> None:
    global _cache_signature
    global _cache_columns
    global _cache_data_column
    global _cache_loaded_at

    sql_path = caminho_sql(caminho)

    try:
        _cache_con.execute(
            f"""
            CREATE OR REPLACE TABLE base_dinamica_cache_novo AS
            SELECT *
            FROM read_parquet('{sql_path}')
            """
        )

        _cache_con.execute(f'DROP TABLE IF EXISTS "{CACHE_TABLE}"')

        _cache_con.execute(
            f"""
            ALTER TABLE base_dinamica_cache_novo
            RENAME TO {CACHE_TABLE}
            """
        )

        _cache_columns = obter_colunas_tabela(
            _cache_con,
            CACHE_TABLE,
        )

        _cache_data_column = detectar_coluna_data(_cache_columns)
        _cache_signature = assinatura_arquivo(caminho)
        _cache_loaded_at = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao carregar cache do Parquet: {exc}",
        ) from exc


def garantir_cache_atualizado() -> tuple[Path, set[str], str]:
    caminho = validar_parquet()
    assinatura = assinatura_arquivo(caminho)

    with _cache_lock:
        if (
            _cache_signature != assinatura
            or not _cache_columns
            or _cache_data_column is None
        ):
            recarregar_cache(caminho)

        return caminho, set(_cache_columns), str(_cache_data_column)


# ============================================================
# FILTROS / SQL
# ============================================================

def parametros_filtros(
    status_acerto=None,
    tipo_granja=None,
    modelo=None,
    produtor=None,
    tecnico=None,
    tipo_linhagem=None,
    linhagem=None,
    galpao=None,
    ano=None,
    mes=None,
    data_inicio=None,
    data_fim=None,
):
    return {
        "status_acerto": status_acerto,
        "tipo_granja": tipo_granja,
        "modelo": modelo,
        "produtor": produtor,
        "tecnico": tecnico,
        "tipo_linhagem": tipo_linhagem,
        "linhagem": linhagem,
        "galpao": galpao,
        "ano": ano,
        "mes": mes,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
    }


def lista_valores(valor):
    if valor is None or valor == "":
        return []

    if isinstance(valor, (list, tuple, set)):
        return [
            item
            for item in valor
            if item is not None
            and item != ""
        ]

    return [valor]


def montar_where(
    coluna_data: str,
    filtros: dict,
    excluir: Optional[str] = None,
) -> tuple[str, list]:
    condicoes = []
    parametros = []

    for chave, coluna in DIMENSOES.items():
        if chave == excluir:
            continue

        valores = lista_valores(
            filtros.get(chave)
        )

        if not valores:
            continue

        placeholders = ", ".join(
            "?"
            for _ in valores
        )

        condicoes.append(
            f'CAST("{coluna}" AS VARCHAR) IN ({placeholders})'
        )

        parametros.extend(
            str(valor)
            for valor in valores
        )

    if excluir != "tipo_linhagem":
        tipos_linhagem = {
            str(item).lower()
            for item in lista_valores(
                filtros.get("tipo_linhagem")
            )
        }

        if tipos_linhagem == {"mista"}:
            condicoes.append(
                """
                "Linhagem" IS NOT NULL
                AND TRIM(CAST("Linhagem" AS VARCHAR)) <> ''
                AND STRPOS(CAST("Linhagem" AS VARCHAR), '/') > 0
                """.strip()
            )

        elif tipos_linhagem == {"pura"}:
            condicoes.append(
                """
                "Linhagem" IS NOT NULL
                AND TRIM(CAST("Linhagem" AS VARCHAR)) <> ''
                AND STRPOS(CAST("Linhagem" AS VARCHAR), '/') = 0
                """.strip()
            )

    data_expr = (
        f'TRY_CAST("{coluna_data}" AS TIMESTAMP)'
    )

    # Regra global do dashboard.
    # Esta condição é aplicada mesmo quando excluir="ano",
    # portanto a própria lista de opções do filtro Ano não pode trazer 2022.
    condicoes.append(
        f"YEAR({data_expr}) >= {ANO_MINIMO}"
    )

    if excluir != "ano":
        anos = [
            int(valor)
            for valor in lista_valores(
                filtros.get("ano")
            )
        ]

        if anos:
            placeholders = ", ".join(
                "?"
                for _ in anos
            )

            condicoes.append(
                f"YEAR({data_expr}) IN ({placeholders})"
            )
            parametros.extend(anos)

    if excluir != "mes":
        meses = [
            int(valor)
            for valor in lista_valores(
                filtros.get("mes")
            )
        ]

        if meses:
            placeholders = ", ".join(
                "?"
                for _ in meses
            )

            condicoes.append(
                f"MONTH({data_expr}) IN ({placeholders})"
            )
            parametros.extend(meses)

    data_inicio = filtros.get("data_inicio")
    data_fim = filtros.get("data_fim")

    if data_inicio not in (None, ""):
        condicoes.append(
            f"CAST({data_expr} AS DATE) >= CAST(? AS DATE)"
        )
        parametros.append(str(data_inicio))

    if data_fim not in (None, ""):
        condicoes.append(
            f"CAST({data_expr} AS DATE) <= CAST(? AS DATE)"
        )
        parametros.append(str(data_fim))

    if not condicoes:
        return "", parametros

    return (
        " WHERE " + " AND ".join(condicoes),
        parametros,
    )


def validar_indicador(indicador: str) -> dict:
    if indicador not in METRICAS:
        raise HTTPException(
            status_code=400,
            detail=f"Indicador inválido: {indicador}",
        )

    return METRICAS[indicador]


# ============================================================
# ENDPOINTS BÁSICOS
# ============================================================

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/zootecnico/info")
def info():
    caminho, _, coluna_data = garantir_cache_atualizado()

    with _cache_lock:
        quantidade, data_minima, data_maxima = _cache_con.execute(
            f'''SELECT COUNT(*),
                       MIN(TRY_CAST("{coluna_data}" AS DATE)),
                       MAX(TRY_CAST("{coluna_data}" AS DATE))
                FROM "{CACHE_TABLE}"'''
        ).fetchone()

    return {
        "ano_minimo": ANO_MINIMO,
        "data_minima": data_minima,
        "data_maxima": data_maxima,
        "arquivo": caminho.name,
        "atualizado_em": arquivo_atualizado_em(caminho),
        "cache_carregado_em": _cache_loaded_at,
        "registros": quantidade,
        "coluna_calendario": coluna_data,
    }


@app.get("/api/zootecnico/cache")
def cache_info():
    caminho, colunas, coluna_data = garantir_cache_atualizado()

    with _cache_lock:
        quantidade = _cache_con.execute(
            f'SELECT COUNT(*) FROM "{CACHE_TABLE}"'
        ).fetchone()[0]

    return {
        "status": "ok",
        "arquivo": caminho.name,
        "arquivo_atualizado_em": arquivo_atualizado_em(caminho),
        "cache_carregado_em": _cache_loaded_at,
        "registros": quantidade,
        "colunas": len(colunas),
        "coluna_calendario": coluna_data,
    }


@app.get("/api/zootecnico/formulas")
def formulas():
    return {
        "metricas": [
            METRICAS[item]
            for item in ORDEM_INDICADORES
        ]
    }


# ============================================================
# FILTROS FACETADOS / DEPENDENTES
# ============================================================

@app.get("/api/zootecnico/filtros")
def filtros(
    status_acerto: Optional[list[str]] = Query(None),
    tipo_granja: Optional[list[str]] = Query(None),
    modelo: Optional[list[str]] = Query(None),
    produtor: Optional[list[str]] = Query(None),
    tecnico: Optional[list[str]] = Query(None),
    tipo_linhagem: Optional[list[str]] = Query(None),
    linhagem: Optional[list[str]] = Query(None),
    galpao: Optional[list[str]] = Query(None),
    ano: Optional[list[int]] = Query(None),
    mes: Optional[list[int]] = Query(None),
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
):
    _, colunas, coluna_data = garantir_cache_atualizado()

    filtros_atuais = parametros_filtros(
        status_acerto=status_acerto,
        tipo_granja=tipo_granja,
        modelo=modelo,
        produtor=produtor,
        tecnico=tecnico,
        tipo_linhagem=tipo_linhagem,
        linhagem=linhagem,
        galpao=galpao,
        ano=ano,
        mes=mes,
        data_inicio=data_inicio,
        data_fim=data_fim,
    )

    resposta = {}

    # Cada faceta respeita todos os outros filtros,
    # mas ignora a própria seleção.
    for chave, coluna in DIMENSOES.items():
        if coluna not in colunas:
            resposta[chave] = []
            continue

        where_sql, params = montar_where(
            coluna_data,
            filtros_atuais,
            excluir=chave,
        )

        sql = f"""
            SELECT DISTINCT
                CAST("{coluna}" AS VARCHAR) AS valor
            FROM "{CACHE_TABLE}"
            {where_sql}
            {'AND' if where_sql else 'WHERE'}
                "{coluna}" IS NOT NULL
                AND TRIM(CAST("{coluna}" AS VARCHAR)) <> ''
            ORDER BY valor
        """

        with _cache_lock:
            valores = _cache_con.execute(sql, params).fetchall()

        resposta[chave] = [linha[0] for linha in valores]

    # Faceta derivada Tipo de Linhagem.
    if "Linhagem" in colunas:
        where_tipo, params_tipo = montar_where(
            coluna_data,
            filtros_atuais,
            excluir="tipo_linhagem",
        )

        sql_tipo = f"""
            SELECT DISTINCT
                CASE
                    WHEN STRPOS(CAST("Linhagem" AS VARCHAR), '/') > 0
                        THEN 'mista'
                    ELSE 'pura'
                END AS valor
            FROM "{CACHE_TABLE}"
            {where_tipo}
            {'AND' if where_tipo else 'WHERE'}
                "Linhagem" IS NOT NULL
                AND TRIM(CAST("Linhagem" AS VARCHAR)) <> ''
            ORDER BY valor
        """

        with _cache_lock:
            tipos = _cache_con.execute(
                sql_tipo,
                params_tipo,
            ).fetchall()

        resposta["tipo_linhagem"] = [
            {
                "valor": linha[0],
                "nome": TIPOS_LINHAGEM.get(linha[0], linha[0]),
            }
            for linha in tipos
        ]
    else:
        resposta["tipo_linhagem"] = []

    data_expr = f'TRY_CAST("{coluna_data}" AS TIMESTAMP)'

    # Ano dependente.
    where_ano, params_ano = montar_where(
        coluna_data,
        filtros_atuais,
        excluir="ano",
    )

    with _cache_lock:
        anos = _cache_con.execute(
            f"""
            SELECT DISTINCT YEAR({data_expr}) AS ano
            FROM "{CACHE_TABLE}"
            {where_ano}
            {'AND' if where_ano else 'WHERE'} {data_expr} IS NOT NULL
                AND YEAR({data_expr}) >= 2023
            ORDER BY ano DESC
            """,
            params_ano,
        ).fetchall()

    resposta["ano"] = [
        int(linha[0])
        for linha in anos
        if (
            linha[0] is not None
            and int(linha[0]) >= 2023
        )
    ]

    resposta["ano"] = [
        int(linha[0])
        for linha in anos
        if (
            linha[0] is not None
            and int(linha[0]) >= 2023
        )
    ]

    # Mês dependente.
    where_mes, params_mes = montar_where(
        coluna_data,
        filtros_atuais,
        excluir="mes",
    )

    with _cache_lock:
        meses = _cache_con.execute(
            f"""
            SELECT DISTINCT MONTH({data_expr}) AS mes
            FROM "{CACHE_TABLE}"
            {where_mes}
            {'AND' if where_mes else 'WHERE'} {data_expr} IS NOT NULL
            ORDER BY mes
            """,
            params_mes,
        ).fetchall()

    resposta["mes"] = [
        {
            "valor": int(linha[0]),
            "nome": MESES[int(linha[0]) - 1],
        }
        for linha in meses
        if linha[0] is not None
    ]

    return resposta


# ============================================================
# PRIMEIRA TELA - DESEMPENHO
# ============================================================

@app.get("/api/zootecnico/desempenho")
def desempenho(
    status_acerto: Optional[list[str]] = Query(None),
    tipo_granja: Optional[list[str]] = Query(None),
    modelo: Optional[list[str]] = Query(None),
    produtor: Optional[list[str]] = Query(None),
    tecnico: Optional[list[str]] = Query(None),
    tipo_linhagem: Optional[list[str]] = Query(None),
    linhagem: Optional[list[str]] = Query(None),
    ano: Optional[list[int]] = Query(None),
    mes: Optional[list[int]] = Query(None),
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
):
    caminho, colunas, coluna_data = garantir_cache_atualizado()

    filtros_atuais = parametros_filtros(
        status_acerto=status_acerto,
        tipo_granja=tipo_granja,
        modelo=modelo,
        produtor=produtor,
        tecnico=tecnico,
        tipo_linhagem=tipo_linhagem,
        linhagem=linhagem,
        ano=ano,
        mes=mes,
        data_inicio=data_inicio,
        data_fim=data_fim,
    )

    for metric_id in ORDEM_INDICADORES:
        coluna = METRICAS[metric_id]["coluna"]
        if coluna not in colunas:
            raise HTTPException(
                status_code=500,
                detail=f"Coluna de métrica não encontrada: {coluna}",
            )

    where_sql, params = montar_where(
        coluna_data,
        filtros_atuais,
    )

    data_expr = f'TRY_CAST("{coluna_data}" AS TIMESTAMP)'

    expressoes = ",\n".join(
        f'{sql_metrica(metric_id)} AS "{metric_id}"'
        for metric_id in ORDEM_INDICADORES
    )

    sql_mensal = f"""
        SELECT
            YEAR({data_expr}) AS ano,
            MONTH({data_expr}) AS mes_numero,
            {expressoes}
        FROM "{CACHE_TABLE}"
        {where_sql}
        {'AND' if where_sql else 'WHERE'} {data_expr} IS NOT NULL
        GROUP BY 1, 2
        ORDER BY 1, 2
    """

    sql_total = f"""
        SELECT
            YEAR({data_expr}) AS ano,
            {expressoes}
        FROM "{CACHE_TABLE}"
        {where_sql}
        {'AND' if where_sql else 'WHERE'} {data_expr} IS NOT NULL
        GROUP BY 1
        ORDER BY 1
    """

    with _cache_lock:
        cur_mensal = _cache_con.execute(sql_mensal, params)
        nomes_mensal = [d[0] for d in cur_mensal.description]
        mensal = [
            dict(zip(nomes_mensal, linha))
            for linha in cur_mensal.fetchall()
        ]

        cur_total = _cache_con.execute(sql_total, params)
        nomes_total = [d[0] for d in cur_total.description]
        totais_linhas = [
            dict(zip(nomes_total, linha))
            for linha in cur_total.fetchall()
        ]

    anos = sorted({
        int(linha["ano"])
        for linha in mensal
        if (
            linha["ano"] is not None
            and int(linha["ano"]) >= ANO_MINIMO
        )
    })

    indicadores = {}

    for metric_id in ORDEM_INDICADORES:
        metrica = METRICAS[metric_id]

        por_ano = {
            str(ano): [None] * 12
            for ano in anos
        }

        for linha in mensal:
            if linha["ano"] is None or linha["mes_numero"] is None:
                continue

            por_ano[str(int(linha["ano"]))][
                int(linha["mes_numero"]) - 1
            ] = linha[metric_id]

        totais = {str(ano): None for ano in anos}

        for linha in totais_linhas:
            if linha["ano"] is not None:
                totais[str(int(linha["ano"]))] = linha[metric_id]

        indicadores[metric_id] = {
            "id": metric_id,
            "nome": metrica["nome"],
            "unidade": metrica.get("unidade", ""),
            "casas_decimais": metrica.get("casas_decimais", 2),
            "por_ano": por_ano,
            "totais": totais,
        }

    return jsonable_encoder({
        "arquivo": caminho.name,
        "atualizado_em": arquivo_atualizado_em(caminho),
        "anos": anos,
        "meses": [
            {"numero": i + 1, "nome": nome}
            for i, nome in enumerate(MESES)
        ],
        "indicadores": indicadores,
    })


# ============================================================
# SEGUNDA TELA - DETALHAMENTO
# ============================================================

@app.get("/api/zootecnico/detalhes")
def detalhes(
    indicador: str,
    status_acerto: Optional[list[str]] = Query(None),
    tipo_granja: Optional[list[str]] = Query(None),
    modelo: Optional[list[str]] = Query(None),
    produtor: Optional[list[str]] = Query(None),
    tecnico: Optional[list[str]] = Query(None),
    tipo_linhagem: Optional[list[str]] = Query(None),
    linhagem: Optional[list[str]] = Query(None),
    galpao: Optional[list[str]] = Query(None),
    ano: Optional[list[int]] = Query(None),
    mes: Optional[list[int]] = Query(None),
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
):
    caminho, colunas, coluna_data = garantir_cache_atualizado()
    metrica = validar_indicador(indicador)

    filtros_atuais = parametros_filtros(
        status_acerto=status_acerto,
        tipo_granja=tipo_granja,
        modelo=modelo,
        produtor=produtor,
        tecnico=tecnico,
        tipo_linhagem=tipo_linhagem,
        linhagem=linhagem,
        galpao=galpao,
        ano=ano,
        mes=mes,
        data_inicio=data_inicio,
        data_fim=data_fim,
    )

    where_sql, params = montar_where(
        coluna_data,
        filtros_atuais,
    )

    data_expr = f'TRY_CAST("{coluna_data}" AS TIMESTAMP)'
    expr = sql_metrica(indicador)

    # KPI no contexto atual.
    with _cache_lock:
        valor = _cache_con.execute(
            f"""
            SELECT {expr} AS valor
            FROM "{CACHE_TABLE}"
            {where_sql}
            """,
            params,
        ).fetchone()[0]

    def ranking(coluna: str, limite: int = 20):
        if coluna not in colunas:
            return []

        sql = f"""
            SELECT
                CAST("{coluna}" AS VARCHAR) AS nome,
                {expr} AS valor
            FROM "{CACHE_TABLE}"
            {where_sql}
            {'AND' if where_sql else 'WHERE'}
                "{coluna}" IS NOT NULL
                AND TRIM(CAST("{coluna}" AS VARCHAR)) <> ''
            GROUP BY 1
            HAVING {expr} IS NOT NULL
            ORDER BY valor DESC NULLS LAST
            LIMIT {limite}
        """

        with _cache_lock:
            linhas = _cache_con.execute(sql, params).fetchall()

        return [
            {"nome": linha[0], "valor": linha[1]}
            for linha in linhas
        ]

    ranking_tecnicos = ranking("Técnico")
    ranking_produtores = ranking("Produtor")

    # Evolução: respeita o contexto temporal selecionado.
    sql_evolucao = f"""
        SELECT
            YEAR({data_expr}) AS ano,
            MONTH({data_expr}) AS mes,
            {expr} AS valor
        FROM "{CACHE_TABLE}"
        {where_sql}
        {'AND' if where_sql else 'WHERE'} {data_expr} IS NOT NULL
        GROUP BY 1, 2
        ORDER BY 1, 2
    """

    with _cache_lock:
        evolucao_linhas = _cache_con.execute(
            sql_evolucao,
            params,
        ).fetchall()

    anos_evolucao = sorted({
        int(l[0])
        for l in evolucao_linhas
        if (
            l[0] is not None
            and int(l[0]) >= ANO_MINIMO
        )
    })

    series = []

    for ano_item in anos_evolucao:
        valores = [None] * 12

        for linha in evolucao_linhas:
            if linha[0] is None or linha[1] is None:
                continue

            if int(linha[0]) == ano_item:
                valores[int(linha[1]) - 1] = linha[2]

        series.append({
            "ano": ano_item,
            "valores": valores,
        })

    return jsonable_encoder({
        "arquivo": caminho.name,
        "atualizado_em": arquivo_atualizado_em(caminho),
        "indicador": {
            "id": indicador,
            "nome": metrica["nome"],
            "unidade": metrica.get("unidade", ""),
            "casas_decimais": metrica.get("casas_decimais", 2),
            "valor": valor,
        },
        "ranking_tecnicos": ranking_tecnicos,
        "ranking_produtores": ranking_produtores,
        "evolucao": {
            "meses": [
                {"numero": i + 1, "nome": nome}
                for i, nome in enumerate(MESES)
            ],
            "series": series,
        },
        "filtros": filtros_atuais,
    })
