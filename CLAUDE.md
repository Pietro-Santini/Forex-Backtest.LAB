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

- Ogni versione di `app.html` va con un nuovo `CACHE_NAME` in `sw.js` (schema `forex-backtest-lab-v2.0.x`, oggi `v2.0.2`).
  I due file si pubblicano sempre insieme, altrimenti telefoni e tablet restano sulla versione
  vecchia.
- Il sito (GitHub Pages) si aggiorna da `main`. Prima di dire che una versione è online,
  controlla `CACHE_NAME` su `origin/main`.
- Decisione del proprietario: ogni lavoro si salva sul ramo e si pubblica **anche su `main`**
  automaticamente, ma solo con `bash laboratorio/collauda.sh` verde (lo impone l'hook
  `guardia_git.py`). Dopo la pubblicazione, controllare `CACHE_NAME` su `origin/main`.

## Memoria, collaudo e agenti

- **PRIMA DI TOCCARE TEMPO, ORARI, CANDELE O MERCATO APERTO/CHIUSO**: leggere
  «REGOLE SUL TEMPO E SUI DATI DEL GRAFICO» in fondo a `cervello/REGOLE.md`. Sono dieci regole
  non negoziabili, scritte il 21 novembre 2026 dopo una giornata persa sullo scarto `-9000`.
  In una riga: **si misura la sorgente prima di toccare il grafico**
  (`curl "http://127.0.0.1:8001/history?symbol=XAUUSD&timeframe=M1&count=5"`, si guarda
  `utc_offset_seconds_applied`), non si dichiara mai una causa senza averla misurata, e non si
  mostrano mai candele false — meglio meno candele, e detto nella barra di stato.
- Dopo **ogni** modifica a `app.html`: `node laboratorio/strumenti/sintassi_app.mjs`. Un solo
  apostrofo italiano dentro una stringa JavaScript rompe un intero blocco `<script>`.
- `cervello/` è la memoria del progetto: leggere `cervello/LEGGIMI.md` e `cervello/REGOLE.md`
  prima di lavorare, aggiornarlo alla fine (bug, lezioni, idee, diario).
- `bash laboratorio/collauda.sh` deve essere verde prima di proporre o pubblicare una modifica.
  Ogni bug corretto ha il suo test in `laboratorio/`.
- Agenti in `.claude/agents/`: `regista` (coordina e consiglia), `collaudatore`,
  `cacciatore-instabilita`, `sentinella-sicurezza`, `guida-neofita`.
- I sorgenti dell'installer sono in `installer_build/` (app.html e sw.js si copiano dalla
  cartella principale). Il Setup lo costruisce GitHub: flusso "Installer Windows".
