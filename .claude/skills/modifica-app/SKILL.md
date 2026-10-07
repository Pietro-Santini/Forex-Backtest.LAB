---
name: modifica-app
description: Come si modifica app.html (4 MB, un solo blocco script) senza romperlo. Usala ogni volta che vai a cambiare app.html, e quando una sostituzione "non trova" il blocco che hai sotto gli occhi.
---

# Modificare app.html

`app.html` è un file unico da 4 MB: 38.000 righe, di cui il 91% dentro **un solo** `<script>`
(righe ~3635–37682), 1.365 funzioni al primo livello, nessun `import`. Non si legge intero e non si
riscrive: si fanno **sostituzioni mirate**.

## La regola che fa perdere più tempo

**`app.html` ha a capo Windows (CRLF).** Un blocco cercato con l'a capo normale di Python (`\n`)
non combacia **mai**, e lo script si ferma dicendo «0 occorrenze, attesa 1» — il che fa pensare
che il testo sia sbagliato, mentre è giusto. Vale anche per `installer.iss` e i `.bat`.

Converti gli a capo **prima** di cercare:

```python
_ACAPO = re.compile(r"\r?\n")
old = _ACAPO.sub("\r\n", old)
new = _ACAPO.sub("\r\n", new)
```

In alternativa usa lo strumento `Edit`, che questo problema non ce l'ha. Per blocchi lunghi o
ripetuti conviene comunque lo script.

## Lo scheletro di uno script di modifica

`.claude/skills/modifica-app/sostituisci.py` è già pronto: lo importi o lo copi. Le quattro cose
che deve avere, e perché:

1. **`assert` sul numero di occorrenze, sempre 1.** Un `replace` alla cieca su un file così grande
   può colpire dieci punti e non te ne accorgi finché non si rompe qualcosa d'altro.
2. **Scrivere il file solo alla fine**, dopo che tutte le sostituzioni sono riuscite. Se il terzo
   passo fallisce, il file resta intatto: niente mezze modifiche da ripulire a mano.
3. **Una frase che spiega il perché**, in cima allo script e nei commenti del codice inserito. Fra
   sei mesi la domanda non sarà «cosa fa» ma «perché così».
4. **Stampare cosa è cambiato** (`ok <etichetta>` per ogni passo, e i caratteri prima/dopo).

## Dopo ogni modifica, in quest'ordine

```bash
node laboratorio/strumenti/sintassi_app.mjs      # parte da sola anche come hook PostToolUse
bash laboratorio/collauda.sh                      # deve dire "Falliti: 0"
```

Un bug è corretto **solo** con un test in `laboratorio/` che **prima falliva e ora passa**: senza,
è un'opinione (`cervello/LEGGIMI.md`). Si verifica così:

```bash
cp app.html /tmp/nuova.html && git checkout app.html
cd laboratorio && node --test --test-concurrency=1 app/iltuo.test.mjs   # deve essere ROSSO
cd .. && cp /tmp/nuova.html app.html
cd laboratorio && node --test --test-concurrency=1 app/iltuo.test.mjs   # deve essere VERDE
```

## Trappole già pagate, nei test dell'app

- **«non risponde mai» si scrive `Infinity`, non `999`.** Con l'attesa accorciata si fanno oltre
  mille tentativi in pochi secondi: un 999 viene raggiunto davvero e la prova che doveva fallire
  riesce, dicendo il falso.
- **Le variabili lette da `localStorage` all'avvio** non cambiano se il test scrive nel deposito
  dopo il caricamento: va impostata **anche** la variabile in memoria.
- **`apriApp()` apre il file in locale, con la rete bloccata e il velo di accesso nascosto.** Non
  prova la strada vera (sito in https, accesso, service worker): per quella c'è l'agente
  `collaudatore-online`.

## Prima di pubblicare

`app.html` nuovo = **`CACHE_NAME` nuovo** in `sw.js`, altrimenti telefoni e tablet restano sulla
versione vecchia senza nessun errore visibile. Lo impone anche l'hook `guardia_git.py`, che blocca
il push su `main`. Per tutta la procedura: skill `pubblica`.

## Dove sta cosa (mappa rapida)

| Righe | Cosa |
|---|---|
| 28–806 | CSS |
| 871–1290 | modulo Firebase: accesso, abbonamento, stato sessione — **qui si decide se l'app parte** |
| 1300–3634 | markup, 26 finestre (`…Overlay`) |
| 3635–37682 | il programma: grafico, indicatori, ordini, conti, sale segnali, collegamenti |
| 38234–38698 | pagina Statistiche |

Le famiglie di funzioni più grosse: `tg…` (126, sale segnali), `fbl…` (87, collegamenti e server),
`footprint…` (60), `kraken…` (30).
