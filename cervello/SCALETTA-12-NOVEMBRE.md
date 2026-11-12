# SCALETTA DEL LAVORO — aperta l'11 novembre 2026 (sera), aggiornata il 12

Tutte le voci segnalate dal proprietario e non ancora curate, in ordine di gravità. Ogni voce dice
**che cosa si sa già misurato** e **che cosa manca**, così nessuno riparte da zero.
Si lavora **con i subagenti** (regola del proprietario, vedi `cervello/REGOLE.md`): un fronte per
agente, misura prima della cura, e un parere su come si potrebbe fare meglio.

Versione pubblicata mentre si scrive: **2.2.31**. Sul PC del proprietario gira ancora la **2.2.12**
(vedi voce 5: è il motivo per cui molte cure non le ha mai viste in funzione).

---

## P0 — BLOCCANTI

### 1. IL PONTE RISPONDE IN MINUTI, E LE CHIUSURE NON RIESCONO
Misura del proprietario, 11 novembre 23:36, MT5 collegato:

    lettura conto     :   239 volte, media 106.755 ms, peggiore 24.711.871 ms, 14 non riuscite
    ordine (altro)    : 2.163 volte, media  13.946 ms, peggiore 24.708.434 ms, 46 non riuscite
    lettura posizioni : 2.154 volte, media  13.978 ms, peggiore 24.708.353 ms, 49 non riuscite
    chiusura          :     8 volte, media   5.043 ms, peggiore      8.306 ms, 8 NON RIUSCITE

**Centosei secondi di media** per leggere il conto, picchi di quasi 7 ore, e **otto chiusure di
posizione su otto fallite**. Alle 15:57 la stessa misura dava 2-4 secondi di media: in otto ore è
peggiorato di trenta volte, quindi degrada col tempo di sessione. Le chiusure che non riescono
sono la cosa più grave di tutta la lista: significa non poter uscire da una posizione.
**Da misurare**: se le richieste si mettono in fila (lock globale, `async def` con dentro una
chiamata bloccante a MT5, worker singolo di uvicorn), e se l'app chiede troppo (2.154 letture di
posizioni con zero posizioni aperte). Indagine avviata e interrotta a metà: va ripresa.

### 2. MERCATO APERTO O CHIUSO: LO DEVONO DIRE I DATI, PER OGNI ASSET
Parole sue: «sono le ore 22 dell'11 novembre e non arriva più nessun dato, e non c'è scritto
nessuna etichetta del mercato chiuso, perché da MT5 sul terminale ancora il mercato è aperto. Non
devi prenderla alla lettera che alle 22 chiude il mercato, ogni asset ha il suo orario».
E il caso opposto, con foto: **DXY alle 23:32 è aperto su MT5 e l'app dice «Mercato chiuso, apre
tra 00:28:16»**, e intanto smette di aggiornare le candele.
Sono due facce dello stesso errore: la decisione è presa da un orario scritto a mano invece che
dai dati. La v2.2.18 aveva cominciato a usare il passaggio dati MT5 (`mt5UltimoTickPerAsset`,
`fblMercatoFermoOra`), ma evidentemente non decide da sola.
**La proposta del proprietario**: isolare apertura e chiusura **per asset**, e capirlo dall'arrivo
dei dati dal terminale. Se per una certa fascia di tempo non arrivano più dati, è chiuso.

### 3. LE CANDELE SI ROMPONO QUANDO IL MERCATO CHIUDE
Con foto. A mercato chiuso, andando indietro nello storico o ricaricando un asset, **tutte** le
candele cambiano aspetto: non è più il disegno normale. Succede «al momento della chiusura, quando
non ricevi i dati da MT5». È grave perché rende inutilizzabile il backtest in replay.
**Da misurare**: che cosa cambia nel disegno (larghezza, corpo, soglia del «grafico a blocchi»
toccata in v2.2.17), e quale stato dell'app lo fa scattare.

### 4. PROFITTO FALSO ALL'APERTURA, E LA PROP FIRM SI «SBLOCCA» DA SOLA
Con foto: due posizioni SELL su XAUUSD da 0,10 lotti mostrano **+40.303,80 €** e **+363,02%**, che
non è vero. Succede «al momento che apro e imposto i livelli TP e stop loss, la maggior parte
delle volte in SELL». E in quel frangente **l'applicazione dice che ha sbloccato la Prop Firm**.
Nella stessa misura: `checkPropFirmRules = 67 ms` è la voce più cara del disegno.
Un numero sbagliato che fa scattare una regola della Prop Firm non è accettabile: la decisione
deve dipendere da un valore validato, non da uno stato di mezzo mentre la posizione si apre.

### 5. OGNI DISPOSITIVO DEVE CONTROLLARE LA PROPRIA VERSIONE
Il pannello sul suo dispositivo dice **2.2.12** mentre l'ultima è la 2.2.31, e il pulsante
«Aggiorna» non compare. Causa già trovata: il confronto è fra la versione del **programma sul PC**
e quella della **pagina servita**, due file che sul PC sono allineati. Nessuno chiede alla pagina
viva, su quel dispositivo, quale versione stia davvero eseguendo.
Parole sue: «i dispositivi mobili devono fare una verifica ulteriore che effettivamente loro siano
una versione vecchia, e non devono prendere la versione presente nel PC. Se sul tablet ho una
versione vecchia e sul telefono una nuova, me lo mostra soltanto sul tablet».

### 6. FINESTRE DUPLICATE: SPOSTARE UNA POSIZIONE NON FUNZIONA E ROMPE ANCHE LA MADRE
«Se sono con la pagina duplicata e vado a spostare delle posizioni, non me le fa spostare, anzi mi
si comincia a comportare in maniera strana il grafico, e anche sulla pagina madre.»
Un difetto che dalla finestra figlia danneggia la madre è il più pericoloso del gruppo.

### 7. I DISEGNI SPARISCONO
Già misurato (tre strade rotte su dodici esaminate):
- riapertura **senza account collegato**: zero disegni a schermo mentre il deposito ne ha due, e
  il primo disegno nuovo **cancella definitivamente** i vecchi;
- una voce del cloud più vecchia e più povera **vince** su quella buona (misurato 5 → 1);
- il tetto di peso è controllato sul pacchetto e non sul documento, quindi si supera il limite del
  cloud e la scrittura viene **rifiutata in silenzio**.
Manca solo la cura, l'indagine è chiusa.

---

## P1 — IMPORTANTI

### 8. FINESTRE DUPLICATE: LE POSIZIONI DEVONO SINCRONIZZARSI NEI DUE VERSI
«Se aggiorno la posizione sulla pagina madre, mi si deve aggiornare anche sulle finestre
duplicate. E stessa cosa al contrario.» Aprire posizioni da una qualsiasi delle finestre deve
avvenire «con tutta naturalità».

### 9. FINESTRE DUPLICATE: ELENCO ASSET INCOMPLETO DALLA SECONDA IN POI
Già misurato l'8 novembre: madre 35 asset, duplicata 5, watchlist vuota. Novità dell'11: **la
prima duplicata adesso è a posto, la seconda no** — l'eredità funziona per chi nasce dalla madre e
non per chi nasce quando una figlia esiste già.

### 10. FINESTRE DUPLICATE: IL CONTO È QUELLO VECCHIO, E ARRIVA IN RITARDO
«Ho aperto una terza pagina duplicata e ancora mi dà il conto selezionato in precedenza, non
quello corrente.» Più il ritardo: «ci aveva salvato che era collegato con un account, poi dopo un
po' di tempo si è collegato a quello della pagina principale».

### 11. FINESTRE DUPLICATE: IL GRAFICO RESTA PIANTATO SUL CARICAMENTO
«Scarico lo storico in corso, carico l'asset, e rimane sempre lì piantato. Non carica.»

### 12. REPLAY: IL TP E LO STOP DEVONO CHIUDERE AL TOCCO, NON A FINE CANDELA
«Se raggiungo la linea del TP o dello stop loss, non mi si chiude la posizione finché non chiude
la candela. Invece deve chiuderla all'istante in cui tocca la linea, come succede nel mondo reale.»
Su timeframe da 5 o 15 minuti la differenza è enorme e falsa tutti i backtest.

### 13. REPLAY: LA LINEA DEL PREZZO NON DEVE SPARIRE
«Se avanzo con le freccette o cambio timeframe, la linea orizzontale del prezzo col cartellino non
mi deve sparire: altrimenti perdo il riferimento di dove si trova la candela e il prezzo.»

### 14. ASSE DEL TEMPO: ANCHE GLI ORARI CHE VENGONO DOPO
«Vediamo soltanto l'ultima ora e minuto dell'ultima candela. Dobbiamo avere anche l'orario
successivo, quello che viene dopo, rapportato al timeframe: le ore spalmate lungo l'asse.»

### 15. SELEZIONARE UNA POSIZIONE RICHIEDE TRE TOCCHI
Causa già trovata: due condizioni che si sommano. Il tocco deve cadere dentro la casella Target o
Stop in orizzontale, e il primo clic buono **marca soltanto**. Il proprietario ha confermato di
voler tenere la marcatura: resta da allargare la zona utile.

### 16. DUE INDICATORI COSTANO 79 ms A FOTOGRAMMA
`ind:bsl_ssl_fvg:calcolo` 49,20 ms e `ind:order_blocks:calcolo` 29,86 ms, a **ogni** fotogramma.
Il loro calcolo è incrementale per costruzione, quindi qualcosa gli fa buttare la cache ogni
volta. Primo sospetto da verificare: l'array delle candele viene **ricreato** a ogni tick
(`rebuildRows` fa `fullAgg.slice()` quando l'ultima candela è parziale), e il confronto
`st.ref !== rows` è per riferimento, quindi scatta sempre.

---

## P2 — DA TENERE D'OCCHIO

### 17. LA BOLLETTA DEL CLOUD
2,30 € in undici giorni, in calo del 65%. Ma l'app conta 81 scritture al giorno e la console ne
conta 15.000: **un fattore 185 da spiegare** prima di toccare qualsiasi cosa. Le Cloud Functions
sono l'82% della spesa e nessuna parte da sola: qualcuno le chiama.

### 18. LA MEMORIA DEL PC
15,9 GB totali, 4,6 liberi, compressione di Windows già attiva. Gli strumenti di sviluppo
occupano da soli circa 6,5 GB. Non è un difetto dell'app, ma è la ragione per cui il computer si
inchioda e per cui due banchi sono caduti oggi senza colpa del codice. Passare a 32 GB toglie il
problema alla radice.

---

## GIÀ CHIUSO (non ricominciare)
- **v2.2.29**: capitale e margine libero si aggiornano come il P/L; in Prop Firm l'avviso non tace.
- **v2.2.30**: la riapertura non inchioda più (pulizia che uccideva i propri figli, 40 secondi di
  attesa contro i 30 della finestra, avviatore ucciso); pulizia automatica dei 17,8 GB di cartelle
  temporanee; tetto al log del servizio dati; collaudo di GitHub che non muore più se il server
  dei pacchetti non risponde.
- **v2.2.31**: il profilo volumetrico non ricalcola più tutto lo storico a ogni fotogramma
  (139 ms → misurato sul banco 28,9 ms → 0,68 ms).
