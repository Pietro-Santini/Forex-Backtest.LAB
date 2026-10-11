# -*- coding: utf-8 -*-
"""Lo scarto orologio broker/UTC del servizio candele MT5 (installer_build/build/mt5_feed_server.py).

PERCHE' CONTA PER LA SINCRONIZZAZIONE: l'app aggancia disegni, linee, posizioni e indicatori al
TEMPO della candela (d.p1.time -> rowIndexNearTime(t)). Se al ricaricare la serie i timestamp delle
candele CAMBIANO, tutto quanto e' agganciato al tempo si stacca dalle candele.

/history ricava lo scarto orologio da UN SOLO tick (symbol_info_tick). A mercato APERTO quel tick e'
fresco (pochi secondi) e lo scarto e' giusto; a mercato CHIUSO lo stesso tick e' vecchio di ore,
quindi "tick.time - adesso" non e' piu' lo scarto del broker ma "scarto - tempo trascorso" (es. -51h)
e /history sposta TUTTE le candele nel futuro: la serie cambia base dei tempi e i disegni si staccano.

Qui si verifica che un tick FERMO (mercato chiuso) NON venga usato per calcolare lo scarto: si riusa
l'ultimo scarto BUONO misurato con un tick fresco.
"""
import importlib
import os
import sys
import types

import pytest

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.dirname(os.path.dirname(QUI))
BUILD = os.path.join(RADICE, "installer_build", "build")

# MetaTrader5 parla col terminale: non c'e' (e non deve esserci) sui server di collaudo. Il modulo
# del servizio candele lo importa a livello di modulo e legge gia' le costanti TIMEFRAME_M*, quindi
# va messo al suo posto un finto modulo che risponde qualsiasi nome con un valore fittizio.
if "MetaTrader5" not in sys.modules:
    _finto_mt5 = types.ModuleType("MetaTrader5")
    _finto_mt5.__getattr__ = lambda _nome: 0  # TIMEFRAME_M1, POSITION_TYPE_BUY, ... tutti 0
    sys.modules["MetaTrader5"] = _finto_mt5

if BUILD not in sys.path:
    sys.path.insert(0, BUILD)


class Tick:
    """Il minimo che _server_time_offset_seconds() legge da un tick MT5: solo .time."""

    def __init__(self, t):
        self.time = t


@pytest.fixture()
def feed(tmp_path, monkeypatch):
    monkeypatch.setenv("FBL_DATI", str(tmp_path))
    monkeypatch.setenv("FBL_ACCESSO_FILE", str(tmp_path / "accesso_remoto.json"))
    import mt5_feed_server

    importlib.reload(mt5_feed_server)  # stato pulito: nessuna misura in cache
    return mt5_feed_server


def test_a_mercato_chiuso_non_si_spostano_le_candele(feed, monkeypatch):
    """Tick FERMO da ore (mercato chiuso): lo scarto resta quello buono.

    Senza la correzione, il terzo controllo riceveva "scarto - tempo trascorso" (1h) al posto dello
    scarto vero del broker (3h): le candele si spostavano di 2 ore e i disegni si staccavano.
    """
    ore = [1000.0]  # orologio locale finto (secondi)
    monkeypatch.setattr(feed.time, "time", lambda: ore[0])
    tick_time = ore[0] + 3 * 3600  # broker a UTC+3, ultimo tick "adesso"

    assert feed._server_time_offset_seconds(Tick(tick_time)) == 3 * 3600

    # Un minuto dopo, stesso tick (mercato calmo ma ancora aperto): scarto invariato.
    ore[0] += 60
    assert feed._server_time_offset_seconds(Tick(tick_time)) == 3 * 3600

    # DUE ORE dopo, il tick e' ancora FERMO = mercato CHIUSO: "scarto - tempo trascorso" darebbe 1h,
    # ma non e' lo scarto del broker. Si deve riusare 3h.
    ore[0] += 2 * 3600
    assert feed._server_time_offset_seconds(Tick(tick_time)) == 3 * 3600


def test_un_tick_nuovo_aggiorna_lo_scarto(feed, monkeypatch):
    """Quando i tick riprendono (o cambia l'ora legale) lo scarto si aggiorna subito."""
    ore = [10000.0]
    monkeypatch.setattr(feed.time, "time", lambda: ore[0])
    assert feed._server_time_offset_seconds(Tick(ore[0] + 3 * 3600)) == 3 * 3600

    # Passa molto tempo (mercato chiuso) e poi arriva un tick NUOVO con uno scarto diverso (+2h).
    ore[0] += 5 * 3600
    assert feed._server_time_offset_seconds(Tick(ore[0] + 2 * 3600)) == 2 * 3600


def test_a_avvio_a_mercato_chiuso_non_si_usa_un_tick_fermo(feed, monkeypatch):
    """SEGNALATO: "la chiusura e' saltata alle 3". Il processo parte quando il mercato e' GIA'
    chiuso, quindi il PRIMO tick che vede e' fermo da ore. Non lo si deve credere fresco solo
    perche' e' il primo: "tick.time - adesso" sarebbe -25h (settimana chiusa) e le candele
    finirebbero nel futuro. Uno scarto di -25h NON e' un fuso orario reale, e' un tick fermo.
    """
    ore = [1_000_000.0]
    monkeypatch.setattr(feed.time, "time", lambda: ore[0])
    tick_fermo = Tick(ore[0] + 3 * 3600 - 28 * 3600)  # broker UTC+3, ultimo tick ~28h fa
    scarto = feed._server_time_offset_seconds(tick_fermo)
    assert abs(scarto) <= 14 * 3600, (
        "uno scarto di -25h non e' un fuso orario reale: e' un tick fermo, non va usato"
    )


def test_lo_scarto_buono_si_ricorda_su_disco_dopo_un_riavvio(feed, monkeypatch):
    """Un riavvio del servizio a mercato chiuso non deve perdere lo scarto buono: va riletto dal
    disco (accanto al programma), altrimenti si riparte da zero/assurdo finche' il mercato non riapre."""
    import importlib
    import json as _json

    with open(feed._file_scarto(), "w", encoding="utf-8") as f:
        _json.dump({"offset_seconds": 3 * 3600}, f)

    importlib.reload(feed)  # simula il riavvio del servizio

    ore = [1_000_000.0]
    monkeypatch.setattr(feed.time, "time", lambda: ore[0])
    tick_fermo = Tick(ore[0] + 3 * 3600 - 28 * 3600)  # mercato chiuso: tick fermo
    assert feed._server_time_offset_seconds(tick_fermo) == 3 * 3600


def test_lo_scarto_misurato_viene_salvato_su_disco(feed, monkeypatch):
    """Uno scarto misurato con un tick fresco (mercato aperto) viene scritto su disco, cosi' un
    riavvio a mercato chiuso non lo perde."""
    ore = [1_000_000.0]
    monkeypatch.setattr(feed.time, "time", lambda: ore[0])
    assert feed._server_time_offset_seconds(Tick(ore[0] + 3 * 3600)) == 3 * 3600

    import json as _json

    with open(feed._file_scarto(), "r", encoding="utf-8") as f:
        assert int(_json.load(f)["offset_seconds"]) == 3 * 3600
