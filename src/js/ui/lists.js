// Colunas de emblemas (regiões e campeões): criação dos botões, população das
// listas e destaque do item selecionado.

import { getNationalities, getChampionsByRegion } from "../api.js";
import { showTooltip, hideTooltip } from "./tooltip.js";

// Cria um botão de emblema. `onSelect(slug, kind)` é chamado no clique — assim
// este módulo não conhece o router diretamente.
function createElementList(item, container, kind, index, onSelect) {
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

export async function populateNationalitiesList(onSelect) {
    const container = document.querySelector(".nationalities");
    const nationalities = await getNationalities();
    container.innerHTML = ""; // remove skeletons da carga inicial
    nationalities.forEach((item) =>
        createElementList(item, container, "region", undefined, onSelect)
    );
}

export async function populateChampionsList(regionSlug, onSelect) {
    const container = document.querySelector(".champions");
    const champions = await getChampionsByRegion(regionSlug);
    container.innerHTML = "";
    champions.forEach((item, i) =>
        createElementList(item, container, "champion", i, onSelect)
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

// Marca como selecionado o botão de um dado slug e limpa a seleção anterior.
export function markSelectedBySlug(slug) {
    document
        .querySelectorAll(".button.selected")
        .forEach((el) => el.classList.remove("selected"));
    const button = document.querySelector(`.button[data-slug="${slug}"]`);
    if (button) {
        button.classList.add("selected");
    }
}
