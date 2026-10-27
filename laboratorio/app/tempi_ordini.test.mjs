// QUANTO CI METTE UN ORDINE, DAL CLIC ALLA RISPOSTA DEL BROKER.
//
// E' la lacuna piu' grave emersa facendo i conti del 27 ottobre: in un'app di trading il tempo
// fra «premo» e «l'ordine c'e'» e' il numero che conta piu' di tutti, e di quello non sapevamo
// NIENTE. Avevamo misurato disegni, aggiornamenti, salvataggi, candele, cache - mai la cosa per
// cui l'app esiste.
//
// Il cronometro sta dentro fetchMt5WithTimeout perche' e' il punto UNICO da cui passa ogni
// chiamata al ponte: ordini, chiusure, modifiche di stop e target, letture. Misurarlo altrove
// vorrebbe dire misurarne una parte e crederla il tutto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('un ordine lascia il suo tempo, con media e PEGGIORE', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      Object.keys(fblTempiPonte).forEach(k => delete fblTempiPonte[k]);
      fblSegnaTempoPonte('/order/market', 120, true);
      fblSegnaTempoPonte('/order/market', 880, true);
      fblSegnaTempoPonte('/order/market', 400, true);
      const t = fblTempiPonte['ordine a mercato'];
      return {n: t.n, media: Math.round(t.tot / t.n), peggio: t.peggio, testo: fblTempiPonteTesto()};
    });
    assert.equal(r.n, 3);
    assert.equal(r.media, 467);
    assert.equal(r.peggio, 880,
      'il peggiore va tenuto a parte: su un ordine la media consola, il caso peggiore fa perdere i soldi');
    assert.match(r.testo, /ordine a mercato/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('anche gli ordini NON riusciti si contano', async () => {
  // Un ordine che non parte dopo venti secondi e' un'informazione piu' importante di uno riuscito
  // in mezzo secondo: se si misurassero solo i successi, il caso peggiore sparirebbe proprio
  // quando conta.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      Object.keys(fblTempiPonte).forEach(k => delete fblTempiPonte[k]);
      fblSegnaTempoPonte('/order/market', 200, true);
      fblSegnaTempoPonte('/order/market', 20000, false);
      const t = fblTempiPonte['ordine a mercato'];
      return {n: t.n, falliti: t.falliti, peggio: t.peggio, testo: fblTempiPonteTesto()};
    });
    assert.equal(r.n, 2, 'si contano tutte e due');
    assert.equal(r.falliti, 1);
    assert.equal(r.peggio, 20000, 'il tentativo fallito entra nel peggiore');
    assert.match(r.testo, /non riuscite/, 'e si vede nel riassunto: ' + r.testo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le famiglie restano separate: un ordine non si confonde con una lettura', async () => {
  // Mescolarle renderebbe il numero inutile: le letture sono centinaia e veloci, gli ordini pochi
  // e lenti. Una media unica nasconderebbe esattamente quello che si vuole vedere.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      Object.keys(fblTempiPonte).forEach(k => delete fblTempiPonte[k]);
      fblSegnaTempoPonte('/order/market', 900, true);
      fblSegnaTempoPonte('/order/close', 300, true);
      fblSegnaTempoPonte('/positions', 40, true);
      fblSegnaTempoPonte('/order/modify', 150, true);
      return Object.keys(fblTempiPonte).sort();
    });
    assert.deepEqual(r, ['chiusura', 'lettura posizioni', 'modifica stop/target', 'ordine a mercato']);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('quello che non interessa non sporca la misura', async () => {
  // La prova di controllo: se ogni chiamata finisse nel riassunto, il riassunto diventerebbe
  // illeggibile e nessuno lo guarderebbe piu'.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      Object.keys(fblTempiPonte).forEach(k => delete fblTempiPonte[k]);
      fblSegnaTempoPonte('/health', 10, true);
      fblSegnaTempoPonte('/news', 500, true);
      fblSegnaTempoPonte('/segnali-log', 80, true);
      return {quante: Object.keys(fblTempiPonte).length, famiglia: fblFamigliaPonte('/health')};
    });
    assert.equal(r.quante, 0, 'health, notizie e registri non entrano nel riassunto');
    assert.equal(r.famiglia, null);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('e finisce nella misura delle prestazioni', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      Object.keys(fblTempiPonte).forEach(k => delete fblTempiPonte[k]);
      fblSegnaTempoPonte('/order/market', 650, true);
      const m = await fblMisuraPrestazioni(1);
      return m.tempiPonte;
    });
    assert.match(String(r), /ordine a mercato.*650/,
      'la misura deve riportare il tempo degli ordini: ' + r);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
