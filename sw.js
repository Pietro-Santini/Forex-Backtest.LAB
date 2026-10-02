// Service worker minimale: mette in cache i file dell'app così può
// funzionare offline e i browser la considerano "installabile".
//
// STRATEGIA CAMBIATA (era cache-first, ora è network-first) — causa di un bug reale appena
// scoperto: con cache-first, ogni volta che pubblichi un app.html aggiornato (anche solo per
// correggere un bug come quello MT5), chi ha già aperto l'app UNA VOLTA continua a vedere la
// versione VECCHIA anche dopo aver ricaricato la pagina — il service worker rispondeva sempre con
// la copia in cache PRIMA di controllare la rete, aggiornando la cache solo per il giro
// SUCCESSIVO. Risultato concreto: un fix pubblicato sembra "non funzionare" quando in realtà non
// è mai arrivato al browser, e non c'è alcun errore visibile che lo segnali — è emerso proprio
// così durante un test manuale. Con la rete disponibile (il caso normale) ora si prova SEMPRE la
// rete per prima; la cache resta come rete di sicurezza SOLO per l'uso offline vero (o se la rete
// è momentaneamente irraggiungibile). CACHE_NAME cambiato apposta (v2 -> v3) per invalidare una
// volta per tutte le cache vecchie di chi ha già usato l'app prima di questo fix.
// ---------------------------------------------------------------------------
// REGOLA: ALZA DI UNO QUESTO NUMERO A OGNI RILASCIO CHE L'UTENTE DEVE RICEVERE.
//
// Questa costante e' l'UNICA cosa che costringe il browser di chi ha gia' usato
// l'app a buttare via la copia in cache e riprendere i file aggiornati. Se
// pubblichi un app.html nuovo SENZA toccarla, l'activate() qui sotto non
// cancella nulla (la chiave cache e' rimasta la stessa) e una parte degli
// utenti continua a vedere la versione vecchia, senza nessun errore visibile:
// per te il fix "non funziona", in realta' non e' mai arrivato al browser.
//
// Va alzata in particolare ogni volta che si rigenera l'installer da
// installer_build (build_exe.bat + installer.iss): il pacchetto desktop
// contiene la sua copia di questo file, quindi le due cose vanno in coppia.
// Tenere allineate TUTTE le copie (vedi ISTRUZIONI_BUILD.txt):
//   applicazione/sw.js             -> quella che va sul repo del sito
//   installer_build/sw.js
//   installer_build/build/sw.js    -> quella impacchettata nell'exe
// Storico: v4 = pubblicato sul repo fino al 26-09-2026 · v5 = mai pubblicato
//          v6 = rilascio con installer desktop, Mt5FeedServer e protocollo
//               forexbacktestlab://
//          v7 = usata dalle copie in installer_build (il repo era rimasto a v6)
//          v8 = accesso alle sale Telegram: popup del codice che non si perde
//               piu', numero ricordato, suono all'arrivo di un segnale. Si salta
//               la v7 apposta: chi ha l'installer precedente ha gia' quella
//               chiave in cache e con lo stesso numero non scaricherebbe niente.
//          v9 = accesso da altri dispositivi: controllo del firewall corretto su
//               Windows italiano, messaggio del tablet che non accusa piu' il PC
//          v10 = accesso da altri dispositivi SOLO via Tailscale (https sul nome
//               .ts.net): niente Wi-Fi, niente firewall, stesso sito sul tablet
//          v11 = la prova del collegamento riconosce il permesso «rete locale» del
//               browser e offre il test diretto, invece di dire «computer non trovato»
//          v12 = login al conto MT5 dal tablet (mancava la chiave); dal tablet
//               «Disconnetti» e la chiusura della pagina non spengono piu' il PC
//          v13 = cambio conto MT5: le posizioni dell'altro conto non si chiudono piu'
//               a prezzo 0 nel Trade Journal, si mettono da parte e tornano
//          v14 = con piu' conti MT5 si sceglie su quale entrare (niente riconnessione
//               all'ultimo); server predefinito MetaQuotes-Demo
//          v15 = footprint allineato nell'ora 22-23 (via i tick MT5 storici dalle fasce
//               di Capital.com); linee TP/SL/entrata evidenziate mentre si premono
// ---------------------------------------------------------------------------
const CACHE_NAME = "forex-backtest-lab-v58";
const ASSETS = [
  "./",
  "./app.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// RETE CON RISERVA (segnalato: sul telefono, a ogni ritorno nell'app, la pagina da quasi 4 MB
// restava bianca finche' non era riscaricata tutta). Resta network-first - un app.html appena
// pubblicato arriva subito - ma se la rete non risponde entro RISERVA_MS e in cache c'e' una copia,
// si mostra SUBITO quella; il download continua comunque e aggiorna la cache per la volta dopo.
const RISERVA_MS = 4000;
function rispostaConRiserva(request) {
  const rete = fetch(request, { cache: 'no-store' })
    .then((response) => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    });
  const riserva = new Promise((resolve) => {
    setTimeout(() => {
      caches.match(request).then((c) => { if (c) resolve(c); });
    }, RISERVA_MS);
  });
  return Promise.race([
    rete.catch(() => caches.match(request).then((c) => c || Promise.reject(new Error('offline')))),
    riserva
  ]);
}

self.addEventListener("fetch", (event) => {
  // Solo richieste GET dello stesso sito. BUG CORRETTO: il commento lo diceva, il codice no - si
  // intercettava OGNI GET, compresi i dati dal vivo del PC (/positions, /account, notizie...) e di
  // Firebase/Capital.com, salvandone una copia. Col PC irraggiungibile si restituiva l'ultima copia:
  // posizioni e saldo VECCHI mostrati come attuali. I dati dal vivo non passano piu' da qui.
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Anche sullo stesso sito, SOLO i file dell'app: quando l'app e' servita dal PC (127.0.0.1:8000)
  // anche /positions e /account sono "dello stesso sito", e non devono mai finire in cache.
  const statico = event.request.mode === "navigate" || url.pathname.endsWith("/") ||
    /\.(html|js|css|json|png|ico|svg|webmanifest|woff2?)$/i.test(url.pathname);
  if (!statico) return;

  event.respondWith(
    // NETWORK-FIRST: prova sempre la rete per prima (così un app.html appena pubblicato arriva
    // SUBITO al prossimo caricamento, non "al giro dopo"); solo se la rete fallisce davvero
    // (offline, o richiesta momentaneamente irraggiungibile) si ripiega sulla copia in cache.
    //
    // {cache:'no-store'} AGGIUNTO — "network-first" qui sopra descrive solo la strategia del
    // service worker (cache delle *Cache API* propria), ma fetch() di per sé rispetta ANCHE la
    // cache HTTP del browser: senza questa opzione, questa richiesta "verso la rete" poteva
    // comunque tornare una risposta presa dalla cache-disco di Chrome (se ancora "fresca" secondo
    // l'euristica del browser) SENZA toccare davvero la rete — proprio il bug per cui un fix
    // pubblicato non arrivava a chi ricaricava con F5 invece di CTRL+SHIFT+R. Ora bypassa sempre
    // anche quella, in coppia con gli header no-cache lato server (vedi bridge.py, serve_app()).
    rispostaConRiserva(event.request)
  );
});
