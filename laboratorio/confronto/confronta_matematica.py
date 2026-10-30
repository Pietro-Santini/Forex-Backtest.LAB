"""CONFRONTO della matematica del prezzo: pagina vs ponte.

Uso:
    python laboratorio/confronto/confronta_matematica.py

Confronta, per ogni simbolo e ogni combinazione, i numeri che la pagina produce
(pipSizeForAsset / calculateForexPL / euroAtLevel / marginForLots, scritti in
piani_pagina.json da misura_pagina.mjs) con quelli che il port Python calcola da solo.

Esce:
    0  tutti i numeri identici
    1  almeno un numero diverso (e stampa quale e di quanto)

Questa e' la FASE 2 del progetto: finche' qui non e' verde, portare la decisione nel ponte
sarebbe portare numeri sbagliati.
"""
from __future__ import annotations

import json
import pathlib
import sys

QUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(QUI))

import ponte_matematica as pm  # noqa: E402

RIF = QUI / "piani_pagina.json"
TOLL = 1e-6


def num(v):
    """Stessa forma dei numeri nel confronto: arrotondati alla 8a cifra."""
    return None if v is None else round(float(v), 8)


def main() -> int:
    rif = json.loads(RIF.read_text(encoding="utf-8"))
    mat = rif.get("matematica")
    if not mat:
        print("piani_pagina.json non ha la sezione 'matematica': rilancia  node laboratorio/confronto/misura_pagina.mjs")
        return 2

    differenze = []
    controllo = 0

    for riga_pagina in mat["righe"]:
        sym = riga_pagina["sym"]
        riga_ponte = {r["sym"]: r for r in pm.tabella_confronto(
            [sym], mat["combinazioni"])}[sym]

        for campo in ("pipDigit", "pipSize", "contractSize", "plMode"):
            controllo += 1
            a, b = riga_pagina.get(campo), riga_ponte.get(campo)
            if isinstance(a, float) or isinstance(b, float):
                if a is None or b is None:
                    ok = a is None and b is None
                else:
                    ok = abs(float(a) - float(b)) <= TOLL
            else:
                ok = a == b
            if not ok:
                differenze.append((sym, campo, a, b, None))

        for c_pag, c_ponte in zip(riga_pagina["casi"], riga_ponte["casi"]):
            ing = c_pag["ingresso"]
            for campo in ("pl", "euroAtLevel", "margin"):
                controllo += 1
                a, b = num(c_pag.get(campo)), num(c_ponte.get(campo))
                if a is None or b is None:
                    ok = a is None and b is None
                else:
                    ok = abs(a - b) <= TOLL
                if not ok:
                    differenze.append((sym, campo, a, b, ing))

    print("confronto matematica del prezzo: PAGINA (app.html) vs PONTE (ponte_matematica.py)")
    print(f"simboli: {len(mat['righe'])}   combinazioni per simbolo: {len(mat['combinazioni'])}   numeri confrontati: {controllo}")
    print()
    if not differenze:
        print("TUTTI I NUMERI IDENTICI. La matematica del prezzo del ponte e' quella della pagina.")
        print("Questo e' il permesso per la fase 3: portare la decisione.")
        return 0

    print(f"{len(differenze)} numeri diversi:")
    for sym, campo, a, b, ing in differenze[:40]:
        dove = f"  [{ing}]" if ing else ""
        print(f"  {sym:<16} .{campo:<13} pagina={a!r:<22} ponte={b!r:<22}{dove}")
    if len(differenze) > 40:
        print(f"  ... e altri {len(differenze) - 40}")
    print()
    print("significato: la matematica del ponte non e' quella della pagina. Non e' un dettaglio di forma:")
    print("e' il numero da cui esce il lottaggio, quindi e' il rischio che ci si mette.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
