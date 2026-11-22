"""Ponte di Forex Backtest LAB per il server Oracle (Linux, sempre acceso).

Strada ibrida (cervello/ORACLE.md): MT5 resta sul PC di casa; qui girano Kraken (conto SIMULATO e
ordini pendenti) e, nel servizio accanto, il ponte segnali Telegram. Stessa porta 8000 e stesso
controllo d'accesso del PC: si ascolta solo su 127.0.0.1 e dagli altri dispositivi si arriva con
Tailscale Serve, con la chiave (accesso_condiviso.py).

Le chiavi Kraken REALI non si mettono qui (cervello/REGOLE.md): il collegamento reale si rifiuta.
"""
import asyncio
import base64
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(os.path.dirname(QUI), "installer_build", "build")
sys.path.insert(0, QUI)
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

# 7-bis: ordini esposti su internet senza Tailscale. Va prima del controllo chiave
# condivisa: registra il motivo preciso e rifiuta origine/segreto/revoca.
import sicurezza_7bis  # noqa: E402

@app.middleware("http")
async def _controllo_7bis_ordini(request, call_next):
    motivo = sicurezza_7bis.motivo_rifiuto_7bis(request)
    if motivo is not None:
        sicurezza_7bis.registra_rifiuto(motivo, request)
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=403, content={"detail": sicurezza_7bis.messaggio_rifiuto(motivo)},
                            headers={"Access-Control-Allow-Origin": "*"})
    return await call_next(request)


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
    if not host.endswith(".ts.net") and not host.endswith("github.io"):
        raise HTTPException(status_code=400,
                            detail="Serve il nome del server (finisce con .ts.net o github.io): quello per cui vale il certificato.")
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
    """Gira al PC una richiesta: preferisce il tunnel agente (uscita dal PC), poi il vecchio host Tailscale."""
    from fastapi.responses import Response
    utente = _utente_da_richiesta(request)
    agente = multiutente.agente_di(utente) if utente else None
    if agente is not None:
        try:
            risp = await agente.chiedi_http(
                porta, percorso, request.method, dict(request.query_params),
                await request.body(), request.headers.get("content-type", "application/json"))
            corpo = base64.b64decode(risp.get("corpo") or b"")
            headers = {"Access-Control-Allow-Origin": "*"}
            ct = str(risp.get("content_type") or (risp.get("headers") or {}).get("content-type") or "application/json")
            return Response(content=corpo, status_code=int(risp.get("status") or 200),
                            media_type=ct, headers=headers)
        except Exception as e:
            raise HTTPException(status_code=502, detail="Il computer non risponde tramite tunnel: %s" % e)

    d = _leggi_pc()
    if not d.get("host"):
        raise HTTPException(status_code=503, detail="Nessun computer registrato su questo server.")
    import httpx
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
    motivo7 = sicurezza_7bis.motivo_rifiuto_7bis(websocket)
    if motivo7 is not None:
        sicurezza_7bis.registra_rifiuto(motivo7, websocket)
        await websocket.close(code=4403)
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
# TUNNEL AGENTE: il PC si connette IN USCITA al server (nessuna porta aperta sul PC).
# Il server gli gira le richieste /pc/* dentro questo canale. Serve per togliere Tailscale.
# =====================================================================
import multiutente  # noqa: E402

def _utente_da_richiesta(request) -> str:
    """Identifica l'utente: chiave personale -> uid, altrimenti singolo agente connesso."""
    chiave = str(request.headers.get("x-fbl-chiave") or request.query_params.get("chiave") or "")
    if not chiave:
        try:
            st = multiutente.stato()
            if len(st) == 1:
                return next(iter(st.keys()))
        except Exception:
            pass
        return ""
    try:
        import auth_server
        uid = auth_server.valida_chiave(chiave)
        if uid:
            return uid
    except Exception:
        pass
    try:
        st = multiutente.stato()
        if len(st) == 1:
            return next(iter(st.keys()))
    except Exception:
        pass
    return ""


@app.websocket("/agente")
async def agente_ws(websocket: WebSocket):
    await websocket.accept()
    agente = None
    try:
        primo = await asyncio.wait_for(websocket.receive_json(), timeout=20)
        if not isinstance(primo, dict) or primo.get("tipo") != "auth":
            await websocket.close(code=4400)
            return
        utente = str(primo.get("utente") or "").strip()
        chiave = str(primo.get("chiave") or "").strip()
        if not utente or not chiave:
            await websocket.close(code=4403)
            return
        try:
            multiutente.registra_utente(utente, chiave)
        except PermissionError:
            if not multiutente.utente_valido(utente, chiave):
                await websocket.close(code=4403)
                return
        except Exception:
            if not multiutente.utente_valido(utente, chiave):
                await websocket.close(code=4403)
                return
        agente = multiutente.collega(utente, websocket)
        await websocket.send_json({"ok": True, "utente": utente})
        while True:
            msg = await websocket.receive_json()
            if isinstance(msg, dict):
                agente.ricevi(msg)
    except Exception:
        pass
    finally:
        if agente is not None:
            try:
                multiutente.scollega(agente.utente, agente)
            except Exception:
                pass
        try:
            await websocket.close()
        except Exception:
            pass

# =====================================================================
# I DOCUMENTI DELL'UTENTE: le rotte /dati vivono in un modulo SOLO.
#
# Stavano qui dentro, cioe' solo su questo server. Il 4 novembre 2026 il proprietario ha chiesto
# di accenderle anche sul suo computer («accendiamolo e lo mettiamo all'interno del nostro disco
# e sul PC»), e il ponte del computer monta lo STESSO router: due copie della stessa logica
# divergono sempre - la lezione pagata due volte il 28 ottobre. Tutto quello che c'era qui ora
# sta in installer_build/build/documenti_utente.py, che questo file ha gia' nel percorso (vedi
# i sys.path in cima).
#
# Qui dentro, in piu', e' stato curato un difetto che il trasloco ha fatto vedere: il registro
# degli ascoltatori non veniva MAI riempito, quindi l'avviso da venti byte non era mai partito.
# =====================================================================
import documenti_utente  # noqa: E402
documenti_utente.registra_router(app)
FIREBASE_PROJECT_ID = documenti_utente.FIREBASE_PROJECT_ID
verifica_token_firebase = documenti_utente.verifica_token_firebase
NOMI_DOCUMENTI = documenti_utente.NOMI_DOCUMENTI
_db_conn = documenti_utente._db_conn
# La dipendenza che ricava l'uid va riesportata con lo STESSO oggetto, non ricreata: i test
# sostituiscono la dipendenza per identita' (app.dependency_overrides[p._uid_dep]), e una copia
# diversa farebbe rispondere 401 a tutto senza che si capisca perche'.
_uid_dep = documenti_utente._uid_dep
_uid_da_richiesta = documenti_utente._uid_da_richiesta

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
