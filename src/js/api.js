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

// Cache dos campeões por região (um valor por regionSlug): mesmo princípio do
// nationalitiesCache. Voltar a uma região já visitada passa a ser instantâneo
// (sem round-trip ao backend), importante no plano gratuito do Render.
const championsByRegionCache = new Map();

export async function getNationalities() {
    if (!nationalitiesCache) {
        nationalitiesCache = await fetchJSON(`${BASE_URL}/nationality/`);
    }
    return nationalitiesCache;
}

export async function getChampionsByRegion(regionSlug) {
    if (championsByRegionCache.has(regionSlug)) {
        return championsByRegionCache.get(regionSlug);
    }
    const champions = await fetchJSON(
        `${BASE_URL}/nationality/champions/${regionSlug}`
    );
    championsByRegionCache.set(regionSlug, champions);
    return champions;
}

export async function getChampion(slug) {
    return fetchJSON(`${BASE_URL}/champion/${slug}`);
}
