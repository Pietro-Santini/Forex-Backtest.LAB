# -*- coding: utf-8 -*-
"""PROVA DI CONTROLLO del punto 4 (margine di chiusura).

Il test app/margine_chiusura.test.mjs deve poter diventare ROSSO. Questo script toglie
dall'app, una alla volta, le due righe che tengono su il meccanismo:

  1. il METRO del fermo col margine: se torna alla forbice del cambio giornata (invece che
     allo spread ordinario), il margine non e' mai "abbastanza lontano" e non scatta mai;
  2. l'ATTESA dei cinque minuti nel ramo del ritorno al pareggio esatto: senza, il giro
     riprova ogni due secondi quando il conto rifiuta.

Rilancia il test dopo ogni difetto e rimette tutto com'era.

Se il test resta verde con il difetto introdotto, il test non sta guardando niente.

Uso: python laboratorio/strumenti/prova_controllo_margine.py
"""
import io
import os
import shutil
import subprocess
import sys
import tempfile

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APP = os.path.join(RADICE, 'app.html')
TEST = os.path.join('app', 'margine_chiusura.test.mjs')

DIFETTI = [
    ('il metro del fermo col margine torna alla forbice (e il margine non scatta mai)',
     " const troppoVicino=(prezzo)=>{ try{ return fblStopTroppoVicino(pos,prezzo,ora,'normale').vicino; }catch(e){ return false; } };",
     " const troppoVicino=(prezzo)=>{ try{ return fblStopTroppoVicino(pos,prezzo,ora,'forbice').vicino; }catch(e){ return false; } };"),
    ('il ritorno al pareggio esatto non aspetta piu\' (il giro insiste ogni due secondi)',
     ' if(fblTroppoPresto(pos,adesso))return fuori;                       // nemmeno qui si insiste a ogni giro\r\n',
     ''),
]


def esegui_test():
    p = subprocess.run(['node', '--test', TEST], cwd=os.path.join(RADICE, 'laboratorio'),
                       capture_output=True, text=True)
    out = p.stdout + p.stderr
    numeri = [r.strip() for r in out.splitlines() if r.strip().startswith('\u2139') or
              (('tests' in r or 'pass' in r or 'fail' in r) and r.strip().startswith('\u2139'))]
    return p.returncode, numeri, out


with io.open(APP, 'r', encoding='utf-8', newline='') as f:
    ORIGINALE = f.read()

backup = os.path.join(tempfile.gettempdir(), 'app_margine_backup.html')
shutil.copyfile(APP, backup)

try:
    for descrizione, da_togliere, da_mettere in DIFETTI:
        if ORIGINALE.count(da_togliere) != 1:
            print('La riga da togliere non c\'e\' una volta sola: la prova non ha senso.')
            print('  (difetto: %s)' % descrizione)
            sys.exit(1)
        rotto = ORIGINALE.replace(da_togliere, da_mettere)
        with io.open(APP, 'w', encoding='utf-8', newline='') as f:
            f.write(rotto)
        print('Difetto introdotto: %s' % descrizione)
        codice, numeri, out = esegui_test()
        esito = 'ROSSO (il difetto si vede)' if codice != 0 else 'VERDE (il test non guarda niente!)'
        print('Esito del test col difetto: ' + esito)
        for riga in numeri:
            print('  ' + riga)
        if codice == 0:
            sys.exit(1)
finally:
    shutil.copyfile(backup, APP)
    print('App rimessa a posto (i difetti introdotti spariscono).')
