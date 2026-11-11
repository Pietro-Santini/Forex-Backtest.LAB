// LE POSIZIONI CHIUSE RESTANO SULLA PAGINA DUPLICATA (tablet, ?pipSlot=2).
//
// SEGNALATO dal proprietario (10 novembre 2026, con screenshot del tablet): «le posizioni aperte
// sul tablet, dello stesso conto parliamo, sono 6 posizioni. Mentre invece sul PC sono soltanto
// 2, come e' corretto che sia. Quindi c'è proprio un errore di principio. I dati non passano
// correttamente. Cioè, stanno avanzando sul tablet posizioni che sono già state chiuse, che hanno
// raggiunto già il TP. Perché ancora sono visualizzate sul tablet?»
//
// NELLO SCREENSHOT: "POSIZIONI APERTE / OPERAZIONI A BLOCCO" = 5 righe (CADJPY, XAUUSD, XAUUSD,
// GBPUSD, GBPCHF) e "🖥️ POSIZIONI MT5 (CONTO REALE COLLEGATO)" = 2 righe (ticket #306749088
// CADJPY e #306804602 XAUUSD) che sono le STESSE prime due. Il P/L live si aggiorna: la pagina
// è viva, il dato è sbagliato. Sul PC invece le 2 posizioni giuste.
//
// CAUSA MISURATA (righe di app.html come sono oggi, 10 novembre 2026; il file si sta spostando
// perche' un altro agente ci lavora in parallelo, i numeri vanno riverificati al momento):
//   laboratorio/app/misura_chiusure_tablet.mjs stampa:
//     subito dopo avvio:                     modo=backtest, tutte le sessioni null
//     dopo il primo annuncio (5 posizioni):  modo=backtest, perSessione.backtest=[p1..p5], righe=5
//     dopo l'elenco con sole 2 posizioni:    modo=live, perSessione.backtest=[p1..p5],
//                                            positions=[p1,p2], righe=7
//     dopo il terzo annuncio (sempre 2):     righe=7  (non si risolve mai da solo)
//   Le 5 posizioni della madre finiscono nella sessione CHE SI STA LASCIANDO (backtest), non in
//   quella Live in cui si entra: app.html reagisce a msg.conto con
//   `Promise.resolve(switchAccountMode(true)).then(...)` (riga 9171) — ASINCRONO — mentre il
//   gestore prosegue SENZA aspettarlo e a riga 9231 fa
//   `positions=Array.isArray(msg.positions)?msg.positions:positions;` (riga 9232 per gli ordini
//   pendenti), che in quel preciso istante è ancora l'array della sessione Storico. Quando poi
//   switchAccountMode() completa, captureCurrentModeSnapshot() (riga 6123) congela quelle 5
//   posizioni dentro sessionByMode.backtest e ripristina la sessione Live (vuota). Da lì in poi
//   ogni messaggio scrive nella sessione Live: la copia nella sessione abbandonata NON viene mai
//   piu' aggiornata, quindi le 3 posizioni chiuse (TP raggiunto) restano in tabella per sempre.
//   La tabella "Posizioni aperte" le mostra perché elenca TUTTE E 4 le sessioni
//   (collectAcrossSessions, riga 13858, usata a riga 13987) con la colonna "Sessione": le 5
//   righe dello screenshot portano il bollino "📼 Storico" — misurato, ed è il motivo per cui le
//   vede il proprietario sul tablet e non sul PC (sul PC `positions` è già quello della Live).
//
// LA SECONDA META' DELLA STESSA CAVALITA', misurata a parte
// (laboratorio/app/misura_chiusure_sessione.mjs, due giri di fetchMt5Positions con ponte finto):
//   - le 3 posizioni chiuse nella sessione ATTIVA: 3 chiusure giornalizzate (motivo TP,
//     /deal_reason chiamato 3 volte), tabella 2 righe. Corretto.
//   - le STESSE 3 posizioni nell'ALTRA sessione: 0 chiusure, /deal_reason chiamato 0 volte,
//     tabella 5 righe, con in piu' le 2 posizioni vere adottate (riga 41856 le dirotta su
//     'live'). Il giro di riconciliazione (riga 41665) percorre solo `positions`, la sessione a
//     schermo; il commento a riga 41648-41650 lo dice: "verra' riconciliata quando si torna su
//     quella sessione" — e sulla pagina duplicata non si torna mai, perché la sessione Live
//     riceve i messaggi e quella Storico è un congelatoio.
//   Il paradosso è dentro lo stesso file: allTrackedMt5PositionTickets() (riga 41602) le 4
//     sessioni le guarda TUTTE (per non ri-adottare un ticket), ma la chiusura la guarda una
//     sola.
//
// QUESTO BANCO misura il COMPORTAMENTO della pagina duplicata, non il testo del sorgente:
// la madre annuncia 5 posizioni, poi le stesse 5 meno 3 (TP raggiunto) — e le 3 chiuse
// devono SPARIRE.
//
// CURATO l'11 novembre 2026: dopo il cambio conto annunciato la pagina ridipinge SUBITO
// (draw/update nel .then() dello switch) e l'attesa del banco e' passata a 3000 ms, perche'
// la ridipintura arrivava a 1536 ms.
//
// RESTA APERTO un caso DIVERSO, che non e' questo: una posizione reale tracciata in una
// sessione che non e' quella a schermo non viene mai riconciliata (se il broker la chiude,
// resta). Il suo banco vive in banchi_aperti e in cervello/PROBLEMI-APERTI-2026-11-07.md:
// non si committa un banco rosso (LEZIONI.md n. 31).

import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const LOGIN = '7712345', SERVER = 'Broker-Demo';
const CONTO = {vivo:true, vista:'mt5', mt5:{login:LOGIN, server:SERVER}};

// Le 5 posizioni dello screenshot: le prime 2 sono quelle del conto reale (tabella MT5),
// le altre 3 sono già chiuse sul broker (TP raggiunto) quando la madre rimanda l'elenco.
const POS = [
  {id:'p1',asset:'CADJPY',side:'BUY', entry:110.5, sl:110.2, tp:111.0, lots:0.10, mt5Ticket:306749088, mt5Login:LOGIN},
  {id:'p2',asset:'XAUUSD',side:'BUY', entry:2650.0,sl:2640.0,tp:2665.0,lots:0.05, mt5Ticket:306804602, mt5Login:LOGIN},
  {id:'p3',asset:'XAUUSD',side:'SELL',entry:2652.0,sl:2660.0,tp:2640.0,lots:0.05, mt5Ticket:306812345, mt5Login:LOGIN},
  {id:'p4',asset:'GBPUSD',side:'BUY', entry:1.2730,sl:1.2700,tp:1.2780,lots:0.20, mt5Ticket:306899999, mt5Login:LOGIN},
  {id:'p5',asset:'GBPCHF',side:'SELL',entry:1.1200,sl:1.1240,tp:1.1140,lots:0.15, mt5Ticket:306911111, mt5Login:LOGIN}
];
const CHIUSE = ['p3','p4','p5'];

// Cosa tiene davvero la pagina: le posizioni di TUTTE E 4 le sessioni, come fa la tabella
// "Posizioni aperte" (collectAcrossSessions → update()), piu' quante righe finiscono nel DOM.
const FOTOGRAFIA = `(function(){
  const perSessione={}, quantePerId={};
  ['backtest','live','backtest_propfirm','live_propfirm'].forEach(k=>{
    const s=sessionByMode[k]; const lista=s?(s.positions||[]):[];
    perSessione[k]=lista.map(p=>p.id);
    lista.forEach(p=>{ quantePerId[p.id]=(quantePerId[p.id]||0)+1; });
  });
  (positions||[]).forEach(p=>{ quantePerId[p.id]=(quantePerId[p.id]||0)+1; });
  const etichette=[...document.querySelectorAll('#openPositions tr')].map(tr=>{
    const td=tr.querySelectorAll('td'); return td.length>1?td[1].textContent.trim():'';
  });
  return {
    modo:currentMode(), vivo:!!liveModeActive,
    posizioni:(positions||[]).map(p=>p.id),
    perSessione:perSessione, quantePerId:quantePerId,
    righeTabella:document.querySelectorAll('#openPositions tr').length,
    etichette:etichette
  };
})()`;

async function manda(pagina, lista, slot){
  await pagina.evaluate(`(function(){
    tradingChannel.onmessage({data:{type:'trading_sync',slot:${slot},at:Date.now(),
      positions:${JSON.stringify(lista)},pendingOrders:[],trades:[],equity:[],
      conto:${JSON.stringify(CONTO)}}});
  })()`);
  // 3000 ms, non 1200: misurato, la tabella veniva ridipinta 1536 ms dopo il cambio conto
  // asincrono. Con 1200 il banco guardava una pagina ancora vecchia (e ora l'app ridipinge
  // subito dopo aver applicato lo stato, quindi in pratica ci si arriva molto prima).
  await pagina.waitForTimeout(3000);
}

// La pagina duplicata ha il SUO canale MT5 (nello screenshot la tabella "🖥️ Posizioni MT5" e' piena
// e il P/L live si muove): senza questo il filtro del conto a riga 9212 butterebbe via TUTTO il
// messaggio e la prova misurerebbe il vuoto invece del difetto.
async function collegaMt5(pagina){
  await pagina.evaluate(`(function(){
    try{ mt5AttivaConto(${JSON.stringify(LOGIN)},${JSON.stringify(SERVER)},true,0); }catch(e){}
  })()`);
}

// =====================================================================================
// IL DIFETTO: la posizione chiusa dalla madre non sparisce dalla pagina duplicata.
// =====================================================================================
test('sulla pagina duplicata la posizione chiusa (TP raggiunto) sparisce dall\'elenco', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=2', altezza:900});
  try{
    await collegaMt5(pagina);
    await manda(pagina, POS, 0);                       // la madre ha 5 posizioni
    const dopo5 = await pagina.evaluate(FOTOGRAFIA);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(dopo5.righeTabella, 5,
      'la pagina duplicata deve mostrare le 5 posizioni annunciate: invece ' + dopo5.righeTabella);

    await manda(pagina, POS.slice(0,2), 0);             // 3 hanno raggiunto il TP: restano 2

    const dopo2 = await pagina.evaluate(FOTOGRAFIA);
    assert.equal(dopo2.modo, 'live',
      'dopo l\'annuncio del conto della madre la pagina duplicata deve essere in Live: invece ' + dopo2.modo);

    const chiuseRimaste = CHIUSE.filter(id => (dopo2.quantePerId[id]||0) > 0);
    assert.deepEqual(chiuseRimaste, [],
      'le posizioni chiuse devono sparire da OVUNQUE nella pagina. Rimaste invece in: '
      + JSON.stringify({perSessione:dopo2.perSessione, quantePerId:dopo2.quantePerId})
      + ' — righe in tabella: ' + dopo2.righeTabella);

    assert.equal(dopo2.righeTabella, 2,
      'la tabella "Posizioni aperte" della pagina duplicata deve avere 2 righe (come sul PC): '
      + 'invece ne ha ' + dopo2.righeTabella + ' (' + dopo2.etichette.join(' , ') + ')');

    const p1Volte = dopo2.quantePerId['p1']||0;
    assert.equal(p1Volte, 1,
      'la posizione p1 (CADJPY) deve essere contata UNA volta. Contata invece ' + p1Volte
      + ' volte, in ' + JSON.stringify(dopo2.perSessione));
  } finally { await browser.close(); }
});

// =====================================================================================
// PROVA DI CONTROLLO (verde): gli stessi due annunci, sulla pagina principale GIA' in Live
// e collegata a MT5 — dove `positions` e' davvero l'array della sessione Live — lasciano 2
// posizioni, contate una volta sola. Senza di essa il banco non direbbe se e' la pagina
// duplicata a essere rotta o se e' la prova a essere scritta male.
// =====================================================================================
test('PROVA DI CONTROLLO: sulla pagina principale in Live le stesse due liste danno 2 posizioni', async () => {
  const {browser, pagina, errori} = await apriApp({altezza:900});
  try{
    await pagina.evaluate(`(function(){
      liveModeActive=true; fblContoVista='mt5'; mt5Connected=true;
      try{ mt5AttivaConto(${JSON.stringify(LOGIN)},${JSON.stringify(SERVER)},true,0); }catch(e){}
    })()`);
    await manda(pagina, POS, 2);      // una finestra PIP (slot 2) annuncia le sue 5 posizioni
    const d5 = await pagina.evaluate(FOTOGRAFIA);
    await manda(pagina, POS.slice(0,2), 2);   // 3 chiuse al TP: restano 2
    const d2 = await pagina.evaluate(FOTOGRAFIA);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(d5.modo, 'live', 'la pagina principale qui e\' in Live, come sul PC del proprietario');
    assert.equal(d2.righeTabella, 2,
      'sulla pagina principale devono restare le 2 posizioni aperte: invece ' + d2.righeTabella);
    assert.equal(d2.quantePerId['p1'], 1,
      'e p1 deve essere contata una volta sola: invece ' + d2.quantePerId['p1']);
    CHIUSE.forEach(id => assert.equal(d2.quantePerId[id]||0, 0,
      'la posizione chiusa ' + id + ' non deve restare: ' + JSON.stringify(d2.perSessione)));
  } finally { await browser.close(); }
});
