"""
Bridge locale MT5 — Forex Backtest LAB
STEP: health check, login, info conto, lettura posizioni reali, apertura/chiusura/modifica
ordini VERI sul conto MT5 collegato (controllo completo, come richiesto).

ATTENZIONE — DENARO VERO: gli endpoint /order/* e /positions parlano con un conto MT5 reale
(anche se demo). Non c'è alcuna simulazione qui: un ordine inviato da /order/market VIENE
ESEGUITO SUL BROKER. Le conferme "sei sicuro?" sono lato app (app.html), non qui: questo file
esegue esattamente quello che gli viene chiesto, senza ulteriori controlli di prudenza oltre a
quelli tecnici (simbolo esistente, volume nei limiti, connessione attiva).

Richiede: un terminale MetaTrader 5 installato su QUESTO PC (solo Windows).
Comunica con lui via IPC locale tramite il pacchetto ufficiale MetaTrader5.

Installazione:
    pip install fastapi uvicorn MetaTrader5

Avvio:
    uvicorn bridge:app --reload --port 8000

Test rapido:
    GET  http://127.0.0.1:8000/health
    POST http://127.0.0.1:8000/connect   {"login": 12345678, "password": "...", "server": "NomeBroker-Demo"}
    GET  http://127.0.0.1:8000/account
    GET  http://127.0.0.1:8000/positions
    POST http://127.0.0.1:8000/order/market  {"symbol": "EURUSD", "side": "BUY", "volume": 0.10}
    POST http://127.0.0.1:8000/order/close   {"ticket": 123456789}
    POST http://127.0.0.1:8000/order/modify  {"ticket": 123456789, "sl": 1.0800, "tp": 1.0950}
"""

import datetime
import json
import os
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import MetaTrader5 as mt5
import traceback
# Chi e' "il PC" e chi no, per tutti e tre i servizi (vedi il blocco ACCESSO DA ALTRI DISPOSITIVI).
# Import OBBLIGATORIO: se manca, il servizio non parte - meglio che partire senza controllo.
import accesso_condiviso as _accesso

# ===================== LOG SU FILE QUANDO NON C'È UNA CONSOLE (modalità --windowed) =====
# PyInstaller compilato con --windowed (nessuna finestra nera: vedi build_exe.bat) imposta
# sys.stdout e sys.stderr a None quando il programma non è lanciato da un terminale — un
# qualsiasi print()/log successivo altrimenti farebbe crashare l'intero servizio con
# "AttributeError: 'NoneType' object has no attribute 'write'". Li rediriggiamo su un file
# di log accanto all'eseguibile: resta uno strumento di diagnostica anche senza finestra
# visibile, coerente col comportamento richiesto (servizio invisibile in background, mai
# una finestra che l'utente possa vedere o dover gestire).
_LOG_FILE_PATH = None
if getattr(sys, "frozen", False) and sys.stdout is None:
    try:
        _LOG_FILE_PATH = os.path.join(os.path.dirname(sys.executable), "ForexBacktestLAB.log")
        _log_fh = open(_LOG_FILE_PATH, "a", buffering=1, encoding="utf-8")
        sys.stdout = _log_fh
        sys.stderr = _log_fh
    except Exception:
        # Nessun posto scrivibile per il log (permessi, disco pieno...): meglio un "pozzo"
        # che assorbe ogni print() senza mai far crashare il servizio per questo.
        import io
        sys.stdout = io.StringIO()
        sys.stderr = io.StringIO()
        _LOG_FILE_PATH = None

# ===================== AUTOTRADING DISATTIVATO AL CAMBIO CONTO =====================
# Comportamento del TERMINALE MT5 stesso (non un bug nostro, non c'è modo di disattivarlo via
# API): ogni volta che mt5.login() cambia l'account attivo su un terminale già avviato, MT5
# spegne da solo il pulsante "AutoTrading"/"Trading algoritmico" nella barra degli strumenti,
# per sicurezza — così un EA/script non continua a operare subito su un conto diverso da quello
# per cui l'avevi attivato, senza che un umano lo confermi di nuovo. Il pacchetto Python
# MetaTrader5 non espone NESSUNA funzione per riaccenderlo (mt5.terminal_info().trade_allowed è
# di sola lettura): l'unico modo "ufficiale" è cliccare il pulsante a mano (o premere Ctrl+E) nel
# terminale, dopo ogni switch di conto.
# Qui sotto un tentativo BEST-EFFORT di farlo comunque in automatico, inviando quella stessa
# scorciatoia (Ctrl+E) alla finestra del terminale via pywinauto — SOLO se al momento risulta
# davvero spento (mai un tocco se è già acceso, per non rischiare di spegnerlo per errore).
# Limiti onesti: funziona solo su Windows (il terminale desktop MT5 esiste solo lì), richiede
# "pip install pywinauto", e dipende dal titolo della finestra del terminale (deve contenere
# "MetaTrader 5" — vero per la stragrande maggioranza dei broker, ma non garantito per tutti) e
# dal fatto che quella finestra sia raggiungibile/attivabile su questo desktop in questo momento
# (es. non minimizzata in modo anomalo, nessun'altra finestra modale sopra). Se qualcosa non va,
# NON blocca /connect: la connessione resta comunque valida, e /connect segnala sempre nella
# risposta se il trading algoritmico risulta acceso o ancora spento, così l'app può dirlo chiaro
# invece di dare per scontato che sia andato tutto bene.
def _try_reenable_autotrading():
    """Ritorna None se non c'era nulla da fare (già acceso) o se il tentativo è stato inviato
    senza errori, altrimenti una stringa che spiega ESATTAMENTE dove si è fermato — niente più
    fallimenti silenziosi: /connect la restituisce all'app così il motivo si vede subito nella
    barra di stato, invece di dover indovinare (vedi anche test_autotrading.py per un giro di
    diagnosi più dettagliato, finestra per finestra)."""
    try:
        term = mt5.terminal_info()
        if term is None:
            return "terminal_info() non disponibile (nessun terminale collegato?)"
        if term.trade_allowed:
            return None  # già acceso: non tocchiamo nulla
    except Exception as e:
        return f"errore leggendo terminal_info(): {e}"

    try:
        import pywinauto  # noqa: F401
    except Exception as e:
        return f"pywinauto non installato/non importabile ({e}) — esegui: pip install pywinauto"

    try:
        from pywinauto import Desktop
        windows = Desktop(backend="win32").windows()
        if len(windows) == 0:
            return ("0 finestre di primo livello viste in assoluto — questo bridge gira quasi "
                    "certamente in una sessione/window station diversa da quella del desktop dove "
                    "vedi MT5 (es. avviato come servizio Windows, da Attività pianificate, o in una "
                    "sessione Remote Desktop disconnessa): da lì MT5 non è raggiungibile in nessun "
                    "modo. Avvia il bridge in un prompt dei comandi/PowerShell aperto DIRETTAMENTE "
                    "sul desktop dove vedi il terminale.")
        titles_seen = []
        target = None
        for w in windows:
            try:
                title = w.window_text()
            except Exception:
                title = ""
            try:
                cls = w.class_name()
            except Exception:
                cls = ""
            if title:
                titles_seen.append(title)
            # Cerchiamo sia nel titolo sia nel nome-classe: il nome-classe di MT5 di solito
            # contiene "MetaQuotes"/"MetaTrader" ed è spesso leggibile anche quando Windows (UIPI)
            # blocca la lettura del TITOLO per una finestra con privilegi diversi dai nostri.
            hay = f"{title} {cls}".lower()
            if "metatrader" in hay or "metaquotes" in hay:
                target = w
                break
        if target is None:
            shown = "; ".join(titles_seen[:12]) if titles_seen else "(nessuna finestra con titolo leggibile)"
            return (f"nessuna finestra riconoscibile come MT5 (né per titolo né per nome-classe) — "
                    f"finestre CON titolo leggibile viste ora: {shown}. Se MT5 è aperto ma non "
                    f"compare nemmeno come finestra a titolo vuoto, il sospetto principale è un "
                    f"conflitto di privilegi (MT5 come Amministratore, questo bridge no, o "
                    f"viceversa): esegui anche il bridge con lo stesso livello di MT5.")
    except Exception as e:
        return f"errore enumerando le finestre: {e}"

    try:
        target.set_focus()
    except Exception as e:
        return (f"set_focus() sulla finestra MT5 fallito: {e} — causa più comune: MT5 gira come "
                f"Amministratore mentre questo bridge no (o viceversa); Windows blocca l'invio di "
                f"tasti tra processi con privilegi diversi. Prova ad avviare ANCHE il bridge come "
                f"Amministratore.")

    try:
        target.type_keys("^e")
    except Exception as e:
        return f"type_keys('^e') fallito: {e}"

    return None  # inviato senza eccezioni: il chiamante rilegge subito trade_allowed per conferma


# ===================== CHIUSURA COMPLETA ALLA DISCONNESSIONE/CHIUSURA PAGINA =====================
# Richiesto esplicitamente: "non è un'app, è un servizio" — quando l'utente disconnette (pulsante
# Disconnetti) o chiude semplicemente la pagina app.html, deve sparire TUTTO: la sessione IPC con
# MT5 (già gestita da mt5.shutdown(), sotto), la FINESTRA del terminale MT5 stesso, e questo stesso
# processo bridge — niente lasciato acceso in background che l'utente debba notare o richiudere lui.
#
# ATTENZIONE — onestamente, questa è l'azione più aggressiva di tutto il file: MT5 è un programma
# di terze parti che l'utente potrebbe avere aperto ANCHE per altro (altri grafici, script/EA in
# esecuzione, un altro conto). .close() invia un WM_CLOSE "gentile" — lo stesso della X in alto a
# destra: se MT5 ha qualcosa da salvare può mostrare un suo popup e restare aperto — mai un kill
# forzato, ma resta comunque una chiusura che l'utente non ha chiesto in quell'istante specifico,
# solo perché ha cliccato "Disconnetti" o chiuso una scheda del browser. Fallisce sempre in
# silenzio: la disconnessione IPC sopra è già avvenuta ed è la parte che conta davvero.
def _try_close_mt5_terminal():
    try:
        from pywinauto import Desktop
        for w in Desktop(backend="win32").windows():
            try:
                title = w.window_text()
            except Exception:
                title = ""
            try:
                cls = w.class_name()
            except Exception:
                cls = ""
            hay = f"{title} {cls}".lower()
            if "metatrader" in hay or "metaquotes" in hay:
                try:
                    w.close()
                except Exception:
                    pass
    except Exception:
        pass  # pywinauto assente/altro problema: non deve mai far fallire /disconnect per questo
    # BUG RISOLTO ("disconnettersi da MT5 mi slogga dall'account ma non chiude davvero il
    # terminale/l'applicazione"): il .close() "gentile" sopra dipende da pywinauto e dal
    # RICONOSCERE la finestra giusta dal suo titolo/classe — se pywinauto manca nell'eseguibile,
    # se il terminale del broker usa un titolo senza "MetaTrader"/"MetaQuotes" (rebranding), o se
    # .close() viene semplicemente ignorato dal terminale, la finestra restava aperta: l'unico
    # effetto visibile era mt5.shutdown() che chiude la sessione IPC (il terminale appare quindi
    # "sloggato", ma la sua finestra resta lì). Come richiesto esplicitamente, la disconnessione
    # deve chiudere DAVVERO tutto: qui sotto un secondo tentativo, con un breve respiro prima per
    # dare tempo alla chiusura gentile di completarsi da sola (così un terminale che si stava già
    # chiudendo non viene interrotto a metà inutilmente).
    time.sleep(1.0)
    # Preferito: chiusura PRECISA per percorso completo (mt5_terminal_exe_path, catturato in
    # /connect da terminal_info().path) — termina solo il processo del terminale a cui questo
    # bridge si è davvero connesso, senza toccare un eventuale ALTRO terminale MT5 che l'utente
    # avesse aperto per un motivo diverso (stesso identico rischio già segnalato sopra per .close(),
    # qui evitato con Stop-Process filtrato per Path invece che un taskkill "alla cieca" per nome).
    closed_precisely = False
    if mt5_terminal_exe_path:
        try:
            escaped_path = mt5_terminal_exe_path.replace("'", "''")
            ps_cmd = (
                f"Get-Process | Where-Object {{ $_.Path -eq '{escaped_path}' }} "
                f"| Stop-Process -Force"
            )
            r = subprocess.run(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
                capture_output=True,
                timeout=8,
            )
            closed_precisely = r.returncode == 0
        except Exception:
            pass
    if not closed_precisely:
        # Ultimo ripiego, meno preciso: nessun percorso noto (es. bridge riavviato dopo /connect,
        # o PowerShell non disponibile) — termina QUALUNQUE terminal64.exe/terminal.exe in
        # esecuzione sul PC. Onestamente: questo PUÒ chiudere anche un altro terminale MT5 aperto
        # dall'utente per un motivo diverso — usato solo quando la chiusura precisa sopra non è
        # stata possibile, mai come primo tentativo.
        for exe_name in ("terminal64.exe", "terminal.exe"):
            try:
                subprocess.run(
                    ["taskkill", "/IM", exe_name, "/F"],
                    capture_output=True,
                    timeout=5,
                )
            except Exception:
                pass  # nessun processo con quel nome, taskkill assente, o altro: mai far fallire /disconnect per questo


app = FastAPI(title="Forex Backtest LAB — Bridge MT5")

# CORS aperto: l'app gira su GitHub Pages (dominio diverso da localhost), quindi il
# browser deve poter chiamare questo bridge da lì. In seguito si potrà restringere
# a solo l'origine reale dell'app, se si vuole irrigidire la sicurezza.
app.add_middleware(CORSMiddleware, **_accesso.opzioni_cors())   # vedi opzioni_cors(): rete privata

# Stato minimo: sappiamo solo se siamo attualmente collegati a un terminale MT5.
mt5_connected = False
# Percorso completo (cartella + eseguibile) del terminale MT5 a cui siamo REALMENTE connessi ora,
# catturato in /connect da mt5.terminal_info().path appena il login riesce — usato da
# _try_close_mt5_terminal() per chiudere PRECISAMENTE quel processo (e nessun altro) alla
# disconnessione, invece di terminare "alla cieca" ogni terminal64.exe in esecuzione sul PC (che
# potrebbe chiudere anche un altro terminale MT5 aperto dall'utente per un motivo diverso).
mt5_terminal_exe_path = None


# ===================== SERVIRE L'APP (app.html + icone/manifest) =====================
# Aggiunto per l'installer distribuibile: prima bridge.py era SOLO un'API (il file
# app.html si apriva a parte, a doppio click o via un .bat separato). Ora bridge.py
# sa anche servire app.html e i suoi asset (manifest.json, icone, service worker) da
# solo, così un utente che scarica l'installer ottiene un'unica cosa che, avviata,
# apre direttamente il browser sulla app — niente doppio programma da capire.
# Questo NON cambia in nulla il flusso attuale "uvicorn bridge:app --reload" +
# app.html aperto via file:// (quel flusso resta identico a prima): è puro aggiunto.
def _app_base_dir():
    """Cartella da cui servire app.html e i suoi asset. Quando gira come .exe creato
    con PyInstaller, i file aggiunti con --add-data vengono estratti in una cartella
    temporanea indicata da sys._MEIPASS; in sviluppo (python bridge.py, o uvicorn
    bridge:app) è semplicemente la cartella di questo file .py."""
    if getattr(sys, "frozen", False):
        return getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


_BASE_DIR = _app_base_dir()
_APP_HTML_PATH = os.path.join(_BASE_DIR, "app.html")


# ===================== AVVIO AUTOMATICO DEL SERVIZIO DATI MT5 (mt5_feed_server.py) =====
# app.html, quando un conto MT5 è collegato, prende il grafico (storico+candela in corso) da un
# SECONDO servizio separato (mt5_feed_server.py, porta 8001) — tenuto apposta in un processo a
# parte da QUESTO bridge (che esegue gli ordini reali), così un bug nel canale dati ad alta
# frequenza non può mai toccare l'esecuzione ordini: vedi il commento in cima a
# mt5_feed_server.py per il motivo completo di questa separazione.
# Prima l'utente doveva avviarlo a mano in una seconda finestra: qui lo facciamo partire da soli,
# insieme a questo bridge, così l'esperienza resta "un solo programma" come per bridge.py stesso
# — SENZA fondere i due processi (restano due processi Windows separati anche così, l'isolamento
# non cambia, cambia solo CHI lo avvia). Attivo SOLO quando questo bridge gira come .exe
# installato o via "python bridge.py" diretto (lo stesso ramo `if __name__=="__main__"` più in
# fondo a questo file) — MAI con "uvicorn bridge:app --reload" in sviluppo, che non passa da lì:
# in quel caso resta il flusso manuale già documentato in mt5_feed_server.py.
_mt5_feed_proc = None


def _mt5_feed_server_exe_path():
    """Trova l'eseguibile del servizio dati MT5. Da .exe installato: è un secondo file
    (Mt5FeedServer.exe) installato ACCANTO a questo stesso .exe (non dentro _MEIPASS, che è solo
    l'estrazione temporanea dei dati di QUESTO bridge — vedi _app_base_dir) — creato dallo stesso
    build_exe.bat con una seconda chiamata a PyInstaller, vedi lì. In sviluppo, invece, è lo
    script .py stesso nella stessa cartella di bridge.py, lanciato con l'interprete Python
    corrente (sys.executable, in quel caso il vero python.exe)."""
    if getattr(sys, "frozen", False):
        candidate = os.path.join(os.path.dirname(sys.executable), "Mt5FeedServer.exe")
        return candidate if os.path.isfile(candidate) else None
    candidate = os.path.join(_BASE_DIR, "mt5_feed_server.py")
    return candidate if os.path.isfile(candidate) else None


def _kill_stale_instances():
    """BUG RISOLTO ("dopo aver aggiornato con l'installer, il freeze delle candele è ricomparso"):
    ForexBacktestLAB.exe si riavvia da solo ad OGNI accesso a Windows (chiave di registro in
    installer.iss) ed è anche lanciato una seconda volta subito dopo l'installazione ([Run] in
    installer.iss) — ma nessuno dei due punti uccideva mai un'istanza precedente ancora viva.
    Risultato reale osservato: l'utente aveva già un ForexBacktestLAB.exe (e il suo
    Mt5FeedServer.exe figlio) partito al login precedente, con dentro il codice VECCHIO
    (pre-fix); ha poi rieseguito l'installer, che ha sovrascritto i file su disco e rilanciato
    l'app — ma il processo NUOVO, con il codice aggiornato, trovava le porte 8000/8001 già
    occupate, falliva il bind (vedi "[Errno 10048] ... di norma è consentito un solo utilizzo di
    ogni indirizzo di socket" nei log) e si chiudeva silenziosamente, lasciando IN VITA proprio
    quello vecchio: app.html continuava quindi a parlare con la versione pre-fix, e il freeze
    tornava — non perché la correzione fosse sbagliata, ma perché non stava girando affatto.
    Fix: a OGNI avvio, prima di fare qualunque altra cosa, termina qualsiasi ALTRA istanza di
    questi due eseguibili (per nome — sono nomi specifici di questa app, non generici, quindi
    filtrare solo per nome è sicuro qui, a differenza del taskkill su terminal64.exe più sopra)
    così l'istanza appena avviata (sempre la più recente) sostituisce sempre quella precedente
    invece di arrendersi in sua presenza. Confinato a .exe su Windows: in sviluppo
    (python bridge.py) non serve, e "taskkill" non esiste comunque altrove."""
    if not getattr(sys, "frozen", False) or os.name != "nt":
        return
    own_pid = os.getpid()
    for exe_name in ("ForexBacktestLAB.exe", "Mt5FeedServer.exe"):
        try:
            subprocess.run(
                ["taskkill", "/F", "/IM", exe_name, "/FI", f"PID ne {own_pid}"],
                capture_output=True,
                timeout=5,
            )
        except Exception:
            pass  # taskkill assente, nessun processo con quel nome, o altro: mai bloccare l'avvio per questo


def _start_mt5_feed_server():
    """Best-effort, non blocca mai l'avvio di QUESTO bridge se qualcosa non va (file mancante,
    porta 8001 già occupata da un'istanza precedente non chiusa bene, ecc.): l'esecuzione ordini
    reali non deve mai dipendere dalla riuscita di questo avvio accessorio. Se il file non c'è
    (installer più vecchio non ancora rigenerato, o sviluppo senza mt5_feed_server.py copiato
    accanto) resta semplicemente spento: app.html se ne accorge da sola (vedi
    "Servizio dati MT5 ... non raggiungibile" in loadLiveHistoryFromMt5) e torna a Capital.com
    per il grafico, senza che l'utente debba far nulla di diverso."""
    global _mt5_feed_proc
    if _mt5_feed_proc is not None and _mt5_feed_proc.poll() is None:
        return  # già in esecuzione (es. riconnessione senza riavviare tutto il bridge)
    target = _mt5_feed_server_exe_path()
    if not target:
        print("[Mt5Feed] Mt5FeedServer.exe/mt5_feed_server.py non trovato accanto al bridge: "
              "servizio dati MT5 per il grafico non avviato (l'app userà comunque Capital.com).")
        return
    try:
        if getattr(sys, "frozen", False):
            cmd = [target]
        else:
            cmd = [sys.executable, "-m", "uvicorn", "mt5_feed_server:app", "--port", "8001"]
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)  # 0 su piattaforme non-Windows
        _mt5_feed_proc = subprocess.Popen(
            cmd,
            cwd=_BASE_DIR if not getattr(sys, "frozen", False) else os.path.dirname(target),
            creationflags=creationflags,
        )
        print(f"[Mt5Feed] servizio dati MT5 avviato (pid {_mt5_feed_proc.pid}) su http://127.0.0.1:8001/")
    except Exception as e:
        print(f"[Mt5Feed] avvio del servizio dati MT5 fallito (non bloccante): {e}")


def _stop_mt5_feed_server():
    """Simmetrico ad _start_mt5_feed_server(): chiamato alla disconnessione/chiusura di QUESTO
    bridge (vedi /disconnect e il blocco pagehide lato app.html) così non resta un processo
    invisibile acceso in background dopo che l'utente ha chiuso tutto — stessa filosofia già
    applicata a bridge.py stesso e al terminale MT5 (_try_close_mt5_terminal)."""
    global _mt5_feed_proc
    if _mt5_feed_proc is None:
        return
    try:
        if _mt5_feed_proc.poll() is None:
            _mt5_feed_proc.terminate()
    except Exception:
        pass
    _mt5_feed_proc = None


# BUG RISOLTO ("premo F5 e torna il vecchio problema già corretto, ma con CTRL+SHIFT+R va tutto
# bene"): FileResponse/StaticFiles di default NON mandano alcun header Cache-Control, quindi il
# browser applica il SUO caching euristico sulla risposta di "/" (app.html) e di "sw.js" — su un
# refresh normale (F5) Chrome può decidere di riusare la copia locale già in cache SENZA nemmeno
# contattare il server, anche se nel frattempo è stata pubblicata una app.html nuova con un fix
# vero: l'utente continua quindi a eseguire codice vecchio senza alcun errore visibile, e il
# refresh forzato (CTRL+SHIFT+R, che ignora sempre la cache) "risolve" tutto — non perché il fix
# fosse sbagliato, ma perché F5 non lo stava nemmeno scaricando. Il service worker (sw.js) rende
# la cosa ancora più subdola: se anche SOLO sw.js resta in cache stale, il browser non si accorge
# mai che ne esiste una versione nuova (il controllo di aggiornamento confronta byte per byte il
# sw.js scaricato, ma se quel download stesso è servito dalla cache non vede mai la differenza),
# quindi il service worker vecchio resta attivo indefinitamente. Fix: servire "/" e "/sw.js" con
# header espliciti che vietano al browser qualunque caching euristico — vanno sempre validati (o
# riscaricati) ad ogni richiesta, esattamente come ci si aspetta durante lo sviluppo attivo di
# un'app che viene aggiornata di frequente. manifest.json/icone restano sulla StaticFiles normale
# più sotto: cambiano raramente ed essere cache-friendly lì non fa danno.
_NO_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}


@app.get("/")
def serve_app():
    if not os.path.exists(_APP_HTML_PATH):
        raise HTTPException(
            status_code=500,
            detail=f"app.html non trovato in \"{_BASE_DIR}\" — per l'uso in sviluppo questa "
                   f"rotta è opzionale (continua pure ad aprire app.html direttamente col "
                   f"doppio click/il lanciatore .bat); per l'installer, app.html va copiato "
                   f"nella stessa cartella di bridge.py PRIMA di creare l'eseguibile.",
        )
    return FileResponse(_APP_HTML_PATH, headers=_NO_CACHE_HEADERS)


@app.get("/sw.js")
def serve_service_worker():
    """Rotta dedicata (invece di lasciarlo alla StaticFiles generica più sotto) SOLO per poter
    forzare gli header no-cache di cui sopra: è il file la cui staleness fa più danno di tutti,
    vedi il commento sopra _NO_CACHE_HEADERS."""
    sw_path = os.path.join(_BASE_DIR, "sw.js")
    if not os.path.exists(sw_path):
        raise HTTPException(status_code=404, detail="sw.js non trovato")
    return FileResponse(sw_path, media_type="application/javascript", headers=_NO_CACHE_HEADERS)


class ConnectRequest(BaseModel):
    login: int
    password: str
    server: str


class OrderRequest(BaseModel):
    symbol: str
    side: str  # 'BUY' o 'SELL'
    volume: float
    sl: Optional[float] = None
    tp: Optional[float] = None
    comment: Optional[str] = None


class CloseRequest(BaseModel):
    ticket: int


class ModifyRequest(BaseModel):
    ticket: int
    sl: Optional[float] = None
    tp: Optional[float] = None


class PendingOrderRequest(BaseModel):
    symbol: str
    side: str  # 'BUY' o 'SELL'
    kind: str  # 'LIMIT' o 'STOP'
    volume: float
    price: float  # prezzo di entrata
    sl: Optional[float] = None
    tp: Optional[float] = None
    comment: Optional[str] = None


class CancelPendingRequest(BaseModel):
    ticket: int


class ModifyPendingRequest(BaseModel):
    ticket: int
    price: Optional[float] = None
    sl: Optional[float] = None
    tp: Optional[float] = None


@app.get("/health")
def health():
    return {"status": "ok"}


# ===================== NEWS — Calendario economico Forex Factory ========================
# Non esiste un'API ufficiale di Forex Factory: usiamo in sola lettura il feed JSON
# settimanale pubblico che FF stesso serve al proprio sito (nessuna chiave richiesta).
# Passa da QUI (bridge.py) e non dal browser per due motivi: evitare CORS lato app.html
# (servita da un'origine diversa), e poter fare caching lato server — il feed ha rate-limit
# per IP (segnalazioni di blocchi Cloudflare in caso di richieste troppo ravvicinate dallo
# stesso indirizzo), quindi più utenti/tab che ricaricano il grafico live NON devono tradursi
# in altrettante richieste al feed.
#
# CACHE ADATTIVA (richiesta esplicita): normalmente 1 ora (il calendario settimanale cambia
# raramente più spesso di così). MA vicino all'orario di un evento — dove forecast/previous
# restano fermi e "actual" compare non appena esce la notizia su Forex Factory — 1 ora sarebbe
# troppo lenta per far comparire l'actual in tempo utile sul grafico. Quindi: se in cache c'è
# un evento la cui data è entro _NEWS_FAST_WINDOW_SECONDS da adesso (prima o dopo), passiamo a
# un TTL molto più corto (_NEWS_FAST_TTL_SECONDS) SOLO finché quella finestra è attiva — non
# interroghiamo il feed più spesso del necessario nel resto della settimana.
#
# NOTA SUI NOMI DEI CAMPI: CONFERMATI con risposte reali del feed (16/09/2026) — title,
# country (codice valuta, o "All" per eventi globali come i summit), date (ISO 8601 con
# offset, es. "2026-09-16T14:00:00-04:00"), impact (Low/Medium/High), forecast/previous
# (stringhe, vuote se non applicabili), actual.
#
# CORREZIONE (la riga precedente qui sopra affermava, senza averlo mai verificato davvero, che
# "actual" si popola da solo quando la notizia esce): FALSO, verificato con una risposta reale
# di questo stesso feed contenente eventi già usciti da ORE (es. un FOMC Statement delle 14:00
# controllato alle 16+) — "actual" restava null anche per quelli. Questo endpoint specifico
# (ff_calendar_thisweek.json) è un calendario/programma, non un feed di risultati: a quanto
# risulta da questa verifica NON riporta mai il valore uscito, per nessun evento passato. Non
# c'è quindi, con QUESTA fonte dati, un modo per mostrare l'"actual" reale nel popup — servirebbe
# una fonte diversa (tipicamente: leggere la pagina HTML vera di Forex Factory, che questo bridge
# evita deliberatamente per non fare scraping, vedi commento in cima a questa sezione). Il
# parsing resta comunque scritto per non rompersi MAI se in futuro un campo dovesse mancare o
# cambiare nome: nel peggiore dei casi quell'evento arriva con campi vuoti al frontend, non causa
# un errore 500 né blocca la cache.
_NEWS_FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
_NEWS_CACHE_TTL_SECONDS = 60 * 60       # 1 ora: refresh normale, lontano da eventi
_NEWS_FAST_TTL_SECONDS = 2 * 60         # 2 minuti: refresh quando un evento è "caldo"
_NEWS_FAST_WINDOW_SECONDS = 20 * 60     # finestra: 20 minuti prima/dopo l'orario schedulato
_news_cache_lock = threading.Lock()
_news_cache = {"events": None, "fetched_at": 0.0, "last_error": None}

# BUG RISOLTO (osservato dal vivo: "/news torna events:[] con error 'HTTP Error 429: Too Many
# Requests'"): la cache qui sopra vive solo in RAM — ad ogni riavvio di questo bridge (capitato
# più volte in una sessione di debug come quella di oggi, ognuna delle quali riparte da cache
# vuota e quindi rifà subito una richiesta al feed) si perde anche l'ultima copia BUONA che il
# fallback su errore (vedi sotto, "stale_events is not None") userebbe per non lasciare l'utente
# a mani vuote. Risultato osservato: dopo una manciata di riavvii ravvicinati durante il debug,
# il feed ha iniziato a rispondere 429 (rate-limit per IP, già previsto nel commento qui sopra)
# e — non essendoci NESSUNA cache pregressa sopravvissuta al riavvio — non c'era proprio nulla
# da servire, nemmeno vecchio. Fix: la cache che funziona si salva anche su disco (un piccolo
# file JSON accanto all'eseguibile, stesso posto/stesso pattern già usato per ForexBacktestLAB.log
# — vedi sopra), e viene ricaricata da lì all'avvio: un riavvio del bridge non azzera più la rete
# di sicurezza, anche se il feed nel frattempo sta rate-limitando. Sempre best-effort: se scrivere
# o leggere il file fallisce per qualunque motivo (permessi, disco pieno, file corrotto), si
# ricade sul comportamento precedente (cache solo in RAM) senza mai far crashare il bridge.
_NEWS_CACHE_FILE_PATH = os.path.join(
    os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else _BASE_DIR,
    "news_cache.json",
)


def _load_news_cache_from_disk():
    try:
        with open(_NEWS_CACHE_FILE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        events = data.get("events")
        fetched_at = data.get("fetched_at")
        if isinstance(events, list) and isinstance(fetched_at, (int, float)):
            with _news_cache_lock:
                _news_cache["events"] = events
                _news_cache["fetched_at"] = fetched_at
    except Exception:
        pass  # file assente al primo avvio, corrotto, o illeggibile: si parte senza cache pregressa, come prima di questo fix


def _save_news_cache_to_disk(events, fetched_at):
    try:
        with open(_NEWS_CACHE_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump({"events": events, "fetched_at": fetched_at}, f)
    except Exception:
        pass  # mai bloccare una risposta HTTP riuscita per un problema di scrittura su disco accessorio


_load_news_cache_from_disk()


def _news_event_epoch(date_str: str):
    """Converte il campo 'date' dell'evento in un timestamp Unix, senza mai sollevare
    eccezioni: se il formato non è quello atteso (ISO 8601 con offset), torna None e
    quell'evento viene semplicemente ignorato ai fini del calcolo della finestra 'calda'
    (non influisce sul TTL, ma resta comunque nella lista restituita al frontend)."""
    try:
        return datetime.datetime.fromisoformat(date_str).timestamp()
    except Exception:
        return None


def _news_effective_ttl(events, now: float) -> float:
    """1 ora di norma; scende a _NEWS_FAST_TTL_SECONDS se un qualunque evento in cache cade
    entro _NEWS_FAST_WINDOW_SECONDS da 'now' — cioè sta per uscire o è appena uscito."""
    if events:
        for ev in events:
            epoch = _news_event_epoch(ev.get("date") or "")
            if epoch is not None and abs(now - epoch) <= _NEWS_FAST_WINDOW_SECONDS:
                return _NEWS_FAST_TTL_SECONDS
    return _NEWS_CACHE_TTL_SECONDS


def _normalize_news_event(item: dict) -> Optional[dict]:
    """Estrae solo i campi che ci servono, senza mai sollevare eccezioni per un singolo
    evento malformato (che verrebbe semplicemente scartato con `continue` dal chiamante)."""
    if not isinstance(item, dict):
        return None
    title = item.get("title") or item.get("Name") or item.get("name")
    date_raw = item.get("date") or item.get("Date")
    if not title or not date_raw:
        return None
    return {
        "title": str(title),
        "country": str(item.get("country") or item.get("currency") or item.get("Currency") or ""),
        "date": str(date_raw),
        "impact": str(item.get("impact") or item.get("Impact") or ""),
        "forecast": item.get("forecast", item.get("Forecast")),
        "previous": item.get("previous", item.get("Previous")),
        "actual": item.get("actual", item.get("Actual")),
    }


def _fetch_news_from_feed() -> list:
    req = urllib.request.Request(
        _NEWS_FEED_URL,
        headers={"User-Agent": "Mozilla/5.0 (compatible; ForexBacktestLAB/1.0)"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        raw = resp.read()
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        # Il feed a volte risponde con una pagina HTML (blocco/rate-limit) invece del JSON
        # atteso: la trattiamo come un fallimento del fetch, gestito da chi chiama (fallback
        # sull'ultima cache buona), non come un crash.
        raise ValueError(f"risposta feed non è JSON valido: {e}")
    if not isinstance(parsed, list):
        raise ValueError("risposta feed non è una lista JSON come atteso")
    events = []
    for item in parsed:
        ev = _normalize_news_event(item)
        if ev is not None:
            events.append(ev)
    return events


@app.get("/news")
def news():
    """Notizie del calendario economico Forex Factory — usate SOLO dal grafico live
    (mai nello storico/backtest: non esiste una fonte affidabile di notizie storiche via
    questo feed). Risponde sempre con 200 e una lista (anche vuota): un feed irraggiungibile
    o malformato non deve mai rompere il grafico dell'utente."""
    now = time.time()
    with _news_cache_lock:
        cached_events = _news_cache["events"]
        age = now - _news_cache["fetched_at"]
        ttl = _news_effective_ttl(cached_events, now)
        if cached_events is not None and age <= ttl:
            return {"events": cached_events, "cached": True, "fetched_at": _news_cache["fetched_at"]}

    try:
        events = _fetch_news_from_feed()
    except Exception as e:
        with _news_cache_lock:
            _news_cache["last_error"] = str(e)
            stale_events = _news_cache["events"]
            stale_ts = _news_cache["fetched_at"]
        if stale_events is not None:
            # Fetch fallito ma abbiamo ancora una cache precedente: meglio dati un po'
            # vecchi che nessun dato.
            return {"events": stale_events, "cached": True, "stale": True,
                    "fetched_at": stale_ts, "warning": str(e)}
        return {"events": [], "cached": False, "error": str(e)}

    with _news_cache_lock:
        _news_cache["events"] = events
        _news_cache["fetched_at"] = now
        _news_cache["last_error"] = None
    _save_news_cache_to_disk(events, now)  # vedi commento sopra _load_news_cache_from_disk
    return {"events": events, "cached": False, "fetched_at": now}


def _find_registered_mt5_terminal() -> bool:
    """Rilevamento best-effort, usato SOLO per scegliere il messaggio d'errore giusto quando
    mt5.initialize() fallisce (mai per bloccare/sostituire initialize(), che resta l'unica fonte
    di verità reale sul collegamento). Ogni terminale MT5 installato si registra scrivendo un
    file "origin.txt" (il percorso d'installazione, in chiaro) dentro una sottocartella di
    %APPDATA%\\MetaQuotes\\Terminal\\ — è lo stesso meccanismo che mt5.initialize() usa da solo
    per trovare un terminale quando non gli passi un path esplicito (come facciamo qui). Se
    questa cartella non esiste o non contiene nessun origin.txt, con buona sicurezza nessun
    terminale MT5 è mai stato installato su questo account Windows: in quel caso "controlla che
    non ci sia un popup aperto" è un messaggio sbagliato e fuorviante, il vero problema è che va
    installato MT5 la prima volta."""
    try:
        appdata = os.environ.get("APPDATA")
        if not appdata:
            return False
        term_root = os.path.join(appdata, "MetaQuotes", "Terminal")
        if not os.path.isdir(term_root):
            return False
        for name in os.listdir(term_root):
            if os.path.isfile(os.path.join(term_root, name, "origin.txt")):
                return True
        return False
    except Exception:
        # In dubbio, non alteriamo il comportamento: niente messaggio "MT5 non installato",
        # si torna al messaggio generico di sempre.
        return False


@app.get("/mt5-terminal-status")
def mt5_terminal_status():
    """Controllo LEGGERO, senza effetti collaterali: dice solo se un terminale MT5 risulta
    registrato su questo PC (vedi _find_registered_mt5_terminal sopra), NON avvia nulla e non
    richiede credenziali. Usato dall'app per il controllo "hai già installato MT5?" PRIMA di
    mostrare i campi di login — così un utente senza terminale non arriva nemmeno a scrivere le
    sue credenziali per poi vedersi rifiutare la connessione."""
    return {"installed": _find_registered_mt5_terminal()}


@app.post("/mt5-launch")
def mt5_launch():
    """Prova ad avviare/agganciare il terminale MT5 SENZA fare login (nessuna credenziale
    coinvolta) — utile per far vedere subito all'utente che il terminale si apre davvero, prima
    di inserire numero conto/password/server. Stessa chiamata initialize() usata da /connect:
    se il terminale non è installato fallisce con lo stesso identico messaggio distinto da lì."""
    try:
        ok = mt5.initialize()
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Eccezione durante l'avvio del terminale MT5:\n" + traceback.format_exc(),
        )
    if not ok:
        if not _find_registered_mt5_terminal():
            raise HTTPException(
                status_code=500,
                detail="Nessun terminale MetaTrader 5 risulta installato su questo PC.",
            )
        raise HTTPException(
            status_code=500,
            detail=f"Impossibile avviare il terminale MT5: {mt5.last_error()} — controlla che non ci sia "
                   f"nessuna finestra/popup aperta in primo piano nel terminale (es. \"Apri un Conto\").",
        )
    return {"ok": True}


# =====================================================================================
# AVVIO DEL PONTE DEI SEGNALI (sale Telegram)
# =====================================================================================
# L'app chiede di avviarlo premendo "Collegamento" nella sezione Telegram: una pagina web non puo'
# lanciare un processo, questo servizio si'. Nessun parametro dal chiamante e un solo script
# possibile: un endpoint locale che esegue comandi arbitrari sarebbe sfruttabile da qualunque
# pagina aperta nel browser.
PORTA_SEGNALI = 8769
_processo_segnali: Optional[subprocess.Popen] = None


def _porta_occupata(porta: int) -> bool:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex(("127.0.0.1", porta)) == 0


def _trova_exe_segnali() -> Optional[str]:
    """SegnaliBridge.exe, se e' stato installato accanto a questo servizio.

    E' la strada preferita: non richiede Python sul PC dell'utente. I sorgenti .py restano un
    ripiego per chi lavora dalla cartella di sviluppo.
    """
    basi = []
    if getattr(sys, "frozen", False):
        basi.append(os.path.dirname(os.path.abspath(sys.executable)))
    basi.append(os.path.dirname(os.path.abspath(__file__)))
    basi.append(os.getcwd())
    for b in basi:
        for c in (os.path.join(b, "SegnaliBridge.exe"),
                  os.path.join(b, "dist", "SegnaliBridge.exe")):
            if os.path.isfile(c):
                return c
    return None


def _trova_script_segnali() -> Optional[str]:
    """segnali_bridge.py nei posti in cui puo' ragionevolmente trovarsi.

    ATTENZIONE al caso impacchettato: con PyInstaller __file__ sta dentro la cartella temporanea
    in cui l'exe si scompatta, non dove l'applicazione e' installata - cercare solo li' accanto
    non troverebbe mai i file veri. La cartella dell'eseguibile va guardata per prima.
    """
    basi = []
    if getattr(sys, "frozen", False):
        basi.append(os.path.dirname(os.path.abspath(sys.executable)))
    basi.append(os.path.dirname(os.path.abspath(__file__)))
    basi.append(os.getcwd())
    candidati = []
    for b in basi:
        candidati.append(os.path.join(b, "segnali_telegram", "segnali_bridge.py"))
        candidati.append(os.path.join(b, "segnali_bridge.py"))
        candidati.append(os.path.join(os.path.dirname(b), "segnali_telegram", "segnali_bridge.py"))
    for c in candidati:
        if os.path.isfile(c):
            return c
    return None


def _trova_python() -> Optional[str]:
    """L'interprete con cui avviarlo.

    Attenzione: impacchettati con PyInstaller, sys.executable NON e' python ma l'eseguibile di
    questo servizio - avviarci uno script non funzionerebbe. Si usa solo se non e' congelato.
    pythonw.exe per primo: non apre nessuna finestra di console.
    """
    import shutil
    if not getattr(sys, "frozen", False):
        return sys.executable
    for nome in ("pythonw.exe", "python.exe", "python3", "python"):
        trovato = shutil.which(nome)
        if trovato:
            return trovato
    return None


# Diario del ponte dei segnali: SegnaliBridge.exe non ha finestra, e senza questo file un errore
# all'avvio era invisibile ("prova a riavviarlo" e non succede nulla). Le credenziali non ci
# finiscono mai: il ponte non le scrive nel suo diario.
FILE_LOG_SEGNALI = os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), "ForexBacktestLAB", "segnali", "ponte_segnali.log")


def _coda_log_segnali(righe: int = 30) -> str:
    try:
        with open(FILE_LOG_SEGNALI, encoding="utf-8", errors="replace") as f:
            return "".join(f.readlines()[-righe:]).strip()
    except OSError:
        return ""


@app.get("/segnali-log")
def segnali_log(righe: int = 80):
    return {"ok": True, "file": FILE_LOG_SEGNALI, "testo": _coda_log_segnali(max(1, min(500, righe)))}


def _assicura_librerie_segnali(interprete: str, cartella: str) -> None:
    flag = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0
    prova = [interprete, "-c", "import telethon, fastapi, uvicorn, websockets"]
    try:
        if subprocess.run(prova, cwd=cartella, timeout=60, creationflags=flag,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            return
    except Exception:
        pass
    req = os.path.join(cartella, "requirements.txt")
    pacchetti = ["-r", req] if os.path.isfile(req) else ["telethon", "fastapi", "uvicorn", "websockets"]
    try:
        os.makedirs(os.path.dirname(FILE_LOG_SEGNALI), exist_ok=True)
        with open(FILE_LOG_SEGNALI, "a", encoding="utf-8", errors="replace") as log:
            log.write("\n===== %s: librerie del ponte mancanti, le installo con pip =====\n" % time.strftime("%Y-%m-%d %H:%M:%S"))
            log.flush()
            esito = subprocess.run([interprete, "-m", "pip", "install", "--disable-pip-version-check"] + pacchetti,
                                   cwd=cartella, timeout=900, creationflags=flag, stdout=log, stderr=subprocess.STDOUT)
            log.write("===== pip: %s =====\n" % ("fatto" if esito.returncode == 0 else "NON riuscito (codice %s)" % esito.returncode))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Mancano le librerie del ponte dei segnali e non sono riuscito a installarle: %s" % e)
    if subprocess.run(prova, cwd=cartella, timeout=60, creationflags=flag,
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode != 0:
        raise HTTPException(status_code=500, detail="Mancano le librerie del ponte dei segnali (telethon, fastapi, uvicorn, websockets) "
                            "e l'installazione automatica non e' riuscita: guarda il Diario del ponte, oppure dal Prompt dei comandi "
                            "nella cartella segnali_telegram esegui: python -m pip install -r requirements.txt")


@app.post("/segnali-launch")
def segnali_launch():
    global _processo_segnali
    if _porta_occupata(PORTA_SEGNALI):
        return {"ok": True, "gia_attivo": True, "messaggio": "Il ponte dei segnali era gia' avviato."}

    # Prima l'eseguibile: e' quello installato dal Setup e non chiede niente al PC dell'utente.
    comando = None
    cartella = None
    exe = _trova_exe_segnali()
    if exe:
        comando = [exe]
        cartella = os.path.dirname(exe)
    else:
        # Ripiego per la cartella di sviluppo: i sorgenti, con il Python del sistema.
        script = _trova_script_segnali()
        if not script:
            raise HTTPException(
                status_code=404,
                detail="Non trovo il ponte dei segnali: dovrebbe esserci SegnaliBridge.exe "
                       "accanto all'applicazione (lo installa il Setup).",
            )
        interprete = _trova_python()
        if not interprete:
            raise HTTPException(
                status_code=500,
                detail="Trovo i sorgenti del ponte ma non Python per avviarli, e manca "
                       "SegnaliBridge.exe. Reinstalla l'applicazione, oppure installa Python "
                       "da python.org.",
            )
        comando = [interprete, script]
        cartella = os.path.dirname(script)
        # RICHIESTO ("mancavano le librerie, per questo il collegamento non andava"): coi sorgenti
        # il ponte usa il Python del PC, che puo' non avere telethon & co. Si controlla e, se manca
        # qualcosa, si installa da requirements.txt PRIMA di avviarlo (serve internet, una volta).
        _assicura_librerie_segnali(interprete, cartella)

    # CREATE_NO_WINDOW: il processo parte davvero, ma senza finestra nera a schermo - era proprio
    # questo il punto della richiesta.
    flag = 0
    if os.name == "nt":
        flag = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
    log = subprocess.DEVNULL
    try:
        os.makedirs(os.path.dirname(FILE_LOG_SEGNALI), exist_ok=True)
        if os.path.isfile(FILE_LOG_SEGNALI) and os.path.getsize(FILE_LOG_SEGNALI) > 2_000_000:
            os.replace(FILE_LOG_SEGNALI, FILE_LOG_SEGNALI + ".1")
        log = open(FILE_LOG_SEGNALI, "a", encoding="utf-8", errors="replace")
        log.write("\n===== avvio %s: %s =====\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), " ".join(comando)))
        log.flush()
    except OSError:
        log = subprocess.DEVNULL
    try:
        _processo_segnali = subprocess.Popen(
            comando,
            # La cartella di lavoro e' quella del ponte: e' li' che stanno configurazione.json e
            # il file di sessione (vedi CARTELLA_DATI in segnali_bridge.py).
            cwd=cartella,
            creationflags=flag,
            stdout=log,
            stderr=subprocess.STDOUT if log is not subprocess.DEVNULL else subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Avvio del ponte dei segnali non riuscito:\n" + traceback.format_exc(),
        )

    # Si aspetta che la porta risponda davvero: dire "avviato" e lasciare che l'app trovi il vuoto
    # sarebbe peggio che dire subito che non ce l'abbiamo fatta.
    for _ in range(40):
        time.sleep(0.25)
        if _porta_occupata(PORTA_SEGNALI):
            return {"ok": True, "gia_attivo": False, "messaggio": "Ponte dei segnali avviato."}
        if _processo_segnali.poll() is not None:
            time.sleep(0.3)
            coda = _coda_log_segnali(12)
            raise HTTPException(
                status_code=500,
                detail="Il ponte dei segnali si e' chiuso subito dopo l'avvio (codice %s).%s"
                       % (_processo_segnali.returncode,
                          ("\nUltime righe del suo diario (%s):\n%s" % (FILE_LOG_SEGNALI, coda)) if coda else
                          " Controlla che configurazione.json, accanto all'eseguibile, contenga api_id e api_hash presi da my.telegram.org."),
            )
    raise HTTPException(
        status_code=504,
        detail="Il ponte dei segnali e' stato avviato ma non risponde sulla porta %d." % PORTA_SEGNALI,
    )


@app.post("/segnali-stop")
def segnali_stop():
    """Ferma il ponte dei segnali avviato da qui.

    Si prova prima con la buona educazione (terminate), poi con le maniere forti: un processo che
    non muore lascerebbe la porta occupata, e il prossimo avvio fallirebbe senza che si capisca
    perche' - e' successo davvero, con un ponte vecchio che continuava a rispondere.
    """
    global _processo_segnali
    fermato = False
    if _processo_segnali is not None and _processo_segnali.poll() is None:
        try:
            _processo_segnali.terminate()
            try:
                _processo_segnali.wait(timeout=5)
            except Exception:
                _processo_segnali.kill()
            fermato = True
        except Exception:
            raise HTTPException(
                status_code=500,
                detail="Non sono riuscito a fermare il ponte dei segnali:\n" + traceback.format_exc(),
            )
        _processo_segnali = None

    # Se la porta resta occupata, il ponte era stato avviato in un altro modo (a mano, o da una
    # sessione precedente dell'app): non e' figlio nostro e non lo si tocca - meglio dirlo che
    # andare a chiudere processi altrui.
    if _porta_occupata(PORTA_SEGNALI):
        return {"ok": True, "fermato": fermato, "ancora_attivo": True,
                "messaggio": "Il ponte risponde ancora sulla porta %d: era stato avviato fuori "
                             "dall'app (a mano o da una sessione precedente), quindi non lo chiudo io."
                             % PORTA_SEGNALI}
    return {"ok": True, "fermato": fermato, "ancora_attivo": False,
            "messaggio": "Ponte dei segnali fermato." if fermato else "Il ponte non era in esecuzione."}


# =====================================================================================
# ACCESSO DA ALTRI DISPOSITIVI (telefono, tablet) - SOLO TAILSCALE
# =====================================================================================
# Il servizio ascolta SOLO su 127.0.0.1. Dal telefono ci si arriva con Tailscale Serve, che
# risponde in HTTPS sul nome del PC (nome-pc.xxxx.ts.net) e gira le richieste qui. Niente porte
# aperte sulla Wi-Fi, niente firewall, e sul tablet si usa il sito normale con lo stesso login.
# Chi e' "il PC" e chi no lo decide accesso_condiviso.richiesta_locale(), la stessa funzione per
# tutti e tre i servizi: con Tailscale Serve anche il tablet arriva da 127.0.0.1, e guardare solo
# l'indirizzo (come si faceva qui) gli avrebbe dato gli ordini senza chiave e perfino la chiave.
# Se il modulo manca l'avvio fallisce, di proposito: meglio un servizio che non parte che uno che
# parte senza controllo.
import secrets

FILE_ACCESSO = _accesso.FILE_ACCESSO


def _percorso_accesso() -> str:
    """Accanto all'eseguibile (o allo script): li' stanno gia' le altre cose locali."""
    if getattr(sys, "frozen", False):
        base = os.path.dirname(os.path.abspath(sys.executable))
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, FILE_ACCESSO)


def _carica_accesso() -> dict:
    """Legge (e se serve crea) la configurazione dell'accesso remoto.

    La chiave si genera da sola al primo avvio: chiedere all'utente di inventarsene una porterebbe
    a chiavi corte e riusate, che e' il modo piu' rapido per rendere inutile tutto questo.
    """
    percorso = _percorso_accesso()
    dati = {}
    try:
        if os.path.isfile(percorso):
            with open(percorso, "r", encoding="utf-8") as f:
                dati = json.load(f) or {}
    except Exception:
        dati = {}
    cambiato = False
    if not dati.get("chiave"):
        dati["chiave"] = secrets.token_urlsafe(24)
        cambiato = True
    if "rete" not in dati:
        dati["rete"] = False      # spento finche' non lo si accende a mano
        cambiato = True
    if cambiato:
        try:
            with open(percorso, "w", encoding="utf-8") as f:
                json.dump(dati, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
    return dati


ACCESSO_REMOTO = _carica_accesso()

# Chi non e' il PC deve presentare la chiave: stesso controllo, stesso file, degli altri due servizi.
_accesso.installa_controllo_chiave(app)

# ORDINI CRIPTO SU KRAKEN FUTURES: sotto /kraken, stessa porta e stessa chiave degli ordini MT5.
# (Binance Futures non e' disponibile ai residenti in Italia: gli ordini cripto passano da Kraken.)
# Le chiavi API restano in kraken_ordini.py (file della cartella dati, cifrato con DPAPI): l'app
# non le rilegge mai. Se il modulo non si carica, MT5 continua a funzionare.
try:
    import kraken_ordini as _kraken
    app.include_router(_kraken.router)
except Exception as _e_kraken:  # pragma: no cover
    print("[Bridge] ordini Kraken non disponibili:", _e_kraken)


def _solo_dal_pc(request: Request, cosa: str) -> None:
    if not _accesso.richiesta_locale(request):
        raise HTTPException(status_code=403, detail=cosa + " solo dal PC.")


def _salva_accesso() -> None:
    try:
        with open(_percorso_accesso(), "w", encoding="utf-8") as f:
            json.dump(ACCESSO_REMOTO, f, ensure_ascii=False, indent=2)
    except Exception:
        raise HTTPException(status_code=500, detail="Non riesco a salvare l'impostazione:\n" + traceback.format_exc())


@app.get("/accesso-remoto")
def accesso_remoto_stato(request: Request):
    """Chiave e stato di Tailscale. Risponde SOLO al PC stesso: la chiave non si chiede da remoto."""
    _solo_dal_pc(request, "Questa informazione si legge")
    return {"ok": True, "chiave": ACCESSO_REMOTO.get("chiave"), "rete": bool(ACCESSO_REMOTO.get("rete")),
            "porte": list(_accesso.PORTE_SERVIZI),
            # Nome da scrivere sul tablet, e se le tre regole di Tailscale Serve ci sono davvero.
            "tailscale": _accesso.stato_tailscale()}


@app.post("/registra-al-server")
def registra_al_server(body: dict, request: Request):
    """Il PC si presenta al server: «mi chiamo cosi' su Tailscale, si entra con questa chiave».

    RICHIESTO dal proprietario (7 ottobre 2026): dal telefono si scrive SOLO il nome del server.
    Perche' valga anche per MT5 - che gira qui, non sul server, e sul server non ci sara' mai - il
    server deve sapere dov'e' questo computer. Glielo diciamo da qui, dove il nome Tailscale e la
    chiave si sanno gia': cosi' non c'e' niente di nuovo da scrivere a mano.

    La chiamata parte dall'app aperta SU QUESTO PC (l'unica a conoscere la chiave del server,
    perche' l'ha scritta l'utente), e per questo si accetta solo da qui.
    """
    _solo_dal_pc(request, "La registrazione al server si fa")
    server = str((body or {}).get("server") or "").strip().lower().rstrip("/")
    chiave_server = str((body or {}).get("chiave_server") or "").strip()
    if not server.endswith(".ts.net"):
        raise HTTPException(status_code=400, detail="Serve il nome del server (finisce con .ts.net).")
    if not chiave_server:
        raise HTTPException(status_code=400, detail="Serve la chiave del server.")

    ts = _accesso.stato_tailscale()
    mio_nome = str(ts.get("nome") or "").strip().lower()
    if not mio_nome.endswith(".ts.net"):
        raise HTTPException(status_code=400, detail=(
            "Questo computer non ha ancora un nome Tailscale: accendi Tailscale qui, poi riprova "
            "(stato: %s)." % ("non installato" if not ts.get("installato")
                              else ("spento" if not ts.get("attivo") else "senza nome"))))
    if not ACCESSO_REMOTO.get("rete"):
        raise HTTPException(status_code=400, detail=(
            "Prima accendi «Consenti l'accesso dagli altri miei dispositivi»: senza, il server "
            "busserebbe a una porta che non apre."))

    import urllib.error
    import urllib.parse
    import urllib.request
    corpo = json.dumps({"host": mio_nome, "chiave": ACCESSO_REMOTO.get("chiave", "")}).encode("utf-8")
    url = "https://%s:8000/pc/registra?chiave=%s" % (server, urllib.parse.quote(chiave_server))
    req = urllib.request.Request(url, data=corpo, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            esito = json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        dettaglio = ""
        try:
            dettaglio = (json.loads(e.read().decode("utf-8") or "{}") or {}).get("detail") or ""
        except Exception:
            pass
        raise HTTPException(status_code=502, detail="Il server ha rifiutato: " + (dettaglio or str(e)))
    except Exception as e:
        raise HTTPException(status_code=502, detail=(
            "Server non raggiungibile da questo computer (%s). Tailscale e' acceso qui?" % e))
    return {"ok": True, "host": mio_nome, "server": server, "risposta": esito}


@app.post("/accesso-remoto")
def accesso_remoto_imposta(body: dict, request: Request):
    """Accende o spegne l'accesso: la chiave richiesta E le tre regole di Tailscale Serve insieme.

    Niente riavvio: i servizi non cambiano indirizzo di ascolto (sempre 127.0.0.1), e la
    configurazione la rileggono dal file a ogni richiesta.
    """
    _solo_dal_pc(request, "Questa impostazione si cambia")
    if body.get("rigenera_chiave"):
        ACCESSO_REMOTO["chiave"] = secrets.token_urlsafe(24)
    risposta = {"ok": True, "riavvio_necessario": False}
    if "rete" in body:
        accendi = bool(body.get("rete"))
        if accendi:
            # Prima la chiave pretesa, POI la strada aperta: mai un istante con Tailscale Serve
            # acceso e l'accesso "spento" (che vorrebbe dire 403 a tutti, ma per il motivo sbagliato).
            ACCESSO_REMOTO["rete"] = True
            _salva_accesso()
            risposta["tailscale"] = _accesso.attiva_serve(True)
        else:
            # Al contrario: prima si chiude la strada, poi si smette di accettare la chiave.
            risposta["tailscale"] = _accesso.attiva_serve(False)
            ACCESSO_REMOTO["rete"] = False
            _salva_accesso()
    else:
        _salva_accesso()
    risposta.update({"rete": ACCESSO_REMOTO["rete"], "chiave": ACCESSO_REMOTO["chiave"]})
    return risposta


@app.post("/connect")
def connect(body: ConnectRequest):
    global mt5_connected, mt5_terminal_exe_path

    # initialize() avvia/aggancia il terminale MT5 installato su questo PC. Se il terminale ha
    # una finestra modale aperta in primo piano (es. la procedura guidata "Apri un Conto" al
    # primo avvio), il canale IPC può non rispondere e initialize() fallisce: chiudere quella
    # finestra prima di riprovare, di solito, risolve.
    # NOTA DIAGNOSTICA: initialize()/login() del pacchetto MetaTrader5 possono anche sollevare
    # un'eccezione nativa invece di limitarsi a ritornare False — prima questa finiva solo nel
    # log del terminale (500 "nudo", nessun dettaglio nel browser). Ora la catturiamo sempre e
    # la restituiamo nel campo "detail", così compare nel banner rosso dell'app senza dover
    # controllare il prompt dei comandi.
    try:
        init_ok = mt5.initialize()
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Eccezione durante l'avvio del terminale MT5:\n" + traceback.format_exc(),
        )

    if not init_ok:
        # Due cause molto diverse, due messaggi diversi: un utente senza NESSUN terminale MT5
        # installato (caso tipico al primo utilizzo in assoluto) vedeva finora lo stesso messaggio
        # di chi ha il terminale ma con un popup bloccante in primo piano — fuorviante nel primo
        # caso, gli faceva cercare un popup che non esiste.
        if not _find_registered_mt5_terminal():
            raise HTTPException(
                status_code=500,
                detail="Nessun terminale MetaTrader 5 risulta installato su questo PC. Scarica e "
                       "installa il terminale MT5 del tuo broker (o, se non hai ancora un broker, "
                       "quello generico di MetaQuotes), poi riprova a connetterti.",
            )
        raise HTTPException(
            status_code=500,
            detail=f"Impossibile avviare il terminale MT5: {mt5.last_error()} — controlla che non ci sia "
                   f"nessuna finestra/popup aperta in primo piano nel terminale (es. \"Apri un Conto\").",
        )

    try:
        ok = mt5.login(login=body.login, password=body.password, server=body.server)
    except Exception:
        mt5.shutdown()
        mt5_connected = False
        raise HTTPException(
            status_code=500,
            detail="Eccezione durante il login MT5:\n" + traceback.format_exc(),
        )

    if not ok:
        error = mt5.last_error()
        mt5.shutdown()
        mt5_connected = False
        raise HTTPException(status_code=401, detail=f"Login MT5 fallito: {error}")

    mt5_connected = True

    # Tentativo automatico di riaccendere "AutoTrading" se il cambio conto lo ha spento (vedi
    # commento su _try_reenable_autotrading più sopra) — poi si rilegge lo stato VERO, non si
    # assume che il tentativo sia riuscito. autofix_detail spiega ESATTAMENTE dove si è fermato
    # (o resta None se non c'era nulla da fare / il tentativo è stato inviato senza errori).
    autofix_detail = _try_reenable_autotrading()
    term = mt5.terminal_info()
    algo_trading = bool(term.trade_allowed) if term is not None else None
    # Catturato qui (connessione appena riuscita, term già letto sopra) per la chiusura precisa
    # in _try_close_mt5_terminal() alla disconnessione — vedi commento sulla variabile globale.
    mt5_terminal_exe_path = None
    if term is not None and getattr(term, "path", None):
        for exe_name in ("terminal64.exe", "terminal.exe"):
            candidate = os.path.join(term.path, exe_name)
            if os.path.isfile(candidate):
                mt5_terminal_exe_path = candidate
                break

    return {
        "status": "connected",
        "login": body.login,
        "server": body.server,
        "algo_trading": algo_trading,
        # Mostrato dall'app SOLO se algo_trading è ancora False: se è tornato già acceso da solo
        # (o il tentativo non era nemmeno necessario), il dettaglio non serve.
        "algo_trading_autofix_detail": (None if algo_trading else autofix_detail),
    }


@app.post("/disconnect")
def disconnect(request: Request):
    global mt5_connected
    # SOLO dal PC. Qui si chiudono MT5, il terminale e questo stesso processo: chiamato dal tablet,
    # nessuno potrebbe piu' riaccenderli se non tornando al computer. Anche con la chiave giusta.
    if not _accesso.richiesta_locale(request):
        raise HTTPException(status_code=403, detail="MT5 e il servizio si spengono dal computer. "
                                                    "Dal tablet puoi chiudere la pagina: sul PC resta tutto acceso.")
    mt5.shutdown()
    mt5_connected = False
    _try_close_mt5_terminal()
    _stop_mt5_feed_server()  # niente processo dati MT5 orfano dopo che questo bridge è sparito
    # Chiude anche QUESTO processo bridge, un attimo dopo aver risposto — coerente col fatto che
    # non è più "un'app che l'utente apre e chiude da solo", ma un servizio legato 1:1 alla sessione
    # dell'app web: niente processo invisibile che resta acceso in background dopo che l'utente ha
    # disconnesso o chiuso la pagina. Il ritardo di 1s serve solo a lasciare al server il tempo di
    # inviare davvero questa risposta HTTP prima di terminare (os._exit salta ogni cleanup normale
    # apposta: è il modo più affidabile per un processo "congelato" da PyInstaller di uscire subito,
    # senza restare bloccato ad aspettare thread/connessioni ancora aperte).
    threading.Timer(1.0, lambda: os._exit(0)).start()
    return {"status": "disconnected"}


@app.get("/account")
def account():
    if not mt5_connected:
        raise HTTPException(status_code=400, detail="Non connesso: chiama prima /connect")

    info = mt5.account_info()
    if info is None:
        raise HTTPException(status_code=500, detail=f"Impossibile leggere il conto: {mt5.last_error()}")

    # RICHIESTO ESPLICITAMENTE: con un conto MT5 collegato l'app deve mostrare capitale e margine
    # libero VERI del conto (non quelli simulati) — aggiunti margin/margin_free/margin_level/profit/
    # credit, letti così come li dà MT5. Campi solo AGGIUNTI: chi leggeva i vecchi non cambia nulla.
    return {
        "login": info.login,
        "server": info.server,
        "balance": info.balance,
        "equity": info.equity,
        "currency": info.currency,
        "leverage": info.leverage,
        "margin": getattr(info, "margin", None),
        "margin_free": getattr(info, "margin_free", None),
        "margin_level": getattr(info, "margin_level", None),
        "profit": getattr(info, "profit", None),
        "credit": getattr(info, "credit", None),
    }


# ===================== ORDINI REALI =====================
# Da qui in poi si parla DAVVERO col broker: niente di simulato.

# Traduzione dei codici di ritorno più comuni di order_send() in un messaggio leggibile, così
# l'app può mostrare subito il motivo di un rifiuto invece di un numero nudo.
RETCODE_MESSAGES = {
    10004: "Requote: il prezzo è cambiato, riprova.",
    10006: "Richiesta rifiutata dal broker.",
    10007: "Richiesta annullata dal trader.",
    10008: "Ordine piazzato.",
    10009: "Operazione completata.",
    10010: "Solo una parte della richiesta è stata eseguita.",
    10013: "Richiesta non valida.",
    10014: "Volume non valido per questo simbolo.",
    10015: "Prezzo non valido.",
    10016: "Stop Loss/Take Profit non validi.",
    10017: "Trading disabilitato sul conto.",
    10018: "Mercato chiuso per questo simbolo ora.",
    10019: "Fondi insufficienti per eseguire l'operazione.",
    10020: "Prezzo cambiato.",
    10021: "Nessuna quotazione disponibile per eseguire la richiesta.",
    10025: "Nessuna modifica effettiva richiesta.",
    10026: "Server occupato, riprova.",
    10027: "Trading via Autotrading disabilitato: attiva \"Trading algoritmico\" nella barra "
           "degli strumenti del terminale MT5.",
    10030: "Modalità di esecuzione (filling mode) non supportata dal broker per questo simbolo.",
    10031: "Nessuna connessione col server di trading del broker.",
}


def _deal_reason_labels():
    """Mappa le costanti DEAL_REASON_* del pacchetto MetaTrader5 (numeriche, cambiano significato
    da sole se lette a memoria) a un'etichetta leggibile per il Trade Journal dell'app — usata da
    /deal_reason per dire con CERTEZZA (letto dallo storico deal del broker, non indovinato dal
    prezzo di chiusura) se una posizione reale si è chiusa per SL, TP, Stop Out (margin call del
    broker), chiusura manuale (terminale/mobile/web) o un Expert Advisor. getattr con default None
    perché non tutte le versioni del pacchetto espongono per forza ogni costante."""
    mapping = {}
    for attr, label in (
        ("DEAL_REASON_CLIENT", "MANUAL"),
        ("DEAL_REASON_MOBILE", "MANUAL"),
        ("DEAL_REASON_WEB", "MANUAL"),
        ("DEAL_REASON_EXPERT", "EA"),
        ("DEAL_REASON_SL", "SL"),
        ("DEAL_REASON_TP", "TP"),
        ("DEAL_REASON_SO", "STOP OUT"),
    ):
        val = getattr(mt5, attr, None)
        if val is not None:
            mapping[val] = label
    return mapping


DEAL_REASON_LABELS = _deal_reason_labels()


def _ensure_trading_allowed():
    """Controllo veloce PRIMA di chiamare order_send(): se AutoTrading/trading sul conto non è
    permesso, order_send() del pacchetto MetaTrader5 può restare bloccato invece di rispondere
    subito con un errore chiaro — meglio fermarsi qui con un messaggio utile che lasciare
    appesa la richiesta (e il browser) senza spiegazioni."""
    term = mt5.terminal_info()
    if term is not None and not term.trade_allowed:
        raise HTTPException(
            status_code=400,
            detail="Trading algoritmico disattivato nel terminale: attiva il pulsante "
                   "\"AutoTrading\"/\"Trading algoritmico\" nella barra degli strumenti "
                   "principale di MT5 (deve diventare verde), poi riprova.",
        )
    acc = mt5.account_info()
    if acc is not None and not acc.trade_allowed:
        raise HTTPException(
            status_code=400,
            detail="Il trading non è permesso su questo conto in questo momento (conto in "
                   "sola lettura, o trading disabilitato dal broker/server).",
        )


def _ensure_symbol(symbol: str):
    """Verifica che il simbolo esista per questo broker/conto e lo rende visibile/selezionabile
    per il trading (un simbolo non "spuntato" nel Market Watch del terminale può rifiutare gli
    ordini pur esistendo)."""
    info = mt5.symbol_info(symbol)
    if info is None:
        raise HTTPException(
            status_code=404,
            detail=f"Simbolo '{symbol}' non trovato su questo broker/conto. Il nome esatto del "
                   f"simbolo può variare da broker a broker (es. suffissi come .m o .a): "
                   f"controlla il Market Watch del terminale MT5.",
        )
    if not info.visible:
        if not mt5.symbol_select(symbol, True):
            raise HTTPException(status_code=500, detail=f"Impossibile selezionare il simbolo '{symbol}': {mt5.last_error()}")
        info = mt5.symbol_info(symbol)
    return info


def _round_volume(info, volume: float) -> float:
    """Arrotanda il volume richiesto al passo consentito dal simbolo (volume_step) e lo
    vincola tra volume_min e volume_max: un volume "storto" (es. 0.07 lot con step 0.01 va
    bene, ma con step 0.1 no) fa rifiutare l'intero ordine dal broker."""
    step = info.volume_step or 0.01
    vol = round(round(volume / step) * step, 8)
    vol = max(info.volume_min, min(info.volume_max, vol))
    return round(vol, 2)


def _pick_filling_mode(info):
    """Non tutti i broker accettano tutte le "filling policy". Per doc MQL5: se il bitmask
    filling_mode del simbolo non include né FOK né IOC, l'UNICA modalità valida è
    ORDER_FILLING_RETURN — BUG RISOLTO: qui si ripiegava erroneamente su IOC anche in quel
    caso, che è esattamente ciò che produceva "Unsupported filling mode" (retcode 10030) su
    ogni ordine, sia da bridge.py che da test_order.py."""
    try:
        mode_bits = info.filling_mode
        if mode_bits & mt5.SYMBOL_FILLING_FOK:
            return mt5.ORDER_FILLING_FOK
        if mode_bits & mt5.SYMBOL_FILLING_IOC:
            return mt5.ORDER_FILLING_IOC
    except Exception:
        pass
    return mt5.ORDER_FILLING_RETURN


def _send_trying_fillings(request: dict):
    """Invia l'ordine provando più "filling policy" in sequenza se il broker rifiuta con
    retcode 10030 (Unsupported filling mode): più robusto della sola lettura del bitmask del
    simbolo, che alcuni broker riportano in modo impreciso o incompleto. Si ferma al primo
    successo, o al primo rifiuto con un motivo DIVERSO da 10030 (in quel caso ritentare con
    un'altra modalità non risolverebbe nulla)."""
    candidates = []
    for mode in (request.get("type_filling"), mt5.ORDER_FILLING_IOC, mt5.ORDER_FILLING_FOK, mt5.ORDER_FILLING_RETURN):
        if mode is not None and mode not in candidates:
            candidates.append(mode)

    last_result = None
    last_exc = None
    for mode in candidates:
        req = dict(request, type_filling=mode)
        try:
            result = mt5.order_send(req)
        except Exception:
            last_exc = traceback.format_exc()
            continue
        if result is None:
            continue
        if result.retcode == mt5.TRADE_RETCODE_DONE:
            return result
        last_result = result
        if result.retcode != 10030:  # errore diverso da "filling non supportato": non ha senso provare un'altra modalità
            break

    if last_result is not None:
        msg = RETCODE_MESSAGES.get(last_result.retcode, f"codice {last_result.retcode}")
        raise HTTPException(status_code=400, detail=f"Ordine rifiutato dal broker: {msg} (retcode {last_result.retcode})")
    if last_exc:
        raise HTTPException(status_code=500, detail="Eccezione durante l'invio dell'ordine a MT5:\n" + last_exc)
    raise HTTPException(status_code=500, detail=f"order_send non ha risposto: {mt5.last_error()}")


def _send_and_check(request: dict):
    """Invio "semplice" (una sola chiamata, senza provare più filling mode): usato per le
    richieste che non riguardano l'esecuzione di un ordine a mercato/chiusura (es. modifica
    SL/TP via TRADE_ACTION_SLTP, dove il filling mode non si applica)."""
    try:
        result = mt5.order_send(request)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Eccezione durante l'invio dell'ordine a MT5:\n" + traceback.format_exc(),
        )
    if result is None:
        raise HTTPException(status_code=500, detail=f"order_send non ha risposto: {mt5.last_error()}")
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        msg = RETCODE_MESSAGES.get(result.retcode, f"codice {result.retcode}")
        raise HTTPException(status_code=400, detail=f"Ordine rifiutato dal broker: {msg} (retcode {result.retcode})")
    return result


def _server_time_offset_seconds(tick) -> int:
    """BUG RISOLTO ("apro una posizione direttamente su MT5 e la freccia/casella di apertura
    non resta ferma sulla candela giusta: continua a spostarsi verso destra man mano che
    arrivano nuove candele"): i campi 'time' restituiti da positions_get()/orders_get() sono
    nell'orologio del SERVER del broker, che per moltissimi broker MT5 NON è UTC (spesso EET,
    UTC+2 o +3, a seconda anche dell'ora legale) — ma l'app li tratta come un vero epoch UTC per
    scegliere su quale candela del grafico (sempre in UTC) disegnare la freccia di apertura. Se
    il server è avanti rispetto a UTC, quel 'time' risulta sempre "nel futuro" rispetto a
    qualunque candela già ricevuta: la ricerca della candela corrispondente si aggancia allora
    sempre all'ULTIMA candela disponibile in quel momento, e siccome il grafico ne riceve di
    nuove in continuazione, l'ancoraggio "insegue" ogni nuova candela invece di restare fermo
    sulla vera candela di apertura. Corretto qui alla radice: calcoliamo lo scarto fra l'orologio
    del server (dato da un tick REALE appena letto, non da un valore statico/presunto — copre
    quindi anche l'ora legale) e l'orologio vero di questa macchina, e lo sottraiamo da 'time'
    prima di restituirlo all'app. Arrotondato al minuto: elimina il jitter di rete/IPC senza
    intaccare la precisione richiesta (le candele sono comunque raggruppate per minuto)."""
    if tick is None or not getattr(tick, "time", None):
        return 0
    try:
        # Al quarto d'ora come in mt5_feed_server.py: un tick vecchio di oltre 30 s sbagliava di un minuto.
        return round((tick.time - time.time()) / 900) * 900
    except Exception:
        return 0


# Ultimo scarto server/UTC misurato con un tick FRESCO (vedi _estimate_server_offset_seconds):
# tenuto in memoria per poterlo riusare quando, in quel momento, nessun simbolo sta quotando
# (mercato chiuso, weekend) e quindi nessun tick è abbastanza recente per rimisurarlo.
_last_good_server_offset = None


def _estimate_server_offset_seconds(preferred_symbols=()):
    """BUG RISOLTO ("una posizione aperta con l'app e chiusa dal broker mentre l'app/il PC erano
    spenti non compare mai nel Journal alla riapertura"): /history_deals calcolava lo scarto
    orologio server/UTC con UN SOLO tick, quello del simbolo del PRIMO deal trovato
    (deals[0].symbol) — ma quel primo deal poteva essere un deposito/rettifica (symbol vuoto ->
    nessun tick -> scarto 0), oppure un simbolo non in Market Watch o fermo in quel momento
    (tick assente o vecchio -> scarto sbagliato). Con scarto 0 (o comunque troppo grande) un
    server EET/EEST (UTC+2/+3) faceva risultare la chiusura recente "nel futuro" rispetto ad
    adesso, e il filtro sull'intervallo la scartava in silenzio: proprio le chiusure più recenti,
    quelle che servono, sparivano. Qui si usa invece il tick PIÙ RECENTE tra i simboli dei deal e
    quelli visibili nel Market Watch (fino a 60): basta che UNO stia quotando ora per misurare lo
    scarto con precisione. Arrotondato a 30 minuti (i server broker sono sempre a ore o mezz'ore
    intere) e accettato solo se il tick è davvero fresco (residuo <= 5 min: un tick vecchio ha un
    residuo casuale); altrimenti si riusa l'ultimo scarto buono già misurato in questo processo,
    e solo in mancanza di tutto si ricade sul valore arrotondato "best effort" (mai un'eccezione)."""
    global _last_good_server_offset
    now = time.time()
    names = []
    for sym in preferred_symbols:
        if sym and sym not in names:
            names.append(sym)
    preferred = set(names)
    try:
        for info in (mt5.symbols_get() or ()):
            if getattr(info, "visible", False) and info.name not in names:
                names.append(info.name)
            if len(names) >= 60:
                break
    except Exception:
        pass
    freshest = None
    for name in names:
        try:
            if name in preferred:
                mt5.symbol_select(name, True)  # senza selezione nel Market Watch non c'è tick
            tick = mt5.symbol_info_tick(name)
        except Exception:
            continue
        t = getattr(tick, "time", 0) if tick is not None else 0
        if t and (freshest is None or t > freshest):
            freshest = t
    if freshest is None:
        return _last_good_server_offset if _last_good_server_offset is not None else 0
    raw = freshest - now
    rounded = int(round(raw / 1800.0)) * 1800
    if abs(raw - rounded) <= 300:
        _last_good_server_offset = rounded
        return rounded
    if _last_good_server_offset is not None:
        return _last_good_server_offset
    return rounded


@app.get("/positions")
def get_positions():
    """Posizioni REALMENTE aperte ora sul conto collegato (non simulate)."""
    if not mt5_connected:
        raise HTTPException(status_code=400, detail="Non connesso: chiama prima /connect")
    positions = mt5.positions_get()
    if positions is None:
        # positions_get() restituisce None per un errore INTERNO/temporaneo (l'IPC col terminale
        # ha avuto un intoppo, il terminale era momentaneamente occupato...), MAI per "il conto
        # non ha più posizioni aperte": quel caso restituisce invece una tupla VUOTA (), che qui
        # sotto diventa correttamente out=[]. Confondere i due casi restituendo comunque [] farebbe
        # credere all'app che TUTTE le posizioni reali tracciate si siano chiuse in un colpo solo
        # durante un singolo giro di polling sfortunato — causando un trade fantasma nel Trade
        # Journal (chiuso al prezzo di apertura, 0 P/L) per ognuna. Un errore vero è molto più
        # sicuro: l'app lo tratta già come "nessuna novità in questo giro, riprovo tra 2s" (vedi
        # fetchMt5Positions), senza toccare nulla.
        code, desc = mt5.last_error()
        raise HTTPException(status_code=503, detail=f"positions_get() non disponibile in questo momento (mt5.last_error={code} {desc}) — nessuna posizione toccata, riprovare")
    out = []
    for p in positions:
        # Bid/ask ATTUALI del simbolo (non quelli dell'apertura): servono all'app per calcolare
        # lo spread REALE in questo momento (es. per il tasto Breakeven, che deve tenerne conto
        # per garantire davvero P/L=0 alla chiusura, non lo spread di quando la posizione fu
        # aperta). Se il tick non è disponibile per qualche motivo, restituiamo None: l'app
        # allora tratta lo spread come sconosciuto/zero invece di inventare un numero.
        tick = mt5.symbol_info_tick(p.symbol)
        # Vedi _server_time_offset_seconds(): p.time è nell'orario SERVER del broker (spesso
        # non UTC), va corretto prima di restituirlo perché l'app lo tratta come epoch UTC vero
        # per ancorare la freccia/casella di apertura alla candela giusta.
        out.append({
            "ticket": p.ticket,
            "symbol": p.symbol,
            "side": "BUY" if p.type == mt5.POSITION_TYPE_BUY else "SELL",
            "volume": p.volume,
            "price_open": p.price_open,
            "sl": p.sl if p.sl else None,
            "tp": p.tp if p.tp else None,
            "price_current": p.price_current,
            "bid": tick.bid if tick is not None else None,
            "ask": tick.ask if tick is not None else None,
            "profit": p.profit,
            "swap": p.swap,
            # Scarto robusto (mezz'ora, tick freschi): prima si arrotondava al minuto sull'ultimo
            # tick del simbolo, e con un tick vecchio di 40 secondi l'apertura slittava di un minuto.
            "time": min(_tempo_posizione(p) - _offset_server_cache([p.symbol]), time.time()),
            # Per il PAREGGIO ESATTO (profitto netto 0,00 alla chiusura): commissione del deal di
            # ingresso, valore in valuta del conto di un movimento di 1,0 del prezzo per questo
            # volume, e cifre/passo del simbolo per arrotondare lo stop dalla parte giusta.
            "commission": _commissione_ingresso(p.ticket),
            "valore_punto": _valore_punto(p.symbol, p.type, p.volume, p.price_open),
            "digits": _cifre_simbolo(p.symbol)[0],
            "point": _cifre_simbolo(p.symbol)[1],
        })
    return out


_commissioni_cache = {}


def _commissione_ingresso(ticket):
    """Commissione (negativa = costo) dei deal di INGRESSO della posizione. Non cambia piu' dopo
    l'apertura: si legge una volta e si ricorda."""
    if ticket in _commissioni_cache:
        return _commissioni_cache[ticket]
    tot = None
    try:
        deals = mt5.history_deals_get(position=ticket)
        if deals:
            entry_in = getattr(mt5, "DEAL_ENTRY_IN", 0)
            tot = round(sum(float(getattr(d, "commission", 0) or 0) + float(getattr(d, "fee", 0) or 0)
                            for d in deals if d.entry == entry_in), 2)
            _commissioni_cache[ticket] = tot
    except Exception:
        tot = None
    return tot


_valore_punto_cache = {}


def _valore_punto(symbol, tipo, volume, prezzo):
    """Profitto nella valuta del conto per un movimento di 1,0 del prezzo, calcolato da MT5
    (order_calc_profit: tiene conto di contract size e cambio valuta). Ricalcolato al massimo ogni
    60 secondi per simbolo/volume/lato: il cambio EUR/USD si muove, ma non ogni due secondi."""
    chiave = (symbol, tipo, round(float(volume or 0), 4))
    ora = time.time()
    c = _valore_punto_cache.get(chiave)
    if c and ora - c[1] < 60:
        return c[0]
    val = None
    try:
        ordine = mt5.ORDER_TYPE_BUY if tipo == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_SELL
        a, b = float(prezzo), float(prezzo) + 1.0
        if ordine == mt5.ORDER_TYPE_SELL:
            a, b = b, a
        r = mt5.order_calc_profit(ordine, symbol, float(volume), a, b)
        val = abs(float(r)) if r is not None else None
    except Exception:
        val = None
    _valore_punto_cache[chiave] = (val, ora)
    return val


def _cifre_simbolo(symbol):
    try:
        info = mt5.symbol_info(symbol)
        if info is not None:
            return int(info.digits), float(info.point)
    except Exception:
        pass
    return None, None


def _tempo_posizione(p) -> float:
    msc = getattr(p, "time_msc", 0) or 0
    return msc / 1000.0 if msc else float(p.time)


@app.get("/deal_reason")
def deal_reason(ticket: int):
    """Motivo REALE per cui la posizione col ticket indicato si è chiusa: SL, TP, STOP OUT
    (margin call del broker), MANUAL (chiusura da terminale/mobile/web, incluso il bottone
    "Chiudi" di questa stessa app — che passa dal terminale allo stesso modo) o EA. Letto dallo
    storico deal del broker (history_deals_get), MAI indovinato dal prezzo — usato dall'app per
    etichettare correttamente il Trade Journal quando una posizione reale si chiude senza che sia
    stata l'app a chiuderla (SL/TP reale colpito, Stop Out, o chiusura fatta a mano in MT5)."""
    if not mt5_connected:
        raise HTTPException(status_code=400, detail="Non connesso: chiama prima /connect")
    deals = mt5.history_deals_get(position=ticket)
    if not deals:
        return {"reason": None, "price": None}
    # L'ultimo deal in ordine cronologico per questa posizione DOVREBBE essere quello di CHIUSURA
    # (si chiama questo endpoint solo dopo aver visto la posizione sparire da /positions). Ma se
    # quella "sparizione" era un falso allarme (vedi il commento su positions_get()==None sopra),
    # nello storico di questo ticket esiste ancora SOLO il deal di APERTURA (entry=DEAL_ENTRY_IN):
    # la posizione, in realtà, non si è mai chiusa. Senza questo controllo si restituiva comunque
    # il suo motivo/prezzo come se fosse la chiusura — e siccome un ordine aperto via QUESTA
    # stessa API viene sempre classificato da MT5 con reason=EXPERT (aperto o chiuso che sia),
    # il Journal si ritrovava un trade fantasma "chiuso" ESATTAMENTE al prezzo di apertura
    # (0 pip, 0 P/L) con motivo "EA". segnaliamo questo caso a parte (stillOpen) invece di
    # fingere che sia una chiusura vera.
    last = deals[-1]
    entry_out_values = {v for v in (getattr(mt5, "DEAL_ENTRY_OUT", None), getattr(mt5, "DEAL_ENTRY_OUT_BY", None)) if v is not None}
    if entry_out_values and last.entry not in entry_out_values:
        return {"reason": None, "price": None, "stillOpen": True}
    label = DEAL_REASON_LABELS.get(last.reason, "MT5")
    # RICHIESTO ESPLICITAMENTE ("sincronizziamo perfettamente aperture e chiusure, non possono
    # esserci errori di visualizzazione"): oltre a motivo e prezzo, i dati VERI del deal. Prima
    # l'app usava come orario di chiusura la candela a schermo quando se ne accorgeva, e ricalcolava
    # il profitto da sola (in dollari, scritto come euro). Ora: orario al millisecondo del deal di
    # uscita e di quello di ingresso (corretti in UTC come /history_deals), profitto NETTO nella
    # valuta del conto (profitto + commissioni + swap + fee di tutti i deal della posizione) e il
    # saldo del conto adesso.
    offset = _offset_server_cache([last.symbol] if getattr(last, "symbol", "") else [])
    now_utc = time.time()
    entry_in_values = {v for v in (getattr(mt5, "DEAL_ENTRY_IN", None),) if v is not None}
    apertura = next((d for d in deals if d.entry in entry_in_values), None) if entry_in_values else deals[0]
    netto = 0.0
    for d in deals:
        netto += float(getattr(d, "profit", 0) or 0) + float(getattr(d, "commission", 0) or 0) \
            + float(getattr(d, "swap", 0) or 0) + float(getattr(d, "fee", 0) or 0)
    saldo = None
    try:
        info = mt5.account_info()
        saldo = float(info.balance) if info is not None else None
    except Exception:
        saldo = None
    return {
        "reason": label,
        "price": last.price,
        "time": min(_tempo_deal(last) - offset, now_utc),
        "time_open": (min(_tempo_deal(apertura) - offset, now_utc) if apertura is not None else None),
        "price_open": (apertura.price if apertura is not None else None),
        "volume": (apertura.volume if apertura is not None else None),
        "profit_net": round(netto, 2),
        "balance": saldo,
    }


def _tempo_deal(d) -> float:
    """Orario del deal in secondi, al millisecondo quando MT5 lo fornisce (time_msc)."""
    msc = getattr(d, "time_msc", 0) or 0
    return msc / 1000.0 if msc else float(d.time)


_offset_misurato_il = 0.0


def _offset_server_cache(preferred_symbols=()):
    """Scarto orologio server/UTC con la misura robusta di _estimate_server_offset_seconds
    (arrotondata alla mezz'ora, solo da tick freschi), ripetuta al massimo ogni 10 minuti: /positions
    la chiede ogni 2 secondi e rileggere 60 tick a ogni giro sarebbe uno spreco."""
    global _offset_misurato_il
    if _last_good_server_offset is not None and time.time() - _offset_misurato_il < 600:
        return _last_good_server_offset
    valore = _estimate_server_offset_seconds(preferred_symbols)
    _offset_misurato_il = time.time()
    return valore


@app.get("/history_deals")
def get_history_deals(from_ts: int, to_ts: int):
    """RICHIESTO ESPLICITAMENTE (segnalato: una posizione aperta all'1 di notte e chiusa alle 9,
    interamente mentre l'app era spenta, non è mai comparsa né sul grafico né nel Journal):
    /deal_reason serve solo per un ticket GIÀ noto all'app (dopo averlo visto sparire da
    /positions) — qui invece scandiamo lo storico deal per un INTERVALLO di tempo, per scoprire
    posizioni che l'app non ha MAI visto perché sono nate E morte interamente ad app spenta.
    Usato da fetchMt5HistoryDeals() lato app ad ogni riconnessione, con from_ts = l'ultima volta
    che risulta essere stata online.

    Raggruppa i deal per posizione (position_id) e restituisce SOLO le posizioni già CHIUSE
    all'interno dell'intervallo (un deal di apertura + uno di chiusura) — quelle ancora aperte le
    vede già /positions/l'adozione automatica, non vanno ripetute qui. Copre il caso comune (un
    ingresso pieno + un'uscita piena): chiusure parziali multiple o reversal in modalità netting
    (DEAL_ENTRY_INOUT) sono un caso più raro e restano fuori da questa prima versione, non
    inventiamo un comportamento per un caso che non abbiamo potuto verificare su un terminale
    reale.

    TP/SL: i deal MT5 NON li contengono (vivono sugli ORDINI, non sui deal) — letti qui da
    history_orders_get() della stessa posizione, prendendo l'ultimo valore impostato prima della
    chiusura. RICHIESTO ESPLICITAMENTE: se non risultano MAI impostati, restano None — mai
    stimati o indovinati, l'app non disegna alcuna casella in quel caso."""
    if not mt5_connected:
        raise HTTPException(status_code=400, detail="Non connesso: chiama prima /connect")
    # Margine ampio (±2 giorni) sull'intervallo passato a history_deals_get(): non c'è modo di
    # verificare qui, senza un terminale reale sottomano, se il pacchetto MetaTrader5 interpreta
    # date_from/date_to nell'orario SERVER del broker o in quello di questa macchina — uno scarto
    # sbagliato in un verso o nell'altro rischierebbe di perdere deal vicini al bordo. Il filtro
    # PRECISO sull'intervallo davvero richiesto avviene più sotto, DOPO aver corretto i timestamp
    # restituiti nel vero orario UTC (stessa identica correzione di /positions, vedi
    # _server_time_offset_seconds): un margine più ampio qui restituisce solo qualche deal extra
    # scartato subito dopo, mai la perdita di un deal vero.
    pad = 2 * 24 * 3600
    date_from = datetime.datetime.utcfromtimestamp(from_ts - pad)
    date_to = datetime.datetime.utcfromtimestamp(to_ts + pad)
    deals = mt5.history_deals_get(date_from, date_to)
    if deals is None:
        code, desc = mt5.last_error()
        raise HTTPException(status_code=503, detail=f"history_deals_get() non disponibile in questo momento (mt5.last_error={code} {desc}) — riprovare")
    if not deals:
        return []
    # Scarto orologio server/UTC calcolato UNA SOLA VOLTA — stesso identico scarto per TUTTI i
    # deal restituiti, perché è l'orologio del server del broker nel suo complesso, non qualcosa
    # che cambia da simbolo a simbolo. BUG RISOLTO: prima si usava il tick del simbolo del PRIMO
    # deal (deals[0]), che poteva essere un deposito (symbol vuoto -> scarto 0) o un simbolo fermo:
    # le chiusure recenti risultavano "nel futuro" e venivano scartate dal filtro qui sotto. Ora
    # si sceglie il tick più fresco fra tutti i simboli disponibili: vedi
    # _estimate_server_offset_seconds().
    offset = _estimate_server_offset_seconds(sorted({d.symbol for d in deals if getattr(d, "symbol", "")}))
    now_utc = int(time.time())

    entry_in_values = {v for v in (getattr(mt5, "DEAL_ENTRY_IN", None),) if v is not None}
    entry_out_values = {v for v in (getattr(mt5, "DEAL_ENTRY_OUT", None), getattr(mt5, "DEAL_ENTRY_OUT_BY", None)) if v is not None}
    # Solo i deal che rappresentano un vero ingresso/uscita di mercato (BUY/SELL): depositi,
    # prelievi, rettifiche contabili (DEAL_TYPE_BALANCE/CREDIT/CHARGE/CORRECTION/BONUS/
    # COMMISSION...) non sono posizioni di trading e vanno ignorati qui.
    trade_type_values = {v for v in (getattr(mt5, "DEAL_TYPE_BUY", None), getattr(mt5, "DEAL_TYPE_SELL", None)) if v is not None}

    by_position = {}
    for d in deals:
        if trade_type_values and d.type not in trade_type_values:
            continue
        by_position.setdefault(d.position_id, []).append(d)

    out = []
    for position_id, ds in by_position.items():
        ds.sort(key=lambda d: d.time)
        opens = [d for d in ds if d.entry in entry_in_values] if entry_in_values else [ds[0]]
        closes = [d for d in ds if d.entry in entry_out_values] if entry_out_values else []
        if closes and not opens:
            # Posizione tenuta aperta più a lungo del margine di ricerca: il deal di CHIUSURA è
            # nell'intervallo ma quello di APERTURA è più vecchio e non è stato restituito.
            # Prima veniva scartata in silenzio (nessuna apertura -> "dati incompleti"): la si
            # ricostruisce ora chiedendo a MT5 TUTTI i deal di quella posizione per numero.
            try:
                full = mt5.history_deals_get(position=position_id)
            except Exception:
                full = None
            if full:
                ds = sorted(
                    [d for d in full if not trade_type_values or d.type in trade_type_values],
                    key=lambda d: d.time,
                )
                opens = [d for d in ds if d.entry in entry_in_values] if entry_in_values else [ds[0]]
                closes = [d for d in ds if d.entry in entry_out_values] if entry_out_values else []
        if not opens or not closes:
            # Nessun deal di chiusura in questo intervallo: posizione ancora aperta (la vede già
            # /positions) oppure dati incompleti ai bordi dell'intervallo — mai inventata qui.
            continue
        open_deal = opens[0]
        close_deal = closes[-1]  # l'ultima uscita in ordine di tempo (copre anche più chiusure parziali)
        # Mai nel futuro: una chiusura/apertura già avvenuta non può essere dopo "adesso". Se lo
        # scarto orologio fosse ancora sbagliato per eccesso, meglio un orario un po' impreciso
        # che una posizione scartata (l'app deduplica comunque per ticket).
        open_time_utc = min(open_deal.time - offset, now_utc)
        close_time_utc = min(close_deal.time - offset, now_utc)
        # Filtro sull'intervallo richiesto (from_ts), sui timestamp ORA corretti in UTC — scarta i
        # deal extra inclusi solo per il margine di ±2 giorni sopra. TOLLERANTE (6 ore di respiro)
        # e SENZA limite superiore: prima il filtro stretto [from_ts, to_ts] scartava in silenzio
        # una chiusura vera appena lo scarto orologio risultava sbagliato; tenere un deal in più è
        # innocuo (l'app scarta i ticket già noti), perderne uno no.
        if close_time_utc < from_ts - 6 * 3600:
            continue
        sl = None
        tp = None
        orders = mt5.history_orders_get(position=position_id)
        if orders:
            for o in sorted(orders, key=lambda o: getattr(o, "time_setup", 0)):
                if getattr(o, "sl", 0):
                    sl = o.sl
                if getattr(o, "tp", 0):
                    tp = o.tp
        out.append({
            "positionId": position_id,
            "symbol": open_deal.symbol,
            "side": "BUY" if open_deal.type == getattr(mt5, "DEAL_TYPE_BUY", -1) else "SELL",
            "volume": open_deal.volume,
            "priceOpen": open_deal.price,
            "priceClose": close_deal.price,
            "timeOpen": open_time_utc,
            "timeClose": close_time_utc,
            "sl": sl,
            "tp": tp,
            "profit": sum(d.profit for d in ds),
            "swap": sum(d.swap for d in ds),
            "commission": sum(d.commission for d in ds),
            "reason": DEAL_REASON_LABELS.get(close_deal.reason, "MT5"),
        })
    print(f"[history_deals] finestra {from_ts}..{to_ts}: {len(deals)} deal letti, "
          f"{len(by_position)} posizioni, {len(out)} chiuse restituite (scarto server/UTC {offset}s)")
    return out


@app.get("/account_history")
def get_account_history():
    """RICHIESTO ESPLICITAMENTE: statistiche del conto (P/L, numero trade, win/loss rate, pip,
    ultimo trade chiuso, profitto totale %) calcolate sui dati VERI del conto MT5 collegato,
    non sui trade simulati dell'app. Restituisce TUTTE le posizioni chiuse dello storico del conto
    (dal 2000 a oggi) raggruppando i deal per posizione, più il totale di depositi/prelievi
    (serve per il "profitto totale %" rispetto al capitale versato davvero).

    Più leggero di /history_deals: nessuna chiamata a history_orders_get() per posizione (SL/TP
    non servono per le statistiche). Una posizione è "chiusa" se ha almeno un deal di uscita e non
    risulta più aperta in positions_get() — una chiusura parziale di una posizione ancora aperta
    non viene contata finché non si chiude del tutto (come fa la cronologia di MT5)."""
    if not mt5_connected:
        raise HTTPException(status_code=400, detail="Non connesso: chiama prima /connect")
    date_from = datetime.datetime(2000, 1, 1)
    date_to = datetime.datetime.utcfromtimestamp(int(time.time()) + 2 * 24 * 3600)
    deals = mt5.history_deals_get(date_from, date_to)
    if deals is None:
        code, desc = mt5.last_error()
        raise HTTPException(status_code=503, detail=f"history_deals_get() non disponibile in questo momento (mt5.last_error={code} {desc}) — riprovare")
    deals = list(deals or [])
    balance_type = getattr(mt5, "DEAL_TYPE_BALANCE", None)
    trade_types = {v for v in (getattr(mt5, "DEAL_TYPE_BUY", None), getattr(mt5, "DEAL_TYPE_SELL", None)) if v is not None}
    entry_in = {v for v in (getattr(mt5, "DEAL_ENTRY_IN", None),) if v is not None}
    entry_out = {v for v in (getattr(mt5, "DEAL_ENTRY_OUT", None), getattr(mt5, "DEAL_ENTRY_OUT_BY", None), getattr(mt5, "DEAL_ENTRY_INOUT", None)) if v is not None}

    deposits = 0.0
    withdrawals = 0.0
    by_position = {}
    for d in deals:
        if balance_type is not None and d.type == balance_type:
            if d.profit >= 0:
                deposits += d.profit
            else:
                withdrawals += -d.profit
            continue
        if trade_types and d.type not in trade_types:
            continue
        by_position.setdefault(d.position_id, []).append(d)

    still_open = set()
    try:
        for p in (mt5.positions_get() or []):
            still_open.add(p.ticket)
    except Exception:
        pass

    offset = _estimate_server_offset_seconds(sorted({d.symbol for d in deals if getattr(d, "symbol", "")}))
    now_utc = int(time.time())
    closed = []
    for position_id, ds in by_position.items():
        if position_id in still_open:
            continue
        ds.sort(key=lambda d: d.time)
        opens = [d for d in ds if d.entry in entry_in] if entry_in else ds[:1]
        closes = [d for d in ds if d.entry in entry_out]
        if not opens or not closes:
            continue
        open_deal = opens[0]
        close_deal = closes[-1]
        closed.append({
            "positionId": position_id,
            "symbol": open_deal.symbol,
            "side": "BUY" if open_deal.type == getattr(mt5, "DEAL_TYPE_BUY", -1) else "SELL",
            "volume": open_deal.volume,
            "priceOpen": open_deal.price,
            "priceClose": close_deal.price,
            "timeOpen": min(open_deal.time - offset, now_utc),
            "timeClose": min(close_deal.time - offset, now_utc),
            "profit": sum(d.profit for d in ds),
            "swap": sum(d.swap for d in ds),
            "commission": sum(d.commission for d in ds),
            "fee": sum(getattr(d, "fee", 0) or 0 for d in ds),
        })
    closed.sort(key=lambda c: c["timeClose"])
    print(f"[account_history] {len(deals)} deal letti, {len(closed)} posizioni chiuse, depositi {deposits:.2f}, prelievi {withdrawals:.2f}")
    return {"closed": closed, "deposits": deposits, "withdrawals": withdrawals}


@app.post("/order/market")
def order_market(body: OrderRequest):
    """Apre un ordine VERO a mercato sul conto collegato."""
    if not mt5_connected:
        raise HTTPException(status_code=400, detail="Non connesso: chiama prima /connect")
    _ensure_trading_allowed()
    side = body.side.upper()
    if side not in ("BUY", "SELL"):
        raise HTTPException(status_code=400, detail="side deve essere 'BUY' o 'SELL'.")
    if not (body.volume > 0):
        raise HTTPException(status_code=400, detail="Volume non valido.")

    info = _ensure_symbol(body.symbol)
    tick = mt5.symbol_info_tick(body.symbol)
    if tick is None:
        raise HTTPException(status_code=500, detail=f"Impossibile leggere la quotazione di {body.symbol}: {mt5.last_error()}")

    order_type = mt5.ORDER_TYPE_BUY if side == "BUY" else mt5.ORDER_TYPE_SELL
    price = tick.ask if side == "BUY" else tick.bid
    volume = _round_volume(info, body.volume)

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": body.symbol,
        "volume": volume,
        "type": order_type,
        "price": price,
        "deviation": 20,
        "magic": 20260910,
        "comment": (body.comment or "ForexBacktestLAB")[:31],
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": _pick_filling_mode(info),
    }
    if body.sl:
        request["sl"] = body.sl
    if body.tp:
        request["tp"] = body.tp

    result = _send_trying_fillings(request)
    return {"ticket": result.order, "deal": result.deal, "price": result.price, "volume": result.volume}


@app.post("/order/close")
def order_close(body: CloseRequest):
    """Chiude DAVVERO (in tutto o in parte) la posizione col ticket indicato."""
    if not mt5_connected:
        raise HTTPException(status_code=400, detail="Non connesso: chiama prima /connect")
    _ensure_trading_allowed()
    pos_list = mt5.positions_get(ticket=body.ticket)
    if not pos_list:
        raise HTTPException(status_code=404, detail=f"Posizione {body.ticket} non trovata (forse è già chiusa).")
    pos = pos_list[0]
    info = _ensure_symbol(pos.symbol)
    tick = mt5.symbol_info_tick(pos.symbol)
    if tick is None:
        raise HTTPException(status_code=500, detail=f"Impossibile leggere la quotazione di {pos.symbol}: {mt5.last_error()}")

    is_buy = pos.type == mt5.POSITION_TYPE_BUY
    close_type = mt5.ORDER_TYPE_SELL if is_buy else mt5.ORDER_TYPE_BUY
    price = tick.bid if is_buy else tick.ask

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": pos.symbol,
        "volume": pos.volume,
        "type": close_type,
        "position": pos.ticket,
        "price": price,
        "deviation": 20,
        "magic": 20260910,
        "comment": "ForexBacktestLAB close",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": _pick_filling_mode(info),
    }
    result = _send_trying_fillings(request)
    return {"ticket": result.order, "deal": result.deal, "price": result.price}


@app.post("/order/modify")
def order_modify(body: ModifyRequest):
    """Modifica DAVVERO lo Stop Loss/Take Profit della posizione col ticket indicato. Passare
    0 (o omettere il campo) rimuove il livello corrispondente, come fa il terminale MT5."""
    if not mt5_connected:
        raise HTTPException(status_code=400, detail="Non connesso: chiama prima /connect")
    _ensure_trading_allowed()
    pos_list = mt5.positions_get(ticket=body.ticket)
    if not pos_list:
        raise HTTPException(status_code=404, detail=f"Posizione {body.ticket} non trovata (forse è già chiusa).")
    pos = pos_list[0]

    request = {
        "action": mt5.TRADE_ACTION_SLTP,
        "symbol": pos.symbol,
        "position": pos.ticket,
        "sl": body.sl if body.sl is not None else (pos.sl or 0.0),
        "tp": body.tp if body.tp is not None else (pos.tp or 0.0),
    }
    result = _send_and_check(request)
    return {"ticket": result.order}


# ===================== ORDINI PENDENTI REALI (LIMIT/STOP) =====================
# Stessa logica di /order/market ma con TRADE_ACTION_PENDING invece di TRADE_ACTION_DEAL: non
# esegue subito, piazza un ordine in attesa sul conto vero che scatta da solo quando il prezzo
# raggiunge il livello indicato — esattamente come gli ordini pendenti simulati dell'app, ma
# reale.
_PENDING_ORDER_TYPES = {
    ("BUY", "LIMIT"): "ORDER_TYPE_BUY_LIMIT",
    ("SELL", "LIMIT"): "ORDER_TYPE_SELL_LIMIT",
    ("BUY", "STOP"): "ORDER_TYPE_BUY_STOP",
    ("SELL", "STOP"): "ORDER_TYPE_SELL_STOP",
}
# Inverso, per leggere GET /orders: dal tipo numerico MT5 al side/kind che usa l'app.
_PENDING_ORDER_TYPES_REV = {}
for _key, _attr in _PENDING_ORDER_TYPES.items():
    _val = getattr(mt5, _attr, None)
    if _val is not None:
        _PENDING_ORDER_TYPES_REV[_val] = _key


@app.post("/order/pending")
def order_pending(body: PendingOrderRequest):
    """Crea un ordine PENDENTE VERO (BUY/SELL LIMIT o STOP) sul conto collegato, con lo stesso
    SL/TP impostati a grafico nell'app."""
    if not mt5_connected:
        raise HTTPException(status_code=400, detail="Non connesso: chiama prima /connect")
    _ensure_trading_allowed()
    side = body.side.upper()
    kind = body.kind.upper()
    if (side, kind) not in _PENDING_ORDER_TYPES:
        raise HTTPException(status_code=400, detail="side deve essere 'BUY'/'SELL' e kind 'LIMIT'/'STOP'.")
    if not (body.volume > 0):
        raise HTTPException(status_code=400, detail="Volume non valido.")
    if not (body.price and body.price > 0):
        raise HTTPException(status_code=400, detail="Prezzo di entrata non valido.")

    info = _ensure_symbol(body.symbol)
    order_type = getattr(mt5, _PENDING_ORDER_TYPES[(side, kind)])
    volume = _round_volume(info, body.volume)

    request = {
        "action": mt5.TRADE_ACTION_PENDING,
        "symbol": body.symbol,
        "volume": volume,
        "type": order_type,
        "price": body.price,
        "deviation": 20,
        "magic": 20260910,
        "comment": (body.comment or "ForexBacktestLAB")[:31],
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": _pick_filling_mode(info),
    }
    if body.sl:
        request["sl"] = body.sl
    if body.tp:
        request["tp"] = body.tp

    result = _send_trying_fillings(request)
    return {"ticket": result.order, "price": body.price, "volume": result.volume}


@app.get("/orders")
def get_orders():
    """Ordini PENDENTI realmente in attesa ora sul conto collegato (non simulati) — non ancora
    scattati, per questo separati da /positions."""
    if not mt5_connected:
        raise HTTPException(status_code=400, detail="Non connesso: chiama prima /connect")
    orders = mt5.orders_get()
    if orders is None:
        return []
    out = []
    for o in orders:
        side, kind = _PENDING_ORDER_TYPES_REV.get(o.type, ("?", "?"))
        # Stessa correzione di /positions (vedi _server_time_offset_seconds): o.time_setup è
        # anch'esso nell'orario SERVER del broker, non UTC.
        tick = mt5.symbol_info_tick(o.symbol)
        out.append({
            "ticket": o.ticket,
            "symbol": o.symbol,
            "side": side,
            "kind": kind,
            "volume": o.volume_current,
            "price_open": o.price_open,
            "sl": o.sl if o.sl else None,
            "tp": o.tp if o.tp else None,
            "time_setup": o.time_setup - _server_time_offset_seconds(tick),
        })
    return out


@app.post("/order/cancel")
def order_cancel(body: CancelPendingRequest):
    """Cancella DAVVERO un ordine pendente (non ancora scattato) sul conto collegato."""
    if not mt5_connected:
        raise HTTPException(status_code=400, detail="Non connesso: chiama prima /connect")
    _ensure_trading_allowed()
    request = {
        "action": mt5.TRADE_ACTION_REMOVE,
        "order": body.ticket,
    }
    _send_and_check(request)
    return {"status": "cancelled", "ticket": body.ticket}


@app.post("/order/modify_pending")
def order_modify_pending(body: ModifyPendingRequest):
    """Modifica DAVVERO prezzo di entrata e/o SL/TP di un ordine pendente (non ancora scattato)
    sul conto collegato. Passare 0/omettere un campo lo lascia invariato (a differenza di
    /order/modify sulle posizioni aperte, qui il prezzo di entrata è obbligatorio per MT5: si
    riusa quello attuale se non indicato)."""
    if not mt5_connected:
        raise HTTPException(status_code=400, detail="Non connesso: chiama prima /connect")
    _ensure_trading_allowed()
    ord_list = mt5.orders_get(ticket=body.ticket)
    if not ord_list:
        raise HTTPException(status_code=404, detail=f"Ordine pendente {body.ticket} non trovato (forse è già scattato o cancellato).")
    o = ord_list[0]

    request = {
        "action": mt5.TRADE_ACTION_MODIFY,
        "order": body.ticket,
        "symbol": o.symbol,
        "price": body.price if body.price else o.price_open,
        "sl": body.sl if body.sl is not None else (o.sl or 0.0),
        "tp": body.tp if body.tp is not None else (o.tp or 0.0),
        "type_time": mt5.ORDER_TIME_GTC,
    }
    result = _send_and_check(request)
    return {"ticket": result.order}


# ===================== ASSET STATICI DELL'APP (manifest.json, icone, sw.js...) =====
# Va registrato DOPO tutte le rotte API sopra (/health, /positions, /order/..., ecc.):
# FastAPI/Starlette controlla le rotte nell'ordine in cui sono state definite, quindi
# le rotte API con un percorso esatto (es. "/positions") vengono sempre trovate PRIMA
# di arrivare a questo mount "cattura-tutto" — che quindi si limita a servire i file
# che nessun'altra rotta gestisce già (manifest.json, icon-192.png, sw.js, ecc.), da
# quello stesso _BASE_DIR. Se _BASE_DIR non esiste (caso limite, non dovrebbe succedere
# visto che è la cartella di bridge.py stesso), evitiamo di far crashare l'avvio.
if os.path.isdir(_BASE_DIR):
    app.mount("/", StaticFiles(directory=_BASE_DIR), name="static-assets")


if __name__ == "__main__":
    # Eseguito SOLO quando bridge.py (o l'eseguibile compilato da esso) viene avviato
    # direttamente — MAI quando lo si lancia con "uvicorn bridge:app --reload" da riga
    # di comando (quel flusso, usato oggi nello sviluppo/uso personale, resta invariato
    # e non passa da qui). Servizio invisibile in background, come richiesto: NESSUNA
    # finestra console (build_exe.bat usa --windowed) e NESSUN browser aperto in
    # automatico — quest'ultimo, in realtà, non serviva nemmeno prima nel flusso reale:
    # il cliente apre già app.html dal sito (GitHub Pages), non da qui; questo bridge
    # gli parla solo via HTTP su 127.0.0.1 quando quella pagina clicca "Connetti".
    import uvicorn

    PORT = 8000
    _kill_stale_instances()  # PRIMA di tutto: vedi commento sulla funzione — garantisce che questa
                              # istanza (sempre la più recente) sostituisca una eventuale precedente
                              # ancora viva, invece di fallire il bind e lasciarla in esecuzione.
    print(f"Forex Backtest LAB — servizio bridge avviato su http://127.0.0.1:{PORT}/ "
          f"(nessuna finestra: log su {_LOG_FILE_PATH or '(nessun file di log disponibile)'})")
    _start_mt5_feed_server()  # vedi commento sulla funzione: best-effort, non blocca questo avvio
    # SOLO 127.0.0.1, sempre: dagli altri dispositivi si arriva con Tailscale Serve (vedi
    # accesso_condiviso.py), che parla con questo servizio in locale.
    _host = _accesso.host_di_ascolto()
    if ACCESSO_REMOTO.get("rete"):
        print("  Accesso da altri dispositivi ACCESO (via Tailscale): serve la chiave.")
    uvicorn.run(app, host=_host, port=PORT)
