// RISCHIO O CAPITALE: LA SCELTA DELLA SALA VINCE SU QUELLA GENERALE.
//
// CHIESTO dal proprietario: «nei livelli comuni a tutte le posizioni c'e' il livello di stop loss
// e poi il rischio totale: quello possiamo cambiarlo tra rischio e capitale, come nella
// configurazione delle strategie. E ovviamente cambia di gran lunga per le posizioni di
// criptovalute».
//
// LE DUE COSE NON SONO LA STESSA (sta scritto per esteso sopra tgAutoPerSimbolo, con l'esempio di
// SOL portato dal proprietario stesso):
//   - RISCHIO: resta fissa la PERDITA. Il 5% = «se parte lo stop perdo 500». Con uno stop stretto
//     la posizione diventa enorme e il margine imprevedibile;
//   - CAPITALE: resta fissa la SPESA. Il 5% = «la posizione vale 500». Il margine e' prevedibile,
//     ed e' quasi sempre quello che si intende sulle cripto.
//
// COSA C'ERA GIA', verificato prima di scrivere: il CALCOLO, dentro tgPiano (opz.base). Mancava
// poterlo scegliere PER SALA invece che solo nell'impostazione generale.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('la scelta della sala vince su quella generale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      salaCapitale: tgBaseDi({base: 'capitale'}, 'rischio'),
      salaRischio: tgBaseDi({base: 'rischio'}, 'capitale'),
      salaVuota: tgBaseDi({}, 'capitale'),
      senzaSala: tgBaseDi(null, 'capitale'),
      nessunaDelleDue: tgBaseDi(null, null),
      valoreAssurdo: tgBaseDi({base: 'pinco'}, 'capitale')
    }));
    assert.equal(r.salaCapitale, 'capitale', 'la sala dice capitale: vale capitale');
    assert.equal(r.salaRischio, 'rischio', 'e viceversa');
    assert.equal(r.salaVuota, 'capitale', 'sala senza scelta: vale l\'impostazione generale');
    assert.equal(r.senzaSala, 'capitale', 'nessuna sala: idem');
    assert.equal(r.nessunaDelleDue, 'rischio',
      'senza niente si resta su RISCHIO, che e\' il comportamento di sempre: cambiarlo in '
      + 'silenzio farebbe aprire a tutte le sale posizioni di taglia diversa da quella attesa');
    assert.equal(r.valoreAssurdo, 'capitale', 'un valore non previsto non deve decidere niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('chi apre passa davvero la scelta della sala, non quella generale', async () => {
  // Il legame fra la tendina e il calcolo: una scelta che non arriva a chi apre non serve a niente.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const src = document.documentElement.outerHTML;
      return (src.match(/base:tgBaseDi\(d\.cfg,d\.base\)/g) || []).length;
    });
    assert.ok(r >= 2, 'tutti e due i percorsi di apertura (Capital e MT5) devono usarla: ' + r);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
