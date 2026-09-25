(() => {
  const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  function explanation(metric) {
    const columns = (metric.colunas || []).map(column => `<code>[${escape(column)}]</code>`).join(" ");
    const steps = (metric.passos || []).map(step => `<li>${escape(step)}</li>`).join("");
    return `<div class="formula-explanation"><h3>Colunas utilizadas</h3><div class="formula-columns">${columns}</div><h3>Como calcular</h3><ol>${steps}</ol></div>`;
  }
  function render(container, metrics, prefix = "formula") {
    if (!container) return;
    const opened = new Set([...container.querySelectorAll("details[open]")].map(item => item.id));
    container.innerHTML = metrics.filter(Boolean).map(metric => {
      const id = prefix + "-" + metric.id;
      return `<details class="formula-card formula-disclosure" id="${escape(id)}" ${opened.has(id) ? "open" : ""}>
        <summary>Fórmula • ${escape(metric.nome)}</summary>
        <div class="formula-content"><div class="code-inline">${escape(metric.formula_exibicao)}</div>
        <p>${escape(metric.descricao)}</p>${explanation(metric)}
        ${metric.formula_dax ? `<details class="code-details"><summary>Ver DAX de referência</summary><pre><code>${escape(metric.formula_dax)}</code></pre></details>` : ""}
        </div></details>`;
    }).join("");
  }
  document.addEventListener("click", event => {
    const link = event.target.closest("[data-formula-target]");
    if (!link) return;
    const target = document.getElementById(link.dataset.formulaTarget);
    const detail = target?.matches("details") ? target : target?.querySelector("details");
    if (!detail) return;
    event.preventDefault();
    detail.open = true;
    detail.scrollIntoView({ block: "start", behavior: "smooth" });
    detail.querySelector("summary").focus({ preventScroll: true });
  });
  window.FormulaUI = { render, explanation };
})();
