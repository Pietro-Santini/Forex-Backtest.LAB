# -*- coding: utf-8 -*-
"""Prove sui formati REALI delle sale segnali seguite dall'utente.

Questi non sono esempi inventati: sono i messaggi veri di sei canali diversi. Valgono piu' di
qualunque formato "medio", perche' ogni sala ha le sue abitudini - e sono proprio le abitudini a
far sbagliare un interprete.
"""

import sys

from parser_segnali import interpreta

CASI = [
    # ------------------------------------------------------------------ EasyForexPips
    ("EasyForexPips", """\U0001F535\U0001F53528 SEPTEMBER FREE signal forecast: AUDJPY

AUDJPY BUY

ENTRY @110.129
SL:   109.735

TP1:  110.502
TP2:  110.972

⭐️⭐️⭐️Become a VIP member => https://easyforexpips.com
\U0001F4BB\U0001F4F1Our XAUUSD Channel\U0001F449 CLICK HERE (https://t.me/+yf6Qtimi3K4yM2Q0)""",
     {"strumento": "AUDJPY", "direzione": "BUY", "entrata": 110.129,
      "stop_loss": 109.735, "take_profit": [110.502, 110.972]}),

    # ------------------------------------------------------------------ Billionaire Forex Trading
    ("Billionaire (range d'entrata)", """#XAUUSD SELL 4141-4144

TP1 4138
TP2 4135
TP3 4130
TP4 4125
TP5 4120

SL 4150

USE PROPER MONEY MANAGEMENT""",
     {"strumento": "XAUUSD", "direzione": "SELL", "entrata": 4141.0,
      "entrata_max": 4144.0, "stop_loss": 4150.0,
      "take_profit": [4138.0, 4135.0, 4130.0, 4125.0, 4120.0]}),

    # ------------------------------------------------------------------ pipxpert
    ("pipxpert", """\U0001F4E3XAU/USD\U0001F4E3

Direction: SELL

Entry Price:  4158.00

TP1       4155.00
TP2       4148.00
TP3       4138.00

SL        4176.00""",
     {"strumento": "XAUUSD", "direzione": "SELL", "entrata": 4158.0,
      "stop_loss": 4176.0, "take_profit": [4155.0, 4148.0, 4138.0]}),

    # ------------------------------------------------------------------ fthgold
    ("fthgold", """XAUUSD \U0001F4C8

Buy: 4119.5

TP: 4129.5

SL: 4114.5

Risk 1-2% of total Equity""",
     {"strumento": "XAUUSD", "direzione": "BUY", "entrata": 4119.5,
      "stop_loss": 4114.5, "take_profit": [4129.5]}),

    # ------------------------------------------------------------------ GOLD Snipers
    ("GOLD Snipers (range abbreviato)", """XAUUSD SELL

ENTRY 4156-58
SL 4170
TP 4151
TP 4146
TP 4141
TP 4121

⭐ Deposit $300 get FREE VIP:
\U0001F449 https://puvip.co/VvQz2e""",
     {"strumento": "XAUUSD", "direzione": "SELL", "entrata": 4156.0,
      "entrata_max": 4158.0, "stop_loss": 4170.0,
      "take_profit": [4151.0, 4146.0, 4141.0, 4121.0]}),

    # ------------------------------------------------------------------ Goldsnipersyy
    ("Goldsnipersyy", """GOLD  BUY 4308

TP 4310
TP 4312
TP 4314
TP 4316
TP 4318

SL 4296""",
     {"strumento": "XAUUSD", "direzione": "BUY", "entrata": 4308.0,
      "stop_loss": 4296.0,
      "take_profit": [4310.0, 4312.0, 4314.0, 4316.0, 4318.0]}),
]

# Messaggi di contorno delle stesse sale: NON sono ordini e non devono diventarlo.
RUMORE = [
    ("annuncio", "‼️NEW TRADE COMING!"),
    ("ingaggio", "ARE YOU READY? REACT WITH \U0001F525"),
    ("inoltro senza dati", "Inoltrato da Vip Signals \"Paid Room\"\nLet's Gooo Again SELL \U0001F3AF⚡"),
    ("aggiunta generica", "ADD MORE SELL \U0001F3AF"),
    ("promozione", "⭐ Deposit $300 get FREE VIP:\n\U0001F449 https://puvip.co/VvQz2e"),
    # MESSAGGI DI ESITO: la sala racconta com'e' andata un'operazione GIA' aperta. Contengono lo
    # strumento e spesso anche la direzione, e per questo venivano scambiati per ordini nuovi:
    # finivano nel pannello come posizioni da confermare. Sono informazione, non istruzione.
    ("esito semplice", "XAUUSD TP1 HIT"),
    ("esito con direzione", "XAUUSD SELL TP1 HIT"),
    ("esito con prezzo", "XAUUSD BUY TP1 HIT 4160"),
    ("esito in italiano", "XAUUSD TP1 RAGGIUNTO"),
    ("esito con pips", "CLOSED +120 PIPS XAUUSD BUY"),
    ("esito tutti i target", "ALL TP HIT GOLD BUY"),
    ("stop colpito", "GOLD SL HIT"),
    ("posizione in corso", "XAUUSD BUY RUNNING IN PROFIT"),
    # ESEMPI VERI portati dall'utente il 2026-09-29. Sono le forme in cui le sale festeggiano un
    # risultato. Il penultimo e' il piu' insidioso: "Hit4130" e' attaccato al prezzo, quindi senza
    # confine di parola dopo HIT - e il messaggio ha strumento, direzione e un numero, cioe' tutto
    # quello che serve per sembrare un ordine. Era l'unico dei sette che sfuggiva.
    ("esito reale 1", "#XAUUSD TP1 HIT! 30+ PIPS PROFIT DONE✔️✔️"),
    ("esito reale 2", "XAUUSD Buy\nTp 2 successfully \nEnjoy (100) pips Running profit"),
    ("esito reale 3", "TP3 SUCCESSFUL HITTING +170 PIPS PROFIT \U0001F4B0\U0001F4B0\U0001F525\U0001F525"),
    ("esito reale 4", "+$595.80 +99 pips ✅"),
    ("esito reale 5", "TP ¹ Hit Successful❤️❤️❤️\U0001F44D"),
    ("esito reale 6", "GOLD SELL ¹TP Hit4130✅"),
    ("esito reale 7", "Target hit 190 pips  ✅✅✅"),
    # Messaggi di FESTEGGIAMENTO (2026-09-29). Il primo e' arrivato davvero; gli altri sono le
    # varianti vicine, che provando si sono rivelate tutte capaci di passare per ordini.
    # Si puo' essere severi qui senza perdere segnali buoni: un ordine vero ha sempre direzione,
    # strumento, stop loss e almeno un target, e con quei quattro passa comunque.
    ("festeggiamento reale", "📊 XAUUSD BUY BOOM BOOM RUNNING 270+ PIPS 🙏"),
    ("pips col segno dopo", "XAUUSD BUY BOOM BOOM 270+ PIPS"),
    ("easy money", "GOLD SELL EASY MONEY 150 PIPS"),
    ("solo pips", "XAUUSD BUY 300 PIPS"),
    ("lets go", "GOLD BUY LETS GO 200 PIPS"),
    ("congratulazioni", "XAUUSD SELL CONGRATULATIONS 90 PIPS"),
    ("smashed", "GOLD SELL SMASHED IT 120 PIPS"),
    ("banked", "XAUUSD BUY BANKED 80 PIPS"),
]

# Ordini LIMITE e STOP: la sala indica un prezzo a cui entrare piu' tardi, non adesso.
# Il caso "BUY STOP" e' quello delicato: la parola STOP e' anche l'etichetta dello stop loss, e
# prima il prezzo d'entrata finiva li' dentro facendo sparire il vero stop. La trappola opposta
# (direzione su una riga e "STOP 4170" su quella dopo) deve invece restare un ordinario stop loss.
ORDINI_PENDENTI = [
    ("buy limit", "XAUUSD BUY LIMIT 4120\nSL 4110\nTP 4140\nTP 4150",
     {"tipo_ordine": "limit", "entrata": 4120.0, "stop_loss": 4110.0, "take_profit": [4140.0, 4150.0]}),
    ("sell limit", "GOLD SELL LIMIT 4180\nSL 4190\nTP 4170\nTP 4160",
     {"tipo_ordine": "limit", "entrata": 4180.0, "stop_loss": 4190.0, "take_profit": [4170.0, 4160.0]}),
    ("buy stop", "XAUUSD BUY STOP 4200\nSL 4190\nTP 4220",
     {"tipo_ordine": "stop", "entrata": 4200.0, "stop_loss": 4190.0, "take_profit": [4220.0]}),
    ("limit col trattino", "XAUUSD BUY-LIMIT 4120\nSL 4110\nTP 4140",
     {"tipo_ordine": "limit", "entrata": 4120.0, "stop_loss": 4110.0}),
    ("TRAPPOLA: stop loss a capo", "XAUUSD SELL\nSTOP 4170\nTP 4140",
     {"tipo_ordine": None, "stop_loss": 4170.0}),
    ("mercato resta mercato", "XAUUSD SELL\nENTRY 4156\nSL 4170\nTP 4151",
     {"tipo_ordine": None, "entrata": 4156.0, "stop_loss": 4170.0}),
]

OK = True

print("Formati REALI delle sale seguite\n")
# Segnalato dall'utente: target a fascia abbreviata e stop loss non dichiarato ("VIP GROUP").
CASI = list(CASI) + [
    ("buy limit con ENTRY (reale)", "XAUUSD buy LIMIT\n\nENTRY 4190\nSL 4185\nTP 4200",
     {"direzione": "BUY", "strumento": "XAUUSD", "entrata": 4190.0, "tipo_ordine": "limit", "stop_loss": 4185.0, "take_profit": [4200.0]}),
    ("sell-limit con @ (reale)", """🔵🔵30 SEPTEMBER FREE signal forecast: GBPAUD 

GBPAUD SELL-LIMIT @1.90699
SL:   1.91194

TP1:  1.90254
TP2:  1.89745
TP3:  1.89210

⭐️⭐️⭐️Become a VIP member => https://easyforexpips.com
💻📱Our XAUUSD Channel👉 CLICK HERE""",
     {"direzione": "SELL", "strumento": "GBPAUD", "entrata": 1.90699, "tipo_ordine": "limit", "stop_loss": 1.91194,
      "take_profit": [1.90254, 1.89745, 1.8921]}),
    ("target a fascia abbreviata (reale)", """#XAUUSD  SELL  4180-84

🚀 ¹/TAKE PROFIT      4174🔘
🚀 ²/TAKE PROFIT      4165🔘
🚀 3/TAKE PROFIT      4155-45🔘

😊 STOP LOSS       VIP GROUP🔘

Regular Quantity ❤️""", {"direzione": "SELL", "strumento": "XAUUSD", "entrata": 4180.0, "entrata_max": 4184.0,
                          "take_profit": [4174.0, 4165.0, 4155.0, 4145.0], "stop_loss": None}),
    ("target a fascia BUY", "EURUSD BUY 1.0850\nSL 1.0820\nTP 1.0880-1.0900",
     {"take_profit": [1.088, 1.09], "stop_loss": 1.082}),
    ("fascia su un target intermedio", "GOLD BUY 4100\nSL 4090\nTP1 4110-15\nTP2 4120",
     {"take_profit": [4110.0, 4120.0]}),
]
for nome, testo, atteso in CASI:
    r = interpreta(testo)
    if r is None:
        print(("  " + nome).ljust(36), "PROBLEMA: nessun segnale prodotto")
        OK = False
        continue
    diff = []
    for k, v in atteso.items():
        if r.get(k) != v:
            diff.append("%s=%r (atteso %r)" % (k, r.get(k), v))
    if diff:
        OK = False
        print(("  " + nome).ljust(36), "PROBLEMA: " + "; ".join(diff))
    else:
        extra = "conf=%d" % r["confidenza"]
        if r["avvisi"]:
            extra += "  AVVISI: " + "; ".join(r["avvisi"])
        print(("  " + nome).ljust(36), "ok  " + extra)

print("\nOrdini LIMITE e STOP")
for nome, testo, atteso in ORDINI_PENDENTI:
    r = interpreta(testo)
    if r is None:
        print(("  " + nome).ljust(36), "PROBLEMA: nessun segnale prodotto")
        OK = False
        continue
    diff = ["%s=%r (atteso %r)" % (k, r.get(k), v) for k, v in atteso.items() if r.get(k) != v]
    if diff:
        OK = False
        print(("  " + nome).ljust(36), "PROBLEMA: " + "; ".join(diff))
    else:
        print(("  " + nome).ljust(36), "ok")

# Segnalati dall'utente: pubblicita' e commenti che diventavano ordini.
RUMORE = list(RUMORE) + [
    ("analisi 'market alert' (reale)", """📣 XAU/USD Market Alert 📣

Current market bias: Bullish

Pair: XAU/USD

Timeframes reviewed: 30M / 1H / 5H

📍 Key reaction zone: 4193.00

📊 Support areas to watch:

4196.00 - first Resistance area
4208.00 - deeper Resistance zone

⚠️ Invalidation area:

The bullish view becomes weaker if price drops back below the lower support area near 4174.00.

Educational market alert only. This is not financial advice, not a personal recommendation, and not an instruction to buy or sell."""),
    ("solo 'bullish' con un prezzo", "GOLD bullish above 4190"),
    ("e-book gratis (reale)", """📚 FREE GOLD TRADING E-BOOK! 📚

I’m giving away my exclusive book:
“GOLD Trading Patterns” 🏆

✅ 17 key GOLD patterns
✅ Real XAUUSD examples
✅ Entry, Stop & Targets explained
✅ Built for beginners & experienced traders

No cost. No catch. Just pure value. 💎

🚀 Get FREE BOOK + FREE VIP + FREE INDICATOR 
👉 https://t.me/m/76WYbigfNjNk"""),
    ("commento di mercato", "Gold market update: bullish momentum 🚀"),
    ("indicatore gratis", "🔥 FREE XAUUSD SIGNALS INDICATOR 🔥\nBuy and sell arrows, 90% accuracy\nDM me now"),
]
print("\nMessaggi di contorno (devono essere scartati)")
for nome, testo in RUMORE:
    r = interpreta(testo)
    esito = r is None
    OK = OK and esito
    print(("  " + nome).ljust(36), "ok  (scartato)" if esito
          else "PROBLEMA: ha prodotto %s %s" % (r["direzione"], r["strumento"]))

print("\nESITO:", "tutto ok" if OK else "ci sono problemi")
sys.exit(0 if OK else 1)
