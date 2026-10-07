# -*- coding: utf-8 -*-
"""Prove dell'interprete dei segnali Telegram.

I messaggi qui sotto sono scritti imitando i formati che girano davvero nelle sale segnali:
etichette diverse, emoji al posto delle parole, numeri su righe separate, testo di contorno.
Servono soprattutto i casi NEGATIVI: quello che l'interprete deve rifiutare conta piu' di
quello che riesce a leggere, perche' a valle c'e' un ordine su un conto vero.
"""

import sys

from parser_segnali import interpreta

OK = True


def prova(nome, testo, atteso):
    """`atteso` None = deve rifiutare. Altrimenti: solo i campi indicati vengono confrontati."""
    global OK
    r = interpreta(testo)
    if atteso is None:
        esito = r is None
        print(("  " + nome).ljust(44), "ok  (rifiutato)" if esito else "PROBLEMA: ha prodotto un segnale")
        OK = OK and esito
        return
    if r is None:
        print(("  " + nome).ljust(44), "PROBLEMA: nessun segnale prodotto")
        OK = False
        return
    diff = []
    for k, v in atteso.items():
        if r.get(k) != v:
            diff.append("%s=%r (atteso %r)" % (k, r.get(k), v))
    esito = not diff
    OK = OK and esito
    extra = "conf=%d" % r["confidenza"]
    if r["avvisi"]:
        extra += "  avvisi=%d" % len(r["avvisi"])
    print(("  " + nome).ljust(44), ("ok  " + extra) if esito else ("PROBLEMA: " + "; ".join(diff)))


print("Interprete dei segnali Telegram\n")
print("FORMATI CHE DEVE LEGGERE")

prova("classico con etichette", """
🔵 BUY EURUSD @ 1.0850
SL: 1.0820
TP1: 1.0880
TP2: 1.0920
""", {"strumento": "EURUSD", "direzione": "BUY", "entrata": 1.0850,
      "stop_loss": 1.0820, "take_profit": [1.0880, 1.0920]})

prova("oro, parole per esteso", """
GOLD SELL NOW 2650.50
Stop loss 2660.00
Take profit 2630.00
""", {"strumento": "XAUUSD", "direzione": "SELL", "stop_loss": 2660.0,
      "take_profit": [2630.0]})

prova("numeri sulla riga dopo", """
XAUUSD
BUY
Entry: 2648
SL:
2640
TP:
2665
""", {"strumento": "XAUUSD", "direzione": "BUY", "entrata": 2648.0,
      "stop_loss": 2640.0, "take_profit": [2665.0]})

prova("italiano", """
VENDI NAS100 a 20500
Stop 20560
Obiettivo 1: 20400
Obiettivo 2: 20350
""", {"strumento": "NAS100", "direzione": "SELL", "stop_loss": 20560.0,
      "take_profit": [20400.0, 20350.0]})

prova("solo emoji per la direzione", """
🟢 US30 35200
S/L 35100
T/P 35400
""", {"strumento": "US30", "direzione": "BUY", "stop_loss": 35100.0,
      "take_profit": [35400.0]})

prova("virgola decimale", """
BUY GBPUSD 1,2750
SL 1,2700
TP 1,2850
""", {"strumento": "GBPUSD", "direzione": "BUY", "entrata": 1.2750,
      "stop_loss": 1.27, "take_profit": [1.285]})

prova("a mercato senza prezzo", """
SELL BTCUSD a mercato
Stop loss: 68500
Take profit: 66000
""", {"strumento": "BTCUSD", "direzione": "SELL", "a_mercato": True,
      "stop_loss": 68500.0, "take_profit": [66000.0]})

prova("alias lungo non confuso col corto", """
BUY USTEC100 20500
SL 20450
""", {"strumento": "NAS100", "direzione": "BUY"})

prova("testo di contorno abbondante", """
Buongiorno ragazzi 👋 setup della mattina, gestione come sempre al 1% di rischio.
🔴 SELL XAU/USD @ 2655
SL: 2663
TP1: 2645
Mi raccomando spostate a pari appena arriva al primo target!
""", {"strumento": "XAUUSD", "direzione": "SELL", "entrata": 2655.0,
      "stop_loss": 2663.0, "take_profit": [2645.0]})

print("\nCASI CHE DEVE RIFIUTARE")
prova("chiacchiera senza segnale", "Buongiorno a tutti, oggi mercati chiusi per festivita'.", None)
prova("solo direzione, niente strumento", "BUY ora! entry 1.0850 sl 1.0820", None)
prova("solo strumento, niente direzione", "EURUSD interessante qui, osserviamo 1.0850", None)
prova("messaggio vuoto", "   ", None)
prova("aggiornamento su una posizione", "TP1 raggiunto su oro, sposto a pari 👍", None)

print("\nCONTROLLI DI COERENZA (il filtro che protegge i soldi)")


def avvisi_di(testo):
    r = interpreta(testo)
    return (r or {}).get("avvisi", []), (r or {}).get("confidenza", -1)


a, c = avvisi_di("BUY EURUSD 1.0850\nSL 1.0900\nTP 1.0880")
esito = any("stop loss non e' sotto" in x for x in a)
OK = OK and esito
print("  BUY con stop SOPRA l'entrata".ljust(44), ("ok  segnalato, conf=%d" % c) if esito else "PROBLEMA: non segnalato")

a, c = avvisi_di("SELL XAUUSD 2650\nSL 2640\nTP 2630")
esito = any("stop loss non e' sopra" in x for x in a)
OK = OK and esito
print("  SELL con stop SOTTO l'entrata".ljust(44), ("ok  segnalato, conf=%d" % c) if esito else "PROBLEMA: non segnalato")

a, c = avvisi_di("BUY EURUSD 1.0850\nSL 1.0820\nTP 1.0800")
esito = any("take profit non e' sopra" in x for x in a)
OK = OK and esito
print("  BUY con target SOTTO l'entrata".ljust(44), ("ok  segnalato, conf=%d" % c) if esito else "PROBLEMA: non segnalato")

a, c = avvisi_di("BUY EURUSD 1.0850\nTP 1.0880")
esito = any("rischio_non_definito" in x for x in a)
OK = OK and esito
print("  senza stop loss".ljust(44), ("ok  segnalato, conf=%d" % c) if esito else "PROBLEMA: non segnalato")

r = interpreta("🔵 BUY EURUSD @ 1.0850\nSL: 1.0820\nTP1: 1.0880")
esito = bool(r) and not r["avvisi"] and r["confidenza"] >= 90
OK = OK and esito
print("  segnale pulito: nessun avviso".ljust(44), ("ok  conf=%d" % r["confidenza"]) if esito else "PROBLEMA")

print("\nALTRO")
r = interpreta("BUY EURUSD @ 1.0850\nSL 1.0820")
esito = bool(r) and r["testo"].startswith("BUY EURUSD")
OK = OK and esito
print("  il testo originale viene conservato".ljust(44), "ok" if esito else "PROBLEMA")

r = interpreta("BUY EURUSD @ 1.0850 con TP al 50% del range\nSL 1.0820")
esito = bool(r) and 50.0 not in (r["take_profit"] or [])
OK = OK and esito
print("  una percentuale non diventa un target".ljust(44), "ok" if esito else "PROBLEMA")

# CRIPTOVALUTE
# SEGNALATO dal proprietario (7 ottobre 2026): «nella pagina prova sale segnali, quando vado a
# inserire una criptovaluta non viene riconosciuta. Qualsiasi criptovaluta metto.»
# L'elenco a mano aveva due monete e non tutte le loro forme: BTCUSDT c'era, ETHUSDT no.
print("\nCRIPTOVALUTE")
for testo, atteso in [
    ("BTCUSD BUY 80000\nSL 79000\nTP 82000", "BTCUSD"),
    ("ETHUSDT SELL 2500\nSL 2600\nTP 2400", "ETHUSD"),      # la forma che mancava
    ("LONG SOL 180\nSL 170\nTP 200", "SOLUSD"),              # la moneta sola
    ("BUY SOLANA 180\nSL 170\nTP 200", "SOLUSD"),            # il nome per esteso
    ("SELL DOGE/USD 0.2\nSL 0.21\nTP 0.18", "DOGEUSD"),      # con la barra
    ("BUY AVAXPERP 30\nSL 28\nTP 34", "AVAXUSD"),            # come si scrive sui futures
    ("XRPUSDT BUY 2.1\nSL 2.0\nTP 2.3", "XRPUSD"),
    ("SHIB BUY 0.00002\nSL 0.000019\nTP 0.000022", "SHIBUSD"),  # prezzi piccolissimi
]:
    r = interpreta(testo)
    esito = bool(r) and r["strumento"] == atteso
    OK = OK and esito
    nome = testo.split("\n")[0][:30]
    print(("  " + nome).ljust(46),
          "ok" if esito else ("PROBLEMA: %s invece di %s" % (r["strumento"] if r else None, atteso)))

# Le cripto non devono aver rotto il resto: oro e forex passavano da qui prima.
for testo, atteso in [("XAUUSD BUY 4100\nSL 4080\nTP 4150", "XAUUSD"),
                      ("EURUSD SELL 1.08\nSL 1.09\nTP 1.07", "EURUSD"),
                      ("GOLD BUY 4100\nSL 4080\nTP 4150", "XAUUSD")]:
    r = interpreta(testo)
    esito = bool(r) and r["strumento"] == atteso
    OK = OK and esito
    print(("  (non rotto) " + testo.split("\n")[0][:24]).ljust(46),
          "ok" if esito else "PROBLEMA: %s invece di %s" % (r["strumento"] if r else None, atteso))

print("\nESITO:", "tutto ok" if OK else "ci sono problemi")
sys.exit(0 if OK else 1)
