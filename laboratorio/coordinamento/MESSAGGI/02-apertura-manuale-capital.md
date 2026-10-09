# MESSAGGIO 02 — Apertura MANUALE su Capital.com (barra conti)

Agente: esplorazione (sola lettura). Argomento: come aggiungere Capital.com come conto della barra
conti manuale, accanto a MT5 e Kraken. Righe verificate sul file corrente (post ONDATA 1).

Nota: la funzione `kontodi` NON esiste; esiste solo `contoDi` (40608).

## Punti da toccare (con righe attuali)
1. **HTML barra conti** 2984-2990: pulsanti `data-conto` mt5 (2986), kraken (2987), storico (2988,
   senza pallino). Inserire il pulsante Capital tra Kraken e Storico.
2. **`fblContoVista`** 35966: whitelist `'kraken'|'storico'|'mt5'` → aggiungere `'capital'`.
3. **`fblContoEffettivo`** 35967-35970: oggi `kraken?kraken:mt5`; aggiungere il caso `'capital'`.
4. **`fblContoDisegna`** 35971-35986: classe `active` (35973-35974); **pallino 35976** usa
   `data-conto==='mt5'?mt5Connected:krakenContoPronto()` → un conto nuovo userebbe lo stato di Kraken
   (BUG da correggere: ramo `capital` → `!!capitalSessionTokens`); testo in `#fblContoNota` 35980-35985.
5. **`fblContoScegli`** 35987-36007: rami storico/mt5/kraken, **nessun else**: aggiungere ramo `capital`
   (accende sessione con `ensureCapitalConnected`, `fblContoVista='capital'`, se `!liveModeActive` →
   `switchAccountMode(true)`).
6. **Delega click** 36008 (generica: funzionerà appena c'è il `data-conto`).
7. **`openMarketTrade(side,forz)`** 19545: ramo Kraken 19548, ramo MT5 vero 19553. **Aggiungere il ramo
   Capital PRIMA di 19553 e solo con `!forz`**, altrimenti con MT5 collegato partirebbe un ORDINE VERO
   MT5 con l'epic Capital (stesso bug del passo 13, oggi riparato solo nell'auto). Letterale `pos`
   19589-19596 **non imposta `account`**; `positions.push` 19613.
8. **Connessione**: `ensureCapitalConnected` 18146; `tgCapitalAccendiInSilenzio` 25519;
   `capitalSessionTokens` 30521; `capitalApiFetch` 30533; base API 30519-30520;
   `tgAssetPerStrumento` 27016 (ricerca Capital 27040); `resolveCapitalEpic` 30757;
   `fetchLatestPriceRest` 33474-33488; `tgPiano` 27148. Esempio prezzo coerente: 26260-26264.
9. **Avvio**: lettura vista salvata 35966; ripristino 36655 (solo Kraken); polling 36819-36840
   (`vista=fblContoVista==='kraken'&&liveModeActive` a 36822).
10. **Capital esistente da riusare**: `tgContoEffettivoPerSegnale` 25538; ramo `capital` in
    `tgAutoValuta` 26254-26272; `tgCapitalEseguiSegnale` 25561-25584 (modello pos 25567-25570 con
    `account:'capital'`); `contoDi` 40608 (40614 capital); `eCapital` 40620; filtro `__capital` 40651;
    badge `journalSessionBadgeHtml` 4339-4353 (4343); export test `window.fblStatCalcoli` 41288.

## Rischi
- Whitelist e `fblContoEffettivo` non conoscono 'capital' → ripiegherebbe su 'mt5'.
- Pallino (35976): mostrerebbe lo stato di Kraken.
- `fblContoScegli`: senza ramo, il click salva 'capital' senza fare nulla di sensato.
- `openMarketTrade`: senza ramo Capital prima di 19553, in Live con MT5 parte un ordine VERO.
- `tgContoDiPosizione` 25513 (`mt5Connected?'mt5':'sim'`) NON conosce `account`: le posizioni Capital
  verrebbero contate come MT5 nei tetti automatici (valutare).
- Dashboard: `applyKrakenStatsToPanel`/`applyMt5AccountStatsToPanel` non coprono Capital (decidere).

## Piano (ordine)
1. Pulsante HTML `data-conto="capital"` dopo 2987.
2. Whitelist 35966 + `fblContoEffettivo` 35969.
3. Pallino 35976 + nota 35980-35985 con ramo Capital.
4. Ramo `capital` in `fblContoScegli` (accende sessione, passa a Live).
5. Nuova `capitalOrdineManuale(side)` (modello `krakenOrdineManuale` 36063): sym = asset a grafico,
   prezzo da `currentPrice()` o `fetchLatestPriceRest`, sl/tp dai campi + `validateTradeLevel`,
   `lots=getLotSize()`, `pos` con `account:'capital'`, `positions.push`, `fblAttribuisciSegnale(pos)`.
6. Ramo in `openMarketTrade` prima di 19553 (solo `!forz`).
7. Boot 36655: ramo `capital`.
8. (consigliato) `tgContoDiPosizione` 25513: riconoscere `account==='capital'`.
9. (da decidere) Dashboard/statistiche Capital.

## Test proposti (`laboratorio/app/capital_manuale.test.mjs`, stile capital_instradamento)
1. Scegliere Capital accende la vista, salva in localStorage, pulsante `active` e pallino `●`.
2. BUY manuale con conto Capital → 1 posizione `account:'capital'`, e **nessun ordine MT5**.
3. Conto Capital senza sessione → nessuna apertura e messaggio in `#status`.
4. La posizione Capital manuale è famiglia a parte nel Trade Journal.
5. In Live con MT5 collegato, il conto Capital dirotta l'ordine manuale (niente ordine vero MT5).
