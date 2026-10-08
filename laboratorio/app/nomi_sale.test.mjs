// LO STESSO NOME DI SALA OVUNQUE.
//
// RICHIESTO dal proprietario (8 ottobre 2026): «lo stesso identico nome in tutto il programma -
// pannello dei segnali, dashboard, profitto per sala, configurazione automatica, rendimento.
// Non puo' assolutamente cambiare».
//
// Radice del problema: il ponte manda DUE nomi per la stessa sala. `sala` e' la voce esatta che
// l'utente ha scritto nelle impostazioni (@nome, link t.me, id) ed e' quella con cui l'app
// riconosce una sala fra quelle accese; `chat` e' il titolo leggibile del gruppo su Telegram.
// La tabella dell'apertura automatica mostrava la prima, le operazioni la seconda.
//
// La regola: si riconosce con la chiave, si mostra con il titolo. Quindi mostrare il nome non
// deve MAI cambiare il modo in cui le sale vengono riconosciute.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const IMPARA = () => {
  fblSaleNomi = {};
  fblRegistraNomeSala({sala: '@goldsignals', chat: 'Gold Signals VIP'});
  fblRegistraNomeSala({sala: 'https://t.me/+abc123', chat: 'SALA STARK'});
};

test('dalla voce configurata esce il titolo leggibile, e dal titolo esce se stesso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((impara) => {
      eval('(' + impara + ')()');
      return {
        daChiave: fblSalaEtichetta('@goldsignals'),
        daTitolo: fblSalaEtichetta('Gold Signals VIP'),
        daLink: fblSalaEtichetta('https://t.me/+abc123'),
        maiuscole: fblSalaEtichetta('@GOLDSIGNALS'),
        sconosciuta: fblSalaEtichetta('@mai-vista'),
        vuota: fblSalaEtichetta('')
      };
    }, IMPARA.toString());
    assert.equal(r.daChiave, 'Gold Signals VIP');
    assert.equal(r.daTitolo, 'Gold Signals VIP', 'il titolo deve restare se stesso, non cambiare');
    assert.equal(r.daLink, 'SALA STARK');
    assert.equal(r.maiuscole, 'Gold Signals VIP', 'maiuscole e minuscole non devono creare due sale');
    assert.equal(r.sconosciuta, '@mai-vista', 'titolo mai visto: si mostra quello che si ha, non un vuoto');
    assert.equal(r.vuota, '');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('due forme diverse dello stesso nome indicano la stessa sala', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((impara) => {
      eval('(' + impara + ')()');
      return {
        chiaveVsTitolo: fblStessaSala('@goldsignals', 'Gold Signals VIP'),
        titoloVsChiave: fblStessaSala('Gold Signals VIP', '@goldsignals'),
        seStessa: fblStessaSala('@goldsignals', '@goldsignals'),
        diverse: fblStessaSala('@goldsignals', 'SALA STARK'),
        vuota: fblStessaSala('', 'Gold Signals VIP')
      };
    }, IMPARA.toString());
    assert.equal(r.chiaveVsTitolo, true, 'sono la stessa sala scritta nei due modi');
    assert.equal(r.titoloVsChiave, true);
    assert.equal(r.seStessa, true);
    assert.equal(r.diverse, false, 'due sale diverse non devono mai confondersi');
    assert.equal(r.vuota, false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il registro si impara dai segnali che arrivano, e sopravvive alla ricarica', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      fblSaleNomi = {}; localStorage.removeItem('fbl_sale_nomi');
      fblRegistraNomeSala({sala: '@nuova', chat: 'Sala Nuova'});
      const salvato = JSON.parse(localStorage.getItem('fbl_sale_nomi') || '{}');
      // un segnale senza titolo non deve cancellare quello che si sa gia'
      fblRegistraNomeSala({sala: '@nuova', chat: ''});
      return {dopo: fblSalaEtichetta('@nuova'), salvatoHaChiave: !!salvato['@nuova']};
    });
    assert.equal(r.dopo, 'Sala Nuova', 'un segnale senza titolo ha cancellato il nome imparato');
    assert.equal(r.salvatoHaChiave, true, 'il registro deve finire nella memoria del dispositivo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('mostrare il nome non cambia cio che viene SCRITTO sulle operazioni', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // La regola che non si puo' tradire: l'etichetta e' per gli occhi. Quello che l'app usa per
    // riconoscere una sala fra quelle accese deve restare la voce configurata.
    const r = await pagina.evaluate((impara) => {
      eval('(' + impara + ')()');
      const voce = {sala: '@goldsignals', chat: 'Gold Signals VIP'};
      return {scritto: fblNomeSala(voce), mostrato: fblSalaEtichetta(fblNomeSala(voce))};
    }, IMPARA.toString());
    assert.equal(r.scritto, 'Gold Signals VIP');
    assert.equal(r.mostrato, 'Gold Signals VIP');
    assert.equal(r.scritto, r.mostrato, 'cio che si scrive e cio che si mostra devono coincidere');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i titoli arrivano dal ponte, anche per sale che non hanno ancora mandato segnali', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // Il ponte li risolve su Telegram quando si mette in ascolto, per OGNI voce configurata:
    // e' il modo per avere il nome giusto anche di una sala silenziosa.
    const r = await pagina.evaluate(() => {
      fblSaleNomi = {}; localStorage.removeItem('fbl_sale_nomi');
      tgApplicaStato({tipo: 'stato', titoli: {'@silenziosa': 'Sala Silenziosa', 'https://t.me/+xyz': 'GOLD EMPIRE'}}, 'telegram');
      return {
        silenziosa: fblSalaEtichetta('@silenziosa'),
        link: fblSalaEtichetta('https://t.me/+xyz'),
        // anche dal titolo: deve restare se stesso
        titolo: fblSalaEtichetta('GOLD EMPIRE'),
        salvato: !!JSON.parse(localStorage.getItem('fbl_sale_nomi') || '{}')['@silenziosa']
      };
    });
    assert.equal(r.silenziosa, 'Sala Silenziosa');
    assert.equal(r.link, 'GOLD EMPIRE', 'un link di invito deve diventare il nome del gruppo');
    assert.equal(r.titolo, 'GOLD EMPIRE');
    assert.equal(r.salvato, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('uno stato senza titoli non cancella quelli gia imparati', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      fblSaleNomi = {};
      tgApplicaStato({tipo: 'stato', titoli: {'@gold': 'Gold Signals VIP'}}, 'telegram');
      tgApplicaStato({tipo: 'stato'}, 'telegram');                 // ponte vecchio: nessun titolo
      tgApplicaStato({tipo: 'stato', titoli: {}}, 'telegram');     // elenco vuoto
      return fblSalaEtichetta('@gold');
    });
    assert.equal(r, 'Gold Signals VIP', 'un ponte che non manda i titoli non deve farli perdere');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
