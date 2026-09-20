// Camada de acesso a dados: encapsula as chamadas ao backend (lol_back).
// A URL base vem do config.js de runtime (window.APP_CONFIG.BASE_URL).

const BASE_URL =
    (window.APP_CONFIG && window.APP_CONFIG.BASE_URL) || "http://localhost:5000";

async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Erro de rede: ${response.status}`);
    }
    return response.json();
}

// Cache das nacionalidades: elas não mudam durante a sessão e são consultadas
// com frequência (a cada navegação), então evitamos refetch desnecessário.
let nationalitiesCache = null;

export async function getNationalities() {
    if (!nationalitiesCache) {
        nationalitiesCache = await fetchJSON(`${BASE_URL}/nationality/`);
    }
    return nationalitiesCache;
}

export async function getChampionsByRegion(regionSlug) {
    return fetchJSON(`${BASE_URL}/nationality/champions/${regionSlug}`);
}

export async function getChampion(slug) {
    return fetchJSON(`${BASE_URL}/champion/${slug}`);
}
