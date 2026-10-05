# Lezioni (errori di ragionamento da non ripetere)

1. **Prima la prova, poi l'ipotesi.** Sul 403 del WebSocket si sono persi giri su librerie e
   permessi del browser; la causa era un decoratore spostato. Riprodurre e leggere il codice che
   risponde, prima di teorizzare.
2. **Candele finte con date ISO con la Z** (`new Date().toISOString()`). Le date senza fuso vengono
   lette come ora del broker e spostano tutto: una posizione "sparisce" dal grafico per colpa del
   test, non dell'app.
3. **Id generati col tempo collidono.** Due oggetti creati nello stesso millisecondo: aggiungere
   una parte casuale.
4. **Percorsi veri, mai inventati.** Il proprietario estrae lo zip in
   `C:\Users\pietro\Desktop\trading` (vecchio PC) e la cartella si chiama sempre `installer_build`.
   Sul PC nuovo il percorso va chiesto, non indovinato.
5. **Un comando per riga** nelle istruzioni per Windows, con la cartella da cui lanciarlo.
6. **Uno screenshot non è un test.** Ogni verifica visiva va trasformata in un'asserzione in
   `laboratorio/`.
7. **Nella finestra PIP il `document` è un altro.** Ascoltatori con `fblDelega`, ricerche con `$$tutti`.
8. **Un valore "comodo" può nascondere un modello sbagliato.** I pip forex su BTC davano 1.500.000:
   quando un numero è assurdo, il modello è sbagliato per quello strumento.
