// Desenvolvimento local. A URL anterior permanece disponível para uso futuro.
const APP_ENV = "offline"; // offline: sem API; local: FastAPI; tunnel: produção
const API_URLS = {
    offline: "",
    local: "http://127.0.0.1:8001",
    tunnel: "https://task-uses-vector-productivity.trycloudflare.com"
};

const APP_CONFIG = {
    mode: APP_ENV === "offline" ? "offline" : `api-${APP_ENV}`,
    API_URL: API_URLS[APP_ENV],

    endpoints: {
        rxp: "/api/zootecnico/rxp",
        rxpFiltros: "/api/zootecnico/rxp/filtros",
        rxpFormulas: "/api/zootecnico/rxp/formulas",
        health:
            "/api/health",
        info:
            "/api/zootecnico/info",
        formulas:
            "/api/zootecnico/formulas",
        filtros:
            "/api/zootecnico/filtros",
        desempenho:
            "/api/zootecnico/desempenho",
        detalhes:
            "/api/zootecnico/detalhes",
        lotesInfo:
            "/api/zootecnico/lotes-em-criacao/info",
        lotesFiltros:
            "/api/zootecnico/lotes-em-criacao/filtros",
        lotesResumo:
            "/api/zootecnico/lotes-em-criacao/resumo",
        lotesFormulas:
            "/api/zootecnico/lotes-em-criacao/formulas"
    }
};
