// DUE FINESTRE NORMALI NON APRONO LO STESSO SEGNALE DUE VOLTE.
//
// TROVATO con l'audit del 17 novembre 2026 (voce 1.3 della scaletta). Le guardie contro il
// doppione ci sono e funzionano fra pagina madre e finestre DUPLICATE, ma sono costruite tutte
// su `PIP_SLOT`:
//
//     async function tgSonoAutoritaSegnale(){ if(PIP_SLOT===0)return true; ... }
//
// e il canale di presenza scarta i messaggi del proprio slot (`if(msg.slot===PIP_SLOT)return`).
// `PIP_SLOT` vale 0 per QUALUNQUE pagina senza `?pipSlot=N`, quindi due istanze normali - il
// programma installato piu' una scheda del browser, o due copie aperte a mano - sono entrambe
// «madre», non si vedono nemmeno fra loro sul canale, e aprono tutte e due.
//
// L'unica barriera condivisa e' il ricordo su disco `fb_tg_segnale_applicato_<id>`, ma si scrive
// DOPO gli ordini (`if(aperte>0)tgSegnaleApplicatoRicorda(voce,aperte)`), e gli ordini a mercato
// partono in parallelo: la finestra di corsa e' larga quanto l'esecuzione su MT5, cioe' secondi.
//
// LA CURA: una PRENOTAZIONE, scritta PRIMA di aprire invece che dopo. Serve pero' una cosa che
// nel programma non esisteva: un modo per distinguere due finestre che hanno lo stesso
// `PIP_SLOT`. Da qui `FBL_FINESTRA_ID`, diverso a ogni caricamento di pagina.
//
// ONESTA' SU QUANTO E' STRETTA: `localStorage` non ha una scrittura atomica, quindi due finestre
// che prenotano nello stesso identico istante possono passare entrambe. La prenotazione riduce
// la corsa da «tutta l'esecuzione MT5» (secondi) a «il tempo fra una scrittura e la sua rilettura»
// (millisecondi). Non e' un lucchetto, e non va raccontato come tale: e' la differenza fra un
// doppione che capita e uno che capita quasi mai.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const VOCE = () => ({id:'segnale-123', chat:'Sala X',
  segnale:{strumento:'XAUUSD', direzione:'BUY', entrata:4000, stop_loss:3990, take_profit:[4010]}});

const PULISCI = () => {
  try{
    for(let i=localStorage.length-1;i>=0;i--){
      const k=localStorage.key(i);
      if(k&&(k.indexOf('fb_tg_segnale_applicato_')===0||k.indexOf('fb_tg_segnale_prenotato_')===0))localStorage.removeItem(k);
    }
  }catch(e){}
};

test('due finestre con lo stesso slot: apre una sola', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      try{
        for(let i=localStorage.length-1;i>=0;i--){
          const k=localStorage.key(i);
          if(k&&(k.indexOf('fb_tg_segnale_applicato_')===0||k.indexOf('fb_tg_segnale_prenotato_')===0))localStorage.removeItem(k);
        }
      }catch(e){}
      let valutazioni=0;
      // L'APERTURA DURA: e' il punto di tutto. Il doppione nasce perche' la seconda finestra
      // arriva MENTRE la prima sta ancora aprendo - su MT5 sono secondi. Un'apertura istantanea
      // non riprodurrebbe niente, e il banco direbbe «tutto a posto» misurando il vuoto.
      window.tgAutoValuta = async () => { valutazioni++; await new Promise(r=>setTimeout(r,120)); };
      window.tgRenderPannello = () => {};
      const voce={id:'segnale-123', chat:'Sala X',
        segnale:{strumento:'XAUUSD', direzione:'BUY', entrata:4000, stop_loss:3990, take_profit:[4010]}};
      // FINESTRA A: parte e NON si aspetta che finisca
      FBL_FINESTRA_ID='finestra-A';
      const lavoroA=tgAutoInCoda(voce);
      await new Promise(r=>setTimeout(r,20));   // A sta aprendo
      // FINESTRA B: lo stesso segnale, un'altra identita', mentre A e' ancora al lavoro.
      FBL_FINESTRA_ID='finestra-B';
      const voceB=Object.assign({}, voce, {autoMotivo:null});
      await tgAutoInCoda(voceB);
      const dopoB=valutazioni, motivoB=voceB.autoMotivo||'';
      FBL_FINESTRA_ID='finestra-A';
      await lavoroA;
      return {dopoA:1, dopoB, motivoA:voce.autoMotivo||'', motivoB};
    });
    assert.equal(r.dopoA, 1, 'la prima finestra deve aprire');
    assert.equal(r.dopoB, 1, 'APERTO DUE VOLTE: la seconda finestra ha valutato lo stesso segnale');
    assert.ok(r.motivoB, 'la seconda finestra deve DIRE perché non apre, non restare muta');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la prenotazione è di chi la prende, e la stessa finestra può riprovare', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      try{
        for(let i=localStorage.length-1;i>=0;i--){
          const k=localStorage.key(i);
          if(k&&k.indexOf('fb_tg_segnale_prenotato_')===0)localStorage.removeItem(k);
        }
      }catch(e){}
      const voce={id:'segnale-456'};
      FBL_FINESTRA_ID='finestra-A';
      const a1=tgSegnalePrenota(voce);
      const a2=tgSegnalePrenota(voce);   // la stessa finestra non si blocca da sola
      FBL_FINESTRA_ID='finestra-B';
      const b1=tgSegnalePrenota(voce);
      return {a1,a2,b1};
    });
    assert.equal(r.a1, true, 'la prima prenotazione deve riuscire');
    assert.equal(r.a2, true, 'la stessa finestra deve poter riprovare: non si blocca da sola');
    assert.equal(r.b1, false, 'un\'altra finestra non deve poter prenotare lo stesso segnale');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una finestra che muore a metà non blocca il segnale per sempre', async () => {
  // Il difetto che una prenotazione mal fatta introduce: se la finestra che prenota si chiude
  // (o si pianta) prima di aprire, il segnale resterebbe prenotato e NESSUNO lo aprirebbe piu'.
  // Sarebbe un guasto peggiore di quello curato, e silenzioso.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const voce={id:'segnale-789'};
      FBL_FINESTRA_ID='finestra-morta';
      tgSegnalePrenota(voce);
      // la prenotazione invecchia: la si riscrive con un istante vecchio
      const k='fb_tg_segnale_prenotato_'+voce.id;
      const g=JSON.parse(localStorage.getItem(k));
      g.at = Date.now() - 10*60*1000;   // dieci minuti fa
      localStorage.setItem(k, JSON.stringify(g));
      FBL_FINESTRA_ID='finestra-viva';
      return {ripresa: tgSegnalePrenota(voce)};
    });
    assert.equal(r.ripresa, true, 'una prenotazione vecchia deve scadere, altrimenti blocca per sempre');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO una finestra sola: apre come adesso', async () => {
  // Senza questa, una cura che blocca tutto passerebbe le prove di sopra e spegnerebbe
  // l'apertura automatica per tutti.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      try{
        for(let i=localStorage.length-1;i>=0;i--){
          const k=localStorage.key(i);
          if(k&&(k.indexOf('fb_tg_segnale_applicato_')===0||k.indexOf('fb_tg_segnale_prenotato_')===0))localStorage.removeItem(k);
        }
      }catch(e){}
      let valutazioni=0;
      window.tgAutoValuta = async () => { valutazioni++; };
      window.tgRenderPannello = () => {};
      for(const id of ['uno','due','tre']){
        await tgAutoInCoda({id:'segnale-'+id, chat:'Sala X',
          segnale:{strumento:'XAUUSD', direzione:'BUY', entrata:4000, stop_loss:3990, take_profit:[4010]}});
      }
      return {valutazioni};
    });
    assert.equal(r.valutazioni, 3, 'tre segnali diversi, una finestra sola: tre aperture');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO un segnale senza id si comporta come prima', async () => {
  // Gli id della bacheca ci sono quasi sempre, ma non e' garantito. Senza id non si puo'
  // prenotare niente: meglio il comportamento di oggi che un segnale che non si apre mai.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      let valutazioni=0;
      window.tgAutoValuta = async () => { valutazioni++; };
      window.tgRenderPannello = () => {};
      FBL_FINESTRA_ID='finestra-A';
      await tgAutoInCoda({chat:'Sala X', segnale:{strumento:'XAUUSD', direzione:'BUY', entrata:4000, stop_loss:3990, take_profit:[4010]}});
      FBL_FINESTRA_ID='finestra-B';
      await tgAutoInCoda({chat:'Sala X', segnale:{strumento:'XAUUSD', direzione:'BUY', entrata:4000, stop_loss:3990, take_profit:[4010]}});
      return {valutazioni};
    });
    assert.equal(r.valutazioni, 2, 'senza id non si prenota: comportamento di prima');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
