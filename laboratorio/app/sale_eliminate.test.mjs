// LE SALE ELIMINATE NON RESTANO PER SEMPRE NELLA DASHBOARD DEI WIN RATE.
//
// Richiesta del proprietario: le sale eliminate vanno via dalla cronologia e dalla dashboard
// «Sale segnali: win rate totale e per livello di TP»; tutte le altre viste restano come sono.
//
// IL DIFETTO MISURATO: gli esiti della cronologia si salvano in fbl_crono_esiti NON vengono
// cancellati quando la sala si toglie dal ponte: la card continuava a mostrare le chip (e le
// righe) delle sale ormai eliminate, con i conti di prima.
//
// LA CURA (nella card): si filtra l'elenco con tgSaleTutte() (sale Telegram del ponte + utenti
// Syntra), SOLO quando la lista si sa (non vuota). Se il ponte e' spento e la lista e' vuota
// non si puo' dire niente di certo: si mostra tutto come prima, i numeri non spariscono solo
// perche' stasera il ponte e' offline. PROVA DI CONTROLLO: qui sotto il secondo test fissa
// proprio il caso «pontee off, lista vuota» — che una cura sbagliata (filtrare comunque)
// spezzerebbe.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const ESITI = () => JSON.stringify({
  'Sala Viva': {XAUUSD: {n: 30, valutati: 28, vinti: 17, wr: 60.7, tp: [{liv: 1, tot: 28, hit: 15}], at: 1729000000000}},
  'Sala Morta': {XAUUSD: {n: 12, valutati: 12, vinti: 9, wr: 75, tp: [{liv: 1, tot: 12, hit: 9}], at: 1729000000000}}
});

const leggiCard = () => {
  const h4 = [...document.querySelectorAll('h4')].find(x => x.textContent.includes('Sale segnali: win rate'));
  if (!h4) return {card: null};
  const card = h4.closest('.fsCard') || h4.closest('[class*=fs]')?.parentElement?.parentElement || h4.closest('div').parentElement;
  const box = card.querySelector('.fsSaleBox');
  const chips = box ? [...box.querySelectorAll('.fsChip')].map(b => b.textContent) : [];
  const testo = card.textContent;
  return {card: !!h4, chips, morta: testo.includes('Sala Morta'), viva: testo.includes('Sala Viva')};
};

test('sala eliminata (ponte attivo, lista nota) sparisce da chip e tabella della card', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate((esiti) => {
      localStorage.setItem('fbl_crono_esiti', esiti);
      tgGruppi = ['Sala Viva'];
      tgGruppiSyntra = [];
    }, ESITI());
    await pagina.evaluate(() => { fblStatApri(); });
    await pagina.waitForFunction(leggiCard, {timeout: 15000});
    const r = await pagina.evaluate(leggiCard);
    assert.ok(r.card, 'la card win rate sale deve esistere: ' + JSON.stringify(r));
    assert.ok(r.viva, 'la sala ancora configurata resta: ' + JSON.stringify(r));
    assert.ok(r.chips.length === 1 && r.chips[0] === 'Sala Viva', 'una sola chip, della sala viva: ' + JSON.stringify(r));
    assert.ok(!r.morta, 'la sala eliminate non compare nella card: ' + JSON.stringify(r));
    assert.equal(errori.length, 0, 'errori console: ' + errori.join(' | '));
  } finally { await browser.close(); }
});

test('CON PROVA DI CONTROLLO: ponte spento (lista vuota) — i numeri NON spariscono', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate((esiti) => {
      localStorage.setItem('fbl_crono_esiti', esiti);
      tgGruppi = [];          // la lista delle sale configurate non si puo' sapere
      tgGruppiSyntra = [];
    }, ESITI());
    await pagina.evaluate(() => { fblStatApri(); });
    await pagina.waitForFunction(leggiCard, {timeout: 15000});
    const r = await pagina.evaluate(leggiCard);
    assert.ok(r.viva && r.morta, 'con la lista non nota si mostra tutto come prima (non si cancellano numeri a osso): ' + JSON.stringify(r));
    assert.ok(r.chips.length === 2, 'entrambe le chip restano quando non si puo' + '\'' + ' distinguere: ' + JSON.stringify(r));
    assert.equal(errori.length, 0, 'errori console: ' + errori.join(' | '));
  } finally { await browser.close(); }
});
