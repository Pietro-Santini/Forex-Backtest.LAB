// USCENDO DAL REPLAY SI TORNA ALL'ULTIMA CANDELA, SU TUTTE LE FINESTRE.
//
// SEGNALATO dal proprietario il 17 novembre 2026: «quando sono in modalità replay e poi vado a
// stoppare, cioè a uscire dalla modalità replay, lui mi deve ritornare automaticamente
// all'ultima candela, anche se il mercato è chiuso. Cosa che invece oggi non succede. Io non so,
// magari c'è stata qualche modifica all'interno che infatti ho intravisto... E deve ritornare sia
// sulla pagina madre che sulle pagine duplicate all'ultima candela, appena esco dalla modalità
// replay.»
//
// AVEVA RAGIONE ANCHE SULLA MODIFICA: c'è stata, il 15-16 novembre, ed era una sua richiesta -
// «il tasto stop ferma su tutte le pagine duplicate allo stesso tempo e allo stesso prezzo, senza
// sfalsati». Da allora, col replay condiviso, STOP = PAUSA sul punto e serve premerlo due volte
// per uscire. Ma la modifica è finita anche sull'USCITA vera:
//
//     if(_condiviso){
//       // Uscita vera dal replay condiviso: ... si RESTA FERMI dove si è.
//       if(Number.isFinite(tEsatto))masterTime=tEsatto;
//     }else{
//       if(baseRows.length)masterTime=closeTimeOf(baseRows[baseRows.length-1]);
//       rebuildRows();
//       followLatest=true; viewEnd=idx; ...
//     }
//
// Da solo l'uscita torna all'ultima candela; con le duplicate resta ferma.
//
// LA PAUSA NON SI TOCCA, ed è il punto delicato: la richiesta del 15 novembre riguarda lo STOP
// come pausa, e resta esattamente com'è (terza prova di questo banco). Si cambia solo l'uscita.
// E tornare all'ultima candela AUMENTA l'allineamento che era stato chiesto invece di ridurlo:
// l'ultima candela è lo stesso punto per tutte le finestre sullo stesso asset, mentre «dove si
// era» dipendeva da chi aveva premuto.
//
// PERCHE' UNA CURA SOLA BASTA PER TUTTE LE FINESTRE: chi riceve l'annuncio di stop chiama la
// STESSA funzione (`esciReplayLive({propaga:false, istante:msg.t, esci:true})`), quindi madre e
// duplicate passano tutte da qui.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// 30 candele al minuto; il replay è fermo a metà (idx 12).
const PREPARA = (condiviso) => `(() => {
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD';
  baseRows=[];
  for(let i=0;i<30;i++){
    const p=4000+i;
    baseRows.push({date:new Date(Date.UTC(2026,10,10,10,i,0)).toISOString(),
      open:p, high:p+1, low:p-1, close:p, volume:1});
  }
  currentTF=1;
  liveModeActive=true;
  masterTime=closeTimeOf(baseRows[12]);
  rebuildRows();
  liveReplayActive=true;
  fblReplayPausa=false;
  fblReplayPerTutte=${condiviso ? 'true' : 'false'};
  followLatest=false;
  positions=[]; trades=[];
  return {idxPrima:idx, ultima:baseRows.length-1, tUltima:closeTimeOf(baseRows[baseRows.length-1])};
})()`;

const LEGGI = `({idx, ultima:baseRows.length-1, masterTime,
  tUltima:closeTimeOf(baseRows[baseRows.length-1]), followLatest, replay:liveReplayActive})`;

test('uscita dal replay CONDIVISO: si torna all\'ultima candela', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const prep = await pagina.evaluate(PREPARA(true));
    assert.equal(prep.idxPrima, 12, 'la preparazione deve fermare il replay a metà');

    const r = await pagina.evaluate(`(() => {
      esciReplayLive({esci:true, propaga:false});
      return ${LEGGI};
    })()`);
    assert.equal(r.replay, false, 'il replay deve essere finito');
    assert.equal(r.idx, r.ultima,
      'il cursore deve stare sull\'ultima candela: è rimasto a ' + r.idx + ' su ' + r.ultima);
    assert.equal(r.masterTime, r.tUltima, 'e l\'orologio deve essere quello dell\'ultima candela');
    assert.equal(r.followLatest, true, 'e il grafico deve tornare a seguire la diretta');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO uscita DA SOLI: si torna all\'ultima candela, come già faceva', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA(false));
    const r = await pagina.evaluate(`(() => {
      esciReplayLive({esci:true, propaga:false});
      return ${LEGGI};
    })()`);
    assert.equal(r.replay, false);
    assert.equal(r.idx, r.ultima, 'da soli funzionava già e deve continuare');
    assert.equal(r.followLatest, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO la PAUSA non si tocca: resta sul punto, come chiesto il 15 novembre', async () => {
  // Il punto delicato di questa cura. Lo STOP col replay condiviso è una PAUSA, e la richiesta
  // del proprietario del 15 novembre era proprio che non saltasse all'ultima candela. Se questa
  // prova diventa rossa, la cura ha disfatto una sua richiesta precedente invece di aggiungerne
  // una nuova.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA(true));
    const r = await pagina.evaluate(`(() => {
      esciReplayLive({propaga:false});          // senza esci:true = pausa
      return Object.assign(${LEGGI}, {pausa:fblReplayPausa});
    })()`);
    assert.equal(r.replay, true, 'la pausa NON esce dal replay');
    assert.equal(r.pausa, true, 'e si segna come pausa armata');
    assert.equal(r.idx, 12, 'e resta sul punto dov\'era: è andata a ' + r.idx);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO: l\'ultima candela si raggiunge anche a mercato chiuso', async () => {
  // Il proprietario l'ha nominato apposta («anche se il mercato è chiuso»). Il tetto del mercato
  // chiuso limita QUANTO si può scorrere in avanti, non dove si atterra: l'ultima candela dei
  // dati è l'ultima candela, aperto o chiuso. Questa prova lo fissa, così se un domani il tetto
  // venisse applicato anche all'uscita, si vedrebbe subito.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA(true));
    const r = await pagina.evaluate(`(() => {
      // le candele finiscono nel passato: per l'app il mercato non sta mandando niente
      window.fblTettoCandele = () => baseRows.length - 1;
      esciReplayLive({esci:true, propaga:false});
      return ${LEGGI};
    })()`);
    assert.equal(r.idx, r.ultima, 'anche col tetto attivo si deve arrivare all\'ultima candela');
    assert.equal(r.replay, false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il pulsante si chiama ESCI e esce al primo colpo, anche col replay condiviso', async () => {
  // RICHIESTO il 17 novembre 2026: «premiamo il tasto replay, poi esce fuori quello che e' il
  // tasto stop. Invece non deve uscire il tasto stop, ma deve venire fuori quello che e' il tasto
  // esci. Il tasto stop starà soltanto quando premiamo quello che e' il tasto play e poi dopo si
  // trasforma in tasto stop.»
  //
  // Prima il pulsante chiamava `esciReplayLive()` senza `esci:true`: col replay condiviso armava
  // una PAUSA e bisognava premerlo DUE volte per uscire. La prova misura il primo colpo.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA(true));
    const r = await pagina.evaluate(`(() => {
      const b = document.getElementById('liveReplayStopBtn');
      const nome = b ? (b.textContent||'').trim() : null;
      b.style.display='inline-block';
      b.click();
      return {nome, replay:liveReplayActive, idx, ultima:baseRows.length-1, pausa:fblReplayPausa};
    })()`);
    assert.match(r.nome, /ESCI/i, 'il pulsante deve chiamarsi ESCI, non STOP: "' + r.nome + '"');
    assert.equal(r.pausa, false, 'non deve armare una pausa: deve uscire');
    assert.equal(r.replay, false, 'al primo colpo deve essere fuori dal replay');
    assert.equal(r.idx, r.ultima, 'e deve stare sull ultima candela: e a ' + r.idx + ' su ' + r.ultima);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO: il PLAY resta il pulsante della pausa (diventa STOP mentre scorre)', async () => {
  // L'altra metà della richiesta: lo STOP esiste ancora, ma vive sul PLAY. Se questa prova
  // diventa rossa, la pausa è rimasta senza pulsante.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA(true));
    const r = await pagina.evaluate(`(() => {
      const p = document.getElementById('play');
      return {esiste: !!p, nomeAFermo: p ? (p.textContent||'').trim() : null};
    })()`);
    assert.equal(r.esiste, true, 'il pulsante PLAY deve esistere');
    assert.match(r.nomeAFermo, /PLAY/i, 'a replay fermo si chiama PLAY: "' + r.nomeAFermo + '"');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
