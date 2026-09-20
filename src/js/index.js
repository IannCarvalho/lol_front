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

function createElementList(item, html) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    const img = document.createElement("img");

    button.className = "button";
    button.dataset.slug = item.slug;
    img.src = item.image;
    img.alt = item.name || item.slug || "";
    img.onerror = () => { img.style.visibility = "hidden"; };
    button.addEventListener("click", () => {
        markSelected(button);
        find(item.slug);
    });

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

// Marca o botão clicado como selecionado e limpa a seleção anterior
// (em ambas as listas: regiões e campeões).
function markSelected(button) {
    document.querySelectorAll(".button.selected")
        .forEach(el => el.classList.remove("selected"));
    button.classList.add("selected");
}

async function populateNationalitiesList() {
    nationalitiesHTML = document.querySelector(".nationalities");
    const nationalities = await fetchJSON(`${BASE_URL}/nationality/`);

    nationalities.forEach(item => createElementList(item, nationalitiesHTML));
}

async function populateChampionsList(nationality) {
    const championsHTML = document.querySelector(".champions");
    const champions = await fetchJSON(`${BASE_URL}/nationality/champions/${nationality}`);
    championsHTML.innerHTML = "";

    champions.forEach(item => createElementList(item, championsHTML));
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
        } catch (error) {
            console.error('Erro na requisição:', error);
        } finally {
            showLoader(false);
        }
    }
}

populateNationalitiesList()
populateChampionsList(ACTUAL_ELEMENT)

// Avalia a descrição inicial (Runeterra, vinda do HTML) para decidir o fade.
setDescription(document.getElementById("description").textContent);