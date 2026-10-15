// Service worker minimale: mette in cache i file dell'app così può
// funzionare offline e i browser la considerano "installabile".
//
// STRATEGIA CAMBIATA (era cache-first, ora è network-first) — causa di un bug reale appena
// scoperto: con cache-first, ogni volta che pubblichi un app.html aggiornato (anche solo per
// correggere un bug come quello MT5), chi ha già aperto l'app UNA VOLTA continua a vedere la
// versione VECCHIA anche dopo aver ricaricato la pagina — il service worker rispondeva sempre con
// la copia in cache PRIMA di controllare la rete, aggiornando la cache solo per il giro
// SUCCESSIVO. Risultato concreto: un fix pubblicato sembra "non funzionare" quando in realtà non
// è mai arrivato al browser, e non c'è alcun errore visibile che lo segnali — è emerso proprio
// così durante un test manuale. Con la rete disponibile (il caso normale) ora si prova SEMPRE la
// rete per prima; la cache resta come rete di sicurezza SOLO per l'uso offline vero (o se la rete
// è momentaneamente irraggiungibile). CACHE_NAME cambiato apposta (v2 -> v3) per invalidare una
// volta per tutte le cache vecchie di chi ha già usato l'app prima di questo fix.
// ---------------------------------------------------------------------------
// REGOLA: ALZA DI UNO QUESTO NUMERO A OGNI RILASCIO CHE L'UTENTE DEVE RICEVERE.
//
// Questa costante e' l'UNICA cosa che costringe il browser di chi ha gia' usato
// l'app a buttare via la copia in cache e riprendere i file aggiornati. Se
// pubblichi un app.html nuovo SENZA toccarla, l'activate() qui sotto non
// cancella nulla (la chiave cache e' rimasta la stessa) e una parte degli
// utenti continua a vedere la versione vecchia, senza nessun errore visibile:
// per te il fix "non funziona", in realta' non e' mai arrivato al browser.
//
// Va alzata in particolare ogni volta che si rigenera l'installer da
// installer_build (build_exe.bat + installer.iss): il pacchetto desktop
// contiene la sua copia di questo file, quindi le due cose vanno in coppia.
// Tenere allineate TUTTE le copie (vedi ISTRUZIONI_BUILD.txt):
//   applicazione/sw.js             -> quella che va sul repo del sito
//   installer_build/sw.js
//   installer_build/build/sw.js    -> quella impacchettata nell'exe
// Storico: v4 = pubblicato sul repo fino al 26-09-2026 · v5 = mai pubblicato
//          v6 = rilascio con installer desktop, Mt5FeedServer e protocollo
//               forexbacktestlab://
//          v7 = usata dalle copie in installer_build (il repo era rimasto a v6)
//          v8 = accesso alle sale Telegram: popup del codice che non si perde
//               piu', numero ricordato, suono all'arrivo di un segnale. Si salta
//               la v7 apposta: chi ha l'installer precedente ha gia' quella
//               chiave in cache e con lo stesso numero non scaricherebbe niente.
//          v9 = accesso da altri dispositivi: controllo del firewall corretto su
//               Windows italiano, messaggio del tablet che non accusa piu' il PC
//          v10 = accesso da altri dispositivi SOLO via Tailscale (https sul nome
//               .ts.net): niente Wi-Fi, niente firewall, stesso sito sul tablet
//          v11 = la prova del collegamento riconosce il permesso «rete locale» del
//               browser e offre il test diretto, invece di dire «computer non trovato»
//          v12 = login al conto MT5 dal tablet (mancava la chiave); dal tablet
//               «Disconnetti» e la chiusura della pagina non spengono piu' il PC
//          v13 = cambio conto MT5: le posizioni dell'altro conto non si chiudono piu'
//               a prezzo 0 nel Trade Journal, si mettono da parte e tornano
//          v14 = con piu' conti MT5 si sceglie su quale entrare (niente riconnessione
//               all'ultimo); server predefinito MetaQuotes-Demo
//          v15 = footprint allineato nell'ora 22-23 (via i tick MT5 storici dalle fasce
//               di Capital.com); linee TP/SL/entrata evidenziate mentre si premono
//          v125 = nuovo indicatore "Gann 21.7 Profit Factor (4h)" nativo in INDICATOR_DEFS,
//               personalizzabile dal pannello impostazioni (34 parametri)
//          v129 = candele/disegni a mercato chiuso: lo scarto orologio broker<->UTC non si
//               ricalcola piu' da un tick fermo (capitava partendo a weekend chiuso: le
//               candele "saltavano" nel futuro). Il servizio candele ora scarta gli scarti
//               impossibili e ricorda quello buono su disco fra un riavvio e l'altro.
//          v130 = grafico Live 22-23: i prezzi Capital.com vengono riportati al livello MT5
//               (niente piu' salto di decine di punti alle 22) e le candele 22-23 gia' salvate
//               si riallineano alla riapertura; cronologia sale: stop a pareggio prima del TP1
//               (percentuale del cammino verso il TP1) nel calcolo della resa.
//          v133 = fix "l'Order Block si toglie da solo": la condivisione fra dispositivi manda
//               l'elenco COMPLETO degli indicatori di una sessione; se un altro dispositivo (es.
//               il telefono con la versione vecchia in cache) rispondeva con la sua lista senza
//               l'OB, la sostituzione lo cancellava dal grafico in pochi secondi. Ora l'arrivo di
//               una voce remota fa un'UNIONE: per lo stesso indicatore (stesso id) vince la voce
//               remota, ma gli indicatori presenti solo su questo dispositivo vengono TENUTI.
//               + segnali senza take profit e senza stop loss: eliminati (non si aprono da soli,
//               via dal pannello); segnali con il target ma SENZA stop loss: non si aprono in
//               automatico ma restano nel pannello per l'apertura a mano.
//          v134 = apertura automatica: la colonna STRATEGIA (accanto a "Max pos.") e la strategia
//               universale ora si aprono con un MENU' A TENDINA che mostra SOLO la configurazione
//               (cosa succede a ogni take profit e dove va lo stop); il riassunto non sta piu' sul
//               pulsante e resta solo nel box in fondo. Aprendo il menu' di una sala le altre
//               restano dove sono. Tolto il campo "Senza stop e senza target". Corretto anche un
//               errore latente: la funzione tgAutoEqua, usata per la scorciatoia "Piu' sul primo
//               target", non era mai stata definita.
// ---------------------------------------------------------------------------
//          v136 = perfezionamenti Replay Live (barra Replay in PIP/finestra separata, gradiente
//               stile TradingView Bar Replay durante la scelta del punto, posizioni reali ancora
//               aperte nascoste in replay coi soli trade rivelati e ricostruzione dei livelli,
//               toggle "posizioni chiuse" senza orizzontali di prezzo).
//          v137 = P/L delle posizioni reali MT5 identico al terminale: ovunque (etichetta sul
//               grafico, casella TP/SL, box "P/L Live", tabelle) si usa profit+swap+commissione
//               della fotografia del bridge, non piu' un ricalcolo col prezzo di un'altra fonte.
//          v138 = replay/posizioni: le orizzontali di entry/TP/SL si vedono SOLO finche' la
//               posizione e' aperta; P/L live in PIP anche in finestra separata; selezione/
//               deselezione delle posizioni e tasti TP/SL sulla posizione selezionata (o sulla
//               bozza); play del replay fluido con moltiplicatore 1x-30x applicato ai dati;
//               freno notizie rosse di Forex Factory con filtri per paese e gravita'.
//          v139 = apertura automatica: il menu' della Strategia (dentro il pannello "Apertura
//               automatica delle posizioni") si apre anche in modalita' PIP, dentro la finestra
//               separata (prima finiva nella pagina principale, restando invisibile), e rientra
//               con essa.
//          v140 = posizioni sul grafico alla MT5: cliccando una posizione aperta SOLO quella
//               resta nei suoi colori (entrata BUY/SELL e caselle Target/Stop); tutte le altre
//               passano in grigio spento, cosi' le loro linee non si confondono con quella
//               selezionata. Senza selezione restano colorate come prima.
//          v141 = replay AL SECONDO (richiesto: il moltiplicatore #speed sono secondi di mercato
//               avanzati per ogni secondo reale, 1x = tempo reale, non piu' "candele"); il
//               "blocco" rosso/verde che si accumulava in formazione e' sparito (ridisegno
//               completo ad ogni aggiornamento, cosi' restano aggiornati anche entry/TP/SL e il
//               P/L mano a mano); footprint: con le righe-per-candela impostate le N righe
//               coprono TUTTA l'ampiezza della candela (alta-bassa); cliccando fuori dopo aver
//               spostato i TP/SL di una posizione selezionata le caselle SL/TP si svuotano
//               (niente piu' anteprima di un ordine inesistente); il box P/L Live (#livePL)
//               resta nella pagina principale anche in PIP/finestra separata.
//          v142 = cambio stile footprint al tocco SEMPRE garantito: l'area sensibile e' una fascia
//               che parte SOPRA l'alta della candela (non di fianco, dove stanno numeri/caselline),
//               cosi' bid/ask -> delta -> volume si puo' cambiare toccando qualsiasi candela, anche
//               minuscola o senza tick registrati. Inoltre: selezionando una posizione si vedono
//               SOLO le sue linee TP/SL con le etichette; le caselle TP/SL delle altre posizioni
//               spariscono del tutto (prima restavano in grigio spento) e ricompaiono cliccando
//               fuori sul grafico, in un punto vuoto.
//          v143 = apertura automatica: il freno notizie di Forex Factory e' ora configurabile per
//               intero. I minuti di sospensione PRIMA e DOPO la notizia sono due campi separati
//               (es. 0 prima e 30 dopo, oppure 30 e 30); si sceglie gravita' per gravita' (alta/
//               rossa, media, bassa) se quella notizia sospende o no; si scelgono i paesi/valute.
//               Il pulsante "Tutti i paesi" e' un ON/OFF: primo clic li seleziona tutti, secondo
//               clic li deseleziona tutti. Il riepilogo mostra il freno acceso con la sua finestra
//               e il filtro. L'interfaccia non veniva mai riempita: ora i filtri salvati si
//               rivedono aprendo il pannello.
//          v144 = replay in Live: col PLAY la candela si forma davvero a schermo (prima lo spazio
//               a destra non veniva riservato e il corpo della candela restava tagliato fuori);
//               via la casellina verde/rossa sulla candela in formazione; posizioni, ordini
//               pendenti, disegni ed etichette dell'asse si rivelano solo quando il replay
//               raggiunge il loro momento; COB e SVP restano spenti; il conto alla rovescia
//               della candela scorre col moltiplicatore di velocita'; i pannelli sotto al
//               grafico non inseguono piu' il presente mentre si guarda il passato.
//               Cronologia delle sale: la prop firm dedicata si misura SEMPRE sul conto
//               iniziale scelto (non sul capitale a cui la sala era arrivata), la data di
//               apertura torna vuota ogni volta che si accende l'interruttore e quando si
//               conferma il pop-up «Prop firm sbloccata».
//               Apertura automatica: si scelgono i CONTI MT5 su cui le sale possono aprire da
//               sole, con tre interruttori - passa da sola al conto scelto, apri su tutti i
//               conti scelti, torna al conto che stavi guardando.
//               Indicatori nascosti: non vengono piu' calcolati (il grafico torna leggero).
//               Footprint a SCALA UNIFORME: stesso passo di riga per tutte le candele, quindi
//               una candela corta mostra meno righe e una lunga di piu', tutte alte uguali.
//          v145 = replay: la candela in formazione e' una CANDELA, non piu' un blocco. La sua
//               larghezza si calcolava sul 62% di TUTTA l'area del grafico invece che di una
//               colonna, quindi col footprint acceso usciva un rettangolo largo 90 px accanto a
//               candele larghe 12; e usava due colori fissi verde/rosso invece di quelli scelti
//               in Style, con lo stoppino quasi invisibile. Inoltre la linea del prezzo
//               principale (bianca, con l'etichetta sull'asse) ora SEGUE la candela mentre si
//               forma: prima restava ferma sulla chiusura dell'ultima candela rivelata e il
//               movimento si vedeva solo da una riga tratteggiata in piu', ora tolta.
//               Footprint: le righe stanno SOLO a fianco della candela - quelle che i tick
//               mettevano sopra o sotto l'alta/bassa si sommano alla riga di bordo invece di
//               uscire dalla candela - e il passo e' uno solo per tutto il grafico: un bucket
//               costruito con un passo diverso (cambio del passo automatico, celle aggregate
//               arrivate dal backup cloud di un altro dispositivo) viene riportato sulla
//               griglia prima di disegnarlo, invece di mostrare righe alte in modo diverso da
//               candela a candela. In replay la candela in formazione ha il suo footprint vero,
//               sulla stessa griglia e con lo stesso disegnatore delle altre: cresce un secondo
//               alla volta insieme alla candela.
//               Cronologia delle sale: quello che si porta a grafico resta su QUESTO
//               dispositivo (dal PC non compare su tablet e telefono, e viceversa), si toglie
//               col pulsante «Togli dal grafico» e sparisce da solo cambiando sala. In piu' un
//               pulsante porta il setup provato sulla resa (rischio, metodologia, percentuali,
//               spostamenti dello stop) dentro la strategia dell'apertura automatica di quella
//               sala, invece di doverla ricopiare a mano.
//               Syntra: un campo per ESCLUDERE gli utenti. Un messaggio di un utente escluso
//               non viene nemmeno riconosciuto come segnale - niente pannello, niente suono,
//               niente apertura automatica - ma l'utente resta nell'elenco, da dove si
//               riammette con una spunta. La scelta si ricorda e vale su tutti i dispositivi.
//               Posizioni aperte e Trade Journal dicono ora se l'operazione e' su Forex/indici/
//               azioni oppure su Cripto: la stessa regola che decide quale delle due strategie
//               automatiche vale per quel segnale.
//               Gruppi di posizioni: due pulsanti sulla riga del gruppo - BE porta a pareggio
//               lo stop di tutte, Chiudi le chiude tutte in un colpo dicendo quanto hanno reso.
//               Cambio stile del footprint al clic: ora la fascia sensibile e' TUTTA la colonna
//               della candela (prima solo il corpo: 9 px per 45 nel banco di prova, con il 38%
//               di colonna morta fra una candela e l'altra), alta quanto la candela piu' almeno
//               22 px sopra e sotto. Vale su ogni candela, anche le passate, a qualunque zoom e
//               timeframe.
//               Syntra: l'asset si legge IN ALTO A SINISTRA della casella e "RR" (il
//               rischio/rendimento) non viene piu' scambiato per un simbolo - prima la regola
//               era "la prima riga con una barra", che sulle schede senza barra (cripto,
//               azioni) lasciava passare qualunque cosa stesse in alto a sinistra.
//               Resa della sala: accanto al calo massimo dal punto piu' alto c'e' ora anche il
//               massimo calo in una sola giornata - il numero che una prop firm guarda per primo.
//               Dashboard, profitto per sala: resa in percentuale, guadagno medio per
//               operazione, R/R e calo massimo, sia nel riquadro al passaggio del mouse sia
//               nella tabella della carta.
//               Syntra, lettore rifatto nel modo di riconoscere le cose: ogni riga si classifica
//               da quello che DICE (data, lato, stato, voto, RR, comandi, numeri), non da dove
//               sta scritta; la posizione resta solo come spareggio. Corretti: le notifiche con
//               la data senza anno (sparivano), le notifiche con una data non riconosciuta (che
//               venivano dichiarate 'vecchie' e buttate SEMPRE, in silenzio - il motivo per cui
//               un utente che manda segnali ogni giorno non veniva mai rilevato), e i prezzi
//               scritti con etichetta e numero in due nodi separati (il segnale usciva senza
//               target ne' stop, quindi veniva scartato).
//          v146 = due difetti della selezione delle posizioni. Una posizione si "sceglieva da
//               sola" e faceva sparire le caselle di tutte le altre: `active` faceva due
//               mestieri - la posizione su cui lavorano le caselle SL/TP, riassegnata dall'app in
//               cinque punti (cambio asset, chiusura, ripristino di sessione, adozione dal conto
//               MT5), e la posizione SCELTA, che nasconde le altre. Ora sono due cose separate:
//               nasconde le altre solo `posSelezionata`, che la mette un clic dell'utente e la
//               toglie un clic sul vuoto. E col DITO il tocco su un punto vuoto deseleziona come
//               col mouse e con la penna: il gestore usciva prima per il touch e il blocco della
//               deselezione non veniva mai raggiunto.
//               E le bandiere delle notizie si vedono anche su telefono e tablet: il polling che
//               le scarica partiva solo da due strade, nessuna delle quali esiste su un telefono
//               (il passaggio a Live fatto a mano, e la riconnessione a Capital.com dopo un
//               refresh, che legge le credenziali da una cartella del computer). Ora si allinea
//               da solo allo stato, dal punto che tutte le strade attraversano.
//               Colonne COB e SVP: stesso aspetto su ogni asset. Il passo delle righe non viene
//               piu' dall'impostazione del FOOTPRINT (tarata sull'altezza di una candela, che non
//               c'entra con una scaletta di liquidita'): si decide in pixel e si arrotonda a un
//               passo tondo dello strumento. Prima su EUR/USD uscivano righe altissime, su
//               XAU/USD fitte, e sulle cripto staccate una dall'altra perche' il passo era cosi'
//               fine che i livelli del book cadevano in bin sparsi. Le barre sono anche attaccate
//               (bordi arrotondati al pixel, niente altezza ridotta di 1 px).
//               Footprint: ARCHIVIO delle candele passate. Si conservano le celle gia' aggregate
//               al minuto (non i tick, troppi), su IndexedDB una chiave per asset e per giorno,
//               per 60 giorni: da li' si costruisce qualunque timeframe sommando i minuti. Prima
//               il footprint si rifaceva solo dal log dei tick, che ha un tetto e scarta i piu'
//               vecchi: passando a 4 ore o a un giorno restavano solo le ultime candele.
//               Posizione selezionata: delle ALTRE restano le linee di stop e target con le loro
//               etichette, in grigio - prima sparivano del tutto - mentre il riempimento colorato
//               resta solo a quella scelta. Cliccando sul vuoto torna tutto.
//               Cronologia delle sale: accanto al pulsante «Analizza e mostra a grafico», mentre
//               scarica, un cerchietto che si riempie con la percentuale e dice cosa sta
//               scaricando.
//               PONTE (serve il reinstaller): la storia di un utente Syntra si prende dalla
//               CLASSIFICA - linguetta in fondo, si scorre fino all'utente, si entra nel suo
//               profilo, si scorrono i setup espandendo i dettagli TP/SL fino al periodo chiesto.
//               Prima si cercava il nome su una sua scheda gia' a schermo: se non aveva
//               pubblicato di recente la lettura moriva prima di cominciare. E il terminale MT5
//               viene ridotto a icona dopo ogni collegamento o cambio di conto, invece di
//               riaprirsi a tutto schermo ogni volta.
//          v147 = REPLAY e posizioni. Col play acceso, entrata, stop, target, P/L e connettore
//               seguono ora la candela IN FORMAZIONE, al ritmo del moltiplicatore scelto: prima
//               passavano tutti da currentPrice(), cioe' la chiusura dell'ultima candela
//               COMPIUTA, un numero che dentro la formazione non cambia mai - percio' facevano
//               un salto secco una volta per candela invece di muoversi. Anche il bordo destro
//               delle caselle Target/Stop avanza con la frazione di candela svelata.
//               E ogni posizione RICORDA I SUOI SPOSTAMENTI: una riga per ogni volta che
//               entrata, stop o target sono cambiati. In replay si rivedono quindi i livelli
//               COM'ERANO in quel momento - lo stop alzato tre volte si rivede alzare tre volte -
//               invece di quelli di adesso disegnati sopra candele di ieri. La traccia si scrive
//               in un punto solo, dentro draw(), perche' stop e target vengono cambiati da dieci
//               strade diverse (trascinamento, tabella, pareggio, trailing, allineamento MT5, e
//               il terminale MT5 stesso da fuori dall'app) e draw() e' il punto che tutte
//               attraversano. In replay il P/L non e' piu' il netto del terminale MT5: quello e'
//               il profitto di ADESSO, e a grafico si sta guardando un altro momento.
//               Sempre v147: LA CANDELA IN FORMAZIONE NON LAMPEGGIA PIU'. Era un ritocco dipinto
//               DOPO draw() e solo dal battito del replay: ogni altro ridisegno (il mirino, il
//               pannello, e forward() ad ogni candela completata) ridipingeva il grafico senza di
//               lei. Piu' si alzava il moltiplicatore piu' spesso le candele si completavano, e
//               piu' spesso il grafico veniva dipinto "senza": per questo peggiorava accelerando.
//               Ora la disegna draw() stesso: non esiste piu' un modo di dipingere il grafico
//               senza. Il play non si "blocca" piu' sulle schede in secondo piano: si misura
//               l'orologio vero invece di dare per scontati 50 ms a battito (i browser rallentano
//               i timer delle schede nascoste a uno al secondo). E ai moltiplicatori alti non
//               scatta piu': le candele completate dentro un giro si valutano tutte ma si
//               disegnano una volta sola alla fine, invece di un ridisegno intero ciascuna.
//               TP1 = il piu' VICINO all'entrata, comunque la sala li scriva. Non c'era nessun
//               ordinamento: si teneva l'ordine di scrittura, quindi una sala che elenca dal piu'
//               lontano al piu' vicino faceva diventare TP1 l'ultimo obiettivo - e la strategia
//               sposta gli stop "quando il prezzo raggiunge il take profit n.1", quindi li
//               spostava nel momento sbagliato. Un target mancante nel messaggio non diventa piu'
//               un take profit a prezzo zero.
//               Il rifiuto di un segnale con lo stop dalla parte sbagliata ora dice QUALE numero
//               sta guardando: chiamava "prezzo di adesso" l'entrata scritta dalla sala in un
//               ordine pendente, e faceva cercare un errore nei prezzi che non c'era.
//          v148 = SALE E NOTIZIE IMPORTANTI: nuova carta nella dashboard della resa. Quali sale
//               rendono di piu' (e di meno) quando escono i dati a gravita' rossa, con il
//               confronto fra la stessa sala sulle notizie e fuori - una sala puo' guadagnare di
//               piu' sulle notizie solo perche' opera di piu', e il totale da solo non lo
//               direbbe. Conta un'operazione APERTA entro mezz'ora da un dato che tocca una
//               valuta del suo asset. Le notizie importanti si archiviano man mano che arrivano
//               (il calendario e' solo l'ultima fotografia, e viene sostituita): la statistica
//               parte da questa versione piu' la settimana gia' nota, e si riempie col tempo.
//               POSIZIONI KRAKEN SU TELEFONO E TABLET: tornano stop e target. Il disegno li
//               prendeva dagli ordini VERI presenti su Kraken e, quando li' non ci sono (ogni
//               volta che a gestirli e' l'app), ripiegava sulle strategie - che pero' sono di
//               proposito del solo dispositivo che ha aperto la posizione. Sul telefono quella
//               voce non c'era: niente stop, niente target, solo l'entrata e il P/L. Ora i
//               LIVELLI si pubblicano in una voce condivisa che gli altri dispositivi usano solo
//               per disegnare; il motore delle strategie resta dov'era.
//               E uno stop ASSENTE non diventa piu' uno stop a PREZZO ZERO (il ponte manda null,
//               e Number(null) fa 0): la casella non copre piu' mezzo grafico.
//               "VAI A GRAFICO" non fallisce piu' in silenzio: i quattro punti che saltano a
//               grafico chiamavano tutti Capital.com, che su un telefono non ha sessione (le
//               credenziali si leggono da una cartella del computer) e usciva senza dire niente -
//               il menu mostrava il nuovo asset, il grafico restava col vecchio. Ora la fonte si
//               sceglie una volta sola, c'e' il ripiego sulla libreria storica, e se proprio non
//               si puo' caricare lo si dice.
//               E la casella Target/Stop non sparisce piu' quando la candela di apertura non e'
//               nello storico caricato: entrata, stop e target sono prezzi, esistono comunque.
//          v149 = KRAKEN: UNA STRATEGIA CHE SPOSTA LO STOP NON E' UNA STRATEGIA CHIUSA. Appena un
//               take profit viene colpito la strategia sposta lo stop - e' il suo mestiere - e
//               spostarlo vuol dire cancellare l'ordine e piazzarne uno nuovo: per un istante il
//               vecchio id non c'e' piu' e il nuovo non e' ancora nella fotografia degli ordini.
//               Un giro del controllo con la fotografia di PRIMA concludeva "stop eseguito":
//               cancellava i take profit rimasti, scriveva una chiusura nel Journal e buttava la
//               strategia. Da fuori: dopo il primo TP sparivano stop e target, e i TP successivi
//               venivano tolti da Kraken. Ora una lettura piu' vecchia dell'ultima nostra mossa
//               non decide niente: si aspetta il giro dopo.
//               E la riga di Journal di una chiusura Kraken ha numeri veri: i pip erano scritti
//               ZERO fissi (nel Journal si leggeva "+0.0" per qualunque operazione cripto) e la
//               colonna Conto conteneva la stringa 'kraken', che passata a euro() diventava
//               "NaN €". Ora i pip si calcolano come per ogni altra operazione e il conto e' il
//               saldo vero, convertito in euro come il P/L della stessa riga.
//          v150 = SYNTRA, LA STORIA DI UN UTENTE (serve il reinstaller: gira nel ponte). Il robot
//               arrivava sul profilo giusto e poi non faceva piu' niente: "0 operazioni lette".
//               Un cane che si morde la coda: una scheda si riconosce solo se contiene la riga
//               "Entrata:", che compare solo a dettaglio APERTO, ma sul profilo le operazioni
//               arrivano CHIUSE - e i pulsanti per aprirle venivano cercati DENTRO le schede gia'
//               riconosciute. Nessuna scheda, nessun pulsante, niente da espandere, niente da
//               riconoscere. Ora i pulsanti si cercano nell'albero intero e le posizioni si aprono
//               una per una, dall'alto in basso, fino al periodo chiesto.
//               Lo scorrimento si calcolava dall'ingombro delle schede: senza schede non avveniva
//               nemmeno, e si restava fermi sulla stessa schermata per tutte le pagine previste.
//               Ora si scorre lo stesso, e dopo tre schermate senza riconoscere niente ci si ferma
//               invece di insistere dentro l'app di qualcun altro.
//               Il profilo ha il suo tetto di schermate (60, non 2 come il giro delle notifiche):
//               a fermarlo deve essere il periodo o il fondo della pagina, non un numero deciso a
//               tavolino.
//               E se Syntra viene chiusa a forza, si riapre: il controllo che c'era gira ogni 30
//               secondi nel ciclo principale, ma la lettura di un profilo dura minuti dentro un
//               solo giro di quel ciclo, quindi proprio mentre serviva non arrivava mai. Serve
//               anche a non toccare lo schermo AL BUIO: con Syntra morta, un tocco a coordinate
//               fisse preme quello che si trova sotto, dentro l'app di qualcun altro.
//               Sempre v150: TP1 = IL PIU' VICINO ALL'ENTRATA ANCHE SU KRAKEN E NELLA CRONOLOGIA.
//               In v147 era stato corretto per i segnali Telegram, ma restavano tre punti che si
//               costruivano la lista per conto loro. Il ponte Kraken manda i take profit ordinati
//               per PREZZO crescente, sempre, qualunque sia il lato: su un SELL il primo della
//               lista e' il piu' LONTANO. Su un SELL BNB/USD da 730 con target 725-720-711-702, a
//               grafico compariva "TP1" a 702 e "TP4" a 725, al contrario. Nella cronologia delle
//               sale non era nemmeno solo un'etichetta: i TP raggiunti si contano scorrendo quella
//               lista IN ORDINE, quindi con l'ordine sbagliato sbagliavano il conteggio, il win
//               rate per TP e tutte le statistiche.
//          v151 = ORDINI PENDENTI A GRAFICO: l'etichetta dice anche QUANTO (il lottaggio), e
//               scegliendo una posizione gli ordini pendenti si spengono con le altre - le loro
//               righe di stop e target, che attraversano tutto il grafico da un bordo all'altro,
//               spariscono del tutto. L'entrata resta, spenta: serve a sapere che l'ordine e' li'.
//               KRAKEN, IL MARGINE LO DECIDI TU. Il rischio scelto nella sala e' quanto si perde
//               ALLO STOP, non il margine: con un conto da 10.000 e il 2%, se lo stop dista 10
//               punti su un prezzo di 730 servono 20 monete, cioe' 14.600 di valore, che a leva 2x
//               sono 7.300 di margine. Il calcolo era corretto - stop stretto e leva bassa (le
//               cripto in UE sono 2x) chiedono molto margine per poco rischio - ma niente
//               permetteva di metterci un tetto. Ora c'e': "Margine massimo per operazione, % del
//               conto" nelle impostazioni Kraken, rispettato sia dal lottaggio consigliato nella
//               barra sia dai segnali automatici. Sui segnali il piano viene RICALCOLATO con un
//               rischio ridotto della stessa proporzione (non ritoccato a posteriori), e la
//               riduzione si legge nella scheda del segnale. 100% = nessun tetto, come prima.
//               Il margine impegnato ora si legge nel riquadro del lottaggio consigliato, accanto
//               al rischio: erano due numeri diversi e se ne vedeva uno solo.
//          v152 = POSIZIONI KRAKEN ANCORATE ALLA CANDELA VERA. Il ponte non diceva QUANDO una
//               posizione era stata aperta (Kraken lo manda in "fillTime", non veniva letto):
//               l'app ripiegava sulla data della strategia - che su un altro dispositivo non
//               esiste - e in ultimo su "venti candele prima della fine", cioe' un punto qualunque.
//               L'entrata finiva sopra candele che quel prezzo non l'avevano mai toccato. Ora il
//               ponte manda aperta_ms (anche il conto simulato) e la casella sta dove deve.
//               E tornano la FRECCIA di apertura e la LINEA fino al prezzo di adesso, come per le
//               posizioni MT5: si disegnano solo quando l'orario e' quello vero, perche' con un
//               ripiego indicherebbero una candela a caso.
//               "VAI A GRAFICO" PORTA ANCHE SUL CONTO GIUSTO: un'operazione cripto riporta sul
//               conto Kraken, una forex su MT5, dalla tabella delle posizioni come dal Trade
//               Journal. Il conto decide la FONTE dei prezzi: guardare una posizione Kraken col
//               conto MT5 davanti vuol dire leggere i suoi livelli sopra candele di un'altra
//               fonte. Il conto si cambia PRIMA di caricare l'asset, per non caricarlo due volte.
//               SYNTRA (serve il reinstaller): il tocco su "Vedi dettagli TP/SL" spesso non
//               espande sul posto, APRE UNA PAGINA A SE'. Da li' non c'erano piu' pulsanti, si
//               leggeva quell'unica operazione e il giro finiva: "apre la prima posizione, la
//               legge, e poi basta". Ora quella pagina si legge, si torna indietro e si riprende
//               dalla posizione seguente, fino al periodo scelto.
//          v153 = I SEGNALI CRIPTO VANNO SU KRAKEN. Segnalato: un segnale cripto aperto su
//               Capital.com invece che su Kraken. Due buchi, non uno. (1) La spunta "Apri i
//               segnali cripto sul conto Kraken" partiva SPENTA, e da spenta un segnale cripto
//               ricadeva sul ramo MT5; se MT5 non aveva quello strumento finiva su Capital.com.
//               Ora parte ACCESA: chi la spegne di proposito se la vede rispettata. (2) Il
//               riconoscimento delle cripto stava tutto in una tabella di nomi: una moneta scritta
//               dalla sala in una forma non prevista non risultava cripto per niente. Ora, prima
//               di dirottare su Capital.com, si CHIEDE A KRAKEN se ha quel contratto - e' lui la
//               fonte autorevole, e non c'e' nessun elenco da tenere aggiornato. Se Kraken non e'
//               collegato il segnale viene rifiutato dicendolo, non dirottato altrove: aprire sul
//               conto sbagliato e' peggio che non aprire.
//               ORIGINE E TIPO DI STRUMENTO: colonna "Origine" (da quale sala arriva) negli ordini
//               pendenti e nelle posizioni Kraken, con la famiglia dello strumento - forex, cripto,
//               materia prima, indice o azione - anche nel Trade Journal. Nella tabella Kraken i
//               clic per spostare stop e target erano legati ai numeri di colonna scritti a mano:
//               ora ogni cella si numera da sola, cosi' aggiungere una colonna non li sposta.
//               CONTI CHIUSI: i conti MT5 che non ci sono piu' restano consultabili in un gruppo
//               tutto loro, ma escono da ogni vista "insieme" - non falsano piu' win rate, resa e
//               totali dei conti che si usano adesso. Con l'elenco dei conti non ancora letto non
//               si dichiara chiuso niente (altrimenti la dashboard si svuoterebbe da sola).
//               ANDAMENTO DEL CONTO: passando sopra si legge anche il capitale dopo quella
//               operazione, preso dal saldo gia' salvato e non ricalcolato.
//               Sempre v153: STOP E TARGET SI SCRIVONO NELLA BARRA DENTRO AL GRAFICO. Accanto ai
//               pulsanti SL e TP ci sono i campi del valore: si scrive li', e SVUOTANDO la casella
//               il livello si toglie. I campi del pannello restano l'unica fonte di verita' (li
//               leggono piu' di trenta punti del programma): quelli nella barra si rispecchiano
//               sopra, come gia' fanno lottaggio e rischio.
//               E un interruttore in Impostazioni -> Style accende e spegne gli ordini pendenti a
//               grafico: spento non si disegna nessuna loro riga, restano solo nella tabella.
//               Colonna "Origine" anche nelle posizioni MT5: le due tabelle delle posizioni devono
//               restare gemelle, ed e' un test del collaudo a tenerlo fermo.
//               CORRETTO UN DIFETTO LATENTE trovato dal collaudo: krakenConto poteva diventare
//               null (risposta andata a buon fine ma con il corpo vuoto) e da li' in poi ogni giro
//               del controllo periodico moriva in silenzio. Non l'ha creato questa versione: l'ha
//               scoperto, perche' accendendo di base i segnali cripto su Kraken quella strada ha
//               cominciato a essere percorsa davvero.
//          v154 = IL PANNELLO DEGLI ORDINI SULLA PAGINA SPARISCE. Gli ordini si aprono dalla barra
//               dentro al grafico - a mercato e pendenti - e quel riquadro non serviva piu'.
//               E' NASCOSTO, non cancellato: i suoi campi non sono un duplicato di quelli della
//               barra, sono la MEMORIA dell'applicazione (li legge mezzo programma, dal lottaggio
//               consigliato all'apertura vera) e la barra ci scrive sopra. Cancellarli avrebbe
//               rotto proprio la barra che li ha sostituiti.
//               Verificato prima di nascondere: chiudere una posizione si fa dal suo pulsante
//               nella tabella, e chiudere a blocchi dal menu "Operazioni a blocco" - che offre
//               piu' del vecchio "CHIUDI TUTTE" (tutte, in guadagno, in perdita, per direzione,
//               per asset).
const CACHE_NAME = "forex-backtest-lab-v154";
const ASSETS = [
  "./",
  "./app.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// MOSTRA SUBITO, AGGIORNA DIETRO.
//
// MISURATO il 7 ottobre 2026: app.html pesa 4,03 MB e ci mette 3,2 secondi a scaricarsi da un
// computer con rete veloce. Su dati mobili sono 7-30 secondi, piu' il tempo di interpretare 4 MB
// di codice sul processore del telefono. Segnalato dal proprietario: sul telefono l'app "resta
// ferma sul logo".
//
// Come si faceva prima: si chiedeva SEMPRE la rete, con `cache: 'no-store'` che salta apposta
// anche la cache del browser, e la copia salvata si mostrava solo dopo RISERVA_MS = 4 secondi di
// attesa. Con un file da 4 MB quei 4 secondi di schermata vuota c'erano quasi sempre, e i 4 MB si
// riscaricavano a ogni apertura - anche alla decima.
//
// Adesso: se una copia c'e', si mostra SUBITO; la rete continua per conto suo e aggiorna la copia
// per la volta dopo. La primissima apertura scarica comunque (non c'e' alternativa), ma da li' in
// poi l'app si apre all'istante, anche con la rete lenta o assente.
//
// E una correzione appena pubblicata? Arriva lo stesso: il download che continua dietro rinfresca
// la copia, e CACHE_NAME con skipWaiting fa il resto. Se la versione nuova arriva mentre l'app e'
// in uso, la pagina lo DICE invece di ricaricarsi da sola: ricaricare di colpo mentre si guarda
// una posizione aperta sarebbe peggio del problema che risolve.
//
// Niente piu' `cache: 'no-store'`: GitHub Pages manda l'ETag, quindi l'aggiornamento di sfondo di
// solito e' una domanda da pochi byte ("e' cambiato?") invece di 4 MB di dati mobili.
function rispostaSubitoPoiAggiorna(request) {
  const rete = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    });
  return caches.match(request).then((salvata) => {
    if (salvata) {
      // La copia c'e': si parte subito. Un errore di rete adesso non deve diventare un errore
      // della pagina, che e' gia' stata servita.
      rete.catch(() => {});
      return salvata;
    }
    // Prima apertura in assoluto: non c'e' niente da mostrare, si aspetta la rete.
    return rete.catch(() => caches.match(request).then((c) => c || Promise.reject(new Error('offline'))));
  });
}

self.addEventListener("fetch", (event) => {
  // Solo richieste GET dello stesso sito. BUG CORRETTO: il commento lo diceva, il codice no - si
  // intercettava OGNI GET, compresi i dati dal vivo del PC (/positions, /account, notizie...) e di
  // Firebase/Capital.com, salvandone una copia. Col PC irraggiungibile si restituiva l'ultima copia:
  // posizioni e saldo VECCHI mostrati come attuali. I dati dal vivo non passano piu' da qui.
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Anche sullo stesso sito, SOLO i file dell'app: quando l'app e' servita dal PC (127.0.0.1:8000)
  // anche /positions e /account sono "dello stesso sito", e non devono mai finire in cache.
  const statico = event.request.mode === "navigate" || url.pathname.endsWith("/") ||
    /\.(html|js|css|json|png|ico|svg|webmanifest|woff2?)$/i.test(url.pathname);
  if (!statico) return;

  event.respondWith(rispostaSubitoPoiAggiorna(event.request));
});

// LA VERSIONE NUOVA E' PRONTA: lo si dice, non si ricarica di nascosto.
//
// Con "mostra subito" una pagina gia' aperta continua a usare la copia vecchia finche' non la si
// riapre. Va benissimo per l'avvio, ma chi ha appena pubblicato una correzione deve poterla
// vedere senza indovinare quando. Quando un service worker NUOVO prende il controllo (CACHE_NAME
// diverso) lo si comunica alle pagine aperte: ci pensa app.html a mostrare un avviso con
// "Ricarica". Ricaricare da soli, magari mentre si sta guardando una posizione aperta, sarebbe
// peggio del problema che risolve.
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const pagine = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const p of pagine) {
      try { p.postMessage({ tipo: "versione-nuova", cache: CACHE_NAME }); } catch (e) {}
    }
  })());
});
