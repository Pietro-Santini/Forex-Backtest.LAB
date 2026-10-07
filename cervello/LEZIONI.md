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
9. **Verde qui, rosso su GitHub = il test dipende dall'ambiente.** Il simulatore Kraken scaricava i
   prezzi veri appena creato: nel contenitore Kraken non si raggiunge, su GitHub sì, e il prezzo
   reale faceva scattare i TP finti. Ora `laboratorio/ponte/_percorsi.py` blocca ogni connessione
   non locale. Un test non deve mai dipendere da internet.
10. **Oracle gratuito: "Out of capacity" sulla ARM è normale.** Non insistere a vuoto: forma più
    piccola, altro availability domain, oppure la AMD Micro gratuita (con swap) per partire subito.
11. **Oracle: l'immagine predefinita è Oracle Linux, non Ubuntu.** Utente `opc`, non `ubuntu`;
    "Permission denied (publickey,gssapi-...)" con `ubuntu@` è il segnale. La guida ora dice di
    premere Change image.
12. **Ubuntu sì, ma 24.04.** Nell'elenco delle immagini Oracle c'è anche la 20.04 (fuori supporto,
    senza Docker): far controllare `lsb_release -d` appena dentro il server.
13. **Prima di inventare una numerazione, guardare quella che c'è.** Le release del proprietario
    erano già `v1.0.NN`: la mia `app-v86-setup-1.0.8` faceva sembrare il Setup più vecchio.
14. **Prima di avviare un servizio su un server "nuovo", guardare chi tiene già la porta.** Sul
    server Oracle un vecchio `forex-bridge.service` (systemd) occupava 127.0.0.1:8769 e il
    container `segnali` ripartiva in tondo con "porta occupata". `ss -ltnp | grep 8769` lo dice
    subito.
15. **"Dimentica il numero" deve voler dire "esci".** Togliere solo il numero lasciava la
    sessione Telegram attiva: il proprietario si aspettava di essere scollegato.
16. **Una guida che dice "sezione X" deve nominare ogni pulsante da premere per arrivarci.** "Prova
    il server" era dietro "Accesso da altri dispositivi", un nome che non c'entrava col server.

- **`app.html` ha a capo Windows (CRLF).** Uno script di modifica che cerca blocchi su piu' righe
  scritti con `
` non trova mai niente e l'assert boccia senza spiegare perche'. Convertire gli
  a capo del blocco cercato prima di cercarlo.
- **Nei test, «non risponde mai» si scrive `Infinity`, non `999`.** Con l'attesa accorciata si
  fanno oltre mille tentativi in pochi secondi: un 999 viene raggiunto davvero e la prova che
  doveva fallire riesce, dicendo il falso.
- **Le variabili lette da `localStorage` all'avvio della pagina** non cambiano se il test scrive
  nel deposito dopo il caricamento: va impostata anche la variabile in memoria.
- **Su Windows `python3` puo' essere il segnaposto del Microsoft Store**, un interprete diverso da
  quello con le librerie: il collaudo bocciava senza motivo. `collauda.sh` ora sceglie
  l'interprete che ha davvero pytest.
- **`subprocess.run(..., text=True)` su Windows decodifica con la codifica locale (cp1252).** Su
  `app.html` scoppia dentro un thread di lettura: l'eccezione non arriva al chiamante, il
  risultato resta vuoto e il controllo **non blocca mai**. Passare sempre
  `encoding="utf-8", errors="replace"`. Un controllo che fallisce in silenzio e' peggio di un
  controllo assente, perche' si crede di essere protetti: provare sempre anche il caso che DEVE
  bloccare, non solo quello che deve passare.
- **Meglio chiedere a git se un file e' cambiato (`git diff --quiet`) che leggerlo e confrontarlo.**
  Su un file da 4 MB e' piu' veloce e non c'e' nessun problema di codifica.
- **Collaudo verde sul PC non vuol dire verde su GitHub.** Dal 6 al 7 ottobre 2026 il flusso
  Collaudo e' rimasto rosso a ogni push senza che nessuno guardasse: sul PC le librerie c'erano,
  nel flusso no. Dopo ogni pubblicazione: `gh run list --workflow=collaudo.yml --limit 3`.
- **Le librerie di un servizio si installano dal file che le dichiara** (`requirements.txt`), non
  elencandole a mano nel flusso: l'elenco a mano resta indietro al primo import nuovo, e il
  programma esce all'avvio con "Mancano le librerie" invece di dire quale manca.

- **Il bug era in `installer_build/build/segnali_telegram/requirements.txt` vs `collaudo.yml`.**
  `pip install fastapi` senza `uvicorn` fa fallire l'import di `segnali_bridge` prima di ogni test.
- **Una chiave di deduplicazione non si ricava mai da un nome che l'utente puo' cambiare.** Al
  primo rinomina tutte le chiavi cambiano e tornano tutti i doppioni. Si usa l'identificativo.
- **Lo script di modifica salva solo alla fine: se un passo fallisce, NON ha scritto niente.** E'
  voluto (niente mezze modifiche), ma le righe "ok" gia' stampate ingannano: dopo un errore vanno
  rifatte TUTTE le sostituzioni, non solo quella fallita.
- **Gli heredoc di bash, in questo ambiente, mangiano UN livello di backslash** anche fra
  apici singoli. Uno script che cerca blocchi contenenti `\n` o `\'` non combacia piu', e
  l'errore dice solo "0 occorrenze": si finisce a dubitare del testo invece che del modo in
  cui e' arrivato. **Gli script di modifica si scrivono come file e si lanciano**, mai
  incollati in un heredoc.
