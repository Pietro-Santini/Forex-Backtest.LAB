# -*- coding: utf-8 -*-
"""I DOCUMENTI DELL'UTENTE, TENUTI DA NOI: le rotte /dati, in un modulo solo.

PERCHE' ESISTE QUESTO FILE (4 novembre 2026). Queste rotte vivevano dentro
`server_oracle/ponte_server.py`, cioe' SOLO sul server Linux. Il proprietario ha chiesto di
accenderle sul suo computer: «per quanto riguarda il server, accendiamolo e lo mettiamo
all'interno del nostro disco e sul PC... un'architettura creata sul nostro dispositivo, che in un
domani possiamo anche avere un nostro server dove gireranno tutti i dati di tutti gli utenti».

E il motivo per cui serve, con i numeri suoi: «ieri su Firestore siamo arrivati a 250.000 letture
e 122.000 di scritture. O sistemiamo qualcosa all'interno che non mi faccia pagare, o se no
cambiamo sistema». La scrittura a delta (lato app) taglia le SCRITTURE; le LETTURE le taglia solo
questo, perche' Firestore quando un documento cambia manda agli altri dispositivi il documento
INTERO, mentre qui si manda {nome, versione} - venti byte - e il dispositivo decide se rileggere.

UNA SOLA COPIA DELLA LOGICA. Il ponte del computer (bridge.py, porta 8000) e il server Linux
(ponte_server.py) montano lo STESSO router: due copie della stessa logica divergono sempre, ed e'
la lezione pagata due volte il 28 ottobre.

DOVE STANNO I DATI: in un file SQLite, sul disco.
  - Windows: %APPDATA%\\ForexBacktestLAB\\dati\\dati_utenti.db (la stessa convenzione delle chiavi
    Kraken e dei dati dei segnali: sopravvive agli aggiornamenti, perche' non sta nella cartella
    del programma).
  - Linux (il server): /dati/dati_utenti.db, come prima.
  - FBL_DATI nell'ambiente vince su tutto: e' cosi' che i test lo mandano in una cartella usa e
    getta.

CHI SEI LO DICE FIREBASE, NON IL CLIENT. Ogni rotta vuole un token Firebase valido
("Authorization: Bearer <id token>") e ne ricava l'uid verificando la firma contro le chiavi
pubbliche di Google. Un uid mandato dal client e' una dichiarazione, non una prova: non si accetta
da nessuna parte.
"""
import os
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket

try:
    from google.oauth2 import id_token as _fb_id_token
    from google.auth.transport import requests as _fb_requests
    _FB_AUTH_OK = True
except Exception:          # pragma: no cover - senza google-auth le rotte rispondono 401
    _FB_AUTH_OK = False


router = APIRouter()

# L'ID del progetto viene da app.html (firebaseConfig.projectId): "forex-backtest-lab".
FIREBASE_PROJECT_ID = os.environ.get("FBL_FIREBASE_PROJECT_ID", "forex-backtest-lab")


def cartella_dati() -> str:
    """La cartella del file SQLite. Si legge a ogni chiamata, non una volta all'import: i test
    cambiano FBL_DATI dopo aver importato il modulo, e un valore congelato all'import li
    manderebbe a scrivere nella cartella vera del proprietario."""
    scelta = os.environ.get("FBL_DATI")
    if scelta:
        return scelta
    if os.name == "nt":
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
        return os.path.join(base, "ForexBacktestLAB", "dati")
    return "/dati"


def percorso_db() -> str:
    return os.path.join(cartella_dati(), "dati_utenti.db")


def _db_conn():
    try:
        os.makedirs(cartella_dati(), exist_ok=True)
    except Exception:
        pass
    conn = sqlite3.connect(percorso_db(), timeout=10)
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
    """L'uid se il token e' valido, altrimenti None. Mai fidarsi di un uid mandato dal client."""
    if not token or not _FB_AUTH_OK:
        return None
    try:
        info = _fb_id_token.verify_firebase_token(
            token, _fb_requests.Request(), audience=FIREBASE_PROJECT_ID)
        if not info:
            return None
        uid = info.get("sub") or info.get("user_id")
        if not str(info.get("iss", "")).startswith("https://securetoken.google.com/"):
            return None
        if info.get("aud") != FIREBASE_PROJECT_ID:
            return None
        return uid
    except Exception:
        return None


def _uid_da_richiesta(request: Request):
    auth = request.headers.get("authorization", "") or ""
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Token Firebase mancante.")
    uid = verifica_token_firebase(auth[7:].strip())
    if not uid:
        raise HTTPException(status_code=401, detail="Token Firebase non valido o scaduto.")
    return uid


async def _uid_dep(request: Request):
    return _uid_da_richiesta(request)


# ===================== CHI STA ASCOLTANDO, E COME LO SI AVVISA =====================
#
# DIFETTO TROVATO IL 4 NOVEMBRE 2026, leggendo il codice per accendere il server sul computer:
# questo registro NON VENIVA MAI RIEMPITO. Il WebSocket accettava la connessione, mandava
# l'elenco iniziale e poi taceva; `avvisa()` trovava sempre un insieme vuoto. Il risparmio che il
# commento dichiarava - venti byte invece del documento intero - non e' quindi MAI entrato in
# funzione: scrivendo dal computer, il telefono non lo sapeva. Non era un ascolto, era una
# sincronizzazione sola andata. Ora il socket si iscrive appena accettato e si cancella quando
# cade.
#
# PERCHE' BASTA LA MEMORIA: il ponte gira come UN solo processo, quindi tutti i WebSocket di tutti
# gli utenti stanno nel processo di chi scrive e un dizionario non ha niente da sincronizzare. Se
# un domani si passasse a piu' processi, QUESTO e' il punto da rifare - scritto qui perche' si
# sappia dove guardare invece di scoprirlo da un difetto.
_ascoltatori = {}          # uid -> set di WebSocket
_loop_principale = None    # il ciclo di eventi, catturato alla prima connessione


def avvisa(uid, nome, versione):
    """Dice agli altri dispositivi di questo utente che un documento e' cambiato.

    MANDA SOLO {nome, versione}, MAI IL CONTENUTO. Non solleva mai: un avviso non consegnato non
    deve far fallire una scrittura che e' gia' andata a buon fine sul disco.
    """
    try:
        import asyncio
        import json as _j
        quali = list(_ascoltatori.get(uid) or ())
        if not quali or _loop_principale is None:
            return
        messaggio = _j.dumps({"nome": nome, "versione": versione})

        async def _manda(ws):
            try:
                await ws.send_text(messaggio)
            except Exception:
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


# I documenti che si tengono per ogni utente. Una lista SOLA, invece dello stesso elenco ripetuto
# in tre rotte: due elenchi che un giorno divergono sono un documento che si scrive da una parte e
# non si legge dall'altra (succedeva col footprint, rifiutato con 400 in silenzio).
NOMI_DOCUMENTI = ("session", "grafico", "collegamento", "preferenze", "footprint")


@router.get("/dati/{nome}")
def dati_leggi(nome: str, uid: str = Depends(_uid_dep)):
    if nome not in NOMI_DOCUMENTI:
        raise HTTPException(status_code=400, detail="Nome documento non previsto.")
    conn = _db_conn()
    try:
        cur = conn.execute(
            "SELECT contenuto, versione, aggiornato FROM documenti WHERE uid=? AND nome=?",
            (uid, nome))
        r = cur.fetchone()
        if not r:
            return {"ok": True, "nome": nome, "contenuto": None, "versione": 0, "aggiornato": None}
        import json as _j
        return {"ok": True, "nome": nome, "contenuto": _j.loads(r[0]),
                "versione": r[1], "aggiornato": r[2]}
    finally:
        conn.close()


@router.put("/dati/{nome}")
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
        conn.execute(
            "INSERT INTO documenti (uid,nome,contenuto,versione,aggiornato) VALUES (?,?,?,?,?) "
            "ON CONFLICT(uid,nome) DO UPDATE SET contenuto=excluded.contenuto, "
            "versione=excluded.versione, aggiornato=excluded.aggiornato",
            (uid, nome, _j.dumps(contenuto, ensure_ascii=False), nuova_versione,
             int(_t.time() * 1000)))
        conn.commit()
        avvisa(uid, nome, nuova_versione)
        return {"ok": True, "nome": nome, "versione": nuova_versione}
    finally:
        conn.close()


@router.patch("/dati/{nome}")
def dati_fondi(nome: str, corpo: dict, uid: str = Depends(_uid_dep)):
    """Fusione: i campi mandati sovrascrivono, gli altri restano. E' la scrittura a delta.

    ATTENZIONE, ed e' la stessa avvertenza che vale per Firestore: la fusione NON CANCELLA. Una
    chiave che e' sparita dall'app resta qui. Chi scrive deve accorgersene e mandare una PUT
    intera in quel caso - lato app lo fa fblCloudCampiCambiati(), che davanti a una chiave sparita
    chiede una scrittura intera.
    """
    if nome not in NOMI_DOCUMENTI:
        raise HTTPException(status_code=400, detail="Nome documento non previsto.")
    import json as _j
    import time as _t
    campi = corpo.get("contenuto") if isinstance(corpo, dict) else None
    if not isinstance(campi, dict):
        raise HTTPException(status_code=400, detail="Il campo 'contenuto' deve essere un oggetto.")
    conn = _db_conn()
    try:
        cur = conn.execute("SELECT contenuto, versione FROM documenti WHERE uid=? AND nome=?",
                           (uid, nome))
        r = cur.fetchone()
        if r:
            try:
                vecchio = _j.loads(r[0])
                if not isinstance(vecchio, dict):
                    vecchio = {}
            except Exception:
                vecchio = {}
            vecchio.update(campi)
            nuova_versione = r[1] + 1
        else:
            vecchio = campi
            nuova_versione = 1
        conn.execute(
            "INSERT INTO documenti (uid,nome,contenuto,versione,aggiornato) VALUES (?,?,?,?,?) "
            "ON CONFLICT(uid,nome) DO UPDATE SET contenuto=excluded.contenuto, "
            "versione=excluded.versione, aggiornato=excluded.aggiornato",
            (uid, nome, _j.dumps(vecchio, ensure_ascii=False), nuova_versione,
             int(_t.time() * 1000)))
        conn.commit()
        # ANCHE LA FUSIONE AVVISA, e prima non lo faceva: un delta che non sveglia gli altri
        # dispositivi li lascia con i dati vecchi finche' non ricaricano a mano. Ed e' proprio il
        # delta la strada normale, da quando la scrittura a campi e' accesa.
        avvisa(uid, nome, nuova_versione)
        return {"ok": True, "nome": nome, "versione": nuova_versione}
    finally:
        conn.close()


@router.post("/dati/trades/aggiungi")
def dati_trades_aggiungi(corpo: dict, uid: str = Depends(_uid_dep)):
    """Append-only: aggiunge solo le operazioni nuove, senza riscrivere il resto."""
    ops = corpo.get("operazioni") if isinstance(corpo, dict) else None
    if not isinstance(ops, list):
        raise HTTPException(status_code=400, detail="Manca il campo 'operazioni' (lista).")
    import json as _j
    import time as _t
    conn = _db_conn()
    try:
        cur = conn.execute("SELECT lista FROM trades WHERE uid=?", (uid,))
        r = cur.fetchone()
        if r:
            try:
                lista = _j.loads(r[0])
            except Exception:
                lista = []
            if not isinstance(lista, list):
                lista = []
            visti = set(_j.dumps(o, sort_keys=True, ensure_ascii=False) for o in lista)
            for o in ops:
                chiave = _j.dumps(o, sort_keys=True, ensure_ascii=False)
                if chiave not in visti:
                    lista.append(o)
                    visti.add(chiave)
        else:
            lista = list(ops)
        conn.execute("INSERT INTO trades (uid,lista,aggiornato) VALUES (?,?,?) "
                     "ON CONFLICT(uid) DO UPDATE SET lista=excluded.lista, "
                     "aggiornato=excluded.aggiornato",
                     (uid, _j.dumps(lista, ensure_ascii=False), int(_t.time() * 1000)))
        conn.commit()
        return {"ok": True, "aggiunte": len(ops), "totale": len(lista)}
    finally:
        conn.close()


@router.get("/dati/trades")
def dati_trades_leggi(uid: str = Depends(_uid_dep)):
    import json as _j
    conn = _db_conn()
    try:
        cur = conn.execute("SELECT lista, aggiornato FROM trades WHERE uid=?", (uid,))
        r = cur.fetchone()
        if not r:
            return {"ok": True, "lista": [], "aggiornato": None}
        try:
            lista = _j.loads(r[0])
        except Exception:
            lista = []
        if not isinstance(lista, list):
            lista = []
        return {"ok": True, "lista": lista, "aggiornato": r[1]}
    finally:
        conn.close()


@router.websocket("/dati/ascolta")
async def dati_ascolta(websocket: WebSocket):
    """Ascolto in tempo reale: manda SOLO {nome, versione}, mai il contenuto.

    Il token arriva come parametro nell'indirizzo (?token=<id token>): il WebSocket non ha un
    header Authorization comodo in tutti i browser.
    """
    global _loop_principale
    token = websocket.query_params.get("token", "")
    uid = verifica_token_firebase(token)
    if not uid:
        await websocket.close(code=4403)
        return
    await websocket.accept()
    # IL CICLO DI EVENTI si cattura qui, alla prima connessione, invece che in un gancio di avvio
    # dell'applicazione: cosi' questo modulo si monta su qualunque app (il ponte del computer e il
    # server) senza chiedere a nessuno di ricordarsi un `on_event("startup")`.
    try:
        import asyncio
        _loop_principale = asyncio.get_running_loop()
    except Exception:
        pass
    _ascoltatori.setdefault(uid, set()).add(websocket)
    try:
        import json as _j
        conn = _db_conn()
        try:
            righe = conn.execute("SELECT nome, versione FROM documenti WHERE uid=?",
                                 (uid,)).fetchall()
        finally:
            conn.close()
        for nome, versione in righe:
            await websocket.send_text(_j.dumps({"nome": nome, "versione": versione}))
        # Da qui in avanti e' avvisa() a parlare. La lettura resta in attesa: serve ad accorgersi
        # che il socket e' caduto.
        while True:
            await websocket.receive_text()
    except Exception:
        pass
    finally:
        try:
            _ascoltatori.get(uid, set()).discard(websocket)
            if not _ascoltatori.get(uid):
                _ascoltatori.pop(uid, None)
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass


def registra_router(app):
    """Monta le rotte /dati sull'applicazione passata. Stesso schema di auth_server."""
    app.include_router(router)
    return router
