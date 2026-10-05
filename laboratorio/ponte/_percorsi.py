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
