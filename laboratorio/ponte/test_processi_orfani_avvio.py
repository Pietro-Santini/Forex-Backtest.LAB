"""CHIUDENDO E RIAPRENDO L'APP NON DEVONO RIMANERE PROCESSI IN PIU' — e se la porta resta
occupata, il ponte deve dire CHI la tiene invece di «non risponde».

SEGNALATO dal proprietatore (9 novembre 2026): «ho cliccato aggiorna e mi ha crashato
l'applicazione, poi l'ho chiusa e riaperta e mi crashava di continuo per una decina di secondi;
ci sono processi che gli danno fastidio a QUANTO pare e non capisco».

CAUSA MISURATA, in due tempi. PRIMO: con `tasklist` sul suo PC risultavano DUE Mt5FeedServer e
DUE SegnaliBridge in piedi - cioè questa pulizia ne chiudeva uno e lasciava l'altro, perché
l'elenco dei nomi era più corto di quello dell'installer. SECONDO (ed è il suo «mi crasha per una
decina di secondi»): `taskkill` torna appena ha CHIESTO la chiusura, non quando è avvenuta; il
ponte nuovo trovava la porta 8000 ancora in mano a quello vecchio, il bind falliva e si riprovava
ogni 2 secondi in silenzio. L'installer (installer.iss, UccidiTutti) faceva già le cose per bene:
manca solo che lo faccia anche il ponte quando riparte, non solo quando si installa.

Qui si misura il comportamento, non il testo: quanti e quali nomi vengono chiusi, che l'attesa
della porta libera esista davvero, che il colpevole venga detto (una volta, non a ogni giro).
"""
import os
import sys
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
    """Fa credere al ponte di essere l'eseguibile installato: senza, la pulizia esce subito
    ("in sviluppo non serve") e non si misura niente."""
    monkeypatch.setattr(bridge.sys, "frozen", True, raising=False)
    monkeypatch.setattr(bridge.os, "name", "nt")


# ---------------------------------------------------------------------------------------------
# L'ELENCO DEI NOMI: lo stesso dell'installer, o prima o poi resta un orfano di troppo.
# ---------------------------------------------------------------------------------------------
def test_la_pulizia_chiude_tutti_i_servizi_non_solo_due(monkeypatch):
    """MISURATO: due Mt5FeedServer e due SegnaliBridge rimasti in piedi. L'elenco era corto."""
    bridge = _bridge()
    _servizio_compilato(monkeypatch, bridge)
    chiusi = []
    monkeypatch.setattr(bridge.subprocess, "run",
                        lambda comando, **k: chiusi.append(comando[3]) or types.SimpleNamespace(returncode=0))
    monkeypatch.setattr(bridge, "_aspetta_porta_libera", lambda porta, **k: True)

    bridge._kill_stale_instances()

    assert "SegnaliBridge.exe" in chiusi, (
        "SegnaliBridge.exe restava in piedi: misurati DUE processi con quel nome sul PC del "
        "proprietario, ed è il servizio dei segnali (porta 8769). Elenco: " + str(chiusi))
    assert "ForexBacktestLAB.exe" in chiusi, "il ponte stesso deve chiudere la sua copia precedente"
    assert "Mt5FeedServer.exe" in chiusi, "e il servizio dati pure, come già faceva"
    assert len(chiusi) == 3, "nomi chiusi: " + str(chiusi)


def test_il_processo_in_uso_non_si_chiude_da_solo(monkeypatch):
    """PROVA DI CONTROLLO, ed è la regola che tiene in piedi tutto il resto: chiudere "tutti i
    ForexBacktestLAB.exe" senza escludere il proprio PID significherebbe uccidere il ponte che
    sta nascendo. Il filtro c'era prima e deve restare."""
    bridge = _bridge()
    _servizio_compilato(monkeypatch, bridge)
    comandi = []
    monkeypatch.setattr(bridge.subprocess, "run",
                        lambda comando, **k: comandi.append(comando) or types.SimpleNamespace(returncode=0))
    monkeypatch.setattr(bridge, "_aspetta_porta_libera", lambda porta, **k: True)
    monkeypatch.setattr(bridge.os, "getpid", lambda: 4242)

    bridge._kill_stale_instances()

    for c in comandi:
        assert "PID ne 4242" in c, "ogni chiusura deve escludere il proprio PID: " + str(c)


def test_l_elenco_dei_nomi_e_lo_stesso_dell_installer(monkeypatch):
    """Due strade che uccidono due elenchi diversi = un orfano di troppo, prima o poi.
    L'installer (installer.iss, procedura UccidiTutti) chiude i quattro nomi: qui si misura che
    quelli del ponte ci siano tutti, nello stesso insieme."""
    bridge = _bridge()
    _servizio_compilato(monkeypatch, bridge)
    nomi_ponte = []
    monkeypatch.setattr(bridge.subprocess, "run",
                        lambda comando, **k: nomi_ponte.append(comando[3]) or None)
    monkeypatch.setattr(bridge, "_aspetta_porta_libera", lambda porta, **k: True)
    bridge._kill_stale_instances()

    percorso = os.path.join(RADICE, "installer_build", "installer.iss")
    with open(percorso, "r", encoding="utf-8", errors="replace") as f:
        testo = f.read()
    corpo = testo[testo.index("procedure UccidiTutti"):]
    for exe in ("ForexBacktestLAB.exe", "Mt5FeedServer.exe", "SegnaliBridge.exe"):
        assert exe in nomi_ponte and exe in corpo, (
            "%s deve essere chiuso in tutte e due le strade (ponte e installer)" % exe)


def test_dopo_aver_chiuso_si_aspetta_che_la_porta_sia_liberata(monkeypatch):
    """taskkill torna quando ha CHIESTO, non quando è avvenuto: senza l'attesa vera il bind
    fallisce e si riprova ogni 2 secondi — il «mi crasha per una decina di secondi»."""
    bridge = _bridge()
    _servizio_compilato(monkeypatch, bridge)
    chiuse = []
    monkeypatch.setattr(bridge.subprocess, "run",
                        lambda comando, **k: chiuse.append(comando[3]) or None)
    attese = []
    monkeypatch.setattr(bridge, "_aspetta_porta_libera", lambda porta, **k: attese.append(porta) or True)

    bridge._kill_stale_instances()

    assert 8000 in attese, "la porta del ponte va aspettata: " + str(attese)
    assert 8001 in attese, "e quella del servizio dati pure: " + str(attese)
    assert len(chiuse) == 3, "i nomi chiusi (la pulizia non deve dipendere dalle attese): " + str(chiuse)


def test_l_attesa_della_porta_torna_true_se_si_libera(monkeypatch):
    bridge = _bridge()
    risposte = [True, True, False]        # occupata, occupata, libera
    monkeypatch.setattr(bridge, "_servizio_gia_vivo", lambda p: risposte.pop(0) if risposte else False)
    monkeypatch.setattr(bridge.time, "sleep", lambda s: None)
    assert bridge._aspetta_porta_libera(8000, secondi=1) is True


def test_l_attesa_della_porta_torna_false_se_resta_occupata(monkeypatch):
    """E non solleva, e non blocca l'avvio per sempre: se la porta non si libera il ponte
    prova comunque, e nel log dice chi la tiene."""
    bridge = _bridge()
    monkeypatch.setattr(bridge, "_servizio_gia_vivo", lambda p: True)
    monkeypatch.setattr(bridge.time, "sleep", lambda s: None)
    assert bridge._aspetta_porta_libera(8000, secondi=1) is False


# ---------------------------------------------------------------------------------------------
# IL COLPEVOLE: "la porta è occupata da PID X" invece di "non risponde".
# ---------------------------------------------------------------------------------------------
def test_chi_tiene_la_porta_legge_pid_e_nome(monkeypatch):
    """Misurato sul PC del proprietatore: le porte 8000/8001/8769 erano in mano a un processo
    che NON era uno dei nostri (PID 9916). Due cose diverse che a schermo sembrano uguali."""
    bridge = _bridge()
    _servizio_compilato(monkeypatch, bridge)
    netstat = ("  TCP  100.120.227.56:8000  0.0.0.0:0  LISTENING  9916\n"
               "  TCP  127.0.0.1:8001        0.0.0.0:0  LISTENING  17712\n")
    tasklist = '"Tailscale.exe","9916","Console","24","40.000 KB"\r\n'

    class _Finto:
        def __init__(self, out): self.stdout, self.returncode = out, 0

    def _run(comando, **k):
        primo = str(comando[0]).lower()
        if "netstat" in primo:
            return _Finto(netstat)
        return _Finto(tasklist)
    monkeypatch.setattr(bridge.subprocess, "run", _run)

    detto = bridge._chi_tiene_la_porta(8000)
    assert "9916" in detto, "il PID di chi tiene la porta deve essere detto: " + detto
    assert "Tailscale" in detto, "e il suo nome, perche' è quello che l'utente deve chiudere: " + detto


def test_chi_tiene_la_porta_non_dice_nulla_se_la_porta_e_libera(monkeypatch):
    bridge = _bridge()
    _servizio_compilato(monkeypatch, bridge)
    monkeypatch.setattr(bridge.subprocess, "run",
                        lambda comando, **k: types.SimpleNamespace(returncode=0, stdout=""))
    assert bridge._chi_tiene_la_porta(8000) == ""


def test_chi_tiene_la_porta_non_solleva_se_netstat_non_ce(monkeypatch):
    """Il diagnosta non deve mai far cadere il ponte: è Windows, e su Linux non esiste."""
    bridge = _bridge()
    monkeypatch.setattr(bridge.os, "name", "posix")
    def _esplode(*a, **k): raise FileNotFoundError("netstat")
    monkeypatch.setattr(bridge.subprocess, "run", _esplode)
    assert bridge._chi_tiene_la_porta(8000) == ""


def test_la_porta_occupata_si_dice_una_volta_sola(monkeypatch):
    """Misurato: riprovando ogni 2 secondi in silenzio, il log si riempiva dello stesso errore
    e la cosa utile (chi tiene la porta) non si vedeva. La notizia si dice una volta: dopo,
    cento righe identiche non aggiungono niente."""
    bridge = _bridge()
    _servizio_compilato(monkeypatch, bridge)
    dette = []
    monkeypatch.setattr(bridge, "_log_bridge", lambda t: dette.append(t))
    monkeypatch.setattr(bridge, "_chi_tiene_la_porta", lambda porta: "PID 9916 - Tailscale.exe")
    monkeypatch.setattr(bridge, "_porta_occupata_detta", False)

    for _ in range(5):
        bridge._dici_porta_occupata(8000)

    assert len(dette) == 1, "la notizia si dice una volta sola: " + str(dette)
    assert "9916" in dette[0], "e dice chi è il colpevole: " + dette[0]
    assert "8000" in dette[0], "e quale porta: " + dette[0]


def test_detto_una_volta_riparte_al_giro_dopo_se_la_porta_si_libera(monkeypatch):
    """PROVA DI CONTROLLO: se la porta si libera e poi si rioccupa, la notizia deve potersi
    ripetere - resta una notizia, non un interruttore."""
    bridge = _bridge()
    _servizio_compilato(monkeypatch, bridge)
    dette = []
    monkeypatch.setattr(bridge, "_log_bridge", lambda t: dette.append(t))
    monkeypatch.setattr(bridge, "_chi_tiene_la_porta", lambda porta: "")
    monkeypatch.setattr(bridge, "_porta_occupata_detta", False)

    bridge._dici_porta_occupata(8000)
    bridge._dici_porta_occupata(8000)          # ancora occupata: tace
    bridge._porta_occupata_detta = False       # si è liberata e poi rioccupata
    bridge._dici_porta_occupata(8000)

    assert len(dette) == 2, "se la porta si libera e si rioccupa, si dice di nuovo: " + str(dette)
