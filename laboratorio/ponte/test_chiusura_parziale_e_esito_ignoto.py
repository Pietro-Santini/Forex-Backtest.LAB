# =============================================================================================
# UNA CHIUSURA NON SI RIPROVA ALLA CIECA, E UNA META' NON E' UN RIFIUTO (12 novembre 2026).
#
# SEGNALATO dal proprietario con la misura del pannello prestazioni (11 novembre, 23:36):
#     chiusura: 8 volte, media 5.043 ms, peggiore 8.306 ms, 8 NON RIUSCITE
# Otto chiusure su otto fallite: non riuscire a uscire da una posizione e' la cosa piu' grave di
# tutta la lista.
#
# MISURATO nel codice del ponte, due difetti distinti dentro _send_trying_fillings:
#
# 1. ESECUZIONE PARZIALE RIPORTATA COME RIFIUTO. Solo TRADE_RETCODE_DONE contava come successo.
#    Il retcode 10010 ("Solo una parte della richiesta e' stata eseguita") finiva fra i rifiuti e
#    usciva come «Ordine rifiutato dal broker». Meta' posizione era chiusa DAVVERO e chi leggeva
#    credeva di essere ancora dentro per intero. Con type_filling IOC - la seconda modalita' che
#    la funzione prova SEMPRE - l'esecuzione parziale e' l'esito normale quando la liquidita' non
#    basta: non e' un caso di laboratorio.
#
# 2. ESITO IGNOTO SEGUITO DA UN NUOVO INVIO. Con `order_send` che torna None la funzione faceva
#    `continue`, cioe' rimandava lo stesso ordine con un'altra filling policy: fino a TRE invii.
#    Ma «non ha risposto» non vuol dire «non e' stato eseguito». Su soldi veri un secondo invio
#    puo' duplicare la chiusura, e una chiusura duplicata APRE la posizione opposta.
#
# Le prove misurano il COMPORTAMENTO con un MetaTrader5 finto: nessun ordine vero, nessun
# terminale toccato.
# =============================================================================================
import os
import sys
import types

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))

import pytest


def _bridge():
    if "MetaTrader5" not in sys.modules:
        sys.modules["MetaTrader5"] = types.SimpleNamespace(
            initialize=lambda *a, **k: False, shutdown=lambda: None,
            terminal_info=lambda: None, account_info=lambda: None, last_error=lambda: (0, ""))
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    import bridge
    return bridge


class _Esito:
    """La risposta di MT5 a un order_send, con i campi che il ponte legge."""
    def __init__(self, retcode, order=111, deal=222, price=1.2345, volume=0.10):
        self.retcode, self.order, self.deal = retcode, order, deal
        self.price, self.volume = price, volume


def _finta_mt5(bridge, monkeypatch, esiti):
    """Sostituisce order_send: restituisce gli esiti della lista, uno per invio, e conta."""
    inviati = []

    def _send(req):
        inviati.append(dict(req))
        e = esiti[len(inviati) - 1] if len(inviati) <= len(esiti) else esiti[-1]
        return e

    monkeypatch.setattr(bridge.mt5, "order_send", _send, raising=False)
    monkeypatch.setattr(bridge.mt5, "last_error", lambda: (1, "finto"), raising=False)
    for nome, valore in (("ORDER_FILLING_IOC", 1), ("ORDER_FILLING_FOK", 0), ("ORDER_FILLING_RETURN", 2),
                         ("TRADE_RETCODE_DONE", 10009)):
        monkeypatch.setattr(bridge.mt5, nome, valore, raising=False)
    return inviati


# ---------------------------------------------------------------------------------------------
# 1. UNA META' NON E' UN RIFIUTO
# ---------------------------------------------------------------------------------------------
def test_esecuzione_parziale_non_e_un_rifiuto(monkeypatch):
    """IL DIFETTO: con 10010 il ponte rispondeva «Ordine rifiutato dal broker» mentre meta'
    posizione era chiusa davvero. Adesso l'esito torna a chi ha chiesto, che puo' dichiararlo."""
    bridge = _bridge()
    inviati = _finta_mt5(bridge, monkeypatch, [_Esito(10010, volume=0.05)])

    r = bridge._send_trying_fillings({"symbol": "XAUUSD", "volume": 0.10, "type_filling": 0})

    assert r is not None, "un'esecuzione parziale non puo' sparire come se fosse un rifiuto"
    assert r.retcode == 10010, "l'esito deve arrivare intatto a chi chiama: %r" % r.retcode
    assert len(inviati) == 1, (
        "una volta eseguita, anche solo in parte, la richiesta NON va rimandata: invii %d" % len(inviati))


# ---------------------------------------------------------------------------------------------
# 2. ESITO IGNOTO: CI SI FERMA, NON SI RIPROVA
# ---------------------------------------------------------------------------------------------
def test_esito_ignoto_non_fa_rimandare_l_ordine(monkeypatch):
    """IL DIFETTO: `order_send` che torna None faceva provare la filling policy successiva, fino
    a tre invii della stessa chiusura. Su soldi veri un doppione di chiusura APRE la posizione
    opposta. «Non ha risposto» non vuol dire «non e' stato eseguito»."""
    bridge = _bridge()
    inviati = _finta_mt5(bridge, monkeypatch, [None, None, None])

    with pytest.raises(Exception) as errore:
        bridge._send_trying_fillings({"symbol": "XAUUSD", "volume": 0.10, "type_filling": 0})

    assert len(inviati) == 1, (
        "dopo un esito sconosciuto l'ordine NON va rimandato: invii effettivi %d" % len(inviati))
    testo = str(getattr(errore.value, "detail", errore.value))
    assert "SCONOSCIUTO" in testo.upper(), (
        "chi legge deve capire che l'esito e' ignoto, non che l'ordine e' stato rifiutato: %r" % testo)
    assert "controlla le posizioni" in testo.lower(), (
        "va detto cosa fare adesso, cioe' verificare prima di riprovare: %r" % testo)


# ---------------------------------------------------------------------------------------------
# 3. CONTROLLO: un rifiuto vero resta un rifiuto, e il 10030 fa ancora cambiare modalita'
# ---------------------------------------------------------------------------------------------
def test_un_rifiuto_vero_resta_un_rifiuto(monkeypatch):
    """PROVA DI CONTROLLO: le cure non devono trasformare un rifiuto in un successo."""
    bridge = _bridge()
    inviati = _finta_mt5(bridge, monkeypatch, [_Esito(10019)])   # fondi insufficienti

    with pytest.raises(Exception) as errore:
        bridge._send_trying_fillings({"symbol": "XAUUSD", "volume": 0.10, "type_filling": 0})

    testo = str(getattr(errore.value, "detail", errore.value))
    assert "rifiutat" in testo.lower(), "un rifiuto vero va ancora detto come rifiuto: %r" % testo
    assert len(inviati) == 1, "con un motivo diverso da 10030 non si cambia modalita'"


def test_il_filling_non_supportato_fa_ancora_cambiare_modalita(monkeypatch):
    """PROVA DI CONTROLLO: il motivo per cui questa funzione esiste - il retcode 10030 - deve
    continuare a far provare la modalita' successiva, o si rompe la compatibilita' coi broker
    che riportano male il bitmask del simbolo."""
    bridge = _bridge()
    inviati = _finta_mt5(bridge, monkeypatch, [_Esito(10030), _Esito(10009)])

    r = bridge._send_trying_fillings({"symbol": "XAUUSD", "volume": 0.10, "type_filling": 0})

    assert r.retcode == 10009, "al secondo tentativo doveva riuscire"
    assert len(inviati) == 2, "con 10030 si prova la modalita' dopo: invii %d" % len(inviati)
    assert inviati[0]["type_filling"] != inviati[1]["type_filling"], (
        "il secondo invio deve usare una filling policy DIVERSA")
