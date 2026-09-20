// Navegação por teclado entre os emblemas.
// ↑/↓ movem o foco na coluna atual; ←/→ alternam entre regiões e campeões;
// Enter/Espaço ativam (nativo do <button>).

function buttonsIn(selector) {
    return Array.from(document.querySelectorAll(`${selector} .button`));
}

function focusButton(button) {
    if (!button) return;
    button.focus({ preventScroll: false });
}

function handleKeyNav(event) {
    const active = document.activeElement;
    if (!active || !active.classList || !active.classList.contains("button")) {
        // se nada relevante está focado, uma seta foca o 1º emblema de região
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
            const first = buttonsIn(".nationalities")[0];
            if (first) {
                focusButton(first);
                event.preventDefault();
            }
        }
        return;
    }

    const inChampions = !!active.closest(".champions");
    const currentList = inChampions ? ".champions" : ".nationalities";
    const buttons = buttonsIn(currentList);
    const index = buttons.indexOf(active);

    switch (event.key) {
        case "ArrowDown":
            event.preventDefault();
            focusButton(buttons[index + 1]); // para no último (sem wrap)
            break;
        case "ArrowUp":
            event.preventDefault();
            focusButton(buttons[index - 1]); // para no primeiro (sem wrap)
            break;
        case "ArrowLeft":
            if (inChampions) {
                event.preventDefault();
                const target = buttonsIn(".nationalities");
                focusButton(target[index] || target[0]);
            }
            break;
        case "ArrowRight":
            if (!inChampions) {
                event.preventDefault();
                const target = buttonsIn(".champions");
                focusButton(target[index] || target[0]);
            }
            break;
        default:
            break;
    }
}

// Registra o listener global de teclado.
export function initKeyboardNav() {
    window.addEventListener("keydown", handleKeyNav);
}
