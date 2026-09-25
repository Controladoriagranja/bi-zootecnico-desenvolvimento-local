const params =
    new URLSearchParams(
        window.location.search
    );


let metricId =
    params.get("indicador")
    || "gmd";

let metricCatalog = [];


const DETAIL_FILTERS = [
    {
        id: "ano",
        apiKey: "ano",
        search: false,
        multi: true
    },
    {
        id: "mes",
        apiKey: "mes",
        search: false,
        multi: true
    },
    {
        id: "produtor",
        apiKey: "produtor",
        search: true,
        multi: true
    },
    {
        id: "tecnico",
        apiKey: "tecnico",
        search: true,
        multi: true
    },
    {
        id: "galpao",
        apiKey: "galpao",
        search: true,
        multi: true
    }
];


const inheritedKeys = [
    "status_acerto",
    "tipo_granja",
    "modelo",
    "tipo_linhagem",
    "linhagem"
];


let detalhesData = null;
let requestController = null;


function semAno2022(series) {
    return (series || []).filter(
        item => Number(item.ano) >= 2023
    );
}


const filters = new FilterController({
    fields: DETAIL_FILTERS,

    onChange: () => {
        atualizarUrl();
        carregarDetalhes(false);
    },

    includeDependentRefresh: true,

    contextProvider: () => ({
        ...inheritedFilters()
    })
});


function inheritedFilters() {
    const result = {};

    inheritedKeys.forEach(key => {
        const values =
            params
                .getAll(key)
                .filter(Boolean);

        if (values.length > 1) {
            result[key] = values;
        }
        else if (values.length === 1) {
            result[key] = values[0];
        }
    });

    return result;
}


function allFilters() {
    return {
        ...inheritedFilters(),
        ...filters.values()
    };
}


async function carregarIndicadores() {
    const response =
        await apiGet(
            APP_CONFIG.endpoints.formulas
        );

    metricCatalog =
        Array.isArray(response.metricas)
            ? response.metricas
            : [];

    metricCatalog = metricCatalog.filter(metric => BI_METRIC_ORDER.includes(metric.id));
    if (!metricCatalog.some(metric => metric.id === metricId)) metricId = "gmd";

    const select =
        document.getElementById(
            "indicador"
        );

    select.innerHTML = "";

    metricCatalog.forEach(metric => {
        const option =
            document.createElement(
                "option"
            );

        option.value = metric.id;
        option.textContent = metric.nome;
        option.selected =
            metric.id === metricId;

        select.appendChild(option);
    });

    select.value = metricId;
}


function registrarIndicador() {
    document
        .getElementById(
            "indicador"
        )
        .addEventListener(
            "change",
            () => {
                metricId =
                    document
                        .getElementById(
                            "indicador"
                        )
                        .value;

                atualizarUrl();
                carregarDetalhes(false);
            }
        );
}


function atualizarUrl() {
    const next =
        new URLSearchParams();

    next.set(
        "indicador",
        metricId
    );

    Object.entries(
        allFilters()
    ).forEach(
        ([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach(item => {
                    next.append(key, item);
                });
                return;
            }

            if (value) {
                next.set(key, value);
            }
        }
    );

    history.replaceState(
        null,
        "",
        `${location.pathname}?${next.toString()}`
    );
}


function formatMetric(
    value,
    metric
) {
    if (
        value === null
        || value === undefined
    ) {
        return "—";
    }

    const number = Number(value);

    if (Number.isNaN(number)) {
        return "—";
    }

    if (metric.unidade === "aves") {
        return number.toLocaleString(
            "pt-BR",
            {
                maximumFractionDigits: 0
            }
        );
    }

    const digits =
        Number.isInteger(
            metric.casas_decimais
        )
            ? metric.casas_decimais
            : 2;

    return number.toLocaleString(
        "pt-BR",
        {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        }
    );
}


function render() {
    if (!detalhesData) {
        return;
    }

    const metric =
        detalhesData.indicador;

    FormulaUI.render(document.getElementById("formulaIndicador"), [METRICAS[metric.id]], "formula-detalhe");

    document
        .getElementById(
            "tituloDetalhes"
        )
        .textContent =
        `Detalhamento • ${metric.nome}`;

    document
        .getElementById(
            "subtituloDetalhes"
        )
        .textContent =
        "Rankings e evolução usando a mesma fórmula oficial do indicador.";

    document
        .getElementById(
            "ultimaAtualizacao"
        )
        .textContent =
        detalhesData.atualizado_em
        || "—";

    document
        .getElementById(
            "kpiNome"
        )
        .textContent =
        metric.nome;

    document
        .getElementById(
            "kpiValor"
        )
        .textContent =
        formatMetric(
            metric.valor,
            metric
        );

    document
        .getElementById(
            "tituloEvolucao"
        )
        .textContent =
        `Evolução de ${metric.nome}`;

    ZooCharts.ranking(
        rankingTecnicosChart,
        detalhesData.ranking_tecnicos,
        metric.nome,
        metric.unidade
    );

    ZooCharts.ranking(
        rankingProdutoresChart,
        detalhesData.ranking_produtores,
        metric.nome,
        metric.unidade
    );

    ZooCharts.evolution(
        evolucaoChart,
        detalhesData.evolucao,
        metric.nome
    );
}


async function carregarDetalhes(
    initial = false
) {
    if (requestController) {
        requestController.abort();
    }

    requestController =
        new AbortController();

    document
        .getElementById(
            "dashboardAtualizando"
        )
        .classList
        .remove("hidden");

    try {
        detalhesData =
            await apiGet(
                APP_CONFIG
                    .endpoints
                    .detalhes,
                {
                    indicador: metricId,
                    ...allFilters()
                },
                {
                    signal:
                        requestController
                            .signal
                }
            );

        render();
    }
    catch (error) {
        if (
            error.name
            === "AbortError"
        ) {
            return;
        }

        console.error(error);

        const el =
            document.getElementById(
                "mensagemErro"
            );

        el.textContent =
            error.message
            || "Falha ao carregar detalhamento.";

        el.classList.remove("hidden");
    }
    finally {
        document
            .getElementById(
                "dashboardAtualizando"
            )
            .classList
            .add("hidden");
    }
}


const rankingTecnicosChart =
    ZooCharts.init(
        document.getElementById(
            "rankingTecnicos"
        )
    );


const rankingProdutoresChart =
    ZooCharts.init(
        document.getElementById(
            "rankingProdutores"
        )
    );


const evolucaoChart =
    ZooCharts.init(
        document.getElementById(
            "evolucaoChart"
        )
    );


rankingTecnicosChart.on(
    "click",
    async paramsChart => {
        filters.set(
            "tecnico",
            paramsChart.name
        );

        await filters.loadOptions({
            preserve: true
        });

        atualizarUrl();
        carregarDetalhes(false);
    }
);


rankingProdutoresChart.on(
    "click",
    async paramsChart => {
        filters.set(
            "produtor",
            paramsChart.name
        );

        await filters.loadOptions({
            preserve: true
        });

        atualizarUrl();
        carregarDetalhes(false);
    }
);


document.addEventListener(
    "charts:theme-refresh",
    () => {
        render();
    }
);


document
    .getElementById(
        "limparFiltrosDetalhes"
    )
    .addEventListener(
        "click",
        async () => {
            filters.clear();

            await filters.loadOptions({
                preserve: false
            });

            atualizarUrl();
            carregarDetalhes(false);
        }
    );


async function aplicarParametrosUrl() {
    DETAIL_FILTERS.forEach(field => {
        const values =
            params
                .getAll(field.apiKey)
                .filter(Boolean);

        if (values.length) {
            filters.set(
                field.apiKey,
                field.multi
                    ? values
                    : values[0]
            );
        }
    });


}


async function iniciar() {
    await carregarIndicadores();
    registrarIndicador();
    filters.register();

    // Carrega opções respeitando os filtros herdados da primeira página.
    await filters.loadOptions({
        preserve: false
    });

    await aplicarParametrosUrl();

    await filters.loadOptions({
        preserve: true
    });

    atualizarUrl();
    await carregarDetalhes(true);
}


iniciar();
