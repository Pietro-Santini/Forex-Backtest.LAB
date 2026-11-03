// IN REPLAY UN ORDER BLOCK SI MITIGA SOLO QUANDO IL MERCATO CI TORNA DAVVERO.
//
// SEGNALATO dal proprietario (3 novembre 2026): "in modalità replay, l'indicatore order blocks,
// quando avanziamo, ci fa vedere che l'order block è già stato mitigato, invece no, deve
// risultare mitigato soltanto quando il mercato ci torna in quella zona, come se fosse un order
// block che si genera in tempo reale e poi il mercato, quando ci torna su quell'order block,
// allora viene mitigato. Non può essere mitigato appena si forma. In modalità replay deve
// seguire la stessa logica identica della modalità reale. Importantissimo per il backtest."
//
// CAUSA MISURATA (leggendo il codice, prima della cura): il calcolo degli indicatori è
// INCREMENTALE. compute() riparte da st.builtTo+1 e arriva a upToIdx, e st.builtTo viene
// azzerato SOLO se cambia l'array rows o i parametri. Nel replay l'array rows è sempre lo
// stesso (è lo storico), quindi:
//   - avanzando fino alla candela della mitigazione, la zona viene segnata mitigata;
//   - TORNANDO INDIETRO col replay, upToIdx è più piccolo di builtTo, il ciclo
//     for(i=builtTo+1; i<=upToIdx; ...) non gira affatto e la zona RESTA mitigata,
//     con l'indice del tocco futuro.
// Cioè: nel replay si vede una mitigazione che deve ancora avvenire. Per un backtest è
// guardare nel futuro: il difetto peggiore possibile.
//
// Come si misura: UN indicatore solo (come nell'app, che lo tiene in activeIndicators), e
// compute() chiamata avanti e indietro, come fa il replay ad ogni fotogramma.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Le stesse candele della prova "struttura" dell'indicatore reale: l'OB nasce alla rottura di
// struttura (barra 6) e il prezzo ci torna dentro alla barra 7.
const STRUTTURA = [
  [100, 101, 99, 100],
  [100, 102, 100, 101],
  [101, 103, 100.5, 102],   // pivot high confermato (pivotLen=2), massimo 103
  [102, 102.5, 101, 101.5],
  [101.5, 102, 100.8, 101],
  [101, 102, 100, 101],     // candela origine del movimento (minimo più basso: 100)
  [101, 103.5, 100.9, 103.5], // ROTTURA: nasce l'OB rialzista
  [103, 103.2, 101, 101.2]  // il prezzo TORNA nella zona: mitigazione
];

// Dentro la pagina: preparo l'indicatore (uno solo, come fa l'app), poi chiamo compute()
// AVANTI e INDIETRO, e leggo le zone. Tutto inline, come negli altri test dell'indicatore.
const AVANTI_E_INDIETRO = (spec) => {
  const def = INDICATOR_DEFS['order_blocks'];
  const ind = hydrateIndicators([{id: 1, key: 'order_blocks', params: def.defaultParams()}])[0];
  ind.params.pivotLen = 2;
  ind.params.regola = 'struttura';
  const R = spec.map((a, i) => ({
    date: new Date(Date.UTC(2024, 0, 1, 0, i, 0)).toISOString(),
    open: a[0], high: a[1], low: a[2], close: a[3], volume: 100
  }));
  rows = R;
  const leggi = () => (ind.calc.zones || []).map(z => ({
    x1: z.x1, creato: z.creato, mitigated: z.mitigated, mitIdx: z.mitIdx
  }));
  // 1) replay AVANTI fino all'ultima candela: lì il prezzo è tornato nella zona.
  def.compute(R, R.length - 1, ind);
  const avanti = leggi();
  // 2) replay INDIETRO fino alla candela della rottura (prima del ritorno nella zona):
  //    STESSO indicatore, come fa l'app (activeIndicators non viene ricreato).
  def.compute(R, 6, ind);
  const indietro = leggi();
  return {avanti, indietro, builtToDopo: ind.calc.builtTo};
};

const AVANTI_INDIETRO_AVANTI = (spec) => {
  const def = INDICATOR_DEFS['order_blocks'];
  const ind = hydrateIndicators([{id: 1, key: 'order_blocks', params: def.defaultParams()}])[0];
  ind.params.pivotLen = 2;
  ind.params.regola = 'struttura';
  const R = spec.map((a, i) => ({
    date: new Date(Date.UTC(2024, 0, 1, 0, i, 0)).toISOString(),
    open: a[0], high: a[1], low: a[2], close: a[3], volume: 100
  }));
  rows = R;
  def.compute(R, R.length - 1, ind);   // avanti
  def.compute(R, 6, ind);              // indietro
  def.compute(R, R.length - 1, ind);   // di nuovo avanti
  return {
    zone: (ind.calc.zones || []).map(z => ({mitigated: z.mitigated, mitIdx: z.mitIdx})),
    builtTo: ind.calc.builtTo
  };
};

test('tornando indietro nel replay, un OB mitigato nel futuro ridiventa VIVO', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(AVANTI_E_INDIETRO, STRUTTURA);
    // Andando avanti: la zona nasce e viene mitigata (comportamento giusto a fine corsa).
    assert.ok(r.avanti.length >= 1, 'avanti deve esserci almeno una zona');
    assert.equal(r.avanti[0].mitigated, true, 'a fine corsa la zona dev\'essere mitigata');
    assert.equal(r.avanti[0].mitIdx, 7, 'la zona si deve fermare alla candela del ritorno (7)');

    // Tornando INDIETRO alla barra 6: il mercato NON è ancora tornato nella zona.
    assert.equal(r.builtToDopo, 6,
      'tornando indietro il calcolo deve rifarsi fino alla candela 6 (adesso resta a 7)');
    assert.equal(r.indietro.length, 1, 'indietro deve restare la sola zona vera');
    assert.equal(r.indietro[0].mitigated, false,
      'tornando indietro alla barra 6 l\'OB NON è ancora mitigato: il mercato non ci è tornato');
    assert.equal(r.indietro[0].mitIdx, null, 'e l\'indice del tocco non deve esistere');
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: riavanzando, la zona si rimitiga da sola', async () => {
  // Senza questa prova il difetto si "sistemerebbe" annullando la mitigating per sempre.
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(AVANTI_INDIETRO_AVANTI, STRUTTURA);
    assert.equal(r.builtTo, STRUTTURA.length - 1, 'il calcolo deve tornare all\'ultima candela');
    assert.equal(r.zone[0].mitigated, true,
      'riavanzando, il ritorno del prezzo deve mitigare di nuovo la zona');
    assert.equal(r.zone[0].mitIdx, 7);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
  } finally { await browser.close(); }
});
