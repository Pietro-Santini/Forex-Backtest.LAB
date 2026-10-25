// IL CONTROLLO CHE L'APK ABBIA LE ICONE INTATTE.
//
// Il 25 ottobre 2026 l'APK v2.0.27 è finito in release con tutte le icone rotte e nessun
// collaudo se n'era accorto, perché il collaudo guarda il repository (sano) e non il pacchetto
// Android. Questo test misura lo strumento che quella sera mancava: gli si dà un APK (uno zip
// con dentro assets/public/app.html) e deve dire OK se le emoji sono vere, KO se sono mojibake.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RADICE} from './aiuti.mjs';

const STRUMENTO = path.join(RADICE, 'strumenti', 'controlla_icone_apk.py');

function python(argomenti){
  let r = spawnSync('python', argomenti, {encoding: 'utf8'});
  if(r.error && r.error.code === 'ENOENT') r = spawnSync('python3', argomenti, {encoding: 'utf8'});
  return r;
}

// Costruisce un APK finto (zip con dentro assets/public/app.html) con il testo dato.
// Lo zip lo fa Python, così il test non porta in giro un formato scritto a mano.
function apkFinto(cartella, nome, html){
  const sorgente = path.join(cartella, nome + '.html');
  const apk = path.join(cartella, nome);
  fs.writeFileSync(sorgente, Buffer.from(html, 'utf8'));
  const creatore = path.join(cartella, 'crea_zip.py');
  fs.writeFileSync(creatore, [
    'import sys, zipfile',
    'with zipfile.ZipFile(sys.argv[1], "w") as z:',
    '    z.writestr("assets/public/app.html", open(sys.argv[2], "rb").read())',
    ''
  ].join('\n'), 'utf8');
  const r = python([creatore, apk, sorgente]);
  assert.equal(r.status, 0, 'lo zip di prova non è stato creato: ' + (r.stderr || ''));
  return apk;
}

test('il controllo delle icone dice OK su un APK sano e KO su uno rovinato', () => {
  const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'fbl-icone-'));
  try{
    const sano = apkFinto(cartella, 'sano.apk',
      '<meta charset="UTF-8"><button>\uD83D\uDE80 Vai</button><em>\u2014</em>');
    const rovinato = apkFinto(cartella, 'rovinato.apk',
      '<meta charset="UTF-8"><button>\u00F0\u0178\u0161\u20AC Vai</button><em>\u00E2\u20AC\u201D</em>');

    const a = python([STRUMENTO, sano]);
    assert.equal(a.status, 0, 'un APK sano deve passare: ' + a.stdout + a.stderr);
    assert.match(a.stdout, /ESITO: OK/);

    const b = python([STRUMENTO, rovinato]);
    assert.equal(b.status, 1, 'un APK rovinato deve fallire: ' + b.stdout + b.stderr);
    assert.match(b.stdout, /TESTO ROVINATO/);
    assert.match(b.stdout, /ESITO: KO/);
  } finally {
    fs.rmSync(cartella, {recursive: true, force: true});
  }
});
