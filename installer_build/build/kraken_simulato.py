"""Conto Kraken Futures SIMULATO, con i prezzi veri di Kraken (Forex Backtest LAB).

RICHIESTO: la demo di Kraken Futures (demo-futures.kraken.com) e' stata chiusa il 14 luglio 2026,
quindi il conto di prova lo teniamo noi, qui sul PC, dentro il ponte. Risponde alle STESSE chiamate
del conto vero (sendorder, cancelorder, openpositions, openorders, accounts...), cosi' l'app e
kraken_ordini.py non cambiano: quando l'utente collega il conto reale cambia solo l'ambiente.

Prezzi: tickers e strumenti pubblici di https://futures.kraken.com (niente chiavi).
  - ordine a mercato: compra all'ASK, vende al BID (lo spread vero), commissione taker 0,05%;
  - stop: scatta sul MARK price (come triggerSignal=mark), eseguito al bid/ask, taker;
  - take profit (limite): eseguito al suo prezzo quando bid/ask lo raggiunge, maker 0,02%;
  - funding ogni ora sulle posizioni aperte (dal tasso pubblicato da Kraken);
  - margine iniziale = valore / leva: ordine rifiutato se non basta, come su Kraken.
Limiti dichiarati: i prezzi si leggono ogni ~1 s, quindi un picco piu' breve puo' sfuggire; nessun
eseguito parziale, nessuno slittamento oltre lo spread del momento. Risultati quindi un po' ottimisti.

Modalita' PROP (RICHIESTO: "simuliamo anche la prop firm, con le regole di Kraken"). Regole di
Kraken Prop (supporto Kraken, ottobre 2026):
  - piani Starter (obiettivo 10%, drawdown massimo 6% statico), Intermediate (12%, 5%),
    Advanced (9%, 3%): perdita giornaliera massima 3% del SALDO alle 00:30 UTC, si azzera ogni
    giorno a quell'ora; il drawdown statico e' una soglia fissa sotto il saldo iniziale;
  - Lite: obiettivo 6%, NESSUN limite giornaliero, drawdown 3% del saldo iniziale che SEGUE il
    saldo chiuso piu' alto (trailing);
  - tutto si misura sull'EQUITY (saldo +/- P/L aperto), commissioni e funding compresi, in ogni
    momento: toccata una soglia -> posizioni chiuse, conto VIOLATO;
  - equity all'obiettivo -> posizioni chiuse, valutazione SUPERATA: si passa al conto FINANZIATO
    (stesso capitale, stesse regole di perdita, nessun obiettivo);
  - leva fino a 10x.
"""
import json
import math
import os
import threading
import time
import urllib.error
import urllib.request

PREZZI_URL = os.environ.get("FBL_KRAKEN_PREZZI_URL") or "https://futures.kraken.com"
COMMISSIONE_TAKER = 0.0005
COMMISSIONE_MAKER = 0.0002
MANTENIMENTO = 0.01          # margine di mantenimento (liquidazione) sul valore delle posizioni
OGNI_S = 1.0
CANDELE_URL = os.environ.get("FBL_KRAKEN_CANDELE_URL") or PREZZI_URL

PIANI_PROP = {
    "starter":      {"nome": "Starter",      "obiettivo": 0.10, "drawdown": 0.06, "giornaliera": 0.03, "trailing": False},
    "intermediate": {"nome": "Intermediate", "obiettivo": 0.12, "drawdown": 0.05, "giornaliera": 0.03, "trailing": False},
    "advanced":     {"nome": "Advanced",     "obiettivo": 0.09, "drawdown": 0.03, "giornaliera": 0.03, "trailing": False},
    "lite":         {"nome": "Lite",         "obiettivo": 0.06, "drawdown": 0.03, "giornaliera": None, "trailing": True},
}
CAPITALI_PROP = [5000, 10000, 25000, 50000, 100000, 200000]


class ErroreSim(Exception):
    pass


def _giorno_prop(ts: float) -> str:
    """Giorno di trading Kraken Prop: cambia alle 00:30 UTC."""
    return time.strftime("%Y-%m-%d", time.gmtime(ts - 30 * 60))


def _pubblico(percorso: str) -> dict:
    req = urllib.request.Request(PREZZI_URL + "/derivatives" + percorso, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode("utf-8") or "{}")
    except (urllib.error.URLError, ValueError, OSError) as e:
        raise ErroreSim("prezzi Kraken non raggiungibili: %s" % getattr(e, "reason", e))


class Simulatore:
    """Stessa interfaccia di kraken_ordini.Client: chiama(metodo, percorso, params) e strumento()."""

    def __init__(self, file_stato: str):
        self.ambiente = "simulato"
        self.file = file_stato
        self._lock = threading.RLock()
        self._tickers = {}
        self._tickers_at = 0.0
        self._strumenti = None
        self._strumenti_at = 0.0
        self._fermo = False
        self.errore_prezzi = None
        self.s = self._carica()
        self._thread = threading.Thread(target=self._ciclo, daemon=True)
        self._thread.start()

    # ------------------------------------------------------------------ stato su file
    @staticmethod
    def stato_nuovo(saldo: float, leva: float = 2.0, prop: dict = None) -> dict:
        ora = time.time()
        s = {"versione": 1, "creato": ora, "saldo_iniziale": float(saldo), "saldo": float(saldo),
             "leva": float(leva), "posizioni": {}, "ordini": [], "storico": [], "eventi": [],
             "commissioni": 0.0, "funding": 0.0, "prossimo_id": 1, "ultimo_funding": int(ora // 3600),
             "prop": None}
        if prop:
            piano = PIANI_PROP[prop["piano"]]
            s["leva"] = float(prop.get("leva") or 10)
            s["prop"] = {"piano": prop["piano"], "fase": "valutazione", "esito": "in corso", "motivo": None,
                         "giorno": _giorno_prop(ora), "saldo_giorno": float(saldo),
                         "massimo_chiuso": float(saldo), "superata_il": None, "violata_il": None,
                         **{k: piano[k] for k in ("obiettivo", "drawdown", "giornaliera", "trailing")}}
        return s

    def _carica(self) -> dict:
        try:
            with open(self.file, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return self.stato_nuovo(10000)

    def _salva(self):
        os.makedirs(os.path.dirname(self.file), exist_ok=True)
        tmp = self.file + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.s, f)
        os.replace(tmp, self.file)

    def azzera(self, saldo: float, leva: float = 2.0, prop: dict = None):
        with self._lock:
            self.s = self.stato_nuovo(saldo, leva, prop)
            self._salva()

    def ferma(self):
        self._fermo = True

    # ------------------------------------------------------------------ prezzi
    def _aggiorna_prezzi(self, forza=False):
        if not forza and time.time() - self._tickers_at < 0.8:
            return
        j = _pubblico("/api/v3/tickers")
        t = {}
        for x in j.get("tickers", []):
            s = str(x.get("symbol", "")).upper()
            if s:
                t[s] = x
        self._tickers = t
        self._tickers_at = time.time()
        self.errore_prezzi = None

    def _prezzi(self, simbolo: str) -> dict:
        t = self._tickers.get(simbolo.upper())
        if not t:
            raise ErroreSim("nessun prezzo per %s" % simbolo)
        f = lambda k: float(t.get(k) or 0) or None
        last = f("last") or f("markPrice")
        mark = f("markPrice") or last
        return {"bid": f("bid") or last, "ask": f("ask") or last, "mark": mark, "last": last,
                "funding": t.get("fundingRate"), "funding_rel": t.get("relativeFundingRate")}

    def strumento(self, simbolo: str) -> dict:
        if not self._strumenti or time.time() - self._strumenti_at > 3600:
            j = _pubblico("/api/v3/instruments")
            self._strumenti = {s["symbol"].upper(): s for s in j.get("instruments", [])}
            self._strumenti_at = time.time()
        s = self._strumenti.get(simbolo.upper())
        if not s or s.get("tradeable") is False:
            raise ErroreSim("contratto %s non disponibile su Kraken Futures" % simbolo)
        prec = s.get("contractValuePrecision")
        step = 10 ** -int(prec) if prec is not None else 1.0
        return {"tick": float(s.get("tickSize") or 0.5), "step": step, "min": step,
                "leva_max": float(s.get("maxLeverage") or 0) or None}

    # ------------------------------------------------------------------ conti
    def _pnl_aperto(self) -> float:
        tot = 0.0
        for sym, p in self.s["posizioni"].items():
            try:
                m = self._prezzi(sym)["mark"]
            except ErroreSim:
                m = p["entrata"]
            tot += (m - p["entrata"]) * p["q"]
        return tot

    def _valore_posizioni(self) -> float:
        tot = 0.0
        for sym, p in self.s["posizioni"].items():
            try:
                m = self._prezzi(sym)["mark"]
            except ErroreSim:
                m = p["entrata"]
            tot += abs(p["q"]) * m
        return tot

    def equity(self) -> float:
        return self.s["saldo"] + self._pnl_aperto()

    def bloccato(self):
        pr = self.s.get("prop")
        if pr and pr["esito"] == "violata":
            return "conto prop VIOLATO (%s): azzera il conto per ricominciare" % (pr.get("motivo") or "")
        return None

    # ------------------------------------------------------------------ esecuzioni
    def _registra(self, sym, lato, q, prezzo, tipo, pnl, comm, cli=None, ts=None):
        self.s["storico"].append({"ts": int(ts if ts else time.time() * 1000), "simbolo": sym, "lato": lato, "quantita": q,
                                  "prezzo": prezzo, "tipo": tipo, "pnl": round(pnl, 6), "commissione": round(comm, 6),
                                  "cliOrdId": cli})
        if len(self.s["storico"]) > 2000:
            self.s["storico"] = self.s["storico"][-2000:]

    def _esegui(self, sym, lato, q, prezzo, maker, tipo, cli=None, ts=None):
        """Applica un eseguito (lato buy/sell, quantita' q>0) alla posizione netta."""
        segno = 1 if lato == "buy" else -1
        p = self.s["posizioni"].get(sym) or {"q": 0.0, "entrata": prezzo}
        vecchia = p["q"]
        nuova = vecchia + segno * q
        pnl = 0.0
        if vecchia == 0 or (vecchia > 0) == (segno > 0):
            # apre o aumenta: prezzo medio
            p["entrata"] = (abs(vecchia) * p["entrata"] + q * prezzo) / (abs(vecchia) + q) if vecchia else prezzo
        else:
            chiusa = min(abs(vecchia), q)
            pnl = (prezzo - p["entrata"]) * chiusa * (1 if vecchia > 0 else -1)
            if abs(nuova) > 1e-12 and (nuova > 0) != (vecchia > 0):
                p["entrata"] = prezzo        # girata dall'altra parte
        comm = q * prezzo * (COMMISSIONE_MAKER if maker else COMMISSIONE_TAKER)
        self.s["saldo"] += pnl - comm
        self.s["commissioni"] += comm
        p["q"] = round(nuova, 12)
        if abs(p["q"]) < 1e-12:
            self.s["posizioni"].pop(sym, None)
            # posizione a zero: via gli ordini reduceOnly rimasti su quel contratto
            self.s["ordini"] = [o for o in self.s["ordini"] if not (o["symbol"] == sym and o["reduceOnly"])]
        else:
            self.s["posizioni"][sym] = p
        self._registra(sym, lato, q, prezzo, tipo, pnl, comm, cli, ts)
        pr = self.s.get("prop")
        if pr:
            pr["massimo_chiuso"] = max(pr["massimo_chiuso"], self.s["saldo"])   # saldo chiuso piu' alto (Lite)
        return pnl

    def _riducibile(self, sym, lato) -> float:
        p = self.s["posizioni"].get(sym)
        if not p:
            return 0.0
        if (p["q"] > 0 and lato == "sell") or (p["q"] < 0 and lato == "buy"):
            return abs(p["q"])
        return 0.0

    def _controlla_ordini(self):
        for o in list(self.s["ordini"]):
            if o not in self.s["ordini"]:
                continue
            try:
                px = self._prezzi(o["symbol"])
            except ErroreSim:
                continue
            esegui = None
            if o["orderType"] == "stop":
                scatta = px["mark"] <= o["stopPrice"] if o["side"] == "sell" else px["mark"] >= o["stopPrice"]
                if scatta:
                    esegui = (px["bid"] if o["side"] == "sell" else px["ask"], False, "stop")
            else:
                tocca = px["bid"] >= o["limitPrice"] if o["side"] == "sell" else px["ask"] <= o["limitPrice"]
                if tocca:
                    esegui = (o["limitPrice"], True, "take profit")
            if not esegui:
                continue
            q = o["size"]
            if o["reduceOnly"]:
                q = min(q, self._riducibile(o["symbol"], o["side"]))
            self.s["ordini"] = [x for x in self.s["ordini"] if x["order_id"] != o["order_id"]]
            if q > 0:
                self._esegui(o["symbol"], o["side"], q, esegui[0], esegui[1], esegui[2], o.get("cliOrdId"))

    # ---------------------------------------------------------- TP/SL toccati fra un controllo e l'altro
    # RICHIESTO ("controlla meglio la chiusura quando arriva alla riga TP e SL"): il prezzo del momento,
    # letto ogni secondo, non vede una spinta di pochi istanti (lo "stoppino" della candela), e a PC
    # spento non vede niente. Le candele da 1 minuto di Kraken (massimo e minimo) si: ogni ordine si
    # confronta con le candele CHIUSE dopo il minuto in cui e' nato - il take profit con quelle dei
    # prezzi scambiati, lo stop con quelle del MARK (Kraken lo fa scattare sul mark). Toccato -> eseguito
    # al SUO livello (lo stop al prezzo d'apertura della candela se questa e' partita gia' oltre). Se
    # nella stessa candela ci sono sia lo stop che un take profit, prima lo stop (prudente).
    def _candele(self, tipo: str, sym: str, da_ms: float, a_ms: float) -> list:
        # API dei grafici di Kraken Futures: fuori da /derivatives, pubblica (niente chiavi).
        url = CANDELE_URL + "/api/charts/v1/%s/%s/1m?from=%d&to=%d" % (tipo, sym, int(da_ms // 1000), int(a_ms // 1000))
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=10) as r:
                j = json.loads(r.read().decode("utf-8") or "{}")
        except (urllib.error.URLError, ValueError, OSError) as e:
            raise ErroreSim("candele Kraken non raggiungibili: %s" % getattr(e, "reason", e))
        out = []
        for c in j.get("candles") or []:
            try:
                out.append((int(c["time"]), float(c["open"]), float(c["high"]), float(c["low"])))
            except (KeyError, TypeError, ValueError):
                continue
        return sorted(out)

    def _controlla_candele(self):
        ora = time.time() * 1000.0
        if ora - getattr(self, "_candele_at", 0) < 15000:
            return
        self._candele_at = ora
        per_simbolo = {}
        for o in self.s["ordini"]:
            per_simbolo.setdefault(o["symbol"], []).append(o)
        for sym, ordini in per_simbolo.items():
            inizio = min(max(o.get("visto_fino") or 0, (int(o.get("ts") or ora) // 60000 + 1) * 60000) for o in ordini)
            fine = (int(ora) // 60000) * 60000          # solo candele gia' chiuse
            if fine - inizio < 60000:
                continue
            try:
                scambi = self._candele("trade", sym, inizio, fine)
            except Exception:
                continue                                 # candele non disponibili: resta il controllo al secondo
            try:
                mark = self._candele("mark", sym, inizio, fine) or scambi
            except Exception:
                mark = scambi
            eventi = []
            for o in ordini:
                da = max(o.get("visto_fino") or 0, (int(o.get("ts") or ora) // 60000 + 1) * 60000)
                serie = mark if o["orderType"] == "stop" else scambi
                for (t, ap, alto, basso) in serie:
                    if t < da or t + 60000 > fine:
                        continue
                    if o["orderType"] == "stop":
                        lv = o["stopPrice"]
                        if (o["side"] == "sell" and basso <= lv) or (o["side"] == "buy" and alto >= lv):
                            prezzo = min(lv, ap) if o["side"] == "sell" else max(lv, ap)
                            eventi.append((t, 0, o["order_id"], prezzo, False, "stop"))
                            break
                    else:
                        lv = o["limitPrice"]
                        if (o["side"] == "sell" and alto >= lv) or (o["side"] == "buy" and basso <= lv):
                            eventi.append((t, 1, o["order_id"], lv, True, "take profit"))
                            break
            for (t, _prio, oid, prezzo, maker, tipo) in sorted(eventi):
                o = next((x for x in self.s["ordini"] if x["order_id"] == oid), None)
                if o is None:
                    continue                             # gia' tolto (posizione chiusa da un evento prima)
                q = o["size"]
                if o["reduceOnly"]:
                    q = min(q, self._riducibile(sym, o["side"]))
                self.s["ordini"] = [x for x in self.s["ordini"] if x["order_id"] != oid]
                if q > 0:
                    self._esegui(sym, o["side"], q, prezzo, maker, tipo, o.get("cliOrdId"), t + 30000)
                    self._evento("%s %s eseguito a %s (candela delle %s)" % (tipo, sym, prezzo, time.strftime("%H:%M", time.localtime(t / 1000))))
            for o in self.s["ordini"]:
                if o["symbol"] == sym:
                    o["visto_fino"] = fine

    def _funding(self):
        ora = int(time.time() // 3600)
        if ora <= self.s.get("ultimo_funding", ora):
            return
        self.s["ultimo_funding"] = ora
        for sym, p in list(self.s["posizioni"].items()):
            try:
                px = self._prezzi(sym)
            except ErroreSim:
                continue
            per_unita = None
            try:
                if px["funding_rel"] is not None:
                    per_unita = float(px["funding_rel"]) * px["mark"]
                elif px["funding"] is not None:
                    per_unita = float(px["funding"])
            except (TypeError, ValueError):
                per_unita = None
            if per_unita is None or abs(per_unita) > px["mark"] * 0.005:
                continue                                # dato assente o fuori scala: meglio niente
            pagamento = -per_unita * p["q"]             # long paga se il tasso e' positivo
            self.s["saldo"] += pagamento
            self.s["funding"] += pagamento
            self._registra(sym, "funding", abs(p["q"]), px["mark"], "funding", pagamento, 0.0)

    def _chiudi_tutto(self, tipo):
        self.s["ordini"] = []
        for sym, p in list(self.s["posizioni"].items()):
            px = self._prezzi(sym)
            lato = "sell" if p["q"] > 0 else "buy"
            self._esegui(sym, lato, abs(p["q"]), px["bid"] if lato == "sell" else px["ask"], False, tipo)

    def _evento(self, testo):
        self.s["eventi"].append({"ts": int(time.time() * 1000), "testo": testo})
        self.s["eventi"] = self.s["eventi"][-50:]

    def soglie_prop(self) -> dict:
        pr = self.s.get("prop")
        if not pr:
            return {}
        iniziale = self.s["saldo_iniziale"]
        if pr["trailing"]:
            pavimento = pr["massimo_chiuso"] - pr["drawdown"] * iniziale
        else:
            pavimento = iniziale * (1 - pr["drawdown"])
        giornaliera = pr["saldo_giorno"] * (1 - pr["giornaliera"]) if pr["giornaliera"] else None
        obiettivo = iniziale * (1 + pr["obiettivo"]) if pr["fase"] == "valutazione" else None
        return {"pavimento": pavimento, "limite_giorno": giornaliera, "obiettivo": obiettivo}

    def _regole(self):
        """Prop: soglie sull'equity. Libero: liquidazione se l'equity scende sotto il mantenimento."""
        pr = self.s.get("prop")
        if pr and pr["esito"] == "violata":
            return
        if pr:
            g = _giorno_prop(time.time())
            if g != pr["giorno"]:
                pr["giorno"] = g
                pr["saldo_giorno"] = self.s["saldo"]
            eq = self.equity()
            so = self.soglie_prop()
            motivo = None
            if eq <= so["pavimento"] + 1e-9:
                motivo = "drawdown massimo: equity %.2f sotto %.2f" % (eq, so["pavimento"])
            elif so["limite_giorno"] is not None and eq <= so["limite_giorno"] + 1e-9:
                motivo = "perdita giornaliera: equity %.2f sotto %.2f" % (eq, so["limite_giorno"])
            if motivo:
                self._chiudi_tutto("violazione prop")
                pr["esito"] = "violata"
                pr["motivo"] = motivo
                pr["violata_il"] = int(time.time() * 1000)
                self._evento("Conto prop VIOLATO: " + motivo)
                return
            if so["obiettivo"] is not None and eq >= so["obiettivo"] - 1e-9:
                self._chiudi_tutto("obiettivo prop")
                finale = self.s["saldo"]
                self._evento("Valutazione SUPERATA con %.2f USD: si passa al conto finanziato da %.2f." % (finale, self.s["saldo_iniziale"]))
                nuovo = self.stato_nuovo(self.s["saldo_iniziale"], self.s["leva"], {"piano": pr["piano"], "leva": self.s["leva"]})
                nuovo["prop"]["fase"] = "finanziato"
                nuovo["prop"]["superata_il"] = int(time.time() * 1000)
                nuovo["eventi"] = self.s["eventi"]
                nuovo["valutazione"] = {"saldo_finale": finale, "storico": self.s["storico"][-200:]}
                self.s = nuovo
            return
        if self.s["posizioni"]:
            if self.equity() <= self._valore_posizioni() * MANTENIMENTO:
                self._chiudi_tutto("liquidazione")
                self._evento("LIQUIDAZIONE: equity sotto il margine di mantenimento.")

    def passo(self):
        with self._lock:
            prima = json.dumps(self.s, sort_keys=True)
            try:
                self._aggiorna_prezzi()
            except ErroreSim as e:
                self.errore_prezzi = str(e)
                return
            self._controlla_candele()
            self._controlla_ordini()
            self._funding()
            self._regole()
            if json.dumps(self.s, sort_keys=True) != prima:
                self._salva()

    def _ciclo(self):
        while not self._fermo:
            try:
                self.passo()
            except Exception as e:  # il ciclo non deve morire
                self.errore_prezzi = str(e)
            time.sleep(OGNI_S)

    # ------------------------------------------------------------------ API come Kraken
    def chiama(self, metodo: str, percorso: str, params=None, privata: bool = True):
        params = {k: v for k, v in (params or {}).items() if v is not None}
        with self._lock:
            if percorso in ("/api/v3/tickers", "/api/v3/instruments"):
                return _pubblico(percorso)
            self._aggiorna_prezzi()
            self._controlla_ordini()
            self._regole()
            try:
                r = self._api(percorso, params)
            finally:
                self._salva()
            return r

    def _api(self, percorso, params):
        if percorso == "/api/v3/accounts":
            pnl = self._pnl_aperto()
            eq = self.s["saldo"] + pnl
            usato = self._valore_posizioni() / self.s["leva"]
            return {"result": "success", "accounts": {"flex": {
                "portfolioValue": eq, "balanceValue": self.s["saldo"], "totalUnrealized": pnl,
                "availableMargin": max(0.0, eq - usato), "initialMargin": usato}}}
        if percorso == "/api/v3/openpositions":
            return {"result": "success", "openPositions": [
                {"symbol": sym, "side": "long" if p["q"] > 0 else "short", "size": abs(p["q"]), "price": p["entrata"]}
                for sym, p in self.s["posizioni"].items()]}
        if percorso == "/api/v3/openorders":
            return {"result": "success", "openOrders": [
                {"order_id": o["order_id"], "symbol": o["symbol"], "side": o["side"], "orderType": o["orderType"],
                 "limitPrice": o.get("limitPrice"), "stopPrice": o.get("stopPrice"), "unfilledSize": o["size"],
                 "reduceOnly": o["reduceOnly"], "cliOrdId": o.get("cliOrdId")} for o in self.s["ordini"]]}
        if percorso == "/api/v3/cancelorder":
            prima = len(self.s["ordini"])
            self.s["ordini"] = [o for o in self.s["ordini"] if o["order_id"] != params.get("order_id")]
            return {"result": "success", "cancelStatus": {"status": "cancelled" if len(self.s["ordini"]) < prima else "notFound"}}
        if percorso == "/api/v3/cancelallorders":
            sym = str(params.get("symbol") or "").upper()
            self.s["ordini"] = [o for o in self.s["ordini"] if sym and o["symbol"] != sym]
            return {"result": "success", "cancelStatus": {"status": "cancelled"}}
        if percorso == "/api/v3/sendorder":
            return self._sendorder(params)
        raise ErroreSim("chiamata non simulata: %s" % percorso)

    def _nuovo_id(self) -> str:
        n = self.s["prossimo_id"]
        self.s["prossimo_id"] = n + 1
        return "sim-%d" % n

    def _sendorder(self, p):
        rifiuto = lambda st: {"result": "success", "sendStatus": {"status": st}}
        if self.bloccato():
            return rifiuto("accountBreached")
        sym = str(p.get("symbol") or "").upper()
        lato = str(p.get("side") or "").lower()
        tipo = str(p.get("orderType") or "").lower()
        ridurre = str(p.get("reduceOnly") or "").lower() == "true"
        try:
            q = float(p.get("size") or 0)
        except ValueError:
            q = 0
        if lato not in ("buy", "sell") or q <= 0:
            return rifiuto("invalidSize")
        try:
            px = self._prezzi(sym)
            info = self.strumento(sym)
        except ErroreSim:
            return rifiuto("marketSuspended")
        if q + 1e-12 < info["min"]:
            return rifiuto("invalidSize")
        oid = self._nuovo_id()
        cli = p.get("cliOrdId")
        if tipo == "mkt":
            if ridurre:
                q = min(q, self._riducibile(sym, lato))
                if q <= 0:
                    return rifiuto("wouldNotReducePosition")
            else:
                prezzo = px["ask"] if lato == "buy" else px["bid"]
                eq = self.equity()
                usato = self._valore_posizioni() / self.s["leva"]
                if (q * prezzo) / self.s["leva"] > eq - usato + 1e-9:
                    return rifiuto("insufficientAvailableFunds")
            prezzo = px["ask"] if lato == "buy" else px["bid"]
            self._esegui(sym, lato, q, prezzo, False, "mercato", cli)
            self._regole()
            return {"result": "success", "sendStatus": {"status": "placed", "order_id": oid,
                    "orderEvents": [{"type": "EXECUTION", "price": prezzo, "amount": q}]}}
        if tipo in ("stp", "stop"):
            try:
                stop = float(p.get("stopPrice"))
            except (TypeError, ValueError):
                return rifiuto("invalidPrice")
            # stop gia' oltre il mark: Kraken lo rifiuterebbe (scatterebbe subito)
            if (lato == "sell" and stop >= px["mark"]) or (lato == "buy" and stop <= px["mark"]):
                return rifiuto("wouldExecuteImmediately")
            if ridurre and self._riducibile(sym, lato) <= 0:
                return rifiuto("wouldNotReducePosition")
            self.s["ordini"].append({"order_id": oid, "symbol": sym, "side": lato, "orderType": "stop",
                                     "stopPrice": stop, "size": q, "reduceOnly": ridurre, "cliOrdId": cli,
                                     "ts": int(time.time() * 1000)})
            return {"result": "success", "sendStatus": {"status": "placed", "order_id": oid}}
        if tipo == "lmt":
            try:
                limite = float(p.get("limitPrice"))
            except (TypeError, ValueError):
                return rifiuto("invalidPrice")
            if not ridurre:
                return rifiuto("simulatoSoloReduceOnly")    # l'app manda limiti solo come take profit
            if self._riducibile(sym, lato) <= 0:
                return rifiuto("wouldNotReducePosition")
            self.s["ordini"].append({"order_id": oid, "symbol": sym, "side": lato, "orderType": "lmt",
                                     "limitPrice": limite, "size": q, "reduceOnly": True, "cliOrdId": cli,
                                     "ts": int(time.time() * 1000)})
            self._controlla_ordini()     # gia' raggiunto: eseguito subito
            return {"result": "success", "sendStatus": {"status": "placed", "order_id": oid}}
        return rifiuto("invalidOrderType")

    # ------------------------------------------------------------------ riepilogo per l'app
    def riepilogo(self) -> dict:
        with self._lock:
            chiusi = [x for x in self.s["storico"] if x["tipo"] not in ("mercato", "funding") or x["pnl"]]
            vinti = sum(1 for x in chiusi if x["pnl"] > 0)
            persi = sum(1 for x in chiusi if x["pnl"] < 0)
            out = {"saldo_iniziale": self.s["saldo_iniziale"], "saldo": self.s["saldo"], "equity": self.equity(),
                   "leva": self.s["leva"], "commissioni": self.s["commissioni"], "funding": self.s["funding"],
                   "risultato": self.s["saldo"] - self.s["saldo_iniziale"], "chiusure_vinte": vinti,
                   "chiusure_perse": persi, "creato": self.s["creato"], "eventi": self.s["eventi"][-5:],
                   "errore_prezzi": self.errore_prezzi}
            pr = self.s.get("prop")
            if pr:
                out["prop"] = {**pr, "nome": PIANI_PROP[pr["piano"]]["nome"], **self.soglie_prop()}
            return out

    def storico(self, n=100) -> list:
        with self._lock:
            return list(reversed(self.s["storico"][-n:]))
