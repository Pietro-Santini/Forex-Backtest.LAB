# Passi 15/16 — Storia completa di un utente Syntra

*Report archiviato dal coordinatore. Versione `v119` / `1.0.119`. Collaudo verde (`Falliti: 0`).*

## Cosa chiedeva il proprietario
Poter **scegliere un nome utente** e vederne la **storia completa**, identica a quella delle sale
Telegram (operazioni, win rate, resa già calcolati dall'app per ogni sala `Syntra · <utente>`).
Il robot deve toccare il **nome in alto a destra** di una casella, aprire il **profilo** dell'utente,
scorrere e leggere tutte le operazioni.

## Vincoli espliciti
1. **Mentre legge il profilo il robot NON deve aggiornare la pagina delle Notifiche** (andrebbe in
   confusione).
2. Le operazioni della cronologia **NON** devono finire nella bacheca come segnali nuovi (aprirebbero
   posizioni): si **ARCHIVIANO**, da dove l'app le mostra.

## Progetto realizzato (solo ponte + robot; nessuna modifica ad `app.html`)
Cronologia e resa sono **già condivise** in `app.html` per le sale `Syntra · <utente>`
(`fblCronoLeggi` ~39882, `fblCronoRicevi` ~39902, `valuta` ~39980-40016, `rendCurva` ~40158):
quindi il passo richiede solo che il **robot** legga il profilo e lo **archivi**.

### `syntra_lettore.py`
- `import storico_sale` in cima (in ordine alfabetico, prima di `import time`).
- In `leggi_schermata`, quando si riconosce il nodo del **nome utente**, si salva anche il punto da
  toccare: `sc["utente_xy"] = ((fx1 + fx2) // 2, (fy1 + fy2) // 2)` (nome in alto a destra della
  scheda). Serve ad aprire il profilo.
- Nuova **`leggi_profilo(adb, utente, pagine, log, stato)`**:
  1. cerca il nome cliccabile di quell'utente (se non c'è, risale alla lista con `_alla_lista` e
     riprova qualche volta);
  2. `adb.tocca(*punto)` → si apre il **profilo**;
  3. per `pagine` schermate raccoglie le schede (`chiave(sc)` deduplica le operazioni) e, dove manca
     il dettaglio TP/SL, apre il `toggle` e rilegge (fino a 6 schede per schermata);
  4. scorre in basso tra una schermata e l'altra;
  5. `adb.indietro()` per lasciare l'emulatore come prima.
  Ritorna la lista delle schede lette. **Non tocca mai la pagina Notifiche.**
- In **`ciclo`**, subito dopo `adb.collega()` e **prima** di tutto il resto, nuovo ramo:
  se `stato["syntra_leggi_profilo"]` esiste e **non** è `pronto`, si legge il profilo, si **archivia**
  ogni operazione con `storico_sale.archivia_syntra("Syntra · <utente>", seg_p, ts)`, si aggiunge
  l'utente a `stato["syntra_utenti"]`, si scrivono `lette`/`registrate` e si marca `pronto = True`.
  Il ramo è un `if ... / elif modalita == "schede" / else:` quindi **salta** il giro notifiche di
  quel ciclo (vincolo 1) e prosegue con la pausa normale del ciclo.

### `segnali_bridge.py`
- `_manda_storico`, ramo `sala.startswith("Syntra · ")`: mette
  `STATO["syntra_leggi_profilo"] = {"utente": <nome>, "pagine": <n>, "pronto": False}`, **aspetta**
  finché `pronto` (max 60 s) controllando che il lettore sia collegato, poi risponde con
  `storico_sale.leggi_syntra(sala)` e una `nota` che dice quante operazioni sono state lette.
- `_stato_chat` espone `"profilo": STATO.get("syntra_profilo")`; `_firma_stato` include
  `STATO.get("syntra_profilo")` nel confronto, così l'app riceve l'avviso "sta leggendo il profilo…".

## Test (prima rossi, ora verdi)
`laboratorio/ponte/test_profilo_syntra.py` — **4/4 verdi**:
1. `test_la_richiesta_di_profilo_legge_e_archivia` — con la richiesta impostata il robot legge il
   profilo, archivia (NON in bacheca) e marca `pronto`. I finti delle notifiche falliscono se vengono
   toccati **prima** del profilo nello stesso giro.
2. `test_senza_richiesta_non_si_legge_nessun_profilo` — nessuna regressione: senza richiesta il giro
   resta quello delle notifiche.
3. `test_leggi_profilo_tocca_il_nome_e_restituisce_le_schede` — `leggi_profilo` tocca il nome e torna
   le schede (utente/asset/lato/entrata). *(Nota: negli XML di test i `\n` dei `content-desc` vanno
   scritti come `&#10;`, altrimenti il parser XML li normalizza a spazi.)*
4. `test_il_ponte_chiede_la_lettura_del_profilo_a_syntra` — la richiesta di storico per una sala
   `Syntra · <utente>` **chiede** la lettura del profilo al robot e risponde con l'archivio.

## Come ricontrollare a mano
1. Emulatore con Syntra collegato (Impostazioni → Syntra).
2. Apri la cronologia di una sala `Syntra · <utente>` nell'app.
3. Nel log del ponte compare `cronologia di Syntra · <utente>: lettura del profilo (fino a N schermate)`;
   il robot va sul profilo e torna, la tabella si riempie con tutte le operazioni.
