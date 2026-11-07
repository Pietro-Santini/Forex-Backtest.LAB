# NESSUN FILE PYTHON DEVE ARRIVARE SU GITHUB CON UN ERRORE DI SINTASSI.
#
# MISURATO il 7 novembre 2026: una modifica a desktop/desktop_shell.py conteneva commenti
# scritti con la barra doppia (abitudine da JavaScript). Il flusso "Installer Windows" su
# GitHub e' diventato ROSSO - PyInstaller non riusciva nemmeno ad analizzare il file - e la
# release non e' uscita. In locale nessuno se ne era accorto, perche' NESSUN passo del collaudo
# compilava quel file: la prova girava solo sui file di laboratorio/ponte.
#
# E il danno non era solo la release saltata: chi aveva premuto "Aggiorna" in quelle ore
# avrebbe trovato il pulsante che non portava a niente.
#
# DA QUI IN AVANTI: ogni file .py del repository (il ponte, il guscio desktop, gli strumenti)
# viene COMPILATO, non letto. Un errore di sintassi e' rosso qui, in 2 secondi, invece che
# dopo 3 minuti di build su GitHub.
import pathlib
import py_compile
import tempfile

import pytest

RADICE = pathlib.Path(__file__).resolve().parents[2]

# Le cartelle da controllare. Esclusi i venv e le cache: sono generate, non scritte da noi.
CARTELLE = ["desktop", "installer_build/build", "laboratorio/ponte", "server_oracle"]


def _file_python():
    fuori = []
    for cartella in CARTELLE:
        base = RADICE / cartella
        if not base.is_dir():
            continue
        for f in sorted(base.rglob("*.py")):
            parti = set(f.parts)
            if any(p in parti for p in ("venv", "__pycache__", "build_exe_output", "node_modules")):
                continue
            fuori.append(f)
    assert fuori, "non ho trovato nessun file .py da controllare: il percorso e' cambiato?"
    return fuori


@pytest.mark.parametrize("percorso", _file_python(), ids=lambda p: str(p.relative_to(RADICE)))
def test_il_file_python_compila(percorso):
    with tempfile.TemporaryDirectory() as tmp:
        py_compile.compile(str(percorso), cfile=str(pathlib.Path(tmp) / "out.pyc"), doraise=True)
