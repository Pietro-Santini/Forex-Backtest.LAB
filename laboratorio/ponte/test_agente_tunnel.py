# -*- coding: utf-8 -*-
"""Tunnel agente: il PC si connette in uscita al server, il server gli gira /pc/* dentro il canale."""
import asyncio
import base64
import importlib
import json
import os
import socket
import sys
import threading
import time

import pytest
import httpx

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.dirname(os.path.dirname(QUI))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))
sys.path.insert(0, os.path.join(RADICE, "server_oracle"))


def _porta_libera():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


@pytest.fixture()
def server(tmp_path, monkeypatch):
    monkeypatch.setenv("FBL_DATI", str(tmp_path))
    monkeypatch.setenv("FBL_ACCESSO_FILE", str(tmp_path / "accesso_remoto.json"))
    (tmp_path / "accesso_remoto.json").write_text(
        json.dumps({"rete": True, "chiave": "chiave-del-server"}), encoding="utf-8")
    import ponte_server
    importlib.reload(ponte_server)
    import multiutente
    importlib.reload(multiutente)
    mu = multiutente
    import uvicorn
    porta = _porta_libera()
    cfg = uvicorn.Config(ponte_server.app, host="127.0.0.1", port=porta, log_level="error")
    srv = uvicorn.Server(cfg)
    th = threading.Thread(target=srv.run, daemon=True)
    th.start()
    for _ in range(100):
        try:
            httpx.get(f"http://127.0.0.1:{porta}/health", params={"chiave": "chiave-del-server"}, timeout=1)
            break
        except Exception:
            time.sleep(0.1)
    yield ponte_server, mu, porta
    srv.should_exit = True


def test_agente_riceve_richiesta_pc(server):
    ponte, mu, porta = server
    mu.registra_utente("utente1", "chiave-lunga-del-pc-1234567890", "PC")

    async def scenario():
        import websockets
        async with websockets.connect(f"ws://127.0.0.1:{porta}/agente") as ws:
            await ws.send(json.dumps({"tipo": "auth", "utente": "utente1", "chiave": "chiave-lunga-del-pc-1234567890"}))
            ack = json.loads(await ws.recv())
            assert ack.get("ok") is True

            async def chiedi():
                async with httpx.AsyncClient() as ac:
                    r = await ac.get(f"http://127.0.0.1:{porta}/pc/8000/health", params={"chiave": "chiave-del-server"})
                    return r.status_code, r.text

            task = asyncio.create_task(chiedi())
            req = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
            assert req["tipo"] == "http"
            assert req["porta"] == 8000
            assert req["percorso"] == "health"
            await ws.send(json.dumps({"id": req["id"], "tipo": "http", "status": 200,
                                      "headers": {"content-type": "application/json"},
                                      "corpo": base64.b64encode(b'{"ok":true}').decode("ascii")}))
            status, body = await asyncio.wait_for(task, timeout=5)
            assert status == 200
            assert '"ok":true' in body

    asyncio.run(scenario())
