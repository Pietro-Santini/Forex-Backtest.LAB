// Le barre dei grafici orizzontali non devono finire sopra ai nomi.
//
// SEGNALATO dal proprietario (7 ottobre 2026): «nella casella profitto per strategia la barra
// rossa o la barra verde viene disegnata sopra a tutta la strategia; stessa cosa per profitto per
// sala e per asset».
//
// Causa vera: le barre negative venivano disegnate normali e poi ribaltate con un transform SVG
// (`translate(...) scale(-1,1)`). Ma l'animazione CSS `fsGrowX` scrive anch'essa sul transform e
// lo sostituisce: finita l'animazione la barra perdeva spostamento e ribaltamento e ricompariva
// nell'angolo in alto a sinistra, sopra il nome della prima riga. Si vede solo con valori negativi
// e con la carta stretta — per questo era sfuggito.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Operazioni con P/L di segno alterno: servono barre rosse, altrimenti il bug non si manifesta.
const PREPARA = () => {
  const nomi = ['Breakout di Londra con conferma volumetrica', 'Scalping serale',
                'Ritracciamento Fibonacci 61.8', 'Manuale'];
  trades = [];
  for (let i = 0; i < 40; i++) {
    const pl = (i % 2 === 0 ? -1 : 1) * (50 + (i * 37) % 400);
    trades.push({id: i, asset: 'OANDA:XAUUSD', side: i % 2 ? 'BUY' : 'SELL', entry: 100, exit: 101,
      pl, pct: pl / 100, pips: pl / 10, result: pl >= 0 ? 'TP' : 'SL', account: 'mt5', mode: 'live',
      closedAt: new Date(Date.now() - i * 86400000).toISOString(),
      startTime: Date.now() - i * 86400000 - 3600000,
      strategy: nomi[i % nomi.length], tgSala: 'Telegram · Gold Signals VIP', lots: 0.1});
  }
  fblStatApri();
};

// Carta stretta: è la condizione in cui il difetto si vedeva.
async function apriStatistiche() {
  const amb = await apriApp({larghezza: 430, altezza: 1100});
  await amb.pagina.evaluate((p) => eval('(' + p + ')')(), PREPARA.toString());
  await amb.pagina.waitForTimeout(2500);   // le animazioni devono essere FINITE: è lì che sbagliava
  return amb;
}

test('nessuna barra finisce sopra al nome della sua riga', async () => {
  const {browser, pagina, errori} = await apriStatistiche();
  try{
    const sovrapposte = await pagina.evaluate(() => {
      const fuori = [];
      document.querySelectorAll('#fblStatOverlay .fsCard').forEach(card => {
        const titolo = (card.querySelector('h4')?.textContent || '').slice(0, 40);
        const testi = [...card.querySelectorAll('svg text')].filter(t => !t.classList.contains('num'));
        const barre = [...card.querySelectorAll('svg path.gh')];
        if (!barre.length || !testi.length) return;
        barre.forEach(b => {
          const rb = b.getBoundingClientRect();
          testi.forEach(t => {
            const rt = t.getBoundingClientRect();
            if (!rt.width || !rb.width) return;
            const sovrapposizione = Math.min(rb.right, rt.right) - Math.max(rb.left, rt.left);
            const stessaRiga = Math.min(rb.bottom, rt.bottom) - Math.max(rb.top, rt.top);
            // Due pixel di tolleranza: i bordi arrotondati possono sfiorare.
            if (sovrapposizione > 2 && stessaRiga > 2) {
              fuori.push({carta: titolo, nome: t.textContent, px: Math.round(sovrapposizione)});
            }
          });
        });
      });
      return fuori;
    });
    assert.deepEqual(sovrapposte, [],
      'una barra copre un nome: ' + JSON.stringify(sovrapposte));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le barre non usano transform: l\'animazione lo sovrascriverebbe', async () => {
  const {browser, pagina, errori} = await apriStatistiche();
  try{
    const conTransform = await pagina.evaluate(() =>
      [...document.querySelectorAll('#fblStatOverlay svg path.gh')]
        .filter(p => p.hasAttribute('transform'))
        .map(p => p.getAttribute('transform')));
    // È la causa vera del difetto: se qualcuno rimette un transform qui, torna tutto.
    assert.deepEqual(conTransform, []);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le barre negative stanno a sinistra dello zero, quelle positive a destra', async () => {
  const {browser, pagina, errori} = await apriStatistiche();
  try{
    const r = await pagina.evaluate(() => {
      const carta = [...document.querySelectorAll('#fblStatOverlay .fsCard')]
        .find(c => /Profitto per strategia/.test(c.querySelector('h4')?.textContent || ''));
      if (!carta) return null;
      const zero = carta.querySelector('svg line.axis0');
      if (!zero) return {senzaZero: true};
      const xz = zero.getBoundingClientRect().left;
      const barre = [...carta.querySelectorAll('svg path.gh')].map(b => {
        const rb = b.getBoundingClientRect();
        return {rosso: /2[0-9a-f]|f[0-9a-f]/.test(b.getAttribute('fill') || '') &&
                       (b.getAttribute('fill') || '').toLowerCase().startsWith('#e'),
                sinistra: Math.round(rb.left), destra: Math.round(rb.right)};
      });
      return {xz: Math.round(xz), barre};
    });
    assert.ok(r && r.barre && r.barre.length, 'il grafico deve avere delle barre');
    r.barre.forEach(b => {
      // Ogni barra sta tutta da una parte sola della riga dello zero (2 px di tolleranza).
      const tuttaSinistra = b.destra <= r.xz + 2;
      const tuttaDestra = b.sinistra >= r.xz - 2;
      assert.ok(tuttaSinistra || tuttaDestra,
        'barra a cavallo dello zero: ' + JSON.stringify(b) + ' zero=' + r.xz);
    });
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
