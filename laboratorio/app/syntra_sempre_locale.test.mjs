// UN COMANDO DI SYNTRA NON VA MAI AL SERVER.
//
// SEGNALATO dal proprietario: «ha smesso di funzionare il robot dentro BlueStacks, non verifica
// piu' le nuove posizioni; non si deve mai fermare, deve sempre rimanere attivo quando l'app
// gira».
//
// NON SI ERA FERMATO: i suoi comandi finivano dall'altra parte. Nei log del server Oracle,
// timbrati mentre lo segnalava:
//     [19:17:58] lettore Syntra spento
//     [19:18:01] lettore Syntra acceso
//     [19:18:01] Syntra non parte: funziona solo sul computer, legge l'app Android dentro
//                BlueStacks, che su un server Linux non c'e'.
//
// LA CAUSA. `tgInviaSyntra` usava il canale locale solo se `tgSyntraSeparata()` era vera, e quella
// richiedeva `fblPonteLocaleVivo===true`. Quando il ponte locale non risultava vivo si ripiegava
// su `tgInvia`, che con un server configurato manda AL SERVER. Il server rifiuta - giustamente -
// ma quel rifiuto l'utente non lo vede: vede un robot fermo.
// E il ponte locale risultava morto per un difetto gia' corretto in v2.0.15 (si spegneva a ogni
// ricarica della pagina): bastava un aggiornamento per dirottare i comandi e non tornare piu'
// indietro. Due difetti in fila, di cui il secondo nascondeva il primo.
//
// LA REGOLA: Syntra E' il computer, per definizione - legge un'app Android dentro un emulatore che
// gira li'. Un comando di Syntra o arriva al ponte locale o NON PARTE, e si dice perche'.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {RADICE} from './aiuti.mjs';

const SORGENTE = () => fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
const CORPO = () => {
  const s = SORGENTE();
  const i = s.indexOf('function tgInviaSyntra(');
  assert.ok(i > 0, 'la funzione deve esistere');
  // Ci si ferma alla PRIMA graffa a inizio riga: una finestra a lunghezza fissa sconfinava nelle
  // funzioni successive e faceva fallire il controllo per colpa del codice di un'altra.
  const dentro = s.slice(i);
  const fine = dentro.search(/\r?\n\}/);
  return dentro.slice(0, fine > 0 ? fine : 1600);
};
// Solo il CODICE: le righe di commento vanno tolte, altrimenti il nome di una funzione citata
// nella spiegazione del perche' e' stata tolta farebbe fallire il controllo che e' stata tolta.
const SOLO_CODICE = () => CORPO()
  .split(/\r?\n/)
  .filter(r => !r.trim().startsWith('//'))
  .join(' ');

test('con un server configurato il comando non ripiega mai su tgInvia', () => {
  const f = SOLO_CODICE();
  // Il ripiego era `if(tgSyntraSeparata()){...} return tgInvia(oggetto);`: bastava che il ponte
  // locale non risultasse vivo e il comando partiva verso il server.
  assert.ok(!/tgSyntraSeparata\(\)/.test(f),
    'non si decide piu\' in base a se il ponte locale RISULTA vivo: se non lo e\', il comando '
    + 'non parte e lo si dice, invece di dirottarlo dove non puo\' funzionare');
  assert.match(f, /if\(fblServer\(\)\)/,
    'con un server configurato si usa il canale locale dedicato');
});

test('quando il ponte locale non c\'e\', lo dice invece di stare zitto', () => {
  const f = CORPO();
  assert.match(f, /tgStato\(/,
    'il silenzio e\' il difetto: l\'utente vedeva solo un robot fermo, senza nessun messaggio');
  assert.match(f, /vive sul computer/,
    'e il messaggio deve spiegare PERCHE\': Syntra legge BlueStacks, che sta sul computer');
});

test('senza server configurato tutto resta come prima', () => {
  // La prova di controllo: chi non usa il server ha un ponte solo, e tgInvia va gia' li'. Se la
  // correzione avesse tolto anche quella strada, il robot non partirebbe piu' per nessuno.
  const f = CORPO();
  assert.match(f, /return tgInvia\(oggetto\);/,
    'senza server il comando deve continuare ad andare per la strada normale');
});

test('il canale dedicato di Syntra punta a 127.0.0.1, mai al server', () => {
  const s = SORGENTE();
  const i = s.indexOf('async function tgSyntraCollega(');
  assert.ok(i > 0, 'la funzione deve esistere');
  // Fino alla funzione successiva, non una finestra a lunghezza fissa: dentro questa funzione il
  // codice puo' crescere (ci e' appena entrato il battito di riaggancio) e una finestra corta
  // smetterebbe di vedere la riga che conta.
  const dentro = s.slice(i);
  const fine = dentro.search(/\r?\n(async )?function /);
  const f = dentro.slice(0, fine > 0 ? fine : 3000);
  assert.match(f, /fblBaseUrl\(tgPortNow\(\),'127\.0\.0\.1'\)/,
    'l\'indirizzo del ponte di Syntra e\' sempre quello di questo computer');
});

test("ma su un dispositivo dove Syntra non e acceso non si tenta niente", () => {
  // IL TEST VECCHIO AVEVA RAGIONE, E L'HA DETTO. La prima correzione teneva aperto il canale
  // locale ogni volta che c'era un server: su un telefono collegato al server non c'e' nessun
  // ponte locale e non c'e' BlueStacks, quindi sarebbe stato un collegamento a 127.0.0.1 tentato
  // ogni mezzo minuto per niente, piu' un messaggio d'errore che parla di un computer che non e'
  // quello in mano. Se ne e' accorto server_oracle.test.mjs, che pretende «nessuna chiamata al
  // PC» quando si usa il server.
  // LA CONDIZIONE GIUSTA E' LA VOLONTA' DELL'UTENTE, non una sonda sul ponte: se il lettore di
  // Syntra e' acceso nelle impostazioni, questo dispositivo E' il computer che legge BlueStacks.
  const s = SORGENTE();
  const i = s.indexOf('function tgSyntraVoluto(');
  assert.ok(i > 0, "deve esistere un modo di sapere se Syntra e voluto su QUESTO dispositivo");
  const f = s.slice(i, i + 700);
  assert.match(f, /syntraAttivo/, "si guarda l'interruttore di Syntra");
  assert.match(f, /fbl_syntra_voluto/,
    "e la scelta si ricorda, perche all'avvio serve saperlo PRIMA che un ponte risponda");
  // DUE SEGNALI IN OR, e nessuno dei due da solo basta: il ponte locale vivo DIMOSTRA che
  // questo e un computer (prova positiva), la volonta dell utente copre il caso che ha rotto il
  // robot - ponte locale spento e comandi dirottati al server. Pretendere la sonda era il
  // difetto; ignorarla sarebbe stato l eccesso opposto.
  assert.match(s, /tgSyntraVoluto\(\)\|\|fblPonteLocaleVivo===true/,
    "basta che Syntra sia voluto qui OPPURE che il ponte locale risponda");
});
