# MESSAGGIO 01 — Mappa della pipeline dei segnali (per il filtro anti-doppioni)

Agente: esplorazione (sola lettura). Argomento: come nasce, viaggia e si apre un segnale Telegram.

> NOTA: i numeri di riga sono quelli **prima** delle ultime modifiche dell'ONDATA 1 (che hanno tolto
> ~19 righe attorno a `tgAutoValuta`). Vanno ri-verificati con grep prima di scrivere codice.

## 1. Parser del messaggio
- **Non è in `app.html`.** È in Python: `installer_build/build/segnali_telegram/parser_segnali.py`,
  funzione `interpreta(testo)` (riga ~611), chiamata dal ponte `segnali_bridge.py` (~riga 417) dentro
  `accogli_messaggio()` (~410).
- Campi del dict `segnale` (parser ~849-875): `strumento`, `direzione`, `entrata`, `entrata_max`
  (fascia), `a_mercato`, `direzione_esplicita`, `tipo_ordine` (`limit`/`stop`/`None`), `stop_loss`,
  `take_profit` (**lista**), `ordini_aggiuntivi`, `confidenza`, `riconosciuto`, `avvisi` (**lista**),
  `testo` (stringa, il messaggio originale).

## 2. La `voce`
- La `voce` È il messaggio JSON: `segnali_bridge.py`, `accogli_messaggio` (~430-444) crea
  `{ricevuto_ms, servizio_ms, ritardo_ms, chat, sala, autore, testo, segnale, sottotipo, parti}`.
  `id` = intero **incrementale in memoria** del ponte (`Bacheca._prossimo_id`), quindi NON stabile fra riavvii.
- Lato app: `tgMessaggioSegnali` (~24069) marca `m.stato='nuovo'`, `m.arrivoLocale_ms=Date.now()` e
  spinge in `tgSegnaliRicevuti` (~24104/24109) + `tgAutoInCoda(m)` (~24117).
- `voce.autoMotivo` viene impostato in `tgAutoValuta` e letto in `tgRenderPannello`.

## 3. Apertura
- Catena: `tgAutoInCoda` → `tgAutoValuta` → `tgAutoDecidi` (pura: ritorna `{apri,motivo,rischio,spazio,cfg,avvicinamento}`).
- Esecutori: **Kraken** `krakenEseguiSegnale` (strategie, NON `positions[]`), **Capital** `tgCapitalEseguiSegnale`
  (posizione simulata con `account:'capital'`), **MT5/simulato** `tgEseguiSegnale` (usa `tgPiano`, poi
  `placeRealMt5Order` / `openMarketTrade` / `pendingOrders.push`).
- Apertura **manuale** dal pannello: pulsante "Apri N posizioni" → `tgApriConfigurazione(voce)` →
  conferma → `tgEseguiSegnale(...)`.

## 4. Metadati di una posizione
- Campi: `id, asset, side, entry, sl, tp, origin, lots, ...` + meta segnale
  `tgGruppo, tgTpIndice, tgSala, tgSegnaleId` (costruiti in `tgEseguiSegnale`). Capital aggiunge `account:'capital'`.
- Kraken: salva in `tgStrategie[gruppo]` `{conto:'kraken', sala, simbolo, sym, side, entry, tps, ...}`.

## 5. Dedup già esistente (riusabile!)
- **`tgRivendicaSegnale`** (cross-device, "chi arriva primo") — ora **rimossa** dall'ONDATA 1.
- Dedup Syntra dello storico: `storico_sale.py` `archivia_syntra` scarta se
  `chiave=(strumento, direzione, entrata, sl, tuple(tp))` coincide entro 3 giorni (~141-144).
- Raggruppamento posizioni (NON filtro) nel Trade Journal: `fblTolleranzaEntrata` usa
  `FBL_POS_QUOTA_STOP=0.15`, `FBL_POS_QUOTA_PREZZO=0.0005`, `FBL_POS_FINESTRA_MS=3*60000`.
- ❌ Non esiste un vero filtro anti-doppione dei segnali in ingresso.

## 6. Punti d'innesto consigliati
- **(a) Nel ponte** (`segnali_bridge.py accogli_messaggio`): imprime una volta per tutti i dispositivi.
  Ha già i campi compattati e una finestra (`FINESTRA_AGGIUNTA_MIN=240`).
- **(b) Nell'app, all'apertura auto** (`tgAutoValuta`, prima di diramare): confronta con ciò che è già aperto.
- **(c) Nell'app, dentro `tgEseguiSegnale`**: coprirebbe anche l'apertura manuale da pannello.
