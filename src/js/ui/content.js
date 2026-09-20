// Conteúdo central: título, descrição (com fade condicional), breadcrumb,
// título da aba, animação de entrada e estado de erro.

import { setBackgroundImage } from "./background.js";

// Define o texto da descrição e aplica o fade no rodapé APENAS quando o
// conteúdo transborda (precisa rolar). Se cabe todo, sem fade.
export function setDescription(text) {
    const description = document.getElementById("description");
    description.textContent = text || "";
    requestAnimationFrame(() => {
        const overflowing = description.scrollHeight > description.clientHeight + 1;
        description.classList.toggle("description--scrollable", overflowing);
        description.scrollTop = 0;
    });
}

export function setTitle(text) {
    document.getElementById("title").textContent = text;
}

// Breadcrumb da região de origem (quando se vê um campeão). Recebe
// `onNavigate(slug)` para não acoplar este módulo ao router.
// region = { slug, name } ou null para esconder.
export function setBreadcrumb(region, onNavigate) {
    const el = document.getElementById("breadcrumb");
    if (!el) return;
    if (region && region.name) {
        el.textContent = `${region.name} ›`;
        el.hidden = false;
        el.onclick = () => onNavigate(region.slug);
    } else {
        el.hidden = true;
        el.onclick = null;
    }
}

// Atualiza o título da aba: "Zaun · Runeterra"; na raiz, apenas "Runeterra".
export function setPageTitle(name) {
    document.title =
        name && name !== "Runeterra" ? `${name} · Runeterra` : "Runeterra";
}

// Re-dispara a animação de entrada do título + descrição (fade/slide).
export function playContentEnter() {
    const content = document.querySelector(".content");
    if (!content) return;
    content.classList.remove("content--enter");
    void content.offsetWidth; // força reflow para reiniciar a animação
    content.classList.add("content--enter");
}

// Mensagem amigável na tela quando algo falha (backend fora do ar, rede).
export function showError(message) {
    const breadcrumb = document.getElementById("breadcrumb");
    if (breadcrumb) breadcrumb.hidden = true;
    setTitle("Ops, algo deu errado");
    setDescription(
        message ||
        "Não foi possível carregar os dados. Verifique sua conexão ou se o servidor está no ar e tente novamente."
    );
    setBackgroundImage(null); // cai no gradiente de fallback
    playContentEnter();
}
