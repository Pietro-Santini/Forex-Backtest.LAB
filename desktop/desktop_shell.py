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


def _ensure_backend():
    """Rende disponibile il ponte (il servizio dell'applicazione) e il suo indirizzo.

    Se la porta locale risponde, il servizio c'e' gia': non si tocca niente.
    Se non risponde e ForexBacktestLAB.exe c'e' installato, si avvia da solo e si
    aspetta che risponda. Come ultima carta si prova l'indirizzo scritto nella
    variabile d'ambiente BACKEND_URL (chi sviluppa, o chi ha un suo server).
    Ritorna l'indirizzo dell'app; se nessuna delle prove funziona ritorna None, e
    allora la finestra mostra la pagina di spiegazione (non resta bianca).
    """
    if _is_port_open(PORTA_LOCALE):
        return _url_app()
    if os.path.isfile(BRIDGE_EXE):
        subprocess.Popen(
            [BRIDGE_EXE],
            cwd=INSTALLED_APP,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        for _ in range(30):
            time.sleep(1)
            if _is_port_open(PORTA_LOCALE):
                return _url_app()
    remoto = (os.environ.get("BACKEND_URL") or "").rstrip("/")
    if remoto:
        url = remoto + "/app.html"
        if _ponte_qui(url):
            return url
    return None


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
        // primo giorno. MISURATO confrontando i due nomi attributo per attributo.
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
        _pulisci_cache_webview()
        url = _ensure_backend()
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
            url_b = _ensure_backend()
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
    api = _Api()
    _patch_zoom_and_popups()
    debug = os.environ.get("DESKTOP_SHELL_DEBUG") == "1"

    _pulisci_cache_webview()
    url = _ensure_backend()
    if url:
        finestra = webview.create_window(
            NOME_APP,
            url,
            width=1280,
            height=820,
            min_size=(960, 580),
            js_api=api,
        )
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

    try:
        webview.start(
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
