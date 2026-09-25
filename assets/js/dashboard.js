const FIRST_FILTERS = [
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
        id: "status",
        apiKey: "status_acerto",
        search: true,
        multi: true
    },
    {
        id: "tipoGranja",
        apiKey: "tipo_granja",
        search: true,
        multi: true
    },
    {
        id: "modelo",
        apiKey: "modelo",
        search: true,
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
        id: "tipoLinhagem",
        apiKey: "tipo_linhagem",
        search: false,
        multi: true
    },
    {
        id: "linhagem",
        apiKey: "linhagem",
        search: true,
        multi: true
    }
];





let formulasCatalogo = {};
let dashboardData = null;
let performanceController = null;

const sortState = {};


const periodFilter = {
    inicio: document.getElementById("dataInicio"),
    fim: document.getElementById("dataFim")
};

function periodValues() {
    const values = {};

    if (periodFilter.inicio?.value) {
        values.data_inicio = periodFilter.inicio.value;
    }

    if (periodFilter.fim?.value) {
        values.data_fim = periodFilter.fim.value;
    }

    return values;
}

function dashboardFilters() {
    return {
        ...filters.values(),
        ...periodValues()
    };
}

function validPeriod() {
    const values = periodValues();

    if (
        values.data_inicio
        && values.data_fim
        && values.data_inicio > values.data_fim
    ) {
        errorMessage(
            "A data inicial não pode ser maior que a data final."
        );
        return false;
    }

    return true;
}


const filters = new FilterController({
    fields: FIRST_FILTERS,

    onChange: () => {
        carregarDashboard(false);
    },

    includeDependentRefresh: true,

    contextProvider: () => periodValues()
});


function errorMessage(message) {
    const el =
        document.getElementById(
            "mensagemErro"
        );

    el.textContent = message;
    el.classList.remove("hidden");
}


function clearError() {
    document
        .getElementById(
            "mensagemErro"
        )
        .classList
        .add("hidden");
}


function formatValue(value, metric) {
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


function detailUrl(
    metricId,
    ano = null,
    mes = null
) {
    const params =
        new URLSearchParams();

    params.set(
        "indicador",
        metricId
    );

    Object.entries(
        dashboardFilters()
    ).forEach(
        ([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach(item => {
                    params.append(key, item);
                });
                return;
            }

            if (
                value !== null
                && value !== undefined
                && value !== ""
            ) {
                params.set(key, value);
            }
        }
    );

    if (ano) {
        params.set("ano", ano);
    }

    if (mes) {
        params.set("mes", mes);
    }

    return `detalhes.html?${params.toString()}`;
}


function getSort(metricId) {
    if (!sortState[metricId]) {
        sortState[metricId] = {
            key: "mes",
            direction: "asc"
        };
    }

    return sortState[metricId];
}


function toggleSort(
    metricId,
    key
) {
    const state =
        getSort(metricId);

    if (state.key === key) {
        state.direction =
            state.direction === "asc"
                ? "desc"
                : "asc";
    }
    else {
        state.key = key;
        state.direction =
            key === "mes"
                ? "asc"
                : "desc";
    }

    renderDashboard();
}


function sortIcon(
    metricId,
    key
) {
    const state =
        getSort(metricId);

    if (state.key !== key) {
        return "↕";
    }

    return state.direction === "asc"
        ? "↑"
        : "↓";
}



function selectedFilterValues(apiKey) {
    const value =
        filters.values()?.[apiKey];

    if (Array.isArray(value)) {
        return value.map(String);
    }

    if (
        value === null
        || value === undefined
        || value === ""
    ) {
        return [];
    }

    return [String(value)];
}


function visibleYears() {
    const selected =
        selectedFilterValues("ano");

    const available =
        (dashboardData?.anos || [])
            .map(Number)
            .filter(year => year >= 2023);

    if (!selected.length) {
        return available;
    }

    const selectedSet =
        new Set(selected.map(Number));

    return available.filter(
        year =>
            selectedSet.has(Number(year))
    );
}


function visibleMonths() {
    const selected =
        selectedFilterValues("mes");

    const available =
        dashboardData?.meses || [];

    if (!selected.length) {
        return available;
    }

    const selectedSet =
        new Set(selected.map(Number));

    return available.filter(
        month =>
            selectedSet.has(
                Number(month.numero)
            )
    );
}


function rowsFor(
    metricId,
    metric,
    years,
    months
) {
    const rows =
        months.map(
            month => {
                const values = {};

                const sourceIndex =
                    Number(month.numero) - 1;

                years.forEach(year => {
                    values[String(year)] =
                        metric
                            .por_ano?.[
                                String(year)
                            ]?.[sourceIndex]
                        ?? null;
                });

                return {
                    monthNumber:
                        month.numero,
                    monthName:
                        month.nome,
                    values
                };
            }
        );

    const state =
        getSort(metricId);

    const direction =
        state.direction === "asc"
            ? 1
            : -1;

    rows.sort(
        (a, b) => {
            if (state.key === "mes") {
                return (
                    a.monthNumber
                    - b.monthNumber
                ) * direction;
            }

            const av =
                a.values[state.key];
            const bv =
                b.values[state.key];

            const emptyA =
                av === null
                || av === undefined;

            const emptyB =
                bv === null
                || bv === undefined;

            if (emptyA && emptyB) {
                return 0;
            }

            if (emptyA) {
                return 1;
            }

            if (emptyB) {
                return -1;
            }

            return (
                Number(av)
                - Number(bv)
            ) * direction;
        }
    );

    return rows;
}


function metricCard(
    metricId,
    metric
) {
    const card =
        document.createElement(
            "article"
        );

    card.className =
        `metric-card ${
            metricId === "aves_abatidas"
                ? "metric-card-wide"
                : ""
        }`;

    const years =
        visibleYears();

    const months =
        visibleMonths();

    const rows =
        rowsFor(
            metricId,
            metric,
            years,
            months
        );

    const headYears =
        years.map(year => `
            <th>
                <button
                    type="button"
                    class="table-sort-button"
                    data-sort-metric="${metricId}"
                    data-sort-key="${year}"
                >
                    ${year}
                    <span class="sort-icon">
                        ${
                            sortIcon(
                                metricId,
                                String(year)
                            )
                        }
                    </span>
                </button>
            </th>
        `).join("");

    const body =
        rows.map(row => `
            <tr>
                <td class="month-cell">
                    ${row.monthName}
                </td>

                ${
                    years.map(year => {
                        const value =
                            row.values[
                                String(year)
                            ];

                        const content =
                            formatValue(
                                value,
                                metric
                            );

                        if (
                            value === null
                            || value === undefined
                        ) {
                            return `<td>${content}</td>`;
                        }

                        return `
                            <td>
                                <a
                                    class="metric-value-link"
                                    href="${
                                        detailUrl(
                                            metricId,
                                            year,
                                            row.monthNumber
                                        )
                                    }"
                                    title="Abrir detalhamento de ${row.monthName}/${year}"
                                >
                                    ${content}
                                </a>
                            </td>
                        `;
                    }).join("")
                }
            </tr>
        `).join("");

    const totals =
        years.map(year => `
            <td>
                ${
                    formatValue(
                        metric.totais?.[
                            String(year)
                        ],
                        metric
                    )
                }
            </td>
        `).join("");

    card.innerHTML = `
        <header class="metric-card-header">
            <div>
                <h2>${metric.nome}</h2>
                <p>Mensal por ano</p>
            </div>

            <div class="card-actions">
                <button
                    class="mini-button"
                    type="button"
                    data-info-metric="${metricId}"
                    title="Ver fórmula"
                >
                    <span class="formula-fx">ƒx</span>
                </button>

                <a
                    class="details-button"
                    href="${detailUrl(metricId)}"
                >
                    Detalhes →
                </a>
            </div>
        </header>

        <div class="metric-table-wrapper">
            <table class="metric-table">
                <thead>
                    <tr>
                        <th class="month-cell">
                            <button
                                type="button"
                                class="table-sort-button table-sort-button-month"
                                data-sort-metric="${metricId}"
                                data-sort-key="mes"
                            >
                                Mês
                                <span class="sort-icon">
                                    ${
                                        sortIcon(
                                            metricId,
                                            "mes"
                                        )
                                    }
                                </span>
                            </button>
                        </th>

                        ${headYears}
                    </tr>
                </thead>

                <tbody>
                    ${body}

                    <tr class="total-row">
                        <td class="month-cell">
                            Total
                        </td>

                        ${totals}
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    return card;
}


function renderDashboard() {
    if (!dashboardData) {
        return;
    }

    document
        .getElementById(
            "ultimaAtualizacao"
        )
        .textContent =
        dashboardData.atualizado_em
        || "—";

    const container =
        document.getElementById(
            "indicadores"
        );

    container.innerHTML = "";

    BI_METRIC_ORDER.forEach(
        metricId => {
            const metric =
                dashboardData
                    .indicadores?.[
                        metricId
                    ];

            if (metric) {
                container.appendChild(
                    metricCard(
                        metricId,
                        metric
                    )
                );
            }
        }
    );

    document
        .getElementById(
            "loadingDashboard"
        )
        .classList
        .add("hidden");

    container
        .classList
        .remove("hidden");
}


async function carregarDashboard(
    initial = false
) {
    clearError();

    if (performanceController) {
        performanceController.abort();
    }

    performanceController =
        new AbortController();

    try {
        const response =
            await apiGet(
                APP_CONFIG
                    .endpoints
                    .desempenho,
                dashboardFilters(),
                {
                    signal:
                        performanceController
                            .signal
                }
            );

        dashboardData = response;
        renderDashboard();
    }
    catch (error) {
        if (
            error.name ===
            "AbortError"
        ) {
            return;
        }

        console.error(error);
        errorMessage(
            error.message
            || "Falha ao carregar."
        );
    }
}


function abrirFormula(metricId) {
    const metric =
        formulasCatalogo[
            metricId
        ];

    if (!metric) {
        return;
    }

    document.getElementById("formulaModalExplicacao").innerHTML = FormulaUI.explanation(metric);

    document
        .getElementById(
            "formulaModalTitulo"
        )
        .textContent =
        metric.nome;

    document
        .getElementById(
            "formulaModalFormula"
        )
        .textContent =
        metric.formula_exibicao
        || "Não informada";

    document
        .getElementById(
            "formulaModalDescricao"
        )
        .textContent =
        metric.descricao
        || "";

    document
        .getElementById(
            "formulaModalDax"
        )
        .textContent =
        metric.formula_dax
        || "";

    const ponderacao =
        document.getElementById(
            "formulaModalPonderacaoContainer"
        );

    if (metric.ponderador) {
        ponderacao
            .classList
            .remove("hidden");

        document
            .getElementById(
                "formulaModalPonderacao"
            )
            .textContent =
            metric.ponderador;
    }
    else {
        ponderacao
            .classList
            .add("hidden");
    }

    const regra =
        document.getElementById(
            "formulaModalRegraContainer"
        );

    if (metric.regra_adicional) {
        regra.classList.remove("hidden");

        document
            .getElementById(
                "formulaModalRegra"
            )
            .textContent =
            metric
                .regra_adicional
                .descricao || "";
    }
    else {
        regra.classList.add("hidden");
    }

    document
        .getElementById(
            "formulaModal"
        )
        .classList
        .remove("hidden");
}


function fecharFormula() {
    document
        .getElementById(
            "formulaModal"
        )
        .classList
        .add("hidden");
}


document
    .getElementById(
        "limparFiltros"
    )
    .addEventListener(
        "click",
        async () => {
            filters.clear();

            if (periodFilter.inicio) {
                periodFilter.inicio.value = "";
            }

            if (periodFilter.fim) {
                periodFilter.fim.value = "";
            }

            await filters.loadOptions({
                preserve: false
            });
            carregarDashboard(false);
        }
    );


document.addEventListener(
    "click",
    event => {
        const sort =
            event.target.closest(
                "[data-sort-metric]"
            );

        if (sort) {
            toggleSort(
                sort.dataset.sortMetric,
                sort.dataset.sortKey
            );

            return;
        }

        const info =
            event.target.closest(
                "[data-info-metric]"
            );

        if (info) {
            abrirFormula(
                info.dataset.infoMetric
            );
        }
    }
);


document
    .getElementById(
        "formulaModalFechar"
    )
    .addEventListener(
        "click",
        fecharFormula
    );


document
    .getElementById(
        "formulaModalBackdrop"
    )
    .addEventListener(
        "click",
        fecharFormula
    );


async function applyPeriod() {
    clearError();

    if (!validPeriod()) {
        return;
    }

    try {
        await filters.loadOptions({
            preserve: true
        });

        await carregarDashboard(false);
    }
    catch (error) {
        if (error.name !== "AbortError") {
            console.error(error);
            errorMessage(
                error.message
                || "Falha ao aplicar o período."
            );
        }
    }
}

periodFilter.inicio?.addEventListener(
    "change",
    applyPeriod
);

periodFilter.fim?.addEventListener(
    "change",
    applyPeriod
);

document
    .getElementById("limparPeriodo")
    ?.addEventListener(
        "click",
        async () => {
            if (periodFilter.inicio) {
                periodFilter.inicio.value = "";
            }

            if (periodFilter.fim) {
                periodFilter.fim.value = "";
            }

            await applyPeriod();
        }
    );


async function iniciar() {
    try {
        filters.register();

        const [
            formulas
        ] = await Promise.all([
            apiGet(
                APP_CONFIG
                    .endpoints
                    .formulas
            ),
            filters.loadOptions({
                preserve: false
            })
        ]);

        formulasCatalogo = {};

        formulas.metricas.forEach(
            metric => {
                formulasCatalogo[
                    metric.id
                ] = metric;
            }
        );

        await carregarDashboard(true);
    }
    catch (error) {
        console.error(error);
        errorMessage(
            error.message
            || "Falha ao iniciar."
        );
    }
}


iniciar();
