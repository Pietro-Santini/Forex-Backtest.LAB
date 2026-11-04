// QUANTO TRAFFICO FACCIAMO DAVVERO, E UNA FOTOGRAFIA AL GIORNO SU FIREBASE.
//
// PERCHÉ UN CONTATORE PRIMA DI UNA CURA. Il proprietario ha un numero vero dalla console
// Firebase: «ieri siamo arrivati a 250.000 letture e 122.000 di scritture». Quel numero dice
// QUANTO, non DA DOVE. E il «da dove» l'ho già sbagliato una volta in questa stessa giornata: ho
// presentato l'ascolto della sessione come «la metà che si paga», e poi ho scoperto che quell
// ascolto NON VIENE MAI AVVIATO (`fxbtCloud.onChange` non è chiamata da nessuna parte: gli
// ascolti vivi sono grafico, collegamento e preferenze). Una cura su una causa supposta è il modo
// di perdere tempo due volte — sul profilo volumetrico è già successo, lo stesso giorno.
//
// SI CONTANO ANCHE I BYTE, e non è un vezzo: su Firebase si paga la BANDA, non le operazioni
// (è annotato in cervello). Mille letture da 200 byte e mille da 50 KB sono due bollette diverse,
// e un contatore che conta solo le operazioni non saprebbe distinguerle.
//
// LA FOTOGRAFIA GIORNALIERA, chiesta dal proprietario: «una scrittura almeno di backup al giorno
// su Firebase, per non perdere tutti i dati di tutti gli utenti». E ha anche una ragione tecnica:
// da quando si manda solo il delta, la copia su Firebase è il risultato di tante fusioni
// parziali — se una non è arrivata, quella copia resta sottilmente sbagliata e nessuno lo sa. La
// fotografia intera riallinea.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Un magazzino finto: le funzioni prendono il magazzino da fuori proprio per questo, così il
// test non tocca il localStorage vero e non deve aspettare mezzanotte per provare il cambio
// di giorno.
const MAGAZZINO = `window.__magazzino = function(){
  var dentro = {};
  return {
    getItem: function(k){ return (k in dentro) ? dentro[k] : null; },
    setItem: function(k,v){ dentro[k] = String(v); },
    removeItem: function(k){ delete dentro[k]; },
    tutto: function(){ return dentro; }
  };
};`;

test('il contatore separa letture e scritture, documento per documento, in byte', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(MAGAZZINO);
    const r = await pagina.evaluate(`(function(){
      const m = window.__magazzino();
      const quando = Date.UTC(2026,10,4,12,0,0);
      fblTrafficoSegna('scrittura','grafico',3000,m,quando);
      fblTrafficoSegna('scrittura','grafico',1000,m,quando);
      fblTrafficoSegna('lettura','grafico',4000,m,quando);
      fblTrafficoSegna('lettura','preferenze',200,m,quando);
      const r = fblTrafficoRiassunto(m,quando);
      return {righe:r.righe, letture:r.totaleLetture, scritture:r.totaleScritture, kb:r.kbTotali};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.scritture, 2);
    assert.equal(r.letture, 2);
    const grafico = r.righe.find(x => x.documento === 'grafico');
    assert.ok(grafico, 'il documento grafico deve comparire nel riassunto');
    assert.equal(grafico.scritture, 2);
    assert.equal(grafico.letture, 1);
    // 3000+1000 scritti, 4000 letti
    assert.equal(grafico.kbScritti, 3.9);
    assert.equal(grafico.kbLetti, 3.9);
    // Ordinato per BANDA, non per numero di operazioni: è la banda che si paga.
    assert.equal(r.righe[0].documento, 'grafico',
      'il più pesante in byte deve stare in cima, invece: ' + JSON.stringify(r.righe.map(x=>x.documento)));
  } finally { await browser.close(); }
});

test('il conto si azzera al cambio di giorno: la console Firebase ragiona a giornate', async () => {
  const {browser, pagina} = await apriApp();
  try {
    await pagina.evaluate(MAGAZZINO);
    const r = await pagina.evaluate(`(function(){
      const m = window.__magazzino();
      const ieri = Date.UTC(2026,10,3,12,0,0), oggi = Date.UTC(2026,10,4,12,0,0);
      fblTrafficoSegna('scrittura','session',5000,m,ieri);
      const diIeri = fblTrafficoRiassunto(m,ieri).totaleScritture;
      const diOggi = fblTrafficoRiassunto(m,oggi).totaleScritture;
      return {diIeri, diOggi};
    })()`);
    assert.equal(r.diIeri, 1);
    assert.equal(r.diOggi, 0, 'il giorno nuovo riparte da zero');
  } finally { await browser.close(); }
});

// ---- LA FOTOGRAFIA GIORNALIERA ----

test('la fotografia intera serve una volta al giorno, non a ogni salvataggio', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(MAGAZZINO);
    const r = await pagina.evaluate(`(function(){
      const m = window.__magazzino();
      const mattina = Date.UTC(2026,10,4,8,0,0);
      const sera = Date.UTC(2026,10,4,21,0,0);
      const domani = Date.UTC(2026,10,5,8,0,0);
      const primaVolta = fblFotoGiornalieraServe(m,mattina);
      fblFotoGiornalieraFatta(m,mattina);
      const subitoDopo = fblFotoGiornalieraServe(m,mattina);
      const laSera = fblFotoGiornalieraServe(m,sera);
      const ilGiornoDopo = fblFotoGiornalieraServe(m,domani);
      return {primaVolta, subitoDopo, laSera, ilGiornoDopo};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.primaVolta, true, 'la prima scrittura del giorno porta la fotografia intera');
    assert.equal(r.subitoDopo, false, 'e subito dopo no: sarebbe una fotografia per ogni modifica');
    assert.equal(r.laSera, false, 'nemmeno la sera dello stesso giorno');
    assert.equal(r.ilGiornoDopo, true, 'il giorno dopo sì: è il backup chiesto dal proprietario');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: con la memoria negata (finestra privata) si risponde NO. Senza questa
// regola, in una finestra privata la fotografia intera partirebbe a OGNI salvataggio — una
// scrittura da 48 KB per ogni modifica, cioè il contrario del risparmio.
test('PROVA DI CONTROLLO: con la memoria negata non si fa una fotografia a ogni salvataggio', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      const negato = {
        getItem: function(){ throw new Error('memoria negata'); },
        setItem: function(){ throw new Error('memoria negata'); },
        removeItem: function(){ throw new Error('memoria negata'); }
      };
      return {serve: fblFotoGiornalieraServe(negato, Date.now())};
    })()`);
    assert.equal(r.serve, false,
      'senza memoria non si può sapere se è già stata fatta: meglio nessuna fotografia che una per modifica');
  } finally { await browser.close(); }
});

// Il giorno è quello LOCALE, non UTC: «una volta al giorno» per l'utente vuol dire il suo giorno.
// Con l'UTC, in Italia la fotografia scatterebbe all'una o alle due di notte invece che al primo
// utilizzo della giornata.
test('il giorno è quello locale dell\'utente', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      const d = new Date(2026,10,4,0,30,0);   // mezzanotte e mezza, ora locale
      return {giorno: fblGiornoDiOggi(d), atteso: '2026-11-04'};
    })()`);
    assert.equal(r.giorno, r.atteso,
      'alle 00:30 locali il giorno deve essere già quello nuovo, non quello di ieri in UTC');
  } finally { await browser.close(); }
});

// ---- IL RIQUADRO NEL PANNELLO ----
//
// Un contatore che nessuno legge è lavoro buttato. La tabella sta nel pannello «Accesso da altri
// dispositivi», accanto all'interruttore del cloud nostro.
test('il riquadro del traffico mostra i documenti più pesanti in cima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      // Si scrive nel magazzino VERO della pagina di prova (è una pagina usa e getta), perché
      // qui si misura il disegno, non la contabilità.
      fblTrafficoSegna('scrittura','grafico',40000);
      fblTrafficoSegna('lettura','grafico',40000);
      fblTrafficoSegna('scrittura','preferenze',300);
      fblTrafficoDisegna();
      const t=document.getElementById('fblTrafficoTabella');
      const righe=[...t.querySelectorAll('tr')].map(r=>r.cells[0].textContent.trim());
      return {testo:t.textContent, righe};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.ok(/grafico/.test(r.testo), 'il riquadro deve elencare i documenti: ' + r.testo.slice(0, 120));
    assert.equal(r.righe[1], 'grafico',
      'il più pesante in banda va in cima (la prima riga è l\'intestazione): ' + JSON.stringify(r.righe));
    assert.ok(/KB/.test(r.testo), 'la banda va mostrata, non solo il numero di operazioni');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: senza traffico il riquadro lo dice, invece di mostrare una tabella vuota
// che sembra un difetto.
test('PROVA DI CONTROLLO: senza traffico il riquadro lo spiega', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      try{ localStorage.removeItem('fbl_cloud_traffico'); }catch(e){}
      fblTrafficoDisegna();
      return (document.getElementById('fblTrafficoTabella')||{}).textContent||'';
    })()`);
    assert.ok(/Ancora niente/.test(r), 'deve dire che non c\'è ancora niente: "' + r.slice(0, 80) + '"');
  } finally { await browser.close(); }
});
