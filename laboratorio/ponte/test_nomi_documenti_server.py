"""I documenti che il server Oracle tiene: footprint deve essere accolto, il resto rifiutato.

DIFETTO CURATO il 31 ottobre 2026, trovato leggendo il server mentre si pubblicava la cura del
footprint: `ponte_server.py` accettava solo ("session", "grafico", "collegamento", "preferenze").
Quando la cura ha spostato il footprint in users/{uid}/data/footprint, il server lo RIFIUTAVA con
400 - e la scrittura finiva nel `catch` del client, in silenzio. Il risparmio restava a metà.

QUESTO TEST MISURA IL COMPORTAMENTO, non l'elenco scritto nel sorgente: chiama le rotte davvero,
in un processo ISOLATO (perché il modulo ponte_server resta in cache fra i file di test, e un
modulo in cache ha il codice vecchio - la lezione del 28 ottobre), con l'identità sostituita (il
token vero non si può fingere), e guarda i codici di risposta.
"""
import os
import re
import sys
import subprocess
import tempfile
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]


def _esegui(script):
    """Un processo a parte, perché il modulo ponte_server resta in cache fra i file di test:
    se un test precedente lo ha importato con un codice più vecchio, qui vedremmo quello. Un
    processo fresco parte sempre dal file corrente."""
    proc = subprocess.run([sys.executable, '-c', script, str(ROOT)],
                          capture_output=True, text=True, timeout=120)
    assert proc.returncode == 0, ('il test comportamentale non è passato:\n' + proc.stderr
                                 + (('\nstdout: ' + proc.stdout) if proc.stdout else ''))
    return proc.stdout


def test_il_documento_footprint_viene_accolto_su_tutte_le_rotte():
    script = r'''
import os, sys, tempfile, json
os.environ["FBL_DATI"] = tempfile.mkdtemp(prefix="fbl_test_")
os.environ["FBL_FIREBASE_PROJECT_ID"] = "forex-backtest-lab"
ROOT = sys.argv[1]
sys.path.insert(0, ROOT + "/server_oracle")
sys.path.insert(0, ROOT + "/installer_build/build")
import ponte_server as p
from fastapi.testclient import TestClient
client = TestClient(p.app)
p.app.dependency_overrides[p._uid_dep] = lambda: "utente-di-prova"
celle = {"XAUUSD": {"1700000000": [[4000, 10, 9, 1]]}}
r = client.get("/dati/footprint")
assert r.status_code == 200, "GET su footprint rifiutata: %s %s" % (r.status_code, r.text)
r = client.put("/dati/footprint", json={"contenuto": celle})
assert r.status_code == 200, "PUT su footprint rifiutata: %s %s" % (r.status_code, r.text)
r = client.get("/dati/footprint")
assert r.status_code == 200 and r.json().get("contenuto") == celle, "dopo la scrittura il footprint si deve rileggere uguale"
r = client.patch("/dati/footprint", json={"contenuto": {"EURUSD": {}}})
assert r.status_code == 200, "PATCH su footprint rifiutata: %s %s" % (r.status_code, r.text)
print("OK")
'''
    _esegui(script)


def test_un_nome_non_previsto_viene_rifiutato():
    script = r'''
import os, sys, tempfile
os.environ["FBL_DATI"] = tempfile.mkdtemp(prefix="fbl_test_")
os.environ["FBL_FIREBASE_PROJECT_ID"] = "forex-backtest-lab"
ROOT = sys.argv[1]
sys.path.insert(0, ROOT + "/server_oracle")
sys.path.insert(0, ROOT + "/installer_build/build")
import ponte_server as p
from fastapi.testclient import TestClient
client = TestClient(p.app)
p.app.dependency_overrides[p._uid_dep] = lambda: "utente-di-prova"
for nome in ("password", "session-2", "footprint-2"):
    r = client.get("/dati/" + nome)
    assert r.status_code == 400, "il documento %r dev'essere rifiutato con 400, ha dato %s" % (nome, r.status_code)
r = client.get("/dati/")
assert r.status_code in (400, 404), "senza nome la richiesta dev'essere rifiutata, ha dato %s" % r.status_code
print("OK")
'''
    _esegui(script)


def test_lelenco_dei_nomi_e_uno_solo():
    sorg = (ROOT / 'server_oracle' / 'ponte_server.py').read_text(encoding='utf-8')
    assert 'NOMI_DOCUMENTI = (' in sorg, 'deve esistere UNA lista dei nomi ammessi'
    assert sorg.count('if nome not in NOMI_DOCUMENTI:') >= 3, \
        'le tre rotte /dati devono tutte controllare la stessa lista'
    assert 'if nome not in (' not in sorg, \
        'il controllo del nome deve usare NOMI_DOCUMENTI, non un elenco scritto nelle rotte'


def test_il_primo_nome_resta_session():
    import importlib
    os.environ['FBL_DATI'] = tempfile.mkdtemp(prefix='fbl_test_')
    os.environ['FBL_FIREBASE_PROJECT_ID'] = 'forex-backtest-lab'
    sys.path.insert(0, str(ROOT / 'server_oracle'))
    sys.path.insert(0, str(ROOT / 'installer_build' / 'build'))
    import ponte_server as p
    p = importlib.reload(p)
    assert p.NOMI_DOCUMENTI[0] == 'session'
    assert 'footprint' in p.NOMI_DOCUMENTI