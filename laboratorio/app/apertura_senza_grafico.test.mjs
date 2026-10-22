// UN SEGNALE SU UN ALTRO ASSET NON DEVE ASPETTARE IL GRAFICO.
//
// CHIESTO dal proprietario: «quando arriva un nuovo segnale su un asset diverso da quello
// visualizzato, prima di caricare il grafico la cosa primaria deve essere il prezzo con cui si
// trova al momento quell'asset. Almeno cosi' apre subito la posizione, senza perdere tempo a far
// caricare tutto il grafico... sennò sono quei secondi, magari anche un minuto, che ci fanno
// perdere l'apertura precisa».
//
// COSA C'ERA GIA', verificato prima di scrivere: l'apertura senza grafico esiste ed e' la strada
// principale (tgAutoApriQui), con tanto di commento «un segnale non aspetta che il grafico abbia
// finito di caricare quello precedente».
//
// DOVE SI FERMAVA: davanti a tgMetaNota(). Se decimali e dimensione del contratto di
// quell'asset non erano ancora noti - cioe' PROPRIO quando il segnale arriva su uno strumento
// che non si stava guardando, che e' il caso della richiesta - si ricadeva su tgPortaAGrafico,
// che carica il grafico e aspetta fino a 15 secondi (60 tentativi da 250 ms).
//
// IL CONTROLLO ERA GIUSTO, SBAGLIATO ERA IL MODO DI PROCURARSI I NUMERI: senza dimensione del
// contratto il lotto si calcolerebbe con quella di EUR/USD, e si aprirebbe una posizione di
// taglia sbagliata su soldi veri. Ora quei numeri si chiedono a mt5_feed_server (/symbol-check),
// che li legge da MT5 in una richiesta sola invece di scaricare uno storico intero.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

test('i dati del simbolo si imparano dal ponte, senza caricare il grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const chiamate = [];
      resolveMt5SymbolForAsset = async (s) => s;
      window.fetch = async (u) => {
        chiamate.push(String(u));
        return new Response(JSON.stringify({found: true, resolved_symbol: 'XYZ', digits: 3,
                                            point: 0.001, contract_size: 50, volume_min: 0.1}),
                            {status: 200});
      };
      delete assetAutoMeta['XYZ'];
      const prima = tgMetaNota('XYZ');
      const ok = await tgImparaMetaDalPonte('XYZ');
      return {prima, ok, dopo: tgMetaNota('XYZ'), meta: assetAutoMeta['XYZ'], chiamate};
    });
    assert.equal(r.prima, false, 'si parte da un asset mai visto');
    assert.equal(r.ok, true, 'il ponte deve bastare');
    assert.equal(r.dopo, true, 'e da li\' in poi l\'asset risulta conosciuto');
    assert.equal(r.meta.decimals, 3);
    assert.equal(r.meta.contractSize, 50, 'la dimensione del contratto e\' il numero che evita '
      + 'di calcolare il lotto con quello di EUR/USD');
    assert.ok(r.chiamate.some(u => /symbol-check/.test(u)), 'si chiede a /symbol-check: ' + JSON.stringify(r.chiamate));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se il ponte non da\' la dimensione del contratto, NON si procede', async () => {
  // LA PROVA DI CONTROLLO, ed e' la piu' importante del file. I decimali da soli farebbero passare
  // il controllo lasciando la dimensione del contratto sbagliata: cioe' esattamente il danno che
  // il controllo doveva evitare. Meglio aspettare il grafico che aprire con il contratto sbagliato.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      resolveMt5SymbolForAsset = async (s) => s;
      const esiti = {};
      const prova = async (nome, corpo) => {
        delete assetAutoMeta['ZZZ'];
        window.fetch = async () => new Response(JSON.stringify(corpo), {status: 200});
        esiti[nome] = {ok: await tgImparaMetaDalPonte('ZZZ'), noto: tgMetaNota('ZZZ')};
      };
      await prova('senzaContratto', {found: true, digits: 3, point: 0.001});
      await prova('contrattoZero', {found: true, digits: 3, contract_size: 0});
      await prova('senzaDecimali', {found: true, contract_size: 100});
      await prova('nonTrovato', {found: false});
      return esiti;
    });
    Object.entries(r).forEach(([nome, e]) => {
      assert.equal(e.ok, false, nome + ': non deve dichiarare di avercela fatta');
      assert.equal(e.noto, false, nome + ': e l\'asset NON deve risultare conosciuto, altrimenti '
        + 'la strada veloce partirebbe con i numeri sbagliati');
    });
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il ponte irraggiungibile non fa saltare niente: si torna alla strada col grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      resolveMt5SymbolForAsset = async (s) => s;
      window.fetch = async () => { throw new Error('rete assente'); };
      delete assetAutoMeta['QQQ'];
      return {ok: await tgImparaMetaDalPonte('QQQ'), noto: tgMetaNota('QQQ')};
    });
    assert.equal(r.ok, false);
    assert.equal(r.noto, false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un asset gia\' conosciuto non fa nessuna richiesta', async () => {
  // Il caso di tutti i giorni: non si deve pagare una richiesta in piu' per un asset che si sta
  // gia' guardando.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const chiamate = [];
      window.fetch = async (u) => { chiamate.push(String(u)); return new Response('{}', {status: 200}); };
      recordAssetAutoMeta('NOTO', {decimals: 5, contractSize: 100000, locked: true}, 'prova');
      const ok = await tgImparaMetaDalPonte('NOTO');
      return {ok, chiamate};
    });
    assert.equal(r.ok, true, 'risulta gia\' conosciuto');
    assert.deepEqual(r.chiamate, [], 'e non si chiede niente a nessuno');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il ponte manda davvero la dimensione del contratto', () => {
  // Il legame fra l'app e il ponte: senza questo campo nel ponte, tutto il resto non serve - e la
  // mancanza non si vedrebbe, perche' l'app si limiterebbe a tornare alla strada lenta.
  const src = fs.readFileSync(path.join(RADICE, 'installer_build', 'build', 'mt5_feed_server.py'), 'utf8');
  const i = src.indexOf('def symbol_check');
  assert.ok(i > 0, 'la rotta deve esistere');
  const f = src.slice(i, i + 1600);
  assert.match(f, /"contract_size":/, '/symbol-check deve restituire la dimensione del contratto');
  assert.match(f, /trade_contract_size/, 'presa da MT5, non inventata');
});
