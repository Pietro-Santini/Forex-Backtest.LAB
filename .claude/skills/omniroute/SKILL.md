---
name: omniroute
description: Configura e verifica OmniRoute (gateway AI locale su localhost:20128) per Claude Code dal Prompt dei comandi di Windows e per Strix. Usala quando il proprietario chiede di collegare OmniRoute, cambiare modello/combo, o capire perche' OmniRoute non risponde.
---
# OmniRoute

OmniRoute gira **sul PC del proprietario** (`http://localhost:20128`). Funziona solo da una sessione
di Claude Code lanciata **su quel PC**: da una sessione cloud (claude.ai/code) `localhost` è un altro
computer e OmniRoute non si raggiunge. Se sei in cloud, dillo subito e dai solo le istruzioni.

## 1. Prima prova che OmniRoute risponda (sul PC)
```
curl -s http://localhost:20128/v1/models
```
Deve uscire un elenco di modelli. Se no: OmniRoute non è avviato (comando `omniroute`, lasciarlo aperto).

## 2. Claude Code (CLI) → OmniRoute, su Windows
L'indirizzo per Claude Code va **senza `/v1`**. Nel Prompt dei comandi, una riga alla volta:
```
setx ANTHROPIC_BASE_URL http://localhost:20128
```
```
setx ANTHROPIC_API_KEY omniroute
```
```
setx ANTHROPIC_MODEL auto/best-coding
```
Poi chiudere e riaprire il Prompt dei comandi. Il modello deve esistere davvero:
```
curl -s http://localhost:20128/v1/models | findstr "auto/best-coding"
```
- `ANTHROPIC_MODEL` è un **id di modello o una combo** (`auto/best-coding`, `auto/best-free`, un nome
  di combo creato nella dashboard), mai il solo nome di un fornitore (`openrouter` non vale).
- Controllare `C:\Users\<utente>\.claude\settings.json`: se il blocco `env` contiene
  `ANTHROPIC_MODEL` o `ANTHROPIC_DEFAULT_*_MODEL`, vince lui sulle variabili: toglierli.
- Verifica: `claude -p "Rispondi solo: OMNIROUTE_OK" --max-turns 1`. "Invalid API key" = la
  richiesta va ancora ad Anthropic, le variabili non sono state lette.
- L'**app desktop** di Claude non si può collegare a OmniRoute: solo la CLI.

Tornare a Claude normale: `setx ANTHROPIC_BASE_URL ""` (e le altre due), poi riaprire il terminale.

## 3. Strix → OmniRoute
`laboratorio/pc/strix_con_omniroute.bat` usa già `LLM_API_BASE=http://localhost:20128/v1` (qui **con**
`/v1`, perché Strix parla come OpenAI). Si cambiano solo le righe `set MODELLO=` e `set CHIAVE=`.

## Regole
- Le chiavi di OmniRoute e dei fornitori restano sul PC: mai nel repository, mai nei messaggi.
- Non usarlo per moltiplicare abbonamenti o account e aggirare i limiti dei fornitori.
- Con OmniRoute il lavoro lo fa il modello che OmniRoute sceglie: la qualità dipende da quello.
  Cervello, agenti e hook del progetto restano gli stessi.
