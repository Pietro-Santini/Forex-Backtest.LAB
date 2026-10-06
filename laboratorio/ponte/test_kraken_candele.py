"""Conto Kraken simulato: TP e SL controllati sulle candele da 1 minuto (kraken_simulato.py)."""
import os
import tempfile
import time

import _percorsi  # noqa: F401
import kraken_simulato as ks

ks.OGNI_S = 3600   # niente ciclo automatico durante la prova
M = 60000


def nuovo(trade, mark=None, prezzo=80500.0):
    sim = ks.Simulatore(os.path.join(tempfile.mkdtemp(), "s.json"))
    sim.ferma()
    sim.s = ks.Simulatore.stato_nuovo(100000, 10)
    sim._tickers = {"PF_XBTUSD": {"symbol": "PF_XBTUSD", "last": prezzo, "markPrice": prezzo, "bid": prezzo - 0.5, "ask": prezzo + 0.5}}
    sim._aggiorna_prezzi = lambda forza=False: None
    sim.strumento = lambda s: {"simbolo": s, "step": 0.0001, "min": 0.0001, "tick": 0.5}
    sim._candele = lambda tipo, sym, da, a: [c for c in (mark if (tipo == "mark" and mark is not None) else trade) if da <= c[0] < a]
    return sim


def apri(sim, t0):
    o = lambda **p: sim.chiama("POST", "/api/v3/sendorder", p)
    o(orderType="mkt", symbol="PF_XBTUSD", side="buy", size="0.2", cliOrdId="fbl_x_in")
    o(orderType="stp", symbol="PF_XBTUSD", side="sell", size="0.2", stopPrice="79000", reduceOnly="true", cliOrdId="fbl_x_sl")
    o(orderType="lmt", symbol="PF_XBTUSD", side="sell", size="0.1", limitPrice="81000", reduceOnly="true", cliOrdId="fbl_x_tp1")
    o(orderType="lmt", symbol="PF_XBTUSD", side="sell", size="0.1", limitPrice="82000", reduceOnly="true", cliOrdId="fbl_x_tp2")
    for x in sim.s["ordini"]:
        x["ts"] = t0


def esiti(sim):
    return [(x["tipo"], float(x["prezzo"]), x["quantita"], x["cliOrdId"]) for x in sim.s["storico"]][1:]


ORA = int(time.time() * 1000) // M * M
T0 = ORA - 10 * M + 5000   # ordini nati 10 minuti fa


def test_tp1_con_stoppino_poi_stop():
    s = nuovo([(ORA - 9 * M, 80500, 81200, 80400), (ORA - 8 * M, 80400, 80600, 80300), (ORA - 7 * M, 80000, 80100, 78900)])
    apri(s, T0); s._controlla_candele()
    assert esiti(s) == [("take profit", 81000.0, 0.1, "fbl_x_tp1"), ("stop", 79000.0, 0.1, "fbl_x_sl")]
    assert s.s["ordini"] == [] and s.s["posizioni"] == {}


def test_stop_e_tp_nella_stessa_candela_prima_lo_stop():
    s = nuovo([(ORA - 9 * M, 80500, 81500, 78800)]); apri(s, T0); s._controlla_candele()
    assert esiti(s) == [("stop", 79000.0, 0.2, "fbl_x_sl")]


def test_apertura_gia_oltre_lo_stop_esegue_all_apertura():
    s = nuovo([(ORA - 9 * M, 78500, 78700, 78300)]); apri(s, T0); s._controlla_candele()
    assert esiti(s) == [("stop", 78500.0, 0.2, "fbl_x_sl")]


def test_stoppino_del_minuto_di_nascita_ignorato():
    s = nuovo([(T0 // M * M, 80500, 85000, 75000)]); apri(s, T0); s._controlla_candele()
    assert esiti(s) == [] and len(s.s["ordini"]) == 3


def test_stop_guarda_il_mark_non_lo_scambio():
    s = nuovo([(ORA - 9 * M, 80000, 80100, 78900)], [(ORA - 9 * M, 80000, 80050, 79200)]); apri(s, T0); s._controlla_candele()
    assert esiti(s) == [] and len(s.s["ordini"]) == 3


def test_candele_non_disponibili_nessun_errore():
    s = nuovo([])
    s._candele = lambda *a: (_ for _ in ()).throw(ks.ErroreSim("giu"))
    apri(s, T0); s._controlla_candele()
    assert len(s.s["ordini"]) == 3
