// IL PACCHETTO DEVE INSTALLARE L'APPLICAZIONE VERA, NON SOLO I SERVIZI.
//
// Riferito dal proprietario (31 ottobre 2026): «installo, il pacchetto installa i servizi ma non
// mostra l'applicazione, avvio ForexBacktestLAB.exe dentro Programmi e non parte niente, manca il
// file per il desktop». Misurato: ForexBacktestLAB.exe e i suoi due fratelli sono servizi SENZA
// FINESTRA (compilati con --windowed), mentre la finestra dell'applicazione era un altro eseguibile
// (ForexBacktestLABDesktop.exe, da desktop\desktop_shell.py) che NESSUNO costruiva nel flusso
// dell'installer: esisteva solo desktop\BUILD_EXE_DESKTOP.bat, uno script a parte che il flusso di
// GitHub non chiama. Risultato: il Setup usciva con tre servizi invisibili e zero applicazioni.
//
// Questo test prova DAVVERO il comportamento, in due modi:
//   A) ESEGUE desktop_shell.py con moduli-finti (webview, socket, subprocess) e misura che cosa
//      la finestra fa: titolo, logo PNG messo nel tab, pagina di spiegazione quando il servizio
//      non c'e', ritorno dell'indirizzo del ponte nei tre casi. Gira su Windows e su GitHub: le
//      finte sono Python puro, nessuna finestra vera si apre.
//   B) CONTROLLA che il pacchetto sia coerente da un capo all'altro: build_exe.bat costruisce
//      anche la finestra, installer.iss la installa e le fa l'icona (Desktop e menu Start), il
//      flusso di GitHub esige il file, lo scheme del sito apre la finestra e non il servizio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PY = process.platform === 'win32' ? 'python' : 'python3';

const DESKTOP_SHELL = path.join(RADICE, 'desktop', 'desktop_shell.py');
const INSTALLER = path.join(RADICE, 'installer_build', 'installer.iss');
const BAT = path.join(RADICE, 'installer_build', 'build_exe.bat');
const REQUIREMENTI = path.join(RADICE, 'installer_build', 'build', 'requirements.txt');
const FLUSSO = path.join(RADICE, '.github', 'workflows', 'installer.yml');

// ============================================================================
// A) IL COMPORTAMENTO DELLA FINESTRA, eseguito davvero con moduli finti.
// ============================================================================

// Lo script Python che misura desktop_shell.py: restituisce un JSON con i fatti misurati.
const PROVA = [
  'import sys, types, importlib.util, json, base64, os',
  'percorso = sys.argv[1]',
  '',
  '# --- webview finto: registra cio\' che la finestra riceve davvero ---',
  '# "events.loaded += f" in Python e\' una lettura + una scrittura: servono attributi VERI',
  '# (non property) il cui += registri davvero la funzione, come fa pywebview.',
  'class _Segno:',
  '    def __init__(self, elenco): self.elenco = elenco',
  '    def __iadd__(self, f): self.elenco.append(f); return self',
  '',
  'class _Ev:',
  '    def __init__(self):',
  '        self.fs = []',
  '        self.loaded = _Segno(self.fs)',
  '        self.shown = _Segno(self.fs)',
  '',
  'class _Finestra:',
  '    def __init__(self, *a, **k):',
  '        self.args = a',
  '        self.kw = k',
  '        self.events = _Ev()',
  '        self.scripts = []',
  '        self.caricati = []',
  '    def load_url(self, u): self.caricati.append(u)',
  '    def evaluate_js(self, js): self.scripts.append(js)',
  '',
  'create = []',
  'webview = types.ModuleType("webview")',
  'webview.settings = {}',
  'def _crea(*a, **k):',
  '    f = _Finestra(*a, **k)',
  '    create.append(f)',
  '    return f',
  'webview.create_window = _crea',
  'webview.start = lambda *a, **k: None',
  'sys.modules["webview"] = webview',
  '',
  '# subprocess finto: NESSUN processo vero (ne\' il ponte del proprietario ne\' altri)',
  'finto_sub = types.ModuleType("subprocess")',
  'class _Popen:',
  '    def __init__(self, *a, **k): pass',
  'finto_sub.Popen = _Popen',
  'sys.modules["subprocess"] = finto_sub',
  '',
  'spec = importlib.util.spec_from_file_location("desktop_shell_in_prova", percorso)',
  'm = importlib.util.module_from_spec(spec)',
  'spec.loader.exec_module(m)',
  '',
  'fatti = {}',
  '',
  '# 1) IL LOGO: esiste un PNG vero e diventa un data URL utilizzabile nel tab?',
  'logo = m._logo_data_url()',
  'png = None',
  'if logo and logo.startswith("data:image/png;base64,"):',
  '    try:',
  '        grezzo = base64.b64decode(logo.split(",", 1)[1])',
  '        png = grezzo[:4] == b"\\x89PNG"',
  '    except Exception:',
  '        png = False',
  'fatti["logo"] = {"presente": bool(logo), "png": png}',
  '',
  '# 2) L\'INDIRIZZO DEL PONTE nei tre casi: ponte su, ponte assente, ponte su un altro PC',
  'vero_is_port = m._is_port_open',
  'm._is_port_open = lambda *a, **k: True',
  'fatti["ponte_su"] = m._ensure_backend()',
  'm._is_port_open = lambda *a, **k: False',
  'm.os.path.isfile = lambda p: False',
  'os.environ.pop("BACKEND_URL", None)',
  'fatti["ponte_assente"] = m._ensure_backend()',
  'os.environ["BACKEND_URL"] = "http://prova.example:9010"',
  'm._ponte_qui = lambda u: u.startswith("http://prova.example")',
  'fatti["ponte_remoto"] = m._ensure_backend()',
  'os.environ.pop("BACKEND_URL", None)',
  'm._is_port_open = vero_is_port',
  '',
  '# 3) LA FINESTRA nel caso peggiore (servizio assente): titolo vero, spiegazione chiara,',
  '#    e il logo davvero iniettato nella pagina quando la finestra e\' pronta',
  'm._ensure_backend = lambda: None',
  'uscita = m.main()',
  'f = create[-1] if create else None',
  'fatti["main_uscita"] = uscita',
  'fatti["finestra"] = {',
  '    "titolo": ((f.kw.get("title") if f else None) or (f.args[0] if f and f.args else None)),',
  '    "larghezza": (f.kw.get("width") if f else None),',
  '    "altezza": (f.kw.get("height") if f else None),',
  '    "js_api_presente": bool(f and f.kw.get("js_api") is not None),',
  '}',
  'if f:',
  '    for ev in list(f.events.fs):',
  '        try: ev()',
  '        except Exception: pass',
  'prova_html = str((f.kw.get("html") if f and f.kw.get("html") else (f.args[1] if f and len(f.args) > 1 else "")) or "")',
  'fatti["spiegazione"] = {',
  '    "dice_riprova": "Riprova" in prova_html,',
  '    "dice_il_nome": "Forex Backtest LAB" in prova_html,',
  '    "pagina_propria": not prova_html.startswith("http"),',
  '}',
  'script = " ".join(f.scripts) if f else ""',
  'fatti["logo_nella_finestra"] = ("data:image/png;base64," in script) and ("link" in script)',
  '',
  '# 4) IL CASO NORMALE: col ponte che risponde la finestra apre l\'applicazione, non la spiegazione',
  'create.clear()',
  'm._ensure_backend = lambda: "http://127.0.0.1:8000/app.html"',
  'm.main()',
  'f2 = create[-1] if create else None',
  'fatti["con_ponte"] = {',
  '    "apre_app": bool(f2 and len(f2.args) > 1 and f2.args[1] == "http://127.0.0.1:8000/app.html"),',
  '    "titolo": ((f2.kw.get("title") if f2 else None) or (f2.args[0] if f2 and f2.args else None)),',
  '}',
  '',
  'print(json.dumps(fatti))',
].join('\n');

test('la finestra dell\'applicazione si comporta da applicazione (eseguita davvero)', () => {
  const dove = path.join(os.tmpdir(), 'fbl-desktop-prova-' + process.pid + '.py');
  fs.writeFileSync(dove, PROVA, 'utf8');
  let json = '';
  try {
    json = execFileSync(PY, [dove, DESKTOP_SHELL], {encoding: 'utf8', timeout: 60000});
  } catch (e) {
    throw new Error(
      'desktop_shell.py non e\' eseguibile: ' + String(e.stdout || '') + String(e.stderr || '') +
      '. La finestra dell\'applicazione deve aprirsi, non cadere.');
  } finally {
    fs.rmSync(dove, {force: true});
  }
  // Il modulo puo' stampare avvisi (es. la patch della webview finta): il JSON misurato
  // e' l'ULTIMA riga, quella scritta dal print finale.
  const righe = String(json).split(/\r?\n/).filter(r => r.trim().length > 0);
  const fatti = JSON.parse(righe[righe.length - 1]);

  // IL LOGO: un PNG vero, incorporato, da mettere in alto a sinistra (riferito dal proprietario:
  // "non ha il logo, non ha in alto a sinistra nulla").
  assert.equal(fatti.logo.presente, true, 'il logo non e\' stato trovato: manca icon-512.png nel percorso atteso');
  assert.equal(fatti.logo.png, true, 'il logo non e\' un PNG valido: non comparirebbe in alto a sinistra');
  assert.equal(fatti.logo_nella_finestra, true,
    'il logo non viene iniettato nella pagina: in alto a sinistra non comparirebbe nulla');

  // IL TITOLO: il nome vero dell'applicazione, come qualunque finestra Windows.
  assert.equal(fatti.finestra.titolo, 'Forex Backtest LAB', 'titolo della finestra sbagliato');
  assert.equal(fatti.finestra.larghezza, 1280, 'la finestra parte troppo piccola');
  assert.equal(fatti.finestra.altezza, 820, 'la finestra parte troppo bassa');
  assert.equal(fatti.finestra.js_api_presente, true,
    'senza js_api il pulsante Riprova della spiegazione non puo\' fare niente');

  // L'INDIRIZZO DEL PONTE: prima la macchina locale (funziona per tutti), poi il server altrui.
  assert.ok(String(fatti.ponte_su).startsWith('http://127.0.0.1:8000/app.html'), 'col ponte locale non si apre l\'applicazione');
  assert.equal(fatti.ponte_assente, null, 'senza ponte e senza alternativa deve dirlo, non inventare un indirizzo');
  assert.equal(fatti.ponte_remoto, 'http://prova.example:9010/app.html', 'BACKEND_URL non viene usato quando c\'e\'');

  // SPIEGAZIONE: se il servizio non c'e', la finestra lo dice con un pulsante Riprova.
  assert.equal(fatti.spiegazione.dice_riprova, true, 'senza servizio manca il pulsante Riprova');
  assert.equal(fatti.spiegazione.dice_il_nome, true, 'la spiegazione non porta il nome dell\'applicazione');
  assert.equal(fatti.spiegazione.pagina_propria, true, 'la spiegazione deve essere una pagina propria, non un indirizzo vuoto');

  // E col servizio disponibile si apre l'applicazione vera.
  assert.equal(fatti.con_ponte.apre_app, true, 'col ponte attivo la finestra non carica l\'applicazione');
  assert.equal(fatti.con_ponte.titolo, 'Forex Backtest LAB', 'titolo sbagliato nel caso normale');
  assert.equal(fatti.main_uscita, 0, 'main() deve chiudere con 0');
});

// ============================================================================
// B) IL PACCHETTO COERENTE: prodotta, installata, icona, avvio, schema, CI.
// ============================================================================

const iss = fs.readFileSync(INSTALLER, 'utf8');
const bat = fs.readFileSync(BAT, 'utf8');
const req = fs.readFileSync(REQUIREMENTI, 'utf8');
const flusso = fs.readFileSync(FLUSSO, 'utf8');

// In installer.iss l'eseguibile della finestra si puo' scrivere col suo nome o con il define
// {#MyAppDesktopExeName} (che in compilazione vale il nome). Entrambe le forme vanno bene.
const ESEDESKTOP = ['{#MyAppDesktopExeName}', 'ForexBacktestLABDesktop.exe'];
const NOMEDESKTOP = 'ForexBacktestLABDesktop.exe';

function righeDi(testo) { return testo.split(/\r?\n/); }
function dice(testo, pezzo) { return testo.includes(pezzo); }
function rigaCon(testo, pezzo, altro) {
  return righeDi(testo).find(r => r.includes(pezzo) && (!altro || r.includes(altro)));
}
// Il codice del .iss, senza le righe di commento (in un .iss il commento inizia con ';').
// Serve perche' i commenti qui sopra spiegano PERCHE' una scelta e' stata fatta e nominano
// anche quella sbagliata: senza toglierli, un test che cerca "{commondesktop}" troverebbe
// la parola dentro la spiegazione e griderebbe al difetto gia' corretto.
function issCodice() { return righeDi(iss).filter(r => !/^\s*;/.test(r)).join('\n'); }

test('build_exe.bat costruisce anche la finestra, con la sua libreria', () => {
  assert.ok(/\-\-name\s+ForexBacktestLABDesktop/.test(bat),
    'build_exe.bat non costruisce ' + NOMEDESKTOP + ': il Setup uscira\' senza applicazione');
  assert.ok(bat.includes('webview.platforms.edgechromium'),
    'senza l\'hidden-import la finestra non si apre su Windows');
  assert.ok(bat.includes('icon-512.png'), 'il logo non e\' incorporato: la pagina non potrebbe mostrarlo');
  const rigaPyinstaller = rigaCon(bat, '--name', 'ForexBacktestLABDesktop');
  assert.ok(rigaPyinstaller, 'il passo di compilazione della finestra non si trova');
  assert.ok(bat.includes('%~dp0..\\desktop\\desktop_shell.py'),
    'build_exe.bat non punta a desktop_shell.py (con percorso relativo): non compilerebbe la finestra giusta');
  assert.ok(righeDi(req).some(r => r.trim() === 'pywebview'),
    'pywebview manca in requirements.txt: l\'exe compilerebbe e morirebbe al primo avvio');
});

test('installer.iss installa la finestra', () => {
  const riga = righeDi(iss).find(r => /^Source:\s*"dist\\/.test(r.trim()) &&
    (r.includes('{#MyAppDesktopExeName}') || r.includes(NOMEDESKTOP)));
  assert.ok(riga, 'installer.iss non installa la finestra: l\'utente non ha nulla da aprire');
  assert.ok(riga.includes('DestDir: "{app}"'), 'la finestra va installata nella cartella dell\'applicazione');
  // Di proposito senza "skipifsourcedoesntexist": se manca, la compilazione deve FERMARSI.
  assert.ok(!riga.includes('skipifsourcedoesntexist'),
    'con skipifsourcedoesntexist un build rotto potrebbe consegnare un Setup senza applicazione');
});

test('installer.iss fa l\'icona sul Desktop (scelta dell\'utente) e nel menu Start', () => {
  assert.ok(dice(iss, '[Tasks]'), 'senza [Tasks] la scorciatoia sul Desktop non e\' una scelta dell\'utente');
  assert.ok(dice(iss, 'Name: "desktopicon"'), 'manca il Task della scorciatoia sul Desktop');
  const desktop = rigaCon(issCodice(), '{userdesktop}');
  assert.ok(desktop, 'non viene creata l\'icona sul Desktop: l\'utente deve cercarsi il programma');
  assert.ok(ESEDESKTOP.some(n => desktop.includes(n)),
    'l\'icona sul Desktop non apre la finestra dell\'applicazione');
  assert.ok(desktop.includes('Tasks: desktopicon'),
    'l\'icona sul Desktop deve essere legata al Task, altrimenti la scelta dell\'utente non conta');
  const avvio = rigaCon(issCodice(), 'Name: "{group}\\{#MyAppName}"', '{#MyAppDesktopExeName}');
  assert.ok(avvio, 'manca la voce nel menu Start per avviare l\'applicazione');
  assert.ok(ESEDESKTOP.some(n => avvio.includes(n)), 'la voce nel menu Start non apre la finestra');
});

test('l\'icona sul Desktop si crea senza i permessi di amministratore', () => {
  // Misurato sul PC del proprietario (1° novembre 2026): l'installazione si FERMAVA con
  // "IPersistFile::Save fallito; codice 0x80070005. Accesso negato." mentre creava
  // C:\Users\Public\Desktop\Forex Backtest LAB.lnk. {commondesktop} e' una cartella di
  // sistema: senza amministratore non si scrive, e questo pacchetto e' pensato per
  // girare SENZA amministratore (PrivilegesRequired=lowest), quindi deve restare cosi'.
  // L'icona va in {userdesktop}: il Desktop di chi installa, che si scrive da solo.
  assert.ok(!/\{commondesktop\}/.test(issCodice()),
    'l\'icona sta in {commondesktop} (C:\\Users\\Public\\Desktop): con PrivilegesRequired=lowest ' +
    'l\'installazione muore con "Accesso negato" - l\'utente resta bloccato a meta\'');
  assert.ok(/\{userdesktop\}/.test(issCodice()),
    'l\'icona sul Desktop deve stare in {userdesktop}, scrivibile senza amministratore');
  assert.ok(/PrivilegesRequired\s*=\s*lowest/.test(issCodice()),
    'l\'installazione deve restare per-utente: nessuna richesta di amministratore all\'utente');
});

test('dopo l\'installazione compare il pulsante selezionabile "Avvia Forex Backtest LAB"', () => {
  const riga = righeDi(iss).find(r => r.trim().startsWith('Filename: "{app}') &&
    (r.includes('{#MyAppDesktopExeName}') || r.includes(NOMEDESKTOP)));
  assert.ok(riga, 'in [Run] non si avvia la finestra dell\'applicazione');
  assert.ok(riga.includes('postinstall'),
    'senza "postinstall" non compare la casella selezionabile per avviare l\'applicazione');
  assert.ok(riga.includes('skipifsilent'),
    'senza "skipifsilent" l\'aggiornamento silenzioso aprirebbe una finestra addosso all\'utente');
  assert.ok(riga.includes('Description: "Avvia'), 'il testo del pulsante finale non dice "Avvia"');
  // Il servizio invisibile deve continuare a partire da solo: non e' stato toccato.
  const servizio = righeDi(iss).find(r => r.trim().startsWith('Filename: "{app}') &&
    (r.includes('{#MyAppExeName}') || r.includes('ForexBacktestLAB.exe')) && !r.includes('ForexBacktestLABDesktop.exe'));
  assert.ok(servizio, 'il servizio deve continuare ad avviarsi in silenzio dopo l\'installazione');
});

test('l\'aggiornamento silenzioso riapre la finestra dell\'applicazione', () => {
  // Misurato dal proprietario (1° novembre 2026): l'aggiornamento chiudeva l'app e basta,
  // poi l'utente doveva riaprirla a mano. Il Setup deve riaprirla SOLO quando gira in
  // silenzio (Check: InstallazioneSilenziosa) - cosi' nell'installazione normale resta
  // la casella "Avvia" a governare, e nell'aggiornamento automatico la finestra torna
  // da sola, con un refresh, come fa OpenCode in alto a destra.
  const riga = righeDi(iss).find(r => r.trim().startsWith('Filename: "{app}') &&
    (r.includes('{#MyAppDesktopExeName}') || r.includes(NOMEDESKTOP)) &&
    /Check:\s*InstallazioneSilenziosa/.test(r));
  assert.ok(riga, 'in [Run] manca la voce che riapre la finestra nell\'aggiornamento silenzioso');
  assert.match(iss, /function\s+InstallazioneSilenziosa\s*\(\)\s*:\s*Boolean;/,
    'manca la funzione InstallazioneSilenziosa in [Code]');
  assert.match(iss, /WizardSilent\(\)/,
    'la funzione silenziosa deve basarsi su WizardSilent()');
  // Il servizio continua a partire anche nell'aggiornamento silenzioso.
  assert.match(iss, /Filename:\s*"\{app\}\\(\{#MyAppExeName\}|ForexBacktestLAB\.exe)"/,
    'il servizio deve continuare ad avviarsi dopo l\'aggiornamento');
});

test('il collegamento del sito apre la finestra, non il servizio invisibile', () => {
  // Nel comando dello schema deve comparire la finestra, e NON il servizio senza finestra.
  const comando = iss.split('forexbacktestlab\\shell\\open\\command')[1] || '';
  assert.ok(comando.includes('{#MyAppDesktopExeName}') || comando.includes(NOMEDESKTOP),
    'il collegamento forexbacktestlab:// apre il servizio: cliccando dal sito non succede nulla di visibile');
  assert.ok(!comando.includes('{#MyAppExeName}"" ""%1"""'),
    'il collegamento del sito punta ancora al servizio senza finestra');
});

test('il flusso di GitHub esige la finestra: niente pacchetti senza applicazione', () => {
  assert.ok(flusso.includes('if not exist installer_build\\dist\\ForexBacktestLABDesktop.exe exit /b 1'),
    'senza questo controllo un build rotto puo\' consegnare un Setup con i soli servizi');
});

test('la finestra e\' codice Python valido', () => {
  let esito = 0;
  try {
    execFileSync(PY, ['-m', 'py_compile', DESKTOP_SHELL], {stdio: 'ignore', timeout: 60000});
  } catch (e) {
    esito = -1;
  }
  assert.equal(esito, 0, 'desktop_shell.py non e\' Python valido: l\'applicazione non partirebbe');
});

// I BLOCCHI "if errorlevel 1" DEL .bat DEVONO ESSERE PARSING VALIDO PER cmd.exe.
//
// Difetto costato un flusso rosso (31 ottobre 2026): dentro un blocco if (...) avevo scritto
// "echo nulla da aprire (il pacchetto ...)". In cmd, una ) non escapata DENTRO un blocco if
// lo chiude prima della fine: ". was unexpected at this time.", processo morto con 255 - e il
// flusso moriva DOPO aver costruito ForexBacktestLABDesktop.exe benissimo, proprio per colpa
// del messaggio d'errore del blocco. Nota: il parsing avviene comunque, anche quando la
// condizione e' falsa (errorlevel 0): e' per questo che il flusso cadeva anche se PyInstaller
// era andato bene.
//
// QUESTO TEST NON CERCA UNA STRINGA: prende ogni blocco if (...) vero di build_exe.bat, lo mette
// in un .bat di prova e lo fa ESEGUIRE da cmd.exe. Se una parentesi chiude il blocco prima,
// cmd esce con un codice diverso da 0 e il test lo dice (gira solo su Windows: su Linux cmd.exe
// non esiste, come build_exe_copia.test.mjs).
const WINDOWS = process.platform === 'win32';
const SALTO = 'cmd.exe non esiste su ' + process.platform +
  ': il parsing del .bat si prova sul Windows del collaudo locale e sul runner di GitHub';

function blocchiIf(testo) {
  const fuori = [];
  let dentro = false;
  let corrente = [];
  for (const riga of righeDi(testo)) {
    if (!dentro && /^\s*if errorlevel 1 \(/.test(riga)) {
      dentro = true;
      corrente = [riga];
      continue;
    }
    if (dentro) {
      corrente.push(riga);
      if (/^\)\s*$/.test(riga)) {
        fuori.push(corrente.join('\r\n') + '\r\n');
        dentro = false;
        corrente = [];
      }
    }
  }
  return fuori;
}

test('i blocchi if di build_exe.bat cmd.exe li legge senza rompersi (eseguito davvero)',
  {skip: WINDOWS ? false : SALTO}, () => {
    const blocchi = blocchiIf(bat);
    assert.ok(blocchi.length >= 3,
      'build_exe.bat dovrebbe avere almeno tre blocchi "if errorlevel 1" (uno per exe). ' +
      'Trovati: ' + blocchi.length);
    const dove = path.join(os.tmpdir(), 'fbl-bat-prova-' + process.pid + '.bat');
    try {
      blocchi.forEach((blocco, n) => {
        // Il blocco gira da solo: errorlevel e' 0, quindi il corpo NON si esegue (niente pause,
        // niente exit) - viene pero' LETTO, ed e' li' che una parentesi di troppo rompe cmd.
        fs.writeFileSync(dove, '@echo off\r\n' + blocco + 'echo FINE_OK\r\n', 'latin1');
        let uscita = '';
        try {
          uscita = execFileSync('cmd.exe', ['/c', dove], {
            stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000, encoding: 'latin1'
          });
        } catch (errore) {
          throw new Error(
            'il blocco if numero ' + (n + 1) + ' di build_exe.bat cmd.exe non lo legge: ' +
            'una parentesi non escapata chiude il blocco prima della fine (il .bat morirebbe con ' +
            '"X was unexpected at this time", come il flusso del 31 ottobre 2026). ' +
            'Blocco:\n' + blocco);
        }
        if (!/FINE_OK/.test(String(uscita))) {
          throw new Error('il blocco if numero ' + (n + 1) + ' non e\' arrivato in fondo');
        }
      });
    } finally {
      fs.rmSync(dove, {force: true});
    }
  });
