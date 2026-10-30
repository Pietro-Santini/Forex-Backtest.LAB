"""FASE 3 del progetto: la DECISIONE del ponte, congelata contro quella della pagina.

Il terreno di verita' e' piani_pagina.json (laboratorio/confronto/), scritto da misurata_pagina.mjs
chiamando la STESSA funzione con cui la pagina decide quando apri un segnale (tgPiano). Qui si
confronta il port Python (ponte_decide.decida) contro quel file, caso per caso.

Se diventa rosso, una delle due cose:
  - la matematica/la decisione del ponte si e' allontanata da quella della pagina: e' il numero da
    cui esce il lottaggio, quindi e' il rischio che ci si mette;
  - la pagina ha cambiato decisione: va rigenerato piani_pagina.mjs e ci si ferma a guardare
    quale dei due ha ragione, perche' il confronto non si "aggiusta" mai.
"""
import json
import pathlib
import sys

import pytest

QUI = pathlib.Path(__file__).resolve().parents[1] / "confronto"
sys.path.insert(0, str(QUI))

from ponte_decide import decida, campi_confronto  # noqa: E402

RIF = QUI / "piani_pagina.json"
CAMPI = ["side", "entry", "sl", "tp", "n", "lotti", "pct", "importoTot", "rischioReale",
         "pendente", "kind", "slCalcolato", "tpCalcolato", "notaEntrata", "notaRidotte",
         "base", "rr"]
TOLL = 1e-6


def _uguale(a, b) -> bool:
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_uguale(x, y) for x, y in zip(a, b))
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(float(a) - float(b)) <= TOLL
    return a == b


def _casi():
    if not RIF.exists():
        return []
    rif = json.loads(RIF.read_text(encoding="utf-8"))
    per_simbolo = {c["sym"]: c for c in rif.get("configEffettiva", [])}
    predefinito = (rif.get("configEffettiva") or [{}])[0]
    for caso in rif["casi"]:
        ing = caso["ingresso"]
        yield caso["nome"], ing, caso["pagina"], per_simbolo.get(ing["sym"], predefinito)


def test_la_pagina_ha_lasciato_un_terreno_di_verita():
    """Senza il file non c'e' nulla da confrontare: meglio dirlo che far passare un test
    che non misura niente."""
    assert RIF.exists(), (
        "manca laboratorio/confronto/piani_pagina.json: lancia  node laboratorio/confronto/misura_pagina.mjs")


@pytest.mark.parametrize("nome", [c[0] for c in _casi()] or ["nessun caso"])
def test_il_ponte_decide_come_la_pagina(nome):
    for n, ing, atteso, cfg in _casi():
        if n != nome:
            continue
        ottenuto = campi_confronto(decida(
            ing["seg"], ing["sym"], ing["prezzo"], cfg,
            pct_forzata=ing.get("pctForzata"), prezzo_scelto=ing.get("prezzoScelto"),
        ))
        diversi = [c for c in CAMPI + ["problemi"] if not _uguale(atteso.get(c), ottenuto.get(c))]
        assert not diversi, f"{n}: campi diversi {diversi} - atteso {[(c, atteso.get(c)) for c in diversi]} ottenuto {[(c, ottenuto.get(c)) for c in diversi]}"
        return
    pytest.skip(f"caso {nome} non trovato")


def test_i_rifiuti_dicono_la_stessa_cosa():
    """Il motivo del rifiuto e' il messaggio che l'utente legge: due motivi diversi lo mandano
    a cercare un errore che non c'e'. Si confrontano parola per parola, numeri formattati
    compresi (tgFmt)."""
    rif = json.loads(RIF.read_text(encoding="utf-8"))
    per_simbolo = {c["sym"]: c for c in rif.get("configEffettiva", [])}
    for caso in rif["casi"]:
        attesi = caso["pagina"].get("problemi") or []
        if not attesi:
            continue
        ing = caso["ingresso"]
        ottenuti = decida(ing["seg"], ing["sym"], ing["prezzo"], per_simbolo.get(ing["sym"], {}),
                          pct_forzata=ing.get("pctForzata"), prezzo_scelto=ing.get("prezzoScelto")).problemi
        assert ottenuti == attesi, f"{caso['nome']}: motivo diverso\n  atteso: {attesi}\n  ottenuto: {ottenuti}"