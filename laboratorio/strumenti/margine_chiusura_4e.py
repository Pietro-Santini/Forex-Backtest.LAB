# -*- coding: utf-8 -*-
"""Punto 4, quinta parte: il ritorno al pareggio esatto non deve insistere ogni due secondi.

Il giro automatico gira dentro il polling MT5, che passa ogni due secondi. Fin qui l'attesa di
cinque minuti era scritta solo per il ramo "margine": se il conto rifiutava il RITORNO al pareggio
esatto, il giro successivo riprovava due secondi dopo, per tutta la sessione. Lo stesso difetto
che era gia' stato corretto per un ramo, ripetuto nell'altro.

La correzione: un solo punto che decide "ora non si insiste", usato da entrambi i rami.

Le righe toccate sono prese dal file cosi' com'e' (riga per riga): il numero di spazi e' quello
vero, non quello che si vede.
"""
import io
import sys

PERCORSO = 'app.html'

with io.open(PERCORSO, 'r', encoding='utf-8', newline='') as f:
    testo = f.read()

righe = testo.split('\r\n')


def ferma(messaggio):
    print('FERMATO: ' + messaggio)
    sys.exit(1)


def indice_che_contiene(frammento, nome):
    trovati = [i for i, r in enumerate(righe) if frammento in r]
    if len(trovati) != 1:
        ferma('%s: riga trovata %d volte (atteso 1)' % (nome, len(trovati)))
    return trovati[0]


# 1) il metro dell'attesa, in un punto solo, subito prima della funzione che decide
i = indice_che_contiene('function fblPareggioChiusuraDecide(pos,t){', 'funzione che decide')
righe = righe[:i] + [
    '// NON SI INSISTE A OGNI GIRO. Il polling MT5 passa ogni due secondi: se il conto non prende',
    '// lo stop, il tentativo si ricorda (anche quello fallito) e si riprova ogni cinque minuti.',
    'function fblTroppoPresto(pos,adesso){',
    ' const tentativo=Number.isFinite(pos.beChiusuraTentativo)?pos.beChiusuraTentativo:0;',
    ' return !!(tentativo&&(adesso-tentativo)<5*60000);',
    '}',
] + righe[i:]

# 2) il ramo del margine usa il metro unico (e sparisce il commento doppio)
i = indice_che_contiene('// Non si insiste a ogni giro (due secondi)', 'commento del ramo margine')
if 'Il tentativo si ricorda anche se fallisce' not in righe[i + 2]:
    ferma("commento del ramo margine: la seconda riga non e' quella attesa")
if 'const tentativo=Number.isFinite(pos.beChiusuraTentativo)' not in righe[i + 4]:
    ferma("commento del ramo margine: la riga del tentativo non e' quella attesa")
if 'if(tentativo&&(adesso-tentativo)<5*60000)return fuori;' not in righe[i + 5]:
    ferma("commento del ramo margine: la riga dell'attesa non e' quella attesa")
righe = righe[:i] + [
    '  if(fblTroppoPresto(pos,adesso))return fuori;   // non si insiste a ogni giro (due secondi)',
] + righe[i + 6:]

# 3) il ramo del ritorno al pareggio esatto usa lo stesso metro
i = indice_che_contiene('if(troppoVicino(esatto))return fuori;', 'ritorno: troppo vicino')
if 'if(oltre(esatto))return fuori;' not in righe[i + 1]:
    ferma('ritorno: la riga dell\'oltre non e\' quella attesa')
righe = righe[:i + 2] + [
    ' if(fblTroppoPresto(pos,adesso))return fuori;                       // nemmeno qui si insiste a ogni giro',
] + righe[i + 2:]

with io.open(PERCORSO, 'w', encoding='utf-8', newline='') as f:
    f.write('\r\n'.join(righe))

print('Fatto: anche il ritorno al pareggio aspetta cinque minuti.')
