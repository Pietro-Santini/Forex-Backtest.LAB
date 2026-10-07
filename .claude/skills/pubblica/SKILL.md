---
name: pubblica
description: Pubblica una versione di Forex Backtest LAB: collaudo, CACHE_NAME, merge su main, Setup e release. Usala solo quando il proprietario chiede di pubblicare.
disable-model-invocation: true
---

# Pubblicare una versione

Pubblica **davvero**: aggiorna il sito che telefono e tablet usano, e crea il Setup che la gente
installa. Per questo la lancia solo il proprietario, mai il modello da solo.

I passi sono in un **ordine obbligato**. Sbagliarlo significa sito aggiornato e installer indietro,
o il contrario — e chi usa l'app vede due versioni diverse della stessa cosa.

## 1. Il collaudo deve essere verde

```bash
bash laboratorio/collauda.sh
```

Deve finire con **`Falliti: 0`**. Non è un consiglio: l'hook `guardia_git.py` blocca il push su
`main` se l'esito è più vecchio di 30 minuti o non è verde.

Se un passo è rosso **per mancanza di strumenti** (non per un difetto):

```bash
python -m pip install pytest
npm install -g playwright && npx playwright install chromium
```

## 2. Alzare il `CACHE_NAME`

In `sw.js`, `forex-backtest-lab-vNN` → `vNN+1`. È l'**unica** cosa che costringe i browser già
usati a buttare via la copia in cache. Senza, la correzione non arriva a nessuno e nessun errore lo
segnala. Anche questo è imposto dall'hook.

## 3. Salvare sul ramo di lavoro

```bash
git checkout -b lavoro/<nome-corto>
git add -A
git commit -m "App vNN: <cosa cambia, dal punto di vista di chi la usa>"
git push -u origin lavoro/<nome-corto>
```

Il messaggio dice **cosa cambia per chi usa l'app**, non quali righe sono state toccate. Niente
nomi di modelli AI (`cervello/REGOLE.md`).

## 4. Pubblicare su main

```bash
git checkout main
git merge --no-ff lavoro/<nome-corto> -m "App vNN: <stesso titolo>"
git push origin main
```

Si **unisce**, non si riscrive la storia: niente `--force`, niente `rebase` su main.

## 5. Controllare che sia online davvero

```bash
git fetch -q origin && git show origin/main:sw.js | grep -m1 CACHE_NAME
```

Finché non lo si è letto da `origin/main`, la versione **non** è online: non dirlo.

## 6. Il Setup e la release

Il flusso **Installer Windows** parte da solo a ogni push che tocca `app.html`, `sw.js` o
`installer_build/`, e lascia `ForexBacktestLAB_Setup.exe` negli Artifacts.

Per fare anche la **release** serve un passaggio in più. Prima alza la versione in
`installer_build/installer.iss`:

```
#define MyAppVersion "1.0.NN"
```

poi, con GitHub CLI:

```bash
gh workflow run installer.yml -f pubblica=true
gh run watch
```

Senza `gh`: Actions → «Installer Windows» → Run workflow, spuntando «Crea anche la release».

## 6-bis. Controllare il collaudo SU GITHUB

Il collaudo verde sul PC **non dice niente** su quello di GitHub: le librerie installate sono
diverse. Dal 6 al 7 ottobre 2026 il flusso e' rimasto rosso a ogni push, e nessuno se n'e' accorto.

```bash
gh run list --workflow=collaudo.yml --limit 3
```

Se e' rosso: `gh run view <id> --log-failed`. Finche' non e' verde, la versione **non** e' da
considerare pubblicata bene.

## 7. Aggiornare il cervello

Prima di considerare finito (`cervello/LEGGIMI.md`):

- `cervello/BUG.md` — i bug chiusi, con **causa vera** e il test che li controlla. Non si cancella
  mai una voce: si chiude, con data.
- `cervello/LEZIONI.md` — gli errori di ragionamento, scritti come regola pratica.
- `cervello/DIARIO.md` — cosa ha fatto questo giro, con l'esito del collaudo.

## Cosa il collaudo NON può controllare

Sessione Telegram vera, Syntra (BlueStacks), MT5 (serve Windows), conti con soldi veri. Per quelli
vale la prova a mano sul PC, **su conto demo o simulato** — mai su soldi veri
(`cervello/REGOLE.md`).
