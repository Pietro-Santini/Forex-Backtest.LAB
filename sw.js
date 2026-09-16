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
const CACHE_NAME = "forex-backtest-lab-v4";
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

self.addEventListener("fetch", (event) => {
  // Solo richieste GET dello stesso sito
  if (event.request.method !== "GET") return;

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
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});