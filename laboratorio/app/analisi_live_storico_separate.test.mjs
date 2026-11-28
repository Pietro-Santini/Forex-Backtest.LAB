// PROVA DI CONTROLLO (§3.4.4(c)): i due canali del motore — Live e Storico — devono restare
// separati, e il journal deve distinguere da dove arriva ogni operazione.
//
// MISURATO il 28/11/2026 con la sonda `laboratorio/misura_live_storico_canali.mjs`:
//   Live:  1 voce di registro, 1 ombra, 0 voci con etichetta di canale, statistiche {aperte:1};
//   Storico: 2 posizioni simulate (backtest:true, motoreStorico:true), 0 nuovi ordini veri,
//            registro/ombre IDENTICI a prima, statistiche invariate, 4 trade Journal mode:'backtest';
//   stato indicatore Live {fatte:398,n:1,firme:2} vs Storico {fatte:256,n:0,firme:7}.
// Il registro NON ha un campo `mode`: non serve, perche' il canale Storico non scrive mai li'
// (scrive solo il Journal, che invece ha `mode:'backtest'`). Questo banco blocca che un futuro
// intervento sull'analisi live mescoli i due canali.
//
// Nessuna rete, MT5 finto, ZERO ordini veri: se qualcosa prova a mandare un ordine, si conta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('analisi Live e Storico separate: stato, registro, ombre e statistiche non si mescolano', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      // ---------- candele fisse (CSV finto, 400 M1) ----------
      const t0 = Date.parse('2026-11-20T00:00:00Z');
      const R = []; let p = 4000;
      for (let i = 0; i < 400; i++) { const o = p, c = p + 0.3;
        R.push({date:new Date(t0 + i*60000).toISOString(), open:o, high:Math.max(o,c)+0.5,
                low:Math.min(o,c)-0.3, close:c, volume:10}); p = c; }

      // ---------- indicatore e regola di prova, dentro l'impianto VERO del motore ----------
      INDICATOR_DEFS.__ls = {defaultParams:()=>({}), render(){}, compute(rowsTf,k,ind){
        const r = rowsTf[k]; if (!r) return;
        ind.calc.operazioni = [{da:k, dir:1, stopIniziale:r.close - 0.5}];
      }};
      FBL_MOTORE_REGOLE.length = 0;
      FBL_MOTORE_REGOLE.push({id:'__ls', key:'__ls', nome:'LS', tf:1, obiettivoR:2, be:null, segnale:'xausweep'});
      const cfg = fblMotoreConfig();
      Object.keys(cfg).forEach(k => delete cfg[k]);
      cfg['__ls'] = true; cfg['__ls#osserva'] = true;
      fblMotoreSalvaConfig(cfg);
      ['fbl_auto_aperture','fbl_motore_ombra','fbl_motore_registro'].forEach(k => localStorage.removeItem(k));
      Object.keys(fblMotoreStati).forEach(k => delete fblMotoreStati[k]);
      Object.keys(fblMotoreStatiS).forEach(k => delete fblMotoreStatiS[k]);
      fblMotoreSerie = {}; fblMotoreUltimaBase = null; fblMotoreInCorso = false;

      // Ponte MT5 finto: conta gli ordini, non ne manda nessuno fuori.
      window.__ordini = [];
      placeRealMt5Order = async (side, forz) => { __ordini.push({side, sl:forz.sl, tp:forz.tp}); return 800000 + __ordini.length; };
      syncMt5PositionLevels = async () => {};

      const fotoStato = dove => { const s = (dove==='live'?fblMotoreStati:fblMotoreStatiS)['__ls'];
        return s ? {fatte:s.fatte, n:s.n, firme:s.firme.size, attese:s.attese.length} : null; };

      // ============ (a) GIRO LIVE su candele fisse ============
      baseRows = R.map(r=>({...r})); rows = R.map(r=>({...r})); rowsAssetKey = 'XAUUSD';
      currentTF = 1; currentAssetKey = 'XAUUSD';
      liveModeActive = true; liveReplayActive = false; liveReplaySelecting = false;
      mt5Connected = true; mt5ActiveSymbol = 'XAUUSD';
      mt5AccountInfo = {reale:false, equity:10000, balance:10000, margin_free:10000};
      liveSessionPhaseNow = () => 'mt5';
      positions.length = 0; trades.length = 0; equity = [10000];
      idx = rows.length - 1; viewEnd = idx;
      fblMotoreCaricaSerie = async (tf) => aggregateRows(baseRows, tf).map(r=>({...r}));
      await fblMotoreAutoGiro(true);

      const registroLive = localStorage.getItem('fbl_motore_registro') || '[]';
      const ombraLive = localStorage.getItem('fbl_motore_ombra') || '[]';
      const live = {
        registro: JSON.parse(registroLive),
        ombre: JSON.parse(ombraLive),
        stato: fotoStato('live'),
        statistiche: fblMotoreStatistiche('__ls'),
        sospesa: fblMotoreSospesa('__ls'),
        ordini: __ordini.length,
        registroGrezzo: registroLive, ombraGrezza: ombraLive
      };

      // ============ (b) GIRO STORICO su CSV con la regola accesa ============
      liveModeActive = false; liveReplayActive = false;
      baseRows = R.map(r=>({...r})); rows = R.map(r=>({...r}));
      masterTime = Date.parse(R[250].date);
      idx = 250; viewEnd = 251; visibleCount = 250;
      positions.length = 0; trades.length = 0;
      for (let i = 0; i < 6; i++) forward(false);

      return {
        live,
        storico: {
          ordini: __ordini.length,
          posizioniStorico: positions.filter(x => x && x.backtest===true && x.motoreStorico===true).length,
          registroIdentico: (localStorage.getItem('fbl_motore_registro') || '[]') === live.registroGrezzo,
          ombreIdentiche: (localStorage.getItem('fbl_motore_ombra') || '[]') === live.ombraGrezza,
          registroVoci: JSON.parse(localStorage.getItem('fbl_motore_registro') || '[]').length,
          ombreVoci: JSON.parse(localStorage.getItem('fbl_motore_ombra') || '[]').length,
          statoLiveDopo: fotoStato('live'),
          statoStorico: fotoStato('storico'),
          statisticheDopo: fblMotoreStatistiche('__ls'),
          sospesaDopo: fblMotoreSospesa('__ls'),
          journal: trades.map(t => t.mode)
        }
      };
    })()`);

    // (a) Il Live produce analisi: registro e ombre della regola, nessun altro canale.
    assert.equal(r.live.registro.length, 1, 'un segnale Live -> una voce di registro');
    assert.equal(r.live.ombre.length, 1, 'un segnale Live -> un\'ombra');
    assert.ok(r.live.stato && r.live.stato.fatte > 0, 'lo stato Live deve essere stato calcolato');
    assert.ok(r.live.ordini >= 0);

    // (b) Lo Storico apre solo sul conto storico e NON manda ordini veri.
    assert.ok(r.storico.posizioniStorico > 0, 'in Storico il motore deve aprire posizioni simulate');
    assert.equal(r.storico.ordini, r.live.ordini,
      'il giro Storico NON deve aggiungere ordini veri (Live=' + r.live.ordini + ', dopo=' + r.storico.ordini + ')');

    // (c) SEPARAZIONE: registro e ombre del Live restano identici dopo il giro Storico.
    assert.equal(r.storico.registroIdentico, true, 'il giro Storico non scrive nel registro del Live');
    assert.equal(r.storico.ombreIdentiche, true, 'il giro Storico non scrive nelle ombre del Live');
    assert.equal(r.storico.registroVoci, r.live.registro.length, 'nessuna voce Storico nel registro Live');
    assert.equal(r.storico.ombreVoci, r.live.ombre.length, 'nessuna ombra Storico nelle ombre Live');

    // (d) STATO SEPARATO: l'indicatore Storico ha il suo stato, il Live non si muove.
    assert.deepEqual(r.storico.statoLiveDopo, r.live.stato, 'lo stato dell\'indicatore Live non cambia dopo il giro Storico');
    assert.ok(r.storico.statoStorico, 'lo Storico deve avere uno stato tutto suo (fblMotoreStatiS)');
    assert.notEqual(r.storico.statoStorico.fatte, r.live.stato.fatte,
      'stati separati: fatte Live ' + r.live.stato.fatte + ' vs Storico ' + r.storico.statoStorico.fatte);

    // (e) STATISTICHE e SOSPENSIONE della regola Live invariate dopo il giro Storico.
    assert.deepEqual(r.storico.statisticheDopo, r.live.statistiche, 'fblMotoreStatistiche non cambia dopo il giro Storico');
    assert.deepEqual(r.storico.sospesaDopo, r.live.sospesa, 'la sospensione della regola Live non cambia dopo il giro Storico');

    // (f) JOURNAL: le operazioni del canale Storico portano l'etichetta mode 'backtest'.
    assert.ok(r.storico.journal.length > 0, 'il journal deve contenere le chiusure del replay');
    assert.equal(r.storico.journal.every(m => m === 'backtest'), true,
      'il journal distingue il canale: mode trovati ' + JSON.stringify(r.storico.journal));

    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
