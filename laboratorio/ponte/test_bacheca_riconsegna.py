"""Una bacheca consegnata una volta non si riconsegna a ogni nuovo collegamento.

IL DIFETTO (16 novembre 2026), misurato riga per riga in segnali_bridge.py: dentro il gestore
del WebSocket, subito dopo `await websocket.accept()`, stava scritto

    # Si riparte dall'ultimo segnale gia' visto, non da zero: cosi' un refresh della pagina non
    # ripropone ordini che avevi gia' valutato.
    ultimo = {"id": 0}

Il commento dice una cosa e il codice fa l'opposto: `ultimo` era LOCALE al collegamento, quindi
`BACHECA.da(ultimo["id"])` rimandava TUTTA la bacheca (fino a STORICO_MAX = 50 messaggi) a OGNI
nuovo WebSocket. Effetto: ricaricare la pagina madre, o aprire una finestra duplicata,entro il
minuto di validita' del segnale RIAPPLICA il segnale — cioe' altre posizioni, anche senza avere
due finestre aperte. La cura lato app (finestra autorizzata + segnale gia' applicato) copre la
stessa strada, ma difendere anche il ponte e' la regola del progetto: due porte, due toppe.

COSA MISURA QUESTA PROVA (il comportamento, non la presenza di una funzione):
  1. il PRIMO collegamento riceve il segnale che sta in bacheca — prova di controllo, senza la
     quale le prove sotto sarebbero mute (un canale che non consegna niente le farebbe passare
     tutte quante);
  2. un SECONDO collegamento aperto subito dopo NON riceve quel segnale;
  3. lo stesso dopo il RIAVVIO del ponte: l'ultimo id consegnato sta su disco, quindi un ponte
     ripartito non rimanda da zero.

COME: il ponte gira in un processo Python a parte (il modulo resta in cache fra i file di test,
lezione gia' pagata), con la sua cartella dati in una cartella temporanea — FBL_SEGNALI_DATI e'
la variabile che il ponte usa gia' per il server Oracle, e APPDATA viene spostata per non
leggere l'accesso vero. Nessuna rete: il WebSocket e' quello finto di FastAPI TestClient, che
gira dentro il processo. La bacheca si semina scrivendo dentro la sua lista invece di passare da
`BACHECA.aggiungi()`: aggiungi e' asincrona e aprirebbe un secondo event loop, mentre il WebSocket
gira in quello del TestClient. Cio' che si misura e' la CONSEGNA, non la semina.
"""
import os
import subprocess
import sys
import tempfile
import pathlib

import _percorsi  # noqa: F401  (prepara i percorsi del ponte e la cartella dati temporanea)

ROOT = pathlib.Path(__file__).resolve().parents[2]


def _esegui(script, cartella):
    proc = subprocess.run([sys.executable, '-c', script, str(ROOT), cartella],
                          capture_output=True, text=True, timeout=180,
                          env=_percorsi.env_pulito())
    # Il ponte, all'uscita, puo' terminare con codice 1 per un dettaglio di spegnimento: non e' un
    # fallimento del comportamento provato. La prova vera e' la riga 'OK' del copione.
    assert "OK" in (proc.stdout or ""), (
        'la prova comportamentale non è passata:\n' + (proc.stderr or '')
        + (('\nstdout: ' + proc.stdout) if proc.stdout else ''))
    return proc.stdout


# Il copione: due collegamenti, poi la stessa cosa in un ponte ripartito.
_COPIONE = r'''
import json
import os
import sys
import tempfile
import threading
import time

# La cartella dati di QUESTA prova. FBL_SEGNALI_DATI e' la variabile che il ponte conosce gia'
# (server Oracle): cosi' niente tocca la cartella vera del ponte, ne' la configurazione ne' la
# ultimo_consegnato.json. APPDATA viene spostata per non leggere l'accesso del proprietario.
os.environ["APPDATA"] = tempfile.mkdtemp(prefix="fbl_prova_segnali_")
os.environ["FBL_SEGNALI_DATI"] = sys.argv[2]
ROOT = sys.argv[1]
sys.path.insert(0, ROOT + "/installer_build/build")
sys.path.insert(0, ROOT + "/installer_build/build/segnali_telegram")

# L'ACCESSO DA ALTRI DISPOSITIVI, finto. Senza un file il ponte rifiuta anche i collegamenti
# che non gli sembrano locali, e il WebSocket del TestClient non gli sembra locale (il client si
# chiama "testclient"). Si punta a un file nostro con FBL_ACCESSO_FILE, la variabile che
# accesso_condiviso conosce gia' per il server Oracle: mai il file del proprietario.
ARCHIVIO_ACCESSO = os.path.join(tempfile.mkdtemp(prefix="fbl_prova_accesso_"),
                               "accesso_remoto.json")
with open(ARCHIVIO_ACCESSO, "w", encoding="utf-8") as f:
    json.dump({"rete": True, "chiave": "chiave-di-prova"}, f)
os.environ["FBL_ACCESSO_FILE"] = ARCHIVIO_ACCESSO
CHIAVE = {"x-fbl-chiave": "chiave-di-prova"}

import segnali_bridge as sb
from fastapi.testclient import TestClient

MESSAGGIO = {
    "strumento": "XAUUSD", "direzione": "SELL", "entrata": 3878, "stop_loss": 3890,
    "take_profit": [3870, 3865, 3860, 3855],
    "testo": "SELL XAUUSD sl 3890 tp 3870 3865 3860 3855",
    "chat": "Sala di prova", "ritardo_ms": 0.0,
    "servizio_ms": time.time() * 1000.0,
}


def semina(id_forzato=None):
    """Mette un segnale in bacheca, con l'id che gli si dice (o il prossimo)."""
    if id_forzato is not None:
        sb.BACHECA._prossimo_id = id_forzato
    voce = dict(MESSAGGIO)
    voce["id"] = sb.BACHECA._prossimo_id
    sb.BACHECA._prossimo_id += 1
    sb.BACHECA._segnali.append(voce)
    return voce["id"]


def riarma():
    """Un Event nuovo per ogni collegamento.

    Nel TestClient ogni WebSocket gira su un event loop SUO, mentre `BACHECA._ev` e' nato con
    quello del primo (misurato: "is bound to a different event loop", e il gestore chiude).
    Qui lo si riarma perche' il collaudo apra piu' collegamenti nello stesso processo; in
    produzione il loop e' uno solo e non serve. Senza, la prova passerebbe per il motivo
    sbagliato: il secondo canale non riceverebbe niente perche' e' morto, non perche' la
    consegna e' giusta.
    """
    import asyncio
    sb.BACHECA._ev = asyncio.Event()


def ricevi_per(ws, secondi):
    """I messaggi che arrivano sul canale in `secondi`, raccolti da un thread.

    `receive_text` aspetta finche' qualcosa arriva, quindi aspettare "non arriva niente" senza
    un thread vorrebbe dire restare appesi al primo messaggio che non verra' mai.
    """
    arrivati = []
    finito = threading.Event()

    def gira():
        while not finito.is_set():
            try:
                arrivati.append(ws.receive_text())
            except Exception:
                return

    t = threading.Thread(target=gira, daemon=True)
    t.start()
    finito.wait(secondi)
    return arrivati


def segnali(messaggi):
    return [json.loads(x) for x in messaggi
            if json.loads(x).get("tipo") == "segnale"]


client = TestClient(sb.app)
primo_id = semina()

riarma()
with client.websocket_connect("/ws/segnali", headers=CHIAVE) as ws:
    arrivati_primo = ricevi_per(ws, 4.0)
ricevuti_primo = segnali(arrivati_primo)
assert len(ricevuti_primo) == 1, (
    "il primo collegamento deve ricevere il segnale che sta in bacheca, ne ha ricevuti %d"
    % len(ricevuti_primo))
assert ricevuti_primo[0]["id"] == primo_id, (
    "deve essere proprio quel segnale: %r" % ricevuti_primo[0].get("id"))

riarma()
with client.websocket_connect("/ws/segnali", headers=CHIAVE) as ws:
    arrivati_secondo = ricevi_per(ws, 4.0)
ricevuti_secondo = segnali(arrivati_secondo)
assert len(ricevuti_secondo) == 0, (
    "il secondo collegamento NON deve ricevere di nuovo un segnale gia' consegnato: ne ha "
    "ricevuti %d (%r)" % (len(ricevuti_secondo),
                          [s.get("id") for s in ricevuti_secondo]))

# E in memoria il ponte deve sapere FINO A CHE PUNTO ha consegnato.
assert sb.ULTIMO_CONSEGNATO["id"] >= primo_id, (
    "l'ultimo id consegnato non e' stato ricordato: %r" % sb.ULTIMO_CONSEGNATO)

# Quello che resta su disco, che e' misura del pezzo "dopo il riavvio": si legge qui, prima di
# uscire, perche' il secondo giro (copione riavviato) leggera' lo stesso file.
with open(os.path.join(sys.argv[2], "ultimo_consegnato.json"), encoding="utf-8") as f:
    su_disco = json.load(f).get("ultimo")
print("SU_DISCO", su_disco)
print("OK")
'''


def test_il_secondo_collegamento_non_riceve_un_segnale_gia_consegnato(tmp_path):
    """Il difetto: oggi `ultimo = {"id": 0}` e' locale al collegamento, quindi il secondo
    WebSocket si riprende tutta la bacheca. La cura lo riparte dall'ultimo consegnato."""
    cartella = str(tmp_path / "dati")
    os.makedirs(cartella, exist_ok=True)
    esito = _esegui(_COPIONE, cartella)
    assert "SU_DISCO" in esito, (
        "l'ultimo id consegnato non risulta scritto su disco: senza, il riavvio del ponte "
        "riconsegna tutto (%r)" % esito)


_COPIONE_RIAVVIO = r'''
import json
import os
import sys
import tempfile
import threading
import time

os.environ["APPDATA"] = tempfile.mkdtemp(prefix="fbl_prova_segnali_")
os.environ["FBL_SEGNALI_DATI"] = sys.argv[2]
ROOT = sys.argv[1]
sys.path.insert(0, ROOT + "/installer_build/build")
sys.path.insert(0, ROOT + "/installer_build/build/segnali_telegram")
ARCHIVIO_ACCESSO = os.path.join(tempfile.mkdtemp(prefix="fbl_prova_accesso_"),
                               "accesso_remoto.json")
with open(ARCHIVIO_ACCESSO, "w", encoding="utf-8") as f:
    json.dump({"rete": True, "chiave": "chiave-di-prova"}, f)
os.environ["FBL_ACCESSO_FILE"] = ARCHIVIO_ACCESSO
CHIAVE = {"x-fbl-chiave": "chiave-di-prova"}

import segnali_bridge as sb
from fastapi.testclient import TestClient

MESSAGGIO = {
    "strumento": "XAUUSD", "direzione": "SELL", "entrata": 3878, "stop_loss": 3890,
    "take_profit": [3870, 3865, 3860, 3855],
    "testo": "SELL XAUUSD sl 3890 tp 3870 3865 3860 3855",
    "chat": "Sala di prova", "ritardo_ms": 0.0,
    "servizio_ms": time.time() * 1000.0,
}

# Il ponte è RIPARTITO: stesso disco, memoria vuota. Se l'ultimo id consegnato non stesse su
# disco, da qui si ricomincerebbe da zero e il segnale già consegnato tornerebbe fuori.
letto = sb.ultimo_consegnato_leggi()
assert letto > 0, (
    "dopo il riavvio il ponte deve ripartire dall'ultimo id che aveva consegnato, ha letto %r"
    % letto)
assert sb.ULTIMO_CONSEGNATO["id"] == letto, (
    "lo stato in memoria deve partire da quello che c'è su disco")

# La sorgente, ripartita, ripropone gli stessi messaggi già visti: alla bacheca arriva di nuovo
# quel segnale, e la bacheca gli assegna lo STESSO id di prima. Non deve essere riconsegnato.
voce = dict(MESSAGGIO)
voce["id"] = letto
sb.BACHECA._segnali.append(voce)

client = TestClient(sb.app)
import asyncio
sb.BACHECA._ev = asyncio.Event()   # ogni collegamento ha il suo event loop nel TestClient
with client.websocket_connect("/ws/segnali", headers=CHIAVE) as ws:
    arrivati = []
    finito = threading.Event()

    def gira():
        while not finito.is_set():
            try:
                arrivati.append(ws.receive_text())
            except Exception:
                return

    threading.Thread(target=gira, daemon=True).start()
    finito.wait(4.0)

ricevuti = [json.loads(x) for x in arrivati if json.loads(x).get("tipo") == "segnale"]
assert len(ricevuti) == 0, (
    "dopo il riavvio un segnale già consegnato non deve tornare fuori: ne sono arrivati %d (%r)"
    % (len(ricevuti), [s.get("id") for s in ricevuti]))
print("OK")
'''


def test_dopo_il_riavvio_del_ponte_non_riconsegna(tmp_path):
    """Se l'ultimo id consegnato non stesse su disco, un riavvio del ponte riconsegnerebbe gli
    ordini già valutati. Qui si misura che il ponte riparte da dove era rimasto."""
    cartella = str(tmp_path / "dati")
    os.makedirs(cartella, exist_ok=True)
    _esegui(_COPIONE, cartella)      # primo giro: consegna e scrive su disco
    _esegui(_COPIONE_RIAVVIO, cartella)   # secondo giro: ponte ripartito, stesso disco