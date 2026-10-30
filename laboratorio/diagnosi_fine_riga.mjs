// DIAGNOSI (sola misura): i fine-riga di app.html nei commit in questione. Serve a stabilire
// se il push 66b5d6e ha cambiato SOLO i fine-riga (e quindi non puo' aver rotto un test).
import {execSync} from 'node:child_process';
const RIP = 'C:\\Users\\pietro\\Documents\\GitHub\\Forex-Backtest.LAB';
for (const c of ['7cf609b','66b5d6e','717a7ec','HEAD']) {
  const buf = execSync(`git -C "${RIP}" cat-file blob ${c}:app.html`, {maxBuffer: 1<<28});
  let cr=0, lf=0, ultimo=0;
  for (const x of buf) { if (x===13) cr++; if (x===10) { lf++; ultimo=x; } }
  console.log(`${c.padEnd(8)} byte=${buf.length} CR=${cr} LF=${lf} -> ${
    (cr===lf ? 'CRLF' : 'LF')}`);
}
// E la copia di lavoro (quella con cui girano i test locali).
import fs from 'node:fs';
const w = fs.readFileSync(RIP + '\\app.html');
let crw=0, lfw=0; for (const x of w) { if (x===13) crw++; if (x===10) lfw++; }
console.log(`lavoro   byte=${w.length} CR=${crw} LF=${lfw} -> ${crw===lfw?'CRLF':'LF'}`);
