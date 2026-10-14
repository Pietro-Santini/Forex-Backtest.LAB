# -*- coding: utf-8 -*-
"""Syntra: una notifica non deve sparire perche' la data e' scritta in un altro modo.

SEGNALATO dal proprietario (14 ottobre 2026): «per le operazioni crypto su Syntra purtroppo non
vengono acquisite. C'e' un utente, Gino, che ogni giorno manda segnali e non lo rileva mai».

DUE CAUSE TROVATE, tutte e due silenziose:

1. Una notifica veniva riconosciuta SOLO se la data stava esattamente sulla prima riga E aveva
   l'anno di quattro cifre ("2 Oct 2026, 10:18 AM"). La stessa app scrive le date anche senza anno
   (come nelle schede). Fuori da quella forma, la notifica non veniva nemmeno vista.

2. Peggio: `nt["quando"] or 0`. Quando la data non si riusciva a leggere, `quando` era None e
   `None or 0` fa 0 - cioe' il 1 gennaio 1970. Il controllo sull'eta' la dichiarava percio'
   "vecchia" SEMPRE, e la scartava in silenzio. Una notifica di cui non si sa l'eta' non e' una
   notifica vecchia: arriva li' solo se e' nuova per noi, e va aperta.

Come si prova che il test serve: rimettendo `or 0` il terzo test va rosso.
"""
import os
import sys
import time

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build", "segnali_telegram"))

import syntra_lettore as SL  # noqa: E402


def nodo(testo, x1=0, y1=0, x2=2560, y2=300):
    t = (testo.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace("\n", "&#10;"))
    return '<node content-desc="%s" bounds="[%d,%d][%d,%d]" clickable="true"/>' % (t, x1, y1, x2, y2)


def pagina(*nodi):
    return ("<hierarchy>" + nodo("Notifiche", 0, 0, 400, 60) + nodo("Cancella tutto", 2000, 0, 2560, 60)
            + "".join(nodi) + "</hierarchy>")


FOREX = ("2 Oct 2026, 10:18 AM\n"
         "EUR/USD | ACQUISTA | IN ATTESA | Di CrownPips\n"
         "Nuovo ordine in sospeso Inserito @1.1261 da CrownPips")

# La stessa cosa, con la data SENZA ANNO: e' la forma che l'app usa nelle schede.
CRIPTO_SENZA_ANNO = ("2 ott, 10:18 AM\n"
                     "BTC / USD | ACQUISTA | IN ATTESA | Di Gino\n"
                     "Nuovo ordine in sospeso Inserito @80285 da Gino")

# E una con una data che non sappiamo leggere affatto.
CRIPTO_DATA_IGNOTA = ("Oggi alle 10:18\n"
                      "ETH / USD | VENDI | IN ATTESA | Di Gino\n"
                      "Nuovo ordine in sospeso Inserito @3120 da Gino")


def test_la_notifica_normale_si_legge_come_prima():
    r = SL.leggi_notifiche(pagina(nodo(FOREX, 0, 100, 2560, 400)))
    assert r["e_notifiche"] is True
    assert len(r["notifiche"]) == 1
    n = r["notifiche"][0]
    assert n["asset"] == "EUR/USD"
    assert n["lato"] == "BUY"
    assert n["utente"] == "CrownPips"
    assert n["prezzo"] == 1.1261
    assert n["quando"] is not None


def test_la_data_senza_anno_non_fa_sparire_la_notifica():
    r = SL.leggi_notifiche(pagina(nodo(CRIPTO_SENZA_ANNO, 0, 100, 2560, 400)))
    assert len(r["notifiche"]) == 1, "la notifica cripto con la data senza anno e' sparita"
    n = r["notifiche"][0]
    assert n["asset"] == "BTC / USD"
    assert n["utente"] == "Gino"
    assert n["prezzo"] == 80285
    assert n["quando"] is not None, "la data senza anno deve essere letta lo stesso"


def test_una_data_che_non_conosciamo_non_vuol_dire_vecchia():
    r = SL.leggi_notifiche(pagina(nodo(CRIPTO_DATA_IGNOTA, 0, 100, 2560, 400)))
    assert len(r["notifiche"]) == 1, "una data che non si sa leggere non deve far sparire la notifica"
    n = r["notifiche"][0]
    assert n["asset"] == "ETH / USD"
    assert n["lato"] == "SELL"
    assert n["utente"] == "Gino"
    # Il punto vero: `quando` None NON deve diventare "1970", cioe' "vecchissima".
    assert n["quando"] is None
    vecchia_com_era = time.time() * 1000.0 - (n["quando"] or 0) > SL.NOTIFICA_MAX_ETA_MS
    assert vecchia_com_era, "e' proprio questo il calcolo che la buttava via: deve restare sbagliato qui"
    # ...e nel lettore vero non si usa piu' quel calcolo: si guarda `is None` a parte.
    import inspect
    sorgente = inspect.getsource(SL)
    assert 'nt["quando"] is None' in sorgente, "il lettore deve trattare a parte la data sconosciuta"
    assert '(nt["quando"] or 0)' not in sorgente, "il vecchio calcolo e' tornato: una data ignota torna 'vecchia'"


def test_piu_notifiche_insieme():
    r = SL.leggi_notifiche(pagina(nodo(FOREX, 0, 100, 2560, 400),
                                  nodo(CRIPTO_SENZA_ANNO, 0, 420, 2560, 720),
                                  nodo(CRIPTO_DATA_IGNOTA, 0, 740, 2560, 1040)))
    assert len(r["notifiche"]) == 3, "devono arrivare tutte e tre"
    assert [x["utente"] for x in r["notifiche"]] == ["CrownPips", "Gino", "Gino"]


def test_quello_che_non_e_una_notifica_resta_fuori():
    r = SL.leggi_notifiche(pagina(nodo("Impostazione magica", 0, 100, 400, 160),
                                  nodo("un testo qualunque senza barre", 0, 200, 900, 260)))
    assert r["notifiche"] == []
