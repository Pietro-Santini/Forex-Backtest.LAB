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
