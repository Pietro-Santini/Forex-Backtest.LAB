// LA COMPILAZIONE DELL'APK DEVE PARTIRE DA SOLA, ANCHE SU UN COMPUTER PULITO.
//
// MISURATO il 10 novembre 2026, ricompilando a mano l'APK della 2.2.24: `mobile/build_apk.bat`
// si e' fermato DUE volte, e nessuna delle due volte per un difetto del codice dell'app.
//
//  1. "SDK location not found. Define a valid SDK location with an ANDROID_HOME environment
//     variable or by setting the sdk.dir path in ... local.properties". Il file non c'e' (e non
//     deve stare nel repository: il percorso dell'SDK cambia da computer a computer), ma nessuno
//     dichiarava ANDROID_HOME.
//  2. "No matching variant of project :capacitor-android was found ... No variants exist."
//     Tradotto: mancava `mobile/node_modules`, e le tre librerie Capacitor sono incluse come
//     progetti che puntano dentro di esso. Serviva `npm ci`.
//
// La cura e' `strumenti/prepara_apk.mjs`: trova l'SDK, scrive local.properties (fuori dal repo) e
// installa le librerie Capacitor se mancano. Questi banchi misurano il COMPORTAMENTO di quello
// script su cartelle finte: nessuno di loro compila davvero un APK (servirebbe l'SDK Android, e su
// GitHub non c'e'), ma ognuno guarda un esito vero - codice d'uscita, file scritti, messaggio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(RADICE, 'strumenti', 'prepara_apk.mjs');

// Un computer finto: la radice del repository, un SDK e (se serve) le librerie Capacitor.
// L'ambiente viene svuotato apposta: se restasse ANDROID_HOME di questa macchina, i banchi
// passerebbero o fallirebbero a seconda del computer - l'errore gia' pagato fra la v158 e la v164.
function computerFinto({conSdk = true, conLibrerie = true} = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fbl-prepara-apk-'));
  const radice = path.join(base, 'repo');
  const android = path.join(radice, 'mobile', 'android');
  fs.mkdirSync(android, {recursive: true});

  const sdk = path.join(base, 'sdk');
  if (conSdk) {
    fs.mkdirSync(path.join(sdk, 'platforms', 'android-36'), {recursive: true});
    fs.mkdirSync(path.join(sdk, 'build-tools', '35.0.0'), {recursive: true});
  } else {
    fs.mkdirSync(sdk, {recursive: true});   // esiste ma e' vuota: NON e' un SDK
  }

  if (conLibrerie) {
    for (const [pacchetto, sotto] of [['@capacitor/android', 'capacitor'],
      ['@capacitor-firebase/authentication', 'android'],
      ['@capacitor/local-notifications', 'android']]) {
      const cartella = path.join(radice, 'mobile', 'node_modules', ...pacchetto.split('/'), sotto);
      fs.mkdirSync(cartella, {recursive: true});
      fs.writeFileSync(path.join(cartella, 'build.gradle'), '// libreria finta\n');
    }
  }

  // Le cartelle "standard" in cui lo script cerca l'SDK si spostano dentro il computer finto,
  // cosi' l'SDK vero di questa macchina non entra nei risultati.
  const vuota = path.join(base, 'senza-sdk');
  fs.mkdirSync(vuota, {recursive: true});
  const ambiente = {...process.env};
  delete ambiente.ANDROID_HOME;
  delete ambiente.ANDROID_SDK_ROOT;
  ambiente.LOCALAPPDATA = vuota;
  ambiente.HOME = vuota;
  ambiente.USERPROFILE = vuota;
  ambiente.ProgramFiles = vuota;

  return {base, radice, sdk, ambiente, android};
}

function esegui(computer, extra = [], ambiente = {}) {
  return spawnSync(process.execPath, [SCRIPT, '--radice', computer.radice, ...extra], {
    env: {...computer.ambiente, ...ambiente},
    encoding: 'utf8',
  });
}

const fileLocali = computer => path.join(computer.android, 'local.properties');
const conBarre = percorso => percorso.split(path.sep).join('/');

test('con l\'SDK dichiarato scrive local.properties: Gradle lo trova senza ANDROID_HOME', () => {
  const computer = computerFinto();
  const esito = esegui(computer, [], {ANDROID_HOME: computer.sdk});

  assert.equal(esito.status, 0, 'lo script doveva dire che si puo\' compilare. Detto invece:\n' +
    esito.stdout + esito.stderr);
  assert.ok(fs.existsSync(fileLocali(computer)),
    'manca mobile/android/local.properties: e\' il file in cui Gradle cerca il percorso dell\'SDK');

  const scritto = fs.readFileSync(fileLocali(computer), 'utf8');
  assert.match(scritto, new RegExp('^sdk\\.dir=' + conBarre(computer.sdk).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'm'),
    'local.properties deve portare il percorso dell\'SDK trovato, con le barre in avanti ' +
    '(su Windows i due punti di C: non vanno protetti). Trovato:\n' + scritto);

  // Secondo giro: la riga non si duplica (Gradle legge l'ultima, e un file che cresce a ogni
  // compilazione prima o poi mente).
  const secondo = esegui(computer, [], {ANDROID_HOME: computer.sdk});
  assert.equal(secondo.status, 0);
  const righe = fs.readFileSync(fileLocali(computer), 'utf8')
    .split('\n').filter(riga => riga.trim().startsWith('sdk.dir='));
  assert.equal(righe.length, 1, 'la riga sdk.dir e\' comparsa ' + righe.length + ' volte');
});

test('una cartella SDK vuota non passa per SDK: si ferma e dice cosa manca', () => {
  const computer = computerFinto({conSdk: false});
  const esito = esegui(computer, [], {ANDROID_HOME: computer.sdk});

  assert.equal(esito.status, 1, 'una cartella vuota non e\' un SDK: lo script doveva fermarsi');
  assert.match(esito.stderr, /SDK ANDROID/, 'il messaggio deve dire che manca l\'SDK Android');
  assert.match(esito.stderr, /ANDROID_HOME/, 'il messaggio deve dire come dichiararlo');
  assert.ok(!fs.existsSync(fileLocali(computer)),
    'non deve scrivere local.properties con un percorso sbagliato: Gradle fallirebbe piu\' tardi');
});

test('le librerie Capacitor mancanti si vedono qui, non come "No variants exist"', () => {
  const computer = computerFinto({conLibrerie: false});
  const esito = esegui(computer, ['--verifica-soltanto'], {ANDROID_HOME: computer.sdk});

  assert.equal(esito.status, 1, 'senza node_modules la compilazione non puo\' partire');
  assert.match(esito.stderr, /CAPACITOR/i, 'il messaggio deve nominare le librerie Capacitor');
  assert.match(esito.stderr, /@capacitor\/android/,
    'il messaggio deve dire QUALE libreria manca, non solo che qualcosa manca');
  assert.match(esito.stderr, /npm ci/, 'il messaggio deve dire come si installano');
});

test('con tutto a posto la verifica non tocca niente e non chiama npm', () => {
  const computer = computerFinto();
  const esito = esegui(computer, ['--verifica-soltanto'], {ANDROID_HOME: computer.sdk});

  assert.equal(esito.status, 0, 'doveva dire che va tutto bene. Detto invece:\n' +
    esito.stdout + esito.stderr);
  assert.ok(!fs.existsSync(fileLocali(computer)),
    '--verifica-soltanto non deve scrivere local.properties: e\' una verifica');
  assert.match(esito.stdout, /verifica soltanto/,
    'deve dire che non ha toccato niente, altrimenti chi legge crede di aver compilato');
});
