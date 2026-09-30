(() => {
  const allAges = [7, 14, 21, 28, 35, 42];
  const displayAges = [7, 14, 21, 28, 35];
  const mortalityAges = displayAges;
  const calc = window.HISTORICO_CALCULOS;
  if (!calc) throw new Error("historico-calculos.js não foi carregado.");

  const rawRows = Array.isArray(window.LOTES_ABERTOS_ROWS) ? window.LOTES_ABERTOS_ROWS : [];
  const asNumber = calc.number;
  const asTime = value => { const time = Date.parse(String(value || "")); return Number.isFinite(time) ? time : -Infinity; };
  const latestWeightKg = row => {
    const abate = asNumber(row["Ps Abate"]);
    if (abate !== null) return abate;
    for (let i = displayAges.length - 1; i >= 0; i -= 1) {
      const weight = asNumber(row[`Peso Med.-${String(displayAges[i]).padStart(2, "0")}`]);
      if (weight !== null) return weight / 1000;
    }
    return null;
  };

  const latestByLot = new Map();
  rawRows.forEach((row, index) => {
    const identity = [row["Codigo Granja"], row["Num Lote"], row.Galp, row["Data Recepcao"]];
    const key = identity.every(value => value !== null && value !== undefined && String(value).trim() !== "")
      ? JSON.stringify(identity.map(String))
      : `sem-chave:${index}`;
    const previous = latestByLot.get(key);
    if (!previous || asTime(row.Periodo_Arquivo_Fim) >= asTime(previous.Periodo_Arquivo_Fim)) latestByLot.set(key, row);
  });

  const rows = [...latestByLot.values()].map(row => ({
    week: String(row["Semana Ano"] || "").trim(),
    year: String(row.Ano || row.Ano_Analise || "").trim(),
    code: String(row["Codigo Granja"] || "").trim(),
    producer: String(row["Nome Granja"] || "").trim(),
    lot: String(row["Num Lote"] || "").trim(),
    barn: String(row.Galp || "").trim(),
    lineage: String(row.Linhagem || "").trim(),
    arrival: row["Data Recepcao"] || "",
    slaughter: row["Data Abate"] || "",
    birdsInitial: row["Aves Inicia"],
    birdsSlaughter: row["Aves Abate"],
    mortalityFinal: row["Mort. Real"],
    pesoAbate: latestWeightKg(row),
    technician: String(row["Técnico"] || "").trim(),
    model: String(row["Modelo Aviário"] || "").trim(),
    type: String(row["Tipo Granja"] || "").trim(),
    gpd: row.GPD,
    ca: row.CA,
    iep: row.IEP,
    ...Object.fromEntries(allAges.flatMap(age => [
      [`mort${age}`, row[`Qtde Mort Sem-${String(age).padStart(2, "0")}`]],
      [`disc${age}`, row[`Qtde Desc Sem-${String(age).padStart(2, "0")}`]],
      [`weight${age}`, row[`Peso Med.-${String(age).padStart(2, "0")}`]],
    ])),
  }));

  const filterFields = [
    ["type", "Tipo de Granja"],
    ["producer", "Produtor"],
    ["model", "Modelo"],
    ["barn", "Galpão"],
    ["technician", "Técnico"],
    ["lineage", "Mist Linha"],
  ];
  const baseSortKeys = new Set(["week", "barn", "birdsInitial"]);
  const state = {
    year: "2026",
    view: "mortality",
    filters: Object.fromEntries(filterFields.map(([key]) => [key, []])),
    sort: { key: "week", dir: "desc" },
    openWeeks: new Set(), openProducers: new Set(), openBarns: new Set(),
  };

  const $ = id => document.getElementById(id);
  const num = calc.number;
  const fmt = (v, d = 0) => v === null || v === undefined || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = v => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const lotId = r => `${r.year}|${r.week}|${r.code}|${r.lot}|${r.barn}|${r.arrival}|${r.slaughter || ""}`;
  const sum = (rs, key) => calc.sum(rs, key);
  const avg = (rs, fn) => { const vs = rs.map(fn).filter(v => v !== null && Number.isFinite(v)); return vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null; };
  const mortalityAtAge = (rs, age) => calc.mortalityAtAge(rs, age);
  const ageWeight = (rs, age) => calc.averageWeightAtAge(rs, age);
  const mort = r => displayAges.reduce((total, age) => total + (num(r[`mort${age}`]) || 0) + (num(r[`disc${age}`]) || 0), 0);

  const selectedRows = () => rows.filter(r => String(r.year || "") === state.year && filterFields.every(([key]) => !state.filters[key].length || state.filters[key].includes(String(r[key] || ""))));
  let historyController;
  const historyMatch = (row, filters, exclude) => String(row.year || "") === state.year &&
    filterFields.every(([key]) => key === exclude || !filters[key]?.length || filters[key].includes(String(row[key] || "")));
  function syncHistoryFilters() {
    const selected = historyController.values();
    filterFields.forEach(([key]) => { state.filters[key] = selected[key] || []; });
    state.openWeeks.clear(); state.openProducers.clear(); state.openBarns.clear();
    render();
  }
  async function refreshHistoryFilters() {
    try { await historyController.loadOptions(); syncHistoryFilters(); }
    catch (error) { $("mensagemErroHistorico").textContent = error.message; $("mensagemErroHistorico").classList.remove("hidden"); }
  }

  const metric = (rs, key) => {
    if (!rs.length) return null;
    if (key === "week") return Number(rs[0].week) || 0;
    if (key === "producer") return rs[0].producer || "";
    if (key === "barn") return rs[0].barn || "";
    if (key === "lot") return rs[0].lot || "";
    if (key === "type") return rs[0].type || "";
    if (key === "lineage") return rs[0].lineage || "";
    if (key === "birdsInitial") return sum(rs, "birdsInitial");
    let match = key.match(/^mortDisc(\d+)$/);
    if (match) return mortalityAtAge(rs, Number(match[1])).combined;
    match = key.match(/^mortOnly(\d+)$/);
    if (match) return mortalityAtAge(rs, Number(match[1])).mortality;
    match = key.match(/^disc(\d+)$/);
    if (match) return mortalityAtAge(rs, Number(match[1])).discard;
    match = key.match(/^weight(\d+)$/);
    if (match) return ageWeight(rs, Number(match[1]));
    if (key === "mortality") { const birds = sum(rs, "birdsInitial"); const deaths = rs.reduce((total, row) => total + mort(row), 0); return birds ? deaths / birds * 100 : null; }
    if (key === "weightAbate") return avg(rs, r => num(r.pesoAbate));
    return "";
  };
  const compare = (a, b, key) => { const av = metric(a.rows || a, key), bv = metric(b.rows || b, key); if (av === null && bv === null) return 0; if (av === null) return 1; if (bv === null) return -1; if (typeof av === "number" && typeof bv === "number") return av - bv; return String(av).localeCompare(String(bv), "pt-BR", { numeric: true, sensitivity: "base" }); };
  const sortGroups = groups => groups.sort((a, b) => compare(a, b, state.sort.key) * (state.sort.dir === "asc" ? 1 : -1));
  function groupBy(rs, fn) { const map = new Map(); rs.forEach(r => { const key = fn(r); if (!map.has(key)) map.set(key, []); map.get(key).push(r); }); return [...map.entries()].map(([key, groupRows]) => ({ key, rows: groupRows })); }

  function renderFilters() {
    $("historyFilters").innerHTML = filterFields.map(([key, label]) =>
      `<div class="filter-field"><span>${label}</span><div class="checkbox-multiselect" id="history-filter-${key}"></div></div>`).join("");
    historyController = new FilterController({
      fields: filterFields.map(([key]) => ({ id: `history-filter-${key}`, apiKey: key, multi: true, search: true })),
      filtersEndpoint: "history-local",
      optionsProvider: filters => Object.fromEntries(filterFields.map(([key]) =>
        [key, opcoesDisponiveis(key, rows, filters, historyMatch, row => row[key])])),
      onChange: syncHistoryFilters
    });
    historyController.register();
  }

  const formulaButton = id => `<button class="mini-button" style="float:right;min-width:40px;min-height:40px" type="button" data-historico-formula="${id}" aria-label="Ver fórmula do indicador"><span class="formula-fx">ƒx</span></button>`;
  function renderKpis(rs) {
    const birds = sum(rs, "birdsInitial"), deaths = rs.reduce((total, row) => total + mort(row), 0), weights = avg(rs, r => num(r.pesoAbate));
    $("historyKpis").innerHTML = `<article class="card history-kpi">${formulaButton("lotes")}<span>Lotes consultados</span><strong>${fmt(rs.length)}</strong></article><article class="card history-kpi">${formulaButton("aves")}<span>Aves alojadas</span><strong>${fmt(birds)}</strong></article><article class="card history-kpi">${formulaButton("mortalidade")}<span>Mortalidade acumulada</span><strong>${birds ? fmt(deaths / birds * 100, 2) + "%" : "—"}</strong></article><article class="card history-kpi">${formulaButton("peso_atual")}<span>Peso médio atual</span><strong>${weights === null ? "—" : fmt(weights, 3) + " kg"}</strong></article>`;
  }

  const sortButton = (key, label, numeric = false, extraClass = "") => `<th class="${[numeric ? "num" : "", extraClass].filter(Boolean).join(" ")}"><button type="button" class="history-sort${numeric ? " num" : ""}" data-sort="${key}">${label} <span>↕</span></button></th>`;
  function renderHead() {
    const base = [
      sortButton("week", "Semana"), sortButton("barn", "Galpão", false),
      sortButton("birdsInitial", "Aves Alojadas", true),
    ];
    const metrics = state.view === "mortality"
      ? mortalityAges.flatMap(age => [
          sortButton(`mortDisc${age}`, `%M+D${age}`, true, "history-col-combined"),
          sortButton(`mortOnly${age}`, `%M${age}`, true),
          sortButton(`disc${age}`, `%D${age}`, true),
        ])
      : displayAges.map(age => sortButton(`weight${age}`, `Peso Med. ${age} dias`, true));
    $("historyTableHead").innerHTML = `<tr>${[...base, ...metrics].join("")}</tr>`;
    const table = document.querySelector(".history-table");
    if (table) table.dataset.view = state.view;
  }

  function cell(value, cls = "") { return `<td class="${cls}">${value}</td>`; }
  function metricCells(rs) {
    if (state.view === "mortality") {
      return mortalityAges.flatMap(age => {
        const valuesAtAge = mortalityAtAge(rs, age);
        return [
          cell(valuesAtAge.combined === null ? "—" : fmt(valuesAtAge.combined, 2) + "%", "num history-col-combined"),
          cell(valuesAtAge.mortality === null ? "—" : fmt(valuesAtAge.mortality, 2) + "%", "num"),
          cell(valuesAtAge.discard === null ? "—" : fmt(valuesAtAge.discard, 2) + "%", "num"),
        ];
      }).join("");
    }
    return displayAges.map(age => { const value = ageWeight(rs, age); return cell(value === null ? "—" : fmt(value, 2), "num"); }).join("");
  }

  function rowHtml(rs, level, label, key, icon, extra = "") {
    const birds = sum(rs, "birdsInitial");
    const barnLabel = level >= 2 ? esc(rs[0]?.barn || "—") : "—";
    if (level === 2) return `<tr class="history-row history-level-2"><td>${esc(label)}</td>${cell(barnLabel)}${cell(fmt(birds), "num")}${metricCells(rs)}</tr>`;
    return `<tr class="history-row history-level-${level}"><td><button class="history-expand" type="button" data-expand="${esc(key)}" aria-expanded="${extra ? "true" : "false"}"><span>${icon}</span><span>${esc(label)}</span></button></td>${cell(barnLabel)}${cell(fmt(birds), "num")}${metricCells(rs)}</tr>${extra}`;
  }

  function renderRows() {
    renderHead();
    const filtered = selectedRows(), byWeek = sortGroups(groupBy(filtered, r => `${r.year}|${r.week}`));
    let html = "";
    byWeek.forEach(w => {
      const first = w.rows[0], wkOpen = state.openWeeks.has(w.key), producers = sortGroups(groupBy(w.rows, r => r.producer || "Sem produtor"));
      let children = "";
      if (wkOpen) producers.forEach(p => {
        const pKey = `${w.key}|${p.key}`, pOpen = state.openProducers.has(pKey), barns = sortGroups(groupBy(p.rows, r => r.barn || "Sem galpão"));
        let barnChildren = "";
        if (pOpen) barns.forEach(b => {
          barnChildren += rowHtml(b.rows, 2, `Galpão ${b.key}`, `${pKey}|${b.key}`, "");
        });
        children += rowHtml(p.rows, 1, p.key, pKey, pOpen ? "−" : "+", pOpen ? barnChildren : "");
      });
      html += rowHtml(w.rows, 0, `Semana ${first.week || "—"}/${first.year || "—"}`, w.key, wkOpen ? "−" : "+", wkOpen ? children : "");
    });
    const columnCount = state.view === "mortality" ? 3 + mortalityAges.length * 3 : 3 + displayAges.length;
    $("historyTableBody").innerHTML = html || `<tr><td colspan="${columnCount}" class="history-empty">Nenhum lote encontrado para os filtros selecionados.</td></tr>`;

    const birds = sum(filtered, "birdsInitial");
    const totals = state.view === "mortality"
      ? mortalityAges.flatMap(age => { const valuesAtAge = mortalityAtAge(filtered, age); return [
          `<th class="num history-col-combined">${valuesAtAge.combined === null ? "—" : fmt(valuesAtAge.combined, 2) + "%"}</th>`,
          `<th class="num">${valuesAtAge.mortality === null ? "—" : fmt(valuesAtAge.mortality, 2) + "%"}</th>`,
          `<th class="num">${valuesAtAge.discard === null ? "—" : fmt(valuesAtAge.discard, 2) + "%"}</th>`,
        ]; }).join("")
      : displayAges.map(age => { const value = ageWeight(filtered, age); return `<th class="num">${value === null ? "—" : fmt(value, 2)}</th>`; }).join("");
    $("historyTableFoot").innerHTML = `<tr><th colspan="2">Total filtrado</th><th class="num">${fmt(birds)}</th>${totals}</tr>`;

    document.querySelectorAll(".history-sort").forEach(button => {
      const active = button.dataset.sort === state.sort.key;
      button.classList.toggle("active", active);
      button.querySelector("span").textContent = active ? (state.sort.dir === "asc" ? "↑" : "↓") : "↕";
    });
  }

  function renderYearButtons() {
    document.querySelectorAll("[data-history-year]").forEach(button => { const active = button.dataset.historyYear === state.year; button.classList.toggle("active", active); button.setAttribute("aria-checked", String(active)); });
  }
  function renderViewButtons() {
    document.querySelectorAll("[data-history-view]").forEach(button => { const active = button.dataset.historyView === state.view; button.classList.toggle("active", active); button.setAttribute("aria-checked", String(active)); });
  }
  function render() { renderYearButtons(); renderViewButtons(); const rs = selectedRows(); renderKpis(rs); renderRows(); }

  document.addEventListener("click", e => {
    const view = e.target.closest("[data-history-view]");
    if (view) {
      state.view = view.dataset.historyView;
      if (!baseSortKeys.has(state.sort.key)) state.sort = { key: "week", dir: "desc" };
      renderViewButtons(); renderRows();
      return;
    }
    const year = e.target.closest("[data-history-year]");
    if (year) { state.year = year.dataset.historyYear; refreshHistoryFilters(); return; }
    const sort = e.target.closest("[data-sort]");
    if (sort) { state.sort = { key: sort.dataset.sort, dir: state.sort.key === sort.dataset.sort && state.sort.dir === "asc" ? "desc" : "asc" }; renderRows(); return; }
    const expand = e.target.closest("[data-expand]");
    if (!expand) return;
    const key = expand.dataset.expand, level = key.split("|").length;
    const set = level === 2 ? state.openWeeks : level === 3 ? state.openProducers : state.openBarns;
    set.has(key) ? set.delete(key) : set.add(key); renderRows();
  });

  $("limparFiltrosHistorico").addEventListener("click", () => {
    historyController.clear();
    state.year = "2026";
    state.view = "mortality";
    state.sort = { key: "week", dir: "desc" };
    refreshHistoryFilters();
  });

  if (!rows.length) {
    $("mensagemErroHistorico").textContent = "A base local de histórico não foi carregada.";
    $("mensagemErroHistorico").classList.remove("hidden");
  }
  function setupFormulaModal() {
    const modal = $("formulaModalHistorico");
    const close = $("formulaFecharHistorico");
    let opener = null;
    let previousOverflow = "";
    function hide() {
      if (modal.classList.contains("hidden")) return;
      modal.classList.add("hidden");
      document.body.style.overflow = previousOverflow;
      opener?.focus({ preventScroll: true });
    }
    document.addEventListener("click", event => {
      const button = event.target.closest("[data-historico-formula]");
      if (!button) return;
      const metric = calc.formulas.find(item => item.id === (button.dataset.historicoFormula === "tabela" ? `tabela_${state.view === "mortality" ? "mortalidade" : "peso"}` : button.dataset.historicoFormula));
      if (!metric) return;
      opener = button;
      $("formulaTituloHistorico").textContent = metric.nome;
      $("formulaExpressaoHistorico").textContent = metric.formula_exibicao;
      $("formulaDescricaoHistorico").textContent = metric.descricao;
      $("formulaExplicacaoHistorico").innerHTML = FormulaUI.explanation(metric);
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      modal.classList.remove("hidden");
      modal.querySelector(".dialog-card").scrollTop = 0;
      close.focus({ preventScroll: true });
    });
    close.addEventListener("click", hide);
    $("formulaBackdropHistorico").addEventListener("click", hide);
    document.addEventListener("keydown", event => {
      if (modal.classList.contains("hidden")) return;
      if (event.key === "Escape") { event.preventDefault(); hide(); }
      if (event.key === "Tab") { event.preventDefault(); close.focus({ preventScroll: true }); }
    });
  }

  setupFormulaModal();
  renderFilters();
  refreshHistoryFilters();
})();
