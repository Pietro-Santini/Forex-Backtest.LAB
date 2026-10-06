"""Cronologia dei segnali di una sala (Forex Backtest LAB).

RICHIESTO: "fare leggere tutti i segnali all'interno del gruppo Telegram e dell'utente Syntra,
inserirli a grafico e calcolare il win rate totale e dei vari livelli dei TP".

- Telegram: si leggono TUTTI i messaggi della sala, dal primo, con lo stesso parser dei segnali
  dal vivo (parser_segnali.interpreta). Il risultato si tiene in una memoria su disco per sala:
  le letture successive scaricano solo i messaggi nuovi (min_id), non si riparte da capo.
- Syntra: l'app non ha uno storico da sfogliare (il lettore vede solo le notifiche), quindi ogni
  segnale Syntra letto viene ARCHIVIATO qui da quando esiste questa versione. La cronologia di un
  utente Syntra parte da li': quello che e' successo prima non c'e' da nessuna parte sul PC.

Qui non si calcola nessun esito: servono le candele, e quelle le ha l'app (MT5, Binance).
"""
import asyncio
import json
import os
import re
import threading
import time
from typing import Callable, Dict, List, Optional

_lock = threading.Lock()
CARTELLA: Optional[str] = None
MAX_TESTO = 600


def imposta_cartella(base: str) -> None:
    global CARTELLA
    CARTELLA = os.path.join(base, "storico_sale")
    os.makedirs(CARTELLA, exist_ok=True)


def _nome_file(sala: str, prefisso: str) -> str:
    sicuro = re.sub(r"[^A-Za-z0-9_.-]", "_", sala)[:80] or "_"
    return os.path.join(CARTELLA or ".", prefisso + sicuro + ".json")


def compatta(segnale: dict, ts_ms: float, mid=None) -> Optional[dict]:
    """Solo quello che serve per disegnare e valutare il segnale."""
    if not segnale or not segnale.get("strumento") or not segnale.get("direzione"):
        return None
    tps = [float(x) for x in (segnale.get("take_profit") or []) if isinstance(x, (int, float))]
    sl = segnale.get("stop_loss")
    return {"id": mid, "ts": float(ts_ms), "strumento": str(segnale.get("strumento")),
            "direzione": str(segnale.get("direzione")).upper(),
            "entrata": segnale.get("entrata"), "entrata_max": segnale.get("entrata_max"),
            "a_mercato": bool(segnale.get("a_mercato")), "tipo_ordine": segnale.get("tipo_ordine"),
            "sl": float(sl) if isinstance(sl, (int, float)) else None, "tp": tps,
            "testo": str(segnale.get("testo") or "")[:MAX_TESTO]}


def _carica(percorso: str) -> dict:
    try:
        with open(percorso, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _salva(percorso: str, dati: dict) -> None:
    with _lock:
        with open(percorso + ".tmp", "w", encoding="utf-8") as f:
            json.dump(dati, f, ensure_ascii=False)
        os.replace(percorso + ".tmp", percorso)


# ----------------------------------------------------------------------------- Telegram
async def leggi_telegram(client, entita, sala: str, interpreta: Callable[[str], Optional[dict]],
                         avanzamento: Optional[Callable[[int, int], None]] = None,
                         da_capo: bool = False) -> dict:
    """Tutti i segnali della sala, dal primo messaggio. Restituisce {segnali, letti, nuovi}."""
    percorso = _nome_file(sala, "tg_")
    memoria = {} if da_capo else _carica(percorso)
    segnali: List[dict] = list(memoria.get("segnali") or [])
    ultimo_id = int(memoria.get("ultimo_id") or 0)
    letti = 0
    nuovi = 0
    # reverse=True: dal piu' vecchio al piu' nuovo, cosi' la memoria resta in ordine e, se la
    # lettura si interrompe, quello che e' gia' stato letto e' valido e si riprende da li'.
    async for m in client.iter_messages(entita, reverse=True, min_id=ultimo_id):
        letti += 1
        testo = getattr(m, "message", None) or ""
        if testo.strip():
            try:
                s = interpreta(testo)
            except Exception:
                s = None
            d = getattr(m, "date", None)
            ts = d.timestamp() * 1000.0 if d is not None and hasattr(d, "timestamp") else time.time() * 1000.0
            c = compatta(s, ts, m.id) if s else None
            if c:
                segnali.append(c)
                nuovi += 1
        ultimo_id = max(ultimo_id, int(m.id))
        if letti % 500 == 0:
            memoria = {"sala": sala, "ultimo_id": ultimo_id, "segnali": segnali, "aggiornato": time.time()}
            _salva(percorso, memoria)
            if avanzamento:
                avanzamento(letti, len(segnali))
            await asyncio.sleep(0)
    memoria = {"sala": sala, "ultimo_id": ultimo_id, "segnali": segnali, "aggiornato": time.time()}
    _salva(percorso, memoria)
    return {"segnali": segnali, "letti": letti, "nuovi": nuovi}


# ----------------------------------------------------------------------------- Syntra
def archivia_syntra(sala: str, segnale: dict, ts_ms: float) -> None:
    """Chiamata per ogni segnale Syntra letto dal vivo: l'unico modo di averne una cronologia."""
    if not CARTELLA:
        return
    c = compatta(segnale, ts_ms)
    if not c:
        return
    percorso = _nome_file(sala, "sy_")
    dati = _carica(percorso)
    elenco = list(dati.get("segnali") or [])
    # La stessa operazione puo' essere letta due volte (IN ATTESA e poi ATTIVATO): una sola voce.
    chiave = (c["strumento"], c["direzione"], c["entrata"], c["sl"], tuple(c["tp"]))
    for v in elenco[-50:]:
        if (v["strumento"], v["direzione"], v["entrata"], v["sl"], tuple(v["tp"])) == chiave and abs(v["ts"] - c["ts"]) < 3 * 86400e3:
            return
    elenco.append(c)
    _salva(percorso, {"sala": sala, "segnali": elenco, "aggiornato": time.time()})


def leggi_syntra(sala: str) -> dict:
    dati = _carica(_nome_file(sala, "sy_"))
    return {"segnali": list(dati.get("segnali") or []), "letti": 0, "nuovi": 0}
