# BUG

## 2026-11-24 - App non si collega più a MT5 dopo riavvio del ponte
- **Sintomo**: app desktop non collegata a MT5; pulsante "Connetti" non rispondeva. Feed server (8001) vedeva l'account, ponte (8000) no.
- **Causa**: ponte riavviato senza `mt5.initialize()` nel suo processo (due processi separati). Non era il browser né le credenziali.
- **Cura**: `POST /mt5-launch` (endpoint esistente, senza credenziali) → aggancia il terminale già aperto.
- **Verifica**: `/account` login 12346925 @ Upcomers-Server, equity 9682.38; posizioni vere di nuovo.
- **Lezione**: se il feed vede MT5 e il ponte no, non chiedere le credenziali — usare `/mt5-launch`.

## 2026-11-24 - Book storico resta in memoria al cambio asset
- **Sintomo**: cambiando asset, lo storico book 12h dell'asset precedente restava in `orderBookHistoryByAsset`.
- **Causa**: nessuna pulizia al cambio asset.
- **Cura**: `fblPulisciBookStoricoAlCambioAsset` chiamata sugli switch asset; mantiene asset corrente e chiavi `reg:`.
- **Prova**: `laboratorio/app/book_storico_cambio_asset.test.mjs`.

## 2026-11-24 - Replay-live: trade storico chiuso invisibile in Journal/stats
- **Sintomo**: chiudendo una posizione `historical` in replay-live, il trade non compariva nel Journal/conto replay; passando a Storico restava assente.
- **Causa**: `closeTrade/addBackfilledMt5Trade` scrivevano in `sessionByMode[closeMode].trades` quando `closeMode!=currentMode()`, ma Journal/stats leggono `trades` globale.
- **Cura**: mirror dello stesso oggetto trade nel `trades` globale quando la destinazione è un bucket di sessione diversa.
- **Prova**: `laboratorio/app/replay_journal_visibile.test.mjs` (rossa/verde), regressione `replay_fix_4_issue.test.mjs`, `replay_posizione_non_si_chiude_subito.test.mjs`.

## 2026-11-24 - BOS auto-open: TP/BE/chiusura non sincronizzati su posizioni reali; beTp1 non applicato; tocco valid pullback solo a fine candela
- **Sintomo**: auto-open BOS apre posizione ma TP seconda entrata mancante; prima posizione non chiusa al TP1; BE % non sposta SL; nessuna chiusura a tutti i TP. In replay chiusura non sempre visibile in Journal con ora reale.
- **Causa**: st.ops aggiornati solo nella simulazione indicatore, utoPosId mai riletto; eTp1 presente in settings ma non implementato; compute BOS avanzava builtTo sulla barra in formazione, rilevando il tocco solo a candela chiusa.
- **Cura**: helper osPosAuto/bosSyncAutoPos/bosChiudiAutoPos per propagare TP/SL/BE/chiusura; implementato eTp1; BOS rievaluta barra in formazione senza avanzare builtTo e con guardie anti-duplicato; 
ealCloseAt su trade chiusi e visualizzazione Journal.
- **Prova**: laboratorio/app/bos_auto_sync_posizioni.test.mjs, test BOS esistenti, sintassi app.

## 2026-11-23 - Grafico fermo dopo le 22:00 mentre MT5 trasmette (v2.2.113)
- **Sintomo**: dopo le 22:00 (ora Roma) le candele non venivano piu disegnate sul grafico; capitale/P&L live si aggiornavano. Misurato: liveSessionPhaseNow=closed, chiusuraMin=1320, mt5Connected=true, mt5ActiveSymbol=null, ssetRiceve=false, lastMt5TickAt/Real=0.
- **Causa**: liveSessionTick congelava il feed chart sulla chiusura da orologio; il guard proteggeva solo con tick recenti (blAssetRiceveDatiOra). Con feed tick WS morto/assente ma broker ancora tradabile (P&L REST vivo), la fase passava a closed e spegneva il grafico.
- **Cura**: in liveSessionTick autorita MT5: se blMercatoMt5Noto dice 	rade_allowed=true, la fase resta/torna mt5 (no freeze/riapertura); se cache sconosciuta, finestra breve 15s per chiedere a MT5, poi fallback orario.
- **Prova**: laboratorio/app/chiusura_mt5_autorita.test.mjs (3/3), sintassi app.

## 2026-11-23 - BOS auto-open replay: lotti 0.01 e chiusura immediata da scan
- **Sintomo**: BOS auto-open apre sempre 0.01 lotti; posizione replay "sfarfalla" (TP/SL poi sparisce), SL non toccato, trade non visibile nel Journal/capitale della sessione guardata.
- **Causa**: `op.lotto` ? oggetto `{lotti,...}` ma auto-open faceva `Number(op.lotto)`=>NaN=>0.01; `scanHistoricalSlTpTouches` poteva chiudere la birth bar in replay.
- **Cura**: usa `op.lotto.lotti`; guard birth bar anche in scan mentre replayForm ? sulla stessa barra; rischioOperazione usato nei lotti pullback/insieme (per operazione).
- **Prova**: sintassi, collaudo.

## 2026-11-23 - BOS auto-open replay: chiusura immediata nella stessa barra
- **Sintomo**: status "aperta" ma chiude subito (XAUUSD M1 replay), Journal vuoto/non visibile nella sessione attesa.
- **Causa**: replayValutaFormazione chiudeva al tick successivo sulla stessa forming bar; guard solo su sub insufficiente.
- **Cura**: `_replayBornBarIdx` e skip in replayValutaFormazione per tutta la forming bar di nascita.
- **Prova**: sintassi, collaudo.

## 2026-11-23 - BOS auto-open replay: apre e chiude subito
- **Sintomo**: in replay, al valid pullback apre e chiude subito; linee TP/SL compaiono ma posizione non resta aperta; Journal registra P/L.
- **Causa**: guard replay consentiva solo i==idx (bloccava forming bar idx+1); replayValutaFormazione poteva chiudere la posizione nello stesso tick/sub di nascita.
- **Cura**: consenti i tra idx e replayForm.idx; aggiunto `_replayBornSub` e skip in replayValutaFormazione finch? sub <= bornSub.
- **Prova**: sintassi, collaudo.

## 2026-11-23 - Replay: prezzo live mostrato / BOS auto-open bloccato
- **Sintomo**: in replay/backtest il prezzo mostrato era il tick live reale; BOS auto-open in replay poteva non aprire per guard same-bar troppo aggressivo.
- **Causa**: `currentPrice()` restituiva tick live anche in replay; guard SL/TP stessa barra in BOS auto-open saltava aperture legittime.
- **Cura**: `currentPrice()` in replay usa `replayPrezzoFormazione()`/`rows[idx].close`; rimosso guard same-bar aggressivo (la chiusura SL/TP la gestisce lo scan col confine replay).
- **Prova**: sintassi, collaudo.

## 2026-11-23 - BOS auto-open replay: sessione/P-L/grafico errati
- **Sintomo**: in replay, auto-open Valid BOS Pullback aggiungeva/subtraeva subito denaro, non mostrava posizione/entry-SL-TP sul grafico, trade nel Journal in sessione Live PF.
- **Causa**: posizione auto creata senza campi replay/storici (`historical`, `startTime` replay, `realOpenAt`, `openTF`, `rrSl/slIniziale`) e senza guard same-bar SL/TP.
- **Cura**: in replay posizione `historical:true`+backtest corretto con campi grafico/replay; guard SL/TP stessa barra solo in replay; auto-open permesso in replay demo/simulato.
- **Prova**: `bos_auto_open_demo.test.mjs`, sintassi, collaudo completo verde.

## 2026-11-23 - Hotfix 2.2.107: regressione asse tempo/profili (1h indietro)
- **Sintomo**: asse tempo 1h indietro (es. 03:09 invece di 04:09), profilo volumetrico giornaliero spezzato a 23:00.
- **Causa**: mia correzione 2.2.105/106 sbagliata: forzava UTC su timestamp MT5 che sono gi? UTC reali (`utc_offset_seconds_applied` ? metadato broker, non shift da togliere in display).
- **Cura**: ripristinato display in fuso device/selectedTimeZone e `romeDayAndMinute` originale.
- **Prova**: sintassi, collaudo.

## 2026-11-23 - Hotfix 2.2.106: 500 /positions dopo 2.2.105
- **Sintomo**: `/positions` del bridge risponde 500 Internal Server Error; app non riceve posizioni MT5.
- **Causa**: regressione in 2.2.105: `_offset_server_cache()` assegnava `_last_good_server_offset/_server` senza dichiararli `global`, causando `UnboundLocalError`.
- **Cura**: aggiunti i global mancanti in `_offset_server_cache()`.
- **Prova**: `sintassi_app.mjs`, collaudo.

## 2026-11-23 - Chiusura MT5 non riflessa in app / saldo Journal errato / fuso MT5
- **Sintomo**: posizioni chiuse su terminale non chiuse in app; doppione/Journal incoerente; saldo Journal 10.825 ? vs saldo reale; al cambio account MT5 asse tempo/profili volumetrici giornalieri sfasati.
- **Causa**: `fetchMt5Positions` azzerava `mt5MissingSince` quando `/deal_reason` dava reason/price nulli o prezzo<=0, impedendo retry; `closeTrade/addBackfilledMt5Trade` scrivevano sempre nei globali correnti; saldo reale deal mancante ricadeva su saldo simulato; asse/profili usavano fuso Rome su timestamp MT5 gi? shiftati da offset broker; `bridge.py` `_offset_server_cache()` poteva restituire `None` causando 500 su `/positions`.
- **Cura**: retry su deal_reason incompleto/prezzo<=0; routing trade/equity nella sessione corretta (`fblRegistraTradeMt5` accetta array destinazione); fallback `mt5AccountInfo.balance` per trade reali MT5; `chartDisplayTimeZone()`=UTC per asset MT5 attivo e `romeDayAndMinute` broker-aware; `_offset_server_cache()` fallback numerico 0.
- **Prova**: `sintassi_app.mjs`, test mirati replay/journal/entry, collaudo completo verde.

## 2026-11-23 - Entry 0 in apertura live (P/L non calcolabile)
- **Sintomo**: apertura posizione in live con entry a 0, P/L/SL-TP non calcolati; segnalato su operazione reale.
- **Causa**: guardie entry accettavano `0` (`Number.isFinite(0)` true); `currentPrice()` poteva restituire close 0; `placeRealMt5Order` accettava fill price 0.
- **Cura**: rifiuto `entry<=0` in `openMarketTrade` (prima/dopo spread), `currentPrice()` ritorna null su close `<=0`, `placeRealMt5Order` non crea posizione locale con fill/approx `<=0` e ricarica posizioni MT5.
- **Prova**: `laboratorio/app/entry_zero_guard.test.mjs`.

## 2026-11-23 - Replay: trade in sessione live, date/linee/sviluppo errati
- **Sintomo**: posizioni aperte in replay finivano nel Journal live; date storiche ambigue; linee tratteggiate entry/SL/TP in replay; trade chiusi visibili prima della chiusura tornando indietro.
- **Cura**: trade `historical` chiusi in replay salvati in `backtest/backtest_propfirm`; `realOpenAt` + tooltip "Apertura reale / Asse grafico"; rimosse linee tratteggiate replay; trade chiuso visibile solo a `closeReached`.
- **Prova**: `laboratorio/app/replay_fix_4_issue.test.mjs`, `replay_capitale_dopo_chiusura.test.mjs`, `replay_live.test.mjs` caso 6, `v138.test.mjs` caso A aggiornati.

## 2026-11-23 - Offset broker/UTC errato su broker non EET (Upcomers) e Prop Firm esercitazione
- **Sintomo**: posizioni graficate ~1h sfasate su Upcomers; conti esercitazione/non-prop valutati da Prop Firm; caselle drawdown nascoste in attesa dati MT5.
- **Causa**: fallback calendario hardcoded EET/FTMO in bridge/mt5_feed_server; cache offset globale non per server; checkPropFirmRules senza gate esercitazione; guardia dati-MT5-non-pronti ritornava senza aggiornare display.
- **Cura**: offset misurato da tick, cache per server, fallback disco/0 prudente; gate `esercitazione` in checkPropFirmRules; pannelli DD mostrano "in attesa dati MT5 reali".
- **Prova**: `test_scarto_ricordato.py`, `test_scarto_server.py` aggiornati.

## 2026-11-23 - Valid BOS Pullback: scadenza a tempo dopo valid pullback
- **Sintomo**: dopo valid pullback, setup/operazioni scadevano a tempo ("target scaduto").
- **Cura**: nessuna scadenza a tempo dopo valid pullback (stage>=2) e sulle operazioni; `maxWait` resta solo per formazione setup. Aggiunto toggle BE su TP1 (SL seconda a BE entrata, solo favorevole).
- **Prova**: `sintassi_app.mjs`, `scaletta_setup.test.mjs`.

## 2026-11-22 - Prop Firm: falsa violazione / capitale simulato quando dati MT5 non pronti
- **Sintomo**: conto MT5 reale mostrava capitale simulato e "dati MT5 non arrivano"; violazione giornaliera/chiusura falsa; popup casuali.
- **Causa probabile**: con `pfWantsRealMt5` ma dati reali non pronti, il motore valutava sul simulato; stato chiuso bloccava la riattivazione dati reali.
- **Cura parziale**: guardie in `checkPropFirmRules` (no valutazione simulata se MT5 reale atteso ma dati non pronti) e in `maybeEvaluatePfMt5Account` (consenti lettura dati reali anche se stato chiuso, senza riaprire). Richiede verifica su caso reale.

## 2026-11-22 - Leak grafico trade MT5 altri conti in live_propfirm
- **Sintomo**: con conto A attivo, sul grafico comparivano trade chiusi MT5 di conto B (anche altro modo) su app installata.
- **Causa**: `tradeBelongsToCurrentView` applicava il filtro conto MT5 solo a `m==='live'`, non a `live_propfirm`.
- **Cura**: filtro conto applicato a `live` e `live_propfirm`; in live non connesso esclusi trade con `mt5Ticket` o `mt5Login`.
- **Prova**: `laboratorio/app/conto_non_si_mischia.test.mjs` (caso live_propfirm cross-account).

# Registro dei bug

Formato: **titolo** — stato — dove — causa vera — test che lo controlla.

## IN CORSO — 22 novembre 2026, Fase 1A / 7-bis: ordini esposti via dominio senza Tailscale

**Stato.** In lavorazione sul repo (non pubblicato). Obiettivo: esporre `/pc/8000/*` via Caddy/dominio solo dopo controlli 7-bis.

**Fatto.**
- `server_oracle/prepara_dominio.sh`: applicato fix 8.7.27 (`auto_https disable_redirects`, `https://$DOMINIO`) e esteso Caddyfile a `/dati`, `/pc/*`, `/segnali/*` con 404 sul resto.
- `server_oracle/sicurezza_7bis.py`: controlli 7-bis per rotte ordini proxiate (origine ammessa, segreto mancante, segreto revocato, registro `registro_rifiuti.jsonl` in `FBL_DATI`).
- `server_oracle/ponte_server.py`: middleware HTTP + check WS per 7-bis sulle rotte ordini.
- `installer_build/build/auth_server.py`: revoca marca `revocata` (non cancella), aggiunto `chiave_revocata`; nuova registrazione su uid revocato emette chiave nuova.

**Test.** `laboratorio/ponte/test_7bis_ordini.py` 4/4 verdi (senza segreto, revocato, origine diversa rifiutati e registrati; valido+origine app passa). `python -m pytest -q laboratorio/ponte` 421/421 verdi.

**Manca per chiudere 7-bis/Fase 1A.** Segreto per dispositivo con scadenza, rate limit, registro esteso/rotazione, tunnel agente `/agente` cablato in ponte_server per PC senza porte in ingresso, verifica Caddy reale su `forexbacktestlab.duckdns.org`, rimozione Tailscale da codice/APK/UI/testi con checklist mobile.

## RISOLTO — 22 novembre 2026, 8.4.12: posizioni/trade di altri conti visibili sul grafico

> Scaletta 8.4.12: «Sul grafico si vedono le posizioni di tutti i conti... una posizione passa il filtro se ha il login del conto attivo **o se non ha login**».

**CAUSA.** `positionBelongsToCurrentView`/`tradeBelongsToCurrentView` accettavano record reali con `mt5Login==null` anche a conto noto; con ponte condiviso/multi-conto questo poteva mostrare posizioni di altri conti.

**CURA.** A conto noto passano solo record reali con `mt5Login` uguale al conto attivo. A conto ignoto resta il comportamento conservativo. In `fetchMt5Positions`, timbratura `mt5Login` su posizioni/ordini/trade reali senza login quando la foto dichiara il conto.

**TEST.** `laboratorio/app/posizioni_null_login_conto.test.mjs`; aggiornati `misura_isolamento_conto_mt5.test.mjs` e `posizioni_grafico_madre_duplicata.misura.test.mjs` al nuovo contratto 8.4.12.

## RISOLTO — 22 novembre 2026, 8.4.10: popup violazione solo sulla madre

**CAUSA.** `showPropFirmViolationOverlay()` mostrava l'overlay in qualunque finestra con violazione (anche duplicate).

**CURA.** Guardia `fblFinestraMadre()` (`PIP_SLOT===0`); l'overlay non si apre sulle duplicate. Su restore/finalize non viene ripetuto se il conto è già chiuso.

**TEST.** `laboratorio/app/scaletta_8410_8411.test.mjs`.

## RISOLTO — 22 novembre 2026, 8.4.11: “Ricomincia” non avvisava le duplicate

**CAUSA.** `fblApplicaStatoTrading` manteneva capitale locale e non riallineava runtime Prop Firm (initialCapital/violazione/baseline/createdAt/campo capitale) al sync.

**CURA.** A parità di conto/modalità, il capitale di sessione segue il sync; per sessione Prop Firm corrente riallineati runtime e UI.

**TEST.** `laboratorio/app/scaletta_8410_8411.test.mjs`.

## FATTO — 22 novembre 2026, 8.4.9: scelta Prop Firm Vera/Trial per conto

**DECISIONE PROPRIETARIO.** Due opzioni: Prop Firm reale (vera) e Firm demo trial. Stesse regole, trial simulata. Scelta ricordata per conto; dopo violazione nessuna domanda/popup; conti non idonei nessun popup; lista conti mostra stato Attivo/Fallito/Passato.

**CURA.** `fblPropMt5Key(login,server)` chiave selettiva; `pfMt5ChoiceGet/setPfMt5Choice` compatibili con vecchia chiave; modal vera/trial; `maybeEvaluatePfMt5Account` aggiornata; `fblPropContoDaChiedere` non richiede dopo violazione; etichette stato in select/popup conti MT5. Aggiornato `prop_conto_chiuso_scelta.test.mjs` alla regola 8.4.9.

## RISOLTO — 22 novembre 2026, 8.2.6: magazzino candele non distingueva il broker

**CAUSA.** Chiave cache `asset::tf` senza broker: due broker con stesso simbolo potevano sovrascriversi.

**CURA.** Chiave `asset::tf::broker` (server MT5 normalizzato), fallback lettura legacy, `fblCandleCacheAssetDi` compatibile con nuovo formato.


## RISOLTO — 22 novembre 2026, replay: posizioni chiuse restano visibili sul grafico

> «quando chiudo le posizioni in modalità replay le posizioni non rimangono impresse a grafico,
> quindi non posso rivedere la posizione che ho aperto come in modalità live che rimane sul
> grafico il tp e sl» — proprietario.

**CAUSA.** In replay `drawClosedTradeMarkers` mostrava le orizzontali Entry/TP/SL solo finché il
trade era aperto (`!closeReached`), poi le toglieva.

**CURA.** In replay le orizzontali restano visibili anche dopo la chiusura
(`liveReplayActive && openIdx<=idx`), così la posizione chiusa resta rivedibile sul grafico.

## FATTO — 22 novembre 2026, registro spostamenti SL/TP sulle posizioni chiuse

> «quando selezioniamo una operazione chiusa a grafico deve farci vedere dove erano i tp-sl e se
> poi lo stop loss è stato spostato prima di chiudere la posizione... un vero e proprio registro
> che registra mano mano gli spostamenti del tp-sl... solo se selezioniamo la posizione chiusa»

**CURA.** `app.html`: ogni modifica SL/TP sulla posizione attiva registra `slHistory`/`tpHistory`
(prezzo, tempo, indice candela). Alla chiusura il trade porta lo storico. Selezionando una
posizione chiusa sul grafico, si disegna il percorso a gradini degli spostamenti SL/TP.

## RISOLTO — 22 novembre 2026, collaudo GitHub v2.2.96 rosso (import MetaTrader5 su CI Linux)

**CAUSA MISURATA.** `laboratorio/ponte/test_scarto_broker_calendario.py` importava
`mt5_feed_server` senza stub MetaTrader5/pywinauto; su GitHub Actions (Linux) collection falliva
con `ModuleNotFoundError: No module named 'MetaTrader5'`.

**CURA.** Stub `MetaTrader5`/`pywinauto` in `sys.modules` prima dell’import, come negli altri test
del ponte (funzioni sotto test sono calcoli puri di calendario).

## RISOLTO — 22 novembre 2026, in replay il capitale del conto storico non si aggiorna alla chiusura

> «in modalità backtest nel replay la apre e la mantiene e calcola perfettamente quello che è il
> P/L live, il problema è quando la chiude non aggiorna il capitale del conto storico, mentre
> invece nel trade journal la fa vedere la posizione con il suo profitto/perdita» — proprietario.

**MISURATO.** Banco `laboratorio/app/replay_capitale_dopo_chiusura.test.mjs`: in replay live,
posizione BUY aperta a 4080, avanzata di una candela (P/L flottante +100), chiusa manualmente.
Prima della cura: capitale prima 10100, dopo la chiusura 10000 (il guadagno spariva); il trade
era nel journal con `pl:100` ma con `mode:'backtest'`.

**CAUSA VERA.** `closeTrade` salvava le posizioni replay (`historical`) con
`closeMode = backtest/backtest_propfirm` invece della modalità corrente, quindi `statsTrades()`
(che legge la modalità corrente) non le contava. Inoltre `equity.push` e l'aggiustamento in
`removeTradeRecordAt` erano saltati per `historical`.

**CURA.** `app.html`: per le posizioni historical si usa `currentMode()`; `equity.push` e
`removeTradeRecordAt` considerano anche i trade historical durante `liveReplayActive`, così
capitale, curva e rimozione restano coerenti.

**PROVA.** `replay_capitale_dopo_chiusura.test.mjs` 1/1; regressione replay 14/14.

## FATTO — 22 novembre 2026, etichette BOS più leggibili e BE2 calcolato dalla rottura

> «migliorie estetiche alle scritte che appaiono sul grafico dell'indicatore pull back, dobbiamo
> rendere le scritte più leggibili e non un testo sopra l'altro. inoltre dobbiamo aggiungere pure
> l'opzione che il be della seconda operazione quando raggiunge la percentuale di arrivo al tp
> deve partire dalla rottura e non dalla apertura della posizione stessa» — proprietario.

**CURA.** `app.html` (Valid BOS Pullback): etichette delle operazioni raccolte, ordinate per y,
distanziate (min 13 px) e disegnate con sfondo scuro semitrasparente. Aggiunta opzione
`bePerc2Da` (`apertura`/`rottura`, default `apertura`): quando è `rottura`, il livello BE2 si
calcola come `rottura + (TP - rottura) * quota`.

**PROVE.** `bos_be2_da_rottura.test.mjs` 2/2 (da rottura 101.725, da apertura 101.50). Sintassi OK.

## RISOLTO — 22 novembre 2026, in replay la prop firm non blocca il conto storico per colpa del conto MT5

> «in replay il comando di apertura posizione non prende e mostra il messaggio di blocco
> prop-firm, benché il conto storico sia a 9938,25 €» — proprietario, 22/11/2026. Messaggio visto:
> «🛑 Conto Prop Firm chiuso per violazione: nessuna nuova operazione consentita.»

**MISURATO.** Banco `laboratorio/app/replay_prop_firm_conto_storico.test.mjs`, in replay (Live +
MT5 collegato, prop firm accesa sul conto reale). Conto MT5 vero: capitale iniziale 12.000,
equity 9.938,25 (-17,2%, oltre il 10%). Conto storico: 10.000 iniziali, equity 9.938,25 (-61,75,
-0,6%). Prima della cura: `checkPropFirmRules()` registrava violazione `max` con `realMt5Login`
e `openMarketTrade('BUY')` lasciava 0 posizioni aperte e la riga «chiuso per violazione».

**CAUSA VERA, due strade dello stesso difetto.** (1) `pfUsesRealMt5()` rispondeva sì anche dentro
il replay, perché il replay vive nella sessione Live: il motore misurava i limiti sull'equity del
conto MT5 vero, contro la regola già scritta in `fblPropContoId()` («in replay vale SEMPRE lo
storico, anche con MT5 collegato», 28 ottobre 2026). (2) La violazione del conto reale restava in
memoria (`propFirmViolation`) e la sessione `live_propfirm` è una sola: il blocco del conto vero
si portava dietro anche il replay.

**CURA.** `app.html`: `pfUsesRealMt5()` ora richiede `!liveReplayActive`. `triggerPropFirmViolation`
marca la violazione con `contoId: fblPropContoId()`. `checkPropFirmRules()`, all'inizio, mette da
parte in replay solo una violazione che non appartiene al conto corrente (marca di altro conto,
oppure `realMt5Login`, oppure il conto corrente non risulta chiuso in `fbl_prop_conti`); la
chiusura del conto vero resta scritta e torna appena si esce dal replay.

**PROVE.** `replay_prop_firm_conto_storico.test.mjs` 2/2: apre in replay sul conto storico sano,
e la violazione del conto reale riappare uscendo dal replay (prova di controllo). Rosse prima
della cura, verdi dopo.

## RISOLTO — 22 novembre 2026, la seconda entrata del Valid BOS Pullback prende il TP solo alla conferma

> «la seconda entrata (al pullback) non deve avere TP ma solo lo stop loss identico alla prima;
> il TP va impostato solo quando la rottura del punto di liquidità è confermata, calcolando il
> target dall'entrata del pullback al punto di rottura, con R:R 1:2 o 1:3 (modificabile nelle
> impostazioni)» — proprietario, 22/11/2026.

**MISURATO.** Banco `laboratorio/app/bos_seconda_tp_alla_conferma.test.mjs`. Candele note
(entrata 101,05, stop 100,94, punto di rottura 101,50, rrTarget2=2, modo «insieme»): prima della
cura la seconda nasceva con TP 101,27 (rischio 0,11 × 2) e nella scena senza conferma un massimo
di 101,35 la chiudeva a target alla barra 9, mentre la rottura non era confermata.

**CURA.** `app.html`: in modo «insieme» la seconda nasce con `tp: null` e lo stesso stop della
prima. Alla conferma (`bosImpostaTpConferma`) il TP diventa `entrata ± distanza(entrata, punto di
rottura) × rrTarget2` (2 o 3, impostazione `rrTarget2`). `bosChiudiOperazioniToccate` ignora un
TP non numerico. Il disegno mostra «TP: alla conferma della rottura» finché manca. Non si forza
più la seconda a break-even sulla stessa barra in cui la prima incassa la rottura: altrimenti il
TP appena armato veniva chiuso subito dallo stop a pareggio.

**PROVE.** `bos_seconda_tp_alla_conferma.test.mjs` 4/4 (nascita senza TP, TP 1:2 alla conferma,
TP 1:3, nessuna chiusura senza conferma). `bos_due_entrate` 5/5, `bos_break_even` 4/4,
`scaletta_setup` 4/4: 13/13 verdi. Rosse prima della cura, verdi dopo.

## RISOLTO — 22 novembre 2026, i nomi dei modelli tornano a essere tre cassetti separati

> «se io lo salvo con lo stesso nome non mi può venire fuori il messaggio attenzione, hai già un
> modello chiamato... io sto salvando il nome del modello su un contenitore del ritracciamento di
> Fibonacci e non lo sto salvando sul contenitore dei disegni, o del profilo volumetrico. Quindi
> deve esserci distinzione.» — proprietario, 21/11/2026.

**MISURATO.** Banco `laboratorio/app/nomi_modelli_disegni.test.mjs`, prova «i nomi GIÀ USATI si
vedono dentro la finestra del nome»: salvato un Fibonacci «Fib 61.8 ritracciato», aprendo il «Salva
come...» di un disegno l'elenco dei suggerimenti conteneva i tre nomi di famiglie diverse —
`["Supporto giornaliero","Zona domanda","Fib 61.8 ritracciato"]`.

**CAUSA VERA.** Le tre funzioni erano già state separate per cassetto
(`nomeModelloGiaUsato(nome,classe)`, `nomiModelliGiaUsati(classe)`, `eliminaModelloOmonimo(nome,classe)`)
ma **la strada del Fibonacci non passava mai la classe**: `chiediNomeModello(...)` era chiamata con
due soli argomenti, e `eliminaModelloOmonimo` riceveva `fblClasseModello(d.type)` dove `d` in quel
punto non esiste. Senza classe le funzioni ripiegano sul vecchio comportamento «cerca in tutte e tre
le memorie»: da qui la domanda di sovrascrittura per un nome libero nel cassetto di destinazione, e
da qui la cancellazione del modello di un'altra famiglia.

**CURA.** `app.html`: la strada Fibonacci passa `'fib'` a entrambe —
`chiediNomeModello('...','...','Fib 61.8 ritracciato','fib')` e `eliminaModelloOmonimo(nome,'fib')`.
Regola del proprietario, ora rispettata: ogni cassetto ha i suoi nomi; la domanda di omonimia
compare solo dentro lo stesso cassetto; la sovrascrittura tocca solo quel cassetto.

**PROVE.** `nomi_modelli_disegni.test.mjs` 11/11 e `modelli_laterale_e_predefinito.test.mjs` 11/11
(22/22 insieme), più i vicini `modelli_per_classe`, `modelli_profilo`, `modelli_ovunque`,
`modello_salvato_non_mente`, `modello_disegno_barra`: 30/30. Rosse prima della cura, verdi dopo.

## RISOLTO — 21 novembre 2026 sera, l'ora di mercato tagliata (l'ultima candela a 21:59)

> «L'ultima candela visualizzata al terminale di MT5 è alle 22:58, mentre a me mi visualizza alle
> 21:59, e effettivamente mi taglia quella che è un'ora di mercato.» — proprietario, 21/11/2026.

**MISURATO riproducendo la scena in laboratorio, non dedotto.** Con `fblScartoServerSec = null`
(scarto del server ignoto), serie a 1 minuto che arriva alle **22:58 di Roma** e tick veri fino a
lì, il grafico mostrava come ultima candela **21:59 di Roma** (20:59 UTC). Numeri, non impressioni:
`{"totale":179, "confine":120, "ultima":"2026-11-11T20:59:00.000Z"}`.

**CAUSA VERA, due strade che si sommavano.** `fblChiusuraMinutiLocali()` ripiega su
`LIVE_MT5_CLOSE_MIN = 22*60` quando `fblScartoServerSec` non è noto, e resta ignoto se in quella
sessione il grafico non è passato dallo storico MT5 (es. sorgente Capital.com). Con quella
"chiusura" finta alle 22:00, due confini buttavano via le candele vere:

1. `_fblConfineChiusuraCalcola()` tagliava tutta la coda che l'orario considerava chiusa
   (22:00→22:58), pur essendo candele che MT5 aveva mandato davvero;
2. `fblConfineAutosegui()` congelava la vista sulla stessa soglia, e a schermo restava l'ultima
   candela "aperta" secondo l'orario: le 21:59.

Nessuna delle due guardava i dati realmente ricevuti. È la regola del proprietario violata
(`REGOLE.md` 4: il mercato è chiuso solo quando non arrivano più dati; nessuna ora fissa).

**LA CURA.** Una funzione nuova, `_fblAllargaAllUltimaReale(cap, a, N)`: il confine trovato con
l'orario si sposta avanti finché le candele stanno dentro l'**ultimo tick vero** ricevuto per
quell'asset — oltre quella non c'è mercato, prima di quella non si taglia niente. Se non c'è
nessun tick vero non si sa niente e resta il confine di prima. Usata dalle **due** strade qui
sopra. In più `fblConfineChiusura()` e `fblConfineAutosegui()` non tagliano né congelano quando
`fblAssetRiceveDatiOra(asset)` è vero (i dati stanno arrivando adesso), e la cache del confine
include l'ultimo tick nella chiave, così un tick nuovo si vede subito e non al minuto dopo.

**SECONDO PASSO, dopo la sua osservazione** («non è che non è presente il file, è che non riesce a
scrivere a grafico quelle che sono le candele rimanenti fino all'effettiva chiusura del mercato...
in modalità replay va a ripescare le candele giuste caricate da MT5 fino effettivamente
all'ultima»). Il solo tick non basta: se l'app è appena partita e in quella sessione non è arrivato
nessun tick, il tick non c'è e il taglio restava. Ma **se la sorgente che sta disegnando è MT5, il
file è la sua serie**: un file MT5 non contiene candele che MT5 non ha mandato (le "past-close" le
aggiunge Capital.com). Quindi `_fblAllargaAllUltimaReale` risponde `N` (niente taglio, niente
congelamento) quando `fblSorgenteGrafico()==='mt5'`. Verificato col file che arriva alle **23:50** e
nessun tick: prima 21:59, dopo 23:50.

**PROVA DEL ROSSO.** Banco nuovo `laboratorio/app/chiusura_non_taglia_candele_reali.test.mjs`,
5 prove. Senza la cura: **2 rosse** (ultima candela 20:59 UTC invece di 21:58; controprova sulle
candele oltre l'ultima reale). Con la cura del solo tick: la prova «app appena aperta, nessun tick»
era **rossa** (21:59 invece di 23:50) — è la misura che ha giustificato il secondo passo. Dopo:
**5 verdi**. Restano verdi i banchi `chiusura_ora_del_server`, `candela_viva_dopo_le_22`,
`mercato_dai_dati_mt5`, `mercato_per_asset_dai_dati`, `tick_vecchio_non_e_mercato`,
`scarto_orologio_solo_tick_nuovi`, `buco_grafico_chiuso`, `grafico_mai_vuoto`,
`asse_si_ferma_alla_chiusura`, `chiusura_mercato`, `congelamento_solo_autosegui` (45 prove).


## RISOLTO — 21 novembre 2026, l'orario sbagliato dell'ultima candela (lo scarto -9000)

> «L'ultima candela del terminale e' alle 23:50 del 20/11/2026, mentre sull'app sono le 03:19.
> Questo sull'asset XAU/USD.» — e, prima: «il tempo scorre anche a mercato chiuso».

**MISURATO sul PC del proprietario, non dedotto.** `curl http://127.0.0.1:8001/history?symbol=XAUUSD&timeframe=M1&count=5`
rispondeva `"utc_offset_seconds_applied": -9000`, e il file
`%APPDATA%\ForexBacktestLAB\scarto_server.json` conteneva
`{"Upcomers-Server": {"scarto": -9000, "quando": ...}}`. Nessun broker sta a **-2h30**: ogni candela
usciva spostata di 4 ore e mezza in avanti (lo scarto vero d'inverno e' +7200).

**LA CAUSA VERA.** `_scarto_fresco_da_epoch()` misura `grezzo = epoch_del_tick - adesso`, cioe'
**scarto meno l'eta' del tick**. Con un tick fresco esce lo scarto; con un tick fermo esce un numero
piu' piccolo di qualunque fuso reale. Le guardie non lo fermavano:

- la griglia della mezz'ora lo lasciava passare, perche' **-9000 e' un multiplo tondo di 1800**;
- il tetto di 14 ore non lo toccava;
- la guardia sull'eta' era `abs(grezzo) > 86400`, cioe' **fino a 24 ore**, mentre il commento
  sopra la riga diceva gia' «basta superare i 5 minuti di eta' per non misurare piu' niente di
  vero». Il commento descriveva la cura del 18 ottobre; la riga non la applicava.

Bastava che il servizio misurasse di sabato con il mercato chiuso da 4h30 (7200 - 16200 = -9000)
perche' il numero passasse, e `_ricorda_scarto()` lo scriveva su disco: da li' in poi restava
sbagliato anche dopo il riavvio.

**PERCHE' IN REPLAY ERA GIUSTO.** Il replay non usa l'orologio: legge le candele cosi' come stanno.
Per questo il proprietario vedeva tutte le candele corrette in replay e sbagliate in Live — ed e'
l'indizio che ha portato allo scarto invece che al grafico.

**LA CURA, e vale per qualunque broker senza indovinare il suo fuso.** `_SCARTO_MINIMO_PLAUSIBILE
= -3600`: i server MT5 stanno da UTC+0 in su (EET +2/+3 nella quasi totalita'), quindi un valore
sotto UTC-1 non e' un fuso, e' l'eta' di un tick fermo. Applicata in tre punti e in tutti e due i
file (`mt5_feed_server.py` e `bridge.py`, che hanno la stessa funzione):

1. la misura dal tick si rifiuta sotto quella soglia (al posto delle 24 ore);
2. `_scarto_ricordato()` butta un valore sotto la soglia: **i -9000 gia' sul disco non tornano a
   galla**, non serve cancellare il file a mano;
3. `_ricorda_scarto()` non lo scrive piu'.

Quando non c'e' nessun tick fresco (sabato e domenica) lo scarto viene da
`_scarto_broker_da_calendario()`: UTC+2 d'inverno, UTC+3 con l'ora legale europea, dal calendario e
non da un valore salvato di un'altra stagione.

**LO STESSO DIFETTO ERA ANCHE NELL'APP.** `mt5RegistraOrarioTick()` accettava un tick vecchio fino a
**6 ore** come differenza di orologio. Il servizio manda i tick gia' in UTC (`"time_ms": ... - offset`),
quindi li' non si misura il fuso del broker ma l'orologio del servizio rispetto al dispositivo — e il
servizio gira sullo stesso PC: la differenza vera e' di secondi. Ora il tetto e'
`FBL_MT5_SILENZIO_CHIUSO_MS` (5 minuti), e un tick conta solo se il suo orario e' **piu' nuovo**
dell'ultimo visto (il ponte ripete lo stesso tick a mercato chiuso).

**Prova del rosso:** rimessa la vecchia guardia `abs(grezzo) > 86400` →
`test_tick_vecchio_di_4h30_non_diventa_uno_scarto` rosso; rimessa quella nuova → verde.

**Test:** `laboratorio/ponte/test_scarto_broker_calendario.py` (4 prove: inverno/estate, i due
cambi dell'ora legale, il tick di 4h30, il valore avvelenato sul disco),
`laboratorio/app/scarto_orologio_solo_tick_nuovi.test.mjs` (2 prove),
`laboratorio/app/tick_vecchio_non_e_mercato.test.mjs`.

**CONFERMATO SUL CAMPO (21 novembre 2026, dopo la v2.2.93).** Il proprietario ha aggiornato e
l'ultima candela di XAU/USD e' tornata al 20 novembre: prima diceva 21 nov 03:19. La catena
misurata (scarto -9000 -> 4h30 di spostamento -> 23:50 del broker mostrato come 03:20) e'
quindi chiusa dalla misura **e** dalla prova sul suo PC, non solo dai banchi.

**LEZIONE.** Un commento che descrive una cura non e' la cura. Qui la riga diceva 24 ore e il
commento sopra diceva 5 minuti, per settimane: il collaudo non se ne e' accorto perche' nessuna
prova misurava un tick di poche ore — c'erano quella di 8h20 e quella del tick assente, e il buco
stava giusto in mezzo.

## APERTI — 17 novembre 2026, prop firm chiusa e finestre duplicate

Segnalato dal proprietario. Tre problemi dentro una segnalazione, e il terzo non è un difetto ma
una regola che manca.

> «Quando sono collegato ho delle finestre duplicate e la prop firm mi si chiude perché non sono
> riuscito a superarla, mi esce fuori il pop-up su tutte e tre le pagine, mentre invece mi deve
> uscire soltanto sulla pagina madre se chiudo il conto per aver violato una regola della prop
> firm. E quando premo il pulsante e ricomincia da capo, succede che sulle pagine duplicate
> qualche pasticcio. […] se gli dico che continuo a utilizzare questo conto come modalità di
> esercitazione non me lo fa più utilizzare, perché effettivamente quel conto è chiuso per sempre
> e ne devo creare per forza un altro. Quindi ci deve essere un sistema che sappia riconoscere
> qual è effettivamente quello che è un conto vero prop firm e uno finto. Per dirti, se apro un
> conto demo da MetaQuotes e ci applico sopra quella che è una modalità prop firm, allora lì sì,
> posso anche continuare a esercitarmi, ma se è un conto invece di una prop firm reale oppure una
> prop firm trial, non posso continuare perché proprio appunto è bloccato.»

1. **IL POPUP DI VIOLAZIONE ESCE SU TUTTE LE FINESTRE.** Deve uscire **solo sulla pagina madre**.
   LETTO NEL SORGENTE (17 novembre, da misurare con un banco): `showPropFirmViolationOverlay()`
   (`app.html` ~riga 7401) **non ha nessun guard `PIP_SLOT`** — nessuna delle due funzioni della
   catena ce l'ha. E chi la chiama è il controllo dell'equity (`triggerPropFirmViolation`, chiamata
   da ~7260, ~7264, ~7321, ~7325), che gira in **ogni** finestra che ha i dati del conto: quindi
   ogni finestra registra la violazione per conto suo e si apre il suo overlay. Nel progetto esiste
   già il modo giusto di fare questa cosa (`anotherWindowOwnsAssetEvaluation`, e i guard
   `if(PIP_SLOT>0)return` sulle scritture): la strada è quella, non una nuova.
2. **IL PULSANTE «RICOMINCIA» FA PASTICCI SULLE DUPLICATE.** Da misurare: cosa succede alle
   duplicate quando la madre riparte (`restartPropFirmChallenge` ~7459 → `openPropFirmCapitalModal`
   → `startNewPropFirmChallenge`). Sospetto da verificare, non ancora misurato: le duplicate non
   sanno che la sfida è ripartita, quindi restano col vecchio capitale iniziale e la vecchia
   violazione in memoria. Serve un annuncio fra finestre, come già si fa per il conto e per il
   replay.
3. **PROP FIRM VERA O ESERCITAZIONE: l'app non lo sa distinguere, e la differenza è sostanziale.**
   Dopo una violazione l'app offre due strade (`fblPropContoScegli`, ~7993): `'pratica'` (il conto
   resta usabile per esercitarsi, la prop firm si spegne) e `'elimina'` (si archivia). La strada
   `'pratica'` **ha senso solo su un conto che il broker lascia vivo**: su una prop firm vera — o
   su un suo trial — il conto è **chiuso per sempre** e l'utente deve crearne un altro, quindi
   offrirgli «continua a esercitarti qui» è una strada che non esiste.
   **PERCHE' LA DISTINZIONE DI OGGI NON BASTA:** esiste già il caso del conto reale
   (`restartPropFirmChallenge` ~7461: se `propFirmViolation.realMt5Login != null` si mostra
   `showPfMt5IneligibleModal` invece del capitale da scegliere) — ma **un trial FTMO è
   tecnicamente un conto DEMO** (`trade_mode` 0), quindi quella strada non scatta e il conto
   finisce trattato come un demo qualunque. Demo-contro-reale **non** è la domanda giusta: la
   domanda è **di chi è il conto**.
   **COSA L'APP SA OGGI, misurato:** il ponte restituisce `server` e `server_mt5` (`bridge.py`
   ~3514-3515, ~3611) e `trade_mode`/`reale`. **Non restituisce `company`**, cioè il nome del
   broker che MT5 pubblica in `account_info()`, ed è il dato che distinguerebbe «FTMO S.R.O.» da
   «MetaQuotes Software Corp.»: `grep -c company app.html` → **0**. Il dato esiste in MT5 e non
   viene chiesto.
   **STRADA PROPOSTA (da confermare col proprietario prima di scrivere codice):** non una lista di
   prop firm incollata nel codice, che invecchia e sbaglia. La domanda «questo conto è una prop
   firm?» **si fa già una volta per conto** (`fblPropAttivazioneDaChiedere`, `propChiesto`): la si
   rende a **tre** risposte invece di due — prop firm vera / prop firm di prova (trial) /
   esercitazione mia su un conto demo — si ricorda per `login@server`, e la strada `'pratica'` si
   offre **solo** alla terza. In più una rete di sicurezza dal `company`/`server` (da esporre nel
   ponte): se il broker è riconosciuto come prop firm, «esercitazione» non si può scegliere, e se
   `trade_mode == 2` il conto è soldi veri comunque. Vale la regola del dubbio già in uso nel
   progetto: se non si sa, si tratta come vera.

4. **CHIUDENDO UN CONTO PROP FIRM, LE DUPLICATE SI AZZERANO.** Segnalato lo stesso giorno:

   > «quando si chiude quello che è un conto prop firm, quelle che sono le impostazioni delle
   > pagine duplicate si resettano completamente, si resettano anche quelli che sono gli
   > indicatori e questo non va bene, perché non posso stare a ripristinare sempre quelli che
   > sono gli indicatori alla chiusura di un conto. Quindi quelli rimangono sulle pagine
   > duplicate.»

   Le impostazioni delle duplicate — **indicatori compresi** — devono restare dove sono. Da
   misurare: cosa esattamente viene azzerato e da quale strada.
5. **UN CONTO AGGIUNTO IN UNA FINESTRA DEVE COMPARIRE ANCHE NELLE ALTRE.** Segnalato come «molto
   importante»:

   > «se nelle impostazioni della pagina madre, oppure nelle impostazioni delle pagine duplicate,
   > vado ad aggiungere un nuovo conto, dopo si spalma su tutti quanti le finestre che sono
   > presenti.»

   **ATTENZIONE, QUESTA VOCE ERA STATA CAPITA AL ROVESCIO** (corretto il 17 novembre 2026, su
   chiarimento del proprietario). «Si spalma» era stato letto come una lamentela — «si spalma e
   non deve» — e per due commit la voce ha detto il contrario di quello che serviva, portandosi
   dietro anche l'ipotesi del punto 6. Parole sue nel chiarimento:

   > «Semplicemente se aggiungo un nuovo conto mi si deve aprire anche sulle altre finestre
   > visibili e non solo su quella dove l'ho aggiunto da impostazioni.»

   Quindi **è una richiesta, non un difetto da togliere**: oggi il conto nuovo compare solo nella
   finestra dove lo aggiungi, e deve comparire in tutte quelle aperte. Lezione di metodo: una
   parola come «si spalma» non dice da sola se chi parla la vuole o no, e indovinarlo e' costato
   due commit e un'ipotesi sbagliata. **Si chiede.**

6. **L'IPOTESI CHE TIENE INSIEME I PUNTI 2, 4 E 5 — da misurare, non da dare per buona.**
   Tre sintomi **opposti**: una cosa che dovrebbe restare locale si spalma (punto 5), e due che
   dovrebbero restare si azzerano (punti 4 e 2). Tutti e tre puntano allo stesso meccanismo: il
   trasporto dello stato fra finestre che **sostituisce in blocco** invece di fondere.
   È esattamente il punto di una trappola già pagata e documentata in
   `cervello/PROGETTO-COPIA-IMPOSTAZIONI-CONTI.md`: il **13 novembre 2026** si è misurato che
   `sessionByMode` non contiene solo impostazioni ma anche i **disegni** e il **capitale**, e che
   il trasporto fra finestre (`if(msg.sessionByMode)sessionByMode=msg.sessionByMode`) sostituiva
   in blocco: una duplicata appena nata, che di disegni non ne aveva, **cancellava quelli della
   madre**, e la madre (slot 0) poi li persisteva su disco. Quella riga ora fonde. Il sospetto è
   che altri campi facciano ancora il giro vecchio.
   **LA MISURA, ed è una sola per tutti e tre:** elencare quali campi viaggiano fra finestre e,
   per ognuno, dire se è un'impostazione di QUELLA finestra, un dato del conto, o roba condivisa.
   Se l'ipotesi regge, i punti 2, 4 e 5 sono **una cura sola invece di tre**. Se non regge, lo si
   scopre prima di aver scritto tre cure sbagliate.

7. **SUL GRAFICO SI VEDONO LE POSIZIONI DI TUTTI I CONTI, non solo di quello selezionato.**
   Segnalato il 17 novembre:

   > «quando cambio conto ancora visualizzo le posizioni al grafico degli altri conti. Cioè io in
   > poche parole vedo tutte, non solo di un altro conto, ma di tutti i conti che sono stati
   > aggiunti. Invece no, io devo vedere soltanto la cronostoria sul grafico delle posizioni
   > soltanto del conto selezionato al momento […] deve funzionare come su MT5 sul terminale.»

   **CAUSA TROVATA, ed è una riga sola** (`positionBelongsToCurrentView`, `app.html` ~15230):
   ```js
   const loginNoto=currentMt5AccountTag().mt5Login;
   if(loginNoto)return pos.mt5Ticket!=null&&(pos.mt5Login==null||String(pos.mt5Login)===loginNoto);
   ```
   Una posizione passa se ha il login del conto attivo **oppure se non ha login affatto**. Quel
   secondo ramo è il difetto: una posizione **senza targhetta** compare su **ogni** conto.
   Confermato dal collaudo del 17 novembre, che fra gli avvisi stampa
   `posizioni viste = {"conLogin":true,"altroLogin":false,"senzaLogin":true,"simulata":false}`:
   `senzaLogin:true` vuol dire che le posizioni senza conto addosso **si vedono**.

   **PERCHE' QUEL RAMO C'E', e perché non va solo stretto** (altrimenti si rompe quello che
   proteggeva): il commento sopra quella riga e la consegna del 5 novembre raccontano il problema
   opposto, già pagato — un ordine reale **senza** `mt5Login` restava **nascosto** quando un login
   era noto (misurato allora: `senzaLogin:false`), e le linee entrata/TP/SL degli ordini pendenti
   non si vedevano. Il ramo è stato allargato per quello. Stringerlo e basta riporta indietro quel
   difetto.

   **LA STRADA GIUSTA, da confermare misurando:** non decidere *in fase di disegno* cosa fare di
   una posizione senza targhetta, ma **non lasciarla senza targhetta**. Il ponte sa da quale conto
   arriva una posizione — la espone perfino come intestazione (`X-MT5-Server`,
   `bridge.py` ~4107) — quindi la targhetta si scrive **quando la posizione si legge**, e il
   filtro può tornare stretto senza nascondere niente. Da tenere distinti due casi che oggi
   finiscono nello stesso ramo:
   - `mt5Ticket == null` → **non è una posizione MT5** (simulata, backtest in Live): non c'entra
     coi conti e si vede sempre. Una cura dell'11 novembre è già stata annullata per questo: vedi
     il commento, aggiungere `mt5Ticket!=null` nel ramo «conto ignoto» aveva fatto sparire le
     posizioni simulate e reso rossi cinque banchi.
   - `mt5Ticket != null && mt5Login == null` → **è una posizione MT5 che ha perso il conto**:
     questa va attribuita, non mostrata a tutti.

   **Banchi già esistenti su questa zona**, da rileggere prima di toccare (e da tenere verdi):
   `posizioni_un_solo_conto`, `conto_non_si_mischia`, `conto_al_salto`, `anagrafica_posizione`,
   più i cinque citati nel commento (`mercato_chiuso`, `mt5_evidenzia_posizione`, `v138`,
   `tosto_be_posizioni`, `replay_live`).

**Stato:** niente curato, niente banco. Il punto 1 ha la causa letta nel sorgente (manca il
guard), i punti 2, 4 e 5 sono sintomi da misurare con l'ipotesi del punto 6, il 3 è una decisione
di disegno da prendere col proprietario, e il 7 ha la riga esatta ma **non** la cura, perché
stringere quel ramo senza prima scrivere la targhetta alla fonte riporta indietro un difetto già
pagato. **Ordine:** il 3 va prima del 2, perché decide cosa deve fare il pulsante; la misura del 6
va prima di 2, 4 e 5, perché potrebbe unificarli; il 7 è indipendente dagli altri e si può fare
quando si vuole.

## 17-18 novembre 2026 — quattro segnalazioni nuove (da fare DOPO, indicazione del proprietario)

1. **IL GRAFICO SI PIANTA ALLE 22, MA TUTTO IL RESTO VA.** «quando arrivano le 22, il grafico, per
   esempio, dell'asset XAUUSD si pianta, mentre invece il terminale MT5 continua ad andare, ad
   aggiornare le candele... se io vado sulla tabella delle posizioni aperte, lui mi mostra quello
   che è il P/L live. L'aggiornamento lo vede. Vede anche quello che è il prezzo corrente. Mi
   calcola tutto, tranne quello che è la scrittura della candela a grafico.» **Vale per tutti gli
   asset, nessuno escluso.**
   **La diagnosi è quasi fatta e viene da lui:** se il prezzo corrente arriva e il P/L live si
   aggiorna, la catena del tick funziona — si ferma solo chi SCRIVE la candela. Da misurare: che
   cosa, alle 22, smette di far entrare il tick nella candela (il pennello dei 250 ms? un confine
   di sessione? un tetto del calendario?) mentre `currentPrice()` continua a rispondere. **Non si
   cura prima di sapere quale dei tre.**
2. **I MODELLI «SALVA COME» DEVONO ESSERE PER CLASSE.** «se io vado a salvare quello che è il
   modello Fibonacci, non mi può far vedere quelli che sono i modelli, per esempio, delle linee o
   dei rettangoli... E deve essere anche distinto con il modello delle impostazioni del profilo del
   volume, sia a intervallo fisso che profilo volumetrico ancorato, e anche il VWAP. Quindi ognuno
   ha una sua classe di appartenenza.» Oggi l'elenco dei nomi già usati mescola due famiglie
   (disegno generico e Fibonacci) **per scelta dichiarata** nel banco `nomi_modelli_disegni`
   («due famiglie, un nome solo»): va rifatto per classe, e le classi sono almeno cinque — linee e
   rettangoli, Fibonacci, profilo volumetrico a intervallo fisso, profilo volumetrico ancorato,
   VWAP.
   **E ANCORA NON SALVA:** «non riesce a salvarmi quello che è praticamente il modello del
   Fibonacci o di una linea o del profilo volumetrico, e non mi salva nemmeno le impostazioni degli
   indicatori». È il problema messo in attesa, di cui la v2.2.65 ha tolto il silenzio: alla prima
   occasione **serve la riga di stato** dopo un salvataggio fallito, che ora dice quanti MB sono
   occupati su quanti.
3. **SU MOBILE «AGGIORNA» DEVE INSTALLARE DA SÉ.** «oggi il PC non è che va a scaricare un nuovo
   pacchetto di installazione, lo installa già lui da solo automaticamente... Deve fare la stessa
   identica cosa anche sui dispositivi mobili. Perché oggi quello che fa è che mi scarica il
   download del pacchetto di installazione APK e poi io manualmente lo devo andare a installare.»
4. **LA DOMANDA SULLA PROP FIRM RITORNA A OGNI RIAPERTURA.** «succede ogni volta che chiudo
   l'applicazione e la riapro, mi fa sempre la stessa identica domanda. Deve esserci un qualcosa
   che salva, gli viene attribuita a quello che è un ID. Almeno lui sa che quel conto è stato
   attribuito a una scelta e non mi fa più la domanda. A un nuovo conto, ovviamente, quando viene
   aggiunto non ha l'ID e quindi mi fa la domanda.» Era già la voce A4 della consegna del 15
   novembre («non riproducibile sul banco»), ma **adesso c'è il disegno**: la risposta si lega a un
   ID del conto. Il meccanismo esiste già (`propChiesto` per `login@server`): da misurare perché
   non regge alla riapertura — si salva e non si rilegge, o si rilegge con una chiave diversa?

**NOTA DI METODO, dallo stesso giro:** nel banco `replay_fra_finestre` un difetto stava **nascosto
dietro un'altra assertion**. La prova si fermava sulla prima (quella superata dalla richiesta nuova)
e non arrivava mai alla seconda, che misurava una cosa ancora rotta. Capovolgendo la prima è
comparsa la seconda. **Una prova rossa può nasconderne un'altra**, e il conto delle rosse non è il
conto dei difetti.
**DA FARE, piccolo:** un banco per il caso «una finestra che NON partecipa al replay non deve farsi
spostare il tempo dall'uscita di un replay altrui». La guardia esiste in `esciReplayLive`
(`if(!era)`), ma nella scena di `replay_fra_finestre` tutte le finestre partecipano, quindi lì non
si può più misurare.

## 17 novembre 2026 — ZOOM OUT IN LIVE: il grafico si ferma sempre allo stesso giorno

Segnalato dal proprietario, **da affrontare dopo** (sua indicazione esplicita):

> «se facciamo un zoom out del grafico in modalita live, quindi a mercato aperto, non so come mai
> mi faccia vedere soltanto quella che e' una sezione e basta del grafico. Si ferma a un
> determinato giorno che e' verso marzo, i primi di marzo, e non mi fa vedere quello che precede
> marzo. Quindi e' come se ci fosse una limitazione di caricamento dei dati al grafico. [...] E
> questo succede con tutti i time frame. Quindi non e' un problema di time frame, ma e' un
> problema proprio di caricamento di dati. Si ferma sempre allo stesso giorno in tutti i time
> frame, partendo da un minuto a una settimana.»

**IPOTESI, con la verifica di struttura già fatta (17 novembre) — non ancora misurata sul suo
grafico.** «Lo stesso giorno in TUTTI i time frame» e' la firma di un limite sulla serie di BASE,
non sui time frame: `getFullAgg(minutes)` aggrega ogni time frame da `baseRows`
(`if(cached && cached.ref===baseRows)`), quindi tutte le viste nascono dalla stessa serie e un
tetto su quella le ferma tutte nello stesso punto. Il candidato e' il `count` dello scarico da
`/history`, che nel codice compare 19 volte come `200000`: duecentomila candele da un minuto sono
circa **139 giorni di calendario**, e scontando i fine settimana si va intorno ai **194 giorni**
— cioe' da meta' novembre si arriva a maggio/marzo, l'ordine di grandezza giusto.

**COSA MISURARE PRIMA DI CURARE, in quest'ordine:** (1) quante candele ha davvero `baseRows` sul
suo grafico e qual e' la data della prima; (2) se quel numero e' esattamente il tetto o il massimo
che MT5 restituisce per quel simbolo (sono due cause diverse: una e' nostra, l'altra e' del
broker); (3) se il magazzino locale delle candele (IndexedDB) tronca a sua volta. **Non si cura
alzando il numero a caso:** 200000 candele da un minuto sono gia' ~5 MB per asset, e il magazzino
cresce senza tetto (voce 5.2 della scaletta) — la strada probabile e' chiedere lo storico lontano
al time frame che serve invece di aggregarlo tutto dal minuto.

## 17 novembre 2026 — MISURA: perché le duplicate «si resettano». E l'ipotesi che le unificava era METÀ sbagliata

Misurato il canale fra finestre (`collectTradingSyncPayload` / `fblApplicaStatoTrading`) per
decidere se i punti 2 (pulsante «ricomincia»), 4 (duplicate che si azzerano) e 5 (conto che si
spalma) fossero **una cura sola o tre**. Risposta: **due e una, non tre e non una.**

### I punti 2 e 4 sono lo stesso difetto, e la causa è verificata

`collectTradingSyncPayload` manda `isPropFirmMode`, e chi riceve lo applica **senza nessuna
guardia**:

```js
if(msg.isPropFirmMode!=null)isPropFirmMode=!!msg.isPropFirmMode;
```

Nella stessa funzione `trades` ed `equity` sono protetti da `_stessoContoMt5`; questo no.
E poi:

```js
function currentMode(){
  const base=liveModeActive?'live':'backtest';
  return isPropFirmMode?(base+'_propfirm'):base;
}
let indicatorsByMode={backtest:null,live:null,backtest_propfirm:null,live_propfirm:null};
```

**Gli indicatori sono archiviati PER MODALITÀ.** Quindi quando la prop firm si chiude o riparte
sulla madre, l'interruttore si propaga a ogni duplicata, la loro `currentMode()` passa da
`live_propfirm` a `live`, e loro mostrano gli indicatori **dell'altro cassetto** — vuoto se non
l'hanno mai configurato.

**Gli indicatori non si resettano: sono nell'altro cassetto.** È la stessa forma del problema dei
modelli dei disegni (3.2 della scaletta): non una perdita, una chiave che cambia sotto.

**LA CURA È UNA DECISIONE, non un difetto da raddrizzare**, e va chiesta al proprietario:
- **A** — le duplicate NON seguono la prop firm della madre: ogni finestra tiene la sua modalità.
  Semplice, ma allora due finestre dello stesso conto possono trovarsi in modalità diverse;
- **B** — la seguono, ma gli indicatori smettono di essere per modalità (uno solo per asset).
  Risolve anche il «perdo gli indicatori» in altri casi, e tocca un archivio che esiste da mesi;
- **C** — la seguono, e al cambio di modalità gli indicatori si portano dietro. Il più gentile,
  il più lavoro.

### Il punto 5 è un'altra cosa — e la mia lettura era al rovescio

**Scritto prima:** «il conto che si spalma è un'altra cosa, e c'è un conflitto da sciogliere».
**Sbagliato.** Chiarito dal proprietario: lui **vuole** che si spalmi, e oggi non lo fa. Non c'è
nessun conflitto con la richiesta del 10 novembre sulla propagazione del conto attivo: sono due
cose che vanno nella stessa direzione.

**LA CAUSA, misurata.** `mt5SavedAccounts` è una **cache in memoria** della cartella delle
credenziali (`let mt5SavedAccounts=[]; // cache della lista di conti letta dalla cartella`).
Aggiungendo un conto si aggiorna **solo la cache di quella finestra**
(`mt5SavedAccounts=await upsertMt5AccountInHandle(handle,creds)`): la cartella su disco è una
sola e condivisa, ma le altre finestre tengono la loro copia vecchia finché non rileggono. Quindi
il conto nuovo non compare, e l'elenco dei conti non viaggia sul canale fra finestre
(`collectTradingSyncPayload` non lo manda).

**LA CURA:** annunciare sul canale fra finestre che l'elenco è cambiato, così le altre rileggono
e ridisegnano. Non si manda l'elenco — dentro ci sono le **credenziali**, e quelle non viaggiano
mai, nemmeno fra due finestre della stessa macchina: si manda solo «rileggi».

## CHIUSO il 18 novembre 2026 (v2.2.72) — SUONO DOPPIO: curate apertura E chiusura

La strada mancante della chiusura e' stata trovata misurando, come la nota qui sotto chiedeva: il
giro delle chiusure vere () decideva se tacere con
, che e' un insieme **di pagina**. Con due finestre entrambe avevano visto
il ticket aperto, quindi entrambe annunciavano. E il doppione DENTRO la madre veniva dalle due
strade che annunciano la stessa chiusura, senza coordinamento.

Cura: , una prenotazione condivisa su localStorage (per ticket e per
tipo, vita 20 s) al posto del battito di presenza, che dipendeva dai tempi - ed e' il motivo per
cui la stessa prova passava in locale e cadeva su GitHub. Le due misure sono state capovolte in
attese: la duplicata tace, una chiusura fa un suono. Banco verde 5 su 5.

### La nota del 17 novembre, come era (resta per la storia)

Il banco da 483 righe scritto il 16 novembre e mai eseguito è stato **salvato dal `%TEMP%`**
(ora `laboratorio/app/suono_e_sfarfallio_duplicate.test.mjs`) e **lanciato per la prima volta**.

**Una sua prova di controllo era sbagliata**, ed è il motivo per cui valeva la pena lanciarlo
invece di fidarsi: adottava **due** posizioni in un colpo solo e poi pretendeva **un** suono.
Letta di fretta diceva «il suono raddoppia anche con una finestra sola», che avrebbe mandato la
diagnosi dalla parte opposta a quella giusta. Corretta: una posizione per volta.

**CURATO — l'APERTURA.** Misurato prima: «Madre 1 + duplicata 1 = 2». Ogni finestra suonava per
conto suo. Due famiglie di suoni, e solo una andava toccata: quelli che la finestra ha **causato**
(l'ordine che hai eseguito lì) devono suonare sempre; quelli **osservati** da MT5 li vedono tutte
le finestre. Guardati i tre siti osservati con `fblSuonoDaMt5SpettaAMe()`, che riusa il **battito**
di presenza — non un elenco di finestre, perché un elenco che non si svuota lascerebbe una madre
**chiusa** a zittire per sempre le sue duplicate (lezione già scritta a `app.html` ~42517).
Dopo: madre 1, duplicata 0.

**NON CURATO — la CHIUSURA**, e sono due difetti distinti:
1. **la duplicata suona ancora una volta** per una chiusura vista su MT5. La strada non è nessuna
   delle tre guardate (il giro degli avvisi, il giro dei sospetti, l'adozione nelle posizioni):
   **va trovata misurando**, non per esclusione. Candidato da verificare: `closeTrade()`
   (`app.html` ~30045, `if(!silent)playOrderSound()`), chiamata da qualche percorso che reagisce
   alla sparizione del ticket.
2. **la madre annuncia la stessa chiusura due volte** su sei giri in cui il ticket non c'è più.
   Per le APERTURE esiste già il coordinamento fra le due strade (`fblMt5Annunciato`); per le
   chiusure non c'è.

**STATO DEL BANCO: 5 verdi su 5, e dice la verità.** Due prove affermano quello che è curato, due
sono etichettate **«MISURA, NON ATTESA»** e fissano i numeri di oggi (duplicata 1, chiusure 2):
se quei numeri cambiano, la causa è cambiata e va rimisurata. Scritte come misure e non come
attese perché un banco rosso lasciato in piedi blocca il collaudo e quindi ogni pubblicazione,
mentre un banco cancellato perde la misura. Quando saranno curate, tornano `=== 1` e `=== 0`.

**LO SFARFALLIO NON SI RIPRODUCE.** Le prove sulle linee che lampeggiano — ricomparse dopo la
sparizione, righe di prezzo ridipinte — sono **verdi**. O è già curato, o sul banco non si vede e
serve il PC del proprietario.

## APERTI — 16 novembre 2026, finestre duplicate (da misurare, non ancora curbati)

Due sintomi, segnalati insieme dal proprietario con le finestre duplicate:

> «e ancora avviene quello che è il doppio/triplo suono dell'esecuzione / chiusura della posizione
> con le pagine duplicate e quando avviene la chiusura o l'apertura della posizione tra le finestre
> duplicate avviene uno sfarfallio della chiusura della posizione a grafico con le linee tp-sl-entry
> che lampeggiano diverse volte prima di andarsene per le posizioni chiuse mentre per le posizioni
> aperte rimanere fisse e stabili.»

1. **IL SUONO PARTE DUE O TRE VOLTE** all'apertura/chiusura di una posizione quando ci sono finestre
   duplicate. Ipotesi da misurare: ogni finestra suona per conto suo, oppure il suono è agganciato alla
   *ricezione* del messaggio `trading_sync` invece che al *cambiamento* della posizione, quindi con
   tre finestre il messaggio arriva due volte e suona due volte. Le strade candidate: suona solo lo
   slot più basso (come già fa `anotherWindowOwnsAssetEvaluation`), oppure il suono si aggancia a un
   dato che cambia **una volta**. (Precedente utile: la cura del 12 novembre v2.2.37 che aveva già
   dovuto chiudere un «suono di benvenuto che si sentiva una volta per ogni finestra aperta».)
2. **LE LINEE DELLA POSIZIONE CHIUSA LAMPEGGIANO** (entry, TP, SL) diverse volte prima di sparire,
   mentre le posizioni aperte restano fisse. Ipotesi da misurare: la posizione chiusa resta in una
   lista attiva mentre esce da un'altra (o rientra dal messaggio dell'altra finestra), quindi viene
   ridisegnata per alcuni giri prima di essere tolta. Misurare quanti giri passano in mezzo.
   Sono due sintomi con una causa sola o due? Da dire esplicitamente.

**Stato:** causa misurata leggendo il sorgente (16 novembre 2026), banco scritto e non eseguito
(`%TEMP%\opencode\banco_suono_sfarfallio.test.mjs`, 483 righe, prova di controllo e autocontrolli
anti-banco-muto inclusi). **L'ipotesi «il suono è agganciato alla ricezione di `trading_sync» è
FALSA**: `fblApplicaStatoTrading()` (riga 55353) non chiama `playOrderSound`. La causa vera è un'altra
e una sola per i tre sintomi (suono doppio, sfarfallio, riga doppia nel Journal):

**CAUSA: ogni finestra interroga il ponte per conto proprio e giudica la fotografia per conto proprio.**
`startMt5PositionsPolling()` (riga 48565) con `mt5PositionsPollTimer=setInterval(...,1000)` (48572)
è una variabile di pagina, quindi **una per finestra**; il detector suona a **47961** (apertura) e a
**47808-47809 → 29673** (chiusura). Le difese `mt5SoundSeenOpenTickets` (29408) e `fblMt5Annunciati`
(29448) sono **di pagina**: con due finestre lo stesso ticket viene visto da due detector indipendenti
→ due suoni, due righe nel Journal. Lo sfarfallio è lo stesso meccanismo con un effetto visivo:
`fblApplicaStatoTrading()` sostituisce la lista in blocco (**55404**) e ogni messaggio ridisegna
(**9756**), mentre il guardiano del tempo (**9711**) confronta l'orologio e non il contenuto; la
posizione chiusa **rientra** perché l'altra finestra la vede ancora (ri-adozione **47931-47957**).
Il lampo non è un numero fisso: dura quanto il disaccordo, tipicamente **2-4 giri**.

**CURA DECISA dal proprietario (16 novembre 2026)**: la **madre** è l'autorità, le duplicate
**ereditano** e non rilevano. Concretamente: il detector (apertura/chiusura, suono, Journal) gira
**solo nella madre**; le duplicate ricevono lo stato dal canale `trading_sync` **in silenzioso** e non
riaprono niente. Chiude tutti e tre gli effetti con una regola sola. La strada preferita fra quelle
proposte dall'indagine è la (b) con la variante profonda: `fblMt5Annunciati` deve viaggiare nel
messaggio invece di essere riscritto nei diciannove chiamanti (stessa reg già applicata il 12 novembre
a `fblPropContoStatoSalva`). Costa di più — tocca `initExtraPipWindow`, l'idea che le duplicate siano
copie complete — e va misurata: è esattamente ciò che misura il banco.

3. **GLI ISTOGRAMMI DEL PROFILO VOLUMETRICO SI ADATTANO AL TIME FRAME** invece di restare su base
   1 minuto.
   > «gli istogrammi del profilo volumetrico non mantengono il numero e le dimensioni fisse del time
   > frame a 1 minuto quando cambiamo time frame più alti, se siamo a time frame 5 minuti dobbiamo
   > sempre vedere l'istogramma generato e in evoluzione del time frame da 1 minuto sempre! non si
   > deve regolare al cambio time frame ma il numero delle barre rimane sempre lo stesso identico.»

   **CHIARIMENTO DEL PROPRIETARIO (16 novembre 2026), da non sbagliare più:**
   > «la regola riguarda solo gli istogrammi dei profili volumetrici e non riguarda il footprint, io
   > non ho mai accennato il footprint, del footprint non va modificato assolutamente nulla»

   Quindi: **il footprint è fuori da questa voce.** `footprintBucketStart`, `_footprintEntries`,
   `__footprintRebuildBuckets` e tutto il resto del footprint **non si toccano**. La prima indagine
   aveva preso quella strada (passo `(currentTF||1)*60000`) e misurava la cosa sbagliata: era il
   footprint, non i profili. Non ripetere quell'errore.

   **MISURATO leggendo il sorgente (16 novembre 2026), sul profilo volumetrico vero.**
   Il profilo degli indicatori e quello disegnato a mano passano dalla stessa funzione:
   `computeVolumeProfile(startIdx,endIdx,buckets)` (~14442, con `_computeVolumeProfileUncached` ~14453)
   distribuisce il volume delle candele `rows[startIdx..endIdx]`. `rows` è l'array del **time frame
   corrente**: a 5m sono candele da 5 minuti, a 1H da un'ora. Il range lo risolve
   `vpFixedResolveRange(d,fullTs,idxLive,rowsLen)` (~14346), che lavora anch'esso in indici del TF
   corrente. Conseguenza: a 5m l'istogramma **non** è quello generato al minuto — si aggiorna ogni 5
   minuti, non ogni minuto, e la sua forma viene da 5 volte meno candele. È il sintomo descritto
   («l'istogramma generato e in evoluzione del time frame da 1 minuto sempre»).
   Le **fasce** di prezzo invece non dipendono dal TF: misurato prima (v2.0.84, banco
   `profilo_barre_timeframe.test.mjs`), restano 300 a 1, 5 e 15 minuti. Quindi la richiesta nuova è
   **la sorgente del volume**: M1 sempre, qualunque sia il TF del grafico.

   **Da misurare prima di curare** (non ancora fatto, e non va indovinato):
   1. se le candele M1 sono già in memoria quando il grafico è a 5m/15m/1H senza dover chiedere al
      server (`__candCache`, `fblCandeleCacheLeggi`, `assetCandles`), e con quale chiave;
   2. come si traduce l'intervallo di tempo del profilo in indici M1 (`rowIndexNearTime` lavora sui
      `rows` correnti: serve la stessa ricerca sull'array M1);
   3. cosa succede nei due modi di ancoraggio (`tieni fermo il tempo` / `il numero di candele`) e in
      replay, dove le M1 devono essere allineate all'istante del replay e non a adesso;
   4. il costo: 1H su 720 minuti = 720 candele M1 contro 12 da 1H (60×). La cache
      `_vpProfileCache` (~14441) è già per array `rows`, quindi va adattata o il profilo M1 va
      calcolato una volta per ridisegno.

   Banco da scrivere (dentro il repo, `laboratorio/app/`): misurare su 1m/5m/15m/1H (a) che l'ultima
   fascia si muova **ogni minuto** anche a 5m e a 1H, (b) che il numero delle fasce resti lo stesso,
   (c) che a 1m nulla cambi rispetto a oggi, (d) che il footprint resti **identico** (controllo che
   nessuno lo tocchi).

   **CURATO il 17 novembre 2026 (v2.2.61).** La strada scelta è la seconda: **il profilo si calcola
   sempre sulle candele a un minuto**. Misura fatta prima di curare, stessa finestra di 300 minuti e
   stessi dati, con lo **stesso zoom** (altrimenti si confrontano due cose diverse): le barre a 5
   minuti differivano da quelle a 1 minuto in media di **20,2 px** (peggiore 64,6), a 15 minuti di
   **20,8 px** (peggiore 45,6) — e senza equalizzare lo zoom la differenza arrivava a 53 e 222 px.
   Dopo la cura, sugli stessi numeri: **0,0 px** a 5 e a 15 minuti, fasce sempre 120.
   Come: `fblSerieM1PerProfilo()` tiene una serie a un minuto per asset (dal magazzino IndexedDB
   `fblCandeleCacheLeggi(asset,1)`, altrimenti da `/history?timeframe=M1&count=20000`), e
   `computeVolumeProfile`/`vpFixedResolveRange`/`lvnTouchIndex`/`developingLevels` accettano ora una
   serie facoltativa (senza, si comportano **esattamente** come prima). Il "numero di candele" resta
   quello del grafico: N candele del time frame = N×TF candele da un minuto, cioè lo stesso arco di
   tempo di prima. Se la serie M1 non c'è, o il profilo comincia prima dei dati che ho, si torna al
   time frame del grafico: mezzo profilo al minuto e mezzo no sarebbe peggio.
   Il **footprint non è stato toccato**: nessuna sua funzione è cambiata (controllo nel banco:
   `footprint_scala_unica` e `footprint_blocchi` verdi dopo la cura).
   Banco: `laboratorio/app/profilo_sempre_minuto.test.mjs` — 2 prove, di cui una **di controllo**
   che spegne apposta la serie M1 e pretende che le differenze tornino (20,2 px), perché un banco
   che passa perché non disegna niente sarebbe indistinguibile da uno che passa perché è giusto.

5. **APRE PIÙ POSIZIONI DI QUANTE IL SEGNALE NE CHIEDA** (soldi veri: priorità massima).
   > «apre più posizioni del dovuto rispetto a quello che dice il segnale del numero delle posizioni.
   > Deve aprire lo stesso numero di posizioni per il numero di TP mai di più.»

   **Fatto misurato dalle sue due foto (16 novembre 2026).** Il segnale dichiara 4 TP (Entry
   3875-3880, SL 3890, TP1 3870, TP2 3865, TP3 3860, TP4 3855) e il pannello del segnale conferma:
   «4 posizioni da 0.01 lot su MT5». Quindi **una posizione per TP è la regola giusta e va tenuta**:
   il difetto non è nel conteggio per TP, è **nella ripetizione** (nello stesso momento a grafico
   risultavano più di 4 SELL da 0.01, e due linee di SL, una «manuale»). Ipotesi da misurare:
   riprova dopo un ordine non confermato, rivalutazione a ogni tick quando il prezzo entra nella
   fascia, finestre duplicate che applicano lo stesso segnale per conto, «Rimetti fra i nuvovi»,
   ripristino dopo ricarica, o lo stesso messaggio arrivato due volte.
   **Regola del proprietario, da rispettare alla lettera**: numero di posizioni = numero dei TP,
   **mai di più**.

   **CAUSA CONFERMATA DAL PROPRIETARIO (16 novembre 2026), con numero**: «ahhh ecco perché viene
   aperto più volte, avevo 2 finestre duplicate e quindi ha aperto x3 volte». Quindi **ogni finestra
   applica il segnale per conto suo**: madre + 2 duplicate = 3 aperture dello stesso segnale, 3 × 4
   posizioni = 12 invece di 4.
   **MISURATO leggendo il sorgente (16 novembre 2026), con le righe.**
   La catena: messaggio → `tgMessaggioSegnali` (**38501**) → `tgAutoInCoda` (**42061**) →
   `tgAutoDecidi` (40989) → `tgAutoValuta`/`tgAutoApriQui` (42126/42377) → **`tgEseguiSegnale`
   (43791)** → ciclo `for(i=0;i<p.n;i++)` (**43908** MT5, **43933** simulato) → `placeRealMt5Order`
   (31586). Il numero di posizioni si decide in **un punto solo**, `tgPiano` **43695**
   (`let n=Math.max(1,tp.length)`), con tre sole riduzioni (tetti della sala 43694, lotto minimo che
   sfora → taglio a k 43730-43733, TP già passati). **Quel numero è giusto e va tenuto.**
   Il difetto è **quante volte `tgEseguiSegnale` viene chiamato per lo stesso messaggio**:
   1. **La finestra duplicata applica per conto suo — è la causa del ×3.** In tutto il blocco dei
      segnali (righe 37700-44100) ci sono **zero occorrenze di `PIP_SLOT`**: la guardia «lo fa la
      madre» esiste già per il cloud (1393), per Notion (36934, 36960), per il suono (45826) e per i
      salvataggi su disco — **manca solo qui**. All'avvio ogni finestra fa `tgGiaUsato()` →
      `tgCollega()` (**38981-38982**, senza guardia), apre il **proprio** WebSocket e riceve **la sua
      copia** del messaggio → `tgEseguiSegnale`. La guardia `anotherWindowOwnsAssetEvaluation`
      (**9493**) esiste ma è usata **solo** per la valutazione SL/TP (30238, 30332), mai per le
      aperture.
   2. **Il ponte riconsegna tutta la bacheca a ogni collegamento — seconda porta, indipendente dalle
      duplicate.** `segnali_bridge.py` tiene gli ultimi 50 segnali (`STORICO_MAX`, 145) e a ogni
      WebSocket nuovo riconsegna tutto: `ultimo = {"id": 0}` (**1499** — il commento sopra dice «si
      riparte dall'ultimo già visto», il codice parte da zero) e `BACHECA.da(ultimo["id"])` (1650).
      Dall'app `tgUltimoId` non è persistito (37442) e `tgSegnaliRicevuti` non è salvato (37705).
      Effetto: **ricaricare la pagina, o aprire una duplicata, entro il minuto di validità del segnale
      (`TG_SEGNALE_VALIDO_MS`, 38712) riapplica il segnale — la madre stessa, da sola.**
   3. **Chiave di deduplicazione per segnale: non esiste.** `tgMessaggioSegnali` non controlla `m.id`.
      Il filtro anti-doppioni di contenuto `fblDedupMotivo` (5762) guarda roba **in memoria di quella
      finestra**, e sulla strada MT5 senza grafico (`senzaGrafico`) le posizioni non finiscono in
      `positions[]`: **fra finestre diverse è cieco**.
   4. **Riprova dopo un ordine non confermato: esclusa** — il ciclo si ferma alla prima bocciatura
      (`break` a 43917, 43926, 43953, 43969). Bene: è la regola del progetto (esito sconosciuto ≠
      rifiuto, non si ritenta mai).
   5. **Rivalutazione a ogni tick: esclusa** — `tgAutoInCoda` ha due soli chiamanti (38580, 38060) e
      il timer da 5 s (38713-38719) fa solo scadere i segnali vecchi.
   6. **«Rimetti fra i nuovi»** (39166) rimette `stato='nuovo'` senza riaprire, ma
      `syntraAggiungiSala` (**38051-38061**) rimette in coda **tutti** i segnali ancora `nuovo` di
      quell'utente: uno appena rimesso a mano ripartirebbe (percorso stretto, solo Syntra).
   7. **La seconda SL «manuale»» non è una causa diversa**: con 12 posizioni allo stesso stop 3890 le
      linee raggruppano per prezzo (fblChiaveCaselleTpSl, 25167-25210). La seconda nasce dalla
      **linea «bozza» della barra ordini** (`#sl`, 25696, disegnata quando **non** c'è una posizione
      selezionata — 25689) oppure da una posizione **adottata dal polling che ha perso l'origine**
      (etichetta «manuale»» a 5621-5631). Chiudendo la moltiplicazione si restringono a una.
   **CURA misurata**: bastano due cose all'**ingresso** dell'applicazione (il numero si crea in
   `tgPiano` ed è già giusto): `PIP_SLOT===0` all'entrata di `tgAutoInCoda` (42061) o nei suoi due
   chiamanti, **più** una chiave persistita per messaggio applicato (id della bacheca + marcatore),
   perché la riconsegna a ogni collegamento riapre anche sulla madre da sola. Kraken è a parte:
   `krakenEseguiSegnale` (56845) fa **una** posizione con chiusure parziali, quindi lì la regola
   «una per TP» non si applica e la moltiplicazione va chiusa lo stesso, per un'altra strada.
   **Nota di sicurezza, da ripetere al proprietario finché la cura non è pubblicata**: con le
   duplicate aperte lo stesso segnale parte una volta per finestra (12 posizioni invece di 4). E
   anche **ricaricare la pagina madre da sola**, entro un minuto dall'uscita del segnale, la riapre.
   **Banco pronto** in `%TEMP%\opencode\banco_posizioni_eccesso.test.mjs` (8 prove): 4 TP → 4 ordini
   (controllo), 1 → 1, 3 → 3; ordine rifiutato e ponte muto → nessun ritentativo; due finestre → 8 e
   tre finestre → 12 (**la riproduzione del difetto**, verde oggi); madre + duplicata → 4 e ricarica →
   0 ordini nuovi (**la cura**, rossa oggi).

   **CURATO il 16 novembre 2026** (banco `laboratorio/app/posizioni_per_finestra.test.mjs`, 9/9;
   misura prima della cura: 2 finestre → 8, 3 finestre → 12 ordini per un segnale da 4). Quattro pezzi:
   1. **autorità**: solo la madre (o lo slot più basso fra le finestre **vive**) applica un segnale. La
      presenza si misura col **battito** su un canale BroadcastChannel dedicato (2,5 s, finestra di
      vita 9 s) — non con `siblingAssetBySlot`, che non si svuota mai e terrebbe bloccate per sempre le
      duplicate di una madre chiusa. Domanda + attesa massima 700 ms; la voce bloccata resta nel
      pannello **col motivo scritto**.
   2. **ricordo su disco**: `tgSegnaleApplicatoRicorda` (chiave per id in `localStorage`, vita 1
      giorno, pulizia pigra) scritto in `tgEseguiSegnale` e letto in `tgAutoInCoda`: chiude la porta 2
      anche se il ponte riconsegna.
   3. **ponte**: `segnali_bridge.py` — l'ultimo id **consegnato** è del ponte e sta su disco
      (`ultimo_consegnato.json`), e `Bacheca._prossimo_id` riparte dall'ultimo consegnato + 1
      (**senza questo la cura faceva peggio del difetto**: dopo un riavvio il ponte riassegnerebbe id
      da 1 e un segnale nuovo verrebbe scartato in silenzio). Nuova prova
      `laboratorio/ponte/test_bacheca_riconsegna.py` (verificata al contrario: senza cura cade).
   4. **stessa guardia su Kraken** (`krakenEseguiSegnale`, 56845); l'ordine manuale (voce senza id) non
      si tocca, quello l'ha confermato la persona.
   `python -m pytest laboratorio/ponte -q` → **401 passed**.
   **Scoperta dalla misura, da curare (decisione del proprietario del 16 novembre 2026: «in gruppo con
   ripiego: se qualcuno viene rifiutato, rileggere e basta»)** — gli ordini di un segnale partono **in
   gruppo** (`Promise.all`), quindi il «mi fermo alla prima bocciatura» avviene **dopo** la partenza:
   misurato, con un rifiuto del primo gli altri tre erano già inviati (4 invece di 1). Non toccato in
   questo giro. Da fare: niente ritentativi (mai), solo **rileggere** cosa è rimasto e **dirlo** nel
   pannello («aperti 3 su 4: uno rifiutato»). È in coda.

   **IL VERSO OPPOSTO, segnalato dal proprietario il 16 novembre 2026**: «a volte apre soltanto una
   posizione rispetto ai TP del segnale […] è arrivato un segnale da 5 TP e ha aperto soltanto una
   posizione e ha messo soltanto un TP». **MISURATO**: con un segnale normale di 5 TP ne aprono 5 (il
   parser ne consegna 5, nessun tetto interno). Ne apre di meno solo per tre riduzioni, **tutte prima
   di aprire e tutte mute**: (a) il **tetto della sala** che lascia posto per 1 sola posizione
   (`tgAutoDecidi` ~41075-41082 → `tgPiano` ~43854: `if(tp.length>maxN)tp=tp.slice(0,maxN)`; attenzione
   a un cfg senza `maxPosizioni` che legge **1**); (b) il **rischio** che non basta per 5 lotti minimi
   (~43884-43894: `k=floor(importoTot/(0.01*perUnita))`, misurato XAUUSD stop 25 $, rischio 1% su
   10.000 € → **4** posizioni, rischio 0,3% → **1**); (c) i **take profit già passati** (~43830-43833).
   Il motivo era scritto (`notaRidotte`, ~43891) ma in automatico **veniva buttato via**: entrava nel
   riepilogo `r` della conferma e `const ok=automatico?true:await appConfirm(...)` (~44045) lo scartava.
   In più il prefisso della scheda diceva il falso («⚡ Non aperto in automatico» su una posizione aperta).
   **CURATO il 16 novembre 2026** (banco `laboratorio/app/segnali_meno_posizioni.test.mjs`, 10/10;
   prima della cura: 1 verde e **9 rosse**, con `voce.autoMotivo` a `null`): il motivo unico si calcola
   in `tgPiano` (`motivoPosizioni`, con tre numeri — TP dichiarati, posizioni aperte, motivo esatto) e
   esce nella **scheda del segnale** (col prefisso corretto, in arancione chiaro), nella **barra di
   stato** e nel **popup manuale**. Frase tipo: «⚡ Aperta in automatico, ma con meno posizioni del
   previsto: aperta 1 posizione invece di 5 dichiarate dalla sala: tetto delle posizioni pieno: posto
   per 1».
   **Caso limite chiuso**: se il prezzo ha passato **tutti** i take profit, oggi `tp=[]` e
   `n=Math.max(1,0)=1` apriva **una posizione senza nessun target** e l'interruttore «apri senza
   target» non lo impediva (43839 controllava `!tutti.length`, non `!tp.length`). Ora **non apre** e lo
   dice (la sala i target li aveva dati, il prezzo li ha passati tutti: aprire uno stop senza obiettivo
   è inventare un ordine che nessuno ha chiesto).
   **Decisione del proprietario**: «Dirlo forte: scheda del segnale, stato e pannello» — il numero di
   posizioni **non** cambia (tetti, rischio e TP passati sono scelte giuste e volute); e il parere
   dell'indagine è che forzare sempre 5 posizioni a 0,01 lotti **non** è prudente: con uno stop lontano
   5 posizioni a lotto minimo possono già superare il rischio scelto (`rischioReale`) e sfondere i tetti
   della prop firm.
   **131 prove esistenti rilanciate, tutte verdi.**
   **Stato:** indagine in corso in sola lettura (16 novembre 2026), banco in preparazione in
   `%TEMP%\opencode\banco_posizioni_eccesso.test.mjs`, tutto su ponte finto e conto simulato.

4. **IL NOME DEL MODELLO DI DISEGNO «NON SI SALVA»** (linee, rettangoli, ritracciamenti di Fibonacci).
   > «succede troppe volte che non mi permette di salvare il nome del modello, me lo fa scrivere ma
   > quando lo vado a salvare non me lo salva […] devono sempre rimanere in memoria e non devono essere
   > tolti né modificati in futuro da parte dell'utente.»

   **Misurato leggendo il sorgente (16 novembre 2026).** Il campo è l'`<input>` di `appPrompt`
   (riga 12453) e il nome sta in `saveCurrentDrawingAsTemplate` (riga **11451**): il modello viene
   scritto in `localStorage['fbtDrawingTemplates_v1']` col **nome come chiave** (11460-11470), e il
   gemello del Fibonacci a **44261** scrive in `fbtFibTemplates_v1`. **Il nome non sta accanto ai
   punti del disegno** (`assetDrawings`, riga 7945, che è quella salvata su disco, IndexedDB e cloud):
   sta in un posto secondario, che è il rischio che la regola vietava.
   Tre cause distinte, tutte da curare **nella famiglia** (non in uno strumento):
   - dopo il salvataggio il menu non viene ridisegnato (11471 senza richiamo a
     `renderDrawTemplateMenu()`): il modello c'è ma non si vede finché non si riapre il menu — è
     l'ipotesi più probabile per il «non me lo salva»;
   - **il modello salvato dalla strada generica perde `levels` e `opts`**: per il Fibonacci il
     nome resta ma il modello è inutilizzabile, quindi «salvato» e «caricato» non coincidono;
   - due ritorni precoci (11454 senza disegno selezionato, 44320 senza bersaglio) in cui la finestra
     del nome non si apre affatto.
   **Deciso dal proprietario (16 novembre 2026)**: nome **immutabile per sempre**, ma il modello si
   può **cancellare**. Quindi nessuna strada di rinomina (nemmeno per refuso), il cestino resta.
   Banco pronto in `%TEMP%\opencode\banco_nomi_disegni.test.mjs` (7 prove, sintassi verificata, non
   eseguito) con la prova di controllo inversa (Esc → in memoria non deve restare niente) e la prova
   dell'immutabilità (il 🗑 toglie il modello, ma nessun percorso lo rinomina).

---

- **CURATO IN PARTE (v2.2.37) 12 novembre 2026 — LA PROP FIRM SI SCORDA CHE LA CHALLENGE E' GIA' STATA AVVIATA: la domanda «questo conto MT5 come lo usi?» riparte su un conto gia' deciso** - `app.html`: `fblPropContoStatoSalva()` riga **6777**, `triggerPropFirmViolation()` riga **7230**, `fblPropAttivazioneDaChiedere()` riga **6815**, `fblPropContoId()` riga **6718**, gestore `pip_clone_snapshot` riga **9663**. Diagnostici: `C:\Users\pietro\Documents\banchi_aperti_forex\diag_prop_memoria.mjs`, `diag_prop_memoria2.mjs`. Banco rosso: `C:\Users\pietro\Documents\banchi_aperti_forex\prop_memoria_conto.misura.test.mjs`.

  **CURATE il 12 novembre (v2.2.37), con banco verde `laboratorio/app/prop_memoria_conto.test.mjs`:**
  - **causa 1** (la violazione cancellava il record): `fblPropContoStatoSalva()` adesso FONDE
    (`Object.assign({},d[_k]||{},...)`) invece di sostituire. La fusione sta nella funzione, non
    nei diciannove chiamanti: il prossimo chiamante nuovo non puo' sbagliare nello stesso modo.
    Misurato dopo la cura: `propChiesto` resta true, `preset` resta `ftmo-1step`, `tipoConto`
    resta `swing`, `faseSuperata` resta 1, e il conto si chiude comunque col suo motivo.
  - **causa 3** (la duplicata eseguiva il rito del collegamento): `updateMt5ModeUI(true)` nel
    gestore `pip_clone_snapshot`. Misurato prima e dopo sulla strada vera, aprendo la pagina come
    finestra duplicata (`?pipSlot=2`) e consegnando lo scatto della madre sul canale: il
    parametro passava `false`, adesso passa `true`. Cura anche il suono di benvenuto che si
    sentiva una volta per ogni finestra aperta.
  **RESTA APERTA la causa 2** (lo stesso conto con due identita' secondo come si e' saputo il nome
  del server): non e' curata, ed e' l'unica delle tre che richiede di decidere quale delle due
  stringhe del ponte e' quella buona.


  Parole del proprietario (12 novembre 2026): «ogni volta che apro una pagina duplicata, e sono collegato a un conto, mi dice sempre se questo conto e' una prop firm o meno. E anche sulla pagina madre. Certe volte mi dice se voglio avviare su questo conto la challenge della prop firm, ma in realta' e' gia' stata avviata. Deve rimanere in memoria fisso che quel conto e' stato ormai utilizzato come prop firm ed e' stata attivata, e se lo deve ricordare. Non se lo puo' scordare.»

  **IL PRIMO SOSPETTO E' INNOCENTE, ed e' misurato.** Non e' vero che «la duplicata non puo' ricordare perche' non scrive su disco». `fblPropContoStatoSalva()` scrive **direttamente** in `localStorage` (riga 6780), senza nessuna guardia `PIP_SLOT>0`, e `localStorage` e' condiviso fra tutte le finestre della stessa origine. Misurato (`diag_prop_memoria.mjs`, misura B): la madre scrive `{"mt5:5057460278@FTMO-Demo":{...propChiesto:true...}}`, la duplicata con `PIP_SLOT=2` rilegge **lo stesso contenuto byte per byte** e risponde `fblPropAttivazioneDaChiedere=false`. La memoria arriva. Il problema e' **chi la cancella** e **con che nome la cerca**.

  **CAUSA 1 (deterministica, la piu' grave): una violazione CANCELLA la memoria del conto.** `triggerPropFirmViolation()` riga 7230 fa

      try{ fblPropContoStatoSalva(null,{stato:'chiuso',motivo:rule}); }catch(e){}

  e `fblPropContoStatoSalva()` riga 6779 fa `d[id]=Object.assign({quando:Date.now()},stato||{})`: **sostituisce l'intero record**, non lo aggiorna. Tutti gli altri diciotto punti che salvano passano `Object.assign({},st,{...})` e conservano quello che c'era; questo e' l'unico che passa un oggetto nudo. Misurato (`diag_prop_memoria.mjs`, misura E) su un conto con challenge avviata, preset **one step**, conto **swing**:

  | campo | prima della violazione | dopo |
  |---|---|---|
  | `propChiesto` | `true` | **`false`** |
  | `preset` | `ftmo-1step` | **`ftmo-2step`** |
  | `tipoConto` | `swing` | **`standard`** |
  | `fblPropAttivazioneDaChiedere` | `false` | **`true`** |

  Due danni, non uno. Il primo e' la domanda che riparte: e' esattamente il «ma in realta' e' gia' stata avviata» del proprietario. Il secondo costa soldi ed e' **silenzioso**: perdendo `preset` e `tipoConto` il conto torna da solo a **FTMO two step / Standard**, cioe' il limite giornaliero mostrato passa da **3%** a **5%** e ricompaiono le restrizioni overnight/notizie di uno Standard su un conto che era Swing. Nessun avviso. Spariscono allo stesso modo `faseSuperata`, `faseSuperataQuando` e `faseSuperataNumeri`: una fase superata e pagata non e' piu' scritta da nessuna parte.

  **CAUSA 2 (riproducibile): lo stesso conto MT5 ha DUE identita' diverse secondo come si e' saputo il server.** `fblPropContoId()` costruisce la chiave come `'mt5:'+login+'@'+(server||'')`. Misurato (`diag_prop_memoria2.mjs`, caso 3): conto `5057460278` con la memoria scritta sotto `mt5:5057460278@FTMO-Demo`, ma attivato con il server vuoto -> chiave `mt5:5057460278@` -> `fblPropAttivazioneDaChiedere=true` -> **la domanda «🛡️ Nuovo conto / Questo conto MT5 come lo usi?» compare davvero** (contata nel banco, non dedotta). E le due sorgenti del server **non sono la stessa**: il ponte restituisce `body.server`, cioe' quello che l'utente ha **digitato**, nella risposta di `/connect` (`installer_build/build/bridge.py` riga **2721**), e `info.server`, cioe' quello che **dichiara MT5**, in `/account` (riga **2817**). La madre impara il conto dalla prima (`connectToMt5Bridge` -> `mt5AttivaConto(esito.data.login, esito.data.server)`), una finestra duplicata o un altro dispositivo lo imparano dalla seconda (`fetchMt5AccountInfo` riga **46540**: `mt5AttivaConto(loginPonte, r.data.server||'')`). Basta che le due stringhe differiscano di una maiuscola, di uno spazio o di un suffisso perche' lo stesso conto diventi due conti per la prop firm. **Che sulla macchina del proprietario le due stringhe differiscano NON e' misurato** (serve il suo ponte vivo): quello che e' misurato e' che se differiscono la domanda riparte, e che niente nel codice le normalizza. `fetchMt5AccountInfo` confronta **solo il login** (`loginPonte!==loginQui`), mai il server: quindi il disallineamento non viene nemmeno notato.

  **CAUSA 3 (strutturale): una finestra duplicata esegue il rito del «mi sono appena collegato», e non dovrebbe.** Il gestore `pip_clone_snapshot` (riga 9663), quando eredita dalla madre il fatto di essere collegata, chiama `updateMt5ModeUI()` **senza** il parametro `silenzioso`. Dentro `updateMt5ModeUI()` (riga 57552) `_justConnected` diventa vero, e da li' partono tutti e tre: suono di benvenuto, domanda sulle sale Telegram e **la domanda della prop firm**. Misurato (`diag_prop_memoria.mjs`, misura D): consegnando alla duplicata lo scatto vero della madre, `campanelle=1` — **il suono di collegamento suona ancora nella duplicata**, che e' il difetto dell'8 novembre dato per chiuso («sento il suono che riproduce quando mi collego»): la cura di allora ha coperto la strada `fetchMt5AccountInfo` (riga 46553, che passa `!loginQui`) e ha lasciato aperta questa. In quella misura la domanda non e' comparsa solo perche' la chiave combaciava; con la chiave sbagliata della causa 2 compare. Il principio e' gia' scritto nel file, alla riga 57545: «IMPARARE IL CONTO NON E' COLLEGARSI». Una duplicata non si collega mai: eredita.

  **COSA NON E' LA CAUSA, misurato.** (a) La duplicata nasce in Storico, e in Storico `fblPropContoId()` risponde `'storico'` invece del conto MT5 (misurato, `diag_prop_memoria2.mjs` caso 1: `idPrima='storico'`, `chiedePrima=true`): sembrava una trappola, ma la domanda e' ritardata di 1.500 ms e in quell'intervallo la finestra passa in Live, quindi al momento della domanda l'id e' gia' `mt5:5057460278@FTMO-Demo` e la domanda **non** parte. Non va curato. (b) `localStorage` non letto dalla duplicata: falso, vedi sopra.

  **PROVA DI CONTROLLO, che vale quanto le altre:** su un conto **mai visto** (`mt5:99999999@Altro-Demo`) la domanda **deve** comparire, e compare (misurato, caso 4). Una cura che smette di chiedere sarebbe peggio del difetto: all'aggiunta di un conto nuovo quella domanda e' l'unico momento in cui si dichiara se quel conto e' una prop firm.

  **DUBBIO APERTO, separato, da decidere col proprietario:** `startNewPropFirmChallenge()` non scrive niente in `fbl_prop_conti`. Quindi dopo «Ricomincia da capo» la sessione riparte ma il record del conto resta `stato:'chiuso'`, e `fblPropContoCalcola()` continua a rispondere `false`: la prop firm non ricomincia a calcolare su un conto che l'utente crede riaperto. Non e' lo stesso difetto e non l'ho toccato.

- **APERTO (misurato) 12 novembre 2026 — GLI INDICATORI RIFANNO IL CALCOLO DA ZERO A OGNI TICK: `rows` cambia IDENTITA' a ogni prezzo che arriva, e la guardia della cache confronta per riferimento** - `app.html`: `rebuildBaseRowsFromLibrary()` riga **12581** (`baseRows=src.slice()`), `rebuildRows()` riga **12458** (`const disp=fullAgg.slice()`), e la guardia ripetuta **17 volte** (16 indicatori integrati + lo script personale) (`st.ref!==rows`, righe 16472, 16760, 17168, 17475, 17887, 18172, 18530, 18814, 19106, 19529, 19787, 20133, 20252, 20351, 20618, 20845 ...). Diagnostici: `C:\Users\pietro\Documents\banchi_aperti_forex\diag_indicatori_cache.mjs` e `diag_altre_cache_rows.mjs`. Banco rosso: `C:\Users\pietro\Documents\banchi_aperti_forex\indicatori_cache_incrementale.misura.test.mjs`.

  **LA MISURA DEL PROPRIETARIO** (pannello prestazioni, 12 novembre 17:30, v2.2.12, 50.029 candele, quattro indicatori accesi): `fotogrammiAlSecondo` **4,7** • `disegnoMedio_ms` **64,44** • `sezioniDelDisegno: indicatori=58,11` (tutto il resto insieme ~6 ms) • dentro: `ind:bsl_ssl_fvg:calcolo`=**23,15**, `ind:amd_poc_trade:calcolo`=**20,83**, `ind:order_blocks:calcolo`=**12,34**, `ind:ema_ind:calcolo`=1,42 — mentre i rispettivi `:disegno` costano 0,04-0,16 ms. **Non e' il disegno, e' il calcolo.**

  **LA CAUSA, misurata e non supposta.** I 17 calcoli con cache (16 indicatori integrati + lo script personale, su 20 indicatori nel menu) sono scritti per essere incrementali: ognuno tiene `st.builtTo` e il ciclo e' `for(let i=st.builtTo+1;i<=upToIdx;i++)`. Ma la guardia che decide se tenere la cache e'

      if(st.ref!==rows || st.builtParamsKey!==JSON.stringify(p) || upToIdx<st.builtTo){ st.builtTo=-1; ...azzera tutto... }

  e `st.ref!==rows` e' un confronto **per riferimento**. In Live, a OGNI prezzo che arriva, la catena `applyLivePriceToChart()` (riga 50831) fa `rebuildBaseRowsFromLibrary()` + `rebuildRows()`, e **tutte e due consegnano un array nuovo di zecca**:
  - riga 12568: `baseRows = tutteBuone ? src.slice() : src.filter(...)` — la `.slice()` e' **voluta**, e il commento accanto lo dice: «necessaria per invalidare correttamente le cache di getBaseTimes()/getFullAgg(), basate sul confronto per riferimento». Serviva a quelle due cache; nessuno ha visto che la stessa riga azzera anche le 17 cache degli indicatori.
  - riga 12458: `const disp=fullAgg.slice(); disp[bIdx]=partial; rows=disp` — quando l'ultima candela e' in formazione (cioe' **sempre**, in diretta, su qualunque timeframe diverso da m1).

  Quindi `rows` ha una faccia nuova a ogni tick, `st.ref!==rows` e' sempre vero, e ogni indicatore ributta via tutto e ricalcola **50.029 candele da capo** per guadagnare una candela.

  **I NUMERI** (`diag_indicatori_cache.mjs`, 50.029 candele m1 finte dentro la sessione di New York, 30 tick veri simulati con la stessa coda di `applyLivePriceToChart`; memoria della pagina 73 MB):

  | | a m1 (50.029 candele) | a m5 (10.006 candele) |
  |---|---|---|
  | `rows` cambia identita' | **30 tick su 30** | **30 su 30** |
  | azzeramenti `builtTo=-1`, per indicatore | **30 su 30** (tutti e quattro) | **30 su 30** |
  | costo per tick, oggi | **241,53 ms** | **43,64 ms** |
  | costo per tick, con l'identita' stabile | **0,75 ms** | **0,11 ms** |
  | **rapporto** | **338x** | **397x** |

  Dettaglio per indicatore, costo per tick **oggi** contro **identita' stabile** (m5): `bsl_ssl_fvg` 15,10 -> **0,00**; `amd_poc_trade` 25,95 -> **0,00**; `order_blocks` 2,08 -> **0,00**; `ema_ind` 0,33 -> 0,00. A m1: 92,73 -> 0,00; 137,27 -> 0,00; 7,46 -> 0,00; 3,32 -> 0,00. Un giro **fermo** (stesso `rows`, niente di nuovo) costa **0,000-0,005 ms**: la macchina incrementale funziona perfettamente, non viene mai lasciata lavorare. Il costo di un giro **da zero** e': `bsl_ssl_fvg` 293,3 ms, `amd_poc_trade` 161,8 ms, `order_blocks` 18,1 ms, `ema_ind` 2,8 ms su 50.029 candele.

  **IL BANCO ROSSO, e il rapporto che misura** (`indicatori_cache_incrementale.misura.test.mjs`, 20 tick, rosso in **14 secondi**: nessun `test.skip`). Tre prove: (1) `rows` cambia identita' **20 su 20** tick, atteso 0; (2) ogni indicatore butta la cache **20 su 20**, atteso 0; (3) **la quota di un ricalcolo**: un tick costa **0,503** di un ricalcolo da zero a m5 (49,9 ms contro 99,3) e **0,591** a m1 (250,25 ms contro 423,3), contro un tetto dello 0,05. Non e' 1,0 tondo per un motivo onesto e non per un risparmio: il primo giro paga anche la compilazione a caldo del browser, i giri dopo no — il lavoro svolto e' lo stesso, tutte le candele da capo. La prova 3 e' un **rapporto fra due misure dello stesso giro**, non un tempo secco: la macchina carica sposta entrambi i numeri, il rapporto resta.

  I numeri del banco sono piu' alti di quelli del pannello (43,64 contro 58,11 a parita' di scala e' lo stesso ordine; 241 ms a m1 e' il caso peggiore senza aggregazione) perche' il banco non ha il limite di tempo del fotogramma: la forma del difetto e' identica, il rapporto e' la misura che conta.

  **IL SECONDO SOSPETTO E' INNOCENTE, e si misura:** `JSON.stringify(p)` dei parametri, eseguito a ogni fotogramma per ogni indicatore, costa **0,2-0,8 microsecondi** (mille giri cronometrati). Su quattro indicatori sono **0,002 ms** per fotogramma: tre ordini di grandezza sotto il difetto. Non va toccato.

  **PRECEDENTE GIA' IN CASA, ed e' la strada della cura.** Il 9 novembre lo stesso problema era stato risolto **solo per `getFullAgg()`**: `fblStessoLivello()` (riga 12304) riconosce «sono le stesse candele» campionando **tre punti fissi** (prima, mezzo, ultima) con uno scarto del **0,5%**, e `segnalaCodaCambiata()` dice alle cache «e' cambiata solo la coda, da questo indice». Oggi quel segnale **lo legge solo `getFullAgg`** (`codaValidaPer`). Gli indicatori non lo vedono nemmeno. La cura e' estendere lo stesso meccanismo alla guardia degli indicatori: una **targa della serie** (`rowsSerieId`) che cambia solo quando le candele sono davvero un'altra serie (asset, timeframe, storico ricaricato, salto nel replay) e **non** quando e' cambiata solo la coda; la guardia confronta la targa invece del riferimento, e quando la coda e' cambiata riporta `builtTo` all'indice dell'ultima candela non toccata invece di azzerarlo.

  **IL BUCO DELLA TARGA DA SOLA, e va chiuso nello stesso lavoro (annotato il 12 novembre, non misurato).**
  La targa ferma il ricalcolo, ma da sola lascia l'indicatore **fermo a una candela incompleta**, che
  e' peggio che lento. Oggi l'ultima candela in vista e' quella in formazione (`disp[bIdx]=partial`),
  e il ciclo incrementale la assorbe: `st.builtTo` arriva a comprenderla. Con il riferimento che
  cambia a ogni tick l'indicatore ributtava tutto e la ricalcolava col prezzo nuovo — lento ma
  aggiornato. Con la targa stabile `upToIdx` non cresce piu', il ciclo non gira, e quell'indicatore
  resta con dentro la candela **come era al primo tick della barra**: un order block o un FVG
  calcolati su una candela che aveva un secondo di dati, e che non si correggono piu'. Non e'
  «confermato a chiusura barra»: e' «congelato all'apertura della barra», ed e' silenzioso.
  La cura quindi e' doppia, e le due parti vanno insieme: (1) la targa della serie; (2) il limite
  del ciclo portato all'ultima candela **chiusa** (`upToIdx` meno uno quando l'ultima e'
  `partial`), cosi' la candela entra nell'indicatore quando chiude davvero — che e' il
  comportamento di TradingView, e va scritto a schermo perche' non si scopra da soli.
  Senza il punto (2), il banco va scritto in modo che se ne accorga: confrontare il valore
  dell'indicatore dopo dieci tick sulla stessa barra con quello di un ricalcolo da zero sulle
  stesse candele. Oggi coincidono per forza bruta; con la targa da sola **divergono**.


  **E LA CANDELA IN FORMAZIONE? MISURATO: COSTA 0,046 ms.** La cura dell'identita' stabile fa costare zero i tick, ma ha un prezzo dichiarato: la candela ancora aperta non entra nell'indicatore finche' non chiude (l'indicatore si aggiorna «quando nasce una candela nuova»). Si e' misurato quanto costerebbe invece rimacinare **solo l'ultima candela** a ogni tick — una candela su 50.029: `bsl_ssl_fvg` **0,013 ms**, `amd_poc_trade` **0,020 ms**, `order_blocks` **0,010 ms**, `ema_ind` **0,003 ms**, in tutto **0,046 ms per tick** contro i **202,82 ms** di oggi (a m5: 0,010 ms contro 35,63). **Tenere viva la candela in formazione non costa praticamente niente in macchina**: cio' che costa e' il lavoro di scrittura, perche' serve una fotografia dello stato interno da ripristinare prima di riassorbire quella candela, e va fatta indicatore per indicatore (17). La spesa e' di sviluppo e di rischio, non di processore — e questo cambia quale strada conviene.

  **GLI INDICATORI NON SONO I SOLI, e qui si spiegano anche i «~6 ms di tutto il resto» del pannello.** A confrontare `rows`/`baseRows` **per riferimento** sono in **sei** posti, oltre alle 17 guardie degli indicatori: `getRowsTimestamps()` riga **12198**, `getFullAgg()` riga 12331, `getBaseTimes()` riga 12362, `computeVolumeProfile()` riga **13479**, `_lvnTouchCache` riga **13623**, `vpIndBuildInstances()` riga **15649**. Di questi **solo due** hanno la cura della coda del 9 novembre (`getFullAgg` e `getBaseTimes`, via `codaValidaPer`); gli altri quattro si svuotano interi a ogni tick. Misurato (`diag_altre_cache_rows.mjs`, 50.029 candele, 20 tick): `getRowsTimestamps()` si **riempie da zero 20 volte su 20** e costa **7,17 ms per tick** (riconverte 50.029 date per una candela che si e' mossa) — che e' **esattamente l'ordine dei «~6 ms» che il pannello del proprietario attribuiva a tutto il resto del disegno**; la mappa di `computeVolumeProfile()` si **svuota 20 su 20** e costa 0,83 ms per tick su cinque profili. Nessuno di questi quattro e' stato scritto male: tutti e quattro sono vittime della stessa riga. **Quindi la targa della serie serve a sei lettori, non solo agli indicatori**, e va messa accanto a `rows` dove il dato nasce — non dentro una funzione sola, che e' l'errore del 9 novembre.

  **NON E' un difetto del porting dei undici indicatori nuovi (v2.2.35).** Misurato: `amd_poc_trade` e' incrementale per costruzione come gli altri (ciclo `for(let i=st.builtTo+1...)`, stato in `st`, nessuna rilettura dello storico) e **a identita' stabile costa 0,00 ms per tick**. Ha pero' due spese sue che pesano **solo** sul giro da zero, e che vale la pena togliere comunque: (a) la finestra di accumulo e' un ciclo interno di `accLen`=40 candele per ogni candela — 2 milioni di confronti su 50.029 candele, dove un massimo/minimo scorrevole costerebbe O(1); (b) `new Date(r.date).getTime()` per ogni candela, 50.029 parse di stringa, mentre `parseDateTime` e' gia' in cache altrove. Con questi due, un giro da zero scenderebbe sotto i 161,8 ms misurati. Ma e' il contorno: la causa del 4,7 fps e' l'azzeramento, non l'algoritmo.

- **APERTO (misurato) 12 novembre 2026 — A MERCATO CHIUSO LE CANDELE «SI TRASFORMANO»: il corpo vale 1 px e viene spalmato su DUE colonne di pixel** - `app.html`, `draw()` riga **22862** (`bw`) e `getViewWindow()` riga **15204**. Banchi di misura: `C:\Users\pietro\Documents\banchi_aperti_forex\diag_candele_chiuso.mjs`, `diag_candele_soglia.mjs`, banco rosso `candele_leggibili_chiuso.misura.test.mjs`.

  Parole del proprietario (foto XAUUSD 5m, mercato chiuso): «quando il mercato chiude e andiamo indietro nello storico, oppure carichiamo un asset diverso o lo ricarichiamo, tutte le candele si trasformano. E' come se perdessero la proprieta' e si rompe il disegno delle candele. Il disegno di default non e' cosi'.»

  **PRIMA MISURA, e smonta la pista piu' forte: LA CHIUSURA DEL MERCATO NON TOCCA NE' IL COLORE NE' LA LARGHEZZA.** Stesso scenario (XAUUSD 5m, 2.017 candele, grafico 1.300 px -> `cw` = **1.140 px**), misurato due volte con lo stesso banco: una con l'orologio su venerdi' 5 novembre 12:00 UTC (mercato APERTO) e una su sabato 7 novembre 12:00 UTC (mercato CHIUSO, verificato: `fblMercatoFermoOra`=true, `liveSessionPhaseNow`=closed, `statoMercato`=chiuso/fonte orari, `fblConfineChiusura`=804).

  | candele in vista `n` | passo px | corpo px | corpi impastati (stessa colonna del vicino) |
  |---|---|---|---|
  | 127 (il valore «ideale») | 8,98 | **5,57** | 0 |
  | 200 | 5,70 | 3,53 | 0 |
  | 300 | 3,80 | 2,36 | 0 |
  | 400 | 2,85 | 1,77 | 0 |
  | 500 | 2,28 | 1,41 | 61 su 379 |
  | 600 | 1,90 | 1,18 | 141 su 467 |
  | 864 (3 giorni a 5m) | 1,32 | **1,00** | **476 su 700** |
  | 1.234 (il tetto `fblTettoCandele`) | 0,92 | **1,00** | **1.024 su 1.025** |
  | 2.000 | 0,57 | 1,00 | 1.698 su 1.699 |

  **I numeri sono IDENTICI a mercato aperto e a mercato chiuso**, riga per riga. Non c'e' nessuna soglia che la chiusura fa cadere dall'altra parte: il colore resta quello del tema scelto (`blue_white`: su `#ffffff`, giu' `#2f9bff` — il bianco/blu della foto e' il suo tema, non un ripiego) e la larghezza dipende **solo** da quante candele stanno nella finestra e da quanto e' larga la finestra.

  **COSA CAMBIA DAVVERO ALLA CHIUSURA, misurato: il MARGINE FUTURO sparisce e nella stessa larghezza entrano piu' candele.** `getViewWindow()` riga 15204: `liveMargin = _apertoOra ? n*LIVE_FUTURE_MARGIN_FRACTION : 0` (la frazione e' 0,12). A mercato aperto il 12% destro della finestra e' vuoto; a mercato chiuso si riempie di candele. Misurato a parita' di `n`: **n=127 -> 52 corpi aperto, 67 chiuso**; **n=864 -> 701 corpi aperto, 804 chiuso**, con i corpi impastati che passano da **476 a 546**. La larghezza del singolo corpo non cambia di un pixel: cambia la QUANTITA' di stecchini a schermo, il 14% in piu' di roba nello stesso spazio. E' un peggioramento vero e spiega il «succede al momento della chiusura», ma e' un contorno, non la causa.

  **LA CAUSA DELL'ASPETTO «ROTTO», e si misura in pixel.** Il corpo e' `bw=Math.max(1,Math.min(_footprintOn?90:12,cw/n*.62,cw/n))` (riga **22862**; il pavimento e' stato abbassato da 2 a 1 px il 10 novembre 2026 per togliere il «grafico a blocchi»). Da `n`>=864 il corpo vale **esattamente 1,00 px** e viene disegnato con `fillRect` a una **x frazionaria**: a 1 px su x frazionaria il browser lo spalma su DUE colonne di pixel, a meta' opacita' ciascuna. Misurato: a n=864 **tutti** i 700 corpi coprono 2 colonne di pixel, nessuno ne copre una sola. Da qui esattamente l'aspetto segnalato: il bianco diventa grigio, il blu diventa blu slavato, e la nitidezza cambia da candela a candela secondo la frazione di pixel su cui cade — cioe' «corpi sottili e irregolari» disegnati «con un'altra regola di colore e un'altra larghezza». La regola e' la stessa di sempre: e' il pixel che non c'e'. **E il perche' sono IRREGOLARI si misura allo stesso modo**: nella fascia di mezzo le candele non sono tutte uguali. A n=500 (corpo 1,41 px) **212 corpi coprono 2 colonne di pixel e 167 ne coprono 3**; a n=400 (corpo 1,77 px) sono 59 contro 232; a n=300 (corpo 2,36 px) 122 contro 81. Larghezze diverse per candele identiche, deciso dalla frazione di pixel su cui ognuna cade: e' esattamente «corpi sottili e irregolari».

  **DOVE STA LA SOGLIA, in numeri utilizzabili (grafico 1.300 px, `cw`=1.140):** fino a **n<=300** (passo 3,80 px, corpo 2,36 px) nessun corpo tocca il vicino; da **n=500** comincia l'impasto; da **n=864** il corpo e' al pavimento di 1 px e il 68% dei corpi condivide la colonna del vicino; da **n=1.200** la condivisione e' totale. La soglia **non e' dichiarata da nessuna parte e non coincide con nessuno dei tre tetti esistenti**: `maxNoOverlapVisibleCount()` vale **380** (cw/3) ma non e' piu' il tetto dello zoom del tempo (richiesta esplicita del proprietario: lo zoom del periodo deve essere illimitato), il tetto dello zoom manuale `maxManualZoomOutVisibleCount()` vale **20.000**, e il tetto del cambio timeframe `fblTettoCandele()` vale **1.234** (la larghezza in pixel del grafico). Due dei tre tetti stanno molto oltre il punto in cui il disegno smette di essere leggibile.

  **IL «GRAFICO A BLOCCHI» DELLA v2.2.17 NON E' SPARITO: E' STATO SPOSTATO PIU' IN LA'.** La cura del 10 novembre (pavimento del corpo da 2 px a 1 px) fa sì che il corpo non superi mai la colonna **finche' la colonna e' larga almeno 1 px**. Sopra `n`=1.234 la colonna scende sotto il pixel (passo 0,92 px a n=1.234, 0,57 px a n=2.000) mentre il corpo resta inchiodato a 1 px: il corpo torna a essere **piu' largo del suo posto** e il grafico ridiventa un masso pieno (misurato: 1.024 corpi impastati su 1.025 a n=1.234, 1.698 su 1.699 a n=2.000). La soglia del blocco e' passata da circa 400 candele a circa 1.230, non e' stata tolta — e lo zoom manuale arriva a 20.000.

  **CHI CI PORTA, misurato con la rotellina vera (CTRL + rotellina sul canvas, gestore vero, grafico 1.234 px):** partenza n=127 (corpo 5,57 px, zero impasti) -> **5 tacche** n=205, corpo 3,45 px -> **10 tacche** n=331, corpo **2,14 px** (sotto la soglia) -> **15 tacche** n=532, corpo 1,33 px, **153 corpi impastati** -> **20 tacche** n=857, corpo **1,00 px**, **574 impastati** -> **25 tacche** n=1.381, passo 0,83 px. Sono tre o quattro colpi di rotellina. Nessun tetto interviene: lo zoom del tempo e' limitato da `maxManualZoomOutVisibleCount()` = **20.000** (per richiesta esplicita del proprietario lo zoom del periodo e' «illimitato»), mentre il tetto che saprebbe la risposta giusta, `maxNoOverlapVisibleCount()` = **380**, non viene piu' usato per il tempo. **Nessun avviso, nessuna scritta: il grafico cambia aspetto e non lo dice.**

  **PERCHE' RESTA DOPO «UN ALTRO ASSET O LO RICARICHIAMO» — la vista rotta si ricorda.** Misurato (`diag_candele_memoria_vista.mjs`, e la terza prova del banco rosso): vista allargata a mano a n=900 (corpo 1,00 px, **840 corpi su 901 spalmati su due colonne**, 660 impastati) -> `applyChartViewForAsset('XAUUSD')`, cioe' la strada di ogni ritorno su quell'asset e di ogni ricaricamento del suo storico, rimette **n=900, autoFitWidth=false, corpo 1,00 px**. La larghezza sta in due memorie: `assetChartViews[modo][asset].visibleCount` (riga **12938**) e il file per dispositivo `fbl_zoom_dispositivo` scritto da `fblZoomDispositivoSalva()` (riga **8691**), che su disco contiene `{"visibleCount":900,"autoFitWidth":false}`. **E niente la riporta a posto**, perche' `autoFitWidth` resta spento: `idealVisibleCount()` (che darebbe 127) viene richiamato solo da `forward()`, `back()`, `window.onresize` e dal pulsante «torna all'ultima candela». Un asset mai visto riparte invece pulito (misurato: n=127): per questo il difetto sembra capriccioso.

  **E LA MEMORIA VA SU DISCO, quindi non basta riaprire l'app.** `visibleCount` non sta nel pacchetto di sessione leggero (`collectLightSessionState()` non lo contiene, misurato), ma sta dentro `assetChartViews`, che `saveAssetChartViews()` (riga **7768**) scrive in **IndexedDB** a OGNI caricamento di asset (`idbPut('assetChartViews', ...)`, chiamata alle righe **13036** e **13058**) e che `initSession` rilegge all'avvio (riga **58544**, applicata alla riga **58754**). Misurato con `laboratorio/app/diag_candele_memoria.mjs`: dopo uno zoom-out a `visibleCount`=3000 su disco finisce `{"XAUUSD":{...,"autoFitWidth":false,"visibleCount":3000}}`. **Il ramo di rilettura all'avvio non e' stato eseguito nel banco** (dopo il `reload` la mappa torna vuota e n=127, perche' `initSession` non parte: il banco salta il velo di accesso e non ha una libreria di asset su IndexedDB) — quindi la scrittura su disco e' misurata, la rinascita all'avvio e' letta nel codice e **resta da misurare**. E il **cambio timeframe non c'entra piu'**: 1H -> 1m col gestore vero della select lascia `visibleCount` a 127 (era la cura della v2.2.17, tiene).

  **Banco rosso (3 prove su 3 rosse, 11,3 s in tutto):** `C:\Users\pietro\Documents\banchi_aperti_forex\candele_leggibili_chiuso.misura.test.mjs`
  1. «CTRL+rotellina indietro: il corpo non deve mai scendere sotto 3 px» -> rosso a 10, 15, 20, 25 tacche;
  2. «a mercato chiuso lo stesso zoom non deve impastare piu' candele» -> rosso, da **476 a 587** corpi impastati a n=864;
  3. «tornando su un asset la larghezza deve essere di nuovo leggibile» -> rosso, torna a 1,00 px con `autoFitWidth=false`.

  **COSA NON E' STATO MISURATO (resta ipotesi).** Il percorso Live di cambio/ricarica asset (`loadLiveHistoryFromMt5`) non e' stato eseguito nel banco perche' chiede la rete: nel codice, quando `shouldResetView` e' vero (riga **47303**) si rimettono `viewEnd`, `followLatest`, `autoFitWidth`, `priceZoomFactor`, **ma non `visibleCount`** (riga **47388**), quindi in Live anche un cambio asset dovrebbe conservare la vista rotta. Letto, non eseguito.

  **IL PARERE (chiesto dal proprietario).** La soglia che cambia l'aspetto del grafico non e' una buona idea cosi' com'e', ma non perche' esista: perche' e' **implicita, invisibile e senza fondo**. Tre proposte, in ordine di valore:
  (1) **un pavimento onesto allo zoom del tempo**: `visibleCount` non oltre `cw/3` (oggi 380 su un grafico da 1.300 px) — lo zoom resta «illimitato» nel senso che conta (si puo' sempre stringere), ma non oltre il punto in cui una candela non e' piu' disegnabile; se si vuole vedere piu' tempo si cambia timeframe, che e' lo strumento giusto per quello;
  (2) **se si vuole mostrare comunque mesi di storia, si cambia DISEGNO e lo si dice**: sotto i 3 px per colonna si passa a una riga sottile continua (tipo «linea di chiusura» o barre OHLC da 1 px disegnate su x INTERA, non frazionaria, cosi' restano nitide) con una scritta piccola «vista compressa: 1.381 candele» e un tocco per tornare alle candele. Un aspetto diverso va annunciato, non subito;
  (3) **in ogni caso, x intera**: arrotondare `xx` e `bw` al pixel quando `bw<=2` toglie da solo lo spalmamento su due colonne — e' la meta' del difetto visivo, e si corregge in una riga senza toccare nessuna soglia.
  E una cosa che non dipende dalle soglie: **la vista non deve restare rotta**. Una larghezza illeggibile non va memorizzata; o si memorizza la finestra di TEMPO e si ricalcola la larghezza su quella, o al ricaricamento di un asset si rimette `autoFitWidth` a vero come si rimettono gia' `followLatest` e `priceZoomFactor`.


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


---

## FINESTRE DUPLICATE — CAUSE LETTE NEL SORGENTE (12 novembre 2026, in corso)

Scritto PRIMA dei banchi, di proposito: la sessione precedente su questo fronte si e' interrotta
dopo aver scritto «causa trovata, ora i banchi» e non e' rimasto niente su disco. Qui sotto c'e'
quello che e' stato letto e verificato nel sorgente di `app.html` (riga per riga), separato da
quello che il banco ha poi misurato davvero.

### A. PUNTO 1 — «dalla duplicata non riesco a spostare le posizioni, e si comporta strano anche
la madre». CAUSA LETTA NEL SORGENTE: `active` viene azzerato da ogni messaggio che arriva.

Tre fatti nel sorgente, in catena:

1. Il trascinamento di SL/TP di una posizione APERTA lavora SOLO su `active` (la posizione
   selezionata). `setTradeLevel()` (riga 24190) scrive `active.sl` / `active.tp`; se `active` e'
   nullo entra nel ramo di riga 24254 — `if(!active){...}` — che scrive soltanto nella CASELLA
   `#sl`/`#tp` come "preimpostato (si applica quando apri la posizione)". Nessun errore, nessun
   avviso: il gesto sembra funzionare e non sposta niente. E' esattamente «non me le fa spostare».
2. Il gestore di `trading_sync` (riga 9322) fa `if(active&&!positions.includes(active))active=null;`
   subito dopo `fblApplicaStatoTrading(msg)`, che a riga 49437 fa
   `positions=Array.isArray(msg.positions)?msg.positions.map(_timbra):positions`.
   `msg.positions` arriva da BroadcastChannel, cioe' da una COPIA strutturata: oggetti NUOVI, mai
   identici per riferimento a quelli locali. Quindi `positions.includes(active)` e' SEMPRE falso
   dopo un messaggio con posizioni, e `active` viene azzerato OGNI VOLTA. Non e' una sganciatura
   di un riferimento orfano (l'intenzione del commento): e' una sganciatura sistematica.
3. `scheduleSave()` (riga 8755) chiama `broadcastTradingStateNow()` a OGNI azione — ogni tick Live,
   ogni `update()`, ogni tasto. Quindi la madre bombarda la duplicata di `trading_sync`, e la
   duplicata perde la selezione in continuazione: il trascinamento parte su una posizione e si
   chiude su `active===null`.

Il DANNO ALLA MADRE ha la stessa radice, al rovescio: non c'e' nessuna barriera `PIP_SLOT` sul ramo
`trading_sync` (togliere la barriera e' stato voluto il 10 novembre, perche' il tablet deve poter
cambiare conto). Quindi ogni messaggio della figlia SOSTITUISCE l'array `positions` della madre con
oggetti nuovi, e azzera anche l'`active` DELLA MADRE: la riga verde in tabella si sgancia, le
caselle SL/TP si svuotano, le linee trascinabili cambiano stato. Chi guarda la madre vede «comportarsi
in maniera strana» senza aver toccato niente.

Terzo pezzo, per le posizioni REALI: `syncMt5PositionLevels(active)` (fondo di `setTradeLevel`) e'
l'unica strada che dice al broker il nuovo stop. Con `active` nullo non viene mai chiamata, quindi
lo stop non arriva mai a MT5 e il giro di lettura successivo della madre ri-annuncia il valore
vecchio: la linea torna indietro da sola.

DIFFERENZA UTILE PER RICONOSCERE IL DIFETTO: gli ORDINI PENDENTI si spostano bene, perche' il loro
ramo cerca per id (`pendingOrders.find(o=>String(o.id)===idStr)`, riga 24198) e non per
riferimento. Solo le posizioni aperte, che passano da `active`, si rompono.

CURA PROPOSTA (non ancora applicata): `active` non va tenuto per riferimento ma per id —
ri-agganciarlo dopo ogni applicazione (`active=positions.find(p=>p.id===idAttivo)`), e non azzerarlo
se l'id esiste ancora. In piu' una barriera «non applico mentre l'utente sta trascinando»:
`graficoOccupato()` esiste gia' a riga 8051 (`tradeLevelDrag` compreso) e NON e' usata da nessuno
dei rami di `tradingChannel.onmessage`.

### B. MESSAGGI SENZA BARRIERA (censimento fatto a riga 9233-9520)

| messaggio | barriera anti-rimbalzo | barriera «utente sta lavorando» |
|---|---|---|
| `trading_sync` | SI (`applyingRemoteTradingSync`) | **NO** |
| `drawings_sync` | SI (`applyingRemoteDrawingsSync` + stesso asset/modo + `assetSwitchInProgress`) | parziale |
| `asset_announce` → `applyRemoteAssetSwitch` | SI (`applyingRemoteAssetSwitch`) | **NO** (nessun `graficoOccupato()`) |
| `chart_time_sync` | SI (`applyingRemoteChartTimeSync`) | **NO** |
| `random_jump_sync` | SI (`applyingRemoteRandomJump`) | **NO** |
| `pip_clone_snapshot` | nessuna (ma e' una volta sola) | **NO** |
| il blocco `msg.conto` (prima di ogni tipo) | nessuna | **NO** |

Il blocco `if(msg.conto)` a riga 9246 gira PRIMA di sapere di che tipo e' il messaggio e puo'
innescare `switchAccountMode()` — che ricostruisce la sessione — in qualunque momento, anche a
metà trascinamento.

### C. PUNTO 4 — la terza finestra prende il conto vecchio. CAUSA LETTA NEL SORGENTE: vince chi
risponde per ultimo, e una duplicata in ritardo risponde con la stessa autorita' della madre.

Alla nascita una finestra manda due richieste (riga 9505 e 9511): `trading_sync_request` e
`pip_clone_request`. Alla prima risponde OGNI altra finestra (`broadcastTradingStateNow()`, riga
9331), non solo la madre. Il ricevente applica `msg.conto` senza confrontare niente: non guarda
`msg.at` (c'e' nel pacchetto, riga 8858, e non viene mai letto), non guarda `msg.slot`, non ha una
regola di precedenza. Quindi la terza finestra adotta il conto dell'ULTIMA risposta arrivata — e se
la duplicata 2 e' ancora sul conto vecchio, il conto vecchio e' quello che vince.
A `pip_clone_request` risponde solo la madre (`if(PIP_SLOT===0)`), ma manda `mt5CredsDraft`
(la bozza del modulo di accesso), non `mt5ContoAttivo` (il conto davvero attivo): sono due
variabili diverse, e `currentMt5AccountTag()` (riga 6074) usa la bozza come terzo ripiego. Una bozza
rimasta indietro fa dichiarare alla figlia un conto che la madre non usa piu'.

### D. DA MISURARE ANCORA (non letto, non provato)
- Punto 3 (il grafico resta piantato sul caricamento): non indagato in questa sessione.
- Punto 5 / voce 12 (elenco asset della SECONDA duplicata): la cura di `fblApplicaElencoAssetMadre`
  esiste e risponde solo la madre, quindi la seconda duplicata dovrebbe essere servita come la
  prima — da misurare con tre finestre, perche' il sintomo dice il contrario.

### E. MISURATO DAVVERO, E CORRETTO (12 novembre 2026, `app.html`, non ancora pubblicato)

**IL CAPPIO DI MESSAGGI FRA FINESTRE — la causa prima del punto 1 e, molto probabilmente, anche
del punto 3 e della voce 9.** Misurato con `banchi_aperti_forex/diag_tempesta_messaggi.mjs`, che
conta le chiamate e nomina il chiamante:

| | prima | dopo la cura |
|---|---|---|
| chiamate a `broadcastTradingStateNow()` sulla madre in 4 s | **11.508** | **20** |
| messaggi ricevuti dalla madre in 4 s | **5.753** | **9** |
| messaggi ricevuti dalla figlia in 4 s | **5.759** | ~9 |

Innescate da UN SOLO annuncio. Due finestre ferme, nessuno che tocca niente: ~1.400 messaggi al
secondo per finestra, per sempre, con `draw()` e `update()` ad ogni messaggio. E' questo che fa
«comportare in maniera strana il grafico, e anche sulla pagina madre».

CAUSA MISURATA (lo stack la nomina): `tradingChannel.onmessage` → `update()` → `scheduleSave()`
(riga 8760) → `broadcastTradingStateNow()`. La riga `try{ draw(); update(); }catch(e){}` del ramo
`trading_sync` stava FUORI dal `finally{ applyingRemoteTradingSync=false; }`, cioe' girava con la
barriera GIA' ABBASSATA; e `update()` finisce con `scheduleSave()`. La barriera c'era, il commento
che la spiega c'era: la scavalcava una riga fuori posto di un carattere.
CURA: quella riga e' entrata dentro il `try`, prima del `finally`.

**LA SELEZIONE AZZERATA A OGNI MESSAGGIO — il «non me le fa spostare».** Misurato dai banchi A, B,
C di `finestre_duplicate_tre.misura.test.mjs`. Il banco B e' la prova che si vede a occhio:
trascinando lo SL di una posizione aperta mentre arriva un messaggio, lo stop della posizione
restava **1,09** (invariato) e il prezzo finiva nella casella bozza: `casellaSl: "1.08500"`, con la
riga di stato «Stop Loss **preimpostato** a 1.08500 (si applica quando apri la posizione...)».
Nessun errore, nessun avviso: il gesto sembra riuscito e non ha spostato niente.
CAUSA MISURATA: `if(active&&!positions.includes(active))active=null;` — `positions` e' appena stato
sostituito con la copia strutturata arrivata dal canale, quindi `includes()` e' SEMPRE falso e
`active` cadeva a ogni messaggio. Stessa riga, stesso difetto, anche su `posSelezionata` (nel
disegno, riga 20294): la selezione dell'utente sul grafico.
CURA: `fblRiagganciaPosizione()` — si ri-aggancia per `id` (e per `mt5Ticket` per le reali) invece
di buttare la selezione. Una posizione davvero chiusa non c'e' piu' nell'elenco e la selezione cade
come prima.

ESITI: A, B, C da ROSSI a VERDI. Non-regressione provata, un banco per volta:
`conto_sincrono` (5/5), `clic_sul_grafico` (5/5), `pip_conto_madre` (2/2),
`disegni_fra_finestre` (5/5), `misura_isolamento_conto_mt5` (8/8).

### F. RIMISURATO IL 15 NOVEMBRE 2026 — due voci su quattro erano GIA' CURATE

ATTENZIONE a chi legge questa sezione: era rimasta indietro. Il banco che cita
(`finestre_duplicate_tre.misura.test.mjs`) NON ESISTE in nessun ramo del repository: le misure del
12 novembre vivevano solo come prosa qui dentro. E' la lezione gia' scritta in questo file - una
voce di diario non e' una prova che una cosa esista, lo e' un test. Il banco rifatto e committato
e' `laboratorio/app/finestre_tre_il_conto.test.mjs` (5/5).

- **D / D2 — il conto della terza finestra (punto 4). IL SINTOMO NON SI RIPRODUCE PIU'.**
  Rimisurato con tre pagine vere: la terza finestra prende il conto della madre in 6 giri su 6, e
  la traccia dice perche' - quando la terza nasce, la duplicata si e' GIA' allineata da sola alla
  madre, quindi al momento della nascita non c'e' piu' disaccordo. Le cure del 12-13 novembre
  (propagazione + guardia su `msg.at`) tengono. La prova resta come guardia di non-regressione.
  DUE CORREZIONI ALLE MISURE SCRITTE QUI SOPRA:
  (1) il numero «decine di risposte nei primi 23 ms» e' di PRIMA della cura del 12 novembre
      (sezione E, da 11.508 chiamate a 20): non descrive il codice di oggi;
  (2) anche la prima misura del 15 novembre era sbagliata, e va detto: contava le CHIAMATE a
      `broadcastTradingStateNow()`, non i messaggi spediti. Le chiamate sono 12 per 2 richieste,
      ma le barriere ne fermavano quasi tutte: i messaggi che usciranno davvero erano UNO.
      Contare le chiamate dava lo stesso numero prima e dopo qualunque cura.
  RESTAVA PERO' UN DIFETTO VERO, e quell'unico messaggio era lui: **chi applica un conto arrivato
  da fuori lo ri-annunciava.** Il blocco `if(msg.conto)` gira PRIMA del ramo per tipo, mentre la
  barriera anti-rimbalzo si alza solo dentro il ramo `trading_sync`: tutto il percorso che applica
  il conto (`mt5AttivaConto` -> `scheduleSave` -> broadcast, e `update()` nella coda asincrona del
  cambio conto) girava a barriera abbassata. E' il cappio previsto in questa stessa sezione: non
  e' infinito solo perche' si ferma quando le finestre vanno d'accordo, ma ogni cambio conto costa
  un giro di messaggi in piu' e un ridisegno su ogni finestra.
  **CURATO il 15 novembre** con `fblSenzaRiannunciare()`, che alza la barriera per il tempo
  dell'applicazione - coda asincrona compresa - e la rimette COM'ERA, non a `false` (il blocco puo'
  trovarsi annidato dentro un'altra applicazione; forzare `false` spalancherebbe la porta a meta'
  strada). Messaggi spediti: da 1 a 0. Non-regressione provata: `conto_sincrono` 5/5 nei DUE versi
  (la propagazione non si perde, perche' chi propaga e' la finestra dove l'utente ha cambiato
  conto, non chi riceve), `pip_conto_madre` 2/2, `disegni_fra_finestre` 5/5,
  `misura_isolamento_conto_mt5` 8/8, `posizioni_chiuse_tablet` 2/2.
- **La parte (a) della cura proposta — «risponde solo la madre» — NON e' stata fatta, di proposito.**
  Non serve piu' al conto (vedi sopra) e porterebbe un rischio nuovo: chiusa la finestra madre,
  nessuno risponderebbe piu' alla nascita di una finestra. Se un giorno servisse, va fatta con un
  ripiego («risponde una duplicata solo se la madre non ha risposto»), non con una barriera secca.

- **G — `sessionByMode` si porta dietro i DISEGNI. GIA' CURATA il 13 novembre 2026** (verificato
  nel sorgente il 15 novembre: la riga ora fonde e tiene i PROPRI disegni e il PROPRIO capitale,
  col commento che riporta la misura). Il testo qui sotto resta per la storia. Misurato:
  `if(msg.sessionByMode)sessionByMode=msg.sessionByMode` (riga 49449) sostituisce in blocco le
  quattro sessioni, e dentro ogni sessione ci sono `drawings` e `capital`. Una duplicata appena
  nata, che di disegni non ne ha, cancella quelli salvati della madre: nel banco da 3 a 0. E la
  madre (slot 0) poi li PERSISTE su disco. E' esattamente la regola che si voleva evitare
  («i disegni restano liberi per finestra»), rotta da una strada laterale.
- **F — il velo di caricamento non ha nessun tetto (punto 3).** Misurato: con il ponte che
  risponde «simbolo non trovato» e la conferma mai data, dopo 3 secondi `#fblCaricamentoAsset` e'
  ancora sopra il grafico e `fblCaricamentoAsset` e' ancora impegnato. Attenzione: nel banco la
  conferma e' forzata a non rispondere mai, quindi questo dimostra che **non esiste un tetto**,
  non ancora che sia quella la strada che il proprietario incontra. Il «rimane piantato» va
  riprodotto con il ponte vero prima di curarlo.
- **E — elenco asset: VERDE con tre finestre.** La voce 12 («solo la seconda duplicata») NON si
  riproduce sul banco: prima e seconda duplicata hanno lo stesso elenco e la stessa watchlist.
  Da riprovare col ponte vero: probabile che dipenda da QUANDO nasce la finestra (madre non ancora
  pronta) piu' che da quante ce ne sono.

---

## 12 novembre 2026 — STORICO E JOURNAL DI ALTRI CONTI (voce 2 di RICHIESTE-12-NOVEMBRE-SERA)

Parole del proprietario: «mi rimangono tutte le posizioni, lo storico nel grafico di tutti quanti
gli account... Quello che mi deve far vedere e' la cronostoria soltanto di quello specifico account
a cui sono collegato. Stop.»

La v2.2.28 ha curato le POSIZIONI APERTE (`positionBelongsToCurrentView`). Questa voce riguarda
**journal, storico, P/L ed equity**, che passano da altre tre strade.


BANCO: `storico_un_solo_conto.misura.test.mjs` (fuori dal repo, in `Documenti\banchi_aperti_forex`,
perche' rosso). Due conti MT5 (A=11111 con 2 operazioni chiuse, B=22222 con 3) piu' DUE operazioni
SIMULATE senza conto addosso, come controllo.

### LE MISURE (12 novembre 2026)

| scenario | righe Journal | di A | di B | storico a grafico | statistiche | P/L totale |
|---|---|---|---|---|---|---|
| collegato ad A (11111)  | 7 | 2 | **3** | 2 (giusto) | 2 (giusto) | 30 (giusto) |
| collegato a B (22222)   | 7 | **2** | 3 | 3 (giusto) | 3 (giusto) | 1200 (giusto) |
| collegato, conto ignoto | 7 | **2** | **3** | **5 (i due conti)** | **5** | **1230 = A+B** |

Le due operazioni simulate restano visibili in tutti e tre gli scenari (controllo VERDE: nessun
filtro le sta cancellando — e' la trappola del 10 novembre, sei banchi rossi in un colpo).

### I QUATTRO PUNTI, con i numeri di riga

**A. IL TRADE JOURNAL NON FILTRA PER CONTO. MAI.** (riga 14694)
`trades.map(...).filter(({t})=>journalTradeMatchesFilter(t,journalModeFilter)&&...)`, dove
`journalModeFilter` e' il valore della tendina `#journalModeFilterSelect` (riga 14681) e **parte su
`all`**; `journalTradeMatchesFilter` (riga 5191) comincia con `if(!f||f==='all')return true`.
Il Journal non sa nemmeno che esiste un conto collegato: `tradeBelongsToCurrentView` non entra qui.
Misurato: collegato ad A si leggono **3 righe del conto B**, col loro badge «MT5 …2222» e il loro
profitto. E' letteralmente «la cronostoria di tutti quanti gli account». La tendina esiste e
funziona: e' il VALORE DI PARTENZA che e' sbagliato — deve essere il conto collegato, non «Tutte».

**B. STORICO A GRAFICO E STATISTICHE: il ripiego `!login||`** (righe 6202 e 6228)
- `tradeBelongsToCurrentView`: `return t.mt5Ticket!=null&&(!login||t.mt5Login==null||String(t.mt5Login)===login);`
- `statsTrades`: `return list.filter(t=>t.mt5Ticket!=null&&(!login||String(t.mt5Login||'')===login));`

Quel `!login||` vuol dire: **se non so quale conto e' collegato, passano tutte**. E' lo stesso pezzo
che l'11 novembre e' stato tolto da `positionBelongsToCurrentView` (riga 14212) con la motivazione
«meglio nessuna che quelle di un altro» — nelle due funzioni gemelle e' rimasto.
Misurato nello scenario «conto ignoto»: 5 operazioni di due conti a grafico, e **P/L totale 1230,
cioe' la somma dei due conti** (30 di A + 1200 di B). Lo stesso ripiego sporca `closedPL()`
(riga 27353), e da li' il capitale mostrato.
Lo stato «collegato + conto ignoto» non e' teorico: e' la finestra duplicata appena nata, gia'
misurata in `posizioni_un_solo_conto`.

**C. IL RIALLINEAMENTO DELLO STORICO RISCRIVE IL JOURNAL DI UN ALTRO CONTO** (riga 45195,
`mt5RiallineaTradeNoti`) — il piu' grave: non e' una vista sporca, **modifica i dati salvati**.
`const perTicket=new Map((deals||[]).map(d=>[String(d.positionId),d]));` poi
`trades.forEach(t=>{ if(!t||t.mt5Ticket==null)return; const d=perTicket.get(String(t.mt5Ticket)); if(!d)return; ... })`
L'abbinamento e' **solo per numero di ticket**, senza guardare `t.mt5Login`. Due broker hanno
numerazioni indipendenti: il ticket 101 esiste su MetaQuotes e su FTMO. Collegandosi a B, lo storico
di B riscrive l'operazione di A con lo stesso numero, e `scheduleSave()` la persiste.
Misurato, con UNA sola riga di storico del conto 22222: operazione del conto 11111 riscritta
`entry 1.1 -> 1.5`, `exit 1.102 -> 1.4`, `pl 10 -> -9999`. Un profitto di 10 del conto A diventa
una perdita di 9.999 del conto B, nel Journal, per sempre.
Stesso difetto nella deduplica di `runMt5HistoryCatchUp` (riga 45168):
`const alreadyKnown=new Set(trades.filter(t=>t.mt5Ticket!=null).map(t=>String(t.mt5Ticket)));` —
senza il conto, un'operazione VERA del conto B viene scartata come «gia' nota» perche' A ha quel
numero: quella non la si vede proprio sul conto giusto.

**D. L'EQUITY NON HA UN CONTO.** (`equity.push`: righe 28635, 45265, 56224)
Le sessioni separate sono quattro (`statsBaselineByMode`, riga 5998: backtest / live /
backtest_propfirm / live_propfirm) e **nessuna delle quattro distingue il conto MT5**. Misurato:
`equity.length` resta 7 passando da A a B, cioe' la curva contiene le operazioni di tutti e due.
Le posizioni aperte hanno il loro parcheggio per conto (`mt5Parcheggio`); la curva di equity, la
linea di partenza delle statistiche e il capitale no.

STATO: MISURATO, banco rosso, NON curato (altro agente lavora su indicatori e Prop Firm; questa
voce tocca journal/storico/posizioni e va curata con il banco qui sopra come arbitro).
Da NON riaprire: nascondere i trade senza `mt5Login` — farebbe sparire voci storiche legittime e le
operazioni simulate del backtest in Live. Il filtro deve scartare **chi dichiara un conto diverso**,
non chi non dichiara niente.

---

## 12 novembre 2026 — LE LINEE DI ENTRATA / STOP / TARGET SI PRENDONO SOLO AI BORDI

Richiesta del proprietario, voce «ordine limite»: «quando c'e' un ordine limite devo avere la
possibilita' di spostarlo, anche se l'ordine pendente viene creato da una sala segnali: posso
spostare la linea di entrata del buy limit e del sell limit». Seconda voce: «quando apro una
posizione e poi vado a toccare lo stop loss o il take profit, e vado a spostare le linee, o le
seleziono, mi deve uscire l'etichetta del rapporto rischio-rendimento».

### MISURA 1 — la fascia utile vera, in pixel (banco `diag_fascia_linee.mjs`)

Finestra 1300x850, tela del grafico **1234 px**, `pad.l=18`, `pad.r=76` → area di plot
**1140 px** (x da 18 a 1158). Un ordine pendente `LIMIT` dell'asset a grafico, una posizione
aperta con stop e target. Si spazza l'asse X alla quota Y di ogni linea e si chiede a
`tradeLevelHit()` se risponde:

| linea | x che rispondono | px utili | % dell'area di plot |
|---|---|---|---|
| pendente — ENTRATA | 0–178 | **141** | 12,4% |
| pendente — STOP | 1018–1158 | **141** | 12,4% |
| pendente — TARGET | 1018–1158 | **141** | 12,4% |
| posizione aperta — STOP | 431–1013 | **583** | 51% |
| posizione aperta — TARGET | 431–1013 | **583** | 51% |

**La fascia morta dell'ordine pendente e' x 159–1017, cioe' 859 px: il 75% del grafico.** Le tre
linee del pendente sono disegnate da `pad.l` a `w-pad.r` (tutta la larghezza, riga ~24623 e
~24653) ma rispondono solo nei primi 160 px a sinistra (entrata) e negli ultimi 140 a destra
(stop e target), righe 25519–25523. Tolleranza verticale 14 px. La posizione aperta non ha questo
problema perche' la sua fascia e' la **casella Target/Stop**, che si vede (`zoneBoxXRange`:
xOrigin 444, xRight 1000) e si allunga da sola fino all'ultima candela.

CAUSA VERA: la fascia dell'ordine pendente e' scritta a numero fisso (160 / 140 px dai bordi) e
non e' legata a niente di visibile. Chi guarda vede una linea tratteggiata lunga 1140 px e non ha
modo di sapere che ne risponde un ottavo.

**E. LA GUARDIA SUL CONTO FRA FINESTRE E' INCOMPLETA** (`fblApplicaStatoTrading`, righe 53486-53512)
`_stessoContoMt5` protegge `positions`, `pendingOrders` e `trades`. Ma le tre righe subito dopo
stanno **fuori** da quella guardia:
- riga 53490 `equity=Array.isArray(msg.equity)?msg.equity:equity;`
- riga 53500-53511 il blocco `if(msg.sessionByMode){...} sessionByMode=_nuove;`
- riga 53512 `if(msg.statsBaselineByMode)statsBaselineByMode=msg.statsBaselineByMode;`

Misurato: una finestra sul conto B (22222) manda il suo stato a una finestra sul conto A (11111).
Posizioni e operazioni vengono respinte giustamente, ma passano **tre strade**:
`equity [10000,10010] -> [50000,40000,30000]`, `sessione Live parcheggiata [] -> [{suaB}]`,
`linea di partenza delle statistiche 0 -> 7`.
La terza e' la piu' insidiosa: `statsBaselineByMode.live` e' l'indice da cui si contano capitale,
P/L e win rate. Portato a 7 dal conto dell'altra finestra, **le prime 7 operazioni del conto A
scompaiono dalle statistiche** senza che niente lo dica, e con loro il capitale.
Banco: terzo controllo di `storico_un_solo_conto.misura.test.mjs`
(«una finestra su un altro conto non deve sovrascrivere equity e sessioni»).

### LE CURE PROPOSTE, minime, nell'ordine in cui conviene farle

1. **C** (`mt5RiallineaTradeNoti`, riga 45195): confrontare anche il conto —
   `if(t.mt5Login && String(t.mt5Login)!==String(loginAttuale)) return;` prima di cercare il
   ticket, e la chiave della deduplica di `runMt5HistoryCatchUp` da `ticket` a `login+'#'+ticket`.
   E' quella che riscrive dati salvati: va prima di tutte.
2. **E**: spostare le tre righe dentro `if(_stessoContoMt5){...}`.
3. **B**: togliere `!login||` da `tradeBelongsToCurrentView` e da `statsTrades`, esattamente come
   l'11 novembre in `positionBelongsToCurrentView`. Il controllo sulle operazioni simulate del
   banco e' li' proprio per questo: `t.mt5Login==null` deve continuare a passare.
4. **A — NON SI FA PIU'.** Il proprietario ha precisato il 12 novembre, rispondendo a una mia
   domanda: «la cronostoria intendo **sul grafico e non sul journal**, sono due cose diverse. Se
   sono collegato con l'account 1 non posso vedere le posizioni chiuse dell'account 2 **a
   grafico**, ed e' come funziona su qualsiasi piattaforma di trading». Il Journal resta lo
   storico completo con la sua tendina: cambiare il valore di partenza non e' richiesto, e
   sarebbe anche la strada con la trappola misurata qui sotto (un filtro per conto cancella le
   operazioni simulate). Restano da fare C, E e B - e di B conta soprattutto la faccia che
   decide cosa si DISEGNA (`tradeBelongsToCurrentView`), che e' esattamente la richiesta.

### LA TRAPPOLA DELLA CURA DI «A», misurata e messa nel banco
La cura ingenua — mettere la tendina su `mt5:<login>` — **cancellerebbe le operazioni simulate**:
`journalTradeMatchesFilter` con un filtro `mt5:...` comincia con `if(t.mt5Ticket==null)return false`
(riga 5193). E' la trappola del 10 novembre in un'altra forma. Serve quindi un valore di partenza
NUOVO («il conto collegato») che significhi «questo conto **piu'** quello che non dichiara nessun
conto», non il filtro per conto che c'e' gia'.
Il banco e' scritto perche' lo faccia notare da solo: NON forza il valore della tendina, legge
quello che l'app mette, e pretende insieme «zero righe di altri conti» **e** «2 operazioni
simulate visibili». Misurato oggi: `filtroDiPartenza=all` in tutti e tre gli scenari, e la tendina
non viene salvata da nessuna parte (nessun `localStorage`, nessun ripristino di sessione: un solo
`addEventListener` alla riga 58404) — quindi a ogni riapertura si torna a vedere tutti i conti.

### NON CURATO IN QUESTA SESSIONE, e perche'
`tradeBelongsToCurrentView` e `statsTrades` sono lette da decine di banchi, e il 10 novembre un
filtro piu' severo su quelle strade ne ha fatti cadere sei in un colpo. Una modifica li' va
verificata con il collaudo INTERO, che in questa sessione non si poteva lanciare (il proprietario
lavorava sulla stessa macchina) e con altri agenti dentro lo stesso `app.html`. Il banco rosso e le
quattro cure sono pronti; chi le applica deve avere `collauda.sh` verde davanti.

---

## FASCIA DEI RIQUADRI IN SCHERMO INTERO (`#fblMiniDash`) — 12 novembre 2026

### MISURA DI PARTENZA (fatta prima di toccare qualunque cosa)
Banco di misura: `laboratorio/app/diag_minidash.mjs` e `diag_minidash2.mjs` (fuori dal repo: sono
misure, non banchi).

Quello che c'era nella fascia, in quest'ordine: **P/L live, Capitale, Win rate, Loss rate,
Margine libero**. Da dove vengono:
- `P/L live` e' l'unico RICALCOLATO dalla fascia (`floatingPL()`, o `krakenConto.pnl_aperto` sul
  conto Kraken): e' la SOMMA di tutte le posizioni aperte.
- `Capitale`, `Win rate`, `Loss rate`, `Margine libero` sono **testo copiato** da `#mCapital`,
  `#mWR`, `#mLR`, `#mMargin` della dashboard principale. La fascia non li calcola.
- Si riaggiorna da sola ogni **1 secondo** (`setInterval` accanto a `fblMiniDashAggiorna`), piu'
  una volta a ogni `fblMiniDashMostra()`.
Misurato: `{"voci":["P/L live","—","Capitale","€10.000","Win rate","—","Loss rate","—",
"Margine libero","—"]}`. Togliere Win rate e Loss rate non rompe la copiatura degli altri due:
ogni voce e' una coppia indipendente nella griglia, `testo(id)` ritorna `—` per gli id assenti.

### `active` E `posSelezionata`: SONO DUE COSE DIVERSE, misurato
- clic sulla **freccetta** della posizione o sul suo corpo -> `focusPosition()` -> mette **tutte
  e due** (`{active:"P1", sel:"P1"}`).
- clic sulla **linea di stop o di target**: solo al SECONDO clic (quando la linea e' gia' armata)
  -> mette tutte e due (riga 25487).
- **apertura** di una posizione (a mercato, o pendente che scatta) -> mette **solo `active`**
  (`{active:"P1", sel:null}`). Lo stesso vale al ripristino di sessione e alla chiusura di
  un'altra posizione, dove `active` viene riassegnata dall'app da sola.
Il proprietario ha chiesto la fascia in TUTTI E DUE i casi («quando apriamo una posizione **o** la
selezioniamo»), quindi la posizione da mostrare e' `posSelezionata || active`, **riagganciata**
con `fblRiagganciaPosizione()` e scartata se non e' piu' in `positions` (una posizione chiusa non
deve restare nel pannello coi pulsanti vivi).

### DIFETTO A, GIA' PRESENTE E NON SEGNALATO: in schermo intero di RIPIEGO la fascia non c'e'
`toggleMainChartFullscreen()` ha due strade: quella nativa (`requestFullscreen`) e il **ripiego
CSS** (`fblEntraSchermoInteroCss`, classe `fbCssFullscreen`) che si accende quando il fullscreen
nativo rifiuta o non risponde — cioe' **l'app desktop con piu' finestre aperte**, il caso per cui
il ripiego e' stato scritto (vedi `schermo_intero_madre.test.mjs`).
La strada nativa passa dal gestore `fullscreenchange`, che chiama i sei `move*IntoSidebar()`.
Il ripiego CSS **non ne chiama nessuno**: misurato su pagina pulita
`{"cssAttivo":true,"miniDash":false,"sidebarAttiva":false,"resetViewDentro":false}`.
Quindi in quel caso non ci sono ne' la fascia, ne' la barra degli strumenti di disegno, ne'
«Torna all'ultima candela» dentro la barra laterale. **Non curato in questa sessione**: i sei
spostamenti sono territorio di altri agenti (indicatori, barra replay) e una cura va fatta in un
punto solo, con il collaudo intero davanti.

### DIFETTO B, misurato: il «Chiudi» della tabella NON chiede conferma su conto simulato
Gestore di `#openPositions`, ramo `closeId`: per una posizione con `mt5Ticket` la conferma
arriva da dentro `closeMt5PositionReal` (ed e' una conferma vera, col ticket e i lotti); per una
posizione **simulata** si va diretti in `closeTrade('MANUAL',...)`, **senza nessuna domanda**.
In tabella e' tollerabile (il pulsante sta in fondo a una riga lunga); nella fascia a schermo
intero no: il pulsante e' grande, sta sotto il dito e il grafico e' a tutto schermo. Nella fascia
la conferma si chiede **sempre**, prima di qualunque cosa, e nomina la posizione.

### MISURA 2 — l'ordine nato da un segnale: non e' quella la seconda strada (banco `diag_pendente_segnale.mjs`)

Si temeva che un pendente nato da una sala non passasse `drawableOnCurrentChart` e non fosse ne'
disegnato ne' agganciabile. Misurato, stato per stato (ordine LIMIT sull'asset a grafico, con
`tgSala`/`tgGruppo`/`tgSegnaleId` addosso):

| stato | disegnabile | px agganciabili sull'entrata |
|---|---|---|
| segnale SIMULATO, MT5 staccato | si | 179 |
| segnale REALE su MT5 (ha ticket), MT5 collegato | si | 179 |
| segnale SIMULATO, conto Storico | si | 179 |
| **segnale SIMULATO, MT5 COLLEGATO** | **no** | **0** |
| segnale REALE di un ALTRO conto, MT5 collegato | no (giusto) | 0 |
| a mano, SIMULATO, MT5 collegato | no | 0 |

CONCLUSIONE: **la sala segnali non c'entra**. Nella configurazione vera del proprietario (MT5
collegato, sessione Live) `reale=!!mt5Connected&&sessioneLive` e' vero, quindi il segnale passa da
`placeRealMt5PendingOrder`, l'ordine ha un `mt5Ticket` e si disegna e si aggancia come gli altri:
**179 px, gli stessi di un ordine fatto a mano** — cioe' il difetto e' UNO SOLO, la fascia stretta.

RESTA UN DUBBIO, misurato ma NON curato qui (e' il territorio dell'isolamento per conto, v2.2.28):
un pendente SIMULATO con MT5 collegato sparisce del tutto dal grafico, perche'
`positionBelongsToCurrentView` pretende `mt5Ticket!=null`. Succede a chi crea il pendente con MT5
staccato e poi si collega. Un ordine pendente simulato non e' «di un altro conto»: la regola
dell'isolamento gli si applica per inerzia. Da decidere con chi tiene quella funzione.

### MISURA 3 — l'etichetta del rapporto rischio/rendimento non esiste a grafico

`computeRRRatio()` (riga ~27820) esiste e alimenta il riquadro «R/R», ma usa `active.sl`/`active.tp`,
che durante il trascinamento **non cambiano**: il valore vero si scrive solo al rilascio
(`setTradeLevel`). Il cartellino dell'anteprima (riga ~24957) scrive solo
`previewLabel+'? '+fmtPrice(prezzo)`. Misurato col banco: toccando lo stop non compare nessuna
scritta col rapporto, e durante il trascinamento a 79800 la tela riceve `"SL? 79800.00000"` —
prezzo si', rapporto no.

### BANCO (rosso prima della cura)

`C:\Users\pietro\Documents\banchi_aperti_forex\linee_trade_fascia_e_rr.test.mjs`
4 prove: A (le tre linee rispondono al 10/25/50/75/90% della larghezza), A2 (a meta' grafico il
primo tocco arma l'entrata), B (toccando lo stop compare «1:2»), B2 (trascinandolo a 79800 il
cartellino dice «1:4»). Prima della cura: 4 rosse su 4.


### IL PASSO A FRECCIA PERDEVA L'ANNUNCIO: IL THROTTLE SCARTAVA IL GESTO (16 novembre 2026)

MISURATO dal banco `laboratorio/app/passo_frecce_finestre.test.mjs`, prova «IL PRIMO BUCKET»:
premendo il tasto avanti sulla madre (M1) la madre andava a 08:32 e la duplicata D1 restava a
08:31. Con una spia dentro le due pagine vere: `fblAnnunciaReplay('istante', 1794317520000, ...)`
veniva chiamata una volta sola, `fblReplayPerTutte` era true, `tradingChannel` esisteva - e
`tradingChannel.postMessage` **non veniva mai chiamata**. Il valore `fblReplayUltimoInvioMs` era
stato scritto 11-15 ms prima del click, e il ramo `modo==='istante'` usciva sul throttle da
`FBL_REPLAY_OGNI_MS` (30 ms).

LA CAUSA: il throttle esiste per lo SCORRIMENTO (a moltiplicatore alto il battito pubblica piu'
volte al secondo), ma il passo a freccia passava dallo stesso ramo: un GESTO veniva scartato come
se fosse un fotogramma. Non era teoria e non era raro: bastava premere avanti entro 30 ms da un
annuncio, e una finestra restava indietro di una candela. QUALE annuncio, lo dice la spia: quello
del **click precedente** (11-15 ms prima), non il battito - il battito gira ogni
`FBL_REPLAY_OGNI_MS` e non e' lui ad aver scritto il segnaposto in quei millisecondi.

LA CURA: `fblAnnunciaReplay(modo, t, sempre)` - il throttle vale solo se `sempre` e' falso;
`fblReplayPasso(segno, continuo)` annuncia con `!continuo`; `forward(silenzioso)` passa
`!!silenzioso`, quindi il battito (`forward(true)`, righe 32698 e 32721) resta strozzato e i gesti
no. Il gesto aggiorna comunque il segnaposto, altrimenti il battito che riparte subito dopo
pubblicherebbe due volte di fila.

MISURA: banco `passo_frecce_finestre.test.mjs` da **10 rosse su 10** a **10 verdi** (0 fallimenti,
123 s). Banchi replay collegati verdi: `replay_fra_finestre`, `replay_stop_armato`,
`replay_scatto_dentro_la_candola`, `frecce_replay_navigate`, `replay_footprint`.

NOTA SU UN BANCO VECCHIO: `replay_su_tutte_le_finestre.test.mjs` pretendeva che il PRIMO STOP
uscisse dal replay. Dal 16 novembre la regola e' «STOP pausa dove si e', PLAY riparte dallo stesso
secondo»: la prova e' stata riallineata (primo STOP = pausa propagata sullo STESSO istante,
secondo STOP = uscita propagata a tutte), non cancellata.


### IL PASSO SU UNA CANDELA MENSILE FACEVA 30 GIORNI FISSI, E IL TETTO IN AVANTI FERMAVA TUTTE (17 novembre 2026, v2.2.62)

Due difetti dello stesso pezzo di codice, `fblReplayPasso`, trovati misurando il passo a freccetta
sui time frame alti e sul bordo dei dati.

**1) IL MESE NON E' 30 GIORNI.** `replaySecondsPerBar()` vale `currentTF*60` secondi, quindi sul
time frame mensile (43200 minuti) il passo era **30 giorni fissi**. Ma la candela mensile non dura
30 giorni: `fblInizioBucket` per `minutes>=FBL_TF_MESE` usa i **mesi di calendario** (28-31 giorni).
MISURATO partendo dal primo del mese, che e' lo stato vero della candela sul grafico: `1 gennaio +
30 giorni = 31 gennaio`, cioe' **ancora gennaio** - la candela non avanzava in 7 mesi su 12; e
`1 febbraio + 30 giorni = 3 marzo`, saltando febbraio. Un passo **indietro** dal 1° gennaio finiva
addirittura a dicembre (idx 24 -> 23) e sulla candela di febbraio usciva un mese intero sbagliato.
Partendo dal 15 del mese il difetto si nascondeva (15 gennaio + 30 = 14 febbraio, che per caso e'
il mese giusto): il primo banco che avevo scritto partiva da li' e i numeri dicevano «0 mesi su 12»
- era il banco a non misurare, non il codice a essere sano.

LA CURA: `fblReplayPassoIstante(da, segno)` - per i time frame normali la durata resta quella
(`da ± tf*60000`, invariato); per il mensile si va al mese di calendario dopo (o prima) e ci si
mette alla **stessa altezza dentro il mese**; se il giorno non esiste (31 gennaio -> febbraio) ci si
ferma dentro il mese, all'ultimo istante utile: la candela avanza di **una** e non ne salta mai due.
`fblReplayPasso` e `fblReplayUnaCandela` (il ciclo dell'autorita') usano tutti e due la nuova
funzione, altrimenti il ciclo girava a vuoto sui mesi da 31 giorni.

MISURA: banco nuovo `passo_mensile_replay.test.mjs`, 3 prove - dodici passi in avanti (uno per mese
del 2026, ognuno deve mostrare il primo del mese dopo), undici indietro, e il caso peggiore 31
gennaio -> febbraio. **Rosso sul codice vecchio** con gli errori esatti («dal mese 1 un passo deve
mostrare 2026-02-01, invece mostra 2026-01-01»; «dal mese 3 indietro deve mostrare il mese prima,
invece mostra 2026-01-01»; «dal 31 gennaio si deve finire a febbraio, non il 2026-03-01»), **verde
dopo la cura**. Il banco porta una **prova di controllo**: conta quanti mesi sbaglierebbe la formula
a 30 giorni fissi e pretende che siano almeno 6 su 12 (ne conta 7) - se un giorno tornasse a zero,
vorrebbe dire che il banco non sta piu' misurando niente.

**2) IL TETTO IN AVANTI FERMAVA TUTTE.** `fblReplayPasso` chiudeva con `if(t>ultimaT)t=ultimaT`.
Quando la finestra che preme e' gia' sull'ultima sua candela, l'istante veniva riportato indietro
all'ultima candela: quella finestra **non avanzava e non usciva**, e annunciava quell'istante alle
altre, che quindi **restavano ferme anche loro**. Il replay condiviso si bloccava in silenzio, che e'
il «si ferma» del proprietario. La regola del 16 novembre e' l'opposto: chi non ha piu' dati **esce
da solo, in silenzio**, e le altre continuano; il ramo che fa uscire c'era gia' in
`fblReplayApplicaIstante`, mancava solo che l'istante richiesto le arrivasse.

LA CURA: via il tetto in avanti (indietro resta il fermo sulla prima candela vera), e l'istante
**richiesto** viene annunciato **prima** di consumare le candele. L'ordine conta e l'ho sbagliato la
prima volta: annunciando dopo, l'uscita (che avviene dentro il ciclo) spegne `fblReplayPerTutte` e
l'annuncio non partiva piu' - misurato: la duplicata restava ferma sull'istante vecchio.

MISURA: banco nuovo `passo_fine_dati.test.mjs` - madre con 30 candele da un minuto, duplicata con
500, replay condiviso avviato sull'ultima candela della madre, **un** passo: la madre esce
(`inReplay:false`) e la duplicata mostra l'istante richiesto (+60 s) restando in replay. **Rosso sul
codice vecchio** («la finestra senza piu' dati deve uscire dal replay, invece resta dentro»),
**verde dopo**. Trappola gia' pagata, ricaduta qui: l'istante di partenza va calcolato **dentro la
pagina** (`parseDateTime`), non in UTC fuori - il primo giro cadeva sul minuto sbagliato.

Verificati verdi dopo la cura anche i dieci banchi replay che c'erano: `passo_frecce_finestre`,
`replay_fra_finestre`, `replay_stop_armato`, `replay_su_tutte_le_finestre`, `replay_live`,
`frecce_replay_navigate`, `replay_fluido`, `countdown_candela_replay`, `replay_posizioni`,
`replay_stop`.

## 24 novembre 2026 — «ACCOUNT E CONNETTI NON RISPONDONO»: ERA UN'ATTESA SENZA FINE

SEGNALATO dal proprietario: «il pulsante account e connetti non rispondono, non mi permettono di
collegarmi a MT5», «me lo fa solo sul PC, sul tablet funziona tutto correttamente», e alla domanda
«si apre la finestra di login o non succede nulla?» → **«non succede nulla»**.

**TRE CAUSE SBAGLIATE, SCARTATE UNA A UNA CON LE MISURE** (vale piu' di una causa giusta
indovinata, perche' sono tre strade che non vanno ripercorse):

1. **Non era la cache del service worker.** `CACHE_NAME` era rimasto a `v2.2.114` dopo la
   riscrittura di `app.html` delle 21:58, e sembrava la spiegazione ovvia. MISURATO leggendo il
   `CacheStorage` del WebView vero
   (`C:\Users\pietro\.forexbacktestlab\webview_profile\EBWebView`): la voce
   `http://127.0.0.1:8000/app.html` aveva `content-length` **6.144.172** e SHA256
   `3DD52A0F…8A7481`, **identico** al file su disco. La copia vecchia (6.128.400 byte) non c'era
   da nessuna parte. **Il bump della cache non c'entrava niente**: resta una cosa da fare per sua
   conto, non una cura per questo difetto.
2. **Non era `/mt5-launch` contro `/connect`.** Il ponte rispondeva 400 «Non connesso», il feed
   8001 diceva `connected_to_broker=true`: sembrava lo stesso disallineamento del 19 novembre.
   MISURATO: era un **`[Disconnect]` manuale alle 22:08:40** premuto dal proprietario stesso
   (confermato da lui). Lo stato era coerente, non rotto.
3. **Non era il click che non arrivava.** Sospetto di un velo invisibile sopra al pulsante.
   MISURATO sulla pagina viva: `mt5ModeBtn` **113x30 px**, `display:block`, `visibility:visible`,
   `pointerEvents:auto`, e `document.elementFromPoint` al suo centro restituiva
   **`BUTTON#mt5ModeBtn`** — il click arrivava a destinazione, e i tre gestori erano attaccati
   (`click:1` ciascuno).

**LA CAUSA VERA, MISURATA.** Nel WebView dell'app installata
`handle.queryPermission({mode:'readwrite'})` **non si conclude mai**: non risponde `'granted'`,
non risponde `'prompt'`, non lancia un errore — la promessa resta **pendente**. Misure prese
leggendo la pagina viva dalla porta di debug, senza cambiare una riga:

| cosa | esito misurato |
|---|---|
| riferimento alla cartella in IndexedDB | **presente**, `name=applicazione`, `kind=directory` |
| `queryPermission({mode:'readwrite'})` | **non si conclude** (oltre 4 s, pendente) |
| `queryPermission({mode:'read'})` | **non si conclude** |
| `refreshMt5AccountsUI()` | **non si conclude** (misurato **6006 ms**, pendente) |
| banner «Ricollega la cartella» | `display:none` — non si mostrava nemmeno lui |

Il costo: **entrambe le voci del menu MT5 mostrano la loro roba solo DOPO aver letto la cartella.**
`«Account»` fa `await refreshMt5AccountsUI()` e **poi** `section.style.display='block'`;
`«Connetti»` fa `await mt5ScegliConto()`, che **comincia** con `await refreshMt5AccountsUI()`. Una
promessa che non si conclude le lascia entrambe a meta': nessun errore in console, **nessuna riga
nei log del ponte** (ed e' per questo che dopo le 21:58 non si vedeva nessun `POST /connect`: non
veniva mai tentato), e da fuori «non succede nulla».

**PERCHE' SOLO SUL PC.** Sul tablet la cartella non si usa affatto — archivio interno
(`fblMobileCredsHandle`, vedi `getMt5CredsDirHandle`): nessuno chiede quel permesso, quindi niente
si appende. Il «funziona sul tablet» non era un indizio contro l'ipotesi del permesso: era la sua
conferma.

**LA CURA.** Una risposta che non arriva vale «non lo so», non «aspetta per sempre».
`fblPermessoConTimeout` mette un tetto di **`FBL_PERMESSO_TIMEOUT_MS = 1500`** su
`queryPermission` e `requestPermission`; il ripiego e' la stringa `'timeout'`, che **non e'**
`'granted'`, quindi non concede niente per sbaglio. In piu' la voce `«Account»` **apre la sezione
prima** e rilegge la cartella dopo: nel caso peggiore si vede una tendina vuota per un istante,
invece di un pulsante che non fa niente.

**MISURA:** banco nuovo `laboratorio/app/permesso_cartella_non_risponde.test.mjs`, 3 prove, con una
cartella finta le cui `queryPermission`/`requestPermission` **non si concludono mai** (`new
Promise(() => {})`) — la condizione misurata sul PC. **Rossi sul codice vecchio** tutti e tre, con
gli errori esatti: «verifyDirPermission non si e' conclusa entro 5 s», «la sezione dei conti non si
e' aperta: il pulsante Account e' rimasto muto», «la finestra di login non si e' aperta: Connetti e'
rimasto muto, come sul PC». **Verdi dopo la cura.**

**TRAPPOLA PAGATA DENTRO IL BANCO, DA NON RIPETERE.** Al primo giro il terzo test era **verde per
sbaglio**: preparava la pagina con `globalThis.mt5TerminalConfirmedBefore = true`, ma nell'app quella
e' una **`let`** di primo livello, e un `let` globale **non diventa una proprieta' di `globalThis`**.
Si creava una variabile nuova, l'app continuava a leggere la sua (`false`), e il test provava la
strada del **primo accesso** — che apre il login subito e non passa mai dalla cartella. Le
assegnazioni del banco vanno fatte **a nome nudo** (`mt5TerminalConfirmedBefore = true`), che trova
il legame vero nello spazio globale. Un test verde sulla strada sbagliata e' peggio di un test rosso.

**IN SOSPESO su questo difetto:** la cura e' nel repo (`app.html`), **non** nella copia installata
`app_aggiornata\app.html` del proprietario, che non va toccata senza una sua decisione. Finche' non
la aggiorna lui, sul suo PC i due pulsanti restano muti e la via per collegare MT5 e' la finestra di
login aperta a mano. Nota a parte, non legata a questo difetto: il processo WebView gira con
`--remote-debugging-port=9222` aperta — e' la porta da cui sono venute tutte queste misure, ma
chiunque sul PC puo' collegarsi e leggere la sessione.

## 24 novembre 2026, sera — RISOLTO (vedi la voce in fondo): «MERCATO CHIUSO» DETTO CON IL MERCATO APERTO

**MISURA (non un sospetto).** Leggendo `#status` sulla pagina viva del WebView, **alle 22:40 circa**
del 24 novembre, la scritta era:

> 🌙 Mercato chiuso: grafico salvato e fermo. Si ricollega da solo a MT5 alla riapertura (00:00).

**Il mercato NON era chiuso.** Il proprietario: «il mercato non è chiuso, chiude alle 23:00 su
questo broker». Quindi la scritta era **sbagliata di una ventina di minuti**, e diceva anche una
riapertura (00:00) che non era quella vera.

**LA REGOLA GIUSTA, DETTA DAL PROPRIETARIO** (e questo difetto «sembrava essere risolto», quindi e'
una **ricaduta**): il mercato si dichiara chiuso **solo** quando si verificano **insieme**

1. **non arrivano piu' aggiornamenti** dei dati delle candele, **e**
2. il confronto fra **l'ora di apertura e di chiusura di quel singolo asset su quel broker** e gli
   orologi del broker torna «chiuso» — e **gli orologi cambiano col tipo di broker**, quindi non si
   puo' usare l'ora locale del PC ne' una sola tabella per tutti.

**~~L'IPOTESI DA MISURARE~~ IPOTESI POI SMENTITA DALLE MISURE (vedi la correzione in fondo).** Alle **22:08:40** c'e' stato un `[Disconnect]`
manuale di MT5 (premuto dal proprietario, confermato). Da quel momento le candele **non arrivavano
piu'**: la condizione 1 era vera. Se l'app ha concluso «mercato chiuso» da **quella sola**
condizione, allora confonde **«non ricevo dati»** con **«il mercato e' chiuso»** — e qualunque
disconnessione, calo di rete o ponte fermo si traveste da chiusura di mercato. Va misurato quale
delle due condizioni viene davvero valutata, e con quale orologio, **prima** di toccare qualcosa.

**ATTENZIONE AL MIO STESSO ERRORE, DA NON RIPETERE.** Io ho **citato quella scritta come un fatto**
(«il mercato è chiuso, quindi è il momento meno invasivo per lanciare il collaudo»), e il
proprietario ha dovuto correggermi. La scritta dell'app e' **il sintomo di questo difetto**, non una
fonte sull'orario dei mercati: va trattata come un dato da verificare, mai come la verita'.

**IN SOSPESO**: difetto **aperto**, nessuna cura tentata, nessun test scritto ancora. Da fare dopo
(o insieme a) i test live 8.8, con una misura che parta dai due ingredienti della regola sopra.

### CORREZIONE alla voce qui sopra, 15 minuti dopo: LA CAUSA E' MISURATA, E NON E' L'ASSENZA DI DATI

L'ipotesi che avevo scritto sopra — «l'app confonde *non ricevo dati* con *mercato chiuso*, per via
del `[Disconnect]` delle 22:08» — **e' SBAGLIATA**. L'ho misurata e non regge: la scritta arriva
dall'**orologio**, non dall'assenza di candele. Lascio l'ipotesi sbagliata scritta, cancellata, per
non ripercorrerla.

**MISURE sulla pagina viva alle 22:41:54** (sola lettura, porta 9222):

| cosa | valore misurato |
|---|---|
| ora del PC | **22:41:54** (1361 minuti) |
| `fblScartoServerSec` | **3600** → **NOTO**, non `null` |
| `fblChiusuraMinutiLocali(ora)` | **1320** = **22:00** |
| `LIVE_MT5_CLOSE_MIN` (ripiego fisso) | **22:00** |
| `LIVE_CAPITAL_UNTIL_MIN` | **23:00** |
| `liveSessionPhaseNow()` | **`closed`** |
| orari veri salvati da Capital.com | **25 asset** (AUDCAD, XAUUSD, EURUSD, GBPCAD, …) |
| `#status` | «🌙 Mercato chiuso … riapertura (00:00)» |

**QUINDI il ripiego «scarto ignoto» NON c'entra**: lo scarto era noto (3600 s). La strada vera e'
l'**altro** ripiego, dentro `fblChiusuraMinutiLocali` (app.html ~60944):

```
let min=1440-(scartoServerMin-scartoRomaMin);   // 1440-(60-60) = 1440
min=((min%1440)+1440)%1440;                      // -> 0
return (min===0)?LIVE_MT5_CLOSE_MIN:min;         // -> 22:00
```

L'orologio del broker e **quello di Roma sono nello stesso fuso** (entrambi +1 h a novembre, scarto
60 min contro 60 min). La «mezzanotte del server vista da Roma» viene quindi **mezzanotte di Roma**,
cioe' `min===0`; il codice la considera inutilizzabile («vorrebbe dire non chiude mai dentro il
giorno») e **ripiega su `LIVE_MT5_CLOSE_MIN` = 22:00**. Il broker chiude alle **23:00**: il ripiego
sbaglia di **un'ora piena**, ed e' per questo che alle 22:41 l'app diceva «chiuso».

**LE DUE COSE CHE STONANO, DA DECIDERE CON IL PROPRIETARIO** (non le tocco da solo: il numero
giusto e' una scelta sua, non mia):

1. **Il numero 23:00 e' gia' nel file**, ma in un'altra costante: `LIVE_CAPITAL_UNTIL_MIN=23*60`.
   Il ripiego usa 22:00. Se la chiusura di questo broker e' 23:00, il ripiego sta guardando la
   costante sbagliata — ma cambiarla a mano resta un numero fisso, cioe' lo stesso difetto spostato
   di un'ora.
2. **Gli orari veri ci sono**: `orariAsset` ne tiene **25**, letti da Capital.com
   (`instrument.openingHours` + `snapshot.marketStatus`, rinfrescati ogni 6 ore). Li usa
   l'etichetta sul grafico col conto alla rovescia, **ma non** `liveSessionPhaseAt`, che decide con
   l'orologio e una soglia unica per tutti. **Sono due fonti di verita' diverse per la stessa
   domanda**, ed e' la radice vera: la regola chiesta dal proprietario («l'ora di apertura e
   chiusura di QUELL'asset su QUEL broker, con i suoi orologi») e' implementata **solo** nel ramo
   dell'etichetta.

**COSA SERVIREBBE** (proposta, non fatta): far decidere `liveSessionPhaseAt` dagli orari
dell'asset quando ci sono, e tenere la soglia fissa solo come ultimo ripiego dichiarato; piu' un
banco che misuri il caso «broker nello stesso fuso di Roma», che oggi e' esattamente quello che
casca sul ripiego. Non l'ho scritto: va deciso prima il numero giusto e la fonte giusta.

**NOTA sul mio metodo, da non ripetere**: la prima ipotesi («assenza di dati») l'ho scritta
*prima* di misurare lo scarto e la fase. Erano tre letture, trenta secondi. Scrivere l'ipotesi
costa meno che misurarla, ed e' proprio per questo che va misurata subito.

### VERIFICA DAL VIVO DELLA CURA, sul PC del proprietario (24 novembre 2026, 22:50)

Cura applicata **anche alla copia installata** `app_aggiornata\app.html` su sua decisione esplicita
(«Sì, applicala»). Copia di sicurezza accanto al file:
`app.html.prima-del-tetto-permessi-24nov` (6.144.172 byte, SHA256 `3DD52A0F…8A7481`). File corretto:
6.145.175 byte, SHA256 `1747CF6B…37E94`. Sintassi: **5 script, 0 errori**.

**MISURE A CURA INSTALLATA** (stessa porta 9222, app riaperta dal proprietario alle 22:49:11):

| cosa | prima | dopo |
|---|---|---|
| `FBL_PERMESSO_TIMEOUT_MS` nella pagina viva | assente | **1500** (gira il codice nuovo, non la cache) |
| `verifyDirPermission(handle,'readwrite')` | **non si concludeva** | **`false` in 3002 ms** |
| voce «Account» → sezione conti | restava `none` (muta) | **`block` in 0 ms** |
| voce «Connetti» → finestra di login | restava chiusa (muta) | **aperta in 0 ms**, passo «Credenziali» |

I 3002 ms sono i **due** tetti da 1500 in fila (`queryPermission` e poi `requestPermission`, perche'
col gesto attivo si prova anche a chiedere): il conto torna, e nessuna delle due risposte arriva —
conferma indipendente che in questo WebView **entrambe** restano pendenti, non solo la prima.

**IL SERVICE WORKER NON HA SERVITO LA COPIA VECCHIA**, pur con `CACHE_NAME` invariato a `v2.2.114`:
la pagina riaperta esegue il codice nuovo. Conferma la misura di prima (la cache si aggiorna dalla
rete) e che il bump non era necessario per far arrivare la cura. Il bump resta da fare per la regola
del progetto, non per questo.

**L'app NON ha sovrascritto il file alla riapertura**: impronta identica prima e dopo
(`1747CF6B…`). Il timore che l'aggiornatore cancellasse la correzione, nato dal fatto che
`app.html` era stato riscritto alle 22:20:00 con contenuto identico, **non si e' avverato**. (Quella
riscrittura era il riavvio dei servizi delle 22:20, non un aggiornamento: ponte 22:19:57, feed
22:20:01, segnali 22:20:10.)

**DUE COSE DA SISTEMARE, VISTE QUI E NON CERCATE:**

1. **L'etichetta della voce mente.** Con `mt5Connected=false` la voce del menu diceva
   **«🔌 Disconnetti»**: il gestore ha giustamente preso la strada della *connessione* (e ha aperto
   il login), ma chi legge vede «Disconnetti» mentre non e' connesso. E' esattamente come il
   proprietario l'ha descritta: «mt5 live connetti che ora è disconnetti». `updateMt5ModeUI` non
   aveva ancora corretto l'etichetta. Difetto **aperto**, piccolo ma fuorviante.
2. **Il banner «Ricollega la cartella» non si vede** quando serve: misurato `display:none` subito
   dopo l'apertura della sezione. Attenzione: quella lettura e' **troppo presto** (la sezione si apre
   in 0 ms, il refresh finisce ~3 s dopo), quindi **non e' una prova** che il banner manchi — va
   rimisurato dopo 4 s. Se davvero non comparisse, l'elenco conti vuoto resterebbe senza
   spiegazione, cioe' il difetto che `cartella_credenziali.test.mjs` doveva aver chiuso.

**PRECARICATO NELLA FINESTRA DI LOGIN** (letto, niente scritto): conto **vuoto**, server
**`MetaQuotes-Demo`**, password vuota. **Non** `FTMO-Demo 1515386110` come diceva la consegna
precedente: quella era la bozza vista nel browser non autenticato dell'altro agente, non lo stato di
questo PC. Il conto giusto (**12346925 @ Upcomers-Server**) lo scrive il proprietario: nessuna
credenziale e' stata letta, scritta o trascritta, e `/connect` non e' stato chiamato da me.

**LEZIONE PAGATA, DA NON RIPETERE: non ricaricare la pagina dell'app desktop con
`location.reload()`.** L'ho fatto per far prendere effetto alla cura e **la finestra dell'app si e'
chiusa** (porta 9222 muta, processo `ForexBacktestLABDesktop` sparito); ha dovuto riaprirla lui. Il
ponte, il feed, i segnali e il terminale sono rimasti vivi e nessuna posizione e' stata toccata, ma
il gesto va chiesto a lui: **la cura si prende da sola alla prossima riapertura**, non serve
ricaricare.

## 24 novembre 2026 — VIA IL POPUP «SBLOCCA I FILE COLLEGATI»: ARCHIVIO INTERNO, IN AUTOMATICO

RICHIESTO dal proprietario, subito dopo la cura dei pulsanti muti: «eliminiamo il popup che esce
fuori del sblocca i file collegati eccetera, **non deve visualizzarsi, lo fa in automatico**».

**PERCHE' TOGLIERLO E' GIUSTO, e non e' nascondere il problema sotto il tappeto.** La cura dei
pulsanti muti ha fatto comparire quel banner: prima non si vedeva perche' il codice restava
appeso **prima** di arrivare a mostrarlo. Ma MISURATO: in quel WebView non rispondono **ne'**
`queryPermission` **ne'** `requestPermission` — i 3002 ms di `verifyDirPermission` sono la somma
dei **due** tetti da 1500. Quindi il banner chiedeva un gesto **che non puo' riuscire**: premere
«Sblocca» non avrebbe cambiato niente, mai. Un popup che non puo' funzionare non va mostrato.

**LA SCELTA, FATTA DAL PROPRIETARIO fra tre strade** (gliele ho messe davanti con i costi, perche'
il costo non era mio da decidere):

1. **archivio interno** ← **scelta sua**: quando l'API tace si usa `fblMobileCredsHandle()`, lo
   stesso archivio interno (IndexedDB) che usa il tablet. Nessun popup, nessun permesso, funziona
   da subito. **Costo accettato**: i conti che stanno nel file della cartella vanno riscritti
   **una volta** nell'app, poi restano.
2. il ponte legge la cartella dal disco con un endpoint nuovo in `bridge.py`: niente da riscrivere,
   ma modifica al ponte **e riavvio** del ponte, che con posizioni possibilmente aperte non faccio.
   **Verificato**: `bridge.py` **non ha** oggi alcun endpoint per credenziali o cartelle (solo
   `/account` e `/account_history`), quindi era davvero da scrivere.
3. nascondere solo il banner: **sconsigliata e scartata**, riporterebbe il difetto «le credenziali
   sono sparite» (elenco vuoto senza spiegazione) che `cartella_credenziali.test.mjs` aveva chiuso.

**LA CURA.** `fblSegnaPermessoSenzaRisposta()` prende il verdetto «API muta» e lo **ricorda** in
`localStorage` (`fbl_permesso_api_muta`), cosi' dal secondo avvio non si riprova nemmeno. Da quel
momento `getMt5CredsDirHandle` e `getCapitalCredsDirHandle` tornano l'archivio interno, e
`fblChiediPermessoFile` **esce subito senza mostrare niente**. Il verdetto azzera anche le cartelle
tenute in cache, e il ripiego e' ricontrollato **dopo** l'attesa, cosi' anche il primo click
funziona invece di tornare un elenco vuoto.

**SERVONO DUE SILENZI DI FILA, NON UNO.** E' il guardrail che evita di peggiorare le cose: con un
solo tetto scaduto, una macchina carica che risponde in due secondi farebbe cambiare strada
all'app e i conti della cartella spariderebbero dalla vista su un browser **sano**. In questo
WebView tacciono entrambe le chiamate, quindi il verdetto arriva comunque **al primo click**, prima
che il banner faccia in tempo a comparire.

**MISURA:** banco nuovo `laboratorio/app/permesso_api_muta_archivio_interno.test.mjs`, 3 prove che
tengono distinti i tre casi:

| caso | atteso | esito |
|---|---|---|
| API muta | archivio interno, banner `none`, verdetto preso e ricordato | **verde** |
| browser che **risponde** `'prompt'` | **banner `flex`**, nessun archivio interno, verdetto NON preso | **verde** |
| **un solo** silenzio | verdetto NON preso, nessun archivio interno | **verde** |

La seconda prova e' quella che conta per non ingannarsi: **e' la dimostrazione che il banner non e'
stato spento per tutti**, ma solo dove non puo' servire. Senza di lei questa cura sarebbe
indistinguibile da «nascondi il popup e ignora il problema». Tutti e 11 i test dei tre banchi del
permesso passano insieme (`permesso_api_muta_archivio_interno`, `permesso_cartella_non_risponde`,
`cartella_credenziali`). Sintassi: **5 script, 0 errori**, su repo e copia installata.

**UN TEST ESISTENTE L'HO ROTTO IO, E L'HO SISTEMATO DICENDOLO.** `cartella_credenziali.test.mjs`
cercava `fblChiediPermessoFile('usare i conti MT5 salvati'` **entro i primi 1400 caratteri** di
`getMt5CredsDirHandle`; le righe nuove l'hanno spinta oltre e il test e' diventato rosso. Ho
allargato la finestra a 3000 **spiegando nel test perche'**: il limite di 1400 era incidentale, non
era la proprieta' sotto esame (che e' «chiede il permesso con un motivo invece di tornare null in
silenzio», e vale ancora per un browser che risponde). E' il difetto dei test che cercano stringhe
nel sorgente invece di misurare il comportamento: la stessa proprieta' e' ora misurata **sul
comportamento** dal banco nuovo.

**IN SOSPESO:** la cura e' sul disco (repo **e** copia installata, `app_aggiornata\app.html`) ma
**non ancora verificata dal vivo**: serve che il proprietario **chiuda e riapra l'app** —
`location.reload()` non si usa, l'ha chiusa l'ultima volta. Alla riapertura va controllato che il
banner non compaia e che i conti si salvino nell'archivio interno. Da ricordare: **il conto va
riscritto una volta** (`12346925 @ Upcomers-Server`), ed e' il costo che il proprietario ha
accettato scegliendo questa strada.

### CORREZIONE alla cura del popup, mezz'ora dopo: IL VERDETTO NON DEVE SMETTERE DI PROVARE

**MISURA CHE HA EVITATO UN DANNO** (24 novembre, dopo che il proprietario ha rifatto il login e
riaperto l'app). Sondate **tutte** le pagine aperte sulla porta 9222 — 3 pagine vere
(`app.html?v=…` e due `app.html?pipSlot=2`) piu' 4 worker — tutte e tre dicono la stessa cosa:

| cosa | valore |
|---|---|
| `mt5Connected` | **true** — **MT5 E' COLLEGATO** |
| cartella in cache | **`conti trading`** (non `applicazione`) |
| conti in elenco | **1** → in tendina `12346925 @ Upcomers-Server [Passato]` |
| banner | **`none`** |
| prima cura (`FBL_PERMESSO_TIMEOUT_MS`) | **viva** |
| seconda cura (`fblPermessoApiMuta`) | **NON viva** (pagine caricate prima di applicarla) |

**LA CARTELLA RISPONDE.** Il permesso **fresco**, dato dal proprietario con un gesto suo vero
durante il login, **funziona**: e' solo **dopo il riavvio** che l'API torna muta. Questo smonta un
pezzo della mia ipotesi: il WebView non e' incapace di dare quel permesso, e' incapace di
**rispondere** quando il permesso va riconfermato da solo.

**IL DANNO CHE LA MIA CURA AVREBBE FATTO.** Avevo messo il ripiego all'archivio interno **in cima**
a `getMt5CredsDirHandle`, prima di provare la cartella: col verdetto ricordato in `localStorage`,
dal riavvio successivo l'app **non avrebbe piu' letto la cartella MAI**, e il conto
`12346925 @ Upcomers-Server` dentro `conti trading` **sarebbe sparito dall'elenco**. Cioe' avrei
ricreato, con la cura, esattamente il «**le credenziali sono sparite**» che questo progetto
combatte da sempre — e stavolta senza nemmeno un banner a spiegarlo, perche' il banner l'avevo
appena spento.

**LA CORREZIONE.** Il verdetto «API muta» serve **a non mostrare il banner**, non a smettere di
provare. Quindi: la cartella si prova **sempre**, e l'archivio interno e' il **ripiego dopo** il
tentativo fallito, in entrambe le funzioni (`getMt5CredsDirHandle` e `getCapitalCredsDirHandle`).
Costo: nel caso muto si aspettano i due tetti (circa 3 s) prima di ripiegare — invisibile, perche'
la sezione «Account» si apre comunque in 0 ms.

**MISURA:** quarta prova nel banco `permesso_api_muta_archivio_interno.test.mjs` — «col verdetto
già preso, una cartella che RISPONDE vince sull'archivio interno»: verdetto `true` ricordato,
cartella `conti trading` che risponde `'granted'`, e si pretende che torni **la cartella** e non
l'archivio. **Rossa prima della correzione** (tornava l'archivio interno), **verde dopo**. Dodici
test verdi sui tre banchi del permesso. Sintassi: 5 script, 0 errori, su repo e copia installata.

**TRAPPOLA DEL BANCO, da ricordare**: `assert.notMatch` **non esiste** nel Node di questo banco
(TypeError, non asserzione fallita — quindi un test che lo usa e' rosso per il motivo sbagliato e
non misura niente). Si scrive `assert.equal(/regola/.test(valore), false, …)`.

**LEZIONE PIU' GENERALE, pagata due volte in questa sessione**: una cura che **ricorda** un verdetto
va guardata dal lato «e se il mondo cambia dopo?». Il primo verdetto («API muta») era giusto quando
l'ho misurato e **sbagliato venti minuti dopo**, perche' il proprietario aveva rifatto il login. Un
verdetto appiccicoso che spegne un tentativo e' peggio del difetto che cura.

**IN SOSPESO:** le tre pagine aperte girano la **prima** cura ma non la seconda; la seconda e' su
disco (repo e copia installata) e si prendera' alla prossima chiusura e riapertura dell'app. Da
verificare allora: nessun banner, e il conto **ancora in tendina** (e' la prova che il ripiego non
ha rubato il posto alla cartella). **Niente da riscrivere a mano**: il conto e' nella cartella e la
cartella si continua a provare — il costo che il proprietario aveva accettato scegliendo l'archivio
interno **non si paga piu'**.

### VERIFICA FINALE DAL VIVO, a cura completa installata (24 novembre 2026, dopo la riapertura)

Sondata la pagina principale dell'app riaperta dal proprietario (porta 9222, sola lettura). **Tutto
quello che serviva sapere e' in questa riga:**

| cosa | valore misurato | significato |
|---|---|---|
| `fblPermessoApiMuta` definito | **true** | la seconda cura **gira** (non e' la copia vecchia) |
| `FBL_PERMESSO_TIMEOUT_MS` | **1500** | la prima cura gira |
| `verdettoApiMuta` | **true** | l'API e' tornata **muta** dopo il riavvio, come previsto |
| `fblPermessiSenzaRisposta` | **3** | tre silenzi: nessuna risposta, confermato di nuovo |
| ricordato in `localStorage` | **`"1"`** | il verdetto e' stato salvato |
| **banner** | **`none`** | **IL POPUP NON COMPARE** — e' quello che il proprietario ha chiesto |
| **cartella in uso** | **`conti trading`** | **LA CARTELLA HA VINTO**, nonostante il verdetto |
| conti in elenco | **1** → `12346925 @ Upcomers-Server` | **il conto non e' sparito** |
| `mt5Connected` | **true** | MT5 resta collegato |

**QUESTA E' LA PROVA CHE LA CORREZIONE DI MEZZ'ORA PRIMA SERVIVA.** Le due cose che sembravano in
conflitto si sono verificate **insieme**: il verdetto «API muta» e' stato preso (quindi nessun
popup) **e** la cartella e' stata comunque letta (quindi il conto e' ancora in tendina). Con la
prima versione della cura — ripiego in cima alla funzione — qui si sarebbe letto
`cartellaInCache: "Archivio locale (interno all'app)"` e `conti: 0`: il conto del proprietario
sparito dall'elenco, senza banner a spiegarlo. Il difetto c'era, e' stato misurato, e non e' mai
arrivato addosso a lui.

**CONSEGUENZA ACCETTATA, da sapere**: il verdetto resta ricordato per sempre, quindi il banner
«Sblocca i file collegati» **non si vedra' piu'** nemmeno in un caso in cui potrebbe servire (un
browser che risponde ma vuole la riconferma). Resta raggiungibile il pulsante «🔓 Ricollega la
cartella» dentro il pannello delle impostazioni (misurato `display:block`, ma a dimensione zero
finche' il pannello e' chiuso: non e' un popup, non esce da solo). E' esattamente il
comportamento chiesto: «non deve visualizzarsi, lo fa in automatico».

**NIENTE DA RISCRIVERE A MANO**: il costo che il proprietario aveva accettato scegliendo l'archivio
interno (riscrivere il conto una volta) **non si paga**, perche' la cartella si continua a provare
e risponde.

## 24 novembre 2026 — «MERCATO CHIUSO» ALLE 22:41: LA CURA, E LA RICHIESTA DEL 1 NOVEMBRE REVOCATA

Questa voce chiude il difetto aperto piu' sopra («MERCATO CHIUSO DETTO CON IL MERCATO APERTO») e la
sua correzione. Le misure stanno la'; qui c'e' la **decisione** e la **cura**.

**LA DECISIONE DEL PROPRIETARIO, che e' la parte che conta.** Messo davanti al fatto che il taglio
alle 22:00 era **una sua richiesta esplicita del 1 novembre 2026** scritta nel sorgente («anche se
il calendario dice aperto, la schedule MT5 e' piu' restrittiva... cosi' l'ultima candela segna
22:00 e non 00:00»), ha risposto: **«va eliminata non è più valida mi ero sbagliato»**. Quindi non
e' stato un compromesso fra due richieste: la vecchia e' **revocata**, e il sorgente lo dice nel
punto esatto dove viveva, perche' nessuno la rimetta credendo di obbedire a lui.

**LA REGOLA NUOVA, nelle sue parole (24 novembre):** il mercato e' chiuso **solo** quando non
arrivano piu' aggiornamenti delle candele **E** l'ora di apertura/chiusura di **quell'asset su quel
broker** dice chiuso, «con i suoi orologi diversi dal tipo di broker». Un numero scritto a mano nel
sorgente non e' nessuna delle due cose.

**LA CURA, in tre pezzi:**

1. **`fblOrariAssetAperto(asset,t)`** (nuova): torna true **solo** se per quell'asset abbiamo
   davvero il calendario (`orariAsset`, da Capital.com) e l'istante cade dentro un suo intervallo.
   Senza calendario torna **false**, non true: «non lo so» non e' «aperto».
2. **`statoMercato`**: dentro un intervallo del calendario vero si torna **`null`** (non chiuso), e
   l'orologio nostro non ha piu' voce in capitolo. E' qui che viveva il taglio revocato.
3. **`liveSessionTick`**: non congela se gli orari veri dicono aperto. Serviva perche' le tre
   guardie che c'erano gia' (tick veri, `fblMercatoMt5Noto`, finestra d'attesa) chiedono **tutte**
   `mt5Connected`: col MT5 scollegato a mano alle 22:08 erano **tutte spente**, e decideva il solo
   orologio. Togliere il cartello senza questo pezzo avrebbe lasciato il grafico fermo comunque.

Il ramo orario resta vivo **solo** per gli asset di cui non abbiamo il calendario: la' e' l'unica
fonte che ci resta, e va dichiarata per quello che e'.

**MISURA:** banco nuovo `laboratorio/app/mercato_chiuso_orari_veri.test.mjs`, 3 prove all'istante
esatto della segnalazione (martedi 24 novembre 2026, 21:41 UTC = 22:41 a Roma), con MT5 **non**
collegato come sul suo PC. Le prove **dichiarano le premesse** (`liveSessionPhaseAt` deve dire
`closed` e `fblChiusuraMinutiLocali` deve dare **1320** = 22:00): se le premesse cadono, il test lo
dice invece di passare per caso.

| prova | senza la cura | con la cura |
|---|---|---|
| dentro l'orario vero → non chiuso | **rossa**: `visto: chiuso/mt5` | **verde** |
| fuori dall'orario vero → chiuso, fonte `orari` | verde (e' la **guardia**) | **verde** |
| il grafico non si congela a mercato aperto | **rossa**: congelato | **verde** |

La seconda prova passa in **entrambi** i casi, ed e' giusto cosi': non e' una prova di regressione,
e' la **guardia** che dimostra che non ho spento il cartello «Mercato chiuso» per tutti — una
chiusura vera resta una chiusura, e dichiara di venire dagli **orari dello strumento**, non da
un'ora scritta a mano.

**DUE TRAPPOLE DEL BANCO PAGATE QUI, da non ripetere:**

1. **`page.evaluate` di Playwright accetta UN SOLO argomento.** Passandogliene tre si prende
   «Too many arguments» e il test **muore prima di misurare qualunque cosa**. I miei tre test sono
   stati rossi per questo, e per un momento ho creduto che fosse la prova di controllo: **non lo
   era**. Si passa un oggetto solo e si destruttura.
2. **`app.html` ha fine riga CRLF** (misurato: 69.881 CRLF, 0 LF). Uno script di sostituzione
   scritto con `\n` **non trova niente** e falliisce in silenzio se non si controlla l'esito. Il
   primo tentativo di revert e' morto cosi'.

**LA PROVA DI CONTROLLO E' STATA RIFATTA PER DAVVERO**, e vale la pena dire perche': dopo aver
corretto il bug del banco, i tre test erano verdi — ma i rossi di prima venivano dal **mio errore**,
non dal codice, quindi non provavano niente. Ho quindi **rimosso la cura** dal sorgente con un
revert chirurgico (copia di sicurezza, due sostituzioni con `\r\n`, test, ripristino, sintassi e
conteggio verificati dopo), e **solo allora** ho visto i rossi veri con i messaggi giusti. Un test
verde non dimostra niente se non si e' visto il rosso **con lo stesso banco**.

**IN SOSPESO:** cura applicata al **repo** (`app.html`, working tree, non committata). **NON** e'
stata applicata alla copia installata `app_aggiornata\app.html`: la decisione di toccare l'app in
uso e' del proprietario, caso per caso. Collaudo completo lanciato dopo la cura: esito da leggere
in `laboratorio/risultati/ultimo.md` (atteso il gruppo di 8 rossi preesistenti delle feature
8.5.13-8.5.18, che non esistono in questa `app.html` — vedi la voce sul collaudo).

## 25 novembre 2026 — LA REVISIONE DELLA MIA STESSA CURA HA TROVATO 4 DIFETTI, UNO GRAVE

Su autorizzazione permanente del proprietario («applica le skill che hai a disposizione per lavorare
meglio e più preciso, con agenti eccetera»), ho messo un agente a rivedere il diff delle cure del 24
novembre con l'incarico di cercare **dove la mia cura fa danno**. Ne ha trovati quattro. Il primo
era grave e **scattava su qualunque browser sano**.

### 1. GRAVE, CORRETTO — `Promise.race` non annulla il perdente

`fblPermessoConTimeout` metteva il tetto con `Promise.race([vera, setTimeout(...)])`. Il
`setTimeout` **restava armato**: il suo callback partiva **sempre** dopo 1500 ms e chiamava
**sempre** `fblSegnaPermessoSenzaRisposta()`, anche quando `queryPermission` aveva risposto
`'granted'` in due millisecondi. Il valore `'timeout'` lo scartava la race; **l'effetto collaterale
no**.

Costo: il contatore saliva a **ogni** chiamata, su **qualsiasi** browser. Bastavano **due chiamate
in tutta la vita della pagina** (credenziali MT5 piu' Capital.com, all'avvio) per latchare «API
muta» su un browser perfettamente funzionante — e il verdetto si scrive in `localStorage` e non si
toglie da nessuna parte. Da li': banner spento per sempre, e al primo riavvio in cui il permesso
torna `'prompt'` senza un gesto, **elenco conti vuoto senza spiegazione**. Cioe' il «le credenziali
sono sparite» che la cura doveva chiudere, **ricreato dalla cura**.

**E IO L'AVEVO LETTO AL ROVESCIO.** La misura sul PC del proprietario diceva
`fblPermessoApiMuta=true` con **3 silenzi** *mentre* la cartella `conti trading` rispondeva e il
conto era in tendina. Avevo concluso «l'API e' tornata muta dopo il riavvio» e l'avevo scritto come
conferma della cura. Erano i miei timer che contavano silenzi inesistenti: **se la cartella
risponde, di silenzi ce ne sono zero**. Una misura che conferma la tua ipotesi va guardata con piu'
sospetto, non con meno.

Cura: il callback controlla `risposto` prima di contare, e il timer si annulla appena la risposta
vera arriva.

### 2. CORRETTO — il tetto su `requestPermission` misurava un dito umano

`requestPermission()` si risolve **quando l'utente clicca** sulla finestra del browser. Con 1500 ms
`verifyDirPermission` tornava `false` su un permesso che l'utente **stava concedendo**, e
`fblCredRicollegaCartelle` scriveva «negata» mentendo.

Cura in due passi, e il primo l'ho sbagliato: ho provato un tetto di **30 s** per dare tempo al
dito, e **misurato** che nel WebView muto i pulsanti restavano appesi mezzo minuto — tornava il
difetto curato il giorno prima. Quindi: tetto **corto** come l'altra chiamata, ma **il silenzio di
`requestPermission` non si conta**. Il tetto corto perde la risposta di un utente lento ma **non
perde il permesso**: appena lui clicca la concessione resta valida e la chiamata DOPO la vede.

### 3. CORRETTO — «la cartella si prova sempre» era falso

Il ripiego veniva scritto **in `mt5CredsDirHandle`**, la stessa variabile di cache della cartella
vera. Dalla prima volta in poi la riga in cima alla funzione restituiva l'archivio interno e la
cartella **non veniva piu' provata per tutta la sessione** — mentre il mio commento prometteva il
contrario. Peggio in scrittura: salvando un conto si scriveva nell'archivio interno **vuoto**
mentre la cartella teneva l'elenco vecchio, con lo `#status` che diceva «salvato nella cartella
collegata». Due archivi che divergono in silenzio.

Cura: il ripiego si **restituisce senza metterlo in cache**.

### 4. CORRETTO — il verdetto buttava via cartelle valide

`fblSegnaPermessoSenzaRisposta` azzerava `mt5CredsDirHandle` e `capitalCredsDirHandle`: una cartella
**valida, con permesso concesso** veniva scartata per un verdetto maturato su un'**altra** cartella
(il contatore e' comune a tutte, Libreria storici inclusa). Azzeramento rimosso.

### 5. CORRETTO — la guardia del mercato interrogava la chiave sbagliata

In `liveSessionTick` passavo `_assetOra` = `mt5ActiveSymbol || currentAssetKey`, ma `mt5ActiveSymbol`
e' il **simbolo risolto dal broker** (`XAUUSD.r`, `US500.cash`; esiste `MT5_SYMBOL_ALIAS_GROUPS`
proprio per questo) mentre `orariAsset` e' indicizzato con la **chiave asset dell'app**. Per ogni
asset con suffisso, `orariAsset[_assetOra]` era `undefined`, la guardia tornava `false` e **il
grafico si congelava alle 22:00 comunque**: la cura non si applicava dove serviva. Ora passa
`currentAssetKey`.

### LA CORREZIONE DI DISEGNO CHE LE TIENE INSIEME

Avevo legato **due cose diverse**: «riesco a leggere la cartella adesso?» e «devo spegnere il
banner per sempre?». La prima si risponde con il tentativo di adesso, la seconda e' una memoria.
Legate, il primo giro con la cartella muta tornava `null` — elenco vuoto senza spiegazione — in
attesa che un secondo silenzio facesse scattare il verdetto.

Separate: `fblPermessoMutoUltimoGiro` (il tentativo appena fatto) decide **il ripiego**, subito;
`fblPermessoApiMuta` (appiccicoso) decide **solo il banner**. Effetto collaterale utile: la soglia
del verdetto e' diventata una decisione **rimandabile**, e il proprietario l'ha rimandata
(«decidiamo poi»): un silenzio o due, il ripiego funziona uguale.

**MISURA:** due banchi nuovi nel file `permesso_api_muta_archivio_interno.test.mjs`:
«browser SANO: una risposta immediata non conta come silenzio, **nemmeno dopo il tetto**» (aspetta
oltre i 1500 ms di proposito: e' l'attesa che gli altri test non facevano, ed e' per questo che non
vedevano il difetto 1) e «il ripiego non si appiccica: alla seconda chiamata la cartella che
risponde torna a vincere». **17 test verdi su 17** sui quattro banchi del permesso e del mercato.

Un'asserzione vecchia e' stata **cambiata dicendolo**: «con un solo silenzio niente archivio
interno» era giusta quando ripiego e verdetto erano legati, ed e' diventata sbagliata dopo averli
separati. Resta l'asserzione che conta: un solo silenzio **non** latcha il verdetto.

### RESTA APERTO (trovato dalla revisione, NON corretto)

1. **Il congelamento puo' non avvenire mai.** `fblOrariAssetAperto` non ha tetto: con un calendario
   `00:00 - 23:59` su sette giorni e' sempre vero (e `orariIntervalli` fonde gli intervalli a meno
   di 60 s, quindi 23:59→00:00 diventa un intervallo continuo). Allora `liveSessionFreezeMt5` non
   parte mai, e con lei **non partono** `saveLightStateNow`, `saveFootprintTicksNow`,
   `saveFootprintArchivioNow`, `saveOrderBookHistoryNow(true)`, `liveOffSessionSaveRows`, ne' si
   imposta `fblNotteMt5`. Un calendario troppo generoso dal broker spegne il salvataggio di fine
   giornata **in silenzio**.
2. **Quattro giudici dello stesso fatto, ora in disaccordo.** `statoMercato` guarda il calendario,
   ma restano sull'orologio: `applyLivePriceToChart` (nessun prezzo tocca il grafico dopo le 22:00),
   `_fblConfineChiusuraCalcola` (taglio candele), `fblConfineAutosegui`. Quindi il sintomo e' curato
   **a metà**. In piu' il commento che dice «LA STESSA REGOLA di statoMercato()» e' ora **falso** e
   disinforma chi lavorera' qui dopo: va corretto.
3. **Weekend.** Per gli asset il cui calendario copre sabato/domenica (apertura della domenica sera,
   CFD 7/7) prima chiudeva l'orologio, ora `statoMercato` torna `null`: mercato dichiarato aperto di
   sabato. Non so se e' voluto — la richiesta riguardava le 22:00 di un giorno lavorativo.
4. **Due strade chiamano ancora `queryPermission` nudo**, senza tetto, quindi nel WebView muto
   restano appese: `fblCredStatoCartella` (il riquadro «collegata / da riconfermare» non si riempie
   mai) e `mt5ContiSenzaChiedere` (che inoltre torna `[]` invece di `null`, cioe' «sono sicuro che
   non ci sono conti» invece di «non lo so»).
5. **La soglia del verdetto**: uno o due silenzi. Rimandata dal proprietario.

### VERSIONI

Alzate per la pubblicazione: `sw.js` → `forex-backtest-lab-v2.2.115`, `app.html` →
`const FBL_VERSIONE='2.2.115'`. Devono combaciare o il passo `versione_app_html` del collaudo cade.

### 25 novembre 2026 — LA SECONDA META' DELLA CURA DEL MERCATO: UNA SOLA REGOLA, NON QUATTRO

Il proprietario: **«Finiamo poi pubblichiamo»**. La revisione aveva trovato che la cura era **a
metà**: `statoMercato` guardava il calendario dello strumento, ma tre altre strade decidevano
ancora con l'orologio e il suo ripiego alle 22:00. Quindi il cartello «Mercato chiuso» spariva e
**il grafico si fermava uguale**.

**LE TRE STRADE RIMASTE, e cosa facevano di sbagliato:**

| strada | sintomo |
|---|---|
| `_fblConfineChiusuraCalcola` (il `chiusa()` del taglio) | tagliava le candele oltre le 22:00 anche dentro l'orario vero: su un broker che chiude alle 23:00, **un'ora di mercato vero sparita dal grafico** |
| `fblConfineAutosegui` | l'autosegui si fermava sulla candela delle **21:59** |
| `applyLivePriceToChart` | **nessun prezzo** toccava il grafico dopo le 22:00 |

**LA CURA: `fblChiusoAllIstante(asset,t)`, una sola risposta per tutta l'app.** Il calendario vero
quando c'e', l'orologio **solo** quando non c'e'. Sotto, `fblOrariAssetStato` da' **tre** risposte
(`'aperto'`, `'chiuso'`, `null`) invece di un booleano: distinguere «lo strumento e' chiuso» da
«non ho il calendario» e' tutto il punto, perche' portano a decisioni opposte, e `false` da solo le
confondeva. `fblOrariAssetAperto` resta come scorciatoia leggibile sopra la stessa funzione.

Nel taglio candele e nell'autosegui la forma e' **conservativa di proposito**: `liveSessionPhaseAt`
resta nella condizione, in `&&` con la regola nuova. Cosi' il comportamento cambia **solo** nel caso
segnalato (orologio chiuso ma calendario aperto) e non in quello opposto, che nessuno ha chiesto di
cambiare. Nell'accettazione dei prezzi sono tre condizioni, tutte e tre necessarie per rifiutare un
prezzo — che e' letteralmente la regola del proprietario: chiuso **solo** se non arrivano dati **e**
l'orario di quell'asset su quel broker dice chiuso.

**UN COMMENTO CHE DICHIARAVA IL FALSO, corretto.** A `fblConfineChiusura` c'era scritto «LA STESSA
REGOLA di statoMercato(): dentro il calendario comanda l'orario con cui l'app segue MT5 (chiusura
alle 22 di Roma)». Era vero fino al 24 novembre; dopo la cura di `statoMercato` era **falso**, e
disinformava chi avrebbe letto. Ora dice la regola nuova e porta scritto l'avviso: un commento che
dichiara una regola **condivisa** va cambiato nello stesso momento della regola, altrimenti diventa
la prossima trappola.

**MISURA:** banco nuovo nel file `mercato_chiuso_orari_veri.test.mjs` — «una sola regola per
«chiuso adesso», con tre risposte distinte»: dentro l'orario → **non chiuso** (con la premessa
dichiarata che l'orologio dice `closed`), fuori → **chiuso**, senza calendario → `null` e **solo
allora** decide l'orologio. **Rosso prima** della cura (la funzione non esisteva), **verde dopo**.
Verdi anche i banchi del mercato che c'erano gia': `mercato_chiuso`, `candela_viva_dopo_le_22`,
`mercato_per_asset_dai_dati` — **21 test su 21**. Quei banchi preesistenti sono la vera guardia
sulle due modifiche ai confini, dove non ho scritto banchi nuovi: se avessi rotto il taglio o
l'autosegui, sarebbero rossi loro.

**RESTA APERTO** (dalla revisione, e non l'ho toccato): il congelamento che con un calendario
`00:00 - 23:59` su sette giorni potrebbe non avvenire mai — e con lui il salvataggio di fine
giornata di footprint, book e stato leggero; e il weekend per gli asset il cui calendario copre
sabato e domenica. Il secondo e' una scelta da fare con il proprietario, non da indovinare.

### 25 novembre 2026 — LA CURA DEL MERCATO CONTRADDICE TRE BANCHI GIA' COLLAUDATI: DECISIONE APERTA

MISURATO con prova di controllo chirurgica (copia, revert, test, ripristino): **con** la cura di
`statoMercato` del 24 novembre tre banchi preesistenti sono **rossi**; **togliendola** tornano
**7 su 7 verdi**. I tre sono `buco_grafico_chiuso` («con l'autosegui la finestra e' piena meno la
candela oltre la chiusura», 300 invece di 299, e «TUTTE le finestre dello storico tengono le loro
candele») e `chiusura_mercato_prestazioni` («il filtro deve tagliare davvero le candele dopo la
chiusura», 80 -> 80, piu' la sua controprova sulle candele finte).

NON e' una regressione per distrazione: quei banchi sono **la richiesta del 1 novembre 2026 scritta
in forma di test** — il taglio alle 22:00 e' cio' che fa segnare «l'ultima candela alle 22:00 e non
alle 00:00». Il proprietario ha **revocato** quella richiesta il 24 novembre («va eliminata non e'
piu' valida mi ero sbagliato») parlando dell'etichetta «Mercato chiuso». Se la revoca copre anche
il **taglio delle candele** e il **confine dell'autosegui**, allora i tre banchi vanno riscritti
sulla regola nuova; se non la copre, `statoMercato` deve tenere il vecchio taglio. **E' una sua
decisione, non una deduzione mia.**

RITIRATE nel frattempo (collaudo alla mano, non per prudenza astratta): le tre modifiche ai
chiamanti — taglio candele, confine autosegui, accettazione prezzi — con il motivo scritto in
ciascun punto del sorgente. `fblChiusoAllIstante` e `fblOrariAssetStato` restano: li usa la guardia
del congelamento, che e' verde. **Niente pubblicato**: con la cura dentro, il collaudo dice
`Falliti: 1` e la guardia su git blocca `main`, giustamente.

### 25 novembre 2026 — LA REGOLA NUOVA VALE PER TUTTO, E SCOPRE UN FILTRO CHE VIAGGIAVA A SBAFO

Il proprietario ha deciso: la revoca del 1 novembre **vale per tutto**, non solo per l'etichetta
(«vale per tutto, è giusto il nuovo aggiornamento»). Quindi le tre modifiche ai chiamanti sono state
**rimesse** (taglio candele, confine autosegui, accettazione prezzi) e i due banchi che erano la
vecchia richiesta in forma di test sono stati **riscritti**: non le asserzioni, ma il **dato di
prova**.

Entrambi dichiaravano «chiusa» la fascia dalle 21:00 UTC e poi costruivano un calendario
`00:00 - 22:00` UTC, cioè **aperto** fino alle 23:00 di Roma. La contraddizione non si vedeva perché
il taglio lo decideva l'orologio e il calendario non veniva nemmeno letto. Ora il calendario dice
21:00 UTC = 22:00 di Roma, cioè quello che il banco ha sempre inteso. `buco_grafico_chiuso` 6 su 6
verde, `chiusura_mercato_prestazioni` verde.

**RESTA UN ROSSO, E NON È LA RICHIESTA REVOCATA.** `chiusura_non_taglia_candele_reali`, prova
«CONTROPROVA: le candele oltre l'ultima reale non si mostrano»: serie fino alle 22:07 UTC, ultimo
tick **vero** alle 21:58, l'ultima visibile deve restare 21:58 — e adesso mostra 21:59. Il suo
calendario è `00:00 - 23:59` (aperto 24 ore) **a posta**, perché la proprietà che misura non c'entra
con gli orari di mercato: «oltre l'ultimo tick vero non c'è mercato».

**DIAGNOSI**: quel filtro **non aveva un meccanismo suo**. Viaggiava a sbafo sul taglio
dell'orologio (il confine della chiusura, poi allargato all'ultima reale da
`_fblAllargaAllUltimaReale`). Togliendo l'orologio da dentro il calendario, il confine non si forma
più e il filtro sparisce con lui. Non è una regressione della decisione del proprietario: è un
filtro che era appoggiato alla cosa sbagliata, e la cura lo ha messo a nudo.

**CURA PROPOSTA, NON APPLICATA**: dentro `chiusa()` trattare come chiuso anche l'istante oltre
l'ultimo tick vero di quell'asset, indipendentemente dal calendario — che è letteralmente la frase
del banco. NON l'ho fatta per due ragioni misurabili: tocca il percorso più caldo del disegno, dove
questo progetto ha già pagato un crash (7 novembre 2026); e va distinta la **sorgente**, perché per
un file di MT5 «oltre l'ultima reale» non esiste (è la cura del 21 novembre,
`_fblAllargaAllUltimaReale`), quindi il filtro nuovo deve valere per le sorgenti che restituiscono
candele past-close (Capital.com) e non per MT5. Va misurata, non indovinata.

**STATO: NON PUBBLICABILE.** Con questo rosso il collaudo non dice `Falliti: 0` e la guardia su git
blocca `main`, giustamente. Le cure sui permessi sono invece finite e verdi (17 su 17).

### 25 novembre 2026 — IL FILTRO «OLTRE L'ULTIMA REALE» ADESSO HA UN MECCANISMO SUO

Seguito della voce qui sopra, che lasciava la cura **proposta e non applicata**. Applicata.

In `_fblConfineChiusuraCalcola`, dentro `chiusa(tt)`, una riga in piu' prima del calendario: oltre
l'**ultimo tick vero** di quell'asset e' chiuso, qualunque cosa dica il calendario. Sono le parole
del banco stesso («oltre l'ultimo tick vero non c'è mercato»), e ora sono nel codice invece di
essere un effetto collaterale di un'altra regola.

**PERCHE' NON ROMPE IL CASO VIVO**, verificato nel sorgente prima di scrivere: `fblConfineChiusura`
esce **prima** sia con `fblAssetRiceveDatiOra(a)` (tick entro il silenzio di 5 minuti) sia con
`fblMercatoMt5Noto(a)===true`, quindi a mercato aperto e con dati in arrivo non si taglia niente,
come prima. E per i file di MT5 il riallargamento all'ultima candela reale resta **a valle**
(`_fblAllargaAllUltimaReale`, cura del 21 novembre): un tick stale non puo' tagliare candele vere.

**MISURA:** `chiusura_non_taglia_candele_reali` verde (era la sola rossa), e verdi insieme a lei
tutti i banchi vicini, che sono la vera guardia su una modifica nel percorso caldo del disegno:
`buco_grafico_chiuso`, `chiusura_mercato_prestazioni`, `congelamento_solo_autosegui`,
`grafico_mai_vuoto`, `zona_morta`, `mercato_chiuso_orari_veri` — **27 test su 27**. Sintassi: 5
script, 0 errori.

**LA LEZIONE, che vale piu' della cura:** una proprieta' che nessuno ha implementato ma che «viene
gratis» da un'altra regola e' una proprieta' **a prestito**. Finche' la regola che la regge non
cambia, nessuno si accorge che non esiste. Qui l'ha scoperta un banco preesistente, scritto da
un'altra sessione e per un altro motivo, che si e' acceso rosso appena ho tolto il sostegno: e' il
secondo caso in due giorni in cui i test del progetto hanno visto un mio errore prima del
proprietario — il primo fu la revisione con l'agente. Il collaudo completo prima di pubblicare non
e' una formalita'.

### 25 novembre 2026 — LE DUE CHIAMATE RIMASTE NUDE, E UN QUARTO STATO

Chiuso il punto 4b della revisione. Due strade chiamavano ancora `queryPermission` **senza tetto**,
quindi nel WebView dell'app installata restavano appese esattamente come i pulsanti di prima:

1. **`fblCredStatoCartella`** → il riquadro «Credenziali: collegata / da riconfermare» nelle
   impostazioni **non si riempiva mai**, e il pulsante «Ricollega la cartella» non compariva.
   Stesso meccanismo dei due pulsanti MT5, in un posto diverso e meno visibile.
2. **`mt5ContiSenzaChiedere`** → una funzione che per **contratto** deve poter rispondere `null`
   = «non lo so senza chiedere» (lo dice il suo stesso commento) non riusciva a darla: restava
   appesa, e i suoi tre chiamanti non arrivavano mai a decidere.

**UN QUARTO STATO, perché i tre non bastavano.** `fblCredStatoCartella` aveva `'ok'`,
`'daRiconfermare'` e `'manca'`. Con il permesso che non risponde, `'daRiconfermare'` sarebbe
sbagliato — **offrirebbe un pulsante che in quel WebView non può riuscire** — e `'ok'` sarebbe una
bugia. Aggiunto `'nonSiSa'`, che il riquadro scrive come «collegata, ma questo browser non risponde
sul permesso» e che **non** accende il pulsante. Dire «non lo so» è una risposta; restare muti no.

**MISURA:** due prove nuove in `permesso_cartella_non_risponde.test.mjs` — il riquadro si riempie,
lo stato è `nonSiSa`, il pulsante resta nascosto; e la lettura silenziosa torna `null` (non un
elenco vuoto, che direbbe «sono sicuro che non ci sono conti»). Verdi insieme ai banchi che già
coprivano quelle funzioni, `cartella_credenziali` e `conti_nuovi_in_tutte_le_finestre`:
**20 test su 20**.

**UN MARGINE SCRITTO A MANO MI HA FATTO UN ROSSO FINTO**, e vale registrarlo: avevo messo
`ms < 4000` con un tetto nominale di 1500, e il test è diventato rosso a **4515 ms** soltanto
perché il collaudo gira quattro browser in parallelo e i timer slittano. Il margine ora si prende
**dalla costante** (`FBL_PERMESSO_TIMEOUT_MS * 4`): la proprietà vera è «si conclude», non «si
conclude in un tempo preciso». Era l'avviso che l'agente in revisione aveva già dato sugli altri
banchi di questa famiglia, e che avevo lasciato cadere.

**Pulito anche `laboratorio/risultati/ultimo.md`** prima di lanciare il collaudo: quel file si
accumula (`tee -a`), e con due corse dentro il controllo a sottostringa di `guardia_git.py` su
`Falliti: 0` diventa inaffidabile. Ripulendolo prima, la riga che si legge è quella della corsa
vera.

### 25 novembre 2026 — UN CALENDARIO CHE NON CHIUDE MAI NON È UN CALENDARIO

Chiuso l'ultimo punto aperto della revisione del 24 novembre, e il meccanismo è peggiore di come
l'avevo riassunto.

`orariIntervalli` **fonde** gli intervalli che si toccano entro 60 secondi, e il salto
`23:59 → 00:00` è **esattamente** 60.000 ms. Quindi un calendario con tutti e sette i giorni
`00:00 - 23:59` non è «aperto quasi sempre»: diventa **un solo intervallo continuo**, e
`fblOrariAssetAperto` risponde «aperto» a qualunque istante gli si chieda, per sempre.

**IL COSTO, che è la parte grave.** La guardia in `liveSessionTick` non avrebbe mai permesso il
congelamento, e con lui **non sarebbero mai partiti** `saveLightStateNow`,
`saveFootprintTicksNow`, `saveFootprintArchivioNow`, `saveOrderBookHistoryNow(true)` e
`liveOffSessionSaveRows`, né si sarebbe impostato `fblNotteMt5` (quindi nemmeno il ricollegamento
automatico alla riapertura). Un calendario troppo generoso dal broker avrebbe spento il salvataggio
di fine giornata **in silenzio**: dati persi, non un fastidio. E nessun log l'avrebbe detto.

**LA CURA.** In `fblOrariAssetStato`: se gli intervalli si riducono a **uno solo** che copre almeno
otto giorni, non c'è nessuna chiusura nella finestra, quindi quel calendario non porta
informazione e si risponde `null` = «non ho un calendario utilizzabile». Da lì decide l'orologio,
che è la stessa regola di quando il calendario non c'è affatto. Per un asset non-cripto (le cripto
escono prima nei chiamanti, via `binanceSymbolForAsset`) «non chiude mai» non può essere vero:
mancherebbe anche il weekend.

**MISURA:** prova nuova in `mercato_chiuso_orari_veri.test.mjs` — con un calendario `00:00 - 23:59`
su sette giorni lo stato deve essere `null`, `fblOrariAssetAperto` deve dire `false`, e
`liveSessionFreezeMt5` deve essere chiamata **una volta** (si conta). **27 test su 27** verdi sui
banchi del mercato, collaudo completo `Falliti: 0` su **1825** test.

**HO DOVUTO CAMBIARE I MIEI STESSI DATI DI PROVA**, e vale registrarlo: i banchi che avevo scritto
il 24 novembre usavano proprio `00:00 - 23:59` su sette giorni come «calendario aperto». Era un
dato di prova che non poteva esistere nella realtà, e che ora l'app giustamente rifiuta: sono
passati a `00:00 - 23:00`, che copre l'istante della segnalazione e lascia un'ora di chiusura al
giorno. Era esattamente l'avviso che l'agente in revisione aveva dato — «un calendario di prova
realistico proverebbe anche la conversione di fuso» — e che avevo lasciato cadere. Un dato di prova
impossibile fa passare i test per il motivo sbagliato.
