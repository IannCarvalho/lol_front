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

// Snapshot estático: um retrato das rotas de dados (nacionalidades + campeões
// por região) gerado no re-seed e servido junto do frontend em
// `src/data/snapshot.json`. A tela de exploração lê dele primeiro, então abre
// instantânea mesmo com o backend no plano gratuito do Render ainda acordando.
// O backend continua sendo a fonte de verdade: qualquer falha ao carregar o
// snapshot (ausente, inválido) cai de volta para a chamada ao backend.
const SNAPSHOT_URL = "/src/data/snapshot.json";
let snapshotPromise = null;

function loadSnapshot() {
    // Carrega uma única vez; a promise é reusada (e, em caso de falha, zerada
    // para não prender o fallback num estado de erro permanente).
    if (!snapshotPromise) {
        snapshotPromise = fetchJSON(SNAPSHOT_URL).catch((err) => {
            snapshotPromise = null;
            throw err;
        });
    }
    return snapshotPromise;
}

export async function getNationalities() {
    if (nationalitiesCache) {
        return nationalitiesCache;
    }
    try {
        const snapshot = await loadSnapshot();
        if (snapshot && Array.isArray(snapshot.nationalities)) {
            nationalitiesCache = snapshot.nationalities;
            return nationalitiesCache;
        }
    } catch (_) {
        /* snapshot indisponível: segue para o backend */
    }
    nationalitiesCache = await fetchJSON(`${BASE_URL}/nationality/`);
    return nationalitiesCache;
}

export async function getChampionsByRegion(regionSlug) {
    if (championsByRegionCache.has(regionSlug)) {
        return championsByRegionCache.get(regionSlug);
    }
    try {
        const snapshot = await loadSnapshot();
        const fromSnapshot =
            snapshot &&
            snapshot.championsByRegion &&
            snapshot.championsByRegion[regionSlug];
        if (Array.isArray(fromSnapshot)) {
            championsByRegionCache.set(regionSlug, fromSnapshot);
            return fromSnapshot;
        }
    } catch (_) {
        /* snapshot indisponível: segue para o backend */
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
