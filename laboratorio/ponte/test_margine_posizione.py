# -*- coding: utf-8 -*-
"""IL MARGINE DI UNA POSIZIONE REALE LO DICE IL BROKER, NON UNA NOSTRA FORMULA.

SEGNALATO dal proprietario: «il margine utilizzato mi da' sempre 0, bisogna fargli calcolare
effettivamente quanto margine e' stato utilizzato da quella singola posizione». (Su Kraken invece
funziona gia', verificato con lui: li' il margine e' calcolato nella tabella e il campo c'e'.)

NON ERA CALCOLATO MALE: non veniva chiesto a nessuno. Le posizioni adottate dal conto MT5
nascevano con marginUsed:0 nell'app - con accanto un commento che diceva «il margine vero e'
quello del conto MT5», che era vero e insieme il motivo per cui nessuno andava a leggerlo. Il
ponte mandava gia' nove dati per posizione (prezzo, swap, commissione, valore del punto, cifre del
simbolo...) e il margine non era fra quelli.

PERCHE' LO CALCOLA MT5 E NON NOI: order_calc_margin tiene conto della percentuale di margine di
quel simbolo, della leva del conto e del cambio valuta. Una formula nostra (valore/leva) darebbe
un numero plausibile e DIVERSO da quello vero, che e' il modo peggiore di sbagliare - sembra
giusto, e nessuno lo controlla.
"""
import os
import sys
import types

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))


def _bridge(calc):
    """bridge.py con un MetaTrader5 finto il cui order_calc_margin fa quello che diciamo noi."""
    sys.modules["MetaTrader5"] = types.SimpleNamespace(
        initialize=lambda *a, **k: False, shutdown=lambda: None,
        terminal_info=lambda: None, account_info=lambda: None, last_error=lambda: (0, ""),
        ORDER_TYPE_BUY=0, ORDER_TYPE_SELL=1, POSITION_TYPE_BUY=0, POSITION_TYPE_SELL=1,
        order_calc_margin=calc)
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    for m in list(sys.modules):
        if m == "bridge":
            del sys.modules[m]
    import bridge
    bridge.mt5 = sys.modules["MetaTrader5"]
    bridge._margine_cache.clear()
    return bridge


def test_il_margine_e_quello_che_dice_mt5():
    visti = []

    def calc(ordine, simbolo, volume, prezzo):
        visti.append((ordine, simbolo, volume, prezzo))
        return 331.25

    bridge = _bridge(calc)
    v = bridge._margine_posizione("EURUSD", 0, 0.10, 1.1000)
    assert v == 331.25, "si restituisce il numero di MT5, senza ritoccarlo"
    assert visti == [(0, "EURUSD", 0.10, 1.1000)], \
        "e gli si passano simbolo, lato, volume e prezzo di QUELLA posizione: " + str(visti)


def test_il_lato_della_posizione_diventa_il_lato_dell_ordine():
    """Una vendita non si calcola come un acquisto: su molti simboli il margine e' lo stesso, ma
    non su tutti, e chiedere il lato sbagliato darebbe un numero plausibile e sbagliato."""
    visti = []
    bridge = _bridge(lambda o, s, v, p: visti.append(o) or 100.0)
    bridge._margine_posizione("EURUSD", 1, 0.10, 1.1000)   # POSITION_TYPE_SELL
    assert visti == [1], "una posizione SELL va calcolata come ordine SELL: " + str(visti)


def test_quando_non_si_sa_si_dice_none_invece_di_zero():
    """E' il cuore della segnalazione: uno zero inventato sembra un dato. Un trattino no."""
    bridge = _bridge(lambda *a: None)
    assert bridge._margine_posizione("EURUSD", 0, 0.10, 1.1000) is None
    bridge._margine_cache.clear()

    def esplode(*a):
        raise RuntimeError("terminale occupato")

    bridge = _bridge(esplode)
    assert bridge._margine_posizione("EURUSD", 0, 0.10, 1.1000) is None, \
        "un errore del terminale non deve diventare un margine di zero euro"


def test_non_si_richiama_mt5_a_ogni_giro():
    """Le posizioni si leggono ogni due secondi: il margine di una posizione aperta non cambia,
    cambia solo col cambio valuta. Stessa cache del valore del punto, 60 secondi."""
    conta = []
    bridge = _bridge(lambda *a: conta.append(1) or 250.0)
    for _ in range(5):
        bridge._margine_posizione("EURUSD", 0, 0.10, 1.1000)
    assert len(conta) == 1, "cinque letture, una sola domanda a MT5: " + str(len(conta))


def test_il_campo_arriva_davvero_nel_payload():
    """La differenza che conta: una funzione giusta che nessuno chiama non corregge niente."""
    sorgente = open(os.path.join(RADICE, "installer_build", "build", "bridge.py"),
                    encoding="utf-8").read()
    assert '"margine": _margine_posizione(' in sorgente, \
        "il margine deve far parte di cio' che /positions restituisce all'app"


def test_l_app_lo_legge_e_non_mette_piu_zero():
    app = open(os.path.join(RADICE, "app.html"), encoding="utf-8").read()
    assert "function fblMargineReale(" in app, "l'app deve avere un modo di leggerlo"
    assert "marginUsed:0,mt5Ticket:rp.ticket" not in app, \
        "le posizioni adottate da MT5 non devono piu' nascere con margine zero"
    assert "fblMargineReale(rpNow)" in app, \
        "e il margine va riallineato a ogni lettura, come SL e TP: altrimenti una posizione " \
        "adottata prima che il ponte lo sapesse dire resterebbe a zero per sempre"
