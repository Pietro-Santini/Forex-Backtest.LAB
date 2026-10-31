"""Fa trovare ai test i moduli del ponte (installer_build/build) e usa una cartella dati temporanea."""
import os
import sys
import tempfile

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BUILD = os.path.join(RADICE, "installer_build", "build")
sys.path.insert(0, BUILD)
sys.path.insert(0, os.path.join(BUILD, "segnali_telegram"))
# ATTENZIONE (31 ottobre 2026): l'APPDATA VERO si conserva PRIMA di sostituirlo.
# Un test che lancia un processo Python a parte (test_nomi_documenti_server.py) lo
# ereditava sostituito: su Windows le librerie installate per l'utente stanno in
# %APPDATA%\Python\Python314\site-packages, quindi quel processo non trovava piu'
# fastapi e cadeva con "No module named 'fastapi'". Il difetto si vedeva SOLO
# quando girava tutta la cartella, per colpa dell'ordine alfabetico:
# test_esci_telegram importa questo file prima di lui. Su GitHub le librerie
# sono di sistema e il difetto non si vedeva (verde la', rosso a casa).
os.environ.setdefault("FBL_APPDATA_ORIGINALE", os.environ.get("APPDATA", ""))
# Mai la cartella dati vera dell'utente: ogni esecuzione ha la sua.
os.environ["APPDATA"] = tempfile.mkdtemp(prefix="fbl_collaudo_")


def env_pulito():
    """Ambiente per un processo Python lanciato a parte dai test.

    Una cosa sola cambia: l'APPDATA torna quello VERO, perche' un processo Python
    nuovo deve trovare le librerie installate per l'utente. Il resto passa come
    sta: i test ci mettono le loro cartelle dati (FBL_DATI, FBL_SEGNALI_DATI).
    """
    env = dict(os.environ)
    vero = os.environ.get("FBL_APPDATA_ORIGINALE")
    if vero:
        env["APPDATA"] = vero
    return env

# Nessuna connessione verso l'esterno durante i test: il simulatore Kraken, appena creato, prova a
# scaricare i prezzi VERI. Su GitHub internet c'e' e il prezzo reale di BTC faceva scattare i TP
# finti (test verdi sul PC, rossi su GitHub). Solo indirizzi locali.
import socket

_connetti = socket.socket.connect


def _solo_locale(self, indirizzo):
    host = indirizzo[0] if isinstance(indirizzo, tuple) else indirizzo
    if host not in ("127.0.0.1", "localhost", "::1") and not str(host).startswith("/"):
        raise OSError("collaudo: rete esterna bloccata (" + str(host) + ")")
    return _connetti(self, indirizzo)


socket.socket.connect = _solo_locale
