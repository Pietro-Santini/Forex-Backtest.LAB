"""CONFRONTO PAGINA <-> PONTE: il lato ponte.

Qued está la decisione che il ponte DOVRA' avere. Oggi non c'e': questo file è lo scheletro
su cui si porta la matematica di app.html (tgPiano), e confronta.py lo misura contro
piani_pagina.json.

Come si riempie, in ordine (ogni passo ha il suo test):
  1. la matematica del prezzo: pip size, valore di un lotto, margine. Dal symbol_info di MT5,
     che il ponte ha gia'. Stessi numeri della pagina.
  2. le regole sui livelli: qual e' il target "n.1" (ordine di arrivo), quali scartare perche'
     il prezzo li ha gia' passati, qual e' la distanza massima per cui un numero e' ancora un
     prezzo (oggi 1% sull'entrata, 3% sulle cripto, 100% sullo stop).
  3. il lottaggio: importoTot = saldo * pct / 100; lotti = floor(importoTot / perUnita / passo).
     Arrotondato PER DIFETTO, mai per eccesso: la percentuale e' un tetto.
  4. le quote dei target (quote della sala), col controllo del minimo.
  5. lo stop calcolato, quando la sala non lo da'.

La regola del confronto (scritta anche in casi.json): numeri IDENTICI alla pagina. Quando uno
differisce ci si FERMA e si capisce quale dei due ha ragione. Non si aggiusta un numero per far
chiudere il confronto.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional


@dataclass
class Piano:
    """Il risultato della decisione. Stessi nomi della pagina, cosi' il confronto è campo a campo."""
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


def decida(seg: Dict[str, Any], sym: str, prezzo: float, cfg: Dict[str, Any],
           pct_forzata: Optional[float] = None, prezzo_scelto: Optional[float] = None) -> Piano:
    """La decisione del ponte. OGGI NON DECIDE: restituisce un piano vuoto con il motivo.

    È la verità misurata: bridge.py non ha una sola funzione di rischio. Questo segnaposto
    serve a far girare il confronto e a farlo dire "ponte: assente" - cioè a dimostrare, con
    numeri, che la decisione sta tutta nella pagina.
    """
    return Piano(
        problemi=["il ponte non decide ancora: la decisione e' nella pagina (app.html, tgPiano)"]
    )


def campi_confronto(piano: Piano) -> Dict[str, Any]:
    """Gli stessi campi, nella stessa forma, che misura_pagina.mjs scrive per la pagina."""
    return asdict(piano)
