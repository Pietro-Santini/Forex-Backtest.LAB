"""CONFRONTO: la decisione del ponte contro quella della pagina, caso per caso.

Uso:
    python laboratorio/confronto/confronta.py

Legge piani_pagina.json (scritto da misura_pagina.mjs: la verita' di riferimento) e affianca
il piano del ponte (ponte_decide.decida) per gli stessi ingressi.

 stampa una tabella e esce:
    0  numeri identici su tutti i casi  (il ponte decide come decide la pagina)
    1  almeno un caso diverso           (e la tabella dice DOVE e di QUANTO)

La regola, scritta anche in casi.json: il confronto deve dare numeri identici. Quando uno
differisce ci si FERMA e si capisce quale dei due ha ragione - non si aggiusta un numero per
far chiudere il confronto.
"""
from __future__ import annotations

import json
import pathlib
import sys

QUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(QUI))

from ponte_decide import decida, campi_confronto  # noqa: E402

RIF = QUI / "piani_pagina.json"
CAMPI = [
    "side", "entry", "sl", "tp", "n", "lotti", "pct", "importoTot",
    "rischioReale", "pendente", "kind", "slCalcolato", "tpCalcolato",
    "notaEntrata", "notaRidotte", "base", "rr", "problemi",
]


def uguale(a, b) -> bool:
    """Confronto campo a campo. I numeri finiscono alla 8a cifra: oltre, la differenza e'
    rumore binario e non una decisione diversa."""
    if isinstance(a, float) or isinstance(b, float):
        if a is None or b is None:
            return a is None and b is None
        return abs(float(a) - float(b)) <= 1e-8
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(uguale(x, y) for x, y in zip(a, b))
    return a == b


def main() -> int:
    if not RIF.exists():
        print("manca piani_pagina.json: lancia prima  node laboratorio/confronto/misura_pagina.mjs")
        return 2
    rif = json.loads(RIF.read_text(encoding="utf-8"))

    # UNA SOLA configurazione, e viene dalla pagina. Quella scritta in casi.json e' un promemoria
    # per l'uomo: se il confronto la usasse, misurerebbe la config di chi ha scritto il file
    # invece di quella con cui l'app decide davvero - ed e' esattamente il difetto che ha fatto
    # segnalare 3 casi "diversi" per una config che la pagina non legge nemmeno.
    per_simbolo = {}
    for c in rif.get("configEffettiva", []):
        per_simbolo[c["sym"]] = c
    cfg_predefinito = rif.get("configEffettiva", [{}])[0] if rif.get("configEffettiva") else {}

    def cfg_di(ing):
        return per_simbolo.get(ing["sym"], cfg_predefinito)

    differenze = 0
    totale = 0
    righe = []

    for caso in rif["casi"]:
        totale += 1
        ing = caso["ingresso"]
        p_pagina = caso["pagina"]

        p_ponte = campi_confronto(decida(
            ing["seg"], ing["sym"], ing["prezzo"], cfg_di(ing),
            pct_forzata=ing.get("pctForzata"), prezzo_scelto=ing.get("prezzoScelto"),
        ))

        diverso = [c for c in CAMPI if not uguale(p_pagina.get(c), p_ponte.get(c))]
        if diverso:
            differenze += 1

        righe.append((caso["nome"], diverso, p_pagina, p_ponte, ing))

    # ---- la tabella ----
    print("confronto decisione: PAGINA (app.html tgPiano) vs PONTE (laboratorio/confronto/ponte_decide.py)")
    print("campi confrontati: " + ", ".join(CAMPI))
    print()
    for nome, diverso, pp, po, ing in righe:
        stato = "IDENTICO" if not diverso else "DIVERSO"
        print(f"[{stato:>8}] {nome}")
        if diverso:
            print("           ingresso: " + json.dumps(ing["seg"], ensure_ascii=False) + f" su {ing['sym']} a {ing['prezzo']}")
            for c in diverso:
                print(f"           .{c:<14} pagina={pp.get(c)!r}  ponte={po.get(c)!r}")
            print()
    print(f"casi: {totale}   identici: {totale - differenze}   diversi: {differenze}")
    if differenze:
        print()
        print("significato: il ponte non sta decidendo come decide la pagina. Finche' e' cosi',")
        print("spostare la decisione nel ponte vuol dire spostare un difetto: si guarda il primo")
        print("campo diverso, si capisce quale dei due ha ragione, e si corregge QUELLO.")
    return 1 if differenze else 0


if __name__ == "__main__":
    raise SystemExit(main())
