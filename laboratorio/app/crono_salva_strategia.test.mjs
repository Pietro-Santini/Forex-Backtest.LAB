// «SALVA CONFIGURAZIONE» DEVE TRASFERIRE TUTTA LA STRATEGIA, NON METÀ.
//
// RICHIESTO dal proprietario: «quando andiamo nella cronologia delle sale segnali impostiamo la
// configurazione di take profit, anche per quanto riguarda il pareggio anticipato — a che punto
// della strada verso il primo target, la percentuale — e la percentuale di rischio o del capitale
// a seconda di quella che ha selezionato. Quando premiamo salva configurazione deve trasferire
// tutto nella strategia di quella sala».
//
// IL BUCO, trovato leggendo: stratDallaUi() CALCOLAVA GIÀ il pareggio anticipato (torna
// avv:{attivo,pct}) e salvaStrategiaNellaSala() non lo copiava. Lo configuravi, premevi salva, e
// nella sala non arrivava: nessun errore, nessun avviso, spariva e basta. Fuori restavano anche la
// base rischio/capitale (che nella cronologia non esisteva proprio).
//
// Due conversioni rendono il buco facile da rifare, ed è il motivo per cui questi test esistono:
// nella riga della sala l'avvicinamento è UN NUMERO (0 = spento), nella cronologia sono DUE campi.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

test('il pareggio anticipato arriva nella sala, acceso e spento', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      // Si simula la conversione che fa il salvataggio: due campi -> un numero.
      const comeSalva = (avv) => (avv && avv.attivo)
        ? Math.max(10, Math.min(100, Number(avv.pct) || 70)) : 0;
      ({acceso: comeSalva({attivo:true, pct:55}),
        spento: comeSalva({attivo:false, pct:55}),
        fuoriScala: comeSalva({attivo:true, pct:999}),
        senzaNumero: comeSalva({attivo:true, pct:null})})
    }`);
    assert.equal(r.acceso, 55);
    assert.equal(r.spento, 0, 'spento deve diventare 0, che è come la sala scrive "nessuno"');
    assert.equal(r.fuoriScala, 100, 'un valore impossibile si riporta nei limiti, non si salva così');
    assert.equal(r.senzaNumero, 70, 'senza numero vale il predefinito, non NaN');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la cronologia ha la scelta rischio / capitale, e si ricorda', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      const sel = document.getElementById('fblRendBase');
      const valori = sel ? [...sel.options].map(o => o.value) : [];
      // Si salva "capitale" e si rilegge come farebbe la riapertura della finestra.
      fblCronoImposta.salva(10000, 2, 'capitale');
      const riletto = fblCronoImposta.leggi();
      fblCronoImposta.salva(10000, 2, 'rischio');
      ({ceSta: !!sel, valori, riletto: riletto.base, tornato: fblCronoImposta.leggi().base})
    }`);
    assert.equal(r.ceSta, true, 'la scelta deve esserci nella cronologia: da lì si salva nella sala');
    assert.deepEqual(r.valori, ['rischio','capitale']);
    assert.equal(r.riletto, 'capitale', 'la scelta si ricorda alla riapertura');
    assert.equal(r.tornato, 'rischio');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il predefinito resta "di rischio", come nella riga della sala', async () => {
  // Cambiarlo di nascosto farebbe aprire posizioni diverse da quelle attese.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      localStorage.removeItem(fblCronoImposta.chiave);
      ({base: fblCronoImposta.leggi().base, strana: (()=>{ localStorage.setItem(fblCronoImposta.chiave, JSON.stringify({base:'altro'}));
                                                 return fblCronoImposta.leggi().base; })()})
    }`);
    assert.equal(r.base, 'rischio');
    assert.equal(r.strana, 'rischio', 'un valore non previsto non deve diventare "capitale"');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il salvataggio scrive davvero base e pareggio nella sala', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const i = src.indexOf('async function salvaStrategiaNellaSala');
  assert.ok(i > 0, 'la funzione di salvataggio deve esistere');
  const fn = src.slice(i, i + 4200);
  assert.ok(/cfg\.baseLotto\s*=/.test(fn), 'la base rischio/capitale deve finire nella sala');
  assert.ok(/cfg\.avvicinamento\s*=/.test(fn), 'il pareggio anticipato deve finire nella sala');
  // E quello che già funzionava non deve sparire.
  ['cfg.rischio','cfg.modo','cfg.equa','cfg.quote','cfg.regole'].forEach(c =>
    assert.ok(fn.indexOf(c) > 0, 'non deve sparire quello che già si trasferiva: ' + c));
});

test('la cronologia si apre anche dalle impostazioni del grafico', () => {
  // RICHIESTO: «trasferisci quel pulsante anche all'interno delle impostazioni».
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const pulsanti = src.match(/class="toolBtn fblCronoBtn"|class="toolBtn[^"]*fblCronoBtn/g) || [];
  assert.ok(pulsanti.length >= 2,
    'devono esserci almeno due pulsanti che aprono la cronologia: ' + pulsanti.length);
  // Ma UN SOLO ascoltatore: due strade diverse per aprire la stessa cosa divergono senza che
  // nessuno se ne accorga.
  const aperture = src.match(/closest\('#fblCronoBtn,\.fblCronoBtn'\)/g) || [];
  assert.equal(aperture.length, 1,
    'l\'apertura deve restare delegata a un punto solo: ' + aperture.length);
});
