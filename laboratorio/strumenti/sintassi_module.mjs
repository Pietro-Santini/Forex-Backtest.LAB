// Controllo di sintassi dei <script type="module"> di login.html (node --check).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = process.argv[2] || path.join(radice, 'login.html');
const s = fs.readFileSync(file, 'utf8');
let errori = 0, n = 0;
const re = /<script(?=[^>]*type=["']module["'])(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(s)) !== null) {
  n++;
  const tmp = path.join(os.tmpdir(), 'fbl_mod_' + process.pid + '_' + n + '.mjs');
  fs.writeFileSync(tmp, m[1], 'utf8');
  try {
    execFileSync(process.execPath, ['--check', tmp], {stdio: 'pipe'});
  } catch (e) {
    errori++;
    console.log('ERRORE di sintassi nel module n.' + n + ': ' + (e.stderr ? e.stderr.toString().split('\n').slice(0, 4).join(' | ') : e.message));
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) {}
  }
}
console.log(path.basename(file) + ': ' + n + ' module, ' + errori + ' errori di sintassi');
process.exit(errori ? 1 : 0);
