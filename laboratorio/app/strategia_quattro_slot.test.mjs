// QUATTRO STRATEGIE PER OGNI SALA, non una sola.
//
// RICHIESTO dal proprietario: «all'interno della configurazione delle strategie inserisci pure
// che quella configurazione vale per un conto demo o per un conto in gestione tramite prop firm
// di FTMO. E ovviamente sara' diverso per one step e two step».
//
// Le quattro: conto NORMALE, prop ONE STEP, prop TWO STEP SFIDA 1, prop TWO STEP SFIDA 2. Non e'
// pignoleria: su un one step si rischia il 3% al giorno e su un two step il 5%, e la sfida 2
// chiede solo il 5% di obiettivo invece del 10% - tre situazioni in cui un trader prudente NON
// userebbe la stessa dimensione di posizione.
//
// IL PEZZO CHE CONTA DAVVERO E' IL PASSAGGIO DAL VECCHIO FORMATO. Oggi la memoria e'
// {sala: configurazione}: una sola per sala. Chi ha gia' configurato le sue sale non deve
// ritrovarsele vuote - e nemmeno doverle riscrivere quattro volte.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const CFG = (q) => ({modo:'posizioni', equa:false, quote:[q], regole:[''], avv:{attivo:false,pct:70}});

async function nellApp(codice){
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(codice);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    return r;
  } finally { await browser.close(); }
}

test('i quattro slot esistono e sono indipendenti', async () => {
  const r = await nellApp(`(function(){
    try{ localStorage.removeItem('fbl_crono_strategia'); }catch(e){}
    stratSalva('SalaX', ${JSON.stringify(CFG(10))}, 'normale');
    stratSalva('SalaX', ${JSON.stringify(CFG(20))}, 'prop1');
    stratSalva('SalaX', ${JSON.stringify(CFG(30))}, 'prop2a');
    stratSalva('SalaX', ${JSON.stringify(CFG(40))}, 'prop2b');
    return {
      normale: stratLeggi('SalaX','normale').quote[0],
      prop1:   stratLeggi('SalaX','prop1').quote[0],
      prop2a:  stratLeggi('SalaX','prop2a').quote[0],
      prop2b:  stratLeggi('SalaX','prop2b').quote[0]
    };
  })()`);
  assert.deepEqual(r, {normale:10, prop1:20, prop2a:30, prop2b:40},
    'ogni slot deve tenersi la SUA configurazione: scrivere in uno non ne tocca un altro');
});

test('una sala di un ALTRO nome non viene toccata', async () => {
  // PROVA DI CONTROLLO: se gli slot fossero tenuti male, scrivere su una sala potrebbe
  // sovrascrivere l'altra - e nessuno se ne accorgerebbe finche' non si riapre quella giusta.
  const r = await nellApp(`(function(){
    try{ localStorage.removeItem('fbl_crono_strategia'); }catch(e){}
    stratSalva('SalaA', ${JSON.stringify(CFG(11))}, 'normale');
    stratSalva('SalaB', ${JSON.stringify(CFG(22))}, 'normale');
    return {a: stratLeggi('SalaA','normale').quote[0], b: stratLeggi('SalaB','normale').quote[0]};
  })()`);
  assert.deepEqual(r, {a:11, b:22});
});

test('IL PASSAGGIO DAL VECCHIO FORMATO: la configurazione che c\'era diventa quella NORMALE', async () => {
  // La memoria vecchia e' {sala: configurazione}, senza slot. Chi riapre l'app dopo
  // l'aggiornamento deve ritrovare la sua configurazione dov'e' naturale cercarla: sul conto
  // normale. Perderla sarebbe il modo piu' rapido di far rifare a mano un lavoro gia' fatto.
  const r = await nellApp(`(function(){
    try{ localStorage.setItem('fbl_crono_strategia', JSON.stringify({
      SalaVecchia: ${JSON.stringify(CFG(77))}
    })); }catch(e){}
    return {normale: stratLeggi('SalaVecchia','normale').quote[0]};
  })()`);
  assert.equal(r.normale, 77, 'la vecchia configurazione dev\'essere ancora li\'');
});

test('e gli altri tre slot PARTONO DA UNA SUA COPIA, non vuoti', async () => {
  // Chi aveva gia' impostato una sala non deve riscriverla quattro volte per avere un punto di
  // partenza: le tre prop nascono uguali alla normale, e si cambiano solo dove serve davvero.
  // Partire vuoti vorrebbe dire che accendendo la prop firm la sala smette di operare, e
  // sembrerebbe un difetto.
  const r = await nellApp(`(function(){
    try{ localStorage.setItem('fbl_crono_strategia', JSON.stringify({
      SalaVecchia: ${JSON.stringify(CFG(77))}
    })); }catch(e){}
    return {
      prop1:  stratLeggi('SalaVecchia','prop1'),
      prop2a: stratLeggi('SalaVecchia','prop2a'),
      prop2b: stratLeggi('SalaVecchia','prop2b')
    };
  })()`);
  assert.ok(r.prop1 && r.prop1.quote[0] === 77, 'il one step parte dalla copia della normale');
  assert.ok(r.prop2a && r.prop2a.quote[0] === 77, 'e cosi\' la sfida 1');
  assert.ok(r.prop2b && r.prop2b.quote[0] === 77, 'e la sfida 2');
});

test('cambiare uno slot NON cambia gli altri, anche se erano nati copiati', async () => {
  // La copia iniziale e' un punto di partenza, non un legame: se restassero agganciati,
  // modificare il one step cambierebbe anche il conto normale - e sarebbe il peggiore dei
  // difetti, perche' silenzioso e su soldi veri.
  const r = await nellApp(`(function(){
    try{ localStorage.setItem('fbl_crono_strategia', JSON.stringify({
      SalaVecchia: ${JSON.stringify(CFG(77))}
    })); }catch(e){}
    stratLeggi('SalaVecchia','prop1');            // fa nascere le copie
    stratSalva('SalaVecchia', ${JSON.stringify(CFG(5))}, 'prop1');
    return {
      prop1:   stratLeggi('SalaVecchia','prop1').quote[0],
      normale: stratLeggi('SalaVecchia','normale').quote[0],
      prop2a:  stratLeggi('SalaVecchia','prop2a').quote[0]
    };
  })()`);
  assert.equal(r.prop1, 5, 'lo slot cambiato ha il valore nuovo');
  assert.equal(r.normale, 77, 'il conto normale resta com\'era');
  assert.equal(r.prop2a, 77, 'e anche la sfida 1');
});

test('senza indicare lo slot vale quello NORMALE: il codice che c\'era continua a funzionare', async () => {
  // Compatibilita' all'indietro. In app.html stratLeggi(sala) e' chiamata da piu' punti (per
  // esempio fblChiusuraPreCfg): se cambiando firma quelle chiamate ricevessero null, smetterebbe
  // di funzionare roba che non c'entra niente con la prop firm.
  const r = await nellApp(`(function(){
    try{ localStorage.removeItem('fbl_crono_strategia'); }catch(e){}
    stratSalva('SalaY', ${JSON.stringify(CFG(9))}, 'normale');
    return {senzaSlot: stratLeggi('SalaY') ? stratLeggi('SalaY').quote[0] : null};
  })()`);
  assert.equal(r.senzaSlot, 9, 'chiamata senza slot deve dare la strategia del conto normale');
});
