#!/usr/bin/env bash
# All'avvio di ogni sessione: librerie del banco di prova (solo se mancano) e promemoria del cervello.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
python3 -c "import pytest, fastapi" 2>/dev/null || pip install -q pytest fastapi pydantic httpx >/dev/null 2>&1
echo "Progetto con memoria: leggi cervello/LEGGIMI.md e cervello/REGOLE.md prima di lavorare."
echo "Ultimo giro registrato: $(grep -E '^- [0-9]{4}-' cervello/DIARIO.md 2>/dev/null | tail -1)"
exit 0
