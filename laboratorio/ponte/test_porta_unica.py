# -*- coding: utf-8 -*-
"""Il server come porta unica: il PC si presenta, il server sa dov'e' e gli gira le richieste.

RICHIESTO dal proprietario (7 ottobre 2026): dal telefono si scrive SOLO il nome del server, non
piu' il nome e la chiave del computer. MT5 pero' gira sul PC, quindi il server deve sapere dov'e'
quel computer: glielo dice il PC stesso.
"""
import importlib
import json
import os
import sys

import pytest
from fastapi.testclient import TestClient

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.dirname(os.path.dirname(QUI))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))


@pytest.fixture()
def server(tmp_path, monkeypatch):
    """Il ponte del server, con i suoi dati in una cartella usa e getta."""
    monkeypatch.setenv("FBL_DATI", str(tmp_path))
    monkeypatch.setenv("FBL_ACCESSO_FILE", str(tmp_path / "accesso_remoto.json"))
    (tmp_path / "accesso_remoto.json").write_text(
        json.dumps({"rete": True, "chiave": "chiave-del-server"}), encoding="utf-8")
    sys.path.insert(0, os.path.join(RADICE, "server_oracle"))
    import ponte_server
    importlib.reload(ponte_server)
    return ponte_server, _cliente(ponte_server)


def _cliente(mod):
    """Un cliente che si presenta con la chiave, come fa il telefono.

    Senza chiave il server risponde 403 a tutto, ed e' giusto cosi': le prove devono passare dalla
    stessa porta da cui passa l'app, altrimenti proverebbero una strada che nessuno percorre.
    """
    cli = TestClient(mod.app)
    vero = cli.request

    def con_chiave(metodo, url, **kw):
        # httpx passa params=None ESPLICITO: un setdefault non scatterebbe mai, e la chiave non
        # verrebbe aggiunta. Costato un quarto d'ora di 403 incomprensibili.
        p = kw.get("params") or {}
        kw["params"] = {**p, "chiave": "chiave-del-server"} if isinstance(p, dict) else p
        return vero(metodo, url, **kw)

    cli.request = con_chiave
    return cli


def test_prima_che_qualcuno_si_registri_non_si_inventa_un_pc(server):
    _, cli = server
    r = cli.get("/pc")
    assert r.status_code == 200
    assert r.json()["registrato"] is False
    # E una richiesta per il PC non deve fingere: deve dire che non c'e'.
    assert cli.get("/pc/health").status_code == 503


def test_il_pc_si_presenta_e_da_quel_momento_il_server_sa_dove_sta(server):
    mod, cli = server
    r = cli.post("/pc/registra", json={"host": "casa-pc.tail83d918.ts.net", "chiave": "chiave-del-pc"})
    assert r.status_code == 200, r.text
    d = cli.get("/pc").json()
    assert d["registrato"] is True
    assert d["host"] == "casa-pc.tail83d918.ts.net"
    # La chiave del PC NON esce dal server: al telefono non serve, le richieste le gira il server.
    assert "chiave" not in d
    # E si vede anche nello stato generale, cosi' il telefono sa subito se aspettarsi MT5.
    assert cli.get("/health").json()["pc"]["registrato"] is True


def test_un_nome_che_non_e_tailscale_si_rifiuta(server):
    _, cli = server
    # Un indirizzo IP non va: il collegamento e' in https e il certificato vale per il NOME.
    assert cli.post("/pc/registra", json={"host": "100.1.2.3", "chiave": "k"}).status_code == 400
    assert cli.post("/pc/registra", json={"host": "casa.ts.net", "chiave": ""}).status_code == 400


def test_la_registrazione_sopravvive_al_riavvio_del_server(server, tmp_path):
    mod, cli = server
    cli.post("/pc/registra", json={"host": "casa-pc.tail1.ts.net", "chiave": "k"})
    # Il server riparte (Docker, riavvio automatico): il PC non deve ripresentarsi ogni volta.
    importlib.reload(mod)
    cli2 = _cliente(mod)      # anche dopo il riavvio ci si presenta con la chiave
    assert cli2.get("/pc").json()["host"] == "casa-pc.tail1.ts.net"


def test_se_il_pc_non_risponde_lo_dice_senza_accusare_il_server(server, monkeypatch):
    mod, cli = server
    cli.post("/pc/registra", json={"host": "casa-pc.tail1.ts.net", "chiave": "k"})

    import httpx

    class ClienteCheFallisce:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def request(self, *a, **k): raise httpx.ConnectError("spento")

    monkeypatch.setattr(httpx, "AsyncClient", ClienteCheFallisce)
    r = cli.get("/pc/health")
    assert r.status_code == 502
    assert "computer non risponde" in r.json()["detail"]
