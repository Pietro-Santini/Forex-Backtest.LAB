# -*- coding: utf-8 -*-
"""IL CLOUD NOSTRO GIRA SUL COMPUTER, DENTRO IL PONTE CHE C'E' GIA'.

CHIESTO dal proprietario (4 novembre 2026): «per quanto riguarda il server, accendiamolo e lo
mettiamo all'interno del nostro disco e sul PC... un'architettura creata sul nostro dispositivo,
che in un domani possiamo anche avere un nostro server dove gireranno tutti i dati di tutti gli
utenti». E il motivo, con i suoi numeri: «ieri su Firestore siamo arrivati a 250.000 letture e
122.000 di scritture. O sistemiamo qualcosa all'interno che non mi faccia pagare, o se no
cambiamo sistema».

COSA C'ERA GIA' E COSA MANCAVA. Le rotte /dati esistevano, ma solo in `server_oracle/
ponte_server.py`, cioe' solo sul server Linux - e quel server oggi non ha un posto dove girare
(Oracle non ha capacita' a nessuna taglia). Il ponte del computer, che il proprietario ha gia'
acceso tutti i giorni, non le aveva. Ora il modulo e' uno solo
(`installer_build/build/documenti_utente.py`) e lo montano entrambi.

LE TRE COSE CHE QUESTE PROVE MISURANO, e la terza e' quella che conta per la sicurezza visto che
il proprietario ha avvisato che il suo computer servira' anche altri utenti:
  1. le rotte ci sono e funzionano (scrivi, fondi, rileggi) dentro il ponte;
  2. i dati di due utenti diversi non si vedono fra loro;
  3. lo scavalco del controllo chiave vale SOLO per /dati: tutto il resto del ponte - comprese le
     rotte che mandano ordini veri su MT5 - resta dietro la chiave.
"""
import os
import sys
import types
import json
import tempfile

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))


def _ponte():
    """Il ponte vero, con MetaTrader5 e pywinauto sostituiti: sul banco non esistono, e senza
    questi due il modulo non si importa nemmeno."""
    if "MetaTrader5" not in sys.modules:
        sys.modules["MetaTrader5"] = types.SimpleNamespace(
            initialize=lambda *a, **k: False, shutdown=lambda: None,
            terminal_info=lambda: None, account_info=lambda: None,
            last_error=lambda: (0, ""))
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    os.environ.setdefault("FBL_DATI", tempfile.mkdtemp(prefix="fbl_dati_prova_"))
    import bridge
    return bridge


def _cliente(bridge, uid="utente-uno"):
    from fastapi.testclient import TestClient
    import documenti_utente
    bridge.app.dependency_overrides[documenti_utente._uid_dep] = lambda: uid
    return TestClient(bridge.app)


def test_le_rotte_dei_documenti_esistono_nel_ponte():
    """Senza questa, il modulo potrebbe essere perfetto e non montato: il `try/except` attorno
    all'import nel ponte lo nasconderebbe in silenzio, che e' il modo peggiore di non funzionare.

    SI GUARDA IL COMPORTAMENTO, NON LA TABELLA DELLE ROTTE. Il primo tentativo leggeva
    `app.routes` cercando "/dati/{nome}": in questa versione di FastAPI un router incluso resta
    un oggetto solo (_IncludedRouter) e le sue rotte NON compaiono li', quindi la prova era rossa
    mentre le rotte rispondevano benissimo. Una richiesta senza token distingue le due cose che
    contano: 401 vuol dire "c'e', e chiede chi sei"; 404 vuol dire "non montata".
    """
    bridge = _ponte()
    from fastapi.testclient import TestClient
    bridge.app.dependency_overrides.clear()
    c = TestClient(bridge.app)
    for percorso in ("/dati/session", "/dati/footprint", "/dati/trades"):
        r = c.get(percorso)
        assert r.status_code != 404, "%s non e' montata sul ponte" % percorso
        assert r.status_code == 401, (
            "%s deve chiedere il token (401), ha dato %s" % (percorso, r.status_code))
    # L'ascolto in tempo reale e' quello che manda {nome, versione} invece del documento intero:
    # e' la ragione per cui questo server taglia le LETTURE, non solo le scritture.
    import documenti_utente
    assert any(getattr(r, "path", "") == "/dati/ascolta" for r in documenti_utente.router.routes), (
        "manca l'ascolto in tempo reale nel router dei documenti")


def test_scrivo_fondo_e_rileggo_sul_computer():
    bridge = _ponte()
    c = _cliente(bridge)
    r = c.put("/dati/session", json={"contenuto": {"a": 1, "b": 2}})
    assert r.status_code == 200, r.text
    assert r.json()["versione"] == 1
    # LA FUSIONE E' LA SCRITTURA A DELTA: manda solo il campo cambiato e lascia gli altri.
    r = c.patch("/dati/session", json={"contenuto": {"b": 9}})
    assert r.status_code == 200, r.text
    assert r.json()["versione"] == 2, "ogni scrittura deve alzare la versione: e' quello che"\
        " l'ascolto manda agli altri dispositivi"
    letto = c.get("/dati/session").json()["contenuto"]
    assert letto == {"a": 1, "b": 9}, "la fusione deve aggiornare b e lasciare a: %r" % letto


def test_i_dati_di_due_utenti_non_si_toccano():
    """Il proprietario ha avvisato che questo computer servira' anche altri utenti: la prova che
    conta non e' che funzioni, e' che i dati di uno non finiscano all'altro."""
    bridge = _ponte()
    uno = _cliente(bridge, "utente-uno")
    uno.put("/dati/preferenze", json={"contenuto": {"tema": "scuro"}})
    due = _cliente(bridge, "utente-due")
    due.put("/dati/preferenze", json={"contenuto": {"tema": "chiaro"}})
    assert _cliente(bridge, "utente-uno").get("/dati/preferenze").json()["contenuto"] == {"tema": "scuro"}
    assert _cliente(bridge, "utente-due").get("/dati/preferenze").json()["contenuto"] == {"tema": "chiaro"}


def test_senza_token_non_si_entra():
    """PROVA DI CONTROLLO della porta: senza l'identita' verificata non si legge niente. Se questa
    passasse per sbaglio, le due prove sopra starebbero misurando una porta aperta a tutti."""
    bridge = _ponte()
    from fastapi.testclient import TestClient
    bridge.app.dependency_overrides.clear()
    c = TestClient(bridge.app)
    r = c.get("/dati/session")
    assert r.status_code == 401, "senza token Firebase la risposta deve essere 401, e' %s" % r.status_code
    r = c.put("/dati/session", json={"contenuto": {"x": 1}})
    assert r.status_code == 401


def test_lo_scavalco_della_chiave_vale_solo_per_i_documenti(monkeypatch):
    """LA PROVA DI SICUREZZA. /dati scavalca il controllo chiave perche' ha un'autenticazione sua
    (il token Firebase, personale). Quello scavalco deve essere STRETTO a quel prefisso: se
    coprisse altro, aprire questa porta agli altri utenti vorrebbe dire aprire anche le rotte che
    mandano ordini veri su MT5.

    Si misura sul comportamento del middleware condiviso, non sulla presenza di una stringa."""
    import accesso_condiviso as accesso
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    app = FastAPI()

    @app.get("/dati/session")
    def _dati():
        return {"ok": True, "dove": "documenti"}

    @app.get("/order/market")
    def _ordine():
        return {"ok": True, "dove": "ordini veri"}

    @app.get("/positions")
    def _posizioni():
        return {"ok": True, "dove": "posizioni"}

    accesso.installa_controllo_chiave(app)
    # Una richiesta che NON viene dal PC: TestClient parla da un indirizzo che il controllo
    # considera esterno solo se l'accesso remoto e' configurato con una chiave. Si forza il
    # giudizio sostituendo motivo_rifiuto: qui si misura il PERIMETRO dello scavalco, non il
    # merito del giudizio (che ha i suoi test altrove).
    # CON monkeypatch, non a mano: questa sostituzione vive in un modulo CONDIVISO da tutti i
    # servizi, e lasciarla in piedi fa fallire i test che girano dopo nello stesso processo.
    # Misurato: undici rossi altrove, tutti causati da questa riga scritta senza ripristino.
    monkeypatch.setattr(accesso, "motivo_rifiuto", lambda request: "chiave")
    monkeypatch.setitem(accesso.MESSAGGI_RIFIUTO, "chiave", "serve la chiave")
    c = TestClient(app)
    assert c.get("/dati/session").status_code == 200, \
        "i documenti devono passare: hanno l'autenticazione loro (token Firebase)"
    for percorso in ("/order/market", "/positions"):
        r = c.get(percorso)
        assert r.status_code == 403, \
            "%s deve restare dietro la chiave anche da fuori, ha dato %s" % (percorso, r.status_code)


def test_chi_ascolta_viene_registrato_davvero(monkeypatch):
    """IL DIFETTO TROVATO IL 4 NOVEMBRE 2026, leggendo il codice per accendere il server sul PC.

    Il registro degli ascoltatori NON VENIVA MAI RIEMPITO: il WebSocket accettava la connessione,
    mandava l'elenco iniziale e poi taceva, e `avvisa()` trovava sempre un insieme vuoto. Il
    risparmio che il commento dichiarava - venti byte invece del documento intero - non e' quindi
    mai entrato in funzione: scrivendo dal computer, il telefono non lo sapeva. Non era un
    ascolto, era una sincronizzazione sola andata.

    Qui si misura il fatto: chi si collega finisce nel registro, e quando se ne va esce.
    """
    bridge = _ponte()
    import documenti_utente as du
    from fastapi.testclient import TestClient
    monkeypatch.setattr(du, "verifica_token_firebase",
                        lambda t: "utente-ascolto" if t == "buono" else None)
    du._ascoltatori.clear()
    c = TestClient(bridge.app)
    with c.websocket_connect("/dati/ascolta?token=buono"):
        quanti = len(du._ascoltatori.get("utente-ascolto") or ())
        assert quanti == 1, "chi ascolta deve stare nel registro, invece ce ne sono %d" % quanti
    assert not du._ascoltatori.get("utente-ascolto"), \
        "chiuso il canale, il socket deve uscire dal registro: se no resta li' per sempre a far"\
        " fallire ogni avviso futuro"


def test_senza_token_lascolto_si_chiude(monkeypatch):
    """PROVA DI CONTROLLO della porta dell'ascolto: senza identita' verificata non si entra. Se
    passasse, la prova sopra starebbe misurando un canale aperto a tutti."""
    bridge = _ponte()
    import documenti_utente as du
    from fastapi.testclient import TestClient
    monkeypatch.setattr(du, "verifica_token_firebase", lambda t: None)
    du._ascoltatori.clear()
    c = TestClient(bridge.app)
    try:
        with c.websocket_connect("/dati/ascolta?token=inventato"):
            pass
    except Exception:
        pass   # il server chiude: e' quello che deve fare
    assert not du._ascoltatori, "nessuno deve essere registrato senza un token valido"


def test_lavviso_manda_solo_nome_e_versione():
    """E' QUESTO che taglia le LETTURE, non le scritture: con Firestore ogni modifica fa
    riscaricare il documento INTERO a ogni dispositivo in ascolto, anche a quello che l'ha appena
    scritto. Qui parte {nome, versione} - venti byte - e chi ha gia' quella versione non chiede
    niente.

    Si misura con un socket finto e un ciclo di eventi vero: il contenuto non deve mai passare da
    qui, e un avviso non consegnato non deve far fallire la scrittura (per questo `avvisa` non
    solleva mai).
    """
    import asyncio
    import json
    import documenti_utente as du

    arrivati = []

    class _SocketFinto:
        async def send_text(self, testo):
            arrivati.append(testo)

    async def _giro():
        du._loop_principale = asyncio.get_running_loop()
        du._ascoltatori.clear()
        du._ascoltatori["u1"] = {_SocketFinto()}
        du.avvisa("u1", "session", 7)
        await asyncio.sleep(0.05)      # il tempo che la coroutine pianificata giri

    asyncio.run(_giro())
    assert len(arrivati) == 1, "l'avviso non e' arrivato: %r" % arrivati
    msg = json.loads(arrivati[0])
    assert msg == {"nome": "session", "versione": 7}
    assert len(arrivati[0]) < 50, "l'avviso deve pesare una manciata di byte, pesa %d" % len(arrivati[0])
    assert "contenuto" not in arrivati[0], "il contenuto non deve mai passare dall'avviso"


def test_un_socket_morto_non_blocca_gli_avvisi_futuri():
    """PROVA DI CONTROLLO: se un dispositivo e' sparito male, il suo socket resta nel registro e
    tirerebbe un errore a ogni avviso. Deve togliersi da se', o da quel momento nessuno riceve
    piu' niente."""
    import asyncio
    import documenti_utente as du

    class _SocketMorto:
        async def send_text(self, testo):
            raise RuntimeError("socket chiuso")

    async def _giro():
        du._loop_principale = asyncio.get_running_loop()
        du._ascoltatori.clear()
        du._ascoltatori["u2"] = {_SocketMorto()}
        du.avvisa("u2", "session", 1)        # non deve sollevare
        await asyncio.sleep(0.05)
        return len(du._ascoltatori.get("u2") or ())

    rimasti = asyncio.run(_giro())
    assert rimasti == 0, "il socket morto deve essersi tolto dal registro, ne restano %d" % rimasti
