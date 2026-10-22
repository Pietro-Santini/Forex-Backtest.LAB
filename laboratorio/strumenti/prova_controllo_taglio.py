# -*- coding: utf-8 -*-
"""PROVA DI CONTROLLO del capitolo 7a (registro tick a blocchi).

Il test app/footprint_blocchi.test.mjs deve poter diventare ROSSO. Questo script toglie
dall'app la riga che tiene i blocchi allineati quando il registro si accorcia dalla testa
(l'incremento di 'base'), rilancia il test e rimette tutto com'era.

Se il test resta verde con il difetto introdotto, il test non sta guardando niente.

Uso: python laboratorio/strumenti/prova_controllo_taglio.py
"""
import io
import os
import shutil
import subprocess
import sys
import tempfile

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APP = os.path.join(RADICE, 'app.html')
TEST = os.path.join('app', 'footprint_blocchi.test.mjs')

RIGA_DA_TOGLIERE = "   st.base++;\r\n"

with io.open(APP, 'r', encoding='utf-8', newline='') as f:
    originale = f.read()

if originale.count(RIGA_DA_TOGLIERE) != 1:
    print('La riga da togliere non c\'e\' una volta sola: la prova non ha senso.')
    sys.exit(1)

backup = os.path.join(tempfile.gettempdir(), 'app_7a_backup.html')
shutil.copyfile(APP, backup)

try:
    rotto = originale.replace(RIGA_DA_TOGLIERE, "")
    with io.open(APP, 'w', encoding='utf-8', newline='') as f:
        f.write(rotto)
    print('Difetto introdotto: i blocchi non si rinumerano piu\' quando il registro si accorcia.')
    p = subprocess.run(['node', '--test', TEST], cwd=os.path.join(RADICE, 'laboratorio'),
                       capture_output=True, text=True)
    out = p.stdout + p.stderr
    falliti = out.count('not ok') + out.count('\u2716')
    print('Esito del test col difetto: ' + ('ROSSO (il difetto si vede)' if p.returncode != 0 else 'VERDE (il test non guarda niente!)'))
    for riga in out.splitlines():
        if 'fail' in riga and 'pass' in riga:
            print('  ' + riga.strip())
finally:
    shutil.copyfile(backup, APP)
    print('App rimessa a posto (il difetto introdotto sparisce).')
