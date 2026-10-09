// (B) APERTURA MANUALE SU CAPITAL.COM — barra conti → 💹 Capital.com.
//
// DECISO dal proprietario: nella barra dei conti, accanto a MT5 e Kraken, deve esserci anche
// Capital.com. Con quel conto scelto, i pulsanti BUY/SELL del pannello aprono una posizione
// SIMULATA su Capital.com (azioni, indici che MT5 non ha) e NON mandano NESSUN ordine vero a MT5.
//
// Il cuore del passo: il ramo Capital.com deve stare PRIMA del ramo MT5 di openMarketTrade,
// altrimenti — come già visto col Passo 13 — l'ordine manuale finisce a MT5 con un simbolo che il
// broker non ha (e lo rifiuta). La rete è tutta bloccata dal banco: Capital.com e MT5 vanno FINTI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Prepara l'app col conto Capital.com scelto. `capitaleCollegato` = c'è già un token di sessione;
// `mt5Collegato` = il broker MT5 è connesso (e NON deve ricevere gli ordini manuali).
const PREPARA = (capitaleCollegato, mt5Collegato) => {
  positions = []; pendingOrders = []; trades = [];
  liveModeActive = true;
  mt5Connected = !!mt5Collegato;
  fblContoVista = 'capital';
  liveCredsDraft = {demo: true};
  capitalSessionTokens = capitaleCollegato ? {cst: 'cst-di-prova', securityToken: 'sec-di-prova'} : null;
  ensureCapitalConnected = async () => !!capitalSessionTokens;
  refreshLiveStreamSubscriptions = () => {};
  currentAssetKey = 'AAPL';
  currentPrice = () => 190.5;          // il prezzo arriva dal grafico
  getLotSize = () => 0.1;
  $('sl').value = ''; $('tp').value = '';
  window.__ordiniMt5 = [];
  // Se (sbagliando) si finisse nel ramo MT5, l'ordine vero verrebbe registrato qui.
  placeRealMt5Order = async (side) => { window.__ordiniMt5.push(String(side)); return true; };
};

test('si sceglie 💹 Capital.com: la vista cambia, si salva, pulsante attivo e pallino ●', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(true, false), PREPARA.toString());
    const r = await pagina.evaluate(async () => {
      await fblContoScegli('capital');
      const b = document.querySelector('.fblContoBtn[data-conto="capital"]');
      let salvato = null; try { salvato = localStorage.getItem('fbl_conto_vista'); } catch (e) { salvato = '(bloccato)'; }
      return {
        vista: fblContoVista, salvato,
        esiste: !!b,
        attivo: !!(b && b.classList.contains('active')),
        punto: b ? (b.querySelector('.fblContoPunto') || {}).textContent : null
      };
    });
    assert.equal(r.vista, 'capital', 'la vista deve passare a Capital.com');
    assert.equal(r.salvato, 'capital', 'la scelta del conto deve essere ricordata');
    assert.ok(r.esiste, 'deve esserci il pulsante 💹 Capital.com nella barra conti');
    assert.ok(r.attivo, 'il pulsante Capital.com deve risultare attivo');
    assert.equal(r.punto, '●', 'collegato → pallino pieno');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('BUY manuale col conto Capital.com: posizione SIMULATA, nessun ordine MT5', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(true, true), PREPARA.toString());
    const r = await pagina.evaluate(async () => {
      await openMarketTrade('BUY');
      return {
        ordiniMt5: window.__ordiniMt5.length,
        pos: positions.map(p => ({asset: p.asset, account: p.account, side: p.side, entry: p.entry, sl: p.sl, tp: p.tp}))
      };
    });
    assert.equal(r.ordiniMt5, 0, 'a MT5 non deve arrivare nessun ordine manuale su Capital.com');
    assert.equal(r.pos.length, 1, 'deve nascere UNA posizione simulata');
    assert.equal(r.pos[0].account, 'capital');
    assert.equal(r.pos[0].asset, 'AAPL');
    assert.equal(r.pos[0].side, 'BUY');
    assert.equal(r.pos[0].entry, 190.5);
    assert.ok(Number.isFinite(r.pos[0].sl), 'deve avere uno SL (anteprima)');
    assert.ok(Number.isFinite(r.pos[0].tp), 'deve avere un TP (anteprima)');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('conto Capital.com senza sessione: non apre niente e lo dice nello stato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(false, false), PREPARA.toString());
    const r = await pagina.evaluate(async () => {
      await openMarketTrade('BUY');
      return {pos: positions.length, stato: $('status').textContent};
    });
    assert.equal(r.pos, 0, 'senza connessione non si apre nulla');
    assert.ok(/Capital/i.test(r.stato), 'lo stato deve parlare di Capital.com: ' + r.stato);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('in Live con MT5 collegato, il conto Capital.com dirotta l\'ordine: nessun ordine vero a MT5', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(true, true), PREPARA.toString());
    const r = await pagina.evaluate(async () => {
      await openMarketTrade('SELL');
      return {
        ordiniMt5: window.__ordiniMt5.length,
        account: positions.length ? positions[0].account : null,
        side: positions.length ? positions[0].side : null
      };
    });
    assert.equal(r.ordiniMt5, 0, 'con il conto Capital.com scelto, MT5 non deve ricevere ordini');
    assert.equal(r.account, 'capital');
    assert.equal(r.side, 'SELL');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la posizione manuale di Capital.com è una famiglia a parte nel Trade Journal', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => ({
      capital: fblStatCalcoli.contoDi({account: 'capital', mode: 'live'}),
      live: fblStatCalcoli.contoDi({mode: 'live'})
    }));
    assert.ok(r.capital.indexOf('Capital.com') >= 0, 'famiglia col suo nome: ' + r.capital);
    assert.notEqual(r.capital, r.live, 'Capital.com e «Live» non sono la stessa voce');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
