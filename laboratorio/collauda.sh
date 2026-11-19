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
    # QUALI test sono falliti, per nome. Misurato il 18 ottobre 2026: la run di GitHub
    # 39063565232 e' caduta con 1 test su 506 e il log visibile NON conteneva il "not ok"
    # (GitHub tronca i log lunghi in fondo): senza queste righe un collaudo rosso non
    # dice mai il nome del colpevole, e bisogna indovinare. Qui il log completo c'e'.
    if grep -qE '^[[:space:]]*not ok ' "$R/$nome.log" 2>/dev/null; then
      echo "----- test falliti in $nome.log -----" >&2
      grep -E '^[[:space:]]*not ok ' "$R/$nome.log" | head -30 >&2
      echo "-----" >&2
    fi
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
passo versione_sw bash -c 'grep -q "forex-backtest-lab-v[0-9][0-9.]*\"" sw.js'
# LA VERSIONE DENTRO app.html DEVE COMBACIARE CON QUELLA DI sw.js (13 novembre 2026).
# Per trentuno versioni `const FBL_VERSIONE` e' rimasta a 2.2.12 mentre sw.js saliva: il
# pannello prestazioni e il pannello «che versione sto usando» - che esiste APPOSTA per
# capire quale copia gira - stampavano un numero falso. Non ha rotto l'aggiornamento (il
# ponte legge sw.js), ha rotto la DIAGNOSI: ci sono volute due ore per scoprire che il
# proprietario era aggiornato e il numero no.
passo versione_app_html bash -c '
  SW=$(sed -n "s/.*forex-backtest-lab-v\([0-9.]*\)\".*//p" sw.js | head -1)
  APP=$(sed -n "s/.*const FBL_VERSIONE=.\([0-9.]*\).;.*//p" app.html | head -1)
  if [ "$SW" != "$APP" ]; then
    echo "sw.js dice $SW ma app.html dice $APP: la versione stampata dai pannelli sarebbe falsa"
    exit 1
  fi'
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
# QUANTI IN PARALLELO LO DICE LA MACCHINA, NON UN NUMERO SCRITTO A MANO (19 novembre 2026).
#
# SEGNALATO dal proprietario: «e' diventato un impazzimento, devo aspettare sempre 30 minuti per
# pubblicare una modifica». MISURATO sul suo PC: 4 in parallelo su una macchina con 14 processori
# usavano meno di un terzo della macchina, e il blocco durava ~24 minuti; con 10 in parallelo lo
# stesso blocco ha chiuso in 10 minuti e 27 secondi.
#
# Qui il numero si calcola: tanti quanti i processori, con un tetto di 10 (oltre, su questi test
# che aprono un Chromium ciascuno, si comincia a pagare in memoria invece di guadagnare tempo) e
# un minimo di 2. Sul runner di GitHub, che di processori ne ha quattro, resta 4 come prima:
# li' il collaudo non si salva con il parallelismo ma con il tetto di tempo del flusso, che per
# questo e' stato portato da 30 a 60 minuti (vedi .github/workflows/collaudo.yml).
PARALLELI=$(nproc 2>/dev/null || echo 4)
[ "$PARALLELI" -gt 10 ] && PARALLELI=10
[ "$PARALLELI" -lt 2 ] && PARALLELI=2
# UN COLLAUDO APPESO NON DEVE RESTARE APPESO (19 novembre 2026).
#
# MISURATO: il giro lanciato alle 02:50 si e' fermato dentro questo passo e ci e' rimasto
# UNDICI ORE - l'ultimo banco scritto nel log era delle 02:57, e alle 13:56 i due processi node
# erano ancora li' con tre secondi di CPU in tutto, piu' tre browser orfani. Il proprietario se
# n'e' accorto prima di me: «sono 668 minuti che sta in esecuzione».
#
# Un collaudo che non finisce non e' ne' verde ne' rosso: non dice niente, e intanto blocca il
# lavoro e lascia processi vivi che rallentano la macchina. Da qui in poi ha un tetto: se lo
# supera, il passo CADE (e si vede nel risultato) invece di restare appeso per sempre.
# 45 minuti sono il triplo abbondante del giro normale, che con i banchi in parallelo sta
# intorno agli 11 minuti: non puo' scattare per lentezza, solo per un blocco vero.
TETTO_BROWSER=${TETTO_BROWSER:-2700}
passo app_browser bash -c "cd laboratorio && timeout --kill-after=30 $TETTO_BROWSER node --test --test-concurrency=$PARALLELI app/*.test.mjs"
grep -h "AVVISO" "$R"/*.log 2>/dev/null | sort -u | sed 's/^/- ⚠️ /' >> "$OUT"
riga ""
riga "Falliti: $FALLITI"
exit $FALLITI
