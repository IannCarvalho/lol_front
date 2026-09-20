const BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.BASE_URL) || "http://localhost:5000";
var ACTUAL_ELEMENT = "runeterra";

async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Erro de rede: ${response.status}`);
    }
    return response.json();
}

// Define a imagem de fundo com crossfade suave e tratamento de falha:
// esmaece a imagem atual, troca o src, e reexibe quando a nova carrega.
// Se a URL quebrar, marca como "failed" para o CSS mostrar o gradiente.
// Duração do fade-out (deve casar com a transição em estilos.css).
const FADE_MS = 400;

// Retorna uma Promise que resolve quando a imagem terminou a troca (com fade).
function setBackgroundImage(url) {
    const image = document.getElementById("image");

    if (!url) {
        image.classList.add("image--failed");
        return Promise.resolve();
    }

    // inicia o fade-out imediatamente
    image.classList.add("image--fading");

    // pré-carrega a nova imagem em paralelo ao fade-out
    const preload = new Image();
    const loaded = new Promise((resolve) => {
        preload.onload = () => resolve(true);
        preload.onerror = () => resolve(false);
    });
    preload.src = url;

    // garante um tempo mínimo de fade-out (mesmo que a imagem já esteja em
    // cache e carregue instantaneamente), para o crossfade ser sempre visível
    const faded = new Promise((resolve) => setTimeout(resolve, FADE_MS));

    return Promise.all([loaded, faded]).then(([ok]) => {
        if (ok) {
            image.src = url;
            image.classList.remove("image--failed");
            requestAnimationFrame(() => image.classList.remove("image--fading"));
        } else {
            image.classList.add("image--failed");
            image.classList.remove("image--fading");
        }
    });
}

// Mostra/esconde o indicador de carregamento
function showLoader(show) {
    const loader = document.getElementById("loader");
    if (loader) {
        loader.hidden = !show;
    }
}

// Tooltip único (posicionado à esquerda do emblema), fora das colunas para
// não ser recortado pelo overflow.
let tooltipEl = null;
function getTooltip() {
    if (!tooltipEl) {
        tooltipEl = document.createElement("div");
        tooltipEl.className = "tooltip";
        document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
}

function showTooltip(button, name) {
    const tip = getTooltip();
    tip.textContent = name;
    const rect = button.getBoundingClientRect();
    // posiciona à esquerda do botão, centralizado verticalmente
    tip.style.top = `${rect.top + rect.height / 2}px`;
    tip.style.right = `${window.innerWidth - rect.left + 12}px`;
    tip.style.left = "auto";
    tip.classList.add("tooltip--visible");
}

function hideTooltip() {
    if (tooltipEl) {
        tooltipEl.classList.remove("tooltip--visible");
    }
}

function createElementList(item, html, kind, index) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    const img = document.createElement("img");

    const name = item.name || item.slug || "";
    button.className = "button";
    button.dataset.slug = item.slug;
    button.dataset.name = name;
    // stagger da animação de entrada (só campeões animam; ver CSS).
    // Limita o atraso acumulado para listas grandes não demorarem demais.
    if (kind === "champion" && typeof index === "number") {
        const delay = Math.min(index * 0.04, 0.6);
        button.style.setProperty("--enter-delay", `${delay}s`);
    }
    img.src = item.image;
    img.alt = name;
    img.onerror = () => { img.style.visibility = "hidden"; };
    button.addEventListener("click", () => {
        // navega via History API (path limpo); find() renderiza o conteúdo
        navigateTo(item.slug, kind);
    });

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
    html.appendChild(li);
}

// Define o texto da descrição e aplica o fade no rodapé APENAS quando o
// conteúdo transborda (precisa rolar). Se o texto cabe todo, sem fade.
function setDescription(text) {
    const description = document.getElementById("description");
    description.textContent = text || "";
    // aguarda o layout recalcular antes de medir o overflow
    requestAnimationFrame(() => {
        const overflowing = description.scrollHeight > description.clientHeight + 1;
        description.classList.toggle("description--scrollable", overflowing);
        description.scrollTop = 0;
    });
}

// Marca como selecionado o botão de um dado slug e limpa a seleção anterior
// (em ambas as listas: regiões e campeões). Funciona tanto para clique quanto
// para navegação via URL.
function markSelectedBySlug(slug) {
    document.querySelectorAll(".button.selected")
        .forEach(el => el.classList.remove("selected"));
    const button = document.querySelector(`.button[data-slug="${slug}"]`);
    if (button) {
        button.classList.add("selected");
    }
}

// Monta o path de uma rota a partir do slug. Regiões e campeões usam
// prefixos distintos para URLs semânticas: /region/:slug e /champion/:slug.
// A raiz "/" representa Runeterra.
function pathFor(slug, kind) {
    if (!slug || slug === "runeterra") return "/";
    return `/${kind}/${slug}`;
}

// Navega para um slug usando a History API (URL com path limpo, sem reload).
function navigateTo(slug, kind) {
    const path = pathFor(slug, kind);
    if (path !== window.location.pathname) {
        window.history.pushState({ slug, kind }, "", path);
    }
    find(slug);
}

// Extrai o slug alvo a partir do path atual da URL.
// "/" -> runeterra ; "/region/zaun" -> zaun ; "/champion/garen" -> garen
function slugFromPath() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "runeterra";
    // aceita /region/<slug> e /champion/<slug>; ignora o prefixo
    if ((parts[0] === "region" || parts[0] === "champion") && parts[1]) {
        return decodeURIComponent(parts[1]);
    }
    // fallback tolerante: último segmento
    return decodeURIComponent(parts[parts.length - 1]);
}

async function populateNationalitiesList() {
    nationalitiesHTML = document.querySelector(".nationalities");
    const nationalities = await fetchJSON(`${BASE_URL}/nationality/`);

    nationalities.forEach(item => createElementList(item, nationalitiesHTML, "region"));
}

async function populateChampionsList(nationality) {
    const championsHTML = document.querySelector(".champions");
    const champions = await fetchJSON(`${BASE_URL}/nationality/champions/${nationality}`);
    championsHTML.innerHTML = "";

    champions.forEach((item, i) => createElementList(item, championsHTML, "champion", i));
}

async function find(element) {
    if (ACTUAL_ELEMENT != element) {
        showLoader(true);
        try {
            const nationalityData = await fetchJSON(`${BASE_URL}/nationality/`);
            const regions = nationalityData.map(item => item.slug);

            if (regions.includes(element)) {
                populateChampionsList(element);

                const selectedNationality = nationalityData.find(item => item.slug === element);
                document.getElementById("title").textContent = selectedNationality.name;
                setDescription(selectedNationality.overview);
                await setBackgroundImage(selectedNationality.background);
            } else {
                const championData = await fetchJSON(`${BASE_URL}/champion/${element}`);
                document.getElementById("title").textContent = `${championData.name}: ${championData.title}`;
                setDescription(championData.lore);
                await setBackgroundImage(championData.background);
            }
            ACTUAL_ELEMENT = element;
            markSelectedBySlug(element);
        } catch (error) {
            console.error('Erro na requisição:', error);
        } finally {
            showLoader(false);
        }
    } else {
        // mesmo elemento: apenas garante o destaque do botão
        markSelectedBySlug(element);
    }
}

// Reage aos botões voltar/avançar do navegador (History API).
window.addEventListener("popstate", () => {
    find(slugFromPath());
});

// --- Navegação por teclado ---------------------------------------------
// ↑/↓ movem o foco entre os emblemas da coluna atual; ←/→ alternam entre a
// coluna de regiões e a de campeões; Enter/Espaço ativam (nativo do button).
function buttonsIn(selector) {
    return Array.from(document.querySelectorAll(`${selector} .button`));
}

// Foca um botão. O foco nativo do navegador já rola o mínimo necessário para
// mantê-lo visível, sem reposicionar a lista de forma desorientadora.
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
        case "ArrowDown": {
            event.preventDefault();
            // para no último item (sem voltar ao topo) para não desorientar
            focusButton(buttons[index + 1]);
            break;
        }
        case "ArrowUp": {
            event.preventDefault();
            // para no primeiro item (sem pular para o fim)
            focusButton(buttons[index - 1]);
            break;
        }
        case "ArrowLeft": {
            // regiões ficam à esquerda dos campeões: vai de campeões -> regiões
            if (inChampions) {
                event.preventDefault();
                const target = buttonsIn(".nationalities");
                focusButton(target[index] || target[0]);
            }
            break;
        }
        case "ArrowRight": {
            // campeões ficam à direita das regiões: vai de regiões -> campeões
            if (!inChampions) {
                event.preventDefault();
                const target = buttonsIn(".champions");
                focusButton(target[index] || target[0]);
            }
            break;
        }
        default:
            break;
    }
}

window.addEventListener("keydown", handleKeyNav);

// Inicialização: popula as listas e navega para o alvo do path (ou Runeterra).
async function init() {
    await populateNationalitiesList();
    await populateChampionsList("runeterra");
    // avalia a descrição inicial (Runeterra, vinda do HTML) para decidir o fade
    setDescription(document.getElementById("description").textContent);

    const initial = slugFromPath();
    if (initial !== "runeterra") {
        // carrega o alvo do deep-link; find() cuida de imagem, texto e seleção
        find(initial);
    } else {
        markSelectedBySlug("runeterra");
    }
}

init();