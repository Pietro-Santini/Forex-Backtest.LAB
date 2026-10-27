# Resa totale di più sale: analisi prima di toccare il codice

**27 ottobre 2026 — studio, non implementazione.** Richiesto dal proprietario: oggi la cronologia
mostra la resa di **una sala sola**; si vuole poterne **scegliere più d'una** e vedere la somma nel
tempo, **ognuna con la sua strategia**, con una dashboard di statistiche sopra e la scelta
**conto normale / prop one step / prop two step**.

Sezione raggiungibile da due posti: il fondo della **dashboard statistiche** (accanto a win rate
per TP) e **Impostazioni → Collegamento e modalità → Sale segnali**.

---

## 1. COSA C'È GIÀ, E QUANTO SE NE RIUSA

| Pezzo | Dove | Riusabile? |
|---|---|---|
| Segnali giudicati sulle candele vere | `risultatiDi(sala, asset)` | **sì, così com'è** |
| Guadagno di un segnale in multipli di R | `rendRisultatoR(x)` | **sì** |
| Curva del capitale con interesse composto | `rendCurva(ris, cap, rischio, serie, strategia)` | **da estendere** (vedi §3) |
| Candele per rigiocare lo stop mobile | `C.serie[sala+'|'+asset]` | sì |
| Strategia della sala | `stratLeggi(sala)` → diventa a quattro slot | sì |
| Esito prop su una curva | `fblPropDedicataConta(punti, capitale, apertoMs)` | **sì**, dopo le correzioni |
| Disegno della curva | `rendDisegnaGrafico()`, `rendVista` | sì |

**Non è una sezione da scrivere da zero: è un'aggregazione sopra pezzi che funzionano già.**
Il grosso del lavoro è in due punti soli, il §2 e il §3.

---

## 2. LA DECISIONE CHE DECIDE TUTTO IL RESTO: un conto solo o tanti conti?

### Un conto solo (quello che sembra giusto)

Tutti i segnali di tutte le sale scelte finiscono su **un'unica cassa**, in ordine di tempo.
Ogni segnale rischia la sua percentuale del capitale **di quel momento**, quindi le sale
**compongono fra loro**: quello che guadagna una fa crescere il rischio in euro della successiva.

- ✅ È come funziona un conto vero, prop firm compresa: **esiste un solo saldo**.
- ✅ Quando due sale sparano insieme, il rischio **si somma** — ed è l'unico modo per cui il
  limite giornaliero prop firm significhi qualcosa.
- ⚠️ Serve decidere **cosa fare quando troppe sale sparano insieme** (vedi sotto).

### Conti separati sommati alla fine

Ogni sala ha la sua cassa, si calcolano N curve indipendenti e si sommano.

- ✅ Semplicissimo: è già tutto scritto, basta sommare.
- ❌ **Non esiste niente del genere nella realtà**, e la prop firm sopra non avrebbe senso: tre
  conti separati non possono violare insieme un limite giornaliero che è di un conto solo.

> **Il conto unico è l'unica scelta che regge insieme alla prop firm.** La riporto come domanda
> perché cambia ogni numero mostrato, non perché ci sia davvero dubbio.

### Il problema vero del conto unico: l'esposizione simultanea

Cinque sale che sparano nello stesso momento, all'1% ciascuna, fanno **5% a rischio in un colpo**
— da sole possono bruciare il limite giornaliero di un two step (5%) senza che nessuna abbia
sbagliato niente. Le strade:

1. **Nessun tetto**: si conta quello che sarebbe successo davvero. Onesto e brutale.
2. **Tetto sul rischio totale aperto** (es. 3%): oltre quello i segnali si **scartano**, e si
   scrive quanti ne sono stati scartati — se no la statistica mente per omissione.
3. **Rischio ridotto in proporzione**: le posizioni contemporanee si rimpiccioliscono per stare
   nel tetto.

La 2 e la 3 sono entrambe difendibili, la 1 è quella che dice la verità sui dati. Serve una
scelta esplicita.

---

## 3. IL VERO LAVORO DI CODICE: una strategia per ogni segnale

`rendCurva` oggi riceve **una** strategia e **una** serie di candele, e le applica a tutti i
segnali. È giusto, perché oggi i segnali sono tutti della stessa sala e dello stesso asset.

Per l'aggregazione ogni segnale deve portarsi dietro la **propria** sala e il **proprio** asset:

```
oggi:    rendCurva(ris, capitale, rischio, serie, strategia)
domani:  rendCurva(righe, capitale, rischio, dammiSerie, dammiStrategia)
         dove ogni riga e' {sala, asset, segnale} e le due funzioni
         restituiscono quello che serve PER QUELLA riga
```

**Non è una riscrittura: è passare da un valore a una funzione che lo cerca.** La versione a una
sala diventa il caso particolare in cui le due funzioni rispondono sempre uguale — così il
comportamento di oggi resta identico, ed è anche il modo di provarlo (stessa sala sola = stessi
numeri di prima, esattamente).

---

## 4. DA DOVE ARRIVANO I DATI, E IL TRANELLO

`risultatiDi(sala, asset)` legge da `localStorage['fbl_crono_ris:<sala>|<asset>']` e torna
**`null` se quella coppia non è mai stata analizzata**.

> **Il tranello:** «resa totale di tutte le sale» su dati parziali darebbe un numero che *sembra*
> completo e non lo è. Una sala molto redditizia mai analizzata su tre asset su cinque abbasserebbe
> il totale, e nessuno capirebbe perché.

Le strade:

- **Analizzare tutto al momento**: corretto, ma la prima volta può essere lungo (ogni coppia
  sala×asset va rigiocata candela per candela).
- **Usare solo quello che c'è già**: istantaneo, ma deve **dire a chiare lettere** cosa manca —
  «3 sale su 5 analizzate, 12 coppie su 40» — altrimenti è un numero che inganna.
- **Via di mezzo**: si mostra subito quello che c'è, con l'elenco di quello che manca e un pulsante
  «completa l'analisi» che lavora in sottofondo.

---

## 5. LE STATISTICHE CHIESTE, E QUANTO COSTANO

| Statistica | Costo | Nota |
|---|---|---|
| Win rate / loss rate totale | **gratis** | già conteggiati in `rendCurva` |
| Rapporto rischio/rendimento, media | **gratis** | `rendRisultatoR` dà già gli R |
| **Percentuale di TP presi, TP per TP** | basso | c'è già `x.raggiunti`: basta contarli per livello |
| Andamento del conto | **gratis** | è la curva |
| Profitto giorno per giorno | basso | raggruppare i punti per giorno (`cetDateKey` esiste già) |
| Chi ha reso di più, sala per sala | basso | stessa curva, filtrata per sala |
| **Fasce orarie** | basso | ora del segnale → fascia. Da decidere: **che fuso?** (Roma, come il resto dell'app) |
| **Rendimento vicino alle notizie** | **ALTO** | vedi §6 |

---

## 6. L'OSTACOLO: le notizie del passato

L'app ha un calendario notizie vero (ForexFactory tramite `bridge.py`), ma è **in diretta**: dice
cosa esce oggi, non cosa è uscito il 14 marzo. Per dire «questa sala rende meglio lontano dalle
notizie» servono le notizie **di ogni giorno della storia**.

E c'è un precedente scritto nel codice: *«ci ha già fatto bloccare qualche minuto da FF con un
semplice refresh ripetuto»*. Scaricare un anno di calendario, un giorno alla volta, è proprio il
genere di traffico che fa bloccare.

Le tre strade oneste:

1. **Fasce orarie fisse** come approssimazione (08:30, 10:00, 14:30, 16:00 CET — le stesse che il
   blocco notizie prop firm usa già). Si fa subito, non serve niente, ma **non è il calendario
   vero**: va scritto che è un'approssimazione.
2. **Da oggi in avanti**: si comincia a salvare il calendario ogni giorno, e fra qualche mese la
   statistica è vera. Giusta ma inutile adesso.
3. **Scarico storico una volta sola**, piano, con pause lunghe, salvando tutto sul server Oracle.
   La più completa e la più lenta da costruire.

**La 1 subito e la 2 in parallelo** sembra la combinazione sensata: si vede qualcosa oggi e
diventa vera col tempo, senza rischiare il blocco.

---

## 7. LA PROP FIRM SOPRA L'AGGREGATO

Una volta che esiste la curva unica, l'innesto è quasi gratuito: `fblPropDedicataConta()` lavora
già su una curva di punti.

**Two step, come si simula sulla storia:**
1. Si percorre la curva dal giorno di apertura con le regole della Sfida 1 (obiettivo 10%).
2. Il giorno in cui l'obiettivo è raggiunto, la Sfida 1 è **passata**: si segna la data.
3. Da quel giorno la Sfida 2 **riparte dal capitale iniziale** (è così che fa FTMO: la verifica
   non eredita il profitto), con obiettivo 5% e gli stessi limiti.
4. Se anche la seconda passa, da lì in poi è **conto finanziato**: si mostra il profitto e
   **l'80% che spetterebbe**.
5. Se una delle due viola, ci si ferma lì e si dice quale, quando e con che numeri.

**One step:** una fase sola, obiettivo 10%, perdita giorno 3%, massimo **trailing**, quota 90%.

> Dipende dalle correzioni in [PROGETTO-PROP-FIRM.md](PROGETTO-PROP-FIRM.md) §2: finché il limite
> giornaliero è calcolato sulla base sbagliata, ogni simulazione qui sopra sarebbe sbagliata con
> lei.

---

## 8. PRESTAZIONI — il vincolo del proprietario

Dichiarato più volte: **l'app non deve rallentare**. Qui il rischio è concreto, perché si passa da
una sala e un asset a tutte le sale e tutti gli asset.

Le regole da rispettare:

- **Il calcolo non va rifatto mentre si scorre.** È il motivo per cui oggi esiste `rendVista`, che
  si porta dietro i conti di ogni punto: il dito che scorre deve solo **leggere**.
- **Il risultato si tiene in memoria** con la chiave «sale scelte + strategie + capitale +
  rischio»: cambiare una casella ricalcola, scorrere no.
- **Se il calcolo è lungo, va spezzato** e deve mostrare una percentuale vera — c'è già il
  precedente della percentuale di caricamento che restava a zero.
- **Si misura prima e dopo** con lo strumento delle prestazioni già nelle impostazioni.

---

## 9. ORDINE DI LAVORO PROPOSTO

1. `rendCurva` che accetta segnali di sale diverse (§3), **con la prova che a una sala sola dà
   numeri identici a oggi**.
2. Scelta delle sale + curva unica + le statistiche gratuite (win rate, R:R, TP per TP, giorno per
   giorno).
3. Il conteggio di quello che manca all'analisi (§4), onesto e visibile.
4. L'innesto prop firm (§7) — **dopo** le correzioni dell'altro documento.
5. Fasce orarie, e le notizie come approssimazione dichiarata (§6).
6. Le notizie vere, se e quando varrà la pena.

---

## 10. DECISIONI DEL PROPRIETARIO (27 ottobre 2026)

### Esposizione simultanea: NESSUN TETTO

Si simula quello che sarebbe successo davvero. Se cinque sale sparano insieme, il conto prende il
5% di rischio e se salta, salta.

> È la scelta che **dice la verità sui dati**, ed è anche quella che risponde alla domanda vera:
> *queste sale, messe insieme, sono compatibili con una prop firm?* Un tetto avrebbe nascosto
> proprio l'incompatibilità che si vuole scoprire.
>
> Conseguenza da scrivere bene nell'interfaccia: una violazione prop può arrivare **senza che
> nessuna singola sala abbia sbagliato niente**. Va detto esplicitamente quando succede, con
> quante posizioni erano aperte insieme in quel momento — altrimenti sembra un errore del
> calcolo.

### Dati mancanti: SI ANALIZZA TUTTO — e la percentuale è un requisito, non un dettaglio

Niente totali parziali: si rigioca tutto quello che manca, e solo alla fine si mostra il totale.

**Richiesto testualmente:** *«fai vedere la percentuale su quanto tempo rimane al completamento di
tutta l'analisi, la percentuale deve essere incrementale e non deve fermarsi mi raccomando!»*

Vincoli che ne derivano, da rispettare alla lettera:

1. **La percentuale deve salire sempre.** Mai tornare indietro, mai restare ferma su un numero
   mentre il lavoro va avanti. C'è un precedente già pagato in questo progetto: la percentuale di
   caricamento del grafico che **restava a 0%** perché il totale non era noto in partenza.
2. **Il totale si conta PRIMA di cominciare.** Le coppie sala×asset da analizzare vanno contate
   tutte all'inizio: senza denominatore non esiste una percentuale onesta. È esattamente la causa
   dell'inciampo precedente.
3. **Serve il tempo rimanente**, stimato sulle coppie già fatte (quanto è costata in media una
   coppia × quante ne restano), non su un numero inventato.
4. **Il lavoro va spezzato** in modo che la pagina non si blocchi: se l'interfaccia si congela, la
   percentuale non si ridisegna e sembra ferma anche quando non lo è — che è il difetto da
   evitare, visto dall'altra parte.
5. **Se una coppia fallisce si va avanti**, contandola come fatta e segnalandola alla fine. Un
   errore su un asset non deve bloccare l'analisi delle altre trentanove.

### Notizie: approssimazione adesso, dato vero da oggi in avanti

Subito le fasce fisse già usate dal blocco prop firm (08:30, 10:00, 14:30, 16:00 CET),
**dichiarate come approssimazione** nell'interfaccia e non spacciate per il calendario vero. In
parallelo si comincia a **salvare il calendario ogni giorno**, così fra qualche mese la statistica
diventa reale senza aver mai rischiato il blocco da ForexFactory.

> Dove salvarlo: sul **server Oracle** insieme agli altri dati, così vale per tutti i dispositivi
> e finisce nel backup notturno. Sono poche decine di righe al giorno.
