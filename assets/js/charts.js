/**
 * MAPA DE FÓRMULAS: ./FORMULAS.md
 * Desenha rankings/evolução; cálculos de tamanho e layout não são fórmulas zootécnicas.
 */
window.ZooCharts = (() => {
    const instances = new Map();
    const compactNumber = new Intl.NumberFormat("pt-BR", {
        notation: "compact", maximumFractionDigits: 1
    });
    const decimalNumber = new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 3
    });
    const axisNumber = value => Math.abs(Number(value)) >= 1000
        ? compactNumber.format(value) : decimalNumber.format(value);

    function wrapTooltip(text, width) {
        const limit = Math.max(12, Math.floor((width - 32) / 8));
        const lines = [];
        let line = "";
        for (const word of String(text).split(/\s+/)) {
            if (line && line.length + word.length + 1 > limit) {
                lines.push(line);
                line = "";
            }
            let rest = word;
            while (rest.length > limit) {
                if (line) { lines.push(line); line = ""; }
                lines.push(rest.slice(0, limit));
                rest = rest.slice(limit);
            }
            line += (line ? " " : "") + rest;
        }
        if (line) lines.push(line);
        return lines.join("\n");
    }

    function responsiveOptions(chart, kind) {
        const width = chart.getDom().clientWidth;
        const narrow = width < 500;
        if (kind === "ranking") {
            const left = narrow ? Math.max(64, Math.min(100, Math.round(width * 0.3))) : 150;
            return {
                grid: { left, right: 72, top: 10, bottom: 34 },
                xAxis: { splitNumber: narrow ? 2 : 5 },
                yAxis: { axisLabel: { width: left - 14 } }
            };
        }
        return {
            grid: { left: narrow ? 46 : 58, right: narrow ? 16 : 22, top: 110, bottom: 42 },
            xAxis: { axisLabel: {
                formatter: value => narrow ? String(value).slice(0, 3) : value,
                hideOverlap: true
            } },
            yAxis: { splitNumber: narrow ? 3 : 5 }
        };
    }

    function resize(chart) {
        if (chart.isDisposed()) {
            observer?.unobserve(chart.getDom());
            instances.delete(chart);
            return;
        }
        const state = instances.get(chart);
        if (state?.kind === "ranking") {
            const narrow = chart.getDom().clientWidth < 500;
            const height = Math.max(narrow ? 360 : 330, state.count * (narrow ? 28 : 22) + 48);
            chart.getDom().style.height = height + "px";
        }
        chart.resize();
        if (state?.kind) {
            // Merge layout only: preserve dataZoom, legend selection and series.
            chart.setOption(responsiveOptions(chart, state.kind));
            if (state.kind === "evolution") {
                const years = chart.getOption().series.map(s => Number(s.name)).sort((a, b) => b - a);
                const narrow = chart.getWidth() < 700;
                const keep = new Set(years);
                chart.setOption({ series: chart.getOption().series.map(s => ({
                    name: s.name, label: { show: keep.has(Number(s.name)) },
                    labelLayout: { hideOverlap: Number(s.name) !== years[0] }
                })) });
                if (state.narrow !== narrow) {
                    chart.setOption({ dataZoom: [{ start: 0, end: narrow ? 25 : 100 }] });
                    state.narrow = narrow;
                }
            }
        }
    }

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(entries => {
        entries.forEach(entry => {
            const chart = echarts.getInstanceByDom(entry.target);
            if (chart && instances.has(chart)) resize(chart);
            else observer.unobserve(entry.target);
        });
    });

    function dispose(chart) {
        observer?.unobserve(chart.getDom());
        instances.delete(chart);
        chart.dispose();
    }

    function css(name) {
        return getComputedStyle(
            document.documentElement
        ).getPropertyValue(name).trim();
    }

    function common() {
        return {
            text: css("--foreground"),
            muted: css("--muted-foreground"),
            border: css("--border"),
            primary: css("--primary"),
            primary2: css("--primary-2"),
            accent: css("--accent"),
            card: css("--card")
        };
    }

    function init(el) {
        const chart = echarts.getInstanceByDom(el) || echarts.init(el);
        if (!instances.has(chart)) {
            instances.set(chart, {});
            observer?.observe(el);
        }
        return chart;
    }

    function valueLabels(chart, position, decimals, unit = "") {
        return {
            label: { show: true, position, fontSize: 10, color: common().text,
                formatter: p => {
                    if (p.value === null || p.value === undefined) return "";
                    const value = Number(p.value);
                    const compact = chart.getWidth() < 500 && Math.abs(value) >= 1000;
                    return value.toLocaleString("pt-BR", compact
                        ? { notation: "compact", maximumFractionDigits: 1 }
                        : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + (unit === "%" ? "%" : "");
                } },
            labelLayout: { hideOverlap: true }
        };
    }

    function ranking(chart, rows, title, unit = "", decimals = 2) {
        const c = common();
        instances.set(chart, { kind: "ranking", count: rows.length });

        chart.setOption({
            animationDuration: 450,
            animationEasing: "cubicOut",

            grid: {
                left: 150,
                right: 72,
                top: 10,
                bottom: 22,
                containLabel: false
            },

            tooltip: {
                trigger: "axis",
                confine: true,
                renderMode: "richText",
                axisPointer: {
                    type: "shadow"
                },
                backgroundColor: c.card,
                borderColor: c.border,
                textStyle: {
                    color: c.text
                },
                formatter(params) {
                    const item = params[0];

                    const value = Number(item.value).toLocaleString("pt-BR", {
                        minimumFractionDigits: decimals, maximumFractionDigits: decimals
                    });
                    // Canvas tooltip avoids HTML measurement expanding mobile viewports.
                    return wrapTooltip(item.name, chart.getDom().clientWidth)
                        + "\n" + wrapTooltip(title + ": " + value + (unit ? " " + unit : ""),
                            chart.getDom().clientWidth);
                }
            },

            xAxis: {
                type: "value",
                splitLine: {
                    lineStyle: {
                        color: c.border,
                        opacity: 0.55
                    }
                },
                axisLabel: {
                    color: c.muted,
                    fontSize: 10,
                    hideOverlap: true,
                    formatter: axisNumber
                }
            },

            yAxis: {
                type: "category",
                inverse: true,
                data: rows.map(r => r.nome),
                axisLine: {
                    show: false
                },
                axisTick: {
                    show: false
                },
                axisLabel: {
                    color: c.text,
                    fontSize: 10,
                    width: 136,
                    overflow: "truncate"
                }
            },

            series: [{
                type: "bar",
                data: rows.map(r => r.valor),
                ...valueLabels(chart, "right", decimals, unit),
                barWidth: 10,
                showBackground: true,
                backgroundStyle: {
                    color: c.border,
                    opacity: 0.35,
                    borderRadius: 8
                },
                itemStyle: {
                    color: c.primary,
                    borderRadius: [0, 8, 8, 0]
                }
            }]
        }, true);
        resize(chart);
    }

    function evolution(chart, response, metricName, decimals = 2, unit = "") {
        const c = common();
        instances.set(chart, { kind: "evolution" });

        const formatEvolutionValue = value => value === null || value === undefined ? "—" :
            Number(value).toLocaleString("pt-BR", {
                minimumFractionDigits: decimals, maximumFractionDigits: decimals
            }) + (unit === "%" ? "%" : "");
        const newestYear = Math.max(...response.series.map(s => Number(s.ano)));
        const series = response.series.map(
            (serie, index) => ({
                name: String(serie.ano),
                type: "bar",
                data: serie.valores,
                ...valueLabels(chart, "top", decimals, unit),
                label: { ...valueLabels(chart, "top", decimals, unit).label,
                    rotate: 90, align: "left", verticalAlign: "middle", distance: 10,
                    fontSize: 12, fontWeight: 700, color: c.text,
                    formatter: p => p.value == null ? "" : formatEvolutionValue(p.value),
                    backgroundColor: c.card, padding: [3, 4], borderRadius: 3 },
                labelLayout: { hideOverlap: Number(serie.ano) !== newestYear },
                barGap: "35%",
                barMaxWidth: 22,
                itemStyle: {
                    borderRadius: [6, 6, 0, 0],
                    color:
                        [
                            c.primary,
                            c.primary2,
                            c.accent,
                            c.muted
                        ][index % 4]
                },
                emphasis: {
                    focus: "series"
                }
            })
        );

        chart.setOption({
            animationDuration: 500,
            color: [
                c.primary,
                c.primary2,
                c.accent,
                c.muted
            ],

            tooltip: {
                trigger: "axis",
                confine: true,
                renderMode: "richText",
                valueFormatter: formatEvolutionValue,
                backgroundColor: c.card,
                borderColor: c.border,
                textStyle: {
                    color: c.text
                }
            },

            legend: {
                type: "scroll",
                top: 0,
                left: 0,
                right: 0,
                textStyle: {
                    color: c.muted,
                    fontSize: 11
                }
            },

            grid: {
                left: 48,
                right: 22,
                top: 42,
                bottom: 42
            },

            xAxis: {
                type: "category",
                data: response.meses.map(m => m.nome),
                axisLine: {
                    lineStyle: {
                        color: c.border
                    }
                },
                axisTick: {
                    show: false
                },
                axisLabel: {
                    color: c.muted,
                    fontSize: 10,
                    hideOverlap: true
                }
            },

            yAxis: {
                type: "value",
                name: metricName,
                nameTextStyle: {
                    color: c.muted,
                    fontSize: 10,
                    align: "left"
                },
                splitLine: {
                    lineStyle: {
                        color: c.border,
                        opacity: 0.55
                    }
                },
                axisLabel: {
                    color: c.muted,
                    fontSize: 10,
                    hideOverlap: true,
                    formatter: axisNumber
                }
            },

            dataZoom: [
                {
                    type: "inside"
                }
            ],

            series
        }, true);
        resize(chart);
    }

    function refreshTheme() {
        instances.forEach((_, chart) => resize(chart));
    }

    window.addEventListener(
        "resize",
        () => {
            instances.forEach((_, chart) => resize(chart));
        }
    );

    document.addEventListener(
        "dashboard:theme-changed",
        () => {
            // detalhes.js redesenha com os mesmos dados.
            document.dispatchEvent(
                new CustomEvent(
                    "charts:theme-refresh"
                )
            );
        }
    );

    window.addEventListener("pagehide", event => {
        if (!event.persisted) {
            [...instances.keys()].forEach(dispose);
            observer?.disconnect();
        }
    });

    return {
        init,
        dispose,
        ranking,
        evolution,
        refreshTheme
    };
})();
