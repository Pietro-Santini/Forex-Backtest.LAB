// build_exe.bat DEVE COPIARE DAVVERO app.html, login.html e sw.js DENTRO build\.
//
// Il 17 ottobre 2026 il Setup non si e' costruito su GitHub con questo errore:
//   ERRORE: manca build\app.html. Scarica tutto il progetto (non solo installer_build).
// Sul PC del proprietario non si vedeva, perche' li' build\app.html c'era gia' da una
// compilazione precedente; su GitHub si parte da una cartella pulita e il difetto salta fuori.
//
// CAUSA MISURATA: la riga di copia conteneva un pezzo di PowerShell scritto dentro il file .bat
// (i caratteri `r`n, che servono a PowerShell per andare a capo e che per cmd.exe NON significano
// niente). cmd.exe leggeva quella riga come un unico comando storto, la copia non avveniva, e il
// controllo subito dopo trovava build\app.html mancante. Un file .bat si scrive leggendolo con
// cmd.exe, non con PowerShell: sono due linguaggi diversi.
//
// QUESTO TEST NON CERCA UNA STRINGA NEL SORGENTE: prende le righe vere di build_exe.bat che fanno
// la copia, le mette in una cartella di prova insieme a dei finti app.html/login.html/sw.js, le fa
// ESEGUIRE da cmd.exe e poi guarda se i file sono arrivati dentro build\. Con la riga rotta
// fallisce; con la riga giusta passa.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BAT = path.join(RADICE, 'installer_build', 'build_exe.bat');

// Le righe di build_exe.bat che vanno dall'inizio fino al primo passo di Python (la creazione
// dell'ambiente isolato). Fino a li' lo script non fa che copiare i file e controllarli: e' la
// parte che si puo' far girare qui, in pochi decimi di secondo, senza Python ne' PyInstaller.
function bloccoDellaCopia() {
  const righe = fs.readFileSync(BAT, 'latin1').split(/\r?\n/);
  const fine = righe.findIndex((r) => r.startsWith('echo === 1)'));
  assert.ok(fine > 0,
    "in build_exe.bat non si trova piu' la riga 'echo === 1)': il test non sa piu' dove finisce " +
    'la parte che copia i file. Va aggiornato, non ignorato.');
  return righe.slice(0, fine).join('\r\n');
}

test('build_exe.bat copia app.html, login.html e sw.js dentro build\\ (eseguito davvero)', () => {
  const prova = fs.mkdtempSync(path.join(os.tmpdir(), 'fbl-copia-'));
  const IB = path.join(prova, 'installer_build');
  fs.mkdirSync(path.join(IB, 'build'), {recursive: true});
  for (const nome of ['app.html', 'login.html', 'sw.js']) {
    fs.writeFileSync(path.join(prova, nome), 'contenuto di prova di ' + nome, 'latin1');
  }
  // Lo script di prova sta nella stessa cartella di build_exe.bat, cosi' "%~dp0" punta allo
  // stesso posto (%~dp0.. = la cartella principale, %~dp0build = la sottocartella build).
  const script = path.join(IB, 'prova_copia.bat');
  fs.writeFileSync(script, bloccoDellaCopia(), 'latin1');

  let uscita = 0;
  let registro = '';
  try {
    registro = execFileSync('cmd.exe', ['/c', script], {
      stdio: ['ignore', 'pipe', 'pipe'],   // niente tastiera: un "pause" non deve bloccare il collaudo
      timeout: 30000,
      encoding: 'latin1'
    });
  } catch (errore) {
    uscita = errore.status === undefined ? -1 : errore.status;
    registro = String(errore.stdout || '') + String(errore.stderr || '');
  }

  for (const nome of ['app.html', 'login.html', 'sw.js']) {
    const dove = path.join(IB, 'build', nome);
    assert.ok(fs.existsSync(dove),
      'build\\' + nome + ' NON e\' stato copiato (la copia e\' uscita con ' + uscita + '). ' +
      'Il Setup su GitHub si fermera\' con "manca build\\' + nome + '". ' +
      (uscita !== 0 ? "Risposta dello script: " + registro.split('\r\n').filter(Boolean).join(' / ') : ''));
  }

  fs.rmSync(prova, {recursive: true, force: true});
});
