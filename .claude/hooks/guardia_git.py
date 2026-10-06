#!/usr/bin/env python3
"""Ferma i comandi git pericolosi (cervello/REGOLE.md).

Pubblicare su main e' permesso (decisione del proprietario, 6 ottobre 2026) SOLO con il collaudo
verde da meno di 30 minuti: laboratorio/risultati/ultimo.md deve dire "Falliti: 0".
Si controlla solo un vero comando "git push" (non il testo dentro echo o file).
"""
import json, os, re, sys, time
try:
    cmd = (json.load(sys.stdin).get("tool_input") or {}).get("command") or ""
except Exception:
    sys.exit(0)

# Solo i comandi che iniziano davvero con git (anche dopo && ; |): il testo dentro echo,
# heredoc o stringhe non e' un push.
comandi = [c.strip() for c in re.split(r"&&|\|\||;|\n", cmd)]
git_veri = [c for c in comandi if re.match(r"^(sudo\s+)?git\s", c)]

for c in git_veri:
    if re.match(r"^(sudo\s+)?git\s+push\b.*(\s--force(-with-lease)?\b|\s-f\b)", c):
        print("Bloccato (niente push forzati). Vedi cervello/REGOLE.md.", file=sys.stderr)
        sys.exit(2)
    if re.match(r"^(sudo\s+)?git\s+reset\s+--hard", c):
        print("Bloccato (niente reset --hard: si perdono modifiche). Vedi cervello/REGOLE.md.", file=sys.stderr)
        sys.exit(2)
    if re.match(r"^(sudo\s+)?git\s+push\b", c) and re.search(r"(\s|:)main\b", c):
        radice = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
        f = os.path.join(radice, "laboratorio", "risultati", "ultimo.md")
        try:
            verde = "Falliti: 0" in open(f, encoding="utf-8").read() and time.time() - os.path.getmtime(f) < 1800
        except OSError:
            verde = False
        if not verde:
            print("Bloccato: su main si pubblica solo con il collaudo verde da meno di 30 minuti. "
                  "Lancia prima: bash laboratorio/collauda.sh", file=sys.stderr)
            sys.exit(2)
