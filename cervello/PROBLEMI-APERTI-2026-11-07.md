# Problemi aperti da risolvere PRIMA delle migliorie (7 novembre 2026)

Lista fatta col proprietario. Si fa **una cosa per volta**, con misura e test,
e si pubblica solo a collaudo verde. Le migliorie (finestre duplicate) aspettano.

## P0 — CRASH: il programma crasha da solo, anche restando dentro
- Sintomo: «continua a crashare anche quando sono dentro da un momento all'altro,
  piu' andiamo avanti e piu' crasha».
- Fatto: bridge.log sano; Mt5FeedServer.log 25 MB (log che cresce);
  ForexBacktestLAB.log 2,4 MB con solo OSError WinError 64 su accept (benigno).
- Da misurare: cosa fa crashatre la finestra pywebview (ForexBacktestLABDesktop.exe).
  Cercare dump/eventi su Windows, poi riprodurre.
- Stato: DA FARE.

## P0 — AGGIORNAMENTO: il pulsante non compare e la versione si aggiorna da sola
- Sintomo: «ero sulla 2.0.99, entro, non mi mostra il pulsante aggiorna, chiudo e
  riapro, crash ripetuti, poi mi ritrovo sulla 2.1.1 senza aver toccato nulla e
  senza che mi abbia installato i pacchetti».
- MISURATO sul PC: il ponte serviva `app_aggiornata\app.html` congelato dalla
  **v2.1.1** (marcatori `_applicaRimanente`, `const end0=` trovati nel file).
  Il bridge aveva quindi la COPIA WEB nuova mentre gli .exe erano quelli vecchi:
  web aggiornato dal service worker / rotta /aggiorna-app, programma MAI reinstallato.
- Conseguenze: il bug del mercato chiuso «torna» perche' la pagina nuova gira sopra
  un ponte vecchio, e l'app sembra aggiornata senza esserlo (proprio il sintomo
  «finta che gli fa credere di essere aggiornato»).
- Da fare: la versione MOSTRATA deve essere quella del PROGRAMMA installato, non
  quella della copia web; il piano aggiornamento va deciso su quella; quando web e
  programma non combaciano, il pulsante DEVE comparire (anche se il tag visto e'
  gia' quello nuovo).
- Stato: DA FARE.

## P0 — MERCATO CHIUSO: l'asse arriva a «adesso» invece di fermarsi alle 22:00
- Sintomo: «mi mostra l'orario di adesso mentre il mercato si e' chiuso ieri alle
  22:00» / «l'ultima candela inserita mi segna le 19:29».
- Nota: e' un problema GIA' successo e poi risolto (v2.0.99 tolse «il tempo e'
  infinito»). Con la pagina v2.1.1 servita sopra un ponte vecchio il sintomo e'
  tornato: la cura va rifatta e resa stabile.
- Stato: FATTO in v2.1.2 (congelamento solo in auto-segui). Da ricontrollare sul PC.

## P1 — REGRESSIONE MIA (v2.1.0): bloccavo lo spostamento orizzontale
- Sintomo: «il grafico mi si sposta solo in verticale ma non in orizzontale».
- CAUSA: congelavo `end` sempre a mercato chiuso, anche durante pan/zoom manuale.
  Di sabato (chiuso tutto il giorno) non si poteva piu' scorrere la cronologia.
- CURA: congelamento solo se `followLatest` (auto-segui): ciucci si sposta il
  grafico followLatest diventa false e il congelamento sparisce.
  Test obbligatori: pan libero a mercato chiuso + auto-segui che non avanza.
- Stato: FATTO e pubblicato in v2.1.2. Congelamento solo se followLatest: appena si sposta
  il grafico followLatest diventa false e il congelamento non c'e' piu'. Provato nei due versi
  (congelamento spento del tutto -> 2 prove rosse; cura v2.1.0 rimessa -> la prova del pan in
  avanti resta rossa).

## P2 — FIREBASE: continua a leggere e scrivere a mercato chiuso
- Sintomo (segnalato dal proprietario): «nonostante tutto i mercati sono chiusi, su Firebase
  continua ad aumentare la scrittura e la lettura del progetto... in realta' non dovrebbe
  ne' leggere ne' scrivere nulla a mercati chiusi».
- Numeri già visti: 57K scritture / 114K letture al giorno contro un limite di 20K/50K.
- Ipotesi da misurare (NON ancora verificate): il giro di salvataggio (scheduleSave) e/o il
  controllo aggiornamenti / polling MT5 continuano a scrivere anche quando il mercato è
  chiuso e non cambia niente.
- Da fare: misurare quali scritture/letture partono a mercato chiuso, poi zittirle.
- Stato: DA FARE (dopo P0/P1).

## Dopo — finestre duplicate (cervello/RICHIESTE-DUPLICA-FINESTRA.md)
- 9 voci, lavoro a se. Non si tocca finche' P0/P1 non sono chiusi e pubblicati.
