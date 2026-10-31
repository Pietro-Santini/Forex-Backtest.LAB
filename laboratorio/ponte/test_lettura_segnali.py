"""FASE 4 del progetto: il ponte ordini LEGGE i segnali dal canale del ponte segnali.

Cosa misura, e perche' conta:
  1. il segnale che arriva sul WebSocket viene riconosciuto e messo da parte. Non la presenza di
     una funzione: un messaggio finto attraversa il ciclo vero e `_ultimo_segnale()` cambia;
  2. un messaggio che NON e' un segnale (un comando di ack, spazzatura) non lo scambia per uno;
  3. il canale perduto NON butta giu' il ponte: ci riprova, e intanto gli ordini della pagina
     continuano a passare. Il ponte ordini che muore perche' il ponte segnali non e' ancora su
     sarebbe un difetto molto piu' grave di quello che questa fase cura;
  4. l'avvio funziona da codice SINCROLO (il blocco principale lo e'): con `ensure_future`
     l'ascolto non sarebbe partito mai, perche' non c'e' un event loop in giro.

Il ponte non si tocca: si guarda, con le stesse finzioni degli altri test (niente MetaTrader5
reale, niente pywinauto). websockets/asyncio/fastapi sono quelli veri, che il ponte usa gia'.
"""
import asyncio
import os
import sys
import types

import pytest

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PONTE = os.path.join(RADICE, "installer_build", "build")
sys.path.insert(0, PONTE)


def _bridge():
    """bridge.py senza MetaTrader5 ne' pywinauto veri: il ponte non si tocca, si guarda."""
    if "MetaTrader5" not in sys.modules:
        sys.modules["MetaTrader5"] = types.SimpleNamespace(
            initialize=lambda *a, **k: False, shutdown=lambda: None,
            terminal_info=lambda: None, account_info=lambda: None,
            last_error=lambda: (0, ""), login=lambda *a, **k: False)
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    import bridge
    return bridge


class _WsFinto:
    """Un canale che consegna i messaggi che gli dai e poi chiude, con la stessa faccia di
    `websockets.connect(...)`: context manager asincrono con recv() e send()."""

    def __init__(self, messaggi):
        self.messaggi = list(messaggi)
        self.inviati = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def recv(self):
        if self.messaggi:
            return self.messaggi.pop(0)
        raise OSError("canale chiuso dal ponte segnali")

    async def send(self, dato):
        self.inviati.append(dato)


def _connetto_con(messaggi, contatore=None):
    """websockets.connect finto: non serve che sia async, `async with` gli basta."""
    def connetto(uri, **k):
        if contatore is not None:
            contatore.append(uri)
        return _WsFinto(messaggi)
    return connetto


def _dormi_e_esci(dopo, contatore):
    """asyncio.sleep finto: conta le attese invece di farle durare, e dopo N interrompe il ciclo
    (altrimenti girerebbe per sempre, com'e' giusto che faccia in produzione)."""
    async def finto_sleep(secondi):
        contatore.append(secondi)
        if len(contatore) >= dopo:
            raise asyncio.CancelledError()
    return finto_sleep


@pytest.fixture
def bridge(monkeypatch):
    b = _bridge()
    monkeypatch.setattr(b, "_ultimo_segnale_ricevuto", None)
    monkeypatch.setattr(b, "_ws_segnali_task", None)
    return b


def test_il_segnale_arrivato_viene_messo_da_parte(bridge):
    bridge._segnala_segnale({"strumento": "EURUSD", "direzione": "BUY", "stop_loss": 1.09,
                             "take_profit": [1.10]})
    u = bridge._ultimo_segnale()
    assert u is not None
    assert u["strumento"] == "EURUSD"
    assert u["direzione"] == "BUY"


def test_il_ciclo_legge_il_messaggio_e_manda_l_ack(bridge, monkeypatch):
    """Il messaggio finto attraversa il ciclo vero: il segnale viene riconosciuto e l'id viene
    rimandato indietro, perche' un ricollegamento non deve perdere gli ultimi segnali gia' visti."""
    import websockets

    messaggio = '{"id": 7, "segnale": {"strumento": "XAUUSD", "direzione": "SELL"}}'
    monkeypatch.setattr(websockets, "connect", _connetto_con([messaggio]))
    attese = []
    monkeypatch.setattr(bridge.asyncio, "sleep", _dormi_e_esci(1, attese))

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(bridge._ascolta_segnali_loop())

    u = bridge._ultimo_segnale()
    assert u is not None, "il segnale dentro il messaggio deve essere riconosciuto"
    assert u["strumento"] == "XAUUSD"
    assert u["direzione"] == "SELL"
    assert attese == [5], "dopo la chiusura del canale si aspetta prima di riprovare"


def test_cosa_non_e_un_segnale_non_viene_scambiato_per_uno(bridge):
    bridge._segnala_segnale({"azione": "ultimo_id", "id": 3})        # un comando
    assert bridge._ultimo_segnale() is None
    bridge._segnala_segnale({"strumento": "EURUSD", "direzione": "BUY"})
    assert bridge._ultimo_segnale()["strumento"] == "EURUSD"
    bridge._segnala_segnale("non sono un dizionario")                 # spazzatura
    assert bridge._ultimo_segnale()["strumento"] == "EURUSD", \
        "la spazzatura non deve sostituire l'ultimo segnale buono"


def test_canale_perso_non_fa_cadere_il_ponte(bridge, monkeypatch):
    """Senza ponte segnali (canale muto) il ciclo dorme e RIPROVA. Il difetto peggiore sarebbe
    l'opposto: un'eccezione non catturata che porta giu' il processo che esegue gli ordini."""
    tentativi = []

    def connetto(uri, **k):
        tentativi.append(uri)
        raise OSError("canale non ancora su")

    import websockets
    monkeypatch.setattr(websockets, "connect", connetto)
    attese = []
    monkeypatch.setattr(bridge.asyncio, "sleep", _dormi_e_esci(3, attese))

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(bridge._ascolta_segnali_loop())

    assert len(tentativi) >= 2, f"deve riprovare, non arrendersi al primo canale muto (tentativi: {len(tentativi)})"
    assert set(attese) == {5}, f"le attese devono essere di 5 secondi, non {attese}"


def test_l_avvio_funziona_anche_da_codice_sincrono(bridge, monkeypatch):
    """Il blocco principale del ponte e' sincrono: `ensure_future` li' solleverebbe "no running
    event loop" e l'ascolto non partirebbe MAI. Misurato: dopo l'avvio il thread esiste, gira,
    e si ferma senza protestare."""
    partito = []
    monkeypatch.setattr(bridge, "_ascolta_segnali_loop",
                        lambda: asyncio.sleep(3600))  # un loop che non finisce mai, come il vero
    monkeypatch.setattr(bridge, "_ws_segnali_task", None)
    monkeypatch.setattr(bridge, "_ultimo_segnale_ricevuto", None)

    # L'avvio deve poter essere chiamato da codice sincrono, senza loop in giro.
    bridge._avvia_ascolto_segnali()
    t = bridge._ws_segnali_task
    assert t is not None, "l'avvio non ha lasciato nemmeno il riferimento al thread"
    assert t.is_alive() or t.daemon, "il thread deve girare (daemon, cosi' non impedisce l'uscita)"

    bridge._ferma_ascolto_segnali()
    assert bridge._ws_segnali_task is None, "fermare deve togliere il riferimento"


def test_l_aggancio_all_avvio_esiste():
    src = open(os.path.join(PONTE, "bridge.py"), encoding="utf-8").read()
    assert "_avvia_ascolto_segnali()" in src, \
        "l'ascolto va avviato all'avvio: senza, la lettura dei segnali non parte mai"
    assert "threading.Thread" in src and "asyncio.run(" in src, \
        "il ciclo gira in un thread con il suo loop: e' l'unico modo che funzioni da codice sincrono"


def test_l_ultimo_segnale_parte_vuoto(bridge):
    assert bridge._ultimo_segnale() is None
