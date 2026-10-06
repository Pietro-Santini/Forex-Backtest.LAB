"""
Ponte SEGNALI TELEGRAM — Forex Backtest LAB

A COSA SERVE
============
Legge i messaggi delle sale segnali Telegram di cui SEI GIA' MEMBRO, li interpreta con
parser_segnali.py, e li mette a disposizione dell'app su:

    ws://127.0.0.1:8769/ws/segnali

L'app mostra il segnale, tu confermi, e solo allora parte l'ordine.

DUE REGOLE CHE NON CAMBIANO
===========================
1. QUESTO PONTE NON APRE ORDINI. Mai. Legge, interpreta, riporta. L'ordine lo decide l'app dopo
   una tua conferma. La parte che puo' sbagliare (interpretare testo libero scritto da un umano)
   resta separata dalla parte che costa soldi.
2. LEGGE SOLO, E SOLO DOVE SEI GIA' DENTRO. Non entra in gruppi, non invia niente, non scrive.
   Usa il tuo account perche' un bot Telegram non puo' leggere un gruppo altrui se un
   amministratore non ce lo aggiunge - cosa che in una sala segnali non succede.

PERCHE' IL TUO ACCOUNT E NON UN BOT
===================================
L'API dei bot vede solo le chat in cui il bot e' stato aggiunto. Le sale segnali non aggiungono
bot di terzi. L'API client (MTProto) invece agisce come il tuo client Telegram: vede quello che
vedi tu. E' l'API ufficiale di Telegram, documentata e prevista per questo.

CREDENZIALI
===========
api_id e api_hash si ottengono da my.telegram.org -> API development tools. Vanno in
configurazione.json, che resta LOCALE: non va nel repository, come tutte le altre credenziali di
questo progetto. Al primo avvio Telegram chiede un codice di verifica e viene creato un file di
sessione (.session): anche quello e' una credenziale a tutti gli effetti, trattalo come tale.

AVVIO
=====
    pip install -r requirements.txt
    python segnali_bridge.py --sim      # simulatore: nessun Telegram, per provare la catena
    python segnali_bridge.py            # vero, legge le chat in configurazione.json
"""

import argparse
import asyncio
import os as _os_avvio
import sys as _sys_avvio
# Senza finestra (exe con console=False avviato a mano, o da un'altra via) stdout non esiste:
# si scrive nel diario del ponte, cosi' anche un errore all'avvio resta leggibile.
if getattr(_sys_avvio, "stdout", None) is None or getattr(_sys_avvio, "stderr", None) is None:
    try:
        _d = _os_avvio.path.join(_os_avvio.environ.get("APPDATA") or _os_avvio.path.expanduser("~"), "ForexBacktestLAB", "segnali")
        _os_avvio.makedirs(_d, exist_ok=True)
        _f = open(_os_avvio.path.join(_d, "ponte_segnali.log"), "a", encoding="utf-8", errors="replace", buffering=1)
        if getattr(_sys_avvio, "stdout", None) is None:
            _sys_avvio.stdout = _f
        if getattr(_sys_avvio, "stderr", None) is None:
            _sys_avvio.stderr = _f
    except Exception:
        pass
import json
import os
import random
import sys
import time
from typing import Dict, List, Optional

try:
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect
    import uvicorn
except ImportError:  # pragma: no cover
    sys.exit("Mancano le librerie. Esegui:  pip install -r requirements.txt")

from parser_segnali import interpreta, riconosci_aggiunta
import syntra_lettore
import storico_sale

# Accesso da altri dispositivi: stesso file e stessa chiave degli altri due servizi.
# Import OBBLIGATORIO: con Tailscale Serve anche il tablet arriva da 127.0.0.1, e senza questo
# modulo nessuno saprebbe distinguerlo dal PC. Prima, se mancava, il ponte partiva lo stesso e
# senza nessun controllo. Dai sorgenti il modulo sta nella cartella sopra: la si aggiunge al
# percorso; nell'eseguibile ce lo mette SegnaliBridge.spec.
if not getattr(sys, "frozen", False):
    _SOPRA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if _SOPRA not in sys.path:
        sys.path.append(_SOPRA)
import accesso_condiviso as _accesso  # noqa: E402
_ACCESSO = _accesso.carica_accesso()

PORTA_DEFAULT = 8769
# La cartella in cui stanno configurazione e sessione. NON si usa un percorso relativo: quello si
# risolve rispetto alla directory di lavoro del processo, che impacchettato in un exe (o avviato
# da un altro programma) non e' quella giusta. Sbagliarla significa non trovare le credenziali e
# riscrivere la sessione altrove, cioe' farsi richiedere il codice di verifica ad ogni avvio.
if getattr(sys, "frozen", False):
    CARTELLA_DATI = os.path.dirname(os.path.abspath(sys.executable))
else:
    CARTELLA_DATI = os.path.dirname(os.path.abspath(__file__))



def _scrivibile(cartella: str) -> bool:
    prova = os.path.join(cartella, ".prova_scrittura")
    try:
        with open(prova, "w") as f:
            f.write("x")
        os.remove(prova)
        return True
    except Exception:
        return False


# Se l'installazione e' finita in una cartella di sola lettura (C:\Program Files, quando si
# installa da amministratore) il file di sessione NON si puo' scrivere: Telegram richiederebbe il
# codice di verifica ad ogni avvio senza dire perche', e nemmeno l'elenco delle sale si potrebbe
# salvare. In quel caso si passa alla cartella dei dati dell'utente, sempre scrivibile, portandosi
# dietro la configurazione che c'e' gia'.
CARTELLA_RICADUTA = os.path.join(
    os.environ.get("APPDATA") or os.path.expanduser("~"), "ForexBacktestLAB", "segnali")
# Server Oracle (server_oracle/): configurazione e sessione stanno nella cartella dei dati del
# server (volume che sopravvive agli aggiornamenti), indicata da FBL_SEGNALI_DATI. Sul PC non c'e'.
if os.environ.get("FBL_SEGNALI_DATI"):
    CARTELLA_DATI = os.environ["FBL_SEGNALI_DATI"]
    os.makedirs(CARTELLA_DATI, exist_ok=True)
elif not _scrivibile(CARTELLA_DATI):
    _origine = os.path.join(CARTELLA_DATI, "configurazione.json")
    try:
        os.makedirs(CARTELLA_RICADUTA, exist_ok=True)
        _destinazione = os.path.join(CARTELLA_RICADUTA, "configurazione.json")
        if os.path.isfile(_origine) and not os.path.isfile(_destinazione):
            import shutil
            shutil.copy2(_origine, _destinazione)
        CARTELLA_DATI = CARTELLA_RICADUTA
    except Exception:
        pass   # non scrivibile nemmeno qui: si prosegue, l'errore si vedra' al primo salvataggio

FILE_CONFIG = os.path.join(CARTELLA_DATI, "configurazione.json")
try:
    storico_sale.imposta_cartella(CARTELLA_DATI)   # cronologia delle sale (vedi storico_sale.py)
except Exception:
    pass
# Client Telegram collegato e sale risolte (voce dell'elenco -> entita'): servono alla lettura
# della cronologia, che riusa la STESSA sessione dell'ascolto dal vivo.
TG_VIVO: Dict[str, object] = {"client": None, "ent": {}}
# Quanti segnali tenere per chi si collega dopo: l'app puo' essere aperta a meta' giornata e
# deve poter vedere cosa e' arrivato prima, invece di ripartire dal vuoto.
STORICO_MAX = 50


def _log(attivo: bool, *parti) -> None:
    if attivo:
        print(time.strftime("[%H:%M:%S]"), *parti, flush=True)


class Bacheca:
    """I segnali interpretati, piu' i risvegli per chi li sta guardando.

    Tiene anche i messaggi SCARTATI (quelli che il parser non ha riconosciuto come segnale):
    servono a capire se la sala usa un formato che ci sfugge, invece di lasciarci col dubbio che
    il ponte sia morto. Non finiscono mai davanti all'utente come ordini.
    """

    def __init__(self) -> None:
        self._segnali: List[dict] = []
        self._scartati: List[dict] = []
        self._ev = asyncio.Event()
        self._lock = asyncio.Lock()
        self._prossimo_id = 1

    async def aggiungi(self, voce: dict, riconosciuto: bool) -> dict:
        async with self._lock:
            voce["id"] = self._prossimo_id
            self._prossimo_id += 1
            elenco = self._segnali if riconosciuto else self._scartati
            elenco.append(voce)
            if len(elenco) > STORICO_MAX:
                del elenco[: len(elenco) - STORICO_MAX]
            self._ev.set()
            self._ev.clear()
            return voce

    async def da(self, ultimo_id: int) -> List[dict]:
        async with self._lock:
            return [s for s in self._segnali if s["id"] > ultimo_id]

    async def riepilogo(self) -> dict:
        async with self._lock:
            return {
                "segnali": len(self._segnali),
                "scartati": len(self._scartati),
                "ultimi_scartati": [s["testo"][:120] for s in self._scartati[-5:]],
            }

    async def attendi(self, timeout: float) -> None:
        try:
            await asyncio.wait_for(self._ev.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            pass


BACHECA = Bacheca()
STATO = {"verbose": True, "sim": False, "chat": [], "collegato": False, "errore": None}

# Cosa sta aspettando l'accesso a Telegram, e cosa e' andato storto l'ultima volta. L'app legge
# questi due campi nello stato e apre il popup giusto: numero, codice, o password della verifica
# in due passaggi. Niente di tutto cio' passa per la console.
ACCESSO = {"serve": None, "errore": None}
# La risposta dell'app arriva qui. Non e' un dizionario di valori "storici": viene svuotato appena
# consumato, perche' sono credenziali e non devono restare in memoria un istante piu' del dovuto.
_RISPOSTE: Dict[str, str] = {}
_RISPOSTA_PRONTA: Optional[object] = None  # asyncio.Event, creato quando serve


def salva_configurazione(campi: dict) -> Optional[str]:
    """Unisce dei campi in configurazione.json. Restituisce un messaggio d'errore, o None.

    Si UNISCE, non si sovrascrive: il file contiene anche l'elenco delle sale e il nome della
    sessione, e riscriverlo da zero li cancellerebbe.
    """
    cfg = carica_configurazione() or {}
    cfg.update(campi)
    try:
        with open(FILE_CONFIG, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
    except Exception as e:
        return "non riesco a salvare %s: %s" % (FILE_CONFIG, e)
    return None


def _credenziali_valide(api_id, api_hash):
    """Controlli minimi prima di scrivere: un api_id non numerico o un hash della lunghezza
    sbagliata non funzionerebbero mai, e scoprirlo al primo collegamento (con un errore di
    Telegram incomprensibile) sarebbe peggio che dirlo subito."""
    try:
        n = int(str(api_id).strip())
    except Exception:
        return None, "l'API ID deve essere un numero (lo trovi su my.telegram.org)"
    if n <= 0:
        return None, "l'API ID non sembra valido"
    h = str(api_hash or "").strip()
    if len(h) < 30 or not all(c in "0123456789abcdefABCDEF" for c in h):
        return None, "l'API hash deve essere la stringa di 32 caratteri che trovi su my.telegram.org"
    return (n, h), None


def _accesso_chiedi(cosa: str) -> None:
    # L'errore precedente NON si cancella qui: e' la spiegazione che l'app deve mostrare nel popup
    # ("codice non valido, riprova", "Telegram non ha accettato questo numero"). Cancellarlo adesso
    # significava chiedere di nuovo la stessa cosa senza dire cosa non era andato: si cancella
    # quando la risposta arriva, in _accesso_attendi.
    ACCESSO["serve"] = cosa
    _log(True, "accesso Telegram: l'app deve fornire %s" % cosa)


async def _accesso_attendi(cosa: str, attesa_massima: float = 300.0) -> Optional[str]:
    """Aspetta che l'app mandi il dato richiesto. Restituisce None se non arriva in tempo.

    Il limite di cinque minuti non e' un dettaglio: senza, un accesso lasciato a meta' terrebbe
    il ponte fermo per sempre, in attesa di una risposta che nessuno stara' piu' dando.
    """
    global _RISPOSTA_PRONTA
    _accesso_chiedi(cosa)
    # Il valore puo' essere GIA' arrivato, prima che lo si chiedesse: l'app ha risposto a una
    # richiesta ripetuta, o l'utente ha premuto due volte. Senza questo controllo si aspetterebbe
    # un evento che non arrivera' mai piu' - cinque minuti di ponte fermo con la risposta in mano.
    if cosa in _RISPOSTE:
        valore = _RISPOSTE.pop(cosa)
        ACCESSO["serve"] = None
        _log(True, "accesso Telegram: %s era gia' arrivato, lo uso" % cosa)
        return valore if str(valore or "").strip() else None
    _RISPOSTA_PRONTA = asyncio.Event()
    try:
        await asyncio.wait_for(_RISPOSTA_PRONTA.wait(), timeout=attesa_massima)
    except asyncio.TimeoutError:
        ACCESSO["serve"] = None
        ACCESSO["errore"] = "nessuna risposta dall'app: accesso annullato"
        _log(True, "accesso Telegram annullato: l'app non ha risposto")
        return None
    finally:
        _RISPOSTA_PRONTA = None
    valore = _RISPOSTE.pop(cosa, None)   # consumato e tolto subito: e' una credenziale
    ACCESSO["serve"] = None
    # Una risposta VUOTA vale come "lascia perdere": l'app manda una stringa vuota quando l'utente
    # chiude il popup, e trattarla come un valore sbagliato farebbe richiedere la stessa cosa cinque
    # volte invece di fermarsi. Vale per numero, codice e password: nessuno dei tre puo' essere vuoto.
    if valore is not None and not str(valore).strip():
        return None
    return valore


def _telefono_valido(grezzo: str) -> Optional[str]:
    """Il numero in cifre, o None se non e' un numero di telefono.

    Stesso criterio di telethon.utils.parse_phone (via +, spazi, parentesi e trattini; devono
    restare solo cifre), piu' un controllo di lunghezza. Farlo QUI, e non lasciarlo scoprire a
    Telethon, e' l'unico modo per poter dire all'utente cosa c'e' che non va.
    """
    import re
    if grezzo is None:
        return None
    cifre = re.sub(r"[+()\s.\-]", "", str(grezzo))
    if not cifre.isdigit():
        return None
    if not (6 <= len(cifre) <= 15):   # intervallo dei numeri telefonici internazionali
        return None
    return cifre


def _accesso_ricevi(cosa: str, valore: str) -> None:
    """L'app ha risposto. Il valore NON viene loggato: si dice solo che e' arrivato."""
    _RISPOSTE[cosa] = str(valore or "")
    _log(True, "accesso Telegram: ricevuto %s dall'app" % cosa)
    if _RISPOSTA_PRONTA is not None:
        try:
            _RISPOSTA_PRONTA.set()
        except Exception:
            pass


# L'ultimo segnale COMPLETO ricevuto da ciascuna sala: serve a dare un riferimento ai messaggi di
# aggiunta ("ADD MORE SELL"), che da soli non dicono ne' strumento ne' prezzi.
ULTIMO_SEGNALE: Dict[str, dict] = {}
# Oltre questo tempo un "add more" non si considera piu' riferito al segnale precedente: le sale
# mandano piu' operazioni al giorno, e collegare un raddoppio a un'operazione di sei ore prima
# vorrebbe dire aprire una posizione su un'altra cosa. Si propone lo stesso, ma con un avviso.
FINESTRA_AGGIUNTA_MIN = 240.0


def _proponi_aggiunta(agg: dict, chat: str) -> Optional[dict]:
    """Da "ADD MORE SELL" a una proposta di raddoppio, agganciata all'ultimo segnale della sala.

    RICHIESTO ESPLICITAMENTE: l'utente vuole vedersi proporre il raddoppio e decidere con una
    conferma. Quindi qui si COSTRUISCE una proposta, non un ordine - e si dichiara tutto cio' che
    e' stato dedotto invece che letto.
    Tre protezioni, perche' un raddoppio dedotto e' piu' fragile di un segnale scritto per esteso:
      1. deve esistere un segnale precedente DELLA STESSA SALA;
      2. la direzione deve coincidere - "ADD MORE BUY" dopo un SELL non e' un'aggiunta a quella
         posizione, e proporlo sarebbe pericoloso;
      3. se il segnale di riferimento e' vecchio, si propone comunque ma con un avviso esplicito.
    """
    rif = ULTIMO_SEGNALE.get(chat)
    if not rif:
        return None
    seg = rif["segnale"]
    eta_min = (time.time() * 1000.0 - rif["ricevuto_ms"]) / 60000.0
    if seg["direzione"] != agg["direzione"]:
        return {
            "proponibile": False,
            "motivo": "la sala dice %s ma l'ultimo segnale era %s: non e' un'aggiunta a quella posizione"
                      % (agg["direzione"], seg["direzione"]),
            "riferimento": seg,
            "eta_minuti": round(eta_min, 1),
        }
    avvisi = [
        "raddoppio DEDOTTO: la sala non ha ripetuto strumento e prezzi, sono presi dal segnale precedente",
    ]
    if eta_min > FINESTRA_AGGIUNTA_MIN:
        avvisi.append("il segnale di riferimento e' di %.0f minuti fa: verifica che sia ancora la stessa operazione"
                      % eta_min)
    # L'entrata di un'aggiunta e' per forza al prezzo di ADESSO, non quella del primo ingresso:
    # ripetere il prezzo originale proporrebbe un ordine a un livello gia' passato.
    derivato = dict(seg)
    derivato["entrata"] = None
    derivato["entrata_max"] = None
    derivato["a_mercato"] = True
    derivato["avvisi"] = list(seg.get("avvisi") or []) + avvisi
    # Confidenza piu' bassa di un segnale scritto per esteso: qui una parte e' dedotta.
    derivato["confidenza"] = max(0, min(100, int(seg.get("confidenza", 0) * 0.6)))
    derivato["riconosciuto"] = list(seg.get("riconosciuto") or []) + ["dedotto_da_aggiunta"]
    return {
        "proponibile": True,
        "riferimento": seg,
        "eta_minuti": round(eta_min, 1),
        "derivato": derivato,
    }


async def accogli_messaggio(testo: str, chat: str, autore: str = "", sala: Optional[str] = None,
                            quando_ms: Optional[float] = None) -> None:
    """Punto UNICO in cui un messaggio diventa (o non diventa) un segnale.

    Simulatore e Telegram passano entrambi da qui: se domani si aggiunge una terza sorgente,
    l'interpretazione resta una sola e non si sdoppia la verita'.
    """
    segnale = interpreta(testo)
    # "sala" e' la voce ESATTA dell'elenco configurato (@nome, link t.me, id...), "chat" il titolo
    # del gruppo su Telegram. L'app riconosce la sala dalla prima: il titolo e' diverso da quello
    # che si scrive nelle impostazioni, e usarlo faceva dire "la sala non e' fra quelle
    # automatiche" anche a una sala spuntata.
    sala = str(sala or chat)
    # Orario del MESSAGGIO su Telegram, riportato sull'orologio di questo PC (vedi OROLOGIO), e
    # quanto ci ha messo ad arrivare qui. L'app non apre da sola un segnale arrivato in ritardo: il
    # prezzo di allora non c'e' piu'.
    servizio_ms = time.time() * 1000.0
    ricevuto_ms = servizio_ms
    if quando_ms:
        ricevuto_ms = min(servizio_ms, float(quando_ms) - OROLOGIO["scarto_s"] * 1000.0)
    voce = {
        "ricevuto_ms": ricevuto_ms,
        "servizio_ms": servizio_ms,
        "ritardo_ms": max(0.0, servizio_ms - ricevuto_ms),
        "chat": chat,
        "sala": sala,
        "autore": autore,
        "testo": str(testo or "").strip(),
        "segnale": segnale,
        "sottotipo": "nuovo",
    }
    if segnale:
        # In quante entrate e' diviso questo messaggio (principale + "MORE BUY @ ..."): l'app divide
        # il rischio della sala fra tutte, cosi' il messaggio intero non supera il rischio scelto.
        voce["parti"] = 1 + len(segnale.get("ordini_aggiuntivi") or [])
        ULTIMO_SEGNALE[sala] = voce
        await BACHECA.aggiungi(voce, True)
        _log(STATO["verbose"], "SEGNALE %s %s (confidenza %d%%)%s" % (
            segnale["direzione"], segnale["strumento"], segnale["confidenza"],
            "  AVVISI: " + "; ".join(segnale["avvisi"]) if segnale["avvisi"] else ""))
        # SECONDA ENTRATA nello stesso messaggio ("GOLD BUY NOW @ 4183 / MORE BUY @ 4173"): un
        # segnale a parte, ordine LIMIT (o STOP) a quel prezzo, con lo STESSO stop e gli stessi
        # target. Nell'app ha la sua scheda e segue le stesse regole (apertura automatica compresa).
        for extra in segnale.get("ordini_aggiuntivi") or []:
            seg2 = dict(segnale)
            seg2.update({"tipo_ordine": extra["tipo_ordine"], "entrata": extra["entrata"],
                         "entrata_max": None, "a_mercato": False, "ordini_aggiuntivi": []})
            seg2["avvisi"] = list(segnale.get("avvisi") or []) + [
                "seconda entrata dello stesso messaggio (%s): ordine %s a %s" % (
                    extra.get("riga", ""), extra["tipo_ordine"].upper(), extra["entrata"])]
            voce2 = dict(voce)
            voce2.update({"segnale": seg2, "sottotipo": "seconda_entrata"})
            await BACHECA.aggiungi(voce2, True)
            _log(STATO["verbose"], "SECONDA ENTRATA %s %s %s a %s" % (
                seg2["direzione"], seg2["strumento"], extra["tipo_ordine"].upper(), extra["entrata"]))
        return

    agg = riconosci_aggiunta(testo)
    if agg:
        esito = _proponi_aggiunta(agg, sala)
        if esito and esito.get("proponibile"):
            voce["sottotipo"] = "aggiunta"
            voce["segnale"] = esito["derivato"]
            voce["aggiunta"] = {"formula": agg["formula"], "eta_minuti": esito["eta_minuti"],
                                "riferimento": esito["riferimento"]}
            await BACHECA.aggiungi(voce, True)
            _log(STATO["verbose"], "AGGIUNTA %s %s dedotta dal segnale di %.0f minuti fa" % (
                esito["derivato"]["direzione"], esito["derivato"]["strumento"], esito["eta_minuti"]))
            return
        motivo = (esito or {}).get("motivo") or "nessun segnale precedente da questa sala a cui agganciarla"
        voce["sottotipo"] = "aggiunta_non_agganciabile"
        voce["nota"] = motivo
        await BACHECA.aggiungi(voce, False)
        _log(STATO["verbose"], "aggiunta NON proponibile: " + motivo)
        return

    await BACHECA.aggiungi(voce, False)
    _log(STATO["verbose"], "scartato (non e' un segnale): " + voce["testo"][:70].replace("\n", " "))


# =====================================================================================
# SORGENTE 1 — simulatore
# =====================================================================================
ESEMPI = [
    "\U0001F535 BUY EURUSD @ 1.0850\nSL: 1.0820\nTP1: 1.0880\nTP2: 1.0920",
    "GOLD SELL NOW 2650.50\nStop loss 2660.00\nTake profit 2630.00",
    "VENDI NAS100 a 20500\nStop 20560\nObiettivo 1: 20400\nObiettivo 2: 20350",
    "Buongiorno ragazzi, setup della mattina.\n\U0001F534 SELL XAU/USD @ 2655\nSL: 2663\nTP1: 2645",
    "TP1 raggiunto su oro, sposto a pari \U0001F44D",            # va scartato
    "Buongiorno a tutti, oggi mercati chiusi per festivita'.",     # va scartato
    "\U0001F7E2 US30 35200\nS/L 35100\nT/P 35400",
    "BUY EURUSD 1.0850\nSL 1.0900\nTP 1.0880",                    # incoerente: deve uscire con avviso
    "ADD MORE SELL \U0001F3AF",                                   # aggiunta: si aggancia al segnale precedente
    "ADD MORE BUY",                                               # direzione opposta: NON proponibile
]


async def sorgente_simulatore() -> None:
    _log(True, "SIMULATORE attivo: i messaggi sono inventati, nessun Telegram collegato")
    STATO["collegato"] = True
    i = 0
    while True:
        await asyncio.sleep(random.uniform(6, 12))
        await accogli_messaggio(ESEMPI[i % len(ESEMPI)], "Sala di prova", "Simulatore")
        i += 1


# =====================================================================================
# SORGENTE 2 — Telegram vero
# =====================================================================================
def carica_configurazione() -> Optional[dict]:
    if not os.path.isfile(FILE_CONFIG):
        return None
    try:
        with open(FILE_CONFIG, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        STATO["errore"] = "configurazione.json illeggibile: %s" % e
        return None


# Ultimo messaggio visto per ogni sala: serve a recuperare quelli arrivati durante un'interruzione.
ULTIMO_ID_PER_CHAT: Dict[int, int] = {}
# Messaggi gia' passati da accogli_messaggio: lo stesso messaggio puo' arrivare sia dall'evento di
# Telegram sia dal controllo veloce (vedi _controllo_veloce), e deve diventare UN segnale solo.
_VISTI: Dict[tuple, float] = {}


def _primo_arrivo(cid, mid) -> bool:
    chiave = (cid, mid)
    if chiave in _VISTI:
        return False
    _VISTI[chiave] = time.time()
    if len(_VISTI) > 5000:
        for k, _ in sorted(_VISTI.items(), key=lambda kv: kv[1])[:1000]:
            _VISTI.pop(k, None)
    return True


# Differenza fra l'orologio dei server Telegram e quello di questo PC, in secondi. Il ritardo di un
# segnale si misura confrontando l'ora del messaggio (Telegram) con l'ora di arrivo (PC): con il PC
# avanti di due minuti ogni segnale sembrerebbe vecchio di due minuti e l'app non ne aprirebbe
# nessuno. Si legge da Telegram all'avvio e ogni 5 minuti.
OROLOGIO = {"scarto_s": 0.0}


async def _misura_orologio(client) -> None:
    try:
        from telethon.tl.functions.help import GetConfigRequest
        prima = time.time()
        conf = await asyncio.wait_for(client(GetConfigRequest()), timeout=15)
        dopo = time.time()
        server = conf.date.timestamp() if hasattr(conf.date, "timestamp") else float(conf.date)
        # La data di Telegram ha la precisione del secondo (troncata): +0,5 s in media.
        scarto = server + 0.5 - (prima + dopo) / 2.0
        # Sotto il secondo e mezzo e' rumore della misura: meglio non correggere affatto.
        OROLOGIO["scarto_s"] = scarto if abs(scarto) > 1.5 else 0.0
        if abs(scarto) > 1.5:
            _log(True, "orologio del PC diverso da quello di Telegram di %.1f s: ne tengo conto" % -scarto)
    except Exception as e:
        _log(STATO["verbose"], "misura dell'orologio non riuscita: %s" % e.__class__.__name__)


async def _sorgente_telegram_sempre() -> None:
    """SUPERVISORE: se l'ascolto di Telegram finisce, riparte da solo.

    Prima, finito run_until_disconnected(), il servizio restava acceso e rispondeva "ok" ma non
    riceveva piu' niente fino al riavvio a mano. Riparte SOLO se il collegamento era gia' riuscito
    (sessione autorizzata): se manca l'accesso o la configurazione si aspetta l'utente - ripartire
    vorrebbe dire chiedere a Telegram un codice nuovo ogni pochi secondi.
    Attesa crescente: 10 s, 20 s, 40 s... fino a 5 minuti; torna a 10 s dopo un collegamento buono.
    """
    attesa = 10
    while True:
        STATO["_riuscito_in_questo_giro"] = False
        inizio = time.time()
        try:
            await sorgente_telegram()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            _log(True, "collegamento a Telegram caduto: %s: %s" % (e.__class__.__name__, e))
        STATO["collegato"] = False
        if not STATO.get("_riuscito_in_questo_giro"):
            return
        if time.time() - inizio > 600:
            attesa = 10
        STATO["errore"] = "collegamento a Telegram interrotto: riprovo tra %d secondi" % attesa
        _log(True, STATO["errore"])
        await asyncio.sleep(attesa)
        attesa = min(300, attesa * 2)


async def sorgente_telegram() -> None:
    try:
        from telethon import TelegramClient, events
    except ImportError:
        STATO["errore"] = ("manca la libreria telethon. Esegui: pip install telethon "
                           "(oppure avvia con --sim per provare senza Telegram)")
        _log(True, "ERRORE: " + STATO["errore"])
        return

    cfg = carica_configurazione()
    if not cfg:
        STATO["errore"] = ("manca %s. Copia configurazione.esempio.json, rinominalo e mettici "
                           "api_id/api_hash da my.telegram.org." % FILE_CONFIG)
        _log(True, "ERRORE: " + STATO["errore"])
        return

    api_id, api_hash = cfg.get("api_id"), cfg.get("api_hash")
    chat_volute = [str(c) for c in (cfg.get("chat") or []) if str(c).strip()]
    if not api_id or not api_hash:
        STATO["errore"] = "api_id/api_hash mancanti in %s" % FILE_CONFIG
        _log(True, "ERRORE: " + STATO["errore"])
        return
    if not chat_volute:
        STATO["errore"] = "nessuna chat indicata in %s (campo \"chat\")" % FILE_CONFIG
        _log(True, "ERRORE: " + STATO["errore"])
        return

    STATO["chat"] = chat_volute
    # Il file di sessione e' una credenziale: sta accanto alla configurazione, non nel repository
    # e non nella directory di lavoro di turno (vedi CARTELLA_DATI).
    nome_sessione = str(cfg.get("sessione") or "sessione_segnali")
    if not os.path.isabs(nome_sessione):
        nome_sessione = os.path.join(CARTELLA_DATI, nome_sessione)
    # SEGNALATO: "nella notte la connessione con le sale si e' interrotta e non ha piu' ricevuto
    # segnali". Con i valori predefiniti Telethon riprova 5 volte a 1 secondo di distanza e poi si
    # arrende: basta il Wi-Fi che si riconnette o un attimo di standby. Ora riprova all'infinito.
    client = TelegramClient(nome_sessione, int(api_id), str(api_hash),
                            connection_retries=None, retry_delay=5, auto_reconnect=True,
                            request_retries=10)
    global _CLIENT, _FILE_SESSIONE
    _CLIENT, _FILE_SESSIONE = client, nome_sessione

    _log(True, "collegamento a Telegram...")
    # NIENTE client.start(): quella chiede numero e codice sulla CONSOLE, e costringerebbe a
    # tenere aperta una finestra nera. Qui ogni passo viene chiesto all'app, che mostra un popup.
    await client.connect()
    telefono = None   # resta None se la sessione era gia' autorizzata: nulla da salvare
    if not await client.is_user_authorized():
        from telethon.errors import SessionPasswordNeededError, PhoneCodeInvalidError

        # Il numero si puo' sbagliare: si richiede, invece di piantare tutto e costringere a
        # chiudere il processo a mano per ricominciare.
        invio = None
        telefono = None
        # Numero gia' salvato su QUESTO dispositivo: non lo si richiede ad ogni accesso. Resta nel
        # file locale, come tutto il resto.
        telefono_salvato = _telefono_valido(cfg.get("telefono"))
        for tentativo in range(5):
            if telefono_salvato and tentativo == 0:
                grezzo = telefono_salvato
                _log(True, "uso il numero di telefono salvato su questo dispositivo")
            else:
                grezzo = await _accesso_attendi("telefono")
            if grezzo is None:
                STATO["errore"] = ("accesso a Telegram interrotto: nessun numero ricevuto. "
                                   "Premi di nuovo Collegamento per riprovare.")
                return
            telefono = _telefono_valido(grezzo)
            if not telefono:
                ACCESSO["errore"] = ("quello non sembra un numero di telefono: scrivilo con il "
                                     "prefisso internazionale, per esempio +39 333 1234567")
                _log(True, "numero non valido (tentativo %d di 5)" % (tentativo + 1))
                continue
            try:
                invio = await client.send_code_request(telefono)
                ACCESSO["errore"] = None   # numero accettato: l'errore di prima non riguarda piu' niente
                break
            except Exception as e:
                # Qui ci finiscono i numeri formalmente validi ma rifiutati DAVVERO da Telegram
                # (inesistenti, bloccati, troppi tentativi): si dice cosa e' successo e si richiede.
                ACCESSO["errore"] = "Telegram non ha accettato questo numero (%s). Controllalo e riprova." % e.__class__.__name__
                _log(True, "send_code_request fallita: %s: %s" % (e.__class__.__name__, e))
                continue
        if invio is None:
            STATO["errore"] = ("numero di telefono non accettato dopo piu' tentativi: "
                               "premi di nuovo Collegamento per ricominciare.")
            ACCESSO["errore"] = STATO["errore"]
            return

        # Il codice si puo' sbagliare: si riprova, invece di far ripartire tutto da capo.
        for tentativo in range(3):
            codice = await _accesso_attendi("codice")
            if not codice:
                STATO["errore"] = ("accesso a Telegram interrotto: nessun codice ricevuto. "
                                   "Premi di nuovo Collegamento per riprovare.")
                return
            try:
                await client.sign_in(telefono, codice, phone_code_hash=invio.phone_code_hash)
                break
            except SessionPasswordNeededError:
                ACCESSO["errore"] = None   # il codice era giusto: non trascinare un errore vecchio
                # Verifica in due passaggi attiva: serve anche la password del CLOUD Telegram.
                # Non viene salvata da nessuna parte: si usa e si butta.
                password = await _accesso_attendi("password")
                if not password:
                    STATO["errore"] = "accesso a Telegram non completato: manca la password della verifica in due passaggi"
                    return
                try:
                    await client.sign_in(password=password)
                except Exception as e:
                    STATO["errore"] = "password della verifica in due passaggi non accettata: %s" % e.__class__.__name__
                    ACCESSO["errore"] = STATO["errore"]
                    return
                break
            except PhoneCodeInvalidError:
                ACCESSO["errore"] = "codice non valido, riprova"
                _log(True, "codice di verifica non valido (tentativo %d di 3)" % (tentativo + 1))
                continue
            except Exception as e:
                STATO["errore"] = "accesso a Telegram fallito: %s" % e
                ACCESSO["errore"] = STATO["errore"]
                _log(True, "ERRORE: " + STATO["errore"])
                return
        else:
            STATO["errore"] = "codice di verifica sbagliato tre volte: accesso annullato"
            ACCESSO["errore"] = STATO["errore"]
            return

    ACCESSO["serve"] = None
    ACCESSO["errore"] = None
    STATO["collegato"] = True
    STATO["errore"] = None
    STATO["_riuscito_in_questo_giro"] = True
    # Accesso riuscito: il numero si salva, cosi' la prossima volta non viene piu' chiesto. Si
    # salva SOLO dopo che Telegram l'ha accettato - salvarlo prima vorrebbe dire conservare un
    # numero sbagliato e richiederlo per sempre.
    if telefono and _telefono_valido(cfg.get("telefono")) != telefono:
        err = salva_configurazione({"telefono": telefono})
        if err:
            _log(True, "numero non salvato: " + err)
        else:
            _log(True, "numero di telefono salvato su questo dispositivo")
    _log(True, "collegato a Telegram")

    # Si risolvono le chat UNA VOLTA all'avvio: un link o un nome diventano un identificatore
    # interno. Se una non si risolve lo si dice subito, invece di restare in ascolto del nulla.
    risolte = []
    # identificatore Telegram -> voce dell'elenco configurato, per dire all'app DA QUALE sala
    # (come l'ha scritta lei) arriva ogni messaggio.
    sala_per_id: Dict[int, str] = {}
    from telethon import utils as _tg_utils
    for c in chat_volute:
        try:
            ent = await client.get_entity(c)
            nome = getattr(ent, "title", None) or getattr(ent, "username", None) or str(c)
            risolte.append(ent)
            TG_VIVO["ent"][c] = ent
            try:
                sala_per_id[_tg_utils.get_peer_id(ent)] = c
            except Exception:
                pass
            _log(True, "in ascolto su: %s" % nome)
        except Exception as e:
            _log(True, "NON raggiungibile: %s (%s). Sei dentro a questo gruppo?" % (c, e.__class__.__name__))

    TG_VIVO["client"] = client
    if not risolte:
        STATO["errore"] = "nessuna delle chat indicate e' raggiungibile con questo account"
        return

    # Titolo di ogni sala, letto una volta sola qui sopra.
    nome_per_id: Dict[int, str] = {}
    for ent in risolte:
        try:
            nome_per_id[_tg_utils.get_peer_id(ent)] = (getattr(ent, "title", None)
                                                      or getattr(ent, "username", None) or "?")
        except Exception:
            pass

    def _quando(m):
        d = getattr(m, "date", None)
        return d.timestamp() * 1000.0 if d is not None and hasattr(d, "timestamp") else None

    @client.on(events.NewMessage(chats=risolte))
    async def _(evento):  # pragma: no cover - richiede Telegram
        # SEGNALI IN RITARDO (segnalato): prima, prima di consegnare il messaggio si chiedevano a
        # Telegram la chat e il mittente - due giri di rete, a volte secondi. Ora il titolo e' gia'
        # in memoria e il mittente si prende solo se Telegram l'ha gia' mandato insieme al messaggio.
        testo = evento.message.message or ""
        if not testo.strip():
            return
        cid = evento.chat_id
        try:
            ULTIMO_ID_PER_CHAT[cid] = max(ULTIMO_ID_PER_CHAT.get(cid, 0), evento.message.id)
        except Exception:
            pass
        if not _primo_arrivo(cid, evento.message.id):
            return
        autore = ""
        try:
            mittente = evento.sender  # gia' in memoria, nessuna chiamata di rete
            if mittente is not None:
                autore = getattr(mittente, "username", None) or getattr(mittente, "first_name", "") or ""
        except Exception:
            pass
        nome = nome_per_id.get(cid) or "?"
        if nome == "?":
            try:
                chat = await evento.get_chat()
                nome = getattr(chat, "title", None) or getattr(chat, "username", None) or "?"
            except Exception:
                pass
        await accogli_messaggio(testo, nome, autore, sala_per_id.get(cid), _quando(evento.message))

    # RECUPERO: dopo una ripartenza si rileggono i messaggi arrivati nel buco (solo se il processo li
    # aveva gia' visti prima: al primo avvio non si recupera niente, sarebbe roba di ieri).
    for ent in risolte:
        try:
            cid = _tg_utils.get_peer_id(ent)
            ultimo = ULTIMO_ID_PER_CHAT.get(cid)
            if not ultimo:
                ult = await client.get_messages(ent, limit=1)
                if ult:
                    ULTIMO_ID_PER_CHAT[cid] = ult[0].id
                continue
            persi = await client.get_messages(ent, min_id=ultimo, limit=30)
            nome = getattr(ent, "title", None) or getattr(ent, "username", None) or "?"
            for m in reversed(list(persi or [])):
                ULTIMO_ID_PER_CHAT[cid] = max(ULTIMO_ID_PER_CHAT.get(cid, 0), m.id)
                if not (m.message or "").strip() or not _primo_arrivo(cid, m.id):
                    continue
                await accogli_messaggio(m.message, nome, "", sala_per_id.get(cid), _quando(m))
            if persi:
                _log(True, "recuperati %d messaggi arrivati durante l'interruzione da %s" % (len(persi), nome))
        except Exception as e:
            _log(True, "recupero messaggi non riuscito per una sala: %s" % e.__class__.__name__)

    # CONTROLLO DI VITA: a volte la connessione resta "su" ma gli aggiornamenti smettono di arrivare
    # (cambio di rete, standby). Ogni 5 minuti si chiede a Telegram chi siamo: se non risponde entro
    # 60 secondi si chiude, e il supervisore (vedi _sorgente_telegram_sempre) riparte da capo.
    async def _vita():
        while True:
            await asyncio.sleep(300)
            try:
                await asyncio.wait_for(client.get_me(), timeout=60)
                STATO["ultimo_contatto"] = time.time()
                await _misura_orologio(client)
            except Exception as e:
                _log(True, "Telegram non risponde (%s): riavvio il collegamento" % e.__class__.__name__)
                try:
                    await client.disconnect()
                except Exception:
                    pass
                return
    # CONTROLLO VELOCE. Telegram non sempre SPINGE subito i messaggi dei canali grandi: a volte li
    # consegna dopo decine di secondi, o solo quando il client "riapre" il canale - ed e' la causa dei
    # segnali arrivati in ritardo. Qui si chiede ogni ~3 secondi a ogni sala se c'e' un messaggio
    # nuovo: quello che l'evento ha gia' portato si salta (vedi _primo_arrivo), quello che manca entra
    # subito. Se Telegram chiede di rallentare (FloodWait) si aspetta quanto dice.
    async def _controllo_veloce():
        while True:
            inizio = time.monotonic()
            for ent in risolte:
                try:
                    cid = _tg_utils.get_peer_id(ent)
                    ultimo = ULTIMO_ID_PER_CHAT.get(cid)
                    if not ultimo:
                        continue
                    nuovi = await asyncio.wait_for(client.get_messages(ent, min_id=ultimo, limit=20), timeout=10)
                    for m in reversed(list(nuovi or [])):
                        ULTIMO_ID_PER_CHAT[cid] = max(ULTIMO_ID_PER_CHAT.get(cid, 0), m.id)
                        if not (m.message or "").strip() or not _primo_arrivo(cid, m.id):
                            continue
                        q = _quando(m)
                        _log(True, "messaggio preso dal controllo veloce (Telegram non l'aveva ancora spinto)%s" % (
                            " dopo %.0f s" % (time.time() - q / 1000.0 + OROLOGIO["scarto_s"]) if q else ""))
                        await accogli_messaggio(m.message, nome_per_id.get(cid) or "?", "", sala_per_id.get(cid), q)
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    attesa = getattr(e, "seconds", None)
                    if isinstance(attesa, (int, float)) and attesa > 0:
                        _log(True, "Telegram chiede di rallentare il controllo veloce per %d s" % attesa)
                        await asyncio.sleep(min(float(attesa) + 1.0, 600.0))
                await asyncio.sleep(0.3)
            await asyncio.sleep(max(0.5, 3.0 - (time.monotonic() - inizio)))

    await _misura_orologio(client)
    vita = asyncio.create_task(_vita())
    veloce = asyncio.create_task(_controllo_veloce())
    STATO["ultimo_contatto"] = time.time()
    try:
        await client.run_until_disconnected()
    finally:
        vita.cancel()
        veloce.cancel()
        STATO["collegato"] = False
        try:
            await client.disconnect()
        except Exception:
            pass


# =====================================================================================
# USCITA — il WebSocket che legge l'app
# =====================================================================================
from contextlib import asynccontextmanager


@asynccontextmanager
async def _ciclo(_app):
    global _task_sorgente
    _task_sorgente = asyncio.create_task(
        sorgente_simulatore() if STATO["sim"] else _sorgente_telegram_sempre()
    )
    avvia_syntra()
    try:
        yield
    finally:
        if _task_sorgente:
            _task_sorgente.cancel()
        if _task_syntra:
            _task_syntra.cancel()


# =====================================================================================
# SORGENTE 3 — Syntra (app Android in un emulatore sul PC, letta via ADB)
# =====================================================================================
# Le operazioni condivise dagli utenti di Syntra diventano segnali come quelli delle sale
# Telegram: stessa bacheca, stessa app, stesse regole. La "sala" e' "Syntra · <utente>": nell'app
# ogni utente si accende o si spegne (e si configura) come una sala. Vedi syntra_lettore.py.
_task_syntra = None


async def accogli_segnale_syntra(segnale: dict, utente: str, quando_ms: float) -> None:
    servizio_ms = time.time() * 1000.0
    ricevuto_ms = min(servizio_ms, float(quando_ms or servizio_ms))
    nome = "Syntra · %s" % utente
    voce = {"ricevuto_ms": ricevuto_ms, "servizio_ms": servizio_ms,
            "ritardo_ms": max(0.0, servizio_ms - ricevuto_ms),
            "chat": nome, "sala": nome, "autore": utente, "testo": segnale.get("testo") or "",
            "segnale": segnale, "sottotipo": "nuovo", "parti": 1, "fonte": "syntra"}
    ULTIMO_SEGNALE[nome] = voce
    try:
        storico_sale.archivia_syntra(nome, segnale, ricevuto_ms)
    except Exception as e:
        _log(True, "archivio Syntra non scritto: %s" % e)
    await BACHECA.aggiungi(voce, True)
    _log(True, "SYNTRA %s %s %s da %s" % (segnale["direzione"], segnale["strumento"],
                                         (segnale.get("tipo_ordine") or "mercato").upper(), utente))


def avvia_syntra() -> None:
    global _task_syntra
    if _task_syntra:
        _task_syntra.cancel()
        _task_syntra = None
    cfg = (carica_configurazione() or {}).get("syntra") or {}
    STATO["syntra_attivo"] = bool(cfg.get("attivo"))
    if not cfg.get("attivo"):
        STATO["syntra_collegato"] = False
        return
    _task_syntra = asyncio.create_task(syntra_lettore.ciclo(cfg, accogli_segnale_syntra, lambda m: _log(True, m), STATO))


app = FastAPI(title="Ponte segnali Telegram - Forex Backtest LAB", lifespan=_ciclo)

# Stesse origini aperte degli altri due ponti del progetto (bridge.py, mt5_feed_server.py): il
# servizio ascolta solo su 127.0.0.1 e la pagina dell'app arriva da un dominio https, quindi senza
# questo la sezione Telegram delle impostazioni non potrebbe nemmeno leggere lo stato.
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

app.add_middleware(CORSMiddleware, **_accesso.opzioni_cors())   # vedi opzioni_cors(): rete privata

# Chi non arriva dal PC stesso deve presentare la chiave, come sugli altri due servizi. Mancava:
# era protetto solo il WebSocket, e con l'accesso da altri dispositivi acceso chiunque arrivasse
# alla porta 8769 poteva leggere le sale (/chat, /health), riscriverle (POST /chat) e soprattutto
# INIETTARE un segnale finto (POST /inietta) con il nome di una sala vera: nell'app suonava
# l'allarme e compariva pronto da confermare, con soldi veri.
# /prova si apre anche senza chiave: e' lei a chiederla (dal telefono/tablet) prima di fare qualunque
# chiamata, e ogni chiamata che fa poi (/health per verificarla, /inietta) passa dal controllo.
_accesso.installa_controllo_chiave(app, percorsi_liberi=("/prova",))

# Il task della sorgente Telegram, tenuto da parte per poterlo far ripartire quando l'elenco dei
# gruppi cambia dall'app: senza, ogni modifica richiederebbe di chiudere e riaprire il ponte.
_task_sorgente: Optional[asyncio.Task] = None
# Il collegamento Telegram in uso e il suo file di sessione: servono per USCIRE davvero.
_CLIENT = None
_FILE_SESSIONE: Optional[str] = None


async def esci_da_telegram() -> dict:
    """RICHIESTO: "dimentica il numero" deve scollegare davvero da Telegram; per rientrare si
    richiedono numero e codice. Si ferma l'ascolto, si fa il logout (la sessione non vale piu'
    nemmeno sui server di Telegram), si cancella il file di sessione e il numero salvato.
    L'ascolto NON riparte da solo: riparte quando l'app si ricollega (vedi "leggi_chat")."""
    global _task_sorgente, _CLIENT
    if _task_sorgente and not _task_sorgente.done():
        _task_sorgente.cancel()
        try:
            await _task_sorgente
        except (asyncio.CancelledError, Exception):
            pass
    uscito_da_telegram = False
    if _CLIENT is not None:
        try:
            if not _CLIENT.is_connected():
                await _CLIENT.connect()
            if await _CLIENT.is_user_authorized():
                uscito_da_telegram = bool(await _CLIENT.log_out())
        except Exception as e:  # rete giu': la sessione si cancella comunque qui sotto
            _log(True, "logout da Telegram non riuscito (%s): cancello comunque la sessione" % e.__class__.__name__)
        try:
            await _CLIENT.disconnect()
        except Exception:
            pass
        _CLIENT = None
    nome = _FILE_SESSIONE or os.path.join(CARTELLA_DATI, str((carica_configurazione() or {}).get("sessione") or "sessione_segnali"))
    for f in (nome + ".session", nome + ".session-journal"):
        try:
            os.remove(f)
        except FileNotFoundError:
            pass
        except Exception as e:
            _log(True, "non riesco a cancellare %s: %s" % (f, e))
    err = salva_configurazione({"telefono": None})
    STATO["collegato"] = False
    STATO["uscito"] = True
    STATO["errore"] = "scollegato da Telegram: per rientrare premi Collegamento e inserisci numero e codice"
    ACCESSO["serve"] = None
    ACCESSO["errore"] = None
    _log(True, "uscito da Telegram: sessione e numero cancellati")
    return {"tipo": "uscito", "ok": err is None, "logout": uscito_da_telegram, "errore": err}


async def riavvia_sorgente() -> None:
    global _task_sorgente
    if _task_sorgente and not _task_sorgente.done():
        _task_sorgente.cancel()
        try:
            await _task_sorgente
        except (asyncio.CancelledError, Exception):
            pass
    STATO["collegato"] = False
    STATO["errore"] = None
    # Anche l'accesso riparte da zero: una richiesta o un errore rimasti dal giro precedente
    # farebbero aprire all'app un popup che non serve piu' a nessuno.
    ACCESSO["serve"] = None
    ACCESSO["errore"] = None
    _task_sorgente = asyncio.create_task(
        sorgente_simulatore() if STATO["sim"] else _sorgente_telegram_sempre()
    )


@app.get("/chat")
async def leggi_chat():
    """L'elenco dei gruppi configurati, per la sezione Telegram delle impostazioni."""
    cfg = carica_configurazione() or {}
    return {
        "chat": cfg.get("chat") or [],
        "credenziali_presenti": bool(cfg.get("api_id") and cfg.get("api_hash")),
        "collegato": STATO["collegato"],
        "errore": STATO["errore"],
        "modalita": "simulatore" if STATO["sim"] else "telegram",
    }


@app.post("/chat")
async def scrivi_chat(corpo: dict):
    """Sostituisce l'elenco dei gruppi e riaggancia Telegram, senza riavviare il ponte.

    Le credenziali NON passano mai di qui: restano nel file locale. Da qui si cambia solo QUALI
    chat leggere - cosi' l'app non ha bisogno di conoscere api_id/api_hash, e non puo' perderli.
    """
    nuove = [str(c).strip() for c in (corpo.get("chat") or []) if str(c).strip()]
    cfg = carica_configurazione() or {}
    cfg["chat"] = nuove
    try:
        with open(FILE_CONFIG, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
    except Exception as e:
        return {"ok": False, "errore": "non riesco a salvare %s: %s" % (FILE_CONFIG, e)}
    STATO["chat"] = nuove
    _log(STATO["verbose"], "elenco chat aggiornato dall'app: %d" % len(nuove))
    if not STATO["sim"]:
        await riavvia_sorgente()
    return {"ok": True, "chat": nuove}


# =====================================================================================
# PAGINA DI PROVA — iniettare un segnale a mano, senza aspettare Telegram
# =====================================================================================
# RICHIESTO ESPLICITAMENTE: poter provare tutta la catena inserendo una posizione di esempio
# associata a un gruppo, invece di restare in attesa che una sala mandi qualcosa. Utile anche a
# mercati chiusi, e indispensabile per riprovare un caso preciso quante volte serve.
# Il messaggio iniettato attraversa ESATTAMENTE lo stesso percorso di uno vero (stesso
# accogli_messaggio, stesso interprete): se funziona qui, funziona da Telegram.
PAGINA_PROVA = """<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prova segnali - Forex Backtest LAB</title>
<style>
 body{font-family:Inter,system-ui,Arial,sans-serif;background:#0b1016;color:#e8edf3;margin:0;padding:28px}
 #accesso{display:none} #accesso input{font-size:16px}
 .esci{background:none;border:none;color:#8b96a5;font-size:12px;text-decoration:underline;padding:0;margin:0;cursor:pointer}
 .box{max-width:620px;margin:0 auto}
 h1{font-size:18px;margin:0 0 4px} p.sub{color:#8b96a5;font-size:13px;margin:0 0 18px;line-height:1.5}
 label{display:block;font-size:11px;color:#9ca3af;font-weight:700;letter-spacing:.1em;margin:14px 0 5px}
 input,textarea,select{width:100%;box-sizing:border-box;background:#141b26;border:1px solid #232d3d;
  color:#e8edf3;border-radius:8px;padding:9px 11px;font-size:13px;font-family:inherit}
 textarea{min-height:150px;font-family:ui-monospace,Consolas,monospace;line-height:1.5}
 .riga{display:flex;gap:10px} .riga>div{flex:1}
 button{margin-top:18px;background:#14b8a6;border:none;color:#04120f;font-weight:700;padding:11px 18px;
  border-radius:9px;cursor:pointer;font-size:14px}
 button:hover{background:#2dd4bf}
 #esito{margin-top:14px;font-size:13px;line-height:1.5;padding:11px;border-radius:8px;display:none}
 .ok{background:rgba(45,212,191,.1);border:1px solid rgba(45,212,191,.4)}
 .ko{background:rgba(224,82,82,.1);border:1px solid rgba(224,82,82,.4)}
 .nota{color:#8b96a5;font-size:12px;line-height:1.5;margin-top:18px;border-top:1px solid #232d3d;padding-top:14px}
 @media(max-width:600px){ body{padding:16px} .riga{flex-wrap:wrap} .riga>div{flex:1 1 45%} }
</style></head><body>
<!-- Dal telefono/tablet (via Tailscale) la pagina chiede prima la chiave di accesso del PC, la
     verifica e la ricorda su quel dispositivo; dal PC stesso si entra subito. -->
<div class="box" id="accesso">
<h1>Prova dei segnali</h1>
<p class="sub">Per usare questa pagina da un altro dispositivo serve la <b>chiave di accesso</b> del PC:
 la trovi nell'app sul PC, in Impostazioni &rarr; Collegamento &rarr; Accesso da altri dispositivi.</p>
<label>Chiave di accesso</label>
<input id="chiaveIn" type="password" autocomplete="current-password" autocapitalize="off" spellcheck="false" placeholder="Incolla qui la chiave">
<button type="button" id="entra">Entra</button>
<div id="esitoAccesso" class="ko" style="display:none;margin-top:14px;font-size:13px;padding:11px;border-radius:8px"></div>
</div>
<div class="box" id="pagina" style="display:none">
<h1>Prova dei segnali</h1>
<p class="sub">Inietta un messaggio come se arrivasse da una sala Telegram. Percorre lo stesso identico
 cammino di uno vero: stesso interprete, stesso canale verso l'app.</p>

<label>Gruppo di provenienza</label>
<input id="chat" value="Sala di prova" placeholder="es. GOLD Snipers">

<label>Messaggio (scrivilo come lo manderebbe la sala)</label>
<textarea id="testo">XAUUSD SELL

ENTRY 4156-58
SL 4170
TP 4151
TP 4146
TP 4141
TP 4121</textarea>

<label>Oppure compila i campi e genera il messaggio</label>
<div class="riga">
 <div><input id="sym" placeholder="Simbolo (XAUUSD)"></div>
 <div><select id="dir"><option>SELL</option><option>BUY</option></select></div>
 <div><select id="tipo" title="A mercato = si apre subito. Limite/Stop = si entra al prezzo indicato, piu' tardi.">
   <option value="">A mercato</option>
   <option value="LIMIT">LIMIT (entrata migliore)</option>
   <option value="STOP">STOP (sulla rottura)</option>
 </select></div>
 <div><input id="entry" placeholder="Entrata"></div>
</div>
<div class="riga" style="margin-top:8px">
 <div><input id="sl" placeholder="Stop loss"></div>
 <div><input id="tp" placeholder="TP separati da virgola: 4151,4146,4141"></div>
</div>
<button type="button" id="genera" style="background:#232d3d;color:#e8edf3">Genera il messaggio qui sopra</button>

<button type="button" id="invia">Invia all'app</button>
<div id="esito"></div>

<p class="nota"><b>Nessun ordine parte da qui.</b> Il segnale viene solo proposto nell'app, dove sei tu
 a confermarlo. Questa pagina serve a provare la lettura e il percorso, non a operare.</p>
<p class="nota" id="notaChiave" style="display:none">Chiave ricordata su questo dispositivo.
 <button type="button" class="esci" id="esci">Dimentica la chiave</button></p>
</div>
<script>
// ---- Accesso: sul PC stesso non serve niente; da un altro dispositivo serve la chiave.
const LOCALE=['127.0.0.1','localhost','[::1]'].indexOf(location.hostname)>=0;
const CHIAVE_KEY='fbl_chiave_prova';
let chiave='';
try{ chiave=new URLSearchParams(location.search).get('chiave')||localStorage.getItem(CHIAVE_KEY)||''; }catch(e){}
function conChiave(url){ return (LOCALE||!chiave)?url:(url+(url.indexOf('?')>=0?'&':'?')+'chiave='+encodeURIComponent(chiave)); }
function mostra(pagina){
 document.getElementById('accesso').style.display=pagina?'none':'block';
 document.getElementById('pagina').style.display=pagina?'block':'none';
 document.getElementById('notaChiave').style.display=(pagina&&!LOCALE)?'block':'none';
}
async function prova(k){
 const r=await fetch('/health'+(LOCALE?'':('?chiave='+encodeURIComponent(k))),{cache:'no-store'});
 if(r.ok)return null;
 let d=''; try{ d=(await r.json()).detail||''; }catch(e){}
 return d||('il PC ha risposto '+r.status);
}
async function avvio(){
 if(LOCALE){ mostra(true); return; }
 if(chiave){ try{ if(!(await prova(chiave))){ mostra(true); return; } }catch(e){} }
 mostra(false);
}
document.getElementById('entra').addEventListener('click',async()=>{
 const k=document.getElementById('chiaveIn').value.trim();
 const e=document.getElementById('esitoAccesso');
 if(!k){ e.style.display='block'; e.textContent='Scrivi la chiave.'; return; }
 e.style.display='block'; e.className=''; e.textContent='Verifica…';
 try{
  const err=await prova(k);
  if(err){ e.className='ko'; e.textContent='Accesso negato: '+err; return; }
  chiave=k; try{ localStorage.setItem(CHIAVE_KEY,k); }catch(_){}
  e.style.display='none'; mostra(true);
 }catch(x){ e.className='ko'; e.textContent='Il PC non risponde: '+x.message; }
});
document.getElementById('chiaveIn').addEventListener('keydown',ev=>{ if(ev.key==='Enter')document.getElementById('entra').click(); });
document.getElementById('esci').addEventListener('click',()=>{ try{ localStorage.removeItem(CHIAVE_KEY); }catch(_){} chiave=''; document.getElementById('chiaveIn').value=''; mostra(false); });
avvio();
document.getElementById('genera').addEventListener('click',()=>{
 const g=id=>document.getElementById(id).value.trim();
 const tp=g('tp').split(',').map(x=>x.trim()).filter(Boolean);
 const tipo=document.getElementById('tipo').value;
 // Con LIMIT/STOP il prezzo va sulla STESSA riga della direzione ("XAUUSD BUY LIMIT 4120"):
 // e' cosi' che lo scrivono le sale, ed e' cosi' che l'interprete lo riconosce come entrata e
 // non come stop loss.
 let t=(g('sym')||'XAUUSD')+' '+document.getElementById('dir').value
   +(tipo?(' '+tipo+(g('entry')?(' '+g('entry')):'')):'')+'\\n\\n';
 if(g('entry')&&!tipo)t+='ENTRY '+g('entry')+'\\n';
 if(g('sl'))t+='SL '+g('sl')+'\\n';
 tp.forEach(x=>{ t+='TP '+x+'\\n'; });
 document.getElementById('testo').value=t.trim();
});
document.getElementById('invia').addEventListener('click',async()=>{
 const e=document.getElementById('esito');
 e.style.display='block'; e.className=''; e.textContent='Invio…';
 try{
  const r=await fetch(conChiave('/inietta'),{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat:document.getElementById('chat').value,testo:document.getElementById('testo').value})});
  if(r.status===403){ let d=''; try{ d=(await r.json()).detail||''; }catch(_){} e.className='ko'; e.textContent='Il PC ha rifiutato l\\'invio: '+(d||'chiave non valida')+'.'; if(!LOCALE){ try{ localStorage.removeItem(CHIAVE_KEY); }catch(_){} } return; }
  const b=await r.json();
  if(b.riconosciuto){
   const s=b.segnale;
   e.className='ok';
   e.innerHTML='<b>Letto come '+s.direzione+' '+s.strumento+'</b> — confidenza '+s.confidenza+'%'
    +'<br>entrata: '+(s.a_mercato?'a mercato':(s.entrata+(s.entrata_max?(' - '+s.entrata_max):'')))
    +' &nbsp; stop: '+(s.stop_loss??'-')+' &nbsp; target: '+(s.take_profit.join(', ')||'-')
    +(b.sottotipo==='aggiunta'?'<br><b>Raddoppio</b> dedotto dal segnale precedente di questa sala.':'')
    +((b.seconde_entrate||[]).map(x=>'<br><b>+ seconda entrata:</b> ordine '+String(x.tipo_ordine||'').toUpperCase()+' a '+x.entrata).join(''))
    +(s.avvisi.length?('<br><b>Avvisi:</b> '+s.avvisi.join('; ')):'');
  }else{
   e.className='ko';
   e.textContent='Non riconosciuto come segnale: '+(b.nota||'mancano strumento o direzione.');
  }
 }catch(err){ e.className='ko'; e.textContent='Il ponte non risponde: '+err.message; }
});
</script></body></html>"""


@app.get("/prova")
async def pagina_prova():
    from fastapi.responses import HTMLResponse
    return HTMLResponse(PAGINA_PROVA)


@app.post("/inietta")
async def inietta(corpo: dict):
    """Fa entrare un messaggio nella catena come se arrivasse da Telegram."""
    testo = str(corpo.get("testo") or "")
    chat = str(corpo.get("chat") or "Sala di prova").strip() or "Sala di prova"
    if not testo.strip():
        return {"riconosciuto": False, "nota": "messaggio vuoto"}
    prima = (await BACHECA.riepilogo())["segnali"]
    await accogli_messaggio(testo, chat, "Prova manuale")
    ultimi = await BACHECA.da(0)
    # Il segnale principale (non la sua eventuale seconda entrata, che viene subito dopo).
    voce = next((v for v in reversed(ultimi) if v.get("sottotipo") != "seconda_entrata"), None)
    seconde = [v["segnale"] for v in ultimi if v.get("sottotipo") == "seconda_entrata" and voce and v["id"] > voce["id"]]
    riconosciuto = bool(voce and (await BACHECA.riepilogo())["segnali"] > prima)
    if not riconosciuto:
        return {"riconosciuto": False,
                "nota": "manca lo strumento o la direzione, oppure e' un'aggiunta senza un segnale precedente di questa sala"}
    return {"riconosciuto": True, "sottotipo": voce.get("sottotipo"), "segnale": voce["segnale"],
            "seconde_entrate": seconde}


@app.get("/health")
async def health():
    r = await BACHECA.riepilogo()
    r.update({
        "ok": True,
        "modalita": "simulatore" if STATO["sim"] else "telegram",
        "collegato": STATO["collegato"],
        "chat": STATO["chat"],
        "errore": STATO["errore"],
    })
    return r


async def _stato_chat() -> dict:
    cfg = carica_configurazione() or {}
    return {
        "tipo": "stato",
        "chat": cfg.get("chat") or [],
        "credenziali_presenti": bool(cfg.get("api_id") and cfg.get("api_hash")),
        "collegato": STATO["collegato"],
        "errore": STATO["errore"],
        "modalita": "simulatore" if STATO["sim"] else "telegram",
        # Cosa aspetta l'accesso in questo momento: l'app apre il popup giusto e rimanda la
        # risposta sullo stesso canale (azioni accesso_telefono / accesso_codice / accesso_password).
        "accesso_serve": ACCESSO["serve"],
        "accesso_errore": ACCESSO["errore"],
        # Se il numero e' gia' salvato su questo dispositivo non verra' piu' chiesto: l'app lo dice
        # nelle impostazioni, cosi' si sa perche' non compare piu' il popup.
        "telefono_salvato": bool(_telefono_valido(cfg.get("telefono"))),
        # Syntra: configurazione, stato del lettore e utenti visti (nell'app diventano "sale").
        "syntra": {"attivo": bool((cfg.get("syntra") or {}).get("attivo")),
                   "indirizzo": (cfg.get("syntra") or {}).get("indirizzo") or "127.0.0.1:5555",
                   "adb": (cfg.get("syntra") or {}).get("adb") or r"C:\platform-tools\adb.exe",
                   "collegato": bool(STATO.get("syntra_collegato")), "errore": STATO.get("syntra_errore"),
                   "utenti": list(STATO.get("syntra_utenti") or []),
                   "ultimo_giro": STATO.get("syntra_ultimo_giro"),
                   "avvio_automatico": (cfg.get("syntra") or {}).get("avvio_automatico", True) is not False,
                   "riduci": (cfg.get("syntra") or {}).get("riduci", True) is not False,
                   "bluestacks": (cfg.get("syntra") or {}).get("bluestacks") or "",
                   "stato_bluestacks": STATO.get("syntra_bluestacks"),
                   "modalita": STATO.get("syntra_modalita") or "notifiche",
                   "notifiche": STATO.get("syntra_notifiche")},
    }


def _firma_stato() -> tuple:
    """Quel poco che, cambiando, l'app DEVE sapere subito.

    Serve a mandare lo stato appena cambia invece di aspettare che l'app lo chieda: e' cosi' che
    l'app scopre che serve il codice di verifica, o che il collegamento e' andato a buon fine.
    """
    return (ACCESSO["serve"], ACCESSO["errore"], STATO["collegato"], STATO["errore"],
            tuple(STATO["chat"]), bool(STATO.get("syntra_collegato")), STATO.get("syntra_errore"),
            tuple(STATO.get("syntra_utenti") or []), STATO.get("syntra_notifiche"))


async def _manda_storico(websocket: WebSocket, sala: str, richiesta, da_capo: bool) -> None:
    async def manda(d: dict) -> None:
        try:
            await websocket.send_text(json.dumps({"tipo": "storico_sala", "sala": sala, "richiesta": richiesta, **d}))
        except Exception:
            pass

    def avanzamento(letti: int, segnali: int) -> None:
        asyncio.create_task(manda({"avanzamento": True, "letti": letti, "trovati": segnali}))

    try:
        if not sala:
            raise ValueError("manca la sala")
        if sala.startswith("Syntra · "):
            r = storico_sale.leggi_syntra(sala)
            r["nota"] = ("Per Syntra la cronologia parte da quando il ponte archivia i segnali letti: "
                         "l'app Syntra non ha uno storico da sfogliare.")
        else:
            client = TG_VIVO.get("client")
            if client is None or STATO.get("sim"):
                raise RuntimeError("Telegram non e' collegato: accendi il collegamento in Sala segnali e riprova")
            ent = TG_VIVO["ent"].get(sala)
            if ent is None:
                try:
                    ent = await client.get_entity(sala)
                except Exception as e:
                    raise RuntimeError("sala non raggiungibile con questo account (%s)" % e.__class__.__name__)
            _log(True, "cronologia di %s: lettura%s" % (sala, " da capo" if da_capo else ""))
            r = await storico_sale.leggi_telegram(client, ent, sala, interpreta, avanzamento, da_capo)
            _log(True, "cronologia di %s: %d messaggi nuovi letti, %d segnali in tutto" % (sala, r["letti"], len(r["segnali"])))
        await manda({"ok": True, **r})
    except Exception as e:
        await manda({"ok": False, "errore": str(e) or e.__class__.__name__})


# ATTENZIONE: il decoratore deve stare SUBITO sopra ws_segnali. Nella v67 era finito sopra
# _manda_storico e il WebSocket veniva rifiutato (403) mentre /health rispondeva: l'app diceva
# "ponte non raggiungibile" con il ponte acceso e collegato a Telegram.
@app.websocket("/ws/segnali")
async def ws_segnali(websocket: WebSocket):
    """Canale UNICO fra ponte e app: segnali in uscita, comandi in entrata.

    Perche' anche i comandi passano di qui invece che dagli endpoint HTTP: in prova, una `fetch()`
    dalla pagina verso 127.0.0.1 veniva rifiutata ("Failed to fetch") mentre il WebSocket verso lo
    stesso indirizzo funzionava senza problemi - e' la stessa via che l'app usa gia' per Binance e
    per il DOM di MT5, quindi e' quella dimostrata sul campo. Gli endpoint HTTP restano per le
    diagnosi da riga di comando, ma l'app non ci fa affidamento.
    """
    # I segnali passano di qui, e il middleware HTTP le WebSocket non le vede: senza questo
    # controllo l'accesso da altri dispositivi proteggerebbe le chiamate normali e lascerebbe
    # passare i segnali a chiunque sia sulla rete. Si rifiuta PRIMA di accettare.
    if not _accesso.websocket_autorizzato(websocket):
        await websocket.close(code=4403)
        _log(STATO["verbose"], "collegamento rifiutato: chiave mancante o errata")
        return
    await websocket.accept()
    _log(STATO["verbose"], "app collegata")

    # Si riparte dall'ultimo segnale gia' visto, non da zero: cosi' un refresh della pagina non
    # ripropone ordini che avevi gia' valutato.
    ultimo = {"id": 0}
    chiuso = asyncio.Event()

    async def ascolta_comandi():
        while not chiuso.is_set():
            try:
                grezzo = await websocket.receive_text()
            except Exception:
                chiuso.set()
                return
            try:
                m = json.loads(grezzo)
            except Exception:
                continue
            if "ultimo_id" in m:
                try:
                    ultimo["id"] = int(m.get("ultimo_id") or 0)
                except Exception:
                    pass
            azione = m.get("azione")
            if azione in ("accesso_telefono", "accesso_codice", "accesso_password"):
                # Il valore arriva dall'utente, passa di qui e finisce a Telethon. Non viene
                # scritto su disco, non finisce nei log, non resta in memoria dopo l'uso.
                _accesso_ricevi(azione.replace("accesso_", ""), m.get("valore"))
                # Nessuno stato di risposta qui: in questo istante ACCESSO["serve"] contiene
                # ANCORA la cosa appena ricevuta (il numero), e mandarlo all'app le farebbe
                # riaprire lo stesso popup. Lo stato vero parte da solo entro mezzo secondo, dal
                # ciclo qui sotto, quando sapra' cosa serve davvero (il codice).
                continue
            if azione == "salva_credenziali":
                # api_id/api_hash arrivano dall'app e finiscono SOLO nel file locale. Non vengono
                # loggati: si dice che sono stati salvati, non quali sono.
                coppia, errore = _credenziali_valide(m.get("api_id"), m.get("api_hash"))
                if errore:
                    await websocket.send_text(json.dumps({"tipo": "salvato", "ok": False, "errore": errore}))
                else:
                    err = salva_configurazione({"api_id": coppia[0], "api_hash": coppia[1]})
                    ok = err is None
                    if ok:
                        _log(True, "credenziali Telegram salvate su questo dispositivo")
                        STATO["errore"] = None
                        if not STATO["sim"]:
                            await riavvia_sorgente()
                    await websocket.send_text(json.dumps({"tipo": "salvato", "ok": ok, "errore": err}))
                await websocket.send_text(json.dumps(await _stato_chat()))
                continue
            if azione in ("esci_telegram", "dimentica_telefono"):
                # Cambio di numero, o dispositivo passato a qualcun altro: si esce da Telegram.
                await websocket.send_text(json.dumps(await esci_da_telegram()))
                await websocket.send_text(json.dumps(await _stato_chat()))
                continue
            if azione == "syntra_config":
                # Impostazioni del lettore Syntra dall'app: acceso/spento, indirizzo ADB dell'emulatore,
                # percorso di adb.exe. Si salvano nel file e il lettore riparte.
                vecchio = (carica_configurazione() or {}).get("syntra") or {}
                nuovo = dict(vecchio)
                if "attivo" in m:
                    nuovo["attivo"] = bool(m.get("attivo"))
                if m.get("indirizzo"):
                    nuovo["indirizzo"] = str(m.get("indirizzo")).strip()[:60]
                if m.get("adb"):
                    nuovo["adb"] = str(m.get("adb")).strip()[:260]
                if "avvio_automatico" in m:
                    nuovo["avvio_automatico"] = bool(m.get("avvio_automatico"))
                if "riduci" in m:
                    nuovo["riduci"] = bool(m.get("riduci"))
                if "bluestacks" in m:
                    nuovo["bluestacks"] = str(m.get("bluestacks") or "").strip()[:260]
                err = salva_configurazione({"syntra": nuovo})
                if err is None:
                    avvia_syntra()
                    _log(True, "lettore Syntra %s" % ("acceso" if nuovo.get("attivo") else "spento"))
                await websocket.send_text(json.dumps({"tipo": "salvato", "ok": err is None, "errore": err}))
                await websocket.send_text(json.dumps(await _stato_chat()))
                continue
            if azione == "storico_sala":
                # RICHIESTO: cronologia di TUTTI i segnali di una sala (Telegram) o di un utente
                # Syntra. Gira a parte: puo' durare minuti e i segnali dal vivo non devono aspettare.
                asyncio.create_task(_manda_storico(websocket, str(m.get("sala") or ""), m.get("richiesta"),
                                                   bool(m.get("da_capo"))))
                continue
            if azione == "leggi_chat":
                if STATO.get("uscito") and not STATO["sim"]:
                    STATO["uscito"] = False
                    await riavvia_sorgente()   # niente sessione e niente numero: li chiede all'app
                await websocket.send_text(json.dumps(await _stato_chat()))
            elif azione == "scrivi_chat":
                nuove = [str(c).strip() for c in (m.get("chat") or []) if str(c).strip()]
                cfg = carica_configurazione() or {}
                cfg["chat"] = nuove
                esito = {"tipo": "salvato", "ok": True}
                try:
                    with open(FILE_CONFIG, "w", encoding="utf-8") as f:
                        json.dump(cfg, f, ensure_ascii=False, indent=2)
                except Exception as e:
                    esito = {"tipo": "salvato", "ok": False, "errore": "non riesco a salvare %s: %s" % (FILE_CONFIG, e)}
                if esito["ok"]:
                    STATO["chat"] = nuove
                    _log(STATO["verbose"], "elenco chat aggiornato dall'app: %d" % len(nuove))
                    if not STATO["sim"]:
                        await riavvia_sorgente()
                await websocket.send_text(json.dumps(esito))
                await websocket.send_text(json.dumps(await _stato_chat()))

    task = asyncio.create_task(ascolta_comandi())
    try:
        # Lo stato parte subito, senza attendere una richiesta: l'app deve poter mostrare
        # l'elenco appena apre la scheda.
        await websocket.send_text(json.dumps(await _stato_chat()))
        firma = _firma_stato()
        ultimo_battito = time.monotonic()
        while not chiuso.is_set():
            nuovi = await BACHECA.da(ultimo["id"])
            if nuovi:
                for s in nuovi:
                    s = dict(s)
                    s["tipo"] = "segnale"
                    # Eta' del segnale ADESSO, misurata tutta su questo PC: l'app non deve usare il
                    # proprio orologio (un telefono avanti o indietro di un minuto sbaglierebbe tutto).
                    # Un segnale rimasto in fila (app riaperta dopo ore) esce con l'eta' vera.
                    s["eta_ms"] = max(0.0, float(s.get("ritardo_ms") or 0.0)
                                      + time.time() * 1000.0 - float(s.get("servizio_ms") or time.time() * 1000.0))
                    await websocket.send_text(json.dumps(s))
                    ultimo["id"] = s["id"]
            # Lo stato parte APPENA cambia, senza attendere che l'app lo chieda. Prima partiva solo
            # su richiesta: la richiesta del codice di verifica nasce mezzo secondo dopo l'invio del
            # numero, quindi non arrivava mai da sola e restava da premere "Ricontrolla" a mano -
            # due volte, perche' nemmeno il "collegato" finale arrivava.
            firma_ora = _firma_stato()
            if firma_ora != firma:
                firma = firma_ora
                await websocket.send_text(json.dumps(await _stato_chat()))
                ultimo_battito = time.monotonic()
            elif time.monotonic() - ultimo_battito >= 10.0:
                # Il battito dice solo "sono vivo": se non c'e' niente da dire non si riscrive lo
                # stato ogni mezzo secondo.
                ultimo_battito = time.monotonic()
                await websocket.send_text(json.dumps({"tipo": "battito", "collegato": STATO["collegato"],
                                                      "errore": STATO["errore"]}))
            # Mezzo secondo, non dieci: e' il tempo massimo che l'utente aspetta il popup del codice.
            await BACHECA.attendi(timeout=0.5)
    except WebSocketDisconnect:
        _log(STATO["verbose"], "app scollegata")
    except Exception as e:  # pragma: no cover
        _log(STATO["verbose"], "errore sul WebSocket: %s" % e)
    finally:
        chiuso.set()
        task.cancel()


def verifica_librerie(file_esito: Optional[str] = None) -> int:
    """Collaudo dell'eseguibile (build_exe.bat, punto 4): tutte le librerie che servono ci sono?
    0 = si', 3 = no (il motivo nel file indicato). Non si collega a niente."""
    mancanti = []
    for nome in ("telethon", "fastapi", "uvicorn", "websockets", "parser_segnali", "syntra_lettore",
                 "avvio_bluestacks", "storico_sale", "accesso_condiviso"):
        try:
            __import__(nome)
        except Exception as e:
            mancanti.append("%s (%s: %s)" % (nome, e.__class__.__name__, e))
    # Il canale dell'app deve portare a ws_segnali (nella v67 un decoratore spostato lo rompeva).
    try:
        rotta = [r for r in app.routes if getattr(r, "path", "") == "/ws/segnali"]
        if not rotta or getattr(rotta[0], "endpoint", None) is not ws_segnali:
            mancanti.append("canale /ws/segnali (non porta a ws_segnali)")
    except Exception as e:
        mancanti.append("canale /ws/segnali (%s)" % e)
    testo = ("OK: tutte le librerie presenti, canale dell'app a posto" if not mancanti else "MANCANO: " + "; ".join(mancanti))
    if file_esito:
        try:
            with open(file_esito, "w", encoding="utf-8") as f:
                f.write(testo + "\n")
        except OSError:
            pass
    print(testo, flush=True)
    return 0 if not mancanti else 3


def main() -> None:
    if len(sys.argv) >= 2 and sys.argv[1] == "--verifica":
        sys.exit(verifica_librerie(sys.argv[2] if len(sys.argv) >= 3 else None))
    ap = argparse.ArgumentParser(description="Ponte segnali Telegram per Forex Backtest LAB")
    ap.add_argument("--porta", type=int, default=PORTA_DEFAULT)
    ap.add_argument("--sim", action="store_true", help="simulatore: nessun Telegram necessario")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    STATO["verbose"] = not args.quiet
    STATO["sim"] = args.sim

    # Solo ASCII in queste righe: la console di Windows usa cp1252 e un carattere fuori tabella
    # fa morire il programma prima ancora di partire. Gia' successo su un altro ponte.
    print("=" * 70)
    print("  Ponte segnali Telegram - Forex Backtest LAB")
    print("=" * 70)
    print("  L'app si collega a:  ws://127.0.0.1:%d/ws/segnali" % args.porta)
    print("  Stato:               http://127.0.0.1:%d/health" % args.porta)
    if args.sim:
        print("  MODALITA' SIMULATORE: i messaggi sono inventati.")
    else:
        print("  Chat lette da:       %s" % FILE_CONFIG)
    print("  Questo ponte NON apre ordini: legge, interpreta, riporta.")
    print("=" * 70)

    import socket as _socket
    probe = _socket.socket(_socket.AF_INET, _socket.SOCK_STREAM)
    try:
        probe.bind(("127.0.0.1", args.porta))   # la prova di porta occupata resta in locale: basta
    except OSError:
        print("")
        print("  ERRORE: la porta %d e' gia' occupata (il ponte e' gia' avviato?)." % args.porta)
        print("  Per sapere chi la tiene:  netstat -ano | findstr :%d" % args.porta)
        sys.exit(1)
    finally:
        probe.close()

    _host = _accesso.host_di_ascolto()      # sempre 127.0.0.1: dagli altri dispositivi via Tailscale Serve
    if _accesso.carica_accesso().get("rete"):
        print("  Accesso da altri dispositivi ACCESO (via Tailscale): serve la chiave anche per i segnali.")
    uvicorn.run(app, host=_host, port=args.porta, log_level="warning")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except BaseException:
        import traceback
        print("ERRORE ALL'AVVIO DEL PONTE:", flush=True)
        traceback.print_exc()
        sys.stdout.flush()
        raise
