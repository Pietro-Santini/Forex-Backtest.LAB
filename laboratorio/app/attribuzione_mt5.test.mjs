// DIFETTO (D) — L'attribuzione "👤 tu" si ripresenta nella colonna "Sessione" delle posizioni
// aperte, per le posizioni MT5. Causa: la tabella legge `fblOrigineBadgeHtml`, che NON recupera la
// sala dal ticket; il Trade Journal, invece, la recupera (`journalOrigineHtml` chiama
// `mt5ApplicaSegnale`). Stessa posizione, due schermate, due risposte diverse.
//
// C'e' anche un secondo buco: `mt5AllineaApertura` chiama `mt5ApplicaSegnale` solo alla FINE, ma
// esce prima se l'orario del broker manca o e' nel futuro (servizio vecchio senza correzione del
// fuso). Cosi' la sala non viene recuperata nemmeno sul percorso di riadattamento ufficiale.
//
// Questi test nascono ROSSI: oggi la colonna "Sessione" mostra "👤 tu" e `tgSala` resta vuoto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// L'app come sul computer, con MT5 collegato. Il ticket 123 appartiene a un segnale di "Sala Oro":
// e' la memoria che l'app scrive quando apre un ordine da un segnale (mt5RicordaSegnale).
const PREPARA = () => {
  positions = []; pendingOrders = []; trades = [];
  mt5Connected = true; liveModeActive = true; fblContoVista = 'mt5';
  mt5TgMeta = {};
  mt5TgMeta['123'] = {tgSala: 'Sala Oro', tgGruppo: 'g1', tgTpIndice: 1, tgSegnaleId: 555, il: Date.now()};
};

test('colonna "Sessione": una posizione MT5 con ticket noto mostra la sala, non "tu"', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(), PREPARA.toString());
    const r = await pagina.evaluate(() => {
      // Posizione ricostruita dal conto: ha il ticket ma non porta ancora la sala.
      const p = {id: 1, asset: 'XAUUSD', side: 'BUY', entry: 2000, sl: 1990, tp: 2010, mt5Ticket: 123};
      return {html: fblOrigineBadgeHtml(p), tgSala: p.tgSala};
    });
    assert.match(r.html, /Sala Oro/, 'la sala va recuperata dal ticket: ' + r.html);
    assert.doesNotMatch(r.html, /👤 tu/, 'non è un\'operazione manuale: ' + r.html);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('riadattamento MT5 senza orario del broker: la sala si recupera comunque', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(), PREPARA.toString());
    const r = await pagina.evaluate(() => {
      const p = {id: 2, asset: 'XAUUSD', side: 'BUY', entry: 2000, sl: 1990, tp: 2010, mt5Ticket: 123};
      // `rp.time` manca (servizio vecchio): mt5AllineaApertura esce prima di applicare la sala.
      mt5AllineaApertura(p, {price_open: 2000});
      return {tgSala: p.tgSala};
    });
    assert.equal(r.tgSala, 'Sala Oro', 'anche uscendo prima, la sala va applicata dal ticket');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un\'operazione davvero a mano resta "tu"', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(), PREPARA.toString());
    const r = await pagina.evaluate(() => {
      const p = {id: 3, asset: 'XAUUSD', side: 'BUY', entry: 2000, sl: 1990, tp: 2010}; // nessun ticket
      return fblOrigineBadgeHtml(p);
    });
    assert.match(r, /👤 tu/, 'senza segnale e senza ticket resta un\'operazione tua');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('ticket sconosciuto: nessuna sala inventata, resta "tu"', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(), PREPARA.toString());
    const r = await pagina.evaluate(() => {
      const p = {id: 4, asset: 'XAUUSD', side: 'BUY', entry: 2000, sl: 1990, tp: 2010, mt5Ticket: 999};
      return fblOrigineBadgeHtml(p);
    });
    assert.match(r, /👤 tu/, 'senza memoria del ticket non si attribuisce nulla');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
