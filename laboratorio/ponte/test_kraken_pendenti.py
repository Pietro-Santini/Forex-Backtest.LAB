"""Ordini pendenti Kraken tenuti dal ponte (kraken_ordini.py): creazione, scatto, annullamenti."""
import pytest
from fastapi import HTTPException

import _percorsi  # noqa: F401
import kraken_ordini as k


class Finto:
    conto_id = "conto-2"
    prezzo = 100.0

    def strumento(self, s):
        return {"tick": 0.1, "step": 0.001, "min": 0.001}

    def chiama(self, metodo, percorso, *a, **kw):
        assert percorso == "/api/v3/tickers"
        return {"tickers": [{"symbol": "PF_SOLUSD", "markPrice": self.prezzo}]}


@pytest.fixture
def ponte(monkeypatch, tmp_path):
    f = Finto()
    aperti = []
    monkeypatch.setattr(k, "FILE_PENDENTI", str(tmp_path / "pendenti.json"))
    monkeypatch.setattr(k, "CARTELLA", str(tmp_path))
    monkeypatch.setattr(k, "_cliente", lambda: f)

    def apri(c, corpo):
        aperti.append(corpo)
        return {"ok": True, "simbolo": corpo.simbolo, "quantita": corpo.quantita_per_tp * max(1, len(corpo.tp)),
                "entrata": f.prezzo, "sl": {"id": "s1"}, "tp": []}
    monkeypatch.setattr(k, "_apri", apri)
    return f, aperti


def nuovo(**kw):
    base = dict(simbolo="PF_SOLUSD", lato="BUY", tipo="LIMIT", entrata=95, sl=90, tp=[110], quantita=1)
    base.update(kw)
    return k.nuovo_pendente(k.Pendente(**base))["pendente"]


def stati():
    return {o["id"]: (o["stato"], o.get("motivo", "")) for o in k.pendenti()["pendenti"]}


def test_limit_buy_scatta_solo_all_entrata(ponte):
    f, aperti = ponte
    o = nuovo(gruppo="pdA")
    assert k.controlla_pendenti() == 0
    f.prezzo = 95.0
    assert k.controlla_pendenti() == 1
    assert [a.gruppo for a in aperti] == ["pdA"] and aperti[0].quantita_per_tp == 1.0
    assert stati()[o["id"]][0] == "eseguito"


def test_stop_sell_e_id_diversi(ponte):
    f, aperti = ponte
    a = nuovo(gruppo="pdA")
    b = nuovo(lato="SELL", tipo="STOP", entrata=92, sl=97, tp=[80], quantita=0.5, gruppo="pdB")
    assert a["id"] != b["id"]
    f.prezzo = 91.5
    k.controlla_pendenti()
    assert [x.gruppo for x in aperti] == ["pdA", "pdB"]


def test_annullato_non_scatta(ponte):
    f, aperti = ponte
    o = nuovo(tipo="STOP", entrata=120, sl=115, tp=[])
    k.annulla_pendente(k.IdPendente(id=o["id"]))
    f.prezzo = 130
    assert k.controlla_pendenti() == 0 and aperti == []


def test_prezzo_oltre_lo_stop_annulla(ponte):
    f, aperti = ponte
    o = nuovo(lato="SELL", entrata=105, sl=108, tp=[])
    f.prezzo = 109
    k.controlla_pendenti()
    stato, motivo = stati()[o["id"]]
    assert stato == "annullato" and "oltre lo stop" in motivo and aperti == []


def test_stop_dal_lato_sbagliato_rifiutato(ponte):
    with pytest.raises(HTTPException):
        nuovo(sl=99)
