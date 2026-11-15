# Progetto — tabella delle notizie in tempo reale dentro l'applicazione

Chiesto dal proprietario il **15 novembre 2026**. È un **progetto a sé**, non una modifica: va
costruito, non aggiunto.

## Parole sue

> «Voglio implementare con delle fonti quella che è una tabella delle notizie in tempo reale
> direttamente dentro l'applicazione, così che quando arriva una nuova notizia, magari che non è
> presente sul calendario, esce direttamente sull'applicazione. Ma sarà un progetto a parte, che
> bisogna poi costruirla, implementare la trasparenza, magari si può anche muovere, si può mettere
> dentro al grafico, cioè c'è proprio un progetto dietro da fare.»

## Cos'è, in una riga

Un pannello dentro l'app che mostra le notizie **appena uscite** — comprese quelle che **non sono
sul calendario** — spostabile, trasparente, da poter appoggiare sopra il grafico.

## Perché non è un'estensione di quello che c'è

Quello che l'app ha oggi è un **calendario**, non un flusso di notizie. Due cose diverse:

- il calendario sa in anticipo *che alle 14:30 esce il CPI americano*: eventi programmati, con
  orario, valuta, gravità, forecast e previous;
- una notizia **non programmata** — una dichiarazione di un banchiere centrale, un dato rivisto, un
  evento geopolitico — non sta in nessun calendario, per definizione. Non arriverà mai dalla fonte
  che l'app usa adesso.

**MISURATO e scritto nel ponte** (vedi il commento sopra `_NEWS_FEED_URL` in `bridge.py`): la fonte
attuale, `ff_calendar_thisweek.json` di faireconomy.media, è un calendario settimanale e **non
riporta nemmeno il valore uscito** (`actual`) per gli eventi già passati — verificato con una
risposta reale su un FOMC Statement delle 14:00 controllato dopo le 16. Quindi questo progetto ha
bisogno di **una fonte di natura diversa**, non di un aggiornamento più frequente.

## Cosa c'è già, e su cui si appoggia

- **Archivio delle notizie** (`notizieArchivio`, chiave `fbl_notizie_archivio`): dal 15 novembre
  conserva anche forecast, previous e actual, viaggia nell'account e sul disco E, e una notizia già
  archiviata può **imparare** i campi che prima mancavano. Misurato: 333 KB per 3000 notizie.
- **Pallini sul grafico** con popup di dettaglio, glossario curato e «effetto usuale».
- **Aggiornamento adattivo** nel ponte: ogni ora di norma, ogni 2 minuti quando un evento cade
  entro 20 minuti. La parte della frequenza è già fatta.
- **Fonti ufficiali per l'actual** (deciso il 15 novembre, da fare): BLS per CPI e Non-Farm
  Payrolls, Federal Reserve per i tassi, Eurostat per l'inflazione europea. Coprono i dati
  programmati, **non** le notizie non programmate.

## LE FONTI, VERIFICATE DAL VIVO IL 15 NOVEMBRE 2026

Chiesto dal proprietario: «troviamo qualche fonte che ovviamente è gratuita e non dà problemi di
legalità e che si può fare tranquillamente quello che è un copia e incolla veramente delle notizie
in tempo reale».

**Provate con una richiesta vera, non elencate a memoria:**

| fonte | esito | cosa contiene |
|---|---|---|
| `federalreserve.gov/feeds/press_all.xml` | **200**, 14,6 KB | titolo, link, categoria, orario |
| `ecb.europa.eu/rss/press.html` | **200**, 5,9 KB | titolo, link, orario |
| `api.bls.gov/publicAPI/v2/...` | **200** | serie di dati (CPI e altri) |
| Eurostat `api/dissemination/statistics/1.0` | **200**, 245 KB | serie di dati |

**Indirizzi che NON funzionano** (404, erano miei tentativi e non fonti verificate — non vanno
messi in lista come buoni): Bank of England `boeapps/rss/feeds.aspx`, BIS `list/press_rlsea`,
EIA `petroleum/supply/weekly/rss.xml`. Se serviranno, i loro feed veri vanno cercati e provati.

### LA DISTINZIONE CHE DECIDE TUTTO: titolo o testo

**Nessuno di questi feed contiene il testo della notizia**: portano titolo, orario e link. Quindi
il «copia e incolla» si divide in due casi, con risposte diverse:

1. **Titolo + orario + fonte + link** — gratuito e lecito da chiunque, agenzie comprese: è
   esattamente a questo che serve un RSS, ed è quello che fanno tutti gli aggregatori. Per una
   tabella di notizie appena uscite **questo basta**.
2. **Il testo integrale** — lecito solo dalle fonti dove il diritto d'autore lo permette, e va
   preso dalla pagina collegata, non dal feed:
   - **enti federali americani** (Federal Reserve, BLS, BEA, Census): per legge le loro opere sono
     di **pubblico dominio**, quindi il testo si può riprodurre per intero, anche a pagamento;
   - **istituzioni europee** (ECB, Eurostat): riuso permesso **citando la fonte** (il feed ECB
     dichiara `Copyright 2026, European Central Bank`, e la loro politica di riuso lo consente con
     attribuzione);
   - **agenzie e testate** (Reuters, Bloomberg, giornali): il testo **non** si può copiare, né
     gratis né pagando il solo accesso. Di loro si mostrano titolo, orario e link, e si rimanda al
     sito. Chi fa diversamente viola il diritto d'autore, e non è una zona grigia.

**Conclusione pratica:** la tabella si può fare **gratis e in pulito** così — titolo, orario,
valuta coinvolta e link per tutti; testo integrale per i comunicati di Fed, BLS, BEA, ECB ed
Eurostat, che sono proprio quelli che muovono il prezzo. Nessun abbonamento, nessuno scraping,
nessun rischio legale.

**Cosa copre davvero questa strada:** i comunicati NON programmati di banche centrali e istituti —
dichiarazioni, discorsi, decisioni fuori calendario, revisioni. Che è esattamente il caso che il
proprietario ha descritto («una notizia che non è presente sul calendario»). NON copre le notizie
di cronaca e geopolitica, che arrivano dalle agenzie: di quelle si potrà mostrare solo il titolo
con il link, se e quando si aggiungerà un loro feed.

## Le altre decisioni da prendere, prima di scrivere codice

1. **Cosa è «rilevante».** Un flusso vero porta centinaia di notizie al giorno. Senza un filtro il
   pannello diventa rumore. Da definire: valute seguite, parole chiave, livello di importanza,
   e se il filtro lo decide l'utente o l'app.
2. **Il pannello.** Spostabile e trasparente, appoggiabile sul grafico. Da decidere se riusa la
   finestra mobile che l'app ha già (quella del grafico staccato) o se è un oggetto nuovo.
3. **Dove si fermano i dati.** Se le notizie non programmate entrano nello stesso archivio, il
   tetto di 3000 voci e i 400 giorni vanno ripensati: un flusso vero li riempie in settimane.

## Vincoli da rispettare

- **Il replay non deve vedere il futuro.** Una notizia va mostrata solo se il suo orario è
  precedente al punto in cui il replay si trova, come già fanno i pallini sul grafico.
- **Il ponte è uno per computer**, e la cache delle notizie sta in RAM: più finestre non devono
  moltiplicare le richieste alla fonte (è l'errore già misurato e curato sul ponte MT5 il 15
  novembre, da non ripetere).
- **Niente scraping** di siti che lo vietano: è una scelta già presa e scritta nel ponte.

## Stato

**Da pianificare.** Nessuna riga scritta. Issue su GitHub aperta il 15 novembre 2026.
