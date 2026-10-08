// CHI HA APERTO L'OPERAZIONE: mai attribuire a te quello che non hai aperto.
//
// SEGNALATO dal proprietario (8 ottobre 2026): «ci sono molte operazioni dove c'e' scritto che le
// ho aperte io manualmente, e invece no: quel "tu" e' associato a qualche sala segnali che non e'
// riuscito a capire quale sia».
//
// Causa: il nome della sala veniva preso solo da `voce.chat`, il titolo del gruppo su Telegram.
// Il ponte ne manda due - `chat` (titolo leggibile) e `sala` (la voce esatta scritta nelle
// impostazioni, quella con cui l'app riconosce la sala fra quelle accese). Se il titolo mancava,
// l'operazione nasceva senza sala, e senza sala veniva mostrata come aperta a mano.
//
// Non e' un dettaglio estetico: un'operazione attribuita a te sparisce dal profitto per sala e dal
// win rate per sala, cioe' dai numeri su cui si decide di quale sala fidarsi.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('il nome della sala: il titolo se c e, altrimenti la voce delle impostazioni', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => ({
      conTitolo: fblNomeSala({chat: 'Gold Signals VIP', sala: '@goldsignals'}),
      senzaTitolo: fblNomeSala({chat: '', sala: '@goldsignals'}),
      titoloSoloSpazi: fblNomeSala({chat: '   ', sala: '@goldsignals'}),
      soloAutore: fblNomeSala({autore: 'CrownPips'}),
      vuota: fblNomeSala({}),
      niente: fblNomeSala(null)
    }));
    assert.equal(r.conTitolo, 'Gold Signals VIP', 'col titolo si usa il titolo: e quello leggibile');
    assert.equal(r.senzaTitolo, '@goldsignals', 'senza titolo si ripiega sulla voce configurata');
    assert.equal(r.titoloSoloSpazi, '@goldsignals');
    assert.equal(r.soloAutore, 'CrownPips');
    assert.equal(r.vuota, 'Sala non riconosciuta', 'mai una stringa vuota: diventerebbe «tu»');
    assert.equal(r.niente, '');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una posizione con i segni di un segnale non viene mai attribuita a te', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => ({
      // il caso segnalato: viene da un segnale (ha il codice del gruppo) ma il nome si e perso
      salaPersa: fblOrigineBadgeHtml({tgGruppo: 'sg1', entry: 100}),
      soloTpIndice: fblOrigineBadgeHtml({tgTpIndice: 2, entry: 100}),
      soloIdSegnale: fblOrigineBadgeHtml({tgSegnaleId: 'abc', entry: 100}),
      // aperta davvero a mano: nessun segno di segnale
      tua: fblOrigineBadgeHtml({entry: 100}),
      // normale
      conSala: fblOrigineBadgeHtml({tgSala: 'Gold Signals VIP', tgGruppo: 'sg1'})
    }));
    assert.doesNotMatch(r.salaPersa, /👤/, 'viene da un segnale: non e tua');
    assert.match(r.salaPersa, /non riconosciuta/);
    assert.doesNotMatch(r.soloTpIndice, /👤/);
    assert.doesNotMatch(r.soloIdSegnale, /👤/);
    assert.match(r.tua, /👤/, 'senza nessun segno di segnale, quella si che e tua');
    assert.match(r.conSala, /Gold Signals VIP/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('stessa regola nella colonna Origine del Trade Journal', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => ({
      salaPersa: journalOrigineHtml({tgGruppo: 'sg1', pl: 10}),
      tua: journalOrigineHtml({pl: 10}),
      conSala: journalOrigineHtml({tgSala: 'SALA STARK', pl: 10})
    }));
    assert.doesNotMatch(r.salaPersa, /Manuale/, 'veniva da un segnale: non e manuale');
    assert.match(r.salaPersa, /non riconosciuta/);
    assert.match(r.tua, /Manuale/);
    assert.match(r.conSala, /SALA STARK/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un segnale senza titolo del gruppo non produce piu operazioni senza sala', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      // Le tre forme in cui un segnale puo' arrivare: titolo, solo voce configurata, nessuno dei due.
      const voci = [{chat: 'Gold Signals VIP', sala: '@gold'}, {chat: '', sala: '@gold'}, {}];
      return voci.map(v => {
        const nome = fblNomeSala(v);
        return {nome, vuoto: !nome, mostrataComeTua: /👤/.test(fblOrigineBadgeHtml({tgSala: nome, tgGruppo: 'sg1'}))};
      });
    });
    r.forEach(x => {
      assert.equal(x.vuoto, false, 'nome vuoto: l operazione finirebbe attribuita a te');
      assert.equal(x.mostrataComeTua, false, 'mostrata come tua con nome «' + x.nome + '»');
    });
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
