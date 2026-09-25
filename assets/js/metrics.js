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
        nome: "Peso Médio Ponderado",
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
        descricao: "Média ponderada da coluna [Peso Médio] da base de desempenho, usando [Aves Abatidas] como peso. Não utiliza as colunas semanais [Peso Med.-07] a [Peso Med.-42]."
    },

    vazio: {
        id: "vazio",
        nome: "Vazio",
        coluna: "Vazio",
        unidade: "dias",
        tipo_calculo: "media_ponderada",
        ponderador: "Aves Abatidas",
        casas_decimais: 1,
        formula_exibicao: "Σ(Vazio ajustado × Aves Abatidas) / Σ(Aves Abatidas)",
        formula_dax: `base_dinamica_media_ponderada_vazio =
VAR BaseValida =
    FILTER(base_dinamica_tratado,
        NOT ISBLANK(base_dinamica_tratado[Vazio]) && NOT ISBLANK(base_dinamica_tratado[Aves Abatidas]))
RETURN
DIVIDE(
    SUMX(
        BaseValida,
        IF(base_dinamica_tratado[Vazio] < 7 || base_dinamica_tratado[Vazio] > 18, 14, base_dinamica_tratado[Vazio]) * base_dinamica_tratado[Aves Abatidas]
    ),
    SUMX(BaseValida, base_dinamica_tratado[Aves Abatidas])
)`,
        regra_adicional: {
            status: "implementada",
            descricao:
                "Em cada registro, substitua [Vazio] menor que 7 ou maior que 18 por 14 antes do cálculo. Valores de 7 a 18 são mantidos; valores ausentes continuam fora da média."
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
            const valido = `(${valor}) IS NOT NULL AND (${peso}) IS NOT NULL`;
            const ajustado = `CASE WHEN (${valor}) < 7 OR (${valor}) > 18 THEN 14 ELSE (${valor}) END`;
            return `SUM(CASE WHEN ${valido} THEN (${ajustado}) * (${peso}) END)
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


// Documentação do cálculo local com os nomes físicos das colunas.
Object.values(METRICAS).forEach(metric => {
    metric.colunas = [...new Set([metric.coluna, metric.ponderador].filter(Boolean))];
    if (metric.tipo_calculo === "soma") {
        metric.formula_exibicao = "Σ([" + metric.coluna + "])";
        metric.passos = ["Aplique os filtros atuais e use registros com ano de abate a partir de 2023.", "Some os valores da coluna [" + metric.coluna + "]."];
    } else {
        metric.formula_exibicao = "Σ([" + metric.coluna + "] × [Aves Abatidas]) / Σ([Aves Abatidas])";
        const table = "base_dinamica_tratado";
        const column = table + "[" + metric.coluna + "]";
        const weight = table + "[Aves Abatidas]";
        const valid = "YEAR(" + table + "[Data de Abate]) >= 2023 && NOT ISBLANK(" + column + ") && NOT ISBLANK(" + weight + ")"
            ;
        const adjusted = metric.id === "vazio" ? "IF(" + column + " < 7 || " + column + " > 18, 14, " + column + ")" : column;
        if (metric.id === "vazio") metric.formula_exibicao = "Σ(SE([Vazio] < 7 OU [Vazio] > 18; 14; [Vazio]) × [Aves Abatidas]) / Σ([Aves Abatidas])";
        metric.formula_dax = metric.id + " =\nVAR LinhasValidas = FILTER(" + table + ", " + valid + ")\nRETURN DIVIDE(\n    SUMX(LinhasValidas, " + adjusted + " * " + weight + "),\n    SUMX(LinhasValidas, " + weight + ")\n)";
        metric.passos = [
            "Aplique os filtros atuais e use registros com ano de abate a partir de 2023.",
            "Use apenas linhas com valor válido em [" + metric.coluna + "] e [Aves Abatidas].",
            ...(metric.id === "vazio" ? ["Em cada linha, se [Vazio] < 7 ou [Vazio] > 18, use 14. Mantenha os valores entre 7 e 18, incluindo os limites. Não transforme valores ausentes em 14."] : []),
            metric.id === "vazio" ? "Multiplique o Vazio ajustado por [Aves Abatidas] de cada linha e some os produtos." : "Multiplique [" + metric.coluna + "] por [Aves Abatidas] em cada linha e some os produtos.",
            "Divida pela soma de [Aves Abatidas] dessas mesmas linhas. Se o denominador for zero, mostre —.",
            ...(metric.unidade === "%" ? ["A coluna já contém percentual: não multiplique novamente por 100."] : [])
        ];
    }
});

window.METRICAS = METRICAS;
window.BI_METRIC_ORDER = BI_METRIC_ORDER;
