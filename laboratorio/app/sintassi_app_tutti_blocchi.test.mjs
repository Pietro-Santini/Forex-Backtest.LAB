// Il controllo di sintassi deve vedere TUTTI i blocchi <script> di app.html, compreso
// <script type="module">. Quel blocco contiene import ES: new Function non lo accetta, quindi
// lo strumento deve usare `node --check` su un .mjs temporaneo. Prima della correzione il blocco
// era escluso e un `const rotto;` passava inosservato al collaudo, rompendo la pagina.
// Il banco misura il COMPORTAMENTO (codice di uscita + messaggi), non il sorgente dello strumento.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STRUMENTO = path.join(RADICE, 'laboratorio', 'strumenti', 'sintassi_app.mjs');
const APP = path.join(RADICE, 'app.html');
// La stringa `<script type="module">` compare anche dentro commenti dell'app: serve l'apertura
// vera, cioè il tag da solo all'inizio di una riga (con a capo Windows: CRLF).
const APERTURA_MODULO = /^<script type="module">[ \t]*\r?$/m;

test('sintassi_app controlla tutti e 6 gli script, anche il modulo', () => {
  const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'fxbt-banco-sintassi-'));
  try {
    const copia = path.join(cartella, 'app.html');
    const pulito = fs.readFileSync(APP, 'utf8');
    const apertura = APERTURA_MODULO.exec(pulito);
    assert.ok(apertura, 'app.html deve contenere il tag di apertura del modulo');
    assert.equal((pulito.match(new RegExp(APERTURA_MODULO.source, 'gm')) || []).length, 1,
      'app.html deve avere un solo blocco modulo');

    // Percorsi assoluti e cartella di lavoro estranea al repo: il risultato non dipende da dove
    // gira il collaudo.
    const esegui = () => spawnSync(process.execPath, [STRUMENTO, copia],
      {encoding: 'utf8', cwd: cartella});
    const esito = (r) => 'uscita ' + r.status + ' stdout: ' + r.stdout + ' stderr: ' + r.stderr;

    // 1) Copia pulita: sei blocchi, nessun errore.
    fs.writeFileSync(copia, pulito, 'utf8');
    let r = esegui();
    assert.equal(r.status, 0, esito(r));
    assert.match(r.stdout, /6 script, 0 errori di sintassi/, esito(r));

    // 2) `const rotto;` dentro il blocco modulo: lo strumento deve accorgersene.
    const tag = apertura[0];
    fs.writeFileSync(copia, pulito.replace(tag, tag + '\nconst rotto;\n'), 'utf8');
    r = esegui();
    assert.equal(r.status, 1, esito(r));
    // Il blocco modulo è il secondo nell'ordine del file (apre alla riga 1169 di app.html).
    assert.match(r.stdout, /script n\.2 \(modulo\)/, esito(r));
    assert.match(r.stdout, /Missing initializer in const declaration/, esito(r));
    assert.match(r.stdout, /6 script, 1 errori di sintassi/, esito(r));

    // 3) Copia ripristinata: torna verde (nessuno stato lasciato dal controllo del modulo).
    fs.writeFileSync(copia, pulito, 'utf8');
    r = esegui();
    assert.equal(r.status, 0, esito(r));
    assert.match(r.stdout, /6 script, 0 errori di sintassi/, esito(r));
  } finally {
    fs.rmSync(cartella, {recursive:true, force:true});
  }
});
