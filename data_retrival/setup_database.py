import pymongo
import requests
from unidecode import unidecode

def make_request(url):
    try:
        response = requests.get(url)
        response.raise_for_status() 
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error trying to make request: {e}")
        return None

def delete_keys(data, keys):
    for key in keys:
        data.pop(key, None)
    return data

def fetch_champion_data(champion, dd_champions, UNIVERSE_API_BASE, DDRAGON_API_BASE):
    slug = champion['slug']
    decoded_name = unidecode(champion['name'])
    url = f"{UNIVERSE_API_BASE}/champions/{slug}/index.json"
    
    for dd_champion in dd_champions:
        dd_info = dd_champions[dd_champion]
        if unidecode(dd_info['name']) == decoded_name:
            dd_id = dd_info['id']
            break

    data = make_request(url)
    dd_champion = make_request(f"{DDRAGON_API_BASE}/data/pt_BR/champion/{dd_id}.json")
    if data is not None:
        data = data.get('champion', {})
        nationality = data.pop('associated-faction-slug')

        if nationality == 'unaffiliated':
            data['nationality'] = 'runeterra'
        else:
            data['nationality'] = nationality
        data['image'] = f"{DDRAGON_API_BASE}/img/champion/{dd_id}.png"
        data['lore'] = dd_champion['data'][dd_id]['lore']
        data['background'] = data['background']['uri']
        
        keys_to_delete = ['type', 'video', 'game-info-url', 'headerImage', 'bioImage', 'associated-faction', 'roles', 'races', 'biography']
        return delete_keys(data, keys_to_delete)
    return None

def fetch_faction_data(faction, UNIVERSE_API_BASE, factions_imgs):
    slug = faction['slug']
    url = f"{UNIVERSE_API_BASE}/factions/{slug}/index.json"
    data = make_request(url)
    if data is not None:
        data = data.get('faction', {})
        data['background'] = data['image']['uri']
        data['image'] = factions_imgs.get(slug, '')
        keys_to_delete = ['video', 'headerImage']
        return delete_keys(data, keys_to_delete)
    return None

def iterate_elements(db, type, elements, collection, dd_champions, UNIVERSE_API_BASE, DDRAGON_API_BASE, factions_imgs):
    for i, element in enumerate(elements, start=1):
        if type == "champions":
            element = fetch_champion_data(element, dd_champions, UNIVERSE_API_BASE, DDRAGON_API_BASE)
        else:
            element = fetch_faction_data(element, UNIVERSE_API_BASE, factions_imgs)

        if element:
            db.append(element)
            print(f"Request made for {element['name']} - ({i}/{len(elements)})")

    print(f"Sending {type} to mongo")
    collection.insert_many(db)

def main():
    dd_versions = make_request('https://ddragon.leagueoflegends.com/api/versions.json')
    
    if dd_versions is not None:    
        DD_DRAGON_VERSION = dd_versions[0]
        UNIVERSE_API_BASE = f"https://universe-meeps.leagueoflegends.com/v1/pt_br"
        DDRAGON_API_BASE = f"https://ddragon.leagueoflegends.com/cdn/{DD_DRAGON_VERSION}"

        factions_imgs = {
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
            "ixtal": "https://universe.leagueoflegends.com/images/ixtal_emblem.png"
        }

        all_data = make_request(f"{UNIVERSE_API_BASE}/search/index.json")
        dd_champions = make_request(f"{DDRAGON_API_BASE}/data/pt_BR/champion.json")['data']
        
        if all_data is None or dd_champions is None:
            return
        
        champions_universe = all_data.get('champions', [])
        factions_universe = all_data.get('factions', [])

        client = pymongo.MongoClient("***REMOVED_CONNECTION_STRING***")
        client.drop_database("lol")
        mongo_db = client["lol"]

        iterate_elements([], "champions", champions_universe, mongo_db["champions"], dd_champions, UNIVERSE_API_BASE, DDRAGON_API_BASE, factions_imgs)

        db_factions = [{
            "slug": "runeterra",
            "image": factions_imgs["runeterra"],
            "background": "https://support-leagueoflegends.riotgames.com/hc/article_attachments/1500019808682/Runeterra_Map.png",
            "name": "Runeterra",
            "overview": {
                "short": "Runeterra é um mundo de fantasia onde heróis e vilões de diferentes lugares e culturas lutam pelo poder e pela sobrevivência. Com suas próprias facções e magias, eles enfrentam desafios épicos em um cenário diversificado, enquanto um mal antigo ameaça o mundo. É um lugar de aventuras e segredos, onde destinos se cruzam em batalhas emocionantes."
            }
        }]

        iterate_elements(db_factions, "factions", factions_universe, mongo_db["nationalities"], None, UNIVERSE_API_BASE, None, factions_imgs)

if __name__ == "__main__":
    main()
