// L'ASSE DEL TEMPO DEVE DIRE L'ORA VERA DELLA CANDELA.
//
// SEGNALATO dal proprietario, confrontando con TradingView: «la candela lunga della notizia e'
// delle 14:30, e da noi l'asse la mette alle 15:30». Un'ora esatta, vista in modalita' replay con
// le pagine duplicate aperte.
//
// COSA E' GIA' STATO MISURATO, e qui non serve rimisurarlo:
//   - i dati che arrivano dal servizio MT5 sono giusti: l'ultima candela servita e' sempre quella
//     del minuto in corso (controllato dal vivo: candela delle 02:44, orologio 02:44);
//   - il magazzino locale scrive e rilegge senza spostare niente (indagine del 10 novembre:
//     «spostamento: 0 ore»), e le serie salvate con un altro scarto orario vengono riallineate
//     con il loro timbro;
//   - il fuso dei CSV (America/New_York) sposta di CINQUE ore, non di una: e' un'altra cosa.
//
// Resta da provare la catena fino allo schermo: la candela ha un istante, l'asse ci scrive
// sopra un'ora. QUESTO banco misura esattamente quel passaggio, in Live e in replay, su un
// giorno d'inverno e su uno d'estate - perche' un'ora di differenza e' esattamente quello che
// succede quando un orario viene calcolato con lo scarto sbagliato fra ora solare e ora legale.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Due giorni scelti apposta: uno in ora solare (gennaio) e uno in ora legale (luglio). Le candele
// sono ISTANTI veri (UTC): quello che l'asse scrive sopra deve corrispondere a quell'istante
// letto nel fuso del dispositivo, qualunque fuso sia.
const GIORNI = [
  {nome: 'inverno (ora solare)', iso: '2026-01-15T13:30:00.000Z'},
  {nome: 'estate (ora legale)',  iso: '2026-07-15T12:30:00.000Z'}
];

// Costruisce 120 candele da un minuto a partire da un istante, disegna, e riporta le etichette
// che l'asse ha prodotto insieme all'istante di ogni tacca.
const PROVA = (isoPartenza, inReplay) => `(async () => {
  const t0 = Date.parse(${JSON.stringify(isoPartenza)}) - 60 * 60000;
  const R = [];
  for (let i = 0; i < 120; i++) {
    const p = 100 + Math.sin(i / 7);
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: p, high: p + 0.5, low: p - 0.5, close: p, volume: 10});
  }
  rows = R; baseRows = R; currentTF = 1;
  currentAssetKey = 'EURUSD'; rowsAssetKey = 'EURUSD';
  csvLibrary = [{id: 'mt5_live_EURUSD', rows: R}];
  liveModeActive = !${JSON.stringify(!!inReplay)};
  liveReplayActive = ${JSON.stringify(!!inReplay)};
  idx = R.length - 1; viewEnd = R.length - 1; visibleCount = 90;
  update(); draw();
  return {
    tacche: timeTicks.map(tk => ({t: tk.t, ora: String(tk.hour).padStart(2,'0') + ':' + String(tk.minute).padStart(2,'0')})),
    fuso: selectedTimeZone,
    replay: !!liveReplayActive
  };
})()`;

// L'ora attesa si calcola qui, in modo indipendente dall'app: stesso istante, stesso fuso,
// chiesto a Intl. Se le due strade divergono, una delle due sbaglia - ed e' quello che il
// proprietario vede sullo schermo.
function oraAttesa(t, fuso) {
  const p = new Intl.DateTimeFormat('it-IT', {timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'})
    .formatToParts(new Date(t));
  const h = p.find(x => x.type === 'hour').value, m = p.find(x => x.type === 'minute').value;
  return h + ':' + m;
}

for (const giorno of GIORNI) {
  for (const inReplay of [false, true]) {
    const dove = inReplay ? 'in replay' : 'in Live';
    test(`l'asse scrive l'ora vera della candela, ${dove}, ${giorno.nome}`, async () => {
      const {browser, pagina, errori} = await apriApp();
      try {
        const r = await pagina.evaluate(PROVA(giorno.iso, inReplay));
        assert.equal(r.replay, inReplay, 'la scena deve essere nello stato che dice di misurare');
        assert.ok(r.tacche.length >= 2, 'l\'asse deve avere almeno due tacche: trovate ' + r.tacche.length);

        const sbagliate = r.tacche
          .filter(tk => Number.isFinite(tk.t))
          .map(tk => ({ora: tk.ora, attesa: oraAttesa(tk.t, r.fuso), istante: new Date(tk.t).toISOString()}))
          .filter(x => x.ora !== x.attesa);

        assert.deepEqual(sbagliate, [],
          'l\'asse scrive un\'ora diversa da quella vera della candela (fuso del dispositivo: '
          + r.fuso + '). Prime differenze: ' + JSON.stringify(sbagliate.slice(0, 3)));
        assert.deepEqual(errori, []);
      } finally { await browser.close(); }
    });
  }
}

test('e la stessa candela, letta in Live e in replay, porta la stessa ora', async () => {
  // La segnalazione arriva dal replay: se l'ora cambiasse passando da una modalita' all'altra,
  // il difetto sarebbe li' - ed e' la differenza che si vede confrontando con TradingView.
  const {browser, pagina, errori} = await apriApp();
  try {
    const live = await pagina.evaluate(PROVA(GIORNI[0].iso, false));
    const replay = await pagina.evaluate(PROVA(GIORNI[0].iso, true));
    const comuni = live.tacche.filter(a => replay.tacche.some(b => b.t === a.t));
    assert.ok(comuni.length >= 2, 'le due letture devono avere tacche in comune: ' + comuni.length);
    const diverse = comuni
      .map(a => ({istante: new Date(a.t).toISOString(), live: a.ora,
                  replay: (replay.tacche.find(b => b.t === a.t) || {}).ora}))
      .filter(x => x.live !== x.replay);
    assert.deepEqual(diverse, [], 'la stessa candela porta due ore diverse: ' + JSON.stringify(diverse.slice(0, 3)));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
