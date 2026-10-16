// Testes da camada de dados (api.js), sem dependencias: node:test + assert.
//
// api.js le window/fetch no topo do modulo, entao os stubs sao definidos em
// globalThis ANTES de cada import dinamico. Cada caso importa com uma query
// string unica (../../src/js/api.js?case=N) para ter estado de modulo LIMPO
// (caches zerados por caso).

import { test } from "node:test";
import assert from "node:assert/strict";

const API = "../../src/js/api.js";
let caseId = 0;

// Monta um ambiente (window + fetch stub) e importa api.js fresco.
// `handlers` mapeia caminho da URL -> funcao(url) => { status, body } ou lanca.
async function loadApi({ snapshot, backend } = {}) {
    caseId += 1;
    globalThis.window = { APP_CONFIG: { BASE_URL: "https://backend.test" } };

    const calls = [];
    globalThis.fetch = (url, opts = {}) => {
        calls.push({ url, opts });
        const u = new URL(url, "https://backend.test");
        const p = u.pathname;

        // Snapshot estatico
        if (p === "/src/data/snapshot.json") {
            if (!snapshot) return respond(404, { message: "no snapshot" });
            if (snapshot === "neterror") return netError(opts);
            return respond(200, snapshot);
        }
        // Backend
        return (backend || (() => respond(404, { message: "no backend" })))(
            p,
            u,
            opts
        );
    };

    const mod = await import(`${API}?case=${caseId}`);
    return { mod, calls };
}

function respond(status, body) {
    return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    });
}

// Simula falha de rede: respeita o AbortSignal para abortar na hora.
function netError(opts) {
    return Promise.reject(Object.assign(new Error("network down"), { name: "TypeError" }));
}

// Simula um timeout: rejeita com AbortError imediatamente (sem esperar o timer
// real), como o AbortController faria ao estourar. Prova o caminho de fallback
// (AbortError => snapshot) sem nenhuma espera de verdade.
function abortImmediately() {
    return Promise.reject(Object.assign(new Error("timeout"), { name: "AbortError" }));
}

const SNAPSHOT = {
    nationalities: [
        { slug: "zaun", name: "Zaun", overview: "x", background: "bg", image: "img" },
        { slug: "noxus", name: "Noxus", overview: "y", background: "bg2", image: "img2" },
    ],
    championsByRegion: {
        zaun: [
            { slug: "jinx", name: "Jinx", title: "t", nationality: "zaun", lore: "L", background: "b" },
        ],
        noxus: [
            { slug: "darius", name: "Darius", title: "t2", nationality: "noxus", lore: "L2", background: "b2" },
        ],
    },
};

test("getNationalities: snapshot-first + cache (sem tocar o backend)", async () => {
    let backendHits = 0;
    const { mod, calls } = await loadApi({
        snapshot: SNAPSHOT,
        backend: (p) => {
            backendHits += 1;
            return respond(200, []);
        },
    });
    const first = await mod.getNationalities();
    const second = await mod.getNationalities();
    assert.equal(first, second, "retorna o mesmo array cacheado");
    assert.equal(first[0].slug, "zaun");
    assert.equal(backendHits, 0, "nao chamou o backend");
    // snapshot buscado uma unica vez (cache de nationalities + snapshotPromise)
    const snapCalls = calls.filter((c) => String(c.url).includes("snapshot.json"));
    assert.equal(snapCalls.length, 1);
});

test("getNationalities: fallback para o backend quando o snapshot falha", async () => {
    let backendHits = 0;
    const { mod } = await loadApi({
        snapshot: null, // 404 no snapshot
        backend: (p) => {
            if (p === "/nationality/") {
                backendHits += 1;
                return respond(200, [{ slug: "ionia", name: "Ionia" }]);
            }
            return respond(404, {});
        },
    });
    const nats = await mod.getNationalities();
    assert.equal(backendHits, 1);
    assert.equal(nats[0].slug, "ionia");
});

test("getChampionsByRegion: via snapshot (sem backend)", async () => {
    let backendHits = 0;
    const { mod } = await loadApi({
        snapshot: SNAPSHOT,
        backend: () => {
            backendHits += 1;
            return respond(200, []);
        },
    });
    const champs = await mod.getChampionsByRegion("zaun");
    assert.equal(champs.length, 1);
    assert.equal(champs[0].slug, "jinx");
    assert.equal(backendHits, 0);
});

test("getChampionsByRegion: via backend com URL encodada quando falta no snapshot", async () => {
    let hitUrl = null;
    const { mod } = await loadApi({
        snapshot: SNAPSHOT, // nao tem a regiao pedida
        backend: (p, u) => {
            if (p.startsWith("/nationality/champions/")) {
                hitUrl = u.pathname;
                return respond(200, [{ slug: "x", name: "X" }]);
            }
            return respond(404, {});
        },
    });
    const champs = await mod.getChampionsByRegion("bandle city/weird");
    assert.equal(champs[0].slug, "x");
    // encodeURIComponent transforma espaco e barra
    assert.equal(hitUrl, "/nationality/champions/bandle%20city%2Fweird");
});

test("getChampion: backend ok (slug encodado) e cacheado", async () => {
    let hits = 0;
    let hitUrl = null;
    const { mod } = await loadApi({
        snapshot: SNAPSHOT,
        backend: (p, u) => {
            if (p.startsWith("/champion/")) {
                hits += 1;
                hitUrl = u.pathname;
                return respond(200, { slug: "jinx", name: "Jinx", title: "do backend", nationality: "zaun", lore: "Lx" });
            }
            return respond(404, {});
        },
    });
    const c1 = await mod.getChampion("jinx");
    assert.equal(c1.title, "do backend", "backend e a fonte primaria quando responde");
    assert.equal(hitUrl, "/champion/jinx");
    const c2 = await mod.getChampion("jinx");
    assert.equal(c2, c1);
    assert.equal(hits, 1, "segunda chamada vem do cache");
});

test("getChampion: slug com caractere especial e encodado", async () => {
    let hitUrl = null;
    const { mod } = await loadApi({
        snapshot: SNAPSHOT, // jinx existe; usamos um slug que nao existe no snapshot
        backend: (p, u) => {
            if (p.startsWith("/champion/")) {
                hitUrl = u.pathname;
                return respond(200, { slug: "weird", name: "W", title: "t" });
            }
            return respond(404, {});
        },
    });
    await mod.getChampion("a/b c");
    assert.equal(hitUrl, "/champion/a%2Fb%20c");
});

test("getChampion: erro de rede com campeao no snapshot => devolve snapshot", async () => {
    const { mod } = await loadApi({
        snapshot: SNAPSHOT,
        backend: (p, u, opts) => {
            if (p.startsWith("/champion/")) return netError(opts);
            return respond(404, {});
        },
    });
    const c = await mod.getChampion("jinx");
    assert.equal(c.slug, "jinx");
    assert.equal(c.title, "t", "veio do snapshot, nao do backend");
});

test("getChampion: 404 do backend => lanca HttpError 404 (sem fallback no snapshot)", async () => {
    const { mod } = await loadApi({
        snapshot: SNAPSHOT, // jinx EXISTE no snapshot, mas 404 e definitivo
        backend: (p) => {
            if (p.startsWith("/champion/")) return respond(404, { message: "not found" });
            return respond(404, {});
        },
    });
    await assert.rejects(
        () => mod.getChampion("jinx"),
        (err) => {
            assert.equal(err.name, "HttpError");
            assert.equal(err.status, 404);
            return true;
        }
    );
});

test("getChampion: timeout (abort) com campeao no snapshot => devolve snapshot (sem esperar de verdade)", async () => {
    const { mod } = await loadApi({
        snapshot: SNAPSHOT,
        backend: (p, u, opts) => {
            if (p.startsWith("/champion/")) return abortImmediately();
            return respond(404, {});
        },
    });
    const c = await mod.getChampion("jinx");
    assert.equal(c.slug, "jinx");
    assert.equal(c.title, "t", "snapshot servido apos o abort do timeout");
});

test("HttpError e exportado e carrega status", async () => {
    const { mod } = await loadApi({ snapshot: SNAPSHOT });
    const e = new mod.HttpError(500, "boom");
    assert.equal(e.status, 500);
    assert.ok(e instanceof Error);
});


test("getChampion: chamadas simultaneas reaproveitam a mesma busca em voo", async () => {
    let hits = 0;
    const { mod } = await loadApi({
        snapshot: SNAPSHOT,
        backend: (p) => {
            if (p.startsWith("/champion/")) {
                hits += 1;
                return respond(200, { slug: "jinx", name: "Jinx", title: "do backend" });
            }
            return respond(404, {});
        },
    });
    const [a, b] = await Promise.all([mod.getChampion("jinx"), mod.getChampion("jinx")]);
    assert.equal(hits, 1, "uma unica request para dois pedidos simultaneos");
    assert.equal(a, b);
});

test("getChampion: depois de um 404 a proxima chamada tenta o backend de novo", async () => {
    let hits = 0;
    const { mod } = await loadApi({
        snapshot: SNAPSHOT,
        backend: (p) => {
            if (p.startsWith("/champion/")) {
                hits += 1;
                return respond(404, { message: "not found" });
            }
            return respond(404, {});
        },
    });
    await assert.rejects(() => mod.getChampion("nao-existe"));
    await assert.rejects(() => mod.getChampion("nao-existe"));
    assert.equal(hits, 2, "a falha nao fica presa no cache");
});
