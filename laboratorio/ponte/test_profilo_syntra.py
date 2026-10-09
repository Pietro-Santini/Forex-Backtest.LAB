"""Passi 15/16 — Storico completo di un utente Syntra.

RICHIESTO dal proprietario: poter scegliere un nome utente e vederne la STORIA COMPLETA, identica
a quella delle sale Telegram (operazioni, win rate, resa gia' calcolati dall'app per ogni sala
"Syntra · <utente>"). Il robot tocca il nome in alto a destra di una casella, si apre il profilo
dell'utente, scorre e legge tutte le operazioni.

VINCOLO esplicito: mentre legge il profilo il robot NON deve aggiornare la pagina delle notifiche
(andrebbe in confusione), e le operazioni della cronologia NON devono finire nella bacheca come
segnali nuovi (aprirebbero posizioni): si ARCHIVIANO, da dove l'app le mostra.

Qui si guida il giro con pezzi finti come in test_syntra_blocco.py: interessa l'ordine delle
decisioni e il vincolo, non l'XML di Android (che il banco non puo' avere).
"""
import asyncio
import json

import pytest

import _percorsi  # noqa: F401
import syntra_lettore as s
import segnali_bridge as sb

# Una scheda come le legge leggi_schermata: riassunto nel content-desc, e il NOME UTENTE come nodo
# cliccabile in alto a destra della casella (da lì si apre il profilo).
XML_MARIO = """<root>
 <node content-desc="Acquisto&#10;EURUSD&#10;23 set, 2:00 PM&#10;Entrata:&#10;1.1" bounds="[0,0][100,40]">
  <node content-desc="Mario" clickable="true" bounds="[70,0][95,15]"/>
  <node content-desc="TP #1:&#10;1.12"/>
  <node content-desc="SL:&#10;1.09"/>
 </node>
</root>"""


class Adb:
    """Emulatore finto: restituisce sempre la stessa schermata e registra i tocchi."""

    def __init__(self, xml=XML_MARIO):
        self.xml = xml
        self.tocchi = []
        self.scorri_chiamate = 0

    async def collega(self):
        pass

    async def apri_syntra(self):
        pass

    async def syntra_davanti(self):
        return True

    async def schermata(self):
        return self.xml

    async def tocca(self, x, y):
        self.tocchi.append((x, y))

    async def scorri(self, x, y1, y2):
        self.scorri_chiamate += 1

    async def indietro(self):
        pass


def _gira_con_profilo(monkeypatch, schede_finte, quanti_giri=2):
    """Un giro di `ciclo` con la richiesta di profilo gia' impostata. Se durante la lettura il robot
    tocca la pagina notifiche (o consegna alla bacheca), i finti lo fanno notare subito."""
    monkeypatch.setattr(s, "sistema_windows", lambda: True)
    adb = Adb()
    stato = {"syntra_leggi_profilo": {"utente": "Mario", "pronto": False}}
    archiviati = []
    chiamate = []
    giri = {"n": 0}

    async def aggiorna(a, st, log, riapri):
        chiamate.append("notifiche")

    async def giro_not(a, visti, primo, log, st):
        chiamate.append("notifiche")
        st["syntra_notifiche"] = "ok"
        return []

    async def consegna(sc, visti, cons, log, st):
        chiamate.append("bacheca")

    async def profilo(a, utente, pagine, log, st):
        # VINCOLO: se arriviamo qui, le notifiche NON devono ancora essere state toccate in questo giro.
        print("PROFILO FAKE CHIAMATO", utente, "chiamate=", chiamate, "schede=", schede_finte)
        assert chiamate == [], "letto il profilo DOPO aver toccato le notifiche: %r" % (chiamate,)
        return schede_finte

    async def apri_not(a, st, log):
        return True

    def archivia(sala, seg, ts):
        archiviati.append((sala, seg))

    monkeypatch.setattr(s, "Adb", lambda *a, **kw: adb)
    monkeypatch.setattr(s, "prepara_emulatore", lambda *a, **kw: asyncio.sleep(0))
    monkeypatch.setattr(s, "aggiorna_notifiche", aggiorna)
    monkeypatch.setattr(s, "giro_notifiche", giro_not)
    monkeypatch.setattr(s, "_consegna_scheda", consegna)
    monkeypatch.setattr(s, "leggi_profilo", profilo)
    monkeypatch.setattr(s, "apri_notifiche", apri_not)
    monkeypatch.setattr(s.storico_sale, "archivia_syntra", archivia)

    async def dormi(_):
        giri["n"] += 1
        if giri["n"] >= quanti_giri:
            raise asyncio.CancelledError()

    monkeypatch.setattr(s.asyncio, "sleep", dormi)

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(s.ciclo({"intervallo_s": 0, "avvio_automatico": False},
                            lambda *a: None, lambda m: None, stato))
    return stato, archiviati


def test_la_richiesta_di_profilo_legge_e_archivia(monkeypatch):
    """PASSO 15/16. Con la richiesta impostata il robot legge il profilo, archivia le operazioni
    nella cronologia dell'utente e marca la richiesta come pronta per il ponte."""
    schede = [{"utente": "Mario", "asset": "EURUSD", "lato": "BUY", "entrata": 1.1, "sl": 1.09,
               "tp": {1: 1.12}, "stato": "", "bounds": (0, 0, 100, 100)}]
    stato, archiviati = _gira_con_profilo(monkeypatch, schede)
    r = stato["syntra_leggi_profilo"]
    assert r.get("pronto") is True, "il ponte deve sapere che la lettura e' finita"
    assert r.get("lette") == 1
    assert archiviati, "le operazioni lette dal profilo vanno archiviate nella cronologia"
    assert archiviati[0][0] == "Syntra · Mario"
    assert archiviati[0][1]["direzione"] == "BUY"
    assert stato.get("syntra_profilo"), "lo stato deve dire cosa sta facendo il robot"


def test_senza_richiesta_non_si_legge_nessun_profilo(monkeypatch):
    """Nessuna regressione: senza la richiesta il giro resta quello delle notifiche."""
    chiamate = []
    monkeypatch.setattr(s, "sistema_windows", lambda: True)
    adb = Adb()
    stato = {}
    aggiornamenti = []
    giri = {"n": 0}

    async def aggiorna(a, st, log, riapri):
        aggiornamenti.append(riapri)

    async def giro_not(a, visti, primo, log, st):
        st["syntra_notifiche"] = "ok"
        return []

    async def profilo(*a, **kw):
        chiamate.append(1)
        return []

    monkeypatch.setattr(s, "Adb", lambda *a, **kw: adb)
    monkeypatch.setattr(s, "prepara_emulatore", lambda *a, **kw: asyncio.sleep(0))
    monkeypatch.setattr(s, "aggiorna_notifiche", aggiorna)
    monkeypatch.setattr(s, "giro_notifiche", giro_not)
    monkeypatch.setattr(s, "_consegna_scheda", lambda *a, **kw: None)
    monkeypatch.setattr(s, "apri_notifiche", lambda a, st, log: True)
    monkeypatch.setattr(s, "leggi_profilo", profilo)

    async def dormi(_):
        giri["n"] += 1
        if giri["n"] >= 2:
            raise asyncio.CancelledError()

    monkeypatch.setattr(s.asyncio, "sleep", dormi)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(s.ciclo({"intervallo_s": 0, "avvio_automatico": False},
                            lambda *a: None, lambda m: None, stato))
    assert chiamate == [], "senza richiesta non si apre nessun profilo"
    assert aggiornamenti, "il giro normale delle notifiche continua come sempre"


def test_leggi_profilo_tocca_il_nome_e_restituisce_le_schede(monkeypatch):
    """PASSO 15. tocca il nome utente (in alto a destra della casella) e torna le sue operazioni."""
    async def _subito(_=0):
        return None

    monkeypatch.setattr(s.asyncio, "sleep", _subito)
    adb = Adb()
    lette = asyncio.run(s.leggi_profilo(adb, "Mario", 1, lambda m: None, {}))
    assert adb.tocchi, "deve toccare il nome utente per aprire il profilo"
    assert lette, "deve leggere almeno una scheda dal profilo"
    assert lette[0]["utente"] == "Mario"
    assert lette[0]["asset"] == "EURUSD"
    assert lette[0]["lato"] == "BUY"
    assert lette[0]["entrata"] == 1.1


class _WS:
    def __init__(self):
        self.messaggi = []

    async def send_text(self, t):
        self.messaggi.append(json.loads(t))


def test_il_ponte_chiede_la_lettura_del_profilo_a_syntra(monkeypatch):
    """PASSO 16. La richiesta di cronologia per una sala "Syntra · <utente>" chiede al robot di
    leggere il profilo e, finita la lettura, risponde con l'archivio."""
    ws = _WS()
    sb.STATO["syntra_collegato"] = True
    monkeypatch.setattr(sb.storico_sale, "leggi_syntra", lambda sala: {"segnali": [
        {"strumento": "EURUSD", "direzione": "BUY"}], "letti": 0, "nuovi": 0})
    monkeypatch.setattr(sb, "_log", lambda *a, **k: None)

    async def _flipa():
        # Finge il robot: appena arriva la richiesta la segna come terminata.
        for _ in range(200):
            r = sb.STATO.get("syntra_leggi_profilo")
            if r and r.get("utente") == "Mario" and not r.get("pronto"):
                r["lette"] = 2
                r["registrate"] = 2
                r["pronto"] = True
                return
            await asyncio.sleep(0)

    async def gira():
        flip = asyncio.ensure_future(_flipa())
        await sb._manda_storico(ws, "Syntra · Mario", "r1", False, None)
        await flip

    asyncio.run(gira())
    r = sb.STATO.get("syntra_leggi_profilo")
    assert r and r.get("utente") == "Mario" and r.get("pronto") is True, \
        "il ponte deve chiedere la lettura del profilo e aspettarla"
    ok = [m for m in ws.messaggi if m.get("ok")]
    assert ok and ok[-1].get("segnali"), "deve rispondere con la cronologia dell'utente"