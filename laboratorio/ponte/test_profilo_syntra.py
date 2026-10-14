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

    async def profilo(a, utente, pagine, log, st, da_ms=None):
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


# ====================== LA STRADA DELLA CLASSIFICA ======================
# RICHIESTO dal proprietario, descritta passo per passo guardando l'app: "per trovare la cronologia
# dei segnali di quell'utente deve andare su CLASSIFICA, che sta in basso; scorre fino a che non
# trova l'utente; entra dentro; scorre le posizioni e controlla la data; prende il primo, lo
# espande, vede i TP, lo stop, l'entrata; e alla fine fa la stessa cosa che fa quella di Telegram".
#
# PRIMA NON FUNZIONAVA: si cercava il nome dell'utente su una SUA scheda gia' visibile nel riquadro
# dei setup. Se non aveva pubblicato di recente - o se si era sulla pagina Notifiche, che e' la
# modalita' di sempre - quel nome sullo schermo non c'era, e la lettura moriva con "nome non
# trovato sullo schermo" senza nemmeno cominciare.
#
# Le schermate qui sotto ricalcano quelle vere (foto del proprietario del 14 ottobre 2026): la
# classifica con le righe "nome / alias / XP / Tasso di vincita", e il profilo col titolo "Info sul
# fornitore di setup" e sotto le schede dei setup.

XML_CLASSIFICA = """<root>
 <node content-desc="GStrike&#10;GStrike&#10;XP 185&#10;Tasso di vincita 94%&#10;Guadagno&#10;2070+" bounds="[0,200][1500,290]"/>
 <node content-desc="Cpulser&#10;Cpulser&#10;XP 68&#10;Tasso di vincita 86%&#10;Guadagno&#10;700+" bounds="[0,300][1500,390]"/>
 <node content-desc="Gino&#10;Gino - SGM FREE&#10;XP 6395&#10;Tasso di vincita 100%&#10;Guadagno&#10;355.43+" bounds="[0,400][1500,490]"/>
 <node content-desc="Setup" clickable="true" bounds="[100,880][450,930]"/>
 <node content-desc="Classifica" clickable="true" bounds="[600,880][950,930]"/>
 <node content-desc="Altro" clickable="true" bounds="[1100,880][1450,930]"/>
</root>"""

XML_ALTRA_PAGINA = """<root>
 <node content-desc="Notifiche" bounds="[0,0][400,60]"/>
 <node content-desc="Cancella tutto" bounds="[1100,0][1500,60]"/>
 <node content-desc="Setup" clickable="true" bounds="[100,880][450,930]"/>
 <node content-desc="Classifica" clickable="true" bounds="[600,880][950,930]"/>
</root>"""

XML_PROFILO = """<root>
 <node content-desc="Info sul fornitore di setup" bounds="[0,0][1500,60]"/>
 <node content-desc="Vendita&#10;CKB/USDT&#10;12 ott, 3:27 PM&#10;Ordine a mercato&#10;Entrata:&#10;0.001621&#10;Vinto" bounds="[0,100][1500,400]">
  <node content-desc="Gino" clickable="true" bounds="[1300,100][1480,140]"/>
  <node content-desc="TP #1:&#10;0.0016129 (+0.5%)"/>
  <node content-desc="SL:&#10;0.0019452 (-20%)"/>
 </node>
</root>"""


class AdbNavigazione:
    """Emulatore finto che cambia schermata quando lo si tocca, come fa l'app vera."""

    def __init__(self, partenza=XML_ALTRA_PAGINA):
        self.xml = partenza
        self.tocchi = []
        self.scorri_chiamate = 0
        self.indietro_chiamate = 0

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
        if self.xml is XML_CLASSIFICA and 400 <= y <= 490:
            self.xml = XML_PROFILO          # si e' toccata la riga di Gino
        elif 880 <= y <= 930 and 600 <= x <= 950:
            self.xml = XML_CLASSIFICA       # si e' toccata la voce "Classifica" in fondo

    async def scorri(self, x, y1, y2):
        self.scorri_chiamate += 1

    async def indietro(self):
        self.indietro_chiamate += 1


def test_la_classifica_si_legge_riga_per_riga():
    pagina = s.leggi_classifica(XML_CLASSIFICA)
    assert pagina["e_classifica"] is True
    assert [r["utente"] for r in pagina["righe"]] == ["GStrike", "Cpulser", "Gino"]
    assert pagina["righe"][2]["alias"] == "Gino - SGM FREE"
    assert pagina["voce"] is not None, "serve il punto dove toccare «Classifica»"


def test_il_nome_si_riconosce_anche_con_l_alias_attaccato():
    # La classifica scrive "Gino", il profilo "Gino - SGM FREE", l'app lo conosce come "Syntra . Gino".
    assert s.stesso_utente_syntra("Gino", "Gino - SGM FREE")
    assert s.stesso_utente_syntra("Syntra · Gino", "Gino")
    assert s.stesso_utente_syntra("CrownPips", "crownpips")
    assert not s.stesso_utente_syntra("Gino", "Nate")
    assert not s.stesso_utente_syntra("", "Gino")


def test_il_profilo_si_riconosce_dal_titolo():
    assert s.e_pagina_profilo(XML_PROFILO) is True
    assert s.e_pagina_profilo(XML_CLASSIFICA) is False


def test_leggi_profilo_passa_dalla_classifica_e_torna_le_schede(monkeypatch):
    """PASSO: dalla pagina Notifiche si arriva al profilo di Gino passando dalla Classifica."""
    async def _subito(_=0):
        return None

    monkeypatch.setattr(s.asyncio, "sleep", _subito)
    adb = AdbNavigazione()
    lette = asyncio.run(s.leggi_profilo(adb, "Gino", 1, lambda m: None, {}))
    assert adb.xml is XML_PROFILO, "doveva finire dentro il profilo"
    assert len(adb.tocchi) >= 2, "un tocco su «Classifica», uno sulla riga dell'utente"
    assert lette, "deve leggere almeno una scheda dal profilo"
    assert lette[0]["asset"] == "CKB/USDT"
    assert lette[0]["lato"] == "SELL"
    assert lette[0]["entrata"] == 0.001621
    assert lette[0]["tp"] == {1: 0.0016129}
    assert lette[0]["sl"] == 0.0019452


def test_un_utente_che_non_c_e_non_manda_il_robot_a_toccare_a_caso(monkeypatch):
    async def _subito(_=0):
        return None

    monkeypatch.setattr(s.asyncio, "sleep", _subito)
    adb = AdbNavigazione()
    lette = asyncio.run(s.leggi_profilo(adb, "NonEsiste", 1, lambda m: None, {}))
    assert lette == [], "senza l'utente non si legge niente"
    assert adb.xml is not XML_PROFILO, "e non si entra in un profilo a caso"


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