import requests
import os
import json


# URL base das splash arts
base_url = "http://ddragon.leagueoflegends.com/cdn/img/champion/splash/"

with open("./data.json", "r", encoding="utf-8") as arquivo:
    dados_json = json.load(arquivo)["data"]


# Nome dos campeões (substitua com a lista completa de campeões)
campeoes = dados_json.keys()

# Pasta de destino para salvar as imagens
pasta_destino = "champion_splash_arts"

# Certifique-se de que a pasta de destino exista ou a crie
if not os.path.exists(pasta_destino):
    os.makedirs(pasta_destino)

# Loop para baixar as splash arts
for campeao in campeoes:
    url_splash = f"{base_url}{campeao}_0.jpg"  # A extensão .jpg pode variar, verifique o site
    nome_arquivo = os.path.join(pasta_destino, f"{campeao}_splash.jpg")

    response = requests.get(url_splash)

    if response.status_code == 200:
        with open(nome_arquivo, "wb") as arquivo:
            arquivo.write(response.content)
        print(f"Baixado: {nome_arquivo}")
    else:
        print(f"Erro ao baixar: {url_splash}")

print("Download concluído.")
