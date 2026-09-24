from pathlib import Path
import json
import duckdb

ROOT = Path(__file__).resolve().parents[1]
PARQUET = ROOT / "data" / "indice_zootecnico_mortalidade_peso_lotes_abertos_tratado.parquet"
OUTPUT = ROOT / "data" / "lotes_local.js"

if not PARQUET.exists():
    raise SystemExit(f"Parquet não encontrado: {PARQUET}")

con = duckdb.connect(database=":memory:")
columns = {row[0] for row in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{PARQUET.as_posix()}')").fetchall()}

def num(col):
    return f'TRY_CAST(REPLACE(TRIM(CAST("{col}" AS VARCHAR)), \',\', \'.\') AS DOUBLE)'

def sum_existing(prefix):
    parts = []
    for age in (7, 14, 21, 28, 35, 42):
        col = f"{prefix}-{age:02d}"
        if col in columns:
            parts.append(f"COALESCE({num(col)}, 0)")
    return " + ".join(parts) if parts else "0"

weights = [c for c in ["Peso Med.-42", "Peso Med.-35", "Peso Med.-28", "Peso Med.-21", "Peso Med.-14", "Peso Med.-07", "Ps Pinto"] if c in columns]
weight_expr = "COALESCE(" + ", ".join(num(c) for c in weights) + ")" if weights else "NULL"
deaths = sum_existing("Qtde Mort Sem")
discards = sum_existing("Qtde Desc Sem")
initial = f"COALESCE({num('Aves Inicia')}, 0)"
current = f"GREATEST(({initial}) - ({deaths}) - ({discards}), 0)"

sql = f'''
WITH source AS (
    SELECT * FROM read_parquet('{PARQUET.as_posix()}')
), latest AS (
    SELECT MAX(TRY_CAST("Data_Analise" AS DATE)) AS data_analise FROM source
), ranked AS (
    SELECT *,
        DATEDIFF('day', TRY_CAST("Data Recepcao" AS DATE), TRY_CAST("Data_Analise" AS DATE)) AS idade_atual,
        {initial} AS aves_alojadas,
        ({deaths}) AS mortes_acumuladas,
        ({discards}) AS descartes_acumulados,
        {current} AS aves_atuais,
        {weight_expr} AS peso_atual,
        ROW_NUMBER() OVER (
            PARTITION BY CAST("Codigo Granja" AS VARCHAR), CAST("Num Lote" AS VARCHAR), CAST("Galp" AS VARCHAR)
            ORDER BY TRY_CAST("Data_Analise" AS TIMESTAMP) DESC,
                     TRY_CAST("Periodo_Arquivo_Fim" AS TIMESTAMP) DESC NULLS LAST
        ) AS rn
    FROM source, latest
    WHERE TRY_CAST("Data_Analise" AS DATE) = latest.data_analise
), base AS (
    SELECT * FROM ranked WHERE rn = 1 AND idade_atual BETWEEN 0 AND 45
)
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
    mortes_acumuladas,
    descartes_acumulados,
    aves_atuais,
    CASE WHEN aves_alojadas > 0 THEN mortes_acumuladas / aves_alojadas * 100 ELSE NULL END AS mortalidade,
    peso_atual,
    TRY_CAST("Data_Analise" AS DATE) AS data_analise
FROM base
ORDER BY idade_atual DESC, granja, lote, galpao
'''

cur = con.execute(sql)
cols = [desc[0] for desc in cur.description]
rows_raw = cur.fetchall()
rows = []
for values in rows_raw:
    row = {}
    for key, value in zip(cols, values):
        if hasattr(value, "isoformat"):
            value = value.isoformat()
        row[key] = value
    rows.append(row)

data_analise = rows[0]["data_analise"] if rows else None
for row in rows:
    row.pop("data_analise", None)

payload = {
    "gerado": True,
    "arquivo": PARQUET.name,
    "data_analise": data_analise,
    "lotes": rows,
}
OUTPUT.write_text("window.LOCAL_LOTES_DATA = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(f"OK: {len(rows)} lotes gravados em {OUTPUT}")
