// QUANDO IL PONTE LOCALE RINASCE, GLI ORDINI DEVONO TORNARE IN LOCALE.
//
// MISURATO sul computer del proprietario, dal suo pannello di diagnosi (5 novembre 2026):
//
//     lettura conto     1552 volte, media 261 ms, peggiore 19.094 ms, 4 non riuscite
//     lettura posizioni 1473 volte, media 243 ms, peggiore 19.103 ms, 4 non riuscite
//     fotogrammiAlSecondo 14
//
// Le stesse rotte, chiamate in locale, rispondono in **2-3 ms** (misurato con curl su
// 127.0.0.1:8000). La differenza è tutta nel giro: l'app stava passando dal server
// (`fblOrdiniVia === 'server'`, cioè /pc/8000) invece che da 127.0.0.1. Con tre chiamate al
// secondo a 261 ms l'una sono quasi otto decimi di secondo di rete per ogni secondo di orologio.
//
// CAUSA. Il controllo periodico riselezionava la strada SOLO quando il ponte locale era morto:
//
//     if (!vivo) await fblScegliStradaOrdini();
//
// All'avvio, se il ponte non è ancora in piedi — e su un computer appena accesso ci mette qualche
// secondo — si sceglie 'server'. Poi il ponte torna vivo, quella condizione è **falsa**, e non si
// riseleziona mai: l'app resta appesa al giro lungo fino alla ricarica della pagina. È anche la
// ragione per cui al proprietario «ricaricare il grafico» sembrava risolvere le cose.
//
// È la stessa famiglia della ricaduta dell'ascolto curata nella v2.0.85: una decisione presa una
// volta all'avvio che non viene mai riconsiderata.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Si misura il COMPORTAMENTO del giro periodico, non la stringa: si finge un ponte locale che
// risponde e si guarda se la strada torna in locale.
const UN_GIRO = (stato) => `(async function(){
  ${stato}
  let indirizziAggiornati = 0;
  fblAggiornaIndirizzi = function(){ indirizziAggiornati++; };
  // SI CHIAMA LA FUNZIONE VERA, quella che il timer chiama ogni trenta secondi. La prima
  // versione di questa prova ricopiava il corpo del timer: un test che duplica il codice non
  // protegge niente - cambi il timer e il test resta verde. Per questo il corpo e' stato
  // estratto in fblStradaOrdiniRicontrolla().
  const esito = await fblStradaOrdiniRicontrolla();
  const vivo = (fblPonteLocaleVivo === true);
  return {vivo, esito, via: fblOrdiniVia, indirizzo: MT5_BRIDGE_URL, indirizziAggiornati};
})()`;

test('col ponte locale vivo, la strada torna in locale anche se era sul giro lungo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.route(u => u.pathname.endsWith('/health'),
      r => r.fulfill({status: 200, contentType: 'application/json', body: '{"status":"ok"}'}));
    const r = await pagina.evaluate(UN_GIRO(`
      // Come si ritrovava il computer del proprietario: strada scelta all'avvio quando il ponte
      // non era ancora su, e mai piu' riconsiderata.
      fblOrdiniVia = 'server';
      MT5_BRIDGE_URL = 'https://pietro.tail83d918.ts.net:8000/pc/8000';
      fblControllaPonteLocale = async function(){ fblPonteLocaleVivo = true; return true; };
    `));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.vivo, true, 'il banco deve presentare un ponte locale vivo');
    assert.equal(r.via, 'locale',
      'con il ponte locale vivo la strada deve tornare in locale, invece: ' + r.via);
    assert.equal(r.indirizzo, 'http://127.0.0.1:8000',
      'e l\'indirizzo degli ordini deve essere quello locale: ' + r.indirizzo);
    assert.equal(r.indirizziAggiornati, 1,
      'il pannello degli indirizzi va riallineato, o continua a mostrare la strada vecchia');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO numero uno: se era GIÀ in locale non si fa niente. Senza questa, il giro
// riscriverebbe l'indirizzo e riallineerebbe il pannello trenta volte al minuto per nulla.
test('PROVA DI CONTROLLO: se era già in locale non si tocca niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(UN_GIRO(`
      fblOrdiniVia = 'locale';
      MT5_BRIDGE_URL = 'http://127.0.0.1:8000';
      fblControllaPonteLocale = async function(){ fblPonteLocaleVivo = true; return true; };
    `));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.via, 'locale');
    assert.equal(r.indirizziAggiornati, 0, 'niente da riallineare: era già sulla strada corta');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO numero due, e difende la ragione per cui quel controllo esiste: se il ponte
// locale è MORTO si deve riselezionare la strada, non restare appesi a un indirizzo che non
// risponde. È il comportamento di prima, e non va perduto curando il resto.
test('PROVA DI CONTROLLO: col ponte locale morto si riseleziona la strada', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(UN_GIRO(`
      fblOrdiniVia = 'locale';
      MT5_BRIDGE_URL = 'http://127.0.0.1:8000';
      fblControllaPonteLocale = async function(){ fblPonteLocaleVivo = false; return false; };
      let riselezionata = 0;
      fblScegliStradaOrdini = async function(){ riselezionata++; window.__ris = riselezionata; return null; };
    `));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.vivo, false);
    const ris = await pagina.evaluate('window.__ris || 0');
    assert.equal(ris, 1, 'col ponte morto la strada va riselezionata, come prima');
  } finally { await browser.close(); }
});
