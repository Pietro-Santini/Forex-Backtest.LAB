# -*- coding: utf-8 -*-
"""Agente PC: connessione in USCITA verso il server (nessuna porta aperta sul PC).

Il PC apre un WebSocket verso https://<dominio>/agente e resta in ascolto.
Quando il server riceve una richiesta /pc/*, la gira dentro questo canale; qui
viene eseguita su 127.0.0.1:<porta> e la risposta torna indietro.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import threading
from typing import Optional

log = logging.getLogger("agente_pc")

_THREAD: Optional[threading.Thread] = None
_STOP = threading.Event()
_STATO = {"attivo": False, "connesso": False, "errore": None, "server": None, "utente": None}


def stato() -> dict:
    return dict(_STATO)


def ferma_agente() -> None:
    _STOP.set()
    _STATO["attivo"] = False
    _STATO["connesso"] = False


async def _esegui_http(porta: int, percorso: str, metodo: str, query: dict, corpo_b64: str, content_type: str) -> dict:
    import httpx
    url = f"http://127.0.0.1:{int(porta)}/{percorso.lstrip('/')}"
    params = dict(query or {})
    body = base64.b64decode(corpo_b64 or b"")
    headers = {}
    if content_type:
        headers["content-type"] = content_type
    async with httpx.AsyncClient(timeout=30.0) as cli:
        r = await cli.request(metodo.upper(), url, params=params, content=body, headers=headers)
    return {
        "tipo": "http",
        "status": r.status_code,
        "headers": {"content-type": r.headers.get("content-type", "application/json")},
        "corpo": base64.b64encode(r.content).decode("ascii"),
        "content_type": r.headers.get("content-type", "application/json"),
    }


async def _gestisci(ws, msg: dict) -> None:
    tipo = str(msg.get("tipo") or "")
    mid = msg.get("id")
    if tipo == "http":
        try:
            risp = await _esegui_http(int(msg.get("porta") or 8000), str(msg.get("percorso") or ""),
                                      str(msg.get("metodo") or "GET"), msg.get("query") or {},
                                      msg.get("corpo") or "", str(msg.get("content_type") or ""))
            risp["id"] = mid
        except Exception as e:
            risp = {"id": mid, "tipo": "http", "status": 502,
                    "headers": {"content-type": "application/json"},
                    "corpo": base64.b64encode(json.dumps({"detail": str(e)}).encode("utf-8")).decode("ascii"),
                    "content_type": "application/json"}
        await ws.send(json.dumps(risp))
    elif tipo == "ws_apri":
        # Canale WS live (prezzi): gestito in modo minimale, chiusura pulita se non supportato.
        try:
            await ws.send(json.dumps({"id": mid, "tipo": "ws_chiuso"}))
        except Exception:
            pass
    elif tipo in ("ws_dato", "ws_chiudi"):
        return


async def _loop(server_url: str, utente: str, chiave: str) -> None:
    import websockets
    url = server_url.rstrip("/")
    if url.startswith("https://"):
        ws_url = "wss://" + url[len("https://"):] + "/agente"
    elif url.startswith("http://"):
        ws_url = "ws://" + url[len("http://"):] + "/agente"
    else:
        ws_url = "wss://" + url + "/agente"
    backoff = 2
    while not _STOP.is_set():
        try:
            async with websockets.connect(ws_url, ping_interval=20, ping_timeout=20, open_timeout=20) as ws:
                await ws.send(json.dumps({"tipo": "auth", "utente": utente, "chiave": chiave}))
                ack_raw = await asyncio.wait_for(ws.recv(), timeout=20)
                ack = json.loads(ack_raw)
                if not ack.get("ok"):
                    _STATO["errore"] = str(ack.get("detail") or "auth fallita")
                    _STATO["connesso"] = False
                    await asyncio.sleep(min(backoff, 30))
                    backoff = min(backoff * 2, 30)
                    continue
                _STATO["connesso"] = True
                _STATO["errore"] = None
                backoff = 2
                async for raw in ws:
                    if _STOP.is_set():
                        break
                    try:
                        msg = json.loads(raw)
                    except Exception:
                        continue
                    if isinstance(msg, dict):
                        asyncio.create_task(_gestisci(ws, msg))
        except Exception as e:
            _STATO["connesso"] = False
            _STATO["errore"] = str(e)
            if _STOP.is_set():
                break
            await asyncio.sleep(min(backoff, 30))
            backoff = min(backoff * 2, 30)
    _STATO["connesso"] = False


def _run(server_url: str, utente: str, chiave: str) -> None:
    try:
        asyncio.run(_loop(server_url, utente, chiave))
    except Exception as e:
        _STATO["errore"] = str(e)
        _STATO["connesso"] = False
        _STATO["attivo"] = False


def avvia_agente(server_url: str, utente: str, chiave: str) -> dict:
    global _THREAD
    ferma_agente()
    _STOP.clear()
    _STATO.update({"attivo": True, "connesso": False, "errore": None, "server": server_url, "utente": utente})
    _THREAD = threading.Thread(target=_run, args=(server_url, utente, chiave), daemon=True, name="agente-pc")
    _THREAD.start()
    return stato()
