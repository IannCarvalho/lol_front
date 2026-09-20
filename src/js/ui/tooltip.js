// Tooltip único (posicionado à esquerda do emblema), criado uma vez e
// reutilizado. Fica fixed no body para não ser recortado pelo overflow das
// colunas.

let tooltipEl = null;

function getTooltip() {
    if (!tooltipEl) {
        tooltipEl = document.createElement("div");
        tooltipEl.className = "tooltip";
        document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
}

export function showTooltip(button, name) {
    const tip = getTooltip();
    tip.textContent = name;
    const rect = button.getBoundingClientRect();
    // à esquerda do botão, centralizado verticalmente
    tip.style.top = `${rect.top + rect.height / 2}px`;
    tip.style.right = `${window.innerWidth - rect.left + 12}px`;
    tip.style.left = "auto";
    tip.classList.add("tooltip--visible");
}

export function hideTooltip() {
    if (tooltipEl) {
        tooltipEl.classList.remove("tooltip--visible");
    }
}
