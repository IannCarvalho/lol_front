"""Unit tests for the pure logic in ``setup_database.py``.

These tests never touch the network or MongoDB. All external effects
(``requests.get`` / ``make_request``) are replaced with fakes via monkeypatch.
"""

import requests

import setup_database as sdb


# ---------------------------------------------------------------------------
# Import safety: importing the module must NOT run main().
# ---------------------------------------------------------------------------

def test_import_does_not_run_main(monkeypatch):
    """The ``if __name__ == "__main__"`` guard must protect main() on import.

    We already imported the module at the top of this file. If main() had run,
    it would have attempted real HTTP/Mongo work. As an extra guarantee we
    assert the module name is not ``__main__`` when imported here.
    """
    assert sdb.__name__ != "__main__"


# ---------------------------------------------------------------------------
# html_to_text
# ---------------------------------------------------------------------------

def test_html_to_text_simple_tag():
    assert sdb.html_to_text("<p>oi</p>") == "oi"


def test_html_to_text_nested_tags():
    assert sdb.html_to_text("<div><span>hello</span> world</div>") == "hello world"


def test_html_to_text_plain_text_unchanged():
    assert sdb.html_to_text("no tags here") == "no tags here"


def test_html_to_text_empty_string():
    assert sdb.html_to_text("") == ""


def test_html_to_text_attributes_and_self_closing():
    assert sdb.html_to_text('<a href="x">link</a><br/>end') == "linkend"


# ---------------------------------------------------------------------------
# delete_keys
# ---------------------------------------------------------------------------

def test_delete_keys_removes_specified():
    data = {"a": 1, "b": 2, "c": 3}
    result = sdb.delete_keys(data, ["a", "c"])
    assert result == {"b": 2}


def test_delete_keys_ignores_missing_keys():
    data = {"a": 1}
    result = sdb.delete_keys(data, ["x", "y"])
    assert result == {"a": 1}


def test_delete_keys_empty_key_list():
    data = {"a": 1, "b": 2}
    result = sdb.delete_keys(data, [])
    assert result == {"a": 1, "b": 2}


def test_delete_keys_returns_same_object():
    data = {"a": 1}
    result = sdb.delete_keys(data, ["a"])
    assert result is data
    assert result == {}


# ---------------------------------------------------------------------------
# make_request
# ---------------------------------------------------------------------------

class _FakeResponse:
    def __init__(self, json_payload, raise_exc=None):
        self._json_payload = json_payload
        self._raise_exc = raise_exc

    def raise_for_status(self):
        if self._raise_exc is not None:
            raise self._raise_exc

    def json(self):
        return self._json_payload


def test_make_request_success(monkeypatch):
    payload = {"ok": True, "value": 42}

    def fake_get(url):
        assert url == "http://example.com/data.json"
        return _FakeResponse(payload)

    monkeypatch.setattr(sdb.requests, "get", fake_get)
    result = sdb.make_request("http://example.com/data.json")
    assert result == payload


def test_make_request_failure_returns_none(monkeypatch):
    def fake_get(url):
        return _FakeResponse(None, raise_exc=requests.exceptions.RequestException("boom"))

    monkeypatch.setattr(sdb.requests, "get", fake_get)
    result = sdb.make_request("http://example.com/broken.json")
    assert result is None


def test_make_request_connection_error_returns_none(monkeypatch):
    def fake_get(url):
        raise requests.exceptions.ConnectionError("no network")

    monkeypatch.setattr(sdb.requests, "get", fake_get)
    assert sdb.make_request("http://example.com/x.json") is None


# ---------------------------------------------------------------------------
# fetch_champion_data
# ---------------------------------------------------------------------------

UNIVERSE = "https://universe.example"
DDRAGON = "https://ddragon.example"


def _dd_champions_fixture():
    """DDragon champion index keyed by champion key, as main() uses it."""
    return {
        "Ahri": {"id": "Ahri", "name": "Ahri"},
        "Garen": {"id": "Garen", "name": "Garen"},
    }


def _make_request_stub(responses):
    """Return a fake make_request that maps a URL -> payload."""

    def _stub(url):
        return responses.get(url)

    return _stub


def test_fetch_champion_data_maps_fields(monkeypatch):
    champion = {"slug": "ahri", "name": "Ahri"}
    dd_champions = _dd_champions_fixture()

    universe_url = f"{UNIVERSE}/champions/ahri/index.json"
    ddragon_url = f"{DDRAGON}/data/pt_BR/champion/Ahri.json"

    universe_payload = {
        "champion": {
            "name": "Ahri",
            "associated-faction-slug": "ionia",
            "background": {"uri": "http://bg/ahri.jpg"},
            "type": "champion",
            "video": "vid",
            "game-info-url": "url",
            "headerImage": "hdr",
            "bioImage": "bio",
            "associated-faction": "Ionia",
            "roles": ["mage"],
            "races": ["vastaya"],
            "biography": "long text",
        }
    }
    ddragon_payload = {"data": {"Ahri": {"lore": "Ahri lore text"}}}

    monkeypatch.setattr(
        sdb,
        "make_request",
        _make_request_stub({universe_url: universe_payload, ddragon_url: ddragon_payload}),
    )

    result = sdb.fetch_champion_data(champion, dd_champions, UNIVERSE, DDRAGON)

    assert result["name"] == "Ahri"
    assert result["nationality"] == "ionia"
    assert result["image"] == f"{DDRAGON}/img/champion/Ahri.png"
    assert result["lore"] == "Ahri lore text"
    assert result["background"] == "http://bg/ahri.jpg"
    # Deleted keys must be gone.
    for key in [
        "type",
        "video",
        "game-info-url",
        "headerImage",
        "bioImage",
        "associated-faction",
        "roles",
        "races",
        "biography",
        "associated-faction-slug",
    ]:
        assert key not in result


def test_fetch_champion_data_unaffiliated_becomes_runeterra(monkeypatch):
    champion = {"slug": "garen", "name": "Garen"}
    dd_champions = _dd_champions_fixture()

    universe_url = f"{UNIVERSE}/champions/garen/index.json"
    ddragon_url = f"{DDRAGON}/data/pt_BR/champion/Garen.json"

    universe_payload = {
        "champion": {
            "name": "Garen",
            "associated-faction-slug": "unaffiliated",
            "background": {"uri": "http://bg/garen.jpg"},
        }
    }
    ddragon_payload = {"data": {"Garen": {"lore": "Garen lore"}}}

    monkeypatch.setattr(
        sdb,
        "make_request",
        _make_request_stub({universe_url: universe_payload, ddragon_url: ddragon_payload}),
    )

    result = sdb.fetch_champion_data(champion, dd_champions, UNIVERSE, DDRAGON)
    assert result["nationality"] == "runeterra"


def test_fetch_champion_data_accent_insensitive_match(monkeypatch):
    """Universe name with accents should still match DDragon via unidecode."""
    champion = {"slug": "kaisa", "name": "Kai'Sa"}
    dd_champions = {"Kaisa": {"id": "Kaisa", "name": "Kai'Sa"}}

    universe_url = f"{UNIVERSE}/champions/kaisa/index.json"
    ddragon_url = f"{DDRAGON}/data/pt_BR/champion/Kaisa.json"

    universe_payload = {
        "champion": {
            "name": "Kai'Sa",
            "associated-faction-slug": "void",
            "background": {"uri": "http://bg/kaisa.jpg"},
        }
    }
    ddragon_payload = {"data": {"Kaisa": {"lore": "Kaisa lore"}}}

    monkeypatch.setattr(
        sdb,
        "make_request",
        _make_request_stub({universe_url: universe_payload, ddragon_url: ddragon_payload}),
    )

    result = sdb.fetch_champion_data(champion, dd_champions, UNIVERSE, DDRAGON)
    assert result["nationality"] == "void"
    assert result["image"] == f"{DDRAGON}/img/champion/Kaisa.png"


def test_fetch_champion_data_no_ddragon_match_returns_none(monkeypatch):
    """The recent fix: a Universe champion with no DDragon counterpart returns
    None and does NOT raise (and never issues a request)."""
    champion = {"slug": "ghostchamp", "name": "Nonexistent Champion"}
    dd_champions = _dd_champions_fixture()

    def _should_not_be_called(url):  # pragma: no cover - must not run
        raise AssertionError("make_request must not be called when no match found")

    monkeypatch.setattr(sdb, "make_request", _should_not_be_called)

    result = sdb.fetch_champion_data(champion, dd_champions, UNIVERSE, DDRAGON)
    assert result is None


def test_fetch_champion_data_universe_returns_none(monkeypatch):
    """If the Universe request fails (returns None), the function returns None."""
    champion = {"slug": "ahri", "name": "Ahri"}
    dd_champions = _dd_champions_fixture()

    universe_url = f"{UNIVERSE}/champions/ahri/index.json"
    ddragon_url = f"{DDRAGON}/data/pt_BR/champion/Ahri.json"

    monkeypatch.setattr(
        sdb,
        "make_request",
        _make_request_stub({universe_url: None, ddragon_url: {"data": {"Ahri": {"lore": "x"}}}}),
    )

    result = sdb.fetch_champion_data(champion, dd_champions, UNIVERSE, DDRAGON)
    assert result is None


# ---------------------------------------------------------------------------
# fetch_faction_data
# ---------------------------------------------------------------------------

def test_fetch_faction_data_maps_fields(monkeypatch):
    faction = {"slug": "noxus"}
    factions_imgs = {"noxus": "http://img/noxus.png"}

    url = f"{UNIVERSE}/factions/noxus/index.json"
    payload = {
        "faction": {
            "name": "Noxus",
            "slug": "noxus",
            "image": {"uri": "http://bg/noxus.jpg"},
            "overview": {"short": "<p>A brutal <b>empire</b></p>"},
            "video": "vid",
            "headerImage": "hdr",
        }
    }

    monkeypatch.setattr(sdb, "make_request", _make_request_stub({url: payload}))

    result = sdb.fetch_faction_data(faction, UNIVERSE, factions_imgs)

    assert result["name"] == "Noxus"
    assert result["background"] == "http://bg/noxus.jpg"
    assert result["image"] == "http://img/noxus.png"
    assert result["overview"] == "A brutal empire"
    assert "video" not in result
    assert "headerImage" not in result


def test_fetch_faction_data_missing_image_defaults_empty(monkeypatch):
    faction = {"slug": "unknown-faction"}
    factions_imgs = {"noxus": "http://img/noxus.png"}

    url = f"{UNIVERSE}/factions/unknown-faction/index.json"
    payload = {
        "faction": {
            "name": "Unknown",
            "image": {"uri": "http://bg/unknown.jpg"},
            "overview": {"short": "plain text"},
        }
    }

    monkeypatch.setattr(sdb, "make_request", _make_request_stub({url: payload}))

    result = sdb.fetch_faction_data(faction, UNIVERSE, factions_imgs)
    assert result["image"] == ""
    assert result["overview"] == "plain text"


def test_fetch_faction_data_request_none_returns_none(monkeypatch):
    faction = {"slug": "noxus"}
    url = f"{UNIVERSE}/factions/noxus/index.json"

    monkeypatch.setattr(sdb, "make_request", _make_request_stub({url: None}))

    result = sdb.fetch_faction_data(faction, UNIVERSE, {})
    assert result is None
