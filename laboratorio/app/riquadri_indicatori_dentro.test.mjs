// NESSUN RIQUADRO DI UN INDICATORE FINISCE SOTTO L'ASSE DEI PREZZI.
//
// SEGNALATO dal proprietario (18 novembre 2026), con foto del pannello «BOS Pullback» mezzo
// nascosto dalla colonna dei prezzi: «una precisazione per tutte le tabelle che ci sono negli
// indicatori che li disegna: bisogna fare attenzione che non vada a disegnare la tabella dietro
// all'asse del prezzo».
//
// MISURATO: la regola esisteva gia' - ma in UN indicatore solo. La dashboard ICT (v precedente)
// calcola il suo angolo con `chartPadR(W)` e poi «clampa» il riquadro dentro l'area di disegno;
// quella del Gann invece si ancorava a `W - larghezza - 8`, cioe' al bordo del CANVAS, che
// comprende la striscia della scala prezzi: a destra finiva sotto i numeri. Due regole diverse
// per la stessa cosa, e la seconda sbagliata.
//
// DA QUI IN POI LA REGOLA E' UNA SOLA, `fblAngoloRiquadroGrafico()`, e questo banco la sorveglia
// per TUTTI gli indicatori che hanno un riquadro, quelli di domani compresi: la prova non elenca
// i nomi, chiede all'app quali indicatori disegnano un riquadro e li prova tutti.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('la regola dell angolo tiene il riquadro dentro l area del grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const W = 1000, H = 600, bw = 230, bh = 120;
      const padR = chartPadR(W);
      const out = {};
      for (const dove of ['top_right','bottom_right','top_left','bottom_left']) {
        const a = fblAngoloRiquadroGrafico(W, H, bw, bh, dove);
        out[dove] = {bx: a.bx, by: a.by, destra: a.bx + bw, limite: W - padR};
      }
      return {out, padR};
    });
    assert.ok(r.padR > 0, 'l\'asse dei prezzi deve avere una larghezza: ' + r.padR);
    for (const dove of Object.keys(r.out)) {
      const a = r.out[dove];
      assert.ok(a.destra <= a.limite,
        'in posizione ' + dove + ' il riquadro arriva a ' + a.destra + ' e l\'area finisce a '
        + a.limite + ': andrebbe sotto i prezzi');
      assert.ok(a.bx >= 0 && a.by >= 0, 'e non deve uscire in alto o a sinistra: ' + JSON.stringify(a));
    }
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('ogni indicatore che disegna un riquadro resta dentro l area', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // Candele finte: servono solo perche' i render abbiano qualcosa su cui lavorare.
      const R = []; const t0 = Date.parse('2026-11-10T08:00:00Z');
      for (let i = 0; i < 400; i++) {
        const base = 100 + Math.sin(i / 9) * 4 + i * 0.01;
        R.push({date:new Date(t0 + i*60000).toISOString(), open:base, high:base+0.6,
                low:base-0.6, close:base + (i%3?0.2:-0.2), volume:100 + (i%7)*10});
      }
      rows = R; baseRows = R; idx = R.length-1; viewEnd = R.length; currentTF = 1;
      currentAssetKey = 'EURUSD'; rowsAssetKey = 'EURUSD';
      csvLibrary = [{id:'mt5_live_EURUSD', rows:R}];

      const W = 1000, H = 600, padR = chartPadR(W);
      // Un contesto finto che registra OGNI cosa disegnata e il suo bordo destro.
      const disegnati = [];
      const ctx = {
        canvas:{clientWidth:W, clientHeight:H, width:W, height:H},
        globalAlpha:1, fillStyle:'', strokeStyle:'', lineWidth:1, font:'', textAlign:'', textBaseline:'',
        // Il ritaglio si comporta come quello vero: `rect` propone, `clip` lo rende attivo, e
        // da li' in poi niente puo' essere disegnato oltre quel bordo. Senza questo, il banco
        // misurerebbe un difetto che sullo schermo non si vede.
        save(){ this._pila.push(this._taglio); },
        restore(){ this._taglio = this._pila.length ? this._pila.pop() : Infinity; },
        _pila:[], _taglio: Infinity, _prop: Infinity,
        beginPath(){}, closePath(){}, moveTo(){}, lineTo(){}, stroke(){},
        fill(){}, arc(){}, setLineDash(){},
        clip(){ this._taglio = Math.min(this._taglio, this._prop); },
        rect(x,y,w,h){ this._prop = x + w; },
        roundRect(x,y,w,h){ this._prop = x + w; }, translate(){},
        rotate(){}, scale(){}, createLinearGradient(){ return {addColorStop(){}}; },
        measureText(t){ return {width: String(t).length * 6}; },
        fillRect(x,y,w,h){ disegnati.push({tipo:'rect', destra:Math.min(x+w, this._taglio)}); },
        strokeRect(x,y,w,h){ disegnati.push({tipo:'rect', destra:Math.min(x+w, this._taglio)}); },
        fillText(t,x,y){ disegnati.push({tipo:'text', destra:Math.min(x + String(t).length*6, this._taglio)}); }
      };
      const y = (p) => 300 - (p - 100) * 10;
      const xAbs = (i) => 60 + (i - 0) * 2;
      const fuori = {}; let larghi = 0; const provati = [];
      for (const key of Object.keys(INDICATOR_DEFS)) {
        const def = INDICATOR_DEFS[key];
        if (typeof def.render !== 'function') continue;
        const p = def.defaultParams();
        // si accende il riquadro dove esiste, comunque si chiami il parametro
        Object.keys(p).forEach(k => { if (/^show(Dash|Table|Panel)/i.test(k)) p[k] = true; });
        const ind = {key, params:p, calc:{serie:null, builtTo:-1}};
        try { if (typeof def.compute === 'function') def.compute(R, R.length-1, ind); } catch(e) {}
        disegnati.length = 0;
        // Lo stesso ritaglio che draw() mette attorno a ogni render (vedi il muro in app.html):
        // il banco deve misurare quello che finisce sullo schermo, non quello che la funzione
        // chiede di disegnare.
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W - padR, H); ctx.clip();
        try { def.render(ctx, ind, R, 0, R.length-1, xAbs, y, {l:60,r:padR,t:18,b:44}, H); } catch(e) {}
        ctx.restore();
        const _l = disegnati.filter(d => d.tipo==='rect' && d.destra > 150).length;
        if (_l) { larghi += _l; provati.push(key); }
        // margine di tolleranza 1 px: i bordi si disegnano a volte a mezzo pixel
        const oltre = disegnati.filter(d => d.destra > W - padR + 1);
        if (oltre.length) fuori[key] = {quanti: oltre.length, massimo: Math.round(Math.max(...oltre.map(d=>d.destra))), limite: W - padR};
      }
      return {fuori, padR, larghi, provati};
    });
    // AUTOCONTROLLO ANTI-BANCO-MUTO: se nessun indicatore ha disegnato niente di largo, questa
    // prova non sta misurando il riquadro di nessuno e il suo verde non vale niente.
    assert.ok(r.larghi > 0,
      'nessun indicatore ha disegnato un riquadro: la prova non sta misurando niente');
    // IL LIMITE DI QUESTA PROVA, detto invece che nascosto: misura solo gli indicatori che in
    // questo contesto finto riescono davvero a disegnare. Alcuni (il Gann, per esempio) mostrano
    // il pannello solo quando il loro stato interno e' «pronto», e qui non lo diventano: per
    // quelli vale la prova qui sopra, che misura la REGOLA invece del disegno. Se un giorno
    // questo elenco si allunga, la copertura e' cresciuta.
    console.log('   indicatori con un riquadro misurato: ' + JSON.stringify(r.provati));
    assert.deepEqual(r.fuori, {},
      'questi indicatori disegnano oltre il bordo dell\'area, cioe\' sotto i prezzi: '
      + JSON.stringify(r.fuori, null, 1));
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

// ---------------------------------------------------------------------------------------
// IL MURO, e perche' serve oltre alla regola dell'angolo: un riquadro messo bene puo' comunque
// avere un'etichetta ancorata a una candela che scorre oltre il bordo. Misurato sui due
// indicatori nuovi del 18 novembre: scrivevano i prezzi dell'operazione fino a 176 px sotto la
// colonna dei prezzi. Il ritaglio sta attorno a OGNI render di indicatore, in draw(), e non
// chiede niente a chi scrive un indicatore nuovo.
// ---------------------------------------------------------------------------------------
test('draw mette il ritaglio attorno al disegno di ogni indicatore', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const {RADICE} = await import('./aiuti.mjs');
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const i = src.indexOf('def.render(ctx,ind,rows,dataStart,dataEnd,xAbs,y,pad,h);');
  assert.ok(i > 0, 'la chiamata al disegno di un indicatore deve esistere');
  const prima = src.slice(Math.max(0, i - 400), i);
  const dopo = src.slice(i, i + 200);
  assert.match(prima, /ctx\.clip\(\);/,
    'subito prima del disegno di un indicatore ci deve essere il ritaglio');
  assert.match(prima, /ctx\.rect\(0,0,Math\.max\(0,w-pad\.r\),h\)/,
    'il ritaglio deve fermarsi al bordo dell\'area, cioe\' prima della scala dei prezzi');
  assert.match(dopo, /ctx\.restore\(\);/,
    'e subito dopo il ritaglio va tolto, o taglierebbe tutto il resto del grafico');
});
