"""IL PROGRAMMA SI AGGIORNA DA SOLO — le regole che lo rendono piu' utile che pericoloso.

SEGNALATO dal proprietario: «quando premiamo aggiorna l'app carica la nuova impaginazione ma non
scarica ForexBacktestLAB.exe. Ogni volta devo andare su collegamento, spegnere il terminale MT5,
premere connetti e mettermi a scaricare i pacchetti a mano. Deve essere un sistema di
aggiornamento come in qualsiasi altra app del mondo».

QUI SI TIENE FERMO IL CONFINE. Un aggiornatore che sbaglia e' MOLTO peggio di nessun
aggiornatore: questo lancia un installer che sostituisce l'eseguibile sotto i piedi a un
programma che gestisce ordini veri. Le tre regole provate qui sotto sono quelle che impediscono
che diventi un modo nuovo di rompersi:

  1. MAI INDIETRO. Un pacchetto non piu' nuovo di quello installato non si tocca. Senza questa
     regola, una release ritirata o una cache di un proxy potrebbero RETROCEDERE il programma.
  2. SI CONTROLLA PRIMA DI LANCIARE. Un file troncato, o una pagina di errore arrivata con
     HTTP 200 e salvata col nome giusto, avviata come installer lascerebbe l'installazione a
     meta': rotta, e senza niente a cui tornare.
  3. SOLO DAL COMPUTER. Da remoto non si reinstalla l'applicazione di qualcun altro mentre la
     sta usando.
"""
import os
import sys
import types

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))


def _finge_windows(monkeypatch, bridge):
    """FINGE DI ESSERE WINDOWS, e serve a far girare questi test anche su Linux.

    `aggiorna_programma` comincia con «se non sei su Windows, esci»: giusto, perche' il pacchetto
    da installare e' un .exe. Ma vuol dire che su Ubuntu - cioe' sul collaudo di GitHub - ogni
    test riceveva "vale solo su Windows" invece del comportamento che voleva misurare.

    MISURATO IL 28 OTTOBRE 2026: il collaudo locale era verde (qui Windows c'e' davvero) e quello
    di GitHub rosso su quattro test. E' esattamente il motivo per cui la catena di pubblicazione
    dice di guardare TUTTI E DUE: le librerie e il sistema non sono gli stessi, e un test che
    gira solo dove lo scrivi non sorveglia niente per chiunque altro.

    La logica che conta (mai indietro, il file si controlla prima di lanciarlo) non ha niente di
    specifico di Windows: puo' e deve essere provata dappertutto. L'unica cosa davvero legata al
    sistema e' l'avvio dell'installer, e quello nei test e' sempre finto.
    """
    monkeypatch.setattr(bridge.os, "name", "nt")


def _bridge():
    if "MetaTrader5" not in sys.modules:
        sys.modules["MetaTrader5"] = types.SimpleNamespace(
            initialize=lambda *a, **k: False, shutdown=lambda: None,
            terminal_info=lambda: None, account_info=lambda: None, last_error=lambda: (0, ""))
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    import bridge
    return bridge


def test_le_versioni_si_confrontano_da_numeri_non_da_testo():
    """"2.0.9" e' piu' NUOVA di "2.0.37" se si confrontano come testo, e piu' vecchia se si
    confrontano come numeri. Confrontarle come testo farebbe retrocedere il programma proprio
    quando il numero di versione cresce — cioe' sempre, prima o poi."""
    bridge = _bridge()
    assert bridge._tupla("2.0.37") == (2, 0, 37)
    assert bridge._tupla("2.0.9") < bridge._tupla("2.0.37")
    assert "2.0.9" > "2.0.37"          # la prova che il confronto come testo sarebbe sbagliato
    assert bridge._tupla("niente") is None
    assert bridge._tupla(None) is None


def test_non_si_reinstalla_quando_il_programma_e_gia_aggiornato(monkeypatch):
    """REGOLA 1. Se l'eseguibile e' gia' alla versione della pagina, non si scarica niente:
    un aggiornamento che reinstalla ogni volta e' solo un modo lento di non cambiare nulla."""
    bridge = _bridge()
    _finge_windows(monkeypatch, bridge)
    monkeypatch.setattr(bridge, "versione_programma_installata", lambda: "2.0.37")
    monkeypatch.setattr(bridge, "_versione_di", lambda cartella: (2, 0, 37))

    def _mai(*a, **k):
        raise AssertionError("non deve scaricare niente: il programma e' gia' aggiornato")
    monkeypatch.setattr(bridge.urllib.request, "urlopen", _mai)

    ok, msg = bridge.aggiorna_programma()
    assert ok is True
    assert "gia'" in msg


def test_non_si_torna_a_una_versione_piu_vecchia(monkeypatch):
    """REGOLA 1, il caso che fa davvero danno: il programma installato e' PIU' NUOVO della
    pagina (release ritirata, copia di un proxy rimasta indietro). Reinstallare qui
    retrocederebbe un programma che gestisce ordini veri."""
    bridge = _bridge()
    _finge_windows(monkeypatch, bridge)
    monkeypatch.setattr(bridge, "versione_programma_installata", lambda: "2.0.40")
    monkeypatch.setattr(bridge, "_versione_di", lambda cartella: (2, 0, 37))

    def _mai(*a, **k):
        raise AssertionError("non deve scaricare: installato 2.0.40, pagina 2.0.37")
    monkeypatch.setattr(bridge.urllib.request, "urlopen", _mai)

    ok, msg = bridge.aggiorna_programma()
    assert ok is True


def _finta_risposta(contenuto):
    """La risposta finta legge A BLOCCHI, come fa il ponte dal 12 novembre 2026.

    Prima tornava tutto il contenuto a ogni `read()` senza argomenti. Il ponte adesso scarica
    con `read(1048576)` e scrive direttamente su file: il pacchetto pesa 123 MB e tenerlo tutto
    in memoria gonfiava il processo e bloccava la pagina per minuti - il proprietario lo vedeva
    come un crash premendo «Aggiorna». Se questa finta non legge a blocchi, le prove cadono su
    un errore di firma e non misurano piu' niente di quello che dicono di misurare.
    """
    class _R:
        def __init__(self_inner):
            self_inner._resto = contenuto

        def read(self_inner, quanti=None):
            if quanti is None:
                dato, self_inner._resto = self_inner._resto, b""
                return dato
            dato = self_inner._resto[:quanti]
            self_inner._resto = self_inner._resto[quanti:]
            return dato

        def __enter__(self_inner):
            return self_inner

        def __exit__(self_inner, *a):
            return False
    return lambda *a, **k: _R()


def test_un_file_troppo_piccolo_non_viene_lanciato(monkeypatch):
    """REGOLA 2. Su certi hosting una pagina di errore arriva con HTTP 200: salvata col nome
    giusto e avviata come installer, lascerebbe l'installazione a meta'."""
    bridge = _bridge()
    _finge_windows(monkeypatch, bridge)
    monkeypatch.setattr(bridge, "versione_programma_installata", lambda: "2.0.30")
    monkeypatch.setattr(bridge, "_versione_di", lambda cartella: (2, 0, 37))
    monkeypatch.setattr(bridge.urllib.request, "urlopen", _finta_risposta(b"MZ" + b"x" * 5000))

    def _mai(*a, **k):
        raise AssertionError("non deve avviare niente: il file e' troppo piccolo")
    monkeypatch.setattr(bridge.subprocess, "Popen", _mai)

    ok, msg = bridge.aggiorna_programma()
    assert ok is False
    assert "non e' il pacchetto" in msg


def test_un_file_che_non_e_un_programma_windows_non_viene_lanciato(monkeypatch):
    """REGOLA 2, seconda meta': la dimensione giusta non basta. Ogni eseguibile di Windows
    comincia con 'MZ': se non c'e', quel file non e' un installer, qualunque cosa pesi."""
    bridge = _bridge()
    _finge_windows(monkeypatch, bridge)
    monkeypatch.setattr(bridge, "versione_programma_installata", lambda: "2.0.30")
    monkeypatch.setattr(bridge, "_versione_di", lambda cartella: (2, 0, 37))
    monkeypatch.setattr(bridge.urllib.request, "urlopen",
                        _finta_risposta(b"<html>errore</html>" + b"x" * (25 * 1024 * 1024)))

    def _mai(*a, **k):
        raise AssertionError("non deve avviare niente: non e' un programma di Windows")
    monkeypatch.setattr(bridge.subprocess, "Popen", _mai)

    ok, msg = bridge.aggiorna_programma()
    assert ok is False
    assert "non e' un programma" in msg


def test_PROVA_DI_CONTROLLO_un_pacchetto_buono_viene_lanciato_in_silenzio(monkeypatch, tmp_path):
    """LA PROVA DI CONTROLLO delle due qui sopra: senza di essa passerebbero anche con una
    funzione che non lancia MAI niente. Qui il pacchetto e' valido e DEVE partire — e deve
    partire in SILENZIO, perche' un installer che si ferma su una finestra da confermare
    lascerebbe l'utente a guardare un'app che non torna piu'."""
    bridge = _bridge()
    _finge_windows(monkeypatch, bridge)
    monkeypatch.setattr(bridge, "versione_programma_installata", lambda: "2.0.30")
    monkeypatch.setattr(bridge, "_versione_di", lambda cartella: (2, 0, 37))
    monkeypatch.setattr(bridge.urllib.request, "urlopen",
                        _finta_risposta(b"MZ" + b"x" * (25 * 1024 * 1024)))
    monkeypatch.setattr(bridge.tempfile, "gettempdir", lambda: str(tmp_path))

    lanciati = {}

    def _finto_popen(comando, **k):
        lanciati["comando"] = comando
        lanciati["opzioni"] = k
        return types.SimpleNamespace(pid=1234)
    monkeypatch.setattr(bridge.subprocess, "Popen", _finto_popen)

    ok, msg = bridge.aggiorna_programma()
    assert ok is True, msg
    comando = lanciati.get("comando")
    assert comando, "il pacchetto valido deve essere avviato"
    assert comando[0].endswith(".exe")
    assert "/VERYSILENT" in comando, "senza questa, l'installazione apre finestre e si blocca"
    assert "/SUPPRESSMSGBOXES" in comando, "un avviso che aspetta un clic blocca tutto per sempre"
    assert "/NORESTART" in comando, "non si riavvia il computer di nessuno senza chiederlo"


def test_la_versione_del_programma_si_legge_dal_registro_non_si_inventa(monkeypatch):
    """Il numero su cui si decide se reinstallare deve venire da dove l'ha scritto l'installer.
    Fuori da Windows, o se il registro non si legge, la risposta e' None — «non lo so» — e non
    un numero inventato: su un numero inventato si prenderebbero decisioni vere."""
    bridge = _bridge()
    v = bridge.versione_programma_installata()
    assert v is None or isinstance(v, str)
    if v is not None:
        assert bridge._tupla(v) is not None, "se una versione c'e', dev'essere leggibile come numeri"


# ===================== IL CUSTODE SI SPEGNE PRIMA, O FA RINASCERE I SERVIZI =====================
#
# SEGNALATO DAL PROPRIETARIO (3 novembre 2026): «quando aggiorno, l'applicazione mi da' NON
# RISPONDE e crasha. Quando chiude l'applicazione, esegue l'aggiornamento, poi riapre, e c'e'
# qualche servizio che rimane ancora attivo dall'istanza precedente».
#
# CAUSA, scritta nero su bianco in bridge.py (~riga 519): «_ferma_custode_mt5_feed() PRIMA di
# spegnere il servizio, O IL CUSTODE LO RIACCENDE». Il custode e' il thread che fa rinascere
# Mt5FeedServer.exe appena la porta 8001 tace. L'installer uccideva prima i figli e solo ALLA
# FINE il ponte: in quella finestra il custode era ancora vivo e faceva rinascere il servizio
# dati, che sopravviveva al padre e restava orfano con la porta 8001 in mano. Dopo
# l'installazione il servizio NUOVO non riusciva piu' ad aprirla.
#
# Qui si prova la meta' che vive nel ponte: prima di lanciare l'installer, il custode e' gia'
# spento e i servizi sono gia' fermi. L'altra meta' (l'ordine dei taskkill) vive in
# installer.iss ed e' provata da test_ordine_chiusura_installer qui sotto.


def test_il_custode_si_spegne_prima_di_lanciare_l_installer(monkeypatch):
    """L'ORDINE E' LA CURA. Se l'installer parte col custode ancora vivo, il servizio dati puo'
    rinascere mentre si sta installando e restare orfano sulla porta 8001."""
    bridge = _bridge()
    _finge_windows(monkeypatch, bridge)
    monkeypatch.setattr(bridge, "versione_programma_installata", lambda: "2.0.1")
    monkeypatch.setattr(bridge, "_versione_di", lambda cartella: (2, 0, 99))
    monkeypatch.setattr(bridge.urllib.request, "urlopen",
                        _finta_risposta(b"MZ" + b"\0" * (bridge._PACCHETTO_MINIMO_BYTE + 10)))

    ordine = []
    monkeypatch.setattr(bridge, "_ferma_custode_mt5_feed", lambda: ordine.append("custode"))
    monkeypatch.setattr(bridge, "_stop_mt5_feed_server", lambda: ordine.append("feed"))
    monkeypatch.setattr(bridge.time, "sleep", lambda s: None)

    def _finto_popen(comando, **k):
        ordine.append("installer")
        return types.SimpleNamespace(pid=1234)
    monkeypatch.setattr(bridge.subprocess, "Popen", _finto_popen)

    ok, msg = bridge.aggiorna_programma()
    assert ok is True, msg
    assert "custode" in ordine, "il custode deve essere spento dall'aggiornamento, non lasciato vivo"
    assert "installer" in ordine, "l'installer deve comunque partire"
    assert ordine.index("custode") < ordine.index("installer"), \
        "il custode va spento PRIMA dell'installer: dopo, puo' gia' aver fatto rinascere il servizio"
    assert ordine.index("custode") < ordine.index("feed"), \
        "e PRIMA del servizio dati, altrimenti lo riaccende subito (vedi bridge.py riga ~519)"


def test_se_spegnere_i_servizi_fallisce_l_aggiornamento_va_avanti_lo_stesso(monkeypatch):
    """PROVA DI CONTROLLO. La chiusura ordinata e' un miglioramento, non una nuova condizione per
    aggiornare: se una di quelle funzioni solleva, l'installer deve partire comunque — altrimenti
    avremmo scambiato un difetto raro con l'impossibilita' di aggiornare."""
    bridge = _bridge()
    _finge_windows(monkeypatch, bridge)
    monkeypatch.setattr(bridge, "versione_programma_installata", lambda: "2.0.1")
    monkeypatch.setattr(bridge, "_versione_di", lambda cartella: (2, 0, 99))
    monkeypatch.setattr(bridge.urllib.request, "urlopen",
                        _finta_risposta(b"MZ" + b"\0" * (bridge._PACCHETTO_MINIMO_BYTE + 10)))

    def _esplode():
        raise RuntimeError("il custode non si spegne")
    monkeypatch.setattr(bridge, "_ferma_custode_mt5_feed", _esplode)
    monkeypatch.setattr(bridge, "_stop_mt5_feed_server", _esplode)
    monkeypatch.setattr(bridge.time, "sleep", lambda s: None)

    lanciato = {}
    monkeypatch.setattr(bridge.subprocess, "Popen",
                        lambda comando, **k: lanciato.setdefault("si", True) or types.SimpleNamespace(pid=1))

    ok, msg = bridge.aggiorna_programma()
    assert ok is True, msg
    assert lanciato.get("si"), "l'installer deve partire anche se la chiusura ordinata non riesce"


def test_ordine_chiusura_installer():
    """L'ALTRA META' DELLA CURA, quella che vive in installer.iss: il PADRE si chiude per primo.

    Non si puo' lanciare un vero Setup dentro un collaudo, quindi qui si legge il copione: si
    controlla che il taskkill di ForexBacktestLAB.exe (che porta con se' il custode) venga PRIMA
    di quello di Mt5FeedServer.exe, e che l'attesa non sia piu' uno Sleep alla cieca ma un
    controllo vero che i processi siano andati."""
    percorso = os.path.join(RADICE, "installer_build", "installer.iss")
    with open(percorso, "r", encoding="utf-8", errors="replace") as f:
        testo = f.read()
    corpo = testo[testo.index("procedure UccidiTutti"):]
    i_padre = corpo.index("ForexBacktestLAB.exe")
    i_feed = corpo.index("Mt5FeedServer.exe")
    assert i_padre < i_feed, (
        "il ponte (che contiene il custode) va chiuso PRIMA del servizio dati: chiudendolo dopo, "
        "il custode fa in tempo a far rinascere Mt5FeedServer.exe e resta un orfano sulla 8001")
    assert "ProcessoVivo" in testo, (
        "serve un controllo vero che i processi siano andati: taskkill torna appena ha CHIESTO "
        "la chiusura, non quando e' avvenuta")


def test_niente_da_installare_non_e_una_installazione_avviata(monkeypatch):
    """«OK» NON VUOL DIRE «PARTITO».

    SEGNALATO dal proprietario (4 novembre 2026): «ho premuto il tasto aggiorna e non mi ha
    chiuso l'applicazione, non mi ha fatto nulla, cioe' e' stato molto istantaneo».

    CAUSA: `aggiorna_programma` rispondeva True in DUE casi diversi — «installazione avviata» e
    «non c'e' niente da installare» — e l'app guardava solo quel True. Nel secondo caso mostrava
    «installazione in corso, l'app si riavvia da sola» e lasciava il velo sullo schermo mentre non
    era partito nulla. Un esito vero detto in modo ambiguo e' peggio di un errore: l'errore si
    vede. Qui si misura che i due casi ora si distinguono.
    """
    bridge = _bridge()
    _finge_windows(monkeypatch, bridge)
    monkeypatch.setattr(bridge, "versione_programma_installata", lambda: "2.0.37")
    monkeypatch.setattr(bridge, "_versione_di", lambda cartella: (2, 0, 37))

    def _mai(*a, **k):
        raise AssertionError("non deve scaricare niente: il programma e' gia' aggiornato")
    monkeypatch.setattr(bridge.urllib.request, "urlopen", _mai)

    d = bridge.aggiorna_programma_dettaglio()
    assert d["ok"] is True, "non e' un errore: non c'era davvero niente da fare"
    assert d["avviato"] is False, "ma nessuna installazione e' partita, e l'app deve saperlo"
    assert "niente da installare" in d["messaggio"]


def test_quando_parte_davvero_lo_dice(monkeypatch):
    """PROVA DI CONTROLLO. Senza questa, bastava rispondere `avviato: False` sempre per far
    passare il test qui sopra — e l'app non direbbe mai piu' «installazione in corso» nemmeno
    quando l'installazione parte per davvero."""
    bridge = _bridge()
    _finge_windows(monkeypatch, bridge)
    monkeypatch.setattr(bridge, "versione_programma_installata", lambda: "2.0.37")
    monkeypatch.setattr(bridge, "_versione_di", lambda cartella: (2, 0, 81))
    pacchetto = b"MZ" + b"\x00" * (bridge._PACCHETTO_MINIMO_BYTE + 10)
    # _finta_risposta restituisce GIA' la funzione da mettere al posto di urlopen.
    monkeypatch.setattr(bridge.urllib.request, "urlopen", _finta_risposta(pacchetto))
    avviati = []
    monkeypatch.setattr(bridge.subprocess, "Popen",
                        lambda comando, **k: avviati.append(comando) or object())

    d = bridge.aggiorna_programma_dettaglio()
    assert d["ok"] is True
    assert d["avviato"] is True, "il pacchetto e' stato avviato: va detto"
    assert len(avviati) == 1, "l'installer deve essere stato lanciato una volta"


def test_la_vecchia_forma_a_due_valori_continua_a_funzionare(monkeypatch):
    """PROVA DI CONTROLLO: otto punti del progetto chiamano ancora `aggiorna_programma()` nella
    forma (esito, messaggio). Cambiare quella firma li romperebbe tutti in silenzio."""
    bridge = _bridge()
    _finge_windows(monkeypatch, bridge)
    monkeypatch.setattr(bridge, "versione_programma_installata", lambda: "2.0.37")
    monkeypatch.setattr(bridge, "_versione_di", lambda cartella: (2, 0, 37))
    ok, msg = bridge.aggiorna_programma()
    assert ok is True and isinstance(msg, str) and "niente da installare" in msg
