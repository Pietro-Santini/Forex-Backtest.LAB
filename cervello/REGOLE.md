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


---

## REGOLA DEL CLOUD — scritta il 12 novembre 2026, dopo la terza bolletta a sorpresa

**IL FATTO CHE L'HA RESA NECESSARIA.** Console Firebase, 12 novembre: **scritture 22.000 su
20.000 al giorno, quota SUPERATA**, letture 44.000 su 50.000 (l'88%). Il pannello dell'app, nello
stesso giorno, diceva **81 scritture**. Un rapporto di 270 a 1 fra quello che il programma crede
di fare e quello che succede davvero. Non e' la prima volta: era gia' successo il 9 novembre
(14.000 contro 102) e il 31 ottobre. Tre volte lo stesso schema, tre volte scoperto dalla
bolletta e non da noi.

### LE CINQUE REGOLE

**1. Ogni operazione verso il cloud passa da un tetto, e il tetto sopravvive alla riapertura.**
Scritture e letture hanno tetti SEPARATI, perche' le quote sono separate: un solo contatore
farebbe smettere di salvare i dati per colpa delle letture. Oggi: 3.000 scritture e 5.000 letture
al giorno, contro 20.000 e 50.000 gratuite. Il conto sta in `localStorage`, non in memoria: in una
WebView le ricariche sono frequenti, e un tetto che riparte da zero a ogni ricarica **non e' un
tetto, e' un'illusione** (misurato: e' successo per le scritture il 10 novembre e per le letture
il 12, lo stesso giorno in cui le ho aggiunte - lo ha trovato il banco, non la bolletta).

**2. Non si legge un documento per sapere un numero.** Il conteggio delle operazioni gia' sul
cloud veniva fatto rileggendo l'INTERO documento a ogni salvataggio. Un numero che si puo'
ricordare non si rilegge mai: si tiene in memoria e si aggiorna dopo ogni scrittura riuscita, e si
rilegge solo la prima volta o dopo un errore.

**3. Un ascolto non e' gratis: ogni arrivo e' una lettura.** I quattro ascolti permanenti
(session, grafico, collegamento, preferenze) producono una lettura a testa OGNI VOLTA che un
altro dispositivo scrive quel documento. Con tre dispositivi accesi, una scrittura ne genera due,
per ognuno dei quattro documenti. **E' il moltiplicatore che nessun pannello vedeva**, perche'
l'app conta le proprie chiamate e non quello che arriva. Prima di aggiungere un ascolto, si
calcola quante letture produrra' con N dispositivi accesi.

**4. Quando una lettura fallisce, non si riscrive tutto.** Se il conteggio non riesce, il codice
cadeva nel ramo di ripiego e rimandava la FOTOGRAFIA INTERA. Un ripiego che costa cento volte
l'operazione normale non e' un ripiego: e' un moltiplicatore che si accende proprio quando le cose
vanno male. Il pannello del proprietario segnava `cloudTradesInviati: 3469`: non erano operazioni
nuove, era lo storico rimandato piu' volte.

**5. Il pannello dell'app non e' la verita': la console lo e'.** Il pannello conta le chiamate
che l'app fa; la console conta le operazioni che Firebase registra - comprese quelle degli
ascolti, delle Cloud Functions e degli altri dispositivi. **Quando i due numeri divergono di piu'
di dieci volte, la differenza E' il difetto**, e va cercata prima di toccare qualunque altra cosa.

### COME SI CONTROLLA, in trenta secondi
Nella console di Firebase, pagina «Uso del prodotto»: scritture e letture del giorno. Nell'app,
pannello del traffico: `budgetStato()` e `budgetLetture()` danno il conto per documento, cioe'
**chi** consuma. Se il rapporto fra i due supera dieci, si apre un'indagine.

### COSA NON VA FATTO, e perche'
- **Alzare il tetto per far sparire l'avviso.** Il tetto non e' il problema, e' il misuratore.
- **Rendere un banco piu' tollerante perche' cade.** Il 12 novembre il banco
  `cloud_incrementale` cadeva a intermittenza anche su GitHub: misura la regola «identico = non
  si scrive», su cui si regge tutta la bolletta. Un banco cosi' si tiene severo finche' non si sa.
- **Fidarsi di un banco che si salta.** Le prime tre prove del tetto delle letture passavano
  SENZA MISURARE NIENTE, perche' il modulo del cloud non partiva nel banco e si uscivano con un
  `return`. Un banco che si salta da' una sicurezza falsa, peggio di uno rosso: se la condizione
  che serve a misurare non c'e', la prova deve CADERE, non saltare.
