#!/usr/bin/env python3
"""Ferma i comandi git che gli agenti non devono mai fare da soli (cervello/REGOLE.md)."""
import json, re, sys
try:
    cmd = (json.load(sys.stdin).get("tool_input") or {}).get("command") or ""
except Exception:
    sys.exit(0)
vietati = [
    (r"git\s+push\b.*(--force|-f\b|--force-with-lease)", "niente push forzati"),
    (r"git\s+push\b[^|;&]*\b(origin\s+)?(HEAD:)?main\b", "nessun agente pubblica su main: lo decide il proprietario"),
    (r"git\s+reset\s+--hard", "niente reset --hard: si perdono modifiche"),
]
for schema, motivo in vietati:
    if re.search(schema, cmd):
        print("Bloccato (" + motivo + "). Vedi cervello/REGOLE.md.", file=sys.stderr)
        sys.exit(2)
