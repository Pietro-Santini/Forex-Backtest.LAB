// MISURA DEL DIFETTO: «premo aggiorna e fa solo refresh; al secondo click installa».
//
// fblPianoAggiornamento(versionePubblicata) accetta la versione pubblicata, ma NESSUNA
// chiamata (app.html righe 57622, 57697, 58150) gliela passa: e' sempre undefined.
// Perciò il confronto "eseguibile vs PACCHETTO PUBBLICATO" (riga 57518) non parte mai, e la
// decisione cade su `da_aggiornare` del ponte, che confronta l'eseguibile con la PAGINA SUL
// DISCO (bridge.py /versione-programma, riga 1654: _versione_di(_CARTELLA_APP)).
// Finché il ponte non ha riscaricato la nuova pagina sul disco, da_aggiornare=false e l'app
// fa solo refresh: esattamente il «primo click refresh, secondo click installa».
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PIANO = (rispostaVersioneProgramma, rispostaHealth, versionePubblicata) => `(async function(){
  fblPianoAggiornamentoCache = null;
  fblPiattaforma = () => 'windows';
  window.__chiamate = [];
  fetchMt5WithTimeout = async function(percorso){
    window.__chiamate.push(percorso);
    if(percorso.indexOf('/versione-programma')===0) return ${JSON.stringify(rispostaVersioneProgramma)};
    if(percorso.indexOf('/health')===0)            return ${JSON.stringify(rispostaHealth)};
    return {ok:false};
  };
  const piano = await fblPianoAggiornamento(${versionePubblicata === undefined ? 'undefined' : JSON.stringify(versionePubblicata)});
  return {piano, chiamate: window.__chiamate};
})()`;

test('SENZA versione pubblicata: ponte allineato (eseguibile == pagina sul disco == 2.0.37) -> solo refresh (IL DIFETTO)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PIANO(
      {ok:true, data:{programma:'2.0.37', pagina:'2.0.37', da_aggiornare:false}},
      {ok:true, data:{app:{versione:'2.0.37', da:'copia installata'}}},
      undefined
    ));
    assert.equal(r.piano.serve, false,
      'senza versione pubblicata il piano dice serve:false: solo refresh anche se la pubblicata è 2.0.38');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CON versione pubblicata 2.0.38: stesso ponte -> pacchetto serve e si installa da solo (COMPORTAMENTO CORRETTO)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PIANO(
      {ok:true, data:{programma:'2.0.37', pagina:'2.0.37', da_aggiornare:false}},
      {ok:true, data:{app:{versione:'2.0.37', da:'copia installata'}}},
      '2.0.38'
    ));
    assert.equal(r.piano.serve, true,
      'con la versione pubblicata il pacchetto serve anche se il disco è ancora allineato');
    assert.equal(r.piano.automatico, true,
      'e il ponte può installarlo da solo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
