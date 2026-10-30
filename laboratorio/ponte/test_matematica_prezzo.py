"""FASE 2 del progetto: la matematica del prezzo del ponte, congelata contro quella della pagina.

I numeri qui sotto sono MISURATI, non scelti a mano: vengono da app.html
(pipSizeForAsset / calculateForexPL / euroAtLevel / marginForLots), confronto del 30 ottobre 2026.
Se cambia uno solo di questi numeri vuol dire che la matematica del ponte si è allontanata da
quella della pagina - ed è la cosa da non far succedere, perché è il numero da cui esce il
lottaggio, quindi è il rischio che ci si mette.

ATTENZIONE, e va letta: per i simboli che il broker non ha ancora descritto la pagina RICADE su
EUR/USD (currentInstrument, riga 19792). Per BINANCE:BTCUSDT il contratto esce perciò 100.000 e
non 1. Quel numero è preso tale quale, di proposito: prima si dimostra che i due linguaggi fanno
la stessa cosa, poi si cura il difetto in ENTRAMBI. Se cambi qui sotto solo il BTC per farlo
"più giusto", il confronto con la pagina torna rosso e non si capisce più chi ha ragione.
"""
import pathlib
import sys

import pytest

QUI = pathlib.Path(__file__).resolve().parents[1] / "confronto"
sys.path.insert(0, str(QUI))

import ponte_matematica as pm  # noqa: E402

# (simbolo, pipDigit, pipSize, contractSize, plMode, [P/L per le 4 combinazioni], [margine])
COMBINAZIONI = [
    {"side": "BUY", "entry": 1.09850, "exit": 1.10500, "lots": 0.10},
    {"side": "SELL", "entry": 1.09850, "exit": 1.09200, "lots": 0.50},
    {"side": "BUY", "entry": 4020.00, "exit": 4060.00, "lots": 0.02},
    {"side": "SELL", "entry": 4020.00, "exit": 4000.00, "lots": 0.01},
]

MISURATO = [
    ("EURUSD", 4, 0.0001, 100000, "baseEqualsAccount", [58.823529, 297.619048, 19.704433, 5], [100, 500, 20, 10]),
    ("GBPUSD", 4, 0.0001, 100000, "approx", [65.0, 325.0, 80000, 20000], [109.85, 549.25, 80400, 40200]),
    ("USDJPY", 2, 0.01, 100000, "approx", [65.0, 325.0, 80000, 20000], [109.85, 549.25, 80400, 40200]),
    ("XAUUSD", 1, 0.1, 100, "approx", [0.065, 0.325, 80, 20], [0.10985, 0.54925, 80.4, 40.2]),
    ("XAGUSD", 2, 0.01, 5000, "approx", [3.25, 16.25, 4000, 1000], [5.4925, 27.4625, 4020, 2010]),
    ("NZDCAD", 4, 0.0001, 100000, "baseEqualsAccount", [58.823529, 297.619048, 19.704433, 5], [100, 500, 20, 10]),
    ("AUDUSD", 4, 0.0001, 100000, "baseEqualsAccount", [58.823529, 297.619048, 19.704433, 5], [100, 500, 20, 10]),
    ("EURCHF", 4, 0.0001, 100000, "baseEqualsAccount", [58.823529, 297.619048, 19.704433, 5], [100, 500, 20, 10]),
    ("BINANCE:BTCUSDT", 4, 0.0001, 100000, "baseEqualsAccount", [58.823529, 297.619048, 19.704433, 5], [100, 500, 20, 10]),
]

TOLL = 1e-6


def test_pip_e_contratto_sono_quelli_della_pagina():
    for sym, pip_digit, pip_size, contratto, pl_mode, _pl, _mg in MISURATO:
        i = pm.strumento(sym)
        assert i.pipDigit == pip_digit, f"{sym}: pipDigit"
        assert pm.pip_size(sym) == pytest.approx(pip_size, abs=TOLL), f"{sym}: pipSize"
        assert pm.contract_size(sym) == pytest.approx(contratto, abs=TOLL), f"{sym}: contractSize"
        assert i.plMode == pl_mode, f"{sym}: plMode"


def test_profitto_e_margine_sono_quelli_della_pagina():
    for sym, _pd, _ps, _cs, _pm, pl_atteso, mg_atteso in MISURATO:
        for c, atteso_pl, atteso_mg in zip(COMBINAZIONI, pl_atteso, mg_atteso):
            pl = pm.calculate_forex_pl(c["side"], c["entry"], c["exit"], c["lots"], sym)
            mg = pm.margin_for_lots(c["lots"], c["entry"], sym)
            euro = pm.euro_at_level(c["entry"], c["exit"], c["lots"], sym)
            assert pl == pytest.approx(atteso_pl, abs=TOLL), f"{sym} {c['side']} P/L"
            assert mg == pytest.approx(atteso_mg, abs=TOLL), f"{sym} {c['side']} margine"
            assert euro == pytest.approx(abs(atteso_pl), abs=TOLL), f"{sym} {c['side']} euroAtLevel"


def test_il_ricaduta_su_eurusd_dice_da_dove_viene():
    """Il difetto trovato dal confronto, inchiodato: senza metadati del broker, un simbolo
    sconosciuto viene trattato come EUR/USD. Il test deve diventare ROSSO quando lo si cura,
    perche' allora il confronto con la pagina va rifatto in tutti e due i linguaggi."""
    assert pm.strumento("NZDCAD").fonte == "ricaduta"
    assert pm.strumento("BINANCE:BTCUSDT").fonte == "ricaduta"
    assert pm.strumento("BINANCE:BTCUSDT").contractSize == 100000
    assert pm.strumento("EURUSD").fonte == "tabella"


def test_i_metadati_del_broker_vincono_sul_ricaduta():
    """Quando il broker descrive il simbolo, la pagina usa QUEI dati. Stessa cosa qui."""
    meta = {"decimals": 2, "pipDigit": 1, "contractSize": 1, "leverage": 2}
    i = pm.strumento("BINANCE:BTCUSDT", meta)
    assert i.fonte == "broker"
    assert i.contractSize == 1
    assert i.leverage == 2
    assert pm.margin_for_lots(0.01, 100000, "BINANCE:BTCUSDT", meta) == pytest.approx(500.0, abs=TOLL)