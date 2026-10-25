// L'INIEZIONE DELLA VERSIONE NON DEVE ROVINARE LE ICONE.
//
// SEGNALATO dal proprietario (25 ottobre 2026): «tutte le icone nei testi adesso mi dà tutti
// simboli di lettere strane e non vengono più visualizzate, dopo quest'ultimo aggiornamento».
//
// MISURATO sull'app.html dentro l'APK v2.0.27: 800 "ðŸ", 1965 "â€", 4852 "Ã", ZERO emoji vere.
// Causa: `aggiorna_www.bat` iniettava la versione con
//     (Get-Content app.html -Raw) -replace ... | Set-Content app.html -Encoding UTF8
// e in Windows PowerShell 5.1 `Get-Content` senza -Encoding legge i byte come ANSI: le emoji
// venivano decodificate come latin1 e risalvate. Il Desktop (che non passa da quella riga) era
// sano: il difetto esisteva solo nell'APK.
//
// Qui non si legge il .bat cercando una stringa: si esegue lo strumento su un file con emoji
// dentro e si guarda cosa esce.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RADICE} from './aiuti.mjs';

const STRUMENTO = path.join(RADICE, 'strumenti', 'inietta_versione.py');

// Su GitHub il comando puo' chiamarsi "python3": si prova, e si usa quello che risponde.
function esegui(argomenti){
  let r = spawnSync('python', argomenti, {encoding: 'utf8'});
  if(r.error && r.error.code === 'ENOENT') r = spawnSync('python3', argomenti, {encoding: 'utf8'});
  return r;
}

test('l\'iniezione della versione lascia intatte le icone (UTF-8, senza BOM)', () => {
  const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'fbl-iniezione-'));
  const file = path.join(cartella, 'app.html');
  const originale = [
    '<!DOCTYPE html>',
    '<meta charset="UTF-8">',
    '<title>Forex Backtest Lab \u2014 Replay</title>',
    '<button>\uD83D\uDE80 Vai</button><span>\uD83D\uDCC8 grafico</span>',
    '<em>attenzione \u2014 qui</em>',
    "const FBL_VERSIONE_BUNDLE='__FBL_VERSIONE__';",
    ''
  ].join('\r\n');
  fs.writeFileSync(file, Buffer.from(originale, 'utf8'));
  try{
    const r = esegui([STRUMENTO, file, '9.9.9']);
    assert.equal(r.status, 0, 'lo strumento deve terminare senza errori: ' + (r.stderr || ''));
    const dati = fs.readFileSync(file);
    assert.notEqual(dati[0], 0xEF, 'il file non deve iniziare con il BOM');
    const testo = dati.toString('utf8');
    assert.ok(testo.includes('9.9.9'), 'la versione deve essere stata iniettata');
    assert.ok(!testo.includes('__FBL_VERSIONE__'), 'il segnaposto non deve restare');
    // Le prove che contano: le icone e la punteggiatura tipografica sono ancora se stesse.
    assert.ok(testo.includes('\uD83D\uDE80'), 'l\'emoji del razzo deve restare un razzo');
    assert.ok(testo.includes('\uD83D\uDCC8'), 'l\'emoji del grafico deve restare un grafico');
    assert.ok(testo.includes('\u2014'), 'il trattino lungo deve restare un trattino lungo');
    assert.ok(!testo.includes('\u00F0\u0178'), 'niente mojibake "ðŸ"');
    assert.ok(!testo.includes('\u00E2\u20AC'), 'niente mojibake "â€"');
    assert.ok(testo.includes('\r\n'), 'i fine riga CRLF devono restare CRLF');
    assert.equal((testo.match(/\r\n/g) || []).length, (originale.match(/\r\n/g) || []).length,
      'il numero di fine riga non deve cambiare');
  } finally {
    fs.rmSync(cartella, {recursive: true, force: true});
  }
});

test('senza argomenti lo strumento si ferma invece di svuotare un file', () => {
  const r = esegui([STRUMENTO]);
  assert.equal(r.status, 2, 'deve uscire con codice 2 e spiegare l\'uso');
  assert.ok(/Uso/.test(r.stdout || ''), 'deve stampare l\'uso: ' + r.stdout);
});
