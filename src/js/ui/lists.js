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
