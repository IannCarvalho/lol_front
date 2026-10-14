// Configuração de runtime do frontend (sem build step).
//
// Regra: em desenvolvimento (localhost / 127.0.0.1) aponta para o backend
// local; em qualquer outro host (produção) usa a URL pública do backend.
//
// >>> Troque PROD_BACKEND_URL pela URL do seu backend no Render <<<
// (ex.: "https://lol-back.onrender.com")

(function () {
    const PROD_BACKEND_URL = "https://lol-back-6zld.onrender.com";
    const LOCAL_BACKEND_URL = "http://localhost:5000";

    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";

    window.APP_CONFIG = {
        BASE_URL: isLocal ? LOCAL_BACKEND_URL : PROD_BACKEND_URL,
    };

    // Aquecimento do backend: config.js roda ANTES de main.js (e antes de o
    // app precisar dos dados), então disparamos aqui um fetch "fire-and-forget"
    // ao /status para o Render (plano gratuito) já começar a sair do cold start
    // enquanto CSS, logo e módulos ainda carregam. Em produção poupa segundos
    // da espera inicial; local é inofensivo. O catch garante que uma falha de
    // rede aqui nunca quebra o carregamento da página.
    try {
        fetch(`${window.APP_CONFIG.BASE_URL}/status`, {
            method: "GET",
            cache: "no-store",
            keepalive: true,
        }).catch(() => {});
    } catch (_) {
        /* ambiente sem fetch: ignora, o fluxo normal segue em main.js */
    }
})();
