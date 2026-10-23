// LA TABELLA MT5 MOSTRA ANCHE LEI LA STRISCIA DI VICINANZA.
//
// Richiesta del proprietario: «le strisce di vicinanza nella tabella MT5» — le stesse che già
// esistono nella tabella "Posizioni" (ultima colonna a destra: verde = vicino al take profit,
// rosso = vicino allo stop, blu = vicino allo stop a profitto).
//
// IL DIFETTO MISURATO: l'intestazione della tabella MT5 aveva GIÀ la colonna della striscia
// (th class="fblStrisciaCella"), ma le righe (mt5RowsHtml) non aggiungevano la corrispondente
// cella: tabella con intestazione "sorda" e righe senz'aria più corte dell'header.
//
// La cura: la riga MT5 aggiunge fblStrisciaCellaHtml(...) usando i dati della riga stessa
// (entry = price_open, prezzo = price_current), quindi striscia e numeri raccontano lo stesso
// istante. PROVA DI CONTROLLO: la struttura verifica che l'ultima cella della riga SIA la
// cella-striscia e che il numero delle celle faccia match con l'intestazione — senza la cura
// la riga resta a 15 celle contro 16 th e il test è rosso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('la riga MT5 porta la striscia: verde vicino al target, vuota se lontana, spenta se disattive', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const res = {};
      // Locale attivo (default) + soglia spalancata al 50% per rendere indiscutibile la vicinanza.
      try{ $('fblStriscePct') && ($('fblStriscePct').value = '50'); }catch(e){}
      res.soglia = fblStriscePosPct();
      mt5RealPositions = [POS()];   // vicino al take profit
      update();
      const tr = $('mt5OpenPositions').querySelector('tr');
      const th = $('mt5OpenPositions').closest('table').querySelector('thead tr').children.length;
      res.celle = tr.children.length;
      res.testata = th;
      const ultima = tr.children[tr.children.length - 1];
      res.ultimaClasse = ultima.className;
      res.verde = !!ultima.querySelector('.fblStriscia') && ultima.title.includes('take profit');
      // Lontana: prezzo lontano da entrambi i livelli → cella presente ma bianca
      mt5RealPositions = [Object.assign(POS(), {price_current: 100})];
      update();
      const tr2 = $('mt5OpenPositions').querySelector('tr');
      const ultima2 = tr2.children[tr2.children.length - 1];
      res.lontana = (ultima2.className === 'fblStrisciaCella' && !ultima2.querySelector('.fblStriscia'));
      // Disattive: con la spunta delle strisce tolta, nessuna riga deve più portare una striscia
      // accesa (le celle vuote restano, per non sbrodare la struttura delle colonne).
      try{
        if($('fblStriscePos'))$('fblStriscePos').checked = false;
        else localStorage.setItem('fbl_strisce_pos','0');
      }catch(e){}
      mt5RealPositions = [POS()];
      update();
      res.spenta = !$('mt5OpenPositions').querySelector('.fblStriscia');
      function POS(){ return {
        ticket: 777, symbol: 'EURUSD', side: 'BUY',
        price_open: 100, sl: 95, tp: 105,
        price_current: 104.9,
        profit: 12, swap: 0, commission: 0,
        volume: 0.01, time: 1729600000000
      }; }
      return res;
    });
    assert.ok(r.celle === r.testata, 'le celle della riga (' + r.celle + ') devono stare come le colonne del titolo (' + r.testata + '): ' + JSON.stringify(r));
    assert.equal(r.ultimaClasse, 'fblStrisciaCella', 'l\'ultima cella della riga MT5 e\' la cella-striscia: ' + JSON.stringify(r));
    assert.ok(r.verde, 'vicino al take profit → striscia verde col titolo giusto: ' + JSON.stringify(r));
    assert.ok(r.lontana, 'lontano dai livelli → striscia spenta ma cella presente: ' + JSON.stringify(r));
    assert.ok(r.spenta, 'strisce disattive → nessuna striscia accesa in tabella MT5: ' + JSON.stringify(r));
    assert.equal(errori.length, 0, 'errori console: ' + errori.join(' | '));
  } finally { await browser.close(); }
});
