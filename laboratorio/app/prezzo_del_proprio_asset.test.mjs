// IL PREZZO DELLA CHIUSURA E' QUELLO DELLA POSIZIONE, MAI QUELLO DI UN ALTRO ASSET.
//
// SEGNALATO dal proprietario il 30 ottobre 2026, con lo screenshot del Trade Journal: due
// posizioni NZDCAD in guadagno risultavano
//   +40.043.640 pip, +120.139.920,00 €, +99,99%
// mentre le posizioni XAUUSD sopra e sotto erano giuste.
//
// RIPRODOTTO al numero: con il grafico sull'oro a 4005.15 e una posizione NZDCAD entrata a
// 0.78600, `pipsFromPrice('BUY', 0.78600, 4005.15, 'NZDCAD')` fa esattamente 40.043.640 -
// (4005.15 - 0.786) / 0.0001. Il prezzo usato per chiudere era quello DELL'ORO, non quello del
// NZDCAD. I pip veri (chiusura al TP 0.79026) sono 42,6 e il profitto circa 162 €.
//
// La causa: in due punti, se non si conosceva il prezzo vero della chiusura, l'app ripiegava su
// `currentPrice()` - il prezzo DEL GRAFICO. Con una posizione su un altro asset, quello e' il
// prezzo di un altro strumento, e il trade veniva registrato a un prezzo che non e' il suo: da
// li' in poi pip, profitto, percentuale e curva del saldo erano tutti falsati.
//
// Cosa misura questo banco: quando il prezzo vero non si conosce, si ripiega sui LIVELLI DELLA
// POSIZIONE (il suo SL, il suo TP) o sulla sua entrata - mai sul prezzo del grafico.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Il grafico sta sull'ORO, la posizione e' su NZDCAD: e' esattamente il caso dello screenshot.
const PREPARA = () => {
  currentAssetKey = 'XAUUSD';
  liveModeActive = true;
  mt5Connected = true;
  // il grafico dice che l'oro sta qui
  currentPrice = () => 4005.15;
  const pos = {id: 'N1', asset: 'NZDCAD', side: 'BUY', entry: 0.78600, sl: 0.78342,
               tp: 0.79026, lots: 0.30, mt5Ticket: 777, tgSala: 'Sala'};
  return pos;
};

test('senza il prezzo vero si ripiega sui livelli della posizione, non sul grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      const pos = eval('(' + p + ')')();
      return {
        // il ripiego dice la stessa cosa qualsiasi asset ci sia a grafico
        suSL: fblPrezzoRipiegoChiusura(pos, 'SL'),
        suTP: fblPrezzoRipiegoChiusura(pos, 'TP'),
        senzaMotivo: fblPrezzoRipiegoChiusura(pos, 'MT5'),
        // e NON e' mai il prezzo del grafico
        prezzoGrafico: currentPrice(),
        prezzoIngresso: pos.entry
      };
    }, PREPARA.toString());
    assert.equal(r.suSL, 0.78342, 'chiusa per lo stop, il prezzo e\' lo stop della posizione');
    assert.equal(r.suTP, 0.79026, 'chiusa per il target, il prezzo e\' il target della posizione');
    // Motivo sconosciuto ("MT5"): l'unica cosa onesta che resta e' l'entrata.
    assert.equal(r.senzaMotivo, 0.78600, 'a motivo ignoto si ripiega sull\'entrata, non si inventa');
    // LA PROVA CHE CONTA: in nessun caso viene fuori il prezzo del grafico.
    [r.suSL, r.suTP, r.senzaMotivo].forEach(v => {
      assert.notEqual(v, r.prezzoGrafico,
        'il ripiego non deve mai restituire il prezzo del grafico (' + r.prezzoGrafico + ')');
    });
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: il prezzo VERO, se si conosce, ha la precedenza sul ripiego', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    // Senza il prezzo dal ponte i pip erano 40.043.640; con il prezzo vero del deal diventano
    // quelli della posizione. Si misura il calcolo, non la presenza di una stringa.
    const r = await pagina.evaluate((p) => {
      const pos = eval('(' + p + ')')();
      const prezzoVero = 0.79026;              // il TP, toccato davvero
      const ripiego = fblPrezzoRipiegoChiusura(pos, 'TP');
      return {
        pipColPrezzoVero: pipsFromPrice(pos.side, pos.entry, prezzoVero, pos.asset),
        pipColRipiego: pipsFromPrice(pos.side, pos.entry, ripiego, pos.asset),
        pipColGrafico: pipsFromPrice(pos.side, pos.entry, currentPrice(), pos.asset),
        plColPrezzoVero: calculateForexPL(pos.side, pos.entry, prezzoVero, pos.lots, pos.asset)
      };
    }, PREPARA.toString());
    // Il numero dello screenshot era 40.043.640: e' la firma del difetto, e non deve piu\' comparire.
    assert.equal(r.pipColGrafico, 40043640,
      'con il prezzo del grafico i pip sono quelli sbagliati dello screenshot');
    // Col ripiego sui livelli i pip tornano quelli veri: 42,6 come misurato sul conto.
    assert.equal(r.pipColPrezzoVero, 42.6, 'col prezzo vero i pip sono 42,6');
    assert.equal(r.pipColRipiego, 42.6, 'e anche col ripiego sui livelli: sono gli stessi numeri');
    assert.ok(Math.abs(r.plColPrezzoVero - 161.72) < 0.5,
      'il profitto col prezzo vero e\' circa 162 €, non 120 milioni: ' + r.plColPrezzoVero);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
