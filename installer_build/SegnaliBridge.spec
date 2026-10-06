# -*- mode: python ; coding: utf-8 -*-
#
# Ponte delle SALE SEGNALI Telegram, impacchettato come eseguibile a se' stante.
#
# Perche' un exe e non i file .py: i sorgenti richiederebbero Python gia' installato sul PC, con
# telethon, fastapi e uvicorn. Su un computer appena formattato non c'e' niente di tutto questo e
# la funzione non partirebbe proprio. Qui dentro c'e' tutto.
#
# console=False: il ponte lo avvia l'app, e non deve far comparire nessuna finestra nera - era
# esattamente il punto della richiesta. Numero di telefono e codice di verifica li chiede l'app
# con un popup e li manda al ponte (vedi _accesso_attendi in segnali_bridge.py): non c'e' piu'
# niente da scrivere in una console.
#
# ATTENZIONE alla cartella dei dati: dentro l'eseguibile __file__ sta nella cartella temporanea in
# cui PyInstaller si scompatta. segnali_bridge.py se ne accorge (getattr(sys, "frozen")) e usa la
# cartella di sys.executable, cioe' quella dove l'exe e' installato: e' li' che devono stare
# configurazione.json e il file di sessione.
from PyInstaller.utils.hooks import collect_all

datas = []
binaries = []
hiddenimports = []
# telethon si porta dietro parecchia roba caricata a runtime (cifratura, TL schema): collect_all
# e' l'unico modo affidabile per non ritrovarsi un exe che parte e poi muore al primo import.
for _pacchetto in ('telethon', 'fastapi', 'uvicorn', 'websockets', 'starlette', 'pydantic', 'rsa'):
    tmp_ret = collect_all(_pacchetto)
    datas += tmp_ret[0]
    binaries += tmp_ret[1]
    hiddenimports += tmp_ret[2]

a = Analysis(
    ['build/segnali_telegram/segnali_bridge.py'],
    # parser_segnali.py sta accanto allo script e viene importato per nome: senza questo percorso
    # PyInstaller non lo troverebbe.
    pathex=['build/segnali_telegram', 'build'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports + ['parser_segnali', 'accesso_condiviso', 'syntra_lettore', 'avvio_bluestacks', 'storico_sale'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='SegnaliBridge',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['build/icon.ico'],
)
