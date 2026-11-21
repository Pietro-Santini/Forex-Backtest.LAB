# Consegna a Open Code — 21 novembre 2026

Leggi tutto prima di scrivere una riga. Poi leggi **`cervello/REGOLE.md`**, in fondo, la sezione
«REGOLE SUL TEMPO E SUI DATI DEL GRAFICO»: sono undici regole non negoziabili, e valgono anche per
te.

---

## 1. Dove siamo adesso

- Versione pubblicata su `main`: **v2.2.93** (commit `efde7a5`). `CACHE_NAME` in `sw.js` allineato.
- Collaudo locale: **verde**, 0 falliti (1779 prove del browser, 410 del ponte).
- Collaudo GitHub: verde su 2.2.91 e 2.2.92; quello della 2.2.93 stava girando alla consegna.
- La release con il Setup la crea il flusso «Installer Windows» a ogni push su `main`, e il
  pulsante **Aggiorna** dell'app la scarica e la installa da solo: aggiorna **tutto**, non solo
  `app.html` — anche `bridge.py` e `mt5_feed_server.py`, che diventano `ForexBacktestLAB.exe` e
  `Mt5FeedServer.exe`. Non serve mandare zip al proprietario.

## 2. Il codice su cui stavi lavorando era rotto. Ecco che cosa è stato sistemato

Non è un rimprovero, è la mappa di quello che troverai diverso da come l'avevi lasciato.

| Che cosa | Effetto che aveva | Stato |
|---|---|---|
| `setupRif.extConf` invece di `extConfirmed` in `bosApplicaBreakEven` | il BE2 non scattava **mai** | corretto |
| `BOS_SETTINGS` e `bosBuildSettings()` **cancellate** da `app.html` | il pannello del BOS non mostrava più nessun campo: né break-even, né target, niente | ricostruite |
| `cervello/DIARIO.md` **riscritto** invece che integrato | 8059 righe di storia del progetto cancellate, ne restavano 21 | recuperato da git |
| Voce di diario che dava per confermato «collaudo GitHub success per v2.2.92» | la 2.2.92 non esisteva ancora quando è stata scritta | vedi regola 2 |

**Il diario, il registro dei bug e le lezioni si scrivono IN TESTA, mai sostituendo il file**
(regola 11). Prima di ogni commit: `git diff --numstat cervello/` — se compaiono cancellazioni
dove ti aspettavi solo aggiunte, fermati e recupera.

## 3. Il difetto grosso di oggi, perché tu non lo rifaccia

Il proprietario segnalava da ore: il tempo che scorre a mercato chiuso, le candele che spariscono
mentre scorre, «torna all'ultima candela» nel vuoto, il replay a 1m con candele da 5m, la freccia
che salta dalla 25 alla 35, e l'ultima candela di XAU data alle 03:19 del 21 mentre il terminale
MT5 diceva 23:50 del 20.

**Era una causa sola, e non stava nel grafico.** Il servizio dati rispondeva
`"utc_offset_seconds_applied": -9000`: −2h30, che non è il fuso di nessun broker. Era l'**età di un
tick fermo** (`grezzo = scarto − età`: di sabato, mercato chiuso da 4h30, 7200 − 16200 = −9000), e
siccome −9000 è un multiplo tondo di mezz'ora passava la griglia dei controlli. Poi finiva scritto
su disco e restava. Il conto torna al minuto: 23:50 del broker + 3h30 di errore = 03:20.

**Che cosa è costato:** prima di misurare sono state proposte cinque cause diverse dentro il codice
del grafico, nessuna misurata, e ognuna è costata un giro al proprietario. A chiudere tutto è stato
un comando di dieci secondi:

```
curl.exe -s "http://127.0.0.1:8001/history?symbol=XAUUSD&timeframe=M1&count=5"
```

**Quindi: quando un orario, una data o una candela sono sbagliati, la prima cosa che fai è chiedere
alla sorgente.** Guarda `utc_offset_seconds_applied` per primo. Non leggere il codice del grafico
finché non sai che cosa arriva dentro.

La cura è in `mt5_feed_server.py` **e** in `bridge.py` (la funzione è duplicata, si correggono tutti
e due): `_SCARTO_MINIMO_PLAUSIBILE = -3600`. I server MT5 stanno da UTC+0 in su, quindi sotto UTC−1
non stai misurando un fuso, stai misurando l'età di un tick fermo. Senza tick freschi (sabato e
domenica) vale `_scarto_broker_da_calendario()`: UTC+2 d'inverno, UTC+3 con l'ora legale europea.

## 4. Le cinque regole che ti faranno inciampare se le salti

1. **Si misura la sorgente prima di toccare il codice.** Mai «la causa più probabile è…» presentato
   come avanzamento. Si dice una di tre cose: «misurato, ecco il numero e il comando», «non
   riprodotto, ecco cosa ho escluso e il dato che mi serve», «non lo so ancora».
2. **Un commento non è una cura.** Il difetto di oggi è vissuto per settimane sotto un commento che
   descriveva già la soluzione giusta («basta superare i 5 minuti di età») mentre la riga sotto
   diceva `> 86400`, cioè 24 ore. Quando un commento nomina una soglia, quella soglia deve stare in
   un test.
3. **Mai dati falsi: meglio meno, e detto.** Mai candele inventate oltre l'ultima reale, mai candele
   di un'altra risoluzione sotto la scritta del time frame scelto. Un grafico vuoto si vede, un
   grafico falso no — e ci si opera sopra con soldi veri.
4. **Il mercato è aperto se MT5 trasmette.** Mai orari fissi, mai «chiude alle 22», mai regole sul
   weekend scritte a mano: ci sono asset che il fine settimana trasmettono.
5. **Dopo ogni modifica a `app.html`: `node laboratorio/strumenti/sintassi_app.mjs`.** Un solo
   apostrofo italiano dentro una stringa JavaScript (`l'etichetta`) rompe un intero blocco
   `<script>`: non una funzione, tutte quelle del blocco. L'app partirebbe morta.

E la regola di sempre del progetto: **prova del rosso**. Rimetti la riga vecchia, guarda il test
fallire, rimetti quella nuova, guarda il verde. Senza, non sai se il test misura la cura o il vuoto.

## 5. Il test 8.1 è già verificato. Non chiederlo al proprietario

Le quattro prove che avevi chiesto di fare a mano sono coperte da banchi che girano nel collaudo.
Eseguiti il 21 novembre sulla 2.2.93: **60 prove, 60 verdi**.

| Prova | Esito | Banco che lo dimostra |
|---|---|---|
| 1 — il replay parte su tutte le finestre | ✅ | `replay_comandi_su_tutte` («la finestra che riceve l'avvio entra in replay E mostra i suoi comandi»), `replay_fra_finestre` («FATTO 1: la finestra nata DOPO la scelta eredita "su tutte"») |
| 2 — l'avanzamento parte da qualsiasi finestra | ✅ | `passo_frecce_finestre`, tutti i casi: ▶ su M5 → madre M1 +5 candele; ▶ su M15 → due M1 +15; ▶ su M1 → le altre non cambiano candela, solo l'evoluzione; ◀ indietro idem |
| 3 — il mirino nei due versi | ✅ | `mirino_da_entrambi_i_versi` («dalla duplicata alla madre e viceversa»), `mirino_fra_finestre`, `replay_fra_finestre` («FATTO 3: il mirino arriva a tutte e tre») |
| 4 — la posizione in replay non sparisce prima | ✅ | `replay_posizione_non_si_chiude_subito`, `replay_non_chiusa_dal_passato`, `replay_conto_storico` (8 prove: «una posizione nata nel replay non viene chiusa dal prezzo di oggi») |

**Unica riserva onesta sul punto 4:** i banchi dimostrano che la posizione **non sparisce** e **non
viene chiusa dal prezzo di oggi**. La riga che compare nel Trade Journal **dopo** la chiusura
naturale non è asserita direttamente in nessuno di quei banchi. Se ti serve certezza su quello,
scrivi il banco — non chiedere al proprietario di guardare a occhio.

**Regola generale:** prima di chiedere una prova manuale, cerca il banco. `laboratorio/app/` ha
oltre quattrocento file e quasi sempre quello che serve c'è già. Una prova manuale chiesta al
proprietario costa il suo tempo; un banco costa il tuo e resta per sempre.

## 6. Che cosa resta aperto

1. **Verifica sul PC del proprietario, dopo l'aggiornamento.** L'ultima candela di XAU deve passare
   da `21 nov 03:19` a `20 nov 22:50`. Non sarà 23:50: il terminale scrive l'ora del broker (UTC+2)
   e l'app quella di Roma (UTC+1), stesso istante in due fusi. Un'ora di differenza è giusta.
2. **Candele che spariscono scorrendo e «torna all'ultima candela» nel vuoto.** Sono spiegate dalla
   stessa causa (candele spinte 4h30 nel futuro, che il taglio del mercato chiuso nascondeva), ma
   **non sono state verificate dopo la cura**. Se tornano, la causa è un'altra: misura prima.
3. **Valid BOS Pullback**, pubblicato nella 2.2.91 e da provare sul campo: due modalità per la
   seconda posizione (`insieme` al pullback, oppure `dopo` la rottura confermata), rischio diviso
   0,5% + 0,5%, break-even doppio, stop del pullback a scelta fra `candela`, `struttura` e
   `liquidita` (default `liquidita`), tolleranza del ritest in pip. I numeri dei backtest sono nel
   promemoria dentro il pannello dell'indicatore.
4. **Le immagini del proprietario con le entrate «certe» che l'indicatore non prende.** Mai
   confrontate barra per barra: servono data, ora e timeframe di ciascun caso, poi si guarda quale
   condizione lo blocca (`minExtensionTicks`, `leftBars`/`rightBars`, `touchTicks`,
   `minUntouchedBars`, `maxWait`). Finché non c'è quel confronto, non dire che è risolto.

## 7. Prima di dire «fatto»

- `bash laboratorio/collauda.sh` → **Falliti: 0**, da meno di 30 minuti.
- `node laboratorio/strumenti/sintassi_app.mjs` dopo l'ultima modifica a `app.html`.
- `CACHE_NAME` in `sw.js` e `FBL_VERSIONE` in `app.html` alzati **insieme**, e controllati su
  `origin/main` dopo il push.
- `git diff --numstat cervello/`: solo aggiunte.
- `cervello/BUG.md` aggiornato con causa vera, prova del rosso e nome del test;
  `cervello/DIARIO.md` con una voce in testa.
- **Il PC del proprietario si legge, non si tocca.** Niente riavvii, niente file cancellati, niente
  aggiornamenti decisi da te: il push è l'ultimo passo, poi è lui che preme Aggiorna.
