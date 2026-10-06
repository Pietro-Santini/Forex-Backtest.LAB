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
: > "$OUT"
riga "# Collaudo $(date -u '+%Y-%m-%d %H:%M') UTC — commit $(git rev-parse --short HEAD 2>/dev/null)"
riga ""
passo sintassi_app node laboratorio/strumenti/sintassi_app.mjs
passo versione_sw bash -c 'grep -q "forex-backtest-lab-v[0-9]*\"" sw.js'
passo ponte_python python3 -m pytest -q laboratorio/ponte
passo interprete_segnali bash -c 'cd installer_build/build/segnali_telegram && python3 test_parser.py && python3 test_formati_reali.py'
passo app_browser bash -c 'cd laboratorio && node --test --test-concurrency=1 app/*.test.mjs'
grep -h "AVVISO" "$R"/*.log 2>/dev/null | sort -u | sed 's/^/- ⚠️ /' >> "$OUT"
riga ""
riga "Falliti: $FALLITI"
exit $FALLITI
