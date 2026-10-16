"""Popula o MongoDB de producao a partir das APIs publicas da Riot.

Fontes: Universe (pt_br) para campeoes/faccoes e DDragon para lore/imagens.

Robustez: todos os dados sao buscados e montados em memoria PRIMEIRO; o banco
so e apagado e reescrito se as duas listas (campeoes e faccoes) vierem nao
vazias. Assim uma falha de rede no meio do processo nao deixa a producao com o
banco vazio ou parcial.
"""

import html
import os
import re

import pymongo
import requests
from dotenv import load_dotenv
from unidecode import unidecode

load_dotenv()

# --- Parametros de modulo -------------------------------------------------
REQUEST_TIMEOUT = 30  # segundos; nenhum request deve travar o seed para sempre
DD_VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json"
UNIVERSE_API_BASE = "https://universe-meeps.leagueoflegends.com/v1/pt_br"
DDRAGON_CDN_BASE = "https://ddragon.leagueoflegends.com/cdn"

# Emblema de cada faccao no CDN do Universe (o nome "iona_emblem.png" e o
# arquivo real da Riot para Ionia; nao renomear).
FACTIONS_IMGS = {
    "piltover": "https://universe.leagueoflegends.com/images/piltover_emblem.png",
    "zaun": "https://universe.leagueoflegends.com/images/zaun_emblem.png",
    "ionia": "https://universe.leagueoflegends.com/images/iona_emblem.png",
    "bilgewater": "https://universe.leagueoflegends.com/images/bilgewater_emblem.png",
    "demacia": "https://universe.leagueoflegends.com/images/demacia_emblem.png",
    "mount-targon": "https://universe.leagueoflegends.com/images/mt_targon_emblem.png",
    "freljord": "https://universe.leagueoflegends.com/images/freljord_emblem.png",
    "noxus": "https://universe.leagueoflegends.com/images/noxus_emblem.png",
    "shadow-isles": "https://universe.leagueoflegends.com/images/shadow_isles_emblem.png",
    "shurima": "https://universe.leagueoflegends.com/images/shurima_emblem.png",
    "void": "https://universe.leagueoflegends.com/images/void_emblem.png",
    "bandle-city": "https://universe.leagueoflegends.com/images/bandle_city_emblem.png",
    "runeterra": "https://universe.leagueoflegends.com/images/default_emblem.png",
    "ixtal": "https://universe.leagueoflegends.com/images/ixtal_emblem.png",
}

# Documento padrao da faccao Runeterra (campeoes "unaffiliated" caem aqui).
RUNETERRA_FACTION = {
    "slug": "runeterra",
    "image": FACTIONS_IMGS["runeterra"],
    "background": "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ryze_0.jpg",
    "name": "Runeterra",
    "overview": "Runeterra é um mundo de fantasia onde heróis e vilões de diferentes lugares e culturas lutam pelo poder e pela sobrevivência. Com suas próprias facções e magias, eles enfrentam desafios épicos em um cenário diversificado, enquanto um mal antigo ameaça o mundo. É um lugar de aventuras e segredos, onde destinos se cruzam em batalhas emocionantes.",
}

CHAMPION_KEYS_TO_DELETE = [
    "type",
    "video",
    "game-info-url",
    "headerImage",
    "bioImage",
    "associated-faction",
    "roles",
    "races",
    "biography",
]
FACTION_KEYS_TO_DELETE = ["video", "headerImage"]


def html_to_text(raw_html):
    """Remove tags HTML e decodifica entidades (&nbsp;, &#39;, ...)."""
    clean_text = re.sub(r"<.*?>", "", raw_html)
    return html.unescape(clean_text)


def make_request(url, session=None):
    """GET + json() com timeout; retorna None (sem levantar) em qualquer falha."""
    getter = session.get if session is not None else requests.get
    try:
        response = getter(url, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error trying to make request: {e}")
        return None


def delete_keys(data, keys):
    for key in keys:
        data.pop(key, None)
    return data


def build_ddragon_index(dd_champions):
    """Indexa o DDragon por nome sem acento -> id, para match O(1)."""
    return {
        unidecode(info["name"]): info["id"]
        for info in dd_champions.values()
    }


def fetch_champion_data(champion, dd_index, ddragon_api_base, session=None):
    """Monta o documento de um campeao; retorna None para pular esse campeao."""
    slug = champion["slug"]
    decoded_name = unidecode(champion["name"])

    dd_id = dd_index.get(decoded_name)
    if dd_id is None:
        print(f"Skipping '{champion['name']}': no matching DDragon champion found")
        return None

    universe_url = f"{UNIVERSE_API_BASE}/champions/{slug}/index.json"
    ddragon_url = f"{ddragon_api_base}/data/pt_BR/champion/{dd_id}.json"

    data = make_request(universe_url, session)
    dd_champion = make_request(ddragon_url, session)
    if data is None or dd_champion is None:
        print(f"Skipping '{champion['name']}': request failed")
        return None

    data = data.get("champion", {})
    try:
        lore = dd_champion["data"][dd_id]["lore"]
    except (KeyError, TypeError):
        print(f"Skipping '{champion['name']}': unexpected DDragon payload")
        return None

    nationality = data.pop("associated-faction-slug", "runeterra")
    if nationality == "unaffiliated":
        nationality = "runeterra"
    data["nationality"] = nationality
    data["image"] = f"{ddragon_api_base}/img/champion/{dd_id}.png"
    data["lore"] = lore
    data["background"] = data["background"]["uri"]

    return delete_keys(data, CHAMPION_KEYS_TO_DELETE)


def fetch_faction_data(faction, session=None):
    """Monta o documento de uma faccao; retorna None para pular essa faccao."""
    slug = faction["slug"]
    url = f"{UNIVERSE_API_BASE}/factions/{slug}/index.json"
    data = make_request(url, session)
    if data is None:
        return None

    data = data.get("faction", {})
    data["background"] = data["image"]["uri"]
    data["image"] = FACTIONS_IMGS.get(slug, "")
    data["overview"] = html_to_text(data["overview"]["short"])
    return delete_keys(data, FACTION_KEYS_TO_DELETE)


def collect_champions(champions_universe, dd_index, ddragon_api_base, session=None):
    """Busca todos os campeoes e RETORNA a lista de documentos montados."""
    documents = []
    total = len(champions_universe)
    for i, champion in enumerate(champions_universe, start=1):
        document = fetch_champion_data(champion, dd_index, ddragon_api_base, session)
        if document:
            documents.append(document)
            print(f"Request made for {document['name']} - ({i}/{total})")
    return documents


def collect_factions(factions_universe, session=None):
    """Busca todas as faccoes e RETORNA a lista (Runeterra sempre primeiro)."""
    documents = [dict(RUNETERRA_FACTION)]
    total = len(factions_universe)
    for i, faction in enumerate(factions_universe, start=1):
        document = fetch_faction_data(faction, session)
        if document:
            documents.append(document)
            print(f"Request made for {document['name']} - ({i}/{total})")
    return documents


def main():
    mongo_url = os.environ.get("MONGO_URL")
    if not mongo_url:
        print(
            "Error: MONGO_URL environment variable is not set. "
            "Copy .env.example to .env and fill it in."
        )
        return

    session = requests.Session()

    dd_versions = make_request(DD_VERSIONS_URL, session)
    if not dd_versions:
        print("Error: could not fetch DDragon versions; aborting without touching the DB.")
        return
    ddragon_api_base = f"{DDRAGON_CDN_BASE}/{dd_versions[0]}"

    all_data = make_request(f"{UNIVERSE_API_BASE}/search/index.json", session)
    dd_data = make_request(f"{ddragon_api_base}/data/pt_BR/champion.json", session)
    if all_data is None or dd_data is None:
        print("Error: could not fetch base data; aborting without touching the DB.")
        return

    dd_index = build_ddragon_index(dd_data["data"])
    champions = collect_champions(
        all_data.get("champions", []), dd_index, ddragon_api_base, session
    )
    factions = collect_factions(all_data.get("factions", []), session)

    # So mexe no banco se AMBAS as listas vierem preenchidas. Caso contrario
    # mantem a producao intacta (melhor manter dados antigos do que apagar).
    # A lista de faccoes SEMPRE comeca com o documento padrao de Runeterra,
    # entao "so Runeterra" significa que todas as faccoes do Universe falharam.
    fetched_factions = len(factions) - 1
    if not champions or fetched_factions < 1:
        print(
            "Error: incomplete data "
            f"(champions={len(champions)}, factions={fetched_factions}); "
            "aborting without touching the DB."
        )
        return

    client = pymongo.MongoClient(mongo_url)
    client.drop_database("lol")
    mongo_db = client["lol"]
    mongo_db["champions"].insert_many(champions)
    mongo_db["nationalities"].insert_many(factions)
    print(f"Done: {len(champions)} champions, {len(factions)} factions.")


if __name__ == "__main__":
    main()
