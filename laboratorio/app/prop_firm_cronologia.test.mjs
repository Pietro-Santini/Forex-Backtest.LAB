// PUNTO 4 — prop firm DEDICATA alla cronologia sale.
//
// Il cuore del Punto 4 (raggruppare la curva per giorno, il drawdown giornaliero del 5%, il
// drawdown totale del 10%, l'obiettivo +10% che "sblocca" la prop) e' una funzione PURA,
// fblPropDedicataConta(punti, capitale, apertoMs): la si prova qui senza browser, su curve
// scritte a mano, cosi' il conto si puo' verificare a occhio.
//
// Come si prova che il test serve: senza l'esposizione `window.fblPropDedicataConta` il primo
// test va rosso con "not a function".
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Un punto della curva della resa: `t` e' l'istante del fill (ms), `cap` il conto dopo quel trade.
// Gli orari sono in UTC a mezzogiorno, cosi' il giorno di Roma e' sempre lo stesso in ogni fuso.
const U = (giorno, h) => Date.UTC(2026, 0, giorno, h, 0, 0);

async function conta(punti, capitale, apertoMs){
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((a) => window.fblPropDedicataConta(a.punti, a.capitale, a.apertoMs),
      {punti, capitale, apertoMs});
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    return r;
  } finally { await browser.close(); }
}

test('un giorno che scende oltre il 5% chiude la prop, e si dice QUALE giorno', async () => {
  // Il 2 gennaio il conto arriva a 10.600 (dal capitale di 10.000); il 3 gennaio scende a 9.900:
  // dal saldo d'inizio giornata (10.600) e' -6,6% -> la prop sarebbe finita quel giorno.
  const r = await conta(
    [{t:U(2,12), cap:10600}, {t:U(3,12), cap:9900}],
    10000, U(2,0)
  );
  assert.equal(r.esito, 'finita');
  assert.ok(r.maxDDGiorno > 5, 'il massimo drawdown giornaliero deve superare il 5%');
  assert.equal(r.maxDDGiornoData, '2026-01-03', 'il giorno indicato deve essere quello della perdita');
});

test('raggiunto il +10% la prop e\' SBLOCCATA: il 5% giornaliero successivo non vale piu\'', async () => {
  // Il conto sale fino a 11.000 = +10% (obiettivo) e il giorno dopo perde il 7,3%: quella
  // perdita NON deve contare, perche' la prop era gia' stata sbloccata.
  //
  // ALLUNGATO IL 28 OTTOBRE 2026 col passo 3. Prima la salita stava in UNA giornata, e da quando
  // esiste la regola FTMO dei 4 giorni minimi quell'obiettivo non sblocca piu' niente -
  // giustamente: serve a impedire di passare con un colpo di fortuna. Questo test non parlava
  // dei giorni, parlava di cosa succede DOPO che si e' sbloccata: la salita e' ora distribuita
  // su cinque giornate e l'affermazione resta identica.
  const r = await conta(
    [{t:U(2,12), cap:10200}, {t:U(3,12), cap:10400}, {t:U(4,12), cap:10600},
     {t:U(5,12), cap:10800}, {t:U(6,12), cap:11000}, {t:U(7,12), cap:10200}],
    10000, U(2,0)
  );
  // SI GUARDA LA SFIDA 1, non il verdetto finale. Dal passo 3 il two step ha due sfide, e
  // «sbloccata» vuol dire che sono passate TUTTE E DUE - cioe' conto finanziato. Qui si voleva
  // misurare un'altra cosa: che una perdita ARRIVATA DOPO non annulla un obiettivo gia'
  // raggiunto. Quella resta vera, e si legge sulla fase.
  assert.equal(r.fasi[0].esito, 'passata');
  assert.equal(r.fasi[0].data, '2026-01-06');
});

test('senza violazioni e senza obiettivo resta "ok", col profitto finale dichiarato', async () => {
  const r = await conta(
    [{t:U(2,12), cap:10200}, {t:U(3,12), cap:10500}],
    10000, U(2,0)
  );
  assert.equal(r.esito, 'ok');
  assert.ok(Math.abs(r.profFinale - 5) < 0.001, 'a fine periodo il conto e\' a +5%');
  assert.ok(r.maxDDGiorno < 5 && r.maxDDTot < 10);
});

test('nessun singolo giorno oltre il 5%, ma il totale oltre il 10%: chiude comunque', async () => {
  // Tre giornate da -4% l'una: nessuna supera il 5% giornaliero, ma il totale supera il 10%.
  const r = await conta(
    [{t:U(2,12), cap:9600}, {t:U(3,12), cap:9216}, {t:U(4,12), cap:8847.36}],
    10000, U(2,0)
  );
  assert.equal(r.esito, 'finita');
  assert.ok(r.maxDDGiorno < 5, 'nessun singolo giorno oltre il 5%');
  assert.ok(r.maxDDTot > 10, 'il drawdown totale deve superare il 10%');
});

test('se non c\'e\' nessuna operazione dopo l\'apertura, lo dice invece di inventare', async () => {
  const r = await conta(
    [{t:U(2,12), cap:10600}],
    10000, U(9,0) // apertura DOPO l'unica operazione
  );
  assert.equal(r.vuoto, true);
});

// ---------------------------------------------------------------------------------------------
// RICHIESTO dal proprietario: il riferimento della prop e' il CONTO INIZIALE scritto nel campo,
// non il capitale a cui la sala era arrivata il giorno dell'apertura. Prima si partiva dall'ultimo
// punto PRIMA dell'apertura: il pop-up "Prop firm sbloccata" mostrava quindi un capitale gia'
// gonfiato dai guadagni di mesi precedenti, e la prop non era piu' confrontata col conto versato.
test('il capitale di partenza e\' il CONTO INIZIALE, non quello a cui la sala era arrivata', async () => {
  // La sala era arrivata a 20.000 partendo da 10.000. La prop si apre dopo: deve ripartire da
  // 10.000, non da 20.000.
  const r = await conta(
    [{t:U(1,12), cap:20000}, {t:U(2,12), cap:20000}, {t:U(3,12), cap:18800}],
    10000, U(2,0)
  );
  assert.equal(r.base, 10000, 'il capitale all\'apertura deve essere il conto iniziale scelto');
});

test('riportando la curva sul conto iniziale il VERDETTO non cambia: cambiano gli euro', async () => {
  // Stessa curva del test qui sopra: -6% in una giornata resta -6%, e la prop sarebbe finita
  // quel giorno. Le percentuali sono rapporti, quindi non dipendono dal conto di partenza: e'
  // esattamente il motivo per cui si puo' riportare la curva sul conto iniziale senza falsare
  // niente. L'unica cosa che cambia e' il numero in euro mostrato all'utente.
  const r = await conta(
    [{t:U(1,12), cap:20000}, {t:U(2,12), cap:20000}, {t:U(3,12), cap:18800}],
    10000, U(2,0)
  );
  assert.equal(r.esito, 'finita');
  assert.equal(r.esitoData, '2026-01-03');
  assert.ok(Math.abs(r.maxDDGiorno - 6) < 0.001, 'il drawdown del giorno resta il 6%');
  assert.ok(Math.abs(r.profFinale + 6) < 0.001, 'il profitto dall\'apertura resta -6%');
});

test('anche l\'obiettivo +10% si misura sul conto iniziale', async () => {
  // Dal giorno dell'apertura il conto sale del 10% sulla curva vera (da 30.000 a 33.000): con il
  // conto iniziale di 10.000 l'obiettivo e' 11.000, e si raggiunge.
  //
  // ALLUNGATO IL 28 OTTOBRE 2026 col passo 3, per la regola dei 4 giorni minimi (vedi il test
  // piu' sopra). Quello che questo test afferma non cambia: le percentuali sono rapporti, quindi
  // una salita del 10% sulla curva vera resta una salita del 10% riportata sul conto iniziale,
  // che la si faccia in un giorno o in cinque.
  const r = await conta(
    [{t:U(1,12), cap:30000}, {t:U(2,12), cap:30600}, {t:U(3,12), cap:31200},
     {t:U(4,12), cap:31800}, {t:U(5,12), cap:32400}, {t:U(6,12), cap:33000}],
    10000, U(2,0)
  );
  // Come sopra: si guarda la SFIDA 1. Il verdetto finale resta «ok» perche' la sfida 2 non ha
  // ancora avuto giornate in cui giocarsi - e dirlo «sbloccato» sarebbe falso.
  assert.equal(r.fasi[0].esito, 'passata');
  assert.equal(r.base, 10000);
  assert.equal(r.fasi[0].data, '2026-01-06');
});

// ---------------------------------------------------------------------------------------------
// RICHIESTO dal proprietario: accendendo l'interruttore della prop dedicata, la data e ora di
// apertura torna a ZERO. Prima restava quella dell'ultima prova, e riaccendendo la prop si vedeva
// subito il verdetto di allora (sbloccata / finita) senza aver scelto niente.
test('accendendo la prop dedicata la data di apertura torna vuota', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const att = document.getElementById('fblCronoPfAtt');
      const dt = document.getElementById('fblCronoPfData');
      dt.value = '2026-01-02T08:00';          // la data della prova precedente
      att.checked = true;                      // si accende adesso
      att.dispatchEvent(new Event('change', {bubbles:true}));
      return {data: dt.value, salvato: localStorage.getItem('fbl_prop_sala:' + (document.getElementById('fblCronoSala').value||''))};
    });
    assert.equal(r.data, '', 'la data deve tornare vuota, da riscrivere');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('spegnendo la prop la data NON viene toccata: si spegne, non si cancella una scelta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const att = document.getElementById('fblCronoPfAtt');
      const dt = document.getElementById('fblCronoPfData');
      dt.value = '2026-01-02T08:00';
      att.checked = false;
      att.dispatchEvent(new Event('change', {bubbles:true}));
      return dt.value;
    });
    assert.equal(r, '2026-01-02T08:00');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// RICHIESTO: il pulsante "Ho capito - il limite del 5% non vale piu'" azzera la data di apertura,
// ma SOLO se il pop-up veniva dalla cronologia delle sale (lo stesso pulsante lo usano anche la
// Prop Firm su conto MT5 reale e quella di Kraken).
test('il pulsante del pop-up «sbloccata» chiede l\'azzeramento della data', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const prima = typeof window.fblPropDedicataAzzeraApertura;
      // Senza il segno "il pop-up viene da qui" non deve azzerare niente: la Prop Firm generale
      // non c'entra con la cronologia delle sale.
      const senzaSegno = window.fblPropDedicataAzzeraApertura();
      let chiamate = 0;
      window.fblPropDedicataAzzeraApertura = () => { chiamate++; return true; };
      document.getElementById('pfSbloccataOkBtn').click();
      return {prima, senzaSegno, chiamate, chiuso: document.getElementById('pfSbloccataOverlay').style.display};
    });
    assert.equal(r.prima, 'function', 'la cronologia deve esporre l\'azzeramento della data');
    assert.equal(r.senzaSegno, false, 'un pop-up che non viene dalla cronologia non deve azzerare la data');
    assert.equal(r.chiamate, 1, 'premendo "Ho capito" si deve chiedere l\'azzeramento');
    assert.equal(r.chiuso, 'none', 'il pop-up si chiude comunque');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
