# -*- coding: utf-8 -*-
"""Aggiunge al diario il capitolo sul pacchetto di installazione (punto 6 della consegna)."""
import io
import os
import sys

PERCORSO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'cervello', 'DIARIO.md'))

CAPITOLO = """
## 22 ottobre 2026 (continua) - Il pacchetto di installazione: quando non serve, non si scarica

**Segnalato:** «30-40 file nella cartella Download invece di uno sostituito».

### Il nome del file non e' un difetto nostro

La consegna lo diceva gia': il nome lo decide il server (GitHub Releases), ma a scaricarlo e' il
browser di sistema, che aggiunge `(1)`, `(2)`, `(3)`... **Una pagina web non puo' sostituire un
file nella cartella Download**: non esiste un'API che lo permetta. Quindi la strada 1 della
consegna (il nome con la versione dentro) e' un modo per capire QUALI file sono, non per
toglierli.

Il difetto vero era un altro, ed era nostro: **il pulsante «Aggiorna» scaricava il pacchetto
anche quando il pacchetto non portava niente**. Ogni release pubblicata = un Setup nuovo = un
click = un file in piu' nella cartella. Quaranta release, quaranta file: il conto torna.

### La misura che decide (era gia' scritta nella consegna)

Dal 22 ottobre il ponte scarica da se' una **copia aggiornata** di `app.html` e `sw.js` e serve
quella, invece di quella congelata dentro l'eseguibile. Lo dichiara in `/health`, nel campo
`app.da`. E' l'unico che sa quale delle due copie sta servendo, quindi e' l'unico a cui si puo'
chiedere.

| Cosa dice il ponte | Cosa serve | Cosa fa il pulsante |
|---|---|---|
| `app.da = 'copia aggiornata'` | niente: il programma sa aggiornarsi da solo | **ricarica la pagina** |
| `app.da = 'copia installata'` | il Setup, UNA volta | scarica il Setup |
| il ponte non risponde | non si puo' sapere: **per sicurezza** il Setup | scarica il Setup |
| Android | l'APK e' l'app stessa | scarica l'APK |
| un dispositivo che non e' un computer | niente | ricarica la pagina |

La decisione sta in un posto solo, `fblPianoAggiornamento()` (con una cache di 60 secondi, per
non interrogare il ponte a ogni click), e l'etichetta in un altro, `fblEtichettaAggiorna(piano)`:
**«⬇️ Aggiorna»** se il pacchetto serve davvero, **«🔄 Aggiorna l'app»** se basta ricaricare. Un
pulsante che dice una cosa e ne fa un'altra e' la causa di mezzo problema.

### La seconda porta: il wizard dei pacchetti MT5

Lo stesso difetto era anche nel wizard che si apre quando il servizio non risponde: se i
pacchetti erano gia' installati, offriva lo stesso «Scarica di nuovo i pacchetti». Ora, se anche
l'app qui e' gia' aggiornata (stesso confronto del pannello Versione), il pulsante **sparisce** e
il testo dice perche': di solito vuol dire che il computer e' appena stato acceso e il servizio
non ha ancora fatto in tempo a partire. Se il problema resta, il testo lascia il link alla pagina
delle versioni: la via per reinstallare a mano non sparisce, cambia solo da pulsante a link.

Il confronto usa la release **già in memoria** (il controllo automatico la tiene aggiornata) e
non chiede la rete: l'utente sta aspettando che qualcosa si muova. Se la release non e' nota,
non si nasconde niente: meglio un file in piu' che un modo per reinstallare perso.

### I test (6) e la prova che sanno diventare rossi

`laboratorio/app/setup_non_necessario.test.mjs` misura il **comportamento**: clicca «Aggiorna
ora» e guarda se parte un **download** del pacchetto oppure una **ricarica** della pagina
(l'indirizzo del link viene registrato, il file non si scarica). Non legge il sorgente.

Le due prove di controllo sono la parte importante:
- il programma installato che serve la **copia congelata** -> il `.exe` **deve** partire;
- l'app qui **indietro** -> nel wizard il download **deve** restare.

Sono state provate rosse: rimettendo il codice di prima, il pulsante diceva «⬇️ Aggiorna ora»,
il pacchetto partiva anche quando non serviva, e il wizard lo offriva lo stesso. Con il codice
nuovo le sei sono verdi.

### La lezione ⭐

**Una domanda che il prodotto puo' fare a se' stesso va fatta, non indovinata.** Il ponte sapeva
già da quale copia stava servendo l'app: la risposta era gia' in `/health`, e noi scaricavamo il
pacchetto lo stesso. Il costo non e' stato scrivere la funzione: e' stato accorgersi che la
domanda esisteva.

**E la cucitura conta.** La prima versione della sonda interrogava il ponte con una `fetch` sua
(3 secondi, AbortController). Il test di prima, `versione_due_numerazioni`, e' diventato rosso:
mockava `fetchMt5WithTimeout`, non `fetch`. La sonda e' passata dalla **stessa porta di sempre**
(`fetchMt5WithTimeout('/health')`), cosi' un solo modo di interrogare il ponte in tutta l'app e i
test di prima continuano a poter parlare con lui. Una porta nuova e' una porta che nessuno
conosce: meglio riusare quella che c'e'.
"""


def main():
    with io.open(PERCORSO, 'r', encoding='utf-8', newline='') as f:
        testo = f.read()
    if 'quando non serve, non si scarica' in testo:
        print('FERMA: il capitolo c\'e\' gia\'')
        sys.exit(1)
    righe = CAPITOLO.replace('\r\n', '\n').split('\n')
    nuovo = '\r\n'.join(righe)
    if not testo.endswith('\r\n'):
        testo = testo + '\r\n'
    testo = testo + nuovo.lstrip('\r\n')
    if not testo.endswith('\r\n'):
        testo = testo + '\r\n'
    with io.open(PERCORSO, 'w', encoding='utf-8', newline='') as f:
        f.write(testo)
    print('diario aggiornato')


main()
