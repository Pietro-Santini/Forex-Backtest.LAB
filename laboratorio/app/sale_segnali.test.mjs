// LA SEZIONE «SALE SEGNALI» STA DAVVERO SU UN'ALTRA PAGINA, E «COLLEGAMENTO» HA TENUTO
// SOLO QUELLO CHE GLI COMPETE.
//
// RICHIESTA DEL PROPRIETARIO (22 ottobre 2026): «non può stare tutto quanto all'interno di
// collegamento. Le cose del collegamento saranno all'interno della pagina collegamento. Le cose
// che riguardano la sala segnale, la cronologia, configurazione di apertura automatica e tutto
// quello che riguarda le sale andrà proprio nella sezione sale segnali».
//
// QUI SI MISURA DOVE STA CIASCUN CONTROLLO (il pannello che lo contiene) E SE SI VEDE davvero
// quando la sua scheda è aperta. Non si cerca una parola nel sorgente: si apre la pagina vera,
// in un browser vero, e si guarda.
//
// LA PROVA DI CONTROLLO c'è ed è in fondo: i pulsanti spostati devono fare ANCORA quello che
// facevano. Una sezione bella ma morta non è una sezione.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// I controlli che il proprietario ha detto: stanno nella sezione delle sale.
const DELLE_SALE = ['tgOpenPanelBtn', 'tgAutoBtn', 'tgGroupList', 'tgNewGroup', 'tgAddBtn',
                    'syntraStatoBox', 'syntraAttivo', 'syntraAvvio', 'syntraFolder',
                    'syntraRefreshBtn', 'syntraUtentiList'];

// I controlli che restano del collegamento.
const DEL_COLLEGAMENTO = ['tgStatusBox', 'tgPort', 'tgRefreshBtn', 'tgToggleBtn',
                          'tgDimenticaTelBtn', 'tgTelefonoSalvatoLbl', 'tgTelefonoForgetBtn',
                          'tgSetupBox', 'tgApiId', 'tgApiHash', 'tgSalvaCredBtn', 'fblRemotoBtn'];

// Apre le impostazioni generali e preme una scheda.
const APRI_SCHEDA = (idScheda) => {
  const ov = document.getElementById('generalSettingsModalOverlay');
  if (!ov) return {errore: 'non c\'è il popup delle impostazioni'};
  ov.style.display = 'flex';
  const b = document.getElementById(idScheda);
  if (!b) return {errore: 'non c\'è la scheda ' + idScheda};
  b.click();
  return {};
};

test('ogni controllo sta nella sezione che gli compete', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(([sale, collegamento]) => {
      const pannelloDi = (id) => {
        const el = document.getElementById(id);
        if (!el) return 'manca';
        const p = el.closest('[data-gensettings-panel]');
        return p ? p.dataset.gensettingsPanel : 'fuori-da ogni sezione';
      };
      const out = {sale: {}, collegamento: {}};
      sale.forEach(id => { out.sale[id] = pannelloDi(id); });
      collegamento.forEach(id => { out.collegamento[id] = pannelloDi(id); });
      // La cronologia delle sale: dentro le sale, e NON dentro il collegamento.
      const pSale = document.querySelector('[data-gensettings-panel="sale"]');
      const pCol = document.querySelector('[data-gensettings-panel="collegamento"]');
      out.cronologiaNelleSale = !!(pSale && pSale.querySelector('.fblCronoBtn'));
      out.cronologiaNelCollegamento = !!(pCol && pCol.querySelector('.fblCronoBtn'));
      return out;
    }, [DELLE_SALE, DEL_COLLEGAMENTO]);

    const fuori = Object.entries(r.sale).filter(([, p]) => p !== 'sale')
      .map(([id, p]) => id + ' -> ' + p);
    assert.deepEqual(fuori, [],
      'questi controlli devono stare nella sezione «Sale segnali»: ' + fuori.join(', '));

    const altrove = Object.entries(r.collegamento).filter(([, p]) => p !== 'collegamento')
      .map(([id, p]) => id + ' -> ' + p);
    assert.deepEqual(altrove, [],
      'questi controlli devono restare nel collegamento: ' + altrove.join(', '));

    assert.equal(r.cronologiaNelleSale, true, 'la cronologia delle sale sta nelle sale');
    assert.equal(r.cronologiaNelCollegamento, false,
      'la cronologia delle sale NON deve restare nel collegamento');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la sezione «Sale segnali» si apre e mostra le sale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((apri) => {
      const err = eval('(' + apri + ')')('genSettingsTabSale');
      if (err.errore) return err;
      const v = (id) => {
        const el = document.getElementById(id);
        return !!(el && el.checkVisibility());
      };
      return {
        errore: null,
        visibili: {
          tgOpenPanelBtn: v('tgOpenPanelBtn'), tgAutoBtn: v('tgAutoBtn'),
          tgGroupList: v('tgGroupList'), tgNewGroup: v('tgNewGroup'), tgAddBtn: v('tgAddBtn')
        },
        collegamentoNascosto: !document.querySelector('[data-gensettings-panel="collegamento"]')
          .checkVisibility()
      };
    }, APRI_SCHEDA.toString());

    assert.equal(r.errore, null, 'la scheda «Sale segnali» deve esistere');
    for (const [id, ok] of Object.entries(r.visibili)) {
      assert.equal(ok, true, 'quando si apre «Sale segnali» si deve vedere ' + id);
    }
    assert.equal(r.collegamentoNascosto, true,
      'aprendo «Sale segnali» il collegamento deve chiudersi');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il collegamento si apre e mostra il ponte e l\'account Telegram', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((apri) => {
      const err = eval('(' + apri + ')')('genSettingsTabCollegamento');
      if (err.errore) return err;
      const v = (id) => {
        const el = document.getElementById(id);
        return !!(el && el.checkVisibility());
      };
      return {
        errore: null,
        visibili: {
          tgStatusBox: v('tgStatusBox'), tgToggleBtn: v('tgToggleBtn'),
          fblRemotoBtn: v('fblRemotoBtn'), tgRefreshBtn: v('tgRefreshBtn')
        },
        saleNascosto: !document.querySelector('[data-gensettings-panel="sale"]').checkVisibility()
      };
    }, APRI_SCHEDA.toString());

    assert.equal(r.errore, null, 'la scheda «Collegamento» deve esistere');
    for (const [id, ok] of Object.entries(r.visibili)) {
      assert.equal(ok, true, 'quando si apre «Collegamento» si deve vedere ' + id);
    }
    assert.equal(r.saleNascosto, true, 'aprendo «Collegamento» le sale devono chiudersi');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: i pulsanti spostati fanno ancora il loro mestiere', async () => {
  // Se il bottone è stato spostato in un'altra sezione e non fa più niente, la sezione è solo
  // un'etichetta. Qui si preme e si guarda che cosa si apre.
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (apri) => {
      const err = eval('(' + apri + ')')('genSettingsTabSale');
      if (err.errore) return err;
      const apriPannello = () => {
        document.getElementById('tgOpenPanelBtn').click();
        return document.getElementById('tgPanel').style.display;
      };
      const apriAuto = () => {
        document.getElementById('tgAutoBtn').click();
        return document.getElementById('tgAutoOverlay').style.display;
      };
      const pannello = apriPannello();
      document.getElementById('tgPanelCloseBtn')?.click();
      const auto = apriAuto();
      document.getElementById('tgAutoCloseBtn')?.click();
      return {errore: null, pannello, auto};
    }, APRI_SCHEDA.toString());

    assert.equal(r.errore, null);
    assert.equal(r.pannello, 'flex',
      '«Apri il pannello dei segnali» deve ancora aprire il pannello dei segnali');
    assert.equal(r.auto, 'flex',
      '«Configura apertura automatica» deve ancora aprire l\'apertura automatica');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la sezione nuova è una sezione nuova, non un doppione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => ({
      pannelliSale: document.querySelectorAll('[data-gensettings-panel="sale"]').length,
      schedeSale: document.querySelectorAll('[data-gensettings-tab="sale"]').length,
      // I due pannelli non possono stare uno dentro l'altro.
      unoDentroLaltro: !!document.querySelector(
        '[data-gensettings-panel="sale"] [data-gensettings-panel="collegamento"],' +
        '[data-gensettings-panel="collegamento"] [data-gensettings-panel="sale"]'),
      schedeNellaBarra: [...document.querySelectorAll('#generalSettingsModalOverlay ' +
        '[data-gensettings-tab]')].map(b => b.dataset.gensettingsTab)
    }));
    assert.equal(r.pannelliSale, 1, 'una sezione «Sale segnali» e non due');
    assert.equal(r.schedeSale, 1, 'una scheda «Sale segnali» e non due');
    assert.equal(r.unoDentroLaltro, false,
      '«Sale segnali» e «Collegamento» sono due sezioni sorelle, non una dentro l\'altra');
    assert.ok(r.schedeNellaBarra.includes('sale'), 'la scheda deve essere nella barra');
    assert.ok(r.schedeNellaBarra.includes('collegamento'), 'il collegamento resta nella barra');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
