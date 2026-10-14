# -*- coding: utf-8 -*-
"""Syntra: l'asset si legge IN ALTO A SINISTRA della casella, e "RR" non e' un asset.

SEGNALATO dal proprietario (14 ottobre 2026): «alcune volte arrivano dei segnali dove legge quello
che e' RR. Quello sarebbe il rischio/rendimento, non deve leggere quello. Per capire l'asset deve
leggere quello che e' situato in alto a sinistra della casella».

Com'era: due regole deboli. La prima riga che conteneva "/" (va bene per EUR/USD, non per BTCUSDT
ne' per un'azione) e, se non bastava, il PRIMO testo in ordine di documento nella meta' sinistra
sopra i 220 px. "RR" sta in alto a sinistra, e' corto e non ha "/": passava, e finiva nel segnale
come simbolo.

Come si prova che il test serve: rimettendo la vecchia regola, il primo test legge "RR".
"""
import os
import sys

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build", "segnali_telegram"))

from syntra_lettore import asset_valido, leggi_dettaglio, leggi_schermata, scegli_asset, segnale  # noqa: E402


def nodo(testo, x1, y1, x2, y2, cliccabile="false"):
    return ('<node content-desc="%s" bounds="[%d,%d][%d,%d]" clickable="%s"/>'
            % (testo.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace("\n", "&#10;"),
               x1, y1, x2, y2, cliccabile))


def pagina(nodi):
    return "<hierarchy>" + "".join(nodi) + "</hierarchy>"


# ------------------------------------------------------------------ le regole di base
def test_rr_non_e_un_asset():
    for brutto in ["RR", "rr", "R/R", "R:R", "1:2", "2.5", "80285", "+50 pips", "SL", "TP",
                   "Entrata:", "Acquisto", "Ordine limite", "Vedi dettagli TP/SL", "Discreto", "A"]:
        assert not asset_valido(brutto), "«%s» non deve passare per un simbolo" % brutto


def test_i_simboli_veri_passano():
    for buono in ["EUR/USD", "AUD / CAD", "XAU/USD", "BTCUSDT", "BTC / USD", "NAS100", "US 30", "AAPL"]:
        assert asset_valido(buono), "«%s» e' un simbolo vero e deve passare" % buono


def test_in_alto_a_sinistra_vince():
    # Tre candidati validi: quello piu' in alto a sinistra e' l'asset.
    nodi = [("RR", (40, 300, 120, 340), False),
            ("EUR/USD", (40, 100, 300, 160), False),
            ("CrownPips", (1800, 90, 2200, 150), False)]
    assert scegli_asset(nodi, 2560) == "EUR/USD"


# ------------------------------------------------------------------ la pagina del dettaglio
DETTAGLIO_CON_RR = pagina([
    nodo("Dettagli configurazione", 0, 0, 2560, 80),
    nodo("RR", 40, 110, 140, 160),                      # il rischio/rendimento, in alto a sinistra
    nodo("BTCUSDT", 40, 180, 420, 240),                 # l'asset vero, senza barra
    nodo("CrownPips", 1900, 120, 2400, 180),
    nodo("2 Oct, 10:18 AM", 40, 260, 600, 310),
    nodo("Acquisto", 40, 330, 300, 380),
    nodo("Entrata:", 40, 400, 300, 450),
    nodo("80285", 320, 400, 600, 450),
    nodo("TP #1:\n80335 (+50 pips)", 40, 470, 800, 520),
    nodo("SL:\n80210 (-75 pips)", 40, 540, 800, 590),
])


def test_dettaglio_non_legge_rr():
    sc = leggi_dettaglio(DETTAGLIO_CON_RR)
    assert sc is not None
    assert sc["asset"] == "BTCUSDT", "ha letto «%s» invece del simbolo" % sc["asset"]


def test_dettaglio_senza_barra_trova_comunque_lasset():
    sc = leggi_dettaglio(DETTAGLIO_CON_RR)
    s = segnale(sc)
    assert s is not None, "il segnale cripto deve essere riconosciuto"
    assert s["strumento"] == "BTCUSDT"
    assert s["direzione"] == "BUY"
    assert s["entrata"] == 80285


# ------------------------------------------------------------------ la scheda riassunto
def test_scheda_risale_sopra_rr():
    # Nella scheda l'asset e' sopra la data: se in mezzo c'e' "RR", si continua a risalire.
    desc = "B\nRR\nBTC / USD\n23 set, 2:00 PM\nAcquisto\nOrdine limite\nEntrata:\n80285\nIn attesa"
    xml = pagina([nodo(desc, 0, 0, 2560, 600), nodo("CrownPips", 1900, 60, 2400, 120)])
    schede = leggi_schermata(xml)["schede"]
    assert schede, "la scheda deve essere letta"
    assert schede[0]["asset"] == "BTC / USD", "ha letto «%s»" % schede[0]["asset"]


def test_un_simbolo_assurdo_non_diventa_un_ordine():
    # Ultima rete di sicurezza: meglio nessun segnale che un ordine su "RR".
    assert segnale({"asset": "RR", "lato": "BUY", "entrata": 1.0, "tp": {}, "sl": None, "utente": "x"}) is None


# ==================================================================================================
# RICHIESTO dal proprietario: «Syntra deve funzionare perfettamente, senza problemi di
# riconoscimento utente, asset, prezzi, cronologia».
# IL MODO SCELTO: ogni riga si riconosce da quello che DICE (tipo_riga), non da dove sta scritta.
# La posizione resta solo come spareggio fra due candidati ugualmente validi. Prima era il
# contrario, ed e' per questo che bastava una scheda fatta un po' diversa - una cripto, un'azione -
# per leggere la cosa sbagliata senza accorgersene.
from syntra_lettore import tipo_riga, scegli_utente  # noqa: E402


def test_ogni_riga_si_riconosce_da_quello_che_dice():
    atteso = {
        "2 Oct 2026, 10:18 AM": "data", "23 set, 2:00 PM": "data",
        "Acquisto": "lato", "Vendita": "lato", "BUY": "lato",
        "Ordine limite": "tipo", "A mercato": "tipo",
        "Entrata:": "etichetta", "Prezzo": "etichetta",
        "TP #1:": "tp", "SL:": "sl",
        "In attesa": "stato", "TARGET HIT!": "stato",
        "Discreto": "qualita", "Ottimo": "qualita",
        "RR": "rr", "R/R": "rr",
        "Vedi dettagli TP/SL": "comando", "Dettagli configurazione": "comando",
        "B": "icona", "80285": "numero", "1,1261": "numero",
        "EUR/USD": "asset", "BTCUSDT": "asset", "BTC / USD": "asset", "NAS100": "asset",
        "CrownPips": "asset",     # un nome puo' avere la forma di un simbolo: lo spareggio e' altrove
        "": "vuota",
    }
    for testo, t in atteso.items():
        assert tipo_riga(testo) == t, "«%s» doveva essere «%s», e' «%s»" % (testo, t, tipo_riga(testo))


def test_lutente_non_puo_essere_una_data_un_voto_o_il_rr():
    # Tutti i candidati tranne "Gino" sono qualcos'altro: deve uscire "Gino", non il piu' a destra.
    nodi = [("RR", (2300, 100, 2400, 140), False),
            ("Discreto", (2000, 100, 2200, 140), False),
            ("2 Oct 2026, 10:18 AM", (1800, 150, 2400, 190), False),
            ("Gino", (1900, 100, 2100, 140), False),
            ("BTC / USD", (40, 100, 400, 140), False)]
    assert scegli_utente(nodi, 2560, "BTC / USD", 150) == "Gino"


def test_lutente_non_puo_essere_lasset():
    nodi = [("BTCUSDT", (40, 100, 400, 140), False)]
    assert scegli_utente(nodi, 2560, "BTCUSDT", 300) is None


DETTAGLIO_NODI_SEPARATI = pagina([
    nodo("Dettagli configurazione", 0, 0, 2560, 80),
    nodo("RR", 40, 110, 140, 160),
    nodo("ETH / USD", 40, 180, 420, 240),
    nodo("Gino", 1900, 120, 2400, 180),
    nodo("2 ott, 10:18 AM", 40, 260, 600, 310),
    nodo("Vendita", 40, 330, 300, 380),
    nodo("Entrata:", 40, 400, 300, 450),
    nodo("3120", 320, 400, 600, 450),
    # Qui l'etichetta e il numero stanno in DUE nodi separati: e' la forma che prima faceva uscire
    # il segnale senza target ne' stop, cioe' lo faceva scartare.
    nodo("TP #1:", 40, 470, 300, 520),
    nodo("3080 (+40 pips)", 320, 470, 800, 520),
    nodo("SL:", 40, 540, 300, 590),
    nodo("3160 (-40 pips)", 320, 540, 800, 590),
])


def test_prezzi_anche_quando_etichetta_e_numero_sono_separati():
    sc = leggi_dettaglio(DETTAGLIO_NODI_SEPARATI)
    assert sc is not None
    assert sc["asset"] == "ETH / USD", "asset letto: %s" % sc["asset"]
    assert sc["utente"] == "Gino", "utente letto: %s" % sc["utente"]
    assert sc["entrata"] == 3120
    assert sc["tp"] == {1: 3080}, "target letti: %s" % sc["tp"]
    assert sc["sl"] == 3160, "stop letto: %s" % sc["sl"]


def test_il_segnale_cripto_esce_completo():
    s = segnale(leggi_dettaglio(DETTAGLIO_NODI_SEPARATI))
    assert s is not None, "il segnale cripto deve uscire, non essere scartato"
    assert s["strumento"] == "ETHUSD"
    assert s["direzione"] == "SELL"
    assert s["entrata"] == 3120
    assert s["stop_loss"] == 3160
    assert s["take_profit"] == [3080]
