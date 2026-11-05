# -*- coding: utf-8 -*-
"""SE UN CONTO E' REALE LO DICE MT5, NON IL NOME DEL SERVER.

RICHIESTO dal proprietario (5 novembre 2026): «se siamo loggati a un conto reale, prop firm, ok,
quindi dove girano soldi veri, dobbiamo avere la possibilita' di attivare le operazioni automatiche
di quel conto oppure disattivarle». E la regola di sicurezza scelta e': su un conto REALE le
aperture automatiche non partono se non e' lui a spuntarlo.

PERCHE' QUESTA PROVA ESISTE: per applicare quella regola l'app deve SAPERE se il conto e' reale, e
fino a oggi non lo sapeva. /account tornava login, server, saldo, margini - mai il tipo di conto.
L'unico indizio disponibile era il nome del server ("...-Demo"), che e' una convenzione del broker
e non un dato: ci sono server reali senza "Live" nel nome e demo senza "Demo". Indovinare, quando
la conseguenza e' aprire posizioni con denaro vero, non e' accettabile.

LA TERZA PROVA E' LA PIU' IMPORTANTE: quando MT5 non dice niente (pacchetto piu' vecchio, campo
assente), la risposta deve essere None - "non lo so" - e NON False. False vorrebbe dire "e' un
demo, procedi tranquillo", che e' esattamente la bugia che farebbe aprire posizioni da sole su un
conto reale. Un dubbio deve far scegliere l'utente, non il programma.
"""
import os
import sys
import types

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))


def _conto(**campi):
    """Un account_info() finto: i campi che MT5 dà sempre, più quelli che passiamo noi."""
    base = dict(login=12345678, server="Broker-Server", balance=10000.0, equity=10000.0,
                currency="EUR", leverage=100, margin=0.0, margin_free=10000.0,
                margin_level=0.0, profit=0.0, credit=0.0)
    base.update(campi)
    return types.SimpleNamespace(**base)


def _bridge(info):
    sys.modules["MetaTrader5"] = types.SimpleNamespace(
        initialize=lambda *a, **k: False, shutdown=lambda: None,
        terminal_info=lambda: None, account_info=lambda: info, last_error=lambda: (0, ""),
        ORDER_TYPE_BUY=0, ORDER_TYPE_SELL=1, POSITION_TYPE_BUY=0, POSITION_TYPE_SELL=1)
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    if "bridge" in sys.modules:
        del sys.modules["bridge"]
    import bridge
    bridge.mt5 = sys.modules["MetaTrader5"]
    bridge.mt5_connected = True      # /account rifiuta se non si è connessi
    return bridge


def test_conto_reale_lo_dice_il_campo_di_mt5():
    # trade_mode 2 = ACCOUNT_TRADE_MODE_REAL
    bridge = _bridge(_conto(trade_mode=2, server="Broker-NonDiceLive"))
    r = bridge.account()
    assert r["trade_mode"] == 2, "il numero grezzo di MT5 deve arrivare all'app così com'è"
    assert r["reale"] is True, (
        "un conto con trade_mode 2 è REALE, qualunque cosa dica il nome del server: " + repr(r["reale"]))


def test_conto_demo_non_viene_scambiato_per_reale():
    # trade_mode 0 = ACCOUNT_TRADE_MODE_DEMO, e il server si chiama "Live" per dispetto
    bridge = _bridge(_conto(trade_mode=0, server="Broker-Live"))
    r = bridge.account()
    assert r["trade_mode"] == 0
    assert r["reale"] is False, (
        "un demo non deve diventare reale solo perché il server si chiama «Live»: " + repr(r["reale"]))


def test_conto_a_concorso_non_e_reale():
    # trade_mode 1 = ACCOUNT_TRADE_MODE_CONTEST: non ci sono soldi veri da perdere
    bridge = _bridge(_conto(trade_mode=1))
    assert bridge.account()["reale"] is False


def test_se_mt5_non_lo_dice_la_risposta_e_non_lo_so_e_non_un_falso():
    """LA PROVA CHE CONTA: niente campo -> None, mai False.

    False significherebbe «è un demo»: l'app, applicando la regola «i conti demo si comportano
    come prima», abiliterebbe da sola le aperture automatiche su un conto che potrebbe essere
    reale. Il "non lo so" deve restare un "non lo so" fino all'app."""
    info = _conto()
    assert not hasattr(info, "trade_mode"), "il banco deve davvero NON avere il campo"
    bridge = _bridge(info)
    r = bridge.account()
    assert r["trade_mode"] is None
    assert r["reale"] is None, (
        "senza il campo la risposta deve essere None (non lo so), non False (è un demo): "
        + repr(r["reale"]))


def test_i_campi_di_prima_non_sono_cambiati():
    """PROVA DI CONTROLLO: si sono AGGIUNTI due campi, non cambiati quelli che l'app già legge.
    Senza questa, una riscrittura della risposta passerebbe le prove qui sopra e romperebbe il
    pannello del conto (capitale, margine libero, leva) senza che nessuna prova se ne accorga."""
    bridge = _bridge(_conto(trade_mode=2))
    r = bridge.account()
    for campo, atteso in (("login", 12345678), ("server", "Broker-Server"), ("balance", 10000.0),
                          ("equity", 10000.0), ("currency", "EUR"), ("leverage", 100),
                          ("margin", 0.0), ("margin_free", 10000.0), ("margin_level", 0.0),
                          ("profit", 0.0), ("credit", 0.0)):
        assert campo in r, "manca il campo storico «" + campo + "»: l'app lo legge già"
        assert r[campo] == atteso, "il campo «" + campo + "» è cambiato di valore"
