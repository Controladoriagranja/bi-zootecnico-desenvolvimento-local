"""Regras compartilhadas pelo cache da API e pela exportação offline do RxP."""
from pathlib import Path

DIMENSOES = {
    "data": "Data", "destino": "Destino", "produtor": "Integrado",
    "tecnico": "Técnico", "tipo_granja": "Tipo Granja", "modelo": "Modelo Aviário",
}
CAMPOS = {"data": "data", "destino": "destino", "produtor": "produtor",
          "tecnico": "tecnico", "tipo_granja": "tipoGranja", "modelo": "modelo"}
SEM_TECNICO = "Sem técnico vinculado"
FORMULAS_RXP = [
    {"id": key, "nome": col, "unidade": "aves", "formula_exibicao": f"Σ([{col}])",
     "descricao": f"Soma da coluna {col} no contexto dos filtros. Valor lido diretamente do Parquet; a diferença não é recalculada.",
     "colunas": [col], "passos": ["Aplicar os filtros selecionados.", f"Somar os valores válidos da coluna {col}."]}
    for key, col in [("programada", "Qtde Programada"), ("real", "Qtde Real"), ("diferenca", "Dif Qtde RxP")]
] + [
    {"id": "registros", "nome": "Registros com Diferença", "unidade": "registros",
     "formula_exibicao": "CONTAR registros com [Dif Qtde RxP] válida e diferente de zero",
     "descricao": "Contagem de registros, não de produtores ou lotes distintos. Valores ausentes não contam como diferença.",
     "colunas": ["Dif Qtde RxP"], "passos": ["Aplicar os filtros.", "Contar diferenças válidas, positivas ou negativas."]},
    {"id": "tecnico", "nome": "Último técnico do produtor", "unidade": "",
     "formula_exibicao": "Técnico do registro com maior [Data de Abate] por [Cod Prod]",
     "descricao": "Vínculo por Código ↔ Cod Prod. Sem código correspondente, usa nome normalizado exato somente quando identifica um único produtor. Considera todo o histórico disponível, antes dos filtros RxP, com técnico preenchido. Desempate por Data_Analise, Periodo_Arquivo_Fim e nome do técnico. Sem correspondência segura: Sem técnico vinculado.",
     "colunas": ["Código", "Integrado", "Cod Prod", "Produtor", "Técnico", "Data de Abate"],
     "passos": ["Localizar o produtor pelo código; usar nome exato e unívoco como alternativa.", "Selecionar seu último abate com técnico informado.", "Aplicar o mesmo vínculo em todos os registros RxP desse produtor."]},
]


def path_sql(path):
    return str(Path(path)).replace("\\", "/").replace("'", "''")


def num(column):
    return f'''TRY_CAST(REPLACE(TRIM(CAST(r."{column}" AS VARCHAR)), ',', '.') AS DOUBLE)'''


def load_table(con, rxp_path, base_path, table="rxp_cache"):
    """Carrega e valida as duas fontes numa transação; nunca altera os Parquets."""
    con.execute("BEGIN TRANSACTION")
    try:
        con.execute(f"CREATE OR REPLACE TEMP TABLE rxp_source AS SELECT * FROM read_parquet('{path_sql(rxp_path)}')")
        con.execute(f"CREATE OR REPLACE TEMP TABLE rxp_base_source AS SELECT * FROM read_parquet('{path_sql(base_path)}')")
        for source, required in [
            ("rxp_source", {"Data", "Código", "Integrado", "Galpão", "Lote", "Tipo Granja", "Modelo Aviário", "Destino", "Qtde Programada", "Qtde Real", "Dif Qtde RxP"}),
            ("rxp_base_source", {"Cod Prod", "Produtor", "Técnico", "Data de Abate", "Data_Analise", "Periodo_Arquivo_Fim"}),
        ]:
            columns = {r[0] for r in con.execute(f'DESCRIBE {source}').fetchall()}
            missing = required - columns
            if missing:
                raise ValueError(f"{source}: colunas ausentes: {', '.join(sorted(missing))}")
        # Código é a identidade principal; nomes são apenas alternativa EXATA e unívoca.
        # Não se tenta casar prefixos, pois produtores diferentes podem ter nomes parecidos.
        con.execute(f'''
            CREATE OR REPLACE TABLE {table} AS
            WITH base_normalizada AS (
                SELECT *, NULLIF(TRIM("Cod Prod"), '') AS codigo,
                    UPPER(REGEXP_REPLACE(TRIM("Produtor"), '\\s+', ' ', 'g')) AS nome,
                    COALESCE(NULLIF(TRIM("Cod Prod"), ''), 'nome:' || UPPER(TRIM("Produtor"))) AS identidade
                FROM rxp_base_source
            ), nomes_unicos AS (
                SELECT nome, MIN(identidade) AS identidade
                FROM base_normalizada WHERE nome IS NOT NULL AND nome <> ''
                GROUP BY nome HAVING COUNT(DISTINCT identidade) = 1
            ), ultimos AS (
                SELECT identidade, codigo, TRIM("Técnico") AS tecnico,
                       CAST("Data de Abate" AS DATE) AS data_tecnico
                FROM base_normalizada
                WHERE NULLIF(TRIM("Técnico"), '') IS NOT NULL
                  AND TRY_CAST("Data de Abate" AS DATE) IS NOT NULL
                QUALIFY ROW_NUMBER() OVER (
                    PARTITION BY identidade
                    ORDER BY "Data de Abate" DESC, "Data_Analise" DESC NULLS LAST,
                             "Periodo_Arquivo_Fim" DESC NULLS LAST, TRIM("Técnico") ASC
                ) = 1
            )
            SELECT CAST(r."Data" AS DATE) AS "Data", TRIM(r."Código") AS "Código",
                TRIM(r."Integrado") AS "Integrado", COALESCE(TRIM(r."Galpão"), '') AS "Galpão",
                COALESCE(TRIM(r."Lote"), '') AS "Lote", COALESCE(TRIM(r."Tipo Granja"), '') AS "Tipo Granja",
                COALESCE(TRIM(r."Modelo Aviário"), '') AS "Modelo Aviário",
                COALESCE(TRIM(r."Destino"), '') AS "Destino",
                {num('Qtde Programada')} AS "Qtde Programada",
                {num('Qtde Real')} AS "Qtde Real",
                {num('Dif Qtde RxP')} AS "Dif Qtde RxP",
                COALESCE(c.tecnico, n.tecnico, '{SEM_TECNICO}') AS "Técnico",
                COALESCE(c.data_tecnico, n.data_tecnico) AS tecnico_data,
                CASE WHEN c.tecnico IS NOT NULL THEN 'codigo'
                     WHEN n.tecnico IS NOT NULL THEN 'nome_exato' ELSE 'sem_vinculo' END AS tecnico_vinculo
            FROM rxp_source r
            LEFT JOIN ultimos c ON NULLIF(TRIM(r."Código"), '') = c.codigo
            LEFT JOIN nomes_unicos nomes ON nomes.nome = UPPER(REGEXP_REPLACE(TRIM(r."Integrado"), '\\s+', ' ', 'g'))
            LEFT JOIN ultimos n ON n.identidade = nomes.identidade AND c.identidade IS NULL
            WHERE TRY_CAST(r."Data" AS DATE) IS NOT NULL
              AND NULLIF(TRIM(r."Integrado"), '') IS NOT NULL
              AND NULLIF(TRIM(r."Galpão"), '') IS NOT NULL
              AND NULLIF(TRIM(r."Lote"), '') IS NOT NULL
        ''')
        con.execute("DROP TABLE rxp_source")
        con.execute("DROP TABLE rxp_base_source")
        con.execute("COMMIT")
    except Exception:
        con.execute("ROLLBACK")
        raise


def select_rows(con, table="rxp_cache", where="", params=None):
    cur = con.execute(f'''
        SELECT CAST("Data" AS VARCHAR) AS data, "Código" AS codigo,
            "Destino" AS destino, "Integrado" AS produtor, "Galpão" AS galpao,
            "Tipo Granja" AS tipoGranja, "Lote" AS lote, "Modelo Aviário" AS modelo,
            "Qtde Programada" AS programada, "Qtde Real" AS real,
            "Dif Qtde RxP" AS difQtdeRxP, "Técnico" AS tecnico,
            CAST(tecnico_data AS VARCHAR) AS tecnico_data, tecnico_vinculo
        FROM {table} {where}
        ORDER BY "Data" DESC, "Destino", "Integrado", "Galpão", "Lote", "Qtde Programada", "Qtde Real", "Dif Qtde RxP"
    ''', params or [])
    columns = [d[0] for d in cur.description]
    return [dict(zip(columns, row)) for row in cur.fetchall()]


def payload(rows, filename):
    return {"arquivo": filename, "rows": rows, "cards": {
        "programada": sum(r["programada"] or 0 for r in rows),
        "real": sum(r["real"] or 0 for r in rows),
        "diferenca": sum(r["difQtdeRxP"] or 0 for r in rows),
        "registrosComDiferenca": sum(r["difQtdeRxP"] is not None and r["difQtdeRxP"] != 0 for r in rows),
    }}
