"""Ordini su Kraken Futures (contratti perpetui "PF_", es. PF_XBTUSD) per Forex Backtest LAB.

Montato dentro bridge.py sotto /kraken (porta 8000, stessa chiave di accesso degli ordini MT5).
Le chiavi API di Kraken stanno SOLO qui, sul PC, in un file della cartella dati dell'utente; su
Windows il segreto e' cifrato con DPAPI. L'app non le riceve mai indietro.

Ambienti:
  - "simulato": conto di prova tenuto QUI sul PC (kraken_simulato.py) con i prezzi veri di Kraken,
                anche in modalita' PROP con le regole di Kraken Prop. Nessuna chiave.
                (La demo di Kraken, demo-futures.kraken.com, e' stata chiusa il 14 luglio 2026.)
  - "reale":    https://futures.kraken.com

Come si apre un segnale ("una posizione con chiusure parziali"):
  1. ordine A MERCATO per la quantita' totale (una quota per take profit);
  2. STOP (stp, reduceOnly) sull'intera quantita';
  3. un ordine LIMIT reduceOnly per ogni take profit, ognuno con la sua quota.
Se lo stop viene rifiutato la quota del segnale si CHIUDE subito: mai senza protezione.
Un take profit rifiutato si segnala e basta (lo stop protegge comunque tutto).

PIU' SEGNALI SULLO STESSO SIMBOLO (richiesto): Kraken tiene UNA posizione netta per contratto, ma
ogni segnale ha i SUOI ordini - stop della sua quantita' e i suoi take profit, tutti reduceOnly.
Due long su BTC = una posizione da 0,02 con due stop da 0,01 (uno magari gia' a pareggio) e i
take profit di entrambi. L'app segue ogni segnale dai numeri dei suoi ordini: quando i suoi TP
vengono eseguiti ridimensiona il suo stop (/sl con la quantita' rimasta), quando il suo stop scatta
toglie i suoi TP rimasti (/annulla). Rifiutati solo segnali OPPOSTI sullo stesso simbolo: si
annullerebbero a vicenda nella posizione netta.

Firma (Kraken Futures API v3): Authent = base64(HMAC-SHA512(base64decode(secret),
SHA256(postData + Nonce + endpointPath))), con endpointPath senza il prefisso "/derivatives".
"""
import base64
import hashlib
import hmac
import json
import math
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

try:
    import accesso_condiviso as _accesso
except Exception:  # pragma: no cover
    _accesso = None

AMBIENTI = {
    "reale": "https://futures.kraken.com",
}
if os.environ.get("FBL_KRAKEN_URL_PROVA"):
    AMBIENTI["prova"] = os.environ["FBL_KRAKEN_URL_PROVA"]
PREFISSO = "/derivatives"

CARTELLA = os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), "ForexBacktestLAB", "kraken")
if os.environ.get("FBL_KRAKEN_CARTELLA"):
    CARTELLA = os.environ["FBL_KRAKEN_CARTELLA"]
FILE_CHIAVI = os.path.join(CARTELLA, "chiavi.json")
FILE_SIMULATO = os.path.join(CARTELLA, "simulato.json")     # conto unico delle versioni vecchie
# RICHIESTO: piu' conti di prova, salvati sul PC e ritrovati al prossimo accesso. Ognuno e' un file in
# simulati/, l'elenco (nomi e quale e' attivo) sta in simulati/conti.json.
CARTELLA_CONTI = os.path.join(CARTELLA, "simulati")
FILE_CONTI = os.path.join(CARTELLA_CONTI, "conti.json")

import kraken_simulato as _sim

router = APIRouter(prefix="/kraken")
_lock = threading.Lock()
# Nomi delle monete diversi su Kraken.
ALIAS = {"BTC": "XBT"}


class KrakenErrore(Exception):
    def __init__(self, messaggio, http=None):
        super().__init__(messaggio)
        self.messaggio = messaggio
        self.http = http


# ----------------------------------------------------------------------------- chiavi
def _dpapi(dati: bytes, cifra: bool) -> Optional[bytes]:
    if os.name != "nt":
        return None
    try:
        import ctypes
        from ctypes import wintypes

        class BLOB(ctypes.Structure):
            _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

        buf = ctypes.create_string_buffer(dati, len(dati))
        ingresso = BLOB(len(dati), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))
        uscita = BLOB()
        f = ctypes.windll.crypt32.CryptProtectData if cifra else ctypes.windll.crypt32.CryptUnprotectData
        if not f(ctypes.byref(ingresso), None, None, None, None, 0, ctypes.byref(uscita)):
            return None
        r = ctypes.string_at(uscita.pbData, uscita.cbData)
        ctypes.windll.kernel32.LocalFree(uscita.pbData)
        return r
    except Exception:
        return None


def _salva_simulato() -> None:
    os.makedirs(CARTELLA, exist_ok=True)
    with open(FILE_CHIAVI + ".tmp", "w", encoding="utf-8") as f:
        json.dump({"ambiente": "simulato"}, f)
    os.replace(FILE_CHIAVI + ".tmp", FILE_CHIAVI)


def _salva_chiavi(api_key: str, api_secret: str, ambiente: str) -> None:
    os.makedirs(CARTELLA, exist_ok=True)
    cifrato = _dpapi(api_secret.encode("utf-8"), True)
    dati = {"api_key": api_key, "ambiente": ambiente}
    if cifrato is not None:
        dati["secret_dpapi"] = base64.b64encode(cifrato).decode("ascii")
    else:
        dati["secret"] = api_secret
    tmp = FILE_CHIAVI + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dati, f)
    os.replace(tmp, FILE_CHIAVI)


def _carica_chiavi() -> Optional[dict]:
    try:
        with open(FILE_CHIAVI, encoding="utf-8") as f:
            d = json.load(f)
    except Exception:
        return None
    if d.get("ambiente") == "simulato":
        return {"ambiente": "simulato", "api_key": None, "api_secret": None}
    segreto = d.get("secret")
    if d.get("secret_dpapi"):
        chiaro = _dpapi(base64.b64decode(d["secret_dpapi"]), False)
        segreto = chiaro.decode("utf-8") if chiaro else None
    if not d.get("api_key") or not segreto:
        return None
    amb = d.get("ambiente") if d.get("ambiente") in AMBIENTI else "reale"
    return {"api_key": d["api_key"], "api_secret": segreto, "ambiente": amb}


# ----------------------------------------------------------------------------- client
class Client:
    def __init__(self, api_key: str, api_secret: str, ambiente: str):
        self.api_key = api_key
        try:
            self.segreto = base64.b64decode(api_secret)
        except Exception:
            raise KrakenErrore("la Private Key non e' valida (deve essere quella lunga, copiata per intero)")
        self.ambiente = ambiente if ambiente in AMBIENTI else "reale"
        self.base = AMBIENTI[self.ambiente]
        self._nonce = 0
        self._strumenti = None
        self._strumenti_at = 0

    def _firma(self, dati: str, nonce: str, percorso: str) -> str:
        h = hashlib.sha256((dati + nonce + percorso).encode("utf-8")).digest()
        return base64.b64encode(hmac.new(self.segreto, h, hashlib.sha512).digest()).decode("ascii")

    def chiama(self, metodo: str, percorso: str, params: Optional[dict] = None, privata: bool = True):
        params = {k: v for k, v in (params or {}).items() if v is not None}
        dati = urllib.parse.urlencode(params)
        url = self.base + PREFISSO + percorso
        corpo = None
        if metodo == "GET":
            if dati:
                url += "?" + dati
        else:
            corpo = dati.encode("utf-8")
        req = urllib.request.Request(url, data=corpo, method=metodo)
        req.add_header("Accept", "application/json")
        if corpo is not None:
            req.add_header("Content-Type", "application/x-www-form-urlencoded")
        if privata:
            self._nonce = max(self._nonce + 1, int(time.time() * 1000))
            nonce = str(self._nonce)
            req.add_header("APIKey", self.api_key)
            req.add_header("Nonce", nonce)
            req.add_header("Authent", self._firma(dati, nonce, percorso))
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                j = json.loads(r.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as e:
            testo = e.read().decode("utf-8", "replace")
            try:
                j = json.loads(testo)
            except ValueError:
                raise KrakenErrore(testo[:200] or str(e), e.code)
            raise KrakenErrore(str(j.get("error") or j.get("errors") or testo[:200]), e.code)
        except urllib.error.URLError as e:
            raise KrakenErrore("Kraken non raggiungibile: %s" % e.reason)
        if j.get("result") == "error":
            raise KrakenErrore(str(j.get("error") or j.get("errors") or "errore"))
        return j

    def strumento(self, simbolo: str) -> dict:
        if not self._strumenti or time.time() - self._strumenti_at > 3600:
            j = self.chiama("GET", "/api/v3/instruments", privata=False)
            self._strumenti = {s["symbol"].upper(): s for s in j.get("instruments", [])}
            self._strumenti_at = time.time()
        s = self._strumenti.get(simbolo.upper())
        if not s or s.get("tradeable") is False:
            raise KrakenErrore("contratto %s non disponibile su Kraken Futures" % simbolo)
        prec = s.get("contractValuePrecision")
        step = 10 ** -int(prec) if prec is not None else 1.0
        return {"tick": float(s.get("tickSize") or 0.5), "step": step, "min": step,
                "leva_max": float(s.get("maxLeverage") or 0) or None}


def _dec(passo: float) -> int:
    s = ("%.12f" % passo).rstrip("0")
    return len(s.split(".")[1]) if "." in s else 0


def _giu(v: float, passo: float) -> float:
    return round(math.floor(v / passo + 1e-9) * passo, _dec(passo))


def _vicino(v: float, passo: float) -> float:
    return round(round(v / passo) * passo, _dec(passo))


def simbolo_kraken(base: str) -> str:
    b = (base or "").upper()
    return "PF_%sUSD" % ALIAS.get(b, b)



# ----------------------------------------------------------------------------- conti di prova
def _leggi_conti() -> dict:
    try:
        with open(FILE_CONTI, encoding="utf-8") as f:
            d = json.load(f)
        if isinstance(d, dict) and isinstance(d.get("conti"), list):
            return d
    except Exception:
        pass
    # Prima volta: il conto unico di prima (simulato.json) diventa "Conto prova 1", con tutto dentro.
    d = {"attivo": None, "conti": []}
    if os.path.isfile(FILE_SIMULATO):
        os.makedirs(CARTELLA_CONTI, exist_ok=True)
        os.replace(FILE_SIMULATO, os.path.join(CARTELLA_CONTI, "conto-1.json"))
        d = {"attivo": "conto-1", "conti": [{"id": "conto-1", "nome": "Conto prova 1", "creato": time.time()}]}
        _scrivi_conti(d)
    return d


def _scrivi_conti(d: dict) -> None:
    os.makedirs(CARTELLA_CONTI, exist_ok=True)
    with open(FILE_CONTI + ".tmp", "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False)
    os.replace(FILE_CONTI + ".tmp", FILE_CONTI)


def _file_conto(cid: str) -> str:
    return os.path.join(CARTELLA_CONTI, re.sub(r"[^A-Za-z0-9_-]", "_", cid) + ".json")


def _conto_attivo() -> dict:
    """Il conto di prova attivo; se non ce n'e' nessuno se ne crea uno (Conto prova 1)."""
    d = _leggi_conti()
    voce = next((c for c in d["conti"] if c["id"] == d.get("attivo")), None) or (d["conti"][0] if d["conti"] else None)
    if voce is None:
        voce = {"id": "conto-1", "nome": "Conto prova 1", "creato": time.time()}
        d["conti"].append(voce)
    if d.get("attivo") != voce["id"] or not os.path.isfile(FILE_CONTI):
        d["attivo"] = voce["id"]
        _scrivi_conti(d)
    return voce


def _apri_conto_attivo() -> "SimKraken":
    voce = _conto_attivo()
    c = SimKraken(_file_conto(voce["id"]))
    c.conto_id, c.conto_nome = voce["id"], voce["nome"]
    return c


class SimKraken(_sim.Simulatore):
    """Il simulatore con gli errori di questo modulo (KrakenErrore), come il Client vero."""

    def chiama(self, *a, **k):
        try:
            return super().chiama(*a, **k)
        except _sim.ErroreSim as e:
            raise KrakenErrore(str(e))

    def strumento(self, simbolo):
        try:
            return super().strumento(simbolo)
        except _sim.ErroreSim as e:
            raise KrakenErrore(str(e))


_client = None


def _imposta_cliente(nuovo):
    global _client
    vecchio = _client
    _client = nuovo
    if isinstance(vecchio, SimKraken) and vecchio is not nuovo:
        vecchio.ferma()


def _cliente():
    if _client is None:
        k = _carica_chiavi()
        if not k:
            raise HTTPException(status_code=409, detail="Conto Kraken non collegato: scegli il conto simulato o inserisci le chiavi API (scheda Kraken, dal PC).")
        _imposta_cliente(_apri_conto_attivo() if k["ambiente"] == "simulato" else Client(k["api_key"], k["api_secret"], k["ambiente"]))
    return _client


def _errore_http(e: KrakenErrore):
    return HTTPException(status_code=502, detail="Kraken: %s" % e.messaggio)


def _solo_dal_pc(request: Request, cosa: str) -> None:
    if _accesso is not None and not _accesso.richiesta_locale(request):
        raise HTTPException(status_code=403, detail=cosa + " solo dal PC: le chiavi API non viaggiano in rete.")


def _conto(c: Client) -> dict:
    j = c.chiama("GET", "/api/v3/accounts")
    flex = (j.get("accounts") or {}).get("flex") or {}
    return {"saldo": float(flex.get("portfolioValue") or flex.get("balanceValue") or 0),
            "disponibile": float(flex.get("availableMargin") or 0),
            "pnl_aperto": float(flex.get("totalUnrealized") or flex.get("pnl") or 0)}


def _posizione(c: Client, simbolo: str) -> float:
    for p in c.chiama("GET", "/api/v3/openpositions").get("openPositions", []):
        if p.get("symbol", "").upper() == simbolo.upper():
            q = float(p.get("size") or 0)
            return q if p.get("side") == "long" else -q
    return 0.0


def _ordini(c: Client, simbolo: Optional[str] = None) -> list:
    return [o for o in c.chiama("GET", "/api/v3/openorders").get("openOrders", [])
            if not simbolo or o.get("symbol", "").upper() == simbolo.upper()]


def _e_stop(o: dict) -> bool:
    return str(o.get("orderType", "")).lower() in ("stop", "stp")


RIFIUTI = {
    "insufficientAvailableFunds": " (margine insufficiente)",
    "accountBreached": " (conto prop violato: ricomincia il conto simulato)",
    "wouldNotReducePosition": " (nessuna posizione da ridurre)",
    "wouldExecuteImmediately": " (stop gia' oltre il prezzo)",
    "marketSuspended": " (mercato sospeso o prezzo non disponibile)",
}


def _invia(c: Client, **p) -> dict:
    j = c.chiama("POST", "/api/v3/sendorder", p)
    st = j.get("sendStatus") or {}
    if st.get("status") not in ("placed", "edited", None):
        raise KrakenErrore("ordine rifiutato: %s%s" % (st.get("status"), RIFIUTI.get(st.get("status"), "")))
    return st


def _stop(c: Client, simbolo: str, lato_chiusura: str, prezzo: float, quantita: float, info: dict,
          cli: Optional[str] = None) -> dict:
    # cli: etichetta del segnale (fbl_<gruppo>_sl) - serve all'app per attribuire la chiusura allo
    # stesso segnale e scriverla nel Trade Journal.
    extra = {"cliOrdId": cli[:100]} if cli else {}
    st = _invia(c, orderType="stp", symbol=simbolo, side=lato_chiusura, size=quantita,
                stopPrice=_vicino(prezzo, info["tick"]), triggerSignal="mark", reduceOnly="true", **extra)
    return {"id": st.get("order_id"), "prezzo": _vicino(prezzo, info["tick"])}


def _chiudi_tutto(c: Client, simbolo: str) -> dict:
    try:
        c.chiama("POST", "/api/v3/cancelallorders", {"symbol": simbolo})
    except KrakenErrore:
        pass
    q = _posizione(c, simbolo)
    if q == 0:
        return {"chiusa": False, "quantita": 0}
    st = _invia(c, orderType="mkt", symbol=simbolo, side="sell" if q > 0 else "buy", size=abs(q), reduceOnly="true")
    return {"chiusa": True, "quantita": abs(q), "ordine": st.get("order_id")}


class Configura(BaseModel):
    ambiente: str = "simulato"
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    # solo simulato: cosa fare se esiste gia' un conto simulato (False = riprende quello)
    nuovo: bool = False
    saldo_iniziale: Optional[float] = None
    prop_piano: Optional[str] = None     # starter / intermediate / advanced / lite (None = conto libero)
    leva: Optional[float] = None


class Segnale(BaseModel):
    simbolo: str                 # PF_XBTUSD (o la moneta: BTC)
    lato: str                    # BUY / SELL
    quantita_per_tp: float       # quantita' di ogni quota, in monete
    tp: List[float]
    sl: float
    gruppo: Optional[str] = None


class SpostaSl(BaseModel):
    simbolo: str
    sl: float
    stop_id: Optional[str] = None      # lo stop del segnale da sostituire (senza: tutti gli stop)
    quantita: Optional[float] = None   # quantita' rimasta del segnale (senza: tutta la posizione)
    lato: Optional[str] = None         # BUY/SELL del segnale (serve se la posizione e' gia' a zero)
    gruppo: Optional[str] = None       # il segnale: lo stop nuovo porta la sua etichetta (Trade Journal)


class Annulla(BaseModel):
    ids: List[str]


class Chiudi(BaseModel):
    simbolo: str


def _norm(simbolo: str) -> str:
    s = simbolo.upper()
    return s if s.startswith(("PF_", "PI_", "FF_", "FI_")) else simbolo_kraken(s.replace("USDT", "").replace("USD", ""))


def _nuovo_simulato(c: "SimKraken", corpo) -> None:
    saldo = float(corpo.saldo_iniziale or 10000)
    if corpo.prop_piano:
        if corpo.prop_piano not in _sim.PIANI_PROP:
            raise HTTPException(status_code=400, detail="piano prop sconosciuto: %s" % corpo.prop_piano)
        if saldo not in _sim.CAPITALI_PROP:
            raise HTTPException(status_code=400, detail="capitale prop non previsto da Kraken: %s" % saldo)
        c.azzera(saldo, float(corpo.leva or 10), {"piano": corpo.prop_piano, "leva": float(corpo.leva or 10)})
    else:
        if saldo < 100 or saldo > 10_000_000:
            raise HTTPException(status_code=400, detail="saldo iniziale fuori misura")
        c.azzera(saldo, float(corpo.leva or 2))


@router.post("/configura")
def configura(corpo: Configura, request: Request):
    """Conto simulato (nessuna chiave) oppure chiavi del conto reale, salvate DOPO averle provate
    (queste solo dal PC)."""
    if corpo.ambiente == "simulato":
        with _lock:
            nuovo_file = not os.path.isfile(_file_conto(_conto_attivo()["id"]))
            c = _client if isinstance(_client, SimKraken) else _apri_conto_attivo()
            if corpo.nuovo or nuovo_file:
                _nuovo_simulato(c, corpo)
            _salva_simulato()
            _imposta_cliente(c)
        try:
            return {"ok": True, "ambiente": "simulato", **_conto(c)}
        except KrakenErrore as e:
            return {"ok": True, "ambiente": "simulato", "avviso": e.messaggio}
    _solo_dal_pc(request, "Le chiavi si inseriscono")
    if not (corpo.api_key or "").strip() or not (corpo.api_secret or "").strip():
        raise HTTPException(status_code=400, detail="servono Public Key e Private Key")
    amb = corpo.ambiente if corpo.ambiente in AMBIENTI else "reale"
    try:
        c = Client(corpo.api_key.strip(), corpo.api_secret.strip(), amb)
        conto = _conto(c)
    except KrakenErrore as e:
        raise _errore_http(e)
    with _lock:
        _salva_chiavi(corpo.api_key.strip(), corpo.api_secret.strip(), amb)
        _imposta_cliente(c)
    return {"ok": True, "ambiente": amb, **conto}


class NuovoConto(BaseModel):
    nome: Optional[str] = None
    saldo_iniziale: Optional[float] = None
    prop_piano: Optional[str] = None
    leva: Optional[float] = None


class SceltaConto(BaseModel):
    id: str
    nome: Optional[str] = None


def _riassunto_conto(voce: dict, attivo: bool) -> dict:
    r = {"id": voce["id"], "nome": voce["nome"], "creato": voce.get("creato"), "attivo": attivo}
    try:
        with open(_file_conto(voce["id"]), encoding="utf-8") as f:
            st = json.load(f)
        r.update({"saldo": st.get("saldo"), "saldo_iniziale": st.get("saldo_iniziale"),
                  "posizioni": len(st.get("posizioni") or {}),
                  "prop": (st.get("prop") or {}).get("piano") if st.get("prop") else None})
    except Exception:
        pass
    return r


@router.get("/conti")
def conti():
    """I conti di prova salvati sul PC (con quello attivo)."""
    with _lock:
        d = _leggi_conti()
        att = d.get("attivo")
        return {"ok": True, "attivo": att, "conti": [_riassunto_conto(c, c["id"] == att) for c in d["conti"]]}


def _passa_a(cid: str) -> "SimKraken":
    d = _leggi_conti()
    if not any(c["id"] == cid for c in d["conti"]):
        raise HTTPException(status_code=404, detail="conto di prova non trovato")
    d["attivo"] = cid
    _scrivi_conti(d)
    _salva_simulato()
    c = _apri_conto_attivo()
    _imposta_cliente(c)
    return c


@router.post("/conti/nuovo")
def conto_nuovo(corpo: NuovoConto):
    with _lock:
        d = _leggi_conti()
        n = 1
        while any(c["id"] == "conto-%d" % n for c in d["conti"]) or os.path.exists(_file_conto("conto-%d" % n)):
            n += 1
        voce = {"id": "conto-%d" % n, "nome": (corpo.nome or "").strip()[:40] or "Conto prova %d" % n, "creato": time.time()}
        d["conti"].append(voce)
        _scrivi_conti(d)
        c = _passa_a(voce["id"])
        _nuovo_simulato(c, Configura(ambiente="simulato", nuovo=True, saldo_iniziale=corpo.saldo_iniziale,
                                     prop_piano=corpo.prop_piano, leva=corpo.leva))
    return {"ok": True, "conto": _riassunto_conto(voce, True)}


@router.post("/conti/scegli")
def conto_scegli(corpo: SceltaConto):
    with _lock:
        _passa_a(corpo.id)
    return conti()


@router.post("/conti/rinomina")
def conto_rinomina(corpo: SceltaConto):
    with _lock:
        d = _leggi_conti()
        for c in d["conti"]:
            if c["id"] == corpo.id:
                c["nome"] = (corpo.nome or "").strip()[:40] or c["nome"]
        _scrivi_conti(d)
        if isinstance(_client, SimKraken) and getattr(_client, "conto_id", None) == corpo.id:
            _client.conto_nome = next(c["nome"] for c in d["conti"] if c["id"] == corpo.id)
    return conti()


@router.post("/conti/elimina")
def conto_elimina(corpo: SceltaConto):
    with _lock:
        d = _leggi_conti()
        if len(d["conti"]) <= 1:
            raise HTTPException(status_code=409, detail="e' l'unico conto di prova: creane un altro prima di eliminarlo")
        d["conti"] = [c for c in d["conti"] if c["id"] != corpo.id]
        era_attivo = d.get("attivo") == corpo.id
        if era_attivo:
            d["attivo"] = d["conti"][0]["id"]
        _scrivi_conti(d)
        if era_attivo:
            _passa_a(d["attivo"])
        try:
            os.replace(_file_conto(corpo.id), _file_conto(corpo.id) + ".eliminato")
        except OSError:
            pass
    return conti()


@router.post("/azzera")
def azzera(corpo: Configura):
    """Ricomincia il conto simulato (anche come nuova valutazione prop)."""
    c = _cliente()
    if not isinstance(c, SimKraken):
        raise HTTPException(status_code=409, detail="il conto collegato e' quello REALE: non si azzera")
    with _lock:
        _nuovo_simulato(c, corpo)
    return {"ok": True, **c.riepilogo()}


@router.get("/storico")
def storico(n: int = 50):
    c = _cliente()
    if not isinstance(c, SimKraken):
        return {"supportato": False, "operazioni": []}
    return {"supportato": True, "operazioni": c.storico(max(1, min(500, n)))}


@router.post("/scollega")
def scollega(request: Request):
    k = _carica_chiavi()
    if k and k["ambiente"] != "simulato":
        _solo_dal_pc(request, "Il conto si scollega")
    with _lock:
        _imposta_cliente(None)
        try:
            os.remove(FILE_CHIAVI)
        except FileNotFoundError:
            pass
    return {"ok": True}


@router.get("/stato")
def stato():
    k = _carica_chiavi()
    if not k:
        return {"configurato": False}
    try:
        c = _cliente()
        if isinstance(c, SimKraken):
            r = c.riepilogo()
            return {"configurato": True, "collegato": True, "ambiente": "simulato", "chiave": None,
                    "leva": r["leva"], "simulazione": r, "conto_id": getattr(c, "conto_id", None),
                    "conto_nome": getattr(c, "conto_nome", None), **_conto(c)}
        return {"configurato": True, "collegato": True, "ambiente": c.ambiente,
                "chiave": k["api_key"][:6] + "…" + k["api_key"][-4:], **_conto(c)}
    except KrakenErrore as e:
        return {"configurato": True, "collegato": False, "ambiente": k["ambiente"], "errore": e.messaggio}


@router.get("/strumento/{base}")
def strumento(base: str):
    """Contratto perpetuo per una moneta (BTC -> PF_XBTUSD), con passo, tick e prezzo."""
    c = _cliente()
    s = simbolo_kraken(base)
    try:
        info = c.strumento(s)
        prezzo = None
        for t in c.chiama("GET", "/api/v3/tickers", privata=False).get("tickers", []):
            if t.get("symbol", "").upper() == s:
                prezzo = float(t.get("markPrice") or t.get("last") or 0) or None
        return {"simbolo": s, "prezzo": prezzo, **info}
    except KrakenErrore as e:
        raise _errore_http(e)


@router.get("/posizioni")
def posizioni():
    c = _cliente()
    try:
        pos = c.chiama("GET", "/api/v3/openpositions").get("openPositions", [])
        ordini = _ordini(c)
        prezzi = {t.get("symbol", "").upper(): float(t.get("markPrice") or t.get("last") or 0)
                  for t in c.chiama("GET", "/api/v3/tickers", privata=False).get("tickers", [])}
    except KrakenErrore as e:
        raise _errore_http(e)
    out = []
    for p in pos:
        s = p.get("symbol", "").upper()
        q = float(p.get("size") or 0)
        if q == 0:
            continue
        lato = "BUY" if p.get("side") == "long" else "SELL"
        entrata = float(p.get("price") or 0)
        mark = prezzi.get(s) or entrata
        tps = [{"id": o.get("order_id"), "prezzo": float(o.get("limitPrice") or 0),
                "quantita": float(o.get("unfilledSize") or 0), "client": o.get("cliOrdId")}
               for o in ordini if o.get("symbol", "").upper() == s and str(o.get("orderType", "")).lower() in ("lmt", "limit") and o.get("reduceOnly")]
        stops = [{"id": o.get("order_id"), "prezzo": float(o.get("stopPrice") or 0), "quantita": float(o.get("unfilledSize") or 0)}
                 for o in ordini if o.get("symbol", "").upper() == s and _e_stop(o)]
        stop = None
        for o in ordini:
            if o.get("symbol", "").upper() == s and _e_stop(o):
                stop = float(o.get("stopPrice") or 0)
        out.append({"simbolo": s, "lato": lato, "quantita": q, "entrata": entrata, "mark": mark,
                    "pnl": (mark - entrata) * q * (1 if lato == "BUY" else -1),
                    "tp": sorted(tps, key=lambda x: x["prezzo"]), "sl": stop, "stops": stops})
    # Tutti gli ordini aperti per numero: l'app riconosce quelli di ogni segnale.
    aperti = [o.get("order_id") for o in ordini]
    return {"posizioni": out, "ordini_aperti": aperti, "ora": int(time.time() * 1000)}


@router.post("/segnale")
def apri_segnale(corpo: Segnale):
    c = _cliente()
    with _lock:
        return _apri(c, corpo)


def _apri(c, corpo: Segnale) -> dict:
    """Apre un segnale (mercato + stop + take profit). Da chiamare con _lock preso."""
    s = _norm(corpo.simbolo)
    lato = corpo.lato.upper()
    if lato not in ("BUY", "SELL"):
        raise HTTPException(status_code=400, detail="lato deve essere BUY o SELL")
    apertura, chiusura = ("buy", "sell") if lato == "BUY" else ("sell", "buy")
    if True:
        try:
            attuale = _posizione(c, s)
            if (attuale > 0 and lato == "SELL") or (attuale < 0 and lato == "BUY"):
                raise HTTPException(status_code=409, detail="Su %s c'e' gia' una posizione %s: un segnale opposto la ridurrebbe invece di aprirne una sua." % (s, "LONG" if attuale > 0 else "SHORT"))
            info = c.strumento(s)
            n = max(1, len(corpo.tp))
            q1 = _giu(corpo.quantita_per_tp, info["step"])
            if q1 < info["min"] or q1 <= 0:
                raise HTTPException(status_code=400, detail="quantita' per take profit %s sotto il minimo di %s (%s)" % (corpo.quantita_per_tp, s, info["min"]))
            totale = round(q1 * n, _dec(info["step"]))
            etichetta = ("fbl_" + (corpo.gruppo or str(int(time.time()))))[:40]
            st = _invia(c, orderType="mkt", symbol=s, side=apertura, size=totale, cliOrdId=etichetta + "_in")
            entrata = None
            for ev in st.get("orderEvents") or []:
                if ev.get("type") == "EXECUTION" and ev.get("price"):
                    entrata = float(ev["price"])
            try:
                stop = _stop(c, s, chiusura, corpo.sl, totale, info, etichetta + "_sl")
            except KrakenErrore as e:
                # Si chiude SOLO la quota di questo segnale: gli altri segnali sullo stesso simbolo restano.
                try:
                    _invia(c, orderType="mkt", symbol=s, side=chiusura, size=totale, reduceOnly="true")
                    esito = "chiusa"
                except KrakenErrore as e2:
                    esito = "CHIUSURA NON RIUSCITA: %s - chiudi a mano!" % e2.messaggio
                raise HTTPException(status_code=502, detail="Stop loss rifiutato da Kraken (%s): quota del segnale chiusa subito per sicurezza (%s)." % (e.messaggio, esito))
            tp_ordini, tp_errori = [], []
            for i, prezzo in enumerate(corpo.tp):
                q = q1 if i < n - 1 else round(totale - q1 * (n - 1), _dec(info["step"]))
                try:
                    o = _invia(c, orderType="lmt", symbol=s, side=chiusura, size=q, limitPrice=_vicino(prezzo, info["tick"]),
                               reduceOnly="true", cliOrdId="%s_tp%d" % (etichetta, i + 1))
                    tp_ordini.append({"indice": i + 1, "id": o.get("order_id"), "prezzo": _vicino(prezzo, info["tick"]), "quantita": q})
                except KrakenErrore as e:
                    tp_errori.append("TP%d: %s" % (i + 1, e.messaggio))
            return {"ok": True, "simbolo": s, "lato": lato, "quantita": totale, "entrata": entrata,
                    "sl": stop, "tp": tp_ordini, "tp_errori": tp_errori}
        except KrakenErrore as e:
            raise _errore_http(e)


# ----------------------------------------------------------------------------- ordini pendenti
# RICHIESTO: "eseguire gli ordini pendenti dalla barra ordini del grafico" anche sul conto Kraken.
# Kraken non lega stop e take profit a un ordine d'entrata in attesa, quindi l'ordine pendente lo
# tiene QUI il ponte (file pendenti.json, per conto): ogni 2 secondi guarda il prezzo mark e, quando
# l'entrata e' raggiunta, apre il segnale come /segnale (mercato + stop + take profit). Funziona ad
# app chiusa, finche' il programma sul PC e' acceso. Si controllano solo i pendenti del conto
# collegato in quel momento: quelli di un altro conto di prova aspettano che torni attivo.
#   LIMIT BUY  scatta a prezzo <= entrata     LIMIT SELL scatta a prezzo >= entrata
#   STOP  BUY  scatta a prezzo >= entrata     STOP  SELL scatta a prezzo <= entrata
FILE_PENDENTI = os.path.join(CARTELLA, "pendenti.json")
_lock_pend = threading.Lock()
TENUTA_ESEGUITI = 7 * 86400


class Pendente(BaseModel):
    simbolo: str
    lato: str                 # BUY / SELL
    tipo: str = "LIMIT"       # LIMIT / STOP
    entrata: float
    sl: float
    tp: List[float] = []
    quantita: float           # totale, in monete
    gruppo: Optional[str] = None


class IdPendente(BaseModel):
    id: str


def _chiave_conto(c) -> str:
    return getattr(c, "conto_id", None) or "reale"


def _leggi_pendenti() -> dict:
    try:
        with open(FILE_PENDENTI, encoding="utf-8") as f:
            d = json.load(f)
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def _scrivi_pendenti(d: dict) -> None:
    os.makedirs(CARTELLA, exist_ok=True)
    with open(FILE_PENDENTI + ".tmp", "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False)
    os.replace(FILE_PENDENTI + ".tmp", FILE_PENDENTI)


def _scattato(o: dict, prezzo: float) -> bool:
    e = float(o["entrata"])
    if o["tipo"] == "STOP":
        return prezzo >= e if o["lato"] == "BUY" else prezzo <= e
    return prezzo <= e if o["lato"] == "BUY" else prezzo >= e


def _prezzi_mark(c) -> dict:
    return {t.get("symbol", "").upper(): float(t.get("markPrice") or t.get("last") or 0)
            for t in c.chiama("GET", "/api/v3/tickers", privata=False).get("tickers", [])}


def controlla_pendenti() -> int:
    """Un giro di controllo; restituisce quanti pendenti sono scattati."""
    if _client is None and not os.path.isfile(FILE_PENDENTI):
        return 0
    with _lock_pend:
        d = _leggi_pendenti()
    try:
        c = _cliente()
    except Exception:
        return 0
    chiave = _chiave_conto(c)
    voci = d.get(chiave) or []
    attesa = [o for o in voci if o.get("stato") == "attesa"]
    if not attesa:
        return 0
    try:
        prezzi = _prezzi_mark(c)
    except Exception:
        return 0
    fatti = 0
    for o in attesa:
        prezzo = prezzi.get(o["simbolo"])
        if not prezzo or not _scattato(o, prezzo):
            continue
        # Lo stop deve stare ancora dal lato giusto del prezzo: se il mercato e' saltato oltre lo
        # stop, aprire vorrebbe dire chiudere subito in perdita. Si annulla e lo si dice.
        if (o["lato"] == "BUY" and prezzo <= o["sl"]) or (o["lato"] == "SELL" and prezzo >= o["sl"]):
            o.update(stato="annullato", il=time.time(),
                     motivo="il prezzo (%s) e' gia' oltre lo stop loss (%s): non aperto" % (prezzo, o["sl"]))
            fatti += 1
            continue
        n = max(1, len(o.get("tp") or []))
        corpo = Segnale(simbolo=o["simbolo"], lato=o["lato"], quantita_per_tp=float(o["quantita"]) / n,
                        tp=list(o.get("tp") or []), sl=float(o["sl"]), gruppo=o.get("gruppo"))
        try:
            with _lock:
                r = _apri(c, corpo)
            o.update(stato="eseguito", il=time.time(), prezzo_scatto=prezzo, risultato=r)
        except HTTPException as e:
            o.update(stato="errore", il=time.time(), motivo=str(e.detail))
        except Exception as e:  # pragma: no cover
            o.update(stato="errore", il=time.time(), motivo=str(e))
        fatti += 1
    if fatti:
        with _lock_pend:
            d2 = _leggi_pendenti()
            per_id = {o["id"]: o for o in voci}
            d2[chiave] = [per_id.get(x["id"], x) if x.get("stato") == "attesa" else x for x in (d2.get(chiave) or [])]
            _scrivi_pendenti(d2)
    return fatti


def _giro_pendenti() -> None:
    while True:
        try:
            controlla_pendenti()
        except Exception:
            pass
        time.sleep(2)


threading.Thread(target=_giro_pendenti, name="kraken-pendenti", daemon=True).start()


@router.post("/pendente")
def nuovo_pendente(corpo: Pendente):
    c = _cliente()
    lato, tipo = corpo.lato.upper(), corpo.tipo.upper()
    if lato not in ("BUY", "SELL") or tipo not in ("LIMIT", "STOP"):
        raise HTTPException(status_code=400, detail="lato BUY/SELL e tipo LIMIT/STOP")
    if not (corpo.entrata > 0 and corpo.sl > 0 and corpo.quantita > 0):
        raise HTTPException(status_code=400, detail="entrata, stop loss e quantita' sono obbligatori")
    if (lato == "BUY" and corpo.sl >= corpo.entrata) or (lato == "SELL" and corpo.sl <= corpo.entrata):
        raise HTTPException(status_code=400, detail="lo stop loss e' dal lato sbagliato dell'entrata")
    for t in corpo.tp:
        if (lato == "BUY" and t <= corpo.entrata) or (lato == "SELL" and t >= corpo.entrata):
            raise HTTPException(status_code=400, detail="il take profit %s e' dal lato sbagliato dell'entrata" % t)
    s = _norm(corpo.simbolo)
    try:
        info = c.strumento(s)
    except KrakenErrore as e:
        raise _errore_http(e)
    n = max(1, len(corpo.tp))
    if _giu(corpo.quantita / n, info["step"]) < info["min"]:
        raise HTTPException(status_code=400, detail="quantita' %s sotto il minimo di %s (%s per take profit)" % (corpo.quantita, s, info["min"]))
    o = {"id": "pd%d%04d" % (int(time.time() * 1000), int.from_bytes(os.urandom(2), "big") % 10000), "simbolo": s, "lato": lato, "tipo": tipo,
         "entrata": _vicino(corpo.entrata, info["tick"]), "sl": _vicino(corpo.sl, info["tick"]),
         "tp": [_vicino(t, info["tick"]) for t in corpo.tp], "quantita": corpo.quantita,
         "gruppo": (corpo.gruppo or "")[:30] or None, "creato": time.time(), "stato": "attesa"}
    with _lock_pend:
        d = _leggi_pendenti()
        d.setdefault(_chiave_conto(c), []).append(o)
        _scrivi_pendenti(d)
    return {"ok": True, "pendente": o}


@router.get("/pendenti")
def pendenti():
    """In attesa + quelli scattati/annullati da poco (l'app li prende in carico e li conferma)."""
    c = _cliente()
    chiave = _chiave_conto(c)
    ora = time.time()
    with _lock_pend:
        d = _leggi_pendenti()
        voci = [o for o in (d.get(chiave) or []) if o.get("stato") == "attesa" or ora - float(o.get("il") or ora) < TENUTA_ESEGUITI]
        if len(voci) != len(d.get(chiave) or []):
            d[chiave] = voci
            _scrivi_pendenti(d)
    return {"ok": True, "conto": chiave, "pendenti": voci}


@router.post("/pendente/annulla")
def annulla_pendente(corpo: IdPendente):
    c = _cliente()
    with _lock_pend:
        d = _leggi_pendenti()
        voci = d.get(_chiave_conto(c)) or []
        o = next((x for x in voci if x["id"] == corpo.id), None)
        if not o:
            raise HTTPException(status_code=404, detail="ordine pendente non trovato")
        if o.get("stato") != "attesa":
            raise HTTPException(status_code=409, detail="l'ordine non e' piu' in attesa (%s)" % o.get("stato"))
        o.update(stato="annullato", il=time.time(), motivo="annullato da te", preso=True)
        _scrivi_pendenti(d)
    return {"ok": True}


@router.post("/pendente/preso")
def pendente_preso(corpo: IdPendente):
    """L'app ha preso in carico un pendente scattato (lo segue lei da qui): non lo ripropone."""
    c = _cliente()
    with _lock_pend:
        d = _leggi_pendenti()
        for o in d.get(_chiave_conto(c)) or []:
            if o["id"] == corpo.id:
                o["preso"] = True
        _scrivi_pendenti(d)
    return {"ok": True}


@router.post("/sl")
def sposta_sl(corpo: SpostaSl):
    c = _cliente()
    s = _norm(corpo.simbolo)
    with _lock:
        try:
            q = _posizione(c, s)
            if q == 0:
                raise HTTPException(status_code=409, detail="nessuna posizione aperta su %s" % s)
            info = c.strumento(s)
            if corpo.stop_id:
                vecchi = [corpo.stop_id]
            else:
                vecchi = [o.get("order_id") for o in _ordini(c, s) if _e_stop(o)]
            quantita = _giu(abs(corpo.quantita), info["step"]) if corpo.quantita else abs(q)
            quantita = min(quantita, abs(q))
            if quantita <= 0:
                raise HTTPException(status_code=400, detail="quantita' dello stop nulla")
            cli_sl = (("fbl_" + corpo.gruppo)[:40] + "_sl") if corpo.gruppo else None
            nuovo = _stop(c, s, "sell" if q > 0 else "buy", corpo.sl, quantita, info, cli_sl)   # prima il nuovo, poi via i vecchi
            for o in vecchi:
                if o != nuovo.get("id"):
                    try:
                        c.chiama("POST", "/api/v3/cancelorder", {"order_id": o})
                    except KrakenErrore:
                        pass
            return {"ok": True, "sl": nuovo}
        except KrakenErrore as e:
            raise _errore_http(e)


@router.post("/annulla")
def annulla(corpo: Annulla):
    """Toglie gli ordini indicati (i TP rimasti di un segnale il cui stop e' scattato, o lo stop di
    un segnale i cui TP sono stati tutti eseguiti)."""
    c = _cliente()
    fatti, errori = [], []
    with _lock:
        for i in corpo.ids or []:
            try:
                c.chiama("POST", "/api/v3/cancelorder", {"order_id": i})
                fatti.append(i)
            except KrakenErrore as e:
                errori.append("%s: %s" % (i, e.messaggio))
    return {"ok": not errori, "annullati": fatti, "errori": errori}


@router.post("/chiudi")
def chiudi(corpo: Chiudi):
    c = _cliente()
    with _lock:
        try:
            return {"ok": True, **_chiudi_tutto(c, _norm(corpo.simbolo))}
        except KrakenErrore as e:
            raise _errore_http(e)
