# -*- coding: utf-8 -*-
"""Prova del meccanismo di accesso guidato dall'app (senza Telegram vero).

Quello che conta qui: che la richiesta arrivi all'app, che la risposta sblocchi l'attesa, che il
valore venga CONSUMATO (una credenziale non deve restare in memoria) e che un'attesa senza risposta
finisca invece di bloccare il ponte per sempre.
"""
import asyncio
import sys

import segnali_bridge as b

OK = True


def prova(nome, cond, extra=""):
    global OK
    if not cond:
        OK = False
    print(("  " + nome).ljust(58) + ("ok" if cond else "PROBLEMA") + (("   " + str(extra)) if extra else ""))


async def principale():
    print("\nRichiesta e risposta\n")

    async def rispondi_fra_poco(cosa, valore, ritardo=0.05):
        await asyncio.sleep(ritardo)
        b._accesso_ricevi(cosa, valore)

    asyncio.ensure_future(rispondi_fra_poco("telefono", "+391234567890"))
    valore = await b._accesso_attendi("telefono", attesa_massima=3)
    prova("il numero arriva dall'app", valore == "+391234567890", valore)
    prova("e viene tolto dalla memoria subito", "telefono" not in b._RISPOSTE)
    prova("la richiesta viene chiusa", b.ACCESSO["serve"] is None)

    # Mentre aspetta, lo stato deve DIRE cosa sta aspettando: e' quello che fa aprire il popup.
    attesa = asyncio.ensure_future(b._accesso_attendi("codice", attesa_massima=3))
    await asyncio.sleep(0.05)
    prova("mentre aspetta, lo stato dice cosa serve", b.ACCESSO["serve"] == "codice", b.ACCESSO["serve"])
    stato = await b._stato_chat()
    prova("e lo stato mandato all'app lo riporta", stato.get("accesso_serve") == "codice", stato.get("accesso_serve"))
    b._accesso_ricevi("codice", "54321")
    prova("il codice arriva", (await attesa) == "54321")

    print("\nUn accesso lasciato a meta' non blocca il ponte\n")
    scaduto = await b._accesso_attendi("password", attesa_massima=0.3)
    prova("senza risposta l'attesa finisce", scaduto is None)
    prova("e lo dice", bool(b.ACCESSO["errore"]), b.ACCESSO["errore"])
    prova("senza restare in attesa per sempre", b.ACCESSO["serve"] is None)

    print("\nLe credenziali non finiscono nei log\n")
    righe = []
    vero_log = b._log
    b._log = lambda v, t: righe.append(t)
    b._accesso_ricevi("password", "SUPERSEGRETA123")
    b._RISPOSTE.pop("password", None)
    b._log = vero_log
    prova("il valore non compare in nessuna riga di log",
          all("SUPERSEGRETA123" not in r for r in righe), " | ".join(righe))

    print("\nESITO:", "tutto ok" if OK else "ci sono problemi")
    return 0 if OK else 1


sys.exit(asyncio.get_event_loop().run_until_complete(principale())
         if sys.version_info < (3, 10) else asyncio.run(principale()))
