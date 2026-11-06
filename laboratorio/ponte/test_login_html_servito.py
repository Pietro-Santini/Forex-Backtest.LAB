"""Il ponte locale serve anche login.html, non solo app.html e sw.js.

DIFETTO DEL 6 NOVEMBRE 2026: app.html fa `location.replace('login.html')` quando l'utente non è
autenticato (o esce dall'account). Il ponte serviva SOLO '/' (app.html) e '/sw.js', quindi
'/login.html' rispondeva 404 ('{"detail":"Not Found"}') e l'utente restava chiuso fuori — anche
dopo aver copiato login.html nella cartella del programma, perché il ponte serve da
`_CARTELLA_APP` (app_aggiornata), non dalla cartella dell'eseguibile.

QUESTO TEST MISURA IL COMPORTAMENTO, in un processo ISOLATO (il modulo bridge resta in cache
fra i file di test): GET /login.html deve rispondere 200 con HTML."""
import os
import sys
import subprocess
import tempfile
import pathlib

import _percorsi  # noqa: F401  (mette i moduli del ponte nel percorso e prepara env_pulito)


ROOT = pathlib.Path(__file__).resolve().parents[2]


def _esegui(script):
    proc = subprocess.run([sys.executable, '-c', script, str(ROOT)],
                          capture_output=True, text=True, timeout=120,
                          env=_percorsi.env_pulito())
    # Il ponte, all'uscita del processo di test, può terminare con codice 1 per un dettaglio di
    # spegnimento (custode/thread): non è un fallimento del comportamento provato. La prova vera è
    # la stampa 'OK' del copione, che arriva solo se GET /login.html ha risposto 200 con HTML.
    assert "OK" in (proc.stdout or ""), ('il test comportamentale non è passato:\n' + proc.stderr
                                          + (('\nstdout: ' + proc.stdout) if proc.stdout else ''))
    return proc.stdout


def test_login_html_servito_dal_ponte():
    script = r'''
import os, sys, tempfile
os.environ["FBL_DATI"] = tempfile.mkdtemp(prefix="fbl_test_")
os.environ["FBL_FIREBASE_PROJECT_ID"] = "forex-backtest-lab"
ROOT = sys.argv[1]
sys.path.insert(0, ROOT + "/server_oracle")
sys.path.insert(0, ROOT + "/installer_build/build")
import bridge as b
from fastapi.testclient import TestClient
client = TestClient(b.app)
r = client.get("/login.html")
assert r.status_code == 200, "GET /login.html rifiutata: %s %s" % (r.status_code, r.text)
ct = r.headers.get("content-type", "")
assert "text/html" in ct, "content-type sbagliato: %s" % ct
assert "<html" in r.text.lower(), "la risposta non sembra HTML"
print("OK")
'''
    assert "OK" in _esegui(script)