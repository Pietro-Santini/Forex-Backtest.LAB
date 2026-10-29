// LA RESA TOTALE SI APRE DAI DUE POSTI CHE IL PROPRIETARIO HA CHIESTO.
//
// RICHIESTO: raggiungibile dalla DASHBOARD DELLE STATISTICHE e da IMPOSTAZIONI ->
// Collegamento e modalita' -> SALE SEGNALI.
//
// Era finita nel pannello «Prop Firm», che non e' nessuno dei due: una funzione che esiste ma
// che non si trova dove la si cerca, per chi la usa non esiste.
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

// Un comando "apre la resa totale" se il suo onclick/id la richiama.
const TROVA = `function trova(radice){
  if(!radice) return false;
  return Array.from(radice.querySelectorAll('button')).some(b =>
    /fblResaTotaleSaleApri/.test(b.getAttribute('onclick')||'') ||
    /resaTotale/i.test(b.id||''));
}`;

test('si apre dal pannello SALE SEGNALI delle impostazioni', async () => {
  const r = await nellApp(`(function(){
    ${TROVA}
    return trova(document.querySelector('[data-gensettings-panel="sale"]'));
  })()`);
  assert.equal(r, true, 'il pannello «Sale segnali» deve avere il comando');
});

test('si apre dalla DASHBOARD DELLE STATISTICHE', async () => {
  const r = await nellApp(`(function(){
    ${TROVA}
    return trova(document.getElementById('fblStatOverlay'));
  })()`);
  assert.equal(r, true, 'la dashboard delle statistiche deve avere il comando');
});

test('PROVA DI CONTROLLO: premerlo apre davvero il riquadro', async () => {
  // Senza questa prova i test sopra passerebbero anche con due pulsanti morti messi li' per
  // far contento il collaudo.
  const r = await nellApp(`(function(){
    ${TROVA}
    const sale=document.querySelector('[data-gensettings-panel="sale"]');
    const b=Array.from(sale.querySelectorAll('button')).find(x =>
      /fblResaTotaleSaleApri/.test(x.getAttribute('onclick')||'') || /resaTotale/i.test(x.id||''));
    b.click();
    const ov=document.getElementById('fblResaTotaleSaleOverlay');
    return !!(ov && ov.style.display !== 'none');
  })()`);
  assert.equal(r, true, 'il riquadro della resa totale deve comparire');
});
