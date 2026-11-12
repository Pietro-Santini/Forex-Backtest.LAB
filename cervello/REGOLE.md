# Regole non negoziabili

Valgono per ogni agente, ogni sessione, ogni automatismo. Le cambia solo il proprietario.

## Soldi e conti
- **Mai conti con soldi veri.** Kraken solo sul conto **simulato**; MT5 solo su conto **demo**. Un
  agente non apre, chiude o modifica posizioni reali, nemmeno "per provare".
- **Mai chiavi API nel repository, nel cloud o nei messaggi.** Le chiavi Kraken stanno solo sul PC
  del proprietario (segreto cifrato con DPAPI) e non tornano mai all'app.
- **Mai permessi di prelievo** su nessuna chiave.
- **La sessione Telegram** non va mai nel repository né in servizi di terzi. Può stare **solo sul
  server Oracle del proprietario** (deciso il 6 ottobre 2026): disco del server, raggiungibile solo
  via Tailscale, mai copiata altrove.
- Nessuna VPN o documento di un altro paese per aggirare restrizioni.

## Pubblicazione
- Il sito si aggiorna da `main`. **Decisione del proprietario (6 ottobre 2026): Claude salva sul
  ramo di lavoro e pubblica da solo anche su `main`**, così il sito resta aggiornato, ma **solo con
  il collaudo verde** (`bash laboratorio/collauda.sh` → "Falliti: 0" da meno di 30 minuti): il
  controllo automatico `.claude/hooks/guardia_git.py` blocca il push su `main` altrimenti. Si
  pubblica unendo il ramo (merge), mai riscrivendo la storia.
- Ogni versione di `app.html` va con un nuovo `CACHE_NAME` in `sw.js` (schema `forex-backtest-lab-v2.0.x`), e
  i due file si pubblicano insieme.
- Prima di dire che una versione è online, controllare `CACHE_NAME` su `origin/main`.
- Niente `git push --force`, niente riscrittura della storia.

## Qualità
- Nessuna correzione senza test che la dimostri (`laboratorio/`).
- `bash laboratorio/collauda.sh` deve essere verde prima di proporre una modifica.
- Nessun identificativo di modello AI in commit, codice o pagine.
- Si risponde e si scrive in italiano, in modo che lo capisca anche chi non è sviluppatore.
- L'email del proprietario non va mai mandata a servizi esterni.


---

## REGOLA DEL PROPRIETARIO (11 novembre 2026, sera): SI LAVORA CON I SUBAGENTI

Parole sue: «mi raccomando, per tutte queste cose applica sempre dei subagenti per smistare i
compiti. D'ora in poi e' una regola. E' una regola da seguire, cosi' almeno abbiamo un piano
migliore su cui andare a modificare le cose in maniera piu' curata, precisa, tecnica, e per
scovare meglio quelli che sono errori o perfezionamenti in merito.»

E i subagenti devono anche PENSARE, non solo eseguire: «magari anche di attribuirgli quella che e'
una sorta di intelligenza, per cercare di capire se possono migliorare il fatto o meno, se quello
che dico io puo' essere implementato in una maniera migliore. Perche' io sono un essere umano,
quindi una macchina magari in determinate cose puo' anche pensarla meglio, puo' vedere degli
aspetti dove un essere umano non ci arriva. Quindi assolutamente, se riesci a indicarmi come
migliorare delle cose, ben venga, sono molto aperto a dei consigli. Sia visivi che tecnici che di
sistema che di progettazione.»

**COME SI APPLICA, in pratica:**
1. Ogni fronte di lavoro (un difetto, una famiglia di difetti, una misura) va dato a un subagente
   dedicato, col contesto gia' dentro il prompt: dov'e' il repo vero, le regole del progetto, le
   misure gia' fatte, e il vincolo di NON lanciare `collauda.sh` (apre 20 browser invisibili per
   2,4 GB, e il proprietario sta lavorando sulla stessa macchina).
2. Fronti indipendenti in parallelo, mai due agenti sugli stessi file.
3. Al subagente si chiede di MISURARE prima di curare, e di dichiarare che cosa resta ipotesi.
4. **Gli si chiede anche un parere**: se la richiesta si puo' realizzare meglio di come e' stata
   formulata, deve dirlo con la motivazione. Il proprietario vuole quel parere, non l'obbedienza.
5. Un banco che misura un difetto ancora aperto resta FUORI dal repo (cartella
   banchi_aperti_forex nei Documenti): un banco rosso non si committa.
6. Chi coordina non ripete il lavoro degli agenti: raccoglie, verifica, cura, collauda e pubblica.

Gli agenti del progetto sono in `.claude/agents/`: `regista` (coordina), `collaudatore`,
`cacciatore-instabilita`, `sentinella-sicurezza`, `guida-neofita`.
