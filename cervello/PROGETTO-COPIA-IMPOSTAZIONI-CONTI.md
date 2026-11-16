# Copia delle impostazioni da un conto all'altro — in coda

Richiesta del proprietario, **16 novembre 2026** (era già scritta come punto aperto nella consegna del
15 novembre: «Copiare le impostazioni da un conto a un altro»):

> «in passato avevo anche chiesto il fatto di poter copiare le impostazioni dentro l'apertura
> automatica delle posizioni, cioè scegliere impostazioni per il conto e copiare quelle di un altro
> conto a disposizione nell'elenco dei conti, quindi copiare quelli che sono tutti i parametri
> dell'altro conto che si vuole copiare.»

## Cosa vuole, detto semplice
Nel pannello dell'**apertura automatica delle posizioni**, per il conto attivo, un modo per dire:
«prendi tutti i parametri da quell'altro conto che è nell'elenco conti».

## Il vincolo che questa cura deve rispettare (trapola già pagata)
**13 novembre 2026, misurato**: `sessionByMode` non contiene solo le impostazioni. Contiene anche i
**disegni** e il **capitale**, e il trasporto fra finestre (`if(msg.sessionByMode)sessionByMode=msg.sessionByMode`,
riga ~49449 all'epoca) **sostituiva in blocco** le sessioni: una finestra duplicata appena nata, che
di disegni non ne aveva, **cancellava quelli salvati della madre**, e la madre (slot 0) poi li
persisteva su disco. Risolto il 13 novembre (la riga ora fonde e tiene i propri disegni e il proprio
capitale, col commento che riporta la misura), ma la lezione resta: **una copia fra conti deve
dichiarare esattamente cosa copia**, e restano **fuori**:

- i **disegni** e le annotazioni del grafico (restano liberi per finestra e per conto, non si copiano);
- il **capitale** (è un dato reale del conto, non un'impostazione: copiarlo falsificherebbe il conto);
- tutto ciò che è **segreto o credenziale** (mai, in nessun caso).

Da verificare all'inizio del lavoro, con `grep`: quali campi stanno davvero dentro `sessionByMode` e
`fblContoVista`, e quali di quelli sono impostazioni e quali sono dati. Da misurare, non da supporre:
la cura deve elencare i campi, non dire «tutti».

## Cosa va misurato prima di scrivere
1. L'elenco dei campi di `sessionByMode` e di `fblContoVista`, diviso in: impostazioni / disegni /
   capitale / credenziali.
2. Se esiste già una «salva configurazione» simile (c'è, nella consegna del 15 novembre è citata una
   cura del 13 novembre su `sessionByMode`): la copia fra conti dovrebbe riusare **quella** strada
   invece di aprirne una seconda.
3. Come si presenta l'elenco dei conti da cui copiare (serve il conto di **destinazione** scelto e
   quello di **origine** scelto da un elenco).

## Il banco che dovrà esistere
- copia → i parametri scelti cambiano, e **solo** quelli;
- **prova di controllo**: dopo la copia, i disegni della finestra e il capitale **non** sono cambiati
  (è la trappola del 13 novembre);
- prova di controllo: una credenza/credenziale non compare fra i campi copiati;
- copiare da un conto che non ha nulla di salvato → non cancella quello che c'è già.

## Decisione del proprietario su cosa copia (16 novembre 2026)
> «Solo impostazioni: rischio, lotti, SL/TP, filtri.»

Quindi **fuori dalla copia**, sempre: **disegni** del grafico (per finestra, per conto), **capitale**
(dato reale, copiarlo falsificherebbe il conto), **credenziali** (mai). La cura dovrà elencare i campi
uno per uno, e il banco dovrà misurare che gli esclusi **non** cambiano.

## Stato
**In coda.** Non iniziato: `app.html` è occupato dalla cura del replay fra finestre (priorità del
proprietario) e dal ponte delle notizie. Quando il tavolo è libero, questo è il prossimo lavoro dopo
il replay.