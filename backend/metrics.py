METRICAS = {
    "iep": {
        "id": "iep",
        "nome": "IEP",
        "coluna": "IEP",
        "unidade": "",
        "tipo_calculo": "media_ponderada",
        "ponderador": "Aves Abatidas",
        "casas_decimais": 2,
        "formula_exibicao": "Σ(IEP × Aves Abatidas) / Σ(Aves Abatidas)",
        "formula_dax": """base_dinamica_media_ponderada_iep =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[IEP] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)""",
        "descricao": "Média ponderada do IEP pelas Aves Abatidas."
    },
    "ca": {
        "id": "ca",
        "nome": "CA",
        "coluna": "CA",
        "unidade": "",
        "tipo_calculo": "media_ponderada",
        "ponderador": "Aves Abatidas",
        "casas_decimais": 3,
        "formula_exibicao": "Σ(CA × Aves Abatidas) / Σ(Aves Abatidas)",
        "formula_dax": """base_dinamica_media_ponderada_ca =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[CA] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)""",
        "descricao": "Média ponderada da Conversão Alimentar pelas Aves Abatidas."
    },
    "cac": {
        "id": "cac",
        "nome": "CAC",
        "coluna": "CAC",
        "unidade": "",
        "tipo_calculo": "media_ponderada",
        "ponderador": "Aves Abatidas",
        "casas_decimais": 3,
        "formula_exibicao": "Σ(CAC × Aves Abatidas) / Σ(Aves Abatidas)",
        "formula_dax": """base_dinamica_media_ponderada_cac =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[CAC] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)""",
        "descricao": "Média ponderada do CAC pelas Aves Abatidas."
    },
    "gmd": {
        "id": "gmd",
        "nome": "GMD",
        "coluna": "GMD",
        "unidade": "",
        "tipo_calculo": "media_ponderada",
        "ponderador": "Aves Abatidas",
        "casas_decimais": 2,
        "formula_exibicao": "Σ(GMD × Aves Abatidas) / Σ(Aves Abatidas)",
        "formula_dax": """base_dinamica_media_ponderada_gmd =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[GMD] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)""",
        "descricao": "Média ponderada do GMD pelas Aves Abatidas."
    },
    "mortalidade": {
        "id": "mortalidade",
        "nome": "% Mortalidade",
        "coluna": "% Mortalidade",
        "unidade": "%",
        "tipo_calculo": "media_ponderada",
        "ponderador": "Aves Abatidas",
        "casas_decimais": 2,
        "formula_exibicao": "Σ(% Mortalidade × Aves Abatidas) / Σ(Aves Abatidas)",
        "formula_dax": """base_dinamica_media_ponderada_perc_mortalidade =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[% Mortalidade] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)""",
        "descricao": "Mortalidade média ponderada pelas Aves Abatidas."
    },
    "idade": {
        "id": "idade",
        "nome": "Idade",
        "coluna": "Idade",
        "unidade": "dias",
        "tipo_calculo": "media_ponderada",
        "ponderador": "Aves Abatidas",
        "casas_decimais": 1,
        "formula_exibicao": "Σ(Idade × Aves Abatidas) / Σ(Aves Abatidas)",
        "formula_dax": """base_dinamica_media_ponderada_idade =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[Idade] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)""",
        "descricao": "Idade média ponderada pelas Aves Abatidas."
    },
    "peso_medio": {
        "id": "peso_medio",
        "nome": "Peso Médio",
        "coluna": "Peso Médio",
        "unidade": "",
        "tipo_calculo": "media_ponderada",
        "ponderador": "Aves Abatidas",
        "casas_decimais": 3,
        "formula_exibicao": "Σ(Peso Médio × Aves Abatidas) / Σ(Aves Abatidas)",
        "formula_dax": """base_dinamica_media_ponderada_peso_m =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[Peso Médio] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)""",
        "descricao": "Peso médio ponderado pelas Aves Abatidas."
    },
    "vazio": {
        "id": "vazio",
        "nome": "Vazio",
        "coluna": "Vazio",
        "unidade": "dias",
        "tipo_calculo": "media_ponderada",
        "ponderador": "Aves Abatidas",
        "casas_decimais": 1,
        "formula_exibicao": "Σ(Vazio × Aves Abatidas) / Σ(Aves Abatidas)",
        "formula_dax": """base_dinamica_media_ponderada_vazio =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[Vazio] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)""",
        "regra_adicional": {
            "status": "pendente",
            "descricao": "Valores de Vazio menores que 7 ou maiores que 18 precisam de tratamento. O valor/regra substituta ainda não foi definido."
        },
        "descricao": "Vazio médio ponderado pelas Aves Abatidas."
    },
    "morte_transporte": {
        "id": "morte_transporte",
        "nome": "% Morte no Transporte",
        "coluna": "% Mort. Transporte",
        "unidade": "%",
        "tipo_calculo": "media_ponderada",
        "ponderador": "Aves Abatidas",
        "casas_decimais": 2,
        "formula_exibicao": "Σ(% Mort. Transporte × Aves Abatidas) / Σ(Aves Abatidas)",
        "formula_dax": """base_dinamica_media_ponderada_perc_morte_transporte =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[% Mort. Transporte] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)""",
        "descricao": "Morte no transporte média ponderada pelas Aves Abatidas."
    },
    "cac_ref": {
        "id": "cac_ref",
        "nome": "CAC Ref",
        "coluna": "CAC REF",
        "unidade": "",
        "tipo_calculo": "media_ponderada",
        "ponderador": "Aves Abatidas",
        "casas_decimais": 3,
        "formula_exibicao": "Σ(CAC REF × Aves Abatidas) / Σ(Aves Abatidas)",
        "formula_dax": """base_dinamica_media_ponderada_cac_ref =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[CAC REF] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)""",
        "descricao": "Média ponderada do CAC de referência pelas Aves Abatidas."
    },
    "aves_abatidas": {
        "id": "aves_abatidas",
        "nome": "Aves Abatidas",
        "coluna": "Aves Abatidas",
        "unidade": "aves",
        "tipo_calculo": "soma",
        "casas_decimais": 0,
        "formula_exibicao": "Σ(Aves Abatidas)",
        "formula_dax": """base_dinamica_sum_aves_abatidas =
SUM(base_dinamica_tratado[Aves Abatidas])""",
        "descricao": "Total de aves abatidas no contexto atual de filtros."
    }
}

ORDEM_INDICADORES = [
    "iep",
    "ca",
    "cac",
    "gmd",
    "mortalidade",
    "idade",
    "peso_medio",
    "vazio",
    "morte_transporte",
    "cac_ref",
    "aves_abatidas",
]


def sql_numero(coluna: str) -> str:
    """
    Converte uma coluna para DOUBLE de forma tolerante.

    Algumas colunas do Parquet, como Vazio, estão armazenadas como
    VARCHAR mesmo contendo números. Também aceita decimal com vírgula.
    """

    return (
        f"COALESCE("
        f"TRY_CAST(\"{coluna}\" AS DOUBLE), "
        f"TRY_CAST(REPLACE(TRIM(CAST(\"{coluna}\" AS VARCHAR)), ',', '.') AS DOUBLE)"
        f")"
    )


def sql_metrica(metric_id: str) -> str:
    metrica = METRICAS[metric_id]
    coluna = metrica["coluna"]
    valor = sql_numero(coluna)

    if metrica["tipo_calculo"] == "soma":
        return f"SUM({valor})"

    if metrica["tipo_calculo"] == "media_ponderada":
        ponderador = metrica["ponderador"]
        peso = sql_numero(ponderador)

        if metric_id == "vazio":
            # Exclude invalid Vazio from both numerator and denominator only here.
            valido = f"({valor}) BETWEEN 7 AND 18"
            return (
                f"SUM(CASE WHEN {valido} THEN ({valor}) * ({peso}) END) "
                f"/ NULLIF(SUM(CASE WHEN {valido} THEN ({peso}) END), 0)"
            )

        return (
            f"SUM(({valor}) * ({peso})) "
            f"/ NULLIF(SUM({peso}), 0)"
        )

    raise ValueError(
        f"Tipo de cálculo não suportado: {metrica['tipo_calculo']}"
    )
