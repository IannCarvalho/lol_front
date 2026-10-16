// Ponto de entrada: orquestra os módulos.
// Carrega dados via api, renderiza via ui, e reage à rota via router.

import { getNationalities, getChampion, getChampionsByRegion, HttpError } from "./api.js";
import { setBackgroundImage } from "./ui/background.js";
import {
    setTitle,
    setDescription,
    setBreadcrumb,
    setPageTitle,
    playContentEnter,
    showError,
} from "./ui/content.js";
import {
    renderNationalitiesList,
    renderChampionsList,
    markColumnSelection,
    showColumnsLoading,
    clearColumnsLoading,
} from "./ui/lists.js";
import { showLoader } from "./ui/loader.js";
import { navigateTo, onRoute, slugFromPath } from "./router.js";
import { initKeyboardNav } from "./keyboard.js";

// Atraso antes de a mensagem de carregamento aparecer: se os dados chegam antes
// disso, a mensagem nunca aparece (evita flash).
const WAKE_DELAY_MS = 1200;

// Mensagem neutra e temática mostrada durante uma espera longa (carga inicial
// ou navegação). Não anuncia detalhes de infraestrutura.
const WAKE_TEXT = "Carregando dados de Runeterra…";

let currentSlug = "runeterra";

// Seleção atual por coluna: a região de contexto (coluna Regiões) e o campeão
// (coluna Campeões, ou null quando estamos vendo uma região). Mantido para o
// early-return remarcar as duas colunas corretamente sem refazer a navegação.
let currentRegionSlug = "runeterra";
let currentChampionSlug = null;

// Qual a lista de campeões (região) atualmente renderizada na coluna, para
// decidir se precisamos re-renderizar a coluna ao abrir um campeão de outra
// região (deep link).
let renderedChampionsRegion = "runeterra";

// "A última navegação vence": cada clique/rota incrementa este id. Após cada
// `await`, uma navegação só mexe na UI se ainda for a atual; senão sai calada.
// Resolve a corrida em que a resposta lenta de A chega depois de B e sobrescreve
// o conteúdo de B (URL diz B, tela mostra A).
let navToken = 0;

// Clique/navegação nos emblemas -> muda a rota (o router chama loadElement).
function onSelect(slug, kind) {
    navigateTo(slug, kind);
}

// Mostra o aviso de carregamento (classe `wake-message`) depois de WAKE_DELAY_MS,
// atrelado a `token`: se a navegação já não for a atual quando o timer disparar,
// não mostra; a função devolvida remove o aviso e cancela o timer pendente.
function startWakeMessage(token) {
    let banner = null;

    const timer = setTimeout(() => {
        if (token !== navToken) return;
        banner = document.createElement("div");
        banner.className = "wake-message";
        banner.setAttribute("role", "status");
        banner.setAttribute("aria-live", "polite");
        banner.textContent = WAKE_TEXT;
        document.body.appendChild(banner);
    }, WAKE_DELAY_MS);

    return function stop() {
        clearTimeout(timer);
        if (banner && banner.parentNode) {
            banner.parentNode.removeChild(banner);
        }
    };
}

// Garante que a coluna Campeões mostra a lista de `regionSlug` (vem do
// snapshot/cache, instantâneo). Só re-renderiza se a lista exibida for de outra
// região. Retorna true se a navegação `token` continua válida ao final.
async function ensureChampionsColumn(regionSlug, token) {
    if (renderedChampionsRegion === regionSlug) return token === navToken;
    const champions = await getChampionsByRegion(regionSlug);
    if (token !== navToken) return false;
    renderChampionsList(champions, onSelect);
    renderedChampionsRegion = regionSlug;
    return true;
}

// Carrega e renderiza um elemento (região ou campeão) a partir do slug.
// Controle de concorrência: "a última navegação vence".
async function loadElement(slug) {
    const token = ++navToken;

    // Early-return para o slug atual TAMBÉM invalida uma navegação em voo
    // (cenário: mostrando A, clica B, volta a clicar A antes de B chegar =>
    // tem que ficar A). O token já foi incrementado acima, então qualquer
    // await de B em voo vai sair calado.
    if (slug === currentSlug) {
        markColumnSelection(currentRegionSlug, currentChampionSlug);
        return;
    }

    showLoader(true);
    const stopWakeMessage = startWakeMessage(token);
    try {
        const nationalities = await getNationalities();
        if (token !== navToken) return;
        const region = nationalities.find((n) => n.slug === slug);

        if (region) {
            const stillCurrent = await ensureChampionsColumn(region.slug, token);
            if (!stillCurrent) return;
            setTitle(region.name);
            setDescription(region.overview);
            setPageTitle(region.name);
            setBreadcrumb(null);
            playContentEnter();
            await setBackgroundImage(region.background);
            if (token !== navToken) return;

            currentSlug = slug;
            currentRegionSlug = region.slug;
            currentChampionSlug = null;
            markColumnSelection(region.slug, null);
        } else {
            const champion = await getChampion(slug);
            if (token !== navToken) return;
            setTitle(`${champion.name}: ${champion.title}`);
            setDescription(champion.lore);
            setPageTitle(champion.name);
            const origin = nationalities.find((n) => n.slug === champion.nationality);
            setBreadcrumb(
                origin ? { slug: origin.slug, name: origin.name } : null,
                (regionSlug) => navigateTo(regionSlug, "region")
            );
            // Coluna Campeões: a região do campeão (deep link para um campeão de
            // outra região re-renderiza a lista correta, instantânea do cache).
            if (champion.nationality) {
                const stillCurrent = await ensureChampionsColumn(
                    champion.nationality,
                    token
                );
                if (!stillCurrent) return;
            }
            playContentEnter();
            await setBackgroundImage(champion.background);
            if (token !== navToken) return;

            currentSlug = slug;
            currentRegionSlug = champion.nationality || null;
            currentChampionSlug = champion.slug;
            // Regiões marca a região de contexto; Campeões marca o campeão.
            markColumnSelection(champion.nationality || null, champion.slug);
        }
    } catch (error) {
        if (token !== navToken) return;
        console.error("Erro na requisição:", error);
        if (error instanceof HttpError && error.status === 404) {
            showError(
                "Não encontramos esse campeão ou região em Runeterra. Escolha um emblema nas colunas ao lado."
            );
        } else {
            showError();
        }
    } finally {
        // O aviso desta navegação sempre é removido; o loader só é escondido se
        // esta ainda for a navegação atual (uma mais recente controla o loader).
        stopWakeMessage();
        if (token === navToken) {
            showLoader(false);
        }
    }
}

async function init() {
    onRoute(loadElement);
    initKeyboardNav();

    // Carga inicial: mostra skeletons nas colunas e, se demorar, uma mensagem
    // discreta de carregamento, para o usuário nunca ver colunas vazias
    // enquanto o backend (plano gratuito) sai do cold start.
    showColumnsLoading();
    const initToken = ++navToken;
    const stopWakeMessage = startWakeMessage(initToken);

    try {
        // Dispara as duas chamadas iniciais EM PARALELO (em vez de uma após a
        // outra), economizando um round-trip no cold start do backend. As
        // nacionalidades ficam cacheadas em api.js, então o render abaixo
        // reaproveita o resultado sem refetch; os campeões já vêm aqui e são
        // renderizados a partir dos dados prontos.
        const [nationalities, champions] = await Promise.all([
            getNationalities(),
            getChampionsByRegion("runeterra"),
        ]);
        renderNationalitiesList(nationalities, onSelect);
        renderChampionsList(champions, onSelect);
        renderedChampionsRegion = "runeterra";
    } catch (error) {
        console.error("Falha ao inicializar:", error);
        stopWakeMessage();
        clearColumnsLoading(); // sem skeletons piscando embaixo do erro
        showError();
        return;
    }
    stopWakeMessage();

    // avalia a descrição inicial (Runeterra, vinda do HTML) para decidir o fade
    setDescription(document.getElementById("description").textContent);
    playContentEnter();

    const initial = slugFromPath();
    if (initial !== "runeterra") {
        loadElement(initial);
    } else {
        currentRegionSlug = "runeterra";
        currentChampionSlug = null;
        markColumnSelection("runeterra", null);
    }
}

init();
