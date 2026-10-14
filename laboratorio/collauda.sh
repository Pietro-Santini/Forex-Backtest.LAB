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
  # Quanto ci mette ogni passo finisce nel riassunto: il problema si deve vedere PRIMA che diventi
  # un collaudo annullato (vedi il commento su app_browser piu' sotto).
  local t0=$SECONDS
  if "$@" > "$R/$nome.log" 2>&1; then riga "- ✅ $nome ($((SECONDS-t0))s)"; else
    riga "- ❌ $nome ($((SECONDS-t0))s, vedi risultati/$nome.log)"; FALLITI=$((FALLITI+1))
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
# I TEST DEL BROWSER GIRANO IN PARALLELO, quattro file per volta.
#
# Erano a --test-concurrency=1 dal primo giorno del laboratorio, senza una ragione scritta da
# nessuna parte. Nel frattempo sono diventati 370 in 86 file, e ognuno apre il PROPRIO Chromium e
# aspetta 2,5 secondi fissi che l'app sia pronta: in fila fanno ~18 minuti, di cui ~15 passati solo
# ad aspettare. Il 14 ottobre 2026 il collaudo su GitHub e' stato ANNULLATO al tetto dei 20 minuti
# a meta' di questo passo: i primi quattro passavano, il quinto veniva troncato.
#
# Si puo' parallelizzare perche' i test sono DAVVERO isolati: ognuno lancia un browser suo e una
# pagina sua (vedi apriApp in app/aiuti.mjs), quindi non condividono ne' stato, ne' memoria del
# browser, ne' file. Misurato PRIMA di cambiarlo: 370 test, 0 falliti, 5 minuti e 25 invece di 18.
# node:test parallelizza per FILE (un processo ciascuno); dentro un file i test restano in fila.
passo app_browser bash -c 'cd laboratorio && node --test --test-concurrency=4 app/*.test.mjs'
grep -h "AVVISO" "$R"/*.log 2>/dev/null | sort -u | sed 's/^/- ⚠️ /' >> "$OUT"
riga ""
riga "Falliti: $FALLITI"
exit $FALLITI
