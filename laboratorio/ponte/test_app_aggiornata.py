# -*- coding: utf-8 -*-
"""L'APP SI AGGIORNA ANCHE QUANDO LA APRI DALL'ICONA.

SEGNALATO dal proprietario piu' volte: «ogni aggiornamento non arriva», «dice che aggiorna e poi
la versione non cambia», «devo reinstallare il pacchetto per avere le novita'». E si vedeva anche
di riflesso, che e' il modo peggiore: mi ha segnalato come difetti TRE cose gia' corrette e
pubblicate (la conferma unica delle chiusure a blocco, il riquadro di caricamento che resta fino a
fine sincronizzazione, il riquadro anche nella finestra PIP). Lui descriveva fedelmente la versione
che aveva in mano.

LA CAUSA NON ERA IL MECCANISMO WEB, che e' fatto bene: updateViaCache:'none' sul service worker,
controllo ogni mezz'ora, ricarica automatica se l'utente ha premuto Aggiorna. Era il ponte: aperta
dall'icona, la pagina non viene dal sito - la serve bridge.py, e la serviva da `sys._MEIPASS`,
cioe' la cartella temporanea dove PyInstaller estrae i file CONGELATI DENTRO L'ESEGUIBILE al
momento della compilazione. Quella copia e', per costruzione, immutabile: nessun aggiornamento web
puo' toccarla.

Ora il ponte scarica app.html e sw.js dal sito in una cartella scrivibile e serve quella copia.
QUESTI TEST TENGONO FERME LE TRE REGOLE che rendono l'aggiornatore piu' utile che dannoso, perche'
un aggiornatore che sbaglia e' peggio di nessun aggiornatore:
  1. LA COPPIA O NIENTE: app.html e sw.js si sostituiscono insieme. sw.js porta il numero che il
     pannello Versione legge: un app.html nuovo con un sw.js vecchio terrebbe il pulsante
     «Aggiorna» accesso per sempre - lo stesso difetto segnalato, da un'altra porta.
  2. MAI INDIETRO: una copia piu' vecchia (una cache di un proxy) non deve retrocedere l'app.
  3. SI CONTROLLA CHE SIA UN'APP: su certi hosting una pagina "404" arriva con HTTP 200.
"""
import os
import sys
import types

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))

HTML_FINTO = "<html>" + ("x" * 600 * 1024) + "</html>"


def _bridge():
    if "MetaTrader5" not in sys.modules:
        sys.modules["MetaTrader5"] = types.SimpleNamespace(
            initialize=lambda *a, **k: False, shutdown=lambda: None,
            terminal_info=lambda: None, account_info=lambda: None, last_error=lambda: (0, ""))
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    import bridge
    return bridge


def _scrivi_coppia(cartella, versione, html=HTML_FINTO):
    os.makedirs(cartella, exist_ok=True)
    with open(os.path.join(cartella, "app.html"), "w", encoding="utf-8") as f:
        f.write(html)
    with open(os.path.join(cartella, "sw.js"), "w", encoding="utf-8") as f:
        f.write('const CACHE_NAME = "forex-backtest-lab-v%s";' % versione)


def test_la_versione_si_legge_da_sw_js():
    bridge = _bridge()
    assert bridge._versione_da_sw('const CACHE_NAME = "forex-backtest-lab-v2.0.14";') == (2, 0, 14)
    assert bridge._versione_da_sw("niente di utile") is None


def test_una_copia_incompleta_o_finta_non_vale(tmp_path, monkeypatch):
    """Regola 3. Su certi hosting una pagina di errore arriva con HTTP 200: un app.html da 200
    byte non e' l'app, e servirlo darebbe una schermata bianca invece di un aggiornamento."""
    bridge = _bridge()
    c = str(tmp_path / "agg")
    os.makedirs(c, exist_ok=True)
    assert bridge._coppia_valida(c) is False, "cartella vuota: non vale"
    with open(os.path.join(c, "app.html"), "w", encoding="utf-8") as f:
        f.write("<html>404 not found</html>")
    assert bridge._coppia_valida(c) is False, "troppo piccolo: non e' l'app"
    _scrivi_coppia(c, "2.0.14")
    assert bridge._coppia_valida(c) is True
    os.remove(os.path.join(c, "sw.js"))
    assert bridge._coppia_valida(c) is False, "senza sw.js la coppia non e' completa"


def test_si_serve_la_copia_aggiornata_quando_e_valida(tmp_path, monkeypatch):
    bridge = _bridge()
    installata = str(tmp_path / "exe")
    aggiornata = str(tmp_path / "agg")
    _scrivi_coppia(installata, "2.0.12")
    _scrivi_coppia(aggiornata, "2.0.14")
    monkeypatch.setattr(bridge, "_BASE_DIR", installata)
    monkeypatch.setattr(bridge, "_CARTELLA_APP", aggiornata)
    assert bridge.percorso_app("app.html").startswith(aggiornata), \
        "con una copia piu' recente valida, si serve quella"
    assert bridge.percorso_app("sw.js").startswith(aggiornata), \
        "e sw.js deve venire dalla STESSA parte (regola 1)"


def test_mai_indietro(tmp_path, monkeypatch):
    """Regola 2. Se dal sito arriva una versione piu' vecchia di quella installata - una cache di
    un proxy, un rollback - si tiene quella installata. Retrocedere l'app di chi la sta usando
    sarebbe un danno fatto dall'aggiornatore stesso."""
    bridge = _bridge()
    installata = str(tmp_path / "exe")
    aggiornata = str(tmp_path / "agg")
    _scrivi_coppia(installata, "2.0.14")
    _scrivi_coppia(aggiornata, "2.0.9")
    monkeypatch.setattr(bridge, "_BASE_DIR", installata)
    monkeypatch.setattr(bridge, "_CARTELLA_APP", aggiornata)
    assert bridge.percorso_app("app.html").startswith(installata), \
        "la 2.0.9 non deve sostituire la 2.0.14"


def test_senza_copia_aggiornata_si_serve_quella_installata(tmp_path, monkeypatch):
    """Il caso di tutti i giorni il primo avvio, e il caso senza rete: l'app deve partire."""
    bridge = _bridge()
    installata = str(tmp_path / "exe")
    _scrivi_coppia(installata, "2.0.14")
    monkeypatch.setattr(bridge, "_BASE_DIR", installata)
    monkeypatch.setattr(bridge, "_CARTELLA_APP", None)
    assert bridge.percorso_app("app.html") == os.path.join(installata, "app.html")


def test_un_download_a_metà_non_sostituisce_niente(tmp_path, monkeypatch):
    """Regola 1, nel modo in cui conta davvero: se sw.js non arriva, app.html NON deve essere
    sostituito da solo. Altrimenti si resta con un'app nuova che dichiara una versione vecchia, e
    il pulsante «Aggiorna» non si spegne piu' - il difetto segnalato, da un'altra porta."""
    bridge = _bridge()
    installata = str(tmp_path / "exe")
    aggiornata = str(tmp_path / "agg")
    _scrivi_coppia(installata, "2.0.12")
    _scrivi_coppia(aggiornata, "2.0.13")   # una coppia buona, gia' presente
    monkeypatch.setattr(bridge, "_BASE_DIR", installata)
    monkeypatch.setattr(bridge, "_CARTELLA_APP", aggiornata)

    class Risposta:
        status = 200
        def __init__(self, dati): self._d = dati
        def read(self): return self._d
        def __enter__(self): return self
        def __exit__(self, *a): return False

    def finto_urlopen(req, timeout=None):
        url = req.full_url if hasattr(req, "full_url") else str(req)
        if url.endswith("app.html"):
            return Risposta(("<html>" + "y" * 600 * 1024 + "</html>").encode())
        raise OSError("rete caduta a metà")

    monkeypatch.setattr(bridge.urllib.request, "urlopen", finto_urlopen)
    ok, msg = bridge.scarica_app_aggiornata(timeout=1)
    assert ok is False, "un download incompleto non deve dichiarare successo: " + msg
    assert bridge._versione_di(aggiornata) == (2, 0, 13), \
        "la coppia buona che c'era prima deve restare intatta"


def test_una_pagina_di_errore_con_http_200_viene_rifiutata(tmp_path, monkeypatch):
    """Regola 3 sul download: GitHub Pages serve la propria 404 con HTTP 200."""
    bridge = _bridge()
    installata = str(tmp_path / "exe")
    aggiornata = str(tmp_path / "agg")
    _scrivi_coppia(installata, "2.0.12")
    os.makedirs(aggiornata, exist_ok=True)
    monkeypatch.setattr(bridge, "_BASE_DIR", installata)
    monkeypatch.setattr(bridge, "_CARTELLA_APP", aggiornata)

    class Risposta:
        status = 200
        def __init__(self, dati): self._d = dati
        def read(self): return self._d
        def __enter__(self): return self
        def __exit__(self, *a): return False

    monkeypatch.setattr(bridge.urllib.request, "urlopen",
                        lambda req, timeout=None: Risposta(b"<html>404</html>"))
    ok, msg = bridge.scarica_app_aggiornata(timeout=1)
    assert ok is False, "una pagina di errore non e' un aggiornamento: " + msg
    assert bridge._coppia_valida(aggiornata) is False


def test_health_dice_quale_app_sta_servendo(tmp_path, monkeypatch):
    """Il difetto piu' lungo di questo progetto e' stato un utente che usava una versione vecchia
    senza saperlo. Da ora /health lo dice, e si puo' leggere senza indovinare dallo schermo."""
    bridge = _bridge()
    installata = str(tmp_path / "exe")
    _scrivi_coppia(installata, "2.0.14")
    monkeypatch.setattr(bridge, "_BASE_DIR", installata)
    monkeypatch.setattr(bridge, "_CARTELLA_APP", None)
    v = bridge.versione_servita()
    assert v["versione"] == "2.0.14"
    assert v["da"] == "copia installata"
