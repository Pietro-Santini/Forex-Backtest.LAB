# Istruzioni per Claude — Forex Backtest LAB

Rispondi sempre in italiano.

## Template Notion (Notion Template Kit)

Il codice delle Cloud Functions del Template Notion (`notion_template_kit/functions-notion/`)
NON è in questo repository: la copia di riferimento è sul PC del proprietario.

Ogni volta che modifichi il Notion Template Kit, aggiorna anche
`notion_template_kit/AGGIORNAMENTO_PASSO_PASSO.txt` e consegnalo dentro lo zip del kit. Va fatto
sempre, senza aspettare che venga chiesto. Il file deve contenere:

- data dell'aggiornamento e novità;
- la procedura completa, in ordine, con la cartella da cui lanciare ogni comando del Prompt dei
  comandi di Windows (la cartella principale è `notion_template_kit`);
- una sezione "PROBLEMI GIÀ INCONTRATI E SOLUZIONE" con ogni domanda fatta dal proprietario
  durante gli aggiornamenti e la risposta (le domande già presenti restano);
- le cose in sospeso.

Il file è di testo semplice, con a capo Windows (CRLF).

## Pubblicazione dell'app

- Ogni versione di `app.html` va con un nuovo `CACHE_NAME` in `sw.js` (`forex-backtest-lab-vNN`).
  I due file si pubblicano sempre insieme, altrimenti telefoni e tablet restano sulla versione
  vecchia.
- Il sito (GitHub Pages) si aggiorna da `main`. Prima di dire che una versione è online,
  controlla `CACHE_NAME` su `origin/main`.
