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

from fastapi import FastAPI, HTTPException, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

import accesso_condiviso as accesso  # noqa: E402
import kraken_ordini  # noqa: E402

app = FastAPI(title="Forex Backtest LAB - server")
app.add_middleware(CORSMiddleware, **accesso.opzioni_cors())
accesso.installa_controllo_chiave(app)


@app.middleware("http")
async def _solo_simulato(request: Request, call_next):
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


@app.api_route("/pc/{percorso:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def pc_inoltra(percorso: str, request: Request):
    """Gira al PC una richiesta arrivata dal telefono, mettendoci la chiave del PC."""
    d = _leggi_pc()
    if not d.get("host"):
        raise HTTPException(status_code=503, detail="Nessun computer registrato su questo server.")
    import httpx
    from fastapi.responses import Response
    url = "https://%s:8000/%s" % (d["host"], percorso)
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


@app.get("/health")
def health():
    pc = _leggi_pc()
    return {"ok": True, "servizio": "server-oracle", "mt5": False, "kraken": "simulato",
            "accesso_remoto": bool(accesso.carica_accesso().get("rete")),
            # Col telefono si sa gia' se aspettarsi MT5, senza una seconda domanda.
            "pc": {"registrato": bool(pc.get("host")), "host": pc.get("host", ""), "visto": pc.get("visto")}}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=accesso.host_di_ascolto(), port=int(os.environ.get("FBL_PORTA", "8000")), log_level="warning")
