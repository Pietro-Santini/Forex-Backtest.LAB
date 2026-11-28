// Controllo veloce: tutti gli <script> di app.html si compilano (errore di sintassi = app bianca).
// Anche i blocchi type="module" vanno controllati: finche' erano esclusi, un `const x;` senza
// inizializzatore passava inosservato e la pagina si apriva con `SyntaxError: Missing initializer
// in const declaration`. I moduli non si possono passare a new Function (import ES), quindi la
// loro sintassi si valida con `node --check` su un file .mjs temporaneo, senza eseguire gli import.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = process.argv[2] || path.join(radice, 'app.html');
const s = fs.readFileSync(file, 'utf8');
let errori = 0, n = 0;
s.replace(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g, (m, c) => {
  n++;
  const modulo = /\btype=["']module["']/.test(m);
  let errore = null;
  if (modulo) {
    const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'fxbt-sintassi-'));
    const tmp = path.join(cartella, 'blocco-' + n + '.mjs');
    try {
      fs.writeFileSync(tmp, c, 'utf8');
      const r = spawnSync(process.execPath, ['--check', tmp], {encoding: 'utf8'});
      if (r.status !== 0) {
        const righe = String(r.stderr || (r.error && r.error.message) || '').split(/\r?\n/)
          .filter(x => x.trim() && !/^\s+at\s/.test(x) && !/^Node\.js v/.test(x));
        errore = righe.slice(-4).join(' | ') || ('node --check uscito con ' + r.status);
      }
    } catch (x) {
      errore = 'scrittura del file temporaneo non riuscita: ' + x.message;
    } finally {
      // Il file va via anche quando il controllo trova un errore (o --check non parte).
      try { fs.rmSync(cartella, {recursive:true, force:true}); } catch (x) {}
    }
  } else {
    try { new Function(c); } catch (x) { errore = x.message; }
  }
  if (errore) {
    errori++;
    console.log('ERRORE di sintassi nello script n.' + n + (modulo ? ' (modulo)' : '') + ': ' + errore);
  }
});
console.log(path.basename(file) + ': ' + n + ' script, ' + errori + ' errori di sintassi');
process.exit(errori ? 1 : 0);
