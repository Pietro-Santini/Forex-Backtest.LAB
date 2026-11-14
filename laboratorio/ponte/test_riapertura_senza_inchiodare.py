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
    assert "secondi_di_attesa=60" in sorgente, (
        "il margine d'attesa predefinito deve restare largo: la pulizia del ponte puo' "
        "prendersi 20 secondi. (Dal 13 novembre l'attesa e' un parametro, non piu' un 60 "
        "scritto dentro il ciclo: chi chiama dal thread della finestra ne passa una corta.)")


# ---------------------------------------------------------------------------------------------
# 6. NESSUNA ATTESA LUNGA SUL THREAD DELLA FINESTRA
#
# SEGNALATO dal proprietario (13 novembre 2026): «dopo che finisce l'aggiornamento, quando la va
# a riaprire non risponde l'applicazione e continua a dare il solito crash di sempre».
#
# MISURATO nel registro eventi di Windows, sul suo PC: non e' un crash, e' un BLOCCO. Quattro
# eventi AppHangB1 su ForexBacktestLABDesktop.exe in due minuti - 13:35:08, 13:36:33, 13:36:49,
# 13:37:07 - «il programma non interagisce piu' con Windows ed e' stato chiuso». Nessuna
# eccezione e nessuna memoria esaurita: il thread della finestra smette di pompare i messaggi.
#
# La causa: _ensure_backend puo' dormire fino a 60 secondi di fila, e veniva chiamata anche dal
# pulsante «Duplica finestra» e dal pulsante «Riprova», che girano sul thread della finestra.
# ---------------------------------------------------------------------------------------------
def _corpo_di(sorgente, nome):
    """Il corpo di una funzione, dalla sua riga def fino alla prossima def allo stesso livello."""
    pezzo = sorgente.split(nome)[1]
    a_capo = chr(10)
    for taglio in (a_capo + "    def ", a_capo + "def "):
        if taglio in pezzo:
            pezzo = pezzo.split(taglio, 1)[0]
    return pezzo


def test_il_pulsante_duplica_finestra_non_puo_congelare_l_app():
    percorso = os.path.join(RADICE, "desktop", "desktop_shell.py")
    with open(percorso, encoding="utf-8") as f:
        sorgente = f.read()
    corpo = _corpo_di(sorgente, "def nuova_finestra(")
    assert "_ensure_backend(" in corpo, "deve comunque provare a tirare su il ponte"
    assert "_ensure_backend()" not in corpo, (
        "qui si e' sul thread della finestra: con l'attesa predefinita (60 s) premere Duplica "
        "mentre il ponte non risponde congela TUTTA l'applicazione, e Windows la dichiara "
        "«non risponde» - e' l'AppHangB1 misurato sul PC del proprietario")


def test_il_pulsante_riprova_non_puo_congelare_l_app():
    percorso = os.path.join(RADICE, "desktop", "desktop_shell.py")
    with open(percorso, encoding="utf-8") as f:
        sorgente = f.read()
    corpo = _corpo_di(sorgente, "def riprova(")
    assert "_ensure_backend()" not in corpo, (
        "anche Riprova gira sul thread della finestra: attesa corta, e il resto in sottofondo")
    assert "_attendi_ponte_poi(" in corpo, (
        "se il ponte non c'e' ancora lo si continua ad aspettare altrove, altrimenti premere "
        "Riprova una volta sola basterebbe a perdere l'avvio")


def test_la_finestra_si_apre_PRIMA_di_aspettare_il_ponte():
    percorso = os.path.join(RADICE, "desktop", "desktop_shell.py")
    with open(percorso, encoding="utf-8") as f:
        sorgente = f.read()
    corpo = _corpo_di(sorgente, "def main(")
    assert "_ensure_backend(0)" in corpo, (
        "all'avvio si prova UNA volta senza aspettare: se il ponte e' gia' vivo si apre dritti "
        "sull'app, come prima")
    # L'ATTESA DEL PONTE SI E' SPOSTATA, E LA PROVA CON LEI (14 novembre 2026).
    #
    # Fino a ieri _attendi_ponte_poi partiva dritto dentro main(), e questa riga lo cercava li'.
    # Dal 14 novembre parte dalla funzione che pywebview esegue QUANDO LA FINESTRA E' PRONTA,
    # perche' il thread chiama finestra.load_url() e, se arriva mentre la finestra si sta ancora
    # costruendo, i due si aspettano a vicenda: misurato sul PC del proprietario, finestra nera
    # e CPU a zero per oltre 70 secondi (vedi pacchetto_app_desktop.test.mjs, che misura
    # l'ORDINE invece del testo).
    #
    # La cosa da garantire non cambia: la finestra si apre comunque per prima, e il ponte si
    # aspetta altrove - mai con l'attesa lunga sul thread della finestra, che e' cio' che
    # Windows scambia per «non risponde».
    tutto = sorgente
    assert "_attendi_ponte_poi(" in tutto, (
        "se il ponte non risponde la finestra si apre lo stesso, aspettando il servizio in un "
        "thread: una finestra che risponde e dice «sto avviando» non e' un crash, una che non "
        "pompa i messaggi per venti secondi lo diventa agli occhi di Windows")
    pronta = _corpo_di(tutto, "def _quando_la_finestra_e_pronta(")
    assert "_attendi_ponte_poi(" in pronta, (
        "l'attesa del ponte deve partire da dentro _quando_la_finestra_e_pronta: li' pywebview "
        "ha gia' creato la finestra, e load_url non si incastra")
    assert "_sorveglia_memoria(" in pronta, (
        "anche il guardiano della memoria chiama load_url: stessa regola")
    assert "_pagina_attesa(" in corpo, "e in quell'attesa si deve vedere qualcosa, non un vuoto"


def test_l_attesa_in_sottofondo_non_blocca_chi_la_chiama():
    """La funzione deve tornare SUBITO: e' tutto il punto. Qui si misura il comportamento, non
    il sorgente: si chiama con un'attesa finta che dura, e si guarda l'orologio."""
    percorso = os.path.join(RADICE, "desktop", "desktop_shell.py")
    with open(percorso, encoding="utf-8") as f:
        sorgente = f.read()
    spazio = {"time": time, "threading": __import__("threading")}
    # Si estrae la sola funzione e le si da' un _ensure_backend finto che dorme.
    pezzo = "def _attendi_ponte_poi(" + sorgente.split("def _attendi_ponte_poi(", 1)[1]
    pezzo = pezzo.split(chr(10) + "# Quello che si vede", 1)[0]
    spazio["_ensure_backend"] = lambda secondi=60: (time.sleep(0.6) or "http://finto")
    exec(pezzo, spazio)
    risultati = []
    inizio = time.time()
    t = spazio["_attendi_ponte_poi"](lambda url: risultati.append(url), 1)
    subito = time.time() - inizio
    assert subito < 0.2, (
        "chi chiama non deve restare fermo ad aspettare: ha aspettato %.2f s" % subito)
    t.join(timeout=3)
    assert risultati == ["http://finto"], (
        "e quando il ponte risponde si deve essere richiamati: %r" % (risultati,))


# ---------------------------------------------------------------------------------------------
# 7. UNA SOLA ISTANZA, E UN OCCHIO SULLA MEMORIA
#
# MISURATO sul PC del proprietario il 13 novembre 2026, con lui che guardava:
#   - l'istanza che lavorava in diretta cresceva di 90 MB al secondo con un core al 100%, fino a
#     15,8 GB: restavano 0,6 GB liberi su 16 e si bloccava TUTTO IL COMPUTER. Chiudendola la
#     memoria tornava subito a 10,6 GB.
#   - la crescita continua anche a finestra MINIMIZZATA (+347 MB in 10 s): non e' il disegno.
#   - aprendo l'app una seconda volta partiva un SECONDO programma intero (altra finestra, altro
#     motore web, sette processi in piu').
#
# La causa della crescita NON e' ancora trovata. Queste due prove non la misurano: misurano il
# paracadute, cioe' che il programma si accorga di star mangiando la memoria e che non si possa
# aprire due volte.
# ---------------------------------------------------------------------------------------------
def test_il_guscio_si_apre_una_volta_sola():
    percorso = os.path.join(RADICE, "desktop", "desktop_shell.py")
    with open(percorso, encoding="utf-8") as f:
        sorgente = f.read()
    corpo = _corpo_di(sorgente, "def main(")
    assert "_gia_in_esecuzione()" in corpo, (
        "main deve controllare se l'applicazione e' gia' aperta PRIMA di crearne un'altra: due "
        "istanze sono due programmi interi, e il proprietario lo vedeva come «pesa tantissimo»")
    assert "_porta_davanti_quella_aperta()" in corpo, (
        "e invece di non fare niente deve portare davanti la finestra che c'e' gia'")
    assert "CreateMutexW" in sorgente, (
        "il controllo va fatto con un nome di sistema, non cercando i processi: in modalita' "
        "onefile l'eseguibile compare DUE volte nell'elenco, e quell'inganno ha gia' confuso la "
        "pulizia anti-orfano del ponte")


def test_il_guardiano_della_memoria_c_e_e_ricarica_invece_di_chiudere():
    percorso = os.path.join(RADICE, "desktop", "desktop_shell.py")
    with open(percorso, encoding="utf-8") as f:
        sorgente = f.read()
    assert "SOGLIA_RICARICA_MB" in sorgente, "serve una soglia dichiarata, non un numero sparso"
    # Qui NON si usa _corpo_di: quella si ferma alla prima funzione annidata, e il guardiano
    # vero (_guarda) e' proprio annidato dentro. Si prende fino alla prossima funzione di primo
    # livello.
    pezzo = sorgente.split("def _sorveglia_memoria(")[1]
    corpo = pezzo.split(chr(10) + "def ", 1)[0]
    assert "load_url" in corpo, (
        "oltre la soglia si RICARICA la pagina: lo stato e' salvato e torna da solo")
    for vietato in ("Stop-Process", "kill(", "os._exit", "sys.exit"):
        assert vietato not in corpo, (
            "il guardiano non chiude niente da solo (%s): al massimo ricarica, come fa gia' "
            "l'aggiornamento" % vietato)
    assert "daemon=True" in corpo, "e gira in un thread a parte, non sul thread della finestra"


def test_la_soglia_e_larga_ma_non_fatale():
    """La soglia deve stare fra «quanto serve per lavorare» e «quanto serve per uccidere il PC».
    Misurato: da fermo con la sessione carica sta sotto i 200 MB; a 15.800 MB il computer si
    blocca. Una soglia troppo bassa ricaricherebbe la pagina mentre si lavora."""
    percorso = os.path.join(RADICE, "desktop", "desktop_shell.py")
    with open(percorso, encoding="utf-8") as f:
        sorgente = f.read()
    import re
    m = re.search(r"SOGLIA_RICARICA_MB\s*=\s*(\d+)", sorgente)
    assert m, "la soglia deve essere un numero leggibile"
    soglia = int(m.group(1))
    assert 1000 <= soglia <= 4000, (
        "soglia %d MB: fuori dall'intervallo sensato. Sotto i 1000 si ricaricherebbe mentre si "
        "lavora, sopra i 4000 si arriva comunque a mettere in ginocchio un PC da 8 GB" % soglia)


def test_la_misura_della_memoria_non_dipende_da_librerie_esterne():
    """Nel pacchetto non c'e' psutil: se il guardiano lo importasse, non partirebbe affatto - e
    un guardiano che non parte e' peggio di nessun guardiano, perche' si crede di averlo."""
    percorso = os.path.join(RADICE, "desktop", "desktop_shell.py")
    with open(percorso, encoding="utf-8") as f:
        sorgente = f.read()
    corpo = _corpo_di(sorgente, "def _memoria_mia_mb(")
    assert "psutil" not in corpo, "niente psutil: non e' nel pacchetto"
    assert "GetProcessMemoryInfo" in corpo, "si chiede a Windows, con ctypes"
    assert "except Exception" in corpo, "e se non si riesce a misurare si risponde 0, non si cade"

def test_nessuno_chiama_la_finestra_da_un_gestore_di_evento():
    """LA FINESTRA NON SI TOCCA DA UN GESTORE DI EVENTO DELLA PAGINA (14 novembre 2026).

    MISURATO sul PC del proprietario: la finestra si bloccava SEMPRE nell'istante in cui la
    pagina finiva di caricare - all'avvio e anche su una semplice ricarica, che con l'avvio non
    c'entra nulla. In quel momento: CPU a ZERO per minuti, 0 KB letti e 0 scritti su disco in 8
    secondi, memoria immobile, e tutti e dieci i thread in attesa, con quello che aveva lavorato
    fermo su UserRequest. Non e' lentezza, e' un blocco incrociato.

    LA CAUSA: `finestra.events.loaded += lambda: finestra.evaluate_js(...)`, usata per scrivere
    il logo nella pagina. La chiamata aspetta il thread della finestra, che sta ancora
    completando il caricamento. E non serviva nemmeno: app.html dichiara gia' il proprio logo.

    La regola e' secca e non ha eccezioni: niente evaluate_js, e nessun gestore sugli eventi
    della pagina. Quello che deve stare in una NOSTRA pagina si scrive nel suo HTML; quello che
    deve partire dopo l'apertura si mette nella funzione passata a webview.start().
    """
    # Si legge il CODICE, non il testo: i commenti qui sopra e nel sorgente nominano
    # evaluate_js apposta, per raccontare il difetto, e non devono far scattare la guardia.
    # Con l'albero sintattico la distinzione e' esatta invece che approssimata.
    import ast

    percorso = os.path.join(RADICE, "desktop", "desktop_shell.py")
    with open(percorso, encoding="utf-8") as f:
        albero = ast.parse(f.read())
    vietati = {"evaluate_js", "loaded", "shown"}
    colpevoli = []
    for nodo in ast.walk(albero):
        if isinstance(nodo, ast.Attribute) and nodo.attr in vietati:
            # "events.loaded" e "events.shown" contano solo se sono proprio gli eventi
            # della finestra: un attributo "loaded" qualunque non c'entra.
            if nodo.attr in ("loaded", "shown"):
                base = nodo.value
                if not (isinstance(base, ast.Attribute) and base.attr == "events"):
                    continue
            colpevoli.append((nodo.lineno, nodo.attr))
    assert not colpevoli, (
        "queste righe chiamano la finestra da un gestore di evento o le iniettano codice: e' il "
        "blocco del 14 novembre 2026 (finestra nera, CPU a zero, tutti i thread in attesa). %s"
        % colpevoli)
