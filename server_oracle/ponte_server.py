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


@app.get("/health")
def health():
    return {"ok": True, "servizio": "server-oracle", "mt5": False, "kraken": "simulato",
            "accesso_remoto": bool(accesso.carica_accesso().get("rete"))}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=accesso.host_di_ascolto(), port=int(os.environ.get("FBL_PORTA", "8000")), log_level="warning")
