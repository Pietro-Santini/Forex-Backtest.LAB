# -*- coding: utf-8 -*-
"""Punto 4, quarta parte: lo stop col margine va arrotondato alla griglia del prezzo.

1,08500 + 0,00500 fa 1,0899999999999999 in virgola mobile. Lo stop che va al broker non puo'
essere un numero cosi': viene arrotondato alle cifre del prezzo dello strumento (quelle che
dice il conto MT5), cosi' come fa gia' mt5PrezzoPareggio per il pareggio esatto.
"""
import io
import sys

PERCORSO = 'app.html'

with io.open(PERCORSO, 'r', encoding='utf-8', newline='') as f:
    testo = f.read()


def ferma(messaggio):
    print('FERMATO: ' + messaggio)
    sys.exit(1)


def sost(testo, vecchio, nuovo, nome):
    quante = testo.count(vecchio)
    if quante != 1:
        ferma('%s: pezzo trovato %d volte (atteso 1)' % (nome, quante))
    return testo.replace(vecchio, nuovo)


testo = sost(
    testo,
    " const prezzo=(pos.side==='BUY')?esatto-margine:esatto+margine;",
    " // Lo stop va arrotondato alla griglia del prezzo: 1,08500 + 0,00500 fa 1,0899999999999999,\n"
    " // e uno stop cosi' non e' un prezzo che il broker possa accettare.\n"
    " const cifre=(()=>{ try{ const rp=(mt5RealPositions||[]).find(x=>String(x.ticket)===String(pos.mt5Ticket));\n"
    "  if(rp&&Number.isFinite(Number(rp.digits)))return Number(rp.digits);\n"
    "  const i=currentInstrument(asset); return Number.isFinite(i.decimals)?i.decimals:5; }catch(e){ return 5; } })();\n"
    " const prezzo=Number(((pos.side==='BUY')?esatto-margine:esatto+margine).toFixed(cifre));",
    'margine arrotondato alla griglia del prezzo')

with io.open(PERCORSO, 'w', encoding='utf-8', newline='') as f:
    f.write(testo)

print('Fatto: lo stop col margine e\' arrotondato alle cifre del prezzo.')
