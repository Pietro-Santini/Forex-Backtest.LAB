# Registro dei bug

Formato: **titolo** — stato — dove — causa vera — test che lo controlla.

- **APERTO (misurato, non curato) 12 novembre 2026 — In SELL lampeggia un profitto che e' il PREZZO D'ENTRATA, e la Prop Firm dichiara la sfida superata (e lo SALVA)** - `app.html`. Banco: `C:\Users\pietro\Documents\banchi_aperti_forex\sell_profitto_falso_prop_firm.test.mjs` (8 prove, tutte rosse) + misure `diag_sell_profitto_falso.mjs`, `diag_sell_falso_cloud.mjs`.

  Parole del proprietario (11 novembre 2026): «quando vado ad aprire una posizione, al momento che la apro e imposto i livelli TP e stop loss, in SELL la maggior parte delle volte, succede che mi segnala per un attimo come se avessi un profitto che ovviamente non e' assolutamente vero. E questo comporta anche che in quel frangente l'applicazione mi dice che ho sbloccato la Prop Firm. Un bug del genere non e' accettabile.»

  **LA PROVA CHE NON E' UN PROFITTO MA UN PREZZO.** Journal fotografato, XAUUSD conto ...68794 SELL 0,10 lotti: riga 1059 entrata 4030.38 -> pip +40303.8 e P/L +40.303,80 EUR; riga 1058 entrata 4030.48 -> pip +40304.8 e P/L +40.304,80 EUR. Per XAUUSD `contractSize` vale 100 (riga **22214**) e 1 pip vale 0,1 (`pipDigit:1`): `4030.38 * 100 * 0,10 = 40303.8` e `4030.38 / 0,1 = 40303.8`. I due numeri sono la stessa differenza di prezzo letta in due unita', e quella differenza **e' il prezzo d'entrata**: cioe' `entrata - uscita` con uscita **zero**. Misurato sul banco: `calculateForexPL('SELL',4030.38,0,0.10,'XAUUSD')` = **40303.8**; con `null` e con stringa vuota lo stesso, perche' `Number(null)` fa 0.

  **IL PUNTO, con i numeri di riga.** `calculateForexPL` riga **22575**: `const rawQuote=(side==='BUY'?(exit-entry):(entry-exit))*size*lots;` — nessun controllo su `entry` ne' su `exit`. **L'ASIMMETRIA SELL/BUY e' qui**: con uscita 0, in SELL esce `+entrata*unita'` (un profitto, che sblocca la Prop Firm), in BUY esce `-entrata*unita'` (misurato: **-40303.8**, una perdita mostruosa). Per questo il proprietario lo vede «la maggior parte delle volte in SELL»: dall'altro lato lo stesso errore si presenta come perdita e non fa scattare nessun traguardo.

  **PERCHE' LO ZERO PASSA DAPPERTUTTO.** Il 10 novembre 2026 il progetto ha deciso che «un prezzo o c'e' o non c'e'» e ha scritto `fblPrezzoValido()` (riga **13515**: `>0` oppure `null`). Quella regola e' stata applicata ai DISEGNI e ai campi `entry`/`exit` del record, **non ai calcoli**: i 19 chiamanti di `calculateForexPL` si difendono con `Number.isFinite(prezzo)` (righe 13652, 23692, 23702-23709, 25186, 24793), e **`Number.isFinite(0)` e' vero**. Tre convenzioni diverse convivono nello stesso file per la domanda «questo prezzo esiste?»: `>0` (`fblPrezzoValido`, e il ramo tick di `currentPrice()` righe **22704-22705**, dove la lezione «un tick a 0 non e' un prezzo» era stata imparata), `!=null`, e `Number.isFinite`.

  **DOVE LO ZERO ENTRA DAVVERO — due buchi misurati.**

  1. `closeMt5PositionReal` riga **26461**: `const price=Number.isFinite(Number(result.data.price))?Number(result.data.price):fblPrezzoRipiegoChiusura(pos,reason);`. Il ponte (`installer_build/build/bridge.py` riga **3777**) risponde `{"ticket":…,"deal":…,"price":result.price}`, e `result.price` di MT5 vale `0.0` quando il server non la riporta (in Python un campo assente diventa `None`, cioe' `null` in JSON). Misurato con il ponte finto, sia `price:0` sia `price:null`: uscita registrata **0**, P/L **+40303.8 EUR**, pip **40303.8**, conto **50303.8** — e a schermo l'app scrive «🔌 Posizione XAUUSD (ticket …) chiusa DAVVERO su MT5 al prezzo **0.00000**». Il ripiego sicuro `fblPrezzoRipiegoChiusura` (riga **5694**, che pretende `>0`) avrebbe dato 4030.38 ma **non viene mai chiamato**. La stessa lezione e' GIA' scritta nell'altra strada di chiusura (riga **42028**: «Number(null) vale 0, che e' finito: cosi' un prezzo mancante diventava un'uscita a 0») con il controllo `prezzoDeal>0` e il presidio `if(!(Number(price)>0)){ continue; }` alla riga **42043**: li' e' curata, qui no.

  2. `addBackfilledMt5Trade` riga **41192**: `const pl=netto!=null?netto:calculateForexPL(d.side,d.priceOpen,d.priceClose,lots,d.symbol);`. Quando il ponte non sa dire il profitto netto (`profit` nullo) il P/L si ricalcola dai prezzi, e `d.priceClose` nullo diventa 0. Misurato: riga del Journal con P/L **+40303.8 EUR** e **conto 50303.8 (+403,038%)** mentre la colonna «Uscita» resta **null**, perche' *quella* passa da `fblPrezzoValido`. Il prezzo «non esiste» per la colonna ed e' stato usato per il calcolo: l'incoerenza e' nello stesso oggetto.

  **IL MOMENTO («al momento che la apro»).** `placeRealMt5Order` riga **26597** fa `positions.push(pos)` e subito `draw(); update();` (riga **26607**), ma la fotografia del ponte arriva ogni 2 s: fino ad allora `mt5RealNet(ticket)` (riga **23486**) torna `null` perche' quel ticket non e' ancora in `mt5RealPositions`. `computeTotalLivePL` (riga **13621**, fallback riga **13643**) ha il fallback dichiarato nel commento — «Nessuna fotografia ancora arrivata dal bridge (es. appena aperta): fallback sotto… meglio un valore approssimato che ignorare la posizione» — e ricade sul calcolo locale con `price=currentPrice()`, difeso solo da `Number.isFinite`. Misurato: con l'ultima candela a `close=0`, il riquadro «P/L Live» mostra **+40303.8 EUR** su una posizione appena aperta (prezzo corrente letto: 0). **Lo stato di mezzo e' questo: la posizione esiste, il suo P/L vero no, e il calcolo parte comunque.**

  **LA CATENA FINO ALLA PROP FIRM — risposta alla domanda «una regola puo' scattare su un valore non ancora validato?»: SI', e lo SCRIVE.** Due strade misurate, entrambe rosse:

  - *dal flottante*: `propFirmFloatingPL()` (riga **6585**) e' `floatingPL()`; in sessione Storico/Storico PF il prezzo e' `currentPrice()` (riga **23702**) e il presidio e' `(price==null)?s:…` (riga **23709**), che lo zero supera. Misurato con capitale iniziale 10.000 e saldo chiuso 10.400 (+4%, sfida in corso): flottante **+40303.8** su un nozionale di **40303.8** (un profitto pari al 100% del valore della posizione, cioe' prezzo arrivato a zero: variazione impossibile, **nessuno la rifiuta**), equity **50703.8**, `profitPct` **407,038%** >= obiettivo 10% -> barra di stato «🎯 Obiettivo Prop Firm raggiunto! Il conto e' sbloccato per il finanziamento.»
  - *dal saldo chiuso*: la chiusura falsa non lampeggia, **resta**. `closeTrade` (riga **24637**) fa `equity.push(account)` (riga **24712**) e `propFirmClosedBalance()` (riga **6580**) legge l'ultimo valore di `equity`. Misurato: `equity` da `[10400]` a `[10400, 50303.8]`, `profitPct` **403,038%**, Challenge superata — **senza bisogno di nessun valore "di mezzo"**: il numero falso e' diventato storia del conto.

  **IL DANNO PERMANENTE.** `checkPropFirmRules` righe **7106-7120**: superato l'obiettivo, `propFirmSbloccataShown=true` (una sola volta per Challenge) e `fblPropContoStatoSalva` scrive in `localStorage` (`fbl_prop_conti`). Misurato, contenuto reale dopo UN giro su valore falso: `{"simulato":{"stato":"in_corso","preset":"ftmo-2step","fase":1,"faseSuperata":0,"faseSuperataQuando":…,"faseSuperataNumeri":{"capitaleIniziale":10000,"equity":50303.8,"profittoPct":403.038,"obiettivo":10}}}` — **la fase e' passata da 0 a 1 e resta scritta**. All'ultima fase il campo diventa `stato:'finanziato'`. Un lampo di un tick avanza la Challenge per sempre, e `checkPropFirmRules` gira a ogni giro di disegno (riga **14005**; misurata come la voce piu' cara del disegno, 67 ms), cioe' spesso e su stati di mezzo. Lo stesso vale a specchio per `triggerPropFirmViolation`.

  **NEL CLOUD CI FINISCE.** `closeTrade` chiude con `fblCloudSalvaTradeJournal()` (riga **24715**), che dopo l'attesa chiama `syncFullStatusToFirebase('trade-chiuso',true)` (riga **24633**) — con `force` **true**, cioe' **salta il limite di frequenza** perche' «e' esattamente il dato che non si puo' perdere» (riga **24631**). Misurato col finto: 1 chiamata, motivo `trade-chiuso`, `forza:true`. La riga falsa (P/L 40303.8, uscita 0) viene quindi scritta su Firestore e tornera' su ogni dispositivo.

  **CURA PROPOSTA, non applicata** (in ordine di gravita'):

  1. **Il presidio nel calcolo, non nei chiamanti.** `calculateForexPL` e `pipsFromPrice` restituiscono `null` se `fblPrezzoValido(entry)` o `fblPrezzoValido(exit)` e' `null`. I chiamanti gia' gestiscono il `null` quasi tutti; i pochi che no vanno adeguati. Una sola convenzione per «questo prezzo esiste», quella del 10 novembre.
  2. **Riga 26461**: `const pr=result.data.price!=null?Number(result.data.price):NaN; const price=(Number.isFinite(pr)&&pr>0)?pr:fblPrezzoRipiegoChiusura(pos,reason);` e, come alla riga 42043, non giornalizzare se il prezzo resta `<=0`. **Riga 41192**: se `netto==null` e `fblPrezzoValido(d.priceClose)` e' `null`, non scrivere `pl`/`pips` (lasciarli assenti e mostrare «—»), mai calcolarli.
  3. **Le regole Prop Firm decidono solo su valori validati e su variazioni possibili** (vedi PROGETTO-PROP-FIRM.md): nessun verdetto se una sola posizione aperta non ha un P/L valido; rifiuto di ogni variazione di equity superiore al nozionale complessivo delle posizioni aperte; conferma su due letture consecutive prima di scrivere `faseSuperata`/`stato`. Il verdetto che **scrive** va separato dal verdetto che **mostra**.

- **APERTO (misurato, causa trovata, non curato) 12 novembre 2026 - I 106 secondi per leggere il conto: il tempo NON e' nel ponte, e' nella STRADA. E il degrado di trenta volte non esiste** - `installer_build/build/bridge.py`, `app.html` (`fetchMt5WithTimeout` riga 40056, `fblUrlOrdini` riga 39836, `mt5PositionsGiro` riga 42839). Banco: `C:\Users\pietro\Documents\banchi_aperti_forex\banco_ponte_in_fila.py` (8 misure; carica il bridge.py VERO con un MetaTrader5 finto).

  Pannello del proprietario, 11 novembre 2026 ore 23:36, MT5 collegato, ZERO posizioni aperte:
  `lettura conto 239 volte, media 106.755 ms, peggiore 24.711.871 ms, 14 non riuscite` ·
  `ordine (altro) 2.163 volte, media 13.946 ms, peggiore 24.708.434 ms, 46 non riuscite` ·
  `lettura posizioni 2.154 volte, media 13.978 ms, peggiore 24.708.353 ms, 49 non riuscite` ·
  `chiusura 8 volte, media 5.043 ms, peggiore 8.306 ms, 8 NON RIUSCITE`.

  **1) IL PONTE NON E' LENTO. Misurato sul ponte VERO in esecuzione (12 novembre, MT5 collegato, 10 richieste sequenziali su 127.0.0.1): `/account` mediana 2,3 ms · `/positions` mediana 2,9 ms · `/orders` mediana 2,3 ms.** Sono gli stessi "2-3 ms in locale" gia' scritti in `app.html` riga 46949. Fra 2,5 ms e 2.508 ms ci sono MILLE volte, e non stanno dentro il ponte.

  **2) LE RICHIESTE NON SI METTONO IN FILA (risposta alla domanda centrale).** Tutte le rotte sono `def` e non `async def`: Starlette le manda nel threadpool di anyio, che ha **40 gettoni** (verificato: `anyio.to_thread.current_default_thread_limiter().total_tokens == 40`), e `uvicorn.run(app, host, port)` (riga 4138) non passa `workers`, quindi un processo e un solo event loop. Nessuna chiamata bloccante dentro un `async def` (l'unico `async def` e' il middleware `_torna_qualcuno`, riga 688, che fa solo `_annulla_spegnimento`). Banco, misura 3, con il terminale che serve una chiamata alla volta e 10 ms per chiamata: 24 richieste in volo -> media 137,8 ms. Misura 5: per arrivare ai 1.943 ms misurati servirebbe una chiamata IPC da **oltre 130 ms**; quella vera ne costa **1,2** (2 chiamate in 2,4 ms). La fila nel ponte spiega decine di millisecondi, non secondi.

  **3) CAUSA: la strada. Banco, misura 6** - stesso ponte, cambia solo l'andata/ritorno: 127.0.0.1 -> 3-6 ms · Tailscale sullo stesso PC -> 35 ms · server Oracle (261 ms, misura del 5 novembre in `app.html` riga 46949) -> 266 ms · server Oracle con rete lenta (2.500 ms) -> **2.506 ms, cioe' esattamente il numero del pannello**. E' lo stesso difetto del 7 novembre (`fblOrdiniVia='server'`, giro lungo attraverso Oracle), che la cura del 10 novembre chiude SOLO per il caso «la pagina la serve il ponte su 127.0.0.1:8000» (`fblPaginaDalPonteLocale`, riga 39828). **Con la pagina aperta sul sito in https, `fetch('http://127.0.0.1:8000/health')` dentro `fblControllaPonteLocale` (riga 39731) e' contenuto misto e il browser lo blocca: `fblPonteLocaleVivo` resta false per sempre e la strada cade su 'diretto' o 'server' anche stando davanti al PC.** RESTA IPOTESI (manca il dato): il pannello prestazioni **non riporta quale strada**. Si chiude aggiungendo `fblOrdiniVia` + `MT5_BRIDGE_URL` al rapporto (una riga, riga 52722).

  **4) IL DEGRADO DI TRENTA VOLTE NON ESISTE: e' UN SOLO evento.** Aritmetica sui numeri del pannello: il picco da 24.711.871 ms e' il **96,9%** di tutto il tempo misurato per `lettura conto` (e l'82% per posizioni e ordini). Togliendolo, la media vera e' **3.372 ms** (conto), **2.508** (posizioni), **2.524** (ordini). Alle 15:57 dello stesso giorno erano 3.832 / 1.943 / 1.919. Contando solo le letture nuove fra le due misure: 3.192 / 2.771 / 2.807. Il conto e' MIGLIORATO, le altre due sono salite del 43%: la stessa fascia, non trenta volte. **"Media 106 secondi" = un solo valore su 239.**

  **5) IL PICCO DA 24,7 MILIONI DI MS (6 h 51 m) NON E' UNA RICHIESTA APPESA NEL PONTE.** `fetchMt5WithTimeout` (riga 40054) impone un tetto a ogni chiamata: 30 s per letture, 60 s per `/order*`, 120 s per lo storico. 24,7 milioni di ms sono **823 volte** il tetto. Il cronometro e' `performance.now()` e l'`AbortController` scade con un `setTimeout`: se la scheda viene congelata o il PC va in sospensione, **nessuno dei due scorre** e al risveglio la richiesta risulta durata tutta la pausa. Conferma indipendente: fra le due misure sono passate solo 1.471 letture di posizioni in 27.540 s, **una ogni 18,7 secondi** (il timer e' a 1 s) - per quelle otto ore la pagina quasi non ha interrogato nulla. Ipotesi: sospensione/congelamento della scheda. Si chiude mettendo nel cronometro anche `Date.now()` e `document.visibilityState`.

  **6) LE OTTO CHIUSURE. Banco, misura 7: una chiusura costa 6 chiamate a MT5** (`terminal_info`, `account_info`, `positions_get`, `symbol_info`, `symbol_info_tick`, `order_send`) - 6 andate e ritorni sulla strada lunga fanno i 5.043 ms misurati, senza che il ponte abbia colpa. E misurato sul codice vero, questi esiti l'app li chiama tutti **"Chiusura reale non riuscita"**:
  - `retcode 10010` DONE_PARTIAL (eseguita A META'): `_send_trying_fillings` riga 2947 accetta SOLO `TRADE_RETCODE_DONE`, quindi risponde 400 «Ordine rifiutato dal broker». **E' IL CASO PERICOLOSO: metà posizione e' chiusa davvero, l'utente legge "non riuscita" e crede di essere ancora dentro per intero.** Con `type_filling=IOC` - la seconda modalita' che il ponte prova sempre - il fill parziale e' l'esito NORMALE con poca liquidita'.
  - `retcode 10008` PLACED: stessa cosa, detto «rifiutato».
  - `order_send` che restituisce **None** («non ha risposto»): misurato, il ponte **rimanda la chiusura TRE volte** (una per modalita' di filling: FOK, IOC, RETURN) e poi risponde 500. Una chiusura rimandata dopo un esito ignoto e' un rischio di doppione: se la prima era passata, la seconda e' un ordine in piu'.
  - `/order/close` (riga 3744) **non prende nessun lock**: `_mt5_order_lock` esiste e sta solo su `/order/market` (riga 3665). `/order/market/batch` dice «in sequenza (thread-safe)» nella sua descrizione ma non prende alcun lock.

  **7) IL LOCK CHE MANCA.** `mt5_feed_server.py` (righe 28-33 e 131-153) dichiara: «il pacchetto MetaTrader5 NON e' thread-safe ... chiamate concorrenti da thread diversi dello stesso processo possono lasciare l'IPC col terminale in uno stato bloccato» e obbliga a passare da `_mt5_call()` con un lock globale. **In `bridge.py` quel lock non c'e': 69 punti chiamano `mt5.*` nudo, dentro 40 thread.** Non spiega i secondi (vedi punto 2), ma e' il sospetto piu' naturale per le 109 letture «non riuscite» (`positions_get()` che torna None -> 503, riga 3191) e per i blocchi silenziosi. E' una mina, non la causa di oggi.

  **8) `GET /health` costa 25 ms di disco e CPU per niente.** Misurato: `/health` sul ponte vero 28-52 ms (il `/health` della 8001, che fa TRE chiamate a MT5, ne fa 11). Causa: `versione_servita()` (riga 921) -> `_coppia_valida` + `percorso_app("sw.js")` -> `_versione_da_app_html_file` legge **app.html INTERO (5,3 MB) e ci passa una regex: 21-26 ms misurati**, a ogni richiesta. Vale anche per `/`, `/app.html`, `/sw.js`, `/login.html` (`percorso_app`, riga 846: «Chiamata a ogni richiesta: niente stato da invalidare»).

  **CURA PROPOSTA, misurata e non applicata** (banco, misura 8: una sola fotografia rinfrescata da un filo a 1 Hz + precedenza a chi opera): le letture restano a **4,7-17 ms da 1 a 12 pagine** (contro 69 -> 399 ms che costa oggi una chiusura passando da 0 a 6 pagine) e la chiusura resta **piatta a 75-78 ms** anche con 12 pagine aperte. Nell'ordine: (a) portare al rapporto prestazioni la strada usata, prima di qualunque altra cura; (b) `_mt5_call()` con lock globale anche in bridge.py, come nel servizio dati; (c) `_send_trying_fillings` deve distinguere «eseguita in parte» ed «esito ignoto» da «rifiutata», e non rimandare mai una richiesta di trade dopo un esito ignoto; (d) `versione_servita()` con la versione letta una volta e ricordata.


- **APERTO (misurato, non curato) 12 novembre 2026 — «Mercato chiuso» su un asset che su MT5 è aperto: tre strade che decidono, e si contraddicono** - `app.html`. Banco: `C:\Users\pietro\Documents\banchi_aperti_forex\mercato_per_asset_dai_dati.test.mjs` (5 prove: 3 rosse, 2 di guardia verdi).

  Parole del proprietario, DUE facce dello stesso difetto misurate l'11 novembre 2026. Ore 22:00: «sono le ore 22 dell'11 novembre e non arriva più nessun dato. Sul grafico non c'è scritta nessuna etichetta del mercato chiuso, proprio perché da MT5 sul terminale ancora il mercato è aperto. Non devi prenderla alla lettera che alle 22 chiude il mercato, anche perché non tutti gli asset chiudono alle 22». Ore 23:32, con foto: sul Dollar Index (DXY) a 5 minuti l'etichetta rossa «🔒 Mercato chiuso · apre tra 00:28:16 (12 nov 00:00)» mentre su MT5 il DXY continua ad aggiornarsi. Pannello diagnostico: `fase=closed`, `fermo=true`, `ultimaCandela=2026-11-11T21:49:00.000Z`, `mt5: collegato`.

  **LE TRE STRADE, con i numeri di riga.** (1) `fblMercatoFermoOra()` riga **51729**: ordine MT5 `/symbol-check` (51731) → tick arrivati per quell'asset (51745-51748, soglia `FBL_MT5_SILENZIO_CHIUSO_MS` = 5 minuti, riga 47238) → orario scritto a mano (51751) → calendario dello strumento (51752). Decide candele, footprint, prezzo che valuta le posizioni, margine dell'asse. (2) `statoMercato()` riga **51396**: MT5 `/symbol-check` (51399) → calendario Capital.com (51402-51423) → orario scritto a mano (51419-51421). **I tick che arrivano non li guarda affatto.** È lei che disegna l'etichetta rossa, via `disegnaStatoMercato()` riga **51762**. (3) `liveSessionTick()` riga **51998** (timer a riga 52019) → `liveSessionFreezeMt5()` riga **51918**: decide **solo** con `liveSessionPhaseAt()` (riga 51224, `LIVE_MT5_CLOSE_MIN=22*60`, riga 51127), un giro al secondo.

  **QUALE HA VINTO NEL CASO DXY: la (3), poi la (2).** Riprodotto sul banco, stessa etichetta della foto: `{"chiuso":true,"apreAt":…,"fonte":"mt5"}` → «🔒 Mercato chiuso · apre tra 01:57:59 (12 nov 00:00)». La mezzanotte **non** è un calendario del DXY: è `fblProssimaRiapertura()` (riga 51316), che cerca il primo minuto in cui `liveSessionPhaseAt()` smette di dire `closed` e per costruzione non può tornare altro che le 00:00. Misurato: `fblProssimaRiapertura(23:32) === 2026-11-11T23:00:00.000Z`.

  **CAUSA VERA, la catena.** Alle 22:00 di Roma `liveSessionTick()` chiama `liveSessionFreezeMt5()`, che fa `stopMt5RefreshTimer(); disconnectMt5Stream(); mt5ActiveSymbol=null` (righe 51925-51926): **l'app si stacca da sola** dal passaggio dati, per qualunque asset non-cripto, qualunque cosa dica MT5. Questa è la faccia A («non arriva più nessun dato» — e non arriva perché l'app ha chiuso il canale). Da quel momento la regola «se non arrivano dati è chiuso» di `fblMercatoFermoOra()` **misura la disconnessione dell'app stessa**: dopo 5 minuti dice chiuso, e `fermo=true` si incastra (riga 50990 blocca il risync, riga 48078 il rollover). L'etichetta rossa, che passa da `statoMercato()`, arriva per conto suo dall'orario scritto a mano: ecco la faccia B. Nel caso delle 22:00 l'etichetta mancava perché `/symbol-check` aveva risposto «aperto» per XAUUSD mentre il congelamento era già scattato: **le due strade dicevano il contrario l'una dell'altra nello stesso istante** — ed è questo il difetto, non una delle due risposte.

  **LA DOMANDA P0 DEL DIARIO «quale orologio decide la chiusura» È CHIUSA: il DISPOSITIVO.** `liveSessionPhaseNow()` (riga 51857) è `liveSessionPhaseAt(Date.now())`, e ogni chiamante passa `Date.now()`, mai `mt5Adesso()` (riga 47263). Ma **non è la causa di questo difetto**: nella diagnostica del proprietario `scartoMinuti=0`. Resta un rischio aperto a parte, non questo.

  **QUELLO CHE MT5 NON PUÒ DARE, già misurato e da non riprovare** (`installer_build/build/mt5_feed_server.py`, righe 354-356): `symbol_info_session_quote()` **non esiste** in questa build della libreria (`[f for f in dir(mt5) if "session" in f]` è vuoto) e `sessions_quotes` dentro `symbol_info` vale `None`. Quindi il calendario vero per strumento non si può chiedere a MT5 così, e `trade_allowed` del ponte (riga 416) è a sua volta solo «tick più giovane di 180 s»: non un calendario.


- **APERTO (misurato, non curato) 11 novembre 2026 — I disegni spariscono: quattro strade misurate, tre rosse** - `app.html` (ripristino disegni righe 7865-7882, copia dedicata 7799-7812, documento condiviso 8045-8275). Banco: `C:\Users\pietro\Documents\banchi_aperti_forex\disegni_chiudi_riapri.test.mjs` (4 prove: 1 verde, 3 rosse) + diagnosi `diag_invio_grafico.mjs`.

  Parole del proprietario: «disegno qualcosa al grafico, lo lascio andare per ore e ore, poi dopo magari quando facciamo qualche aggiornamento, oppure chiudo l'applicazione e poi la vado a riaprire, quei disegni non ci sono più.»

  **Prova UNO — VERDE.** Il giro locale puro non è rotto: 3 forme disegnate in Live su XAU/USD, `flushDrawingsOnExit()`, `reload()` della pagina → **3 in memoria, 3 nella copia dedicata, 3 nello stato di sessione, 3 nel documento del cloud**. Quindi la perdita NON è nel salvataggio di base.

  **Prova DUE — ROSSA (la più grave).** Riaprendo con l'account non collegato (servizio account che non risponde entro i 20 s di `initSession`, token scaduto, apertura prima del login) e senza stato di sessione locale: la copia dedicata sul disco ha 2 forme firmate `uid=UTENTE`, `restoreDrawingsFromBackupIfNewer` (riga 7870) la **scarta** perché `(b.uid||null)===(uid||null)` è falso → **0 forme a grafico**. Poi basta UN disegno nuovo: `persistDrawingsBackupNow` riscrive la copia dedicata con `uid=null` → **backup 2 → 1**, le due vecchie **cancellate dal disco per sempre**. E lo stato di sessione viene riscritto vuoto con `savedByUid=null`: dal giro dopo, anche se l'account torna, la guardia `best.savedAt<=stateAt` (riga 7875) scarta il backup. Perdita definitiva.

  **Prova TRE — ROSSA.** 5 disegni veri su questo dispositivo contro UNA voce del cloud di IERI con UN disegno: vince il cloud. Causa misurata: `graficoT` (gli istanti di modifica) si salva in localStorage dentro un `try/catch` muto (riga 8019); se non c'è (magazzino pieno, altro indirizzo, dispositivo nuovo) ogni voce prende il **seme** `1+numero di disegni` (riga 8045) — misurato **6 contro 1794321888402** — e `if(r.t>lt)` (riga 8263) applica la voce povera. `graficoApplica` poi chiama `persistDrawingsBackupNow`: **5 → 1 anche sul disco**. Gli INDICATORI hanno l'unione che impedisce esattamente questo (riga 8098, «una voce vecchia non può MAI far sparire un indicatore»); i disegni no.

  **Prova QUATTRO — ROSSA (il «senza dire niente»).** Il controllo `if(byte>900*1024)` (riga 8228) pesa SOLO le voci di quell'invio, non il documento: con il documento già a 1.040 KB, mandare una voce da poche centinaia di byte passa, il documento arriva a **1.065.245 byte** (oltre il megabyte, il tetto vero di Firestore) e `graficoAvvisoPieno` resta **false**. E quando il cloud rifiuta, `graficoStat.errore` finisce solo nel pannello «Disegni condivisi» delle impostazioni: la barra di stato resta a «Carica il CSV per iniziare.» — **l'utente non vede niente**. (In più le voci in coda vengono buttate: `graficoDaInviare.clear()` alla riga 8215 sta PRIMA del controllo dei 900 KB.)

  **Sul «lascio andare per ore»:** cercata e NON trovata alcuna scadenza o pulizia a tempo dei disegni (ci sono per le notizie, 400 giorni, e per il footprint, 60 giorni — mai per i disegni). Le cose che dipendono dal tempo sono tre: la distanza minima di 60 s fra due scritture del documento condiviso (`GRAFICO_INVIO_MIN_MS`, riga 8147 — **misurato: dopo 4,5 s il disegno è ancora solo in coda**, quindi chi disegna e chiude entro un minuto non lo manda su); la rilettura del documento ogni 60 s (riga 8413), che è il motore che può applicare ORE DOPO una voce più povera (prova TRE) a programma aperto; e il tetto di 3.000 scritture al giorno (riga 1320) che a sessione lunga ferma ogni scrittura sul cloud.

- **APERTO (misurato, non curato) 11 novembre 2026 — Chiudendo e riaprendo, l'app «non risponde»: l'avvio del ponte si trattiene da solo** - `installer_build/build/bridge.py` (`_kill_stale_instances`, righe 965-1008, chiamata DUE volte: righe 3948 e 3971) + `desktop/desktop_shell.py` (`_ensure_backend`, riga 91).

  Parole del proprietario: «quando chiudo l'applicazione poi la vado a riaprire subito dopo, la pagina mi da' sempre forex backtest lab non risponde, e si inchioda».

  **Quattro misure, nessuna supposizione** (11 novembre 2026, PC del proprietario, app accesa dalle 15:24):

  1. **La pulizia anti-orfano trattiene l'avvio 20,1 secondi, e viene chiamata due volte.** Misurato col taskkill finto e le porte vere: `_kill_stale_instances()` = **20.107 ms** (due `_aspetta_porta_libera` da 10 s ciascuna). Entrambe le chiamate stanno PRIMA di `uvicorn.run()` (riga 3978): fino a ~40 s in cui la porta 8000 non risponde a nessuno. Dall'altra parte `_ensure_backend` aspetta al massimo 30 s, un `time.sleep(1)` per volta.
  2. **Il servizio dati viene avviato DUE volte a ogni accensione.** Dal log vero dell'eseguibile installato, una sola accensione: `servizio dati MT5 avviato (pid 24280)` ... `servizio dati MT5 avviato (pid 6836)`, e solo DOPO `Started server process [23580]`. Il secondo giro di pulizia (riga 3971) chiude per nome `Mt5FeedServer.exe` e `SegnaliBridge.exe`, cioe' i figli che le righe 3953 e 3956 avevano appena avviato. Il «servizio figlio arrivato in ritardo» del commento alla riga 3966 e' il PROPRIO.
  3. **Il ponte si uccide il proprio avviatore onefile.** Albero dei processi letto dal sistema: tutti i nostri exe hanno la coppia avviatore+processo (8,3 MB + 59-111 MB) tranne `ForexBacktestLAB.exe` (pid 23580, padre 26620 **morto**). L'unico che chiude quel nome e' `_kill_stale_instances` con `/FI "PID ne <mio>"`: l'avviatore ha un PID diverso dal proprio, quindi il filtro non lo protegge. **Conseguenza materiale, contata: 359 cartelle `_MEI*` nella cartella temporanea per 17.446 MB (17,4 GB), su un disco con 39 GB liberi**, 20-40 nuove al giorno — e' l'avviatore che doveva cancellarle.
  4. **Tailscale NON inganna il custode, e la diagnosi che lo accusava era sbagliata.** `_servizio_gia_vivo` (riga 1088) apre una TCP **solo su 127.0.0.1**: misurato con un socket vero legato a 192.168.1.5, risponde `False` — non vede chi tiene la porta su un altro indirizzo. E uvicorn lega sempre 127.0.0.1 (`accesso_condiviso.host_di_ascolto`, riga 117), quindi nemmeno il bind collide. Invece `_chi_tiene_la_porta` (riga 1026) legge `netstat -ano` e prende la **prima** riga `LISTENING` senza guardare l'indirizzo: misurato, con 127.0.0.1 libera accusa comunque il processo in ascolto sulla LAN. E' quella funzione che il 9 novembre ha fatto scrivere «PID 9916, Tailscale» come causa.

  **Resta ipotesi (da confermare con la procedura di misura):** `_ensure_backend` si accontenta che la 8000 sia APERTA; se il ponte vecchio sta ancora morendo (`_spegni_tutto_adesso` fa `mt5.shutdown()` e un PowerShell con timeout 8 s prima di `os._exit(0)`) la finestra nuova si attacca a un ponte che sparisce subito dopo, e nessuno riprova da solo. E non e' misurato su quale thread pywebview esegua `_Api.riprova()` e `nuova_finestra()`: se e' quello della finestra, i 30 s di attesa dentro `_ensure_backend` sono letteralmente il «non risponde» di Windows.

  **Banco (rosso oggi, fuori dal repository perche' rosso):** `banchi_aperti_forex/riapertura_ponte_misura.py` — 6 prove, 4 rosse, 1 verde (la prova di controllo che scagiona Tailscale), 1 lenta a richiesta (`BANCO_LENTO=1`, 20 s). Procedura a mano in due minuti: `banchi_aperti_forex/PROCEDURA_MISURA_RIAPERTURA.txt`.

- **RISOLTO 3 novembre 2026 — Il mercato risultava chiuso su strumenti che invece erano aperti** - `app.html` + `installer_build/build/mt5_feed_server.py`.

  Chiesto dal proprietario (3 novembre 2026): "ogni asset apre e chiude in fasce orarie diverse. NZD/CAD in questo momento il mercato e' aperto. E in realta' mi dice che il mercato e' chiuso e che apre tra 17 minuti a mezzanotte. Ed e' impossibile perche' sul terminale MT5 il mercato e' aperto e il PL live si aggiorna di quell'asset."

  **Causa vera, misurata.** Lo stato del mercato era deciso da una schedule fissa valida per tutti (chiusura alle 22 di Roma). Uno strumento che chiude alle 23 risultava chiuso alle 22, e uno che chiude alle 21 risultava aperto fino alle 22. MT5 lo sa simbolo per simbolo, ma l'app non glielo chiedeva.

  **Cura.** `/symbol-check` sul ponte ora restituisce `trade_allowed` e `trade_mode` (da `mt5.symbol_info`): `trade_allowed` e' vero solo quando il mercato di quel simbolo e' davvero aperto. L'app lo chiede per l'asset a grafico ogni 30 secondi (cache per asset, `fblMercatoMt5Cache`), e `statoMercato()`/`fblMercatoFermoOra()` lo leggono per primi: se MT5 dice aperto, non si dice chiuso. Senza risposta di MT5 resta l'orario fisso di prima, invariato.

  **Attenzione al pacchetto:** il ponte e' cambiato, quindi serve il **Setup nuovo** perche' la cura arrivi fino in fondo. Senza, `/symbol-check` risponde senza `trade_allowed` e l'app si comporta esattamente come adesso (nessuna rottura).

  **Test:** `laboratorio/app/mercato_stato_mt5.test.mjs` (3 prove, comprese due prove di controllo: MT5 dice chiuso -> resta chiuso; senza risposta -> resta l'orario fisso). Provato nei due sensi: senza la cura rosso, con la cura verde.

- **RISOLTO 3 novembre 2026 — La scala dell'interfaccia viaggiava tra i dispositivi** - `app.html`, canale preferenze del cloud.

  Chiesto dal proprietario (3 novembre 2026): "se sono su un dispositivo mobile ed eseguo lo zoom dell'intera impaginazione, della scala, me la va a modificare anche su tutti gli altri dispositivi collegati. Invece no, deve essere una cosa indipendente tra dispositivo e dispositivo... se lo imposto sul tablet, la scala rimane soltanto per il tablet. Assolutamente no."

  **Causa vera, misurata.** La scala UI (`fbl_ui_scala_pct`) stava nel canale delle preferenze sincronizzate sull'account, in quattro punti: `fblScalaUiSalva()` (salvava in locale e poi pubblicava le preferenze), `fblSyncPrepara()` (metteva `scala` nel documento da pubblicare), `fblSyncRicevi()` (riscriveva `FBL_UI_SCALA_KEY` nel magazzino di chi riceveva) e `applicaPreferenzeDalCloud()` (applicava alla pagina il valore arrivato).

  **Cura.** La scala esce dal canale in tutti e quattro i punti: si salva solo nel magazzino del dispositivo, non si pubblica, non si accetta, non si applica dal cloud. Watchlist e ricerche salvate continuano a viaggiare come sempre: sono scelte dell'account, non dello schermo.

  **Test:** `laboratorio/app/sync_preferenze.test.mjs` (12 prove, compresa "cambiare la scala sul telefono NON la cambia sul PC" e la prova di controllo che la sola scala non pubblica niente) e `laboratorio/app/sync_impostazioni.test.mjs`. Provato nei due sensi: senza la cura i test esistenti erano rossi sulle asserzioni che esigevano il viaggio, con la cura verdi.

- **RISOLTO 3 novembre 2026 — Nel replay gli order block risultavano già mitigati (look-ahead)** - `app.html`, `compute()` di tutti gli indicatori incrementali (`INDICATOR_DEFS`).

  Chiesto dal proprietario (3 novembre 2026): "in modalita' replay, l'indicatore order blocks, quando avanziamo, ci fa vedere che l'order block e' gia' stato mitigato, invece no, deve risultare mitigato soltanto quando il mercato ci torna in quella zona... Non puo' essere mitigato appena si forma. Deve seguire la stessa logica identica della modalita' reale. Importantissimo per il backtest."

  **Causa vera, misurata.** Il calcolo degli indicatori e' incrementale: `compute(rows, upToIdx, ind)` riparte da `st.builtTo+1` e arriva a `upToIdx`. `st.builtTo` veniva azzerato solo se cambiava l'array `rows` o i parametri - e nel replay l'array `rows` è sempre lo STESSO storico CSV. Quindi:
  - avanzando fino alla candela in cui il prezzo torna nella zona, la zona viene segnata `mitigated=true` con `mitIdx` = quella candela;
  - tornando INDIETRO col replay, `upToIdx` diventa piu' piccolo di `builtTo`, il ciclo non gira affatto e la zona RESTA mitigata con l'indice del tocco futuro.
  Risultato: nel replay si vede una mitigazione che deve ancora avvenire - guardare nel futuro, il difetto peggiore per un backtest.

  **Cura.** Aggiunta alla condizione di reset la terza possibilita' `|| upToIdx<st.builtTo`: se il replay chiede una candela precedente a quella gia' calcolata, si butta tutto e si rifa' da zero fino a `upToIdx`. La zona ridiventa VIVA finche' il mercato non ci torna davvero; riavanzando, la mitigazione ricompare da sé. Applicata a TUTTI gli indicatori con lo stesso schema incrementale (OB, FVG buyside/sellside, Support & Resistance with Breaks, ICT Reversal Setup, EMA), perche' il difetto era della classe, non di uno solo.

  **Strada NON presa, e perche':** invertire il calcolo (togliere la mitigazione quando si torna indietro) sarebbe parso piu' efficiente, ma la mitigazione di una zona dipende da decine di candele, dal run dell'impulso e dallo stato dei pivot: smontarla e' molto piu' fragile che rifare.

  **Test:** `laboratorio/app/ob_replay_mitigazione.test.mjs` (2 prove, compresa la prova di controllo che la mitigazione non sia stata semplicemente spenta). Provato nei due sensi: senza la cura è ROSSO, con la cura è VERDE.

- **RISOLTO 2 novembre 2026 — In replay i segnali non eseguivano ordini reali, e l'apertura si fermava a metà se il grafico era su un altro asset** — `app.html`, `tgEseguiSegnale` (~34613) e la guardia alla porta di `fetchMt5WithTimeout` (~36152).

  Chiesto dal proprietario (2 novembre 2026): in replay i segnali che arrivano devono eseguire in background **sul conto MT5 reale**, e con più conti selezionati deve aprire le posizioni sugli altri conti e poi tornare al conto/alla candela del backtest.

  **Causa vera, misurata:** tre guardie indipendenti, una per sintomo.
  (a) `reale` era `!!mt5Connected&&sessioneLive&&!liveReplayActive` → in replay valeva falso e i segnali diventavano posizioni finte;
  (b) un blocco unico **alla porta** in `fetchMt5WithTimeout` scartava *tutte* le rotte `/order` con il replay attivo;
  (c) nel ramo senza conto reale `if(currentAssetKey!==sym){...break;}` interrompeva l'apertura a metà se il grafico guardava un altro asset → alcune posizioni aperte e altre no.

  **Cura:** `reale` senza piu' `!liveReplayActive`; tolto il blocco alla porta; tolta la riga che interrompeva l'apertura.

  **Sulla scelta:** rovescia quella del 26 ottobre (richiesta esplicita del proprietario: «in replay le posizioni non vengono aperte sull'account MT5»), confermata il 2 novembre con cognizione di causa sul rischio di ordini reali in background.

  **Prova del rosso:** rimessa la guardia alla porta → 3 rossi, e le 3 prove di controllo (letture, fuori-replay, rotte che non scrivono) rimaste verdi.

  **Test:** `laboratorio/app/replay_mai_ordini_veri.test.mjs`, 6 prove.

  **Nota importante:** il «torna al conto di prima e si ricorda della posizione» **già funzionava**. Il percorso a conto reale passa da `senzaGrafico`, che lancia gli ordini in batch con il simbolo esplicito e **non tocca** `currentAssetKey`: l'apertura in background lascia il grafico e la candela del replay dove sono. Era la guardia (c) a fermare l'apertura prima.
- **RISOLTO 2 novembre 2026 — "l'app non risponde / crasha alla riapertura", soprattutto a
  mercato chiuso** - `app.html`, `getVisibleData()` (riga ~12874). Il filtro che toglie le
  candele dopo la chiusura chiedeva al calendario dello strumento **per ogni candela
  visibile**: ogni domanda costruisce `orariIntervalli()` (dieci giorni, dieci
  `Intl.DateTimeFormat` per fuso - e `orariScartoZona()` ne creava uno nuovo a ogni chiamata) e
  cerca la riapertura su `4*24*60` minuti. Con una fascia di candele che sta PRIMA della
  chiusura il ciclo non si interrompeva mai: tanti calendari quante candele, nello stesso giro
  di disegno. Misurato con `chiusura_mercato_prestazioni.test.mjs`: **23 calendari per 80
  candele visibili**, e il numero cresceva con le candele.

  **Perche' il commit 09b6b0a non lo aveva risolto.** Aveva reso condizionale solo il filtro,
  non il costo: a mercato chiuso la condizione e' vera, quindi il ciclo per candela girava
  comunque - anzi, e' proprio a mercato chiuso che serve.

  **Cura.** (a) `orariScartoZona()`: il formattatore si tiene in cache per fuso; (b)
  `getVisibleData()`: la fascia visibile e' ordinata per tempo e, da quando il mercato chiude,
  resta chiuso fino in fondo, quindi **il punto di taglio si cerca su meta' fascia** - `log2`
  delle candele invece delle candele - col predicato invariato `fblMercatoFermoOra`, cioe' le
  stesse candele di prima. Resta lo scorrimento linea per linea solo nel caso rarissimo di
  candele senza data. Dopo la cura la stessa misura da' **8 calendari** e non cresce piu' con
  le candele.

  **Strada sbagliata, da non riprovare:** prendere la chiusura dal calendario Capital.com
  (`iv[i][1] <= adesso`) e poi confrontare i timestamp. È rosso perche' quel calendario e' in
  UTC mentre la schedule MT5 e' sulle 22 di Roma: taglia all'ora sbagliata (80 candele invece
  di 20). Cercando su meta' fascia si usa lo STESSO predicato di prima, quindi il punto di
  taglio non puo' cambiare.

  **Test che lo controlla:** `laboratorio/app/chiusura_mercato_prestazioni.test.mjs` (rosso
  senza la cura, verde con; e non puo' passare "a vuoto" perche' pretende che il filtro tagli
  davvero).

## Aperti / limiti noti
- **RISOLTO 28 ottobre 2026 — Ogni release senza APK rompeva il collegamento per Android** - 28 ottobre
  2026, trovato pubblicando la 2.0.37. `index.html` riga 3528 punta a
  `releases/latest/download/forexbacktestlab.apk`: appena esce una release NUOVA senza APK
  allegato, quel collegamento da' 404, perche' "latest" e' cambiato. E' gia' successo con la
  2.0.36 ("non e' presente l'apk nella release quindi i dispositivi mobili non trovano il file").

  **Perche' non si risolve copiando l'APK vecchio.** Misurato aprendo il pacchetto: l'APK e'
  un'app **Capacitor** che si porta dentro TUTTO il sito (`assets/public/app.html`,
  `assets/public/sw.js`), e `capacitor.config.json` **non ha `server.url`**: carica i file
  impacchettati, non il sito. Il `CACHE_NAME` dentro l'APK della 2.0.36 dice proprio
  `forex-backtest-lab-v2.0.36`. Copiarlo nella release nuova darebbe ad Android un'app bloccata
  alla versione vecchia che si dichiara da aggiornare, offre il download, scarica se' stessa e
  ricomincia: lo stesso giro a vuoto gia' pagato sul PC con `app.html` congelato dentro
  l'eseguibile.

  **Perche' non si automatizza oggi:** il progetto Android (Capacitor) **non e' nel repo** - sta
  solo sul computer del proprietario, ed e' il motivo per cui l'APK si costruisce a mano in
  Android Studio. Nessun flusso di GitHub puo' farlo finche' il progetto e la chiave di firma
  non sono disponibili alla CI.

  **RISOLTO.** Il progetto Capacitor e' nel repo (5,7 MB: fuori node_modules, le build e le copie
  del sito) e il flusso Release , versione 2.0.37, versionCode 20037
total 5340
drwxr-xr-x 1 pietro 197121       0 Oct 28 08:58 .
drwxr-xr-x 1 pietro 197121       0 Oct 28 08:57 ..
-rw-r--r-- 1 pietro 197121 5137367 Oct 28 08:57 app.html
-rw-r--r-- 1 pietro 197121   47138 Oct 28 08:58 asset-library.html
-rw-r--r-- 1 pietro 197121   16263 Oct 28 08:58 icon-192.png
-rw-r--r-- 1 pietro 197121   49372 Oct 28 08:58 icon-512.png
-rw-r--r-- 1 pietro 197121     660 Oct 28 08:58 index.html
-rw-r--r-- 1 pietro 197121   13854 Oct 28 08:58 informativa-bot.html
-rw-r--r-- 1 pietro 197121   36876 Oct 28 08:58 login.html
-rw-r--r-- 1 pietro 197121     756 Oct 28 08:58 manifest.json
-rw-r--r-- 1 pietro 197121   21817 Oct 28 08:58 privacy.html
-rw-r--r-- 1 pietro 197121   13916 Oct 28 08:58 rischi-finanziari.html
-rw-r--r-- 1 pietro 197121   67274 Oct 28 08:58 sw.js
-rw-r--r-- 1 pietro 197121   22094 Oct 28 08:58 termini.html
::error::Manca il segreto ANDROID_KEYSTORE_BASE64. Vedi cervello/GUIDA-APK-AUTOMATICO.md, passo 3.
chiave di firma pronta costruisce l'APK a ogni release pubblicata,
  firmato con una chiave di rilascio vera presa dai Secrets, con  ricavato da sw.js
  (2.0.37 -> 20037) invece del vecchio  fisso, e con una verifica  prima di
  allegarlo. Verificato sulla 2.0.37: il collegamento e' tornato 200, e dentro il pacchetto ci
  sono versione 2.0.37, emoji sane e nessuna traccia della chiave di debug.

  Due inciampi trovati e corretti costruendolo: Capacitor 8.5.3 pretende **Node 22** (col 20
   passa con un avviso e poi  muore senza spiegare), e 
  contiene l'**impronta della chiave di firma** - cambiando chiave, l'accesso con Google si
  sarebbe rotto con un errore muto. Ora ci sono due impronte registrate su Firebase.

  **Resta un passo manuale UNA VOLTA SOLA:** l'app installata oggi e' firmata col debug, quindi
  va disinstallata e reinstallata. Dopo, gli aggiornamenti sono automatici per sempre.

  ~~La regola, finche' non si automatizza:~~ ogni volta che si pubblica una versione, **l'APK va
  ricostruito e allegato a QUELLA release**, oppure il collegamento per Android resta rotto. Non
  e' un passo facoltativo della catena di pubblicazione: e' l'unico modo perche' i telefoni
  ricevano l'aggiornamento.
- **Collegato a un account MT5 si vedevano anche le posizioni dell'altro account** - risolto 2.0.29 - 26 ottobre 2026, segnalato con «se mi collego a un account devo vedere sul grafico soltanto le posizioni di quell'account ... non posso vedere entrambe le posizioni di tutti e due gli account». Causa: `positionBelongsToCurrentView()` con MT5 collegato accettava qualunque posizione con `mt5Ticket!=null`, senza confrontare il login del conto attivo (`currentMt5AccountTag()`), mentre `tradeBelongsToCurrentView()` lo faceva già per i trade chiusi. Ora il filtro delle posizioni aperte è identico a quello dei chiusi.
- **Il P/L live dell'app era diverso dal terminale MT5** - risolto 2.0.29 - 26 ottobre 2026, segnalato con «andando a vedere sul terminale MT5 vedo il PL Live ed è diverso rispetto a quello che mi mostra qui l'applicazione». Causa: `floatingPL()` sommava `mt5RealProfit()` (solo profitto di prezzo), lasciando fuori swap e commissione che il terminale include. Ora usa `mt5RealNet()` (profit+swap+commissione).
- **Il P/L live si aggiornava dopo secondi** - risolto 2.0.29 - 26 ottobre 2026, segnalato con «l'aggiornamento è veramente lento, si aggiorna dopo secondi». Causa: il polling delle posizioni MT5 dal bridge era a 2000 ms. Portato a 1000 ms.
- **Le etichette TP/SL si sovrapponevano e serviva un pulsante per scompattarle** - risolto 2.0.29 - 26 ottobre 2026, segnalato con «devono raggrupparsi nel grafico se nella stessa linea di prezzo ci sono più etichette ... l'utente premerà quell'unica etichetta e quando la preme si espanderà ... e non deve stare il pulsante all'interno di style». Causa: il raggruppamento era solo una modalità alternativa al pulsante "Esplodi etichette" nelle impostazioni. Ora il raggruppamento è il comportamento di default sempre attivo, il pulsante è rimosso, il gruppo si espande al click sull'etichetta ×N e si ricompone al click su un punto vuoto.
- **I disegni slittavano a ogni cambio di timeframe** - risolto 2.0.29 - 26 ottobre 2026, segnalato con «i disegni devono rispettare sempre la stessa identica posizione ... non è possibile che ogni volta che cambia time frame si spostano». Causa: `fblDisegniRiAgganciaAlTf()` spostava ogni ancora al timestamp della candela del TF nuovo più vicina (10:07 → 10:05 o 10:10), cambiando la posizione visiva del disegno. Ora i disegni mantengono il timestamp ASSOLUTO e `dataPosFromTime()` li mappa dentro la candela del nuovo TF alla stessa frazione. Test: `laboratorio/app/disegni_cambio_tf.test.mjs` (riscritto: misura che timestamp e prezzi non si toccano e che 10:07 cade nella candela 5m 10:05-10:10 al 40%).
- **Le candele del grafico erano sfasate di 8h20** - risolto 2.0.2 - 18 ottobre 2026,
  segnalato con «XAU/USD chiude alle 04:55 su MT5, qui alle 13:15 sull'app». Causa misurata:
  `_server_time_offset_seconds()` (`mt5_feed_server.py` per le candele, `bridge.py` per
  posizioni e ordini pendenti) calcolava lo scarto fra orologio server e UTC come
  `tick.time - time.time()` su QUALUNQUE tick, anche uno lasciato indietro da ore: con la
  chiusura giornaliera dell'oro il tick aveva 8h20 di età e quella età sostituiva il fuso
  reale. Ora la misura ha una guardia a 4 livelli: tick fresco → scarto vero (griglia 1800 s
  dei broker); altro simbolo che quota adesso → il suo orologio fa da misura per tutti;
  scan Market Watch al più una volta al minuto; altrimenti 0 o l'ultimo scarto buono, mai un
  numero a caso. Test: `laboratorio/ponte/test_scarto_server.py` (12 prove, con `time` e
  `MetaTrader5` finti, gira anche su CI Ubuntu).
- **Il riquadro dell'installazione da telefono sbagliava su certi dispositivi Android** -
  risolto 2.0.2 - 18 ottobre 2026, `index.html`. Sintomo: «Non c'è una versione installabile
  per questo dispositivo» su Android, e «resta sul web invece di riaprire l'app» dopo il login.
  Causa: `piattaforma()` guardava solo `navigator.userAgent`, e certi browser/webview Android
  non si dichiarano tali — il riquadro cadeva nel ramo «altro» e l'intent verso l'app non
  partiva mai. Ora, falliti i nomi, si guarda l'hardware (`userAgentData.mobile`, oppure
  tocco + `pointer:coarse`): quel telefono riceve la porta Android e l'offerta dell'APK.
  Test: `laboratorio/app/porta_dopo_login.test.mjs` (i tre casi «UA senza nomi»).
- **Login Google da telefono: pagina «400» di Google al primo accesso** - limite noto, non
  risolvibile da noi - 18 ottobre 2026, APK. Dopo l'installazione il primo accesso con
  l'account Google finisce su una pagina di errore **400** mostrata da `accounts.google.com`
  (si vede nell'indirizzo), non dall'app; premendo «Indietro» e riprovando il login riesce.
  Causa: la prima apertura interrompe la continuità OAuth di Google (il browser interno
  dell'APK non ha ancora la sessione pending, e Google rifiuta la richiesta in corso con il
  suo 4 corposo); al secondo tentativo la sessione c'è e il flusso va a buon fine. Nessun
  rimedio in codice: è «riprova e funziona», documentato qui perché non sembri un guasto
  dell'app.
- **Il login con Google su telefono e tablet non veniva mai eseguito** - risolto 2.0.1 - 18
  ottobre 2026, segnalato con due errori ("Unable to process request due to missing initial state"
  e "Impossibile raggiungere il sito / Connessione negata da localhost"). DUE cause misurate, tutte
  e due nella strada del reindirizzamento di Firebase:
  (1) `capacitor.config.json` non aveva `server.allowNavigation`, e `Bridge.launchIntent` di
  Capacitor butta nel BROWSER ESTERNO ogni navigazione fuori dall'app: il giro di Google finiva in
  Chrome (app → firebaseapp.com → accounts.google.com → https://localhost/login.html), e su
  localhost Chrome non trova nulla. Ora `allowNavigation` contiene "*.firebaseapp.com" e
  "*.google.com"; il sito resta fuori, perche' il collegamento in alto a sinistra dell'APK deve
  aprirsi nel browser (test `apk_login_google.test.mjs`).
  (2) Lo stato del reindirizzamento vive in `sessionStorage`, in memoria del processo: Android
  uccide la WebView durante la scelta dell'account e al ritorno Firebase butta "missing initial
  state". Ora il pulsante Google archivia tutto in `localStorage` prima di partire e lo rimette al
  posto PRIMA di `getRedirectResult`; la bandierina porta l'orario, cosi' un backup scaduto viene
  consumato e non blocca l'accesso di chi e' gia' loggato. Telefono e tablet usano il
  reindirizzamento anche nel browser (niente popup); un popup bloccato ripiega sul
  reindirizzamento. Test: `laboratorio/app/login_stato_google.test.mjs`.
  In piu', dopo il login sul SITO si torna alla porta d'ingresso (`index.html?dopo=login`) che
  apre l'app installata o offre l'installazione, con sempre l'uscita "Continua col sito web"
  verso app.html: test `laboratorio/app/porta_dopo_login.test.mjs`.
- **Colonne COB/SVP con righe di altezza diversa da asset a asset, e staccate sulle cripto** -
  risolto v146 - 14 ottobre 2026, segnalato con tre foto (EUR/USD, XAU/USD, BTC/USDT). Il passo
  delle righe veniva da `footprintStepForAsset`, cioe' dall'impostazione del FOOTPRINT: pip per
  "altezza riga", un numero tarato sull'altezza di una CANDELA. Una scaletta di liquidita' non
  c'entra niente con l'altezza di una candela, e quel passo cambia da strumento a strumento in modo
  tutto suo: su EUR/USD usciva una riga da una decina di pixel, su XAU un paio, e sulle cripto era
  cosi' fine rispetto all'intervallo di prezzo che i livelli del book finivano in bin sparsi, coi
  buchi in mezzo. Ora il passo si decide in PIXEL (COB_SVP_RIGA_PX) e si arrotonda a un passo tondo
  dello strumento (1/2/5 x 10^n volte il pip, con le soglie geometriche). In piu' i bordi sono
  arrotondati al pixel e le barre hanno l'altezza piena: era quel mezzo pixel a farle sembrare
  staccate. Test: `laboratorio/app/cob_svp_scala.test.mjs`.
- **Le bandiere delle notizie non si vedevano su telefono e tablet** - risolto v146 - 14 ottobre
  2026. Le bandiere si disegnano solo se `newsEvents` ha qualcosa dentro, e quello si riempie solo
  col POLLING - che partiva da due strade sole: il passaggio Storico->Live fatto a mano, e la
  riconnessione automatica a Capital.com dopo un refresh. La seconda sul telefono NON PUO'
  avvenire: legge le credenziali da una cartella del computer (File System Access API, che su
  telefono e tablet non esiste). In Live da telefono newsEvents restava vuoto per sempre. Nota: lo
  stesso difetto era gia' stato corretto una volta sul PC, ma aggiungendo la chiamata in QUEL ramo
  - una cura che vale solo per la strada che si conosce. Ora newsPollingSincronizza() allinea il
  polling allo stato, ed e' chiamata da updateLiveModeUI(), l'unico punto che tutte le strade
  attraversano. Test: `laboratorio/app/notizie_altri_dispositivi.test.mjs`.
- **Una posizione si "selezionava da sola" e nascondeva le altre** - risolto v146 - 14 ottobre
  2026, segnalato dal proprietario ("da un momento all'altro, in maniera casuale, viene
  visualizzata la singola operazione; noi non abbiamo premuto niente"). `active` faceva DUE
  mestieri: la posizione su cui lavorano le caselle SL/TP - che l'app riassegna DA SOLA in cinque
  punti, tutti con la stessa riga `active = l'ultima posizione di questo asset` (cambio asset,
  chiusura di una posizione, ripristino di sessione, adozione dal conto MT5) - e, dalla v142,
  anche la posizione SCELTA, quella che fa sparire le caselle di tutte le altre. Finche' il
  mestiere era uno solo nessuno se ne accorgeva; col secondo, ogni riassegnazione automatica
  diventa una selezione che l'utente non ha fatto, e sembra che succeda "a caso" perche' succede
  quando cambia qualcos'altro. Ora c'e' `posSelezionata`, che mette solo un clic e toglie solo un
  clic sul vuoto. Test: `laboratorio/app/selezione_posizioni.test.mjs`.
  LEZIONE: quando una variabile che l'app riassegna da sola acquista un SECONDO significato
  "deciso dall'utente", vanno separate. Il difetto che ne esce sembra casuale e non lo e'.
- **Col dito il tocco sul vuoto non deselezionava (serviva la penna)** - risolto v146 - il gestore
  di pointerup del grafico esce prima per `pointerType==='touch'`, e il blocco della deselezione
  stava DOPO quell'uscita: col dito non ci si arrivava mai. E' lo stesso identico difetto gia'
  pagato una volta sulla stessa uscita anticipata (il cambio stile del footprint). Ora il blocco e'
  una funzione, `fblClickSuVuoto()`, chiamata da tutti e due i rami.
- **Syntra: un utente che manda segnali ogni giorno non veniva MAI rilevato** - risolto v145 -
  14 ottobre 2026, segnalato dal proprietario ("le operazioni crypto non vengono acquisite, c'e'
  Gino che manda segnali ogni giorno e non lo rileva mai"). Due cause, tutte e due silenziose:
  (1) una notifica veniva riconosciuta solo se la data stava sulla PRIMA riga e aveva l'anno di
  quattro cifre; la stessa app scrive le date anche senza anno. (2) Peggio: `nt["quando"] or 0` -
  una data NON LETTA diventava 0, cioe' il 1 gennaio 1970, e il controllo sull'eta' la dichiarava
  "vecchia" sempre, scartandola senza dire niente. Ora la data si legge in piu' forme e una data
  sconosciuta NON vuol dire vecchia: la notifica si apre lo stesso (l'insieme `visti` basta gia' a
  non riaprire le stesse). Test: `laboratorio/ponte/test_syntra_notifiche.py`.
  LEZIONE: `x or 0` su un valore che puo' essere None e che poi si confronta con un tempo e' una
  trappola: trasforma "non lo so" in "vecchissimo".
- **Syntra: segnali senza target ne' stop, quindi scartati** - risolto v145 - le due espressioni
  che leggono TP e SL pretendevano etichetta e numero NELLO STESSO nodo ("TP #1:
80335"). Dove
  l'app li scrive in due nodi separati non trovavano niente, il segnale usciva senza livelli e
  veniva buttato. Ora c'e' il ripiego gia' usato per "Entrata": etichetta, poi il primo numero.
  Test: `laboratorio/ponte/test_syntra_asset.py`.
- **Il cambio stile del footprint non si prendeva sulle candele passate** - risolto v145 -
  14 ottobre 2026, segnalato due volte dal proprietario ("deve funzionare su TUTTE le candele, in
  qualsiasi timeframe e per tutti gli asset, rendilo definitivo"). LA DIAGNOSI SBAGLIATA sarebbe
  stata "il gestore guarda solo la candela di adesso": riprodotto nel banco di prova, il
  meccanismo rispondeva su OGNI candela. Il difetto era il BERSAGLIO: la fascia sensibile era
  larga quanto il CORPO della candela (bw, cioe' il 62% della colonna, con un tetto di 12 px senza
  footprint) e alta quanto la candela piu' 18 px sopra e 6 sotto - misurati 9 px per 45. Un
  bersaglio cosi' si prende per fortuna, col dito su un tablet mai, e fra una colonna e l'altra
  restava il 38% di spazio morto. Ora la fascia e' tutta la colonna (cw/n) e si allarga sopra e
  sotto di almeno 22 px, restando comunque legata al prezzo di QUELLA candela (lontano dalle
  candele il grafico non viene toccato) e con le precedenze di prima (posizioni, caselle TP/SL,
  livelli, disegni). Test: `laboratorio/app/footprint_tocco_stile.test.mjs`, che ora prova OGNI
  candela a schermo, i due bordi della colonna e due zoom diversi: e' quello il guard-rail che
  impedisce al difetto di tornare.
  LEZIONE: quando una cosa "non funziona a volte", misurare il bersaglio prima di cercare il bug
  nella logica. Qui la logica era giusta da sempre.
- **Footprint sparpagliato: righe fuori dalla candela e righe alte in modo diverso** - risolto
  v145 - 14 ottobre 2026, segnalato con una foto. Due cause insieme: (a) le righe nascono dai tick
  e possono cadere fuori dall'alta/bassa della candela, e tolto `footprintResliceFisse` (v144)
  nessuno le riportava piu' dentro; (b) il disegno usava il passo salvato DENTRO ogni bucket
  (`bucket.step`), quindi bucket costruiti con passi diversi - dopo un cambio del passo
  automatico, e sempre con le celle aggregate che arrivano dal backup cloud di un altro
  dispositivo - davano righe alte in modo diverso sullo stesso grafico. Ora
  `footprintDentroLaCandela` fa tutt'e due le cose: riporta le righe dentro la candela sommandole
  al bordo (niente volume perso) e riporta il bucket sulla griglia del passo GLOBALE, che draw()
  calcola una volta sola. Test: `laboratorio/app/footprint_scala_unica.test.mjs`.
- **In replay il footprint non si vedeva formarsi** - risolto v145 - la candela in formazione
  accumulava il volume in una mappa sua (`f.fp[prezzo]=numero`, livelli non sulla griglia) e lo
  disegnava come trattini orizzontali. Ora accumula celle vere sulla griglia globale e si disegna
  con lo stesso `drawFootprintCandle` delle altre candele. LIMITE ONESTO che resta: per le candele
  gia' rivelate il footprint c'e' solo dove i tick erano stati registrati davvero - andando
  indietro oltre il log dei tick non c'e' niente da mostrare, e non si inventa.
- **In replay la candela in formazione era un blocco verde/rosso** - risolto v145 - 14 ottobre
  2026, segnalato con due foto. `replayDisegnaFormazione` calcolava la larghezza del corpo su
  `padH*.62` (il 62% di tutta l'area del grafico) invece che su una colonna: col footprint acceso
  il tetto e' 90 px, quindi accanto a candele larghe 12 usciva un rettangolo largo 90. Non era un
  problema di avanzamento - la candela si formava davvero, ma larga nove volte tanto. Ora la
  formula e' quella delle candele vere, `cw/n*.62`, e colori e stoppino sono quelli di Style.
  Test: `laboratorio/app/replay_live.test.mjs` 8).
- **In replay la linea del prezzo restava ferma** - risolto v145 - stessa segnalazione. La linea
  del prezzo corrente e l'etichetta sull'asse usavano sempre `rows[idx].close`, cioe' la chiusura
  dell'ultima candela RIVELATA: durante la formazione non si muovevano, e il prezzo che saliva e
  scendeva si vedeva solo da una riga tratteggiata colorata disegnata apposta. Ora
  `replayPrezzoFormazione()` da' il prezzo della formazione e la linea principale lo segue; la
  riga tratteggiata in piu' e' stata tolta. Test: `laboratorio/app/replay_live.test.mjs` 9).
- **In replay Live il PLAY non aggiornava la candela** - risolto v144 - 13 ottobre 2026, segnalato
  dal proprietario. `getViewWindow` riservava la colonna extra per la candela in formazione solo
  se `!liveModeActive`: durante il replay-Live restava 0, la candela all'indice idx+1 cadeva oltre
  il bordo dell'area di disegno e il clip di `draw()` la tagliava. L'etichetta sull'asse prezzi
  invece si disegna FUORI dal clip e continuava ad aggiornarsi: si vedeva la casellina colorata
  muoversi e il corpo della candela fermo. Ora lo spazio si riserva anche con `liveReplayActive`.
  Test: `laboratorio/app/replay_live.test.mjs` 7).
- **Nel timer MT5 draw() girava anche in replay** - risolto v144 - trovato rileggendo il lavoro
  del giro precedente: `if(!liveReplayActive)update();draw();` - senza graffe solo `update()` sta
  dentro l'if, `draw()` e' un'istruzione a se' e girava sempre. Il ramo Capital.com, scritto con le
  graffe, era corretto: lo stesso commento sopra due righe diverse e' il modo piu' facile di non
  accorgersene. Test: asserzione statica nel 5) di `replay_live.test.mjs`.
- **La prop firm della cronologia si misurava sul capitale gia' cresciuto** - risolto v144 -
  13 ottobre 2026, segnalato dal proprietario. `fblPropDedicataConta` partiva dall'ultimo punto
  PRIMA della data di apertura: su una sala che da 10.000 era arrivata a 20.000, il pop-up «Prop
  firm sbloccata» mostrava 20.000 come capitale all'apertura, e la prop non era piu' confrontata
  col conto versato. Ora la base e' sempre il CONTO INIZIALE del campo e la curva dopo l'apertura
  si riporta su quel conto (percentuali identiche, euro e obiettivo +10% riferiti al conto vero).
  Nello stesso giro: la data di apertura non restava piu' quella della prova precedente.
  Test: `laboratorio/app/prop_firm_cronologia.test.mjs`.
- **Gli indicatori nascosti pesavano come quelli accesi** - risolto v144 - nel ciclo di `draw()`
  `def.compute()` stava FUORI dalla guardia `if(!ind.hidden)`, che proteggeva solo `def.render()`:
  spegnere l'occhio nascondeva l'indicatore ma non ne toglieva il costo. Test:
  `laboratorio/app/indicatori_nascosti.test.mjs`.
- **Le righe di prezzo comparivano anche sulle operazioni chiuse** - risolto v124 -
  9 ottobre 2026, segnalato dal proprietario: «vedo centinaia di righe, esce fuori un bordello».
  L'interruttore del passo 22 disegnava le orizzontali di apertura E chiusura dentro
  `drawClosedTradeMarkers`, cioe' per ogni trade concluso: con uno storico lungo sono due righe
  per operazione che attraversano tutto il grafico. Ora restano solo sulle posizioni APERTE,
  dove dicono a che prezzo si e' entrati su qualcosa di ancora vivo; su una conclusa non
  aggiungevano nulla, perche' ci sono gia' freccia e casella.
  Test: `laboratorio/app/interruttori_posizioni.test.mjs` (prima rosso: 20 righe da 10 operazioni).
- **Il grafico del rendimento si bloccava e lampeggiava bianco al tocco** - risolto v111 -
  8 ottobre 2026, segnalato su telefono e tablet. Quattro difetti nello scorrimento introdotto
  con la v107: (1) il canvas veniva RIALLOCATO a ogni movimento del dito - riassegnare
  width/height lo cancella, e su un telefono lo si prende a meta' strada: ecco il bianco;
  (2) il rettangolo del canvas si rimisurava a ogni movimento, ma i numeri sopra il grafico
  cambiano mentre si scorre e lo spostano - il dito finiva su un punto diverso da quello che
  toccava, ed e' il «salta a caso»; (3) `touchAction:'none'` si mangiava anche lo scorrimento
  verticale della pagina; (4) si ridisegnava a ogni evento invece che a ogni immagine.
  Ora: canvas toccato solo se la misura cambia, rettangolo misurato UNA volta per gesto,
  'pan-y', presa del puntatore e ridisegno una volta per immagine.
  Test: `laboratorio/app/rendimento_scorrimento.test.mjs`.
- **Operazioni segnate come aperte da te, che non erano tue** - risolto v109 - 8 ottobre 2026:
  il nome della sala veniva preso solo da `voce.chat` (il titolo del gruppo), ma il ponte ne manda
  DUE - `chat` e `sala`, la voce esatta scritta nelle impostazioni. Senza titolo la posizione
  nasceva senza sala, e senza sala veniva mostrata come aperta a mano. Peggio: quelle che l'app
  non apre da sola (tetto, freno, margine) il proprietario le apre dalla barra ordini, e da li'
  non c'era nessun legame col segnale. Ora `fblNomeSala` non torna mai vuoto, «tu» si scrive solo
  se non c'e' NESSUNA traccia di un segnale, e una posizione aperta a mano cerca il segnale a cui
  appartiene (stesso asset, stessa direzione, entro due ore, non gia' eseguito).
  Un'operazione attribuita a te sparisce dal profitto per sala: non era estetica.
  Test: `laboratorio/app/origine_operazioni.test.mjs`, `attribuzione_segnale.test.mjs`.
- **Le posizioni di uno stesso ingresso non si raggruppavano** - risolto v109 - 8 ottobre 2026:
  si univano solo con l'entrata IDENTICA, e dieci ordini non si aprono tutti allo stesso prezzo.
  Ora comanda il codice del segnale quando c'e'; dove manca, tolleranza proporzionata alla
  distanza entrata-stop di quella operazione (non un numero fisso: tre punti sull'oro sono niente,
  sull'euro-dollaro sono un'enormita') piu' una finestra di tre minuti.
  Test: `laboratorio/app/gruppi_posizioni.test.mjs`.
- **La stessa sala con due nomi diversi in due schermate** - risolto v109 - 8 ottobre 2026: la
  tabella dell'apertura automatica mostrava la voce configurata, le operazioni il titolo del
  gruppo. Ora il ponte manda i titoli di TUTTE le sale appena si mette in ascolto (li risolveva
  gia' e li buttava via dopo averli scritti nel diario) e l'app li usa ovunque.
  Si riconosce con la chiave, si mostra con il titolo. Test: `laboratorio/app/nomi_sale.test.mjs`.
- **MT5 non si collegava dal telefono, con tutto verde** - risolto v108 - 8 ottobre 2026:
  l'indirizzo degli ordini (porta 8000) veniva INDOVINATO da `fblBaseUrl(8000)`, che passa dal
  server solo col campo "computer" vuoto. Con un indirizzo rimasto scritto da prima, dal telefono
  tutte le chiamate di MT5 ci andavano dritte e il server non veniva nemmeno provato. Il grafico
  no, perche' dalla v105 la sua strada se la prova: da qui il sintomo che non tornava, grafico e
  segnali che funzionavano e la sola sezione MT5 morta. E il pannello «Cosa risponde adesso»
  restava verde perche' la riga Ordini provava una rotta SUA (`/pc/health`) invece di quella in
  uso. Ora la strada degli ordini si prova come quella del grafico (`fblScegliStradaOrdini`), il
  pannello prova l'indirizzo vero, e il popup di MT5 la riscegli prima di dire che non risponde.
  Test: `laboratorio/app/strada_ordini.test.mjs`.
- **Ordini pendenti Kraken fermi a PC spento** — limite — `kraken_ordini.py` — li tiene il ponte sul
  PC. Senza un server sempre acceso non si risolve.
- **Pendenti di un conto di prova non attivo non controllati** — limite — `controlla_pendenti()`
  guarda solo il conto collegato.
- **Livelli dal grafico Binance, scatto sul prezzo Kraken** — limite — piccola differenza di prezzo.
- **Exe non firmati** — limite — Windows SmartScreen avvisa all'installazione.
- **Telegram, Syntra, MT5 non collaudabili nel cloud** — limite — servono sessione/BlueStacks/Windows.
  Nel cloud si collauda l'interprete sui messaggi registrati.

## Risolti
- **In replay la posizione aperta non si vedeva, e i numeri del conto erano di un'altra epoca** — risolto 2.0.28 — 26 ottobre 2026, segnalato con «in modalità replay il PL live non viene visualizzato al momento in cui si apre una posizione in modalità replay che va a finire in storico [...] verranno visualizzati i profitti/perdite della posizione aperta in replay le etichette tp-sl-stop profit eccetera, si aggiornerà anche quello che è la tabella contenente il margine libero, win/loss rate, capitale eccetera dell'account storico quando siamo in modalità replay live». **QUATTRO cause, tutte misurate sul banco Playwright prima di toccare il codice** (`laboratorio/app/replay_conto_storico.test.mjs`):
  (1) `positionBelongsToCurrentView()` con MT5 collegato accettava solo `pos.mt5Ticket!=null`: una posizione simulata (replay e conto Storico) non ha ticket, quindi veniva scartata → `drawableOnCurrentChart()` false → **zero linee, zero etichette, zero righe in `#openPositions`**. Misura: 0 testi con l'euro sulla tela, 0 righe in tabella. Ora `pos.historical`, `!liveModeActive` e `liveReplayActive` escono dal filtro prima del controllo del ticket; la vista Live del conto reale resta identica.
  (2) `floatingPL()` nel ramo live valutava al `livePriceByAsset`, cioè al prezzo VERO di adesso: con un tick a 4.300 e il replay fermo a 4.080 il capitale storico scendeva a **8.481 € invece di 10.000 €** (-1.518 € su una posizione appena aperta e mai mossa). Il prezzo di adesso è il futuro rispetto a ciò che si rivede. In replay ora si valuta al `prezzoMostratoOra()`, e solo per l'asset a grafico.
  (3) `mt5StatsActive()` era vero anche in replay, quindi equity e margine libero arrivavano dal conto MT5 reale: due conti mescolati. Aggiunto `&& !liveReplayActive`.
  (4) trovata dal test, non dalla segnalazione: in replay SL/TP si trascinavano ma **tornavano al valore di prima**, perché `posStoriaAggiornaTutte()` datava lo spostamento a `Date.now()` — il futuro rispetto al punto del replay — e `posLivelliAlTempo()` a quell'istante trovava ancora in vigore il livello vecchio. Ora la data è `replayMomentoMostrato()`.
  **ALTRI TRE PUNTI, trovati dal revisore e misurati prima di correggerli** — il conto storico era ancora mescolato col conto reale, nei due sensi, e il filtro della vista era troppo largo:
  (5) `floatingPL` aggiungeva il profitto VERO di una posizione MT5 (+250 misurati → capitale "storico" 10.250) e `statsTrades` con MT5 collegato restituiva **solo** le operazioni reali: una chiusa a -3.000 portava il capitale a 7.000, mentre una simulata del replay chiusa a +1.000 non entrava mai. Ora in replay contano solo le posizioni `historical` e le operazioni senza `mt5Ticket`; `usedMargin` ignora le posizioni di altri conti.
  (6) `evaluate()` chiudeva le posizioni simulate sulla candela VERA di oggi: con il replay fermo a 4.080 e un target a 4.090, la candela vera a 4.199 la chiudeva subito mentre il grafico mostrava +0,00 — il backtest diventava inutilizzabile. Ora una posizione `historical` si valuta sulla candela del replay (la scelta "gestione in tempo reale" resta per le posizioni del conto Live); anche il Margin Call in replay usa il prezzo del replay.
  (7) Il filtro della vista era troppo largo: dopo lo STOP una posizione simulata restava a grafico nel conto MT5, e durante il replay entrava una posizione reale Capital.com. Ora in replay si vede solo `historical`; la vista Live normale è identica a prima.
  Test: `laboratorio/app/replay_conto_storico.test.mjs` (8 prove: disegno + P/L, conto non valutato al prezzo live, P/L che segue il replay, SL/TP trascinabili e disegnati, conto Storico con MT5 collegato, soldi reali esclusi dal conto storico, nessuna chiusura al prezzo di oggi, vista Live invariata).
- **Posizionare lo Stop Loss scriveva il lottaggio da solo** — risolto 2.0.4 — 19 ottobre 2026, segnalato con «il lottaggio viene esclusivamente modificato solo se l'utente preme direttamente dentro la casella e inserisce lui un valore, oppure solo quando ha scritto quello che è il rischio in percentuale e poi clicca il bottone lottaggio […]: ora il campo si scrive solo scrivendolo o premendo il pulsante del lottaggio consigliato. Test: `laboratorio/app/lottaggio_solo_su_richiesta.test.mjs`.
- **Cambiando asset restavano due grafici sullo schermo** — risolto 2.0.4 — 19 ottobre 2026, segnalato con «vedremo delle candele di un asset e delle candele di un altro» e posizioni fuori scala (XAUUSD a 4000 sulla fascia di AUDCAD a 0,98). Causa: la risposta dello storico dell'asset vecchio scriveva in `csvLibrary` senza verificare che l'asset fosse ancora a schermo. Ora ogni loader (MT5, Capital.com, Binance) scarta la risposta se `asset !== currentAssetKey`. Test: `laboratorio/app/cambio_asset_doppio.test.mjs`.
- **Caricamento di 200.000 candele in un colpo** — risolto 2.0.4 — 19 ottobre 2026, scaricava decine di megabyte per dispositivo e andava in crash sulle macchine da 1 GB con pochi utenti. Ora si caricano al massimo 5.000 candele (fattore 40 in meno di traffico), sufficienti per indicatori e disegni; il resto arriva con la risincronizzazione periodica se l'utente scorre indietro.
- **Mercato chiuso che sfasava le candele di 48 ore** — risolto 2.0.4 — 19 ottobre 2026, XAUUSD a 4161 giovedì 15 ore 06 mostrato come sabato 17 ore 05:50. Causa: `_scarto_fresco_da_epoch()` in `mt5_feed_server.py` e `bridge.py` usava il residuo dalla griglia di mezz'ora invece dell'età del tick, accettando tick vecchi di giorni. Ora rifiuta tick con `|età| > 24h` e `|residuo dalla mezz'ora| > 5min`. Test: `laboratorio/ponte/test_scarto_server.py` (12 prove).
- **Orario di apertura vicino al numero identificativo** — risolto 2.0.4 — 19 ottobre 2026, nelle tabelle posizioni e ordini pendenti compare l'etichetta «apertura» per le posizioni e «inserimento» per gli ordini pendenti, accanto all'orario di esecuzione.
- **Pannello "Accesso da altri dispositivi" senza chiave visibile** — risolto 2.0.4 — 19 ottobre 2026, rimossa la sezione "Come si fa, passo per passo" (procedura Tailscale scritta a mano), il riquadro "Chiave di questo computer" con copia-incolla, e i campi nome/chiave del server visibili. Rimane il pulsante "Consenti l'accesso dagli altri miei dispositivi" e il pannello "Cosa risponde adesso". Tutto passa dal server, niente chiave in giro.
- **Pulsante "Avvia i 7 Giorni Gratuiti" con scelta piattaforma** — risolto 2.0.4 — 19 ottobre 2026, invece di indovinare il dispositivo, apre un modale con tre scelte: Android (APK), iPhone/iPad/Mac (nessun pacchetto ancora, messaggio onesto), PC (Windows, installer). Test: navigazione manuale.
- **Tetti di rischio/capitale e dello stop portati al 100%** — risolto 2.0.4 — 19 ottobre 2026, da 20% (cripto 40%) a 100% per tutti, su richiesta esplicita: «la percentuale sia di rischio che del capitale può essere impostata fino al 100%». I numeri che non sono prezzi restano scartati dal controllo dell'entrata.

- **Posizionare lo Stop Loss scriveva il lottaggio da solo** — risolto 2.0.3 — 19 ottobre 2026,
  segnalato con «il lottaggio viene esclusivamente modificato solo se l'utente preme direttamente
  dentro la casella e inserisce lui un valore, oppure solo quando ha scritto quello che è il rischio
  in percentuale e poi clicca il bottone lottaggio […] e non deve scrivere direttamente quello che è
  il lottaggio in maniera automatica quando io vado a posizionare quello che è lo stop loss prima di
  aprire un'operazione». Causa vera: la funzione `autoLottoDaGrafico()`, chiamata dai TRE punti in
  cui si posiziona un livello prima di aprire un ordine (stop a mercato, stop/target dell'ordine
  pendente, entrata del pendente), finiva con `$(pending?'lotsPending':'lots').value=s.lots` —
  cioè scriveva il numero calcolato dentro il campo Lottaggio. A schermo compariva un lottaggio
  «già pronto» che l'utente non aveva scelto, e quel numero finiva nell'ordine al primo click: il
  rischio vero non era quello scritto nella casella RISCHIO. MISURATO sul banco (EUR/USD a 1.1000,
  rischio 1% su 10.000): mettere lo stop a 1.078 portava il campo da **0,07 a 0,05** senza che
  nessuno avesse premuto niente; sull'ordine pendente da **0,07 a 0,03**. Peggio, il numero non
  era stabile: dipendeva da quale livello fosse stato toccato per ultimo, quindi due caselle
  diverse potevano mostrarlo in momenti diversi. Ora la funzione calcola il consiglio (serve al
  messaggio in basso e resta la base del pulsante che applica) ma **non scrive niente**; il
  messaggio dice «Consigliato 0,05 lot […] Non è stato impostato». Verificato con un grep su
  tutto il file: i sei punti rimasti che scrivono un campo lottaggio sono tutti specchi o azioni
  esplicite (la casella, i quattro pulsanti ﹀/︿/﹂/﹁, i due pulsanti «APPLICA LOTTAGGIO
  CONSIGLIATO»). Test: `laboratorio/app/lottaggio_solo_su_richiesta.test.mjs` (5 prove, viste
  rosse prima della correzione).
- **Il Setup non si costruiva su GitHub: «ERRORE: manca build\app.html. Scarica tutto il progetto
  (non solo installer_build)»** — risolto v168 — 17 ottobre 2026, scoperto solo alla pubblicazione,
  non in locale — la riga che copia `app.html` dentro `installer_build\build\` conteneva un a capo
  scritto `r`n: quella è la sintassi di **PowerShell** per andare a riga nuova, e dentro un `.bat`
  non significa niente. `cmd.exe` leggeva tutta la riga come un **unico comando storto**, la copia
  non avveniva mai, e il controllo immediatamente dopo trovava `build\app.html` assente. Non saltava
  fuori in locale perche' `build\app.html` c'era **gia'** lì da una compilazione precedente, che ha
  mascherato il difetto: su GitHub si parte da una cartella pulita e lo script si fermava subito.
  LEZIONE: un `.bat` si scrive e si legge con `cmd.exe`, non con PowerShell — sono due linguaggi
  diversi e quello della shell corrente vince dentro ogni riga che contengono. Simile a
  `sintassi_app` per `app.html`, ma non basta leggere il file: qui il test le **esegue** le righe
  vere con `cmd.exe` su una cartella di prova e guarda se i file arrivano.
  Test: `laboratorio/app/build_exe_copia.test.mjs` (rosso con la riga rotta, con lo stesso identico
  messaggio d'errore che appariva su GitHub, poi verde con la riga corretta).
- **Linee SL e TP delle posizioni Kraken che seguivano il prezzo** — risolto app v100 —
  `krakenDisegnaGrafico` compensava la differenza fra i prezzi del grafico (Binance) e quelli di
  Kraken con uno scostamento **ricalcolato a ogni disegno**: muovendosi il prezzo si muoveva anche
  lo scostamento, e con lui le linee. Una linea di stop che insegue il prezzo non dice piu' dove
  chiudera' la posizione. Ora si calcola una volta, alla comparsa della posizione, e si butta
  quando la posizione si chiude. Test: `laboratorio/app/kraken_linee.test.mjs` (4).
- **Posizioni Kraken nella stessa casella di quelle MetaTrader** — risolto app v100 — riquadro
  separato, con le stesse colonne di MT5 (asset, side, entry, SL, TP, R/R, lotti, margine, prezzo
  corrente, P/L live) e i pulsanti «vai a grafico», «seleziona», «BE», «chiudi». Il R/R usa lo stop
  di APERTURA: con quello di adesso, portandolo a pareggio diventerebbe infinito.
  Test: `laboratorio/app/kraken_posizioni.test.mjs` (6).
- **Dal telefono il grafico diceva «nessuna risposta»** — risolto app v98 + server — il grafico sta
  sulla porta 8001 del PC, ma il server girava al PC solo la 8000: dal telefono non aveva nessuna
  strada. Ora il server gira tutte e tre le porte previste (`/pc/<porta>/<percorso>`, solo
  8000/8001/8769) e l'app capisce da sola se il ponte locale c'e' (sul computer) o no (sul
  telefono) chiedendolo una volta e ricontrollando ogni minuto. **La chiave giusta la mette
  `fblConChiave`**, che riconosce l'indirizzo del server: metterla nei singoli punti avrebbe
  voluto dire dimenticarsene in qualcuno.
  **Resta aperto**: i tick dal vivo passano da WebSocket, che il server non gira ancora. Dal
  telefono il grafico si disegna con lo storico ma non si muove da solo.
- **«computer spento» detto anche quando nessun computer era registrato** — risolto app v98 — 502 e
  503 sono due cose diverse che si risolvono in modi opposti, e avere lo stesso messaggio ha fatto
  cercare un guasto che non c'era. Test: `porta_unica.test.mjs`.
- **Syntra sul server: «[Errno 2] No such file or directory: C:\platform-toolsdb.exe»** —
  risolto — spostando il ponte dei segnali sul server (Linux), Syntra tentava lo stesso di aprire
  ADB con un percorso di Windows. Ora dice la verita': Syntra legge BlueStacks sul computer e sul
  server non puo' funzionare (gia' previsto in ORACLE.md, fase 4).
- **Le barre dei grafici disegnate SOPRA i nomi** (profitto per strategia, per sala, per asset) —
  risolto app v97 — `graficoOrizz` disegnava le barre negative normali e le ribaltava con un
  `transform` SVG (`translate(...) scale(-1,1)`). Ma l'animazione CSS `fsGrowX` scrive anch'essa
  sul transform e lo SOSTITUISCE: finita l'animazione la barra perdeva spostamento e ribaltamento
  e ricompariva nell'angolo in alto a sinistra, sopra il nome della prima riga. Si vedeva solo con
  valori negativi e carta stretta. Ora le barre negative si disegnano alle coordinate vere
  (`hbarPath(...,sinistra)`), senza nessun transform.
  Test: `laboratorio/app/grafici_statistiche.test.mjs` (3, 5 rossi prima).
- **«Accesso a Telegram interrotto, premi di nuovo Collegamento»** — migliorato app v97 — il
  comportamento era gia' giusto (col numero salvato si rimanda il codice; senza, si richiede prima
  il numero) ma non lo diceva, e restava una richiesta a meta' in sospeso. Ora il messaggio dice
  cosa accadra' al prossimo tentativo e lo stato si azzera.
  Test: `laboratorio/ponte/test_accesso_interrotto.py` (3).
- **Trade Journal di Kraken vuoto per le chiusure avvenute a app chiusa** — risolto app v94 — le
  righe le scriveva l'app nel momento della chiusura (`krakenRegistraChiusura`). Con il server
  sempre acceso le posizioni si chiudono anche a app chiusa - cioe' proprio il caso per cui il
  server esiste - e quelle righe non nascevano per nessuno; su un dispositivo nuovo il giornale
  mostrava solo cio' che quel dispositivo aveva visto. Ora `krakenRicostruisciGiornale()` le
  ricava dallo storico del server (gia' persistente, fino a 2000 esecuzioni), seguendo la
  posizione netta per simbolo. Niente doppioni: ogni riga porta una chiave ricavata dal dato del
  server (`kr:<conto_id>:<simbolo>:<ts>`), e la riga scritta dal vivo porta la stessa.
  **conto_id e non il nome**: il nome si puo' rinominare, e al primo rinomina sarebbero tornati
  tutti doppioni. Test: `laboratorio/app/giornale_kraken.test.mjs` (5).
- **Collegamento/Modalita' chiedeva due indirizzi e due chiavi** — risolto app v93 — dal telefono
  si scriveva nome e chiave del computer E nome e chiave del server, e la chiave del computer si
  ricopiava a mano da una parte all'altra. Ora si scrive solo il **server**: il computer si
  presenta da solo (`/registra-al-server` -> `/pc/registra`), e gli ordini MT5 il server li gira
  al PC. In cima tre righe - ordini, grafico, segnali - che si aggiornano da sole ogni 6 secondi
  finche' la schermata e' aperta, e si fermano alla chiusura.
  Test: `laboratorio/app/porta_unica.test.mjs` (5), `laboratorio/ponte/test_porta_unica.py` (5).
  Trovato dal test: togliendo il blocco dei campi era sparito anche `fblRemotoEsito`, dove
  finiscono i messaggi di Salva e Prova — `fblRemotoApri` scoppiava all'apertura.
- **Il collaudo su GitHub era rosso dal 6 ottobre e nessuno se n'era accorto** — risolto 7 ottobre
  2026 — `.github/workflows/collaudo.yml` installava `fastapi` ma non `uvicorn`, e
  `segnali_bridge.py` esce gia' all'import ("Mancano le librerie"): i test del ponte non partivano
  proprio. Ora le librerie si prendono da `requirements.txt`, il file che le dichiara. Controllo:
  `gh run list --workflow=collaudo.yml`.
- **Niente da fare mentre internet non c'e'** — risolto app v92 — l'avvio aspettava il
  collegamento e dopo 25 secondi offriva solo «Riprova», mentre il backtest lavora su dati gia'
  presenti sul dispositivo. Ora c'e' `fblInternetVero()` (prova davvero, non si fida di
  `navigator.onLine`, che su una Wi-Fi che non naviga dice "si") e «Continua solo in backtest»,
  con un contrassegno in alto e un «Accedi» che porta al login **solo** se la verifica dice che
  internet c'e'. Test: `laboratorio/app/solo_backtest.test.mjs`.
- **Sul telefono l'app resta ferma sul logo** — risolto app v91 — `sw.js` — MISURATO: `app.html`
  pesa 4,03 MB e ci mette 3,2 s a scaricarsi da un computer con rete veloce (su dati mobili molto
  di piu'). Il service worker chiedeva SEMPRE la rete, con `cache: 'no-store'` che salta apposta
  anche la cache del browser, e si decideva a mostrare la copia salvata solo dopo 4 secondi
  (`RISERVA_MS`): con un file da 4 MB quell'attesa c'era praticamente sempre, e i 4 MB si
  riscaricavano a ogni apertura. Ora la copia salvata si mostra SUBITO e la rete aggiorna dietro
  (senza `no-store`: con l'ETag l'aggiornamento e' una domanda da pochi byte). Quando arriva una
  versione nuova la pagina lo dice con un avviso e un pulsante «Ricarica», invece di ricaricarsi
  da sola mentre si guarda una posizione aperta.
  Test: `laboratorio/app/avvio_cache.test.mjs` (6, rossi prima).
- **«Installa i pacchetti aggiuntivi» chiesto a chi li ha gia' installati** — risolto app v90 —
  `mt5StartLoginFlow()` provava `/health` UNA volta sola e, se non rispondeva, mostrava il passo 1,
  che e' la schermata dell'installazione. Ma `/health` muto quasi sempre vuol dire che il servizio
  non ha finito di partire (parte da solo; su un PC appena acceso ci mette qualche secondo). La
  procedura precedente (`mt5StartLoginFlowLegacy`) aspettava con `waitForBridgeHealthy(20000)`:
  quella nuova aveva perso l'attesa. Ora aspetta, e se il servizio ha gia' risposto almeno una
  volta su questo PC (`fxbt_ponteGiaVisto`) la schermata dice «non risponde» con «Riprova», non
  «installa». Test: `laboratorio/app/pacchetti.test.mjs`.
- **WebSocket segnali 403 ("ponte non raggiungibile")** — risolto v70 — `segnali_bridge.py` — il
  decoratore `@app.websocket("/ws/segnali")` era finito sopra `_manda_storico`. Controllo: `--verifica`.
- **Barra ordini con Kraken: rischio e lotto col modello forex** — risolto app v85 — usava saldo
  MT5/backtest e contratti da 100.000. Test: `laboratorio/app/barra_kraken.test.mjs`.
- **Anteprima sul grafico in € forex con Kraken** — risolto app v85 — `drawTpSlZoneBox`. Test: idem.
- **Id ordini pendenti uguali nello stesso millisecondo** — risolto — STOP SELL non scattava.
  Test: `laboratorio/ponte/test_kraken_pendenti.py::test_stop_sell_e_id_diversi`.
- **Pendente scattato registrato due volte nel Journal** — prevenuto — memoria locale degli id presi.
  Test: `barra_kraken.test.mjs` "preso in carico una sola volta".
- **Casella posizione Kraken che non arrivava all'ultima candela** — risolto — `keepPaceIdx` voleva
  un indice, riceveva `true`. Test: `journal_kraken.test.mjs`.
- **Pulsanti e schede che "non funzionavano" nella finestra PIP** — risolto — ascoltatori delegati
  solo su `document`. Ora `fblDelega()`.
- **Test del ponte che usavano la rete vera** — risolto 2026-10-05 — `laboratorio/ponte/_percorsi.py`
  — il simulatore scaricava i prezzi di Kraken; ora rete esterna bloccata nei test.
- **Segnali e apertura dai segnali senza consenso informato** — risolto app v86 — consenso a due
  livelli (`consensoRischi('segnali'|'esecuzione')`), registrato con data e versione, sincronizzato
  sull'account; l'apertura automatica si ferma se manca. Test: `laboratorio/app/consenso.test.mjs`.
- **"Dimentica il numero" non scollegava da Telegram** — risolto app v88 — ora "Esci da Telegram":
  il ponte fa il logout, cancella sessione e numero; ricollegandosi chiede numero e codice.
  Test: `laboratorio/app/esci_telegram.test.mjs`, `laboratorio/ponte/test_esci_telegram.py`.
- **Nessuna criptovaluta veniva riconosciuta nella pagina di prova** — risolto app v104 — le monete
  riconosciute erano due (BTC, ETH) e non in tutte le forme (`BTCUSDT` si', `ETHUSDT` no). Ora si
  generano da un elenco di 31 monete, in **due** posti: `CRIPTO` in `parser_segnali.py` (il ponte
  normalizza `SOL`, `SOLUSDT`, `SOLANA`, `SOLPERP` in `SOLUSD`) e `TG_CRIPTO` in `app.html` (i
  gruppi di sinonimi con cui l'app ritrova l'asset dal broker). Aggiungere una moneta = una riga di
  qua e una di la'. Test: `test_parser.py` (sezione CRIPTOVALUTE), `laboratorio/app/cripto_gruppi.test.mjs`.
- **Syntra smetteva di aggiornare la pagina e non rilevava piu' le sale** — risolto app v104 — due
  difetti, tutti e due silenziosi. (1) `primo` diventava False solo quando la pagina Notifiche
  veniva trovata: se al primo giro non si trovava, da li' in avanti `aggiorna_notifiche` non veniva
  piu' chiamata (sta sotto `if not primo`) e ogni notifica veniva segnata come vista senza essere
  consegnata — con lo stato che diceva "collegato, nessun errore". Ora l'aggiornamento non dipende
  da `primo`, i tentativi a vuoto si contano e si dicono in `syntra_errore`, e dopo 20 giri Syntra
  viene riaperta nell'emulatore. (2) Il messaggio "Syntra non funziona su Linux" finiva in
  `stato["syntra"]`, una chiave che l'app non legge: ora in `syntra_errore`.
  Test: `laboratorio/ponte/test_syntra_blocco.py` (4 dei 6 fallivano prima della correzione).
- **I trade Kraken finivano nel conto "Live" delle statistiche** — risolto app v104 — `contoDi()`
  guardava solo `mt5Ticket`; le righe Kraken (`account:'kraken'`, `mode:'live'`) diventavano "Live"
  insieme ai trade simulati, e non erano separabili nemmeno a mano. Ora si chiamano
  `🐙 Kraken <conto>`, il menu ha due famiglie («Tutti i conti Forex» / «Tutti i conti Kraken»),
  si parte dal solo Forex e la somma fra i due mondi resta possibile ma con un avviso scritto.
  Test: `laboratorio/app/dashboard_conti.test.mjs`.
- **Il ponte dei segnali moriva su una emoji** — risolto v106 — 7 ottobre 2026, 16:29:
  `UnicodeEncodeError: 'charmap' codec can't encode character '✅'` in `_log`, console cp1252.
  Da quel momento niente piu' segnali, ne' Telegram ne' Syntra, e nessuno lo ha riacceso. Ora
  `_scrivibile()` riduce il testo a cio' che la console sa scrivere (l'emoji diventa `?`) e `_log`
  non puo' sollevare nulla. Test: `laboratorio/ponte/test_diario_emoji.py`.
- **Syntra non partiva piu' da quando i segnali sono sul server** — risolto v106 — il ponte sul
  computer lo accendeva l'app con `/segnali-launch`, e con un server configurato non lo accende
  piu'. Ma Syntra vive li' (legge BlueStacks via ADB). Ora i ponti sono DUE: Telegram sul server,
  Syntra sul computer avviata con `--solo-syntra`, che non tocca Telegram — avviare qui la sorgente
  Telegram vorrebbe dire chiedere il codice per un account gia' collegato sul server. I segnali dei
  due finiscono nella stessa bacheca; lo stato di Syntra lo scrive solo il ponte di Syntra.
  Test: `laboratorio/ponte/test_solo_syntra.py`, `laboratorio/app/due_ponti_segnali.test.mjs`.
- **Il grafico dal telefono non passava mai dal server** — risolto v105 — dei tre servizi era
  l'unico senza `srv ?`: usava `fblBaseUrl(8001)`, che va al server solo col campo "computer" vuoto.
  Con un indirizzo vecchio rimasto scritto, ordini e segnali lo ignoravano e il grafico ci sbatteva.
  Ora si prova: prima dritto al computer (una tappa in meno per i prezzi al millisecondo), poi dal
  server; e c'e' scritto quale strada e' in uso. Test: `laboratorio/app/strada_grafico.test.mjs`.
- **«Installa i pacchetti aggiuntivi» compariva ancora su telefono e tablet** —
  risolto app v112 — 9 ottobre 2026. Due buchi con la stessa conseguenza:
  (1) il gate «hai già installato MT5?» (passo 2) cadeva sul passo 1 col testo
  STATICO dell'installazione (`mt5ShowStepVisible(1)` senza `mt5Passo1Parole`)
  quando il bridge smetteva di rispondere mentre si era al gate — esattamente
  cosa fa un ponte impallato — mostrando «Installa i pacchetti aggiuntivi» col
  pulsante di download su QUALSIASI dispositivo, e lo stesso testo statico anche
  sul computer quando i pacchetti c'erano già; (2) `fblEMobile()` non riconosceva
  un telefono con il browser in «modalità desktop»: la User-Agent mente e il
  controllo chiedeva `maxTouchPoints > 1` (un telefono così ne ha anche solo 1).
  Ora il gate adatta le parole prima di mostrare il passo 1
  (`mt5Passo1Parole(pontGiaVisto)`), `fblEMobile()` guarda l'hardware (touch —
  anche di una sola punta — + puntatore grossolano + schermo piccolo) e i Client
  Hints del sistema operativo, e la condizione vale anche per `fblRemoto()`
  (la chiave ereditata `fb_indirizzo_ponte`, scritta solo sui telefoni prima del
  7 ottobre). Il pulsante «Scarica MetaTrader 5» del gate non compare più fuori
  dal computer, e il suo messaggio dice che il terminale si installa sul COMPUTER.
  Test: `laboratorio/app/pacchetti_mobile.test.mjs` (4 test, 3 fallivano prima).
- **Segnale su un asset che vive solo su Capital.com mandato a MT5** — risolto app v113 —
  9 ottobre 2026. PASSO 13. Con MT5 collegato, il segnale di una sala su uno strumento che non
  esiste né su Kraken né su MT5 (un'azione, un indice) veniva comunque mandato a MT5 come ORDINE
  VERO, con l'epic di Capital.com come simbolo: il broker quel simbolo non lo conosce e lo
  rifiuta, la posizione non si apriva e il segnale restava «eseguito» a metà.
  Catena del difetto (righe di `app.html` PRIMA della correzione): `tgContoPerSegnale` (25518)
  ritornava solo `'kraken' | 'mt5' | 'sim'`; `tgAssetPerStrumento` (26940) trovava GIÀ l'epic su
  Capital.com (26976-26979); `tgEseguiSegnale` (27234) procedeva con `reale=!!mt5Connected`;
  `openMarketTrade` (19565) dirottava a `placeRealMt5Order`, che fa `POST /order/market` (19473)
  con quel simbolo. Capital.com nell'app è di sola LETTURA: nessun endpoint per inviare ordini
  (l'unica POST è il login `/api/v1/session`), le posizioni «Capital.com» sono simulate in app
  (`positions.push`).
  CAUSA VERA: la decisione del conto stava in una funzione SINCRONA (`tgContoPerSegnale`) che non
  poteva né chiedere a MT5 se conosce lo strumento né accendere la connessione a Capital.com:
  l'unico esito possibile era `'mt5'`.
  CORREZIONE: nuova `tgContoEffettivoPerSegnale(seg)` ASINCRONA che, se il conto sarebbe `'mt5'`,
  chiede a `resolveMt5SymbolForAsset` se il broker ha lo strumento (`null` = «non ce l'ha»,
  definitivo; `undefined` = errore di rete, nel dubbio si resta su MT5) e in tal caso accende
  Capital.com in silenzio (`tgCapitalAccendiInSilenzio`, coi dati salvati, senza aprire moduli) e
  ritorna `'capital'` se Capital.com conosce l'epic. Nuovo ramo `conto==='capital'` in
  `tgAutoValuta` (prezzo da Capital.com via `fetchLatestPriceRest`, `tgPiano`, apertura con
  `tgCapitalEseguiSegnale`). `tgCapitalEseguiSegnale` apre posizioni SIMULATE in `positions[]`
  marcate `account:'capital'`: MAI un ordine a MT5. Capital.com diventa poi una FAMIGLIA A PARTE
  nel Trade Journal: `contoDi` ritorna `'💹 Capital.com'` per `account==='capital'`, nuovo helper
  `eCapital`, gruppo dedicato in `opzioniConto`, filtro `__capital`, badge in
  `journalSessionBadgeHtml`.
  Test: `laboratorio/app/capital_instradamento.test.mjs` — 5 test: (1) MT5 non ha lo strumento ma
  Capital sì → conto `'capital'`; (2) se MT5 lo ha → resta `'mt5'`; (3) senza connessione a
  Capital.com non si tenta; (4) l'esecutore apre simulato e a MT5 arrivano 0 ordini; (5) nel
  Journal Capital.com è famiglia a parte, non «Live». Prima della correzione i 5 test erano rossi.
- **Sei difetti dell'ondata 1 (v115–v117)** — risolti 9 ottobre 2026.
  - **Apertura automatica da un altro dispositivo** (v117): l'apertura automatica la fa **solo il
    computer** (`tgSonoIlComputer`); telefono e tablet mostrano il segnale e aprono a mano.
    Test: `laboratorio/app/apertura_solo_computer.test.mjs`.
  - **Errore latente del passo 13** (v117): nel ramo Capital di `tgAutoValuta` si usava `sym` prima
    della dichiarazione (TDZ), quindi l'apertura **automatica** Capital.com andava in errore. Corretto
    con `let sym` in cima.
  - **Attribuzione della sala** (v115): `fblOrigineBadgeHtml` non recuperava la sala dal ticket MT5,
    mentre il Trade Journal sì: la stessa posizione era `📡 Sala Oro` nel Journal e `👤 tu` nella
    tabella. Ora `fblOrigineBadgeHtml` chiama `mt5ApplicaSegnale(p)` e `mt5AllineaApertura` applica la
    sala su ogni percorso. Test: `laboratorio/app/attribuzione_mt5.test.mjs` (4).
  - **Asse dei prezzi e colonne COB/SVP** (v117): l'asse faceva partire il **drag** di TP/SL o
    pendenti sotto il dito (guardia con `&& !tradeLevelHit(...)`) e la striscia di zoom era spostata
    sopra le colonne COB/SVP; COB/SVP, dal canto loro, zoomano per errore. Ora l'asse fa **solo
    zoom**, la striscia è ancorata al bordo (`right:'0px'`), e su COB/SVP si **trascina** il grafico
    (mai zoom, mai linea). Test: `laboratorio/app/asse_prezzi_zoom.test.mjs` (3).
- **I segnali doppioni riaprono una seconda posizione** — risolto app v116 — 9 ottobre 2026: stesso
  strumento, stessa direzione, stessa fascia d'entrata e stessi target non aprono più una seconda
  posizione. Funzioni pure `fblDedupTp`/`fblDedupStesso`/`fblDedupMotivo`; gancio in `tgAutoDecidi`
  (ritorna `no('doppione: …')`) e in `tgEseguiSegnale` (avviso + conferma esplicita già presente).
  Esenti «aggiunta» e «seconda entrata»; tolleranza `fblTolleranzaEntrata×0,5`. Test:
  `laboratorio/app/filtro_doppioni.test.mjs` (7) e `filtro_doppioni_auto.test.mjs` (2), prima rossi.
- **Capital.com non si poteva usare per un ordine MANUALE** — risolto app v118 — 9 ottobre 2026:
  aggiunto il pulsante 💹 Capital.com fra Kraken e Storico nella barra conti; `fblContoVista`
  (`'mt5'|'kraken'|'capital'|'storico'`), `openMarketTrade` dirotta al conto Capital.com PRIMA del ramo
  MT5 (solo manuale) e `capitalOrdineManuale(side)` apre posizioni **SIMULATE** `account:'capital'` —
  **mai** un ordine vero a MT5. Test: `laboratorio/app/capital_manuale.test.mjs` (5, 4 rossi prima).
- **Di un utente Syntra si vedevano solo le notifiche nuove, non la storia** — risolto app v119 —
  9 ottobre 2026 — PASSO 15/16: `leggi_schermata` salva il punto del **nome** (`utente_xy`),
  `leggi_profilo` tocca il nome, apre il profilo e legge le operazioni, e il ramo dedicato in `ciclo`
  le **archivia** (`storico_sale.archivia_syntra`) nella cronologia della sala `Syntra · <utente>`,
  **senza** toccare la pagina Notifiche e **senza** metterle in bacheca. Lato ponte, `_manda_storico`
  chiede la lettura e aspetta (max 60 s). Test: `laboratorio/ponte/test_profilo_syntra.py` (4, prima
  rossi). *Limite noto*: la lettura richiede l'emulatore collegato e può durare fino a un minuto.
- **Le linee TP/SL della cronologia finivano tutte alla stessa candela** — risolto app v120 —
  9 ottobre 2026 — PASSI 18/19: `valuta` teneva solo il conteggio dei TP (`raggiunti`) e un unico
  `tFine`, quindi il disegno non sapeva SU QUALE candela ogni livello fosse scattato. Ora registra
  `tpT` (tempo di ogni TP) e `slT` (tempo dello stop); `fblCronoAncore` calcola `tpEnd[]`/`slEnd`;
  `fblCronoDisegna` ferma ogni linea sulla sua candela e mette la **spunta ✓ a sinistra** del punto
  in cui un TP è stato preso. Se lo stop non è preso, la sua linea prende la lunghezza dell'ultima
  di TP. Test: `laboratorio/app/cronologia_linee.test.mjs` (3, prima rossi).

- **Nell'APK il pacchetto di aggiornamento non arrivava mai** - risolto app v2.0.8 - 20 ottobre 2026:
  segnalato dal proprietario ("l'applicazione sui dispositivi mobili non riesce a ricevere il
  pacchetto di aggiornamento della versione"). Il pulsante "Aggiorna" compariva, ma il pacchetto
  non partiva: dentro l'APK la pagina gira in una WebView (Capacitor) e li' il download con
  l'attributo `download` non scarica niente (la WebView di Capacitor non mette nessun
  `DownloadListener`), quindi il file spariva senza nessun errore. Difetto minore collegato: il
  numero di build nel tag della release (`v2.0.7-131`) veniva confrontato come numero di
  versione, e il pulsante "Aggiorna" compariva anche subito dopo l'installazione. Correzione:
  nell'APK il pacchetto si apre come **navigazione** (link senza `download`), che Capacitor
  passa al browser di sistema dove il file viene scaricato davvero; il tag si annota e l'app si
  chiude solo DOPO l'installazione, non prima; il build number viene tolto prima del confronto.
  Test: `laboratorio/app/aggiornamento_apk.test.mjs` (4, prima rossi).

- **Nell'APK l'accesso con Google finiva con errore 400 e schermata bianca** - risolto app v2.0.9 -
  20 ottobre 2026: segnalato dal proprietario ("inserisco l'email, inserisco la password, poi mi
  manda all'autorizzazione da un altro dispositivo, e quando do l'autorizzazione si ricollega con la
  pagina web e mi manda sempre con errore 400 [...] mi dà tutta schermata bianca"). Causa misurata:
  il pulsante usava il POPUP di Firebase, che dentro la WebView dell'APK non ha la finestra nuova in
  cui rimandare la credenziale (Firebase risponde 400), e inoltre lasciava l'app a meta giro
  ("verifica in due passaggi" che non finiva) e, al secondo tentativo, la WebView restava sulla
  pagina di errore (schermata bianca). Correzione: nell'APK e sul telefono nel browser si usa il
  REINDIRIZZAMENTO (una normale navigazione, che torna nell'app); sul computer il popup resta, col
  reindirizzamento come ripiego se il browser lo blocca. In piu' l'app non resta piu' ferma su una
  pagina che non e' sua: al riavvio, se la WebView e' su una pagina esterna che non fa parte del
  giro di accesso, si torna alla pagina dell'app (MainActivity). Test:
  `laboratorio/app/login_google_flusso.test.mjs` (8, prima rossi).

- **L'APK proposeva l'aggiornamento anche quando era gia' all'ultima versione** - risolto app
  v2.0.10 - 20 ottobre 2026: segnalato dal proprietario ("il tasto aggiorna e' sempre presente.
  Io lo clicco, mi manda il pacchetto di aggiornamento, che e' effettivamente il 2.0.9, e' l'ultimo.
  [...] c'e' effettivamente la 2.0.9, ma l'applicazione mi dice che c'e' presente una nuova
  versione"). Causa misurata: l'APK pubblicato conteneva dentro se' uno sw.js con CACHE_NAME
  "forex-backtest-lab-v2.0.8" (copiato prima di alzare la versione e poi dimenticato). L'app
  credeva quindi di essere alla 2.0.8, la release era la 2.0.9, e il pulsante restava sempre
  li'. Correzione: il sw.js dell'APK riallineato al repository e un test che confronta i due
  numeri sul pacchetto costruito (`laboratorio/app/apk_versione.test.mjs`).
- **Il login con Google nell'APK finiva con errore 400 e schermata bianca, e sul tablet non
  finiva piu'** - risolto app v2.0.9 - 20 ottobre 2026: segnalato dal proprietario ("il login
  riesce, il problema e' che porta sempre sulla pagina di Google con l'errore 400 [...] mi da' tutta
  schermata bianca"). Due cause distinte, misurate: (1) il popup di Firebase non funziona dentro
  una WebView (non viene creata la finestra nuova in cui rimandare la credenziale: errore 400), e
  si usa quindi il reindirizzamento; (2) la credenziale che arrivava con il reindirizzamento non
  veniva letta, perche' nella WebView il fragmento cambia senza ricaricare la pagina - e l'app
  restava ferma sulla pagina di accesso (mentre l'accesso era riuscito: bastava riaprire l'app).
  Correzione: il risultato si legge sempre e si rilegge quando il fragmento arriva, e la
  bandierina scade dopo un'ora invece che dopo dieci minuti. Test:
  `laboratorio/app/login_google_esito.test.mjs` (6) e `login_google_flusso.test.mjs` (8).
- **La scala dell'interfaccia non scendeva sotto il 70%** - risolto app v2.0.10 - 20 ottobre
  2026: richiesto dal proprietario ("sul telefono il 70% dell'interfaccia e' troppo, posso
  scendere anche a 60, 50, 10, 15, 20 - e stessa cosa per la dimensione del testo. Non devi avere
  limiti"). Correzione: il tetto minimo della scala passa a 10% e anche il testo del grafico
  scende fino al 10% (prima 50%). Test: `laboratorio/app/scala_ui.test.mjs` (17).
- **La finestra separata (PIP) si mostrava come una pagina web: barra delle informazioni del sito
  con "about:blank", nessun titolo, nessuna icona, e il logo dell'app che mancava** - risolto app
  v2.0.21 - 22 ottobre 2026 (da pubblicare): segnalato dal proprietario ("in modalita' pip viene
  mostrata la barra delle informazioni del sito, con about blank, e quella deve essere tolta [...]
  deve essere una seconda schermata della STESSA applicazione, non un qualcosa collegato via web
  [...] la finestra non ha il logo come la pagina madre"). Causa misurata: la finestra veniva
  aperta con `window.open('')` su una pagina **vuota**, quindi il browser la trattava come una
  pagina web qualsiasi (e non come una finestra del programma). Correzione: si prova prima la
  **Document Picture-in-Picture nativa** (finestra senza barra del browser, senza indirizzo,
  con lo STESSO documento dentro: misurato dentro la finestra 0 script, un solo canvas e il
  motore inesistente, quindi un solo cervello e nessun doppio ordine); se l'API non c'e' si cade
  sul popup di prima, ma con l'icona dell'app nel titolo e una barra interna col logo e il nome
  "BacktestLAB FOREX EDITION". Scartata di proposito la seconda istanza dell'app (`?pipSlot=N`):
  aprirebbe un secondo collegamento a MT5/Capital.com. Test:
  `laboratorio/app/pip_finestra.test.mjs` (2).
- **Il puntatore del mouse nel grafico della finestra separata era sfasato in X e in Y** - risolto
  app v2.0.21 - 22 ottobre 2026 (da pubblicare): segnalato dal proprietario ("il puntatore e'
  sfasato di posizione sia dell'asse X che dell'asse Y: io punto il mouse sopra il grafico e la
  posizione effettiva e' spostata in alto a sinistra"). Causa misurata: con la scala UI al 130%
  il canvas era **950 px di layout contro 730 px a schermo** e il mirino cadeva 78 px a sinistra e
  55 px in alto; il mirino, da solo, era giusto (scarto -1/-1 px: arrotondamento). La causa vera
  era il **contro-zoom** della scala UI: sta sul `#chartWrap` e viaggia col nodo quando il grafico
  si sposta in un'altra finestra, dove il `body` invece non e' zoomato - il grafico si
  rimpiccioliva senza che nessuno lo misurasse (il disegno e la lettura del puntatore parlavano
  di due grafici diversi). Correzione: il contro-zoom si toglie quando il grafico cambia finestra
  e si rimette al rientro; l'invariante tenuta in test e' `clientWidth == rect.width`. Test:
  `laboratorio/app/pip_puntatore.test.mjs` (2).
- **La riga del gruppo delle posizioni non aveva la striscia di vicinanza, e per questo aveva una
  colonna in meno: tutte le colonne erano spostate a sinistra** - risolto app v2.0.21 - 22
  ottobre 2026 (da pubblicare): segnalato dal proprietario ("la linea in fondo a destra di ogni
  posizione deve essere visualizzata anche all'interno dei gruppi [...] se c'e' una posizione che
  e' piu' vicina allo stop profit mi visualizza il cartellino blu, se invece e' piu' vicina a una
  linea del tipo TP mi visualizzera' quella che e' il cartellino verde, e allo stesso tempo, se e'
  la piu' vicina a uno stop loss [...] il cartellino rosso"). Causa misurata: la riga del gruppo
  generava **14 celle invece di 15** (mancava proprio la cella della striscia), quindi non era un
  difetto di colore ma una colonna assente. Correzione: dentro il gruppo ogni singola operazione
  mostra il **proprio** cartellino, e sulla riga aggregata c'e' il cartellino della posizione
  **piu' vicina** a un livello (blu = stop a profitto, verde = take profit, rosso = stop loss),
  con nel titolo il numero della posizione dentro il gruppo ("Posizione 2 di 3: ..."); per
  scegliere la piu' vicina `fblStrisciaPosizione` restituisce adesso anche la percentuale (`perc`:
  0 = livello gia' superato, cioe' il caso piu' urgente). Test:
  `laboratorio/app/gruppi_striscia.test.mjs` (2).
- **Il margine di chiusura non sarebbe mai scattato: il metro era confrontato con se stesso** —
  risolto 2.0.21 (da pubblicare) — 22 ottobre 2026, `app.html` (punto 4 della consegna). Sintoma:
  il margine dello spread intorno alla chiusura del mercato non partiva mai. Causa misurata: la
  regola che rifiuta uno stop «troppo vicino» confrontava la distanza fermo/prezzo con la
  **forbice del cambio giornata**, e il margine E' quella forbice: confrontarli significa
  confrontare la forbice con se stessa, quindi il fermo col margine non era mai «abbastanza
  lontano». Correzione: il metro del margine è lo spread **ordinario** (`fblSpreadNormalePrezzo`),
  mentre per il pareggio esatto resta la forbice (la regola del 21 ottobre, che non si tocca).
  Test: `laboratorio/app/margine_chiusura.test.mjs` (8 casi, tempo iniettato).
- **Lo stop scritto in app prima che il conto lo avesse preso, e il giro che riprovava ogni due
  secondi** — risolto 2.0.21 (da pubblicare) — 22 ottobre 2026, `app.html` (punto 4 della consegna).
  Sintoma: se il ponte rifiutava lo spostamento dello stop, l'app mostrava comunque lo stop
  nuovo (che sul conto non c'era) e riprovava a ogni giro del polling MT5 (ogni 2 secondi).
  Causa misurata: il giro scriveva `pos.sl`/`pos.beChiusura` senza sapere il risultato della
  chiamata al ponte, e il tentativo non era tracciato da nessuna parte. Correzione: il tentativo
  si traccia **prima** (in `pos.beChiusuraTentativo`), lo stato locale si aggiorna **solo** se il
  conto ha preso lo stop, e il giro successivo aspetta **cinque minuti**. La stessa attesa mancava
  nel ramo «ritorno al pareggio esatto»: se il conto rifiutava quello, il giro riprovava due
  secondi dopo, per tutta la sessione. Test: i casi 7 e 9 di
  `laboratorio/app/margine_chiusura.test.mjs` (il ponte finto che rifiuta).
- **Il fermo col margine non era un prezzo** — risolto 2.0.21 (da pubblicare) — 22 ottobre 2026,
  `app.html` (punto 4 della consegna). Sintoma: lo stop calcolato per la SELL era
  `1,0899999999999999` (1,08500 + 0,00500 in virgola mobile) e andava al broker così com'era.
  Causa misurata: la somma del pareggio esatto e del margine non veniva arrotondata alla griglia
  del prezzo. Correzione: il fermo col margine viene arrotondato alle cifre del prezzo che dice
  il conto MT5 (come già faceva `mt5PrezzoPareggio` per il pareggio esatto). Test: il caso 3 di
  `laboratorio/app/margine_chiusura.test.mjs` (la SELL a 1,09000 esatto).

- **Le forme al grafico slittavano al cambio Time Frame** - risolto (da pubblicare) - 23 ottobre
  2026, commit `06d401b`, `app.html`. Sintoma: «cambio TF e trend, quadrati e linee slittano
  rispetto alle candele». Causa misurata: le punte dei disegni sono ancorate a un Istante reale
  (ms) che nel TF vecchio era l'apertura di una candela; al cambio TF le candele diventano bucket
  aggregati (5m/15m/1H da M1) e quell'istante non e' piu' l'apertura di nessuna candela: la punta
  slitta in mezzo alla candela (fino a quasi una larghezza intera) e l'inclinazione si riscrive.
  Correzione: `fblDisegniRiAgganciaAlTf()` riaggancia ogni punto alla candela del TF attuale piu'
  vicina (ricerca binaria su `rows`), lo stesso aggancio che il punto aveva al momento del
  disegno; la chiamano SOLO i veri cambi TF (il listener del timeframe in storico e i tre percorsi
  Live Capital/MT5/Binance con `opts.tfChangeSpanMinutes`), cosi' le risincronizzazioni periodiche
  dello stesso TF non toccano niente. Test: `laboratorio/app/disegni_cambio_tf.test.mjs` (2, con
  prova di controllo: prima della cura 10:07 NON e' apertura di una candela 5m).
- **Lo zoom si sincronizzava tra macchine** - risolto (da pubblicare) - 23 ottobre 2026, commit
  `a844e4c`, `app.html`. Sintoma: aprendo l'app su un'altra macchina arrivava lo zoom di quella
  prima, e alla sincronizzazione successiva scappava pure lo zoom scelto qui. Causa misurata:
  lo zoom (priceZoomFactor, viewPriceLo/Hi) viaggiava nel pacchetto di sessione
  (`collectLightSessionState`) destinato ANCHE al cloud, e `assetChartViews` portava pure lo zoom
  orizzontale e l'autogamma. Correzione: lo zoom di QUESTA macchina vive in un localStorage
  separato (`fbl_zoom_dispositivo`, aggiornato ad ogni salvataggio) e non entra piu' nel
  pacchetto; `trimTradesForCloudBudget` (unico punto di passaggio delle scritture cloud: report
  intero e keepalive) lo separa clonando senza toccare la memoria locale; chi applica uno stato
  remoto legge lo zoom solo dal file del proprio dispositivo, con semina una tantum dal pacchetto
  vecchio per non perdere lo zoom al primo avvio dopo l'aggiornamento. Le ancore di posizione
  (masterTime/viewEnd) viaggiano come prima. Test: `laboratorio/app/zoom_dispositivo.test.mjs`
  (3: pacchetto pulito, memoria intatta, pacchetto vecchio ignorato).
- **Le etichette TP/SL sovrapposte si impilavano** - risolto (da pubblicare) - 23 ottobre
  2026, commit `e231310`, `app.html`. Sintoma: nel gruppo di un segnale (stessa sala, N
  posizioni con entrata/stop/target identici) le N caselle TP/SL coincidono e le N etichette si
  scrivono una sopra l'altra: TP1/TP2/TP3 impilati e non si leggono. Causa: la casella si
  disegna per OGNI posizione (`drawTpSlZoneBox` una chiamata ciascuna) e un'etichetta non sa di
  avere sorelle gemelle sotto. Correzione: a ogni draw una mappa dei gruppi con la chiave della
  casella INTERA (asset, punto d'apertura, livelli, span risolto); le caselle gemelle si
  disegnano una volta sola, dalla prima posizione del gruppo, con un'unica etichetta (numero di
  posizioni, origine comune, accumulo della perdita sugli SL); durante il trascinamento di un
  livello il raggruppamento si stacca. Test: `laboratorio/app/etichette_raggruppate.test.mjs`
  (3).
- **Il gruppo delle etichette non s'esplodeva, e il tocco sull'etichetta non selezionava** -
  risolto (da pubblicare) - 23 ottobre 2026, `app.html`. Sintomi (tre richieste in un capitolo):
  «un pulsante che ci esplode tutte le etichette», «selezionare una posizione anche toccando
  l'etichetta tp-sl-stop profit», e il popup del Collegamento/Modalità intitolato
  «Impostazioni generali» invece di «Impostazioni di sistema». Causa misurata col banco dei
  PointerEvent sintetici: (a) il raggruppamento era una strada sola, senza invertitore;
  (b) la casella LARGA apre le statistiche e DESELEZIONA pure, perché è nella lista dei
  «vuoti» di `fblClickSuVuoto` (richiesta vecchia del proprietario: un rettangolo largo mezzo
  grafico non deve trattenere la selezione), quindi ogni selezione scritta al pointerup della
  casella veniva rispazzata nello stesso gesto; (c) la pillola dell'etichetta sta sulla STESSA
  altezza della linea TP/SL, e il controllo dei livelli la mangiava, selezionando la posizione
  senza aprire le statistiche. Correzioni: invertitore `#explodeTpSlEtichetteBtn` accanto a
  «Mostra/nascondi etichette» (scelta in localStorage `fbl_etichette_esplose`; con l'esplosione
  la mappa dei gruppi non si costruisce e ogni casella si disegna sua); hit-rect propri delle
  etichette (`tpSlPillHitRects`, riempito da `drawZonePill` che ora restituisce il rettangolo
  VERO dopo lo spostamento anti-sovrapposizione), candidato che al pointerdown si scrive PRIMA
  del hit dei livelli (la linea, sulla stessa y, lo mangerebbe) e al pointerup, se il gesto è
  fermo, SELEZIONA la posizione e apre le statistiche; in `fblClickSuVuoto` l'etichetta non è
  più «vuoto» (trattiene la selezione), la casella larga resta «vuoto» com'era voluto allora;
  titolo del popup rinominato in tutte le 8 occorrenze. Test: `etichette_esplodi_tocco.test.mjs`
  (3: scompatta/ricompone, tocco sull'etichetta del gruppo seleziona il rappresentante e apre
  le statistiche, tocco su TP2 scompattata seleziona p2) e `impostazioni_sistema.test.mjs` (2).


- **Credenziali MT5/Capital.com che spariscono su mobile** - risolto (da pubblicare) - 25
  ottobre 2026, commit `7f1d9a3`, `app.html`. Sintomo: su telefono/tablet il pulsante
  «Scegli» (cartella credenziali) non faceva nulla, le credenziali si perdevano a ogni
  riavvio/aggiornamento, e «Aggiungi nuovo conto» non apriva il popup. Causa misurata:
  `supportsFS=false` nel WebView Capacitor, quindi `getMt5CredsDirHandle()` tornava `null` e
  il salvataggio era gated da `if(supportsFS)`. Correzione: archivio IndexedDB interno
  (`FxbtCredsDB`) con handle virtuale (`getFileHandle`/`createWritable`), salvataggio
  abilitato su mobile, gate del bridge saltato con pulsante «Inserisci credenziali (salva
  nell'app)». Test: pacchetti_mobile (verdi), collaudo Falliti 0.
- **Pulsante «Aggiorna» che resta acceso su mobile** - risolto (da pubblicare) - 25 ottobre
  2026, commit `7f1d9a3`. Causa: `fblVersioneInstallata()` restituiva '' (caches vuote,
  fetch sw.js fallito nel bundle), quindi il confronto cadeva sul tag visto (vecchio) e il
  pulsante non si spegneva mai. Correzione: fallback `FBL_VERSIONE_BUNDLE` iniettato da
  `aggiorna_www.bat`, e ramo di spegnimento indipendente da `installata`.
- **Icone accanto ai testi diventate lettere strane nell'APK** - risolto (da pubblicare) - 25
  ottobre 2026, `aggiorna_www.bat`, `strumenti/inietta_versione.py`. Sintomo segnalato dal
  proprietario: «tutte le icone nei testi adesso mi dà tutti simboli di lettere strane».
  Misurato sull'`app.html` DENTRO l'APK v2.0.27: 800 "ðŸ", 1965 "â€", 4852 "Ã", ZERO emoji
  vere; lo stesso file sul Desktop era sano. Causa: l'iniezione della versione usava
  `(Get-Content app.html -Raw) | Set-Content -Encoding UTF8`; in Windows PowerShell 5.1
  `Get-Content` senza `-Encoding` legge i byte come ANSI (Windows-1252) e risalva il testo
  rovinato, con BOM. Correzione: iniezione fatta da uno script Python con UTF-8 esplicito,
  `newline=''` (CRLF intatti) e nessun BOM. Test: `iniezione_versione.test.mjs` (2), che
  esegue lo strumento su un file con emoji e controlla i byte in uscita.
- **Posizioni che si spostano a mercato chiuso** - risolto (da pubblicare) - 25 ottobre 2026,
  `app.html`. Sintomo: nel fine settimana le caselle Target/Stop "avanzavano" nel grafico
  mentre disegni e rettangoli restavano fermi. Causa misurata: il bordo destro della casella
  seguiva `idx` a ogni fotogramma (`keepPaceIdx:idx+replayFrazioneBarra()`), e a mercato chiuso
  `idx`/`viewEnd` avanzavano lo stesso per tre strade: rollover del refresh live, watchdog dei
  15s che ricaricava lo storico, guardiano candele MT5. Correzione: guardia
  `fblMercatoFermoOra` in tutte e tre, e `keepPaceIdx` fermo su `originBox` a mercato chiuso.
  Test: `mercato_chiuso.test.mjs` (7, di cui 2 nuovi che misurano il disegno vero e il
  ricaricamento dello storico).

  25 ottobre 2026, commit `98e7937`, `app.html`. Sintomo: in live replay con MT5 collegato,
  BUY/SELL non creavano nulla (il guard di placeRealMt5Order bloccava tutto) oppure, se MT5
  era scollegato, creavano posizioni simulate che finivano nelle statistiche del conto live.
  Correzione: il ramo reale viene saltato in replay (posizione simulata con mt5Ticket=null e
  flag historical:true, mode backtest in chiusura, equity invariata, nessuna chiamata al
  bridge, chiusura posizioni reali bloccata). Test: replay_storico.test.mjs (2).

- **Il tasto "Aggiorna" restava sulla pagina principale anche dopo l'aggiornamento** - risolto 2.0.30 - 26 ottobre 2026, segnalato con «rimane il tasto aggiorna in alto a destra della pagina, mentre dentro impostazioni di versione il tasto aggiorna non c'è, rimane in memoria e non va via il pulsante sulla pagina principale». Causa: nel ramo "pacchetto aperto nel browser esterno" di fblApplicaAggiornamento() il pulsante veniva RIATTIVATO invece di spento, e il tag non veniva annotato. Ora su computer il pulsante si spegne e il tag si annota; nell'APK il comportamento è INVARIATO (protetto da aggiornamento_apk.test.mjs: il pacchetto si apre nel browser e l'utente deve ancora installarlo a mano, quindi il pulsante deve restare). In più, su computer l'app non si chiude più da sola dopo il download: chiudere l'applicazione alle spalle dell'utente era fastidioso e non si capiva che il pacchetto era già in Download.
- **Il menù della strategia di sala stava a destra, tagliato dal bordo, e non si vedeva a tutto schermo** - risolto 2.0.30 - 26 ottobre 2026, segnalato con «quei pop-up delle strategie vengono messi tutti alla destra, invece no, deve stare al centro pagina ... in modalità a tutto schermo ... non viene visualizzata». Causa: tgAutoPosizionaPop() ancorava il menù al pulsante premuto, e lo z-index era 96 (troppo basso per stare sopra al grafico a tutto schermo). Ora il menù è centrato orizzontalmente, z-index 100000, e in testa porta il nome della sala, così si riconosce quale strategia si sta modificando.

- **In replay i segnali aprivano posizioni VERE sul conto MT5** - risolto 2.0.31 - 26 ottobre 2026, segnalato con «in modalità replay le posizioni non vengono aperte nell'account storico, ma vengono aperte sull'account MT5. Devi assolutamente correggere, non va bene. Non possono essere aperte nell'account MT5». Causa: tgEseguiSegnale() decideva se aprire ordini veri con `const reale=!!mt5Connected;` — la sessione replay non entrava nel calcolo, quindi con MT5 collegato gli ordini dei segnali partivano veri (placeRealMt5Order / placeRealMt5PendingOrder) anche mentre si rivede il passato. Ora `reale` è vero solo in sessione Live, con MT5 collegato e FUORI dal replay. Aggiunta anche la guardia del replay a tutte le altre funzioni che parlano col bridge (closeMt5PositionReal, closeMt5TicketFromTable, modifyMt5TicketFromTable, fblMt5SpostaStop, applyBreakevenToMt5TicketDirect): il proprietario ha detto "assolutamente", quindi è impossibile toccare il conto reale in replay per qualsiasi strada. Test: laboratorio/app/replay_segnali_conto_storico.test.mjs (3 prove).
- **L'ordine limite scelto dall'utente apriva comunque a mercato** - risolto 2.0.31 - 26 ottobre 2026, segnalato con «con il pulsante dell'ordine limite premuto ce le apre comunque a prezzo del mercato e non ce la posiziona come un ordine limite selezionando il prezzo per l'ordine pendente». Causa: in tgPiano() il prezzo scelto dall'utente veniva messo subito in `entry`, e il confronto che decide "pendente o mercato" era `opz.prezzo!==entry` — il prezzo confrontato con SE STESSO, sempre falso, quindi sempre a mercato (e anche il tipo limite/stop si deduceva da un confronto sbagliato). Ora il prezzo di mercato è salvato da parte (prezzoMercato) e i confronti usano quello.

- **Il grafico ridisegnava le stesse zone 4-5 volte al secondo (4,8 fotogrammi/secondo)** - risolto 2.0.31 - 26 ottobre 2026, misurato dal proprietario col pannello prestazioni: 276 ms per disegno, di cui **128 ms nella sola sezione zoneZeroPrint**. Causa: ad OGNI ridisegno il codice ri-scansionava fino a 12.000 candele e ricalcolava da zero le zone zero-print (imbalance), per sapere se erano ancora aperte. A 4,8 fps erano 12.000 candidati rifatti continuamente, per un risultato che cambia solo quando cambia il footprint. Cura: cache delle zone (si ricalcolano solo se cambiano asset, timeframe, soglia, finestra o contenuto del footprint, con `footprintVersione` che si alza a ogni tick) + lookback ridotto da 12.000 a 2.000 candele. Da misurare di nuovo dopo l'installazione: il disegno dovrebbe passare da 276 ms a ~150 ms; le prossime sezioni da guardare sono disegniUtente (84 ms) e indicatori (46 ms). Nota dalla stessa misura: 1.042.311 tick di footprint e 1.350 MB di memoria, perche' `FOOTPRINT_MAX_TICKS_PER_ASSET` è 150.000 tick PER ASSET (7 asset aperti = oltre un milione di tick): è la prossima cosa da ridurre, ma è una scelta di prodotto (quanto storico footprint tenere) e va decisa col proprietario.

- **La firma anti-doppioni non aveva mai funzionato** - risolto 2.0.32 - 27 ottobre 2026, trovato durante il passo 1 del progetto dati nostri. Causa misurata: lo stato salvato porta savedAt:Date.now(), che cambia a OGNI raccoglimento. La firma si calcolava su tutto il testo, quindi due fotografie identiche avevano firme diverse e si riscrivevano sempre — il proprietario aveva chiesto "identico = non si scrive" (CONSEGNA-OPENCODE-22-OTTOBRE, §1.3) e la console Firebase conta lo spreco (107K scritture in 30 giorni). Cura: la firma si calcola sul contenuto stabile (savedAt normalizzato a 0), il peso continua a essere quello reale. La regola della consegna resta intatta: la firma si aggiorna solo DOPO una scrittura riuscita, e se le operazioni nuove non si salvano la firma non si aggiorna — al giro dopo si riprovano da sole.
- **Il salvataggio cloud mandava 305 KB a ogni scrittura, di cui 194 KB di storico operazioni** - risolto 2.0.32 - 27 ottobre 2026, passo 1 del progetto dati nostri (PROGETTO-DATI-NOSTRI.md §1, §6). Misurato sulla console Firebase (30 giorni): letture 293K, scritture 107K, "larghezza di banda oltre 10 GB" e "byte archiviati oltre 1 GB" — il costo Firestore e' 3,54 € su 4,82 € totali. Cura: le operazioni chiuse stanno in un documento a parte (users/{uid}/data/trades) e si aggiungono con arrayUnion: una operazione nuova sono ~259 byte invece della fotografia intera (750 volte meno). Il documento session non porta piu' lo storico. Il keepalive della chiusura pagina manda il documento senza operazioni. La lettura unisce i due documenti e resta retrocompatibile. Test: laboratorio/app/cloud_incrementale.test.mjs (3 prove, col comportamento misurato in byte; prova di controllo fatta: rimesso il file vecchio, il test diventa rosso).

