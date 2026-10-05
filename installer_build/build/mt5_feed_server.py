"""
Bridge feed MT5 — Forex Backtest LAB — DATI GRAFICO (storico + tick live)

Usato da app.html quando un conto MT5 è collegato: il grafico (storico + candela in corso) passa
in esclusiva a questo servizio finché resti connesso, poi torna in automatico a Capital.com alla
disconnessione — vedi syncChartSourceWithMt5()/loadLiveHistoryFromMt5() in app.html.

SCOPO E ISOLAMENTO — LEGGERE PRIMA DI AVVIARLO:
Questo è un servizio SEPARATO da bridge.py, di proposito. bridge.py è il processo che apre/
chiude/modifica ordini VERI sul tuo conto MT5: qualunque bug in un nuovo canale dati ad alta
frequenza (storico candele + tick live via WebSocket) NON deve girare nello stesso processo che
esegue quegli ordini. Questo file gira come un secondo processo, sulla PORTA 8001 (bridge.py
resta sulla 8000, invariato), e non tocca mai order_send/positions_get/ecc: legge solo prezzi.
Se questo processo va in crash, va in leak di memoria/thread, o si blocca, bridge.py e
l'esecuzione dei tuoi ordini reali restano completamente intatti — sono due processi Windows
separati, senza memoria condivisa.

Come funziona l'aggancio a MT5: il pacchetto MetaTrader5 parla con il terminale via IPC locale.
Più processi possono agganciarsi allo STESSO terminale già aperto e già loggato (ognuno con la
sua chiamata mt5.initialize(), indipendente) — per questo questo servizio NON chiede login/
password: si aggancia in sola lettura al terminale che bridge.py ha già connesso. Se il terminale
non è aperto/loggato, /health lo segnala chiaramente.

mt5_feed_test.html resta disponibile come pagina di diagnostica standalone (isolata dall'app
vera) per verificare a occhio storico/tick in caso di dubbi, ma non è più un prerequisito per
l'uso normale: app.html ci parla direttamente.

THREAD-SAFETY (importante, causa di un bug reale già risolto): il pacchetto MetaTrader5 NON è
thread-safe — chiamate concorrenti da thread diversi dello stesso processo possono lasciare l'IPC
col terminale in uno stato bloccato (sintomo osservato: l'aggiornamento tick si ferma in silenzio,
tipicamente proprio al cambio candela, quando /history e il loop del WebSocket si sovrappongono).
Ogni chiamata mt5.* in questo file passa quindi da _mt5_call(), che la serializza dietro un lock
globale — NON aggiungere mai una chiamata mt5.* diretta altrove in questo file.

Installazione (stesso ambiente Python di bridge.py):
    pip install fastapi "uvicorn[standard]" MetaTrader5
NOTA IMPORTANTE: serve "uvicorn[standard]" (non il solo "uvicorn") — la versione "nuda" non
include una libreria WebSocket, e la rotta /ws/ticks/... risponde 404 con un warning "No
supported WebSocket library detected" invece di aprire lo stream. Se hai già installato uvicorn
senza [standard], basta: pip install "uvicorn[standard]"  (oppure, senza reinstallare uvicorn:
pip install websockets).

Avvio (in una finestra separata da quella di bridge.py — devono girare ENTRAMBI insieme):
    uvicorn mt5_feed_server:app --port 8001

Test rapido:
    GET  http://127.0.0.1:8001/health
    GET  http://127.0.0.1:8001/symbol-check?symbol=EURUSD
    GET  http://127.0.0.1:8001/history?symbol=EURUSD&timeframe=M1&count=300
    WS   ws://127.0.0.1:8001/ws/ticks/EURUSD
    WS   ws://127.0.0.1:8001/ws/orderbook/EURUSD   (Market Depth/DOM — solo se il broker lo pubblica
                                                     per quel simbolo, vedi ws_orderbook())
"""

import asyncio
import json
import math
import os
import re
import sys
import threading
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import MetaTrader5 as mt5

# ===================== BUG RISOLTO ("AttributeError: 'NoneType' object has no attribute
# 'isatty'" all'avvio di Mt5FeedServer.exe) =====================
# Stessa identica causa/fix già presente in bridge.py (vedi lì il commento gemello, non
# duplicato qui per esteso): PyInstaller compilato con --windowed (vedi build_exe.bat) imposta
# sys.stdout/sys.stderr a None quando il programma non è lanciato da un terminale — uvicorn, in
# fase di avvio, configura il proprio logging colorato chiamando sys.stdout.isatty(), che con
# stdout=None crasha subito ("NoneType has no attribute isatty"), PRIMA ancora che il servizio
# dati arrivi a partire. bridge.py aveva già risolto lo stesso problema per sé (redirect su file
# di log accanto all'eseguibile) ma mt5_feed_server.py — file separato, processo separato di
# proposito, vedi il commento in cima — non l'aveva mai ereditato: qui sotto lo stesso rimedio,
# con un file di log proprio (Mt5FeedServer.log) così i due processi non condividono nulla.
if getattr(sys, "frozen", False) and sys.stdout is None:
    try:
        _log_fh = open(os.path.join(os.path.dirname(sys.executable), "Mt5FeedServer.log"), "a", buffering=1, encoding="utf-8")
        sys.stdout = _log_fh
        sys.stderr = _log_fh
    except Exception:
        import io
        sys.stdout = io.StringIO()
        sys.stderr = io.StringIO()

app = FastAPI(title="Forex Backtest LAB — Feed dati MT5 (prototipo, sola lettura)")

# Accesso da altri dispositivi: stessa chiave e stesso file degli altri due servizi. Senza questo,
# dal telefono il grafico resta vuoto anche quando la prova del collegamento riesce (la prova
# tocca la porta 8000, non questa).
# Import OBBLIGATORIO: con Tailscale Serve anche il tablet arriva da 127.0.0.1, e senza questo
# modulo nessuno saprebbe distinguerlo dal PC. Un servizio che non parte e' meglio di uno che
# parte senza controllo.
import accesso_condiviso as _accesso
_ACCESSO = _accesso.carica_accesso()

# ===================== BUG RISOLTO ("l'aggiornamento si blocca esattamente al cambio candela") =====================
# Causa: il pacchetto MetaTrader5 NON è thread-safe — le sue funzioni parlano col terminale via
# IPC e non supportano chiamate concorrenti da thread diversi dello stesso processo (limite
# documentato del pacchetto stesso, non un bug nostro). /history gira come funzione sync (FastAPI
# la esegue in un thread del suo threadpool) mentre /ws/ticks/{symbol} interroga mt5.* ogni 150ms
# anch'essa tramite thread separati (asyncio.to_thread) — cioè DUE thread diversi che possono
# chiamare mt5.* nello STESSO istante. Al cambio candela l'app richiede subito un resync via
# REST (/history) MENTRE il loop tick del WebSocket sta ancora girando: quella sovrapposizione è
# il momento in cui la collisione capita quasi sempre. L'effetto osservato (non un crash, non un
# errore visibile): una chiamata mt5.symbol_info_tick() dentro il loop del WebSocket comincia a
# restituire None per sempre, il loop continua a girare silenziosamente senza più mandare nessun
# messaggio — il WebSocket resta aperto (niente onclose) ma smette di aggiornare per sempre,
# esattamente il sintomo "si interrompe l'aggiornamento delle candele successive".
# Fix: un lock GLOBALE attorno a OGNI chiamata mt5.* in questo file, così non ne può mai partire
# più di una alla volta, qualunque sia il thread/endpoint di provenienza — è la soluzione
# standard raccomandata per questo limite noto del pacchetto.
_mt5_lock = threading.Lock()


def _mt5_call(fn, *args, **kwargs):
    """Esegue UNA chiamata mt5.* sotto il lock globale — vedi commento sopra. Usare SEMPRE
    questa invece di chiamare mt5.* direttamente, in ogni funzione di questo file (sync o dentro
    asyncio.to_thread), altrimenti la protezione ha dei buchi."""
    with _mt5_lock:
        return fn(*args, **kwargs)

# CORS aperto come in bridge.py: la pagina di test/l'app girano da file:// o da un dominio
# diverso da localhost, quindi il browser deve poter chiamare questo servizio da lì.
app.add_middleware(CORSMiddleware, **_accesso.opzioni_cors())   # vedi opzioni_cors(): rete privata

# Chi non arriva dal PC stesso deve presentare la chiave (vale solo quando l'accesso
# da altri dispositivi e' acceso; in locale non cambia niente).
_accesso.installa_controllo_chiave(app)

TIMEFRAME_MAP = {
    "M1": mt5.TIMEFRAME_M1,
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
    "M30": mt5.TIMEFRAME_M30,
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
    "W1": mt5.TIMEFRAME_W1,
    "MN1": mt5.TIMEFRAME_MN1,
}


def _ensure_initialized():
    """Aggancio in sola lettura al terminale MT5 già aperto (nessun login qui: le credenziali
    restano competenza esclusiva di bridge.py). Chiamata a inizio di ogni endpoint, così se il
    terminale non è ancora aperto/loggato lo segnaliamo con un messaggio chiaro invece di un
    500 generico."""
    try:
        ok = _mt5_call(mt5.initialize)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eccezione agganciandosi al terminale MT5: {e}")
    if not ok:
        raise HTTPException(
            status_code=503,
            detail=f"Impossibile agganciarsi al terminale MT5 ({_mt5_call(mt5.last_error)}). Il terminale "
                   f"deve essere aperto e loggato (normalmente tramite bridge.py/'Connetti' "
                   f"nell'app) prima di usare questo servizio dati.",
        )


def _server_time_offset_seconds(tick) -> int:
    """Stessa identica logica di _server_time_offset_seconds() in bridge.py (vedi lì il
    commento completo): l'orologio del server del broker spesso non è UTC. Calcoliamo lo scarto
    da un tick REALE appena letto (copre quindi anche l'ora legale) e lo sottraiamo da ogni
    timestamp prima di restituirlo, arrotondato al minuto per eliminare il jitter di rete/IPC."""
    if tick is None or not getattr(tick, "time", None):
        return 0
    # ARROTONDATO AL QUARTO D'ORA, non piu' al minuto (SEGNALATO: "sul telefono le candele si
    # fermano dopo un po' e si muovono solo a fine candela"). tick.time e' l'ora dell'ULTIMO tick:
    # a mercato calmo puo' essere vecchio di oltre 30 s, e l'arrotondamento al minuto dava uno scarto
    # sbagliato di un minuto intero - le candele "saltavano" avanti di un minuto e il telefono
    # scartava i prezzi fino al ricaricamento di fine candela. Gli scarti dei broker sono ore intere
    # (o mezz'ore): al quarto d'ora il risultato e' lo stesso con un tick vecchio fino a 7 minuti e
    # con l'orologio del PC sbagliato di qualche minuto.
    try:
        return round((tick.time - time.time()) / 900) * 900
    except Exception:
        return 0


def _resolve_symbol(symbol: str) -> Optional[str]:
    """Trova il simbolo esatto su QUESTO broker: prima un match esatto, poi (per broker che
    aggiungono suffissi tipo .a/.m/.pro) un match case-insensitive per prefisso/contenuto. Non
    sceglie da sola quale usare in caso di ambiguità — restituisce solo la prima corrispondenza
    utile per questo endpoint di sola lettura; la logica di conferma/fallback per l'app vera
    (popup, nessun impatto sul conto reale) è un passo successivo, non ancora implementato qui."""
    info = _mt5_call(mt5.symbol_info, symbol)
    if info is not None:
        return symbol
    all_symbols = _mt5_call(mt5.symbols_get)
    if not all_symbols:
        return None
    target = symbol.upper()
    for s in all_symbols:
        if s.name.upper() == target:
            return s.name
    for s in all_symbols:
        if s.name.upper().startswith(target):
            return s.name
    for s in all_symbols:
        if target in s.name.upper():
            return s.name
    return None


@app.get("/health")
def health():
    try:
        ok = _mt5_call(mt5.initialize)
    except Exception as e:
        return {"ok": False, "mt5_initialized": False, "detail": str(e)}
    if not ok:
        return {"ok": False, "mt5_initialized": False, "detail": str(_mt5_call(mt5.last_error))}
    term = _mt5_call(mt5.terminal_info)
    acc = _mt5_call(mt5.account_info)
    return {
        "ok": True,
        "mt5_initialized": True,
        "connected_to_broker": bool(term.connected) if term is not None else None,
        "account_login": acc.login if acc is not None else None,
        "account_server": acc.server if acc is not None else None,
    }


@app.get("/symbol-check")
def symbol_check(symbol: str):
    """Sola lettura: esiste questo simbolo su questo broker? Se no, propone candidati per nome
    simile (es. EURUSD -> EURUSD.a). NON decide nulla da sola e non seleziona/abilita il
    simbolo per il trading: è solo un aiuto diagnostico per il test di questo prototipo."""
    _ensure_initialized()
    info = _mt5_call(mt5.symbol_info, symbol)
    if info is not None:
        return {
            "found": True,
            "resolved_symbol": symbol,
            "digits": info.digits,
            "point": info.point,
            "candidates": [],
        }
    all_symbols = _mt5_call(mt5.symbols_get) or []
    target = symbol.upper()
    candidates = sorted({s.name for s in all_symbols if target in s.name.upper()})[:15]
    return {"found": False, "resolved_symbol": None, "digits": None, "point": None, "candidates": candidates}


_SIMBOLI = {"t": 0.0, "lista": []}


def _tipo_da_percorso(percorso: str, nome: str) -> str:
    p = (percorso or "").lower()
    if "crypto" in p or "cripto" in p:
        return "crypto"
    if "forex" in p or "fx" in p.split("\\")[0:1] or "currenc" in p:
        return "forex"
    if "metal" in p or "commod" in p or "energ" in p or "oil" in p:
        return "commodity"
    if "indic" in p or "index" in p or "indices" in p or "cash" in p:
        return "index"
    if "stock" in p or "share" in p or "equit" in p or "azion" in p:
        return "share"
    return "other"


@app.get("/symbols")
def symbols(q: str = "", limit: int = 30):
    """RICHIESTO: la ricerca simboli dell'app guarda PRIMA il broker MT5. Sola lettura: nome,
    descrizione e cartella dei simboli del broker che contengono il testo cercato (nel nome o nella
    descrizione), i piu' somiglianti per primi. Elenco tenuto in memoria 5 minuti."""
    _ensure_initialized()
    if time.time() - _SIMBOLI["t"] > 300 or not _SIMBOLI["lista"]:
        tutti = _mt5_call(mt5.symbols_get) or []
        _SIMBOLI["lista"] = [{"nome": s.name, "descrizione": getattr(s, "description", "") or "",
                              "percorso": getattr(s, "path", "") or ""} for s in tutti]
        _SIMBOLI["t"] = time.time()
    norm = lambda s: "".join(ch for ch in (s or "").upper() if ch.isalnum())
    cerca = norm(q)
    if len(cerca) < 2:
        return {"simboli": []}
    trovati = []
    for s in _SIMBOLI["lista"]:
        n = norm(s["nome"])
        d = norm(s["descrizione"])
        if n == cerca:
            punti = 0
        elif n.startswith(cerca):
            punti = 1
        elif cerca in n:
            punti = 2
        elif cerca in d:
            punti = 3
        else:
            continue
        trovati.append((punti, len(n), s["nome"], s))
    trovati.sort(key=lambda x: x[:3])
    out = []
    for _, _, _, s in trovati[:max(1, min(100, int(limit)))]:
        out.append({**s, "tipo": _tipo_da_percorso(s["percorso"], s["nome"])})
    return {"simboli": out}


def _history_count_fallback_sequence(count: int):
    """Genera una sequenza di tentativi decrescenti a partire da `count` (dimezzando ogni volta,
    con un pavimento a 500 barre — sempre meglio di un grafico vuoto): il PRIMO tentativo resta
    sempre il count originale richiesto (nessuna perdita per chi il terminale lo supporta
    davvero), i successivi servono solo come rete di sicurezza se quel tetto risulta troppo alto
    per "Max. bars in chart" su QUESTO terminale — vedi il commento sopra in /history."""
    seq = [count]
    c = count
    floor = 500
    while c > floor:
        c = max(floor, c // 2)
        if c not in seq:
            seq.append(c)
    return seq


@app.get("/history")
def history(symbol: str, timeframe: str = "M1", count: int = 300):
    """Candele storiche per il grafico, timestamp GIA' corretti in UTC vero (vedi
    _server_time_offset_seconds). tick_volume incluso: è lo stesso TIPO di dato (conteggio tick,
    non volume reale — il forex/CFD è OTC) già usato oggi in app.html come lastTradedVolume da
    Capital.com, quindi confrontabile alla pari."""
    _ensure_initialized()
    if timeframe not in TIMEFRAME_MAP:
        raise HTTPException(status_code=400, detail=f"timeframe deve essere uno tra {list(TIMEFRAME_MAP)}.")
    # BUG RISOLTO (segnalato: "copy_rates_from_pos non ha restituito dati... (-2, 'Terminal:
    # Invalid params')"): il commento precedente qui sotto assumeva che copy_rates_from_pos()
    # non fallisse MAI per un count troppo alto — solo "restituisce quello che ha". Verificato che
    # NON è garantito: la documentazione ufficiale dice solo che le barre disponibili sono limitate
    # dall'impostazione del terminale "Max. bars in chart" (Strumenti → Opzioni → Grafici), ma non
    # garantisce che superare quel tetto dia un troncamento silenzioso invece di un errore duro —
    # ed è esattamente quello che è successo qui, dopo che il tetto era stato alzato da 5000 a
    # 200000: quel valore supera "Max. bars in chart" su questo terminale/broker (il default
    # tipico è 100000, ma varia — non è un valore che possiamo conoscere in anticipo, cambia da
    # installazione a installazione). Invece di indovinare un tetto fisso valido per tutti,
    # ritentiamo con count via via più piccoli finché uno funziona: robusto qualunque sia il
    # limite реale di QUESTO terminale, senza bisogno di conoscerlo.
    count = max(1, min(count, 200000))

    resolved = _resolve_symbol(symbol)
    if resolved is None:
        raise HTTPException(status_code=404, detail=f"Simbolo '{symbol}' non trovato su questo broker.")
    info_check = _mt5_call(mt5.symbol_info, resolved)
    if info_check is not None and not info_check.visible:
        _mt5_call(mt5.symbol_select, resolved, True)

    tick = _mt5_call(mt5.symbol_info_tick, resolved)
    offset = _server_time_offset_seconds(tick)

    rates = None
    last_err = None
    attempted_counts = []
    for attempt_count in _history_count_fallback_sequence(count):
        attempted_counts.append(attempt_count)
        rates = _mt5_call(mt5.copy_rates_from_pos, resolved, TIMEFRAME_MAP[timeframe], 0, attempt_count)
        if rates is not None and len(rates) > 0:
            break
        last_err = _mt5_call(mt5.last_error)
        rates = None
    if rates is None:
        raise HTTPException(
            status_code=502,
            detail=f"copy_rates_from_pos non ha restituito dati per '{resolved}' anche riprovando con count "
                   f"più bassi ({attempted_counts}) — ultimo errore: {last_err}. Controlla che il simbolo abbia "
                   f"davvero storico disponibile su questo broker, o riduci manualmente la profondità richiesta.",
        )

    candles = [
        {
            "time": int(r["time"]) - offset,
            "open": float(r["open"]),
            "high": float(r["high"]),
            "low": float(r["low"]),
            "close": float(r["close"]),
            "tick_volume": int(r["tick_volume"]),
        }
        for r in rates
    ]
    info_digits = _mt5_call(mt5.symbol_info, resolved)
    return {
        "ok": True,
        "symbol": resolved,
        "timeframe": timeframe,
        "utc_offset_seconds_applied": offset,
        "digits": info_digits.digits if info_digits is not None else None,
        "candles": candles,
    }


@app.get("/ticks")
def ticks(symbol: str, from_ms: int, to_ms: int, max_ticks: int = 50000):
    """Tick storici REALI (non stimati) per il backfill del footprint lato app.html, via
    mt5.copy_ticks_range(). A differenza di /history (candele OHLC), qui si ottengono i singoli
    tick bid/ask/last con flag COPY_TICKS_ALL — il dato che serve a ricostruire il footprint di
    candele passate per cui l'app non era aperta/collegata a quell'asset (invece di stimarle).

    LIMITE NOTO (non aggirabile da qui, dipende dal broker): molti broker retail conservano solo
    alcuni giorni/settimane di storico tick, molto meno delle candele OHLC — se copy_ticks_range
    restituisce vuoto per un range troppo indietro nel tempo è il broker che non ha più quel
    dato, non un bug di questo endpoint. Il chiamante deve gestire questo caso mostrando
    onestamente che il backfill non è disponibile per quel periodo, non inventando dati.

    from_ms/to_ms: timestamp UTC in millisecondi (stessa convenzione epoch già usata da
    app.html). Il risultato è troncato a max_ticks (default e tetto duro 50000), tenendo i tick
    PIÙ RECENTI del range se il conteggio disponibile è maggiore, così un range troppo ampio
    richiesto per errore non può far esplodere payload/memoria in un colpo solo — l'app rifà la
    richiesta a pezzi più piccoli se le serve andare più indietro.
    """
    _ensure_initialized()
    if to_ms <= from_ms:
        raise HTTPException(status_code=400, detail="to_ms deve essere maggiore di from_ms.")
    max_ticks = max(1, min(max_ticks, 50000))

    resolved = _resolve_symbol(symbol)
    if resolved is None:
        raise HTTPException(status_code=404, detail=f"Simbolo '{symbol}' non trovato su questo broker.")
    info_check = _mt5_call(mt5.symbol_info, resolved)
    if info_check is not None and not info_check.visible:
        _mt5_call(mt5.symbol_select, resolved, True)

    tick_now = _mt5_call(mt5.symbol_info_tick, resolved)
    offset = _server_time_offset_seconds(tick_now)

    # Converte l'intervallo UTC richiesto in "ora del server broker" — stessa convenzione di
    # offset già usata in /history (vedi _server_time_offset_seconds): broker_time = utc_time +
    # offset. copy_ticks_range vuole un datetime "ora del terminale", non UTC puro.
    date_from = datetime.utcfromtimestamp((from_ms / 1000.0) + offset)
    date_to = datetime.utcfromtimestamp((to_ms / 1000.0) + offset)

    raw = _mt5_call(mt5.copy_ticks_range, resolved, date_from, date_to, mt5.COPY_TICKS_ALL)
    if raw is None or len(raw) == 0:
        last_err = _mt5_call(mt5.last_error)
        return {
            "ok": True,
            "symbol": resolved,
            "utc_offset_seconds_applied": offset,
            "truncated": False,
            "count": 0,
            "ticks": [],
            "note": f"Nessun tick storico restituito dal broker per questo range (probabile limite di "
                    f"retention del broker, non un errore) — ultimo codice MT5: {last_err}.",
        }

    truncated = False
    if len(raw) > max_ticks:
        raw = raw[-max_ticks:]  # tiene i tick più RECENTI nel range richiesto, non i più vecchi
        truncated = True

    # FOOTPRINT REALE (passo 1): oltre a bid/ask/last/volume serve il campo "flags" di MetaTrader.
    # E' l'unico dato che dice con certezza da che parte stava l'AGGRESSORE di quel trade:
    #   TICK_FLAG_BUY = 32, TICK_FLAG_SELL = 64
    # Senza di esso l'app deve dedurlo confrontando "last" con bid/ask (regola at-bid / at-ask) e,
    # quando nemmeno "last" c'e', ripiegare sulla tick-rule (prezzo sale = compratore) — che e' una
    # STIMA, non order flow. Passando flags qui, l'app puo' usare il dato certo quando c'e' e dire
    # onestamente all'utente quale dei tre livelli di qualita' sta guardando.
    ticks_out = [
        {
            "time_ms": (float(r["time_msc"]) - offset * 1000.0) if r["time_msc"] else (int(r["time"]) - offset) * 1000.0,
            "bid": float(r["bid"]),
            "ask": float(r["ask"]),
            "last": float(r["last"]),
            "volume": float(r["volume_real"]) if r["volume_real"] else float(r["volume"]),
            "flags": int(r["flags"]) if "flags" in raw.dtype.names else 0,
        }
        for r in raw
    ]

    # Riepilogo della QUALITA' del dato su questo lotto di tick, calcolato sul dato vero e non
    # promesso a priori: e' il broker a decidere cosa riempie davvero. L'app lo usa per etichettare
    # il footprint come "volume reale", "at bid/ask" o "stimato dalla tick-rule", invece di
    # mostrare numeri che sembrano volume di borsa quando non lo sono.
    TICK_FLAG_BUY, TICK_FLAG_SELL = 32, 64
    n_last = sum(1 for t in ticks_out if t["last"] > 0)
    n_vol = sum(1 for t in ticks_out if t["volume"] > 0)
    n_flag = sum(1 for t in ticks_out if t["flags"] & (TICK_FLAG_BUY | TICK_FLAG_SELL))
    total = len(ticks_out) or 1
    if n_flag / total >= 0.5:
        quality = "flags"          # lato aggressore dichiarato dal broker: il dato migliore
    elif n_last / total >= 0.5:
        quality = "bidask"         # ricostruibile confrontando last con bid/ask
    else:
        quality = "tickrule"       # solo quotazioni: footprint stimato, non order flow reale
    return {
        "ok": True,
        "symbol": resolved,
        "utc_offset_seconds_applied": offset,
        "truncated": truncated,
        "count": len(ticks_out),
        "ticks": ticks_out,
        "quality": quality,
        "quality_detail": {
            "with_last": n_last,
            "with_volume": n_vol,
            "with_aggressor_flag": n_flag,
            "total": len(ticks_out),
        },
    }


@app.websocket("/ws/ticks/{symbol}")
async def ws_ticks(websocket: WebSocket, symbol: str):
    """Push dei tick live per un simbolo, un messaggio JSON per tick REALMENTE cambiato (niente
    spam di tick identici). Loop di polling a ~150ms sul terminale locale via IPC — ogni lettura
    gira in un thread separato (asyncio.to_thread) così non blocca mai il loop async, a
    differenza di una chiamata mt5.* diretta dentro un handler async."""
    # La chiave anche qui: il middleware HTTP non vede i WebSocket, e prima i dati
    # del grafico uscivano verso chiunque arrivasse alla porta.
    if not _accesso.websocket_autorizzato(websocket):
        await websocket.close(code=4403)
        return
    await websocket.accept()
    try:
        ok = await asyncio.to_thread(_mt5_call, mt5.initialize)
    except Exception as e:
        await websocket.send_json({"error": f"Eccezione agganciandosi al terminale MT5: {e}"})
        await websocket.close()
        return
    if not ok:
        last_err = await asyncio.to_thread(_mt5_call, mt5.last_error)
        await websocket.send_json({"error": f"Impossibile agganciarsi al terminale MT5 ({last_err})"})
        await websocket.close()
        return

    resolved = await asyncio.to_thread(_resolve_symbol, symbol)
    if resolved is None:
        await websocket.send_json({"error": f"Simbolo '{symbol}' non trovato su questo broker."})
        await websocket.close()
        return
    info = await asyncio.to_thread(_mt5_call, mt5.symbol_info, resolved)
    if info is not None and not info.visible:
        await asyncio.to_thread(_mt5_call, mt5.symbol_select, resolved, True)

    last_time = None
    last_bid = None
    last_ask = None
    # RETE DI SICUREZZA aggiuntiva (oltre al lock globale sopra, che è la fix vera): se
    # symbol_info_tick() dovesse comunque restituire None per troppi giri di fila (es. il
    # terminale MT5 è stato chiuso/disconnesso a metà sessione, non solo una collisione di
    # thread), ritentiamo un mt5.initialize() per provare a recuperare l'aggancio invece di
    # continuare a girare in silenzio per sempre senza mai più mandare un messaggio.
    consecutive_none = 0
    # ===================== BUG RISOLTO ("al termine della candela aggiorna ad X tempo a seconda
    # del timeframe selezionato", con più riconnessioni WS ravvicinate in log) =====================
    # Causa: qui sotto mandavamo un messaggio SOLO quando il prezzo cambiava davvero ("niente spam
    # di tick identici", commento originale) -- corretto in sé, ma app.html usa "tempo trascorso
    # dall'ULTIMO MESSAGGIO ricevuto" come unico segnale di "il canale è vivo" (startMt5RefreshTimer,
    # soglia 8s: se non arriva NULLA in 8s, disconnette e riconnette, pensando che il socket sia
    # morto). Su molti simboli/broker (es. XAUUSD fuori dagli orari più liquidi) il prezzo può
    # restare fermo per PIÙ di 8s anche col terminale perfettamente funzionante: nessun messaggio ->
    # il client crede la connessione morta -> disconnette/riconnette inutilmente, in loop, ogni
    # ~8-10s. L'unico aggiornamento visibile che restava era quindi la risincronizzazione forzata a
    # ogni cambio candela (vedi startMt5RefreshTimer in app.html) -- la cui cadenza coincide
    # ESATTAMENTE col timeframe scelto, che è precisamente il sintomo descritto.
    # Fix: un "battito" leggero (nessun prezzo, solo prova di vita) ogni HEARTBEAT_INTERVAL secondi
    # quando non c'è un tick nuovo da mandare -- il client lo usa SOLO per capire che il canale è
    # vivo (mai per aggiornare il prezzo), eliminando le riconnessioni spurie senza reintrodurre lo
    # spam di prezzi duplicati sul grafico.
    HEARTBEAT_INTERVAL = 2.0
    last_sent_at = time.time()
    try:
        while True:
            tick = await asyncio.to_thread(_mt5_call, mt5.symbol_info_tick, resolved)
            if tick is not None:
                consecutive_none = 0
                if tick.time != last_time or tick.bid != last_bid or tick.ask != last_ask:
                    last_time, last_bid, last_ask = tick.time, tick.bid, tick.ask
                    offset = _server_time_offset_seconds(tick)
                    # FOOTPRINT REALE (passo 1): "flags" e "volume_real" servono anche al
                    # vivo, non solo nel backfill storico — altrimenti il footprint costruito
                    # mentre si guarda il grafico sarebbe di qualita' PEGGIORE di quello
                    # ricostruito dopo, il che e' esattamente il contrario di quel che serve.
                    # time_ms al millisecondo: tick.time e' al secondo e schiaccerebbe nello
                    # stesso istante piu' trade dello stesso secondo.
                    await websocket.send_json({
                        "symbol": resolved,
                        "time": int(tick.time) - offset,
                        "time_ms": (float(tick.time_msc) - offset * 1000.0) if getattr(tick, "time_msc", 0) else (int(tick.time) - offset) * 1000.0,
                        "bid": tick.bid,
                        "ask": tick.ask,
                        "last": tick.last,
                        "volume": float(getattr(tick, "volume_real", 0) or tick.volume or 0),
                        "flags": int(getattr(tick, "flags", 0) or 0),
                    })
                    last_sent_at = time.time()
                elif (time.time() - last_sent_at) >= HEARTBEAT_INTERVAL:
                    await websocket.send_json({"heartbeat": True, "symbol": resolved})
                    last_sent_at = time.time()
            else:
                consecutive_none += 1
                if consecutive_none >= 20:  # ~3s senza un tick valido: prova a riagganciare
                    consecutive_none = 0
                    await asyncio.to_thread(_mt5_call, mt5.initialize)
            await asyncio.sleep(0.15)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"error": f"Eccezione nel loop tick: {e}"})
        except Exception:
            pass


def _book_snapshot_to_json(resolved: str, book) -> dict:
    """Converte una lettura di mt5.market_book_get() in {bids,asks}: bid = livelli in acquisto
    (BOOK_TYPE_BUY/BOOK_TYPE_BUY_MARKET), ask = livelli in vendita (BOOK_TYPE_SELL/
    BOOK_TYPE_SELL_MARKET) — stessa distinzione usata da MT5 stesso nella finestra "Profondità di
    mercato" del terminale. volume_dbl (se >0) è il volume col decimale reale del broker,
    altrimenti si ricade sul solo volume (intero, in lotti minimi) — mai un valore inventato.
    Ordinati per prezzo: bid decrescente (il migliore in cima), ask crescente (il migliore in
    cima), esattamente come si leggerebbe un vero book."""
    bids = []
    asks = []
    for lvl in (book or ()):
        vol = float(lvl.volume_dbl) if getattr(lvl, "volume_dbl", 0) else float(lvl.volume)
        entry = {"price": float(lvl.price), "volume": vol}
        if lvl.type in (mt5.BOOK_TYPE_BUY, mt5.BOOK_TYPE_BUY_MARKET):
            bids.append(entry)
        elif lvl.type in (mt5.BOOK_TYPE_SELL, mt5.BOOK_TYPE_SELL_MARKET):
            asks.append(entry)
    bids.sort(key=lambda e: -e["price"])
    asks.sort(key=lambda e: e["price"])
    return {"symbol": resolved, "time_ms": time.time() * 1000.0, "bids": bids, "asks": asks}


@app.websocket("/ws/orderbook/{symbol}")
async def ws_orderbook(websocket: WebSocket, symbol: str):
    """Push del Market Depth (DOM) — il vero book bid/ask in attesa, non i tick eseguiti (vedi
    /ws/ticks per quelli) — usato da app.html per l'Order Book Profile (istogramma a sinistra nel
    profilo volumetrico) e per la heatmap di liquidità. RICHIEDE che il BROKER pubblichi davvero
    il Market Depth per questo simbolo: molti broker Forex/CFD OTC non lo fanno (è molto più
    comune su strumenti quotati su una borsa vera, es. futures/azioni) — in quel caso
    market_book_add() qui sotto restituisce False e mandiamo un errore chiaro, MAI un book finto
    al suo posto. Stesso schema di polling di /ws/ticks (mt5.market_book_get() non ha un
    callback nel pacchetto Python: va interrogato a intervalli regolari), stesso lock globale
    _mt5_call() per la thread-safety, stesso heartbeat per non far credere al client che il
    canale sia morto quando il book resta semplicemente invariato per un po'."""
    # La chiave anche qui: il middleware HTTP non vede i WebSocket, e prima i dati
    # del grafico uscivano verso chiunque arrivasse alla porta.
    if not _accesso.websocket_autorizzato(websocket):
        await websocket.close(code=4403)
        return
    await websocket.accept()
    try:
        ok = await asyncio.to_thread(_mt5_call, mt5.initialize)
    except Exception as e:
        await websocket.send_json({"error": f"Eccezione agganciandosi al terminale MT5: {e}"})
        await websocket.close()
        return
    if not ok:
        last_err = await asyncio.to_thread(_mt5_call, mt5.last_error)
        await websocket.send_json({"error": f"Impossibile agganciarsi al terminale MT5 ({last_err})"})
        await websocket.close()
        return

    resolved = await asyncio.to_thread(_resolve_symbol, symbol)
    if resolved is None:
        await websocket.send_json({"error": f"Simbolo '{symbol}' non trovato su questo broker."})
        await websocket.close()
        return
    info = await asyncio.to_thread(_mt5_call, mt5.symbol_info, resolved)
    if info is not None and not info.visible:
        await asyncio.to_thread(_mt5_call, mt5.symbol_select, resolved, True)

    added = await asyncio.to_thread(_mt5_call, mt5.market_book_add, resolved)
    if not added:
        last_err = await asyncio.to_thread(_mt5_call, mt5.last_error)
        await websocket.send_json({
            "error": f"Il broker non pubblica il Market Depth (DOM) per '{resolved}' su questo "
                     f"terminale (market_book_add ha restituito False, ultimo codice MT5: {last_err}). "
                     f"Frequente sui simboli Forex/CFD OTC: nessun order book reale da mostrare per "
                     f"questo strumento — non è un errore di questo servizio.",
        })
        await websocket.close()
        return

    HEARTBEAT_INTERVAL = 2.0
    last_sent_at = time.time()
    last_sig = None
    try:
        while True:
            book = await asyncio.to_thread(_mt5_call, mt5.market_book_get, resolved)
            if book:
                snap = _book_snapshot_to_json(resolved, book)
                # Firma leggera (solo prezzo+volume di ogni livello) per mandare un messaggio
                # SOLO quando il book è davvero cambiato, stesso principio anti-spam di /ws/ticks.
                sig = tuple((e["price"], e["volume"]) for e in snap["bids"]) + \
                    tuple((e["price"], e["volume"]) for e in snap["asks"])
                if sig != last_sig:
                    last_sig = sig
                    await websocket.send_json(snap)
                    last_sent_at = time.time()
                elif (time.time() - last_sent_at) >= HEARTBEAT_INTERVAL:
                    await websocket.send_json({"heartbeat": True, "symbol": resolved})
                    last_sent_at = time.time()
            elif (time.time() - last_sent_at) >= HEARTBEAT_INTERVAL:
                # Book vuoto (nessun livello in questo istante, es. fuori orario): comunque vivo.
                await websocket.send_json({"heartbeat": True, "symbol": resolved})
                last_sent_at = time.time()
            await asyncio.sleep(0.25)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"error": f"Eccezione nel loop order book: {e}"})
        except Exception:
            pass
    finally:
        # Disiscrizione esplicita: senza questa il terminale continua a mantenere/inviare
        # aggiornamenti di book per un simbolo che nessuno sta più guardando (leak lato terminale,
        # non solo lato nostro processo) — chiamata anche se il client si è solo disconnesso.
        try:
            # Il registratore (vedi registratore.py) puo' seguire lo stesso simbolo: in quel caso il
            # book resta sottoscritto, altrimenti la sua registrazione si fermerebbe.
            if not (_REG and _REG.book_mt5 and _REG.book_mt5.usa(resolved)):
                await asyncio.to_thread(_mt5_call, mt5.market_book_release, resolved)
        except Exception:
            pass


# ============================================================================= REGISTRATORE
# RICHIESTO ("la registrazione deve continuare anche ad app chiusa, impeccabile" e "salviamo anche
# tick e candele per caricarli come CSV per il backtest"): vedi registratore.py. Parte con questo
# servizio e registra per gli asset della watchlist che l'app gli comunica.
import registratore as _reg
from fastapi import Request
from fastapi.responses import StreamingResponse

_REG = None


def _scarto_simbolo(risolto: str) -> int:
    try:
        return _server_time_offset_seconds(_mt5_call(mt5.symbol_info_tick, risolto))
    except Exception:
        return 0


def _risolvi_quieto(simbolo: str) -> Optional[str]:
    try:
        return _resolve_symbol(simbolo)
    except Exception:
        return None


@app.on_event("startup")
async def _avvia_registratore():
    global _REG
    try:
        _REG = _reg.Registratore(_reg.BookMt5(_mt5_call, mt5, _risolvi_quieto, _book_snapshot_to_json),
                                 _reg.TickMt5(_mt5_call, mt5, _risolvi_quieto, _scarto_simbolo))
        _REG.avvia()
    except Exception as e:
        print("[Registratore] non avviato:", e)


@app.on_event("shutdown")
async def _ferma_registratore():
    if _REG:
        await _REG.ferma()


@app.post("/registratore/config")
async def registratore_config(request: Request):
    """L'app manda la watchlist: [{asset, tipo:"cripto"|"mt5"|"book", simbolo, book}] e range_pct."""
    try:
        corpo = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="corpo JSON non valido")
    cfg = _reg.salva_config(corpo if isinstance(corpo, dict) else {})
    if _REG:
        _REG.applica_config(cfg)
    return {"ok": True, "config": cfg}


@app.get("/registratore/cartella")
def registratore_cartella():
    return {"ok": True, "cartella": _reg.CARTELLA, "predefinita": _reg.CARTELLA_PREDEFINITA}


@app.post("/registratore/cartella")
async def registratore_cartella_imposta(request: Request):
    """{"scegli": true} apre la finestra di Windows sul PC; {"cartella": "D:\\..."} la imposta;
    {"cartella": ""} torna a quella predefinita. "sposta": porta anche i giorni gia' registrati.
    Solo dal PC: e' una cartella del PC, e da un telefono non la si vede."""
    if _accesso is not None and not _accesso.richiesta_locale(request):
        raise HTTPException(status_code=403, detail="La cartella di destinazione si sceglie dal PC su cui gira la registrazione.")
    try:
        corpo = await request.json()
    except Exception:
        corpo = {}
    scelta = corpo.get("cartella")
    if corpo.get("scegli"):
        try:
            scelta = await asyncio.to_thread(_reg.scegli_cartella_dialogo, _reg.CARTELLA)
        except Exception as e:
            raise HTTPException(status_code=500, detail="Finestra di scelta non aperta: %s" % e)
        if not scelta:
            return {"ok": True, "annullato": True, "cartella": _reg.CARTELLA, "predefinita": _reg.CARTELLA_PREDEFINITA}
    if scelta is None:
        raise HTTPException(status_code=400, detail="manca la cartella")
    try:
        r = await asyncio.to_thread(_reg.imposta_cartella, str(scelta), bool(corpo.get("sposta")))
    except Exception as e:
        raise HTTPException(status_code=400, detail="Cartella non utilizzabile: %s" % e)
    return {"ok": True, **r}


@app.get("/registratore/stato")
def registratore_stato():
    return {"ok": True, "stato": _reg.STATO, "config": _reg.carica_config(), "cartella": _reg.CARTELLA}


@app.get("/registratore/trade")
def registratore_trade(asset: str, da_ms: float, a_ms: float):
    """Trade cripto registrati: [[t_ms, prezzo, volume, lato(+1 acquisto aggressivo, -1 vendita)], ...]"""
    if a_ms <= da_ms:
        raise HTTPException(status_code=400, detail="a_ms deve essere maggiore di da_ms")
    if _REG:
        _REG.trade.svuota()      # cosi' arrivano anche gli ultimi secondi
    righe = _reg.leggi_trade(asset, da_ms, a_ms)
    return {"ok": True, "asset": asset, "count": len(righe), "trade": righe,
            "troncato": len(righe) >= _reg.MAX_RIGHE_RISPOSTA}


@app.get("/registratore/book")
def registratore_book(chiave: str, da_ms: float, a_ms: float):
    """Fotografie del book registrate: cripto "bn:SIMBOLO" ({t,b,a,off,passo}) o simbolo MT5 ({t,bids,asks})."""
    if a_ms <= da_ms:
        raise HTTPException(status_code=400, detail="a_ms deve essere maggiore di da_ms")
    foto = _reg.leggi_book(chiave, da_ms, a_ms)
    return {"ok": True, "chiave": chiave, "count": len(foto), "foto": foto}


def _iso(t_ms: float) -> str:
    return datetime.utcfromtimestamp(t_ms / 1000.0).strftime("%Y-%m-%dT%H:%M:%SZ")


def _csv_cripto(asset: str, da_ms: float, a_ms: float, cosa: str):
    if _REG:
        _REG.trade.svuota()
    giorno = 86400000
    if cosa == "tick":
        yield "time,price,volume,side\n"
    else:
        yield "date,open,high,low,close,volume\n"
    t0 = da_ms
    candela = None
    while t0 < a_ms:
        t1 = min(a_ms, t0 + giorno)
        righe = _reg.leggi_trade(asset, t0, t1 - 0.001)
        pezzi = []
        for t, p, q, lato in righe:
            if cosa == "tick":
                pezzi.append("%s,%r,%r,%s\n" % (datetime.utcfromtimestamp(t / 1000.0).strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (int(t) % 1000), p, q, "buy" if lato > 0 else "sell"))
                continue
            m = int(t // 60000) * 60000
            if candela and candela[0] == m:
                candela[2] = max(candela[2], p); candela[3] = min(candela[3], p); candela[4] = p; candela[5] += q
            else:
                if candela:
                    pezzi.append("%s,%r,%r,%r,%r,%r\n" % (_iso(candela[0]), candela[1], candela[2], candela[3], candela[4], round(candela[5], 8)))
                candela = [m, p, p, p, p, q]
        if pezzi:
            yield "".join(pezzi)
        t0 = t1
    if candela and cosa != "tick":
        yield "%s,%r,%r,%r,%r,%r\n" % (_iso(candela[0]), candela[1], candela[2], candela[3], candela[4], round(candela[5], 8))


def _csv_mt5(simbolo: str, da_ms: float, a_ms: float, cosa: str):
    _ensure_initialized()
    resolved = _resolve_symbol(simbolo)
    if resolved is None:
        yield "errore,simbolo %s non trovato su questo broker\n" % simbolo
        return
    info = _mt5_call(mt5.symbol_info, resolved)
    if info is not None and not info.visible:
        _mt5_call(mt5.symbol_select, resolved, True)
    offset = _server_time_offset_seconds(_mt5_call(mt5.symbol_info_tick, resolved))
    yield ("time,bid,ask,last,volume,flags\n" if cosa == "tick" else "date,open,high,low,close,volume\n")
    passo = 3600000 if cosa == "tick" else 86400000      # a pezzi: niente risposte gigantesche in memoria
    t0 = da_ms
    while t0 < a_ms:
        t1 = min(a_ms, t0 + passo)
        dfrom = datetime.utcfromtimestamp(t0 / 1000.0 + offset)
        dto = datetime.utcfromtimestamp(t1 / 1000.0 + offset)
        pezzi = []
        if cosa == "tick":
            raw = _mt5_call(mt5.copy_ticks_range, resolved, dfrom, dto, mt5.COPY_TICKS_ALL)
            for k in (raw if raw is not None else []):
                tm = float(k["time_msc"]) - offset * 1000.0
                if tm >= t1:
                    continue
                pezzi.append("%s,%r,%r,%r,%r,%d\n" % (datetime.utcfromtimestamp(tm / 1000.0).strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (int(tm) % 1000),
                                                      float(k["bid"]), float(k["ask"]), float(k["last"]), float(k["volume_real"] if "volume_real" in k.dtype.names else k["volume"]), int(k["flags"])))
        else:
            raw = _mt5_call(mt5.copy_rates_range, resolved, mt5.TIMEFRAME_M1, dfrom, dto)
            for r in (raw if raw is not None else []):
                tm = (float(r["time"]) - offset) * 1000.0
                if tm >= t1:
                    continue
                pezzi.append("%s,%r,%r,%r,%r,%d\n" % (_iso(tm), float(r["open"]), float(r["high"]), float(r["low"]), float(r["close"]), int(r["tick_volume"])))
        if pezzi:
            yield "".join(pezzi)
        t0 = t1


# ---- FILE UNICO per il backtest (RICHIESTO: "un unico file, compreso di tutto"): stesse colonne
# delle candele piu' due colonne finali, cosi' qualunque lettore di candele lo apre comunque:
#   date,open,high,low,close,volume,tipo,dati
#   candela da 1 minuto ............ tipo vuoto
#   F = footprint di quel minuto .... dati "prezzo;volume_comprato;volume_venduto" (aggressore vero)
#   B = fotografia del book ......... dati "scarto|p v p v ...(bid)|p v p v ...(ask)" ogni 30 s
#   M = descrizione (ultima riga) ... dati "asset=...;fonte=...;versione=1"
# Nelle righe F/B/M le colonne open..volume valgono "-": un lettore di sole candele le salta.
TICK_FLAG_BUY, TICK_FLAG_SELL = 32, 64
BOOK_UNICO_OGNI_MS = 30000


def _iso_ms(t_ms: float) -> str:
    return datetime.utcfromtimestamp(t_ms / 1000.0).strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (int(t_ms) % 1000)


def _righe_book(chiave: str, da: float, a: float, mt5_formato: bool) -> list:
    out, ultima = [], -1e18
    for f in _reg.leggi_book(chiave, da, a):
        if f["t"] - ultima < BOOK_UNICO_OGNI_MS:
            continue
        ultima = f["t"]
        if mt5_formato:
            b = " ".join("%r %r" % (e["price"], e["volume"]) for e in f.get("bids", []))
            a_ = " ".join("%r %r" % (e["price"], e["volume"]) for e in f.get("asks", []))
            off = 0.0
        else:
            b = " ".join("%r" % x for x in f.get("b", []))
            a_ = " ".join("%r" % x for x in f.get("a", []))
            off = f.get("off", 0.0)
        out.append((f["t"], 2, "%s,-,-,-,-,-,B,%r|%s|%s\n" % (_iso_ms(f["t"]), off, b, a_)))
    return out


def _unico_cripto(asset: str, book: str, da_ms: float, a_ms: float):
    if _REG:
        _REG.trade.svuota()
    yield "date,open,high,low,close,volume,tipo,dati\n"
    giorno, t0, primo = 86400000, da_ms, None
    while t0 < a_ms:
        t1 = min(a_ms, t0 + giorno)
        candele, fp = {}, {}
        for t, p, q, lato in _reg.leggi_trade(asset, t0, t1 - 0.001):
            m = int(t // 60000) * 60000
            c = candele.get(m)
            if c is None:
                candele[m] = [p, p, p, p, q]
            else:
                c[1] = max(c[1], p); c[2] = min(c[2], p); c[3] = p; c[4] += q
            cella = fp.setdefault((m, p), [0.0, 0.0])
            cella[0 if lato > 0 else 1] += q
        righe = [(m, 0, "%s,%r,%r,%r,%r,%r,,\n" % (_iso(m), c[0], c[1], c[2], c[3], round(c[4], 8))) for m, c in candele.items()]
        righe += [(m, 1, "%s,-,-,-,-,-,F,%r;%r;%r\n" % (_iso(m), p, round(v[0], 8), round(v[1], 8))) for (m, p), v in fp.items()]
        if book:
            righe += _righe_book("bn:" + book, t0, t1 - 0.001, False)
        righe.sort(key=lambda r: (r[0], r[1]))
        if primo is None:
            prima_candela = next((r[0] for r in righe if r[1] == 0), None)
            if prima_candela is None:
                t0 = t1
                continue
            primo = prima_candela
            righe = [r for r in righe if r[0] >= primo]     # la prima riga dati deve essere una candela
        if righe:
            yield "".join(r[2] for r in righe)
        t0 = t1
    yield "%s,-,-,-,-,-,M,asset=%s;fonte=cripto;book=%s;versione=1\n" % (_iso(a_ms), asset.replace(";", "_"), book or "")


def _classifica(k, bid_prec):
    flags = int(k["flags"])
    vol = float(k["volume_real"]) if "volume_real" in k.dtype.names and float(k["volume_real"]) > 0 else float(k["volume"]) or 1.0
    if flags & TICK_FLAG_BUY:
        return 1, vol
    if flags & TICK_FLAG_SELL:
        return -1, vol
    bid, ask, last = float(k["bid"]), float(k["ask"]), float(k["last"])
    if last > 0 and ask >= bid > 0:
        if last >= ask:
            return 1, vol
        if last <= bid:
            return -1, vol
        return 0, vol
    if bid_prec is not None and bid > bid_prec:
        return 1, vol
    if bid_prec is not None and bid < bid_prec:
        return -1, vol
    return 0, vol


def _unico_mt5(asset: str, simbolo: str, da_ms: float, a_ms: float):
    _ensure_initialized()
    resolved = _resolve_symbol(simbolo)
    if resolved is None:
        yield "errore,simbolo %s non trovato su questo broker\n" % simbolo
        return
    info = _mt5_call(mt5.symbol_info, resolved)
    if info is not None and not info.visible:
        _mt5_call(mt5.symbol_select, resolved, True)
    offset = _server_time_offset_seconds(_mt5_call(mt5.symbol_info_tick, resolved))
    yield "date,open,high,low,close,volume,tipo,dati\n"
    t0, primo, bid_prec = da_ms, None, None
    while t0 < a_ms:
        t1 = min(a_ms, t0 + 3600000)       # un'ora alla volta
        dfrom = datetime.utcfromtimestamp(t0 / 1000.0 + offset)
        dto = datetime.utcfromtimestamp(t1 / 1000.0 + offset)
        righe = []
        candele_raw = _mt5_call(mt5.copy_rates_range, resolved, mt5.TIMEFRAME_M1, dfrom, dto)
        for r in (candele_raw if candele_raw is not None else []):     # array numpy: mai "or []"
            tm = (float(r["time"]) - offset) * 1000.0
            if t0 <= tm < t1:
                righe.append((tm, 0, "%s,%r,%r,%r,%r,%d,,\n" % (_iso(tm), float(r["open"]), float(r["high"]), float(r["low"]), float(r["close"]), int(r["tick_volume"]))))
        fp = {}
        # Prima i tick REGISTRATI sul PC (l'archivio non scade); se per quell'ora non ce ne sono,
        # quelli dello storico del broker (finche' li conserva).
        registrati = _reg.leggi_trade(asset, t0, t1 - 0.001)
        for t_, p_, q_, lato_ in registrati:
            cella = fp.setdefault((int(t_ // 60000) * 60000, p_), [0.0, 0.0])
            if lato_ > 0:
                cella[0] += q_
            elif lato_ < 0:
                cella[1] += q_
            else:
                cella[0] += q_ / 2; cella[1] += q_ / 2
        raw = None if registrati else _mt5_call(mt5.copy_ticks_range, resolved, dfrom, dto, mt5.COPY_TICKS_ALL)
        for k in (raw if raw is not None else []):
            tm = float(k["time_msc"]) - offset * 1000.0
            if not (t0 <= tm < t1):
                continue
            lato, vol = _classifica(k, bid_prec)
            bid_prec = float(k["bid"])
            prezzo = float(k["bid"]) or float(k["last"])
            if not prezzo:
                continue
            cella = fp.setdefault((int(tm // 60000) * 60000, prezzo), [0.0, 0.0])
            if lato > 0:
                cella[0] += vol
            elif lato < 0:
                cella[1] += vol
            else:
                cella[0] += vol / 2; cella[1] += vol / 2
        righe += [(m, 1, "%s,-,-,-,-,-,F,%r;%r;%r\n" % (_iso(m), p, round(v[0], 8), round(v[1], 8))) for (m, p), v in fp.items()]
        righe += _righe_book(resolved, t0, t1 - 0.001, True)
        righe.sort(key=lambda r: (r[0], r[1]))
        if primo is None:
            prima_candela = next((r[0] for r in righe if r[1] == 0), None)
            if prima_candela is None:
                t0 = t1
                continue
            primo = prima_candela
            righe = [r for r in righe if r[0] >= primo]
        if righe:
            yield "".join(r[2] for r in righe)
        t0 = t1
    yield "%s,-,-,-,-,-,M,asset=%s;fonte=mt5;simbolo=%s;versione=1\n" % (_iso(a_ms), asset.replace(";", "_"), resolved)


@app.get("/registratore/giorni")
def registratore_giorni():
    """Archivio della registrazione: per ogni asset i giorni registrati con lo spazio occupato."""
    elenco = _reg.elenco_giorni()
    totale = sum(g["trade_byte"] + g["book_byte"] for a in elenco.values() for g in a["giorni"].values())
    return {"ok": True, "asset": elenco, "byte_totali": totale, "cartella": _reg.CARTELLA,
            "registrazione": bool(_reg.carica_config().get("registrazione"))}


@app.get("/registratore/giorno_csv")
def registratore_giorno_csv(asset: str, giorno: str):
    """FILE UNICO di UN giorno (00:00-24:00 UTC) di un asset: candele M1 + footprint + book.
    I file dei giorni si caricano tutti insieme nella Libreria storici CSV dello stesso asset."""
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", giorno or ""):
        raise HTTPException(status_code=400, detail="giorno nel formato AAAA-MM-GG")
    da = datetime.strptime(giorno, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp() * 1000.0
    a = da + 86400000.0
    voce = _reg.elenco_giorni().get(asset) or {}
    mt5_pronto = False
    if voce.get("tipo") == "mt5":
        try:
            _ensure_initialized()
            mt5_pronto = _resolve_symbol(voce.get("simbolo") or asset) is not None
        except Exception:
            mt5_pronto = False
    if mt5_pronto:
        gen = _unico_mt5(asset, voce.get("simbolo") or asset, da, a)
    elif voce.get("tipo") == "mt5":
        # Terminale MT5 non disponibile: candele e footprint dai tick registrati sul PC.
        gen = _unico_cripto(asset, "", da, a)
    else:
        gen = _unico_cripto(asset, voce.get("book") or "", da, a)
    nome = "%s_%s.csv" % (re.sub(r"[^A-Za-z0-9]+", "_", asset).strip("_") or "asset", giorno)
    return StreamingResponse(gen, media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="%s"' % nome})


@app.post("/registratore/elimina")
async def registratore_elimina(request: Request):
    """Cancella a mano i giorni scelti: {"voci":[{"asset","giorno"}]}."""
    try:
        corpo = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="corpo JSON non valido")
    n = 0
    for v in (corpo or {}).get("voci") or []:
        n += _reg.elimina_giorno(str(v.get("asset") or ""), str(v.get("giorno") or ""))
    return {"ok": True, "file_cancellati": n}


@app.get("/registratore/csv")
def registratore_csv(asset: str, da_ms: float, a_ms: float, cosa: str = "candele", tipo: str = "cripto", simbolo: str = "", book: str = ""):
    """CSV per il backtest in modalita' Storico: candele da 1 minuto (date,open,high,low,close,
    volume, ora UTC) o tick. Cripto: dai trade registrati qui sul PC (dove il PC era spento non ci
    sono candele: mai inventate). MT5: dallo storico del broker."""
    if a_ms <= da_ms:
        raise HTTPException(status_code=400, detail="a_ms deve essere maggiore di da_ms")
    cosa = cosa if cosa in ("tick", "completo") else "candele"
    da_ms = math.floor(da_ms / 60000.0) * 60000.0      # dal minuto intero: nessuna candela o footprint a meta'

    if cosa == "completo":
        gen = _unico_cripto(asset, book, da_ms, a_ms) if tipo == "cripto" else _unico_mt5(asset, simbolo or asset, da_ms, a_ms)
    else:
        gen = _csv_cripto(asset, da_ms, a_ms, cosa) if tipo == "cripto" else _csv_mt5(simbolo or asset, da_ms, a_ms, cosa)
    nome = "%s_%s_%s_%s.csv" % (re.sub(r"[^A-Za-z0-9]+", "_", asset).strip("_") or "asset", {"candele": "M1", "tick": "tick", "completo": "completo"}[cosa],
                                datetime.utcfromtimestamp(da_ms / 1000.0).strftime("%Y%m%d"), datetime.utcfromtimestamp(a_ms / 1000.0).strftime("%Y%m%d"))
    return StreamingResponse(gen, media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="%s"' % nome})


# ============================================================================= LIBRERIA CSV DAL PC
# RICHIESTO ("su telefono e tablet niente permessi sui file"): l'app sul PC, quando legge la sua
# Libreria storici CSV, ne manda una copia qui; telefono e tablet la scaricano da qui (via
# Tailscale, con la chiave) e la tengono nella memoria interna dell'app. Nessuna cartella da
# collegare sul telefono, nessun permesso.
from fastapi.responses import PlainTextResponse

CARTELLA_LIBRERIA = os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), "ForexBacktestLAB", "libreria")
if os.environ.get("FBL_LIBRERIA_CARTELLA"):
    CARTELLA_LIBRERIA = os.environ["FBL_LIBRERIA_CARTELLA"]


def _nome_sicuro(s: str) -> str:
    s = re.sub(r"[^A-Za-z0-9 ._()+@-]", "_", s or "").strip(" .")
    return s[:120] or "_"


def _indice_libreria(cartella: str) -> dict:
    try:
        with open(os.path.join(cartella, "_indice.json"), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


@app.get("/libreria/elenco")
def libreria_elenco(asset: str):
    cartella = os.path.join(CARTELLA_LIBRERIA, _nome_sicuro(asset))
    ind = _indice_libreria(cartella)
    out = []
    for nome, info in sorted(ind.items()):
        p = os.path.join(cartella, _nome_sicuro(nome))
        if os.path.isfile(p):
            out.append({"nome": nome, "byte": info.get("byte", os.path.getsize(p)), "modificato": info.get("modificato", 0)})
    return {"ok": True, "asset": asset, "file": out}


@app.get("/libreria/file")
def libreria_file(asset: str, nome: str):
    p = os.path.join(CARTELLA_LIBRERIA, _nome_sicuro(asset), _nome_sicuro(nome))
    if not os.path.isfile(p):
        raise HTTPException(status_code=404, detail="file non presente nella libreria del PC")
    with open(p, encoding="utf-8", errors="replace") as f:
        return PlainTextResponse(f.read(), media_type="text/csv")


@app.post("/libreria/file")
async def libreria_invia(request: Request, asset: str, nome: str, modificato: float = 0):
    corpo = (await request.body()).decode("utf-8", "replace")
    if not corpo.strip():
        raise HTTPException(status_code=400, detail="file vuoto")
    cartella = os.path.join(CARTELLA_LIBRERIA, _nome_sicuro(asset))
    os.makedirs(cartella, exist_ok=True)
    p = os.path.join(cartella, _nome_sicuro(nome))
    with open(p + ".tmp", "w", encoding="utf-8", newline="") as f:
        f.write(corpo)
    os.replace(p + ".tmp", p)
    ind = _indice_libreria(cartella)
    ind[nome] = {"byte": len(corpo.encode("utf-8")), "modificato": modificato}
    with open(os.path.join(cartella, "_indice.json.tmp"), "w", encoding="utf-8") as f:
        json.dump(ind, f)
    os.replace(os.path.join(cartella, "_indice.json.tmp"), os.path.join(cartella, "_indice.json"))
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    PORT = 8001
    _host = _accesso.host_di_ascolto()      # sempre 127.0.0.1: dagli altri dispositivi via Tailscale Serve
    print(f"Forex Backtest LAB — servizio FEED DATI MT5 (prototipo, sola lettura) avviato su "
          f"http://{_host}:{PORT}/ — bridge.py (ordini reali) resta separato sulla porta 8000.")
    if _accesso.carica_accesso().get("rete"):
        print("  Accesso da altri dispositivi ACCESO (via Tailscale): serve la chiave.")
    uvicorn.run(app, host=_host, port=PORT)
