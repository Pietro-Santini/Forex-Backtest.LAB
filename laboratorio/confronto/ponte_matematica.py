"""FASE 2 del progetto: la matematica del PREZZO in Python.

Cosa si porta, e perche' e' la fase giusta per prima: questa matematica e' PICCOLA, NON ha
opinioni (una distanza per un lotto e' una distanza per un lotto) e ha una sola fonte di verita'
contabile: il symbol_info di MT5, che il ponte ha gia'. Se questa non da' gli stessi numeri
della pagina, niente di cio' che viene dopo (la decisione) potra' darli.

Le formule sono COPIA di app.html, non reinterpretazioni:
  - calculateForexPL  (riga 19891): (uscita-entrata) * unita contratto * lotti; se la valuta base
    e' quella del conto, si divide per il prezzo di uscita.
  - marginForLots     (riga 19976): nozionale / leva. Il nozionale e' lots*size se la valuta base
    e' quella del conto, altrimenti lots*size*prezzo.
  - pipSizeForAsset   (riga 14159): 10^-pipDigit, con pipDigit da INSTRUMENTS, oppure ricavato
    dai decimali (penultima cifra, riga 19706), col tetto a 8 cifre.

Come si prova: confronta_matematica.py la misura contro matematica_pagina.json, che
misura_pagina.mjs scrive chiamando le funzioni della pagina per gli stessi simboli e le stesse
combinazioni. Finche' un numero differisce, la matematica del ponte non e' quella della pagina.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

# ---- la tabella, COPIATA da app.html (riga 19526). Una sola sorgente di verita' in due linguaggi:
# ---- se una delle due cambia, il confronto deve diventare rosso e.dirvi quale delle due ha ragione.
INSTRUMENTS: Dict[str, dict] = {
    "EURUSD": {"label": "EUR/USD", "decimals": 5, "pipDigit": 4, "contractSize": 100000, "plMode": "baseEqualsAccount"},
    "GBPUSD": {"label": "GBP/USD", "decimals": 5, "pipDigit": 4, "contractSize": 100000, "plMode": "approx"},
    "USDJPY": {"label": "USD/JPY", "decimals": 3, "pipDigit": 2, "contractSize": 100000, "plMode": "approx"},
    "XAUUSD": {"label": "XAU/USD (Oro)", "decimals": 2, "pipDigit": 1, "contractSize": 100, "plMode": "approx"},
    "XAGUSD": {"label": "XAG/USD (Argento)", "decimals": 3, "pipDigit": 2, "contractSize": 5000, "plMode": "approx"},
    "custom": {"label": "Personalizzato", "decimals": None, "pipDigit": None, "contractSize": 100000, "plMode": "approx"},
}

# I simboli fuori tabella, coi metadati ricavati dal broker (assetAutoMeta lato pagina). Qui la
# stessa informazione, nella forma che il ponte ha dentro: symbol_info di MT5.
# VUOTO di proposito: senza broker collegato la pagina NON ha questi dati, e confrontare con una
# tabella inventata qui significherebbe misurare la mia immaginazione invece del suo comportamento.
META_AUTO: Dict[str, dict] = {}

# Leva: la pagina la legge dal menu a tendina #leverage (opzioni 10/20/30/50/100/200/500) e il
# valore selezionato oggi è 100. getLeverage() ricade su 30 solo se la casella è vuota.
LEVA_PREDEFINITA = 100.0


@dataclass(frozen=True)
class Strumento:
    decimals: Optional[int]
    pipDigit: Optional[int]
    contractSize: float
    plMode: str
    leverage: float
    fonte: str  # da dove viene: 'tabella', 'broker', 'ricaduta'

    @property
    def base_equals_account(self) -> bool:
        return self.plMode == "baseEqualsAccount"


def _pip_digit_for_decimals(dec) -> Optional[int]:
    """penultima cifra decimale (riga 19706 di app.html)."""
    if dec is None:
        return None
    try:
        dec = int(dec)
    except (TypeError, ValueError):
        return None
    return max(0, dec - 1)


def _cripto(asset_key: str) -> bool:
    k = str(asset_key or '')
    return k.startswith('BINANCE:') or k.startswith('KRAKEN:')


def strumento(asset_key: str, meta_auto: Optional[dict] = None,
              leva: float = LEVA_PREDEFINITA) -> Strumento:
    """currentInstrument(assetKey) di app.html (riga 19792), copia fedele e ordine incluso:

      1. la tabella scritta a mano (INSTRUMENTS);
      2. i metadati REALI del broker (assetAutoMeta / symbol_info);
      3. in mancanza di entrambi: **INSTRUMENTS.EURUSD**, in silenzio.

    Il punto 3 e' un difetto che questo confronto ha tirato fuori (30 ottobre 2026): un simbolo
    che il broker non ha ancora descritto viene trattato come EUR/USD - contratto da 100.000 e
    valuta base = valuta del conto - quindi una cripto senza metadati risulta con un contratto
    100.000 volte troppo grande. Viene copiato tale e quale per rendere il confronto verde; la
    cura va fatta nei DUE linguaggi insieme, o il confronto tornerebbe rosso.
    """
    k = asset_key or ""
    if k in INSTRUMENTS:
        i = INSTRUMENTS[k]
        return Strumento(i.get("decimals"), i.get("pipDigit"),
                         float(i.get("contractSize") or 100000),
                         str(i.get("plMode") or "approx"), float(leva), "tabella")

    auto = dict(META_AUTO.get(k, {}))
    if meta_auto:
        auto.update({kk: vv for kk, vv in meta_auto.items() if vv is not None})

    if auto.get("decimals") is not None and auto.get("pipDigit") is not None:
        cs = auto.get("contractSize")
        if not (isinstance(cs, (int, float)) and cs > 0):
            cs = 1 if _cripto(k) else 100000
        return Strumento(auto.get("decimals"), auto.get("pipDigit"), float(cs), "approx",
                         float(auto.get("leverage") or leva), "broker")

    i = INSTRUMENTS["EURUSD"]
    return Strumento(i.get("decimals"), i.get("pipDigit"),
                     float(i.get("contractSize") or 100000),
                     str(i.get("plMode") or "approx"), float(leva), "ricaduta")



def pip_size(asset_key: str, meta_auto: Optional[dict] = None) -> float:
    """pipSizeForAsset (riga 14159): 10^-pipDigit, col tetto a 8 cifre."""
    i = strumento(asset_key, meta_auto)
    d = i.pipDigit
    if d is None:
        return 1e-1
    d = max(0, min(8, int(d)))
    return 10.0 ** (-d)


def contract_size(asset_key: str, meta_auto: Optional[dict] = None) -> float:
    i = strumento(asset_key, meta_auto)
    return i.contractSize or 100000.0


def calculate_forex_pl(side: str, entry: float, exit_: float, lots: float,
                       asset_key: str, meta_auto: Optional[dict] = None) -> float:
    """calculateForexPL (riga 19891)."""
    i = strumento(asset_key, meta_auto)
    size = contract_size(asset_key, meta_auto)
    raw = (exit_ - entry if str(side).upper() == "BUY" else entry - exit_) * size * lots
    if i.base_equals_account:
        return raw / (float(exit_) or 1.0)
    return raw


def euro_at_level(entry: float, level: float, lots: float,
                  asset_key: str, meta_auto: Optional[dict] = None) -> float:
    """euroAtLevel: il valore ASSOLUTO, il segno lo mette chi usa."""
    return abs(calculate_forex_pl("BUY", entry, level, lots, asset_key, meta_auto))


def margin_for_lots(lots: float, price: float, asset_key: str,
                    meta_auto: Optional[dict] = None) -> float:
    """marginForLots (riga 19976): nozionale / leva."""
    i = strumento(asset_key, meta_auto)
    size = contract_size(asset_key, meta_auto)
    if i.base_equals_account:
        notional = lots * size
    else:
        notional = lots * size * (float(price) or 0.0)
    return notional / (i.leverage or 30.0)


def tabella_confronto(simboli: List[str], combinazioni: List[dict]) -> List[dict]:
    """Gli stessi numeri, nella stessa forma, per il confronto con la pagina."""
    righe = []
    for sym in simboli:
        s = {
            "sym": sym,
            "pipDigit": strumento(sym).pipDigit,
            "pipSize": pip_size(sym),
            "contractSize": contract_size(sym),
            "plMode": strumento(sym).plMode,
            "casi": [],
        }
        for c in combinazioni:
            side = c["side"]
            entry = c["entry"]
            exit_ = c["exit"]
            lots = c["lots"]
            s["casi"].append({
                "ingresso": {"side": side, "entry": entry, "exit": exit_, "lots": lots},
                "pl": calculate_forex_pl(side, entry, exit_, lots, sym),
                "euroAtLevel": euro_at_level(entry, exit_, lots, sym),
                "margin": margin_for_lots(lots, entry, sym),
            })
        righe.append(s)
    return righe
