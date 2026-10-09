#!/usr/bin/env bash
# Collaudo completo di Forex Backtest LAB. Uso: bash laboratorio/collauda.sh
# Esce con 0 solo se TUTTO passa. Riassunto in laboratorio/risultati/ultimo.md.
set -u
cd "$(dirname "$0")/.."
R=laboratorio/risultati; mkdir -p "$R"
OUT="$R/ultimo.md"; FALLITI=0
riga(){ echo "$1" | tee -a "$OUT"; }
passo(){ # nome, comando...
  local nome="$1"; shift
  if "$@" > "$R/$nome.log" 2>&1; then riga "- ✅ $nome"; else
    riga "- ❌ $nome (vedi risultati/$nome.log)"; FALLITI=$((FALLITI+1))
    # Il dettaglio va anche a schermo: su GitHub il log del flusso e' l'unico posto dove si legge subito.
    echo "----- ultime righe di $nome.log -----" >&2; tail -40 "$R/$nome.log" >&2; echo "-----" >&2
  fi
}
# Quale Python usare. Su Linux e su GitHub e' python3 e finisce qui. Su Windows python3 puo'
# essere il segnaposto del Microsoft Store, un interprete diverso da quello con le librerie: in
# quel caso si prova python e poi py, e si prende il primo che ha pytest.
PY=python3
if ! "$PY" -c "import pytest" >/dev/null 2>&1; then
  for _c in python py; do
    if command -v "$_c" >/dev/null 2>&1 && "$_c" -c "import pytest" >/dev/null 2>&1; then PY="$_c"; break; fi
  done
fi

: > "$OUT"
riga "# Collaudo $(date -u '+%Y-%m-%d %H:%M') UTC — commit $(git rev-parse --short HEAD 2>/dev/null)"
riga ""
passo sintassi_app node laboratorio/strumenti/sintassi_app.mjs
passo versione_sw bash -c 'grep -q "forex-backtest-lab-v[0-9]*\"" sw.js'
passo ponte_python "$PY" -m pytest -q laboratorio/ponte
passo interprete_segnali bash -c 'cd installer_build/build/segnali_telegram && "$0" test_parser.py && "$0" test_formati_reali.py && "$0" test_syntra_audcad.py' "$PY"
passo app_browser bash -c 'cd laboratorio && node --test --test-concurrency=1 app/*.test.mjs'
grep -h "AVVISO" "$R"/*.log 2>/dev/null | sort -u | sed 's/^/- ⚠️ /' >> "$OUT"
riga ""
riga "Falliti: $FALLITI"
exit $FALLITI
