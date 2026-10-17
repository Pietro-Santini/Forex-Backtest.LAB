# -*- coding: utf-8 -*-
"""Le chiavi personali: il telefono si procura da solo la porta d'ingresso, senza chiave condivisa.

RICHIESTO dal proprietario: ogni utente, al primo accesso, si vede creare una chiave personale che
lo collega al server Oracle - cosi' non c'e' una chiave uguale per tutti e non si scrive nulla a mano.

IL CERCHIO CHE SI ERA CHIUSO
----------------------------
Il telefono non ha nessuna chiave quando prova a registrarsi, e il controllo d'accesso esigeva LA
CHIAVE CONDIVISA su ogni richiesta remota. Quindi /register tornava 403, la chiave non veniva mai
generata, e nessun utente esisteva in utenti_server.json: per registrarsi serviva la chiave, e la
chiave usciva solo da una registrazione. Questo file prova che il cerchio e' aperto:
  - POST /register SENZA nessuna chiave arriva al modulo di autenticazione (400, non 403);
  - da li' esce una chiave;
  - quella chiave apre /health via Tailscale, proprio come la chiave condivisa;
  - una chiave inventata resta fuori;
  - aprire /register non ha aperto nient'altro;
  - spento l'accesso, resta fuori anche una chiave personale.
"""
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
def percorsi(tmp_path, monkeypatch):
    """I file su cui lavora il server, tutti dentro la cartella del test.

    L'elenco utenti vero sta accanto al codice: se questo collaudo lo toccasse, cancellerebbe gli
    utenti veri del server. Per la stessa ragione il verificatore del token Firebase si sostituisce
    dentro i singoli test, non qui: quello vero e' un servizio esterno.
    """
    accesso = tmp_path / "accesso_remoto.json"
    accesso.write_text(json.dumps({"rete": True, "chiave": "segreta123"}))
    monkeypatch.setenv("FBL_ACCESSO_FILE", str(accesso))
    import accesso_condiviso
    accesso_condiviso._CACHE.update(percorso=None, mtime=None, dati=None)
    import auth_server
    monkeypatch.setattr(auth_server, "UTENTI_FILE", str(tmp_path / "utenti_server.json"))
    return {"accesso": accesso}


@pytest.fixture
def client(percorsi):
    from fastapi.testclient import TestClient
    import ponte_server
    importlib.reload(ponte_server)
    # TestClient arriva da "testclient": per il controllo d'accesso lo facciamo sembrare 127.0.0.1
    return TestClient(ponte_server.app, client=("127.0.0.1", 50000))


def _registra(client, monkeypatch, token="token-di-prova"):
    """Registra un utente col verificatore di token sostituito (Firebase non e' raggiungibile da
    qui). Tutto il resto - elenco utenti, generazione della chiave, controllo d'accesso - e' il
    codice vero."""
    import auth_server
    monkeypatch.setattr(auth_server, "verifica_token_firebase",
                        lambda _t: {"uid": "uid-di-prova", "email": "p@e.se"})
    r = client.post("/register", headers=TAILSCALE, json={"token": token})
    assert r.status_code == 200, r.text
    return r.json()["chiave"]


def test_register_senza_chiave_arriva_al_server(client):
    """IL DIFETTO RISOLTO: /register doveva arrivare. Ora risponde 400 (manca il token), non 403
    ("chiave d'accesso mancante", cioe' la chiave che chi si registra non puo' ancora avere)."""
    r = client.post("/register", headers=TAILSCALE, json={})
    assert r.status_code != 403, r.text
    assert r.status_code == 400, r.text
    assert "token" in r.json()["detail"].lower()


def test_register_con_token_non_valido_da_401(client):
    """Non e' una porta aperta: senza un token Firebase valido non esce nessuna chiave."""
    r = client.post("/register", headers=TAILSCALE, json={"token": "finto"})
    assert r.status_code != 403, r.text
    assert r.status_code == 401, r.text
    assert "non valido" in r.json()["detail"].lower()


def test_la_chiave_ricevuta_apre_il_server(client, monkeypatch):
    """Il cerchio aperto: registrazione -> chiave -> /health risponde via Tailscale."""
    chiave = _registra(client, monkeypatch)
    assert len(chiave) >= 24, chiave

    r = client.get("/health", headers={**TAILSCALE, "x-fbl-chiave": chiave})
    assert r.status_code == 200, r.text
    assert r.json()["kraken"] == "simulato"

    # La stessa chiave passa anche nel modo in cui la manda davvero l'app: ?chiave=
    r2 = client.get("/health", headers=TAILSCALE, params={"chiave": chiave})
    assert r2.status_code == 200, r2.text

    # Riregistrandosi, l'utente riavra' SEMPRE la stessa chiave: due chiavi per lo stesso account
    # farebbero credere "revocata" a chi avesse ancora la prima.
    assert _registra(client, monkeypatch, token="altro-token") == chiave


def test_verifica_chiave_risponde_a_chi_ce_lha(client, monkeypatch):
    """Anche /verifica_chiave deve essere raggiungibile senza chiave condivisa, altrimenti non
    servirebbe a nessuno. Dice solo se la chiave esiste."""
    chiave = _registra(client, monkeypatch)
    r = client.get("/verifica_chiave", headers=TAILSCALE, params={"chiave": chiave})
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True and r.json()["uid"] == "uid-di-prova"

    r2 = client.get("/verifica_chiave", headers=TAILSCALE, params={"chiave": "inventata"})
    assert r2.status_code == 403


def test_aprire_register_non_ha_aperto_nient_altro(client, monkeypatch):
    """Tutto il resto resta dietro la chiave, come prima."""
    chiave = _registra(client, monkeypatch)
    assert client.get("/health", headers=TAILSCALE).status_code == 403
    assert client.get("/health", headers=TAILSCALE, params={"chiave": "pippo123"}).status_code == 403
    assert client.get("/health", headers={**TAILSCALE, "x-fbl-chiave": "pippo123"}).status_code == 403

    # E una chiave personale non da' poteri in piu': la regola "sul server solo conto simulato"
    # vale anche per chi entra con la sua chiave.
    r = client.post("/kraken/configura", headers=TAILSCALE, params={"chiave": chiave},
                    json={"ambiente": "reale", "api_key": "x", "api_secret": "y"})
    assert r.status_code == 403 and "simulato" in r.json()["detail"], r.text


def test_spegnere_l_accesso_vale_anche_per_le_chiavi_personali(client, monkeypatch, percorsi):
    """L'interruttore del proprietario non si perde: le chiavi personali entrano solo finche'
    l'accesso da altri dispositivi e' acceso."""
    chiave = _registra(client, monkeypatch)
    assert client.get("/health", headers=TAILSCALE, params={"chiave": chiave}).status_code == 200

    import accesso_condiviso
    percorsi["accesso"].write_text(json.dumps({"rete": False, "chiave": "segreta123"}))
    accesso_condiviso._CACHE.update(percorso=None, mtime=None, dati=None)

    r = client.get("/health", headers=TAILSCALE, params={"chiave": chiave})
    assert r.status_code == 403, r.text
    assert "spento" in r.json()["detail"]
