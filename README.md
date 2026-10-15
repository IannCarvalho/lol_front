# LoL Front

Frontend estático (HTML/CSS/JS puro) para navegar por regiões (nacionalidades) e campeões de League of Legends. Consome a API do [lol_back](https://github.com/IannCarvalho/lol_back).

**Live:** https://lolfront.vercel.app (frontend na Vercel) · backend em https://lol-back-6zld.onrender.com (Render) · banco no MongoDB Atlas.

> Deploy contínuo: cada push na branch `main` publica automaticamente na Vercel.

## Estrutura

O JavaScript é organizado em **ES Modules nativos** (sem framework nem bundler): cada arquivo tem uma responsabilidade e o `main.js` orquestra os demais.

```
lol_front/
├── index.html
├── favicon.ico
├── _redirects            # fallback SPA (Netlify)
├── vercel.json           # fallback SPA (Vercel)
├── src/
│   ├── css/              # reset, estilos, responsivo e estados de carga (skeleton/wake)
│   ├── imagens/          # logo.png
│   └── js/
│       ├── config.js     # configuração de runtime (BASE_URL) + wake do backend
│       ├── main.js       # ponto de entrada: orquestra os módulos
│       ├── api.js        # camada de dados (fetch ao backend, com cache)
│       ├── router.js     # roteamento por History API (URLs limpas)
│       ├── keyboard.js   # navegação por teclado (setas)
│       └── ui/           # componentes de interface
│           ├── background.js  # crossfade da imagem de fundo
│           ├── content.js     # título, descrição, breadcrumb, erro
│           ├── lists.js       # emblemas das colunas + seleção
│           ├── tooltip.js     # tooltip com o nome do emblema
│           └── loader.js      # indicador de carregamento
└── data_retrival/
    ├── setup_database.py     # popula o MongoDB com dados da Riot/DDragon
    ├── requirements.txt
    ├── requirements-dev.txt  # dependências de teste (pytest)
    ├── .env.example
    └── tests/                # testes pytest do setup_database.py
```

> Como usa ESM (`<script type="module">`), o app precisa ser servido via HTTP (não abre por `file://`).

O `api.js` cacheia em memória tanto as nacionalidades quanto os campeões por região (um valor por região): voltar a uma região já visitada não refaz a chamada ao backend.

Como o backend roda no plano gratuito do Render (cold start de ~30s), a carga inicial trata a espera de duas formas: o `config.js` dispara um fetch *fire-and-forget* ao `/status` assim que carrega, para o Render começar a acordar antes de os dados serem pedidos; e o `main.js` busca nacionalidades e campeões em paralelo (`Promise.all`), mostra *skeletons* nas colunas e, se a carga passar de ~1,2s, exibe um aviso discreto de "acordando o servidor".

## Rodando o frontend

Não há build step. Como o app usa roteamento por **History API** (URLs com path limpo, ver seção Rotas), o servidor precisa fazer *fallback* para o `index.html` em rotas desconhecidas. Use um servidor estático com suporte a SPA:

```bash
# recomendado (faz o fallback com a flag -s)
npx serve -s -l 5500
```

Depois acesse `http://localhost:5500`.

> `python -m http.server` funciona para a raiz, mas **não** faz fallback: recarregar em `/region/zaun` daria 404. Prefira `serve -s` (ou outro servidor com fallback) durante o desenvolvimento.

## Rotas

O estado da navegação fica na URL (dá para recarregar e compartilhar):

| URL                 | Conteúdo                        |
|---------------------|---------------------------------|
| `/`                 | Runeterra (tela inicial)        |
| `/region/:slug`     | Uma região/facção (ex.: `/region/zaun`) |
| `/champion/:slug`   | Um campeão (ex.: `/champion/garen`) |

## Deploy

O frontend está publicado na **Vercel** em https://lolfront.vercel.app. Por ser estático (sem build step), o deploy é direto — o `vercel.json` cuida do *fallback* SPA.

O repositório já inclui as configs de *fallback* SPA para os principais hosts:
- **Vercel**: `vercel.json` (rewrites para `/index.html`)
- **Netlify**: `_redirects` (`/* /index.html 200`)

Em outros servidores (ex.: Nginx), configure o equivalente: `try_files $uri /index.html;`.

### Configurando o backend

A URL do backend fica em `src/js/config.js`. O arquivo detecta o ambiente
automaticamente: em `localhost` usa o backend local; em produção usa a URL
pública do Render.

```js
const PROD_BACKEND_URL = "https://lol-back-6zld.onrender.com";
const LOCAL_BACKEND_URL = "http://localhost:5000";
```

Para apontar para outra instância do `lol_back`, ajuste `PROD_BACKEND_URL`.

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

## Testes

As funções puras do `setup_database.py` têm testes com [pytest](https://docs.pytest.org/) (sem rede nem MongoDB — as chamadas externas são mockadas).

```bash
cd data_retrival
pip install -r requirements-dev.txt
pytest
```
