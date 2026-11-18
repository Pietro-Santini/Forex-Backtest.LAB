// TOGLIERE UN INDICATORE DAL GRAFICO AZZERA IL SUO «ULTIMO SETTAGGIO».
//
// SEGNALATO dal proprietario (18 novembre 2026): «quando vado a modificare un indicatore e non lo
// salvo, poi vado ad eliminarlo dal grafico e poi aggiungo di nuovo lo stesso indicatore, mi
// rimette i valori dell'ultima modifica che ho fatto. Invece no: deve rimettere sempre i valori
// di default. Soprattutto con il nuovo indicatore valid boss pullback.»
//
// ATTENZIONE, PERCHE' QUESTA RICHIESTA NE CONTRADDICE UNA SUA PRECEDENTE, ed e' scritta nel
// codice (13 novembre 2026): «un indicatore aggiunto dopo deve ricordare l'ultimo settaggio
// usato, non ripartire dal predefinito: si deve ricordare quando l'ho modificato sulle pagine
// duplicate, cosi' mi trasporta il setup che avevo fatto prima».
//
// LE DUE RICHIESTE SI CONCILIANO SU UN GESTO: **l'eliminazione dal grafico**. Finche' l'indicatore
// resta, l'ultimo settaggio si ricorda e viaggia fra le finestre (13 novembre). Quando lo si
// TOGLIE, si butta anche la memoria di quel tipo: togliere e' il gesto con cui si dice «non mi
// serve piu' cosi'», e riaggiungerlo e' ricominciare (18 novembre). I setup SALVATI col nome non
// si toccano mai: quelli sono scelte battezzate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PULISCI = (key) => `(() => {
  activeIndicators.length = 0;
  try{ localStorage.removeItem('fbtUltimiParam_v1_' + ${JSON.stringify(key)}); }catch(e){}
  try{ localStorage.removeItem('fbtPresets_v1_' + ${JSON.stringify(key)}); }catch(e){}
  return true;
})()`;

// Il primo parametro numerico dell'indicatore: si modifica quello, qualunque indicatore sia.
const PRIMO_NUMERO = (p) => Object.keys(p).find(k => typeof p[k] === 'number');

test('tolto dal grafico e rimesso, un indicatore riparte dai valori predefiniti', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const key = Object.keys(INDICATOR_DEFS).find(k => Object.values(INDICATOR_DEFS[k].defaultParams()).some(v => typeof v === 'number'));
      activeIndicators.length = 0;
      try{ localStorage.removeItem('fbtUltimiParam_v1_' + key); }catch(e){}
      addIndicator(key);
      const ind = activeIndicators[0];
      const campo = Object.keys(ind.params).find(k => typeof ind.params[k] === 'number');
      const predefinito = INDICATOR_DEFS[key].defaultParams()[campo];
      // si modifica senza salvare nessun setup, come fa il proprietario dal pannello
      ind.params[campo] = predefinito + 7;
      fblRicordaParamIndicatore(key, ind.params);
      // ... e poi lo si toglie dal grafico
      removeIndicator(ind.id);
      // ... e lo si rimette
      addIndicator(key);
      return {key, campo, predefinito, dopo: activeIndicators[0].params[campo]};
    });
    assert.equal(r.dopo, r.predefinito,
      'rimesso a grafico deve avere il valore predefinito (' + r.predefinito + '), non quello della '
      + 'modifica buttata via: ha ' + r.dopo + ' (indicatore ' + r.key + ', campo ' + r.campo + ')');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('GUARDIA: finche NON lo togli, l ultimo settaggio si ricorda (richiesta del 13 novembre)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const key = Object.keys(INDICATOR_DEFS).find(k => Object.values(INDICATOR_DEFS[k].defaultParams()).some(v => typeof v === 'number'));
      activeIndicators.length = 0;
      try{ localStorage.removeItem('fbtUltimiParam_v1_' + key); }catch(e){}
      addIndicator(key);
      const ind = activeIndicators[0];
      const campo = Object.keys(ind.params).find(k => typeof ind.params[k] === 'number');
      const predefinito = INDICATOR_DEFS[key].defaultParams()[campo];
      ind.params[campo] = predefinito + 7;
      fblRicordaParamIndicatore(key, ind.params);
      // il primo RESTA a grafico, se ne aggiunge un secondo dello stesso tipo
      addIndicator(key);
      return {campo, predefinito, secondo: activeIndicators[1].params[campo]};
    });
    assert.equal(r.secondo, r.predefinito + 7,
      'col primo ancora a grafico, il secondo deve nascere con l\'ultimo settaggio usato: ha ' + r.secondo);
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('GUARDIA: togliere un indicatore non cancella i setup SALVATI col nome', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const key = Object.keys(INDICATOR_DEFS)[0];
      activeIndicators.length = 0;
      try{ localStorage.removeItem('fbtPresets_v1_' + key); }catch(e){}
      addIndicator(key);
      const ind = activeIndicators[0];
      window.appPrompt = async () => 'IL MIO SETUP';
      await savePresetForIndicator(ind);
      removeIndicator(ind.id);
      return Object.keys(loadIndicatorPresets(key));
    });
    assert.deepEqual(r, ['IL MIO SETUP'],
      'i setup battezzati dall\'utente non si toccano mai: ' + JSON.stringify(r));
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});
