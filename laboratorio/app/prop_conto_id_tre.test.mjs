// I TRE CONTI DISTINTI: mt5, storico, simulato. E in replay vale sempre lo storico,
// anche con MT5 collegato. Vedi cervello/CONSEGNA-OPENCODE-28-OTTOBRE.md voce A.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

async function nellApp(codice){
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(codice);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    return r;
  } finally { await browser.close(); }
}

test('con MT5 collegato e fuori dal replay: conto mt5:<login>@<server>', async () => {
  const r = await nellApp(`(function(){
    liveModeActive = true; liveReplayActive = false;
    mt5ContoAttivo = {login:'5057460278', server:'MetaQuotes-Demo'};
    const id = fblPropContoId();
    mt5ContoAttivo = null;
    return id;
  })()`);
  assert.equal(r, 'mt5:5057460278@MetaQuotes-Demo');
});

test('in modalita\' storico: conto storico', async () => {
  const r = await nellApp(`(function(){
    liveModeActive = false; liveReplayActive = false;
    mt5ContoAttivo = {login:'5057460278', server:'MetaQuotes-Demo'};
    const id = fblPropContoId();
    return id;
  })()`);
  assert.equal(r, 'storico');
});

test('in replay live: conto storico anche con MT5 collegato', async () => {
  const r = await nellApp(`(function(){
    liveModeActive = true; liveReplayActive = true;
    mt5ContoAttivo = {login:'5057460278', server:'MetaQuotes-Demo'};
    const id = fblPropContoId();
    return id;
  })()`);
  assert.equal(r, 'storico');
});

test('PROVA DI CONTROLLO: live senza MT5: conto simulato', async () => {
  const r = await nellApp(`(function(){
    liveModeActive = true; liveReplayActive = false;
    mt5ContoAttivo = null;
    const id = fblPropContoId();
    return id;
  })()`);
  assert.equal(r, 'simulato');
});