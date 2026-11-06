# -*- coding: utf-8 -*-
"""IL LOG HA UN TETTO, E LA CHIAVE NON FINISCE SU DISCO.

MISURATO sul computer del proprietario (6 novembre 2026): ForexBacktestLAB.log era a **91 MB** e
1.023.510 righe, aperto in append e mai ruotato. Contando che cosa c'era dentro:
    /positions ~295.000, /orders ~286.000, /account ~279.000, /health ~29.000,
    /account_history ~17.000
cioe' l'88% era il NOSTRO polling riuscito (l'app interroga MT5 tre volte al secondo). Il disturbo
esterno su /v1/models era l'1%: avevo dato la colpa a quello a occhio, e la misura mi ha smentito.

E in circa 250.000 righe compariva "?chiave=..." in chiaro: la chiave condivisa del ponte, scritta
su disco centinaia di migliaia di volte.

LE PROVE QUI SOTTO misurano il comportamento del filtro, non come e' scritto. La piu' importante
e' la terza: un ERRORE sulla stessa rotta deve restare. Un filtro che butta via tutto sarebbe
"silenzioso" e passerebbe le prime due prove, ma al primo guasto non ci sarebbe piu' niente da
leggere - e un log che non aiuta a diagnosticare non serve a nulla.
"""
import os
import sys
import types

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))


def _bridge():
    sys.modules["MetaTrader5"] = types.SimpleNamespace(
        initialize=lambda *a, **k: False, shutdown=lambda: None,
        terminal_info=lambda: None, account_info=lambda: None, last_error=lambda: (0, ""),
        ORDER_TYPE_BUY=0, ORDER_TYPE_SELL=1, POSITION_TYPE_BUY=0, POSITION_TYPE_SELL=1)
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    if "bridge" in sys.modules:
        del sys.modules["bridge"]
    import bridge
    return bridge


def _log(tmp_path, nome="ForexBacktestLAB.log"):
    bridge = _bridge()
    percorso = str(tmp_path / nome)
    return bridge, bridge._LogConTetto(percorso), percorso


def _contenuto(percorso):
    with open(percorso, encoding="utf-8") as f:
        return f.read()


def test_la_chiave_non_finisce_nel_file(tmp_path):
    bridge, log, percorso = _log(tmp_path)
    # Una riga che si TIENE (404, non e' polling riuscito) e che porta la chiave.
    log.write('127.0.0.1:1 - "GET /qualcosa?chiave=SEGRETISSIMA123 HTTP/1.1" 404 Not Found\n')
    log.flush()
    testo = _contenuto(percorso)
    assert "SEGRETISSIMA123" not in testo, (
        "la chiave condivisa del ponte non deve mai essere scritta su disco: " + testo)
    assert "chiave=***" in testo, "la riga va tenuta, con la chiave mascherata: " + testo


def test_il_polling_riuscito_non_si_scrive(tmp_path):
    bridge, log, percorso = _log(tmp_path)
    for rotta in ("/positions", "/orders", "/account", "/account_history", "/health", "/news"):
        log.write('127.0.0.1:1 - "GET %s HTTP/1.1" 200 OK\n' % rotta)
    log.write('127.0.0.1:1 - "GET /positions?chiave=ABC HTTP/1.1" 200 OK\n')
    log.flush()
    assert _contenuto(percorso) == "", (
        "le chiamate riuscite del polling sono l'88% del file e non dicono niente a nessuno: "
        + repr(_contenuto(percorso)))


def test_UN_ERRORE_SULLA_STESSA_ROTTA_RESTA(tmp_path):
    """LA PROVA CHE CONTA. Senza di lei un filtro che butta tutto passerebbe le altre due, e al
    primo guasto il log sarebbe vuoto proprio quando serve."""
    bridge, log, percorso = _log(tmp_path)
    log.write('127.0.0.1:1 - "GET /positions HTTP/1.1" 500 Internal Server Error\n')
    log.write('127.0.0.1:1 - "GET /account HTTP/1.1" 401 Unauthorized\n')
    log.write('127.0.0.1:1 - "GET /orders HTTP/1.1" 200 OK\n')      # questa sola si butta
    log.flush()
    testo = _contenuto(percorso)
    assert "500" in testo and "401" in testo, (
        "gli errori sulle rotte del polling sono esattamente cio' che si cerca quando qualcosa "
        "si rompe: devono restare. Trovato: " + repr(testo))
    assert '"GET /orders HTTP/1.1" 200' not in testo, "il 200 su /orders va comunque buttato"


def test_i_messaggi_nostri_e_le_eccezioni_restano(tmp_path):
    bridge, log, percorso = _log(tmp_path)
    log.write("[Ponte] La pagina e' andata via: spengo fra 90 secondi.\n")
    log.write("Traceback (most recent call last):\n")
    log.flush()
    testo = _contenuto(percorso)
    assert "[Ponte]" in testo, "i messaggi del ponte sono la parte utile del log"
    assert "Traceback" in testo, "una traccia di eccezione non si butta mai"


def test_una_riga_scritta_a_pezzi_viene_decisa_intera(tmp_path):
    """uvicorn scrive il messaggio e il terminatore in due chiamate separate. Decidere su un
    pezzo vorrebbe dire scartare mezza riga e rendere il file illeggibile."""
    bridge, log, percorso = _log(tmp_path)
    log.write('127.0.0.1:1 - "GET /positions HTTP/1.1" 200 OK')   # ancora senza "\n"
    log.flush()
    assert _contenuto(percorso) == "", "finche' la riga non e' finita non si decide niente"
    log.write("\n")
    log.flush()
    assert _contenuto(percorso) == "", "a riga finita si riconosce il polling riuscito e si butta"


def test_oltre_il_tetto_il_file_ruota_e_tiene_una_copia(tmp_path, monkeypatch):
    bridge = _bridge()
    monkeypatch.setattr(bridge, "_LOG_MAX_BYTE", 2000)
    percorso = str(tmp_path / "ForexBacktestLAB.log")
    log = bridge._LogConTetto(percorso)
    for i in range(200):
        log.write("[Ponte] riga di prova numero %d, abbastanza lunga da arrivare al tetto\n" % i)
    log.flush()
    assert os.path.exists(percorso + ".1"), (
        "superato il tetto deve esistere la copia precedente: senza, la storia si perde del tutto")
    assert os.path.getsize(percorso) < 2000 * 3, (
        "dopo la rotazione il file corrente deve essere piccolo, non 91 MB: "
        + str(os.path.getsize(percorso)))
    # E la storia non si perde: la copia contiene le righe di prima.
    with open(percorso + ".1", encoding="utf-8") as f:
        assert "[Ponte] riga di prova" in f.read()


def test_non_solleva_nemmeno_se_il_file_sparisce(tmp_path):
    """PROVA DI CONTROLLO: un log che fa crashare il servizio e' peggio di nessun log."""
    bridge, log, percorso = _log(tmp_path)
    log._fh.close()                      # si simula il peggio: il file non e' piu' scrivibile
    log.write("[Ponte] qualcosa\n")      # non deve sollevare
    log.flush()
