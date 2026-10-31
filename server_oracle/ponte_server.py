"""Ponte di Forex Backtest LAB per il server Oracle (Linux, sempre acceso).

Strada ibrida (cervello/ORACLE.md): MT5 resta sul PC di casa; qui girano Kraken (conto SIMULATO e
ordini pendenti) e, nel servizio accanto, il ponte segnali Telegram. Stessa porta 8000 e stesso
controllo d'accesso del PC: si ascolta solo su 127.0.0.1 e dagli altri dispositivi si arriva con
Tailscale Serve, con la chiave (accesso_condiviso.py).

Le chiavi Kraken REALI non si mettono qui (cervello/REGOLE.md): il collegamento reale si rifiuta.
"""
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(os.path.dirname(QUI), "installer_build", "build")
sys.path.insert(0, os.environ.get("FBL_BUILD") or BUILD)

from fastapi import FastAPI, HTTPException, Request, WebSocket  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
import sqlite3  # noqa: E402
try:
    from google.oauth2 import id_token as _fb_id_token
    from google.auth.transport import requests as _fb_requests
    _FB_AUTH_OK = True
except Exception:
    _FB_AUTH_OK = False


import accesso_condiviso as accesso  # noqa: E402
import kraken_ordini  # noqa: E402

app = FastAPI(title="Forex Backtest LAB - server")
# Le chiavi PERSONALI (una per utente, generate al primo accesso) vivono in auth_server.py, nella
# cartella installer_build/build, che i sys.path qui sopra ha appena messo in testa: e' il posto
# in cui sta anche accesso_condiviso. Senza queste due righe il telefono non ha nessuna chiave con
# cui farsi aprire la porta del controllo d'accesso, e /register non esiste nemmeno.
import auth_server  # noqa: E402
auth_server.registra_router(app)
app.add_middleware(CORSMiddleware, **accesso.opzioni_cors())
accesso.installa_controllo_chiave(app)


@app.middleware("http")
async def _solo_simulato(request: Request, call_next):
    # Le rotte /dati usano il token Firebase (Authorization: Bearer), non la chiave
    # condivisa del server: bypassano il controllo chiave, che viene dopo di qui
    # (LIFO: l'ultimo middleware aggiunto esegue per primo).
    if request.url.path.startswith("/dati/"):
        return await call_next(request)
    # Regola: sul server niente chiavi reali. /kraken/configura con ambiente diverso da "simulato"
    # non passa, qualunque cosa mandi l'app.
    if request.method == "POST" and request.url.path == "/kraken/configura":
        corpo = await request.body()
        import json
        try:
            amb = (json.loads(corpo or b"{}") or {}).get("ambiente", "simulato")
        except Exception:
            amb = "?"
        if amb != "simulato":
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=403, headers={"Access-Control-Allow-Origin": "*"},
                                content={"detail": "Sul server Oracle solo il conto simulato: le chiavi Kraken reali restano sul PC di casa."})

        async def _rileggi():
            return {"type": "http.request", "body": corpo, "more_body": False}
        request._receive = _rileggi
    return await call_next(request)


app.include_router(kraken_ordini.router)


# =====================================================================================
# IL SERVER E' LA PORTA UNICA: dal telefono si scrive solo il nome del server
# =====================================================================================
# RICHIESTO dal proprietario (7 ottobre 2026): «sul telefono o tablet devo inserire il nome del
# server e la chiave del server, non piu' il nome del computer e la chiave del computer».
#
# Ma MT5 gira sul PC (strada ibrida, cervello/ORACLE.md) e sul server non ci sara' mai: la
# libreria MetaTrader5 esiste solo per Windows. Quindi il PC si FA CONOSCERE dal server: gli dice
# come si chiama su Tailscale e con che chiave si entra. Da quel momento il telefono ha due
# strade, e nessuna delle due va scritta a mano:
#   - chiede al server dov'e' il PC (`GET /pc`) e ci parla diretto: e' la via piu' veloce;
#   - oppure passa dal server (`/pc/<percorso>`), che gira la richiesta: funziona anche quando il
#     telefono il PC non lo vede da solo.
#
# La chiave del PC resta fra due macchine del proprietario, tutte e due raggiungibili solo via
# Tailscale. Non e' la chiave di un servizio esterno (quelle, dice cervello/REGOLE.md, non si
# muovono dal PC): e' la parola d'ordine del suo stesso ponte.
import json as _json
import time as _time

FILE_PC = os.path.join(os.environ.get("FBL_DATI") or "/dati", "pc.json")


def _leggi_pc() -> dict:
    try:
        with open(FILE_PC, encoding="utf-8") as f:
            return _json.load(f) or {}
    except Exception:
        return {}


def _scrivi_pc(dati: dict) -> None:
    os.makedirs(os.path.dirname(FILE_PC), exist_ok=True)
    with open(FILE_PC, "w", encoding="utf-8") as f:
        _json.dump(dati, f, ensure_ascii=False, indent=2)


@app.post("/pc/registra")
def pc_registra(corpo: dict):
    """Il PC si presenta: «mi chiamo cosi' su Tailscale, si entra con questa chiave».

    Ci arriva gia' con la chiave del server (ci pensa il controllo d'accesso piu' sopra), quindi
    chi la manda e' qualcuno che il server conosce gia'.
    """
    host = str((corpo or {}).get("host") or "").strip().lower()
    chiave = str((corpo or {}).get("chiave") or "").strip()
    if not host.endswith(".ts.net"):
        raise HTTPException(status_code=400,
                            detail="Serve il nome Tailscale del PC (finisce con .ts.net): e' quello per cui vale il certificato.")
    if not chiave:
        raise HTTPException(status_code=400, detail="Senza la chiave del PC il server non potrebbe parlargli.")
    _scrivi_pc({"host": host, "chiave": chiave, "visto": _time.time()})
    return {"ok": True, "host": host}


@app.get("/pc")
def pc_dove():
    """Dov'e' il PC. La chiave NON esce di qui: all'app non serve, le richieste le gira il server."""
    d = _leggi_pc()
    if not d.get("host"):
        return {"ok": True, "registrato": False,
                "detail": "Nessun computer si e' ancora presentato a questo server. "
                          "Apri l'app sul PC: si registra da sola."}
    return {"ok": True, "registrato": True, "host": d["host"], "visto": d.get("visto")}


# Le tre porte del PC, tutte raggiungibili attraverso il server. Non solo la 8000: il GRAFICO sta
# sulla 8001 e i segnali sulla 8769, e dal telefono non hanno nessun'altra strada - e' il motivo
# per cui dal telefono il grafico diceva "nessuna risposta" mentre ordini e segnali andavano.
# Solo queste tre: il server non deve diventare un passaggio verso una porta qualsiasi del PC.
PORTE_PC = (8000, 8001, 8769)


@app.api_route("/pc/{porta:int}/{percorso:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def pc_inoltra_porta(porta: int, percorso: str, request: Request):
    """Gira al PC una richiesta su una delle tre porte."""
    if porta not in PORTE_PC:
        raise HTTPException(status_code=400, detail="Porta non prevista: %s" % porta)
    return await _inoltra(porta, percorso, request)


@app.api_route("/pc/{percorso:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def pc_inoltra(percorso: str, request: Request):
    """Senza porta si intende la 8000 (ordini): com'era prima, per non rompere nulla."""
    return await _inoltra(8000, percorso, request)


async def _inoltra(porta: int, percorso: str, request: Request):
    """Gira al PC una richiesta arrivata dal telefono, mettendoci la chiave del PC."""
    d = _leggi_pc()
    if not d.get("host"):
        raise HTTPException(status_code=503, detail="Nessun computer registrato su questo server.")
    import httpx
    from fastapi.responses import Response
    url = "https://%s:%d/%s" % (d["host"], porta, percorso)
    parametri = dict(request.query_params)
    parametri["chiave"] = d.get("chiave", "")
    try:
        async with httpx.AsyncClient(timeout=30) as cli:
            r = await cli.request(request.method, url, params=parametri,
                                  content=await request.body(),
                                  headers={"content-type": request.headers.get("content-type", "application/json")})
        return Response(content=r.content, status_code=r.status_code,
                        media_type=r.headers.get("content-type", "application/json"),
                        headers={"Access-Control-Allow-Origin": "*"})
    except httpx.HTTPError as e:
        # Il PC spento e' la cosa piu' probabile, e va detta cosi': non e' un guasto del server.
        raise HTTPException(status_code=502,
                            detail="Il computer non risponde (acceso? Tailscale attivo?): %s" % e)


# `{porta:int}` nel percorso, non solo nell'annotazione: senza, la porta arriva come TESTO
# ("8001") e il confronto con i numeri qui sotto fallisce sempre, chiudendo il canale subito.
# Il grafico dal vivo non si sarebbe mosso, senza nessun errore visibile.
@app.websocket("/pc/{porta:int}/{percorso:path}")
async def pc_inoltra_ws(websocket: WebSocket, porta: int, percorso: str):
    """Gira al PC anche un canale WebSocket.

    Serve per i PREZZI DAL VIVO: il terminale MT5 sta sul computer, il ponte li' li legge sulla
    porta 8001 e li manda su un canale WebSocket. Senza questo passaggio, dal telefono il grafico
    si disegna con lo storico ma non si muove - ed e' meta' del motivo per cui si guarda un
    grafico. La catena e': terminale MT5 -> ponte sul computer -> server -> telefono.
    Il controllo della chiave va fatto QUI: il controllo HTTP le WebSocket non le vede.
    """
    if porta not in PORTE_PC:
        await websocket.close(code=4400)
        return
    if not accesso.websocket_autorizzato(websocket):
        await websocket.close(code=4403)
        return
    d = _leggi_pc()
    if not d.get("host"):
        await websocket.close(code=4404)       # nessun computer registrato
        return

    import asyncio
    import urllib.parse

    import websockets

    parametri = dict(websocket.query_params)
    parametri["chiave"] = d.get("chiave", "")      # al PC serve la SUA chiave, non quella del server
    url = "wss://%s:%d/%s?%s" % (d["host"], porta, percorso, urllib.parse.urlencode(parametri))
    await websocket.accept()
    try:
        async with websockets.connect(url, open_timeout=20, ping_interval=20) as pc:
            async def verso_pc():
                while True:
                    await pc.send(await websocket.receive_text())

            async def verso_telefono():
                while True:
                    await websocket.send_text(await pc.recv())

            # Il primo dei due che finisce chiude anche l'altro: un canale mezzo aperto terrebbe
            # in vita una connessione al PC che non legge piu' nessuno.
            fatti, restanti = await asyncio.wait(
                [asyncio.create_task(verso_pc()), asyncio.create_task(verso_telefono())],
                return_when=asyncio.FIRST_COMPLETED)
            for t in restanti:
                t.cancel()
    except Exception:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass



# =====================================================================
# PASSO 2 DEL PROGETTO DATI NOSTRI (27 ottobre 2026): verifica del token
# Firebase sul server. Il client manda "Authorization: Bearer <ID token>" e
# il server lo verifica (firma JWT contro le chiavi pubbliche di Google,
# scadenza, aud = PROJECT_ID) e ne ricava l'uid. Da li' uid e' la chiave di
# tutto: nessuna rotta accetta un uid dal client.
#
# L'ID del progetto viene da app.html (firebaseConfig.projectId):
# "forex-backtest-lab" (numero progetto 808053062225).
# =====================================================================
FIREBASE_PROJECT_ID = os.environ.get("FBL_FIREBASE_PROJECT_ID", "forex-backtest-lab")
FBL_DATI_DB = os.path.join(os.environ.get("FBL_DATI") or "/dati", "dati_utenti.db")


def _db_conn():
    try: os.makedirs(os.path.dirname(FBL_DATI_DB), exist_ok=True)
    except Exception: pass
    conn = sqlite3.connect(FBL_DATI_DB, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("""CREATE TABLE IF NOT EXISTS documenti (
        uid TEXT NOT NULL,
        nome TEXT NOT NULL,
        contenuto TEXT NOT NULL,
        versione INTEGER NOT NULL DEFAULT 1,
        aggiornato INTEGER NOT NULL,
        PRIMARY KEY (uid, nome)
    );""")
    conn.execute("""CREATE TABLE IF NOT EXISTS trades (
        uid TEXT NOT NULL,
        lista TEXT NOT NULL,
        aggiornato INTEGER NOT NULL,
        PRIMARY KEY (uid)
    );""")
    conn.commit()
    return conn


def verifica_token_firebase(token: str):
    """Restituisce l'uid se il token e' valido, altrimenti None. Mai fidarsi di
    un uid mandato dal client: e' una dichiarazione, non una prova."""
    if not token or not _FB_AUTH_OK:
        return None
    try:
        info = _fb_id_token.verify_firebase_token(
            token, _fb_requests.Request(), audience=FIREBASE_PROJECT_ID)
        # verify_firebase_token puo' restituire None se il token non e' valido
        if not info:
            return None
        # il claim 'sub' e' l'uid dell'utente (a volte 'user_id' in token vecchi)
        uid = info.get("sub") or info.get("user_id")
        # controllo aggiuntivo: issuer e audience
        iss = info.get("iss", "")
        if not iss.startswith("https://securetoken.google.com/"):
            return None
        if info.get("aud") != FIREBASE_PROJECT_ID:
            return None
        return uid
    except Exception:
        return None


def _uid_da_richiesta(request: Request):
    """Estrae e verifica il Bearer token. Restituisce l'uid o solleva 401."""
    auth = request.headers.get("authorization", "") or ""
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Token Firebase mancante.")
    uid = verifica_token_firebase(auth[7:].strip())
    if not uid:
        raise HTTPException(status_code=401, detail="Token Firebase non valido o scaduto.")
    return uid


from fastapi import Depends


async def _uid_dep(request: Request):
    return _uid_da_richiesta(request)


# ===================== ROTTE /dati =====================
# Passo 2: le rotte ESISTONO e sono protette dal token. L'app non le usa ancora
# (fxbtCloud continua a scrivere su Firestore): si attivano nel passo 3, dopo
# il doppio scritto. Ogni rotta scrive in SQLite sul volume /dati.
# ===================== CHI STA ASCOLTANDO, E COME LO SI AVVISA =====================
#
# PASSO 4 del progetto dati (cervello/PROGETTO-DATI-NOSTRI.md). Il WebSocket c'era gia', ma il
# codice stesso dichiarava il buco: «qui non pushiamo niente di nostro perche' non abbiamo un
# meccanismo di notifica cross-processo». Senza quello, l'ascolto mandava l'elenco iniziale e poi
# restava muto: scrivendo dal computer, il telefono non lo sapeva. Non era un ascolto, era una
# sincronizzazione sola andata.
#
# PERCHE' BASTA LA MEMORIA, e non serve un meccanismo fra processi: il ponte gira come UN solo
# processo (vedi docker-compose.yml, `command: python ponte_server.py`, nessun worker multiplo).
# Tutti i WebSocket di tutti gli utenti stanno nello stesso processo di chi scrive, quindi un
# dizionario in memoria e' sufficiente e non ha niente da sincronizzare. Se un domani si passasse
# a piu' processi, QUESTO e' il punto che va rifatto - ed e' scritto qui perche' si sappia dove
# guardare invece di scoprirlo da un difetto.
_ascoltatori = {}          # uid -> set di WebSocket
_loop_principale = None    # il ciclo di eventi, catturato all'avvio


@app.on_event("startup")
async def _cattura_loop():
    """Le rotte di scrittura sono SINCRONE (def, non async def): FastAPI le esegue in un thread a
    parte, dove non esiste il ciclo di eventi. Per mandare un messaggio su un WebSocket da li'
    serve il riferimento al ciclo vero, preso qui una volta sola."""
    global _loop_principale
    import asyncio
    _loop_principale = asyncio.get_running_loop()


def _avvisa(uid, nome, versione):
    """Dice agli altri dispositivi di questo utente che un documento e' cambiato.

    MANDA SOLO {nome, versione}, MAI IL CONTENUTO - ed e' il cuore del risparmio: oggi con
    Firestore ogni modifica fa riscaricare l'intero documento (305 KB misurati) a ogni dispositivo
    in ascolto, anche a quello che l'ha appena scritto. Cosi' invece arrivano venti byte, e chi ha
    gia' quella versione non chiede niente.

    Non solleva mai: un avviso non consegnato non deve far fallire una scrittura che e' gia'
    andata a buon fine sul disco. Al massimo l'altro dispositivo se ne accorge al prossimo giro.
    """
    try:
        import asyncio, json as _j
        quali = list(_ascoltatori.get(uid) or ())
        if not quali or _loop_principale is None:
            return
        messaggio = _j.dumps({"nome": nome, "versione": versione})

        async def _manda(ws):
            try:
                await ws.send_text(messaggio)
            except Exception:
                # Socket morto: si toglie dal registro, altrimenti resta li' per sempre a far
                # fallire ogni avviso futuro.
                try:
                    _ascoltatori.get(uid, set()).discard(ws)
                except Exception:
                    pass

        for ws in quali:
            try:
                asyncio.run_coroutine_threadsafe(_manda(ws), _loop_principale)
            except Exception:
                pass
    except Exception:
        pass


# I documenti che il server tiene per ogni utente. Una lista SOLA, invece dello stesso elenco
# ripetuto in tre rotte: due elenchi che un giorno divergono sono due comportamenti diversi, e
# qui vuol dire un documento che si scrive da una parte e non si legge dall'altra.
#
# "footprint" aggiunto il 31 ottobre 2026. Sta in users/{uid}/data/footprint da quando è uscito
# dal documento session (cura bolletta Firebase), e senza averlo in questo elenco il server lo
# RIFUTAVA con 400: la scrittura finiva nel catch del client, in silenzio, e il risparmio restava
# a metà — la met che si paga.
NOMI_DOCUMENTI = ("session", "grafico", "collegamento", "preferenze", "footprint")


@app.get("/dati/{nome}")
def dati_leggi(nome: str, uid: str = Depends(_uid_dep)):
    if nome not in NOMI_DOCUMENTI:
        raise HTTPException(status_code=400, detail="Nome documento non previsto.")
    conn = _db_conn()
    try:
        cur = conn.execute("SELECT contenuto, versione, aggiornato FROM documenti WHERE uid=? AND nome=?",
                           (uid, nome))
        r = cur.fetchone()
        if not r:
            return {"ok": True, "nome": nome, "contenuto": None, "versione": 0, "aggiornato": None}
        import json as _j
        return {"ok": True, "nome": nome, "contenuto": _j.loads(r[0]), "versione": r[1], "aggiornato": r[2]}
    finally:
        conn.close()


@app.put("/dati/{nome}")
def dati_scrivi(nome: str, corpo: dict, uid: str = Depends(_uid_dep)):
    if nome not in NOMI_DOCUMENTI:
        raise HTTPException(status_code=400, detail="Nome documento non previsto.")
    import json as _j
    import time as _t
    contenuto = corpo.get("contenuto") if isinstance(corpo, dict) else None
    if contenuto is None:
        raise HTTPException(status_code=400, detail="Manca il campo 'contenuto'.")
    conn = _db_conn()
    try:
        cur = conn.execute("SELECT versione FROM documenti WHERE uid=? AND nome=?", (uid, nome))
        r = cur.fetchone()
        nuova_versione = (r[0] + 1) if r else 1
        conn.execute("INSERT INTO documenti (uid,nome,contenuto,versione,aggiornato) VALUES (?,?,?,?,?) "
                     "ON CONFLICT(uid,nome) DO UPDATE SET contenuto=excluded.contenuto, versione=excluded.versione, aggiornato=excluded.aggiornato",
                     (uid, nome, _j.dumps(contenuto, ensure_ascii=False), nuova_versione, int(_t.time() * 1000)))
        conn.commit()
        _avvisa(uid, nome, nuova_versione)
        return {"ok": True, "nome": nome, "versione": nuova_versione}
    finally:
        conn.close()


@app.patch("/dati/{nome}")
def dati_fondi(nome: str, corpo: dict, uid: str = Depends(_uid_dep)):
    # Fusione: i campi mandati sovrascrivono, gli altri restano. Equivale a setDoc(...,{merge:true}).
    if nome not in NOMI_DOCUMENTI:
        raise HTTPException(status_code=400, detail="Nome documento non previsto.")
    import json as _j
    import time as _t
    campi = corpo.get("contenuto") if isinstance(corpo, dict) else None
    if not isinstance(campi, dict):
        raise HTTPException(status_code=400, detail="Il campo 'contenuto' deve essere un oggetto.")
    conn = _db_conn()
    try:
        cur = conn.execute("SELECT contenuto, versione FROM documenti WHERE uid=? AND nome=?", (uid, nome))
        r = cur.fetchone()
        if r:
            try:
                vecchio = _j.loads(r[0])
                if not isinstance(vecchio, dict): vecchio = {}
            except Exception:
                vecchio = {}
            vecchio.update(campi)
            nuova_versione = r[1] + 1
        else:
            vecchio = campi
            nuova_versione = 1
        conn.execute("INSERT INTO documenti (uid,nome,contenuto,versione,aggiornato) VALUES (?,?,?,?,?) "
                     "ON CONFLICT(uid,nome) DO UPDATE SET contenuto=excluded.contenuto, versione=excluded.versione, aggiornato=excluded.aggiornato",
                     (uid, nome, _j.dumps(vecchio, ensure_ascii=False), nuova_versione, int(_t.time() * 1000)))
        conn.commit()
        return {"ok": True, "nome": nome, "versione": nuova_versione}
    finally:
        conn.close()


@app.post("/dati/trades/aggiungi")
def dati_trades_aggiungi(corpo: dict, uid: str = Depends(_uid_dep)):
    # Salvataggio incrementale: aggiunge solo le operazioni nuove, senza riscrivere il resto.
    # Lato client manda {"operazioni": [...]}.
    ops = corpo.get("operazioni") if isinstance(corpo, dict) else None
    if not isinstance(ops, list):
        raise HTTPException(status_code=400, detail="Manca il campo 'operazioni' (lista).")
    import json as _j
    import time as _t
    conn = _db_conn()
    try:
        cur = conn.execute("SELECT lista, versione FROM trades WHERE uid=?", (uid,))
        r = cur.fetchone()
        if r:
            try: lista = _j.loads(r[0])
            except Exception: lista = []
            if not isinstance(lista, list): lista = []
            # Append-only: aggiungo solo quelle che non ci sono gia' (confronto per valore).
            visti = set(_j.dumps(o, sort_keys=True, ensure_ascii=False) for o in lista)
            for o in ops:
                chiave = _j.dumps(o, sort_keys=True, ensure_ascii=False)
                if chiave not in visti:
                    lista.append(o); visti.add(chiave)
            versione = r[1] + 1
        else:
            lista = list(ops)
            versione = 1
        conn.execute("INSERT INTO trades (uid,lista,aggiornato) VALUES (?,?,?) "
                     "ON CONFLICT(uid) DO UPDATE SET lista=excluded.lista, aggiornato=excluded.aggiornato",
                     (uid, _j.dumps(lista, ensure_ascii=False), int(_t.time() * 1000)))
        conn.commit()
        return {"ok": True, "aggiunte": len(ops), "totale": len(lista), "versione": versione}
    finally:
        conn.close()


@app.get("/dati/trades")
def dati_trades_leggi(uid: str = Depends(_uid_dep)):
    import json as _j
    conn = _db_conn()
    try:
        cur = conn.execute("SELECT lista, aggiornato FROM trades WHERE uid=?", (uid,))
        r = cur.fetchone()
        if not r:
            return {"ok": True, "lista": [], "aggiornato": None}
        try: lista = _j.loads(r[0])
        except Exception: lista = []
        if not isinstance(lista, list): lista = []
        return {"ok": True, "lista": lista, "aggiornato": r[1]}
    finally:
        conn.close()


@app.websocket("/dati/ascolta")
async def dati_ascolta(websocket: WebSocket):
    """Ascolto in tempo reale: manda SOLO {nome, versione}, mai il contenuto.
    Il client decide se leggere. Cosi' un dispositivo che ha gia' quella versione
    non scarica niente - ed e' esattamente lo spreco che oggi si paga a Firestore."""
    # 1) autenticazione: il token arriva come query param (il WebSocket non ha header
    #    Authorization comodi in tutti i browser). Il client manda ?token=<idToken>.
    token = websocket.query_params.get("token", "")
    uid = verifica_token_firebase(token)
    if not uid:
        await websocket.close(code=4403)
        return
    await websocket.accept()
    try:
        # invia la lista iniziale dei documenti presenti per questo utente
        conn = _db_conn()
        rows = conn.execute("SELECT nome, versione FROM documenti WHERE uid=?", (uid,)).fetchall()
        conn.close()
        for nome, versione in rows:
            await websocket.send_text(__import__("json").dumps({"nome": nome, "versione": versione}))
        # resta in ascolto: il client legge quando vuole. Qui non pushiamo niente di nostro
        # perche' non abbiamo un meccanismo di notifica cross-processo in questo passo;
        # il client fa polling leggero o rilegge al cambio di visibilita'.
        while True:
            await websocket.receive_text()
    except Exception:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

@app.get("/health")
def health():
    pc = _leggi_pc()
    return {"ok": True, "servizio": "server-oracle", "mt5": False, "kraken": "simulato",
            "accesso_remoto": bool(accesso.carica_accesso().get("rete")),
            # Col telefono si sa gia' se aspettarsi MT5, senza una seconda domanda.
            "pc": {"registrato": bool(pc.get("host")), "host": pc.get("host", ""),
                   "visto": pc.get("visto"), "porte": list(PORTE_PC)}}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=accesso.host_di_ascolto(), port=int(os.environ.get("FBL_PORTA", "8000")), log_level="warning")
