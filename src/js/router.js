// Roteamento por History API (URLs com path limpo, sem reload).
// Rotas: "/" = runeterra ; "/region/:slug" ; "/champion/:slug".

// Monta o path a partir do slug e do tipo.
function pathFor(slug, kind) {
    if (!slug || slug === "runeterra") return "/";
    return `/${kind}/${slug}`;
}

// Extrai o slug alvo a partir do path atual da URL.
export function slugFromPath() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "runeterra";
    if ((parts[0] === "region" || parts[0] === "champion") && parts[1]) {
        return decodeURIComponent(parts[1]);
    }
    // fallback tolerante: último segmento
    return decodeURIComponent(parts[parts.length - 1]);
}

let routeHandler = () => {};

// Registra a função chamada quando a rota muda (clique, voltar/avançar).
export function onRoute(handler) {
    routeHandler = handler;
    window.addEventListener("popstate", () => routeHandler(slugFromPath()));
}

// Navega para um slug: atualiza a URL (se mudou) e dispara o handler.
export function navigateTo(slug, kind) {
    const path = pathFor(slug, kind);
    if (path !== window.location.pathname) {
        window.history.pushState({ slug, kind }, "", path);
    }
    routeHandler(slug);
}
