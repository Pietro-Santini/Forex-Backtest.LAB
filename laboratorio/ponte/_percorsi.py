"""Fa trovare ai test i moduli del ponte (installer_build/build) e usa una cartella dati temporanea."""
import os
import sys
import tempfile

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BUILD = os.path.join(RADICE, "installer_build", "build")
sys.path.insert(0, BUILD)
sys.path.insert(0, os.path.join(BUILD, "segnali_telegram"))
# Mai la cartella dati vera dell'utente: ogni esecuzione ha la sua.
os.environ["APPDATA"] = tempfile.mkdtemp(prefix="fbl_collaudo_")

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
