; ============================================================================
; Script per Inno Setup (https://jrsoftware.org/isinfo.php — gratuito).
; Impacchetta dist\ForexBacktestLAB.exe (creato da build_exe.bat) in un vero
; programma di installazione Windows: ForexBacktestLAB_Setup.exe — quello che
; darai ai tuoi utenti/clienti. Un doppio click sul Setup e loro hanno:
;   - il servizio installato (in Program Files) e avviato subito, in automatico
;     e senza finestre (vedi [Run]) — NESSUNA icona, né sul Desktop né nel menu
;     Start: non è un'app che si apre a mano, l'utente non deve mai vederla
;   - una voce nel menu Start SOLO per disinstallare
;   - un disinstallatore vero (Pannello di controllo > App e funzionalità)
;
; COME USARLO: apri questo file con Inno Setup Compiler (o tasto destro >
; "Compile"), oppure da riga di comando: ISCC.exe installer.iss
; Il risultato (ForexBacktestLAB_Setup.exe) esce nella cartella "Output".
; ============================================================================

#define MyAppName "Forex Backtest LAB"
; LA VERSIONE SEGUE QUELLA DELL'APP: app vNN -> Setup 1.0.NN. Il flusso "Installer Windows"
; la riscrive da sw.js (unica fonte: il CACHE_NAME) prima di compilare, cosi' non puo' restare
; indietro. Il numero qui sotto serve a chi compila a mano: prima era rimasto fermo a 1.0.77
; mentre uscivano quattro Setup diversi, tutti con lo stesso nome.
#define MyAppVersion "1.0.120"
#define MyAppPublisher "Pietro Santini"
#define MyAppExeName "ForexBacktestLAB.exe"

[Setup]
AppId={{8F1C6E1A-7B2D-4E3F-9C41-FBLAB00000001}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
; Esplicito (anche se è già il comportamento di default di Inno Setup): la
; pagina "Seleziona cartella di destinazione" con pulsante "Sfoglia..." DEVE
; comparire durante l'installazione — DefaultDirName sopra è solo la cartella
; PROPOSTA (Program Files), non imposta: chi installa può cambiarla con
; qualsiasi percorso voglia. Scritto qui per iscritto, non lasciato implicito.
DisableDirPage=no
; Un solo file .exe unico invece di tanti file sparsi: più semplice da
; distribuire (basta mandare/scaricare un unico Setup).
OutputDir=Output
OutputBaseFilename=ForexBacktestLAB_Setup
Compression=lzma
SolidCompression=yes
; Icona vera (generata da icon-512.png) sia per il programma di
; installazione stesso sia — dato che PyInstaller la incorpora già dentro
; ForexBacktestLAB.exe con --icon — per tutte le scorciatoie create qui sotto.
SetupIconFile=build\icon.ico
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "italian"; MessagesFile: "compiler:Languages\Italian.isl"

; NESSUNA sezione [Tasks]: di proposito. Prima c'era una casella facoltativa ("avvia il bridge
; automaticamente ad ogni accesso a Windows"), lasciata all'utente da spuntare o meno — ma un
; checkbox del genere è ESATTAMENTE il tipo di casella che chiunque ha imparato a togliere per
; riflesso durante un'installazione ("meno cose che partono da sole, meglio è"). Se l'utente la
; toglie, il bridge parte una volta sola (vedi [Run] sotto) e poi MAI PIÙ dopo un riavvio o un
; logout — e qui non c'è più nessuna icona da nessuna parte con cui l'utente possa farlo ripartire
; lui stesso: risultato, l'app smette di funzionare per sempre finché non reinstalla da capo,
; senza nessun indizio del perché. Dato il vincolo esplicito "l'utente non deve mai doverci
; pensare", questo non può essere opzionale: la registrazione dell'avvio automatico qui sotto
; ([Registry], chiave Run) è quindi SEMPRE scritta, senza bisogno di alcuna scelta — e di
; conseguenza Inno Setup non mostra più nemmeno la pagina "Selezione processi aggiuntivi" (appare
; solo se esiste almeno un Task: senza [Tasks], sparisce da sola).

[Files]
; NB: percorso relativo a questo file .iss — presuppone che tu compili questo
; script stando nella cartella "installer_build" (quella con dentro sia
; "installer.iss" sia "dist\ForexBacktestLAB.exe").
Source: "dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
; Servizio dati MT5 per il grafico (vedi build_exe.bat, punto 3b): un eseguibile SEPARATO,
; installato nella STESSA cartella di {#MyAppExeName} — bridge.py lo trova e lo avvia da solo
; come processo figlio ogni volta che parte (_start_mt5_feed_server() in bridge.py cerca
; "Mt5FeedServer.exe" accanto al proprio eseguibile), quindi qui non serve NESSUNA voce
; aggiuntiva in [Run] o [Registry]: un solo avvio automatico (quello di ForexBacktestLAB.exe
; sopra) basta per far partire entrambi i processi. skipifsourcedoesntexist: se manca in fase di
; compilazione del Setup (es. sviluppatore che rigenera il Setup senza aver rifatto il punto 3b
; di build_exe.bat), la compilazione NON si blocca — l'app resta comunque installabile e
; funzionante, semplicemente il grafico Live resterà sempre su Capital.com anche con MT5
; connesso finché quel file non viene incluso in una compilazione successiva.
; OBBLIGATORIO (RICHIESTO): senza questo exe gli utenti restano senza il grafico MT5 - prima il Setup si
; creava lo stesso e il programma ripiegava sui sorgenti .py, che senza Python e librerie
; (pip install) non partono. Se manca, la compilazione si ferma: rifai build_exe.bat.
Source: "dist\Mt5FeedServer.exe"; DestDir: "{app}"; Flags: ignoreversion
; Ponte delle SALE SEGNALI Telegram: un TERZO eseguibile, installato accanto agli altri due.
; Lo avvia il servizio MT5 quando l'utente preme "Collegamento" nella sezione Telegram (vedi
; /segnali-launch in bridge.py), senza far comparire nessuna finestra.
; Perche' un exe e non i sorgenti .py: quelli richiederebbero Python gia' installato sul PC con
; telethon, fastapi e uvicorn - su un computer appena formattato non c'e' niente di tutto questo.
; Dentro l'exe c'e' tutto, quindi la funzione parte ovunque.
; configurazione.json (api_id/api_hash dell'utente) NON viene mai incluso: le credenziali restano
; solo sul PC di chi le ha create. Qui si installa solo l'esempio, che spiega il formato; il file
; vero lo crea l'utente accanto all'eseguibile.
; OBBLIGATORIO (RICHIESTO): senza questo exe gli utenti restano senza le sale segnali (Telegram, Syntra) - prima il Setup si
; creava lo stesso e il programma ripiegava sui sorgenti .py, che senza Python e librerie
; (pip install) non partono. Se manca, la compilazione si ferma: rifai build_exe.bat.
Source: "dist\SegnaliBridge.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "build\segnali_telegram\configurazione.esempio.json"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

[Registry]
; Registra il protocollo personalizzato "forexbacktestlab://" — permette al
; SITO WEB (un link tipo <a href="forexbacktestlab://avvia">Apri l'app</a>)
; di avviare questo programma già installato, esattamente come fanno Zoom,
; Discord o Spotify col loro pulsante "Apri nell'app desktop". Un sito NON
; può mai eseguire programmi o installare librerie da solo (bloccato dalla
; sicurezza del browser): questo protocollo è l'unico modo legittimo per
; farlo, e funziona SOLO dopo che questo installer è già stato eseguito
; almeno una volta su quel PC. Su HKCU (utente corrente, non tutto il
; sistema): non servono permessi da amministratore per registrarlo.
Root: HKCU; Subkey: "Software\Classes\forexbacktestlab"; ValueType: string; ValueName: ""; ValueData: "URL:Forex Backtest Lab"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\forexbacktestlab"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\forexbacktestlab\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"""
Root: HKCU; Subkey: "Software\Classes\forexbacktestlab\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""

; Avvio automatico ad ogni accesso a Windows, SEMPRE (non più legato a un Task facoltativo: vedi
; il commento sopra [Files] sul perché) - stessa chiave di registro usata da moltissimi programmi
; (Discord, Spotify, Steam...) per avviarsi da soli col login, senza bisogno di permessi da
; amministratore (HKCU = solo per l'utente corrente). uninsdeletevalue: rimossa in automatico alla
; disinstallazione, non resta comunque nulla "orfano" nel Registro dopo un eventuale addio.
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "{#MyAppName}"; ValueData: """{app}\{#MyAppExeName}"""; Flags: uninsdeletevalue

[Icons]
; Solo la voce nel menu Start per DISINSTALLARE resta — niente scorciatoia per AVVIARE il
; programma (né qui né sul Desktop, vedi sopra): non è un'app che si apre a mano, l'utente non
; deve mai vederne un'icona su cui poter cliccare.
Name: "{group}\Disinstalla {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
; Avvia il servizio SUBITO dopo l'installazione, in modo completamente silenzioso — niente
; checkbox, niente richiesta, niente finestra (l'exe è compilato con --windowed): serve perché la
; chiave di avvio automatico qui sopra parte solo al PROSSIMO accesso a Windows, quindi senza
; questa riga il primo "Connetti" dell'utente, subito dopo aver installato, fallirebbe comunque
; (il servizio non sarebbe ancora partito). Da qui in poi le due cose insieme (questa riga per la
; primissima volta, la chiave di registro per ogni accesso successivo) garantiscono che il
; servizio sia SEMPRE attivo, senza eccezioni e senza che l'utente debba mai saperlo o farlo lui.
Filename: "{app}\{#MyAppExeName}"; Flags: nowait skipifsilent

[Messages]
; Promemoria onesto mostrato prima dell'installazione: MetaTrader 5 non è
; incluso in questo pacchetto (va installato a parte dal broker dell'utente)
; e il programma funziona solo su Windows.
WelcomeLabel2=Questo installa {#MyAppName} sul tuo PC.%n%nATTENZIONE: serve un terminale MetaTrader 5 installato separatamente (scaricabile dal sito del tuo broker) per collegare un conto reale — questo programma non lo sostituisce, ci si collega.%n%nFunziona solo su Windows.

[Code]
// RICHIESTO ("deve funzionare per gli altri utenti senza problemi dopo il Setup"): i tre programmi
// girano senza finestra e, se sono in esecuzione, Windows non lascia sostituire i loro .exe. Prima il
// Setup chiedeva "riprova/ignora" e, ignorando, restava la versione VECCHIA (per esempio il ponte dei
// segnali con il canale rotto). Qui si chiudono prima di installare e prima di disinstallare;
// [Run] riavvia ForexBacktestLAB.exe a fine installazione, e lui riavvia gli altri due.
procedure ChiudiProgrammi();
var
  Esito: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM SegnaliBridge.exe', '', SW_HIDE, ewWaitUntilTerminated, Esito);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM Mt5FeedServer.exe', '', SW_HIDE, ewWaitUntilTerminated, Esito);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM ForexBacktestLAB.exe', '', SW_HIDE, ewWaitUntilTerminated, Esito);
  Sleep(1500);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  ChiudiProgrammi();
  Result := '';
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
    ChiudiProgrammi();
end;
