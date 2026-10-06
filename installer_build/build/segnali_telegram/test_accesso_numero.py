# -*- coding: utf-8 -*-
"""Prova del ciclo di accesso quando il numero e' sbagliato.

E' esattamente il percorso che si era rotto: un numero non interpretabile arrivava a Telethon, che
rispondeva "bytes or str expected, not NoneType" e faceva morire la sorgente - per riprovare non
restava che chiudere il processo a mano.

Telethon qui e' finto: serve solo a vedere COSA gli viene passato e a farlo fallire a comando.
Niente rete, niente account veri.
"""
import asyncio
import sys
import types

CHIAMATE = []


class FintoInvio:
    phone_code_hash = "hash-finto"


class FintoClient:
    def __init__(self, sessione, api_id, api_hash):
        CHIAMATE.append(("init", sessione, api_id, api_hash))

    async def connect(self):
        CHIAMATE.append(("connect",))

    async def is_user_authorized(self):
        return False

    async def send_code_request(self, telefono):
        CHIAMATE.append(("send_code_request", telefono))
        # Numero formalmente valido ma rifiutato da Telegram: succede davvero (numeri inesistenti,
        # troppi tentativi). Deve poter essere ribattuto.
        if telefono == "391111111111":
            raise ValueError("numero rifiutato dal server")
        return FintoInvio()

    async def sign_in(self, *a, **k):
        CHIAMATE.append(("sign_in", a, k))

    async def get_entity(self, c):
        CHIAMATE.append(("get_entity", c))
        raise RuntimeError("nessuna chat nella prova")

    def on(self, *a, **k):
        return lambda f: f

    async def run_until_disconnected(self):
        return


class SessionPasswordNeededError(Exception):
    pass


class PhoneCodeInvalidError(Exception):
    pass


finto = types.ModuleType("telethon")
finto.TelegramClient = FintoClient
finto.events = types.SimpleNamespace(NewMessage=lambda **k: None)
errori = types.ModuleType("telethon.errors")
errori.SessionPasswordNeededError = SessionPasswordNeededError
errori.PhoneCodeInvalidError = PhoneCodeInvalidError
finto.errors = errori
sys.modules["telethon"] = finto
sys.modules["telethon.errors"] = errori

import segnali_bridge as b  # noqa: E402  (l'import deve venire DOPO il finto telethon)

OK = True


def prova(nome, cond, extra=""):
    global OK
    if not cond:
        OK = False
    print(("  " + nome).ljust(58) + ("ok" if cond else "PROBLEMA") + (("   " + str(extra)) if extra else ""))


async def risponditore(sequenza):
    """Fa la parte dell'app: aspetta che il ponte chieda qualcosa e risponde."""
    for atteso, valore in sequenza:
        for _ in range(200):
            if b.ACCESSO["serve"] == atteso:
                break
            await asyncio.sleep(0.01)
        else:
            print("      (il ponte non ha mai chiesto %r)" % atteso)
            return
        b._accesso_ricevi(atteso, valore)
        await asyncio.sleep(0.02)


async def principale():
    b.STATO["sim"] = False
    b.STATO["errore"] = None
    b.ACCESSO["serve"] = None
    b.ACCESSO["errore"] = None

    print("\nNumero sbagliato: si richiede invece di morire\n")
    compito = asyncio.ensure_future(b.sorgente_telegram())
    await risponditore([
        ("telefono", "ciao"),            # non e' un numero
        ("telefono", "+39 111 1111111"), # valido, ma il server lo rifiuta
        ("telefono", "+39 333 1234567"), # buono
        ("codice", "12345"),
    ])
    try:
        await asyncio.wait_for(compito, timeout=5)
    except asyncio.TimeoutError:
        compito.cancel()

    numeri = [c[1] for c in CHIAMATE if c[0] == "send_code_request"]
    prova("il numero non valido non arriva mai a Telegram", "ciao" not in numeri, numeri)
    prova("quello rifiutato dal server si puo' ribattere", "391111111111" in numeri, numeri)
    prova("alla fine passa quello buono", "393331234567" in numeri, numeri)
    prova("e si arriva al codice", any(c[0] == "sign_in" for c in CHIAMATE))
    prova("la sorgente non e' morta al primo errore", len(numeri) >= 2, "%d tentativi" % len(numeri))

    print("\nSe si annulla, lo dice chiaramente\n")
    CHIAMATE.clear()
    b.STATO["errore"] = None
    compito = asyncio.ensure_future(b.sorgente_telegram())
    await asyncio.sleep(0.1)
    b._accesso_ricevi("telefono", "")     # l'app annulla
    try:
        await asyncio.wait_for(compito, timeout=5)
    except asyncio.TimeoutError:
        compito.cancel()
    prova("il messaggio spiega cosa fare", "Collegamento" in (b.STATO["errore"] or ""), b.STATO["errore"])

    print("\nESITO:", "tutto ok" if OK else "ci sono problemi")
    return 0 if OK else 1


sys.exit(asyncio.run(principale()))
