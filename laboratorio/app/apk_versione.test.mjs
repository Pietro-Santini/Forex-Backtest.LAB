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
import zlib from 'node:zlib';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROGETTO_MOBILE = 'C:\\Users\\pietro\\Desktop\\trading\\forex-backtest-mobile';
const SALTO = 'il progetto mobile sta fuori dal repository (sul computer del proprietario): ' +
  'la versione dentro l\'APK si controlla l\u00ec, in locale';

function versioneDaTesto(testo) {
  const m = /CACHE_NAME\s*=\s*["']forex-backtest-lab-v([\d.]+)["']/.exec(testo);
  return m ? m[1] : null;
}

// UN FILE DA DENTRO L'APK, SENZA PROGRAMMI ESTERNI.
//
// La prima stesura chiamava `tar` (`execFileSync('tar', ['-tf', apk])`), e questo collaudo era
// quindi un'opinione: dipendeva da QUALE tar vinceva nel PATH. Con quello di Windows
// (System32\tar.exe, che è bsdtar e sa leggere gli zip) passava; con quello che installa Git
// (GNU tar) cadeva due volte — legge `C:\...` come se `C` fosse un computer remoto («Cannot
// execute remote shell») e comunque non apre gli zip. Stesso file, stesso APK, esito diverso a
// seconda della macchina: è esattamente l'errore già pagato fra la v158 e la v164 (LEZIONI.md).
//
// Un APK è uno zip. Qui lo si legge con il solo Node: si parte dalla coda (End Of Central
// Directory), si scorre l'indice e si decomprime la singola voce che serve. Le dimensioni si
// prendono dall'INDICE e non dall'intestazione locale, perché quando lo zip è scritto in flusso
// l'intestazione locale le porta a zero (descrittore in coda).
function leggiDallaZip(percorsoZip, finisceCon) {
  const buf = fs.readFileSync(percorsoZip);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 70000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('non è uno zip valido: manca la coda dell\'indice');
  const quante = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const trovate = [];
  for (let n = 0; n < quante; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('indice dello zip illeggibile');
    const metodo = buf.readUInt16LE(p + 10);
    const compressa = buf.readUInt32LE(p + 20);
    const lunNome = buf.readUInt16LE(p + 28);
    const lunExtra = buf.readUInt16LE(p + 30);
    const lunNota = buf.readUInt16LE(p + 32);
    const inizioLocale = buf.readUInt32LE(p + 42);
    const nome = buf.toString('utf8', p + 46, p + 46 + lunNome);
    if (nome.endsWith(finisceCon)) trovate.push({nome, metodo, compressa, inizioLocale});
    p += 46 + lunNome + lunExtra + lunNota;
  }
  return {
    quante: trovate.length,
    nomi: trovate.map(v => v.nome),
    contenuto: () => {
      const v = trovate[0];
      if (!v) return null;
      if (buf.readUInt32LE(v.inizioLocale) !== 0x04034b50) throw new Error('voce dello zip illeggibile');
      const dati = v.inizioLocale + 30 + buf.readUInt16LE(v.inizioLocale + 26) +
                                        buf.readUInt16LE(v.inizioLocale + 28);
      const pezzo = buf.subarray(dati, dati + v.compressa);
      if (v.metodo === 0) return pezzo.toString('utf8');            // immagazzinato
      if (v.metodo === 8) return zlib.inflateRawSync(pezzo).toString('utf8');  // compresso
      throw new Error('compressione non prevista nello zip: ' + v.metodo);
    }
  };
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
  const voce = leggiDallaZip(apk, 'assets/public/sw.js');
  assert.equal(voce.quante, 1,
    'nell\'APK deve esserci un solo sw.js (public): trovati ' + voce.quante + ' — ' + voce.nomi.join(', '));

  const swDellApk = voce.contenuto();
  const versioneApk = versioneDaTesto(swDellApk);
  assert.equal(versioneApk, versioneRepository,
    'l\'APK porta dentro la versione ' + versioneApk + ' e il repository la ' + versioneRepository +
    ': l\'app crede di essere vecchia e propone l\'aggiornamento per sempre');
});
