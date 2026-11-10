; ============================================================================
; Script per Inno Setup (https://jrsoftware.org/isinfo.php â€” gratuito).
; Impacchetta dist\ForexBacktestLAB.exe (creato da build_exe.bat) in un vero
; programma di installazione Windows: ForexBacktestLAB_Setup.exe â€” quello che
; darai ai tuoi utenti/clienti. Un doppio click sul Setup e loro hanno:
;   - il servizio installato (in Program Files) e avviato subito, in automatico
;     e senza finestre (vedi [Run]) â€” NESSUNA icona, nÃ© sul Desktop nÃ© nel menu
;     Start: non Ã¨ un'app che si apre a mano, l'utente non deve mai vederla
;   - una voce nel menu Start SOLO per disinstallare
;   - un disinstallatore vero (Pannello di controllo > App e funzionalitÃ )
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
#define MyAppVersion "2.2.23"
#define MyAppPublisher "Pietro Santini"
#define MyAppExeName "ForexBacktestLAB.exe"
; LA FINESTRA DELL'APPLICAZIONE: l'unico eseguibile che l'utente VEDE e apre. Gli altri
; tre (ForexBacktestLAB.exe, Mt5FeedServer.exe, SegnaliBridge.exe) sono servizi senza
; finestra che girano da soli. Prima questo pacchetto non la conteneva affatto (era
; costruita solo da desktop\BUILD_EXE_DESKTOP.bat, che il flusso di GitHub non chiama):
; chi installava trovava i servizi in esecuzione e nessuna applicazione da aprire, ed era
; costretto a cercarsi i percorsi a mano. Ora la costruisce build_exe.bat (passo 3d) e la
; installa questo script, con la sua icona sul Desktop e nel menu Start.
#define MyAppDesktopExeName "ForexBacktestLABDesktop.exe"

[Setup]
AppId={{8F1C6E1A-7B2D-4E3F-9C41-FBLAB00000001}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
; Esplicito (anche se Ã¨ giÃ  il comportamento di default di Inno Setup): la
; pagina "Seleziona cartella di destinazione" con pulsante "Sfoglia..." DEVE
; comparire durante l'installazione â€” DefaultDirName sopra Ã¨ solo la cartella
; PROPOSTA (Program Files), non imposta: chi installa puÃ² cambiarla con
; qualsiasi percorso voglia. Scritto qui per iscritto, non lasciato implicito.
DisableDirPage=no
; Un solo file .exe unico invece di tanti file sparsi: piÃ¹ semplice da
; distribuire (basta mandare/scaricare un unico Setup).
OutputDir=Output
OutputBaseFilename=ForexBacktestLAB_Setup
Compression=lzma
SolidCompression=yes
; Icona vera (generata da icon-512.png) sia per il programma di
; installazione stesso sia â€” dato che PyInstaller la incorpora giÃ  dentro
; ForexBacktestLAB.exe con --icon â€” per tutte le scorciatoie create qui sotto.
SetupIconFile=build\icon.ico
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "italian"; MessagesFile: "compiler:Languages\Italian.isl"

; NESSUNA sezione [Tasks]: di proposito. Prima c'era una casella facoltativa ("avvia il bridge
; automaticamente ad ogni accesso a Windows"), lasciata all'utente da spuntare o meno â€” ma un
; checkbox del genere Ã¨ ESATTAMENTE il tipo di casella che chiunque ha imparato a togliere per
; riflesso durante un'installazione ("meno cose che partono da sole, meglio Ã¨"). Se l'utente la
; toglie, il bridge parte una volta sola (vedi [Run] sotto) e poi MAI PIÃ™ dopo un riavvio o un
; logout â€” e qui non c'Ã¨ piÃ¹ nessuna icona da nessuna parte con cui l'utente possa farlo ripartire
; lui stesso: risultato, l'app smette di funzionare per sempre finchÃ© non reinstalla da capo,
; senza nessun indizio del perchÃ©. Dato il vincolo esplicito "l'utente non deve mai doverci
; pensare", questo non puÃ² essere opzionale: la registrazione dell'avvio automatico qui sotto
; ([Registry], chiave Run) Ã¨ quindi SEMPRE scritta, senza bisogno di alcuna scelta â€” e di
; conseguenza Inno Setup non mostra piÃ¹ nemmeno la pagina "Selezione processi aggiuntivi" (appare
; solo se esiste almeno un Task: senza [Tasks], sparisce da sola).

[Files]
; NB: percorso relativo a questo file .iss â€” presuppone che tu compili questo
; script stando nella cartella "installer_build" (quella con dentro sia
; "installer.iss" sia "dist\ForexBacktestLAB.exe").
Source: "dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
; Servizio dati MT5 per il grafico (vedi build_exe.bat, punto 3b): un eseguibile SEPARATO,
; installato nella STESSA cartella di {#MyAppExeName} â€” bridge.py lo trova e lo avvia da solo
; come processo figlio ogni volta che parte (_start_mt5_feed_server() in bridge.py cerca
; "Mt5FeedServer.exe" accanto al proprio eseguibile), quindi qui non serve NESSUNA voce
; aggiuntiva in [Run] o [Registry]: un solo avvio automatico (quello di ForexBacktestLAB.exe
; sopra) basta per far partire entrambi i processi. skipifsourcedoesntexist: se manca in fase di
; compilazione del Setup (es. sviluppatore che rigenera il Setup senza aver rifatto il punto 3b
; di build_exe.bat), la compilazione NON si blocca â€” l'app resta comunque installabile e
; funzionante, semplicemente il grafico Live resterÃ  sempre su Capital.com anche con MT5
; connesso finchÃ© quel file non viene incluso in una compilazione successiva.
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
; LA FINESTRA DELL'APPLICAZIONE (desktop_shell.py compilato, passo 3d di build_exe.bat):
; e' l'eseguibile che l'utente apre dal Desktop o dal menu Start, ed e' anche cio' che apre
; il collegamento forexbacktestlab:// del sito. OBBLIGATORIO (RICHIESTO dal proprietario,
; 31 ottobre 2026: "l'utente non deve andare a cercare questi percorsi"): senza questo file
; il pacchetto installerebbe solo i servizi invisibili, senza alcuna applicazione da aprire.
; Non ha skipifsourcedoesntexist di proposito: se manca, la compilazione si FERMA invece di
; consegnare un Setup che lascia l'utente con tre servizi e nessuna finestra.
Source: "dist\{#MyAppDesktopExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "build\segnali_telegram\configurazione.esempio.json"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

[Registry]
; Registra il protocollo personalizzato "forexbacktestlab://" â€” permette al
; SITO WEB (un link tipo <a href="forexbacktestlab://avvia">Apri l'app</a>)
; di avviare questo programma giÃ  installato, esattamente come fanno Zoom,
; Discord o Spotify col loro pulsante "Apri nell'app desktop". Un sito NON
; puÃ² mai eseguire programmi o installare librerie da solo (bloccato dalla
; sicurezza del browser): questo protocollo Ã¨ l'unico modo legittimo per
; farlo, e funziona SOLO dopo che questo installer Ã¨ giÃ  stato eseguito
; almeno una volta su quel PC. Su HKCU (utente corrente, non tutto il
; sistema): non servono permessi da amministratore per registrarlo.
Root: HKCU; Subkey: "Software\Classes\forexbacktestlab"; ValueType: string; ValueName: ""; ValueData: "URL:Forex Backtest Lab"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\forexbacktestlab"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\forexbacktestlab\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppDesktopExeName}"""
; Il comando apre la FINESTRA DELL'APPLICAZIONE ({#MyAppDesktopExeName}), non il servizio
; ({#MyAppExeName}): prima il "collegamento diretto" del sito avviava il servizio, che gira
; senza finestra, quindi sembrava che non succedesse niente. Il collegamento dal sito deve
; comportarsi come il doppio clic sull'icona.
Root: HKCU; Subkey: "Software\Classes\forexbacktestlab\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppDesktopExeName}"" ""%1"""

; Avvio automatico ad ogni accesso a Windows, SEMPRE (non piÃ¹ legato a un Task facoltativo: vedi
; il commento sopra [Files] sul perchÃ©) - stessa chiave di registro usata da moltissimi programmi
; (Discord, Spotify, Steam...) per avviarsi da soli col login, senza bisogno di permessi da
; amministratore (HKCU = solo per l'utente corrente). uninsdeletevalue: rimossa in automatico alla
; disinstallazione, non resta comunque nulla "orfano" nel Registro dopo un eventuale addio.
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "{#MyAppName}"; ValueData: """{app}\{#MyAppExeName}"""; Flags: uninsdeletevalue

[Icons]
; ATTENZIONE, PROPRIETARIO (31 ottobre 2026): qui c'era scritto "nessuna scorciatoia per
; avviare, l'utente non deve mai vederne un'icona", perche' si pensava a un pacchetto di
; soli servizi invisibili. Risultato misurato: chi installava non aveva NESSUNA
; applicazione da aprire e doveva cercarsi i percorsi a mano (e avviando
; ForexBacktestLAB.exe partivano solo i servizi). Ora l'applicazione si apre dal Desktop o
; dal menu Start, come qualunque altro programma installato.
; IconFilename usa l'icona incorporata nell'eseguibile (PyInstaller --icon), la stessa del
; Setup: un'icona sola per tutto, coerente con l'applicazione. â€” niente scorciatoia per AVVIARE il
; programma (nÃ© qui nÃ© sul Desktop, vedi sopra): non Ã¨ un'app che si apre a mano, l'utente non
; deve mai vederne un'icona su cui poter cliccare.
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppDesktopExeName}"; IconFilename: "{app}\{#MyAppDesktopExeName}"; Comment: "Apri Forex Backtest LAB"
; ATTENZIONE (1° novembre 2026): {userdesktop}, NON {commondesktop}. {commondesktop} e'
; C:\Users\Public\Desktop, una cartella di SISTEMA che si scrive solo con i permessi da
; amministratore. Questo pacchetto gira con PrivilegesRequired=lowest - nessun
; amministratore richiesto, e deve restare cosi' (l'utente non deve vedere la richesta di
; permessi) - quindi scrivere la' era impossibile: Inno Setup si FERMAVAcon
; "IPersistFile::Save fallito; codice 0x80070005. Accesso negato." e l'installazione non
; andava a buon fine, bloccando l'utente a meta'. {userdesktop} e' il Desktop dell'utente
; che installa: lo scrive senza chiedere niente a nessuno. Provato dal test
; pacchetto_app_desktop.test.mjs.
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppDesktopExeName}"; IconFilename: "{app}\{#MyAppDesktopExeName}"; Comment: "Apri Forex Backtest LAB"
; La voce per disinstallare resta: un programma installato deve poter essere rimosso dal
; solito posto, senza andare a caccia del disinstallatore.
Name: "{group}\Disinstalla {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
; Avvia il servizio SUBITO dopo l'installazione, in modo completamente silenzioso â€” niente
; checkbox, niente richiesta, niente finestra (l'exe Ã¨ compilato con --windowed): serve perchÃ© la
; chiave di avvio automatico qui sopra parte solo al PROSSIMO accesso a Windows, quindi senza
; questa riga il primo "Connetti" dell'utente, subito dopo aver installato, fallirebbe comunque
; (il servizio non sarebbe ancora partito). Da qui in poi le due cose insieme (questa riga per la
; primissima volta, la chiave di registro per ogni accesso successivo) garantiscono che il
; servizio sia SEMPRE attivo, senza eccezioni e senza che l'utente debba mai saperlo o farlo lui.
; SENZA "skipifsilent", DI PROPOSITO (28 ottobre 2026).
;
; "skipifsilent" significa: non avviare il programma quando l'installazione e' silenziosa. Era
; giusto finche' l'unico modo di installare in silenzio era una distribuzione aziendale, dove
; nessuno vuole vedersi partire un programma addosso.
;
; Da oggi il programma si AGGIORNA DA SOLO: il ponte scarica questo stesso pacchetto e lo avvia
; con /VERYSILENT (vedi aggiorna_programma in build/bridge.py). Con "skipifsilent" l'aggiornamento
; avrebbe funzionato benissimo e avrebbe lasciato l'utente con l'app SPENTA - cioe' peggio di
; prima, perche' prima almeno sapeva di doverla riavviare.
;
; La chiave di avvio automatico non basta: quella parte al prossimo accesso a Windows, non
; adesso. Serve questa riga, e deve valere in tutti e due i casi.
Filename: "{app}\{#MyAppExeName}"; Flags: nowait

; L'APPLICAZIONE VERA, CON LA SUA FINESTRA. Nella pagina finale dell'installazione compare
; una casella SELEZIONABILE "Avvia Forex Backtest LAB" (e' il flag "postinstall"), come in
; qualunque altro programma: chi la vuole la lascia, chi non la vuole la leva. Il comportamento
; e' quello delle icone qui sopra: il doppio clic sull'icona apre questa stessa finestra.
;
; "skipifsilent" c'e' DI PROPOSITO, ed e' l'opposto del servizio qui sopra. L'aggiornamento
; automatico installa con /VERYSILENT (vedi aggiorna_programma in build\bridge.py): li' non
; deve aprirsi nessuna finestra addosso all'utente, deve solo ripartire il servizio. La
; finestra la riapre l'utente quando vuole, dall'icona.
Filename: "{app}\{#MyAppDesktopExeName}"; Description: "Avvia {#MyAppName}"; Flags: nowait postinstall skipifsilent

; AGGIORNAMENTO AUTOMATICO: quando il ponte lancia il pacchetto con /VERYSILENT, il Setup
; chiude l'applicazione (ChiudiProgrammi), installa e poi riapre da solo la FINESTRA
; dell'applicazione (Check silenziosa). E' la stessa cosa che fa OpenCode in alto a
; destra: installa, chiude, riapre - cosi' i nuovi pacchetti si caricano con un refresh.
; Senza questa riga l'aggiornamento chiudeva l'app e basta, e l'utente doveva riaprirla
; a mano (segnalato dal proprietario il 1° novembre 2026).
Filename: "{app}\{#MyAppDesktopExeName}"; Flags: nowait; Check: InstallazioneSilenziosa

[Messages]
; Promemoria onesto mostrato prima dell'installazione: MetaTrader 5 non Ã¨
; incluso in questo pacchetto (va installato a parte dal broker dell'utente)
; e il programma funziona solo su Windows.
WelcomeLabel2=Questo installa {#MyAppName} sul tuo PC.%n%nATTENZIONE: serve un terminale MetaTrader 5 installato separatamente (scaricabile dal sito del tuo broker) per collegare un conto reale â€” questo programma non lo sostituisce, ci si collega.%n%nFunziona solo su Windows.

[Code]
// RICHIESTO ("deve funzionare per gli altri utenti senza problemi dopo il Setup"): i tre programmi
// girano senza finestra e, se sono in esecuzione, Windows non lascia sostituire i loro .exe. Prima il
// Setup chiedeva "riprova/ignora" e, ignorando, restava la versione VECCHIA (per esempio il ponte dei
// segnali con il canale rotto). Qui si chiudono prima di installare e prima di disinstallare;
// [Run] riavvia ForexBacktestLAB.exe a fine installazione, e lui riavvia gli altri due.
// L'ORDINE CONTA, E PRIMA ERA SBAGLIATO.
//
// SEGNALATO DAL PROPRIETARIO (3 novembre 2026): "quando aggiorno, l'applicazione mi da' NON
// RISPONDE e crasha: quando chiude, fa l'installazione e poi riapre, c'e' qualche servizio che
// rimane ancora attivo dall'istanza precedente".
//
// CAUSA, documentata dal progetto stesso in build/bridge.py (~riga 519): "_ferma_custode_mt5_feed()
// PRIMA di spegnere il servizio, O IL CUSTODE LO RIACCENDE". Il custode e' il thread dentro
// ForexBacktestLAB.exe che fa rinascere Mt5FeedServer.exe appena la porta 8001 smette di
// rispondere. Qui si uccideva prima SegnaliBridge, poi Mt5FeedServer, e SOLO ALLA FINE il ponte:
// nella finestra fra il secondo e il quarto taskkill il custode era ancora vivo e faceva
// RINASCERE Mt5FeedServer.exe. Quel figlio sopravviveva al padre, restava orfano con la porta
// 8001 occupata, e dopo l'installazione il servizio nuovo non riusciva piu' ad aprirla: l'app
// partiva e non trovava i dati. Ecco il "non risponde".
//
// ADESSO: prima il PADRE (l'unico che puo' far rinascere qualcuno), poi i figli. E al posto di
// uno Sleep alla cieca si CONTROLLA davvero che non resti nessuno: taskkill torna appena ha
// CHIESTO la chiusura, non quando e' avvenuta.
function ProcessoVivo(const Nome: String): Boolean;
var
  Esito: Integer;
begin
  // tasklist filtrato per nome; find esce 1 quando non trova nulla, 0 quando il processo c'e'.
  Result := Exec(ExpandConstant('{cmd}'),
    '/C tasklist /FI "IMAGENAME eq ' + Nome + '" /NH | find /I "' + Nome + '" >nul',
    '', SW_HIDE, ewWaitUntilTerminated, Esito) and (Esito = 0);
end;

procedure UccidiTutti();
var
  Esito: Integer;
begin
  // Il PADRE per primo: con lui muore il custode, e da qui nessuno puo' piu' rinascere.
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM ForexBacktestLAB.exe', '', SW_HIDE, ewWaitUntilTerminated, Esito);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM ForexBacktestLABDesktop.exe', '', SW_HIDE, ewWaitUntilTerminated, Esito);
  // Poi i figli, compresi eventuali orfani lasciati da un aggiornamento precedente andato storto.
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM Mt5FeedServer.exe', '', SW_HIDE, ewWaitUntilTerminated, Esito);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM SegnaliBridge.exe', '', SW_HIDE, ewWaitUntilTerminated, Esito);
end;

procedure ChiudiProgrammi();
var
  Giro: Integer;
  Restano: Boolean;
begin
  UccidiTutti();
  // Fino a 10 giri da mezzo secondo: se qualcuno resta in piedi, si riprova invece di tirare
  // dritto e lasciare che l'installazione fallisca a meta' o che un orfano tenga la porta.
  for Giro := 1 to 10 do
  begin
    Restano := ProcessoVivo('ForexBacktestLAB.exe') or ProcessoVivo('Mt5FeedServer.exe')
            or ProcessoVivo('SegnaliBridge.exe') or ProcessoVivo('ForexBacktestLABDesktop.exe');
    if not Restano then
      Break;
    UccidiTutti();
    Sleep(500);
  end;
  // Attesa finale: il processo e' morto, ma Windows rilascia la porta che teneva aperta un
  // attimo dopo — ed e' proprio l'attimo in cui [Run] riavvia tutto.
  Sleep(800);
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

// RICHIESTO (1° novembre 2026): l'aggiornamento automatico avvia il pacchetto con
// /VERYSILENT (vedi aggiorna_programma in build/bridge.py). In quel caso il Setup
// chiude il ponte (ChiudiProgrammi qui sopra), installa e poi deve riaprire la
// FINESTRA dell'applicazione da solo: il ponte non puo' farlo, e' stato spento prima
// di poterlo riaprire. WizardSilent() e' vero solo in quel caso; nell'installazione
// normale la finestra si apre dalla casella "Avvia Forex Backtest LAB" piu' sotto.
function InstallazioneSilenziosa(): Boolean;
begin
  Result := WizardSilent();
end;
