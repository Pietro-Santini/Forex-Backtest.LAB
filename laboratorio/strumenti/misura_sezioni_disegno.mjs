// MISURA DELLE SEZIONI DEL DISEGNO (capitolo 7b) — da lanciare a mano.
//
// Apre l'app nel banco di prova, prepara le candele, e stampa quanto costa OGNI SEZIONE del
// corpo di draw(): e' il numero che serve per sapere dove ottimizzare, invece di indovinare.
//
// Uso: node laboratorio/strumenti/misura_sezioni_disegno.mjs
import {apriApp, PREPARA_BTC} from '../app/aiuti.mjs';

const {browser, pagina, errori} = await apriApp();
try {
  await pagina.evaluate(PREPARA_BTC);

  const base = await pagina.evaluate(async () => {
    fblSezioniDraw = {};
    fblCronoSezioni = true;
    const t0 = performance.now();
    for(let i = 0; i < 20; i++)draw();
    const totale = (performance.now() - t0) / 20;
    fblCronoSezioni = false;
    const sezioni = {};
    for(const k of Object.keys(fblSezioniDraw))sezioni[k] = fblSezioniDraw[k] / 20;
    return {totale, sezioni};
  });

  // CON UN CARICO SIMILE A QUELLO DEL PROPRIETARIO: disegni dell'utente e posizioni aperte.
  const carico = await pagina.evaluate(async () => {
    // 20 disegni (rettangoli e linee di tendenza) sulle ultime 80 candele visibili.
    const n = rows.length;
    for(let i = 0; i < 20; i++){
      const a = Math.max(0, n - 80 + (i * 3) % 70), b = Math.min(n - 1, a + 12);
      const tipo = (i % 2) ? 'rectangle' : 'trendline';
      drawings.push({id: 900000 + i, type: tipo,
        p1: {time: Date.parse(rows[a].date), price: rows[a].low},
        p2: {time: Date.parse(rows[b].date), price: rows[b].high},
        locked: false, hidden: false, color: (i % 2) ? '#3ea6ff' : '#ff9800', width: 1});
    }
    fblSezioniDraw = {};
    fblCronoSezioni = true;
    const t0 = performance.now();
    for(let i = 0; i < 20; i++)draw();
    const totale = (performance.now() - t0) / 20;
    fblCronoSezioni = false;
    const sezioni = {};
    for(const k of Object.keys(fblSezioniDraw))sezioni[k] = fblSezioniDraw[k] / 20;
    return {totale, sezioni, disegni: drawings.length};
  });

  const stampa = (titolo, m) => {
    const righe = Object.keys(m.sezioni).map(k => [k, m.sezioni[k]]).sort((x, y) => y[1] - x[1]);
    console.log('\n=== ' + titolo + ' ===');
    console.log('disegno medio: ' + m.totale.toFixed(2) + ' ms   (somma sezioni: ' +
      righe.reduce((s, x) => s + x[1], 0).toFixed(2) + ' ms)');
    for(const [k, v] of righe) console.log('  ' + k.padEnd(24) + v.toFixed(3) + ' ms');
  };
  stampa('candele da sole (BTC, banco di prova)', base);
  stampa('con ' + carico.disegni + ' disegni dell\'utente', carico);
  if(errori.length) console.log('\nerrori di pagina: ' + errori.join(' | '));
} finally {
  await browser.close();
}
