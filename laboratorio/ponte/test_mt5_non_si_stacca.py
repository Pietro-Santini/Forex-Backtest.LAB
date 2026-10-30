# -*- coding: utf-8 -*-
"""CON MT5 COLLEGATO, LA PAGINA CHE SE NE VA NON DEVE SPEGNERE NIENTE.

SEGNALATO dal proprietario (28 ottobre 2026), ed era la terza volta sullo stesso punto: «quando
avviene una nuova release mi interrompe il collegamento con MT5. I segnali mi arrivano pero' non
riesce ad aprire le operazioni. E se mi vado a ricollegare mi dice che i pacchetti non esistono.
Il programma non puo' avere intoppi, non puo' interrompere le operazioni, le chiusure, gli
spostamenti, le aperture automatiche: non puo' interrompere nulla».

COSA ERA STATO FATTO PRIMA, e non bastava: la GRAZIA (90 secondi di attesa prima di spegnere, vedi
test_spegnimento_grazia.py). Risolve la RICARICA - chi ricarica torna in due secondi e annulla il
conto alla rovescia. Ma NON risolve il caso vero del proprietario: se la pagina in quel momento
non e' aperta, nessuno torna, e allo scadere il ponte spegne MT5, chiude il terminale e si uccide.
Da fuori si vede esattamente quello che ha descritto: i segnali continuano ad arrivare (li porta
un altro processo) e gli ordini non partono piu' (il ponte non c'e' piu').

LA REGOLA NUOVA, e ha la precedenza sulla grazia: se il ponte e' COLLEGATO A MT5, un evento di
"pagina andata via" non programma proprio niente. Non una grazia piu' lunga: nessuno spegnimento.
Un ponte attaccato a un conto vero non e' un processo dimenticato - e' il processo che sta
lavorando.

E LA VIA D'USCITA RESTA DICHIARATA: i pulsanti «Esci» e «Disconnetti» non chiedono la grazia, e
spengono tutto subito anche con MT5 collegato. Il motivo per cui lo spegnimento automatico era
stato chiesto - non lasciare processi accesi a sua insaputa - resta soddisfatto dal caso senza
MT5, dove non c'e' niente da perdere.
"""
import os
import sys
import types

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))


def _bridge(monkeypatch):
    if "MetaTrader5" not in sys.modules:
        sys.modules["MetaTrader5"] = types.SimpleNamespace(
            initialize=lambda *a, **k: False, shutdown=lambda: None,
            terminal_info=lambda: None, account_info=lambda: None, last_error=lambda: (0, ""))
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    import bridge
    spenti = []
    monkeypatch.setattr(bridge, "_spegni_tutto_adesso", lambda: spenti.append("grazia scaduta"))
    monkeypatch.setattr(bridge, "_try_close_mt5_terminal", lambda: spenti.append("terminale"))
    monkeypatch.setattr(bridge, "_stop_mt5_feed_server", lambda: spenti.append("dati"))
    # La richiesta arriva dal computer: non e' questo che si sta provando qui.
    monkeypatch.setattr(bridge._accesso, "richiesta_locale", lambda r: True)
    # os._exit ucciderebbe pytest: qui si registra soltanto che e' stato chiesto.
    monkeypatch.setattr(bridge.threading, "Timer",
                        lambda s, f: types.SimpleNamespace(start=lambda: spenti.append("processo"),
                                                           cancel=lambda: None, daemon=True))
    bridge._annulla_spegnimento()
    return bridge, spenti


def _finta_richiesta(grazia):
    """Una richiesta come quella del beacon, senza alzare un server."""
    return types.SimpleNamespace(query_params={"grazia": "1"} if grazia else {},
                                 url=types.SimpleNamespace(path="/disconnect"),
                                 client=types.SimpleNamespace(host="127.0.0.1"))


def test_con_mt5_collegato_la_pagina_che_se_ne_va_non_spegne_niente(monkeypatch):
    """IL CUORE. Pagina chiusa mentre un conto e' collegato: non si programma nulla."""
    bridge, spenti = _bridge(monkeypatch)
    try:
        monkeypatch.setattr(bridge, "mt5_connected", True)
        esito = bridge.disconnect(_finta_richiesta(grazia=True))
        assert bridge.spegnimento_in_attesa() is False,             "con MT5 collegato non si avvia NESSUN conto alla rovescia: ne' lungo ne' corto"
        assert spenti == [], "e non si spegne niente"
        assert bridge.mt5_connected is True, "il collegamento deve restare in piedi"
        assert esito.get("status") == "resta_acceso",             "e si deve poter dire all'utente che e' rimasto acceso, invece di tacere"
    finally:
        bridge._annulla_spegnimento()


def test_PROVA_DI_CONTROLLO_senza_mt5_la_grazia_funziona_come_prima(monkeypatch):
    """Senza questa prova, la correzione passerebbe anche spegnendo il meccanismo del tutto - e
    allora un ponte aperto per sbaglio resterebbe acceso per sempre, che e' il motivo per cui lo
    spegnimento automatico era stato chiesto all'inizio. Senza MT5 non c'e' niente da perdere."""
    bridge, spenti = _bridge(monkeypatch)
    try:
        monkeypatch.setattr(bridge, "mt5_connected", False)
        esito = bridge.disconnect(_finta_richiesta(grazia=True))
        assert bridge.spegnimento_in_attesa() is True,             "senza MT5 collegato il conto alla rovescia resta: non c'e' niente da difendere"
        assert esito.get("status") == "spegnimento_programmato"
    finally:
        bridge._annulla_spegnimento()


def test_PROVA_DI_CONTROLLO_il_pulsante_esci_spegne_anche_con_mt5_collegato(monkeypatch):
    """L'utente deve conservare una via d'uscita dichiarata. Senza questa prova, la correzione
    potrebbe rendere il ponte impossibile da spegnere mentre e' collegato."""
    bridge, spenti = _bridge(monkeypatch)
    try:
        monkeypatch.setattr(bridge, "mt5_connected", True)
        esito = bridge.disconnect(_finta_richiesta(grazia=False))
        assert esito.get("status") == "disconnected"
        assert bridge.mt5_connected is False, "chi lo dice esplicitamente lo spegne davvero"
        assert "terminale" in spenti, "si chiude il terminale MT5"
        assert "processo" not in spenti, "ma il processo bridge RESTA VIVO (riconnessione possibile)"
    finally:
        bridge._annulla_spegnimento()
