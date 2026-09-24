const METRICAS = {
    iep: {
        id: "iep",
        nome: "IEP",
        coluna: "IEP",
        unidade: "",
        tipo_calculo: "media_ponderada",
        ponderador: "Aves Abatidas",
        casas_decimais: 2,
        formula_exibicao: "Σ(IEP × Aves Abatidas) / Σ(Aves Abatidas)",
        formula_dax: `base_dinamica_media_ponderada_iep =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[IEP] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)`,
        descricao: "Média ponderada do IEP pelas Aves Abatidas."
    },

    ca: {
        id: "ca",
        nome: "CA",
        coluna: "CA",
        unidade: "",
        tipo_calculo: "media_ponderada",
        ponderador: "Aves Abatidas",
        casas_decimais: 3,
        formula_exibicao: "Σ(CA × Aves Abatidas) / Σ(Aves Abatidas)",
        formula_dax: `base_dinamica_media_ponderada_ca =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[CA] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)`,
        descricao: "Média ponderada da Conversão Alimentar pelas Aves Abatidas."
    },

    cac: {
        id: "cac",
        nome: "CAC",
        coluna: "CAC",
        unidade: "",
        tipo_calculo: "media_ponderada",
        ponderador: "Aves Abatidas",
        casas_decimais: 3,
        formula_exibicao: "Σ(CAC × Aves Abatidas) / Σ(Aves Abatidas)",
        formula_dax: `base_dinamica_media_ponderada_cac =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[CAC] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)`,
        descricao: "Média ponderada do CAC pelas Aves Abatidas."
    },

    gmd: {
        id: "gmd",
        nome: "GMD",
        coluna: "GMD",
        unidade: "",
        tipo_calculo: "media_ponderada",
        ponderador: "Aves Abatidas",
        casas_decimais: 2,
        formula_exibicao: "Σ(GMD × Aves Abatidas) / Σ(Aves Abatidas)",
        formula_dax: `base_dinamica_media_ponderada_gmd =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[GMD] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)`,
        descricao: "Média ponderada do GMD pelas Aves Abatidas."
    },

    mortalidade: {
        id: "mortalidade",
        nome: "% Mortalidade",
        coluna: "% Mortalidade",
        unidade: "%",
        tipo_calculo: "media_ponderada",
        ponderador: "Aves Abatidas",
        casas_decimais: 2,
        formula_exibicao: "Σ(% Mortalidade × Aves Abatidas) / Σ(Aves Abatidas)",
        formula_dax: `base_dinamica_media_ponderada_perc_mortalidade =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[% Mortalidade] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)`,
        descricao: "Mortalidade média ponderada pelas Aves Abatidas."
    },

    idade: {
        id: "idade",
        nome: "Idade",
        coluna: "Idade",
        unidade: "dias",
        tipo_calculo: "media_ponderada",
        ponderador: "Aves Abatidas",
        casas_decimais: 1,
        formula_exibicao: "Σ(Idade × Aves Abatidas) / Σ(Aves Abatidas)",
        formula_dax: `base_dinamica_media_ponderada_idade =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[Idade] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)`,
        descricao: "Idade média ponderada pelas Aves Abatidas."
    },

    peso_medio: {
        id: "peso_medio",
        nome: "Peso Médio",
        coluna: "Peso Médio",
        unidade: "",
        tipo_calculo: "media_ponderada",
        ponderador: "Aves Abatidas",
        casas_decimais: 3,
        formula_exibicao: "Σ(Peso Médio × Aves Abatidas) / Σ(Aves Abatidas)",
        formula_dax: `base_dinamica_media_ponderada_peso_m =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[Peso Médio] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)`,
        descricao: "Peso médio ponderado pelas Aves Abatidas."
    },

    vazio: {
        id: "vazio",
        nome: "Vazio",
        coluna: "Vazio",
        unidade: "dias",
        tipo_calculo: "media_ponderada",
        ponderador: "Aves Abatidas",
        casas_decimais: 1,
        formula_exibicao: "Σ(Vazio × Aves Abatidas) / Σ(Aves Abatidas), somente registros com 7 ≤ Vazio ≤ 18",
        formula_dax: `base_dinamica_media_ponderada_vazio =
VAR BaseValida =
    FILTER(base_dinamica_tratado,
        base_dinamica_tratado[Vazio] >= 7 && base_dinamica_tratado[Vazio] <= 18)
RETURN
DIVIDE(
    SUMX(
        BaseValida,
        base_dinamica_tratado[Vazio] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUMX(BaseValida, base_dinamica_tratado[Aves Abatidas])
)`,
        regra_adicional: {
            status: "implementada",
            descricao:
                "Somente registros com 7 ≤ Vazio ≤ 18 participam do numerador e do denominador, sem substituição."
        },
        descricao: "Vazio médio ponderado pelas Aves Abatidas."
    },

    morte_transporte: {
        id: "morte_transporte",
        nome: "% Morte no Transporte",
        coluna: "% Mort. Transporte",
        unidade: "%",
        tipo_calculo: "media_ponderada",
        ponderador: "Aves Abatidas",
        casas_decimais: 2,
        formula_exibicao:
            "Σ(% Mort. Transporte × Aves Abatidas) / Σ(Aves Abatidas)",
        formula_dax: `base_dinamica_media_ponderada_perc_morte_transporte =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[% Mort. Transporte] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)`,
        descricao:
            "Morte no transporte média ponderada pelas Aves Abatidas."
    },

    cac_ref: {
        id: "cac_ref",
        nome: "CAC Ref",
        coluna: "CAC REF",
        unidade: "",
        tipo_calculo: "media_ponderada",
        ponderador: "Aves Abatidas",
        casas_decimais: 3,
        formula_exibicao: "Σ(CAC REF × Aves Abatidas) / Σ(Aves Abatidas)",
        formula_dax: `base_dinamica_media_ponderada_cac_ref =
DIVIDE(
    SUMX(
        base_dinamica_tratado,
        base_dinamica_tratado[CAC REF] * base_dinamica_tratado[Aves Abatidas]
    ),
    SUM(base_dinamica_tratado[Aves Abatidas])
)`,
        descricao: "Média ponderada do CAC de referência pelas Aves Abatidas."
    },

    aves_abatidas: {
        id: "aves_abatidas",
        nome: "Aves Abatidas",
        coluna: "Aves Abatidas",
        unidade: "aves",
        tipo_calculo: "soma",
        casas_decimais: 0,
        formula_exibicao: "Σ(Aves Abatidas)",
        formula_dax: `base_dinamica_sum_aves_abatidas =
SUM(base_dinamica_tratado[Aves Abatidas])`,
        descricao: "Total de aves abatidas no contexto atual de filtros."
    }
};


const BI_METRIC_ORDER = [
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
    "aves_abatidas"
];


function sqlNumero(coluna) {
    const c =
        `"${String(coluna).replaceAll('"', '""')}"`;

    return `
        COALESCE(
            TRY_CAST(${c} AS DOUBLE),
            TRY_CAST(
                REPLACE(
                    TRIM(CAST(${c} AS VARCHAR)),
                    ',',
                    '.'
                )
                AS DOUBLE
            )
        )
    `.trim();
}


function sqlMetrica(metricId) {
    const metrica =
        METRICAS[metricId];

    if (!metrica) {
        throw new Error(
            `Indicador inválido: ${metricId}`
        );
    }

    const valor =
        sqlNumero(
            metrica.coluna
        );

    if (
        metrica.tipo_calculo
        === "soma"
    ) {
        return `SUM(${valor})`;
    }

    if (
        metrica.tipo_calculo
        === "media_ponderada"
    ) {
        const peso =
            sqlNumero(
                metrica.ponderador
            );

        if (metricId === "vazio") {
            const valido = `(${valor}) BETWEEN 7 AND 18`;
            return `SUM(CASE WHEN ${valido} THEN (${valor}) * (${peso}) END)
                / NULLIF(SUM(CASE WHEN ${valido} THEN (${peso}) END), 0)`;
        }

        return `
            SUM((${valor}) * (${peso}))
            /
            NULLIF(SUM(${peso}), 0)
        `.trim();
    }

    throw new Error(
        `Tipo de cálculo não suportado: ${metrica.tipo_calculo}`
    );
}

window.METRICAS = METRICAS;
window.BI_METRIC_ORDER = BI_METRIC_ORDER;
