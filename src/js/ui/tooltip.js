// Tooltip único com o nome do emblema, criado uma vez e reutilizado. Fica
// fixed no body para não ser recortado pelo overflow das colunas.
// - Desktop (colunas em pé à direita): à esquerda do emblema.
// - Mobile (faixas horizontais no rodapé): acima do emblema, centralizado e
//   sem sair da tela — à esquerda, os primeiros emblemas da faixa jogavam o
//   tooltip para fora da viewport.

const RAILS_QUERY = window.matchMedia("(max-width: 600px)");
const VIEWPORT_MARGIN = 8; // px mínimos entre o tooltip e a borda da tela

let tooltipEl = null;

function getTooltip() {
    if (!tooltipEl) {
        tooltipEl = document.createElement("div");
        tooltipEl.className = "tooltip";
        tooltipEl.setAttribute("aria-hidden", "true"); // o nome já está no alt
        document.body.appendChild(tooltipEl);
        // Rolar uma coluna/faixa deixaria o tooltip parado no lugar antigo.
        document.addEventListener("scroll", hideTooltip, { capture: true, passive: true });
    }
    return tooltipEl;
}

export function showTooltip(button, name) {
    const tip = getTooltip();
    tip.textContent = name;
    const rect = button.getBoundingClientRect();
    const above = RAILS_QUERY.matches;
    tip.classList.toggle("tooltip--above", above);

    if (above) {
        const half = tip.offsetWidth / 2;
        const center = rect.left + rect.width / 2;
        const minX = half + VIEWPORT_MARGIN;
        const maxX = window.innerWidth - half - VIEWPORT_MARGIN;
        tip.style.left = `${Math.min(Math.max(center, minX), maxX)}px`;
        tip.style.right = "auto";
        tip.style.top = `${rect.top - 10}px`;
    } else {
        // à esquerda do botão, centralizado verticalmente
        tip.style.top = `${rect.top + rect.height / 2}px`;
        tip.style.right = `${window.innerWidth - rect.left + 12}px`;
        tip.style.left = "auto";
    }
    tip.classList.add("tooltip--visible");
}

export function hideTooltip() {
    if (tooltipEl) {
        tooltipEl.classList.remove("tooltip--visible");
    }
}
