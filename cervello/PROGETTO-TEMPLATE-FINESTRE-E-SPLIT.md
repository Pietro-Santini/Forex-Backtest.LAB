# Progetto — template delle finestre duplicate e degli split

Richiesta del proprietario, **17 novembre 2026**. Da costruire **in dettaglio più avanti**: questo
documento serve a non perdere la richiesta e a fissare il vincolo che decide il disegno.

> «Dobbiamo salvare quelli che sono dei preset della pagina duplicata […] l'utente può salvarsi
> quello che è il template salvato su una specifica pagina duplicata, così che alla riapertura,
> quando non ci sono pagine duplicate, quando si va a premere quello che è il pulsante duplica
> pagina, gli uscirà fuori un elenco dei template che lui ha salvato, con dentro tutte le
> impostazioni che ci sono all'interno di style, tutte le impostazioni che ci sono, per esempio,
> degli indicatori aggiunti, quindi gli fa l'elenco degli indicatori aggiunti, con il modello
> salvato di quel specifico indicatore, così almeno che lui lo carica e viene già caricato tutto
> quanto invece di andarlo a scrivere manualmente. Questo lo si fa anche per le pagine split […]
> facciamo 2 elenchi separati, uno il template intero per la pagina duplicata, che riguarda anche
> all'interno il numero di split che l'utente vuole aggiungere, quindi la suddivisione 1x1, 1x2,
> 2x2. Poi dopo un elenco aggiuntivo per ogni split avvenuto, quindi su ogni mini riquadro possiamo
> scegliere l'elenco degli indicatori che noi vogliamo. Devono esserci tutti i preset, tutti dei
> modelli salvati.»

E il vincolo, dato nella stessa richiesta:

> «mi raccomando poi da tenere d'occhio ovviamente a quello che è la memoria del programma, perché
> bisogna farlo in modo che non stressi troppo la macchina e che non appesantisca troppo. Quindi
> dobbiamo farlo a regola d'arte e non troppo pesante. […] Deve essere un programma molto fluido.»

## Cosa vuole, detto semplice

**Due elenchi di template, separati.**

1. **Template di finestra** — si applica premendo «duplica pagina» quando non ci sono duplicate
   aperte. Dentro: le impostazioni di stile della pagina, la **suddivisione** dei riquadri
   (`1x1`, `1x2`, `2x2`, e le altre che si decideranno), e per ogni riquadro quali indicatori
   mettere con **quale modello salvato** di quell'indicatore.
2. **Template di riquadro** — un elenco a sé, da applicare a un singolo mini-riquadro dopo che lo
   split è avvenuto: l'elenco degli indicatori di quel riquadro, ognuno col suo preset.

Il secondo elenco è riusabile dentro il primo: un template di finestra è una suddivisione più N
riferimenti a template di riquadro. Conviene costruirlo così invece di duplicare i dati, altrimenti
cambiare un preset vorrebbe dire ricordarsi di cambiarlo in dieci posti.

## Dipendenza da dichiarare subito

Questo lavoro **viene dopo la divisione del grafico** (`A1` nella consegna del 15 novembre, voce
3.6 della scaletta del 17): non si possono salvare i template di una suddivisione che non esiste
ancora. Se la divisione del grafico cambia forma, cambiano anche i template.

## LA REGOLA DI DISEGNO SULLA LEGGEREZZA, e non è negoziabile

**Un template è SOLO impostazioni. Mai dati.** Un template contiene nomi, numeri e parametri: la
suddivisione, l'elenco degli indicatori, i loro parametri, lo stile. Un template non contiene — e
non deve mai contenere — **candele**, **posizioni**, **ordini**, il **capitale**, i **disegni** o
qualunque **credenziale**. Così un template pesa qualche kilobyte e salvarlo o caricarlo non costa
niente.

**La pesantezza non viene dai template: viene da cosa succede quando se ne carica uno.** Un
template che accende 6 indicatori su 4 riquadri sono 24 indicatori che si calcolano. Qui il
progetto ha già due misure, e vanno rilette prima di scrivere una riga:

- **v2.2.41** — gli indicatori rifacevano **50.029 candele a ogni prezzo**: da **262 ms a 0,6 ms**.
  La cura esiste; un template che aggira quella strada la riporterebbe indietro moltiplicata per il
  numero di riquadri.
- **v2.2.31** — il profilo volumetrico ripagava tutto lo storico a ogni fotogramma.
- **v2.1.5** — le zone zero-print allocavano 200.000 array a fotogramma.

Da cui tre regole operative:

1. **Una serie di candele per asset, non una per riquadro.** Due riquadri sullo stesso asset e
   timeframe condividono la stessa serie. Se il disegno porta a N copie di `baseRows`, il disegno è
   sbagliato: a 50.000 candele una copia sono ~6 MB.
2. **Caricare un template è un'operazione sola**, non N operazioni che ridisegnano ognuna. Si
   applica tutto e si disegna una volta.
3. **Un riquadro che non si vede non calcola.** Se una suddivisione lascia un riquadro coperto o
   fuori vista, i suoi indicatori non devono girare.

## Cosa misurare PRIMA di scrivere

1. **La memoria, con lo strumento che ancora non c'è** (voce 4.1 della scaletta): la crescita va
   misurata *prima* di aggiungere una funzione che moltiplica i riquadri, altrimenti non si saprà
   più se la colpa è di questa o di quello che c'era già. **Questo è il motivo per cui 4.1 va
   prima di questo lavoro.**
2. Quanto costa **un** indicatore in memoria e in millisecondi, per poter dire quanto costano 24.
3. Se gli indicatori di un riquadro possono vivere senza una copia propria della serie: è la
   domanda che decide se questa funzione è leggera o pesante.

## Il banco che dovrà esistere

- salvare un template e riaprirlo → la suddivisione e gli indicatori tornano identici;
- un template **non contiene** candele, posizioni, capitale, disegni o credenziali (prova di
  controllo sui campi, come per la copia fra conti);
- caricare un template con 4 riquadri × 6 indicatori → **una sola** serie di candele per
  asset+timeframe in memoria, non quattro (si conta, non si suppone);
- caricare un template non fa più di **un** giro di disegno;
- prova di controllo: nessun template salvato → il pulsante «duplica pagina» si comporta
  esattamente come oggi.

## Stato

**In coda, da dettagliare.** Dipende da `A1` (divisione del grafico) e dalla voce 4.1 (lo strumento
che misura la memoria). Nessun codice, nessun banco.
