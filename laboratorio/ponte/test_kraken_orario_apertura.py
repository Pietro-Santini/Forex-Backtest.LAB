"""QUANDO E' STATA APERTA UNA POSIZIONE KRAKEN: il numero deve arrivare fino all'app.

SEGNALATO dal proprietario, due volte. La prima: «ho aperto una posizione su Kraken alle ore 22,
sono andato a riaprire il grafico e la posizione me l'ha messa alle 19.20». La seconda, il 21
ottobre: «le posizioni le apre tranquillamente, e' solo il discorso della data di apertura che va
risolto».

LA CATENA, e basta che si rompa un anello perche' l'app debba indovinare:

    simulatore            il momento dell'apertura, in millisecondi, nel campo "aperta"
      -> _iso_apertura()  diventa ISO 8601 col nome di Kraken vero: "fillTime"
      -> bridge _ms_iso() torna millisecondi nel campo "aperta_ms"
      -> app              krakenOrarioApertoMs() lo preferisce a tutto (e' un fatto)

Se "aperta_ms" arriva vuoto l'app ripiega sull'anagrafica, cioe' su QUANDO HA VISTO la posizione
la prima volta - ed e' esattamente cosi' che una posizione aperta alle 22 finisce alle 19:20:
non e' un orario sbagliato, e' l'orario di un altro evento.

Questi test misurano la catena intera sul simulatore, perche' e' il conto che il proprietario usa.
"""
import os
import tempfile
import time

import _percorsi  # noqa: F401
import kraken_simulato as ks

ks.OGNI_S = 3600   # niente ciclo automatico durante la prova


def nuovo(prezzo=80500.0):
    sim = ks.Simulatore(os.path.join(tempfile.mkdtemp(), "s.json"))
    sim.ferma()
    sim.s = ks.Simulatore.stato_nuovo(100000, 10)
    sim._tickers = {"PF_XBTUSD": {"symbol": "PF_XBTUSD", "last": prezzo, "markPrice": prezzo,
                                  "bid": prezzo - 0.5, "ask": prezzo + 0.5}}
    sim._aggiorna_prezzi = lambda forza=False: None
    sim.strumento = lambda s: {"simbolo": s, "step": 0.0001, "min": 0.0001, "tick": 0.5}
    return sim


def _ms_iso(v):
    """La stessa lettura che fa il ponte (kraken_ordini._ms_iso), copiata qui per non importare
    tutto il modulo (che su questo banco pretende MetaTrader5 e pywinauto)."""
    if not v:
        return None
    t = str(v).strip().replace("Z", "+00:00")
    try:
        from datetime import datetime
        return datetime.fromisoformat(t).timestamp() * 1000.0
    except Exception:
        return None


def test_l_orario_di_apertura_arriva_fino_in_fondo():
    sim = nuovo()
    prima = time.time() * 1000.0
    sim.chiama("POST", "/api/v3/sendorder", {"symbol": "PF_XBTUSD", "side": "buy", "size": 0.5, "orderType": "mkt"})
    dopo = time.time() * 1000.0

    r = sim._api("/api/v3/openpositions", {})
    pos = r["openPositions"]
    assert len(pos) == 1, "la posizione deve esserci"
    fill = pos[0].get("fillTime")
    assert fill, "senza fillTime l'app non sa quando e' stata aperta e ripiega su quando l'ha vista"

    ms = _ms_iso(fill)
    assert ms is not None, "il ponte deve saper rileggere il formato che il simulatore scrive: %r" % fill
    # Un secondo di tolleranza: il formato ISO del simulatore non porta i millisecondi.
    assert prima - 1000 <= ms <= dopo + 1000, (
        "l'orario deve essere quello dell'apertura (atteso fra %.0f e %.0f, trovato %.0f)" % (prima, dopo, ms))


def test_l_orario_non_cambia_quando_si_aggiunge_alla_stessa_posizione():
    """Mediare NON e' aprire una posizione nuova: l'orario deve restare quello della PRIMA.
    Se si spostasse, la freccia a grafico salterebbe in avanti ogni volta che si aggiunge."""
    sim = nuovo()
    sim.chiama("POST", "/api/v3/sendorder", {"symbol": "PF_XBTUSD", "side": "buy", "size": 0.5, "orderType": "mkt"})
    primo = _ms_iso(sim._api("/api/v3/openpositions", {})["openPositions"][0]["fillTime"])
    time.sleep(1.1)
    sim.chiama("POST", "/api/v3/sendorder", {"symbol": "PF_XBTUSD", "side": "buy", "size": 0.5, "orderType": "mkt"})
    dopo = _ms_iso(sim._api("/api/v3/openpositions", {})["openPositions"][0]["fillTime"])
    assert primo == dopo, ("aggiungendo alla stessa posizione l'orario di apertura non si tocca: "
                           "%.0f -> %.0f" % (primo, dopo))


def test_una_posizione_girata_e_una_posizione_nuova():
    """Se si vende piu' di quanto si aveva, la posizione si CAPOVOLGE: quella e' nuova, e l'orario
    deve ripartire. Altrimenti una posizione aperta adesso verrebbe disegnata ore indietro."""
    sim = nuovo()
    sim.chiama("POST", "/api/v3/sendorder", {"symbol": "PF_XBTUSD", "side": "buy", "size": 0.5, "orderType": "mkt"})
    primo = _ms_iso(sim._api("/api/v3/openpositions", {})["openPositions"][0]["fillTime"])
    time.sleep(1.1)
    sim.chiama("POST", "/api/v3/sendorder", {"symbol": "PF_XBTUSD", "side": "sell", "size": 1.5, "orderType": "mkt"})   # 0,5 long -> 1,0 short
    p = sim._api("/api/v3/openpositions", {})["openPositions"][0]
    assert p["side"] == "short", "la posizione deve essersi capovolta"
    nuovo_ms = _ms_iso(p["fillTime"])
    assert nuovo_ms > primo, ("una posizione capovolta e' una posizione nuova: l'orario deve "
                              "ripartire (%.0f -> %.0f)" % (primo, nuovo_ms))


def test_una_posizione_vecchia_senza_orario_non_inventa_niente():
    """Le posizioni aperte PRIMA che questo campo esistesse non hanno "aperta". Li' il ponte deve
    rispondere «non lo so» (None), non un orario qualunque: l'app ha gia' il modo di dirlo a mano
    (la cella «Eseguita»), ma solo se nessuno le ha mentito prima."""
    sim = nuovo()
    sim.chiama("POST", "/api/v3/sendorder", {"symbol": "PF_XBTUSD", "side": "buy", "size": 0.5, "orderType": "mkt"})
    sim.s["posizioni"]["PF_XBTUSD"].pop("aperta", None)    # com'era prima della v152
    fill = sim._api("/api/v3/openpositions", {})["openPositions"][0]["fillTime"]
    assert fill is None, "senza l'orario vero si risponde None, non un orario inventato: %r" % fill
    assert _ms_iso(fill) is None
