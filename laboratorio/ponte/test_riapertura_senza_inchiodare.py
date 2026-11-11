# =============================================================================================
# LA RIAPERTURA NON INCHIODA PIU' - banco della cura dell'11 novembre 2026 (v2.2.30).
#
# SEGNALATO dal proprietario: «quando chiudo l'applicazione poi la vado a riaprire subito dopo, la
# pagina mi da' sempre forex backtest lab non risponde, e si inchioda. Non si riesce a sbloccare».
#
# MISURATO PRIMA DELLA CURA, registrando i processi ogni 2 secondi durante una chiusura/riapertura
# vera, piu' il log dell'eseguibile installato:
#   - "servizio dati MT5 avviato" compariva DUE volte con due PID diversi (24280 e poi 6836);
#   - _kill_stale_instances costava 20.107 ms e veniva chiamata DUE volte prima di uvicorn.run:
#     fino a 40 secondi in cui la porta 8000 era muta, mentre la finestra se ne concede 30;
#   - ForexBacktestLAB.exe restava senza il suo avviatore onefile, e le cartelle temporanee
#     _MEI* erano 367 per 17,8 GB su un disco con 39 GB liberi.
#
# Le prove misurano il COMPORTAMENTO delle funzioni: nessun processo vero viene chiuso, nessuna
# porta vera viene occupata.
# =============================================================================================
import os
import sys
import time
import types

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))


def _bridge():
    if "MetaTrader5" not in sys.modules:
        sys.modules["MetaTrader5"] = types.SimpleNamespace(
            initialize=lambda *a, **k: False, shutdown=lambda: None,
            terminal_info=lambda: None, account_info=lambda: None, last_error=lambda: (0, ""))
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    import bridge
    return bridge


def _servizio_compilato(monkeypatch, bridge):
    monkeypatch.setattr(bridge.sys, "frozen", True, raising=False)
    monkeypatch.setattr(bridge.os, "name", "nt")


class _Finto:
    def __init__(self, out=""):
        self.stdout, self.returncode = out, 0


# ---------------------------------------------------------------------------------------------
# 1. IL SECONDO GIRO NON UCCIDE I FIGLI CHE ABBIAMO APPENA CREATO
# ---------------------------------------------------------------------------------------------
def test_il_giro_mirato_chiude_solo_i_processi_della_fotografia(monkeypatch):
    """IL DIFETTO MISURATO: il secondo _kill_stale_instances(), fatto DOPO aver avviato i servizi,
    li chiudeva per NOME - compresi i propri, appena nati - e poi il custode li faceva rinascere.
    Nel log si leggeva due volte "servizio dati MT5 avviato", con due PID diversi.
    Adesso quel giro riceve la fotografia dei PID vivi PRIMA della nascita dei nostri e chiude
    solo quelli: un figlio nostro non puo' finirci dentro."""
    bridge = _bridge()
    _servizio_compilato(monkeypatch, bridge)
    comandi = []

    def _run(comando, **k):
        comandi.append(list(comando))
        return _Finto()
    monkeypatch.setattr(bridge.subprocess, "run", _run)

    orfano_vecchio = 11111       # c'era gia' prima di noi
    figlio_appena_nato = 22222   # lo abbiamo avviato noi: non va toccato
    bridge._kill_stale_instances(solo_pid={orfano_vecchio}, aspetta_porte=False)

    uccisi = [c[c.index("/PID") + 1] for c in comandi if "/PID" in c]
    assert str(orfano_vecchio) in uccisi, (
        "l'orfano della sessione precedente deve essere chiuso: chiusi %r" % uccisi)
    assert str(figlio_appena_nato) not in uccisi, (
        "un servizio avviato da noi non va chiuso: chiusi %r" % uccisi)
    assert not [c for c in comandi if "/IM" in c], (
        "il giro mirato non deve chiudere per NOME, o riprende i propri figli: %r" % comandi)


# ---------------------------------------------------------------------------------------------
# 2. IL PROPRIO AVVIATORE NON SI UCCIDE (e' quello che lasciava 17,8 GB sul disco)
# ---------------------------------------------------------------------------------------------
def test_la_pulizia_per_nome_risparmia_il_proprio_avviatore(monkeypatch):
    """In modalita' onefile il processo che scompatta i file si chiama ESATTAMENTE come questo e
    ha un PID diverso: il filtro "PID ne <mio>" non lo proteggeva. Ucciderlo lascia la cartella
    temporanea sul disco per sempre, perche' e' lui a cancellarla all'uscita."""
    bridge = _bridge()
    _servizio_compilato(monkeypatch, bridge)
    comandi = []

    def _run(comando, **k):
        comandi.append(list(comando))
        return _Finto()
    monkeypatch.setattr(bridge.subprocess, "run", _run)
    monkeypatch.setattr(bridge.os, "getpid", lambda: 4242)
    monkeypatch.setattr(bridge.os, "getppid", lambda: 777)

    bridge._kill_stale_instances(aspetta_porte=False)

    per_nome = [c for c in comandi if "/IM" in c]
    assert per_nome, "la pulizia per nome deve comunque avvenire"
    for c in per_nome:
        filtri = " ".join(c)
        assert "PID ne 4242" in filtri, "deve risparmiare se stesso: %r" % c
        assert "PID ne 777" in filtri, (
            "deve risparmiare anche il proprio avviatore, o la cartella temporanea resta sul "
            "disco per sempre: %r" % c)


# ---------------------------------------------------------------------------------------------
# 3. IL SECONDO GIRO NON RIASPETTA LE PORTE (erano 20 secondi in piu' prima di uvicorn)
# ---------------------------------------------------------------------------------------------
def test_il_giro_mirato_non_riaspetta_le_porte(monkeypatch):
    """MISURATO: ogni _kill_stale_instances aspetta che 8000 e 8001 si liberino, fino a 10 secondi
    ciascuna. Chiamata due volte faceva fino a 40 secondi prima che il ponte cominciasse ad
    ascoltare, mentre la finestra si arrende dopo 30. Il secondo giro non ha nulla da aspettare:
    le porte le ha gia' liberate il primo."""
    bridge = _bridge()
    _servizio_compilato(monkeypatch, bridge)
    monkeypatch.setattr(bridge.subprocess, "run", lambda c, **k: _Finto())
    attese = []
    monkeypatch.setattr(bridge, "_aspetta_porta_libera", lambda p, **k: attese.append(p))

    bridge._kill_stale_instances(solo_pid=set(), aspetta_porte=False)
    assert attese == [], "il giro mirato non deve aspettare nessuna porta: ha atteso %r" % attese

    bridge._kill_stale_instances(aspetta_porte=True)
    assert attese == [8000, 8001], (
        "il primo giro invece deve ancora aspettare le due porte: %r" % attese)


# ---------------------------------------------------------------------------------------------
# 4. LA PULIZIA DEL DISCO: via le vecchie, mai quella in uso
# ---------------------------------------------------------------------------------------------
def test_la_spazzata_toglie_le_vecchie_e_risparmia_la_propria(tmp_path, monkeypatch):
    """MISURATE sul PC del proprietario 367 cartelle per 17,8 GB. Qui si misura che la spazzata
    porti via quelle vecchie, non tocchi la cartella di QUESTO processo e lasci stare quelle
    toccate da poco, che potrebbero essere di un programma ancora vivo."""
    bridge = _bridge()
    monkeypatch.setattr(bridge.os, "name", "nt")
    vecchia = tmp_path / "_MEI_vecchia"
    vecchia.mkdir()
    (vecchia / "roba.bin").write_bytes(b"x" * 2048)
    recente = tmp_path / "_MEI_recente"
    recente.mkdir()
    mia = tmp_path / "_MEI_mia"
    mia.mkdir()
    estranea = tmp_path / "cartella_di_qualcun_altro"
    estranea.mkdir()

    vecchio = time.time() - 7200          # due ore fa
    os.utime(str(vecchia), (vecchio, vecchio))
    os.utime(str(mia), (vecchio, vecchio))   # vecchia MA e' la nostra: non si tocca

    monkeypatch.setattr(bridge.sys, "_MEIPASS", str(mia), raising=False)
    import tempfile
    monkeypatch.setattr(tempfile, "gettempdir", lambda: str(tmp_path))

    quante, byte = bridge._spazza_cartelle_temporanee()

    assert not vecchia.exists(), "la cartella vecchia doveva essere portata via"
    assert mia.exists(), "la cartella di QUESTO processo non si tocca mai"
    assert recente.exists(), "una cartella toccata da poco puo' essere di un programma vivo"
    assert estranea.exists(), "si toccano solo le _MEI*, non altro che sta nel temporaneo"
    assert quante == 1, "doveva contarne una sola: %r" % quante
    assert byte >= 2048, "deve dire anche quanto spazio ha liberato: %r" % byte


# ---------------------------------------------------------------------------------------------
# 5. LA FINESTRA CHIEDE SE IL PONTE RISPONDE, NON SE LA PORTA E' APERTA
# ---------------------------------------------------------------------------------------------
def test_il_guscio_non_si_accontenta_della_porta_aperta():
    """MISURATO: alla riapertura il guscio trovava la 8000 aperta dal ponte PRECEDENTE, che stava
    morendo. La porta era aperta, il servizio no: la finestra si attaccava a un ponte che spariva
    un istante dopo, e nessuno riprovava. Adesso chiede /health."""
    percorso = os.path.join(RADICE, "desktop", "desktop_shell.py")
    with open(percorso, encoding="utf-8") as f:
        sorgente = f.read()
    assert "def _ponte_risponde(" in sorgente, "manca la verifica vera del ponte"
    assert "/health" in sorgente, "la verifica deve interrogare /health, non la sola porta"
    dentro = sorgente.split("def _ensure_backend(")[1].split("\ndef ", 1)[0]
    assert "_ponte_risponde(" in dentro, (
        "_ensure_backend deve usare la verifica vera, non _is_port_open")
    assert "_is_port_open(PORTA_LOCALE)" not in dentro, (
        "_ensure_backend non deve piu' accontentarsi della porta aperta")
    assert "range(60)" in dentro, (
        "il margine d'attesa deve essere largo: la pulizia del ponte puo' prendersi 20 secondi")
