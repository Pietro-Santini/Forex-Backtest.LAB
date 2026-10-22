# -*- coding: utf-8 -*-
"""Prova di controllo: cambiando asset non si esce piu' dal replay."""
import io, os, shutil, subprocess, sys, tempfile

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APP = os.path.join(RADICE, 'app.html')
TEST = os.path.join('app', 'replay_asset.test.mjs')

RIGA = " if(liveReplayActive) esciReplayLive();\r\n // Cambiando asset si esce automaticamente dal replay (e si carica l'ultimo prezzo).\r\n"

with io.open(APP, 'r', encoding='utf-8', newline='') as f:
    originale = f.read()

# The guard line alone
GUARD = " if(liveReplayActive) esciReplayLive();\r\n"

if originale.count(GUARD) != 1:
    print('guard trovata %d volte' % originale.count(GUARD))
    sys.exit(1)

backup = os.path.join(tempfile.gettempdir(), 'app_replay_asset_backup.html')
shutil.copyfile(APP, backup)

try:
    rotto = originale.replace(GUARD, '')
    with io.open(APP, 'w', encoding='utf-8', newline='') as f:
        f.write(rotto)
    print('Difetto introdotto: cambiando asset non si esce dal replay.')
    p = subprocess.run(['node', '--test', TEST], cwd=os.path.join(RADICE, 'laboratorio'),
                       capture_output=True, text=True)
    print('Esito: ' + ('ROSSO (il difetto si vede)' if p.returncode != 0 else 'VERDE (il test non guarda niente!)'))
    for riga in (p.stdout + p.stderr).splitlines():
        if 'fail' in riga and 'pass' in riga:
            print('  ' + riga.strip())
finally:
    shutil.copyfile(backup, APP)
    print('App rimessa a posto.')
