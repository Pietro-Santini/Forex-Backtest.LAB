// LE DATE DELLE CANDELE, LETTE IN FRETTA MA UGUALI A PRIMA.
//
// Convertire le date si prendeva meta' del primo disegno: su 100.000 candele, 25,7 ms dentro
// Date.parse piu' 18,3 nella funzione che la chiama, misurati col profilatore l'8 ottobre 2026 su
// un computer - su un telefono sei volte tanto. Ora le due forme che coprono quasi tutto (ISO
// delle candele dal vivo, MetaTrader dei CSV) si leggono numero per numero.
//
// Il rischio di questa correzione e' uno solo, ma grosso: una data letta in un fuso diverso
// sposta candele, entrate e marcatori, e non se ne accorge nessuno finche' non e' tardi. Quindi
// qui non si prova che e' veloce: si prova che e' IDENTICA. Dove non lo e', deve tirarsi
// indietro e lasciar fare al percorso di prima.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Forme che la strada veloce DEVE sapere leggere.
const CONOSCIUTE = [
  '2026-10-08T06:30:00.000Z', '2026-10-08T06:30:00Z', '2026-01-01T00:00:00Z',
  '2026-10-08T06:30:00', '2026-10-08T06:30', '2024-03-31T02:30',
  '2024.01.01 12:00', '2024.01.01 12:00:00', '2024.12.31 23:59:59',
  '2024.03.10 02:30', '2024.11.03 01:30', '2025.06.15 08:45:30',
  '2024-01-01 12:00', '2024-01-01 12:00:00',
  // Millisecondi scritti con meno di tre cifre: ".5" vale 500, ".05" vale 50, come per
  // Date.parse. Sono comprese apposta, perche' sono il caso in cui e' piu' facile sbagliare.
  '2026-10-08T06:30:00.5Z', '2026-10-08T06:30:00.05Z', '2026-10-08T06:30:00.123456Z'
];
// Forme che la strada veloce NON deve toccare: deve tirarsi indietro e lasciar fare a prima.
// La piu' insidiosa e' la seconda: senza fuso scritto MA con i millisecondi, oggi viene letta
// nel fuso del dispositivo, non in quello dei CSV. Uniformarla di nascosto sposterebbe candele.
const STRANE = [
  '2026-10-08T06:30:00+02:00', '2026-10-08T06:30:00.000',
  '2026-10-08t06:30:00z', '2026-1-8T6:30', '2026/10/08 06:30', '8 ottobre 2026',
  '', '   ', 'non una data', '2026-10-08', '20261008T0630'
];

test('sulle forme conosciute la lettura veloce da lo stesso identico istante di prima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((valori) => valori.map(v => ({
      v, veloce: _parseDateTimeVeloce(v), lento: _parseDateTimeLento(v)
    })), CONOSCIUTE);
    r.forEach(x => {
      assert.notEqual(x.veloce, undefined, 'la strada veloce dovrebbe saper leggere «' + x.v + '»');
      assert.equal(x.veloce, x.lento, 'istante diverso per «' + x.v + '»: veloce ' + x.veloce + ', prima ' + x.lento);
      assert.ok(Number.isFinite(x.lento), 'la data «' + x.v + '» deve restare valida');
    });
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('sulle forme strane la lettura veloce si tira indietro, invece di indovinare', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((valori) => valori.map(v => ({v, veloce: _parseDateTimeVeloce(String(v))})), STRANE);
    r.forEach(x => assert.equal(x.veloce, undefined,
      '«' + x.v + '» non e una delle due forme note: doveva lasciar fare al percorso di prima, ha risposto ' + x.veloce));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('parseDateTime nel suo insieme non cambia risposta su nessuna delle due', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((valori) => valori.map(v => {
      const dalla = parseDateTime(v);          // passa dalla strada veloce
      const prima = _parseDateTimeLento(v);    // come si faceva
      return {v, dalla, prima, uguali: (Number.isNaN(dalla) && Number.isNaN(prima)) || dalla === prima};
    }), CONOSCIUTE.concat(STRANE.filter(s => s.trim())));
    const diversi = r.filter(x => !x.uguali);
    assert.deepEqual(diversi, [], 'queste date cambierebbero significato: ' + JSON.stringify(diversi));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un anno intero di candele al minuto da gli stessi istanti, ora per ora', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // Mezzanotti, cambi d'ora legale e fine mese compresi: sono i punti dove un fuso sbagliato
    // si vede, e dove e' piu' facile sbagliare.
    const r = await pagina.evaluate(() => {
      let diversi = 0, provati = 0, primoDiverso = null;
      const due = (n) => String(n).padStart(2, '0');
      for (let mese = 1; mese <= 12; mese++) {
        for (const giorno of [1, 10, 15, 28, 30]) {
          for (const ora of [0, 1, 2, 3, 12, 23]) {
            for (const forma of ['iso', 'mt']) {
              const v = forma === 'iso'
                ? `2024-${due(mese)}-${due(giorno)}T${due(ora)}:30`
                : `2024.${due(mese)}.${due(giorno)} ${due(ora)}:30`;
              provati++;
              const a = _parseDateTimeVeloce(v), b = _parseDateTimeLento(v);
              if (a !== b) { diversi++; if (!primoDiverso) primoDiverso = {v, a, b}; }
            }
          }
        }
      }
      return {provati, diversi, primoDiverso};
    });
    assert.ok(r.provati > 500, 'troppe poche date provate: ' + r.provati);
    assert.equal(r.diversi, 0, 'prima differenza: ' + JSON.stringify(r.primoDiverso));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i timestamp del dataset restano quelli di prima, candela per candela', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const n = 3000, t0 = Date.UTC(2024, 0, 1, 0, 0, 0), R = [];
      for (let i = 0; i < n; i++) R.push({date: new Date(t0 + i * 60000).toISOString(), open: 1, high: 2, low: 0, close: 1, volume: 1});
      rows = R; baseRows = R;
      rowsTimeCache = null; rowsTimeCacheRef = null;
      const nuovi = getRowsTimestamps().slice();
      const prima = R.map(x => _parseDateTimeLento(x.date));
      let diversi = 0, primo = null;
      for (let i = 0; i < n; i++) if (nuovi[i] !== prima[i]) { diversi++; if (!primo) primo = {i, nuovo: nuovi[i], prima: prima[i], data: R[i].date}; }
      return {n, diversi, primo, tuttiValidi: nuovi.every(Number.isFinite)};
    });
    assert.equal(r.diversi, 0, 'prima differenza: ' + JSON.stringify(r.primo));
    assert.equal(r.tuttiValidi, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
