# -*- coding: utf-8 -*-
"""L'app non deve dover CHIEDERE per sapere che il ponte vuole il codice.

Il difetto segnalato: dopo aver mandato il numero bisognava premere "Ricontrolla" per far comparire
il popup del codice, e premerlo di nuovo dopo il codice per vedersi collegati. Motivo: lo stato
veniva mandato solo in risposta a un comando, e durante l'accesso l'app non manda comandi.

Questa prova fa la parte dell'app che sta ZITTA: manda il numero, poi il codice, e per il resto si
limita ad ascoltare. Se il popup del codice e il collegamento non arrivano da soli, fallisce.
Telethon e' finto: nessuna rete, nessun account vero.
"""
import asyncio
import json
import sys
import threading
import time
import types

PORTA = 8793


# ----------------------------------------------------------------- finto Telethon
class FintoInvio:
    phone_code_hash = "hash-finto"


class FintoClient:
    def __init__(self, *a, **k):
        pass

    async def connect(self):
        pass

    async def is_user_authorized(self):
        return False

    async def send_code_request(self, telefono):
        await asyncio.sleep(0.4)      # Telegram ci mette un attimo: e' proprio la finestra in cui
        return FintoInvio()           # prima non arrivava niente all'app

    async def sign_in(self, *a, **k):
        await asyncio.sleep(0.2)

    async def get_entity(self, c):
        raise RuntimeError("nessuna chat nella prova")

    def on(self, *a, **k):
        return lambda f: f

    async def run_until_disconnected(self):
        await asyncio.sleep(3600)


finto = types.ModuleType("telethon")
finto.TelegramClient = FintoClient
finto.events = types.SimpleNamespace(NewMessage=lambda **k: None)
errori = types.ModuleType("telethon.errors")
errori.SessionPasswordNeededError = type("SessionPasswordNeededError", (Exception,), {})
errori.PhoneCodeInvalidError = type("PhoneCodeInvalidError", (Exception,), {})
finto.errors = errori
sys.modules["telethon"] = finto
sys.modules["telethon.errors"] = errori

import segnali_bridge as b  # noqa: E402
import uvicorn  # noqa: E402
import websockets  # noqa: E402

OK = True


def prova(nome, cond, extra=""):
    global OK
    if not cond:
        OK = False
    print(("  " + nome).ljust(60) + ("ok" if cond else "PROBLEMA") + (("   " + str(extra)) if extra else ""))


async def aspetta_stato(ws, condizione, secondi=6.0):
    """Ascolta e basta, finche' non arriva uno stato che soddisfa la condizione."""
    fine = time.time() + secondi
    while time.time() < fine:
        try:
            grezzo = await asyncio.wait_for(ws.recv(), timeout=max(0.1, fine - time.time()))
        except asyncio.TimeoutError:
            return None
        m = json.loads(grezzo)
        if m.get("tipo") == "stato" and condizione(m):
            return m
    return None


async def principale():
    b.STATO["sim"] = False
    cfg = uvicorn.Config(b.app, host="127.0.0.1", port=PORTA, log_level="error")
    server = uvicorn.Server(cfg)
    threading.Thread(target=server.run, daemon=True).start()
    await asyncio.sleep(2.0)

    # La sorgente NON si avvia qui: la fa gia' partire il server all'avvio (lifespan), esattamente
    # come nell'uso vero. Avviarne una seconda in QUESTO ciclo di eventi voleva dire due sorgenti
    # in due thread diversi: quella di qui aspettava la risposta su un evento dell'altro ciclo, si
    # svegliava solo allo scadere dei 6 secondi di attesa del test, e il test falliva sempre -
    # anche sul codice giusto.

    async with websockets.connect("ws://127.0.0.1:%d/ws/segnali" % PORTA) as ws:
        print("\nL'app sta in ascolto e non chiede niente\n")

        m = await aspetta_stato(ws, lambda x: x.get("accesso_serve") == "telefono")
        prova("la richiesta del NUMERO arriva da sola", m is not None)

        await ws.send(json.dumps({"azione": "accesso_telefono", "valore": "+39 333 1234567"}))

        # Da qui in poi l'app non manda piu' niente: e' esattamente il punto in cui prima
        # bisognava premere "Ricontrolla".
        m = await aspetta_stato(ws, lambda x: x.get("accesso_serve") == "codice")
        prova("la richiesta del CODICE arriva da sola", m is not None,
              "" if m else "e' questo il difetto segnalato")

        await ws.send(json.dumps({"azione": "accesso_codice", "valore": "12345"}))

        m = await aspetta_stato(ws, lambda x: x.get("collegato") is True)
        prova("il COLLEGATO arriva da solo", m is not None,
              "" if m else "bisognava ripremere il tasto")

    print("\nESITO:", "tutto ok" if OK else "ci sono problemi")
    return 0 if OK else 1


sys.exit(asyncio.run(principale()))
