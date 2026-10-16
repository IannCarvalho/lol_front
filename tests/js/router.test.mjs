// Testes do roteamento (router.js): slugFromPath e navigateTo.
//
// router.js le window.location/window.history/window.addEventListener. Stubbamos
// globalThis.window ANTES do import dinamico; cada caso usa uma query string
// unica para estado de modulo limpo (o routeHandler e um estado de modulo).

import { test } from "node:test";
import assert from "node:assert/strict";

const ROUTER = "../../src/js/router.js";
let caseId = 0;

// Monta um window stub com um pathname e um history que registra pushState.
function makeWindow(pathname = "/") {
    const pushes = [];
    const listeners = {};
    return {
        pushes,
        listeners,
        obj: {
            location: { pathname },
            history: {
                pushState(state, title, path) {
                    pushes.push({ state, title, path });
                    // reflete a navegacao no location (como o browser faria)
                    this._owner.location.pathname = path;
                },
            },
            addEventListener(type, fn) {
                (listeners[type] = listeners[type] || []).push(fn);
            },
        },
    };
}

async function loadRouter(pathname) {
    caseId += 1;
    const w = makeWindow(pathname);
    w.obj.history._owner = w.obj;
    globalThis.window = w.obj;
    const mod = await import(`${ROUTER}?case=${caseId}`);
    return { mod, w };
}

test("slugFromPath: raiz => runeterra", async () => {
    const { mod } = await loadRouter("/");
    assert.equal(mod.slugFromPath(), "runeterra");
});

test("slugFromPath: /region/zaun => zaun", async () => {
    const { mod } = await loadRouter("/region/zaun");
    assert.equal(mod.slugFromPath(), "zaun");
});

test("slugFromPath: /champion/miss-fortune => miss-fortune", async () => {
    const { mod } = await loadRouter("/champion/miss-fortune");
    assert.equal(mod.slugFromPath(), "miss-fortune");
});

test("slugFromPath: segmento com %20 e decodificado", async () => {
    const { mod } = await loadRouter("/champion/miss%20fortune");
    assert.equal(mod.slugFromPath(), "miss fortune");
});

test("slugFromPath: rota desconhecida cai no ultimo segmento", async () => {
    const { mod } = await loadRouter("/qualquer/coisa/xpto");
    assert.equal(mod.slugFromPath(), "xpto");
});

test("navigateTo: regiao faz pushState com /region/<slug> e dispara o handler", async () => {
    const { mod, w } = await loadRouter("/");
    let handled = null;
    mod.onRoute((slug) => { handled = slug; });
    mod.navigateTo("zaun", "region");
    assert.equal(w.pushes.length, 1);
    assert.equal(w.pushes[0].path, "/region/zaun");
    assert.equal(handled, "zaun");
});

test("navigateTo: campeao faz pushState com /champion/<slug>", async () => {
    const { mod, w } = await loadRouter("/");
    mod.onRoute(() => {});
    mod.navigateTo("jinx", "champion");
    assert.equal(w.pushes[0].path, "/champion/jinx");
});

test("navigateTo: runeterra vai para '/'", async () => {
    const { mod, w } = await loadRouter("/region/zaun");
    let handled = null;
    mod.onRoute((slug) => { handled = slug; });
    mod.navigateTo("runeterra", "region");
    assert.equal(w.pushes[0].path, "/");
    assert.equal(handled, "runeterra");
});

test("navigateTo: nao faz pushState se o path nao mudou (mas ainda dispara o handler)", async () => {
    const { mod, w } = await loadRouter("/region/zaun");
    let handled = null;
    mod.onRoute((slug) => { handled = slug; });
    mod.navigateTo("zaun", "region"); // path atual ja e /region/zaun
    assert.equal(w.pushes.length, 0, "sem pushState redundante");
    assert.equal(handled, "zaun", "handler ainda dispara");
});

test("onRoute: popstate dispara o handler com o slug do path atual", async () => {
    const { mod, w } = await loadRouter("/champion/jinx");
    let handled = null;
    mod.onRoute((slug) => { handled = slug; });
    // dispara o listener de popstate registrado
    const fns = w.listeners.popstate || [];
    assert.equal(fns.length, 1);
    fns[0]();
    assert.equal(handled, "jinx");
});
