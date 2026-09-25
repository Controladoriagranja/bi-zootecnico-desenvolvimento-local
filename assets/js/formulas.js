FormulaUI.render(document.getElementById("formulaContainer"), BI_METRIC_ORDER.map(id => METRICAS[id]), "formula-desempenho");
FormulaUI.render(document.getElementById("formulaLotesContainer"), FORMULAS_LOTES, "formula-lotes");

apiGet(APP_CONFIG.endpoints.rxpFormulas).then(result => {
    FormulaUI.render(document.getElementById("formulaRxpContainer"), result.metricas, "rxp");
}).catch(error => { document.getElementById("formulaRxpContainer").textContent = error.message; });
