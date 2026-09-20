const BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.BASE_URL) || "http://localhost:5000";
var ACTUAL_ELEMENT = "runeterra";

async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Erro de rede: ${response.status}`);
    }
    return response.json();
}

// Define a imagem de fundo tratando falha de carregamento: se a URL quebrar,
// marca a imagem como "failed" para o CSS mostrar o gradiente de fundo.
function setBackgroundImage(url) {
    const image = document.getElementById("image");
    image.classList.remove("image--failed");
    image.onerror = () => image.classList.add("image--failed");
    image.src = url || "";
    if (!url) {
        image.classList.add("image--failed");
    }
}

function createElementList(item, html) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    const img = document.createElement("img");

    button.className = "button";
    img.src = item.image;
    img.alt = item.name || item.slug || "";
    img.onerror = () => { img.style.visibility = "hidden"; };
    button.addEventListener("click", () => find(item.slug));

    button.appendChild(img);
    li.appendChild(button);
    html.appendChild(li);
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
        try {
            const nationalityData = await fetchJSON(`${BASE_URL}/nationality/`);
            const regions = nationalityData.map(item => item.slug);

            if (regions.includes(element)) {
                populateChampionsList(element);

                const selectedNationality = nationalityData.find(item => item.slug === element);
                setBackgroundImage(selectedNationality.background);
                document.getElementById("title").textContent = selectedNationality.name;
                document.getElementById("description").textContent = selectedNationality.overview;
            } else {
                const championData = await fetchJSON(`${BASE_URL}/champion/${element}`);
                setBackgroundImage(championData.background);
                document.getElementById("title").textContent = `${championData.name}: ${championData.title}`;
                document.getElementById("description").textContent = championData.lore;
            }
            ACTUAL_ELEMENT = element;
        } catch (error) {
            console.error('Erro na requisição:', error);
        }
    }
}

populateNationalitiesList()
populateChampionsList(ACTUAL_ELEMENT)