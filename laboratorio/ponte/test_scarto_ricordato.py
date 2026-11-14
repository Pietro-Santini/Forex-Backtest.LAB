# -*- coding: utf-8 -*-
"""A MERCATO CHIUSO L'ORA DEL GRAFICO NON PUO' SPOSTARSI DI DUE ORE.

SEGNALATO dal proprietario il 14 novembre 2026, con lo screenshot del grafico: «abbiamo ancora il
problema del tempo che non si ferma alla chiusura dell'asset, mi mostra 00:48 invece l'asset ha
chiuso alle 22:00».

MISURATO sul suo PC, di sabato a mercato chiuso: le candele di XAU/USD arrivavano fino alle 00:45
locali e NON erano inventate - avevano volume vero (1.056, 626, 739 tick). Erano candele giuste,
mostrate due ore avanti. Nei log dello stesso giorno, a mercato aperto:

    scarto server/UTC 7200s   12 volte     <- il vero scarto di FTMO (UTC+2, ora solare)
    scarto server/UTC    0s    2 volte     <- solo DOPO il riavvio di quella notte

LA CAUSA: lo scarto si misura da un tick FRESCO (giustamente: l'eta' di un tick vecchio verrebbe
scambiata per il fuso del broker, difetto del 18 ottobre). La riserva c'era, ma viveva in una
variabile del processo: riaprendo l'applicazione nel fine settimana si ripartiva da zero, e
"zero" vuol dire mostrare l'orologio del server come se fosse UTC.

Queste prove usano i numeri veri di quel sabato.
"""
import json
import os
import time

import pytest

import _percorsi  # noqa: F401  (mette installer_build/build nel percorso e isola APPDATA)

feed = pytest.importorskip("mt5_feed_server")


# I numeri misurati sul PC del proprietario, sabato 14 novembre 2026 alle 00:54 locali.
SCARTO_VERO = 7200                 # FTMO-Demo, ora solare: UTC+2
ULTIMA_CANDELA_SERVER = 1794613500  # 23:45 "ora server" dell'ultimo tick vero di XAU/USD
ADESSO = 1794614040                 # 23:54 UTC di quel sabato


def _tick_senza_eta_misurabile():
    """Un tick troppo vecchio perche' se ne possa ricavare un fuso orario: tre giorni.

    PERCHE' NON UN ISTANTE FISSO. Qui prima c'era l'epoch vero dell'ultima candela di quel
    sabato. Ma _server_time_offset_seconds legge l'orologio VERO, non un istante finto: col
    passare delle ore la distanza fra quell'epoch e "adesso" cambia, e dopo un'ora era finita
    per caso vicino alla griglia della mezz'ora - la guardia l'accettava e ne ricavava -3600.
    Risultato: la prova passava da sola e falliva nella suite, cioe' dipendeva dall'ora in cui
    la si lanciava. Tre giorni di eta' superano sempre il tetto delle 24 ore, a qualunque ora.
    """

    class Tick:
        time = __import__("time").time() - 3 * 86400

    return Tick()



@pytest.fixture(autouse=True)
def _pulisci(tmp_path, monkeypatch):
    """Ogni prova ha il SUO file, in una cartella sua.

    Prima queste prove cancellavano il file condiviso e basta: passavano da sole e fallivano
    dentro la suite (misurato: usciva uno scarto di -3600, scritto da un'altra prova che usa un
    MT5 finto con lo stesso nome di server). Un file vero condiviso rende l'esito dipendente
    dall'ordine, che e' il difetto che il laboratorio insegue da sempre - e non si cura
    cancellando piu' forte, si cura dando a ogni prova il suo spazio.
    """
    monkeypatch.setattr(feed, "_CARTELLA_SCARTO", str(tmp_path))
    monkeypatch.setattr(feed, "_FILE_SCARTO", str(tmp_path / "scarto_server.json"))
    monkeypatch.setattr(feed, "_last_good_server_offset", None)
    monkeypatch.setattr(feed, "_ultima_ricerca_scarto", 0.0)
    # Dal 14 novembre un tick vale solo se e' PIU' NUOVO dell'ultimo visto: senza azzerare
    # anche questo, l'esito di una prova dipenderebbe da quelle girate prima.
    monkeypatch.setattr(feed, "_epoch_massimo_visto", 0)
    yield
    feed._last_good_server_offset = None


def _fingi_server(monkeypatch, nome="FTMO-Demo"):
    monkeypatch.setattr(feed, "_nome_server_broker", lambda: nome)


def test_il_file_sta_fuori_dalla_cartella_del_programma():
    """Deve sopravvivere a una reinstallazione: il Setup riscrive la cartella del programma.

    Qui si rilegge il percorso VERO dal sorgente, non quello finto della fixture: e' proprio il
    percorso scelto a dover essere giusto."""
    import importlib
    vero = importlib.import_module("mt5_feed_server")
    percorso = vero.__dict__["_FILE_SCARTO"] if "_FILE_SCARTO" in vero.__dict__ else ""
    percorso = os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"),
                            "ForexBacktestLAB", "scarto_server.json")
    assert "ForexBacktestLAB" in percorso
    assert percorso.endswith("scarto_server.json")
    programmi = os.path.join("AppData", "Local", "Programs")
    assert programmi not in percorso, (
        "se stesse nella cartella del programma, ogni aggiornamento cancellerebbe il ricordo "
        "proprio quando serve: %s" % percorso)


def test_un_tick_vecchio_NON_diventa_il_fuso_orario(monkeypatch):
    """La guardia che non si deve rompere: quello di sabato era vecchio di due ore, e preso per
    buono avrebbe spostato ogni candela di due ore (e' il difetto del 18 ottobre, al contrario)."""
    _fingi_server(monkeypatch)
    # Un tick di nove minuti prima: residuo 540 s dalla griglia di mezz'ora, va respinto.
    assert feed._scarto_fresco_da_epoch(ULTIMA_CANDELA_SERVER, ADESSO) is None
    # E uno vecchio di giorni, a maggior ragione.
    assert feed._scarto_fresco_da_epoch(ULTIMA_CANDELA_SERVER - 3 * 86400, ADESSO) is None


def test_un_tick_fresco_misura_lo_scarto_vero(monkeypatch):
    """Il caso normale, a mercato aperto: il tick ha l'ora del server e noi siamo adesso."""
    _fingi_server(monkeypatch)
    fresco = ADESSO + SCARTO_VERO        # stesso istante, ma con l'orologio del broker
    # La prima osservazione SI ACCETTA: con un tick davvero fresco lo scarto deve essere noto
    # subito, altrimenti alla prima installazione il grafico resta sfasato. (Per un momento
    # l'avevo resa muta: test_scarto_server.py ha avuto ragione a protestare.)
    assert feed._scarto_fresco_da_epoch(fresco, ADESSO) == SCARTO_VERO


def test_lo_scarto_misurato_viene_SCRITTO(monkeypatch):
    _fingi_server(monkeypatch)
    feed._ricorda_scarto(SCARTO_VERO)
    with open(feed._FILE_SCARTO, encoding="utf-8") as f:
        dati = json.load(f)
    assert dati["FTMO-Demo"]["scarto"] == SCARTO_VERO


def test_RIAPERTA_A_MERCATO_CHIUSO_ritrova_le_due_ore(monkeypatch):
    """La prova che vale per tutte: e' il sabato del proprietario.

    Niente in memoria (l'applicazione e' appena ripartita), nessun simbolo che quota (mercato
    chiuso), nessun tick fresco. Prima qui usciva 0 e il grafico mostrava 00:45 invece di 22:45.
    """
    _fingi_server(monkeypatch)
    feed._ricorda_scarto(SCARTO_VERO)            # misurato ieri, a mercato aperto
    feed._last_good_server_offset = None         # l'app e' stata riavviata
    monkeypatch.setattr(feed, "_scarto_da_un_simbolo_quiunque", lambda now: None)

    ottenuto = feed._server_time_offset_seconds(_tick_senza_eta_misurabile())
    assert ottenuto == SCARTO_VERO, (
        "a mercato chiuso si deve riusare l'ultima misura buona: con 0 le candele di XAU/USD "
        "finivano alle 00:45 invece che alle 22:45. Ottenuto: %s" % ottenuto)


def test_senza_nessun_ricordo_si_resta_a_zero(monkeypatch):
    """Non si inventa niente: senza una misura buona alle spalle vale ancora la regola di prima
    (l'orologio del server com'e', mai un numero dedotto dall'eta' di un tick)."""
    _fingi_server(monkeypatch)
    feed._last_good_server_offset = None
    monkeypatch.setattr(feed, "_scarto_da_un_simbolo_quiunque", lambda now: None)

    assert feed._server_time_offset_seconds(_tick_senza_eta_misurabile()) == 0


def test_un_ALTRO_broker_non_eredita_il_fuso(monkeypatch):
    """Due server diversi non si passano lo scarto: cambiando broker si ricomincia a misurare."""
    _fingi_server(monkeypatch, "FTMO-Demo")
    feed._ricorda_scarto(SCARTO_VERO)
    _fingi_server(monkeypatch, "AltroBroker-Live")
    assert feed._scarto_ricordato() is None


def test_un_tick_FRESCO_vince_sul_ricordo(monkeypatch):
    """Il giorno del cambio dell'ora legale il ricordo e' vecchio di un'ora: deve perdere."""
    _fingi_server(monkeypatch)
    feed._ricorda_scarto(SCARTO_VERO)
    feed._last_good_server_offset = None

    # L'orario deve essere fresco rispetto all'orologio VERO: _server_time_offset_seconds
    # legge time.time(), non un istante finto. (Prima questa prova era rossa per colpa mia:
    # usavo l'istante di quel sabato, che oggi e' vecchio di giorni e viene respinto.)
    # A mercato APERTO i tick arrivano di continuo: il primo fa da riferimento, dal secondo in
    # poi si misura. E' la regola del 14 novembre (un tick vale solo se AVANZA), e qui si
    # riproduce quel flusso invece di una chiamata sola.
    class TickPrimo:
        time = time.time() + 10800 - 30

    class TickFresco:
        time = time.time() + 10800     # il broker e' passato a UTC+3

    feed._server_time_offset_seconds(TickPrimo())
    assert feed._server_time_offset_seconds(TickFresco()) == 10800


def test_un_file_rovinato_non_sposta_le_candele(monkeypatch):
    _fingi_server(monkeypatch)
    os.makedirs(os.path.dirname(feed._FILE_SCARTO), exist_ok=True)
    with open(feed._FILE_SCARTO, "w", encoding="utf-8") as f:
        f.write("{non sono json")
    assert feed._scarto_ricordato() is None
    with open(feed._FILE_SCARTO, "w", encoding="utf-8") as f:
        json.dump({"FTMO-Demo": {"scarto": 99 * 3600, "quando": time.time()}}, f)
    assert feed._scarto_ricordato() is None, "99 ore non e' il fuso di nessun broker"


def test_non_si_scrive_su_disco_a_ogni_candela(monkeypatch):
    """La stessa misura, ripetuta, non deve rifare il file: /history la chiede di continuo."""
    _fingi_server(monkeypatch)
    feed._ricorda_scarto(SCARTO_VERO)
    quando = os.path.getmtime(feed._FILE_SCARTO)
    for _ in range(50):
        feed._ricorda_scarto(SCARTO_VERO)
    assert os.path.getmtime(feed._FILE_SCARTO) == quando

def test_un_tick_VECCHIO_DI_ORE_INTERE_non_e_un_fuso_orario(monkeypatch):
    """IL BUCO DEL 14 NOVEMBRE, con i numeri veri.

    MISURATO sul PC del proprietario, sabato pomeriggio a mercato chiuso: lo scarto era saltato
    a -57600 (meno sedici ore) e tutte le candele erano tornate sbagliate.

        adesso:            sab 14/11 16:53
        grezzo:            -53.973 s  (-15,0 ore)   <- e' l'ETA' del tick di venerdi'
        allineato a 30min: -54.000 s
        residuo:                27 s                <- si respingeva solo sopra 300
        eta' oltre 24h?    NO                       <- si respingeva solo sopra 86.400

    Un tick vecchio di un numero INTERO di ore cade sulla griglia della mezz'ora esatta: succede
    per forza dopo ogni chiusura, una volta all'ora, per le prime ventiquattro.
    """
    _fingi_server(monkeypatch)
    adesso = 1794671580.0                 # sab 14/11 16:53
    tick_di_venerdi = adesso - 53973      # l'ultimo tick vero prima della chiusura
    # Respinta dalla guardia delle 14 ore: -15 ore non e' il fuso di nessun broker.
    assert feed._scarto_fresco_da_epoch(tick_di_venerdi, adesso) is None
    # E ripetendola - il tick non avanza, il mercato e' chiuso - non si misura comunque niente.
    ottenuto = feed._scarto_fresco_da_epoch(tick_di_venerdi, adesso + 60)
    assert ottenuto is None, (
        "un tick fermo da quindici ore non e' un fuso orario: prima da qui usciva -54000 e le "
        "candele finivano sedici ore avanti. Ottenuto: %s" % ottenuto)


def test_nessun_broker_sta_oltre_le_quattordici_ore(monkeypatch):
    """Il controllo c'era gia' sul valore RICORDATO ma non su quello MISURATO: l'asimmetria
    lasciava entrare -15 e -16 ore. Nessun server MT5 sta fuori da UTC-12..+14."""
    _fingi_server(monkeypatch)
    adesso = 1794671580.0
    feed._scarto_fresco_da_epoch(adesso - 100000, adesso)      # prima osservazione, muta
    assert feed._scarto_fresco_da_epoch(adesso - 15 * 3600, adesso) is None, "15 ore: respinto"
    assert feed._scarto_fresco_da_epoch(adesso + 20 * 3600, adesso) is None, "20 ore: respinto"


def test_a_mercato_CHIUSO_non_si_misura_e_vince_il_ricordo(monkeypatch):
    """Tutto insieme: il mercato e' fermo, il tick non avanza mai, e la risposta giusta e'
    l'ultima misura buona salvata su disco - non un numero ricavato da un'eta'."""
    _fingi_server(monkeypatch)
    feed._ricorda_scarto(SCARTO_VERO)
    feed._last_good_server_offset = None
    adesso = 1794671580.0
    fermo = adesso - 53973

    class TickFermo:
        time = fermo

    monkeypatch.setattr(feed, "_scarto_da_un_simbolo_quiunque", lambda now: None)
    for _ in range(3):                       # il mercato resta chiuso: si richiede piu' volte
        assert feed._server_time_offset_seconds(TickFermo()) == SCARTO_VERO, (
            "a mercato chiuso deve valere il 7200 ricordato, mai l'eta' del tick fermo")
