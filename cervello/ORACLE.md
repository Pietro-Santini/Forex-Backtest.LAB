# Piano Oracle (server sempre acceso)

Obiettivo: quello che oggi vive sul PC di casa gira su un server Oracle 24 ore su 24, raggiungibile
dall'app ovunque via Tailscale; il PC di casa può essere spento.

## Fatti verificati (6 ottobre 2026)
- `bridge.py` e `mt5_feed_server.py` importano `MetaTrader5` alla prima riga: **su Linux non
  partono**. La libreria MetaTrader5 per Python esiste solo per Windows.
- Kraken (`kraken_ordini.py`, `kraken_simulato.py`), l'interprete dei segnali e il collaudo girano
  già su Linux (lo prova il flusso Collaudo su GitHub).
- L'accesso remoto è già solo Tailscale (`accesso_condiviso.py`).

## Il nodo MT5: tre strade
| Strada | Come | Pro | Contro |
|---|---|---|---|
| A. Linux x86 + Wine | MT5 e un Python per Windows dentro Wine, il ponte parla con loro | un server solo | non è gratis (serve una macchina x86 vera, la gratuita AMD ha 1 GB: troppo poco); MT5 sotto Wine funziona, la libreria Python sotto Wine è meno solida: va provata |
| B. Windows nel cloud | macchina Windows (Oracle con licenza, o un VPS Windows) | è l'ambiente di oggi, rischio minimo | costa ogni mese (licenza Windows) |
| C. Ibrida | MT5 resta sul PC di casa; tutto il resto su Oracle | gratis (macchina ARM gratuita) | MT5 funziona solo a PC acceso |
I costi e i limiti del piano gratuito Oracle vanno verificati sul conto Oracle del proprietario.

## Fasi
0. **Preparazione (nessuna decisione serve):** il ponte deve partire anche senza MT5 (MT5
   diventa un modulo che c'è o non c'è); contenitori Docker per i servizi Linux; collaudo su
   GitHub anche del ponte avviato su Linux.
1. **Server Oracle base:** Ubuntu + Docker + Tailscale; conto Kraken **simulato**, ordini pendenti,
   registratore cripto (candele/footprint pubblici), archivio dei dati storici. L'app si collega
   all'indirizzo Tailscale del server.
2. **Segnali sul server:** ponte Telegram sul server. **Richiede di cambiare una regola**: oggi la
   sessione Telegram non va nel cloud. Va deciso dal proprietario (server suo, disco cifrato,
   accesso solo Tailscale).
3. **MT5:** la strada scelta tra A, B e C.
4. **Syntra:** oggi legge da BlueStacks sul PC. Sul server servirebbe Android in un contenitore:
   possibile in teoria, da sperimentare per ultimo.

## Regole che restano (finché il proprietario non decide altrimenti)
- Chiavi Kraken **reali**: solo sul PC di casa. Sul server solo il conto simulato.
- Sessione Telegram: non sul server finché non si decide la fase 2.

## Decisioni del proprietario (6 ottobre 2026)
- MT5: strada **C, ibrida** (MT5 resta sul PC di casa).
- Server Oracle: **da creare** (macchina ARM gratuita) → procedura passo passo.
- Sessione Telegram: **sì, sul server Oracle** (regola aggiornata in `REGOLE.md`).
- Chiavi Kraken reali: restano sul PC (nessuna decisione diversa).

## Stato (7 ottobre 2026)
- Server creato: AMD gratuita, Ubuntu 26.04, Docker; servizi `ponte` (8000) e `segnali` (8769) attivi,
  pubblicati su Tailscale (`pietro.tail83d918.ts.net`); sessione Telegram copiata da un avvio
  manuale precedente in `/srv/fbl/dati/segnali`.
- App v87: impostazione "Server sempre acceso" (Kraken e segnali al server, MT5 al PC).
- Da verificare dal proprietario: pagina /health dal PC (rifiuto senza chiave), Telegram ripreso.

## Ingrandire (7 ottobre 2026)
- Il proprietario vuole più memoria e disco, in vista di MT5 sul server.
- Micro AMD = 1 GB fisso. ARM gratuita = tanta memoria ma **niente MT5**. AMD Flex = MT5 sotto
  Wine provabile, ma a pagamento. Passaggi in `server_oracle/GUIDA_SERVER_ORACLE.md`.
- La decisione su MT5 (strada e conto demo/reale) è stata rimandata dal proprietario.

## Porta unica (7 ottobre 2026)

Deciso dal proprietario: dal telefono si scrive **solo** il nome e la chiave del **server**, mai
piu' quelli del computer. MT5 pero' gira sul PC e sul server non ci sara' mai (la libreria
MetaTrader5 esiste solo per Windows), quindi il **PC si presenta al server**:

- `POST /registra-al-server` sul PC (solo da 127.0.0.1): legge il proprio nome Tailscale e la
  propria chiave e li manda al server. Niente di nuovo da scrivere a mano.
- `POST /pc/registra` sul server: salva `{host, chiave}` in `/dati/pc.json`. Sopravvive al
  riavvio del contenitore.
- `GET /pc` e `GET /health` dicono se un computer e' registrato. **La chiave del PC non esce dal
  server**: al telefono non serve.
- `/pc/<percorso>` sul server gira la richiesta al PC con la sua chiave: e' la strada che funziona
  anche quando il telefono il PC non lo vede da solo.

Scelte fatte entrambe, come chiesto: il telefono puo' andare **diretto** al PC (piu' veloce,
indirizzo chiesto al server) **oppure** passare dal server. In nessuno dei due casi si scrive
niente a mano.

Prove: `laboratorio/ponte/test_porta_unica.py` (5).
