/**
 * Cliente HTTP do BI Zootécnico.
 *
 * O navegador não lê mais Parquet. Todos os dados vêm da API local
 * publicada pelo Cloudflare Tunnel.
 */
async function apiGet(
    endpoint,
    params = {},
    options = {}
) {
    if (!endpoint) {
        throw new Error(
            "Endpoint da API não informado."
        );
    }

    const baseUrl =
        String(APP_CONFIG.API_URL || "")
            .replace(/\/+$/, "");

    if (!baseUrl) {
        throw new Error(
            "APP_CONFIG.API_URL não configurada."
        );
    }

    const normalizedEndpoint =
        endpoint.startsWith("/")
            ? endpoint
            : `/${endpoint}`;

    const url =
        new URL(
            baseUrl + normalizedEndpoint
        );

    Object
        .entries(params || {})
        .forEach(
            ([key, value]) => {
                if (
                    value === null
                    || value === undefined
                    || value === ""
                ) {
                    return;
                }

                if (Array.isArray(value)) {
                    value.forEach(item => {
                        if (
                            item !== null
                            && item !== undefined
                            && item !== ""
                        ) {
                            url.searchParams.append(
                                key,
                                String(item)
                            );
                        }
                    });

                    return;
                }

                url.searchParams.append(
                    key,
                    String(value)
                );
            }
        );

    let response;

    try {
        response = await fetch(
            url,
            {
                method: "GET",
                signal: options.signal,
                cache: options.cache || "no-store",
                headers: {
                    "Accept": "application/json"
                }
            }
        );
    }
    catch (error) {
        if (error?.name === "AbortError") {
            throw error;
        }

        throw new Error(
            "Não foi possível conectar à API do BI. "
            + "Verifique se a FastAPI e o Cloudflare Tunnel estão ligados."
        );
    }

    if (!response.ok) {
        let detail = "";

        try {
            const body = await response.json();

            if (body?.detail) {
                detail = ` - ${body.detail}`;
            }
        }
        catch (_) {
            // Resposta não-JSON: mantém apenas o status HTTP.
        }

        throw new Error(
            `Erro na API: ${response.status}${detail}`
        );
    }

    return response.json();
}
