"""Unit tests for ``generate_snapshot.py``.

Never touches the network: ``fetch`` is replaced with a fake, and the output
path is redirected to a temp dir so no real snapshot.json is ever written.
"""

import json

import generate_snapshot as gs
import pytest


def _fake_fetch(responses):
    def _fetch(url):
        return responses[url]

    return _fetch


def test_strip_id_removes_mongo_id():
    assert gs.strip_id({"_id": "x", "slug": "noxus"}) == {"slug": "noxus"}


def test_strip_id_non_dict_passthrough():
    assert gs.strip_id("plain") == "plain"


def test_build_snapshot_shapes_output(monkeypatch):
    base = "http://backend.example"
    responses = {
        f"{base}/nationality/": [
            {"_id": "a", "slug": "noxus", "name": "Noxus"},
            {"_id": "b", "slug": "ionia", "name": "Ionia"},
        ],
        f"{base}/nationality/champions/noxus": [
            {"_id": "c1", "slug": "darius", "name": "Darius"},
        ],
        f"{base}/nationality/champions/ionia": [
            {"_id": "c2", "slug": "ahri", "name": "Ahri"},
        ],
    }
    monkeypatch.setattr(gs, "fetch", _fake_fetch(responses))

    snapshot = gs.build_snapshot(base)

    assert [n["slug"] for n in snapshot["nationalities"]] == ["noxus", "ionia"]
    # _id stripped everywhere.
    assert all("_id" not in n for n in snapshot["nationalities"])
    assert snapshot["championsByRegion"]["noxus"][0]["name"] == "Darius"
    assert "_id" not in snapshot["championsByRegion"]["noxus"][0]
    assert set(snapshot["championsByRegion"]) == {"noxus", "ionia"}


def test_main_aborts_on_empty_nationalities(monkeypatch, tmp_path):
    base = "http://backend.example"
    out = tmp_path / "snapshot.json"
    monkeypatch.setattr(gs, "OUT_PATH", str(out))
    monkeypatch.setattr(gs, "fetch", _fake_fetch({f"{base}/nationality/": []}))
    monkeypatch.setattr(gs.sys, "argv", ["generate_snapshot.py", base])

    with pytest.raises(SystemExit):
        gs.main()

    # The empty snapshot must NOT have been written.
    assert not out.exists()


def test_main_writes_snapshot_when_data_present(monkeypatch, tmp_path):
    base = "http://backend.example"
    out = tmp_path / "nested" / "snapshot.json"
    responses = {
        f"{base}/nationality/": [{"_id": "a", "slug": "noxus", "name": "Noxus"}],
        f"{base}/nationality/champions/noxus": [
            {"_id": "c1", "slug": "darius", "name": "Darius"}
        ],
    }
    monkeypatch.setattr(gs, "OUT_PATH", str(out))
    monkeypatch.setattr(gs, "fetch", _fake_fetch(responses))
    monkeypatch.setattr(gs.sys, "argv", ["generate_snapshot.py", base])

    gs.main()

    assert out.exists()
    written = json.loads(out.read_text(encoding="utf-8"))
    assert written["nationalities"][0]["slug"] == "noxus"
    assert "_id" not in written["nationalities"][0]
    assert written["championsByRegion"]["noxus"][0]["name"] == "Darius"
