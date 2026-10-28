# Non interrompere mai MT5 — e la verità sull'autonomia a programma chiuso

Chiesto dal proprietario il 28 ottobre 2026, con parole da tenere:

> «Il programma non può avere intoppi, non può interrompere quelle che sono le operazioni, le
> chiusure, gli spostamenti, le aperture dell'operazione automatico: non può interrompere nulla.
> È importantissimo questo. Già ci eravamo passati su questo punto e ancora si ripresenta.»

---

## 1. La parte che è stata corretta

### Il difetto

Il ponte si spegneva da solo quando la pagina se ne andava. C'era già la **grazia** (90 secondi
di attesa, dal 2.0.14): serve per la **ricarica**, perché chi ricarica torna in due secondi e
annulla il conto alla rovescia.

Ma non copriva il caso vero del proprietario: **tenere il ponte acceso per gli ordini e il
browser chiuso.** Lì nessuno torna, e allo scadere dei 90 secondi il ponte spegneva MT5, chiudeva
il terminale e si uccideva.

Da fuori si vede esattamente quello che ha descritto: **i segnali continuano ad arrivare** (li
porta un processo diverso, che non muore) **e gli ordini non partono più** (il ponte non c'è
più). E «i pacchetti non esistono» al ricollegamento è la stessa cosa vista dall'altra parte: il
processo è morto, quindi l'app ripropone l'installazione.

### La regola nuova, e ha la precedenza sulla grazia

**Collegati a MT5, un evento di «pagina andata via» non programma niente.** Non una grazia più
lunga: **nessuno spegnimento.** Un ponte attaccato a un conto non è un processo dimenticato — è
il processo che sta lavorando, e dall'altra parte ci sono posizioni aperte con il loro stop e il
loro target.

Il motivo per cui lo spegnimento automatico era stato chiesto («non lasciare processi accesi a
sua insaputa») **resta soddisfatto**: senza MT5 collegato il conto alla rovescia c'è ancora, e lì
non c'è niente da perdere. E la via d'uscita resta **dichiarata**: «Esci» e «Disconnetti» non
chiedono la grazia e spengono tutto subito, anche con MT5 collegato.

Collaudi: `laboratorio/ponte/test_mt5_non_si_stacca.py` — il cuore era **rosso** prima, e due
prove di controllo tengono ferme le due cose che non devono rompersi (la grazia senza MT5, e il
pulsante esplicito con MT5).

> **Serve un Setup nuovo.** La correzione è in `bridge.py`, cioè dentro
> `ForexBacktestLAB.exe`: non arriva con l'aggiornamento della pagina.

---

## 2. La parte che NON è vera, e va detta

> «Non importa se il programma nostro Backtest Lab è aperto o meno, perché tanto gira sul
> server, giusto?»

**No.** Oggi le operazioni **non** funzionano a programma chiuso, e non è una questione di
difetti da sistemare: è come è costruito.

**Misurato il 28 ottobre 2026**, cercando chi chiama gli endpoint degli ordini:

| Endpoint del ponte | Chi lo chiama |
|---|---|
| `/order/market` | **solo** `app.html` (una riga) |
| `/order/close` | **solo** `app.html` |
| `/order/modify` | **solo** `app.html` |

Il ponte dei segnali **non apre nessun ordine**: non contiene nemmeno un riferimento alla porta
8000. Il server Oracle **legge e consegna i segnali**, e si ferma lì.

Quindi la catena vera è:

```
Telegram/Syntra → server (legge) → PAGINA APERTA (decide) → ponte sul PC → MT5
                                   ^^^^^^^^^^^^^^^^^^^^^^
                                   se qui non c'è nessuno,
                                   non parte nessun ordine
```

**Chi decide è la pagina.** Apertura, chiusura, spostamento di stop e target, gestione
automatica: tutto vive in `app.html`. Con la pagina chiusa il ponte resta vivo e sano — e non
riceve nessun ordine da eseguire, perché nessuno glielo manda.

La correzione del punto 1 è comunque necessaria e non sprecata: **senza di essa l'autonomia non
sarebbe nemmeno possibile**, perché il pezzo sul PC moriva 90 secondi dopo la chiusura della
pagina. Ma da sola non basta.

### Cosa servirebbe per l'autonomia vera

Spostare **la decisione** fuori dalla pagina. Due strade, e la seconda è quella giusta:

1. **Una pagina sempre aperta** sul PC (finestra nascosta che si riapre da sola). Si fa in un
   giorno. È un cerotto: dipende da un browser vivo, e un browser si chiude.
2. **La decisione nel ponte**: la regola «questo segnale → questo ordine, con questo rischio,
   con questi stop» va portata in `bridge.py`, che è un servizio e non muore. La pagina diventa
   quello che dovrebbe essere — **il cruscotto**: guarda, configura, interviene a mano.

La 2 è un progetto, non una correzione: va riscritta in Python la parte di `app.html` che
calcola rischio, volume, stop e target da un segnale, e va provata **contro** quella della
pagina, segnale per segnale, finché non dà numeri identici. Quel confronto non è un
dettaglio — è l'unico modo onesto di dimostrare che il ponte decide **come** decide la pagina
oggi, su soldi veri.

---

## 3. Quello che NON era la causa (misurato, per non rifare la strada)

Il sospetto ovvio era il banco di prova: i collaudi aprono `app.html` centinaia di volte, e
`app.html` su `pagehide` manda un beacon a `/disconnect`. Il 21 ottobre erano state tappate due
strade (le richieste HTTP con `pagina.route`, i WebSocket con una classe finta), e sembrava che
la terza — `navigator.sendBeacon()` — fosse rimasta aperta.

**Misurato, su un server finto, con quattro combinazioni:**

| | pagina sintetica | app.html vera |
|---|---|---|
| filtro + `browser.close()` | non esce | non esce |
| filtro + `pagina.close()` | **esce** | non esce |

Su una pagina sintetica il beacon sfugge a `pagina.route`; **sull'app vera non si riproduce**. E
**nessun collaudo** usa `pagina.close()` (zero file su tutta la cartella): quelli che fanno una
seconda `pagina.goto` sono undici, e per quella strada il beacon **non** esce.

Quindi la frase nel docstring di `test_spegnimento_grazia.py` — «il banco non apre più socket né
richieste verso il ponte vivo» — **oggi regge**, pur essendo stata scritta con più sicurezza di
quanta ne fosse stata misurata.

Un collaudo è stato scritto per difendere questo punto e poi **cancellato**: la sua prova di
controllo non riusciva a diventare rossa, e un collaudo che non può fallire non difende niente.
