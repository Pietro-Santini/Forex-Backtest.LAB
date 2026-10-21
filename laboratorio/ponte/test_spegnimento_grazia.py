# -*- coding: utf-8 -*-
"""UN AGGIORNAMENTO NON DEVE STACCARE MT5.

SEGNALATO dal proprietario, due volte - e la prima volta avevo dichiarato il problema risolto
quando non lo era: «ogni minimo aggiornamento io devo sempre riavviare l'applicazione e il
pacchetto di installazione per poter continuare a inviare ordini, ricevere segnali eccetera.
Questo non puo' succedere, perche' se effettuo un aggiornamento e non sono a casa non posso
avviare il pacchetto sul PC».

LA CAUSA NON ERANO I TEST (quelli erano stati chiusi prima: il banco non apre piu' socket ne'
richieste verso il ponte vivo). Era l'app stessa: all'uscita manda un beacon a /disconnect, e
/disconnect spegneva MT5, il terminale, il processo dei dati e il ponte stesso. Ma l'evento del
browser che fa partire quel beacon ('pagehide') scatta ANCHE per una semplice ricarica: aggiornare
la pagina era indistinguibile dal chiuderla. In app.html c'era perfino scritto che era un «limite
onesto, non aggirabile lato browser».

Dal browser, infatti, non si distingue. Ma la decisione non va presa li': va presa nel ponte, che
puo' aspettare e vedere se qualcuno torna. Questi test tengono ferme le quattro cose che servono
perche' la cura non diventi un'altra malattia.
"""
import os
import sys
import types

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))


def _bridge(monkeypatch):
    """bridge.py senza MetaTrader5 ne' pywinauto, e senza che possa spegnere niente per davvero."""
    if "MetaTrader5" not in sys.modules:
        sys.modules["MetaTrader5"] = types.SimpleNamespace(
            initialize=lambda *a, **k: False, shutdown=lambda: None,
            terminal_info=lambda: None, account_info=lambda: None, last_error=lambda: (0, ""))
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    import bridge
    # Niente os._exit nei test: sarebbe la fine del processo di pytest, non un fallimento.
    spenti = []
    monkeypatch.setattr(bridge, "_spegni_tutto_adesso", lambda: spenti.append(True))
    bridge._annulla_spegnimento()
    return bridge, spenti


def test_la_grazia_programma_invece_di_spegnere(monkeypatch):
    """Il beacon della pagina che se ne va NON spegne: avvia un conto alla rovescia."""
    bridge, spenti = _bridge(monkeypatch)
    try:
        bridge._programma_spegnimento(5)
        assert bridge.spegnimento_in_attesa() is True, "il conto alla rovescia deve essere avviato"
        assert spenti == [], "e niente deve essere spento adesso"
    finally:
        bridge._annulla_spegnimento()


def test_chi_torna_annulla_lo_spegnimento(monkeypatch):
    """E' il cuore della correzione: una ricarica torna in due secondi, e il collegamento resta."""
    bridge, spenti = _bridge(monkeypatch)
    try:
        bridge._programma_spegnimento(60)
        assert bridge._annulla_spegnimento() is True, "l'annullamento deve riuscire"
        assert bridge.spegnimento_in_attesa() is False
        assert spenti == [], "nessuno spegnimento deve essere avvenuto"
    finally:
        bridge._annulla_spegnimento()


def test_il_conto_alla_rovescia_scade_davvero(monkeypatch):
    """L'altra meta' che conta: se la pagina e' stata chiusa per davvero, il ponte si spegne.
    Senza questo, la correzione avrebbe lasciato processi accesi per sempre - cioe' il motivo per
    cui lo spegnimento era stato chiesto in origine."""
    import time
    bridge, spenti = _bridge(monkeypatch)
    try:
        bridge._programma_spegnimento(0.15)
        time.sleep(0.6)
        assert spenti == [True], "scaduta la grazia senza che nessuno torni, si spegne"
    finally:
        bridge._annulla_spegnimento()


def test_annullare_quando_non_ce_niente_non_fa_danni(monkeypatch):
    """Ogni richiesta al ponte passa da qui: deve essere gratis e silenzioso quando non c'e'
    nessun conto alla rovescia in corso, cioe' il 99,9% delle volte."""
    bridge, spenti = _bridge(monkeypatch)
    assert bridge._annulla_spegnimento() is False
    assert bridge.spegnimento_in_attesa() is False
    assert spenti == []


def test_la_richiesta_di_spegnimento_non_annulla_se_stessa():
    """Il filtro del middleware: /disconnect e' l'unica rotta che NON deve annullare il conto alla
    rovescia, altrimenti il beacon spegnerebbe il timer che ha appena chiesto."""
    sorgente = open(os.path.join(RADICE, "installer_build", "build", "bridge.py"),
                    encoding="utf-8").read()
    assert 'endswith("/disconnect")' in sorgente, \
        "il middleware deve escludere /disconnect dall'annullamento"
    assert "_annulla_spegnimento()" in sorgente


def test_i_pulsanti_espliciti_spengono_subito():
    """Chi preme «Esci» o «Disconnetti» ha dichiarato l'intenzione: li' la grazia non si applica,
    e il parametro serve proprio a distinguere i due casi. Compatibile nelle due direzioni: un'app
    vecchia (senza parametro) con un ponte nuovo si spegne subito come prima; un'app nuova con un
    ponte vecchio pure, perche' il parametro viene ignorato."""
    sorgente = open(os.path.join(RADICE, "installer_build", "build", "bridge.py"),
                    encoding="utf-8").read()
    assert 'request.query_params.get("grazia")' in sorgente, \
        "la grazia si chiede con un parametro, non e' il comportamento predefinito"
    app = open(os.path.join(RADICE, "app.html"), encoding="utf-8").read()
    assert "/disconnect?grazia=1" in app, \
        "il beacon di 'pagehide' deve chiedere la grazia: e' quello che scatta alla ricarica"
    i = app.index("window.disconnectMt5Bridge")
    assert "?grazia=1" not in app[i - 400:i], \
        "il pulsante esplicito non deve chiedere la grazia"
