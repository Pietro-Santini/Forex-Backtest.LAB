# -*- coding: utf-8 -*-
"""PROVA DI CONTROLLO del capitolo 7b (cronometri di sezione dentro draw()).

Il test app/cronometri_disegno.test.mjs deve poter diventare ROSSO. Questo script introduce
due difetti, uno per volta, rilancia il test e rimette tutto com'era:

  A) il cronometro non accumula niente (misura zero)        -> i casi 1 e 3 devono cadere
  B) la misura non riporta le sezioni nel risultato         -> il caso 3 deve cadere

Se con un difetto il test resta verde, quel test non sta guardando niente.

Uso: python laboratorio/strumenti/prova_controllo_cronometri.py
"""
import io
import os
import shutil
import subprocess
import tempfile

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APP = os.path.join(RADICE, 'app.html')
TEST = os.path.join('app', 'cronometri_disegno.test.mjs')

DIFETTI = [
    ('A) il cronometro non accumula niente (misura zero)',
     " fblSezioniDraw[nome]=(fblSezioniDraw[nome]||0)+(ora-t0);\r\n"),
    ('B) la misura non riporta le sezioni nel risultato',
     "    r.sezioniDelDisegno_ms=sezioni.map(x=>x[0]+'='+x[1]).join('  ');\r\n"),
]

with io.open(APP, 'r', encoding='utf-8', newline='') as f:
    originale = f.read()

backup = os.path.join(tempfile.gettempdir(), 'app_7b_backup.html')
shutil.copyfile(APP, backup)

try:
    for titolo, riga in DIFETTI:
        if originale.count(riga) != 1:
            print('La riga del difetto %s non c\'e\' una volta sola: la prova non ha senso.' % titolo)
            continue
        with io.open(APP, 'w', encoding='utf-8', newline='') as f:
            f.write(originale.replace(riga, ''))
        print('Difetto introdotto: %s' % titolo)
        p = subprocess.run(['node', '--test', TEST], cwd=os.path.join(RADICE, 'laboratorio'),
                           capture_output=True, text=True, encoding='utf-8', errors='replace')
        out = p.stdout + p.stderr
        rosso = p.returncode != 0
        print('  Esito del test col difetto: ' + ('ROSSO (il difetto si vede)' if rosso else 'VERDE (il test non guarda niente!)'))
        for r in out.splitlines():
            r = r.encode('ascii', 'replace').decode('ascii').strip()
            if r.startswith('?') and ('cronometr' in r or 'misura' in r or 'disegno' in r):
                print('  ' + r[:150])
            elif 'fail' in r and 'pass' in r:
                print('  ' + r[:150])
finally:
    shutil.copyfile(backup, APP)
    print('App rimessa a posto (i difetti introdotti spariscono).')
