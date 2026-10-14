// Ponto de entrada: orquestra os módulos.
// Carrega dados via api, renderiza via ui, e reage à rota via router.

import { getNationalities, getChampion, getChampionsByRegion } from "./api.js";
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
    populateNationalitiesList,
    populateChampionsList,
    markSelectedBySlug,
    showColumnsLoading,
    renderChampionsList,
} from "./ui/lists.js";
import { showLoader } from "./ui/loader.js";
import { navigateTo, onRoute, slugFromPath } from "./router.js";
import { initKeyboardNav } from "./keyboard.js";

let currentSlug = "runeterra";

// Clique/navegação nos emblemas -> muda a rota (o router chama loadElement).
function onSelect(slug, kind) {
    navigateTo(slug, kind);
}

// Carrega e renderiza um elemento (região ou campeão) a partir do slug.
async function loadElement(slug) {
    if (slug === currentSlug) {
        markSelectedBySlug(slug);
        return;
    }

    showLoader(true);
    try {
        const nationalities = await getNationalities();
        const region = nationalities.find((n) => n.slug === slug);

        if (region) {
            populateChampionsList(region.slug, onSelect);
            setTitle(region.name);
            setDescription(region.overview);
            setPageTitle(region.name);
            setBreadcrumb(null);
            playContentEnter();
            await setBackgroundImage(region.background);
        } else {
            const champion = await getChampion(slug);
            setTitle(`${champion.name}: ${champion.title}`);
            setDescription(champion.lore);
            setPageTitle(champion.name);
            const origin = nationalities.find((n) => n.slug === champion.nationality);
            setBreadcrumb(
                origin ? { slug: origin.slug, name: origin.name } : null,
                (regionSlug) => navigateTo(regionSlug, "region")
            );
            playContentEnter();
            await setBackgroundImage(champion.background);
        }

        currentSlug = slug;
        markSelectedBySlug(slug);
    } catch (error) {
        console.error("Erro na requisição:", error);
        showError();
    } finally {
        showLoader(false);
    }
}

// Mostra uma mensagem discreta de "acordando o servidor" SÓ se a carga inicial
// demorar (o backend no plano gratuito pode levar ~30s no cold start). Se os
// dados chegam rápido, a mensagem nunca aparece (evita flash). Retorna uma
// função que remove a mensagem e cancela o timer pendente.
function startWakeMessage() {
    const DELAY_MS = 1200; // só mostra se a carga passar deste tempo
    let banner = null;

    const timer = setTimeout(() => {
        banner = document.createElement("div");
        banner.className = "wake-message";
        banner.setAttribute("role", "status");
        banner.setAttribute("aria-live", "polite");
        banner.textContent =
            "Acordando o servidor (plano gratuito), isso pode levar ~30s…";
        document.body.appendChild(banner);
    }, DELAY_MS);

    return function stop() {
        clearTimeout(timer);
        if (banner && banner.parentNode) {
            banner.parentNode.removeChild(banner);
        }
    };
}

async function init() {
    onRoute(loadElement);
    initKeyboardNav();

    // Carga inicial: mostra skeletons nas colunas e uma mensagem discreta de
    // "acordando o servidor", para o usuário nunca ver colunas vazias enquanto
    // o backend (plano gratuito) sai do cold start.
    showColumnsLoading();
    const stopWakeMessage = startWakeMessage();

    try {
        // Dispara as duas chamadas iniciais EM PARALELO (em vez de uma após a
        // outra), economizando um round-trip no cold start do backend. As
        // nacionalidades ficam cacheadas em api.js, então populateNationalities
        // abaixo reaproveita o resultado sem refetch; os campeões já vêm aqui e
        // são renderizados a partir dos dados prontos.
        const [, champions] = await Promise.all([
            getNationalities(),
            getChampionsByRegion("runeterra"),
        ]);
        await populateNationalitiesList(onSelect);
        renderChampionsList(champions, onSelect);
    } catch (error) {
        console.error("Falha ao inicializar:", error);
        stopWakeMessage();
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
        markSelectedBySlug("runeterra");
    }
}

init();
