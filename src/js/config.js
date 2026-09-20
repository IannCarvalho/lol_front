// Configuração de runtime do frontend (sem build step).
//
// Regra: em desenvolvimento (localhost / 127.0.0.1) aponta para o backend
// local; em qualquer outro host (produção) usa a URL pública do backend.
//
// >>> Troque PROD_BACKEND_URL pela URL do seu backend no Render <<<
// (ex.: "https://lol-back.onrender.com")

(function () {
    const PROD_BACKEND_URL = "https://lol-back.onrender.com";
    const LOCAL_BACKEND_URL = "http://localhost:5000";

    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";

    window.APP_CONFIG = {
        BASE_URL: isLocal ? LOCAL_BACKEND_URL : PROD_BACKEND_URL,
    };
})();
