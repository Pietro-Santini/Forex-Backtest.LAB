"""Syntra: il robot non deve mai restare a girare a vuoto, in silenzio.

SEGNALATO dal proprietario (7 ottobre 2026): «il robot non aggiorna piu' la pagina [...] le sale
segnali di Syntra non vengono piu' rilevate».

La causa era nel controllo del giro, non nella lettura dello schermo: `primo` ("non ho ancora fatto
l'inventario") diventava False solo quando la pagina Notifiche veniva TROVATA. Se al primo giro non
si trovava, `primo` restava True per sempre e da quel momento la pagina non si aggiornava piu' e
nessuna notifica veniva consegnata - con lo stato che diceva "collegato, nessun errore".

Qui si guida il giro con pezzi finti: interessa l'ordine delle decisioni, non l'XML di Android.
"""
import asyncio

import pytest

import _percorsi  # noqa: F401
import syntra_lettore as s


class Adb:
    """Un emulatore finto. `trovata` dice se la pagina Notifiche si trova."""

    def __init__(self):
        self.trovata = False
        self.riaperture = 0

    async def collega(self):
        pass

    async def apri_syntra(self):
        self.riaperture += 1

    async def syntra_davanti(self):
        return True


def _gira(monkeypatch, quanti_giri, trovata_dal_giro=None, mancate_prima=0):
    """Fa girare `ciclo` per `quanti_giri` e torna (aggiornamenti, stato, adb)."""
    adb = Adb()
    stato = {}
    aggiornamenti = []
    consegnate = []
    giri = {"n": 0}

    monkeypatch.setattr(s, "Adb", lambda *a, **kw: adb)
    monkeypatch.setattr(s, "prepara_emulatore", lambda *a, **kw: asyncio.sleep(0))

    async def aggiorna(a, st, log, riapri):
        aggiornamenti.append(riapri)

    async def giro(a, visti, primo, log, st):
        giri["n"] += 1
        if trovata_dal_giro is not None and giri["n"] >= trovata_dal_giro:
            adb.trovata = True
        st["syntra_notifiche"] = "ok" if adb.trovata else "pagina Notifiche non trovata"
        if not adb.trovata:
            return []
        # Una notifica sola: all'inventario non si consegna, dopo si'.
        return [] if primo else [{"utente": "Mario", "finta": True}]

    async def consegna(sc, visti, cons, log, st):
        consegnate.append(sc)

    monkeypatch.setattr(s, "aggiorna_notifiche", aggiorna)
    monkeypatch.setattr(s, "giro_notifiche", giro)
    monkeypatch.setattr(s, "_consegna_scheda", consegna)

    # Niente attese vere: al giro numero `quanti_giri` si esce.
    async def dormi(_):
        if giri["n"] >= quanti_giri:
            raise asyncio.CancelledError()

    monkeypatch.setattr(s.asyncio, "sleep", dormi)

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(s.ciclo({"intervallo_s": 0, "avvio_automatico": False},
                            lambda *a: None, lambda m: None, stato))
    return aggiornamenti, stato, adb, consegnate


def test_la_pagina_si_aggiorna_anche_se_non_si_trova(monkeypatch):
    """IL DIFETTO. Pagina mai trovata: prima restava zero aggiornamenti, per sempre."""
    aggiornamenti, stato, adb, _ = _gira(monkeypatch, quanti_giri=6)
    assert aggiornamenti, "la lista non si tirava piu' giu': e' il difetto segnalato"


def test_lo_dice_invece_di_restare_zitto(monkeypatch):
    """Prima lo stato diceva collegato e nessun errore, mentre non arrivava niente."""
    _, stato, _, _ = _gira(monkeypatch, quanti_giri=5)
    assert stato.get("syntra_errore"), "girare a vuoto senza dirlo e' il motivo per cui non si capiva"
    assert "Notifiche" in stato["syntra_errore"]


def test_dopo_molti_tentativi_riapre_syntra(monkeypatch):
    """Se la pagina non si trova, l'emulatore e' su un'altra schermata: cercare l'icona non basta."""
    _, _, adb, _ = _gira(monkeypatch, quanti_giri=22)
    assert adb.riaperture >= 1


def test_quando_la_pagina_torna_riparte_e_consegna(monkeypatch):
    """Il caso che contava: l'inventario si chiude al ritrovamento e i segnali ripartono."""
    _, stato, _, consegnate = _gira(monkeypatch, quanti_giri=6, trovata_dal_giro=3)
    assert stato.get("syntra_errore") is None, "ritrovata la pagina, l'errore va via"
    assert consegnate, "dopo l'inventario le notifiche devono essere consegnate"


def test_tutto_bene_dal_primo_giro_resta_come_prima(monkeypatch):
    """Nessuna regressione: al primo giro si fa l'inventario e NON si consegna niente di vecchio."""
    aggiornamenti, stato, _, consegnate = _gira(monkeypatch, quanti_giri=1, trovata_dal_giro=1)
    assert aggiornamenti == [], "al primo giro non si tira giu' la lista: si guarda cosa c'e' gia'"
    assert consegnate == [], "le notifiche gia' presenti non si aprono"
    assert stato.get("syntra_errore") is None


def test_su_linux_lo_dice_dove_l_app_lo_legge(monkeypatch):
    """Difetto introdotto col messaggio stesso: finiva in una chiave che l'app non guarda."""
    monkeypatch.setattr(s.os, "name", "posix", raising=False)
    import os as _o
    monkeypatch.setattr(_o, "name", "posix")
    stato = {"syntra_collegato": True}
    asyncio.run(s.ciclo({}, lambda *a: None, lambda m: None, stato))
    assert "BlueStacks" in (stato.get("syntra_errore") or ""), \
        "l'app mostra syntra_errore: scritto altrove, il messaggio non arriva a nessuno"
    assert stato.get("syntra_collegato") is False
