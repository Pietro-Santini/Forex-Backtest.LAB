// CONFRONTO PAGINA <-> PONTE: il lato pagina.
//
// Gira i casi di casi.json dentro app.html, chiamando la STESSA funzione che decide quando apri
// un segnale (tgPiano), e scrive il risultato in piani_pagina.json.
//
// Quel file e' il terreno di verita': quando il ponte avra' la sua decisione in Python,
// confronta.py la misura contro questo, caso per caso, e pretende numeri identici. Fino a quel
// giorno questo file serve a dire una cosa sola, e misurata: ecco ESATTAMENTE cosa decide la
// pagina oggi, caso per caso.
//
// Uso:  node laboratorio/confronto/misura_pagina.mjs
//
// PERCHE' UNA PAGINA FRESCA PER OGNI CASO. La prima versione teneva la stessa pagina per tutti
// i casi e la faceva ricaricare: dal terzo caso in poi la pagina misurava uno stato che nessuno
// aveva chiesto (e a volte non era piu' app.html). Un caso per pagina costa un paio di secondi
// e rende la misura ripetibile, che e' l'unica cosa che conta in uno strumento di confronto.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const casi = JSON.parse(fs.readFileSync(path.join(QUI, 'casi.json'), 'utf8'));
const URL_APP = 'file://' + path.join(RADICE, 'app.html');

// I campi che il confronto deve guardare. Se uno di questi differisce fra pagina e ponte, il
// ponte sta decidendo un'altra cosa - e su soldi veri non e' un dettaglio.
const CAMPI = [
    'side', 'entry', 'sl', 'tp', 'n', 'lotti', 'pct', 'importoTot',
    'rischioReale', 'pendente', 'kind', 'slCalcolato', 'tpCalcolato',
    'notaEntrata', 'notaRidotte', 'base', 'rr'
];

function normalizza(piano) {
    const out = {};
    for (const c of CAMPI) {
        let v = piano ? piano[c] : undefined;
        if (Array.isArray(v)) v = v.map(x => (typeof x === 'number' ? Number(x.toFixed(8)) : x));
        else if (typeof v === 'number') v = Number(v.toFixed(8));
        out[c] = v === undefined ? null : v;
    }
    out.problemi = (piano && piano.problemi) ? piano.problemi.slice() : [];
    return out;
}

const righe = [];
const errori = [];
const browser = await chromium.launch();

for (const caso of casi.casi) {
    const pagina = await browser.newPage({viewport: {width: 1400, height: 900}});
    pagina.on('pageerror', e => errori.push(caso.nome + ': ' + String(e)));
    await pagina.goto(URL_APP, {waitUntil: 'domcontentloaded'});

    let piano = null;
    try {
        piano = await pagina.evaluate((c) => {
            // Il prezzo lo do ALLA CANDELA: currentPrice() restituisce rows[idx].close fuori
            // dal Live, quindi non serve toccare funzioni dell'app - si mette il dato dove
            // l'app lo legge, e la misura resta onesta.
            const barra = {
                date: '2026-10-30 10:00', t: Date.UTC(2026, 9, 30, 8, 0),
                o: c.prezzo, h: c.prezzo, l: c.prezzo, close: c.prezzo, v: 1
            };
            rows = [barra];
            baseRows = [barra];
            idx = 0;
            const opz = {};
            if (c.prezzoScelto != null) opz.prezzo = c.prezzoScelto;
            return tgPiano(c.seg, c.sym, c.pctForzata, opz);
        }, caso);
    } catch (e) {
        piano = {problemi: ['misura non riuscita: ' + String(e).slice(0, 140)]};
    }
    await pagina.close();

    const n = normalizza(piano);
    righe.push({
        nome: caso.nome,
        ingresso: {seg: caso.seg, sym: caso.sym, prezzo: caso.prezzo, pctForzata: caso.pctForzata, prezzoScelto: caso.prezzoScelto || null},
        pagina: n
    });
    const motivo = n.problemi.length ? '  <' + n.problemi[0].slice(0, 88) + '>' : '';
    console.log(
        (n.problemi.length ? 'RIFIUTATO ' : 'accettato ') + caso.nome.padEnd(52) +
        'lotti=' + String(n.lotti) + ' importo=' + String(n.importoTot) + motivo
    );
}

await browser.close();

const uscita = {
    generato: new Date().toISOString(),
    sorgente: 'app.html tgPiano()',
    config: casi.config,
    campi: CAMPI,
    casi: righe
};
fs.writeFileSync(path.join(QUI, 'piani_pagina.json'), JSON.stringify(uscita, null, 1), 'utf8');
console.log('\nscritto piani_pagina.json (' + righe.length + ' casi)');
if (errori.length) {
    console.log('errori JS nella pagina: ' + errori.join(' | '));
    process.exit(1);
}
