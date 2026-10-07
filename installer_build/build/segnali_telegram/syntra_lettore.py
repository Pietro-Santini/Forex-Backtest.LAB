"""Lettore di Syntra: legge le operazioni condivise dall'app Syntra aperta in un emulatore Android
(BlueStacks) sullo stesso PC, tramite ADB, e le passa al ponte dei segnali come una sala in piu'.

Come legge (verificato con la diagnosi del 2 ottobre 2026, pacchetto io.syntra.app): Syntra espone
ad Android tutti i testi come "content-desc" dei nodi dell'interfaccia. Una scheda operazione e' un
nodo con il riassunto ("BTC / USD", "23 set, 2:00 PM", "Acquisto", "Ordine limite", "Entrata:",
"80285", stato...) e dentro ha:
  - un nodo col NOME UTENTE (in alto a destra della scheda);
  - un nodo per ogni take profit ("TP #1:\\n80335 (+50 pips)") e uno per lo stop ("SL:\\n80210 ...")
    - SOLO se il dettaglio e' aperto;
  - il pulsante "Vedi dettagli TP/SL", che apre/chiude il dettaglio.
Niente OCR: si legge il testo vero.

Cosa fa a ogni giro: per ogni scheda (FX/IDX, Crypto, Azioni) tocca la linguetta, legge la
schermata, apre il dettaglio delle operazioni che non lo mostrano (tocca "Vedi dettagli TP/SL"),
scorre per un paio di pagine, poi torna in cima. Le operazioni gia' presenti all'avvio NON partono:
sono quelle vecchie. Parte solo quello che compare dopo.

NOTIFICHE (RICHIESTO, diagnosi del 2 ottobre 2026): Syntra ha una pagina "Notifiche" (titolo
"Notifiche", pulsante "Cancella tutto" - MAI toccato). Ogni notifica e' un nodo cliccabile:
  "2 Oct 2026, 10:18 AM\nEUR/USD | ACQUISTA | IN ATTESA | Di CrownPips\nNuovo ordine in sospeso Inserito @1.1261 da CrownPips"
Eventi visti: IN ATTESA (ordine pendente inserito), ATTIVATO (pendente eseguito), TARGET HIT! |
VINTO (TP n raggiunto), Scambio concluso (operazione chiusa). Toccandola si apre "Dettagli
configurazione" con gli stessi testi della scheda (asset, utente, data, Acquisto, Ordine limite,
Entrata, TP, SL, stato), ma come nodi separati.
MODALITA' PREDEFINITA "notifiche" (RICHIESTO: "il robot guardi soltanto la sessione notifiche, senza
saltare tra FX/IDX, Azioni, Crypto"): il lettore resta sulla pagina Notifiche (se non c'e', la apre
dall'icona in alto a destra, trovata da sola). Per ogni notifica NUOVA che non e' solo informazione
(Scambio concluso, TARGET HIT, VINTO, PERSO... si annotano e basta) apre il dettaglio, legge, torna:
  - IN ATTESA -> segnale con ordine pendente (stessa chiave della scheda: niente doppioni);
  - ATTIVATO  -> segnale "attivazione_pendente": l'app lo apre A MERCATO solo su Kraken (dove i
                 pendenti non si piazzano); su MT5 il pendente e' gia' stato piazzato all'IN ATTESA.
Ogni ~3 s tira giu' la lista per aggiornarla, ogni 60 s esce e rientra nella pagina.

Non tocca mai nient'altro: niente pulsanti "copia", niente "Impostazione magica", niente ordini.
"""
import asyncio
import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Callable, Dict, List, Optional, Tuple

MESI = {"gen": 1, "feb": 2, "mar": 3, "apr": 4, "mag": 5, "giu": 6, "lug": 7, "ago": 8,
        "set": 9, "ott": 10, "nov": 11, "dic": 12,
        "jan": 1, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "dec": 12}
RE_DATA = re.compile(r"^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$", re.I)
RE_TP = re.compile(r"^TP\s*#?\s*(\d+)\s*:\s*\n\s*([-\d.,\s]+?)(?:\s*\(|$)", re.I)
RE_SL = re.compile(r"^SL\s*:\s*\n\s*([-\d.,\s]+?)(?:\s*\(|$)", re.I)
RE_DATA_NOTIFICA = re.compile(r"^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$", re.I)
RE_BOUNDS = re.compile(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]")
SCHEDE_NOTE = ("FX/IDX", "Azioni", "Crypto", "Synth")
# Etichette dentro la scheda che NON sono il nome utente.
NON_UTENTE = {"discreto", "buono", "ottimo", "scarso", "eccellente", "impostazione magica",
              "vedi dettagli tp/sl", "r/r"}
STATI_CHIUSI = ("chiuso", "chiusa", "annullat", "cancellat", "scadut", "hit", "closed", "cancel")


def numero(s: str) -> Optional[float]:
    t = (s or "").replace(" ", "").replace("\u00a0", "").strip()
    if not t:
        return None
    if "," in t and "." in t:
        t = t.replace(",", "")
    elif "," in t:
        parti = t.split(",")
        t = t.replace(",", "") if len(parti[-1]) == 3 and len(parti) == 2 and len(parti[0]) <= 3 else t.replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def _bounds(n) -> Tuple[int, int, int, int]:
    m = RE_BOUNDS.match(n.get("bounds") or "")
    return tuple(int(x) for x in m.groups()) if m else (0, 0, 0, 0)


def data_ms(testo: str, adesso: Optional[float] = None) -> Optional[float]:
    """'23 set, 2:00 PM' -> millisecondi (ora del PC). Senza anno: l'anno corrente, o il precedente
    se verrebbe nel futuro."""
    m = RE_DATA.match((testo or "").strip())
    if not m:
        return None
    g, mese_t, h, mi, ampm = m.groups()
    mese = MESI.get(mese_t.lower()[:3])
    if not mese:
        return None
    h = int(h)
    if ampm:
        if ampm.upper() == "PM" and h != 12:
            h += 12
        if ampm.upper() == "AM" and h == 12:
            h = 0
    ora = datetime.fromtimestamp(adesso or time.time())
    try:
        d = datetime(ora.year, mese, int(g), h, int(mi))
        if d.timestamp() > ora.timestamp() + 86400:
            d = datetime(ora.year - 1, mese, int(g), h, int(mi))
    except ValueError:
        return None
    return d.timestamp() * 1000.0


def data_notifica_ms(testo: str) -> Optional[float]:
    """'2 Oct 2026, 10:44 AM' -> millisecondi (ora del PC)."""
    m = RE_DATA_NOTIFICA.match((testo or "").strip())
    if not m:
        return None
    g, mese_t, anno, h, mi, ampm = m.groups()
    mese = MESI.get(mese_t.lower()[:3])
    if not mese:
        return None
    h = int(h)
    if ampm:
        if ampm.upper() == "PM" and h != 12:
            h += 12
        if ampm.upper() == "AM" and h == 12:
            h = 0
    try:
        return datetime(int(anno), mese, int(g), h, int(mi)).timestamp() * 1000.0
    except ValueError:
        return None


def _lato(parola: str) -> Optional[str]:
    p = (parola or "").strip().lower()
    if p in ("acquisto", "acquista", "compra", "buy", "long"):
        return "BUY"
    if p in ("vendita", "vendi", "sell", "short"):
        return "SELL"
    return None


def leggi_notifiche(xml_testo: str) -> dict:
    """Pagina Notifiche: e' quella giusta? e le notifiche (dall'alto: le piu' recenti)."""
    radice = ET.fromstring(xml_testo)
    descs = set()
    notifiche = []
    for n in radice.iter("node"):
        d = n.get("content-desc") or ""
        descs.add(d)
        righe = [r.strip() for r in d.split("\n") if r.strip()]
        if len(righe) < 2 or "|" not in righe[1] or not RE_DATA_NOTIFICA.match(righe[0]):
            continue
        parti = [x.strip() for x in righe[1].split("|") if x.strip()]
        utente = None
        if parti and parti[-1].lower().startswith("di "):
            utente = parti.pop()[3:].strip()
        x1, y1, x2, y2 = _bounds(n)
        prezzo = None
        m = re.search(r"@\s*([-\d.,]+)", righe[2] if len(righe) > 2 else "")
        if m:
            prezzo = numero(m.group(1))
        notifiche.append({"id": d, "data": righe[0], "quando": data_notifica_ms(righe[0]),
                          "asset": parti[0] if parti else None, "lato": _lato(parti[1]) if len(parti) > 1 else None,
                          "evento": " | ".join(parti[2:]).lower(), "utente": utente, "prezzo": prezzo,
                          "descrizione": righe[2] if len(righe) > 2 else "",
                          "centro": ((x1 + x2) // 2, (y1 + y2) // 2), "alta": y2 - y1})
    return {"e_notifiche": "Notifiche" in descs and "Cancella tutto" in descs, "notifiche": notifiche}


def leggi_dettaglio(xml_testo: str) -> Optional[dict]:
    """Pagina "Dettagli configurazione" aperta da una notifica: stessi dati della scheda, ma in nodi
    separati. Restituisce una scheda nello stesso formato di leggi_schermata (stessa chiave)."""
    radice = ET.fromstring(xml_testo)
    nodi = [(n.get("content-desc") or "", _bounds(n), n.get("clickable") == "true") for n in radice.iter("node")]
    if not any(d == "Dettagli configurazione" for d, _, _ in nodi):
        return None
    larghezza = max(b[2] for _, b, _ in nodi) or 2560
    sc = {"bounds": (0, 0, larghezza, 0), "righe": [d for d, _, _ in nodi if d], "utente": None, "tp": {}, "sl": None,
          "toggle": None, "asset": None, "data": None, "lato": None, "tipo": None, "entrata": None, "stato": ""}
    titolo = False
    y_data = None
    for i, (d, b, cl) in enumerate(nodi):
        if not d:
            continue
        if d == "Dettagli configurazione":
            titolo = True
            continue
        if not titolo:
            continue
        r = d.strip()
        rl = r.lower()
        if sc["data"] is None and RE_DATA.match(r):
            sc["data"] = r
            y_data = b[1]
            continue
        m = RE_TP.match(d)
        if m:
            v = numero(m.group(2))
            if v is not None:
                sc["tp"][int(m.group(1))] = v
            continue
        m = RE_SL.match(d)
        if m:
            sc["sl"] = numero(m.group(1))
            continue
        if rl.startswith("vedi dettagli"):
            sc["toggle"] = ((b[0] + b[2]) // 2, (b[1] + b[3]) // 2)
            continue
        if _lato(r):
            sc["lato"] = _lato(r)
            continue
        if sc["tipo"] is None and (rl.startswith("ordine ") or rl in ("a mercato", "esecuzione a mercato", "mercato", "market")):
            sc["tipo"] = rl
            continue
        if r.startswith("Entrata"):
            for d2, _, _ in nodi[i + 1:]:
                if d2:
                    sc["entrata"] = numero(d2)
                    break
            continue
        if rl in ("in attesa", "attivo", "attiva", "aperto", "aperta", "in corso", "chiuso", "chiusa",
                  "annullato", "annullata", "scaduto", "scaduta", "vinto", "perso") or "hit" in rl:
            sc["stato"] = (sc["stato"] + " " + r).strip()
            continue
        if sc["asset"] is None and "/" in r and "\n" not in r and len(r) <= 20:
            sc["asset"] = r
            continue
        # utente: in alto a destra, sopra la data
        if (sc["utente"] is None and "\n" not in r and rl not in NON_UTENTE and b[0] > larghezza * 0.6
                and b[1] < 260 and (y_data is None or b[1] < y_data)):
            sc["utente"] = r
    if sc["asset"] is None:
        # azioni o asset senza "/": il primo testo dopo il titolo che non e' una lettera d'icona
        for d, b, _ in nodi:
            if d and d != "Dettagli configurazione" and len(d) >= 2 and "\n" not in d and b[1] < 220 and b[0] < larghezza * 0.5:
                sc["asset"] = d.strip()
                break
    return sc


def leggi_schermata(xml_testo: str) -> dict:
    """Dall'albero dell'interfaccia: linguette e schede operazione."""
    radice = ET.fromstring(xml_testo)
    linguette: Dict[str, Tuple[int, int]] = {}
    schede: List[dict] = []
    for n in radice.iter("node"):
        d = (n.get("content-desc") or "")
        if d in SCHEDE_NOTE and n.get("clickable") == "true":
            x1, y1, x2, y2 = _bounds(n)
            linguette[d] = ((x1 + x2) // 2, (y1 + y2) // 2)
            continue
        if "\nEntrata:\n" not in d and not d.startswith("Entrata:\n"):
            continue
        x1, y1, x2, y2 = _bounds(n)
        righe = [r.strip() for r in d.split("\n") if r.strip()]
        sc = {"bounds": (x1, y1, x2, y2), "righe": righe, "utente": None, "tp": {}, "sl": None, "toggle": None,
              "asset": None, "data": None, "lato": None, "tipo": None, "entrata": None, "stato": ""}
        # riassunto
        for i, r in enumerate(righe):
            if sc["data"] is None and RE_DATA.match(r):
                sc["data"] = r
                # l'asset e' la riga prima della data (prima ancora c'e' la lettera dell'icona)
                if i >= 1:
                    sc["asset"] = righe[i - 1]
            rl = r.lower()
            if rl in ("acquisto", "compra", "buy", "long"):
                sc["lato"] = "BUY"
            elif rl in ("vendita", "vendi", "sell", "short"):
                sc["lato"] = "SELL"
            elif sc["tipo"] is None and (rl.startswith("ordine ") or rl in ("a mercato", "esecuzione a mercato", "mercato", "market")):
                # solo l'etichetta corta: la riga lunga dell'avvertenza contiene anche "mercato"
                sc["tipo"] = rl
            if r.startswith("Entrata") and i + 1 < len(righe):
                sc["entrata"] = numero(righe[i + 1])
            if rl in ("in attesa", "attivo", "attiva", "aperto", "aperta", "in corso", "chiuso", "chiusa",
                      "annullato", "annullata", "scaduto", "scaduta") or "hit" in rl:
                sc["stato"] = (sc["stato"] + " " + r).strip()
        # figli: utente, TP, SL, pulsante dettagli
        larghezza = max(1, x2 - x1)
        for f in n:
            fd = (f.get("content-desc") or "")
            fx1, fy1, fx2, fy2 = _bounds(f)
            m = RE_TP.match(fd)
            if m:
                v = numero(m.group(2))
                if v is not None:
                    sc["tp"][int(m.group(1))] = v
                continue
            m = RE_SL.match(fd)
            if m:
                sc["sl"] = numero(m.group(1))
                continue
            if fd.strip().lower().startswith("vedi dettagli"):
                sc["toggle"] = ((fx1 + fx2) // 2, (fy1 + fy2) // 2)
                continue
            if (sc["utente"] is None and fd and "\n" not in fd and fd.strip().lower() not in NON_UTENTE
                    and f.get("clickable") == "true" and fx1 > x1 + larghezza * 0.6 and fy1 - y1 < 80):
                sc["utente"] = fd.strip()
        schede.append(sc)
    return {"linguette": linguette, "schede": schede}


def chiusa(sc: dict) -> bool:
    s = (sc.get("stato") or "").lower()
    return any(k in s for k in STATI_CHIUSI)


def chiave(sc: dict) -> str:
    return "|".join(str(sc.get(k) or "") for k in ("utente", "asset", "data", "lato", "entrata"))


def segnale(sc: dict, attivazione: bool = False) -> Optional[dict]:
    """Scheda -> segnale nello stesso formato del lettore dei messaggi (parser_segnali.interpreta).
    attivazione=True: notifica "ordine in attesa ATTIVATO" -> segnale a mercato, marcato."""
    if not sc.get("asset") or not sc.get("lato") or sc.get("entrata") is None:
        return None
    if sc.get("sl") is None and not sc.get("tp"):
        return None   # dettaglio non letto: senza livelli non e' ancora un segnale
    strumento = re.sub(r"[^A-Za-z0-9]", "", sc["asset"]).upper()
    t = sc.get("tipo") or ""
    tipo = None if attivazione else ("limit" if "limit" in t else ("stop" if "stop" in t else None))
    tps = [sc["tp"][k] for k in sorted(sc["tp"])]
    avvisi = []
    if sc.get("sl") is None:
        avvisi.append("rischio_non_definito: nessuno stop loss nella scheda Syntra")
    testo = "Syntra · %s\n%s %s %s %s\nSL %s\n%s" % (
        sc.get("utente") or "?", sc["asset"], "BUY" if sc["lato"] == "BUY" else "SELL",
        "ATTIVATO (ordine in attesa eseguito)" if attivazione else (tipo or "market").upper(), sc["entrata"], sc.get("sl") if sc.get("sl") is not None else "-",
        "\n".join("TP%d %s" % (i + 1, v) for i, v in enumerate(tps)))
    return {"strumento": strumento, "direzione": sc["lato"], "entrata": sc["entrata"], "entrata_max": None,
            "a_mercato": tipo is None, "tipo_ordine": tipo, "stop_loss": sc.get("sl"), "take_profit": tps,
            "ordini_aggiuntivi": [], "confidenza": 100,
            "riconosciuto": ["strumento", "direzione", "entrata"] + (["stop_loss"] if sc.get("sl") is not None else []) + (["take_profit"] if tps else []),
            "avvisi": avvisi, "direzione_esplicita": True, "testo": testo, "fonte": "syntra",
            "attivazione_pendente": bool(attivazione)}


# ----------------------------------------------------------------------------- ADB
class Adb:
    def __init__(self, adb: str, indirizzo: str):
        self.adb = adb
        self.indirizzo = indirizzo

    async def _esegui(self, *argomenti, timeout=30) -> str:
        cmd = [self.adb] + (["-s", self.indirizzo] if argomenti and argomenti[0] not in ("connect", "devices") else []) + list(argomenti)
        crea = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        p = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, creationflags=crea)
        try:
            out, err = await asyncio.wait_for(p.communicate(), timeout)
        except asyncio.TimeoutError:
            p.kill()
            raise RuntimeError("adb non risponde (%s)" % " ".join(argomenti[:2]))
        if p.returncode != 0:
            raise RuntimeError((err or out).decode("utf-8", "replace").strip()[:200])
        return out.decode("utf-8", "replace")

    async def collega(self) -> None:
        r = await self._esegui("connect", self.indirizzo)
        if "connected" not in r.lower():
            raise RuntimeError(r.strip() or "connessione all'emulatore non riuscita")

    async def schermata(self) -> str:
        await self._esegui("shell", "uiautomator", "dump", "/sdcard/fbl_syntra.xml")
        return await self._esegui("exec-out", "cat", "/sdcard/fbl_syntra.xml")

    async def tocca(self, x: int, y: int) -> None:
        await self._esegui("shell", "input", "tap", str(x), str(y))

    async def scorri(self, x: int, y1: int, y2: int) -> None:
        await self._esegui("shell", "input", "swipe", str(x), str(y1), str(x), str(y2), "350")

    async def indietro(self) -> None:
        await self._esegui("shell", "input", "keyevent", "4")

    async def syntra_davanti(self) -> bool:
        """Syntra e' l'app in primo piano nell'emulatore?"""
        r = await self._esegui("shell", "dumpsys", "window", "windows", timeout=20)
        for riga in r.splitlines():
            if "mCurrentFocus" in riga or "mFocusedApp" in riga:
                if "io.syntra.app" in riga:
                    return True
        return False

    async def apri_syntra(self) -> None:
        await self._esegui("shell", "monkey", "-p", "io.syntra.app", "-c", "android.intent.category.LAUNCHER", "1", timeout=30)


# ----------------------------------------------------------------------------- giro
async def giro(adb: Adb, schede: List[str], pagine: int, log: Callable[[str], None]) -> List[dict]:
    """Un giro completo su tutte le linguette. Restituisce le schede lette (dettaglio aperto)."""
    trovate: Dict[str, dict] = {}
    for nome in schede:
        lettura = leggi_schermata(await adb.schermata())
        if nome in lettura["linguette"]:
            await adb.tocca(*lettura["linguette"][nome])
            await asyncio.sleep(1.2)
        for pagina in range(max(1, pagine)):
            lettura = leggi_schermata(await adb.schermata())
            # Apre il dettaglio delle operazioni aperte che non lo mostrano (una alla volta: dopo ogni
            # tocco la schermata si sposta e va riletta).
            for _ in range(6):
                da_aprire = [s for s in lettura["schede"] if not chiusa(s) and not s["tp"] and s["sl"] is None and s["toggle"]]
                if not da_aprire:
                    break
                await adb.tocca(*da_aprire[0]["toggle"])
                await asyncio.sleep(0.8)
                lettura = leggi_schermata(await adb.schermata())
            for s in lettura["schede"]:
                s["scheda"] = nome
                trovate[chiave(s)] = s
            if pagina < pagine - 1 and lettura["schede"]:
                x1, y1, x2, y2 = lettura["schede"][0]["bounds"]
                basso = max(s["bounds"][3] for s in lettura["schede"])
                await adb.scorri((x1 + x2) // 2, basso - 20, y1 + 40)
                await asyncio.sleep(0.8)
        # di nuovo in cima per il giro dopo
        lettura = leggi_schermata(await adb.schermata())
        if lettura["schede"]:
            x1, y1, x2, y2 = lettura["schede"][0]["bounds"]
            for _ in range(max(1, pagine)):
                await adb.scorri((x1 + x2) // 2, y1 + 40, y1 + 900)
            await asyncio.sleep(0.5)
    return list(trovate.values())


# Eventi che sono SOLO informazioni (RICHIESTO: "scambio concluso e target hit non sono segnali").
EVENTI_INFO = ("scambio concluso", "concluso", "target hit", "vinto", "perso", "stop loss", "sl hit", "chiuso",
               "chiusa", "annullat", "cancellat", "scadut", "pareggio", "breakeven")
NOTIFICA_MAX_ETA_MS = 15 * 60 * 1000
RIAPRI_OGNI_S = 60


def evento_informativo(evento: str) -> bool:
    e = (evento or "").lower()
    return any(k in e for k in EVENTI_INFO)


async def _alla_lista(adb: Adb) -> bool:
    """Torna alla schermata con le linguette (indietro al massimo 3 volte)."""
    for _ in range(3):
        if leggi_schermata(await adb.schermata())["linguette"]:
            return True
        await adb.indietro()
        await asyncio.sleep(1.0)
    return bool(leggi_schermata(await adb.schermata())["linguette"])


async def apri_notifiche(adb: Adb, stato: dict, log: Callable[[str], None]) -> bool:
    """Porta Syntra sulla pagina Notifiche. Se ci e' gia', niente. Altrimenti torna alla lista e
    tocca l'icona (in alto a destra, senza scritta), trovata da sola la prima volta e poi ricordata.
    Mai toccato "Cancella tutto"."""
    xml = await adb.schermata()
    if leggi_notifiche(xml)["e_notifiche"]:
        return True
    if leggi_dettaglio(xml) is not None:          # rimasto su un dettaglio: indietro
        await adb.indietro()
        await asyncio.sleep(1.2)
        xml = await adb.schermata()
        if leggi_notifiche(xml)["e_notifiche"]:
            return True
    if not leggi_schermata(xml)["linguette"]:
        if not await _alla_lista(adb):
            return False
        xml = await adb.schermata()
    xy = stato.get("syntra_xy_notifiche")
    candidati = [tuple(xy)] if xy else []
    if not candidati:
        radice = ET.fromstring(xml)
        larghezza = max((_bounds(n)[2] for n in radice.iter("node")), default=2560) or 2560
        for n in radice.iter("node"):
            x1, y1, x2, y2 = _bounds(n)
            if (n.get("clickable") == "true" and not (n.get("content-desc") or "").strip() and y2 <= 260
                    and x1 > larghezza * 0.85 and (x2 - x1) < 150 and n.get("class") != "android.widget.EditText"):
                candidati.append(((x1 + x2) // 2, (y1 + y2) // 2))
        candidati.sort(key=lambda c: -c[0])   # prima la piu' a destra
    for c in candidati:
        await adb.tocca(*c)
        await asyncio.sleep(1.5)
        if leggi_notifiche(await adb.schermata())["e_notifiche"]:
            if not xy:
                log("Syntra: trovata l'icona delle notifiche in %s,%s" % c)
            stato["syntra_xy_notifiche"] = list(c)
            return True
        await adb.indietro()
        await asyncio.sleep(1.0)
        await _alla_lista(adb)
    stato.pop("syntra_xy_notifiche", None)
    return False


async def giro_notifiche(adb: Adb, visti: set, primo: bool, log: Callable[[str], None], stato: dict) -> List[dict]:
    """Legge le notifiche nuove e apre il dettaglio di quelle che sono segnali. Resta sulle Notifiche."""
    lette: List[dict] = []
    if not await apri_notifiche(adb, stato, log):
        stato["syntra_notifiche"] = "pagina Notifiche non trovata: aprila a mano in Syntra"
        return lette
    stato["syntra_notifiche"] = "ok"
    for _ in range(20):
        pagina = leggi_notifiche(await adb.schermata())
        if not pagina["e_notifiche"]:
            if not await apri_notifiche(adb, stato, log):
                break
            continue
        nuova = None
        for nt in pagina["notifiche"]:
            if nt["id"] in visti:
                continue
            if nt["alta"] < 60:
                continue          # tagliata in fondo allo schermo: si legge quando sale
            visti.add(nt["id"])
            if primo:
                continue
            if evento_informativo(nt["evento"]):
                log("Syntra info: %s %s %s di %s (%s)" % (nt["asset"], nt["lato"], nt["evento"].upper(), nt["utente"], nt["descrizione"]))
                continue
            if time.time() * 1000.0 - (nt["quando"] or 0) > NOTIFICA_MAX_ETA_MS:
                log("Syntra: notifica vecchia ignorata: %s" % nt["id"].replace("\n", " / "))
                continue
            nuova = nt
            break
        if nuova is None:
            break
        await adb.tocca(*nuova["centro"])
        await asyncio.sleep(1.5)
        sc = leggi_dettaglio(await adb.schermata())
        if sc and not sc["tp"] and sc["sl"] is None and sc["toggle"]:
            await adb.tocca(*sc["toggle"])
            await asyncio.sleep(1.0)
            sc = leggi_dettaglio(await adb.schermata()) or sc
        if sc:
            sc["evento"] = nuova["evento"]
            sc["notifica"] = nuova
            if not sc.get("utente"):
                sc["utente"] = nuova["utente"]
            lette.append(sc)
        else:
            log("Syntra: il dettaglio della notifica non si e' aperto (%s)" % nuova["id"].replace("\n", " / "))
        await adb.indietro()
        await asyncio.sleep(1.2)
    return lette


async def aggiorna_notifiche(adb: Adb, stato: dict, log: Callable[[str], None], riapri: bool) -> None:
    """Fa comparire le notifiche nuove: tira giu' la lista (aggiorna, se Syntra lo prevede) e ogni
    tanto esce e rientra nella pagina."""
    if riapri:
        await adb.indietro()
        await asyncio.sleep(1.0)
        await apri_notifiche(adb, stato, log)
        return
    xml = await adb.schermata()
    pagina = leggi_notifiche(xml)
    if pagina["e_notifiche"] and pagina["notifiche"]:
        x, y = pagina["notifiche"][0]["centro"]
        await adb.scorri(x, y, y + 700)
        await asyncio.sleep(1.0)


async def _consegna_scheda(s: dict, visti: set, consegna: Callable, log: Callable[[str], None], stato: dict) -> None:
    attivato = "attivato" in (s.get("evento") or "")
    k = chiave(s) + ("|attivato" if attivato else "")
    if k in visti or not s.get("utente"):
        return
    visti.add(k)
    if chiusa(s):
        log("Syntra: %s (%s) di %s gia' chiusa quando l'abbiamo aperta: niente" % (s.get("asset"), s.get("evento"), s.get("utente")))
        return
    seg = segnale(s, attivazione=attivato)
    if seg is None:
        log("Syntra: dettaglio di %s di %s senza livelli: niente" % (s.get("asset"), s.get("utente")))
        return
    utenti = stato.setdefault("syntra_utenti", [])
    if s["utente"] not in utenti:
        utenti.append(s["utente"])
    q = (s.get("notifica") or {}).get("quando")
    adesso = time.time() * 1000.0
    quando = adesso if (q is None or abs(adesso - q) < 180000) else q
    await consegna(seg, s["utente"], quando)


async def prepara_emulatore(adb: Adb, cfg: dict, log: Callable[[str], None], stato: dict) -> None:
    """RICHIESTO: BlueStacks e Syntra si aprono da soli, ridotti a icona (vedi avvio_bluestacks.py)."""
    import avvio_bluestacks as ab
    if not ab.in_esecuzione():
        player = ab.trova_player(cfg.get("bluestacks") or "")
        if not player:
            stato["syntra_bluestacks"] = "BlueStacks non trovato: scrivi il percorso di HD-Player.exe nelle impostazioni"
            return
        istanza = ab.trova_istanza(ab.porta_da_indirizzo(cfg.get("indirizzo") or "127.0.0.1:5555"))
        log("Syntra: avvio BlueStacks%s e Syntra" % ((" (istanza %s)" % istanza) if istanza else ""))
        ab.avvia(player, istanza)
        stato["syntra_bluestacks"] = "avviato dal programma alle %s" % time.strftime("%H:%M")
        # Fino a 2 minuti per l'avvio: intanto la finestra si riduce a icona appena compare.
        fine = time.time() + 120
        while time.time() < fine:
            if cfg.get("riduci", True):
                await asyncio.to_thread(ab.riduci_a_icona)
            try:
                await adb.collega()
                await adb._esegui("shell", "getprop", "sys.boot_completed", timeout=10)
                break
            except Exception:
                await asyncio.sleep(3)
        if cfg.get("riduci", True):
            for _ in range(5):                # la finestra a volte si riapre a fine avvio
                await asyncio.sleep(2)
                await asyncio.to_thread(ab.riduci_a_icona)
    elif not stato.get("syntra_bluestacks"):
        stato["syntra_bluestacks"] = "gia' aperto"
    try:
        await adb.collega()
        if not await adb.syntra_davanti():
            log("Syntra: l'app non era in primo piano nell'emulatore, la riapro")
            await adb.apri_syntra()
            await asyncio.sleep(6)
    except Exception as e:
        stato["syntra_bluestacks"] = "emulatore non pronto: %s" % e


async def ciclo(cfg: dict, consegna: Callable, log: Callable[[str], None], stato: dict) -> None:
    """Gira per sempre. `consegna(segnale, utente, quando_ms)` e' la funzione del ponte.
    Modalita' "notifiche" (predefinita, RICHIESTO): resta sulla pagina Notifiche di Syntra.
    Modalita' "schede": il giro sulle linguette FX/IDX, Crypto, Azioni (come prima)."""
    # SYNTRA GIRA SOLO SUL COMPUTER. Legge l'app Android dentro BlueStacks attraverso ADB: su un
    # server Linux non c'e' ne' BlueStacks ne' Windows, e nessun percorso potra' mai esistere.
    # Prima si tentava lo stesso e usciva "[Errno 2] No such file or directory" con un percorso di
    # Windows, che manda a cercare un file mancante invece di dire la cosa vera - ed e' successo
    # davvero appena il ponte dei segnali e' stato spostato sul server.
    import os as _os
    if _os.name != "nt":
        # IN `syntra_errore`, non in una chiave nostra: e' quella che l'app mostra. Scritto altrove,
        # il messaggio non arriva a nessuno e l'app resta "attiva, nessun errore, nessuna sala".
        stato["syntra_errore"] = ("Syntra funziona solo sul computer: legge l'app Android dentro "
                                  "BlueStacks, che su un server Linux non c'e'. Le sale Telegram "
                                  "funzionano dal server; per Syntra tieni acceso il ponte sul "
                                  "computer.")
        stato["syntra_collegato"] = False
        log("Syntra non parte: " + stato["syntra_errore"])
        return
    # adb trovato da solo (quello di BlueStacks, HD-Adb.exe): l'utente non deve scaricare niente.
    try:
        import avvio_bluestacks as _ab
        percorso_adb = _ab.trova_adb(cfg.get("adb") or "") or (cfg.get("adb") or r"C:\platform-tools\adb.exe")
    except Exception:
        percorso_adb = cfg.get("adb") or r"C:\platform-tools\adb.exe"
    adb = Adb(percorso_adb, cfg.get("indirizzo") or "127.0.0.1:5555")
    modalita = cfg.get("modalita") or "notifiche"
    schede = cfg.get("schede") or ["FX/IDX", "Crypto", "Azioni"]
    pagine = int(cfg.get("pagine") or 2)
    pausa = float(cfg.get("intervallo_s") or 3)
    visti: set = set()
    visti_notifiche: set = set()
    primo = True
    ultimo_rientro = time.time()
    ultimo_controllo_app = 0.0
    # Quante volte di fila la pagina Notifiche non si e' trovata. Serve a due cose: dirlo (prima
    # restava tutto zitto) e, dopo un po', riaprire Syntra - perche' se la pagina non si trova
    # l'emulatore e' su qualcos'altro, e tirare giu' la lista non serve a niente.
    mancate = 0
    while True:
        try:
            # Ogni 30 s: BlueStacks aperto e Syntra davanti (se l'avvio automatico e' acceso).
            if cfg.get("avvio_automatico", True) and time.time() - ultimo_controllo_app > 30:
                ultimo_controllo_app = time.time()
                await prepara_emulatore(adb, cfg, log, stato)
            await adb.collega()
            stato["syntra_collegato"] = True
            stato["syntra_errore"] = None
            stato["syntra_modalita"] = modalita
            if modalita == "schede":
                for s in await giro(adb, schede, pagine, log):
                    if primo:
                        if s.get("utente") and segnale(s) is not None:
                            visti.add(chiave(s))
                        continue
                    if not chiusa(s) and segnale(s) is not None:
                        s["evento"] = ""
                        await _consegna_scheda(s, visti, consegna, log, stato)
                if primo:
                    log("Syntra: %d operazioni gia' presenti all'avvio (non aperte). In ascolto delle nuove." % len(visti))
                    primo = False
            else:
                riapri = time.time() - ultimo_rientro > RIAPRI_OGNI_S
                # L'aggiornamento NON dipende piu' da `primo`: dipende dall'aver trovato la pagina
                # almeno una volta. Legato a `primo`, un inventario mai concluso fermava per sempre
                # l'aggiornamento della lista.
                if not primo or mancate:
                    await aggiorna_notifiche(adb, stato, log, riapri)
                    if riapri:
                        ultimo_rientro = time.time()
                lette = await giro_notifiche(adb, visti_notifiche, primo, log, stato)
                if stato.get("syntra_notifiche") == "ok":
                    if primo:
                        log("Syntra: %d notifiche gia' presenti (non aperte). In ascolto delle nuove." % len(visti_notifiche))
                        primo = False
                    if mancate:
                        log("Syntra: pagina Notifiche ritrovata dopo %d tentativi" % mancate)
                    mancate = 0
                    stato["syntra_errore"] = None
                else:
                    # NON si resta zitti: prima lo stato diceva "collegato, nessun errore" mentre
                    # il robot girava a vuoto.
                    mancate += 1
                    stato["syntra_errore"] = ("pagina Notifiche di Syntra non trovata (%d giri). "
                                              "Aprila a mano in Syntra, o controlla che "
                                              "l'emulatore non sia su un'altra schermata." % mancate)
                    if mancate % 10 == 0:
                        log("Syntra: " + stato["syntra_errore"])
                    # Dopo un po' di tentativi la pagina non si trova perche' Syntra e' su
                    # qualcos'altro (login, aggiornamento, schermata di avvio): si riapre l'app,
                    # invece di continuare a cercare un'icona che non c'e'.
                    if mancate % 20 == 0:
                        log("Syntra: riapro l'app nell'emulatore")
                        try:
                            await adb.apri_syntra()
                            await asyncio.sleep(6)
                        except Exception as e:
                            log("Syntra: non sono riuscito a riaprirla (%s)" % e)
                for s in lette:
                    await _consegna_scheda(s, visti, consegna, log, stato)
            stato["syntra_ultimo_giro"] = time.time()
            await asyncio.sleep(pausa)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            stato["syntra_collegato"] = False
            stato["syntra_errore"] = str(e)
            log("Syntra: %s - riprovo fra 10 s" % e)
            await asyncio.sleep(10)
