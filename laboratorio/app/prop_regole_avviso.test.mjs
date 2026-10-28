// LE REGOLE CHE AVVISANO, invece di chiudere il conto.
//
// RICHIESTO dal proprietario: «anche le regole dell'overnight e del trade che non si puo' fare
// sulle notizie devono essere scritte, in modo che venga visualizzato all'utente che non puo'
// effettuare queste cose, altrimenti gli si chiude il conto in gestione».
//
// E LA SUA DOMANDA: «se viene infranta una regola del genere si chiude automaticamente il conto,
// potrebbe essere cosi'?». LA RISPOSTA E' NO, ed e' il motivo per cui questi test esistono.
//
// FTMO scrive: «Violating this rule MAY result in termination of an FTMO Account». "May", non
// "will": e' una revisione umana, non un meccanismo automatico come i due limiti di perdita, che
// invece il sistema misura e che chiudono il conto all'istante.
//
// Trattarle come violazioni automatiche ci renderebbe PIU' SEVERI di FTMO: un conto dichiarato
// violato che in realta' sarebbe ancora vivo e' un risultato sbagliato, anche se prudente. E'
// lo stesso errore evitato con la regola di costanza.
//
// IN PIU' VALGONO SOLO PER IL CONTO STANDARD: lo Swing non ha restrizioni ne' sull'overnight ne'
// sulle notizie (in cambio la leva scende da 1:100 a 1:30). Senza sapere il tipo di conto, quelle
// regole non sanno nemmeno se applicarsi.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

async function nellApp(codice){
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(codice);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    return r;
  } finally { await browser.close(); }
}

test('le restrizioni stanno nel TIPO DI CONTO, non nel preset', async () => {
  // SCRITTO COSI' DOPO AVER PROVATO L'ALTRO MODO. Avevo immaginato le restrizioni dentro il
  // preset, ma non e' li' che vivono: lo STESSO two step si puo' fare Standard o Swing, e
  // cambiano solo le restrizioni. Metterle nel preset avrebbe voluto dire quattro preset invece
  // di due, con le soglie ripetute - e due copie delle stesse soglie divergono sempre.
  //
  // Il preset dice quale tipo di conto e' quello di partenza; le restrizioni le porta il tipo.
  const r = await nellApp(`(function(){
    return {
      presetDiPartenza: window.FBL_PROP_REGOLE['ftmo-2step'].tipoConto,
      standard: window.FBL_PROP_TIPI_CONTO.standard.restrizioni,
      swing:    window.FBL_PROP_TIPI_CONTO.swing.restrizioni
    };
  })()`);
  assert.equal(r.presetDiPartenza, 'standard', 'il preset parte dal conto Standard');
  assert.equal(r.standard.overnight, true, 'lo Standard non puo\' tenere posizioni oltre la chiusura');
  assert.equal(r.standard.notizie, true, 'e non puo\' operare sulle notizie');
  assert.equal(r.swing.overnight, false, 'lo Swing puo\' tenerle');
  assert.equal(r.swing.notizie, false, 'e puo\' operare sulle notizie');
});

test('passando a Swing le restrizioni spariscono', async () => {
  // PROVA DI CONTROLLO: se le restrizioni fossero scritte fisse nel codice invece di arrivare
  // dal tipo di conto, qui resterebbero accese - e l'app direbbe a chi ha uno Swing che non puo'
  // fare cose che invece puo' fare.
  const r = await nellApp(`(function(){
    window.fblPropTipoContoImposta('swing');
    const a = window.fblPropRegoleAttive();
    return {tipo:a.tipoConto, overnight:a.restrizioni.overnight, notizie:a.restrizioni.notizie};
  })()`);
  assert.equal(r.tipo, 'swing');
  assert.equal(r.overnight, false, 'lo Swing puo\' tenere posizioni oltre la chiusura');
  assert.equal(r.notizie, false, 'e puo\' operare sulle notizie');
});

test('le notizie AVVISANO, non bloccano piu\' l\'ordine', async () => {
  // Prima blockedByPropFirmNews() impediva l'ordine. Ma FTMO non blocca: registra, e semmai
  // rivede il conto dopo. Impedire l'operazione significa dare all'utente un'app che si comporta
  // diversamente dal conto vero, e abituarlo a una protezione che nella realta' non c'e'.
  const r = await nellApp(`(function(){
    isPropFirmMode = true; liveModeActive = true;
    window.fblPropTipoContoImposta('standard');
    const prima = fblPropAvvisi ? fblPropAvvisi().length : -1;
    const bloccato = blockedByPropFirmNews();
    return {bloccato, prima};
  })()`);
  assert.equal(r.bloccato, false,
    'l\'ordine non si blocca: FTMO non lo impedisce, e un\'app che lo impedisce insegna una cosa falsa');
});

test('PROVA DI CONTROLLO: il conto VIOLATO blocca ancora tutto', async () => {
  // Ammorbidire le restrizioni non deve ammorbidire le violazioni vere. Con un conto chiuso per
  // superamento del limite di perdita, nessuna operazione nuova deve passare.
  const r = await nellApp(`(function(){
    isPropFirmMode = true; liveModeActive = true;
    propFirmViolation = {rule:'daily', dailyLoss:9999};
    return {bloccato: blockedByPropFirmNews()};
  })()`);
  assert.equal(r.bloccato, true,
    'con il conto gia\' violato si blocca eccome: quella non e\' una restrizione, e\' una chiusura');
});

test('gli avvisi si possono leggere, e dicono cosa rischi', async () => {
  // Non basta che la regola esista nel codice: il proprietario ha chiesto che sia SCRITTA e
  // VISIBILE. Un avviso che non si puo' mostrare non protegge nessuno.
  const r = await nellApp(`(function(){
    isPropFirmMode = true;
    window.fblPropTipoContoImposta('standard');
    const a = window.fblPropAvvisi();
    return {quanti:a.length, testi:a.map(x=>x.testo).join(' | ')};
  })()`);
  assert.ok(r.quanti >= 2, 'con lo Standard ci sono almeno due restrizioni da dire, erano ' + r.quanti);
  assert.ok(/chiusur|termin|conto/i.test(r.testi),
    'e devono dire cosa si rischia, non solo che la regola esiste');
});
