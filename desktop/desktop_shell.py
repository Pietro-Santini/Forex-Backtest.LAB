"""FINESTRA DELL'APPLICAZIONE Forex Backtest LAB (Windows).

E' l'eseguibile che l'utente VEDE e apre dall'icona sul Desktop o del menu Start
(viene compilato in ForexBacktestLABDesktop.exe, vedi build_exe.bat passo 3d e
installer_build/installer.iss). Gli altri eseguibili del pacchetto
(ForexBacktestLAB.exe, Mt5FeedServer.exe, SegnaliBridge.exe) sono servizi che
girano senza finestra: questa finestra li trova gia' in funzione e, se per
qualche motivo non lo fossero, fa partire il ponte da sola.

Cosa garantisce, perche' l'utente non deve avere problemi:
  1. il logo di Forex Backtest LAB compare in alto a sinistra (favicon), anche se
     la pagina caricata fosse servita da un altro indirizzo e senza suo logo;
  2. il titolo della finestra e il nome dell'applicazione sono quelli veri;
  3. se il servizio non parte, appare una pagina chiara con "che cosa fare" e un
     pulsante Riprova, invece di una finestra vuota che sembra rotta;
  4. funziona sul PC di chiunque: di default parla col ponte locale
     (http://127.0.0.1:8000), non con il server di un altro utente.
"""
import base64
import hashlib
import json
import os
import socket
import subprocess
import sys
import time

import webview

webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = False
webview.settings["REMOTE_DEBUGGING_PORT"] = 9222

# IL PONTE LOCALE E' LA REGOLA. Prima qui si partiva dall'indirizzo di un server
# remoto (Tailscale Oracle): andava bene su quel PC specifico, invece per tutti
# gli altri l'avvio si trascinava tre secondi di attesa e poi tentava comunque
# l'indirizzo lontano. Ora: prima il ponte installato con il pacchetto (sempre
# presente, su ogni PC), e SOLO se l'ambiente lo chiede esplicitamente si esce
# da questa macchina (variabile BACKEND_URL, per chi sviluppa o ha un Oracle).
PORTA_LOCALE = 8000
INDIRIZZO_LOCALE = "http://127.0.0.1:%d/app.html" % PORTA_LOCALE

STORAGE_PATH = os.path.join(os.path.expanduser("~"), ".forexbacktestlab", "webview_profile")
os.makedirs(STORAGE_PATH, exist_ok=True)

INSTALLED_APP = os.path.join(os.path.expanduser("~"), "AppData", "Local", "Programs", "Forex Backtest LAB")
BRIDGE_EXE = os.path.join(INSTALLED_APP, "ForexBacktestLAB.exe")

NOME_APP = "Forex Backtest LAB"


def _is_port_open(port, host="127.0.0.1", timeout=1.0):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (OSError, socket.timeout):
        return False


def _ponte_risponde(timeout=2.0):
    """Dice se il ponte e' DAVVERO in piedi, non solo se la porta accetta connessioni.

    MISURATO l'11 novembre 2026: alla riapertura il guscio trovava la porta 8000 aperta dal ponte
    della sessione PRECEDENTE, che stava morendo. _is_port_open rispondeva True, la finestra si
    attaccava a un servizio che spariva un istante dopo, e nessuno riprovava: la finestra restava
    li' e Windows la dichiarava "non risponde". Una porta aperta non e' un servizio vivo.
    """
    try:
        import urllib.request

        with urllib.request.urlopen(
            "http://127.0.0.1:%d/health" % PORTA_LOCALE, timeout=timeout
        ) as r:
            return 200 <= getattr(r, "status", 200) < 300
    except Exception:
        return False


def _hash_app_html():
    """Hash corto del file app.html servito dal ponte, per il cache-bust dell'URL.

    Ogni volta che l'app viene aggiornata, app.html cambia e l'hash cambia: il
    desktop carica un URL diverso, quindi la WebView2 (e il service worker) non
    possono servire la copia vecchia dalla cache. Senza questo, il riavvio
    dell'applicazione continuava a mostrare la versione precedente (segnalato
    dal proprietario: "non si aggiorna neanche chiudendo").
    """
    dove = []
    mei = getattr(sys, "_MEIPASS", None)
    if mei:
        dove.append(os.path.join(mei, "app.html"))
    qui = os.path.dirname(os.path.abspath(__file__))
    dove.append(os.path.join(qui, "app.html"))
    dove.append(os.path.join(os.path.dirname(qui), "app.html"))
    dove.append(os.path.join(INSTALLED_APP, "app.html"))
    for percorso in dove:
        try:
            with open(percorso, "rb") as f:
                return hashlib.sha256(f.read()).hexdigest()[:12]
        except OSError:
            continue
    return str(int(time.time()))


def _url_app():
    """Indirizzo dell'app con cache-bust, in modo che ogni versione sia un URL nuovo."""
    base = "http://127.0.0.1:%d/app.html" % PORTA_LOCALE
    return base + "?v=" + _hash_app_html()


# MAI CHIAMARE QUESTA FUNZIONE CON UN'ATTESA LUNGA DAL THREAD DELLA FINESTRA (13 nov 2026).
#
# Segnalato dal proprietario: «dopo che finisce l'aggiornamento, quando la va a riaprire non
# risponde l'applicazione e continua a dare il solito crash di sempre».
#
# MISURATO nel registro eventi di Windows, sul suo PC: NON e' un crash, e' un BLOCCO. Quattro
# eventi AppHangB1 su ForexBacktestLABDesktop.exe in due minuti (13:35:08, 13:36:33, 13:36:49,
# 13:37:07): «il programma non interagisce piu' con Windows ed e' stato chiuso». Nessuna
# eccezione, nessuna memoria esaurita.
#
# La causa e' il ciclo qui sotto: fino a 60 time.sleep(1) di fila. Windows marca una finestra
# come «non risponde» dopo pochi secondi che non pompa i messaggi, e all'avvio il ponte puo'
# metterci venti secondi (la pulizia anti-orfano aspetta che le porte si liberino).
#
# Chi chiama dal thread della finestra passa un'attesa CORTA (o zero) e, se il ponte non c'e'
# ancora, lo aspetta altrove: vedi _attendi_ponte_poi.
def _ensure_backend(secondi_di_attesa=60):
    """Rende disponibile il ponte (il servizio dell'applicazione) e il suo indirizzo.

    Se la porta locale risponde, il servizio c'e' gia': non si tocca niente.
    Se non risponde e ForexBacktestLAB.exe c'e' installato, si avvia da solo e si
    aspetta che risponda. Come ultima carta si prova l'indirizzo scritto nella
    variabile d'ambiente BACKEND_URL (chi sviluppa, o chi ha un suo server).
    Ritorna l'indirizzo dell'app; se nessuna delle prove funziona ritorna None, e
    allora la finestra mostra la pagina di spiegazione (non resta bianca).
    """
    if _ponte_risponde():
        return _url_app()
    if os.path.isfile(BRIDGE_EXE):
        subprocess.Popen(
            [BRIDGE_EXE],
            cwd=INSTALLED_APP,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        # QUANTO SI ASPETTA, E PERCHE' NON BASTAVANO 30 SECONDI (11 novembre 2026).
        # All'avvio il ponte fa la pulizia anti-orfano, che aspetta che le porte 8000 e 8001 si
        # liberino: fino a 10 secondi ciascuna. Finche' quella pulizia veniva fatta DUE volte si
        # arrivava a 40 secondi, piu' di questi 30, e la finestra si arrendeva proprio mentre il
        # ponte stava per nascere. Il secondo giro adesso non aspetta piu' (vedi bridge.py), ma il
        # margine qui resta largo: arrendersi un secondo troppo presto costa un avvio fallito,
        # aspettare qualche secondo in piu' non costa niente a nessuno.
        for _ in range(max(0, int(secondi_di_attesa))):
            time.sleep(1)
            if _ponte_risponde():
                return _url_app()
    remoto = (os.environ.get("BACKEND_URL") or "").rstrip("/")
    if remoto:
        url = remoto + "/app.html"
        if _ponte_qui(url):
            return url
    return None


# Aspetta il ponte in un THREAD A PARTE e, quando risponde, chiama quando_pronto(url).
# Serve a non bloccare mai il thread della finestra: la finestra si apre subito e continua a
# rispondere a Windows mentre il servizio parte. E' la differenza fra «ci mette venti secondi»
# e «non risponde, vuoi chiuderlo?».
def _attendi_ponte_poi(quando_pronto, secondi=60):
    import threading

    def _lavora():
        try:
            url = _ensure_backend(secondi)
        except Exception:
            url = None
        try:
            quando_pronto(url)
        except Exception:
            pass

    t = threading.Thread(target=_lavora, name="attesa-ponte", daemon=True)
    t.start()
    return t


# Quello che si vede mentre il servizio parte: una finestra che risponde, non un vuoto.
def _pagina_attesa():
    return (
        "<!doctype html><html lang='it'><head><meta charset='utf-8'>"
        "<title>" + NOME_APP + "</title><style>"
        "body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;"
        "font-family:system-ui,Segoe UI,sans-serif;background:#0b0f14;color:#e8edf3;}"
        "div{text-align:center;max-width:460px;line-height:1.5}"
        "b{display:block;font-size:17px;margin-bottom:8px}"
        "p{color:#93a1b3;font-size:13px;margin:6px 0}"
        "</style></head><body><div>"
        "<b>Sto avviando Forex Backtest LAB...</b>"
        "<p>Il servizio dell'applicazione sta partendo. Puo' metterci una ventina di secondi "
        "quando si riapre subito dopo un aggiornamento.</p>"
        "<p>La finestra si apre da sola appena e' pronto.</p>"
        "</div></body></html>"
    )


# UNA SOLA ISTANZA, E UN OCCHIO SULLA MEMORIA (13 novembre 2026).
#
# Misurato sul PC del proprietario, con lui che guardava:
#   - aprendo l'app una seconda volta partiva un SECONDO programma intero (altra finestra, altro
#     motore web, altri 7 processi). Nel suo Gestione attivita' si vedevano 34-36 processi e 1,7 GB
#     per quella che lui credeva una sola applicazione.
#   - l'istanza che lavorava in diretta cresceva di 90 MB al secondo, con un core al 100%, fino a
#     15,8 GB: a quel punto restavano 0,6 GB liberi su 16 e si bloccava TUTTO IL COMPUTER, non solo
#     l'app. Chiudendola la memoria tornava subito a 10,6 GB.
#   - la crescita continua anche a finestra MINIMIZZATA (+347 MB in 10 s), quindi non e' il disegno
#     a schermo: e' qualcosa che gira comunque.
#
# La causa di quella crescita non e' ancora trovata. Queste due cure non la curano: tolgono di
# mezzo il modo in cui diventa fatale. Un programma che si apre una volta sola consuma una volta
# sola; e un programma che si accorge di star mangiando la memoria puo' ricaricarsi da solo
# invece di portarsi giu' il computer. Va detto, e sta scritto qui: e' un paracadute, non una cura.


# UN PRINT, QUI, NON LO LEGGE NESSUNO (14 novembre 2026).
#
# Questo eseguibile e' compilato con --windowed: non ha una console, e tutto quello che scrive su
# stdout finisce nel nulla. Quando il guardiano della memoria ha cominciato a ricaricare la pagina
# da solo, nel log non c'era UNA riga che lo dicesse: il difetto si e' trovato per deduzione,
# guardando le richieste al ponte (un /disconnect seguito da un /sw.js). Una guardia che agisce
# senza lasciare traccia costa piu' tempo di quanto ne risparmi.
def _scrivi_nel_diario(riga):
    """Una riga con l'ora nel diario della finestra, accanto agli altri log dell'applicazione."""
    try:
        import datetime
        quando = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        dove = os.path.join(INSTALLED_APP, "ForexBacktestLABDesktop.log")
        if not os.path.isdir(INSTALLED_APP):
            dove = os.path.join(os.path.expanduser("~"), ".forexbacktestlab",
                                "ForexBacktestLABDesktop.log")
            os.makedirs(os.path.dirname(dove), exist_ok=True)
        with open(dove, "a", encoding="utf-8") as f:
            f.write("%s [finestra] %s\n" % (quando, riga))
    except Exception:
        pass


def _memoria_mia_mb():
    """Quanta RAM sta occupando davvero questo processo, in MB.

    IL CONTATORE GIUSTO E' IL WORKING SET, NON IL PAGEFILE (misurato il 14 novembre 2026).
    La prima versione di questa funzione leggeva PagefileUsage, e il risultato misurato sul PC
    del proprietario, su un'applicazione perfettamente sana, era:

        PagefileUsage   2.639 MB          <- quello che leggevo
        WorkingSetSize    253 MB          <- la RAM davvero occupata

    Dieci volte tanto. PagefileUsage e' lo spazio di indirizzi che il processo si e' fatto
    addebitare, e per un motore web e' enorme per costruzione: non dice niente su quanta memoria
    sta togliendo al computer. Con la soglia a 2.500 MB il guardiano scattava SUBITO, su un'app
    sana, e ricaricava la pagina ogni due minuti per sempre - difetto visto dal vivo nel log
    (POST /disconnect seguito da GET /sw.js, cioe' una ricarica non chiesta da nessuno).

    Il working set e' quello che il Gestione attivita' mostra alla voce "Memoria", ed e' il numero
    che il proprietario guardava quando ha visto 15,8 GB.
    """
    try:
        import ctypes
        from ctypes import wintypes

        class _PMC(ctypes.Structure):
            _fields_ = [
                ("cb", wintypes.DWORD),
                ("PageFaultCount", wintypes.DWORD),
                ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t),
            ]

        pmc = _PMC()
        pmc.cb = ctypes.sizeof(_PMC)
        h = ctypes.windll.kernel32.GetCurrentProcess()
        if not ctypes.windll.psapi.GetProcessMemoryInfo(h, ctypes.byref(pmc), pmc.cb):
            return 0
        return int(pmc.WorkingSetSize / (1024 * 1024))
    except Exception:
        return 0


# Oltre questa soglia di WORKING SET la pagina si ricarica da sola.
#
# I due numeri fra cui sta, misurati entrambi sul PC del proprietario:
#   253 MB   working set di un'applicazione sana, con la sessione carica e il conto collegato;
#   15,8 GB  il caso che gli bloccava tutto il computer (0,6 GB liberi su 16).
# 3.000 MB e' dodici volte il normale - quindi non puo' scattare per un uso intenso - e cinque
# volte meno del punto in cui fa danno.
SOGLIA_RICARICA_MB = 3000


def _sorveglia_memoria(finestra, url):
    """Guarda ogni dieci secondi quanta memoria sta usando la finestra. Se sfonda la soglia,
    ricarica la pagina: lo stato dell'utente e' salvato e torna da solo, mentre la memoria si
    libera. Non chiude mai niente da sola - al massimo ricarica, come fa gia' l'aggiornamento."""
    import threading

    def _guarda():
        ricaricata_al = 0.0
        while True:
            try:
                time.sleep(10)
                mb = _memoria_mia_mb()
                if mb < SOGLIA_RICARICA_MB:
                    continue
                # Non si ricarica a raffica: almeno due minuti fra una e l'altra.
                if (time.time() - ricaricata_al) < 120:
                    continue
                ricaricata_al = time.time()
                _scrivi_nel_diario(
                    "memoria a %d MB (soglia %d): ricarico la pagina" % (mb, SOGLIA_RICARICA_MB))
                try:
                    if url:
                        finestra.load_url(url)
                except Exception:
                    pass
            except Exception:
                # Un guardiano non puo' far cadere l'applicazione che sorveglia.
                try:
                    time.sleep(10)
                except Exception:
                    return

    threading.Thread(target=_guarda, name="sorveglia-memoria", daemon=True).start()


# Il nome di sistema resta in mano nostra per tutta la vita del processo (se lo si lascia
# andare, Windows lo libera e la finestra dopo non vedrebbe piu' niente), e la RISPOSTA si
# calcola UNA VOLTA SOLA.
#
# Il perche' l'ha trovato il banco di prova, non io: chiamando la funzione due volte nello stesso
# processo, la seconda volta Windows risponde «esiste gia'» - ma quello che esiste e' il nome che
# abbiamo creato noi un attimo prima. Il programma si sarebbe chiuso credendo di essere il
# doppione di se stesso.
_MUTEX_MIO = None
_GIA_APERTA = None


def _gia_in_esecuzione():
    """Vero se un'altra finestra dell'applicazione e' gia' aperta.

    Si usa un nome di sistema (mutex) invece di cercare i processi: e' l'unico modo che non
    sbaglia quando l'eseguibile in modalita' onefile compare DUE volte nell'elenco (l'avviatore
    e il programma vero), cosa che ha gia' tratto in inganno la pulizia anti-orfano del ponte.
    """
    global _MUTEX_MIO, _GIA_APERTA
    if _GIA_APERTA is not None:
        return _GIA_APERTA
    try:
        import ctypes

        kernel32 = ctypes.windll.kernel32
        # Il nome vive nella sessione dell'utente: due utenti diversi sullo stesso PC restano
        # indipendenti.
        h = kernel32.CreateMutexW(None, False, "Local\\ForexBacktestLAB_finestra")
        if not h:
            _GIA_APERTA = False
            return False
        _MUTEX_MIO = h
        _GIA_APERTA = kernel32.GetLastError() == 183  # ERROR_ALREADY_EXISTS
        return _GIA_APERTA
    except Exception:
        # Se il controllo non si puo' fare, si apre: meglio una finestra in piu' che nessuna.
        _GIA_APERTA = False
        return False


def _porta_davanti_quella_aperta():
    """Porta in primo piano la finestra gia' aperta, invece di aprirne una seconda."""
    try:
        import ctypes

        user32 = ctypes.windll.user32
        h = user32.FindWindowW(None, NOME_APP)
        if not h:
            return False
        user32.ShowWindow(h, 9)       # SW_RESTORE: se era ridotta a icona torna su
        user32.SetForegroundWindow(h)
        return True
    except Exception:
        return False


def _ponte_qui(url):
    """Dice se l'indirizzo risponde davvero: evita finestre vuote su un URL morto."""
    try:
        import urllib.request

        with urllib.request.urlopen(url.split("?")[0], timeout=4) as r:
            return 200 <= getattr(r, "status", 200) < 300
    except Exception:
        return False


# --- IL LOGO IN ALTO A SINISTRA ---------------------------------------------
def _logo_data_url():
    """Il logo dell'app come indirizzo incorporato, per metterlo nel tab della finestra.

    Parte dall'icona vera del programma (icon-512.png), quella usata anche
    dall'icona sul Desktop. Se il file non si trova (esecuzione dai sorgenti,
    pacchetto diverso) ritorna None e la pagina tiene il favicon che ha gia'.
    """
    dove_cercare = []
    # PyInstaller onefile: i file aggiunti con --add-data finiscono in _MEIPASS.
    mei = getattr(sys, "_MEIPASS", None)
    if mei:
        dove_cercare.append(os.path.join(mei, "icon-512.png"))
    qui = os.path.dirname(os.path.abspath(__file__))
    dove_cercare.append(os.path.join(qui, "icon-512.png"))
    dove_cercare.append(os.path.join(os.path.dirname(qui), "icon-512.png"))
    dove_cercare.append(os.path.join(qui, "..", "installer_build", "build", "icon-512.png"))
    for percorso in dove_cercare:
        try:
            with open(percorso, "rb") as f:
                return "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")
        except OSError:
            continue
    return None


def _metti_il_logo(finestra):
    """Mette il logo nel tab della finestra (in alto a sinistra), senza toccare la pagina."""
    logo = _logo_data_url()
    if not logo:
        return
    js = (
        "(function(){try{"
        "var l=document.querySelector('link[rel~=\"icon\"]')||document.querySelector('link[rel=\"shortcut icon\"]');"
        "if(!l){l=document.createElement('link');l.rel='icon';document.head.appendChild(l);}"
        "l.type='image/png';l.href=" + json.dumps(logo) + ";"
        "}catch(e){}})();"
    )
    # Il logo si mette quando la pagina e' pronta, non prima.
    try:
        finestra.events.loaded += lambda: _inietta(finestra, js)
    except Exception:
        try:
            finestra.events.shown += lambda: _inietta(finestra, js)
        except Exception:
            pass


def _inietta(finestra, js):
    try:
        finestra.evaluate_js(js)
    except Exception:
        pass


# --- LA PAGINA DI SPIEGAZIONE, SE IL SERVIZIO NON PARTE ---------------------
def _pagina_spiegazione(motivo):
    """Pagina mostrata quando il ponte non risponde: chiara, con il pulsante Riprova."""
    return (
        "<!doctype html><html lang='it'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>" + NOME_APP + "</title><style>"
        "body{margin:0;font-family:system-ui,Segoe UI,sans-serif;background:#0b0f14;color:#e8edf3;}"
        ".box{max-width:520px;margin:12vh auto;padding:28px;border:1px solid #202832;"
        "border-radius:14px;background:#111720;text-align:center}"
        "h1{font-size:20px;margin:0 0 12px}"
        "p{font-size:14px;line-height:1.6;color:#9aa7b8;margin:0 0 10px}"
        "code{background:#0b1117;border:1px solid #263241;border-radius:6px;padding:2px 6px}"
        "button{margin-top:12px;background:#2dd4bf;color:#05201c;border:0;border-radius:9px;"
        "font-weight:700;font-size:14px;padding:11px 22px;cursor:pointer}"
        ".motivo{font-size:12px;color:#6b7785;margin-top:14px}"
        "</style></head><body><div class='box'>"
        "<h1>" + NOME_APP + " non si e' ancora aperto</h1>"
        "<p>Il servizio dell'applicazione (il ponte) non risponde: senza di lui non ci sono\n"
        " il grafico ne' gli ordini.</p>"
        "<p>Premi <b>Riprova</b>: se non basta, riavvia il PC oppure reinstalla il\n"
        " pacchetto <code>ForexBacktestLAB_Setup.exe</code> dal sito.</p>"
        "<button onclick=\"try{window.pywebview.api.riprova()}catch(e){" + "location.reload()}\">Riprova</button>"
        "<div class='motivo'>Dettaglio: " + str(motivo) + "</div>"
        "</div></body></html>"
    )


# --- ADATTAMENTI DELLA WEBVIEW (zoom e finestre nuove) -----------------------
def _patch_zoom_and_popups():
    try:
        import webview.platforms.edgechromium as ec

        _orig = ec.EdgeChrome.on_webview_ready

        def _patched(self, sender, args):
            _orig(self, sender, args)
            try:
                s = sender.CoreWebView2.Settings
                s.AreBrowserAcceleratorKeysEnabled = True
                s.IsZoomControlEnabled = True
            except Exception:
                pass

        # ATTENZIONE AL NOME: prima qui si scriveva `on_web_view_ready` (con un underscore in
        # piu'), mentre l'originale era stato letto da `on_webview_ready`. Due attributi
        # DIVERSI: il patch non agganciava niente e questa funzione era codice morto dal
        # primo giorno. MISURATO confrontando i due nomi attributo per attributo.
        ec.EdgeChrome.on_webview_ready = _patched

        def _allow_native_popup(self, sender, args):
            args.set_Handled(False)

        ec.EdgeChrome.on_new_window_request = _allow_native_popup
    except Exception as exc:
        print("patch fallita:", exc)


class _Api(object):
    """Cio' che la pagina di spiegazione puo' chiamare per riprovare l'apertura."""

    def __init__(self):
        self.finestra = None

    def riprova(self):
        # Chiamata DALLA PAGINA, quindi dal thread della finestra: attesa corta. Se il ponte
        # non c'e' ancora lo si continua ad aspettare in sottofondo, e la finestra resta viva.
        _pulisci_cache_webview()
        url = _ensure_backend(3)
        if not url and self.finestra is not None:
            finestra = self.finestra

            def _poi(indirizzo):
                try:
                    if indirizzo:
                        finestra.load_url(indirizzo)
                except Exception:
                    pass

            _attendi_ponte_poi(_poi, 60)
            return False
        if url and self.finestra is not None:
            try:
                self.finestra.load_url(url)
            except Exception:
                return False
            return True
        return False

    def nuova_finestra(self, slot):
        # Apre una finestra NATIVA senza barra degli indirizzi: e' il meccanismo che
        # sul sito (browser) non si puo' ottenere con window.open (i browser lo vietano
        # per sicurezza). Qui, nella finestra dell'applicazione, la finestra nuova è
        # una vera finestra pywebview, con il titolo "Forex Backtest Lab" e nessuna
        # barra degli indirizzi — esattamente come richiesto. Il contenuto e' la stessa
        # pagina app.html con pipSlot=N, quindi l'istanza completa e indipendente.
        try:
            slot = int(slot)
        except (ValueError, TypeError):
            slot = 2
        if slot < 2:
            slot = 2
        if not _is_port_open(PORTA_LOCALE):
            # IL PULSANTE «DUPLICA FINESTRA» NON PUO' CONGELARE L'APP (13 novembre 2026): qui si
            # e' sul thread della finestra, e con l'attesa lunga premere Duplica mentre il ponte
            # non risponde bloccava TUTTA l'applicazione per un minuto.
            url_b = _ensure_backend(3)
            if not url_b:
                return False
        url = "http://127.0.0.1:%d/app.html?pipSlot=%d" % (PORTA_LOCALE, slot)
        try:
            w = webview.create_window(
                NOME_APP,
                url,
                width=1280,
                height=820,
                min_size=(960, 580),
                frameless=False,
                easy_drag=False,
            )
            return True
        except Exception as exc:
            print("nuova_finestra fallita:", exc)
            return False


def _pulisci_cache_webview():
    """Cancella la cache HTTP/WebView2 ad ogni avvio, per non servire mai una copia vecchia
    di app.html/sw.js dopo un aggiornamento. I dati dell'utente (localStorage, cookie) restano
    intatti: si tocca solo la cartella Cache. Segnalato dal proprietario: "l'installer
    all'aggiornamento carica la vecchia app.html".
    """
    try:
        cache_dir = os.path.join(STORAGE_PATH, "EBWebView", "Default", "Cache")
        if os.path.isdir(cache_dir):
            import shutil
            shutil.rmtree(cache_dir, ignore_errors=True)
        # Anche la cache del service worker (CacheStorage)
        cs = os.path.join(STORAGE_PATH, "EBWebView", "Default", "Service Worker", "CacheStorage")
        if os.path.isdir(cs):
            import shutil
            shutil.rmtree(cs, ignore_errors=True)
    except Exception:
        pass


def main():
    # SE E' GIA' APERTA, SI PORTA DAVANTI QUELLA (13 novembre 2026). Aprire l'app due volte
    # significa due programmi interi: due finestre, due motori web, quattordici processi. Il
    # proprietario lo vedeva come «il programma pesa tantissimo», e gli e' successo per sbaglio
    # anche durante le prove di oggi.
    if _gia_in_esecuzione():
        _porta_davanti_quella_aperta()
        return 0
    api = _Api()
    _patch_zoom_and_popups()
    debug = os.environ.get("DESKTOP_SHELL_DEBUG") == "1"

    _pulisci_cache_webview()
    # PRIMA LA FINESTRA, POI L'ATTESA (13 novembre 2026). Si prova UNA volta senza aspettare: se
    # il ponte e' gia' vivo - il caso normale - si apre dritti sull'app, come prima. Se non
    # risponde, la finestra si apre lo stesso con la pagina di attesa e il servizio viene
    # aspettato in un thread, cosi' la finestra continua a rispondere a Windows invece di farsi
    # dichiarare «non risponde» dopo pochi secondi.
    # COSA FARE QUANDO LA FINESTRA SARA' PRONTA (14 novembre 2026). Vedi il blocco lungo piu'
    # sotto, su webview.start: niente che tocchi la finestra puo' partire prima che pywebview
    # l'abbia davvero creata.
    da_fare_quando_pronta = None
    url = _ensure_backend(0)
    if url:
        finestra = webview.create_window(
            NOME_APP,
            url,
            width=1280,
            height=820,
            min_size=(960, 580),
            js_api=api,
        )
    elif os.path.isfile(BRIDGE_EXE):
        # Il ponte c'e' ma non risponde ancora: finestra subito, attesa in sottofondo.
        finestra = webview.create_window(
            NOME_APP,
            html=_pagina_attesa(),
            width=1280,
            height=820,
            min_size=(960, 580),
            js_api=api,
        )

        def _quando_pronto(indirizzo, _f=None):
            try:
                if indirizzo:
                    api.finestra.load_url(indirizzo)
                else:
                    api.finestra.load_html(_pagina_spiegazione(
                        "il ponte non ha risposto sulla porta %d entro un minuto" % PORTA_LOCALE))
            except Exception:
                pass

        # NON si parte adesso: si segna soltanto. Vedi webview.start, piu' sotto.
        da_fare_quando_pronta = _quando_pronto
    else:
        # ATTENZIONE: la spiegazione e' HTML, VA PASSATA con "html=", non come secondo
        # argomento. Il secondo argomento di create_window e' l'INDIRIZZO (url): passandogli
        # l'HTML, pywebview proverebbe a caricarlo come un indirizzo inesistente e la
        # finestra resterebbe vuota - cioe' il difetto che questo ramo deve evitare.
        # Misurato dal test laboratorio/app/pacchetto_app_desktop.test.mjs.
        finestra = webview.create_window(
            NOME_APP,
            html=_pagina_spiegazione("il ponte non risponde sulla porta %d" % PORTA_LOCALE),
            width=1280,
            height=820,
            min_size=(960, 580),
            js_api=api,
        )
    api.finestra = finestra
    _metti_il_logo(finestra)

    # NIENTE load_url PRIMA CHE LA FINESTRA ESISTA DAVVERO (14 novembre 2026).
    #
    # RIPRODOTTO sul PC del proprietario, a freddo, con un doppio clic vero: la finestra si apre
    # in 4 secondi e risponde; al decimo secondo smette di rispondere e resta cosi' per sempre -
    # un rettangolo nero. MISURATO in quel momento: CPU a ZERO per oltre 70 secondi, memoria
    # ferma a 108 MB, mentre i processi del motore web sotto erano vivi e attivi (1 GB). Zero CPU
    # vuol dire che non sta calcolando niente: sta aspettando.
    #
    # LA CAUSA. Qui sotto, prima, partivano DUE thread: quello che aspetta il ponte e poi chiama
    # finestra.load_url(), e il guardiano della memoria, che fa lo stesso sopra una soglia.
    # Partivano PRIMA di webview.start(), cioe' prima che pywebview avesse creato la finestra
    # vera. Se il ponte risponde in fretta - ed e' il caso normale, qui si e' alzato in 4 secondi
    # - load_url arriva MENTRE la finestra si sta costruendo: la chiamata aspetta il thread della
    # finestra, che a sua volta sta aspettando di finire l'inizializzazione. Si bloccano a
    # vicenda, con CPU a zero, ed e' esattamente il quadro misurato.
    #
    # Piu' il ponte e' veloce, piu' e' probabile il blocco: un difetto che peggiora sui computer
    # buoni e sparisce quando si fanno le prove a mano, col ponte gia' acceso.
    #
    # pywebview una strada giusta ce l'ha, ed e' questa: la funzione passata a webview.start()
    # viene eseguita DOPO che la finestra e' pronta. Da li' in poi load_url si puo' chiamare.
    def _quando_la_finestra_e_pronta():
        if da_fare_quando_pronta is not None:
            _attendi_ponte_poi(da_fare_quando_pronta, 60)
        try:
            _sorveglia_memoria(finestra, url)
        except Exception:
            pass

    try:
        webview.start(
            _quando_la_finestra_e_pronta,
            debug=debug,
            private_mode=False,
            storage_path=STORAGE_PATH,
        )
    except Exception as exc:
        print("avvio fallito:", exc)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
