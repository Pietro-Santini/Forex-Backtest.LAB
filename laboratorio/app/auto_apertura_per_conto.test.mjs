// L'INTERRUTTORE «APRI LE POSIZIONI IN AUTOMATICO» E' DI QUEL CONTO, NON DI QUELLO A SCHERMO.
//
// SEGNALATO dal proprietario il 12 novembre 2026, e gli e' costato un conto vero:
//   «per colpa di questa cosa questa notte ci ho chiuso un conto, ci ho chiuso una prop firm.
//    Mi ha aperto delle posizioni dove io gli avevo detto di non aprire le posizioni in
//    automatico: invece ha preso l'impostazione dell'altro conto e l'ha applicata.»
//
// CAUSA MISURATA: `tgAutoDecidi(voce, contoKey)` RICEVEVA il conto su cui si sta per aprire e non
// lo usava. Dentro chiamava `tgAutoPerSimbolo()`, che passa da `tgAutoDi()` -> `tgAutoRisolvi(fam)`
// senza conto; quello ripiega su `tgAutoContoSelezionato`, cioe' il conto aperto nel PANNELLO
// delle impostazioni, oppure sulla configurazione base. Cosi' l'interruttore di un conto decideva
// per un altro. La funzione giusta esisteva gia' accanto, inutilizzata:
// `tgAutoPerSimbodoEConto(strumento, contoKey)`.
//
// Queste prove misurano la DECISIONE, non il testo del sorgente: si chiede a tgAutoDecidi cosa
// farebbe, con due conti configurati in modo opposto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const CONTO_SPENTO = '111111@PropFirm-Server';   // qui l'utente ha DETTO di non aprire
const CONTO_ACCESO = '222222@Demo-Server';       // qui ha lasciato acceso

// Prepara due conti con l'interruttore opposto, e un segnale valido appena arrivato.
const SCENA = (dati) => {
  const {spento, acceso} = dati;
  liveModeActive = true; mt5Connected = true;
  // due blocchi per conto: uno spento, uno acceso. La forma e' quella di tgAutoPerConto.
  const base = JSON.parse(JSON.stringify(tgAutoFx));
  base.sale = base.sale || {};
  const fatto = (attivo) => {
    const c = JSON.parse(JSON.stringify(base));
    c.attivo = attivo;
    c.universale = {attivo: true, rischio: 1, maxPosizioni: 1,
                    regole: (typeof tgAutoRegolePrudenti === 'function') ? tgAutoRegolePrudenti() : {},
                    avvicinamento: 100, quote: [], modo: 'posizioni'};
    c.etaMaxS = 86400;          // niente scarti per ritardo: qui si misura l'interruttore
    return c;
  };
  tgAutoPerConto[spento] = {fx: fatto(false), cr: fatto(false)};
  tgAutoPerConto[acceso] = {fx: fatto(true),  cr: fatto(true)};
  // La configurazione BASE e' ACCESA: e' il caso peggiore, quello che ha fatto il danno.
  tgAutoFx.attivo = true;
  if (tgAutoFx.universale) tgAutoFx.universale.attivo = true;

  const voce = {
    id: 'prova-1', at: Date.now(), sala: 'Sala di prova',
    segnale: {strumento: 'XAUUSD', direzione: 'BUY', entrata: null,
              stop_loss: 3900, take_profit: [4100],
              testo: 'BUY XAUUSD', direzione_esplicita: true},
  };
  const esito = (k) => {
    try { return tgAutoDecidi(voce, k); }
    catch (e) { return {errore: String(e && e.message ? e.message : e)}; }
  };
  return {
    suSpento: esito(spento),
    suAcceso: esito(acceso),
    senzaConto: esito(null),
    // il conto aperto nel PANNELLO e' quello acceso: e' la trappola che faceva il danno
    conPannelloSulAcceso: (() => { tgAutoContoSelezionato = acceso; return esito(spento); })(),
  };
};

test('un conto con l\'apertura automatica SPENTA non apre, nemmeno se un altro conto ce l\'ha accesa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(SCENA, {spento: CONTO_SPENTO, acceso: CONTO_ACCESO});
    console.log('decisioni:', JSON.stringify(r, null, 1));

    assert.ok(!r.suSpento.errore, 'la decisione non deve sollevare: ' + r.suSpento.errore);
    assert.equal(r.suSpento.apri, false,
      'IL DIFETTO CHE HA CHIUSO UNA PROP FIRM: su un conto con l\'interruttore spento non si apre. ' +
      JSON.stringify(r.suSpento));
    assert.match(String(r.suSpento.motivo || ''), /spenta/i,
      'e il motivo deve dire che e\' spenta PER QUEL CONTO: ' + r.suSpento.motivo);
  } finally { await browser.close(); }
});

test('e non cambia niente se nel pannello e\' aperto il conto che ce l\'ha accesa', async () => {
  // E' esattamente la trappola: `tgAutoContoSelezionato` e' il conto aperto nelle IMPOSTAZIONI,
  // e prima decideva lui. Chi guarda un conto mentre un segnale arriva per un altro non deve
  // poter cambiare quello che succede sui soldi.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(SCENA, {spento: CONTO_SPENTO, acceso: CONTO_ACCESO});
    assert.equal(r.conPannelloSulAcceso.apri, false,
      'con il pannello aperto sul conto acceso, un segnale per il conto SPENTO non deve aprire: ' +
      JSON.stringify(r.conPannelloSulAcceso));
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: sul conto con l\'interruttore ACCESO la decisione passa', async () => {
  // Senza questa, la cura potrebbe essere «non apre mai piu' niente», che non e' una cura.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(SCENA, {spento: CONTO_SPENTO, acceso: CONTO_ACCESO});
    assert.ok(!r.suAcceso.errore, 'la decisione non deve sollevare: ' + r.suAcceso.errore);
    assert.notEqual(String(r.suAcceso.motivo || ''), 'apertura automatica spenta',
      'sul conto acceso non deve fermarsi sull\'interruttore: ' + JSON.stringify(r.suAcceso));
  } finally { await browser.close(); }
});

test('se il conto non si sa, non si apre', async () => {
  // Su soldi veri «non lo so» non puo' valere «fai pure»: e' la stessa regola gia' scelta per le
  // posizioni di un altro conto a grafico (v2.2.28).
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(SCENA, {spento: CONTO_SPENTO, acceso: CONTO_ACCESO});
    assert.equal(r.senzaConto.apri, false,
      'senza sapere il conto di destinazione non si puo' + '\' aprire: ' + JSON.stringify(r.senzaConto));
    assert.match(String(r.senzaConto.motivo || ''), /conto/i,
      'e il motivo deve dirlo chiaramente: ' + r.senzaConto.motivo);
  } finally { await browser.close(); }
});
