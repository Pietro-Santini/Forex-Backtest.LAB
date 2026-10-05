"""Registratore sul PC - Forex Backtest LAB.

RICHIESTO ("la registrazione deve continuare anche ad app chiusa: deve essere impeccabile"): il
browser registra footprint e heatmap solo finche' l'app e' aperta. Questo modulo gira dentro il
servizio dati (mt5_feed_server.py, porta 8001), che resta acceso sul PC anche quando l'app e'
chiusa, e registra per gli asset della WATCHLIST (l'elenco lo manda l'app):

  - CRIPTO, trade veri (Binance Futures, stream aggTrade): prezzo, volume e lato dell'aggressore
    (m=true -> il compratore era maker -> vendita aggressiva). Uniti come fa l'app: trade
    consecutivi allo stesso prezzo, nello stesso secondo e dallo stesso lato in una riga sola.
  - CRIPTO, book (Binance spot, la stessa fonte della heatmap dell'app): book locale tenuto
    aggiornato con lo snapshot REST + gli aggiornamenti @100ms (procedura ufficiale Binance), e
    ogni 5 s una fotografia dei livelli entro +/- range% dal prezzo medio. Con la fotografia si
    salva anche lo scarto fra il prezzo dei futures (quello del grafico) e il medio dello spot,
    che l'app usa per allineare i livelli al grafico, come fa gia' dal vivo.
  - MT5, book (DOM) dei simboli del broker, dove il broker lo pubblica: una fotografia al secondo
    quando cambia.

I TICK MT5 non si registrano: il broker li conserva gia' e l'app li riprende da /ticks per i
periodi in cui era chiusa.

ACCESO E SPENTO DALL'UTENTE (RICHIESTO: "le registrazioni giorno per giorno, illimitate: decido io
quando interromperle", Impostazioni del grafico -> Registrazione): registra solo quando "registrazione"
e' vera nella configurazione, al massimo 10 asset (quelli della watchlist), e NON cancella mai
niente da solo. Si cancella un giorno solo a mano (elimina_giorno). Anche i TICK MT5 si registrano
(TickMt5): lo storico del broker dopo qualche settimana li perde, l'archivio no.

File (testo semplice, uno per giorno UTC):
  %APPDATA%\\ForexBacktestLAB\\registratore\\trade\\<asset>\\AAAA-MM-GG.csv   t_ms,prezzo,volume,lato
  %APPDATA%\\ForexBacktestLAB\\registratore\\book\\<chiave>\\AAAA-MM-GG.jsonl {"t":..,"b":[p,v,..],"a":[..],"off":..}

Niente ordini, niente chiavi: solo dati pubblici di mercato e il book del terminale MT5.
"""
import asyncio
import json
import math
import os
import re
import shutil
import threading
import time
import urllib.request
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional

CARTELLA_PREDEFINITA = os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), "ForexBacktestLAB", "registratore")
# RICHIESTO: "collega cartella di destinazione". La cartella scelta si ricorda in un file accanto a
# quella predefinita (che resta il punto fisso da cui ritrovarla a ogni avvio).
FILE_DESTINAZIONE = os.path.join(os.path.dirname(CARTELLA_PREDEFINITA), "registratore_cartella.txt")
CARTELLA = CARTELLA_PREDEFINITA
try:
    with open(FILE_DESTINAZIONE, encoding="utf-8") as _f:
        _scelta = _f.read().strip()
    if _scelta and os.path.isabs(_scelta):
        CARTELLA = _scelta
except OSError:
    pass
if os.environ.get("FBL_REGISTRATORE_CARTELLA"):
    CARTELLA = os.environ["FBL_REGISTRATORE_CARTELLA"]
FILE_CONFIG = os.path.join(CARTELLA, "config.json")
MAX_ASSET = 10                 # come la watchlist
FILE_INDICE = None             # vedi _file_indice(): nome vero degli asset e dei book di ogni cartella
FUTURES_WS = os.environ.get("FBL_REG_FUTURES_WS") or "wss://fstream.binance.com"
SPOT_WS = [u for u in (os.environ.get("FBL_REG_SPOT_WS") or "wss://stream.binance.com:9443|wss://data-stream.binance.vision").split("|") if u]
SPOT_REST = [u for u in (os.environ.get("FBL_REG_SPOT_REST") or "https://api.binance.com|https://data-api.binance.vision").split("|") if u]
BOOK_OGNI_S = 5.0
MT5_BOOK_OGNI_S = 1.0
MAX_RIGHE_RISPOSTA = 400000

STATO: Dict = {"attivo": False, "avviato": None, "cripto": {}, "mt5": {}, "errori": [], "config_at": None}
_lock_file = threading.Lock()


def _sicuro(nome: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "_", nome or "")[:80] or "_"


def _giorno(t_ms: float) -> str:
    return datetime.fromtimestamp(t_ms / 1000.0, tz=timezone.utc).strftime("%Y-%m-%d")


def _errore(msg: str) -> None:
    STATO["errori"].append({"t": int(time.time() * 1000), "msg": msg})
    STATO["errori"] = STATO["errori"][-30:]


def _scrivi_righe(sotto: str, nome: str, righe: List[tuple]) -> None:
    """righe = [(t_ms, testo_riga)]: ogni riga nel file del suo giorno."""
    if not righe:
        return
    per_giorno: Dict[str, List[str]] = {}
    for t, testo in righe:
        per_giorno.setdefault(_giorno(t), []).append(testo)
    cartella = os.path.join(CARTELLA, sotto, _sicuro(nome))
    with _lock_file:
        os.makedirs(cartella, exist_ok=True)
        for g, lista in per_giorno.items():
            with open(os.path.join(cartella, g + (".csv" if sotto == "trade" else ".jsonl")), "a", encoding="utf-8") as f:
                f.write("\n".join(lista) + "\n")


def _file_nel_periodo(sotto: str, nome: str, da_ms: float, a_ms: float) -> List[str]:
    cartella = os.path.join(CARTELLA, sotto, _sicuro(nome))
    if not os.path.isdir(cartella):
        return []
    g0, g1 = _giorno(da_ms), _giorno(a_ms)
    out = []
    for f in sorted(os.listdir(cartella)):
        g = f.split(".")[0]
        if g0 <= g <= g1:
            out.append(os.path.join(cartella, f))
    return out


def leggi_trade(asset: str, da_ms: float, a_ms: float) -> List[list]:
    out = []
    for p in _file_nel_periodo("trade", asset, da_ms, a_ms):
        with _lock_file:
            try:
                righe = open(p, encoding="utf-8").read().splitlines()
            except OSError:
                continue
        for r in righe:
            parti = r.split(",")
            if len(parti) < 4:
                continue
            try:
                t = float(parti[0])
                if da_ms <= t <= a_ms:
                    out.append([t, float(parti[1]), float(parti[2]), int(parti[3])])
            except ValueError:
                continue
            if len(out) >= MAX_RIGHE_RISPOSTA:
                return out
    out.sort(key=lambda x: x[0])
    return out


def leggi_book(chiave: str, da_ms: float, a_ms: float) -> List[dict]:
    out = []
    for p in _file_nel_periodo("book", chiave, da_ms, a_ms):
        with _lock_file:
            try:
                righe = open(p, encoding="utf-8").read().splitlines()
            except OSError:
                continue
        for r in righe:
            try:
                s = json.loads(r)
            except ValueError:
                continue
            if da_ms <= s.get("t", 0) <= a_ms:
                out.append(s)
    out.sort(key=lambda x: x["t"])
    return out


def _file_indice() -> str:
    return os.path.join(CARTELLA, "indice.json")


def carica_indice() -> dict:
    try:
        with open(_file_indice(), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"asset": {}, "book": {}}


def aggiorna_indice(cfg: dict) -> None:
    """Cartella -> asset vero (i nomi delle cartelle sono 'puliti') e chiave del book -> asset."""
    ind = carica_indice()
    for a in cfg.get("assets") or []:
        ind["asset"][_sicuro(a["asset"])] = {"asset": a["asset"], "tipo": "cripto" if a["tipo"] == "cripto" else ("mt5" if a["tipo"] == "mt5" else ind["asset"].get(_sicuro(a["asset"]), {}).get("tipo", "book")),
                                            "simbolo": a.get("simbolo") or ind["asset"].get(_sicuro(a["asset"]), {}).get("simbolo", "")}
        if a.get("book"):
            ind["book"][_sicuro("bn:" + a["book"])] = a["asset"]
            ind["asset"][_sicuro(a["asset"])]["book"] = a["book"]
        if a["tipo"] == "mt5" and a.get("simbolo"):
            ind["book"][_sicuro(a["simbolo"])] = a["asset"]
    os.makedirs(CARTELLA, exist_ok=True)
    with open(_file_indice() + ".tmp", "w", encoding="utf-8") as f:
        json.dump(ind, f)
    os.replace(_file_indice() + ".tmp", _file_indice())


def elenco_giorni() -> dict:
    """{asset: {tipo, simbolo, book, giorni:{AAAA-MM-GG:{trade_byte, book_byte}}}} da quello che c'e' sul disco."""
    ind = carica_indice()
    out: Dict[str, dict] = {}

    def voce(asset: str) -> dict:
        info = next((v for v in ind["asset"].values() if v.get("asset") == asset), {})
        return out.setdefault(asset, {"tipo": info.get("tipo", ""), "simbolo": info.get("simbolo", ""), "book": info.get("book", ""), "giorni": {}})
    for sotto in ("trade", "book"):
        base = os.path.join(CARTELLA, sotto)
        if not os.path.isdir(base):
            continue
        for cartella in os.listdir(base):
            if sotto == "trade":
                asset = (ind["asset"].get(cartella) or {}).get("asset") or cartella
            else:
                asset = ind["book"].get(cartella) or cartella
            cd = os.path.join(base, cartella)
            for f in os.listdir(cd) if os.path.isdir(cd) else []:
                g = f.split(".")[0]
                try:
                    dim = os.path.getsize(os.path.join(cd, f))
                except OSError:
                    continue
                d = voce(asset)["giorni"].setdefault(g, {"trade_byte": 0, "book_byte": 0})
                d["trade_byte" if sotto == "trade" else "book_byte"] += dim
    return out


def elimina_giorno(asset: str, giorno: str) -> int:
    """Cancella a mano un giorno di un asset (trade e book). Restituisce i file cancellati."""
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", giorno or ""):
        return 0
    ind = carica_indice()
    cartelle = [("trade", _sicuro(asset))] + [("book", k) for k, v in ind["book"].items() if v == asset]
    n = 0
    with _lock_file:
        for sotto, c in cartelle:
            for est in (".csv", ".jsonl"):
                p = os.path.join(CARTELLA, sotto, c, giorno + est)
                if os.path.isfile(p):
                    os.remove(p)
                    n += 1
    return n


def pulisci_vecchi() -> None:
    """Non piu' usata: la registrazione e' illimitata, si cancella solo a mano (elimina_giorno)."""
    return


# ----------------------------------------------------------------------------- configurazione
def carica_config() -> dict:
    try:
        with open(FILE_CONFIG, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"assets": [], "range_pct": 1.0, "registrazione": False}


def salva_config(cfg: dict) -> dict:
    """cfg = {"assets":[{"asset","tipo":"cripto"|"mt5","simbolo","book"?}], "range_pct"}"""
    puliti = []
    for a in cfg.get("assets") or []:
        if not isinstance(a, dict) or not a.get("asset") or a.get("tipo") not in ("cripto", "mt5", "book"):
            continue
        puliti.append({"asset": str(a["asset"])[:80], "tipo": a["tipo"], "simbolo": str(a.get("simbolo") or "")[:40].upper(),
                       "book": str(a.get("book") or "")[:40].upper()})
    # Tetto: al massimo MAX_ASSET asset diversi (un asset puo' avere piu' voci: trade, book, MT5).
    scelti, tenuti = [], []
    for a in puliti:
        if a["asset"] not in scelti:
            if len(scelti) >= MAX_ASSET:
                continue
            scelti.append(a["asset"])
        tenuti.append(a)
    nuovo = {"assets": tenuti, "range_pct": max(0.1, min(20.0, float(cfg.get("range_pct") or 1.0))),
             "registrazione": bool(cfg.get("registrazione")), "aggiornato": int(time.time() * 1000)}
    os.makedirs(CARTELLA, exist_ok=True)
    with open(FILE_CONFIG + ".tmp", "w", encoding="utf-8") as f:
        json.dump(nuovo, f)
    os.replace(FILE_CONFIG + ".tmp", FILE_CONFIG)
    STATO["config_at"] = nuovo["aggiornato"]
    try:
        aggiorna_indice(nuovo)
    except Exception as e:
        _errore("indice: %s" % e)
    return nuovo


def _http_json(url: str, timeout: float = 15):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _nice(v: float) -> float:
    if not v > 0:
        return v
    e = 10 ** math.floor(math.log10(v))
    m = v / e
    return (1 if m <= 1 else 2 if m <= 2 else 5 if m <= 5 else 10) * e


# ----------------------------------------------------------------------------- cripto: trade
class TradeCripto:
    """Stream combinato aggTrade dei futures per tutti gli asset cripto in watchlist."""

    def __init__(self):
        self.mappa: Dict[str, str] = {}      # simbolo minuscolo -> asset
        self.buffer: Dict[str, List[list]] = {}
        self.ultimo_prezzo: Dict[str, float] = {}   # simbolo maiuscolo -> ultimo prezzo futures
        self.chiave = ""

    def imposta(self, mappa: Dict[str, str]) -> None:
        self.mappa = mappa

    def _aggiungi(self, asset: str, t: float, p: float, q: float, lato: int) -> None:
        b = self.buffer.setdefault(asset, [])
        if b and b[-1][1] == p and b[-1][3] == lato and int(b[-1][0] // 1000) == int(t // 1000):
            b[-1][2] += q
            return
        b.append([t, p, q, lato])

    def svuota(self) -> None:
        secondo_ora = int(time.time())
        for asset, b in list(self.buffer.items()):
            if not b:
                continue
            # L'ultima riga puo' ancora crescere solo finche' il suo secondo non e' finito.
            if int(b[-1][0] // 1000) < secondo_ora:
                pronti, self.buffer[asset] = b, []
            else:
                pronti, self.buffer[asset] = b[:-1], b[-1:]
            if not pronti:
                continue
            _scrivi_righe("trade", asset, [(r[0], "%d,%r,%r,%d" % (r[0], r[1], round(r[2], 10), r[3])) for r in pronti])
            st = STATO["cripto"].setdefault(asset, {})
            st["trade_scritti"] = st.get("trade_scritti", 0) + len(pronti)
            st["ultimo_trade"] = int(pronti[-1][0])

    def svuota_tutto(self) -> None:
        for asset, b in list(self.buffer.items()):
            if b:
                _scrivi_righe("trade", asset, [(r[0], "%d,%r,%r,%d" % (r[0], r[1], round(r[2], 10), r[3])) for r in b])
        self.buffer = {}

    async def gira(self, fermo: Callable[[], bool]) -> None:
        import websockets
        while not fermo():
            simboli = sorted(self.mappa)
            if not simboli:
                await asyncio.sleep(2)
                continue
            self.chiave = "/".join(simboli)
            url = FUTURES_WS + "/stream?streams=" + "/".join(s + "@aggTrade" for s in simboli)
            try:
                async with websockets.connect(url, ping_interval=20, ping_timeout=20, max_size=2 ** 22) as ws:
                    ultimo_flush = time.time()
                    while not fermo() and "/".join(sorted(self.mappa)) == self.chiave:
                        try:
                            msg = await asyncio.wait_for(ws.recv(), timeout=5)
                        except asyncio.TimeoutError:
                            msg = None
                        if msg:
                            try:
                                d = json.loads(msg).get("data") or {}
                            except ValueError:
                                d = {}
                            if d.get("e") == "aggTrade":
                                s = str(d.get("s") or "")
                                asset = self.mappa.get(s.lower())
                                try:
                                    p, q, t = float(d["p"]), float(d["q"]), float(d["T"])
                                except (KeyError, ValueError, TypeError):
                                    p = q = t = None
                                if asset and p and q and t:
                                    self.ultimo_prezzo[s.upper()] = p
                                    self._aggiungi(asset, t, p, q, -1 if d.get("m") else 1)
                        if time.time() - ultimo_flush >= 2:
                            ultimo_flush = time.time()
                            self.svuota()
            except asyncio.CancelledError:
                raise
            except Exception as e:
                _errore("trade cripto: %s" % e)
                await asyncio.sleep(5)
        self.svuota_tutto()


# ----------------------------------------------------------------------------- cripto: book
class BookSpot:
    """Book locale di un simbolo spot (procedura ufficiale Binance)."""

    def __init__(self, simbolo: str):
        self.simbolo = simbolo
        self.bids: Dict[float, float] = {}
        self.asks: Dict[float, float] = {}
        self.ultimo_id = 0
        self.sincronizzato = False
        self.buffer: List[dict] = []
        self.u_prec: Optional[int] = None

    def snapshot(self) -> None:
        errore = None
        for base in SPOT_REST:
            try:
                j = _http_json(base + "/api/v3/depth?symbol=%s&limit=5000" % self.simbolo)
                self.bids = {float(p): float(q) for p, q in j.get("bids", []) if float(q) > 0}
                self.asks = {float(p): float(q) for p, q in j.get("asks", []) if float(q) > 0}
                self.ultimo_id = int(j["lastUpdateId"])
                return
            except Exception as e:
                errore = e
        raise RuntimeError("snapshot book %s: %s" % (self.simbolo, errore))

    def applica(self, d: dict) -> bool:
        """False = sequenza rotta, serve un nuovo snapshot."""
        U, u = int(d["U"]), int(d["u"])
        if u <= self.ultimo_id:
            return True
        if self.u_prec is None:
            if not (U <= self.ultimo_id + 1 <= u):
                return False
        elif U != self.u_prec + 1:
            return False
        self.u_prec = u
        for lato, mappa in (("b", self.bids), ("a", self.asks)):
            for p, q in d.get(lato, []):
                p, q = float(p), float(q)
                if q == 0:
                    mappa.pop(p, None)
                else:
                    mappa[p] = q
        return True

    def fotografia(self, range_pct: float, prezzo_futures: Optional[float]) -> Optional[dict]:
        if not self.bids or not self.asks:
            return None
        bb, ba = max(self.bids), min(self.asks)
        mid = (bb + ba) / 2
        rng = mid * range_pct / 100.0
        # Stessa grana minima che usa l'app dal vivo (2*range/400): l'app poi raggruppa con la sua.
        passo = _nice(max(rng / 200.0, mid * 1e-7))
        out = {}
        for lato, mappa, lo, hi in (("b", self.bids, mid - rng, mid), ("a", self.asks, mid, mid + rng)):
            agg: Dict[float, float] = {}
            for p in list(mappa):
                if p < lo or p > hi:
                    if abs(p - mid) > rng * 3:
                        mappa.pop(p, None)       # potatura dei livelli lontanissimi, come l'app
                    continue
                k = round(round(p / passo) * passo, 10)
                agg[k] = agg.get(k, 0.0) + mappa[p]
            arr = []
            for k in sorted(agg):
                arr += [k, float("%.5g" % agg[k])]
            out[lato] = arr
        off = 0.0
        if prezzo_futures and abs(prezzo_futures - mid) / mid < 0.03:
            off = prezzo_futures - mid
        return {"t": int(time.time() * 1000), "b": out["b"], "a": out["a"], "off": round(off, 8), "passo": passo, "mid": mid}


class BookCripto:
    def __init__(self, trade: TradeCripto):
        self.trade = trade
        self.simboli: List[str] = []       # spot, maiuscoli
        self.range_pct = 1.0
        self.libri: Dict[str, BookSpot] = {}
        self.chiave = ""

    def imposta(self, simboli: List[str], range_pct: float) -> None:
        self.simboli = sorted(set(simboli))
        self.range_pct = range_pct

    async def _sincronizza(self, b: BookSpot) -> None:
        b.sincronizzato = False
        b.u_prec = None
        await asyncio.to_thread(b.snapshot)
        attesa, b.buffer = b.buffer, []
        for d in attesa:
            if not b.applica(d):
                raise RuntimeError("sequenza book %s rotta durante la sincronizzazione" % b.simbolo)
        b.sincronizzato = True

    async def gira(self, fermo: Callable[[], bool]) -> None:
        import websockets
        indice_url = 0
        while not fermo():
            if not self.simboli:
                await asyncio.sleep(2)
                continue
            self.chiave = "/".join(self.simboli)
            self.libri = {s: BookSpot(s) for s in self.simboli}
            url = SPOT_WS[indice_url % len(SPOT_WS)] + "/stream?streams=" + "/".join(s.lower() + "@depth@100ms" for s in self.simboli)
            try:
                async with websockets.connect(url, ping_interval=20, ping_timeout=20, max_size=2 ** 23) as ws:
                    da_sincronizzare = set(self.simboli)
                    ultima_foto = 0.0
                    while not fermo() and "/".join(sorted(set(self.simboli))) == self.chiave:
                        try:
                            msg = await asyncio.wait_for(ws.recv(), timeout=5)
                        except asyncio.TimeoutError:
                            msg = None
                        if msg:
                            try:
                                j = json.loads(msg)
                            except ValueError:
                                j = {}
                            d = j.get("data") or {}
                            s = str(d.get("s") or "").upper()
                            b = self.libri.get(s)
                            if b and d.get("e") == "depthUpdate":
                                if not b.sincronizzato:
                                    b.buffer.append(d)
                                    if len(b.buffer) > 5000:
                                        b.buffer = b.buffer[-5000:]
                                elif not b.applica(d):
                                    b.sincronizzato = False
                                    b.buffer = [d]
                                    da_sincronizzare.add(s)
                        # una sincronizzazione alla volta (lo snapshot da 5000 livelli pesa sui limiti di Binance)
                        for s in list(da_sincronizzare):
                            b = self.libri[s]
                            if b.buffer:
                                try:
                                    await self._sincronizza(b)
                                    da_sincronizzare.discard(s)
                                except Exception as e:
                                    _errore(str(e))
                                    b.buffer = b.buffer[-200:]
                                    await asyncio.sleep(2)
                            break
                        if time.time() - ultima_foto >= BOOK_OGNI_S:
                            ultima_foto = time.time()
                            for s, b in self.libri.items():
                                if not b.sincronizzato:
                                    continue
                                f = b.fotografia(self.range_pct, self.trade.ultimo_prezzo.get(s))
                                if f:
                                    _scrivi_righe("book", "bn:" + s, [(f["t"], json.dumps(f, separators=(",", ":")))])
                                    st = STATO["cripto"].setdefault("bn:" + s, {})
                                    st["book_scritti"] = st.get("book_scritti", 0) + 1
                                    st["ultimo_book"] = f["t"]
            except asyncio.CancelledError:
                raise
            except Exception as e:
                _errore("book cripto: %s" % e)
                indice_url += 1
                await asyncio.sleep(5)


# ----------------------------------------------------------------------------- MT5: book (DOM)
class BookMt5:
    def __init__(self, mt5_call: Callable, mt5_mod, risolvi: Callable, converti: Callable):
        self.call = mt5_call
        self.mt5 = mt5_mod
        self.risolvi = risolvi
        self.converti = converti
        self.simboli: List[str] = []
        self.non_disponibili: Dict[str, float] = {}
        self.aggiunti: set = set()
        self.firme: Dict[str, tuple] = {}

    def imposta(self, simboli: List[str]) -> None:
        self.simboli = sorted(set(simboli))

    def usa(self, simbolo: str) -> bool:
        return simbolo in self.aggiunti

    def giro(self) -> None:
        if not self.simboli:
            return
        if not self.call(self.mt5.initialize):
            return
        adesso = time.time()
        for s in self.simboli:
            if adesso - self.non_disponibili.get(s, 0) < 600:
                continue
            risolto = self.risolvi(s)
            if not risolto:
                self.non_disponibili[s] = adesso
                continue
            libro = self.call(self.mt5.market_book_get, risolto)
            if not libro:
                info = self.call(self.mt5.symbol_info, risolto)
                if info is not None and not info.visible:
                    self.call(self.mt5.symbol_select, risolto, True)
                if not self.call(self.mt5.market_book_add, risolto):
                    self.non_disponibili[s] = adesso
                    STATO["mt5"].setdefault(risolto, {})["book"] = "il broker non pubblica il DOM"
                    continue
                self.aggiunti.add(risolto)
                libro = self.call(self.mt5.market_book_get, risolto)
            if not libro:
                continue
            snap = self.converti(risolto, libro)
            firma = tuple((e["price"], e["volume"]) for e in snap["bids"]) + tuple((e["price"], e["volume"]) for e in snap["asks"])
            if firma == self.firme.get(risolto):
                continue
            self.firme[risolto] = firma
            riga = {"t": int(snap["time_ms"]), "bids": snap["bids"], "asks": snap["asks"]}
            _scrivi_righe("book", risolto, [(riga["t"], json.dumps(riga, separators=(",", ":")))])
            st = STATO["mt5"].setdefault(risolto, {})
            st["book"] = "ok"
            st["book_scritti"] = st.get("book_scritti", 0) + 1
            st["ultimo_book"] = riga["t"]


# ----------------------------------------------------------------------------- MT5: tick
class TickMt5:
    """Tick dei simboli MT5 in watchlist, letti dal terminale ogni 2 s (copy_ticks_from dal punto
    dove si era arrivati). Lato dell'aggressore come nel file unico: flag MT5 se il broker li da',
    poi last contro bid/ask, poi regola del tick. Stesso formato dei trade cripto."""
    FLAG_BUY, FLAG_SELL = 32, 64

    def __init__(self, mt5_call: Callable, mt5_mod, risolvi: Callable, scarto_s: Callable):
        self.call, self.mt5, self.risolvi, self.scarto_s = mt5_call, mt5_mod, risolvi, scarto_s
        self.simboli: Dict[str, str] = {}   # simbolo -> asset
        self.da_ms: Dict[str, float] = {}
        self.bid_prec: Dict[str, float] = {}

    def imposta(self, simboli: Dict[str, str]) -> None:
        self.simboli = dict(simboli)

    def _lato(self, k, prec):
        flags = int(k["flags"])
        if flags & self.FLAG_BUY:
            return 1
        if flags & self.FLAG_SELL:
            return -1
        bid, ask, last = float(k["bid"]), float(k["ask"]), float(k["last"])
        if last > 0 and ask >= bid > 0:
            return 1 if last >= ask else (-1 if last <= bid else 0)
        if prec is not None:
            return 1 if bid > prec else (-1 if bid < prec else 0)
        return 0

    def giro(self) -> None:
        if not self.simboli or not self.call(self.mt5.initialize):
            return
        from datetime import datetime as _dt
        adesso = time.time() * 1000.0
        for simbolo, asset in list(self.simboli.items()):
            risolto = self.risolvi(simbolo)
            if not risolto:
                continue
            scarto = self.scarto_s(risolto)
            da = self.da_ms.get(risolto, adesso - 2000)
            raw = self.call(self.mt5.copy_ticks_range, risolto, _dt.utcfromtimestamp(da / 1000.0 + scarto),
                            _dt.utcfromtimestamp(adesso / 1000.0 + scarto + 1), self.mt5.COPY_TICKS_ALL)
            if raw is None or len(raw) == 0:
                continue
            righe, ultima = [], None
            for k in raw:
                t = float(k["time_msc"]) - scarto * 1000.0
                if t <= da:
                    continue
                lato = self._lato(k, self.bid_prec.get(risolto))
                self.bid_prec[risolto] = float(k["bid"])
                p = float(k["bid"]) or float(k["last"])
                if not p:
                    continue
                vol = float(k["volume_real"]) if "volume_real" in k.dtype.names and float(k["volume_real"]) > 0 else (float(k["volume"]) or 1.0)
                if ultima and ultima[1] == p and ultima[3] == lato and int(ultima[0] // 1000) == int(t // 1000):
                    ultima[2] += vol
                else:
                    ultima = [t, p, vol, lato]
                    righe.append(ultima)
                self.da_ms[risolto] = t
            if righe:
                _scrivi_righe("trade", asset, [(r[0], "%d,%r,%r,%d" % (r[0], r[1], round(r[2], 10), r[3])) for r in righe])
                st = STATO["mt5"].setdefault(risolto, {})
                st["tick_scritti"] = st.get("tick_scritti", 0) + len(righe)
                st["ultimo_tick"] = int(righe[-1][0])


# ----------------------------------------------------------------------------- ciclo principale
class Registratore:
    def __init__(self, book_mt5: Optional[BookMt5] = None, tick_mt5: Optional["TickMt5"] = None):
        self.trade = TradeCripto()
        self.book = BookCripto(self.trade)
        self.book_mt5 = book_mt5
        self.tick_mt5 = tick_mt5
        self._fermo = False
        self._compiti: List[asyncio.Task] = []

    def applica_config(self, cfg: dict) -> None:
        mappa, spot, mt5, tick = {}, [], [], {}
        acceso = bool(cfg.get("registrazione"))
        STATO["registrazione"] = acceso
        for a in (cfg.get("assets") or []) if acceso else []:
            if a["tipo"] == "cripto" and a.get("simbolo"):
                mappa[a["simbolo"].lower()] = a["asset"]
            if a.get("book") and a["tipo"] in ("cripto", "book"):
                spot.append(a["book"])
            if a["tipo"] == "mt5" and a.get("simbolo"):
                mt5.append(a["simbolo"])
                tick[a["simbolo"]] = a["asset"]
        self.trade.imposta(mappa)
        if self.tick_mt5:
            self.tick_mt5.imposta(tick)
        self.book.imposta(spot, float(cfg.get("range_pct") or 1.0))
        if self.book_mt5:
            self.book_mt5.imposta(mt5)
        STATO["asset"] = sorted({a["asset"] for a in cfg.get("assets") or []}) if acceso else []

    async def _giro_mt5(self) -> None:
        while not self._fermo:
            try:
                if self.book_mt5:
                    await asyncio.to_thread(self.book_mt5.giro)
            except Exception as e:
                _errore("book MT5: %s" % e)
            try:
                if self.tick_mt5 and time.time() - getattr(self, "_ultimo_tick", 0) >= 2:
                    self._ultimo_tick = time.time()
                    await asyncio.to_thread(self.tick_mt5.giro)
            except Exception as e:
                _errore("tick MT5: %s" % e)
            await asyncio.sleep(MT5_BOOK_OGNI_S)

    def avvia(self) -> None:
        self.applica_config(carica_config())
        fermo = lambda: self._fermo
        self._compiti = [asyncio.create_task(self.trade.gira(fermo)), asyncio.create_task(self.book.gira(fermo)),
                         asyncio.create_task(self._giro_mt5())]
        STATO["attivo"] = True
        STATO["avviato"] = int(time.time() * 1000)

    async def ferma(self) -> None:
        self._fermo = True
        for c in self._compiti:
            c.cancel()
        self.trade.svuota_tutto()
        STATO["attivo"] = False


# ----------------------------------------------------------------------------- cartella di destinazione
def imposta_cartella(percorso: str, sposta: bool = False) -> dict:
    """Cambia la cartella in cui si registra. '' = torna a quella predefinita. Con `sposta` porta
    nella nuova anche i giorni gia' registrati; senza, restano dove sono (e si possono riprendere
    tornando alla cartella di prima). Le scritture successive vanno subito nella nuova: i file si
    aprono a ogni scrittura, non c'e' niente da riavviare."""
    global CARTELLA, FILE_CONFIG
    nuova = os.path.abspath(os.path.expanduser(percorso.strip())) if (percorso or "").strip() else CARTELLA_PREDEFINITA
    if not os.path.isabs(nuova):
        raise ValueError("serve un percorso completo (es. D:\\Registrazioni)")
    os.makedirs(nuova, exist_ok=True)
    prova = os.path.join(nuova, ".prova_scrittura")
    with open(prova, "w", encoding="utf-8") as f:
        f.write("ok")
    os.remove(prova)
    vecchia = CARTELLA
    spostati = 0
    with _lock_file:
        if os.path.normcase(vecchia) != os.path.normcase(nuova):
            # la configurazione (watchlist, interruttore) segue sempre la cartella
            if os.path.isfile(os.path.join(vecchia, "config.json")) and not os.path.isfile(os.path.join(nuova, "config.json")):
                shutil.copy2(os.path.join(vecchia, "config.json"), os.path.join(nuova, "config.json"))
            if sposta and os.path.isdir(vecchia):
                for nome in os.listdir(vecchia):
                    if nome == "config.json":
                        continue
                    da, a = os.path.join(vecchia, nome), os.path.join(nuova, nome)
                    if os.path.isdir(da) and os.path.isdir(a):
                        for radice, _cart, files in os.walk(da):
                            dest = os.path.join(a, os.path.relpath(radice, da))
                            os.makedirs(dest, exist_ok=True)
                            for fn in files:
                                d2 = os.path.join(dest, fn)
                                if os.path.exists(d2):
                                    with open(os.path.join(radice, fn), "rb") as fi, open(d2, "ab") as fo:
                                        fo.write(fi.read())
                                    os.remove(os.path.join(radice, fn))
                                else:
                                    shutil.move(os.path.join(radice, fn), d2)
                                spostati += 1
                        shutil.rmtree(da, ignore_errors=True)
                    else:
                        shutil.move(da, a)
                        spostati += 1
        CARTELLA = nuova
        FILE_CONFIG = os.path.join(CARTELLA, "config.json")
        os.makedirs(os.path.dirname(FILE_DESTINAZIONE), exist_ok=True)
        with open(FILE_DESTINAZIONE, "w", encoding="utf-8") as f:
            f.write("" if nuova == CARTELLA_PREDEFINITA else nuova)
    return {"cartella": CARTELLA, "predefinita": CARTELLA_PREDEFINITA, "precedente": vecchia, "spostati": spostati}


def scegli_cartella_dialogo(iniziale: str = "") -> Optional[str]:
    """Apre SUL PC la finestra di Windows per scegliere una cartella. None = annullato."""
    if os.name != "nt":
        raise RuntimeError("la scelta della cartella con la finestra si fa solo su Windows")
    import subprocess
    ps = ("[Console]::OutputEncoding=[Text.Encoding]::UTF8;"
          "Add-Type -AssemblyName System.Windows.Forms;"
          "$f=New-Object System.Windows.Forms.FolderBrowserDialog;"
          "$f.Description='Forex Backtest LAB - cartella dove salvare la registrazione del grafico';"
          "$f.ShowNewFolderButton=$true;"
          "$f.SelectedPath=$env:FBL_INIZIALE;"
          "$t=New-Object System.Windows.Forms.Form -Property @{TopMost=$true;ShowInTaskbar=$false};"
          "if($f.ShowDialog($t) -eq 'OK'){ [Console]::Out.Write($f.SelectedPath) }")
    env = dict(os.environ, FBL_INIZIALE=iniziale or CARTELLA)
    r = subprocess.run(["powershell", "-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", ps],
                       capture_output=True, timeout=600, env=env,
                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    scelta = (r.stdout or b"").decode("utf-8", "replace").strip()
    return scelta or None
