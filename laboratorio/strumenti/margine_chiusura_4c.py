# -*- coding: utf-8 -*-
"""Punto 4, terza parte: i due pulsanti BE accettano il tempo.

Fin qui il tempo lo prendeva l'orologio (`fblPareggioPerStop(pos)` senza tempo), e quindi
nello stop scattato dal pulsante non si poteva sapere se il margine di chiusura sarebbe
entrato o no: si poteva solo misurarlo davanti al rollover vero, che non si puo' fare in un
test. Con il tempo passato dentro, il pulsante si puo' provare: stesso codice, stesso
comportamento, un orologio che non e' quello della parete.

Cambia solo la firma: `applyBreakevenToPosition(pos)` e `applyBreakevenToMt5TicketDirect(ticket)`
continuano a funzionare come prima (il tempo, se manca, e' l'ora vera).
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
    "function applyBreakevenToPosition(pos){",
    "function applyBreakevenToPosition(pos,t){",
    'firma: BE sulla posizione')

testo = sost(
    testo,
    " const scelta=fblPareggioPerStop(pos);",
    " const scelta=fblPareggioPerStop(pos,t);",
    'tempo: BE sulla posizione')

testo = sost(
    testo,
    "async function applyBreakevenToMt5TicketDirect(ticket){",
    "async function applyBreakevenToMt5TicketDirect(ticket,t){",
    'firma: BE diretto sul ticket')

testo = sost(
    testo,
    " const scelta=fblPareggioPerStop(finta);",
    " const scelta=fblPareggioPerStop(finta,t);",
    'tempo: BE diretto sul ticket')

with io.open(PERCORSO, 'w', encoding='utf-8', newline='') as f:
    f.write(testo)

print('Fatto: i due pulsanti BE accettano il tempo.')
