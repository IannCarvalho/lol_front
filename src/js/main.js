// Ponto de entrada: orquestra os módulos.
// Carrega dados via api, renderiza via ui, e reage à rota via router.

import { getNationalities, getChampion, getChampionsByRegion, HttpError } from "./api.js";
import { setBackgroundImage } from "./ui/background.js";
import {
    setTitle,
    setHeading,
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

// Lista da coluna Campeões para a região de contexto de um campeão (deep link
// para um campeão de outra região). Devolve null quando a lista exibida já é a
// certa ou quando não dá para obtê-la: a lista é secundária e uma falha aqui
// não deve impedir de mostrar o campeão.
async function championsListForContext(regionSlug) {
    if (!regionSlug || regionSlug === renderedChampionsRegion) return null;
    try {
        return await getChampionsByRegion(regionSlug);
    } catch (error) {
        console.warn("Não foi possível carregar a lista da região:", error);
        return null;
    }
}

// Troca a coluna Campeões para a lista de `regionSlug` (dados já carregados).
function showChampionsOf(regionSlug, champions) {
    if (!champions) return;
    renderChampionsList(champions, onSelect);
    renderedChampionsRegion = regionSlug;
}

// Registra o que está NA TELA e marca as duas colunas. É chamado no momento em
// que o conteúdo é desenhado (e não depois do fade do fundo): assim um clique
// durante o fade é comparado com o que o usuário realmente vê.
function setDisplayed(slug, regionSlug, championSlug) {
    currentSlug = slug;
    currentRegionSlug = regionSlug;
    currentChampionSlug = championSlug;
    markColumnSelection(regionSlug, championSlug);
}

// Carrega e renderiza um elemento (região ou campeão) a partir do slug.
// Controle de concorrência: "a última navegação vence". Os dados são buscados
// primeiro; depois de conferir que a navegação ainda é a atual, o conteúdo é
// desenhado de uma vez e só então o fundo faz o crossfade.
async function loadElement(slug) {
    const token = ++navToken;
    const isCurrent = () => token === navToken;

    // Slug já exibido: só remarca as colunas. O token incrementado acima já
    // invalida qualquer navegação em voo (mostrando A, clica B, volta a clicar
    // A antes de B chegar => fica A); por isso ESTA navegação assume o loader,
    // que senão ficaria preso na tela.
    if (slug === currentSlug) {
        showLoader(false);
        markColumnSelection(currentRegionSlug, currentChampionSlug);
        return;
    }

    showLoader(true);
    const stopWakeMessage = startWakeMessage(token);
    try {
        const nationalities = await getNationalities();
        if (!isCurrent()) return;
        const region = nationalities.find((n) => n.slug === slug);

        if (region) {
            const champions =
                region.slug === renderedChampionsRegion
                    ? null
                    : await getChampionsByRegion(region.slug);
            if (!isCurrent()) return;
            showChampionsOf(region.slug, champions);
            setTitle(region.name);
            setDescription(region.overview);
            setPageTitle(region.name);
            setBreadcrumb(null);
            setDisplayed(slug, region.slug, null);
            playContentEnter();
            await setBackgroundImage(region.background);
        } else {
            const champion = await getChampion(slug);
            if (!isCurrent()) return;
            const contextChampions = await championsListForContext(champion.nationality);
            if (!isCurrent()) return;
            showChampionsOf(champion.nationality, contextChampions);
            setHeading(champion.name, champion.title);
            setDescription(champion.lore);
            setPageTitle(champion.name);
            const origin = nationalities.find((n) => n.slug === champion.nationality);
            setBreadcrumb(
                origin ? { slug: origin.slug, name: origin.name } : null,
                (regionSlug) => navigateTo(regionSlug, "region")
            );
            // Regiões marca a região de contexto; Campeões marca o campeão.
            setDisplayed(slug, origin ? origin.slug : null, champion.slug);
            playContentEnter();
            await setBackgroundImage(champion.background);
        }
    } catch (error) {
        if (!isCurrent()) return;
        console.error("Erro na requisição:", error);
        // Nada válido na tela: esquece o slug exibido (clicar de novo no último
        // item volta a carregá-lo) e limpa a seleção das colunas.
        setDisplayed(null, null, null);
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
        setDisplayed("runeterra", "runeterra", null);
    }
}

init();
