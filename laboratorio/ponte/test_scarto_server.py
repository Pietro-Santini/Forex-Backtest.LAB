# -*- coding: utf-8 -*-
"""Lo scarto orario del broker NON può mai essere l'età di un vecchio tick (8h20).

Richiesto dal proprietario (18/10/2026): «risolvi subito il grafico: le candele sono sfasate.
Apri XAU/USD, chiude alle 04:55 sul MT5, qui alle 13:15 sull'app, si è spostato di 8h20».

CAUSA MISURATA: _server_time_offset_seconds() (mt5_feed_server.py per le candele, bridge.py
per posizioni e ordini pendenti) calcolava lo scarto fra orologio server e UTC come
`tick.time - time.time()` su QUALUNQUE tick, anche uno lasciato indietro da ore. Con la
chiusura giornaliera dell'oro il tick dell'ultimo prezzo aveva 8h20 di età, e quella età
sostituiva il fuso reale: tutte le candele spostate di 8h20 (04:55 + 8h20 = 13:15, l'ora
esatta segnalata). Gli orologi dei broker cadono su ore o mezz'ore intere (griglia 1800 s),
quindi con un tick fresco il residuo dalla griglia è di soli secondi, mentre con un tick
vecchio l'età si somma e il residuo è un numero a caso oltre i 5 minuti.

QUI SI PROVA IL COMPORTAMENTO (time e MetaTrader5 finti, gira anche su CI Ubuntu):
- un tick fresco restituisce lo scarto vero del broker (UTC+2 = 7200);
- un tick vecchio di 8h20 restituisce 0 (o l'ultimo scarto buono già misurato), MAI -29700;
- se un altro simbolo sta quotando adesso, il suo orologio fa da misura per tutti;
- lo scan del Market Watch è limitato a una volta al minuto (il polling gira ogni 2s);
- nessuna eccezione per tick assente o mercato chiuso.
"""
import importlib
import os
import sys
import types

import pytest

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))

ORA = 1_700_000_000.0          # "adesso" congelato: senza, ogni assert è una rincorsa
SCARTO_VERO = 7200             # broker finto UTC+2
ETA_8H20 = 8 * 3600 + 20 * 60  # 29520 s: l'età del tick che ha causato il difetto
SCARTO_FALSO_ATTESO = -29700   # arrotondamento a 900 s di -29520: il numero di una volta


def _tick(epoch):
    return types.SimpleNamespace(time=epoch, bid=1.0, ask=1.0)


class _MT5Finto:
    """MetaTrader5 finto per il banco (su GitHub Actions non c'è MT5). Le costanti
    sconosciute (TIMEFRAME_*, POSITION_TYPE_*, ...) valgono 0; le funzioni che servono
    ai test sono qui sotto, e i singoli test possono sostituirle."""

    def __init__(self, tick_per_simbolo=None):
        self.tick_per_simbolo = dict(tick_per_simbolo or {})
        self.chiamate_tick = 0

    def symbols_get(self):
        return [types.SimpleNamespace(name=nome) for nome in self.tick_per_simbolo]

    def symbol_info_tick(self, nome):
        self.chiamate_tick += 1
        epoch = self.tick_per_simbolo.get(nome)
        if epoch is None:
            return None
        return _tick(epoch)

    def symbol_select(self, nome, selezionato=True):
        return True

    def __getattr__(self, nome):
        return 0


def _carica(nome, monkeypatch, mt5):
    """Importa il modulo (bridge o mt5_feed_server) con MT5 finto e time fermo a ORA."""
    sys.modules["MetaTrader5"] = mt5
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    mod = importlib.import_module(nome)
    monkeypatch.setattr(mod, "time", types.SimpleNamespace(time=lambda: ORA))
    monkeypatch.setattr(mod, "mt5", mt5)
    # La memoria vive nel modulo (singleton di processo): resettare ad ogni test.
    monkeypatch.setattr(mod, "_last_good_server_offset", None)
    monkeypatch.setattr(mod, "_ultima_ricerca_scarto", 0.0)
    return mod


@pytest.mark.parametrize("nome_modulo", ["mt5_feed_server", "bridge"])
class TestScartoServer:
    """Gli stessi casi su entrambi i moduli: candele (feed) e posizioni/ordini (bridge)
    devono misurare lo scarto allo stesso modo, altrimenti i marker si spostano."""

    def test_tick_fresco_dà_lo_scarto_del_broker(self, nome_modulo, monkeypatch):
        mt5 = _MT5Finto({"EURUSD": ORA + SCARTO_VERO + 10})
        mod = _carica(nome_modulo, monkeypatch, mt5)
        assert mod._server_time_offset_seconds(_tick(ORA + SCARTO_VERO + 10)) == SCARTO_VERO

    def test_tick_vecchio_di_8h20_non_restiutisce_lo_scarto_falso(self, nome_modulo, monkeypatch):
        """IL DIFETTO SEGNALATO: con il vecchio calcolo questo test restituiva -29700.
        Mercato chiuso da ore, nessuna misura precedente: serve 0 ("server = UTC"),
        che è comunque più sicuro di un numero inventato."""
        mt5 = _MT5Finto({"XAUUSD": ORA - ETA_8H20})
        mod = _carica(nome_modulo, monkeypatch, mt5)
        scarto = mod._server_time_offset_seconds(_tick(ORA - ETA_8H20))
        assert scarto == 0, f"un tick vecchio di 8h20 non può dare scarto {scarto}"
        assert scarto != SCARTO_FALSO_ATTESO

    def test_con_memoria_si_riusa_lo_scarto_misurato(self, nome_modulo, monkeypatch):
        """Pomeriggio con mercato dell'oro chiuso: la misura del mattino (tick fresco) vale
        ancora, non viene sostituita dall'età del vecchio tick."""
        mt5 = _MT5Finto({"XAUUSD": ORA + SCARTO_VERO + 3})
        mod = _carica(nome_modulo, monkeypatch, mt5)
        assert mod._server_time_offset_seconds(_tick(ORA + SCARTO_VERO + 3)) == SCARTO_VERO
        # Il mercato dell'oro si ferma: stesso simbolo, tick rimasto indietro di 8h20.
        mt5.tick_per_simbolo["XAUUSD"] = ORA - ETA_8H20
        assert mod._server_time_offset_seconds(_tick(ORA - ETA_8H20)) == SCARTO_VERO

    def test_un_altro_simbolo_fresco_fa_da_orologio(self, nome_modulo, monkeypatch):
        """L'oro è fermo da 8h20 ma il Forex sta ancora quotando: un solo tick fresco basta
        a misurare lo scarto per tutti (stesso server broker)."""
        mt5 = _MT5Finto({
            "XAUUSD": ORA - ETA_8H20,
            "EURUSD": ORA + SCARTO_VERO + 5,
        })
        mod = _carica(nome_modulo, monkeypatch, mt5)
        assert mod._server_time_offset_seconds(_tick(ORA - ETA_8H20)) == SCARTO_VERO

    def test_scan_al_massimo_una_volta_al_minuto(self, nome_modulo, monkeypatch):
        """Il polling dell'app chiama questa funzione ogni 2s: quando il mercato è chiuso lo
        scan del Market Watch (fino a 60 chiamate IPC) non deve girare a ogni chiamata."""
        mt5 = _MT5Finto({"XAUUSD": ORA - ETA_8H20})
        mod = _carica(nome_modulo, monkeypatch, mt5)
        mod._server_time_offset_seconds(_tick(ORA - ETA_8H20))
        dopo_primo = mt5.chiamate_tick
        assert dopo_primo > 0  # il primo scan è davvero avvenuto
        mod._server_time_offset_seconds(_tick(ORA - ETA_8H20))
        mod._server_time_offset_seconds(_tick(ORA - ETA_8H20))
        assert mt5.chiamate_tick == dopo_primo, "scan rifatto prima dei 60 secondi"
        # Passato un minuto, il mercato viene ricontrollato.
        monkeypatch.setattr(mod, "_ultima_ricerca_scarto", ORA - 120.0)
        mod._server_time_offset_seconds(_tick(ORA - ETA_8H20))
        assert mt5.chiamate_tick > dopo_primo

    def test_tick_assente_mercato_chiuso_non_esplode(self, nome_modulo, monkeypatch):
        mt5 = _MT5Finto({})
        mod = _carica(nome_modulo, monkeypatch, mt5)
        assert mod._server_time_offset_seconds(None) == 0
