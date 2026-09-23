const APP_CONFIG = {
    mode: "api-tunnel",

    // URL temporária do Cloudflare Quick Tunnel usada no teste atual.
    // Quando o cloudflared reiniciar, a URL trycloudflare.com pode mudar.
    // Troque somente este valor quando isso acontecer.
    API_URL:
        "https://task-uses-vector-productivity.trycloudflare.com",

    endpoints: {
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
            "/api/zootecnico/detalhes"
    }
};
