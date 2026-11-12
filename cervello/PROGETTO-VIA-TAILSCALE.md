# Progetto: VIA TAILSCALE, TUTTO DAL SERVER — brief per l'esecutore

Data: 10 novembre 2026. Scritto da OpenCode per il proprietario, da passare a Claude.
Stato del progetto misurato oggi, non a memoria: l'inventario esatto è in fondo (31 file, 220 righe).

## 1. L'obiettivo, in una frase

Tailscale **non deve esistere più da nessuna parte** del progetto, e grafico, segnali, ordini,
sessioni e APK devono passare **tutti dal server** (Oracle), su un dominio vero con certificato,
con l'accesso tramite account Google o email/password come già avviene.

## 2. Le regole non negoziabili (da `cervello/REGOLE.md`, valgono sempre)

1. **Nessuna chiave nel repository, nel cloud o nei messaggi.** La chiave di accesso sta solo sul
   PC e sul server (`accesso_remoto.json`, `accesso_condiviso.py`), mai in un file versionato.
2. **Si misura prima di correggere.** Ogni passo ha un banco che misura il comportamento
   (`laboratorio/app/*.test.mjs` coi browser, `laboratorio/ponte/test_*.py` col ponte): il banco
   deve essere **rosso senza la cura e verde con**. Un test che legge il testo del sorgente non
   conta come prova.
3. **Versione alzata a ogni commit** (`sw.js` → `CACHE_NAME`, `installer_build/installer.iss` →
   `MyAppVersion`), e il collaudo su **GitHub** è quello che conta, non solo il locale.
4. **L'ordine dei passi non è negoziabile** (gia' scritto in `cervello/CONSEGNA-OPENCODE-5-NOVEMBRE.md`
   riga 426): prima il **dominio funziona e il telefono lo vede dai dati mobili**, e solo dopo si
   toglie Tailscale dall'app, dal ponte, dal server e dall'installer. Togliere prima vuol dire
   restare senza accesso dal telefono.
5. **Il PC deve continuare a funzionare da solo**, senza server e senza Tailscale: oggi il ponte
   ascolta su `127.0.0.1:8000` e l'app è servita da lì. Questa strada locale non si tocca.

## 3. Come è fatto oggi (misurato il 10 novembre 2026)

| Pezzo | Oggi | File |
|---|---|---|
| Server | `prepara_server.sh` installa Tailscale e pubblica con `tailscale serve --https=8000/8769/8001` | `server_oracle/prepara_server.sh` righe 29-31, 48-55, 58 |
| Dominio | lo script **esiste gia'**: Caddy + Let's Encrypt + nome (DuckDNS o proprio), espone **solo** `/dati` e `/dati/ascolta` | `server_oracle/prepara_dominio.sh`, guida in `cervello/GUIDA-DOMINIO-SENZA-TAILSCALE.md` |
| Accesso | solo rete privata Tailscale + chiave; le richieste non locali passano per `accesso_condiviso.richiesta_locale()` | `installer_build/build/accesso_condiviso.py`, `server_oracle/multiutente.py` |
| Inoltro al PC | `/pc/{8000,8001,8769}` dal server al PC, sul nome Tailscale del PC | `server_oracle/ponte_server.py` righe 80, 111, 180 |
| App | l'indirizzo del server sta in `localStorage` (`FBL_SERVER_KEY`), letto da `fblServer()`; l'URL si costruisce con `fblServerUrl(porta)` → `https://<nome>:<porta>` | `app.html` (`fblServer`, `fblServerUrl`, `fblOrdiniVia`, `fblUrlOrdini`, `fblUrlDati`, `fblPaginaDalPonteLocale`, `fblCollegamentoHostValido`) |
| Telefono/tablet | oggi punta a `pietro.tail83d918.ts.net` (il nome Tailscale del server) | pannello «Accesso da altri dispositivi», `accesso_remoto.json` |
| Test | simulano la rete privata con header finti: `x-forwarded-for: 100.101.102.103`, `host: server.tail1234.ts.net` | `laboratorio/ponte/test_chiave_personale.py`, `test_server_oracle.py`, `test_porta_unica.py`, `test_custode_servizio_dati.py` |

## 4. La decisione tecnica da prendere per prima (e la mia raccomandazione)

Con un dominio e Caddy, **tutti i servizi stanno su una sola porta (443) e si distinguono per
percorso**, non per porta. Ma l'app oggi costruisce `https://<server>:8000`, `:8001`, `:8769`.
Quindi una delle due:

- **(A) Raccomandata: un solo nome, percorsi diversi.** Caddy pubblica su `https://<dominio>`:
  `/dati/*` (documenti e sessione), `/pc/8000/*` (ordini del PC), `/pc/8001/*` (dati MT5),
  `/pc/8769/*` (segnali), `/segnali/*`. Poi in `app.html` si insegna a `fblServerUrl(porta)` a
  costruire `https://<dominio>/pc/<porta>` **quando il server è un dominio e non un nome `.ts.net`**.
  Vantaggio: una sola porta aperta, un solo certificato, nessun problema di contenuto misto.
- (B) alternativa: aprire publlicamente 8000/8001/8769 sul dominio. Funziona, ma sono tre porte
  in piu' da aprire sul firewall di Oracle e tre certificati da gestire. Sconsigliata.

**La conseguenza pratica per l'app**: `fblServerUrl()` deve sapere distinguere «nome `.ts.net`»
(oggi: `https://nome:porta`) da «dominio» (dopo: `https://dominio/pc/porta`). Il riconoscimento
deve cadere quando il dominio non è piu' `.ts.net`, e i test devono coprire **tutte e due** le
forme, perche' il PC del proprietario ha gia' il nome `.ts.net` salvato in `localStorage` e non
deve rompersi nel passaggio.

## 5. I passi, in ordine

**Fase 1 — il server (niente di rotto si tocca)**
1. `prepara_dominio.sh` esiste: eseguirlo con `FBL_DOMINIO=<nome.duckdns.org>`. Dominio che punta
   all'IP pubblico del server, porta **443** aperta in **due** posti (Security List/NSG della VCN
   Oracle **e** iptables su Ubuntu: e' la trappola che fa perdere mezz'ora, il dominio risolve,
   Caddy parte, e la richiesta non arriva).
2. Caddy deve pubblicare, oltre a `/dati` e `/dati/ascolta`, anche le rotte del PC:
   `/pc/8000/*`, `/pc/8001/*`, `/pc/8769/*`, `/segnali/*`. Oggi `prepara_dominio.sh` le esclude
   di proposito («tutto il resto del ponte resta raggiungibile solo da dentro la macchina»):
   **questo è il punto da cambiare**, perche' senza quello gli ordini non escono dal server.
3. Verifica da telefono **con i dati mobili** (Tailscale spento sul telefono):
   `https://<dominio>/dati/session` risponde, e `https://<dominio>/pc/8000/health` risponde.
   Finche' queste due non rispondono, NON si passa alla fase 2.

**Fase 2 — l'app e l'accesso**
4. Togliere Tailscale dal pannello «Accesso da altri dispositivi» (`app.html` ~36830-36860: la
   sezione «Tailscale su questo computer», `fblTsDisegna`, il nome `.ts.net`, la frase «Il
   collegamento con gli altri dispositivi comparirà qui quando Tailscale sarà installato»). Al suo
   posto: l'indirizzo del server, la chiave, e la verifica che risponde.
5. `fblServerUrl()`: come al punto 4 (dominis vs `.ts.net`). `fblCollegamentoHostValido` e
   `fblPaginaDalPonteLocale` devono accettare il dominio (oggi accettano localhost e `.github.io`).
6. `accesso_condiviso.py` e `multiutente.py`: senza rete privata **tutte** le richieste arrivano da
   internet. Il discriminatore non puo' piu' essere «e' sulla mia rete»: deve diventare **la chiave
   piu' l'identita'** (account Google o email/password), che il progetto ha gia'. Le rotte che
   oggi sono «solo dal computer» (per esempio `/aggiorna-programma`) devono restare tali per un
   altro motivo, non per la rete: si decide con il proprietario.
7. I test del ponte sostituiscono gli header Tailscale finti con la nuova regola d'ingresso
   (chiave + identita'), mantenendo **le stesse prove di rifiuto**: senza chiave si rifiuta, con la
   chiave passa, con un nome che non è il server si rifiuta.

**Fase 3 — via Tailscale da tutto il resto**
8. `prepara_server.sh`: togliere l'installazione di Tailscale, `tailscale up`, `tailscale serve`, e
   la lettura del nome da `tailscale status --json`. Restano: Docker, la chiave d'accesso, i servizi,
   Caddy. Il nome del server diventa il dominio (passo 1).
9. `installer_build/installer.iss` e `PUBBLICARE.md`: togliere ogni riferimento a `ts.net`,
   MagicDNS, Funnel, login.tailscale.com, «stessa rete Tailscale».
10. Testi dell'app e della GUI: sostituire le frasi che dicono «serve Tailscale» con la verita'
    nuova (server + dominio + account). Le prove di controllo devono verificare che **nessuna**
    parola «tailscale» o «ts.net» Resti nei testi che l'utente legge: e' un test sul comportamento
    (cosa si vede), non sul sorgente.
11. Il `desktop_shell.py` e l'APK: l'indirizzo del server predefinito non deve piu' essere un nome
    `.ts.net`; verificare che la copia dentro l'APK (`mobile/android/app/src/main/assets/public/`)
    sia riallineata (oggi e' ferma ad altre versioni: misurare prima).
12. Documentazione: `cervello/CONSEGNA.md`, `ORACLE.md`, `MAPPA.md`, `PUBBLICARE.md`,
    `GUIDA-MIGRAZIONE-COMPLETA.md`, `GUIDA_SERVER_ORACLE.md`, `DIARIO.md` (una riga di data).

**Fase 4 — collaudo e pubblicazione**
13. Banchi nuovi in `laboratorio/app/` e `laboratorio/ponte/`, rossi senza e verdi con.
14. Collaudo completo locale, poi **push e collaudo su GitHub** (quello che conta), versione alzata.
15 Alla fine, e solo allora: `sudo tailscale logout` / disinstallazione sui tre apparecchi. Il
    proprietario lo fa a mano, con calma, **dopo** che dal telefono tutto funziona senza.

## 6. Come si riconosce che è finita (accettazione)

- Con Tailscale **spento su PC, server e telefono**, dal telefono con i **dati mobili**:
  il grafico carica, i segnali arrivano, gli ordini su MT5 partono e le posizioni si vedono.
- Dal PC, da solo, tutto continua a funzionare (la strada locale non si tocca).
- Cercando `tailscale` e `ts.net` nell'app, nei testi, negli installer e negli script: **zero`
  occorrenze, fuori dalla storia in `cervello/` (che resta, perche' spiega il perche'`.
- Il collaudo su GitHub e' verde e la versione e' alzata.

## 7. Le trappole note (gia' pagate, non rimetterle in conto)

- **HTTPS obbligatorio**: l'app è servita in HTTPS (GitHub Pages), il browser rifiuta le chiamate
  `http://`. Con Caddy e il certificato questo si risolve; senza, si rompe tutto.
- **La porta 443 in due posti**: firewall di Oracle (Security List/NSG) **e** iptables sulla
  macchina. Se manca uno dei due, il dominio risolve ma non risponde niente.
- **Il certificato vuole un NOME**: Let's Encrypt non rilascia certificati per un IP nudo.
- **`localStorage` del proprietario ha gia' il nome `.ts.net`**: il passaggio deve funzionare sia
  col nome vecchio (fino a che non lo cambia) sia col dominio, o il PC del proprietatore si rompe
  al primo avvio.
- **La copia dentro l'APK** (`mobile/android/app/src/main/assets/public/app.html`) e' una copia
  separata: va riallineata, altrimenti il telefono tiene il codice vecchio (misurato oggi: era
  ferma alla 2.2.19 mentre la radice era alla 2.2.24).
- **MAI una chiave nel repository**: la chiave di accesso sta nei file fuori dal repo.

## 7-bis. LA CONSEGUENZA DI SICUREZZA, e va trattata come la parte principale del lavoro

Richiamata dal proprietario il 12 novembre 2026: «far viaggiare tutto su una connessione pubblica
ovviamente criptata ecc, per evitare fishing e hack esterni».

**Il fatto da cui partire, scomodo e vero: oggi le difese sono DUE, dopo questo lavoro ne resta
UNA.** Oggi una richiesta che non arriva da 127.0.0.1 deve (1) venire da dentro la rete privata
Tailscale e (2) portare la chiave personale (`accesso_condiviso.richiesta_locale()`). Togliendo
Tailscale cade la prima, e la chiave diventa l'unica cosa fra Internet e un ponte che **esegue
ordini veri su MT5**. Chi trova il dominio e la chiave apre e chiude posizioni sui suoi conti.
Quindi il lavoro non è «togliere Tailscale e mettere il certificato»: è **sostituire la difesa che
si toglie**, e questa parte va fatta per prima, non per ultima.

Cosa deve esserci, in ordine di importanza:

1. **Nessuna porta aperta sul PC di casa.** Il PC non si fa trovare: è il ponte che apre lui la
   connessione verso il server (uscente), e il server gli gira le richieste su quella. Così il
   router di casa non ha niente da inoltrare e non c'è una superficie da attaccare a casa. È
   anche l'unico modo che non dipende dal suo operatore o da un IP che cambia.
2. **Un segreto per dispositivo, con scadenza e revocabile.** Non una chiave sola uguale per
   tutti: telefono e tablet hanno la loro, si vedono in elenco, si revocano una per una. Una
   chiave unica persa costringe a cambiarla su tutti gli apparecchi, e finché non lo fai sei
   aperto. Nessun segreto dentro l'app pubblicata: l'app pubblicata la può scaricare chiunque.
3. **Le rotte che toccano i soldi non bastano col segreto.** `/pc/8000/*` apre e chiude posizioni.
   Lì serve un limite di frequenza, un registro di chi ha chiesto cosa e quando (che oggi non
   c'è), e il rifiuto di qualunque richiesta che non arrivi dall'origine dell'app. Un registro
   serve anche dopo: senza, un accesso non autorizzato non si scopre mai.
4. **Il phishing non si ferma sul server, si ferma sul nome.** Il rischio vero per lui non è che
   qualcuno bucchi Caddy: è una pagina che somiglia alla sua e gli chiede la chiave. Difese:
   un dominio solo, scritto nelle guide e nel pannello, e il ponte che rifiuta richieste con
   un'origine diversa dalla sua — così una copia della pagina su un altro indirizzo non funziona
   nemmeno se la chiave gliela dai.
5. **Il certificato non è la sicurezza, è il minimo.** HTTPS impedisce che qualcuno legga per
   strada. Non impedisce a nessuno di chiedere. Le quattro cose sopra servono tutte comunque.

**Accettazione, da aggiungere a quella della sezione 6:** con il dominio pubblico attivo, una
richiesta agli ordini **senza** segreto deve essere rifiutata; una **con un segreto revocato**
deve essere rifiutata; una con origine diversa da quella dell'app deve essere rifiutata; e ognuno
dei tre rifiuti deve comparire nel registro. Tre banchi, rossi prima.

## 8. Inventario esatto di dove sta scritto Tailscale (31 file, 220 righe, misurato oggi)

Codice che deve cambiare:
- `app.html` (47 righe: pannello accesso remoto, `fblTsDisegna`, `fblServerUrl`, testi, validazione host)
- `mobile/android/app/src/main/assets/public/app.html` (47 righe: la copia dentro l'APK, da riallineare)
- `mobile/android/app/src/main/assets/public/sw.js` (1 riga di commento sulla storia delle versioni)
- `server_oracle/prepara_server.sh` (10: installazione, `tailscale up`, `tailscale serve`, nome da `tailscale status`)
- `server_oracle/prepara_dominio.sh` (5: commenti; è lo script che **sostituisce** Tailscale, va esteso alle rotte del PC)
- `server_oracle/ponte_server.py` (5: `/pc/*` e il messaggio d'errore «Tailscale attivo?»)
- `server_oracle/multiutente.py` (5: nota sul limite della rete privata)
- `server_oracle/docker-compose.yml` (1: `network_mode: host` motivato da Tailscale Serve)
- `installer_build/installer.iss` e `installer_build/build/accesso_condiviso.py` (da verificare: oggi 0 occorrenze dirette, ma la regola d'ingresso dipende dalla rete)
- `desktop/desktop_shell.py` (1 riga di commento)
- `sw.js` (1 riga di storia versioni)

Test che devono cambiare (oggi simulano la rete privata con header finti):
- `laboratorio/ponte/test_chiave_personale.py` (16), `test_server_oracle.py` (8),
  `test_porta_unica.py` (1), `test_custode_servizio_dati.py` (2),
  `test_processi_orfani_avvio.py` (3, con `tasklist "Tailscale.exe"`)
- `.github/workflows/collaudo.yml` (2 righe: l'eco della prova «via Tailscale»)

Documentazione (la storia resta, i testi d'uso si riscrivono):
- `cervello/CONSEGNA.md` (9), `cervello/ORACLE.md` (7), `cervello/CONSEGNA-OPENCODE-5-NOVEMBRE.md` (12),
  `cervello/DIARIO.md` (12), `cervello/PUBBLICARE.md` (2), `cervello/MAPPA.md` (1),
  `cervello/GUIDA-MIGRAZIONE-COMPLETA.md` (5), `cervello/GUIDA-DOMINIO-SENZA-TAILSCALE.md` (3),
  `server_oracle/GUIDA_SERVER_ORACLE.md` (7), `cervello/LISTA-COMPLETA-RICHIESTE.md` (2),
  `cervello/REGOLE.md` (1), `cervello/IDEE.md` (1), `cervello/BUG.md` (1),
  `cervello/PROBLEMI-APERTI-2026-11-07.md` (1), `.claude/agents/collaudatore-online.md` (1)
