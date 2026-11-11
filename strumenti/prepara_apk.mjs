// PREPARA LA COMPILAZIONE DELL'APK: i due inciampi che Gradle ti spiega male.
//
// MISURATO il 10 novembre 2026, ricompilando a mano l'APK della 2.2.24 su questo computer:
//
//  1. Gradle si e' fermato con "SDK location not found. Define a valid SDK location with an
//     ANDROID_HOME environment variable or by setting the sdk.dir path in your project's local
//     properties file at .../mobile/android/local.properties".
//     Nel repository `local.properties` non c'e' ed e' giusto cosi': il percorso dell'SDK cambia
//     da computer a computer (vedi mobile/.gitignore). Ma `mobile/build_apk.bat` non dichiarava
//     ANDROID_HOME, quindi su un computer "pulito" la compilazione non poteva partire.
//
//  2. Superato il primo, Gradle si e' fermato con:
//       "No matching variant of project :capacitor-android was found ... No variants exist."
//     Quel messaggio non dice la causa. La causa vera: mancava `mobile/node_modules`, e le tre
//     librerie Capacitor sono INCLUSE come progetti che puntano dentro di esso
//     (mobile/android/capacitor.settings.gradle -> ../node_modules/@capacitor/android/capacitor).
//     Serviva `npm ci` nella cartella `mobile`.
//
// Questo script fa i due controlli PRIMA di Gradle, e li fa in italiano:
//   - trova l'SDK Android (ANDROID_HOME, ANDROID_SDK_ROOT, local.properties, percorsi standard)
//     e scrive `mobile/android/local.properties`, che non entra nel repository;
//   - se mancano le librerie Capacitor le installa con `npm ci`.
// Esce 0 solo quando Gradle puo' davvero partire.
//
// Uso:
//   node strumenti/prepara_apk.mjs                     prepara davvero (scrive, installa)
//   node strumenti/prepara_apk.mjs --verifica-soltanto  controlla e basta (non scrive, non installa)
//   node strumenti/prepara_apk.mjs --radice <cartella>  lavora su un'altra radice (serve ai banchi)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const RADICE_PREDEFINITA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Le tre librerie che Gradle include dal progetto mobile. Se una sola manca, la compilazione
// muore con "No variants exist" e nessuno capisce perche'.
const LIBRERIE = [
  ['@capacitor/android', 'capacitor'],
  ['@capacitor-firebase/authentication', 'android'],
  ['@capacitor/local-notifications', 'android'],
];

export function argomenti(argv) {
  const opzioni = {radice: RADICE_PREDEFINITA, verificaSoltanto: false};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--radice') {
      const valore = argv[++i];
      if (!valore) throw new Error('--radice vuole una cartella');
      opzioni.radice = path.resolve(valore);
    } else if (argv[i] === '--verifica-soltanto') {
      opzioni.verificaSoltanto = true;
    } else {
      throw new Error('opzione non riconosciuta: ' + argv[i]);
    }
  }
  return opzioni;
}

// Una cartella e' un SDK Android solo se dentro c'e' qualcosa che Gradle cerca davvero: senza
// questo controllo un percorso vuoto (o sbagliato) passerebbe, e Gradle fallirebbe piu' tardi.
export function eSdkAndroid(percorso) {
  if (!percorso) return false;
  try {
    if (!fs.statSync(percorso).isDirectory()) return false;
  } catch {
    return false;
  }
  return fs.existsSync(path.join(percorso, 'platforms')) ||
         fs.existsSync(path.join(percorso, 'build-tools'));
}

export function percorsiStandard() {
  if (process.platform === 'win32') {
    const fuori = [];
    if (process.env.LOCALAPPDATA) fuori.push(path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'));
    fuori.push(path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'sdk'));
    return fuori;
  }
  if (process.platform === 'darwin') return [path.join(os.homedir(), 'Library', 'Android', 'sdk')];
  return [path.join(os.homedir(), 'Android', 'Sdk'), '/usr/lib/android-sdk'];
}

export function sdkDaLocalProperties(file) {
  try {
    const testo = fs.readFileSync(file, 'utf8');
    const trovato = /^[ \t]*sdk\.dir[ \t]*=[ \t]*(.+?)[ \t]*$/m.exec(testo);
    return trovato ? trovato[1] : null;
  } catch {
    return null;
  }
}

export function trovaSdk(radice) {
  const candidati = [
    ['ANDROID_HOME', process.env.ANDROID_HOME],
    ['ANDROID_SDK_ROOT', process.env.ANDROID_SDK_ROOT],
    ['mobile/android/local.properties',
      sdkDaLocalProperties(path.join(radice, 'mobile', 'android', 'local.properties'))],
    ...percorsiStandard().map(percorso => ['percorso standard', percorso]),
  ];
  for (const [da, percorso] of candidati) {
    if (eSdkAndroid(percorso)) return {da, percorso};
  }
  return {da: null, percorso: null, cercati: candidati};
}

// Il file lo legge Gradle, non noi: si scrive con le barre in avanti, che su Windows vanno bene
// e non hanno bisogno di proteggere i due punti (C:) come farebbero le barre rovesciate.
export function scriviLocalProperties(file, sdk) {
  const valore = sdk.split(path.sep).join('/');
  const riga = 'sdk.dir=' + valore;
  let testo = '';
  try {
    testo = fs.readFileSync(file, 'utf8');
  } catch {
    testo = '';
  }
  if (/^[ \t]*sdk\.dir[ \t]*=/m.test(testo)) {
    testo = testo.replace(/^[ \t]*sdk\.dir[ \t]*=.*$/m, riga);
  } else {
    testo = (testo && !testo.endsWith('\n') ? testo + '\n' : testo) + riga + '\n';
  }
  fs.writeFileSync(file, testo);
}

export function librerieMancanti(radice) {
  const dentroNodeModules = path.join(radice, 'mobile', 'node_modules');
  return LIBRERIE
    .filter(([pacchetto, sotto]) =>
      !fs.existsSync(path.join(dentroNodeModules, ...pacchetto.split('/'), sotto, 'build.gradle')))
    .map(([pacchetto]) => pacchetto);
}

function installaLibrerie(radice) {
  const cartella = path.join(radice, 'mobile');
  const risultato = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], {
    cwd: cartella,
    stdio: 'inherit',
    // Su Windows `npm` e' npm.cmd: senza shell il sistema non lo trova e sembra che npm manchi.
    shell: process.platform === 'win32',
  });
  return risultato.status === 0;
}

function main(argv) {
  const opzioni = argomenti(argv);
  const radice = opzioni.radice;
  const cartellaAndroid = path.join(radice, 'mobile', 'android');
  const fileLocali = path.join(cartellaAndroid, 'local.properties');

  if (!fs.existsSync(cartellaAndroid)) {
    console.error('Non c\'e\' ' + cartellaAndroid + ': questo non e\' il repository di Forex Backtest LAB.');
    return 1;
  }

  // 1. L'SDK Android.
  const sdk = trovaSdk(radice);
  if (!sdk.percorso) {
    console.error('MANCA L\'SDK ANDROID: senza, Gradle non sa dove compilare.');
    console.error('L\'ho cercato qui:');
    for (const [da, percorso] of sdk.cercati) {
      console.error('  ' + da + ': ' + (percorso || '(non dichiarato)'));
    }
    console.error('Installa l\'SDK da Android Studio (SDK Manager) oppure dichiara ANDROID_HOME.');
    return 1;
  }
  console.log('SDK Android: ' + sdk.percorso + '  (da ' + sdk.da + ')');
  if (!opzioni.verificaSoltanto) scriviLocalProperties(fileLocali, sdk.percorso);

  // 2. Le librerie Capacitor.
  const mancanti = librerieMancanti(radice);
  if (mancanti.length > 0) {
    if (opzioni.verificaSoltanto) {
      console.error('MANCANO LE LIBRERIE CAPACITOR in mobile/node_modules: ' + mancanti.join(', '));
      console.error('Senza, Gradle si ferma con "No variants exist" e non dice perche\'.');
      console.error('Si installano con: npm ci  (dentro mobile)');
      return 1;
    }
    console.log('Mancano le librerie Capacitor (' + mancanti.join(', ') + '): le installo con npm ci...');
    if (!installaLibrerie(radice)) {
      console.error('npm ci non e\' riuscito: le librerie Capacitor restano mancanti.');
      return 1;
    }
    const ancoraMancanti = librerieMancanti(radice);
    if (ancoraMancanti.length > 0) {
      console.error('Dopo npm ci mancano ancora: ' + ancoraMancanti.join(', '));
      return 1;
    }
  } else {
    console.log('Librerie Capacitor: presenti (mobile/node_modules)');
  }

  console.log(opzioni.verificaSoltanto
    ? 'Va tutto bene: Gradle puo\' partire (verifica soltanto, non ho toccato niente).'
    : 'Pronto: Gradle puo\' partire.');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (errore) {
    console.error('Preparazione dell\'APK interrotta: ' + errore.message);
    process.exitCode = 1;
  }
}
