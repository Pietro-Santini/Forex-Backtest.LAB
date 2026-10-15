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
import storico_sale
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
# SEGNALATO dal proprietario (14 ottobre 2026): "alcune volte arrivano dei segnali dove legge RR.
# Quello sarebbe il rischio/rendimento, non deve leggere quello. Per capire l'asset deve leggere
# quello che e' situato in alto a sinistra della casella".
# Com'era: l'asset si prendeva con due regole deboli - la prima riga che conteneva "/" (va bene per
# EUR/USD, non per BTCUSDT o per un'azione) e, se non bastava, il PRIMO testo in ordine di documento
# nella meta' sinistra sopra i 220 px. "RR" sta in alto a sinistra, e' corto e non ha "/": passava.
# Ora: (1) un elenco di etichette che non sono MAI un asset, (2) un controllo di forma (niente
# numeri, niente rapporti come 1:2, almeno due lettere), (3) fra i candidati validi si prende il
# piu' in ALTO e, a pari altezza, il piu' a SINISTRA - cioe' esattamente quello che ha chiesto.
NON_ASSET = {
    "rr", "r/r", "r:r", "rischio/rendimento", "risk/reward",
    "sl", "tp", "entrata", "uscita", "prezzo", "lotto", "lotti", "pips", "pip",
    "vedi dettagli tp/sl", "dettagli configurazione", "impostazione magica", "notifiche",
    "acquisto", "compra", "buy", "long", "vendita", "vendi", "sell", "short",
    "a mercato", "esecuzione a mercato", "mercato", "market",
    "discreto", "buono", "ottimo", "scarso", "eccellente",
    "in attesa", "attivo", "attiva", "aperto", "aperta", "in corso", "chiuso", "chiusa",
    "annullato", "annullata", "scaduto", "scaduta", "vinto", "perso", "target hit",
}
# Forma di un simbolo: lettere e cifre, eventualmente separate da / o - e spazi ("AUD / CAD",
# "EUR/USD", "US 30", "NAS100", "BTCUSDT"). Niente due punti, niente virgole, niente segni: e' li'
# che cadono "1:2", "2.5", "+50 pips".
RE_ASSET_FORMA = re.compile(r"^[A-Za-z0-9]+(?:\s*[/\-]?\s*[A-Za-z0-9]+)*$")


def asset_valido(testo: Optional[str]) -> bool:
    """Vero se questo testo puo' essere il simbolo di un'operazione."""
    r = (testo or "").strip()
    if not r or "\n" in r or not (2 <= len(r) <= 20):
        return False
    rl = r.lower().rstrip(":")
    if rl in NON_ASSET:
        return False
    if rl.startswith(("tp ", "tp#", "tp:", "sl ", "sl:", "ordine ", "entrata", "uscita")):
        return False
    if sum(1 for c in r if c.isalpha()) < 2:      # "1:2", "2.5", "80285", "+50"
        return False
    return bool(RE_ASSET_FORMA.match(r))


# RICHIESTO dal proprietario (14 ottobre 2026): "Syntra deve funzionare perfettamente, senza
# problemi di riconoscimento utente, asset, prezzi, cronologia".
# IL MODO: ogni riga si riconosce da quello che DICE, non da dove sta scritta. La posizione resta
# solo come spareggio fra due candidati ugualmente validi. Prima era il contrario - "il primo testo
# in alto a sinistra", "il nodo nella meta' destra" - ed e' per questo che bastava una scheda fatta
# un po' diversa (una cripto, un'azione) per leggere la cosa sbagliata senza accorgersene.
RE_SOLO_NUMERO = re.compile(r"^[-+]?[\d.,\s]+$")
ETICHETTE_PREZZO = ("entrata", "uscita", "prezzo", "entry", "price")


def tipo_riga(testo: Optional[str]) -> str:
    """Che cos'e' questa riga? Una sola parola, per poterci ragionare sopra.

    data | lato | tipo | etichetta | prezzo | tp | sl | stato | qualita | rr | comando | icona |
    numero | asset | altro | vuota
    """
    r = (testo or "").strip()
    if not r:
        return "vuota"
    if "\n" in r:
        if RE_TP.match(r):
            return "tp"
        if RE_SL.match(r):
            return "sl"
        return "blocco"
    rl = r.lower().rstrip(":")
    if RE_DATA.match(r) or RE_DATA_NOTIFICA.match(r):
        return "data"
    if _lato(r):
        return "lato"
    if rl.startswith("ordine ") or rl in ("a mercato", "esecuzione a mercato", "mercato", "market"):
        return "tipo"
    if rl in ETICHETTE_PREZZO:
        return "etichetta"
    if rl.startswith("tp") and (len(rl) <= 5 or rl[2:3].isdigit() or rl[2:3] in " #"):
        return "tp"
    if rl in ("sl", "stop", "stop loss"):
        return "sl"
    if rl in ("rr", "r/r", "r:r", "rischio/rendimento", "risk/reward"):
        return "rr"
    if rl in ("discreto", "buono", "ottimo", "scarso", "eccellente"):
        return "qualita"
    if rl in ("in attesa", "attivo", "attiva", "aperto", "aperta", "in corso", "chiuso", "chiusa",
              "annullato", "annullata", "scaduto", "scaduta", "vinto", "perso") or "hit" in rl:
        return "stato"
    if rl in ("vedi dettagli tp/sl", "dettagli configurazione", "impostazione magica", "notifiche",
              "cancella tutto", "classifica"):
        return "comando"
    if len(r) == 1:
        return "icona"
    if RE_SOLO_NUMERO.match(r):
        return "numero"
    if asset_valido(r):
        return "asset"
    return "altro"


def scegli_utente(nodi, larghezza: int, asset: Optional[str], y_data: Optional[int]) -> Optional[str]:
    """Il nome di chi ha condiviso l'operazione.

    Si scartano PRIMA tutte le righe che sono qualcos'altro (data, lato, stato, voto, RR, comandi,
    numeri, l'asset stesso): quello che resta in alto e' il nome. Fra piu' candidati vince quello
    piu' a destra, perche' e' li' che Syntra lo scrive - ma la posizione non puo' piu' far scegliere
    da sola una riga che e' palesemente un'altra cosa.
    """
    a = (asset or "").strip().lower()
    candidati = []
    for d, b, _ in nodi:
        r = (d or "").strip()
        if not r or "\n" in r:
            continue
        if r.lower() == a:
            continue
        if tipo_riga(r) not in ("altro", "asset"):
            continue
        if y_data is not None and b[1] > y_data + 40:
            continue                      # il nome sta in alto, sopra (o accanto a) la data
        candidati.append((-b[0], b[1], r))
    if not candidati:
        return None
    candidati.sort()
    return candidati[0][2]


def scegli_asset(nodi, larghezza: int, y_limite: Optional[int] = None) -> Optional[str]:
    """L'asset e' il testo IN ALTO A SINISTRA della casella (richiesto esplicitamente).
    Fra tutti i testi validi della meta' sinistra si prende il piu' in alto; a pari altezza, il piu'
    a sinistra. `nodi` sono triple (testo, bounds, cliccabile)."""
    candidati = []
    for d, b, _ in nodi:
        if not asset_valido(d):
            continue
        if b[0] > larghezza * 0.5:                # meta' destra: li' c'e' il nome utente
            continue
        if y_limite is not None and b[1] > y_limite:
            continue
        candidati.append((b[1], b[0], d.strip()))
    if not candidati:
        return None
    candidati.sort()
    return candidati[0][2]


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
    """'2 Oct 2026, 10:44 AM' -> millisecondi (ora del PC).

    SEGNALATO dal proprietario (14 ottobre 2026): "c'e' un utente, Gino, che ogni giorno manda
    segnali cripto e non lo rileva mai". Una delle due cause e' qui: si accettava SOLO la forma con
    l'anno di quattro cifre. La stessa app scrive le date anche senza anno ("2 ott, 10:44 AM", la
    forma che usa nelle schede), e in quel caso qui tornava None - con le conseguenze spiegate
    sopra la riga dell'eta' in leggi_notifiche_dalla_pagina. Ora si prova anche quella forma, e
    l'anno mancante e' quello di adesso.
    """
    t = (testo or "").strip()
    m = RE_DATA_NOTIFICA.match(t)
    if not m:
        # Senza anno: la stessa forma delle schede ("23 set, 2:00 PM"). data_ms() la sa gia' leggere
        # e sceglie l'anno piu' sensato (se il giorno e' nel futuro, e' dell'anno scorso).
        senza_anno = data_ms(t)
        if senza_anno is not None:
            return senza_anno
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
        # Una notifica si riconosce dalla riga con le BARRE ("EUR/USD | ACQUISTA | IN ATTESA | Di
        # Gino"): e' quella che porta i dati. La data e' sopra, ma NON si pretende piu' che stia
        # esattamente sulla prima riga ne' che abbia l'anno: Syntra la scrive in piu' modi, e
        # pretendere una forma sola faceva sparire notifiche intere senza dire niente.
        i_barre = next((k for k in range(min(4, len(righe))) if "|" in righe[k]), None)
        if i_barre is None or len(righe) < 2:
            continue
        riga_data = next((r for r in righe[:i_barre + 1] if data_notifica_ms(r) is not None), None)
        parti = [x.strip() for x in righe[i_barre].split("|") if x.strip()]
        if len(parti) < 2:
            continue
        utente = None
        if parti and parti[-1].lower().startswith("di "):
            utente = parti.pop()[3:].strip()
        x1, y1, x2, y2 = _bounds(n)
        descrizione = righe[i_barre + 1] if len(righe) > i_barre + 1 else ""
        prezzo = None
        m = re.search(r"@\s*([-\d.,]+)", descrizione)
        if m:
            prezzo = numero(m.group(1))
        notifiche.append({"id": d, "data": riga_data or righe[0],
                          "quando": data_notifica_ms(riga_data) if riga_data else None,
                          "asset": parti[0] if parti else None, "lato": _lato(parti[1]) if len(parti) > 1 else None,
                          "evento": " | ".join(parti[2:]).lower(), "utente": utente, "prezzo": prezzo,
                          "descrizione": descrizione,
                          "centro": ((x1 + x2) // 2, (y1 + y2) // 2), "alta": y2 - y1})
    return {"e_notifiche": "Notifiche" in descs and "Cancella tutto" in descs, "notifiche": notifiche}


# ===================== LA STRADA DELLA CLASSIFICA (RICHIESTO) =====================
# Il proprietario ha descritto, passo per passo, come si fa a mano: "per trovare la cronologia dei
# segnali di quell'utente deve andare su CLASSIFICA, che sta in basso; scorre fino a che non trova
# l'utente; entra dentro; scorre le posizioni e controlla la data; prende il primo, lo espande, vede
# i TP, lo stop, l'entrata; e alla fine fa la stessa cosa che fa quella di Telegram".
# PERCHE' PRIMA NON FUNZIONAVA: leggi_profilo cercava il nome dell'utente su una SUA SCHEDA gia'
# visibile nel riquadro dei setup. Se quell'utente non aveva pubblicato di recente - o se si era
# sulla pagina Notifiche, che e' la modalita' predefinita - quel nome sullo schermo non c'era, e la
# lettura finiva prima di cominciare con "nome non trovato sullo schermo".
# Ora la strada e' quella vera: la linguetta Classifica in fondo, la riga dell'utente, il suo
# profilo. Le tre pagine si riconoscono da quello che SCRIVONO, non da dove stanno:
#   - la Classifica ha le righe con "Tasso di vincita";
#   - il profilo ha il titolo "Info sul fornitore di setup";
#   - le schede del profilo sono le stesse schede di sempre (leggi_schermata).
TITOLO_PROFILO = "Info sul fornitore di setup"
VOCE_CLASSIFICA = "Classifica"
RE_TASSO = re.compile(r"tasso di vincita", re.I)


def _nome_confrontabile(v: str) -> str:
    """Il nome come si confronta: niente prefisso, niente maiuscole, niente spazi o punteggiatura.
    Serve perche' la classifica scrive "Gino" e il profilo "Gino - SGM FREE", e l'app lo conosce
    come "Syntra . Gino"."""
    s = str(v or "").replace("\u00b7", " ")
    s = re.sub(r"^\s*syntra\s*", "", s, flags=re.I)
    return re.sub(r"[^a-z0-9]", "", s.lower())


def stesso_utente_syntra(a: str, b: str) -> bool:
    """Vero se i due nomi sono la stessa persona. Il confronto sta da una parte sola, cosi' una
    riga "Gino - SGM FREE" trova "Gino" e viceversa, senza inventare somiglianze fra nomi diversi."""
    na, nb = _nome_confrontabile(a), _nome_confrontabile(b)
    if not na or not nb:
        return False
    return na == nb or na.startswith(nb) or nb.startswith(na)


def leggi_classifica(xml_testo: str) -> dict:
    """La pagina Classifica: e' quella giusta? e le righe, con il punto da toccare.

    Una riga si riconosce dal fatto che contiene "Tasso di vincita": e' l'unica cosa che hanno tutte
    e che non ha nient'altro nella pagina. Il nome e' la prima riga del nodo (nelle foto: il nome
    grande, poi il nome utente, poi XP e il tasso)."""
    radice = ET.fromstring(xml_testo)
    nodi = [(n.get("content-desc") or "", _bounds(n), n.get("clickable") == "true") for n in radice.iter("node")]
    voce = None
    righe = []
    for d, b, cl in nodi:
        t = (d or "").strip()
        if not t:
            continue
        if t == VOCE_CLASSIFICA and cl:
            voce = ((b[0] + b[2]) // 2, (b[1] + b[3]) // 2)
            continue
        if not RE_TASSO.search(t):
            continue
        parti = [r.strip() for r in t.split("\n") if r.strip()]
        if not parti:
            continue
        nome = parti[0]
        if RE_TASSO.search(nome):          # un nodo che contiene SOLO l'etichetta: non e' una riga
            continue
        righe.append({"utente": nome, "alias": parti[1] if len(parti) > 1 else "",
                      "testo": t, "centro": ((b[0] + b[2]) // 2, (b[1] + b[3]) // 2),
                      "alta": b[3] - b[1]})
    e_classifica = bool(righe)
    return {"e_classifica": e_classifica, "voce": voce, "righe": righe}


RE_ESPANDI = re.compile(r"^\s*vedi dettagli", re.I)


def trova_espansori(xml_testo: str) -> List[Tuple[int, int]]:
    """I pulsanti «Vedi dettagli TP/SL» presenti sullo schermo, dall'alto in basso.

    SEGNALATO dal proprietario: "il robot fa la procedura giusta, va in classifica, cerca l'utente,
    entra nel profilo... pero' una volta che va sul profilo non esegue piu' nulla" - e l'app
    riceveva "storia completa letta dal profilo, 0 operazioni lette".
    LA CAUSA, ed e' un cane che si morde la coda: leggi_schermata() riconosce una scheda SOLO se il
    suo testo contiene la riga "Entrata:", che compare solo a dettaglio APERTO. Sul profilo di un
    utente le operazioni arrivano CHIUSE. I pulsanti per aprirle venivano pero' cercati DENTRO le
    schede gia' riconosciute (sc["toggle"]): nessuna scheda riconosciuta, nessun pulsante trovato,
    niente da espandere, quindi niente da riconoscere. Si girava a vuoto per tutte le pagine
    previste e si usciva con zero operazioni.
    Qui i pulsanti si cercano NELL'ALBERO INTERO, che e' l'unico posto dove esistono prima di aver
    riconosciuto qualcosa. Non si richiede clickable="true": l'etichetta spesso e' figlia del nodo
    che riceve davvero il tocco, ed e' lo stesso motivo per cui leggi_schermata non lo richiede.
    """
    try:
        radice = ET.fromstring(xml_testo)
    except Exception:
        return []
    out = []
    for n in radice.iter("node"):
        d = (n.get("content-desc") or "")
        if not RE_ESPANDI.match(d):
            continue
        x1, y1, x2, y2 = _bounds(n)
        if x2 <= x1 or y2 <= y1:
            continue
        out.append(((x1 + x2) // 2, (y1 + y2) // 2))
    out.sort(key=lambda p: p[1])
    return out


def misura_schermo(xml_testo: str) -> Tuple[int, int]:
    """Larghezza e altezza dello schermo, dal nodo piu' esterno. Servono per scorrere anche quando
    non si e' riconosciuta nessuna scheda: senza, lo scorrimento si calcolava dall'ingombro delle
    schede e quindi non avveniva proprio - si restava fermi sulla stessa schermata."""
    try:
        radice = ET.fromstring(xml_testo)
    except Exception:
        return (0, 0)
    larg = max((_bounds(n)[2] for n in radice.iter("node")), default=0)
    alt = max((_bounds(n)[3] for n in radice.iter("node")), default=0)
    return (larg, alt)


def e_pagina_profilo(xml_testo: str) -> bool:
    """Siamo dentro "Info sul fornitore di setup"?"""
    try:
        radice = ET.fromstring(xml_testo)
    except Exception:
        return False
    for n in radice.iter("node"):
        if (n.get("content-desc") or "").strip() == TITOLO_PROFILO:
            return True
    return False


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
        # PREZZI IN DUE NODI: su certe schermate l'etichetta e il numero non stanno nello stesso
        # nodo ("TP #1:" e, a parte, "80335 (+50 pips)"). Le due espressioni qui sopra pretendono
        # etichetta e numero INSIEME, quindi li' non trovavano niente e il segnale usciva senza
        # target ne' stop - cioe' veniva scartato. Stesso trattamento gia' usato per "Entrata".
        t = tipo_riga(r)
        if t in ("tp", "sl") and not RE_TP.match(d) and not RE_SL.match(d):
            for d2, _, _ in nodi[i + 1:]:
                if not d2:
                    continue
                v = numero(d2.split("(")[0])
                if v is None:
                    break
                if t == "sl":
                    sc["sl"] = v
                else:
                    m2 = re.search(r"(\d+)", rl)
                    sc["tp"][int(m2.group(1)) if m2 else (len(sc["tp"]) + 1)] = v
                break
            continue
        if rl in ("in attesa", "attivo", "attiva", "aperto", "aperta", "in corso", "chiuso", "chiusa",
                  "annullato", "annullata", "scaduto", "scaduta", "vinto", "perso") or "hit" in rl:
            sc["stato"] = (sc["stato"] + " " + r).strip()
            continue
        # L'asset NON si decide qui riga per riga (era la regola del "/" che lasciava passare
        # "RR" sulle schede senza barra): si sceglie dopo, per posizione, con scegli_asset().
        # L'utente NON si decide piu' qui riga per riga: si sceglie dopo, con scegli_utente(),
        # scartando prima tutto quello che e' palesemente un'altra cosa.
    # L'ASSET: il testo piu' in alto a sinistra della casella (vedi scegli_asset). Se si conosce
    # l'altezza della data, non si guarda piu' in basso di li': l'asset sta sempre sopra.
    sc["asset"] = scegli_asset(nodi, larghezza, y_data)
    if sc["utente"] is None:
        sc["utente"] = scegli_utente(nodi, larghezza, sc["asset"], y_data)
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
                # L'asset e' sopra la data (prima ancora c'e' la lettera dell'icona). Si risale
                # fino alla prima riga che PUO' essere un simbolo: certe schede infilano "RR" (il
                # rischio/rendimento) fra l'asset e la data, e veniva preso per il simbolo.
                for j in range(i - 1, -1, -1):
                    if asset_valido(righe[j]):
                        sc["asset"] = righe[j]
                        break
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
                # Dove toccare per aprire il PROFILO di quell'utente (il nome, in alto a destra
                # della scheda). Serve ai Passi 15/16: da lì si scorre la storia completa.
                sc["utente_xy"] = ((fx1 + fx2) // 2, (fy1 + fy2) // 2)
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
    # Ultima rete: un simbolo che non ha la forma di un simbolo non diventa un segnale. Meglio
    # nessun segnale che un ordine su "RR".
    if sc.get("asset") and not asset_valido(sc["asset"]):
        return None
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
            # BUG SEGNALATO ("un utente che manda segnali ogni giorno e non lo rileva mai"):
            # `nt["quando"] or 0` trasformava una data NON LETTA in "1 gennaio 1970", cioe' in una
            # notifica vecchissima - e veniva scartata SEMPRE, in silenzio. Una notifica di cui non
            # si riesce a leggere la data e' una notifica di cui non si sa l'eta': siccome arriva
            # qui solo se e' NUOVA per noi (l'insieme `visti` la protegge dai doppioni), la si
            # tratta come recente e la si apre. Meglio aprirne una di troppo che perderne una.
            if nt["quando"] is None:
                log("Syntra: notifica con la data in un formato che non conosco (la apro lo stesso): %s"
                    % nt["id"].replace("\n", " / "))
            elif time.time() * 1000.0 - nt["quando"] > NOTIFICA_MAX_ETA_MS:
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


async def apri_classifica(adb: Adb, log: Callable[[str], None]) -> bool:
    """Porta l'app sulla pagina Classifica. Torna True se ci siamo.

    Prima un passo indietro: se si e' dentro il dettaglio di una notifica, la barra in fondo non
    c'e'. Poi si cerca la voce "Classifica" e la si tocca. Non si tocca mai nient'altro.
    """
    for tentativo in range(3):
        xml = await adb.schermata()
        pagina = leggi_classifica(xml)
        if pagina["e_classifica"]:
            return True
        if pagina["voce"]:
            await adb.tocca(*pagina["voce"])
            await asyncio.sleep(1.2)
            if leggi_classifica(await adb.schermata())["e_classifica"]:
                return True
        if tentativo < 2:
            try:
                await adb.indietro()
            except Exception:
                pass
            await asyncio.sleep(0.8)
    return False


async def cerca_in_classifica(adb: Adb, utente: str, log: Callable[[str], None],
                              scorrimenti: int = 14) -> Optional[Tuple[int, int]]:
    """Scorre la classifica fino a trovare la riga di questo utente. Torna il punto da toccare.

    Si scorre finche' la pagina CAMBIA: quando due scorrimenti di fila mostrano le stesse righe
    vuol dire che si e' arrivati in fondo, e insistere non serve a niente.
    """
    viste = set()
    for giro_n in range(max(1, scorrimenti)):
        pagina = leggi_classifica(await adb.schermata())
        righe = pagina["righe"]
        for r in righe:
            if stesso_utente_syntra(r["utente"], utente) or stesso_utente_syntra(r["alias"], utente):
                log("Syntra: %s trovato nella classifica (riga «%s»)" % (utente, r["utente"]))
                return r["centro"]
        firma = "|".join(r["utente"] for r in righe)
        if not righe or firma in viste:
            break                      # fondo raggiunto, o pagina che non scorre piu'
        viste.add(firma)
        alto = min(r["centro"][1] for r in righe)
        basso = max(r["centro"][1] for r in righe)
        if basso - alto < 20:
            break
        await adb.scorri(righe[0]["centro"][0], basso, alto)
        await asyncio.sleep(0.8)
    return None


async def syntra_viva(adb: Adb, log: Callable[[str], None], tentativi: int = 2) -> bool:
    """Syntra e' davanti? Se non c'e' piu', la si riapre e si aspetta che torni.

    RICHIESTO dal proprietario: "a volte l'applicazione di Syntra viene chiusa forzatamente e non
    viene riaperta".
    Il controllo che esisteva gira nel ciclo principale ogni 30 secondi - ma la lettura di un
    profilo dura MINUTI dentro un solo giro di quel ciclo, quindi proprio mentre serve non arriva
    mai. Qui si guarda prima di ogni schermata del profilo.
    E serve a una seconda cosa, altrettanto importante: NON TOCCARE LO SCHERMO AL BUIO. Se Syntra
    e' morta e davanti c'e' qualcos'altro, un tocco a coordinate fisse preme qualunque cosa si
    trovi li' sotto, dentro l'app di qualcun altro.
    """
    for i in range(max(1, tentativi)):
        try:
            if await adb.syntra_davanti():
                return True
        except Exception:
            # Non si riesce nemmeno a chiedere chi e' davanti: si prosegue come si faceva prima,
            # senza bloccare tutto per un controllo accessorio.
            return True
        log("Syntra: l'app non e' in primo piano (chiusa?): la riapro")
        try:
            await adb.apri_syntra()
        except Exception as e:
            log("Syntra: riapertura non riuscita: %s" % e)
            return False
        await asyncio.sleep(3.0 + i * 2.0)
    try:
        return await adb.syntra_davanti()
    except Exception:
        return True


async def leggi_profilo(adb: Adb, utente: str, pagine: int, log: Callable[[str], None],
                        stato: dict, da_ms: Optional[float] = None) -> List[dict]:
    """Passi 15/16 — la STORIA COMPLETA di un utente Syntra.

    Si tocca il nome dell'utente (nodo cliccabile in alto a destra di una sua scheda), si apre il
    PROFILO e si scorre per `pagine` schermate: ogni scheda letta è un'operazione passata. Si torna
    indietro da soli, lasciando l'emulatore come prima. NON tocca la pagina delle notifiche.
    """
    # 1) LA STRADA DELLA CLASSIFICA (richiesto esplicitamente, passo per passo dal proprietario):
    #    indietro per uscire da dove si e', poi la linguetta "Classifica" in fondo, poi si scorre
    #    fino a trovare l'utente e si entra nella sua scheda.
    #    Prima si cercava il nome su una SUA scheda gia' visibile nel riquadro dei setup: se non
    #    aveva pubblicato di recente - o se si era sulle Notifiche, che e' la modalita' di sempre -
    #    quel nome sullo schermo non c'era e la lettura moriva li'.
    if not await apri_classifica(adb, log):
        log("Syntra: non trovo la linguetta «%s» in fondo allo schermo" % VOCE_CLASSIFICA)
        return []
    punto = await cerca_in_classifica(adb, utente, log)
    if not punto:
        log("Syntra: %s non si trova nella classifica (scorsa fino in fondo)" % utente)
        try:
            await adb.indietro()
        except Exception:
            pass
        return []
    await adb.tocca(*punto)
    await asyncio.sleep(1.4)
    if not e_pagina_profilo(await adb.schermata()):
        # Il tocco non ha aperto il profilo: si riprova una volta, poi si lascia stare invece di
        # andare avanti a toccare cose a caso dentro l'app di qualcun altro.
        await adb.tocca(*punto)
        await asyncio.sleep(1.4)
        if not e_pagina_profilo(await adb.schermata()):
            log("Syntra: la scheda di %s non si e' aperta" % utente)
            return []

    # 2) Si scorre il profilo dall'alto in basso, ESPANDENDO una per una tutte le posizioni, fino
    #    al periodo chiesto (richiesto esplicitamente: "inizia a scorrere verso il basso e a vedere
    #    tutte le posizioni, a espandere tutte le posizioni una per una fino al periodo scelto").
    trovate: Dict[str, dict] = {}
    vuote_di_fila = 0
    firme = set()
    for pagina in range(max(1, pagine)):
        # L'app potrebbe non esserci piu': prima di toccare qualunque cosa si controlla.
        if not await syntra_viva(adb, log):
            log("Syntra: profilo di %s interrotto: l'app non e' tornata in primo piano" % utente)
            break
        xml = await adb.schermata()
        # APRI UNA POSIZIONE, LEGGILA, TORNA INDIETRO, PASSA ALLA SUCCESSIVA.
        #
        # SEGNALATO dal proprietario: "apre la prima posizione, legge i valori di quella posizione e
        # basta, e poi chiude". LA CAUSA: toccare «Vedi dettagli TP/SL» non sempre espande la scheda
        # SUL POSTO - spesso apre una PAGINA A SE'. Da li' in poi non c'erano piu' pulsanti da
        # toccare (il giro di espansione finiva), si leggeva quell'unica operazione, e alla schermata
        # dopo la "pagina" era sempre quella: due letture uguali di fila = "non scorre piu'", e via.
        # Ora si riconosce il caso: se dopo il tocco non siamo piu' sul profilo, quella pagina si
        # LEGGE e poi si torna indietro, riprendendo dalla posizione seguente.
        fatti = 0
        for _ in range(24):
            esp = trova_espansori(xml)
            if fatti >= len(esp):
                break
            prima = xml
            await adb.tocca(*esp[fatti])
            await asyncio.sleep(0.8)
            xml = await adb.schermata()
            if not e_pagina_profilo(xml):
                # Pagina a se': si prende tutto quello che c'e' (il dettaglio porta entrata, stop e
                # target, che e' esattamente cio' che serve) e si torna sul profilo.
                for sc in leggi_schermata(xml)["schede"]:
                    trovate[chiave(sc)] = sc
                try:
                    d = leggi_dettaglio(xml)
                except Exception:
                    d = None
                if d:
                    trovate[chiave(d)] = d
                try:
                    await adb.indietro()
                except Exception:
                    pass
                await asyncio.sleep(1.0)
                xml = await adb.schermata()
                fatti += 1
                if not e_pagina_profilo(xml):
                    # Non si e' tornati dove si era: non si insiste a toccare al buio.
                    log("Syntra: non sono tornato sul profilo di %s: mi fermo qui" % utente)
                    break
                continue
            if xml == prima:
                log("Syntra: il dettaglio non si apre: vado avanti con quello che c'e'")
                break
            # Espansa sul posto: il suo pulsante sparisce dall'elenco, quindi `fatti` resta dov'e'
            # e il giro dopo prende la prossima.
        schede = leggi_schermata(xml)["schede"]
        for sc in schede:
            if (sc.get("utente") or utente) != utente:
                continue
            trovate[chiave(sc)] = sc
        if not schede:
            vuote_di_fila += 1
            log("Syntra: profilo di %s: nessuna operazione riconosciuta nella schermata %d"
                % (utente, pagina + 1))
            # Tre schermate di fila senza riconoscere niente: non e' la pagina che pensiamo di
            # avere davanti. Insistere a scorrere dentro l'app di qualcun altro non ha senso.
            if vuote_di_fila >= 3:
                log("Syntra: profilo di %s: mi fermo, questa non sembra la pagina dei setup" % utente)
                break
        else:
            vuote_di_fila = 0
        # IL PERIODO: sotto a ogni scheda c'e' la sua data. Quando TUTTE quelle a schermo sono piu'
        # vecchie del periodo chiesto si smette: piu' giu' c'e' solo roba ancora piu' vecchia.
        if da_ms is not None and schede:
            date = [data_ms(sc.get("data") or "") for sc in schede]
            note = [d for d in date if d is not None]
            if note and max(note) < da_ms:
                log("Syntra: profilo di %s: arrivato al periodo chiesto, mi fermo" % utente)
                break
        # FONDO DELLA PAGINA: se due schermate di fila mostrano le stesse identiche operazioni si
        # e' arrivati in fondo, e continuare a scorrere e' tempo buttato (stessa idea gia' usata
        # per scorrere la classifica).
        firma = "|".join(sorted(chiave(sc) for sc in schede))
        if schede and firma in firme:
            log("Syntra: profilo di %s: la pagina non scorre piu', mi fermo" % utente)
            break
        if schede:
            firme.add(firma)
        if pagina >= pagine - 1:
            break
        # SCORRIMENTO. Con le schede riconosciute si usa il loro ingombro; SENZA, si scorre lo
        # stesso di due terzi di schermo invece di restare fermi sulla stessa schermata fino alla
        # fine del giro - che e' esattamente quello che succedeva prima.
        if schede:
            x1, y1, x2, y2 = schede[0]["bounds"]
            basso = max(sc["bounds"][3] for sc in schede)
            await adb.scorri((x1 + x2) // 2, basso - 20, y1 + 40)
        else:
            larg, alt = misura_schermo(xml)
            if alt < 200:
                break
            await adb.scorri(max(1, larg // 2), int(alt * 0.80), int(alt * 0.25))
        await asyncio.sleep(0.6)
    # 3) Indietro: si torna alla pagina di prima.
    try:
        await adb.indietro()
        await asyncio.sleep(0.4)
    except Exception:
        pass
    log("Syntra: profilo di %s: %d operazioni lette" % (utente, len(trovate)))
    return list(trovate.values())


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


def sistema_windows() -> bool:
    """Siamo su Windows? Separata apposta: il collaudo deve poter provare il giro anche su Linux.

    Fingere `os.name` dal test non si puo' - lo guardano anche pathlib e shutil, e cambiarlo rompe
    pytest. Questa funzione invece si sostituisce senza conseguenze.
    """
    return os.name == "nt"


async def ciclo(cfg: dict, consegna: Callable, log: Callable[[str], None], stato: dict) -> None:
    """Gira per sempre. `consegna(segnale, utente, quando_ms)` e' la funzione del ponte.
    Modalita' "notifiche" (predefinita, RICHIESTO): resta sulla pagina Notifiche di Syntra.
    Modalita' "schede": il giro sulle linguette FX/IDX, Crypto, Azioni (come prima)."""
    # SYNTRA GIRA SOLO SUL COMPUTER. Legge l'app Android dentro BlueStacks attraverso ADB: su un
    # server Linux non c'e' ne' BlueStacks ne' Windows, e nessun percorso potra' mai esistere.
    # Prima si tentava lo stesso e usciva "[Errno 2] No such file or directory" con un percorso di
    # Windows, che manda a cercare un file mancante invece di dire la cosa vera - ed e' successo
    # davvero appena il ponte dei segnali e' stato spostato sul server.
    if not sistema_windows():
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
            # Passi 15/16 — se l'app ha chiesto la cronologia di un utente Syntra, questo giro legge
            # il PROFILO (non le notifiche). Va prima di tutto: mentre si legge il profilo la pagina
            # delle notifiche non si tocca (vincolo richiesto dal proprietario).
            richiesta_profilo = stato.get("syntra_leggi_profilo")
            if richiesta_profilo and not richiesta_profilo.get("pronto"):
                utente_p = str(richiesta_profilo.get("utente") or "")
                stato["syntra_profilo"] = "lettura del profilo di %s..." % utente_p
                try:
                    # `mesi` lo manda l'app insieme alla richiesta (la stessa tendina PERIODO della
                    # cronologia delle sale): 0 o assente = tutta la storia che si riesce a leggere.
                    _mesi = 0
                    try:
                        _mesi = int(richiesta_profilo.get("mesi") or 0)
                    except Exception:
                        _mesi = 0
                    _da = (time.time() - _mesi * 30 * 86400) * 1000.0 if _mesi > 0 else None
                    # QUANTE SCHERMATE scorrere sul profilo. Non e' `pagine` (che vale 2 ed e' il
                    # giro delle NOTIFICHE): con due schermate non si arriva da nessuna parte, ed e'
                    # una delle ragioni per cui la storia tornava vuota o quasi. Qui il tetto e'
                    # alto apposta perche' a fermare il giro deve essere il PERIODO chiesto (o il
                    # fondo della pagina), non un numero deciso a tavolino.
                    _pagine_profilo = int(cfg.get("pagine_profilo") or 60)
                    schede_p = await leggi_profilo(adb, utente_p, _pagine_profilo, log, stato, _da)
                except Exception as e:
                    schede_p = []
                    log("Syntra: lettura del profilo di %s non riuscita: %s" % (utente_p, e))
                quante_p = 0
                for sc_p in (schede_p or []):
                    if (sc_p.get("utente") or utente_p) != utente_p:
                        continue
                    seg_p = segnale(sc_p)
                    if not seg_p:
                        continue
                    try:
                        storico_sale.archivia_syntra("Syntra · %s" % utente_p, seg_p, time.time() * 1000.0)
                        quante_p += 1
                    except Exception:
                        pass
                # L'utente entra tra i conosciuti anche se l'archivio era vuoto.
                utenti_p = stato.setdefault("syntra_utenti", [])
                if utente_p and utente_p not in utenti_p:
                    utenti_p.append(utente_p)
                richiesta_profilo["lette"] = len(schede_p or [])
                richiesta_profilo["registrate"] = quante_p
                richiesta_profilo["pronto"] = True
                stato["syntra_profilo"] = "profilo di %s: %d operazioni lette" % (utente_p, len(schede_p or []))
                log("Syntra: profilo di %s: %d operazioni lette, %d archiviate" % (utente_p, len(schede_p or []), quante_p))
            elif modalita == "schede":
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
