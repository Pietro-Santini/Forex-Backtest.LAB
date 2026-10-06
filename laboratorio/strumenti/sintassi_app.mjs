// Controllo veloce: tutti gli <script> di app.html si compilano (errore di sintassi = app bianca).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = process.argv[2] || path.join(radice, 'app.html');
const s = fs.readFileSync(file, 'utf8');
let errori = 0, n = 0;
s.replace(/<script(?![^>]*type=["']module)(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g, (m, c) => {
  n++; try { new Function(c); } catch (x) { errori++; console.log('ERRORE di sintassi nello script n.' + n + ': ' + x.message); }
});
console.log(path.basename(file) + ': ' + n + ' script, ' + errori + ' errori di sintassi');
process.exit(errori ? 1 : 0);
