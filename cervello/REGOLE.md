# Regole non negoziabili

Valgono per ogni agente, ogni sessione, ogni automatismo. Le cambia solo il proprietario.

## Soldi e conti
- **Mai conti con soldi veri.** Kraken solo sul conto **simulato**; MT5 solo su conto **demo**. Un
  agente non apre, chiude o modifica posizioni reali, nemmeno "per provare".
- **Mai chiavi API nel repository, nel cloud o nei messaggi.** Le chiavi Kraken stanno solo sul PC
  del proprietario (segreto cifrato con DPAPI) e non tornano mai all'app.
- **Mai permessi di prelievo** su nessuna chiave.
- **La sessione Telegram non va mai nel cloud** né nel repository.
- Nessuna VPN o documento di un altro paese per aggirare restrizioni.

## Pubblicazione
- Il sito si aggiorna da `main`. **Nessun agente scrive su `main`.** Gli agenti lavorano su un ramo
  e propongono; il proprietario decide cosa va online.
- Ogni versione di `app.html` va con un nuovo `CACHE_NAME` in `sw.js` (`forex-backtest-lab-vNN`), e
  i due file si pubblicano insieme.
- Prima di dire che una versione è online, controllare `CACHE_NAME` su `origin/main`.
- Niente `git push --force`, niente riscrittura della storia.

## Qualità
- Nessuna correzione senza test che la dimostri (`laboratorio/`).
- `bash laboratorio/collauda.sh` deve essere verde prima di proporre una modifica.
- Nessun identificativo di modello AI in commit, codice o pagine.
- Si risponde e si scrive in italiano, in modo che lo capisca anche chi non è sviluppatore.
- L'email del proprietario non va mai mandata a servizi esterni.
