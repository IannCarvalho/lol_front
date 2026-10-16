// Conteúdo central: título (nome + epíteto), descrição (com fade condicional),
// breadcrumb, título da aba, animação de entrada e estado de erro.

import { setBackgroundImage } from "./background.js";

// Liga/desliga o fade do rodapé conforme o texto transborda ou não.
function updateDescriptionFade(description) {
    const overflowing = description.scrollHeight > description.clientHeight + 1;
    description.classList.toggle("description--scrollable", overflowing);
}

// Reavalia o fade quando o espaço disponível muda (girar o celular,
// redimensionar a janela), e não só quando o texto troca.
let descriptionObserver = null;
function watchDescription(description) {
    if (descriptionObserver || typeof ResizeObserver === "undefined") return;
    descriptionObserver = new ResizeObserver(() => updateDescriptionFade(description));
    descriptionObserver.observe(description);
}

// Define o texto da descrição e aplica o fade no rodapé APENAS quando o
// conteúdo transborda (precisa rolar). Se cabe todo, sem fade.
export function setDescription(text) {
    const description = document.getElementById("description");
    description.textContent = text || "";
    watchDescription(description);
    requestAnimationFrame(() => {
        updateDescriptionFade(description);
        description.scrollTop = 0;
    });
}

// Título do elemento: o nome no <h1> e, para campeões, o epíteto logo abaixo
// (ex.: "Jinx" + "o Gatilho Desenfreado"). Sem epíteto, a linha some.
export function setHeading(name, epithet) {
    document.getElementById("title").textContent = name;
    const epithetEl = document.getElementById("epithet");
    if (epithetEl) {
        epithetEl.textContent = epithet || "";
        epithetEl.hidden = !epithet;
    }
}

// Título sem epíteto (regiões, tela de erro).
export function setTitle(text) {
    setHeading(text, null);
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
