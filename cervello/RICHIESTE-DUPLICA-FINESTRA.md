# Richieste aperte — finestra duplicata («Duplica finestra»)

## VERIFICA DEL 15 NOVEMBRE 2026 — LEGGERE PRIMA DEL RESTO

Rimisurate una per una contro il codice di oggi, invece di fidarsi degli stati scritti qui sotto.
**Sei voci su dodici erano gia' curate e segnate ancora da fare.** Gli stati delle singole voci,
piu' in basso, sono stati corretti; il testo originale resta perche' spiega i sintomi.

| voce | stato vero al 15 novembre |
|---|---|
| 1 sfarfallio | curata il 12 nov (tempesta di messaggi: da 11.508 chiamate a 20) |
| 2 schermo intero sulla madre | curata l'8 nov. **Ora con un banco**: `duplicata_schermo_e_scroll` |
| 3 scorrimento nella duplicata | curata. Misurato: 0 px da scorrere, rotellina inerte. Stesso banco |
| 4 / 12 elenco asset | curata (`fblApplicaElencoAssetMadre`). Da riprovare col ponte vero |
| 5 propagazione del conto | curata il 12-13 nov, nei due versi (`conto_sincrono` 5/5) |
| 6 replay sincronizzato con la domanda | **FATTA il 15 nov**: banco replay_su_tutte_le_finestre (7/7) |
| 7 disegni sincronizzati | curata (`disegni_fra_finestre` 5/5) |
| 8 modello sulla barra strumenti | **DA VERIFICARE** |
| 9 chiusure lente | **DA MISURARE** |
| 10 grafico piantato sul caricamento | tetto di 30 s aggiunto il 12 nov. Da riprovare col ponte vero |
| 11 conto della terza finestra | il sintomo NON si riproduce piu' (6 giri su 6 col conto giusto) |
| eco del conto (non segnalato) | **CURATO il 15 nov**: chi applica un conto non lo ri-annuncia |

PERCHE' ERANO RIMASTE INDIETRO, e vale per la prossima volta: le misure del 12 novembre erano
state scritte in `BUG.md` come prosa, e il banco che citavano
(`finestre_duplicate_tre.misura.test.mjs`) **non esiste in nessun ramo**. Senza un banco
committato, nessuno sa piu' se una cosa e' curata: va riletto il sorgente da zero. I banchi nuovi
sono `finestre_tre_il_conto.test.mjs` (5/5) e `duplicata_schermo_e_scroll.test.mjs` (3/3).

RESTA VERO che le voci 10 e 12 vanno riprovate col ponte MT5 vero: sul banco non si riproducono,
e il proprietario le ha viste con il ponte collegato. Un banco verde non chiude una segnalazione
vista dal vivo.

Lista creata il 7 novembre 2026. Lavoro separato dal rilascio mercato-chiuso.
Ogni voce va riprodotta e misurata prima di curare (regola: si misura prima di correggere).

## Difetti segnalati

1. **Sfarfallio delle posizioni aperte** [CURATA il 12 novembre 2026: la causa era una tempesta
   di messaggi fra finestre, da 11.508 chiamate in 4 s a 20 - vedi BUG.md sezione E] nella duplicata: TP, SL, punti di entrata,
   P/L live, prezzo attuale non coincidono con la madre e lampeggiano. Causa da misurare:
   due loop che si pestano o stato condiviso non sincronizzato.
   - Stato: CURATA (12 novembre 2026).

2. **Schermo intero bloccato sulla pagina madre** [CURATA l'8 novembre, VERIFICATA il 15 con un
   banco: la madre entra a schermo intero con una duplicata aperta] dopo aver duplicato una finestra.
   La madre deve poter andare a schermo intero anche con duplicate aperte.
   - Stato: CURATA (8 novembre 2026), con banco dal 15 novembre.

3. **Scroll indesiderato** nella duplicata [CURATA, VERIFICATA il 15 novembre: nella duplicata
   non c'e' niente da scorrere e la rotellina la lascia ferma]: rodellina/dito fanno scorrere la pagina,
   ma deve esserci solo il grafico. La barra laterale degli strumenti e del replay
   deve restare ancorata a sinistra.
   - Stato: CURATA, con banco dal 15 novembre.

4. **Elenco asset limitato / modalità CSV** su una seconda duplicata: la duplicata
   mostra pochi asset, perde le watchlist, in alcuni casi si apre in modalità storico CSV
   invece di seguire il conto della madre. Asset e watchlist devono essere identici,
   e il conto (MT5 / CSV / Kraken) lo stesso.
   - Stato: FATTO IN PARTE (v2.1.1): la duplicata ora entra in Live se la madre e' in Live
   (vedi pip_conto_madre.test.mjs). RESTA: elenco asset identico alla madre e watchlist
   (oggi l'elenco arriva solo da MT5/Capital di questa finestra).

5. **Collegamento tra le sessioni**: le duplicate sono sessioni diverse ma devono
   condividere il conto selezionato. Se la madre passa da MT5 a CSV, le duplicate
   si adattano automaticamente.
   - Stato: PARZIALE (v2.1.1): all'apertura la duplicata prende la modalita' della madre.
   RESTA: propagare il CAMBIO di modalita' dopo l'apertura (madre che passa Live->Storico
   o cambia conto con duplicate gia' aperte).

6. **Replay sincronizzato**: premendo Replay con duplicate aperte, il programma chiede
   se applicare il replay anche alle altre duplicate. Se confermato, le duplicate
   entrano in replay e le posizioni replay si trasportano sulle altre.
   - Stato: DA FARE.

7. **Disegni sincronizzati** [CURATA: banco disegni_fra_finestre 5/5]: un disegno manuale aggiunto su una pagina deve
   comparire anche sulle altre duplicate, indipendentemente da quale è la madre.
   - Stato: CURATA (banco disegni_fra_finestre 5/5).

8. **Modello sulla barra strumenti**: selezionando un disegno salvato come modello e
   poi cliccando sul grafico, il disegno viene tracciato subito con le priorità salvate;
   al trascinamento/applicazione si applicano tutte le priorità salvate.
   (Verificare: potrebbe già funzionare.)
   - Stato: DA VERIFICARE.

9. **Chiusura lenta delle operazioni** (TP che scatta, chiusura a mercato): già lenta
   di suo, e con duplicate aperte rallenta ancora di più. Le chiusure devono essere
   istantanee. Le duplicate non devono rallentare il sistema.
   - Stato: DA FARE.

## Note per chi cura
- Misurare prima: riprodurre il flickering con le DevTools (Performance) e contare
  quanti aggiornamenti al secondo arrivano alla duplicata.
- Il guardiano `currentAssetKey` («Mai far comparire due grafici») va rispettato
  anche sulla strada nuova.
- Non mescolare queste modifiche con il rilascio mercato-chiuso: lavoro a sé.

## Ordine proposto
Iniziare dalle più concrete e misurabili:
  - 3 (scroll/overflow) — CSS, verificabile in 1 minuto.
  - 4 (asset list / conto) — confronto asset disponibili tra madre e duplicata.
  - 1 (flickering) — richiede misura degli aggiornamenti.
  - 7 (disegni) — estendere il canale BroadcastChannel esistente.
  - 6 (replay) — aggiungere richiesta di conferma + sync.
  - 5 (collegamento conto) — propagazione del conto selezionato.
  - 2 (schermo intero) — likely facile, da verificare.
  - 8 (modello) — verifica comportamento attuale.
  - 9 (prestazioni) — profiling, da fare per ultimo.

## Voce 4/5 — ELENCO ASSET DELLA DUPLICATA (misurato 8 novembre 2026)

Dagli screenshot del proprietario, dialogo «Ricerca simbolo» aperto nelle due finestre:
- pagina madre: ASSET DISPONIBILI (35), con la stellina della watchlist piena su XAUUSD;
- pagina duplicata: ASSET DISPONIBILI (5) — solo EURUSD, GBPUSD, USDJPY, XAUUSD, XAGUSD, e le
  stelline della watchlist tutte vuote.

CAUSA MISURATA nel codice: una finestra PIP aggiuntiva nasce VUOTA per scelta esplicita (non
ripristina da storage, vedi initExtraPipWindow). L'elenco degli asset si costruisce da quello
che la finestra ha caricato o ricevuto lei: senza l'eredita' dalla madre restano solo i cinque
di base. La watchlist sta in localStorage, che una finestra appena nata non ha ancora letto.

RICHIESTO: gli asset disponibili e la watchlist devono essere identici a quelli della pagina
madre, elencati allo stesso modo. Non sono due elenchi da tenere allineati a mano: la duplicata
deve EREDITARE quello della madre, una volta, all'apertura.

STRADA (da misurare prima di curare): il messaggio pip_clone_snapshot porta gia' stili, asset
corrente e credenziali MT5 (vedi il gestore). Gli stessi campi che costruiscono l'elenco — il
risultato della ricerca Capital.com e la watchlist — viaggiano la' dentro, e la duplicata li
applica prima di mostrare il dialogo. Misura: contare le voci del dialogo nelle due finestre
dopo l'apertura (oggi 35 contro 5).

- Stato: DA FARE (dopo la regressione delle linee entry/tp/sl: tocca lo stesso canale di
  comunicazione tra finestre, meglio non aprirne due fronti insieme).


## SEGNALAZIONI DELLA SERA DELL'11 NOVEMBRE 2026 (a voce, dal proprietario)

Arrivate DOPO la v2.2.28. Quasi tutte sono voci GIA' APERTE in questa lista, e una di esse
(l'elenco asset) era GIA' MISURATA l'8 novembre: sono rimaste indietro mentre si curava altro.
Nessuna va curata a intuito: per ognuna c'e' scritto se la misura esiste o manca.

**IL PRINCIPIO, parole sue:** «la pagina duplicata quello che deve fare e' semplicemente un copia
e incolla di quello che c'e' sulla pagina madre, solo con le limitazioni che ho scritto e ho
definito. Che alcune cose devono essere trasportate, alcune no. Tipo quelle dei disegni, gli
indicatori, i time frame, eccetera.»
Quindi il comportamento atteso NON e' «qualche campo viaggia»: e' **copia della madre** piu' una
lista chiusa di eccezioni. Le eccezioni sono quelle scritte in questo documento e nel DIARIO.

### 10. IL GRAFICO DELLA DUPLICATA RESTA PIANTATO SUL CARICAMENTO  ← P0, NUOVO, da misurare
Parole sue: «adesso le pagine duplicate, il grafico fa sempre scarico lo storico in corso, carico
l'asset e rimane sempre li' piantato. Non carica.»
Non misurato. Da misurare: in quale stato si ferma (il messaggio a schermo e' quello dello
scaricamento storico), se la richiesta al ponte parte, se torna, e se il disegno riprende. Da
guardare per prime: l'eredita' del conto all'apertura (se la duplicata non sa quale conto usare,
puo' restare in attesa di dati che non arrivano) e il guardiano `currentAssetKey`.
- Stato: DA MISURARE.

### 11. IL CONTO ARRIVA IN RITARDO, E LA TERZA DUPLICATA PRENDE QUELLO VECCHIO  ← P0
Parole sue: «a un certo punto ci aveva salvato che era collegato con un account, poi dopo un po' di
tempo si e' collegato effettivamente all'account che e' stato caricato sulla pagina principale» e
«ho aperto una terza pagina duplicata e ancora mi da' il conto selezionato in precedenza, non
quello corrente».
E' la voce 5 di questa lista (propagare il CAMBIO di conto dopo l'apertura), piu' un caso nuovo e
preciso: **la TERZA finestra**. Le cure di v2.2.26 e v2.2.28 hanno fatto viaggiare il conto, ma
qui la finestra nuova eredita uno stato VECCHIO, non quello corrente. Da misurare: con tre
finestre aperte e un cambio di conto sulla madre, quale conto dichiara ognuna delle tre e in che
ordine temporale (il ritardo e' parte del sintomo, non un dettaglio).
- Stato: **MISURATO il 12 novembre 2026, non curato.** Alla nascita di una finestra rispondono
  TUTTE le altre (`trading_sync_request` -> `broadcastTradingStateNow()` senza barriera sullo
  slot), e vince l'ULTIMO arrivo: il campo `at` viaggia nel messaggio e non viene letto da nessuno.
  Traccia reale della terza finestra: decine di risposte nei primi 23 ms, login che oscilla fra il
  conto nuovo e quello vecchio, **conto finale quello VECCHIO**. In piu': il blocco `if(msg.conto)`
  gira fuori da ogni barriera e il suo ramo `conto_mt5` ri-annuncia (`mt5AttivaConto` ->
  `scheduleSave`), quindi due finestre in disaccordo sul conto si ribaltano a vicenda senza fine.
  Cura proposta in BUG.md (sezione F): risponde solo la madre, e il conto si applica solo se piu'
  recente. Banco: `finestre_duplicate_tre.misura.test.mjs`, prove D e D2 (rosse).

### 12. ELENCO ASSET INCOMPLETO SOLO SULLA SECONDA DUPLICATA IN POI  ← P1
Parole sue: «vado a selezionare gli asset e me ne fa vedere solo alcuni, non mi fa vedere come
quelli della pagina principale, mentre invece la prima pagina duplicata si'.»
E' la voce 4, GIA' MISURATA l'8 novembre (madre 35 asset, duplicata 5) e mai curata. La novita'
utile: la PRIMA duplicata adesso e' a posto, la SECONDA no. Questo restringe la causa:
l'eredita' funziona per chi nasce dalla madre e non per chi nasce da una duplicata (o per chi
nasce quando la madre ha gia' una figlia).
- Stato: **MISURATO il 12 novembre 2026: sul banco NON si riproduce.** Con tre finestre, prima e
  seconda duplicata hanno lo stesso elenco asset e la stessa watchlist della madre (prova E,
  verde): la cura di `fblApplicaElencoAssetMadre` regge anche per la seconda. Quindi il sintomo
  dipende da QUANDO nasce la finestra (madre non ancora pronta a rispondere) e non da quante ce ne
  sono: da riprovare col ponte vero, con la duplicata aperta subito dopo l'avvio.

## NUOVE RICHIESTE DEL 15 NOVEMBRE 2026 (sera)

### 13. IL MIRINO SI TRASPORTA FRA LE FINESTRE - FATTA (v2.2.57)
Parole sue: «se sono su pagine duplicate e su tutte le pagine c'e' lo stesso identico asset, se
sto con il mirino su una finestra mi si deve trasportare anche sulle altre... sullo stesso punto
del prezzo, stesso punto dell'orario... e' esattamente come funziona su TradingView». Tre
condizioni: solo il mouse («vale soltanto per il PC»), solo lo stesso asset, e i time frame
possono essere diversi.
CORREZIONE SUA, subito dopo la prima versione: «non si deve posare, ma deve muoversi in tempo
reale senza fermarsi anche a time frame diversi: deve calcolare lo spostamento che avviene su
time frame da 1 minuto rapportato ai time frame piu' alti». Fatto: il mirino scorre DENTRO la
candela, alla frazione giusta, e l'istante spedito e' continuo.
- Stato: FATTA. Banco `mirino_fra_finestre.test.mjs` (11/11).

### 14. L'ANTEPRIMA DEL TAGLIO DEL REPLAY SU TUTTE LE FINESTRE - FATTA (v2.2.57)
Parole sue: «in modalita' replay con le pagine duplicate, quando andiamo a selezionare un nuovo
punto, l'anteprima deve venire anche sulle altre pagine duplicate... l'asse verticale che delimita
il taglio... anche se hanno un time frame diverso». Viaggia l'orario, come per il mirino.
Si manda solo se il replay e' condiviso (risposta «su tutte le finestre» alla voce 6): disegnare
un taglio su finestre che devono restare in diretta sarebbe contraddittorio. CONFERMATO dal
proprietario.
- Stato: FATTA, nello stesso banco.

### 15. TIME FRAME NUOVI - DA FARE
Parole sue: «aggiungiamo piu' time frame: da 3 minuti, 10 minuti, 2h 3h 4h 5h 12h 2g 3g 5g 1w 2w
1 mese» (4h c'e' gia').
IL LAVORO VERO NON E' IL MENU, E' L'ANCORAGGIO DELLE CANDELE. I gruppi si contano dall'epoca
Unix: `bucketKeyOf(t,minuti)=floor(t/(minuti*60000))`. Va bene per 3m, 10m, 2h, 3h, 12h, che
dividono esattamente la giornata. NON va bene per:
  - 5h (300 min): 1440/300 = 4,8, quindi le candele slittano di giorno in giorno;
  - 2g, 3g, 5g, 1w, 2w: l'epoca Unix cade di GIOVEDI', quindi le settimane non partono di lunedi';
  - 1 mese: 43.200 minuti sono 30 giorni fissi, non il mese del calendario.
Serve un ancoraggio per time frame (mezzanotte, lunedi', primo del mese), e tocca `bucketKeyOf`,
`findBucketIndexForTime`, `buildPartialBucket` e i punti che fanno `bucketKeyOf(...)*TF*60000`
(che presuppone candele tutte uguali, falso per i mesi). Sotto ci stanno footprint, replay e
indicatori: capitolo a se', con il suo collaudo.
Da decidere anche la strada dei DATI in Live: `MT5_TIMEFRAME_MAP` copre 1,5,15,30,60,240,1440 e
per gli altri ripiega su M1 - inutilizzabile per un mese (un mese di M1 sono 43.200 candele). La
strada giusta e' chiedere il piu' grande time frame MT5 che divide quello voluto (H1 per 5h, D1
per i giorni, le settimane e il mese) e aggregare da li'.
- Stato: **FATTA (v2.2.58).** Ancoraggio in fblInizioBucket/fblFineBucket, una sola fonte di
  verita'; bucketKeyOf restituisce l'inizio del bucket in ms; fblTfMt5Per() chiede a MT5 il piu'
  grande time frame che divide quello voluto. Banco `time_frame_nuovi.test.mjs` (8/8), con la
  non-regressione sui time frame di sempre (zero differenze col conto vecchio).
