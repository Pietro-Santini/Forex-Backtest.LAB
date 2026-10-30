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
    let pagina = await browser.newPage({viewport: {width: 1400, height: 900}});
    pagina.on('pageerror', e => errori.push(caso.nome + ': ' + String(e)));
    await pagina.goto(URL_APP, {waitUntil: 'domcontentloaded'});

    let piano = null;
    for (let tentativo = 1; tentativo <= 3 && piano == null; tentativo++) {
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
        // La pagina a volte si ricarica da sola durante il primo caso: non e' un rifiuto del
        // segnale, e segnarlo come tale vorrebbe dire un confronto rosso per un incidente di
        // misura. Si riprova con una pagina fresca; solo se riprova e ricasca si arrende.
        piano = null;
        await pagina.close();
        pagina = await browser.newPage({viewport: {width: 1400, height: 900}});
        pagina.on('pageerror', e2 => errori.push(caso.nome + ': ' + String(e2)));
        await pagina.goto(URL_APP, {waitUntil: 'domcontentloaded'});
        if (tentativo === 3) piano = {problemi: ['misura non riuscita dopo 3 tentativi: ' + String(e).slice(0, 140)]};
    }
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

// ---- FASE 2: la matematica del prezzo. Gli stessi simboli e le stesse combinazioni che
// ponte_matematica.py calcola da solo: il confronto deve dare lo stesso numero.
const MAT_SIMBOLI = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'XAGUSD', 'NZDCAD', 'AUDUSD', 'EURCHF', 'BINANCE:BTCUSDT'];
const MAT_COMBINAZIONI = [
    {side: 'BUY', entry: 1.09850, exit: 1.10500, lots: 0.10},
    {side: 'SELL', entry: 1.09850, exit: 1.09200, lots: 0.50},
    {side: 'BUY', entry: 4020.00, exit: 4060.00, lots: 0.02},
    {side: 'SELL', entry: 4020.00, exit: 4000.00, lots: 0.01},
];
const matematica = await (async () => {
    const b = await chromium.launch();
    const pg = await b.newPage({viewport: {width: 1400, height: 900}});
    await pg.goto(URL_APP, {waitUntil: 'domcontentloaded'});
    const out = await pg.evaluate(({simboli, combinazioni}) => {
        return simboli.map(sym => ({
            sym,
            pipDigit: (() => {
                const i = currentInstrument(sym);
                return (i && i.pipDigit != null) ? i.pipDigit : null;
            })(),
            pipSize: pipSizeForAsset(sym),
            contractSize: contractSize(sym),
            plMode: currentInstrument(sym).plMode,
            casi: combinazioni.map(c => ({
                ingresso: c,
                pl: calculateForexPL(c.side, c.entry, c.exit, c.lots, sym),
                euroAtLevel: euroAtLevel(c.entry, c.exit, c.lots, sym),
                margin: marginForLots(c.lots, c.entry, sym),
            })),
        }));
    }, {simboli: MAT_SIMBOLI, combinazioni: MAT_COMBINAZIONI});
    await b.close();
    return out;
})();

// La configurazione EFFETTIVA della pagina, per famiglia di strumento: una sola sorgente di
// verita'. Senza questa, il confronto misurava la config scritta a mano in casi.json - che la
// pagina non legge - e segnalava differenze che erano difetti del caso, non del ponte.
const configEffettiva = await (async () => {
    const b = await chromium.launch();
    const pg = await b.newPage({viewport: {width: 1400, height: 900}});
    await pg.goto(URL_APP, {waitUntil: 'domcontentloaded'});
    const out = await pg.evaluate((simboli) => {
        // Per SIMBOLO, non per famiglia: il caso deve prendere la config che la pagina
        // userebbe per quel simbolo (tgAutoPerSimbolo fa esattamente questa strada).
        return simboli.map(sym => {
            let A = null;
            try { A = tgAutoPerSimbolo(sym); } catch (e) { A = null; }
            if (A && A.sale) { /* lascia stare: qui conta il universale della famiglia */ }
            return {
                sym,
                rischioTotale: tgRischioTotale(),
                rischioSenzaSl: tgRischioSenzaSlDi(A, null),
                tpSenzaTpPct: tgTpSenzaTpPctDi(A, null, false),
                tpSenzaNullaPct: (function () { try { return tgTpSenzaNullaPct(A); } catch (e) { return 50; } })(),
                apriSenzaSl: tgApreSenzaSl(A),
                apriSenzaTp: tgApreSenzaTp(A),
                parti: 1,
                saldo: realizedBalanceNow(),
                passoLotto: 0.01,
                minimoLotto: 0.01,
                maxN: null,
                famiglia: (function () { try { return tgFamDaSimbolo(sym); } catch (e) { return null; } })(),
            };
        });
    }, MAT_SIMBOLI);
    await b.close();
    return out;
})();

const uscita = {
    generato: new Date().toISOString(),
    sorgente: 'app.html tgPiano()',
    config: casi.config,
    configEffettiva,
    campi: CAMPI,
    casi: righe,
    matematica: {
        sorgente: 'app.html pipSizeForAsset/calculateForexPL/marginForLots',
        simboli: MAT_SIMBOLI,
        combinazioni: MAT_COMBINAZIONI,
        righe: matematica,
    }
};
fs.writeFileSync(path.join(QUI, 'piani_pagina.json'), JSON.stringify(uscita, null, 1), 'utf8');
console.log('\nscritto piani_pagina.json (' + righe.length + ' casi)');
if (errori.length) {
    console.log('errori JS nella pagina: ' + errori.join(' | '));
    process.exit(1);
}
