"""Server Oracle (server_oracle/ponte_server.py): accesso solo con chiave via Tailscale, solo conto simulato."""
import importlib
import json
import os
import sys

import pytest

import _percorsi  # noqa: F401

RADICE = _percorsi.RADICE
sys.path.insert(0, os.path.join(RADICE, "server_oracle"))
TAILSCALE = {"x-forwarded-for": "100.101.102.103", "host": "server.tail1234.ts.net"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    f = tmp_path / "accesso_remoto.json"
    f.write_text(json.dumps({"rete": True, "chiave": "segreta123"}))
    monkeypatch.setenv("FBL_ACCESSO_FILE", str(f))
    import accesso_condiviso
    accesso_condiviso._CACHE.update(percorso=None, mtime=None, dati=None)
    import ponte_server
    importlib.reload(ponte_server)
    # TestClient arriva da "testclient": per il controllo d'accesso lo facciamo sembrare 127.0.0.1
    return TestClient(ponte_server.app, client=("127.0.0.1", 50000))


def test_health_dal_server_stesso(client):
    r = client.get("/health", headers={"host": "127.0.0.1:8000"})
    assert r.status_code == 200 and r.json()["mt5"] is False and r.json()["kraken"] == "simulato"


def test_via_tailscale_senza_chiave_rifiutato(client):
    r = client.get("/health", headers=TAILSCALE)
    assert r.status_code == 403


def test_via_tailscale_con_chiave_passa(client):
    r = client.get("/health", headers={**TAILSCALE, "x-fbl-chiave": "segreta123"})
    assert r.status_code == 200


def test_chiave_sbagliata_rifiutata(client):
    r = client.get("/health", headers={**TAILSCALE, "x-fbl-chiave": "sbagliata"})
    assert r.status_code == 403


def test_kraken_reale_rifiutato_sul_server(client):
    r = client.post("/kraken/configura", headers={**TAILSCALE, "x-fbl-chiave": "segreta123"},
                    json={"ambiente": "reale", "api_key": "x", "api_secret": "y"})
    assert r.status_code == 403 and "simulato" in r.json()["detail"]


def test_kraken_simulato_passa_al_ponte(client):
    r = client.post("/kraken/configura", headers={"host": "127.0.0.1:8000"}, json={"ambiente": "simulato"})
    assert r.status_code != 403, r.text
