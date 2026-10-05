# -*- coding: utf-8 -*-
"""Messaggi VERI delle sale seguite (inviati dall'utente il 01/10), con la lettura attesa.
Da eseguire dopo ogni modifica a parser_segnali.py:  python test_sale_seguite.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parser_segnali as P

# I messaggi reali mandati dall'utente, con l'esito atteso.
CASI = [
("nas100_chiocciola", """🔵🔵01 OCTOBER  FREE signal forecast: NAS100 

NAS100 SELL 

ENTRY @30764
SL:    30953

TP1:  30591
TP2: 30396
TP3: 30175

⭐️⭐️⭐️Become a VIP member => https://easyforexpips.com
💻📱Our XAUUSD Channel👉 CLICK HERE (https://t.me/+yf6Qtimi3K4yM2Q0)""",
 dict(strumento="NAS100",direzione="SELL",entrata=30764,stop_loss=30953,take_profit=[30591,30396,30175],tipo_ordine=None)),
("presentazione_sala_razzo", """🎯 XAUUSD 🚀 4-6 Daily Accurate Signals 📊""",
 None),
("sl_tp_vuoti_15_persone", """XAUUSD  SELL 4280
SL 
TP 
ONLY 15 PEOPLE ALLOWED

https://t.me/GOLDSNNPER786


https://t.me/XAUSSDGOLDMASTER76

https://t.me/+3ZzKt085B_c0YmJk

VIP ROOM 
➖➖➖➖➖ 
join vip now 👇👇""",
 dict(strumento="XAUUSD",direzione="SELL",entrata=4280,stop_loss=None,take_profit=[],tipo_ordine=None)),
("gold_senza_livelli", """Gold SELL 4162

Gold 
99% Accurate signals 🫶
For TP and SL Join Now 👇

https://t.me/+1s_1rLRkBIsxNjM0
https://t.me/+1s_1rLRkBIsxNjM0


Join For TP And SL 👆""",
 dict(strumento="XAUUSD",direzione="SELL",entrata=4162,stop_loss=None,take_profit=[],tipo_ordine=None)),
("italiano_limite", """XAUUSD: Ordine di acquisto con limite a 4155/4150.

TP1: 4160
TP2: 4165
TP3: 4170
TP4: 4175
TP5: 4180
TP6: 4185

SL: 4125""",
 dict(strumento="XAUUSD",direzione="BUY",tipo_ordine="limit",stop_loss=4125,take_profit=[4160,4165,4170,4175,4180,4185])),
("acquista_tp_attaccato", """XAUUSD ACQUISTA a 4176
TP14181
TP2 4186
TP3 4191
TP4 4196
SL 4156""",
 dict(strumento="XAUUSD",direzione="BUY",entrata=4176,stop_loss=4156,take_profit=[4181,4186,4191,4196],tipo_ordine=None)),
("steven_sticker", """XAUUSD 🔤🔤 SETUP
➖➖➖➖➖➖➖➖➖➖
✅ Entry: 4165 - 4170

😮 SL.   4180
➖➖➖➖➖➖➖➖➖➖
😮TP1: 4160
😮TP2: 4155
😮TP3: 4150
😮TP4: 4145""",
 dict(strumento="XAUUSD",direzione="SELL",entrata=4165,stop_loss=4180,take_profit=[4160,4155,4150,4145])),
("sell_limit_11tp", """GOLD Sell LIMIT 4167/4170

TP 4164
TP 4161
TP 4158
TP 4155
TP 4152
TP 4149
TP 4146
TP 4143
TP 4140
TP 4120
TP 4100

SL /4190""",
 dict(strumento="XAUUSD",direzione="SELL",tipo_ordine="limit",stop_loss=4190,take_profit=[4164,4161,4158,4155,4152,4149,4146,4143,4140,4120,4100])),
("signal_alert", """🚨 SIGNAL ALERT🚨

🌐 #XAUUSD 

📊 Trade Details: 📉 #BUY 

⚪️ Entry Point: 4165
🔴 Stop Loss (SL): 4157

🟢 Take Profit 1 (TP1): 4168
🟢 Take Profit 2 (TP2): 4173
🟢 Take Profit 3 (TP3): 4181""",
 dict(strumento="XAUUSD",direzione="BUY",entrata=4165,stop_loss=4157,take_profit=[4168,4173,4181],tipo_ordine=None)),
("sell_now_confirm_open", """XAUUSD Sell NOW:  4162

TAKE PROFIT:       4158
TAKE PROFIT:       4154 CONFIRM
TAKE PROFIT:       4150
TAKE PROFIT:       4145 Open

STOP LOSS:          4174""",
 dict(strumento="XAUUSD",direzione="SELL",entrata=4162,stop_loss=4174,take_profit=[4158,4154,4150,4145],tipo_ordine=None)),
("apici_vip", """#XAUUSD  BUY  4175

¹/TAKE PROFIT      4185
²/TAKE PROFIT      4190
3/TAKE PROFIT      4195-4205

STOP LOSS             ,VIP GROUP""",
 dict(strumento="XAUUSD",direzione="BUY",entrata=4175,stop_loss=None,take_profit=[4185,4190,4195,4205],tipo_ordine=None)),
("buy_from", """Gold buy From 4137

TP ¹ 4140

TP ² 4143

TP ³ 4146

TP ⁴ 4150

SL 4125""",
 dict(strumento="XAUUSD",direzione="BUY",entrata=4137,stop_loss=4125,take_profit=[4140,4143,4146,4150],tipo_ordine=None)),
("buy_piu", """XAUUSD BUY 4185+ 4182

Sl 4173

TP 4188
TP 4191
TP 4195
TP 4200
TP 4205""",
 dict(strumento="XAUUSD",direzione="BUY",stop_loss=4173,take_profit=[4188,4191,4195,4200,4205],tipo_ordine=None)),
("direction_entry_price", """📣XAU/USD📣

Direction: BUY

Entry Price:  4193.00

TP1       4196.00
TP2       4208.00
TP3       4223.00

SL        4174.00""",
 dict(strumento="XAUUSD",direzione="BUY",entrata=4193,stop_loss=4174,take_profit=[4196,4208,4223],tipo_ordine=None)),
("market_alert", """📣 XAU/USD Market Alert 📣

Current market bias: Bearish

Pair: XAU/USD

Timeframes reviewed: 30M / 1H / 5H

📍 Key reaction zone: 4158.00

📉 This is the area where the Bearish scenario becomes active and where price reaction is important.

📊 Support areas to watch:

4155.00 - first lower support area
4148.00 - deeper support zone
4138.00 - extended Bearish area

⚠️ View becomes weaker if price breaks and holds above:

4164.00

⚠️ Invalidation area:

The bearish view becomes weaker if price pushes back above the upper resistance area near 4176.00.

A strong break and hold above this zone would suggest that sellers are losing control and that the market structure may shift.

Educational market alert only. This is not financial advice, not a personal recommendation, and not an instruction to buy or sell.""",
 None),
("canfom_target", """🥇 GOLD BUY 4183/4185

1-TP:4187
2-TP:4291
3-TP:4195
4-TP:4199 Canfom Target 
5-TP:4203 Open 

STOP:LOSS:4173""",
 dict(strumento="XAUUSD",direzione="BUY",entrata=4183,stop_loss=4173,take_profit=[4187,4195,4199,4203],tipo_ordine=None)),
("buy_now_more_buy", """GOLD BUY NOW
@ 4183
MORE BUY @ 4173
TP : 4202
TP : 4230
SL : 4162""",
 dict(strumento="XAUUSD",direzione="BUY",stop_loss=4162,take_profit=[4202,4230],a_mercato=True,ordini_aggiuntivi=[{"tipo_ordine":"limit","entrata":4173}])),
("buy_now_nudo", """GOLD BUY NOW""",
 dict(strumento="XAUUSD",direzione="BUY",a_mercato=True,stop_loss=None,take_profit=[])),
("sell_now_nudo", """XAUUSD SELL NOW""",
 dict(strumento="XAUUSD",direzione="SELL",a_mercato=True,stop_loss=None,take_profit=[])),
]

ok_tot=0
for nome, testo, atteso in CASI:
    r = P.interpreta(testo)
    if atteso is None:
        esito = r is None
        det = "" if esito else f"letto come {r['direzione']} {r['strumento']}"
    else:
        esito = r is not None
        det = ""
        if r is None:
            det = "NON riconosciuto"
        else:
            for k, v in atteso.items():
                got = r.get(k)
                if isinstance(v, list) and k=="take_profit":
                    got=[float(x) for x in (got or [])]; v=[float(x) for x in v]
                if k=="ordini_aggiuntivi":
                    got=[{kk:(float(vv) if isinstance(vv,(int,float)) else vv) for kk,vv in d.items() if kk in ("tipo_ordine","entrata")} for d in (got or [])]
                    v=[{kk:(float(vv) if isinstance(vv,(int,float)) else vv) for kk,vv in d.items()} for d in v]
                if isinstance(v,(int,float)) and not isinstance(v,bool) and got is not None:
                    try: got=float(got); v=float(v)
                    except: pass
                if got != v:
                    esito=False; det += f" {k}: atteso {v} letto {got};"
    ok_tot += esito
    print(("OK  " if esito else "NO  ")+nome+("  ->"+det if det else ""))
print("\nESITO: tutto ok" if ok_tot == len(CASI) else "\nESITO: %d su %d" % (ok_tot, len(CASI)))
sys.exit(0 if ok_tot == len(CASI) else 1)
