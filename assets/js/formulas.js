/**
 * MAPA DE FÓRMULAS: ./FORMULAS.md
 * Monta a página de catálogos; não calcula indicadores.
 */
FormulaUI.render(document.getElementById("formulaContainer"), BI_METRIC_ORDER.map(id => METRICAS[id]), "formula-desempenho");
FormulaUI.render(document.getElementById("formulaLotesContainer"), FORMULAS_LOTES, "formula-lotes");

apiGet(APP_CONFIG.endpoints.rxpFormulas).then(result => {
    FormulaUI.render(document.getElementById("formulaRxpContainer"), result.metricas, "rxp");
}).catch(error => { document.getElementById("formulaRxpContainer").textContent = error.message; });

FormulaUI.render(document.getElementById("formulaHistoricoContainer"), HISTORICO_CALCULOS.formulas, "formula-historico");
