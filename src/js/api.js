// Camada de acesso a dados: encapsula as chamadas ao backend (lol_back).
// A URL base vem do config.js de runtime (window.APP_CONFIG.BASE_URL).

const BASE_URL =
    (window.APP_CONFIG && window.APP_CONFIG.BASE_URL) || "http://localhost:5000";

// Timeouts nomeados (via AbortController). O backend no plano gratuito do
// Render pode levar ~30-50s para sair do cold start; por isso as chamadas sem
// alternativa esperam acima de um cold start tipico. O snapshot e um arquivo
// estatico servido junto do frontend, entao espera pouco antes de cair para o
// backend. Quando o detalhe do campeao JA existe no snapshot, a chamada ao
// backend usa um timeout curto (o snapshot cobre o erro/espera).
const BACKEND_TIMEOUT_MS = 60000; // chamada ao backend sem alternativa
const SNAPSHOT_TIMEOUT_MS = 10000; // snapshot estatico (cai para o backend)
const CHAMPION_SOFT_TIMEOUT_MS = 5000; // detalhe com fallback no snapshot

// Erro de HTTP com status: distingue um 404 (recurso inexistente, resposta
// definitiva) de um erro de rede/servidor. O 404 nao e "erro de rede" e nao
// deve cair em nenhum fallback.
export class HttpError extends Error {
    constructor(status, message) {
        super(message || `Erro HTTP ${status}`);
        this.name = "HttpError";
        this.status = status;
    }
}

// fetch com timeout via AbortController. Lanca HttpError(status) para respostas
// nao-ok (ex.: 404, 500) e um Error de rede para falha de conexao/timeout.
async function fetchJSON(url, timeoutMs = BACKEND_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
        response = await fetch(url, { signal: controller.signal });
    } catch (err) {
        // AbortError (timeout) ou falha de rede: ambos sao "erro de rede".
        throw new Error(`Erro de rede: ${err && err.name === "AbortError" ? "timeout" : err}`);
    } finally {
        clearTimeout(timer);
    }
    if (!response.ok) {
        throw new HttpError(response.status, `Erro HTTP ${response.status}`);
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

// Cache do detalhe de campeões já carregados (um valor por slug): evita refetch
// ao revisitar um campeão (como no championsByRegionCache).
const championCache = new Map();

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
        snapshotPromise = fetchJSON(SNAPSHOT_URL, SNAPSHOT_TIMEOUT_MS).catch((err) => {
            snapshotPromise = null;
            throw err;
        });
    }
    return snapshotPromise;
}

// Procura o campeão `slug` dentro do snapshot (varrendo as regiões). Retorna o
// objeto completo do campeão, ou null se o snapshot falhar ou não o tiver.
async function championFromSnapshot(slug) {
    try {
        const snapshot = await loadSnapshot();
        const byRegion = snapshot && snapshot.championsByRegion;
        if (!byRegion) return null;
        for (const slugKey of Object.keys(byRegion)) {
            const list = byRegion[slugKey];
            if (!Array.isArray(list)) continue;
            const found = list.find((c) => c && c.slug === slug);
            if (found) return found;
        }
        return null;
    } catch (_) {
        return null;
    }
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
        `${BASE_URL}/nationality/champions/${encodeURIComponent(regionSlug)}`
    );
    championsByRegionCache.set(regionSlug, champions);
    return champions;
}

export async function getChampion(slug) {
    if (championCache.has(slug)) {
        return championCache.get(slug);
    }

    const url = `${BASE_URL}/champion/${encodeURIComponent(slug)}`;
    const snapshotChampion = await championFromSnapshot(slug);

    if (snapshotChampion) {
        // O campeão existe no snapshot: o backend continua sendo a fonte
        // primária (dados sempre atuais), mas com timeout curto. Em erro de
        // rede, timeout ou 5xx, devolvemos o snapshot — isso elimina a espera
        // do cold start no clique e também cobre o caso em que o CORS do
        // backend bloqueia (ex.: previews da Vercel). Um 404 do backend é
        // resposta DEFINITIVA e NÃO cai no snapshot.
        try {
            const champion = await fetchJSON(url, CHAMPION_SOFT_TIMEOUT_MS);
            championCache.set(slug, champion);
            return champion;
        } catch (err) {
            if (err instanceof HttpError && err.status === 404) {
                throw err;
            }
            // erro de rede / timeout / 5xx: usa o snapshot
            championCache.set(slug, snapshotChampion);
            return snapshotChampion;
        }
    }

    // Não existe no snapshot: backend é a única fonte, com o timeout longo.
    const champion = await fetchJSON(url, BACKEND_TIMEOUT_MS);
    championCache.set(slug, champion);
    return champion;
}
