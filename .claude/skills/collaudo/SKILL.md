---
name: collaudo
description: Lancia e amplia il banco di prova di Forex Backtest LAB (laboratorio/). Usala prima di proporre qualunque modifica, quando un test fallisce, o quando serve un test nuovo per un bug.
---
# Collaudo

- Tutto: `bash laboratorio/collauda.sh` → riassunto in `laboratorio/risultati/ultimo.md`, log per
  ogni passo nella stessa cartella. Esce con 0 solo se tutto passa.
- Solo app nel browser: `cd laboratorio && node --test --test-concurrency=1 app/*.test.mjs`
- Solo ponte Python: `python3 -m pytest -q laboratorio/ponte`
- Solo sintassi di app.html: `node laboratorio/strumenti/sintassi_app.mjs`

## Scrivere un test nuovo
- App: un file `laboratorio/app/<argomento>.test.mjs`. Usa `apriApp()` (Chromium senza rete,
  veli di accesso nascosti), `PREPARA_BTC` (150 candele BTC da 1 minuto, conto Kraken scelto), e un
  ponte finto sostituendo `fetchMt5WithTimeout` dentro `pagina.evaluate`. Controlla sempre
  `errori` (errori JavaScript) alla fine.
- Ponte: `laboratorio/ponte/test_<argomento>.py` con `import _percorsi` in cima (trova i moduli in
  `installer_build/build` e usa una cartella dati temporanea, mai quella vera).
- Date delle candele finte: ISO con la Z. Vedi `cervello/LEZIONI.md`.
- Un test deve fallire senza la correzione e passare con la correzione. Verificalo.

Su GitHub lo stesso collaudo gira a ogni push (flusso "Collaudo").
