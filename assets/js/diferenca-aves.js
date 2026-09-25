(() => {
    // Protótipo visual. A integração com o Parquet será feita em etapa posterior.
    // Regra importante: Dif Qtde RxP vem pronta da origem e NÃO é recalculada como Real - Programada.
    const MOCK_ROWS = [
        { data: "2026-01-02", destino: "AVE NOVA", produtor: "GRANJA BRASILIA AGROINDUSTRIAL", galpao: "290A", tipoGranja: "Alugada", lote: "52", modelo: "Convencional Forrado", programada: 7524, real: 7524, difQtdeRxP: 0, tecnico: "" },
        { data: "2026-01-02", destino: "AVE NOVA", produtor: "ESPOLIO DE ADEMIR DE ARAUJO CO", galpao: "731A", tipoGranja: "Integrada", lote: "5", modelo: "Dark house", programada: 36747, real: 35244, difQtdeRxP: -1503, tecnico: "" },
        { data: "2026-01-02", destino: "AVE NOVA", produtor: "ESPOLIO DE ADEMIR DE ARAUJO CO", galpao: "731C", tipoGranja: "Integrada", lote: "5", modelo: "Dark house", programada: 38438, real: 34039, difQtdeRxP: -4399, tecnico: "" },
        { data: "2026-01-02", destino: "AVE NOVA", produtor: "MARIA EDIANA LIMA SANTANA", galpao: "517", tipoGranja: "Integrada", lote: "40", modelo: "Convencional Forrado", programada: 17146, real: 15713, difQtdeRxP: -1433, tecnico: "" },
        { data: "2026-01-02", destino: "AVE NOVA", produtor: "JOAQUIM DO PRADO MACIEL", galpao: "553B", tipoGranja: "Integrada", lote: "29", modelo: "Dark house", programada: 7524, real: 7524, difQtdeRxP: 0, tecnico: "" },
        { data: "2026-01-02", destino: "AVE NOVA", produtor: "ATAIR AUGUSTO DOS SANTOS", galpao: "235", tipoGranja: "Própria", lote: "36", modelo: "Convencional Forrado", programada: 11313, real: 10465, difQtdeRxP: -848, tecnico: "" },
        { data: "2026-01-02", destino: "REAL ALIMENTOS", produtor: "JOSE NILO NAVES", galpao: "336", tipoGranja: "Integrada", lote: "87", modelo: "Convencional Forrado", programada: 11274, real: 10356, difQtdeRxP: -918, tecnico: "" },
        { data: "2026-01-02", destino: "REAL ALIMENTOS", produtor: "GERALDO MAGELA DA SILVA FILHO", galpao: "396A", tipoGranja: "Integrada", lote: "41", modelo: "Dark house", programada: 19693, real: 19260, difQtdeRxP: -433, tecnico: "" },
        { data: "2026-01-02", destino: "REAL ALIMENTOS", produtor: "LUCIANO APARECIDO LOBATO", galpao: "596", tipoGranja: "Integrada", lote: "36", modelo: "Dark house", programada: 18891, real: 18744, difQtdeRxP: -147, tecnico: "" },
        { data: "2026-01-02", destino: "REAL ALIMENTOS", produtor: "JOAQUIM DO PRADO MACIEL", galpao: "553B", tipoGranja: "Integrada", lote: "29", modelo: "Dark house", programada: 25502, real: 24702, difQtdeRxP: -800, tecnico: "" },
        { data: "2026-01-03", destino: "AVE NOVA", produtor: "JOAO MOREIRA DA SILVA FILHO", galpao: "761", tipoGranja: "Integrada", lote: "2", modelo: "Dark house", programada: 15048, real: 14220, difQtdeRxP: -828, tecnico: "" },
        { data: "2026-01-03", destino: "AVE NOVA", produtor: "GERALDO ELI DE OLIVEIRA", galpao: "424", tipoGranja: "Integrada", lote: "82", modelo: "Convencional Forrado", programada: 24286, real: 23784, difQtdeRxP: -502, tecnico: "" },
        { data: "2026-01-03", destino: "AVE NOVA", produtor: "JOAQUIM DO PRADO MACIEL", galpao: "553A", tipoGranja: "Integrada", lote: "29", modelo: "Dark house", programada: 12880, real: 12030, difQtdeRxP: -850, tecnico: "" },
        { data: "2026-01-03", destino: "REAL ALIMENTOS", produtor: "LUCIANO APARECIDO LOBATO", galpao: "597", tipoGranja: "Integrada", lote: "36", modelo: "Dark house", programada: 11286, real: 11286, difQtdeRxP: 0, tecnico: "" },
        { data: "2026-01-03", destino: "REAL ALIMENTOS", produtor: "JEFFERSON LOPES MOREIRA", galpao: "762", tipoGranja: "Integrada", lote: "2", modelo: "Dark house", programada: 27410, real: 29454, difQtdeRxP: 2044, tecnico: "" },
        { data: "2026-01-03", destino: "REAL ALIMENTOS", produtor: "JOAO MOREIRA DA SILVA FILHO", galpao: "761", tipoGranja: "Integrada", lote: "2", modelo: "Dark house", programada: 12516, real: 10938, difQtdeRxP: -1578, tecnico: "" }
    ];

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

    const fmt = value => new Intl.NumberFormat("pt-BR").format(Number(value || 0));
    const fmtSigned = value => `${value > 0 ? "+" : ""}${fmt(value)}`;
    const fmtDate = value => {
        const [year, month, day] = value.split("-");
        return `${day}/${month}/${year}`;
    };
    const unique = (rows, key) => [...new Set(rows.map(row => String(row[key] || "").trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "pt-BR"));

    function setOptions(select, values, firstLabel) {
        select.innerHTML = `<option value="">${firstLabel}</option>` + values
            .map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
            .join("");
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function initFilters() {
        const dates = unique(MOCK_ROWS, "data").sort().reverse();
        els.data.innerHTML = `<option value="">Todas as datas</option>` + dates
            .map(value => `<option value="${value}">${fmtDate(value)}</option>`)
            .join("");
        setOptions(els.unidade, unique(MOCK_ROWS, "destino"), "Todas");
        setOptions(els.produtor, unique(MOCK_ROWS, "produtor"), "Todos");
        setOptions(els.tipoGranja, unique(MOCK_ROWS, "tipoGranja"), "Todos");
        setOptions(els.modelo, unique(MOCK_ROWS, "modelo"), "Todos");

        [els.data, els.unidade, els.produtor, els.tecnico, els.tipoGranja, els.modelo, els.status]
            .forEach(select => select.addEventListener("change", render));

        els.limpar.addEventListener("click", () => {
            [els.data, els.unidade, els.produtor, els.tecnico, els.tipoGranja, els.modelo, els.status]
                .forEach(select => { select.value = ""; });
            render();
        });
    }

    function statusMatches(diff, status) {
        if (!status) return true;
        if (status === "negativa") return diff < 0;
        if (status === "positiva") return diff > 0;
        if (status === "zero") return diff === 0;
        return true;
    }

    function filteredRows() {
        return MOCK_ROWS.filter(row => {
            if (els.data.value && row.data !== els.data.value) return false;
            if (els.unidade.value && row.destino !== els.unidade.value) return false;
            if (els.produtor.value && row.produtor !== els.produtor.value) return false;
            if (els.tecnico.value && row.tecnico !== els.tecnico.value) return false;
            if (els.tipoGranja.value && row.tipoGranja !== els.tipoGranja.value) return false;
            if (els.modelo.value && row.modelo !== els.modelo.value) return false;
            if (!statusMatches(row.difQtdeRxP, els.status.value)) return false;
            return true;
        });
    }

    function totals(rows) {
        return rows.reduce((acc, row) => {
            acc.programada += row.programada;
            acc.real += row.real;
            acc.diferenca += row.difQtdeRxP;
            if (row.difQtdeRxP !== 0) acc.registrosComDiferenca += 1;
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
        const groups = groupByUnit(rows);
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
        els.modalTitulo.textContent = group.destino;
        els.modalSubtitulo.textContent = `${group.registros.length} registro(s) no contexto filtrado`;
        els.modalProgramada.textContent = fmt(group.programada);
        els.modalReal.textContent = fmt(group.real);
        els.modalDiferenca.textContent = fmtSigned(group.diferenca);
        els.modalDiferenca.className = `abate-summary-diff ${diffStateClass(group.diferenca)}`;

        els.tbodyProdutores.innerHTML = group.registros
            .slice()
            .sort((a, b) => Math.abs(b.difQtdeRxP) - Math.abs(a.difQtdeRxP))
            .map(row => `
                <tr class="abate-row ${diffStateClass(row.difQtdeRxP)}">
                    <td><strong>${escapeHtml(row.produtor)}</strong></td>
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

    function render() {
        const rows = filteredRows();
        renderKpis(rows);
        renderUnits(rows);
    }

    els.modalBackdrop.addEventListener("click", closeModal);
    els.modalFechar.addEventListener("click", closeModal);
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !els.modal.classList.contains("hidden")) closeModal();
    });

    initFilters();
    render();
})();
