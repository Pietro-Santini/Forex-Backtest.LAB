# -*- coding: utf-8 -*-
"""Lo scarto orologio broker/UTC di bridge.py (posizioni reali e Trade Journal).

PERCHE' CONTA: le posizioni/il diario vengono agganciati al tempo della candela. Se a mercato chiuso
lo scarto e' sbagliato (es. -25h perche' il processo e' partito col mercato gia' chiuso e il primo
tick e' fermo da ore), tutto finisce spostato. Stessa identica difesa del servizio candele
(installer_build/build/mt5_feed_server.py): uno scarto non plausibile non si usa, e lo scarto buono
si ricorda su disco fra un riavvio e l'altro.
"""
import importlib
import os
import sys
import types

import pytest

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.dirname(os.path.dirname(QUI))
BUILD = os.path.join(RADICE, "installer_build", "build")

if BUILD not in sys.path:
    sys.path.insert(0, BUILD)


class _Info:
    def __init__(self, nome, visibile=True):
        self.name = nome
        self.visible = visibile


class _Tick:
    def __init__(self, t):
        self.time = t


def _finto_mt5(tick_time=None):
    """Un finto MetaTrader5: qualunque nome sconosciuto risponde 0 (costanti TIMEFRAME_*, ...), e le
    poche funzioni davvero usate da _estimate_server_offset_seconds rispondono sui tick."""
    finto = types.ModuleType("MetaTrader5")
    finto.symbols_get = lambda: [_Info("EURUSD")]
    finto.symbol_select = lambda *a, **k: True
    finto.symbol_info_tick = lambda _n: (None if tick_time is None else _Tick(tick_time))
    finto.__getattr__ = lambda _n: 0
    return finto


@pytest.fixture()
def ponte(tmp_path, monkeypatch):
    monkeypatch.setenv("FBL_DATI", str(tmp_path))
    monkeypatch.setenv("FBL_ACCESSO_FILE", str(tmp_path / "accesso_remoto.json"))
    monkeypatch.setitem(sys.modules, "MetaTrader5", _finto_mt5())
    import bridge

    importlib.reload(bridge)  # stato pulito: nessuna misura in cache
    return bridge


def test_a_avvio_a_mercato_chiuso_non_usa_un_tick_fermo(ponte, monkeypatch):
    """Il servizio parte col mercato GIA' chiuso: il primo tick e' fermo da ~28h, quindi
    "tick - adesso" = -25h. Non e' un fuso reale: non va usato (prima dava -90000 e le posizioni
    finivano "adesso"/nel futuro)."""
    ore = [1_000_000.0]
    monkeypatch.setattr(ponte.time, "time", lambda: ore[0])
    monkeypatch.setattr(ponte, "mt5", _finto_mt5(ore[0] + 3 * 3600 - 28 * 3600))

    scarto = ponte._estimate_server_offset_seconds(())
    assert abs(scarto) <= 14 * 3600, "uno scarto di -25h non e' un fuso: e' un tick fermo"


def test_lo_scarto_buono_si_ricorda_su_disco_dopo_un_riavvio(ponte, monkeypatch):
    """Riavvio a mercato chiuso: lo scarto buono salvato su disco viene riletto, non si riparte da 0."""
    import json as _json

    with open(ponte._file_scarto(), "w", encoding="utf-8") as f:
        _json.dump({"offset_seconds": 3 * 3600}, f)

    importlib.reload(ponte)  # simula il riavvio

    ore = [1_000_000.0]
    monkeypatch.setattr(ponte.time, "time", lambda: ore[0])
    monkeypatch.setattr(ponte, "mt5", _finto_mt5(ore[0] + 3 * 3600 - 28 * 3600))

    assert ponte._estimate_server_offset_seconds(()) == 3 * 3600


def test_un_tick_fresco_misura_e_salva_lo_scarto(ponte, monkeypatch):
    """Mercato aperto (tick fresco): lo scarto si misura e si salva su disco."""
    ore = [1_000_000.0]
    monkeypatch.setattr(ponte.time, "time", lambda: ore[0])
    monkeypatch.setattr(ponte, "mt5", _finto_mt5(ore[0] + 3 * 3600))

    assert ponte._estimate_server_offset_seconds(()) == 3 * 3600

    import json as _json

    with open(ponte._file_scarto(), "r", encoding="utf-8") as f:
        assert int(_json.load(f)["offset_seconds"]) == 3 * 3600
