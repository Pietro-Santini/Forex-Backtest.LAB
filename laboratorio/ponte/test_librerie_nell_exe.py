# -*- coding: utf-8 -*-
"""LE LIBRERIE DICHIARATE A PyInstaller DEVONO ESISTERE DAVVERO.

TROVATO sul PC del proprietario il 14 novembre 2026, aprendo l'applicazione appena installata e
leggendo il log del ponte:

    [Dati] token rifiutato: le librerie google-auth non sono disponibili in questo eseguibile:
    nessun token potra' mai essere accettato (e altri 13 rifiuti uguali nel frattempo)

LA CAUSA, in una riga di build_exe.bat: c'era scritto `--collect-all google-auth`. Su PyPI il
pacchetto si chiama google-auth, ma il MODULO da importare e' google.auth. PyInstaller non trovava
nulla, scriveva un avviso ("skipping data collection for module 'google-auth' as it is not a
package") e continuava: l'eseguibile usciva SENZA la libreria, e nessuno se ne accorgeva.

MISURATO con PyInstaller stesso:
    collect_all('google-auth')    -> 0 dati, 0 binari, 0 import nascosti
    collect_all('google.auth')    -> 61 dati, 60 import nascosti
    collect_all('google.oauth2')  -> 19 dati, 18 import nascosti

QUANTO COSTAVA: nell'eseguibile la verifica del token non poteva MAI riuscire, quindi ogni
richiesta al canale dei dati veniva rifiutata - 3.468 "connection rejected (403 Forbidden)" in un
log, 780 nel successivo, e /dati/session e /dati/collegamento sempre 401. Cioe' il salvataggio dei
documenti sul disco E non ha mai potuto funzionare, pur essendo attivo e configurato.

LA REGOLA CHE QUESTE PROVE DIFENDONO: un nome di modulo Python non puo' contenere un trattino (non
e' un identificatore valido). Quindi un trattino dentro --collect-all, --hidden-import o
--collect-submodules e' sbagliato PER COSTRUZIONE, sempre, senza bisogno di provare a importarlo.
E' un controllo che non puo' dare falsi allarmi e che copre tutta la classe di errore, non solo
quello visto.
"""
import re
from pathlib import Path

from _percorsi import RADICE

COSTRUTTORE = Path(RADICE) / "installer_build" / "build_exe.bat"
# Le opzioni di PyInstaller che vogliono un nome di MODULO (non di pacchetto PyPI).
OPZIONI_DI_MODULO = ("--collect-all", "--hidden-import", "--collect-submodules",
                     "--collect-data", "--collect-binaries")


def _nomi_dichiarati():
    """Ogni (opzione, nome) passato a PyInstaller dentro build_exe.bat."""
    testo = COSTRUTTORE.read_text(encoding="utf-8", errors="replace")
    trovati = []
    for riga in testo.splitlines():
        pulita = riga.strip()
        if pulita.upper().startswith("REM"):      # i commenti citano i nomi sbagliati di proposito
            continue
        for opzione in OPZIONI_DI_MODULO:
            for m in re.finditer(re.escape(opzione) + r'\s+"?([A-Za-z0-9_.\-]+)"?', pulita):
                trovati.append((opzione, m.group(1)))
    return trovati


def test_il_costruttore_esiste():
    assert COSTRUTTORE.is_file(), "build_exe.bat non trovato: %s" % COSTRUTTORE


def test_nessun_trattino_in_un_nome_di_modulo():
    sbagliati = [(o, n) for o, n in _nomi_dichiarati() if "-" in n]
    assert not sbagliati, (
        "questi nomi hanno un trattino, quindi non sono moduli Python e PyInstaller li ignora "
        "in silenzio (e' il difetto del 14 novembre 2026, costato 3.468 rifiuti di token e il "
        "salvataggio dei dati sul disco E): %s" % sbagliati)


def test_google_auth_e_dichiarato_col_nome_giusto():
    nomi = [n for _, n in _nomi_dichiarati()]
    for atteso in ("google.auth", "google.oauth2"):
        assert atteso in nomi, (
            "%s deve essere raccolto: senza, nell'eseguibile la verifica del token non puo' mai "
            "riuscire e tutto il canale /dati risponde 401. Dichiarati: %s" % (atteso, nomi))


def test_gli_import_dentro_un_try_sono_dichiarati_a_mano():
    """documenti_utente.py importa google dentro un try/except: PyInstaller non segue quel ramo,
    quindi i due moduli precisi vanno nominati, non solo il pacchetto."""
    nomi = [n for _, n in _nomi_dichiarati()]
    for atteso in ("google.oauth2.id_token", "google.auth.transport.requests"):
        assert atteso in nomi, (
            "%s e' importato dentro un try in documenti_utente.py: va dichiarato con "
            "--hidden-import, altrimenti puo' restare fuori. Dichiarati: %s" % (atteso, nomi))


def test_chi_verifica_il_token_importa_ancora_quei_moduli():
    """Il legame fra le due cose: se domani il codice cambiasse libreria, queste prove
    difenderebbero un nome che non serve piu'. Si controlla che il sorgente lo usi davvero."""
    sorgente = (Path(RADICE) / "installer_build" / "build" / "documenti_utente.py").read_text(
        encoding="utf-8", errors="replace")
    assert "from google.oauth2 import id_token" in sorgente, (
        "documenti_utente.py non importa piu' google.oauth2: se e' cambiata la libreria, "
        "aggiornare anche build_exe.bat e queste prove")
    assert "from google.auth.transport import requests" in sorgente


def test_se_PyInstaller_c_e_si_misura_davvero_cosa_raccoglie():
    """La prova piu' forte, quando sul computer c'e' PyInstaller: si chiede a lui se quei nomi
    raccolgono qualcosa. Dove non c'e' (un PC senza l'ambiente di build) la prova si salta: le
    altre, che leggono solo il testo, bastano a fermare il difetto."""
    try:
        from PyInstaller.utils.hooks import collect_all
    except Exception:
        import pytest
        pytest.skip("PyInstaller non installato qui: bastano le prove sul testo")
    for nome in ("google.auth", "google.oauth2"):
        dati, _binari, nascosti = collect_all(nome)
        assert len(dati) + len(nascosti) > 0, (
            "collect_all(%r) non raccoglie niente: il nome e' sbagliato o la libreria non e' "
            "installata" % nome)
    dati, _b, nascosti = collect_all("google-auth")
    assert len(dati) + len(nascosti) == 0, (
        "collect_all('google-auth') ha raccolto qualcosa: se PyInstaller ha imparato a tradurre "
        "i nomi dei pacchetti PyPI, questa prova va riscritta - ma il nome del modulo resta "
        "quello giusto da usare")

def test_nessun_commento_REM_dentro_un_comando_continuato():
    """UN REM FRA DUE RIGHE UNITE DA ^ NON E' UN COMMENTO: E' UN ARGOMENTO.

    MISURATO il 14 novembre 2026, flusso Installer Windows rosso. Avevo spiegato la correzione
    di google.auth con un blocco di commento messo in mezzo alle opzioni di PyInstaller. Ma le
    righe del comando sono unite dal carattere ^ , e cmd.exe le legge come UNA riga sola: il
    commento e' finito dentro il comando.

        pyinstaller: error: unrecognized arguments: IL NOME DEL MODULO, NON QUELLO DEL PACCHETTO
        '--collect-all' is not recognized as an internal or external command

    La compilazione si e' fermata e il pacchetto non e' uscito. Il controllo e' meccanico: si
    scorre il file e, finche' una riga finisce con ^ , la successiva fa parte dello stesso
    comando e non puo' cominciare per REM.
    """
    righe = COSTRUTTORE.read_text(encoding="utf-8", errors="replace").splitlines()
    dentro_un_comando = False
    colpevoli = []
    for numero, riga in enumerate(righe, 1):
        if dentro_un_comando and riga.strip().upper().startswith("REM"):
            colpevoli.append((numero, riga.strip()[:70]))
        dentro_un_comando = riga.rstrip().endswith("^")
    assert not colpevoli, (
        "queste righe REM stanno DENTRO un comando continuato con ^ , quindi cmd.exe le passa "
        "come argomenti e la compilazione si ferma. I commenti vanno sopra il comando: %s"
        % colpevoli)

# ---------------------------------------------------------------------------------------------
# DICHIARARE IL MODULO NON BASTA: DEVONO ESSERCI ANCHE LE SUE DIPENDENZE
# ---------------------------------------------------------------------------------------------
REQUISITI = Path(RADICE) / "installer_build" / "build" / "requirements.txt"


def _pacchetti_richiesti():
    """I nomi dei pacchetti elencati in requirements.txt, senza commenti ne' versioni."""
    nomi = set()
    for riga in REQUISITI.read_text(encoding="utf-8", errors="replace").splitlines():
        r = riga.strip()
        if not r or r.startswith("#"):
            continue
        nomi.add(re.split(r"[<>=!~\[ ]", r)[0].strip().lower())
    return nomi


def test_requests_e_nei_requisiti():
    """SECONDA CAUSA DELLO STESSO SINTOMO (14 novembre 2026).

    Corretto il nome del modulo in build_exe.bat (era `--collect-all google-auth` invece di
    `google.auth`), l'eseguibile della 2.2.51 continuava a dire "le librerie google-auth non
    sono disponibili". MISURATO nel log di compilazione di GitHub:

        WARNING: Failed to collect submodules for 'google.auth.compute_engine' because
        importing it raised: ModuleNotFoundError: No module named 'requests'

    documenti_utente.py fa `from google.auth.transport import requests`, e quel modulo e'
    costruito SOPRA la libreria requests - che non e' mai stata nei requisiti. L'import falliva
    dentro il try esattamente come prima: stesso sintomo, causa diversa.

    Conseguenza, la stessa di prima: ogni richiesta al canale /dati torna 401 e il salvataggio
    dei documenti sul disco E non parte.
    """
    assert "requests" in _pacchetti_richiesti(), (
        "google.auth.transport.requests ha bisogno della libreria requests: senza, la verifica "
        "del token non puo' mai riuscire e il disco E resta vuoto")


def test_ogni_modulo_dichiarato_ha_il_suo_pacchetto():
    """La regola generale: dichiarare un modulo a PyInstaller non lo fa esistere.

    Per ogni `--collect-all`/`--hidden-import` nominato in build_exe.bat, il pacchetto che lo
    fornisce deve comparire in requirements.txt. Senza, la raccolta fallisce in silenzio (un
    WARNING nel log di compilazione) e il difetto si scopre mesi dopo, in produzione.
    """
    # Da quale pacchetto arriva ogni modulo che dichiariamo. Si tiene a mano perche' e' corto e
    # perche' va letto: e' la mappa fra "cosa importa il codice" e "cosa si installa".
    DA_QUALE_PACCHETTO = {
        "google.auth": "google-auth",
        "google.oauth2": "google-auth",
        "google.oauth2.id_token": "google-auth",
        "google.auth.transport.requests": "requests",   # <- il caso del 14 novembre
        "MetaTrader5": "metatrader5",
        "numpy": "numpy",
        "uvicorn": "uvicorn",
        "pywinauto": "pywinauto",
    }
    presenti = _pacchetti_richiesti()
    mancanti = []
    for _opzione, modulo in _nomi_dichiarati():
        pacchetto = DA_QUALE_PACCHETTO.get(modulo)
        if pacchetto and pacchetto.lower() not in presenti:
            mancanti.append((modulo, pacchetto))
    assert not mancanti, (
        "questi moduli sono dichiarati a PyInstaller ma il pacchetto che li fornisce non e' nei "
        "requisiti: la raccolta fallisce in silenzio. %s" % mancanti)
