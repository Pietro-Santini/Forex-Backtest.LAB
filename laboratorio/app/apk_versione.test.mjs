// L'APK DEVE PORTARE DENTRO LA STESSA VERSIONE DEL REPOSITORY.
//
// MISURATO il 20 ottobre 2026: l'APK pubblicato come "v2.0.9" conteneva dentro se' uno sw.js
// con CACHE_NAME "forex-backtest-lab-v2.0.8" (era stato copiato PRIMA di alzare la versione, e
// poi non era stato ricopiato). Conseguenza per l'utente, sul telefono: il pulsante "Aggiorna"
// era SEMPRE visibile, perche' l'app credeva di essere alla 2.0.8 mentre la release era la 2.0.9 -
// e premendolo propose di scaricare di nuovo la 2.0.9, per sempre. Sembrava un difetto della
// logica di versione: era invece il pacchetto fuori data.
//
// LA REGOLA: il numero di versione sta in tre posti (sw.js, installer.iss, e il sw.js dentro
// l'APK). Se uno dei tre e' indietro, l'utente vede un pulsante che non si spegne.
//
// Questo test confronta il CACHE_NAME del sw.js del repository con quello del sw.js davvero
// dentro l'APK costruito (quando il progetto mobile e' presente sul computer: sta FUORI dal
// repository, quindi su GitHub il test salta).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROGETTO_MOBILE = 'C:\\Users\\pietro\\Desktop\\trading\\forex-backtest-mobile';
const SALTO = 'il progetto mobile sta fuori dal repository (sul computer del proprietario): ' +
  'la versione dentro l\'APK si controlla l\u00ec, in locale';

function versioneDaTesto(testo) {
  const m = /CACHE_NAME\s*=\s*["']forex-backtest-lab-v([\d.]+)["']/.exec(testo);
  return m ? m[1] : null;
}

test('la versione dentro l\'APK e\' la stessa del repository (il pulsante "Aggiorna" deve spegnersi)',
  {skip: fs.existsSync(PROGETTO_MOBILE) ? false : SALTO}, () => {
  const swDelRepository = fs.readFileSync(path.join(RADICE, 'sw.js'), 'utf8');
  const versioneRepository = versioneDaTesto(swDelRepository);
  assert.ok(versioneRepository, 'non si legge la versione dal sw.js del repository');

  // Il sw.js davvero incorporato nell'APK (non la copia nella cartella www: e' l'APK che
  // l'utente installa, ed e' li' che il difetto si vedeva).
  const apk = path.join(PROGETTO_MOBILE, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  assert.ok(fs.existsSync(apk),
    'non c\'e\' l\'APK costruito in ' + apk + ': compila l\'APK e poi riprova (il collaudo ' +
    'della versione si fa sul pacchetto, non sulla cartella)');

  // Si legge il file dentro l'APK (che e' uno zip) senza spacchettarlo tutto.
  const elenco = execFileSync('tar', ['-tf', apk], {encoding: 'utf8', timeout: 60000});
  const dentro = elenco.split('\n').map(r => r.trim()).filter(r => /assets\/public\/sw\.js$/.test(r));
  assert.equal(dentro.length, 1, 'nell\'APK deve esserci un solo sw.js (public): trovati ' + dentro.length);

  const swDellApk = execFileSync('tar', ['-xOf', apk, dentro[0]], {encoding: 'utf8', timeout: 60000});
  const versioneApk = versioneDaTesto(swDellApk);
  assert.equal(versioneApk, versioneRepository,
    'l\'APK porta dentro la versione ' + versioneApk + ' e il repository la ' + versioneRepository +
    ': l\'app crede di essere vecchia e propone l\'aggiornamento per sempre');
});
