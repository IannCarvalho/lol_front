# LoL Front

Frontend estático (HTML/CSS/JS puro) para navegar por regiões (nacionalidades) e campeões de League of Legends. Consome a API do [lol_back](https://github.com/IannCarvalho/lol_back).

## Estrutura

```
lol_front/
├── index.html
├── src/
│   ├── css/            # reset, estilos e regras responsivas
│   ├── imagens/        # logo e mapas de região
│   └── js/
│       ├── config.js   # configuração de runtime (BASE_URL do backend)
│       └── index.js    # lógica de fetch e renderização
└── data_retrival/
    ├── setup_database.py   # popula o MongoDB com dados da Riot/DDragon
    ├── requirements.txt
    └── .env.example
```

## Rodando o frontend

Não há build step. Sirva a pasta com qualquer servidor estático, por exemplo:

```bash
python -m http.server 5500
```

Depois acesse `http://localhost:5500`.

### Configurando o backend

A URL do backend fica em `src/js/config.js`:

```js
window.APP_CONFIG = {
    BASE_URL: "http://localhost:5000",
};
```

Ajuste `BASE_URL` para apontar para a instância do `lol_back` que você estiver rodando.

## Populando o banco (data_retrival)

O script `setup_database.py` busca campeões e facções nas APIs pública da Riot (Universe) e DDragon e insere no MongoDB.

```bash
cd data_retrival
pip install -r requirements.txt
cp .env.example .env   # e preencha MONGO_URL
python setup_database.py
```

> A `MONGO_URL` é lida de variável de ambiente (via `.env`). Nunca faça commit do `.env` — ele está no `.gitignore`.

⚠️ O script executa `drop_database("lol")` antes de inserir, ou seja, recria a base do zero a cada execução.
