/**
 * MAPA DE FÓRMULAS: ./FORMULAS.md
 * Tema visual, sem fórmulas de indicadores.
 */
(() => {
    const STORAGE_KEY = "bi-zootecnico-theme";

    function temaInicial() {
        const salvo = localStorage.getItem(STORAGE_KEY);

        if (salvo === "light" || salvo === "dark") {
            return salvo;
        }

        return window.matchMedia(
            "(prefers-color-scheme: dark)"
        ).matches
            ? "dark"
            : "light";
    }

    function aplicarTema(tema) {
        document.documentElement.dataset.theme = tema;

        document
            .querySelectorAll("[data-theme-icon]")
            .forEach(el => {
                el.textContent =
                    tema === "dark"
                        ? "☀"
                        : "☾";
            });

        document.dispatchEvent(
            new CustomEvent(
                "dashboard:theme-changed",
                { detail: { theme: tema } }
            )
        );
    }

    window.ThemeManager = {
        get() {
            return document.documentElement.dataset.theme || temaInicial();
        },

        toggle() {
            const novo =
                this.get() === "dark"
                    ? "light"
                    : "dark";

            localStorage.setItem(
                STORAGE_KEY,
                novo
            );

            aplicarTema(novo);
        },

        init() {
            aplicarTema(temaInicial());

            document.addEventListener(
                "click",
                event => {
                    const button =
                        event.target.closest(
                            "[data-theme-toggle]"
                        );

                    if (button) {
                        this.toggle();
                    }
                }
            );
        }
    };

    ThemeManager.init();
})();
