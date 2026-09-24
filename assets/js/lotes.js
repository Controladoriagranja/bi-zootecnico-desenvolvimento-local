(() => {
    const WEEKS = [7, 14, 21, 28, 35, 42];
    const state = { raw: [], rows: [], latest: null, charts: [], filters: null, sort: { key: "aves", dir: "desc" }, resizeObserver: null };

    const $ = id => document.getElementById(id);
    const num = value => {
        if (value === null || value === undefined || value === "") return null;
        const parsed = Number(String(value).replace(",", "."));
        return Number.isFinite(parsed) ? parsed : null;
    };
    const fmt = (value, decimals = 0) => value === null || value === undefined || !Number.isFinite(Number(value))
        ? "—"
        : Number(value).toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const date = value => value ? new Date(value) : null;
    const daysBetween = (a, b) => Math.floor((b - a) / 86400000);
    const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    function normalize(value) {
        return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
    }

    function buildModelLookup() {
        const counts = new Map();
        (window.BASE_DINAMICA_ROWS || []).forEach(row => {
            const producer = normalize(row.Produtor);
            const model = String(row.Modelo || "").trim();
            if (!producer || !model) return;
            const key = producer.slice(0, 18);
            if (!counts.has(key)) counts.set(key, new Map());
            const map = counts.get(key);
            map.set(model, (map.get(model) || 0) + 1);
        });
        const result = new Map();
        counts.forEach((models, key) => {
            const best = [...models.entries()].sort((a, b) => b[1] - a[1])[0];
            if (best) result.set(key, best[0]);
        });
        return result;
    }

    function prepareRows() {
        const raw = Array.isArray(window.LOTES_45D_ROWS) ? window.LOTES_45D_ROWS : [];
        if (!raw.length) throw new Error("A base local dos últimos 45 dias não foi carregada.");

        // A janela desta tela é definida exclusivamente por Data Recepcao.
        // O arquivo local já combina lotes abertos + fechados e mantém, para cada lote/galpão,
        // o registro mais recente disponível dentro dos últimos 45 dias de recepção.
        const receptionDates = raw.map(row => date(row["Data Recepcao"])).filter(Boolean);
        const latest = new Date(Math.max(...receptionDates.map(d => d.getTime())));
        const modelLookup = buildModelLookup();

        state.latest = latest;
        state.raw = raw.map(row => {
            const reception = date(row["Data Recepcao"]);
            const age = reception ? daysBetween(reception, latest) : null;
            const model = modelLookup.get(normalize(row["Nome Granja"]).slice(0, 18)) || "";
            const lineage = String(row.Linhagem || "").trim();
            return {
                source: row,
                tipo_granja: String(row["Tipo Granja"] || "").trim(),
                produtor: String(row["Nome Granja"] || "").trim(),
                modelo: model,
                galpao: String(row.Galp || "").trim(),
                tecnico: String(row["Técnico"] || "").trim(),
                linhagem: lineage,
                mist_linha: lineage.includes("/") ? "Mista" : "Pura",
                idade: age,
                aves: num(row["Aves Inicia"]) || 0,
            };
        }).filter(row => row.idade !== null && row.idade >= 0 && row.idade <= 45);
    }

    function mortalityAtWeek(row, week) {
        const suffix = String(week).padStart(2, "0");
        const mortes = num(row.source[`Qtde Mort Sem-${suffix}`]) || 0;
        const descartes = num(row.source[`Qtde Desc Sem-${suffix}`]) || 0;
        return mortes + descartes;
    }

    function mortalityThrough(row, limit) {
        let total = 0;
        WEEKS.forEach(week => {
            if (week <= limit && week <= row.idade) total += mortalityAtWeek(row, week);
        });
        return total;
    }

    function latestWeight(row, limit = 45) {
        const maxAge = Math.min(row.idade, limit);
        for (const week of [...WEEKS].reverse()) {
            if (week <= maxAge) {
                const value = num(row.source[`Peso Med.-${String(week).padStart(2, "0")}`]);
                if (value !== null) return value;
            }
        }
        return num(row.source["Ps Pinto"]);
    }

    const FILTER_FIELDS = [
        { id: "periodoDias", apiKey: "periodo_dias", multi: true },
        { id: "tipoGranja", apiKey: "tipo_granja", multi: true, search: true },
        { id: "modelo", apiKey: "modelo", multi: true, search: true },
        { id: "galpao", apiKey: "galpao", multi: true, search: true },
        { id: "tecnico", apiKey: "tecnico", multi: true, search: true },
        { id: "mistLinha", apiKey: "mist_linha", multi: true }
    ];

    const AGE_RANGES = [
        { value: "0-7", label: "0–7 dias", min: 0, max: 7 },
        { value: "8-14", label: "8–14 dias", min: 8, max: 14 },
        { value: "15-21", label: "15–21 dias", min: 15, max: 21 },
        { value: "22-28", label: "22–28 dias", min: 22, max: 28 },
        { value: "29-35", label: "29–35 dias", min: 29, max: 35 },
        { value: "36-42", label: "36–42 dias", min: 36, max: 42 },
        { value: "43-45", label: "43–45 dias", min: 43, max: 45 }
    ];

    function selectedFilters() {
        return state.filters ? state.filters.values() : {};
    }

    function includesSelected(selected, value) {
        return !selected?.length || selected.includes(String(value));
    }

    function ageMatches(age, selected) {
        if (!selected?.length) return true;
        return selected.some(value => {
            const range = AGE_RANGES.find(item => item.value === value);
            return range && age >= range.min && age <= range.max;
        });
    }

    function filteredRows() {
        const f = selectedFilters();
        return state.raw.filter(row => ageMatches(row.idade, f.periodo_dias)
            && includesSelected(f.tipo_granja, row.tipo_granja)
            && includesSelected(f.modelo, row.modelo)
            && includesSelected(f.galpao, row.galpao)
            && includesSelected(f.tecnico, row.tecnico)
            && includesSelected(f.mist_linha, row.mist_linha));
    }

    function uniqueOptions(values) {
        return [...new Set(values.filter(Boolean).map(String))]
            .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }))
            .map(value => ({ value, label: value }));
    }

    function setupFilters() {
        state.filters = new FilterController({
            fields: FILTER_FIELDS,
            filtersEndpoint: "local",
            includeDependentRefresh: false,
            onChange: render
        });
        state.filters.register();

        const optionMap = {
            periodo_dias: AGE_RANGES.map(({ value, label }) => ({ value, label })),
            tipo_granja: uniqueOptions(state.raw.map(row => row.tipo_granja)),
            modelo: uniqueOptions(state.raw.map(row => row.modelo)),
            galpao: uniqueOptions(state.raw.map(row => row.galpao)),
            tecnico: uniqueOptions(state.raw.map(row => row.tecnico)),
            mist_linha: [
                { value: "Pura", label: "Pura" },
                { value: "Mista", label: "Mista" }
            ]
        };

        FILTER_FIELDS.forEach(field => {
            state.filters.renderMultiOptions(field, optionMap[field.apiKey] || [], []);
        });
    }

    function totals(rows) {
        const limit = 45;
        const aves = rows.reduce((sum, row) => sum + row.aves, 0);
        const mortes = rows.reduce((sum, row) => sum + mortalityThrough(row, limit), 0);
        const weights = rows.map(row => latestWeight(row, limit)).filter(value => value !== null);
        return {
            lotes: rows.length,
            aves,
            mortes,
            mortalidade: aves ? mortes / aves * 100 : null,
            peso: weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : null,
        };
    }

    const ICONS = {
        lotes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0-5.7 4.1A5 5 0 0 0 7 17h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 12 3Z"/><path d="M9 12h6M12 9v6"/></svg>',
        aves: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11c0-4 2.6-7 6-7 2.7 0 5 2 5 4.5 0 3.4-2.7 5.5-6 5.5H8l-2 3v-6Z"/><path d="M15.5 5 18 3l1 3M8 18h8M10 14v4M14 14v4"/></svg>',
        mort: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
        percent: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="2"/><circle cx="16" cy="16" r="2"/><path d="m7 18 10-12"/></svg>',
        peso: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10l2 11H5L7 8Z"/><path d="M9 8a3 3 0 0 1 6 0M12 12v3l2 1"/></svg>'
    };

    function renderCards(rows) {
        const t = totals(rows);
        const cards = [
            ["lotes", "Lotes em Criação", fmt(t.lotes), ""],
            ["aves", "Aves Alojadas", fmt(t.aves), ""],
            ["mort", "Mortalidade no Período (Qtde)", fmt(t.mortes), ""],
            ["percent", "Mortalidade no Período (%)", fmt(t.mortalidade, 2), "%"],
            ["peso", "Peso Médio Atual", fmt(t.peso, 2), ""],
        ];
        $("cardsLotes").innerHTML = cards.map(([icon, label, value, suffix]) => `<article class="card lotes-reference-kpi"><span class="lotes-kpi-topline"></span><div class="lotes-reference-icon">${ICONS[icon]}</div><div><div class="lotes-reference-label">${label}</div><div class="lotes-reference-value">${value}${suffix}</div></div></article>`).join("");
    }

    function weeklyData(rows) {
        return WEEKS.map(week => {
            // Cada ponto usa diretamente a coluna da idade correspondente:
            // Peso Med.-07, Peso Med.-14 ... e Mortalidade = Mortes + Descartes da mesma semana.
            const eligible = rows.filter(row => row.idade >= week);
            const deaths = eligible.reduce((sum, row) => sum + mortalityAtWeek(row, week), 0);
            const aves = eligible.reduce((sum, row) => sum + row.aves, 0);
            const weights = eligible
                .map(row => num(row.source[`Peso Med.-${String(week).padStart(2, "0")}`]))
                .filter(value => value !== null);
            return {
                week,
                label: `${week} dias`,
                deaths,
                mortality: aves ? deaths / aves * 100 : null,
                weight: weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : null,
                weightCount: weights.length,
                eligibleCount: eligible.length,
            };
        }).filter(item => item.eligibleCount > 0 && (item.deaths > 0 || item.weight !== null));
    }

    function baseChartOption() {
        const text = css("--foreground");
        const muted = css("--muted-foreground");
        const border = css("--border");
        return {
            animationDuration: 550,
            animationEasing: "cubicOut",
            textStyle: { fontFamily: "Geist, Inter, system-ui, sans-serif", color: text },
            tooltip: { trigger: "axis", confine: true, backgroundColor: css("--card"), borderColor: border, textStyle: { color: text }, extraCssText: "border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.10)" },
            grid: { left: 48, right: 28, top: 34, bottom: 42 },
            xAxis: {
                type: "category",
                axisLine: { lineStyle: { color: border } },
                axisTick: { show: false },
                axisLabel: {
                    color: muted,
                    fontSize: window.matchMedia?.("(max-width: 640px)").matches ? 10 : 11,
                    interval: 0,
                    hideOverlap: false,
                    formatter: value => window.matchMedia?.("(max-width: 640px)").matches
                        ? String(value).replace(" dias", "d")
                        : value
                }
            },
            yAxis: { type: "value", axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: border, opacity: .7 } }, axisLabel: { color: muted, fontSize: 10, formatter: value => fmt(value) } }
        };
    }

    function getChart(id) {
        const el = $(id);
        const chart = echarts.getInstanceByDom(el) || echarts.init(el, null, { renderer: "svg" });
        if (!state.charts.includes(chart)) state.charts.push(chart);
        if (state.resizeObserver && !el.dataset.resizeObserved) {
            state.resizeObserver.observe(el);
            el.dataset.resizeObserved = "true";
        }
        return chart;
    }

    function renderCharts(rows) {
        const weekly = weeklyData(rows);
        const primary = css("--primary");
        const accent = css("--accent");
        const muted = css("--muted-foreground");
        const base = baseChartOption();

        const mortality = getChart("chartMortalidade");
        mortality.setOption({ ...base,
            xAxis: { ...base.xAxis, data: weekly.map(x => x.label) },
            yAxis: [base.yAxis, { ...base.yAxis, position: "right", axisLabel: { color: muted, fontSize: 10, formatter: value => `${fmt(value, 1)}%` }, splitLine: { show: false } }],
            series: [
                { name: "M+D (Qtde)", type: "bar", yAxisIndex: 0, data: weekly.map(x => x.deaths), tooltip: { valueFormatter: value => fmt(value) }, barMaxWidth: 42, itemStyle: { color: primary, borderRadius: [8, 8, 2, 2] }, label: { show: true, position: "insideTop", color: "#fff", fontSize: 10, fontWeight: 700, formatter: p => fmt(p.value) }, labelLayout: { hideOverlap: true } },
                { name: "M+D (%)", type: "line", yAxisIndex: 1, data: weekly.map(x => x.mortality), tooltip: { valueFormatter: value => value == null ? "—" : `${fmt(value, 2)}%` }, symbol: "circle", symbolSize: 8, smooth: .32, lineStyle: { color: accent, width: 3 }, itemStyle: { color: accent }, label: { show: true, position: "top", distance: 8, color: primary, backgroundColor: accent, borderRadius: 5, padding: [3,5], formatter: p => p.value == null ? "" : `${fmt(p.value,2)}%` }, labelLayout: { hideOverlap: true, moveOverlap: "shiftY" } }
            ]
        }, true);

        const weight = getChart("chartPesoSemanal");
        weight.setOption({ ...base,
            xAxis: { ...base.xAxis, data: weekly.map(x => x.label) },
            series: [{ name: "Peso Médio", type: "bar", data: weekly.map(x => x.weight), tooltip: { valueFormatter: value => value == null ? "—" : fmt(value, 2) }, barMaxWidth: 54, itemStyle: { color: primary, borderRadius: [10, 10, 3, 3] }, label: { show: true, position: "top", distance: 7, color: muted, fontSize: 10, formatter: p => p.value == null ? "" : fmt(p.value, 2) }, labelLayout: { hideOverlap: true } }]
        }, true);

        const growthPoints = [{ week: 0, label: "0", value: (() => { const ps=rows.map(r=>num(r.source["Ps Pinto"])).filter(v=>v!==null);return ps.length?ps.reduce((a,b)=>a+b,0)/ps.length:null; })() }, ...weekly.map(x => ({ week: x.week, label: String(x.week), value: x.weight }))].filter(x => x.value !== null);
        const growth = getChart("chartCrescimento");
        growth.setOption({ ...base,
            grid: { left: 48, right: 24, top: 42, bottom: 46 },
            xAxis: { ...base.xAxis, data: growthPoints.map(x => x.label), name: "Idade", nameLocation: "middle", nameGap: 30, nameTextStyle: { color: muted, fontSize: 10 } },
            series: [{ name: "Peso", type: "line", data: growthPoints.map(x => x.value), tooltip: { valueFormatter: value => value == null ? "—" : fmt(value, 2) }, smooth: .42, symbol: "circle", symbolSize: 7, lineStyle: { color: primary, width: 4, cap: "round" }, itemStyle: { color: primary }, areaStyle: { color: { type: "linear", x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:"rgba(122,23,38,.42)"},{offset:1,color:"rgba(122,23,38,.06)"}] } }, label: { show: true, position: "top", distance: 8, color: muted, fontWeight: 650, formatter: p => fmt(p.value, 2) }, labelLayout: { hideOverlap: true, moveOverlap: "shiftY" } }]
        }, true);
    }

    function aggregateTable(rows) {
        const limit = 45;
        const groups = new Map();
        rows.forEach(row => {
            const key = [row.tipo_granja, row.produtor, row.linhagem].join("||");
            if (!groups.has(key)) groups.set(key, { tipo: row.tipo_granja, produtor: row.produtor, linhagem: row.linhagem, aves: 0, mortes: 0, weights: [] });
            const g = groups.get(key);
            g.aves += row.aves;
            g.mortes += mortalityThrough(row, limit);
            const w = latestWeight(row, limit); if (w !== null) g.weights.push(w);
        });
        return [...groups.values()].map(g => ({ ...g, mortalidade: g.aves ? g.mortes/g.aves*100 : null, peso: g.weights.length ? g.weights.reduce((a,b)=>a+b,0)/g.weights.length : null }));
    }

    function compareValues(a, b, key) {
        const av = a[key];
        const bv = b[key];
        if (typeof av === "number" || typeof bv === "number") {
            const an = av !== null && av !== undefined && Number.isFinite(Number(av)) ? Number(av) : -Infinity;
            const bn = bv !== null && bv !== undefined && Number.isFinite(Number(bv)) ? Number(bv) : -Infinity;
            return an - bn;
        }
        return String(av ?? "").localeCompare(String(bv ?? ""), "pt-BR", { numeric: true, sensitivity: "base" });
    }

    function sortedGroups(groups) {
        const { key, dir } = state.sort;
        const multiplier = dir === "asc" ? 1 : -1;
        return [...groups].sort((a, b) => compareValues(a, b, key) * multiplier);
    }

    function updateSortHeaders() {
        document.querySelectorAll(".lotes-sort-button").forEach(button => {
            const active = button.dataset.sort === state.sort.key;
            button.classList.toggle("active", active);
            button.setAttribute("aria-sort", active ? (state.sort.dir === "asc" ? "ascending" : "descending") : "none");
            const icon = button.querySelector(".sort-icon");
            if (icon) icon.textContent = active ? (state.sort.dir === "asc" ? "↑" : "↓") : "↕";
        });
    }

    function renderTable(rows) {
        const groups = sortedGroups(aggregateTable(rows));
        $("tabelaLotesBody").innerHTML = groups.length ? groups.map(g => `<tr><td>${esc(g.tipo)}</td><td>${esc(g.produtor)}</td><td>${esc(g.linhagem)}</td><td class="num">${fmt(g.aves)}</td><td class="num">${fmt(g.mortes)}</td><td class="num">${fmt(g.mortalidade,2)}%</td><td class="num">${fmt(g.peso,2)}</td></tr>`).join("") : '<tr><td colspan="7">Nenhum lote encontrado para os filtros selecionados.</td></tr>';
        const t = totals(rows);
        $("tabelaLotesFoot").innerHTML = `<tr><th colspan="3">Total</th><th class="num">${fmt(t.aves)}</th><th class="num">${fmt(t.mortes)}</th><th class="num">${fmt(t.mortalidade,2)}%</th><th class="num">${fmt(t.peso,2)}</th></tr>`;
        updateSortHeaders();
    }

    function render() {
        const rows = filteredRows();
        state.rows = rows;
        renderCards(rows);
        renderCharts(rows);
        renderTable(rows);
    }

    function clearFilters() {
        state.filters?.clear();
        render();
    }

    function init() {
        try {
            prepareRows();
            setupFilters();
            state.resizeObserver = typeof ResizeObserver !== "undefined"
                ? new ResizeObserver(entries => entries.forEach(entry => echarts.getInstanceByDom(entry.target)?.resize()))
                : null;
            $("limparFiltrosLotes").addEventListener("click", clearFilters);
            document.querySelectorAll(".lotes-sort-button").forEach(button => {
                button.addEventListener("click", () => {
                    const key = button.dataset.sort;
                    state.sort = state.sort.key === key
                        ? { key, dir: state.sort.dir === "asc" ? "desc" : "asc" }
                        : { key, dir: ["tipo", "produtor", "linhagem"].includes(key) ? "asc" : "desc" };
                    renderTable(state.rows);
                });
            });
            render();
            window.addEventListener("resize", () => state.charts.forEach(chart => chart.resize()));
            new MutationObserver(() => renderCharts(state.rows)).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        } catch (error) {
            $("mensagemErroLotes").textContent = error.message || "Não foi possível carregar os dados locais.";
            $("mensagemErroLotes").classList.remove("hidden");
        }
    }

    document.addEventListener("DOMContentLoaded", init);
})();
