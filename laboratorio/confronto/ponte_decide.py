"""FASE 3 del progetto: la DECISIONE in Python.

Porto di tgPiano (app.html, riga 34079 - 212 righe) nelle stesse parole, stesso ordine, stessi
numeri. Non e' una reinterpretazione: e' una copia. Se un numero differisce da quello della
pagina, confronta.py lo dice e ci si ferma a capire quale dei due ha ragione.

L'ordine dei controlli e' quello della pagina, e non si puo' cambiare senza accorgersene: il
primo rifiuto che scatta decide il messaggio che l'utente legge, quindi due ordini diversi
danno due segnali rifiutati per motivi diversi.

Cosa NON e' qui (e resta nella pagina, per ora):
  - la tabella di configurazione (tgCfg) e la conferma dell'utente: questa funzione parte dal
    segnale ARRIVATO e decide cosa farne, che e' esattamente il pezzo che deve poter girare da
    solo;
  - l'esecuzione (tgEseguiSegnale) e la gestione dal vivo (pareggio, break-even, sposta stop).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import ponte_matematica as pm

# ---- configurazione: una sola, esportata dalla pagina (vedi casi.json "config").
#      Due config che un domani divergono sono due comportamenti diversi.
CONFIG_PREDEFINITA = {
    "rischioTotale": 1,        # tgRischioTotale: localStorage, min(100), default 1
    "rischioSenzaSl": 1,       # tgRischioSenzaSlDi
    "tpSenzaTpPct": 20,        # tgTpSenzaTpPctDi: target calcolato = % della distanza dello stop
    "apriSenzaSl": True,       # tgApreSenzaSl: !A || A.apriSenzaSl !== false
    "apriSenzaTp": True,       # tgApreSenzaTp
    "parti": 1,                # in quante entrate e' diviso il messaggio
    "saldo": 10000,            # realizedBalanceNow() con conto pulito
    "passoLotto": 0.01,
    "minimoLotto": 0.01,
    "maxN": None,
}

CRIPTI = "BTC|ETH|SOL|XRP|LTC|DOGE|ADA|BNB|CRYPTO"


@dataclass
class Piano:
    """Stessi nomi della pagina, cosi' il confronto e' campo a campo."""
    side: str = ""
    entry: float = 0.0
    sl: Optional[float] = None
    tp: List[float] = field(default_factory=list)
    n: int = 1
    lotti: float = 0.0
    pct: float = 0.0
    importoTot: float = 0.0
    rischioReale: float = 0.0
    pendente: bool = False
    kind: Optional[str] = None
    slCalcolato: bool = False
    tpCalcolato: bool = False
    notaEntrata: Optional[str] = None
    notaRidotte: Optional[str] = None
    base: str = "rischio"
    rr: Optional[float] = None
    problemi: List[str] = field(default_factory=list)


def _c(v) -> bool:
    """tgC: il valore c'e'? Number(null) fa 0 e 0 passa Number.isFinite - il trabocchetto
    segnato a riga 30448 di app.html, copiato tale quale."""
    return v is not None and v != "" and isinstance(v, (int, float)) and math.isfinite(float(v))


def tg_fmt(v, sym: str) -> str:
    """tgFmt (riga 29916): il prezzo coi decimali del SUO asset, o il trattino se non e' un
    prezzo. I messaggi di rifiuto si leggono con questi numeri: un rifiuto diverso e' un
    messaggio diverso, e l'utente va a cercare un errore che non c'e'."""
    if not _c(v):
        return "—"
    d = pm.strumento(sym).decimals
    d = 5 if d is None else int(d)
    return f"{float(v):.{d}f}"


def _validate_trade_level(side: str, entry: float, sl, tp) -> str:
    """validateTradeLevel (riga 23258). Restituisce il messaggio, o '' se va bene."""
    if _c(sl) and sl <= 0:
        return "Lo Stop Loss deve essere un prezzo valido, maggiore di zero."
    if _c(tp) and tp <= 0:
        return "Il Take Profit deve essere un prezzo valido, maggiore di zero."
    if _c(sl):
        if side == "BUY" and sl >= entry:
            return "Per un BUY, lo Stop Loss deve essere sotto l'entry."
        if side == "SELL" and sl <= entry:
            return "Per un SELL, lo Stop Loss deve essere sopra l'entry."
    if _c(tp):
        if side == "BUY" and tp <= entry:
            return "Per un BUY, il Take Profit deve essere sopra l'entry."
        if side == "SELL" and tp >= entry:
            return "Per un SELL, il Take Profit deve essere sotto l'entry."
    return ""


def _tp_in_ordine(lista, direzione: str) -> List[float]:
    """tgTpInOrdine (riga 30447): scarta chi non e' un prezzo, ordina per arrivo."""
    grezzi = lista if isinstance(lista, list) else [lista]
    v = [float(x) for x in grezzi
         if x is not None and x != "" and isinstance(x, (int, float)) and math.isfinite(float(x)) and float(x) > 0]
    compra = str(direzione or "").upper() != "SELL"
    return sorted(v, reverse=not compra)


def _stop_calcolato(side: str, entry: float, n: int, importo_tot: float,
                    sym: str, opz: Dict[str, Any], cfg: Dict[str, Any]) -> Dict[str, Any]:
    """tgStopCalcolato (riga 34049)."""
    lotti = opz["minimo"] if opz.get("minimo") and opz["minimo"] > 0 else 0.01
    per_unita = pm.euro_at_level(entry, entry + 1, lotti, sym)
    if not (per_unita > 0) or not (importo_tot > 0):
        return {"problema": "non riesco a calcolare il valore di un punto su " + sym}
    dist = importo_tot / (n * per_unita)
    passo = pm.pip_size(sym) / 10
    sl = entry - dist if side == "BUY" else entry + dist
    sl = (math.ceil(sl / passo - 1e-9) * passo if side == "BUY"
          else math.floor(sl / passo + 1e-9) * passo)
    sl = float(f"{sl:.8f}")
    spread = pm.strumento(sym).spread_pips * pm.pip_size(sym)
    minimo = max(3 * spread, entry * 0.001, 10 * passo)
    if abs(entry - sl) < minimo:
        return {"problema": "col rischio scelto e " + str(n) + (' posizione' if n == 1 else ' posizioni')
                + f" da {lotti:.2f} lot lo stop calcolato starebbe a {tg_fmt(sl, sym)}, troppo vicino al prezzo: "
                + "scatterebbe per il normale movimento del mercato. Aumenta il rischio o tieni meno target"}
    return {"sl": sl, "lotti": lotti}


def decida(seg: Dict[str, Any], sym: str, prezzo: float, cfg: Dict[str, Any],
           pct_forzata: Optional[float] = None, prezzo_scelto: Optional[float] = None,
           opz: Optional[Dict[str, Any]] = None) -> Piano:
    cfg = {**CONFIG_PREDEFINITA, **(cfg or {})}
    opz = {**{"minimo": None, "valore": None, "parti": None, "maxN": None,
              "entroRischio": False, "base": None, "quote": None, "saldo": None,
              "prezzo": None}, **(opz or {})}
    if opz["parti"] is None:
        opz["parti"] = cfg["parti"]
    parti = max(1, int(opz["parti"] or 1))
    max_n = opz["maxN"] if opz["maxN"] else cfg["maxN"]
    max_n = math.floor(max_n) if max_n and max_n >= 1 else math.inf
    saldo = opz["saldo"] if opz["saldo"] else cfg["saldo"]
    passo_lotto = float(cfg["passoLotto"])
    minimo_lotto = float(cfg["minimoLotto"])
    dec_lotto = max(0, round(-math.log10(passo_lotto)))

    def problemi(msg: str) -> Piano:
        return Piano(problemi=[msg])

    side = str(seg.get("direzione") or "").upper()
    if side != "BUY" and side != "SELL":
        return problemi("il segnale non dice se comprare o vendere")

    prezzo_mercato = prezzo
    entry = float(prezzo_scelto if _c(prezzo_scelto) and prezzo_scelto > 0 else prezzo_mercato)
    if not math.isfinite(entry):
        return problemi("il grafico non ha ancora un prezzo per " + sym)

    mercato = entry

    def lontano(v, pct) -> bool:
        if not _c(v) or not (mercato > 0):
            return False
        return abs(float(v) - mercato) / mercato > pct / 100

    max_scarto = 3 if re_test(sym) else 1
    if lontano(seg.get("entrata"), max_scarto):
        e = float(seg["entrata"])
        return problemi(f"l'entrata della sala ({tg_fmt(e, sym)}) e' a "
                        f"{abs(e - mercato) / mercato * 100:.1f}% dal prezzo di {sym} ({tg_fmt(mercato, sym)}), "
                        f"oltre il {max_scarto}% ammesso: segnale scartato")
    if lontano(seg.get("stop_loss"), 100):
        sl0 = float(seg["stop_loss"])
        return problemi(f"lo stop loss della sala ({tg_fmt(sl0, sym)}) e' a "
                        f"{abs(sl0 - mercato) / mercato * 100:.1f}% dal prezzo di {sym} ({tg_fmt(mercato, sym)}), "
                        f"oltre il 100% ammesso: non e' un prezzo vero")

    pendente, kind, nota_entrata = False, None, None
    tipo_ord = str(seg.get("tipo_ordine") or "").lower()
    if tipo_ord in ("limit", "stop") and _c(seg.get("entrata")):
        e = float(seg["entrata"])
        piazzabile = (e < entry) if (tipo_ord == "limit") == (side == "BUY") else (e > entry)
        if piazzabile:
            pendente, kind, entry = True, tipo_ord.upper(), e
        elif tipo_ord == "limit":
            nota_entrata = f"il prezzo e' gia' oltre l'entrata limite della sala ({tg_fmt(e, sym)}): aperto a mercato, a un prezzo migliore"
        else:
            return problemi(f"entrata STOP a {tg_fmt(e, sym)} gia' superata dal prezzo ({tg_fmt(entry, sym)}): la rottura e' gia' avvenuta, non la inseguo")

    if _c(prezzo_scelto) and prezzo_scelto > 0 and prezzo_scelto != prezzo_mercato:
        e = float(prezzo_scelto)
        e_limit = (e < prezzo_mercato) if side == "BUY" else (e > prezzo_mercato)
        pendente, kind, entry = True, ("LIMIT" if e_limit else "STOP"), e
        nota_entrata = f"prezzo di apertura scelto dall'utente: {tg_fmt(e, sym)}"

    sl = float(seg.get("stop_loss") or 0) if _c(seg.get("stop_loss")) else 0.0
    sl_calcolato = False
    lotti_fissi = None
    in_automatico = _c(pct_forzata) and pct_forzata > 0

    if not _c(seg.get("stop_loss")):
        if in_automatico and not cfg["apriSenzaSl"]:
            return problemi("la sala non ha dato lo stop loss, e nelle impostazioni dell'apertura "
                            "automatica hai scelto di non aprire i segnali senza stop: resta qui, "
                            "da valutare a mano")
        tutti_tp = [v for v in _tp_in_ordine(seg.get("take_profit"), side)
                    if not _validate_trade_level(side, entry, float("nan"), v)]
        n_tp = max(1, min(max_n, len(tutti_tp)))
        pct_tmp = (float(pct_forzata) if in_automatico else cfg["rischioSenzaSl"]) / parti
        calc = _stop_calcolato(side, entry, n_tp, saldo * pct_tmp / 100, sym, opz, cfg)
        if "problema" in calc:
            return problemi(calc["problema"])
        sl, lotti_fissi, sl_calcolato = calc["sl"], calc["lotti"], True

    if _validate_trade_level(side, entry, sl, float("nan")):
        dove = "sotto" if side == "BUY" else "sopra"
        rif = (f"entrata {kind} della sala {tg_fmt(entry, sym)}" if pendente else f"entrata a mercato {tg_fmt(entry, sym)}")
        rif_m = (f", prezzo di adesso {tg_fmt(mercato, sym)}" if mercato != entry else "")
        return problemi(f"lo stop loss della sala ({tg_fmt(sl, sym)}) e' dalla parte sbagliata: per un {side} "
                        f"deve stare {dove} all'entrata ({rif}{rif_m}). Cosi' com'e', la posizione "
                        f"nascerebbe gia' oltre il proprio stop: il segnale non e' valido")

    tutti = [v for v in _tp_in_ordine(seg.get("take_profit"), side) if not lontano(v, 20)]
    tp = [v for v in tutti if not _validate_trade_level(side, entry, float("nan"), v)]
    tp_calcolato = False
    senza_livelli = sl_calcolato and not tutti
    if not tutti and in_automatico and not cfg["apriSenzaTp"]:
        return problemi("la sala non ha dato nessun take profit, e nelle impostazioni "
                        "dell'apertura automatica hai scelto di non aprire i segnali senza target: "
                        "resta qui, da valutare a mano")
    if not tutti:
        passo_tp = pm.pip_size(sym) / 10
        # DUE percentuali diverse, e la pagina le tiene distinte perche' rispondono a due domande
        # diverse: "la sala ha dato lo stop ma non il target" (tgTpSenzaTpPct) e "non ha dato
        # nemmeno lo stop" (tgTpSenzaNullaPct, predefinita 50). Usare una sola per tutti e due i
        # casi vuol dire sbagliare uno dei due.
        pct_tp_num = cfg.get("tpSenzaNullaPct", 50) if senza_livelli else cfg.get("tpSenzaTpPct", 30)
        pct_tp = float(pct_tp_num) / 100
        pip_sala = None
        v = (entry + pip_sala * pm.pip_size(sym) if pip_sala is not None and side == "BUY" else
             entry - pip_sala * pm.pip_size(sym) if pip_sala is not None else
             entry + abs(entry - sl) * pct_tp if side == "BUY" else
             entry - abs(entry - sl) * pct_tp)
        v = round(round(v / passo_tp) * passo_tp, 8)
        if not _validate_trade_level(side, entry, float("nan"), v) and v != entry:
            tp, tp_calcolato = [v], True

    if len(tp) > max_n:
        tp = tp[:int(max_n)]
    n = max(1, len(tp))
    pct = min(100, float(pct_forzata) if in_automatico else cfg["rischioTotale"]) / parti
    importo_tot = saldo * pct / 100
    per_lotto = pm.euro_at_level(entry, sl, 1, sym)
    if not (per_lotto > 0):
        return problemi("non riesco a calcolare quanto si perde per lotto su " + sym)
    base_cap = opz["base"] == "capitale"
    per_unita = entry if base_cap else per_lotto
    if not (per_unita > 0):
        return problemi("non riesco a calcolare quanto vale un lotto su " + sym)
    lotti = round(math.floor((importo_tot / n) / per_unita / passo_lotto + 1e-9) * passo_lotto, dec_lotto)
    if lotti_fissi is not None:
        lotti = lotti_fissi
    al_minimo = False
    if not (lotti >= minimo_lotto):
        lotti, al_minimo = minimo_lotto, True
    nota_ridotte = None
    if opz["entroRischio"] and al_minimo and lotti * per_unita * n > importo_tot + 0.01:
        k = math.floor(importo_tot / (minimo_lotto * per_unita) + 1e-9)
        if k < 1:
            return problemi(f"anche una sola posizione da {minimo_lotto} lot "
                            f"{'varrebbe' if base_cap else 'rischierebbe'} {minimo_lotto * per_unita}, "
                            f"piu' del {pct:.2f}% {'del capitale' if base_cap else 'di rischio'} "
                            f"scelto ({importo_tot}): "
                            f"{'il lotto minimo di questo contratto e troppo grande per questo conto' if base_cap else 'stop troppo lontano per questo conto'}")
        if k < n:
            nota_ridotte = f"aperte {k} posizioni invece di {n}: con {minimo_lotto} lot (il minimo) tutte e {n} insieme avrebbero superato {'il capitale' if base_cap else 'il rischio'} scelto"
            tp = tp[:k]
            n = k
        al_minimo = False

    lotti_tp = None
    quote = opz.get("quote")
    if quote and len(quote) >= n:
        if any(abs(x - 1 / n) > 1e-9 for x in quote[:n]):
            grezzi = [round(math.floor(importo_tot * f / per_unita / passo_lotto + 1e-9) * passo_lotto, dec_lotto)
                      for f in quote[:n]]
            if all(v >= minimo_lotto - 1e-12 for v in grezzi):
                lotti_tp = grezzi

    rischio_reale = (sum(v * per_lotto for v in lotti_tp) if lotti_tp
                     else lotti * per_lotto * n)
    rr = (abs(tp[0] - entry) / abs(entry - sl)
          if tp and abs(entry - sl) > 0 else None)

    return Piano(side=side, entry=entry, sl=sl, tp=tp, n=n, lotti=lotti, pct=pct,
                 importoTot=importo_tot, rischioReale=rischio_reale, pendente=pendente,
                 kind=kind, slCalcolato=sl_calcolato, tpCalcolato=tp_calcolato,
                 notaEntrata=nota_entrata, notaRidotte=nota_ridotte,
                 base="capitale" if base_cap else "rischio", rr=rr)


def re_test(sym: str) -> bool:
    import re
    return bool(re.search(CRIPTI, str(sym or ''), re.I))


CAMPI_CONFRONTO = [
    "side", "entry", "sl", "tp", "n", "lotti", "pct", "importoTot",
    "rischioReale", "pendente", "kind", "slCalcolato", "tpCalcolato",
    "notaEntrata", "notaRidotte", "base", "rr"
]


def campi_confronto(piano: Piano) -> Dict[str, Any]:
    """Gli stessi campi, nella stessa forma, che misura_pagina.mjs scrive per la pagina.

    Quando il piano e' un RIFIUTO la pagina restituisce {problemi:[...]} e nient'altro: tutti
    gli altri campi sono assenti, e misurarli coi valori predefiniti del dataclass direbbe
    "la pagina non ha lotti, il ponte ha 0" - una differenza che non esiste.
    """
    if piano.problemi:
        return {c: None for c in CAMPI_CONFRONTO} | {"problemi": list(piano.problemi)}
    return {c: getattr(piano, c) for c in CAMPI_CONFRONTO} | {"problemi": []}
