# -*- coding: utf-8 -*-
"""Prova di controllo per il fix dello STOP che conserva la formazione."""
import io, os, shutil, subprocess, sys, tempfile

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APP = os.path.join(RADICE, 'app.html')
TEST = os.path.join('app', 'replay_stop.test.mjs')

RIGA = "if(timer){clearInterval(timer);timer=null;$('play').textContent='▶ PLAY';try{draw();}catch(e){} $('status').textContent='Play in pausa.';return;}"

with io.open(APP, 'r', encoding='utf-8', newline='') as f:
    originale = f.read()

assert originale.count(RIGA) == 1, 'riga non trovata una volta sola'

backup = os.path.join(tempfile.gettempdir(), 'app_replay_stop_backup.html')
shutil.copyfile(APP, backup)

try:
    rotto = originale.replace(RIGA, "if(timer){clearInterval(timer);timer=null;$('play').textContent='▶ PLAY';replayForm=null;try{draw();}catch(e){} $('status').textContent='Play in pausa.';return;}")
    with io.open(APP, 'w', encoding='utf-8', newline='') as f:
        f.write(rotto)
    print('Difetto introdotto: STOP azzera la formazione.')
    p = subprocess.run(['node', '--test', TEST], cwd=os.path.join(RADICE, 'laboratorio'),
                       capture_output=True, text=True)
    print('Esito: ' + ('ROSSO (il difetto si vede)' if p.returncode != 0 else 'VERDE (il test non guarda niente!)'))
    for riga in (p.stdout + p.stderr).splitlines():
        if 'fail' in riga and 'pass' in riga:
            print('  ' + riga.strip())
finally:
    shutil.copyfile(backup, APP)
    print('App rimessa a posto.')
