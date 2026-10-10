# Il cervello di Forex Backtest LAB

Qui sta tutto quello che il progetto "sa" di se stesso. Gli agenti AI non hanno memoria tra una
sessione e l'altra: **ricordano solo quello che è scritto qui**. Se una cosa non è scritta qui, al
prossimo giro è dimenticata.

| File | Cosa contiene | Chi lo aggiorna |
|---|---|---|
| `METODO.md` | Le domande da farsi prima di agire, il piano, la verifica | si affina con le lezioni |
| `PROPRIETARIO.md` | Come lavora e ragiona il proprietario, come parlargli, cerchi aperti | chi lo conosce meglio |
| `REGOLE.md` | Regole che nessun agente può superare (soldi veri, chiavi, pubblicazione) | solo il proprietario |
| `MAPPA.md` | Com'è fatto il progetto: pezzi, porte, file, dati, dove si trova cosa | chiunque scopra qualcosa di nuovo |
| `BUG.md` | Bug aperti e risolti, con causa vera e test che li controlla | chi trova o corregge un bug |
| `LEZIONI.md` | Errori di ragionamento già fatti e come non rifarli | chi sbaglia (e se ne accorge) |
| `IDEE.md` | Idee per estetica, semplicità, leggerezza, guide per neofiti | chiunque, con priorità |
| `DIARIO.md` | Cosa ha fatto ogni giro di agenti, con l'esito del collaudo | il regista, a fine giro |
| `PUBBLICARE.md` | **Come si pubblica un aggiornamento** (sito, computer, server) e come funziona il collaudo: la procedura passo passo, anche da fare a mano | chi cambia il modo di pubblicare |
| `CONSEGNA.md` | **Da leggere per primo se riprendi il lavoro senza aver visto le sessioni precedenti**: com'e' fatto il sistema, cosa e' stato fatto, cosa manca | chi consegna il lavoro |

## Protocollo (vale per ogni agente)
1. **Prima di lavorare:** leggi `METODO.md`, `PROPRIETARIO.md`, `REGOLE.md`, poi `MAPPA.md` e le voci di `BUG.md`/`LEZIONI.md` che
   riguardano la parte che toccherai.
2. **Mentre lavori:** un bug si dichiara corretto solo con un **test** in `laboratorio/` che prima
   falliva e ora passa. Senza test è un'opinione.
3. **Dopo:** aggiorna i file qui sopra. Una lezione si scrive come regola pratica ("le date delle
   candele finte vanno in ISO con Z, altrimenti…"), non come racconto.
4. **Mai cancellare** voci di `BUG.md` o `LEZIONI.md`: si chiudono, con data e commit.
