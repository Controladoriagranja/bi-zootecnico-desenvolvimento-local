(() => {
    const els = {
        data: document.getElementById("filtroData"),
        unidade: document.getElementById("filtroUnidade"),
        produtor: document.getElementById("filtroProdutor"),
        tecnico: document.getElementById("filtroTecnico"),
        tipoGranja: document.getElementById("filtroTipoGranja"),
        modelo: document.getElementById("filtroModelo"),
        status: document.getElementById("filtroStatus"),
        limpar: document.getElementById("limparFiltrosAbate"),
        kpiProgramada: document.getElementById("kpiProgramada"),
        kpiReal: document.getElementById("kpiReal"),
        kpiDiferenca: document.getElementById("kpiDiferenca"),
        kpiDiferencaLegenda: document.getElementById("kpiDiferencaLegenda"),
        cardDiferenca: document.getElementById("cardDiferenca"),
        kpiRegistros: document.getElementById("kpiRegistros"),
        tbodyUnidades: document.getElementById("tabelaUnidadesAbate"),
        tfootUnidades: document.getElementById("tabelaUnidadesAbateTotal"),
        modal: document.getElementById("modalAbate"),
        modalBackdrop: document.getElementById("modalAbateBackdrop"),
        modalFechar: document.getElementById("modalAbateFechar"),
        modalTitulo: document.getElementById("modalAbateTitulo"),
        modalSubtitulo: document.getElementById("modalAbateSubtitulo"),
        modalProgramada: document.getElementById("modalProgramada"),
        modalReal: document.getElementById("modalReal"),
        modalDiferenca: document.getElementById("modalDiferenca"),
        tbodyProdutores: document.getElementById("tabelaProdutoresAbate")
    };

    const fmt = value => value === null ? "—" : new Intl.NumberFormat("pt-BR").format(Number(value || 0));
    const fmtSigned = value => `${value > 0 ? "+" : ""}${fmt(value)}`;
    const fmtDate = value => {
        const [year, month, day] = value.split("-");
        return `${day}/${month}/${year}`;
    };
    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    const filterFields = {data: els.data, destino: els.unidade, produtor: els.produtor,
        tecnico: els.tecnico, tipo_granja: els.tipoGranja, modelo: els.modelo, status: els.status};
    const statusLabels = {negativa: "Abaixo do programado", positiva: "Acima do programado", zero: "Sem diferença"};
    const errorBox = document.getElementById("erroRxp");
    const statusBox = document.getElementById("statusRxp");
    let requestId = 0;

    function selectedFilters() {
        return Object.fromEntries(Object.entries(filterFields).map(([key, el]) => [key, el.value]));
    }

    function populateFilters(options) {
        for (const [key, select] of Object.entries(filterFields)) {
            const selected = select.value;
            const values = [...(options[key] || [])];
            // Preserva a seleção explícita mesmo quando a combinação não tem linhas.
            if (selected && !values.includes(selected)) values.push(selected);
            select.innerHTML = '<option value="">Todos</option>' + values.map(value => {
                const label = key === "data" ? fmtDate(value) : key === "status" ? statusLabels[value] : value;
                return `<option value="${escapeHtml(value)}">${escapeHtml(label || value)}</option>`;
            }).join("");
            select.value = selected;
        }
    }

    async function reload() {
        const id = ++requestId;
        statusBox.textContent = "Carregando…";
        document.getElementById("periodoRxp").textContent = els.data.value ? fmtDate(els.data.value) : "";
        errorBox.classList.add("hidden");
        closeModal();
        // Não deixa resultados antigos visíveis sob um novo contexto de filtros.
        [els.kpiProgramada, els.kpiReal, els.kpiDiferenca, els.kpiRegistros].forEach(el => el.textContent = "—");
        els.tbodyUnidades.innerHTML = '<tr><td colspan="6" class="abate-empty">Carregando dados…</td></tr>';
        els.tfootUnidades.innerHTML = "";
        try {
            const params = selectedFilters();
            const [data, options] = await Promise.all([
                apiGet(APP_CONFIG.endpoints.rxp, params),
                apiGet(APP_CONFIG.endpoints.rxpFiltros, params)
            ]);
            if (id !== requestId) return;
            populateFilters(options);
            renderPeriod(data.rows);
            renderKpis(data.rows);
            renderUnits(data.rows);
            statusBox.textContent = `${fmt(data.rows.length)} registros`;
        } catch (error) {
            if (id !== requestId) return;
            statusBox.textContent = "Falha ao carregar";
            errorBox.textContent = error.message || String(error);
            errorBox.classList.remove("hidden");
            els.tbodyUnidades.innerHTML = '<tr><td colspan="6" class="abate-empty">Não foi possível carregar os dados. Altere os filtros ou recarregue a página para tentar novamente.</td></tr>';
        }
    }

    let formulas = window.FORMULAS_RXP || [];
    async function loadFormulas() {
        try { formulas = (await apiGet(APP_CONFIG.endpoints.rxpFormulas)).metricas; }
        catch (error) { console.warn("Usando catálogo local de fórmulas", error); }
    }
    function setupFormulaModal() {
        const modal = document.getElementById("formulaModalRxp");
        const close = document.getElementById("formulaFecharRxp");
        let opener, overflow;
        function hide() {
            if (modal.classList.contains("hidden")) return;
            modal.classList.add("hidden");
            document.body.style.overflow = overflow;
            opener?.focus({preventScroll: true});
        }
        document.addEventListener("click", event => {
            const button = event.target.closest("[data-rxp-formula]");
            if (!button) return;
            const metric = formulas.find(item => item.id === button.dataset.rxpFormula);
            if (!metric) return;
            opener = button;
            document.getElementById("formulaTituloRxp").textContent = metric.nome;
            document.getElementById("formulaExpressaoRxp").textContent = metric.formula_exibicao;
            document.getElementById("formulaDescricaoRxp").textContent = metric.descricao;
            document.getElementById("formulaExplicacaoRxp").innerHTML = FormulaUI.explanation(metric);
            overflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            modal.classList.remove("hidden");
            modal.querySelector(".dialog-card").scrollTop = 0;
            close.focus({preventScroll: true});
        });
        close.addEventListener("click", hide);
        document.getElementById("formulaBackdropRxp").addEventListener("click", hide);
        document.addEventListener("keydown", event => {
            if (modal.classList.contains("hidden")) return;
            if (event.key === "Escape") { event.preventDefault(); hide(); }
            if (event.key === "Tab") { event.preventDefault(); close.focus(); }
        });
    }

    let currentRows = [], currentGroup = null;
    const unitSort = {key: "diferenca", direction: -1, absolute: true};
    const detailSort = {key: "difQtdeRxP", direction: -1, absolute: true};
    const collator = new Intl.Collator("pt-BR", {numeric: true, sensitivity: "base"});
    function sorted(rows, order) {
        return rows.slice().sort((a, b) => {
            let x = a[order.key], y = b[order.key];
            if (x == null) return y == null ? 0 : 1;
            if (y == null) return -1;
            if (order.absolute) { x = Math.abs(x); y = Math.abs(y); }
            return order.direction * (typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y)));
        });
    }
    function setupSort(body, keys, order, refresh) {
        const headers = body.closest("table").querySelectorAll("thead th");
        headers.forEach((th, index) => {
            const key = keys[index];
            if (!key) return;
            const label = th.textContent.trim();
            const button = document.createElement("button");
            button.type = "button";
            button.className = "abate-sort-button";
            button.textContent = label + " ↕";
            button.title = "Ordenar por " + label;
            th.replaceChildren(button);
            button.addEventListener("click", () => {
                order.direction = order.key === key && !order.absolute ? -order.direction : 1;
                order.key = key; order.absolute = false;
                headers.forEach(header => {
                    header.removeAttribute("aria-sort");
                    const btn = header.querySelector("button");
                    if (btn) btn.textContent = btn.textContent.replace(/ [↕↑↓]$/, " ↕");
                });
                th.setAttribute("aria-sort", order.direction === 1 ? "ascending" : "descending");
                button.textContent = label + (order.direction === 1 ? " ↑" : " ↓");
                refresh();
            });
        });
    }

    function renderPeriod(rows) {
        const dates = [...new Set(rows.map(row => row.data).filter(Boolean))].sort();
        document.getElementById("periodoRxp").textContent = els.data.value
            ? fmtDate(els.data.value)
            : dates.length === 0 ? "Sem datas no período"
            : dates.length === 1 ? fmtDate(dates[0])
            : `${fmtDate(dates[0])} a ${fmtDate(dates[dates.length - 1])}`;
    }

    function totals(rows) {
        return rows.reduce((acc, row) => {
            acc.programada += row.programada;
            acc.real += row.real;
            acc.diferenca += row.difQtdeRxP;
            if (row.difQtdeRxP !== null && row.difQtdeRxP !== 0) acc.registrosComDiferenca += 1;
            return acc;
        }, { programada: 0, real: 0, diferenca: 0, registrosComDiferenca: 0 });
    }

    function diffStateClass(value) {
        if (value < 0) return "is-negative";
        if (value > 0) return "is-positive";
        return "is-zero";
    }

    function renderKpis(rows) {
        const t = totals(rows);
        els.kpiProgramada.textContent = fmt(t.programada);
        els.kpiReal.textContent = fmt(t.real);
        els.kpiDiferenca.textContent = fmtSigned(t.diferenca);
        els.kpiRegistros.textContent = fmt(t.registrosComDiferenca);

        els.cardDiferenca.classList.remove("is-negative", "is-positive", "is-zero");
        els.cardDiferenca.classList.add(diffStateClass(t.diferenca));

        if (t.diferenca < 0) els.kpiDiferencaLegenda.textContent = "aves abaixo do programado";
        else if (t.diferenca > 0) els.kpiDiferencaLegenda.textContent = "aves acima do programado";
        else els.kpiDiferencaLegenda.textContent = "sem diferença no contexto atual";
    }

    function groupByUnit(rows) {
        const groups = new Map();
        rows.forEach(row => {
            if (!groups.has(row.destino)) groups.set(row.destino, []);
            groups.get(row.destino).push(row);
        });
        return [...groups.entries()].map(([destino, registros]) => ({ destino, registros, ...totals(registros) }))
            .sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca));
    }

    function renderUnits(rows) {
        currentRows = rows;
        const groups = sorted(groupByUnit(rows), unitSort);
        els.tbodyUnidades.innerHTML = "";
        els.tfootUnidades.innerHTML = "";

        if (!groups.length) {
            els.tbodyUnidades.innerHTML = `<tr><td colspan="6" class="abate-empty">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;
            return;
        }

        groups.forEach(group => {
            const tr = document.createElement("tr");
            tr.className = `abate-row ${diffStateClass(group.diferenca)}`;
            tr.innerHTML = `
                <td><strong>${escapeHtml(group.destino)}</strong></td>
                <td class="num">${fmt(group.programada)}</td>
                <td class="num">${fmt(group.real)}</td>
                <td class="num"><span class="abate-diff-pill ${diffStateClass(group.diferenca)}">${fmtSigned(group.diferenca)}</span></td>
                <td class="num">${fmt(group.registrosComDiferenca)}</td>
                <td class="action"><button class="mini-button" type="button">Ver produtores</button></td>
            `;
            tr.querySelector("button").addEventListener("click", () => openUnit(group));
            els.tbodyUnidades.appendChild(tr);
        });

        const t = totals(rows);
        els.tfootUnidades.innerHTML = `
            <tr>
                <th>Total</th>
                <th class="num">${fmt(t.programada)}</th>
                <th class="num">${fmt(t.real)}</th>
                <th class="num"><span class="abate-diff-pill ${diffStateClass(t.diferenca)}">${fmtSigned(t.diferenca)}</span></th>
                <th class="num">${fmt(t.registrosComDiferenca)}</th>
                <th></th>
            </tr>
        `;
    }

    function openUnit(group) {
        currentGroup = group;
        els.modalTitulo.textContent = group.destino;
        els.modalSubtitulo.textContent = `${group.registros.length} registro(s) no contexto filtrado`;
        els.modalProgramada.textContent = fmt(group.programada);
        els.modalReal.textContent = fmt(group.real);
        els.modalDiferenca.textContent = fmtSigned(group.diferenca);
        els.modalDiferenca.className = `abate-summary-diff ${diffStateClass(group.diferenca)}`;

        els.tbodyProdutores.innerHTML = sorted(group.registros, detailSort)
            .map(row => `
                <tr class="abate-row ${diffStateClass(row.difQtdeRxP)}">
                    <td><strong>${escapeHtml(row.produtor)}</strong></td>
                    <td>${escapeHtml(row.tecnico)}</td>
                    <td>${fmtDate(row.data)}</td>
                    <td>${escapeHtml(row.galpao)}</td>
                    <td>${escapeHtml(row.lote)}</td>
                    <td>${escapeHtml(row.tipoGranja)}</td>
                    <td>${escapeHtml(row.modelo)}</td>
                    <td class="num">${fmt(row.programada)}</td>
                    <td class="num">${fmt(row.real)}</td>
                    <td class="num"><span class="abate-diff-pill ${diffStateClass(row.difQtdeRxP)}">${fmtSigned(row.difQtdeRxP)}</span></td>
                </tr>
            `).join("");

        els.modal.classList.remove("hidden");
        requestAnimationFrame(() => els.modal.querySelector(".dialog-card").focus());
    }

    function closeModal() {
        els.modal.classList.add("hidden");
    }

    els.modalBackdrop.addEventListener("click", closeModal);
    els.modalFechar.addEventListener("click", closeModal);
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !els.modal.classList.contains("hidden")) closeModal();
    });

    Object.values(filterFields).forEach(el => el.addEventListener("change", reload));
    els.limpar.addEventListener("click", () => {
        Object.values(filterFields).forEach(el => { el.value = ""; });
        reload();
    });
    setupFormulaModal();
    setupSort(els.tbodyUnidades, ["destino", "programada", "real", "diferenca", "registrosComDiferenca"], unitSort, () => renderUnits(currentRows));
    setupSort(els.tbodyProdutores, ["produtor", "tecnico", "data", "galpao", "lote", "tipoGranja", "modelo", "programada", "real", "difQtdeRxP"], detailSort, () => { if (currentGroup) openUnit(currentGroup); });
    reload();
    loadFormulas();
})();
