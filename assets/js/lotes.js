/**
 * MAPA DE FÓRMULAS: ./FORMULAS.md
 * Motor da tela Lotes: mortalidade, médias simples semanais, média geral e gráficos.
 */
(() => {
  const WEEKS = [7, 14, 21, 28, 35, 42];
  const state = {
    raw: [],
    rows: [],
    latest: null,
    charts: [],
    filters: null,
    sort: { key: "aves", dir: "desc" },
    resizeObserver: null,
    tableView: "produtores",
    expandedGroups: new Set(),
    galpaoRanking: "piores",
    rankingChart: null,
    detailChart: null,
  };

  const $ = (id) => document.getElementById(id);
  const num = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const fmt = (value, decimals = 0) =>
    value === null || value === undefined || !Number.isFinite(Number(value))
      ? "—"
      : Number(value).toLocaleString("pt-BR", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
  const date = (value) => {
    if (!value) return null;
    const parsed = new Date(String(value).slice(0, 10) + "T00:00:00Z");
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  };
  const daysBetween = (a, b) => Math.floor((b - a) / 86400000);
  const esc = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  const css = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim();
  }

  function buildModelLookup() {
    const counts = new Map();
    (window.BASE_DINAMICA_ROWS || []).forEach((row) => {
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

  /**
   * FÓRMULA: Deduplicação e idade
   * Usa hoje e Data Recepcao para idade em dias inteiros. Mantém 0..45 inclusive. Chave: Codigo Granja +
   * Num Lote + Galp + recepção; escolhe maior Periodo_Arquivo_Fim (última ocorrência em empate).
   * Registros sem chave completa recebem identidade por índice.
   * Passo a passo (pseudocódigo):
   *   idade = piso((hoje - recepção) / 86400000)
   *   base = última versão por chave, com 0 <= idade <= 45
   */
  function prepareRows() {
    const raw = Array.isArray(window.LOTES_ABERTOS_ROWS)
      ? window.LOTES_ABERTOS_ROWS
      : [];
    if (!raw.length)
      throw new Error("A base local de lotes abertos não foi carregada.");

    // Recepção nos últimos 45 dias, contados a partir de hoje.
    const now = new Date();
    const latest = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // O Parquet preserva o histórico: a tela usa a versão mais recente de cada lote/galpão.
    const unique = new Map();
    raw.forEach((row, index) => {
      const reception = date(row["Data Recepcao"]);
      if (!reception) return;
      const identity = [row["Codigo Granja"], row["Num Lote"], row.Galp];
      const key = identity.every(value => value !== null && value !== undefined && String(value).trim() !== "")
        ? JSON.stringify([...identity.map(String), reception.toISOString()])
        : "sem-chave:" + index;
      const previous = unique.get(key);
      const updated = date(row.Periodo_Arquivo_Fim)?.getTime() ?? -Infinity;
      const previousUpdated = date(previous?.Periodo_Arquivo_Fim)?.getTime() ?? -Infinity;
      if (!previous || updated >= previousUpdated) unique.set(key, row);
    });
    const modelLookup = buildModelLookup();

    state.latest = latest;
    state.raw = [...unique.values()]
      .map((row) => {
        const reception = date(row["Data Recepcao"]);
        const age = reception ? daysBetween(reception, latest) : null;
        const model =
          modelLookup.get(normalize(row["Nome Granja"]).slice(0, 18)) || "";
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
      })
      .filter((row) => row.idade !== null && row.idade >= 0 && row.idade <= 45);
  }

  /**
   * FÓRMULA: Mortes mais descartes de uma semana
   * Soma Qtde Mort Sem-XX e Qtde Desc Sem-XX do lote. XX = 07, 14, 21, 28, 35 ou 42. Ausentes somam
   * zero.
   * Passo a passo (pseudocódigo):
   *   retornar [Qtde Mort Sem-XX] + [Qtde Desc Sem-XX]
   */
  function mortalityAtWeek(row, week) {
    const suffix = String(week).padStart(2, "0");
    const mortes = num(row.source[`Qtde Mort Sem-${suffix}`]) || 0;
    const descartes = num(row.source[`Qtde Desc Sem-${suffix}`]) || 0;
    return mortes + descartes;
  }

  /**
   * FÓRMULA: Mortes mais descartes do período
   * Soma mortalityAtWeek apenas das semanas disponíveis já atingidas pelo lote.
   * Passo a passo (pseudocódigo):
   *   total = 0
   *   para semana disponível:
   *     se idade >= semana: total += mortalityAtWeek(lote, semana)
   */
  function mortalitySelected(row) {
    return selectedWeeks().reduce(
      (total, week) => total + (week <= row.idade ? mortalityAtWeek(row, week) : 0),
      0,
    );
  }

  /**
   * FÓRMULA: Média simples da coluna semanal
   * Usa Peso Med.-XX de lotes com idade >= semana. Descarta null, mantém zero. Soma pesos / quantidade
   * de pesos válidos. Sem valores retorna null.
   * Passo a passo (pseudocódigo):
   *   pesos = valores válidos de [Peso Med.-XX] com idade >= semana
   *   retornar soma(pesos) / quantidade(pesos), ou null
   */
  function weeklyWeightMean(rows, week) {
    const column = `Peso Med.-${String(week).padStart(2, "0")}`;
    const values = rows
      .filter((row) => row.idade >= week)
      .map((row) => num(row.source[column]))
      .filter((value) => value !== null);
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  }

  /**
   * FÓRMULA: Peso Médio Geral
   * Regra atual: média simples das médias semanais válidas. Cada semana tem o mesmo peso
   * independentemente do número de lotes. Não usa Ps Pinto, nem último peso por lote.
   * Passo a passo (pseudocódigo):
   *   medias = weeklyWeightMean(linhas, semana) para cada semana disponível
   *   remover medias null
   *   retornar soma(medias) / quantidade(medias), ou null
   */
  function generalWeightMean(rows) {
    // 1) calcula a média de cada coluna semanal selecionada;
    // 2) soma essas médias;
    // 3) divide pela quantidade de semanas com média válida.
    // `rows` já contém todos os filtros ativos da tela.
    const weeklyMeans = selectedWeeks()
      .map((week) => weeklyWeightMean(rows, week))
      .filter((value) => value !== null);
    return weeklyMeans.length
      ? weeklyMeans.reduce((sum, value) => sum + value, 0) / weeklyMeans.length
      : null;
  }

  const FILTER_FIELDS = [
    { id: "periodoDias", apiKey: "periodo_dias", multi: true },
    { id: "tipoGranja", apiKey: "tipo_granja", multi: true, search: true },
    { id: "produtor", apiKey: "produtor", multi: true, search: true },
    { id: "modelo", apiKey: "modelo", multi: true, search: true },
    { id: "galpao", apiKey: "galpao", multi: true, search: true },

    { id: "tecnico", apiKey: "tecnico", multi: true, search: true },
    { id: "mistLinha", apiKey: "mist_linha", multi: true },
  ];
  function selectedFilters() {
    return state.filters ? state.filters.values() : {};
  }

  function hasPeriodSelection() {
    const selected = selectedFilters().periodo_dias || [];
    return selected.length > 0 && selected.length < WEEKS.length;
  }

  function selectedWeeks() {
    if (!hasPeriodSelection()) return WEEKS;
    const selected = selectedFilters().periodo_dias.map(Number);
    return WEEKS.filter(week => selected.includes(week));
  }

  function includesSelected(selected, value) {
    return !selected?.length || selected.includes(String(value));
  }

  // Cada semana usa lotes que já atingiram a idade; todos mantém a janela completa.
  function matchesAgeRange(age, selected) {
    return !selected?.length || selected.length === WEEKS.length ||
      selected.some(week => WEEKS.includes(Number(week)) && age >= Number(week));
  }

  function matchesLote(row, f, exclude = null) {
    return FILTER_FIELDS.every(({ apiKey }) => apiKey === exclude ||
      (apiKey === "periodo_dias" ? matchesAgeRange(row.idade, f[apiKey]) :
        includesSelected(f[apiKey], row[apiKey])));
  }

  function filteredRows() {
    return state.raw.filter(row => matchesLote(row, selectedFilters()));
  }

  function lotesOptions(filters) {
    return Object.fromEntries(FILTER_FIELDS.map(({ apiKey }) => {
      const values = opcoesDisponiveis(apiKey, state.raw, filters, matchesLote, row =>
        apiKey === "periodo_dias" ? row.idade : row[apiKey]);
      return [apiKey, apiKey === "periodo_dias" ? WEEKS.filter(week => values.some(age => Number(age) >= week))
        .map(week => ({ valor: String(week), nome: `${week} dias` })) : values];
    }));
  }

  function uniqueOptions(values) {
    return [...new Set(values.filter(Boolean).map(String))]
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }))
      .map((value) => ({ value, label: value }));
  }

  function setupFilters() {
    state.filters = new FilterController({
      fields: FILTER_FIELDS,
      filtersEndpoint: "local",
      includeDependentRefresh: true,
      optionsProvider: lotesOptions,
      onChange: render,
    });
    state.filters.register();

    const optionMap = lotesOptions({});

    FILTER_FIELDS.forEach((field) => {
      state.filters.renderMultiOptions(
        field,
        state.filters.normalizeOptions(field, optionMap[field.apiKey] || []),
        [],
      );
    });
  }

  /**
   * FÓRMULA: Cards e total da tabela
   * Conta lotes, soma Aves Inicia uma vez por lote e M+D das semanas elegíveis. Percentual = total M+D /
   * total aves × 100; peso = generalWeightMean. Denominador zero retorna null.
   * Passo a passo (pseudocódigo):
   *   lotes = quantidade(linhas)
   *   aves = soma(Aves Inicia)
   *   mortes = soma(mortalitySelected(lote))
   *   percentual = mortes / aves * 100
   *   peso = generalWeightMean(linhas)
   */
  function totals(rows) {
    const aves = rows.reduce((sum, row) => sum + row.aves, 0);
    const mortes = rows.reduce(
      (sum, row) => sum + mortalitySelected(row),
      0,
    );
    return {
      lotes: rows.length,
      aves,
      mortes,
      mortalidade: aves ? (mortes / aves) * 100 : null,
      peso: generalWeightMean(rows),
    };
  }

  const ICONS = {
    lotes:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0-5.7 4.1A5 5 0 0 0 7 17h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 12 3Z"/><path d="M9 12h6M12 9v6"/></svg>',
    aves: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11c0-4 2.6-7 6-7 2.7 0 5 2 5 4.5 0 3.4-2.7 5.5-6 5.5H8l-2 3v-6Z"/><path d="M15.5 5 18 3l1 3M8 18h8M10 14v4M14 14v4"/></svg>',
    mort: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    percent:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="2"/><circle cx="16" cy="16" r="2"/><path d="m7 18 10-12"/></svg>',
    peso: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10l2 11H5L7 8Z"/><path d="M9 8a3 3 0 0 1 6 0M12 12v3l2 1"/></svg>',
  };

  function renderCards(rows) {
    const t = totals(rows);
    const cards = [
      ["lotes", "Lotes em Criação", fmt(t.lotes), ""],
      ["aves", "Aves Alojadas", fmt(t.aves), ""],
      ["mort", "Mortalidade no Período (Qtde)", fmt(t.mortes), ""],
      ["percent", "Mortalidade no Período (%)", fmt(t.mortalidade, 2), "%"],
      ["peso", "Peso Médio Geral", fmt(t.peso, 2), ""],
    ];
    const formulaIds = { lotes: "lotes_criacao", aves: "aves_alojadas", mort: "mortalidade_qtde", percent: "mortalidade", peso: "peso_medio" };
    $("cardsLotes").innerHTML = cards
      .map(
        ([icon, label, value, suffix]) =>
          `<article class="card lotes-reference-kpi"><span class="lotes-kpi-topline"></span><div class="lotes-reference-icon">${ICONS[icon]}</div><div><div class="lotes-reference-label">${label}</div><div class="lotes-reference-value">${value}${suffix}</div></div><button class="mini-button lotes-formula-button" type="button" data-lotes-formula="${formulaIds[icon]}" title="Ver fórmula" aria-label="Ver fórmula: ${label}"><span class="formula-fx">ƒx</span></button></article>`,
      )
      .join("");
  }

  /**
   * FÓRMULA: Dados dos gráficos semanais
   * Em cada semana, soma M+D e Aves Inicia apenas dos lotes que atingiram a idade. Linha percentual =
   * M+D / aves elegíveis × 100. Peso usa weeklyWeightMean. Remove pontos sem lotes ou sem mortes
   * positivas e sem peso válido.
   * Passo a passo (pseudocódigo):
   *   elegiveis = linhas com idade >= semana
   *   barra = soma(mortalityAtWeek(lote, semana))
   *   linha = barra / soma(aves elegíveis) * 100
   *   peso = weeklyWeightMean(linhas, semana)
   */
  function weeklyData(rows) {
    return selectedWeeks().map((week) => {
      // Cada ponto usa diretamente a coluna da idade correspondente:
      // Peso Med.-07, Peso Med.-14 ... e Mortalidade = Mortes + Descartes da mesma semana.
      const eligible = rows.filter((row) => row.idade >= week);
      const deaths = eligible.reduce(
        (sum, row) => sum + mortalityAtWeek(row, week),
        0,
      );
      const aves = eligible.reduce((sum, row) => sum + row.aves, 0);
      const column = `Peso Med.-${String(week).padStart(2, "0")}`;
      const weights = eligible
        .map((row) => num(row.source[column]))
        .filter((value) => value !== null);
      return {
        week,
        label: `${week} dias`,
        deaths,
        mortality: aves ? (deaths / aves) * 100 : null,
        weight: weeklyWeightMean(rows, week),
        weightCount: weights.length,
        eligibleCount: eligible.length,
      };
    }).filter(
      (item) =>
        item.eligibleCount > 0 && (item.deaths > 0 || item.weight !== null),
    );
  }

  function baseChartOption() {
    const text = css("--foreground");
    const muted = css("--muted-foreground");
    const border = css("--border");
    return {
      animationDuration: 550,
      animationEasing: "cubicOut",
      textStyle: {
        fontFamily: "Geist, Inter, system-ui, sans-serif",
        color: text,
      },
      tooltip: {
        trigger: "axis",
        confine: true,
        backgroundColor: css("--card"),
        borderColor: border,
        textStyle: { color: text },
        extraCssText:
          "border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.10)",
      },
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
          formatter: (value) =>
            window.matchMedia?.("(max-width: 640px)").matches
              ? String(value).replace(" dias", "d")
              : value,
        },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: border, opacity: 0.7 } },
        axisLabel: {
          color: muted,
          fontSize: 10,
          formatter: (value) => fmt(value),
        },
      },
    };
  }

  function getChart(id) {
    const el = $(id);
    const chart =
      echarts.getInstanceByDom(el) ||
      echarts.init(el, null, { renderer: "svg" });
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
    const readableLabel = {
      color: css("--foreground"), backgroundColor: css("--card"),
      fontSize: 12, fontWeight: 600, padding: [3, 4], borderRadius: 4,
      distance: 12,
    };

    const mortality = getChart("chartMortalidade");
    mortality.setOption(
      {
        ...base,
        xAxis: { ...base.xAxis, data: weekly.map((x) => x.label) },
        yAxis: [
          base.yAxis,
          {
            ...base.yAxis,
            position: "right",
            axisLabel: {
              color: muted,
              fontSize: 10,
              formatter: (value) => `${fmt(value, 1)}%`,
            },
            splitLine: { show: false },
          },
        ],
        series: [
          {
            name: "M+D (Qtde)",
            type: "bar",
            yAxisIndex: 0,
            data: weekly.map((x) => x.deaths),
            tooltip: { valueFormatter: (value) => fmt(value) },
            barMaxWidth: 42,
            itemStyle: { color: primary, borderRadius: [8, 8, 2, 2] },
            label: {
              show: true,
              position: "insideTop",
              distance: 6,
              color: "#fff",
              backgroundColor: "rgba(0,0,0,0.55)",
              padding: [3, 3],
              borderRadius: 3,
              fontSize: 11,
              fontWeight: 700,
              formatter: (p) => fmt(p.value),
            },
            labelLayout: { hideOverlap: true },
          },
          {
            name: "M+D (%)",
            type: "line",
            yAxisIndex: 1,
            data: weekly.map((x) => x.mortality),
            tooltip: {
              valueFormatter: (value) =>
                value == null ? "—" : `${fmt(value, 2)}%`,
            },
            symbol: "circle",
            symbolSize: 8,
            smooth: 0.32,
            lineStyle: { color: accent, width: 3 },
            itemStyle: { color: accent },
            label: {
              show: true,
              position: "top",
              ...readableLabel,
              color: "#211b1d",
              backgroundColor: accent,
              formatter: (p) => (p.value == null ? "" : `${fmt(p.value, 2)}%`),
            },
            labelLayout: { hideOverlap: true, moveOverlap: "shiftY" },
          },
        ],
      },
      true,
    );

    // No gráfico de peso, não exiba semanas sem nenhum Peso Med.-XX válido.
    // Ex.: se Peso Med.-42 estiver totalmente vazio, o rótulo "42 dias" também some.
    const weeklyWeight = weekly.filter((item) => item.weight !== null);
    const weight = getChart("chartPesoSemanal");
    weight.setOption(
      {
        ...base,
        xAxis: { ...base.xAxis, data: weeklyWeight.map((x) => x.label) },
        series: [
          {
            name: "Média da Coluna",
            type: "bar",
            data: weeklyWeight.map((x) => x.weight),
            tooltip: {
              valueFormatter: (value) => (value == null ? "—" : fmt(value, 2)),
            },
            barMaxWidth: 54,
            itemStyle: { color: primary, borderRadius: [10, 10, 3, 3] },
            label: {
              show: true,
              position: "top",
              ...readableLabel,
              formatter: (p) => (p.value == null ? "" : fmt(p.value, 2)),
            },
            labelLayout: { hideOverlap: true },
          },
        ],
      },
      true,
    );

    /**
     * FÓRMULA: Curva de crescimento e peso inicial
     * Dentro de renderCharts. Ponto zero = média simples dos Ps Pinto válidos.
     * Pontos semanais vêm de weeklyData. Remove pesos null e não extrapola para 45 dias.
     * Passo a passo (pseudocódigo):
     *   se todas as semanas: ponto0 = soma(Ps Pinto válidos) / quantidade
     *   pontos semanais = pesos de weeklyData
     */
    const growthPoints = [
      ...(!hasPeriodSelection() ? [{
        week: 0,
        label: "0",
        value: (() => {
          const ps = rows
            .map((r) => num(r.source["Ps Pinto"]))
            .filter((v) => v !== null);
          return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null;
        })(),
      }] : []),
      ...weekly.map((x) => ({
        week: x.week,
        label: String(x.week),
        value: x.weight,
      })),
    ].filter((x) => x.value !== null);
    const growth = getChart("chartCrescimento");
    growth.setOption(
      {
        ...base,
        grid: { left: 48, right: 24, top: 42, bottom: 46 },
        xAxis: {
          ...base.xAxis,
          data: growthPoints.map((x) => x.label),
          name: "Idade",
          nameLocation: "middle",
          nameGap: 30,
          nameTextStyle: { color: muted, fontSize: 10 },
        },
        series: [
          {
            name: "Peso",
            type: "line",
            data: growthPoints.map((x) => x.value),
            tooltip: {
              valueFormatter: (value) => (value == null ? "—" : fmt(value, 2)),
            },
            smooth: 0.42,
            symbol: "circle",
            symbolSize: 7,
            lineStyle: { color: primary, width: 4, cap: "round" },
            itemStyle: { color: primary },
            areaStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: "rgba(122,23,38,.42)" },
                  { offset: 1, color: "rgba(122,23,38,.06)" },
                ],
              },
            },
            label: {
              show: true,
              position: "top",
              ...readableLabel,
              formatter: (p) => fmt(p.value, 2),
            },
            labelLayout: { hideOverlap: true, moveOverlap: "shiftY" },
          },
        ],
      },
      true,
    );
  }


  function groupKey(group) {
    return [group.tipo, group.produtor, group.linhagem].join("||");
  }

  function aggregateGalpoes(rows) {
    const groups = new Map();
    rows.forEach((row) => {
      const key = [row.produtor, row.galpao].join("||");
      if (!groups.has(key)) groups.set(key, { produtor: row.produtor, galpao: row.galpao || "—", tipo: row.tipo_granja, linhagem: row.linhagem, rows: [], aves: 0, mortes: 0 });
      const g = groups.get(key);
      g.rows.push(row);
      g.aves += row.aves;
      g.mortes += mortalitySelected(row);
    });
    return [...groups.values()].map((g) => ({
      ...g,
      idade: g.rows.reduce((max, row) => Math.max(max, row.idade || 0), 0),
      mortalidade: g.aves ? (g.mortes / g.aves) * 100 : null,
      peso: generalWeightMean(g.rows),
    }));
  }

  function galpaoEvolution(rows) {
    return WEEKS.map((week) => {
      const eligible = rows.filter((row) => row.idade >= week);
      if (!eligible.length) return null;
      const peso = weeklyWeightMean(rows, week);
      const mortes = eligible.reduce((sum, row) => sum + mortalityAtWeek(row, week), 0);
      const aves = eligible.reduce((sum, row) => sum + row.aves, 0);
      return {
        week,
        peso,
        mortalidade: aves ? (mortes / aves) * 100 : null,
      };
    }).filter(Boolean);
  }

  function rankedGalpoes(rows) {
    const items = aggregateGalpoes(rows).filter((g) => g.mortalidade !== null);
    items.sort((a, b) => state.galpaoRanking === "piores" ? b.mortalidade - a.mortalidade : a.mortalidade - b.mortalidade);
    return items;
  }

  function renderGalpaoRanking(rows) {
    if (state.tableView !== "galpoes") return;
    const items = rankedGalpoes(rows);
    const chartItems = items.slice(0, 10);
    const rankingLabel = state.galpaoRanking === "piores" ? "piores" : "melhores";
    $("galpaoRankingTitulo").textContent = `Top ${chartItems.length || 10} galpões com ${state.galpaoRanking === "piores" ? "maior" : "menor"} mortalidade`;
    $("galpaoRankingSubtitulo").textContent = `Mortalidade (%) — ${rankingLabel} primeiro`;
    $("galpaoRankingList").innerHTML = items.length ? items.map((g, i) => `
      <button class="lotes-galpao-rank-row" type="button" data-galpao-detail="${esc(g.produtor)}||${esc(g.galpao)}" aria-label="Abrir detalhes do galpão ${esc(g.galpao)} de ${esc(g.produtor)}">
        <span class="lotes-galpao-rank-pos">${i + 1}</span>
        <span class="lotes-galpao-rank-name"><strong>${esc(g.galpao)}</strong><small>${esc(g.produtor)}</small></span>
        <span class="lotes-galpao-rank-metric"><strong>${fmt(g.aves)}</strong><small>Aves</small></span>
        <span class="lotes-galpao-rank-metric"><strong>${fmt(g.peso, 2)}</strong><small>Média de peso</small></span>
        <span class="lotes-galpao-rank-highlight"><strong>${fmt(g.mortalidade, 2)}%</strong><small>Mortalidade</small></span>
        <span class="lotes-galpao-detail-cta"><span>Ver detalhes</span><small>Clique para ver detalhes</small><b aria-hidden="true">›</b></span>
      </button>`).join("") : '<div class="lotes-galpao-empty">Nenhum galpão encontrado para os filtros selecionados.</div>';

    if (!window.echarts || !$("chartGalpoesRanking")) return;
    if (!state.rankingChart) state.rankingChart = echarts.init($("chartGalpoesRanking"));
    const primary = css("--primary");
    const foreground = css("--foreground");
    const muted = css("--muted-foreground");
    const border = css("--border");
    const mobileRanking = window.matchMedia("(max-width: 768px)").matches;
    state.rankingChart.setOption({
      animationDuration: 350,
      grid: { left: mobileRanking ? 94 : 124, right: mobileRanking ? 48 : 58, top: 12, bottom: 26 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (params) => { const p = params[0]; const g = chartItems[p.dataIndex]; return `<strong>${esc(g.galpao)} · ${esc(g.produtor)}</strong><br>Mortalidade: ${fmt(p.value, 2)}%`; } },
      xAxis: { type: "value", min: 0, axisLabel: { color: muted, fontSize: mobileRanking ? 9 : 11, formatter: "{value}%" }, splitLine: { lineStyle: { color: border } } },
      yAxis: { type: "category", inverse: true, data: chartItems.map((g) => `${g.galpao} · ${g.produtor}`), axisLabel: { color: foreground, fontSize: mobileRanking ? 9 : 11, width: mobileRanking ? 78 : 110, overflow: "truncate" }, axisTick: { show: false }, axisLine: { show: false } },
      series: [{ type: "bar", data: chartItems.map((g) => g.mortalidade), barMaxWidth: 24, itemStyle: { color: primary, borderRadius: 5 }, label: { show: true, position: "right", color: foreground, formatter: (p) => `${fmt(p.value, 2)}%` } }],
    }, true);
    state.rankingChart.off("click");
    state.rankingChart.on("click", (params) => { const g = chartItems[params.dataIndex]; if (g) openGalpaoDetail(g.produtor, g.galpao); });
    requestAnimationFrame(() => state.rankingChart?.resize());
  }

  function renderDetailChart(evolution) {
    if (!window.echarts || !$("chartGalpaoDetalhe")) return;
    if (!state.detailChart) state.detailChart = echarts.init($("chartGalpaoDetalhe"));
    const primary = css("--primary"), foreground = css("--foreground"), muted = css("--muted-foreground"), border = css("--border");
    const valid = evolution.filter((x) => x.mortalidade !== null);
    state.detailChart.setOption({
      grid: { left: 52, right: 24, top: 24, bottom: 38 },
      tooltip: { trigger: "axis", valueFormatter: (value) => value == null ? "—" : `${fmt(value, 2)}%` },
      xAxis: { type: "category", data: valid.map((x) => `${x.week}`), name: "Idade (dias)", nameLocation: "middle", nameGap: 28, nameTextStyle: { color: muted, fontSize: 10 }, axisLabel: { color: muted }, axisLine: { lineStyle: { color: border } } },
      yAxis: { type: "value", min: 0, axisLabel: { color: muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: border } } },
      series: [
        { name: "Mortalidade", type: "line", data: valid.map((x) => x.mortalidade), smooth: .25, symbol: "circle", symbolSize: 7, lineStyle: { color: primary, width: 3 }, itemStyle: { color: primary }, label: { show: true, position: "top", color: foreground, formatter: (p) => `${fmt(p.value, 2)}%` }, labelLayout: { hideOverlap: true } },
      ],
    }, true);
    requestAnimationFrame(() => state.detailChart?.resize());
  }

  function openGalpaoDetail(produtor, galpao) {
    const rows = state.rows.filter((row) => row.produtor === produtor && row.galpao === galpao);
    if (!rows.length) return;
    const evolution = galpaoEvolution(rows);
    const sample = rows[0];
    const resumo = aggregateGalpoes(rows)[0];
    $("galpaoDrawerTitulo").textContent = `Galpão ${galpao}`;
    $("galpaoDrawerProdutor").textContent = produtor;
    $("galpaoDrawerResumo").innerHTML = `
      <div><small>Idade atual</small><strong>${fmt(resumo?.idade)} dias</strong></div>
      <div><small>Linhagem</small><strong>${esc(sample.linhagem || "—")}</strong></div>
      <div><small>Aves alojadas</small><strong>${fmt(resumo?.aves)}</strong></div>
      <div><small>Média de peso</small><strong>${fmt(resumo?.peso, 2)}</strong></div>
      <div><small>Mortalidade</small><strong>${resumo?.mortalidade === null || resumo?.mortalidade === undefined ? "—" : `${fmt(resumo.mortalidade, 2)}%`}</strong></div>`;
    $("galpaoDrawerTabela").innerHTML = evolution.map((x) => `<tr><td>${x.week} dias</td><td class="num">${fmt(x.peso, 2)}</td><td class="num lotes-mortality-cell">${x.mortalidade === null ? "—" : `${fmt(x.mortalidade, 2)}%`}</td></tr>`).join("");
    $("galpaoDrawer").classList.remove("hidden");
    $("galpaoDrawer").setAttribute("aria-hidden", "false");
    document.body.classList.add("lotes-drawer-open");
    renderDetailChart(evolution);
  }

  function closeGalpaoDetail() {
    $("galpaoDrawer")?.classList.add("hidden");
    $("galpaoDrawer")?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lotes-drawer-open");
  }

  function setTableView(view) {
    state.tableView = view;
    $("produtoresView").classList.toggle("hidden", view !== "produtores");
    $("galpoesView").classList.toggle("hidden", view !== "galpoes");
    $("galpaoRankingControls").classList.toggle("hidden", view !== "galpoes");
    document.querySelectorAll("[data-lotes-view]").forEach((button) => {
      const active = button.dataset.lotesView === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    if (view === "galpoes") renderGalpaoRanking(state.rows);
  }

  /**
   * FÓRMULA: Agrupamento da tabela
   * Agrupa por tipo_granja + produtor + linhagem. Soma aves e M+D; recalcula percentual e
   * generalWeightMean nas linhas de cada grupo. O rodapé usa totals de todas as linhas, não a média dos
   * grupos.
   * Passo a passo (pseudocódigo):
   *   para cada grupo:
   *     aves = soma(aves)
   *     mortes = soma(mortalitySelected(lote))
   *     percentual = mortes / aves * 100
   *     peso = generalWeightMean(linhas do grupo)
   */
  function aggregateTable(rows) {
    const groups = new Map();
    rows.forEach((row) => {
      const key = [row.tipo_granja, row.produtor, row.linhagem].join("||");
      if (!groups.has(key))
        groups.set(key, {
          tipo: row.tipo_granja,
          produtor: row.produtor,
          linhagem: row.linhagem,
          aves: 0,
          mortes: 0,
          rows: [],
        });
      const g = groups.get(key);
      g.aves += row.aves;
      g.mortes += mortalitySelected(row);
      g.rows.push(row);
    });
    return [...groups.values()].map((g) => ({
      ...g,
      mortalidade: g.aves ? (g.mortes / g.aves) * 100 : null,
      peso: generalWeightMean(g.rows),
    }));
  }

  function compareValues(a, b, key) {
    const av = a[key];
    const bv = b[key];
    if (typeof av === "number" || typeof bv === "number") {
      const an =
        av !== null && av !== undefined && Number.isFinite(Number(av))
          ? Number(av)
          : -Infinity;
      const bn =
        bv !== null && bv !== undefined && Number.isFinite(Number(bv))
          ? Number(bv)
          : -Infinity;
      return an - bn;
    }
    return String(av ?? "").localeCompare(String(bv ?? ""), "pt-BR", {
      numeric: true,
      sensitivity: "base",
    });
  }

  function sortedGroups(groups) {
    const { key, dir } = state.sort;
    const multiplier = dir === "asc" ? 1 : -1;
    return [...groups].sort((a, b) => compareValues(a, b, key) * multiplier);
  }

  function updateSortHeaders() {
    document.querySelectorAll(".lotes-sort-button").forEach((button) => {
      const active = button.dataset.sort === state.sort.key;
      button.classList.toggle("active", active);
      button.setAttribute(
        "aria-sort",
        active
          ? state.sort.dir === "asc"
            ? "ascending"
            : "descending"
          : "none",
      );
      const icon = button.querySelector(".sort-icon");
      if (icon)
        icon.textContent = active
          ? state.sort.dir === "asc"
            ? "↑"
            : "↓"
          : "↕";
    });
  }

  function renderTable(rows) {
    const groups = sortedGroups(aggregateTable(rows));
    $("tabelaLotesBody").innerHTML = groups.length
      ? groups.map((g) => {
          const key = groupKey(g);
          const expanded = state.expandedGroups.has(key);
          const galpoes = aggregateGalpoes(g.rows).sort((a, b) => String(a.galpao).localeCompare(String(b.galpao), "pt-BR", { numeric: true }));
          const parent = `<tr class="lotes-producer-row"><td>${esc(g.tipo)}</td><td><button class="lotes-expand-producer" type="button" data-expand-group="${esc(key)}" aria-expanded="${expanded}"><span>${expanded ? "−" : "+"}</span>${esc(g.produtor)}</button></td><td>${esc(g.linhagem)}</td><td class="num">${fmt(g.aves)}</td><td class="num">${fmt(g.mortes)}</td><td class="num">${fmt(g.mortalidade, 2)}%</td><td class="num">${fmt(g.peso, 2)}</td></tr>`;
          if (!expanded) return parent;
          const children = galpoes.map((item) => `<tr class="lotes-galpao-child"><td></td><td><span class="lotes-galpao-child-name">↳ Galpão ${esc(item.galpao)}</span></td><td>${esc(item.linhagem || g.linhagem)}</td><td class="num">${fmt(item.aves)}</td><td class="num">${fmt(item.mortes)}</td><td class="num">${fmt(item.mortalidade, 2)}%</td><td class="num">${fmt(generalWeightMean(item.rows), 2)}</td></tr>`).join("");
          return parent + children;
        }).join("")
      : '<tr><td colspan="7">Nenhum lote encontrado para os filtros selecionados.</td></tr>';
    const t = totals(rows);
    $("tabelaLotesFoot").innerHTML = `<tr><th colspan="3">Total</th><th class="num">${fmt(t.aves)}</th><th class="num">${fmt(t.mortes)}</th><th class="num">${fmt(t.mortalidade, 2)}%</th><th class="num">${fmt(t.peso, 2)}</th></tr>`;
    updateSortHeaders();
  }

  function render() {
    const rows = filteredRows();
    state.rows = rows;
    renderCards(rows);
    renderCharts(rows);
    renderTable(rows);
    renderGalpaoRanking(rows);
  }

  async function clearFilters() {
    state.filters?.clear();
    await state.filters.loadOptions({ preserve: false });
    render();
  }

  function setupFormulaModal() {
    const modal = $("formulaModalLotes");
    const close = $("formulaFecharLotes");
    let opener = null;
    let previousOverflow = "";
    function hide() {
      if (modal.classList.contains("hidden")) return;
      modal.classList.add("hidden");
      document.body.style.overflow = previousOverflow;
      opener?.focus({ preventScroll: true });
    }
    document.addEventListener("click", event => {
      const button = event.target.closest("[data-lotes-formula]");
      if (!button) return;
      const metric = buildLotesFormulas(selectedWeeks(), hasPeriodSelection()).find(item => item.id === button.dataset.lotesFormula);
      if (!metric) return;
      opener = button;
      $("formulaTituloLotes").textContent = metric.nome;
      $("formulaExpressaoLotes").textContent = metric.formula_exibicao;
      $("formulaDescricaoLotes").textContent = metric.descricao;
      $("formulaExplicacaoLotes").innerHTML = FormulaUI.explanation(metric);
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      modal.classList.remove("hidden");
      modal.querySelector(".dialog-card").scrollTop = 0;
      close.focus({ preventScroll: true });
    });
    close.addEventListener("click", hide);
    $("formulaBackdropLotes").addEventListener("click", hide);
    document.addEventListener("keydown", event => {
      if (modal.classList.contains("hidden")) return;
      if (event.key === "Escape") { event.preventDefault(); hide(); }
      if (event.key === "Tab") { event.preventDefault(); close.focus({ preventScroll: true }); }
    });
  }

  function init() {
    try {
      prepareRows();
      setupFilters();
      setupFormulaModal();
      state.resizeObserver =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver((entries) =>
              entries.forEach((entry) =>
                echarts.getInstanceByDom(entry.target)?.resize(),
              ),
            )
          : null;
      $("limparFiltrosLotes").addEventListener("click", clearFilters);
      document.querySelectorAll(".lotes-sort-button").forEach((button) => {
        button.addEventListener("click", () => {
          const key = button.dataset.sort;
          state.sort =
            state.sort.key === key
              ? { key, dir: state.sort.dir === "asc" ? "desc" : "asc" }
              : {
                  key,
                  dir: ["tipo", "produtor", "linhagem"].includes(key)
                    ? "asc"
                    : "desc",
                };
          renderTable(state.rows);
        });
      });
      document.querySelectorAll("[data-lotes-view]").forEach((button) => button.addEventListener("click", () => setTableView(button.dataset.lotesView)));
      $("galpaoRanking").addEventListener("change", (event) => { state.galpaoRanking = event.target.value; renderGalpaoRanking(state.rows); });
      document.addEventListener("click", (event) => {
        const expand = event.target.closest("[data-expand-group]");
        if (expand) {
          const key = expand.dataset.expandGroup;
          state.expandedGroups.has(key) ? state.expandedGroups.delete(key) : state.expandedGroups.add(key);
          renderTable(state.rows);
          return;
        }
        const detail = event.target.closest("[data-galpao-detail]");
        if (detail) {
          const [produtor, galpao] = detail.dataset.galpaoDetail.split("||");
          openGalpaoDetail(produtor, galpao);
        }
      });
      $("galpaoDrawerFechar").addEventListener("click", closeGalpaoDetail);
      $("galpaoDrawerBackdrop").addEventListener("click", closeGalpaoDetail);
      document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("galpaoDrawer").classList.contains("hidden")) closeGalpaoDetail(); });
      render();
      window.addEventListener("resize", () =>
        state.charts.forEach((chart) => chart.resize()),
      );
      new MutationObserver(() => { renderCharts(state.rows); renderGalpaoRanking(state.rows); }).observe(
        document.documentElement,
        { attributes: true, attributeFilter: ["data-theme"] },
      );
    } catch (error) {
      $("mensagemErroLotes").textContent =
        error.message || "Não foi possível carregar os dados locais.";
      $("mensagemErroLotes").classList.remove("hidden");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
