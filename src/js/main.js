// Ponto de entrada: orquestra os módulos.
// Carrega dados via api, renderiza via ui, e reage à rota via router.

import { getNationalities, getChampion } from "./api.js";
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

async function init() {
    onRoute(loadElement);
    initKeyboardNav();

    try {
        await populateNationalitiesList(onSelect);
        await populateChampionsList("runeterra", onSelect);
    } catch (error) {
        console.error("Falha ao inicializar:", error);
        showError();
        return;
    }

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
