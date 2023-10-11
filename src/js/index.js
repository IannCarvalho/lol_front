const BASE_URL = "http://localhost:5000";

async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Erro de rede: ${response.status}`);
    }
    return response.json();
}

function populateChampionsList(champions, champions_html) {
    champions_html.innerHTML = "";
    champions.forEach(item => {
        const li = document.createElement("li");
        const button = document.createElement("button");
        const img = document.createElement("img");

        button.className = "botao";
        img.src = item.image;
        button.addEventListener("click", () => filtrar(item.name));

        button.appendChild(img);
        li.appendChild(button);
        champions_html.appendChild(li);
    });
}

async function filtrar(filtro) {
    try {
        const nationalityData = await fetchJSON(`${BASE_URL}/nationality/`);
        const regions = nationalityData.map(item => item.slug);

        if (regions.includes(filtro)) {
            const champions_html = document.querySelector(".botoes");
            const nationalityChampions = await fetchJSON(`${BASE_URL}/nationality/champions/${filtro}`);
            
            populateChampionsList(nationalityChampions, champions_html);

            const selectedNationality = nationalityData.find(item => item.slug === filtro);
            document.getElementById("imagemSelecionada").src = selectedNationality.background;
            document.getElementById("title_text").textContent = filtro;
            document.getElementById("description_text").textContent = selectedNationality.overview.short;
        } else {
            const championData = await fetchJSON(`${BASE_URL}/champion/${filtro}`);
            document.getElementById("imagemSelecionada").src = championData.background;
            document.getElementById("title_text").textContent =  `${championData.name}: ${championData.title}`;
            document.getElementById("description_text").textContent = championData.lore;
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
    }
}
