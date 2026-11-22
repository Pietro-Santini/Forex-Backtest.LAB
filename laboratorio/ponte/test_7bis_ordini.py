# -*- coding: utf-8 -*-
"""7-bis: prima di esporre /pc/8000 senza Tailscale, i controlli di sicurezza sugli ordini.

Accettazione (cervello/PROGETTO-VIA-TAILSCALE.md, 7-bis):
- richiesta agli ordini SENZA segreto -> rifiutata;
- richiesta con segreto REVOCATO -> rifiutata;
- richiesta con ORIGINE diversa da quella dell'app -> rifiutata;
- ognuno dei tre rifiuti compare nel registro.

Banchi rossi prima della cura.
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
sys.path.insert(0, os.path.join(RADICE, "server_oracle"))

ORIGINE_APP = "https://pietro-santini.github.io"
# Simula arrivo via Caddy/dominio pubblico (non locale): X-Forwarded-For presente.
PUBBLICO = {"x-forwarded-for": "203.0.113.7", "host": "forexbacktestlab.duckdns.org", "origin": ORIGINE_APP}


@pytest.fixture()
def server(tmp_path, monkeypatch):
    monkeypatch.setenv("FBL_DATI", str(tmp_path))
    monkeypatch.setenv("FBL_ACCESSO_FILE", str(tmp_path / "accesso_remoto.json"))
    (tmp_path / "accesso_remoto.json").write_text(
        json.dumps({"rete": True, "chiave": "chiave-del-server"}), encoding="utf-8")
    # auth_server: elenco utenti isolato
    import auth_server
    monkeypatch.setattr(auth_server, "UTENTI_FILE", str(tmp_path / "utenti_server.json"))
    import ponte_server
    importlib.reload(ponte_server)
    try:
        import sicurezza_7bis
        sicurezza_7bis._RATE_BUCKET.clear()
    except Exception:
        pass
    cli = TestClient(ponte_server.app)
    return ponte_server, cli, tmp_path


def _registra(cli, monkeypatch, uid="uid-prova", email="p@e.se"):
    import auth_server
    monkeypatch.setattr(auth_server, "verifica_token_firebase",
                        lambda _t: {"uid": uid, "email": email})
    r = cli.post("/register", headers={"x-forwarded-for": "203.0.113.7", "host": "forexbacktestlab.duckdns.org"},
                 json={"token": "tok"})
    assert r.status_code == 200, r.text
    return r.json()["chiave"]


def _leggi_registro(tmp_path):
    p = tmp_path / "registro_rifiuti.jsonl"
    if not p.exists():
        return []
    righe = []
    for riga in p.read_text(encoding="utf-8").splitlines():
        riga = riga.strip()
        if riga:
            righe.append(json.loads(riga))
    return righe


def test_ordini_senza_segreto_rifiutati(server, monkeypatch):
    _, cli, tmp_path = server
    r = cli.get("/pc/8000/health", headers={"x-forwarded-for": "203.0.113.7", "host": "forexbacktestlab.duckdns.org",
                                            "origin": ORIGINE_APP})
    assert r.status_code in (401, 403), r.text
    reg = _leggi_registro(tmp_path)
    assert any(x.get("motivo") == "segreto_mancante" for x in reg), reg


def test_ordini_con_segreto_revocato_rifiutati(server, monkeypatch):
    _, cli, tmp_path = server
    chiave = _registra(cli, monkeypatch)
    # revoca
    import auth_server
    utenti = auth_server._carica_utenti()
    assert utenti
    uid = next(iter(utenti.keys()))
    assert auth_server.revoca_chiave(uid) is True
    r = cli.get("/pc/8000/health", headers={**PUBBLICO, "x-fbl-chiave": chiave})
    assert r.status_code in (401, 403), r.text
    reg = _leggi_registro(tmp_path)
    assert any(x.get("motivo") == "segreto_revocato" for x in reg), reg


def test_ordini_origine_diversa_rifiutati(server, monkeypatch):
    _, cli, tmp_path = server
    chiave = _registra(cli, monkeypatch)
    r = cli.get("/pc/8000/health", headers={"x-forwarded-for": "203.0.113.7", "host": "forexbacktestlab.duckdns.org",
                                            "origin": "https://evil.example", "x-fbl-chiave": chiave})
    assert r.status_code in (401, 403), r.text
    reg = _leggi_registro(tmp_path)
    assert any(x.get("motivo") == "origine_non_ammessa" for x in reg), reg


def test_ordini_con_segreto_valido_e_origine_app_passano(server, monkeypatch):
    mod, cli, _ = server
    chiave = _registra(cli, monkeypatch)
    # nessun PC registrato -> 503 è la risposta normale del percorso, non 401/403
    r = cli.get("/pc/8000/health", headers={**PUBBLICO, "x-fbl-chiave": chiave})
    assert r.status_code == 503, r.text


def test_ordini_origine_localhost_ammessa_in_transizione(server, monkeypatch):
    _, cli, _ = server
    chiave = _registra(cli, monkeypatch)
    h = {"x-forwarded-for": "203.0.113.7", "host": "forexbacktestlab.duckdns.org",
         "origin": "https://localhost", "x-fbl-chiave": chiave}
    r = cli.get("/pc/8000/health", headers=h)
    assert r.status_code == 503, r.text


def test_dati_ascolta_non_bloccata_da_7bis(server, monkeypatch):
    _, cli, _ = server
    # WS sync dati: non è rotta ordini, non deve prendere 403 segreto_mancante da 7-bis.
    h = {"x-forwarded-for": "203.0.113.7", "host": "forexbacktestlab.duckdns.org",
         "origin": "https://localhost"}
    r = cli.get("/pc/8000/dati/ascolta?token=tok", headers=h)
    assert r.text != '{"detail":"Segreto mancante o non valido."}', r.text
