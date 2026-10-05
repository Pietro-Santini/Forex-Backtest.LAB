#!/usr/bin/env python3
"""Dopo ogni modifica a app.html controlla la sintassi: un errore = app bianca per tutti."""
import json, os, subprocess, sys
try:
    dati = json.load(sys.stdin)
except Exception:
    sys.exit(0)
f = (dati.get("tool_input") or {}).get("file_path") or ""
if not f.endswith("app.html"):
    sys.exit(0)
radice = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
r = subprocess.run(["node", os.path.join(radice, "laboratorio", "strumenti", "sintassi_app.mjs"), f],
                   capture_output=True, text=True)
if r.returncode != 0:
    print("app.html non si compila più:\n" + r.stdout, file=sys.stderr)
    sys.exit(2)   # il messaggio torna all'agente, che deve correggere subito
