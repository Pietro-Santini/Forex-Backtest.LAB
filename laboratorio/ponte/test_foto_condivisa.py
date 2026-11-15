# -*- coding: utf-8 -*-
"""Più finestre che chiedono la stessa cosa nello stesso istante = UNA sola lettura di MT5.

SEGNALATO dal proprietario (voce 9 delle finestre duplicate): «la chiusura è già lenta di suo, e
con duplicate aperte rallenta ancora di più. Le chiusure devono essere istantanee. Le duplicate
non devono rallentare il sistema.»

MISURATO il 15 novembre 2026 con tre pagine vere e un ponte finto che conta le richieste: OGNI
finestra interroga il ponte per conto suo, una volta al secondo, su tre rotte.
    una finestra ..... ~27 letture in 6 secondi
    tre finestre ..... ~83 letture in 6 secondi
Verso il terminale MT5 quelle chiamate sono per natura seriali, quindi una chiusura mandata in
mezzo si accoda dietro le letture delle altre finestre. La pagina NON è lenta: closeTrade()
misura 2,5 ms e non peggiora con le duplicate (misurato: 2,5 / 2,5 / 2,6 ms con 0, 1, 2
duplicate aperte), e il ponte manda un solo ordine al broker.

QUI SI PROVA IL COMPORTAMENTO DELLA CURA:
- tre chiamate ravvicinate fanno UNA sola lettura di MT5;
- passato il tempo di validità si torna a leggere davvero (la fotografia non invecchia per
  sempre);
- dopo un'operazione di trading la fotografia si butta SUBITO, anche se l'operazione è fallita;
- due thread che arrivano insieme non fanno due letture (è il caso vero: tre finestre con lo
  stesso timer da un secondo);
- le rotte che OPERANO non passano dalla fotografia: leggono sempre dal vivo.
"""
import importlib
import os
import sys
import threading
import time
import types

import pytest

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))


class _MT5Finto:
    def __init__(self):
        self.chiamate = 0

    def positions_get(self, *a, **k):
        self.chiamate += 1
        return []

    def __getattr__(self, nome):
        return 0


@pytest.fixture
def ponte(monkeypatch):
    mt5 = _MT5Finto()
    sys.modules["MetaTrader5"] = mt5
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    mod = importlib.import_module("bridge")
    importlib.reload(mod)
    mod._foto_scadi()
    return mod, mt5


def test_tre_finestre_una_sola_lettura(ponte):
    mod, mt5 = ponte
    for _ in range(3):
        mod._foto("positions", mt5.positions_get)
    assert mt5.chiamate == 1, (
        "tre finestre che chiedono le posizioni nello stesso istante devono costare UNA lettura "
        f"di MT5, non tre: ne sono state fatte {mt5.chiamate}"
    )


def test_passato_il_tempo_si_rilegge(ponte):
    # La fotografia non deve invecchiare per sempre: sarebbe peggio del difetto.
    mod, mt5 = ponte
    monkey_ttl = 0.05
    mod._FOTO_TTL = monkey_ttl
    mod._foto("positions", mt5.positions_get)
    time.sleep(monkey_ttl * 3)
    mod._foto("positions", mt5.positions_get)
    assert mt5.chiamate == 2, (
        f"scaduto il tempo di validità si deve tornare a leggere MT5: chiamate {mt5.chiamate}"
    )


def test_dopo_una_operazione_la_foto_si_butta(ponte):
    mod, mt5 = ponte
    mod._foto("positions", mt5.positions_get)
    assert mt5.chiamate == 1
    mod._foto_scadi()
    mod._foto("positions", mt5.positions_get)
    assert mt5.chiamate == 2, (
        "dopo una chiusura (o qualunque operazione) la lettura successiva deve andare a MT5 "
        f"davvero, altrimenti si vedrebbe una posizione già chiusa: chiamate {mt5.chiamate}"
    )


def test_due_thread_insieme_non_fanno_due_letture(ponte):
    # Il caso vero: tre finestre con lo stesso timer da un secondo arrivano insieme.
    mod, mt5 = ponte
    lenta = threading.Event()

    def produci():
        mt5.chiamate += 1
        lenta.wait(0.3)          # finge una lettura MT5 che non è istantanea
        return []

    fatti = []
    def giro():
        mod._foto("positions", produci)
        fatti.append(1)

    t = [threading.Thread(target=giro) for _ in range(3)]
    for x in t:
        x.start()
    time.sleep(0.05)
    lenta.set()
    for x in t:
        x.join(5)
    assert len(fatti) == 3, "tutti e tre devono essere serviti"
    assert mt5.chiamate == 1, (
        "chi arriva mentre la lettura è in corso deve aspettare quella, non farne un'altra: "
        f"letture {mt5.chiamate}"
    )


def test_il_filtro_copre_tutte_le_rotte_che_operano(ponte):
    # La fotografia si butta in un posto solo, un filtro sulle richieste: una rotta nuova
    # aggiunta domani è coperta senza doversene ricordare. Qui si prova che il filtro esiste e
    # che riconosce le rotte giuste.
    mod, _ = ponte
    sorgente = open(os.path.join(RADICE, "installer_build", "build", "bridge.py"),
                    encoding="utf-8").read()
    assert "_foto_scade_dopo_le_operazioni" in sorgente, "il filtro deve esistere"
    assert 'request.url.path.startswith(("/order", "/position"))' in sorgente, (
        "il filtro deve coprire le rotte /order* e /position*"
    )
    assert 'request.method != "GET"' in sorgente, (
        "una semplice lettura non deve buttare la fotografia"
    )


def test_le_rotte_che_operano_leggono_dal_vivo(ponte):
    # /order/close deve vedere la posizione VERA, non una fotografia di un quarto di secondo
    # prima: una chiusura su un dato vecchio è un ordine sbagliato.
    sorgente = open(os.path.join(RADICE, "installer_build", "build", "bridge.py"),
                    encoding="utf-8").read()
    inizio = sorgente.index('@app.post("/order/close")')
    fine = sorgente.index("@app.", inizio + 10)
    corpo = sorgente[inizio:fine]
    assert "_foto(" not in corpo, (
        "la rotta di chiusura NON deve passare dalla fotografia condivisa: deve leggere la "
        "posizione dal vivo"
    )
    assert "mt5.positions_get(ticket=" in corpo, "e la legge per ticket, come prima"
