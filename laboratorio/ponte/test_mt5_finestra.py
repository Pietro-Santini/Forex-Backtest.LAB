# -*- coding: utf-8 -*-
"""Il terminale MT5 resta ridotto a icona.

RICHIESTO dal proprietario: «quando ci si collega all'account MT5, e anche quando si passa da un
account all'altro, non deve aprirsi ogni volta il terminale a tutto schermo: forziamolo ridotto a
icona, cosi' resta nascosto e lavora in background».

Il terminale DEVE restare aperto - e' lui che esegue gli ordini, il pacchetto Python ci parla
soltanto - ma non deve prendersi lo schermo a ogni collegamento.

Qui si prova la funzione da sola, con una finestra finta: il banco non ha ne' Windows ne' MT5.
"""
import os
import sys
import types

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))


def _bridge(monkeypatch, finestra):
    """Importa bridge.py senza MetaTrader5 ne' pywinauto (su questo banco non ci sono: e' Windows a
    darli, e il banco gira anche su Linux) e con una finestra finta al posto di quella vera."""
    if "MetaTrader5" not in sys.modules:
        sys.modules["MetaTrader5"] = types.SimpleNamespace(
            initialize=lambda *a, **k: False, shutdown=lambda: None,
            terminal_info=lambda: None, account_info=lambda: None, last_error=lambda: (0, ""))
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    import bridge
    monkeypatch.setattr(bridge, "_finestra_mt5", lambda: finestra)
    return bridge


class Finestra:
    def __init__(self, gia_giu=False, esplode=False):
        self.gia_giu = gia_giu
        self.esplode = esplode
        self.ridotte = 0

    def is_minimized(self):
        return self.gia_giu

    def minimize(self):
        if self.esplode:
            raise RuntimeError("accesso negato")
        self.ridotte += 1


def test_la_finestra_si_riduce_a_icona(monkeypatch):
    f = Finestra()
    b = _bridge(monkeypatch, f)
    assert b.riduci_terminale_a_icona() is None, "doveva riuscire"
    assert f.ridotte == 1, "la finestra del terminale deve finire nella barra delle applicazioni"


def test_una_finestra_gia_ridotta_non_si_tocca(monkeypatch):
    # Rifarlo su una finestra gia' giu' su alcuni sistemi la riporta SU: l'opposto di quel che serve.
    f = Finestra(gia_giu=True)
    b = _bridge(monkeypatch, f)
    assert b.riduci_terminale_a_icona() is None
    assert f.ridotte == 0, "era gia' ridotta: non andava toccata"


def test_senza_finestra_lo_dice_e_non_esplode(monkeypatch):
    b = _bridge(monkeypatch, None)
    msg = b.riduci_terminale_a_icona()
    assert isinstance(msg, str) and "nessuna finestra" in msg, "deve spiegare perche' non ha fatto niente"


def test_se_windows_dice_di_no_il_collegamento_non_salta(monkeypatch):
    # Il tentativo e' un di piu': se fallisce, al massimo la finestra resta aperta - mai un errore
    # che fa fallire /connect.
    f = Finestra(esplode=True)
    b = _bridge(monkeypatch, f)
    msg = b.riduci_terminale_a_icona()
    assert isinstance(msg, str) and "non riuscito" in msg
