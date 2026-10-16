// Colunas de emblemas (regiões e campeões): criação dos botões, renderização
// das listas e destaque do item selecionado.
//
// Este módulo SÓ renderiza e marca seleção — não busca dados. A orquestração de
// dados (snapshot/backend/cache) fica no main.js, que passa itens já prontos.

import { showTooltip, hideTooltip } from "./tooltip.js";

// Cria um botão de emblema. Recebe um objeto de opções (em vez de uma lista
// longa de parâmetros posicionais). `onSelect(slug, kind)` é chamado no clique
// — assim este módulo não conhece o router diretamente.
function createEmblem(item, { container, kind, index, onSelect }) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    const img = document.createElement("img");

    const name = item.name || item.slug || "";
    button.className = "button";
    button.dataset.slug = item.slug;
    button.dataset.name = name;

    // stagger da animação de entrada (só campeões animam; ver CSS)
    if (kind === "champion" && typeof index === "number") {
        const delay = Math.min(index * 0.04, 0.6);
        button.style.setProperty("--enter-delay", `${delay}s`);
    }

    img.src = item.image;
    img.alt = name;
    img.onerror = () => {
        img.style.visibility = "hidden";
    };

    button.addEventListener("click", () => onSelect(item.slug, kind));

    // tooltip com o nome ao passar o mouse / focar por teclado
    if (name) {
        const show = () => showTooltip(button, name);
        const hide = () => hideTooltip();
        button.addEventListener("mouseenter", show);
        button.addEventListener("mouseleave", hide);
        button.addEventListener("focus", show);
        button.addEventListener("blur", hide);
    }

    button.appendChild(img);
    li.appendChild(button);
    container.appendChild(li);
}

// Renderiza a coluna de regiões a partir de itens JÁ carregados.
export function renderNationalitiesList(items, onSelect) {
    const container = document.querySelector(".nationalities");
    if (!container) return;
    container.innerHTML = ""; // remove skeletons da carga inicial
    items.forEach((item) =>
        createEmblem(item, { container, kind: "region", onSelect })
    );
}

// Renderiza a coluna de campeões a partir de itens JÁ carregados (sem fetch).
export function renderChampionsList(items, onSelect) {
    const container = document.querySelector(".champions");
    if (!container) return;
    container.innerHTML = "";
    items.forEach((item, i) =>
        createEmblem(item, { container, kind: "champion", index: i, onSelect })
    );
}

// Preenche uma coluna com emblemas-fantasma (skeletons) enquanto os dados
// reais não chegam — assim o usuário vê a coluna "viva" durante o cold start
// do backend em vez de uma coluna vazia. `count` é só uma estimativa visual.
function renderSkeletons(container, count) {
    container.innerHTML = "";
    for (let i = 0; i < count; i++) {
        const li = document.createElement("li");
        li.className = "skeleton-emblem";
        li.setAttribute("aria-hidden", "true");
        container.appendChild(li);
    }
}

// Mostra skeletons nas colunas Regiões e Campeões durante a carga INICIAL.
export function showColumnsLoading() {
    const nationalities = document.querySelector(".nationalities");
    const champions = document.querySelector(".champions");
    if (nationalities) renderSkeletons(nationalities, 6);
    if (champions) renderSkeletons(champions, 8);
}

// Limpa os skeletons de uma coluna (usado quando a carga inicial falha, para a
// coluna não ficar piscando emblemas-fantasma para sempre embaixo do erro).
function clearSkeletons(container) {
    if (!container) return;
    container
        .querySelectorAll(".skeleton-emblem")
        .forEach((el) => el.remove());
}

// Limpa os skeletons das duas colunas.
export function clearColumnsLoading() {
    clearSkeletons(document.querySelector(".nationalities"));
    clearSkeletons(document.querySelector(".champions"));
}

// Marca como selecionado o botão de `slug` DENTRO de uma coluna (seletor de
// container), limpando a seleção anterior daquela coluna e ajustando
// `aria-current`. Rola o selecionado para a vista sem rolar a página.
function markSelectedIn(containerSelector, slug) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    container.querySelectorAll(".button.selected").forEach((el) => {
        el.classList.remove("selected");
        el.removeAttribute("aria-current");
    });
    if (!slug) return;
    const button = container.querySelector(
        `.button[data-slug="${CSS.escape(slug)}"]`
    );
    if (button) {
        button.classList.add("selected");
        button.setAttribute("aria-current", "true");
        // "nearest" não rola se já estiver visível; a coluna é o scroller, não
        // a página (confirmado no harness: window.scrollX/Y continuam 0).
        button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
}

// Marca a seleção das DUAS colunas: a região de contexto na coluna Regiões e o
// campeão na coluna Campeões. Passar null em qualquer uma só limpa aquela
// coluna. Isso permite, ao ver um campeão, manter a região dele destacada.
export function markColumnSelection(regionSlug, championSlug) {
    markSelectedIn(".nationalities", regionSlug);
    markSelectedIn(".champions", championSlug);
}
