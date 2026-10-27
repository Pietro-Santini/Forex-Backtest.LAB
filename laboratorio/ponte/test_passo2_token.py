"""Passo 2 del progetto dati nostri: verifica del token Firebase sul server.

Il server Oracle riceve il token ID di Firebase nell'intestazione
`Authorization: Bearer <token>` e lo verifica (firma JWT contro le chiavi
pubbliche di Google, scadenza, audience = PROJECT_ID). Da lui estrae l'uid.
Nessuna rotta accetta un uid dal client.

Questo test misura il comportamento, non il sorgente:
- un token finto viene rifiutato (401);
- nessun token viene rifiutato (401);
- il nome di un documento non previsto non bypassa il controllo (401);
- la funzione verifica_token_firebase restituisce None per un token finto.
"""
import os
import sys
import sqlite3
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'server_oracle'))
sys.path.insert(0, os.path.join(ROOT, 'installer_build', 'build'))

os.environ['FBL_DATI'] = tempfile.mkdtemp(prefix='fbl_test_')
os.environ['FBL_FIREBASE_PROJECT_ID'] = 'forex-backtest-lab'

import ponte_server as p
from fastapi.testclient import TestClient

client = TestClient(p.app)


def test_token_finto_rifiutato():
    r = client.get('/dati/session', headers={'Authorization': 'Bearer finto.token.here'})
    assert r.status_code == 401, 'token finto deve dare 401, ha dato %s' % r.status_code


def test_senza_token_rifiutato():
    r = client.get('/dati/session')
    assert r.status_code == 401, 'senza token deve dare 401, ha dato %s' % r.status_code


def test_token_finto_non_bypassa_validazione_documento():
    r = client.get('/dati/foo', headers={'Authorization': 'Bearer finto.token.here'})
    assert r.status_code == 401, 'il controllo del token viene prima della validazione del nome'


def test_verifica_token_finto_restituisce_none():
    assert p.verifica_token_firebase('finto.token.here') is None


def test_verifica_token_vuoto_restituisce_none():
    assert p.verifica_token_firebase('') is None


def test_project_id_corretto():
    assert p.FIREBASE_PROJECT_ID == 'forex-backtest-lab'


def test_db_crea_tabelle():
    conn = p._db_conn()
    tabelle = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    assert 'documenti' in tabelle
    assert 'trades' in tabelle
    conn.close()
