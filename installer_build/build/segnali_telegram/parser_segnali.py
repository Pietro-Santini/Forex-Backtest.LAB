# -*- coding: utf-8 -*-
"""
Interprete dei messaggi delle sale segnali Telegram — Forex Backtest LAB

COSA FA
=======
Prende il testo libero di un messaggio Telegram e ne ricava, quando ci riesce, un segnale
strutturato: strumento, direzione, entrata, stop loss, take profit.

LA REGOLA CHE GOVERNA TUTTO: NEL DUBBIO, NON INVENTARE
=======================================================
Questo interprete alimenta l'apertura di ordini su un conto VERO. Un segnale letto male non e' un
grafico storto: sono soldi. Quindi:

  - ogni segnale porta una CONFIDENZA (0-100) e l'elenco di cosa e' stato riconosciuto;
  - se manca un pezzo essenziale (strumento o direzione) NON si produce nessun segnale;
  - se manca lo stop loss il segnale esce con `rischio_non_definito`, e a valle deve essere
    l'utente a decidere - mai un default silenzioso;
  - il testo ORIGINALE viaggia sempre insieme al risultato, cosi' chi conferma legge cosa e'
    arrivato davvero e non solo la nostra interpretazione.

Non fa nessuna rete, non apre nessun ordine, non ha stato: si prova da solo, e infatti
test_parser.py lo mette alla prova su decine di formati reali.
"""

import re
import unicodedata
from typing import Dict, List, Optional

# =====================================================================================
# STRUMENTI
# =====================================================================================
# Le sale segnali chiamano lo stesso strumento in dieci modi diversi. Qui si normalizza verso il
# nome che usa l'app. La lista e' volutamente ESPLICITA: un riconoscimento "furbo" basato su
# pattern generici finirebbe per scambiare una parola qualunque per uno strumento.
ALIAS_STRUMENTI: Dict[str, str] = {
    # metalli
    "GOLD": "XAUUSD", "ORO": "XAUUSD", "XAUUSD": "XAUUSD", "XAU/USD": "XAUUSD", "XAU": "XAUUSD",
    "SILVER": "XAGUSD", "ARGENTO": "XAGUSD", "XAGUSD": "XAGUSD", "XAG/USD": "XAGUSD",
    # indici
    "US30": "US30", "DOW": "US30", "DJI": "US30", "DOWJONES": "US30",
    "NAS100": "NAS100", "NASDAQ": "NAS100", "US100": "NAS100", "USTEC": "NAS100", "USTEC100": "NAS100",
    "SPX500": "SPX500", "SP500": "SPX500", "US500": "SPX500", "SPX": "SPX500",
    "GER40": "GER40", "DAX": "GER40", "DE40": "GER40",
    # cripto: si generano piu' sotto, da CRIPTO
    # energia
    "OIL": "USOIL", "USOIL": "USOIL", "WTI": "USOIL", "CRUDE": "USOIL",
}

# CRIPTO: si generano, invece di elencare a mano ogni forma di ogni moneta.
# Le sale scrivono la stessa moneta in molti modi - SOL, SOLUSD, SOLUSDT, SOL/USD, SOLPERP - e una
# forma dimenticata vuol dire un segnale non riconosciuto, in silenzio. Aggiungere una moneta qui
# e' una riga: il nome esteso serve perche' certe sale scrivono "BITCOIN" o "SOLANA" per esteso.
CRIPTO: Dict[str, List[str]] = {
    "BTC": ["BITCOIN", "XBT", "XBTUSD"],
    "ETH": ["ETHEREUM"],
    "SOL": ["SOLANA"],
    "XRP": ["RIPPLE"],
    "ADA": ["CARDANO"],
    "DOGE": ["DOGECOIN"],
    "BNB": ["BINANCECOIN"],
    "LTC": ["LITECOIN"],
    "AVAX": ["AVALANCHE"],
    "LINK": ["CHAINLINK"],
    "DOT": ["POLKADOT"],
    "MATIC": ["POLYGON"],
    "TRX": ["TRON"],
    "ATOM": ["COSMOS"],
    "UNI": ["UNISWAP"],
    "NEAR": [],
    "APT": ["APTOS"],
    "ARB": ["ARBITRUM"],
    "OP": ["OPTIMISM"],
    "INJ": ["INJECTIVE"],
    "SUI": [],
    "TON": ["TONCOIN"],
    "FIL": ["FILECOIN"],
    "ETC": [],
    "XLM": ["STELLAR"],
    "HBAR": ["HEDERA"],
    "AAVE": [],
    "SHIB": ["SHIBAINU"],
    "PEPE": [],
    "ICP": [],
    "VET": ["VECHAIN"],
}
for _moneta, _nomi in CRIPTO.items():
    _std = _moneta + "USD"
    # Le forme in cui una sala puo' scriverla. "PERP" perche' sui futures si scrive spesso cosi'.
    _forme = [_moneta, _std, _moneta + "USDT", _moneta + "USDC", _moneta + "/USD", _moneta + "/USDT",
              _moneta + "PERP", _moneta + "-USD", _moneta + "USD.P"]
    for _n in _nomi:
        _forme += [_n, _n + "USD", _n + "USDT"]
    for _f in _forme:
        ALIAS_STRUMENTI.setdefault(_f.upper(), _std)

# Coppie forex: si generano dalle valute, invece di elencarne 28 a mano.
VALUTE = ["EUR", "USD", "GBP", "JPY", "CHF", "AUD", "NZD", "CAD"]
for _a in VALUTE:
    for _b in VALUTE:
        if _a != _b:
            ALIAS_STRUMENTI.setdefault(_a + _b, _a + _b)

# =====================================================================================
# DIREZIONE
# =====================================================================================
PAROLE_ACQUISTO = ["BUY", "LONG", "COMPRA", "ACQUISTA", "ACQUISTO", "RIALZO", "BULLISH"]
PAROLE_VENDITA = ["SELL", "SHORT", "VENDI", "VENDITA", "RIBASSO", "BEARISH"]
# Le sale usano molto le emoji: spesso sono l'unico segno della direzione.
EMOJI_ACQUISTO = ["\U0001F7E2", "\U0001F535", "⬆", "\U0001F4C8", "\U0001F680"]  # verde, blu, su, grafico su, razzo
EMOJI_VENDITA = ["\U0001F534", "⬇", "\U0001F4C9"]                               # rosso, giu, grafico giu


# Parole che segnalano una riga pubblicitaria o di servizio. Le sale chiudono quasi sempre il
# messaggio con un invito al canale VIP, e quelle righe contengono nomi di strumenti e numeri che
# NON fanno parte dell'ordine. Vanno tolte prima di leggere qualunque cosa.
PAROLE_RUMORE = [
    "HTTP", "WWW.", "T.ME", "VIP", "DEPOSIT", "CLICK HERE", "SUBSCRIBE", "JOIN ",
    "CHANNEL", "MEMBER", "TELEGRAM", "EQUITY", "BONUS", "PROMO", "REGISTER",
]


# Parole da messaggio PUBBLICITARIO (e-book, corsi, indicatori, "VIP gratis"). Segnalato davvero:
# "FREE GOLD TRADING E-BOOK ... Real XAUUSD examples ... Entry, Stop & Targets explained ... 🚀 Get
# FREE BOOK + FREE VIP" era diventato un BUY XAUUSD - GOLD come strumento e il razzo come
# direzione. Un messaggio cosi', se non porta nessun prezzo, non e' mai un ordine.
PAROLE_PUBBLICITA = [
    r"\bFREE\b", r"\bGRATIS\b", r"\bGRATUIT", r"E-?BOOK", r"\bBOOK\b", r"\bLIBRO\b",
    r"\bGIV(?:E|ING)\s*AWAY\b", r"\bGIVEAWAY\b", r"\bNO\s+COST\b", r"\bCOURSE\b", r"\bCORSO\b",
    r"\bMENTORSHIP\b", r"\bINDICATOR\b", r"\bINDICATORE\b", r"\bDM\s+ME\b", r"\bCONTACT\b",
    r"\bOFFER\b", r"\bOFFERTA\b", r"\bDISCOUNT\b", r"\bSCONTO\b", r"\bSIGN\s*UP\b", r"\bISCRIVITI\b",
    r"\bLIMITED\s+(?:SPOTS?|TIME|SEATS?)\b", r"\bEXCLUSIVE\b", r"\bPATTERNS?\b", r"\bEXAMPLES?\b",
    r"\bBEGINNERS?\b", r"\bLEARN\b", r"\bIMPARA\b", r"\bWEBINAR\b", r"\bLIVE\s+STREAM\b",
]


# Parole "descrittive": dicono com'e' il mercato, non cosa fare. Da sole non fanno un ordine.
PAROLE_DIREZIONE_DEBOLI = {"RIALZO", "BULLISH", "RIBASSO", "BEARISH"}

# Messaggi di ANALISI (segnalato: un "XAU/USD Market Alert - Current market bias: Bullish - Key
# reaction zone 4193 - Support areas... - Educational market alert only, not an instruction to buy
# or sell" diventava un BUY XAUUSD). Un messaggio cosi' e' un segnale SOLO se contiene la parola
# operativa (BUY/SELL...) E almeno un target.
PAROLE_ANALISI = [
    r"NOT\s+FINANCIAL\s+ADVICE", r"EDUCATIONAL", r"NOT\s+AN?\s+INSTRUCTION", r"MARKET\s+ALERT",
    r"MARKET\s+(?:BIAS|OUTLOOK|UPDATE|ANALYSIS)", r"\bBIAS\b", r"\bOUTLOOK\b", r"\bANALYSIS\b", r"\bANALISI\b",
    r"KEY\s+(?:REACTION\s+)?(?:ZONE|LEVEL|AREA)", r"SUPPORT\s+(?:AREAS?|ZONES?|LEVELS?)", r"RESISTANCE\s+(?:AREAS?|ZONES?|LEVELS?)",
    r"\bSCENARIO\b", r"\bINVALIDATION\b", r"TIMEFRAMES?\s+REVIEWED", r"NON\s+(?:E'|E)\s+UN\s+CONSIGLIO",
]


def _e_analisi(testo: str) -> bool:
    t = _normalizza(testo)
    return any(re.search(e, t) for e in PAROLE_ANALISI)


def _direzione_forte(testo: str) -> bool:
    """True se la direzione e' scritta come ORDINE (BUY, SELL, COMPRA...) o con le emoji dei segnali,
    non solo descritta (bullish, rialzo). "BUYERS"/"SELLERS" non contano: servono parole intere."""
    t = _normalizza(testo)
    for p in PAROLE_ACQUISTO + PAROLE_VENDITA:
        if p in PAROLE_DIREZIONE_DEBOLI:
            continue
        if re.search(r"(?<![A-Z])" + p + r"(?![A-Z])", t):
            return True
    orig = str(testo or "")
    return any(e in orig for e in EMOJI_ACQUISTO + EMOJI_VENDITA)


def _direzione_a_parole(testo: str) -> bool:
    """True solo se BUY/SELL (o sinonimi operativi) sono scritti in lettere. Un'emoji da sola - un
    razzo, un pallino verde - e' decorazione finche' il messaggio non porta un ordine completo."""
    t = _normalizza(testo)
    for p in PAROLE_ACQUISTO + PAROLE_VENDITA:
        if p in PAROLE_DIREZIONE_DEBOLI:
            continue
        if re.search(r"(?<![A-Z])" + p + r"(?![A-Z])", t):
            return True
    return False


def _e_pubblicita(testo: str) -> bool:
    t = _normalizza(testo)
    return sum(1 for e in PAROLE_PUBBLICITA if re.search(e, t)) >= 1


# Parole che raccontano com'e' ANDATA un'operazione, invece di aprirne una.
# Nota su "PROFIT": da solo non si puo' usare, perche' "TAKE PROFIT" sta in ogni segnale vero.
# Si cercano solo le forme che parlano di un risultato gia' avvenuto.
PAROLE_ESITO = [
    # "HIT" in tutte le forme in cui le sale lo scrivono, COMPRESO attaccato al prezzo:
    # "GOLD SELL 1TP Hit4130" non ha confine di parola dopo HIT e prima sfuggiva - proprio il caso
    # peggiore, perche' ha strumento, direzione e un numero, e passava per un ordine.
    r"\bHIT(?:TING|TED|S)?(?![A-Z])", r"\bREACHED\b", r"RAGGIUNT", r"\bCOLPIT",
    # Come le sale festeggiano: "Tp 2 successfully", "Enjoy 100 pips", "+$595.80".
    r"\bSUCCESS(?:FUL|FULLY)?\b", r"\bENJOY\b", r"\bPROFIT\s+DONE\b", r"[+\-]\s*\$\s*\d",
    r"\bCLOSED\b", r"\bCHIUS", r"\bSECURED\b", r"\bBOOKED\b",
    r"IN\s+PROFIT", r"\bRUNNING\b", r"\bDONE\b", r"\bGAINED\b",
    # I pips, in tutte e tre le forme usate: "+99 pips", "270+ PIPS", "300 pips".
    # Un ordine vero i pips non li nomina quasi mai, e se li nomina ha comunque stop e target -
    # quindi passa lo stesso dalla scappatoia piu' sotto.
    r"[+\-]\s*\d+(?:[.,]\d+)?\s*PIPS?\b", r"\d+(?:[.,]\d+)?\s*\+?\s*PIPS?\b",
    r"\bPIPS?\s+(?:PROFIT|GAIN|LOSS)\b",
    # Come si festeggia. In un ordine non ci finiscono mai.
    r"\bBOOM\b", r"\bEASY\s+MONEY\b", r"\bLET'?S\s+GO\b", r"\bCONGRAT",
    r"\bWELL\s+DONE\b", r"\bGOOD\s+JOB\b", r"\bBANKED\b", r"\bSMASH",
    r"\bALL\s+TPS?\b", r"\bTPS?\s*\d*\s*(?:HIT|REACHED|DONE|OK)\b",
    r"\bSL\s*HIT\b", r"\bSTOP(?:PED)?\s+OUT\b",
]


# Tipo d'ordine dichiarato dalla sala. None = non l'ha detto, e allora decide chi esegue
# confrontando l'entrata con il prezzo del momento (lo sa l'app, non il parser).
#   limit = si entra a un prezzo MIGLIORE di quello attuale (piu' basso per un BUY)
#   stop  = si entra a un prezzo PEGGIORE, sulla rottura (piu' alto per un BUY)
# Le due forme vanno tenute distinte: scambiarle significa piazzare l'ordine dalla parte sbagliata
# del prezzo, dove non scattera' mai o scattera' subito.
_TIPO_LIMIT = re.compile(r"\b(?:BUY|SELL|LONG|SHORT)[ \t\-_]*LIMIT\b")
_TIPO_STOP = re.compile(r"\b(?:BUY|SELL|LONG|SHORT)[ \t\-_]*STOP\b")
_TIPO_LIMIT_SOLO = re.compile(r"\b(?:ORDINE\s+)?LIMIT(?:E)?\b")


def trova_tipo_ordine(testo: str) -> Optional[str]:
    """"limit", "stop" o None. Si guarda RIGA PER RIGA, mai il testo intero.

    Sul testo intero "\\s" scavalcherebbe gli a capo, e un segnale normale con la direzione su una
    riga e "STOP 4170" su quella dopo verrebbe letto come ordine stop.
    """
    for riga in _righe_utili(testo):
        t = _normalizza(riga)
        if _TIPO_STOP.search(t):
            return "stop"
        if _TIPO_LIMIT.search(t):
            return "limit"
    # "LIMIT" da solo su una riga sua (es. "LIMIT ORDER" come intestazione): vale solo se in quella
    # riga non c'e' anche uno stop loss, per non confondersi con le etichette dei livelli.
    for riga in _righe_utili(testo):
        t = _normalizza(riga)
        if any(re.search(e, t) for e in ETICHETTE_SL):
            continue
        if _TIPO_LIMIT_SOLO.search(t):
            return "limit"
    return None


def _e_esito(testo: str) -> bool:
    """True se il messaggio racconta come e' finita un'operazione."""
    t = _normalizza(testo)
    return any(re.search(e, t) for e in PAROLE_ESITO)


def _e_rumore(riga: str) -> bool:
    t = _normalizza(riga)
    return any(p in t for p in PAROLE_RUMORE)


def _righe_utili(testo: str):
    """Le righe del messaggio senza la parte promozionale."""
    return [r for r in str(testo or "").splitlines() if r.strip() and not _e_rumore(r)]


def _normalizza(testo: str) -> str:
    """Maiuscolo, accenti via, separatori uniformati. Non tocca i numeri."""
    t = unicodedata.normalize("NFKD", str(testo or ""))
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.upper()
    t = t.replace("–", "-").replace("—", "-").replace("−", "-")
    return t


def _numeri(testo: str) -> List[float]:
    """Tutti i numeri di una riga, virgola decimale compresa.

    Scarta quelli attaccati a un % o preceduti da # (sono percentuali e numeri d'ordine, non
    prezzi): lasciarli passare significherebbe prendere "TP 50%" per un target a 50.
    """
    out = []
    for m in re.finditer(r"(?<![\w#])(\d{1,7}(?:[.,]\d{1,6})?)", testo):
        dopo = testo[m.end():m.end() + 1]
        if dopo == "%":
            continue
        try:
            out.append(float(m.group(1).replace(",", ".")))
        except ValueError:
            pass
    return out


def _primo_numero(testo: str) -> Optional[float]:
    n = _numeri(testo)
    return n[0] if n else None


def _intervallo(testo: str):
    """Riconosce "4141-4144" e la forma abbreviata "4156-58" (= 4156-4158).

    L'abbreviazione e' comune quando la fascia e' stretta: si scrivono solo le cifre finali. Si
    completa prendendo le cifre iniziali dal primo numero. Se il risultato non fosse coerente
    (estremo destro minore del sinistro) si lascia perdere invece di indovinare.
    """
    m = re.search(
        r"(?<![\w.])(\d{2,7}(?:[.,]\d{1,5})?)\s*[-/]\s*(\d{1,7}(?:[.,]\d{1,5})?)(?![\w.%])",
        str(testo or ""))
    if not m:
        return None
    try:
        a = float(m.group(1).replace(",", "."))
        grezzo_b = m.group(2)
        b = float(grezzo_b.replace(",", "."))
    except ValueError:
        return None
    if b < a:
        # forma abbreviata: si completa con il prefisso del primo ("4156" + "58" -> "4158")
        interi_a = m.group(1).split(".")[0].split(",")[0]
        interi_b = grezzo_b.split(".")[0].split(",")[0]
        if len(interi_b) < len(interi_a):
            prefisso = interi_a[: len(interi_a) - len(interi_b)]
            try:
                b = float((prefisso + grezzo_b).replace(",", "."))
            except ValueError:
                return None
    if not (b > a):
        return None
    return (a, b)


def _strumento_in(riga: str) -> Optional[str]:
    """L'alias riconosciuto in UNA riga, dando la precedenza a quelli piu' lunghi.

    L'ordine conta: senza di esso "XAUUSD" verrebbe riconosciuto come "XAU" e "USTEC100" come
    "USTEC", producendo uno strumento diverso da quello scritto.
    """
    t = _normalizza(riga)
    for alias in sorted(ALIAS_STRUMENTI, key=len, reverse=True):
        # confine di parola su entrambi i lati: evita che "USOIL" scatti dentro "HOUSOIL"
        if re.search(r"(?<![A-Z0-9])" + re.escape(alias) + r"(?![A-Z0-9])", t):
            return ALIAS_STRUMENTI[alias]
    return None


def trova_strumento(testo: str) -> Optional[str]:
    """Lo strumento dell'ordine, ignorando quelli citati nelle righe promozionali.

    Se nel messaggio ne compaiono piu' d'uno vince quello scritto SULLA RIGA DELLA DIREZIONE:
    e' li' che sta l'ordine. Senza questa precedenza, un messaggio di AUD/JPY che in fondo
    pubblicizza "Our XAUUSD Channel" faceva aprire ORO - errore vero, preso su un messaggio vero.
    """
    righe = _righe_utili(testo)
    for riga in righe:
        if trova_direzione(riga) is not None:
            st = _strumento_in(riga)
            if st:
                return st
    for riga in righe:
        st = _strumento_in(riga)
        if st:
            return st
    return None


def trova_direzione(testo: str) -> Optional[str]:
    """BUY o SELL. Prima le parole, poi le emoji: una parola esplicita batte un pallino colorato."""
    t = _normalizza(testo)
    for p in PAROLE_ACQUISTO:
        if re.search(r"(?<![A-Z])" + p + r"(?![A-Z])", t):
            return "BUY"
    for p in PAROLE_VENDITA:
        if re.search(r"(?<![A-Z])" + p + r"(?![A-Z])", t):
            return "SELL"
    testo_orig = str(testo or "")
    for e in EMOJI_ACQUISTO:
        if e in testo_orig:
            return "BUY"
    for e in EMOJI_VENDITA:
        if e in testo_orig:
            return "SELL"
    return None


# Etichette usate dalle sale per ciascun campo. Ordine: dalla piu' specifica alla piu' generica.
#
# L'INDICE DEI TARGET, tre volte fonte di errori. Le sale numerano i target in tutti i modi:
# "TP1 4138", "TP 2: 4135", "Obiettivo 1: 20400", "TP: 4129.5", "TP 4310".
#   - Scrivere l'indice come `\s*\d*` faceva mangiare all'etichetta la prima cifra del valore:
#     "TP 1,2850" diventava "TP 1" + ",2850", e il target leggeva 2850.
#   - Metterci un `\b` finale spezzava tutto il resto: fra "TP" e "1" non c'e' nessun confine di
#     parola, quindi "TP1 4138" non veniva riconosciuto affatto e il target spariva.
# Regola finale, semplice: si consumano SOLO le cifre ATTACCATE all'etichetta (TP1, TP2), perche'
# quelle sono per forza un numero d'ordine. L'indice scritto staccato ("TP 1: 4138") lo toglie
# invece la regola dei valori piu' sotto, che scarta un intero piccolo seguito da altri numeri.
ETICHETTE_SL = [r"STOP\s*LOSS", r"\bSL\d{0,2}", r"\bS/L\b", r"\bSTOPLOSS\d{0,2}", r"\bSTOP\b"]
ETICHETTE_TP = [r"TAKE\s*PROFIT\d{0,2}", r"\bTP\d{0,2}", r"\bT/P\b",
                r"\bTARGET\d{0,2}", r"\bOBIETTIVO\d{0,2}"]
ETICHETTE_ENTRATA = [r"\bENTRY\b", r"\bENTRATA\b", r"\bENTER\b", r"\bPREZZO\b", r"\bPRICE\b", r"\bE\s*:\b", r"\bINGRESSO\b"]


def _fascia_target(coda: str, direzione: Optional[str]):
    """Un target scritto come FASCIA ("4155-45", "4155-4145"): restituisce (vicino, lontano),
    ordinati dall'entrata verso l'esterno (per un SELL prima il piu' alto, per un BUY il piu'
    basso). Le cifre abbreviate si completano col prefisso del primo numero (45 -> 4145): prima
    "3/TAKE PROFIT 4155-45" diventava un target a 4155 e un quarto target a 45 DOLLARI. Cosa farne
    lo decide interpreta(): sull'ULTIMO target diventano due target, altrove vale il vicino.
    Se i due numeri non sono una fascia plausibile (distanti piu' del 5%, es. "1-4138") None."""
    if direzione not in ("BUY", "SELL"):
        return None
    m = re.search(r"(?<![\w.])(\d{1,7}(?:[.,]\d{1,5})?)\s*[-\u2013\u2014/]\s*(\d{1,7}(?:[.,]\d{1,5})?)(?![\w.%])", coda)
    if not m:
        return None
    try:
        a = float(m.group(1).replace(",", "."))
        grezzo_b = m.group(2)
        interi_a = m.group(1).split(".")[0].split(",")[0]
        interi_b = grezzo_b.split(".")[0].split(",")[0]
        if len(interi_b) < len(interi_a):
            grezzo_b = interi_a[: len(interi_a) - len(interi_b)] + grezzo_b
        b = float(grezzo_b.replace(",", "."))
    except ValueError:
        return None
    if a <= 0 or b <= 0 or a == b or abs(a - b) / max(a, b) > 0.05:
        return None
    return (max(a, b), min(a, b)) if direzione == "SELL" else (min(a, b), max(a, b))


def _valori_per_etichetta(righe: List[str], etichette: List[str], direzione: Optional[str] = None,
                          fasce: Optional[dict] = None) -> List[float]:
    """Tutti i numeri che seguono una delle etichette, riga per riga.

    Si lavora per RIGHE e non sul testo intero di proposito: nei messaggi reali ogni campo sta
    sulla sua riga, e cercare "il numero dopo SL" su tutto il testo prenderebbe volentieri il
    numero di un altro campo piu' in basso.
    """
    out: List[float] = []
    for riga in righe:
        t = _normalizza(riga)
        for et in etichette:
            m = re.search(et, t)
            if not m:
                continue
            coda = riga[m.end():]
            # Target a fascia: un solo valore, l'estremo piu' vicino all'entrata.
            fascia = _fascia_target(coda, direzione)
            if fascia is not None:
                if fasce is not None:
                    fasce[len(out)] = fascia[1]      # l'estremo lontano, per chi decide dopo
                out.append(fascia[0])
                break
            # niente numero dopo l'etichetta sulla stessa riga: spesso sta sulla riga dopo,
            # ma quel caso lo gestisce il chiamante guardando la riga successiva.
            valori = _numeri(coda)
            # Indice rimasto attaccato al valore ("TP1 1.0880"): un intero piccolo seguito da altri
            # numeri sulla stessa riga e' un numero d'ordine, non un prezzo. Si scarta solo se c'e'
            # davvero un valore dopo - altrimenti "TP 3" resta un target a 3, che su un indice o
            # una cripto puo' essere un prezzo legittimo.
            if len(valori) > 1 and float(valori[0]).is_integer() and 1 <= valori[0] <= 9:
                valori = valori[1:]
            out.extend(valori)
            break
    return out


# =====================================================================================
# MESSAGGI DI AGGIUNTA ("ADD MORE SELL", "Let's Gooo Again SELL")
# =====================================================================================
# Non sono segnali nuovi: si riferiscono a una posizione gia' aperta, e la sala NON ripete ne'
# strumento ne' prezzi. Da soli non contengono abbastanza per un ordine - per questo `interpreta`
# continua giustamente a rifiutarli - ma buttarli via del tutto perderebbe un'informazione che
# l'utente vuole: la sala sta raddoppiando.
# Qui si riconoscono soltanto; e' il ponte a collegarli all'ultimo segnale di QUELLA sala.
PAROLE_AGGIUNTA = [
    "ADD MORE", "ADD ", "AGGIUNGI", "RADDOPPIA", "DOUBLE DOWN", "AGAIN",
    "ANCORA", "SECOND ENTRY", "RE-ENTRY", "REENTRY", "SCALE IN",
]
# Un messaggio di aggiunta e' corto per natura. La soglia serve a non scambiare per un raddoppio
# un'analisi lunga che per caso contiene "again" e la parola "sell".
LUNGHEZZA_MAX_AGGIUNTA = 160


def riconosci_aggiunta(testo: str) -> Optional[dict]:
    """Riconosce un invito ad aggiungere alla posizione in corso. None se non lo e'.

    Tre condizioni, tutte necessarie: una formula di aggiunta, una direzione, e il fatto che il
    messaggio NON sia gia' un segnale completo (quello lo gestisce `interpreta`).
    """
    if not testo or not str(testo).strip():
        return None
    righe = _righe_utili(testo)
    if not righe:
        return None
    pulito = "\n".join(righe)
    if len(pulito) > LUNGHEZZA_MAX_AGGIUNTA:
        return None
    if interpreta(testo) is not None:
        return None  # ha gia' tutto: e' un segnale, non un'aggiunta
    t = _normalizza(pulito)
    parola = next((p for p in PAROLE_AGGIUNTA if p in t), None)
    if not parola:
        return None
    direzione = trova_direzione(pulito)
    if not direzione:
        return None
    return {"direzione": direzione, "formula": parola.strip(), "testo": pulito.strip()}


# =====================================================================================
# CASI DELLE SALE SEGUITE (segnalati con esempi veri)
# =====================================================================================

# SECONDA ENTRATA: "GOLD BUY NOW @ 4183 / MORE BUY @ 4173". La sala apre subito e chiede un
# secondo ordine piu' in basso (piu' in alto per un SELL), con lo STESSO stop e gli stessi target.
# La riga della seconda entrata non e' l'entrata principale: va tolta dalla ricerca dell'entrata.
_SECONDA_ENTRATA = re.compile(
    r"\b(?:MORE|ADD|ANOTHER|EXTRA|SECOND|2ND|ALTRO|ANCORA)\s+(?:BUY|SELL|LONG|SHORT|COMPRA|VENDI)\b"
    r"|\b(?:BUY|SELL)\s+(?:MORE|AGAIN)\b")


def _e_seconda_entrata(riga: str) -> bool:
    return bool(_SECONDA_ENTRATA.search(_normalizza(riga)))


# TARGET CON L'INDICE ATTACCATO AL PREZZO: "TP14181" e' TP1 a 4181, non TP14 a 181. Si sceglie la
# lettura il cui prezzo e' della stessa grandezza degli altri prezzi del messaggio.
_TP_ATTACCATO = re.compile(r"(?<![A-Z])(TP|T/P)(\d{4,9}(?:[.,]\d+)?)(?![\d])", re.IGNORECASE)


def _stacca_indici_tp(righe: List[str]) -> List[str]:
    altri = []
    for r in righe:
        if _TP_ATTACCATO.search(r):
            continue
        altri += [n for n in _numeri(r) if n >= 10]
    if not altri:
        return righe
    altri.sort()
    rif = altri[len(altri) // 2]

    def sistema(m):
        cifre = m.group(2)
        intero = cifre.split(".")[0].split(",")[0]
        candidati = [("", cifre)]
        for k in (1, 2):
            if len(intero) - k >= 2:
                candidati.append((cifre[:k], cifre[k:]))
        def distanza(c):
            try:
                v = float(c[1].replace(",", "."))
            except ValueError:
                return 1e9
            return abs(v - rif) / max(rif, 1e-9) if v > 0 else 1e9
        idx, val = min(candidati, key=distanza)
        return m.group(1) + idx + " " + val

    return [_TP_ATTACCATO.sub(sistema, r) for r in righe]


def _scarta_target_fuori_sequenza(tps: List[float], direzione: str):
    """Un target che rompe la sequenza ("4187, 4291, 4195, 4199": un 1 battuto come 2) si toglie,
    se togliendolo la sequenza torna ordinata e se e' davvero lontano dagli altri. Uno solo."""
    if len(tps) < 3:
        return tps, None
    cresce = direzione == "BUY"
    def ordinata(v):
        return all((v[i] < v[i + 1]) if cresce else (v[i] > v[i + 1]) for i in range(len(v) - 1))
    if ordinata(tps):
        return tps, None
    for i in range(len(tps)):
        resto = tps[:i] + tps[i + 1:]
        if not ordinata(resto):
            continue
        passi = sorted(abs(resto[j + 1] - resto[j]) for j in range(len(resto) - 1)) or [0]
        passo = passi[len(passi) // 2] or 1e-9
        vicini = [resto[i - 1]] if i > 0 else []
        if i < len(resto):
            vicini.append(resto[i])
        if vicini and min(abs(tps[i] - v) for v in vicini) > 3 * passo:
            return resto, ("target %s scartato: fuori sequenza rispetto agli altri (probabile errore di battitura della sala)"
                           % (int(tps[i]) if float(tps[i]).is_integer() else tps[i]))
    return tps, None


def _deduci_direzione(righe: List[str]) -> Optional[str]:
    """La direzione quando la sala la scrive con un'IMMAGINE (lettere-sticker di Telegram che
    nel testo arrivano come segnaposto): si ricava dai livelli. Stop SOPRA tutti i target = SELL,
    stop SOTTO = BUY; se c'e' l'entrata deve stare fra stop e target. Senza stop o senza target non
    si deduce niente."""
    sl_vals = _valori_per_etichetta(righe, ETICHETTE_SL)
    tps = _valori_per_etichetta(righe, ETICHETTE_TP)
    if not sl_vals or not tps:
        return None
    sl = sl_vals[0]
    if all(t < sl for t in tps):
        d = "SELL"
    elif all(t > sl for t in tps):
        d = "BUY"
    else:
        return None
    entry = _valori_per_etichetta(righe, ETICHETTE_ENTRATA)
    for riga in righe:
        if any(re.search(e, _normalizza(riga)) for e in ETICHETTE_ENTRATA):
            iv = _intervallo(riga)
            if iv:
                entry = [iv[0], iv[1]]
            break
    for e in entry[:2]:
        if d == "SELL" and not (min(tps) < e < sl):
            return None
        if d == "BUY" and not (sl < e < max(tps)):
            return None
    return d


def interpreta(testo: str) -> Optional[dict]:
    """Da testo libero a segnale strutturato. None se non e' un segnale riconoscibile."""
    if not testo or not str(testo).strip():
        return None
    grezzo = str(testo)
    # Le righe promozionali sono gia' fuori: contengono numeri (importi, codici di invito) che
    # altrimenti finirebbero fra i prezzi.
    righe = _righe_utili(grezzo)

    # Strumento e direzione si cercano solo nelle righe UTILI: la riga pubblicitaria ("🚀 Get FREE
    # VIP") e' gia' esclusa per i prezzi, e deve esserlo anche per la direzione - il suo razzo
    # veniva letto come un BUY.
    testo_utile = "\n".join(righe)
    strumento = trova_strumento(testo_utile)
    direzione = trova_direzione(testo_utile)
    direzione_dedotta = False
    if strumento and not direzione:
        # Direzione scritta con un'immagine (segnalato: "XAUUSD [SELL in lettere-sticker] SETUP"):
        # la si ricava dai livelli, solo se stop, target (ed entrata) sono tutti coerenti.
        direzione = _deduci_direzione(righe)
        direzione_dedotta = direzione is not None
    # Senza strumento o senza direzione non c'e' niente da eseguire: meglio nessun segnale che un
    # segnale a meta' che qualcuno potrebbe confermare per distrazione.
    if not strumento or not direzione:
        return None

    riconosciuto = ["strumento", "direzione_dedotta" if direzione_dedotta else "direzione"]

    # La riga che dichiara il tipo d'ordine ("BUY STOP 4200", "SELL LIMIT 4180") NON e' la riga
    # dello stop loss, anche se contiene la parola STOP: il suo numero e' il prezzo d'ENTRATA.
    # Senza questa esclusione quel numero finiva nello stop loss e il vero SL veniva perso.
    def _e_riga_tipo(riga: str) -> bool:
        t = _normalizza(riga)
        return bool(_TIPO_STOP.search(t) or _TIPO_LIMIT.search(t))

    righe_livelli = _stacca_indici_tp([r for r in righe if not _e_riga_tipo(r) and not _e_seconda_entrata(r)])
    sl_vals = _valori_per_etichetta(righe_livelli, ETICHETTE_SL)
    fasce_tp: dict = {}
    tp_vals = _valori_per_etichetta(righe_livelli, ETICHETTE_TP, direzione, fasce_tp)
    # RICHIESTO: se l'ULTIMO target e' una fascia ("3/TAKE PROFIT 4155-45") diventa DUE target -
    # TP3 al primo estremo (4155) e TP4 al secondo (4145). Sulle righe prima dell'ultima resta un
    # target solo, all'estremo piu' vicino all'entrata: quelli raggiunti prima.
    ultimo = len(tp_vals) - 1
    if ultimo in fasce_tp:
        tp_vals.append(fasce_tp[ultimo])
    # La riga della seconda entrata ("MORE BUY @ 4173") non e' l'entrata principale.
    righe_entrata = [r for r in righe if not _e_seconda_entrata(r)]
    entry_vals = _valori_per_etichetta(righe_entrata, ETICHETTE_ENTRATA)
    # Il prezzo scritto sulla riga del tipo e' l'entrata, se non e' gia' stata trovata altrove.
    if not entry_vals:
        for riga in righe:
            if not _e_riga_tipo(riga):
                continue
            n_riga = _numeri(riga)
            if n_riga:
                entry_vals = [n_riga[0]]
                break

    # Caso frequente: l'etichetta e' su una riga e il numero su quella dopo ("SL:" / "2660").
    # La riga dopo deve essere SOLO un prezzo ("2660", ": 2660", "@ 4183.5"). Segnalato: "SL" e "TP"
    # vuoti e sotto "ONLY 15 PEOPLE ALLOWED" -> il 15 era diventato il take profit di un SELL a 4280.
    for i, riga in enumerate(righe[:-1]):
        t = _normalizza(riga)
        if not re.match(r"^\s*[@:=\-\u2192>]*\s*\d[\d.,\s]*\s*$", righe[i + 1]):
            continue
        dopo = _primo_numero(righe[i + 1])
        if dopo is None:
            continue
        if not _numeri(riga):
            if any(re.search(e, t) for e in ETICHETTE_SL) and not sl_vals:
                sl_vals = [dopo]
            elif any(re.search(e, t) for e in ETICHETTE_TP) and not tp_vals:
                tp_vals = [dopo]

    # L'entrata puo' non avere etichetta: "BUY GOLD 2650" o "EURUSD BUY @ 1.0850".
    entrata = entry_vals[0] if entry_vals else None
    entrata_max = None
    # Fascia d'entrata: la si cerca sulla riga dell'etichetta o su quella della direzione, mai
    # sulle righe dei target (dove un "4138-4135" non esiste, ma meglio non rischiare).
    for riga in righe_entrata:
        t_riga = _normalizza(riga)
        if any(re.search(e, t_riga) for e in ETICHETTE_SL):
            continue
        if any(re.search(e, t_riga) for e in ETICHETTE_TP):
            continue
        if not (any(re.search(e, t_riga) for e in ETICHETTE_ENTRATA) or trova_direzione(riga) is not None):
            continue
        iv = _intervallo(riga)
        if iv:
            entrata, entrata_max = iv
            break
    tipo_ordine = trova_tipo_ordine(grezzo)
    a_mercato = False
    if entrata is None:
        # Solo nelle righe UTILI: "For TP and SL Join Now" (pubblicita') faceva credere a un ordine
        # a mercato e il prezzo scritto dalla sala ("Gold SELL 4162") andava perso.
        t = _normalizza(testo_utile)
        # "MARKET" da solo non basta: compare in "market update", "market analysis". Vale solo
        # nelle forme che chiedono davvero un'esecuzione ("AT MARKET", "MARKET ORDER", "BUY MARKET").
        if re.search(r"\b(NOW|A\s*MERCATO|AL\s+MERCATO|AT\s+MARKET|@\s*MARKET|MARKET\s+(?:PRICE|EXECUTION|ORDER)"
                     r"|(?:BUY|SELL)\s+MARKET|ADESSO|SUBITO|INSTANT)\b", t):
            a_mercato = True
        # Il prezzo della sala si tiene anche quando e' a mercato ("Sell NOW: 4162", "BUY NOW / @
        # 4183"): primo numero sulla riga della direzione o su una riga che comincia con "@",
        # esclusi quelli gia' assegnati a stop e target e la riga della seconda entrata.
        if entrata is None:
            assegnati = set(sl_vals) | set(tp_vals)
            for riga in righe_entrata:
                tl = _normalizza(riga)
                if any(re.search(e, tl) for e in ETICHETTE_SL + ETICHETTE_TP):
                    continue
                if trova_direzione(riga) is None and not riga.strip().startswith("@"):
                    continue
                for n in _numeri(riga):
                    if n not in assegnati:
                        entrata = n
                        break
                if entrata is not None:
                    break

    if entrata is not None:
        riconosciuto.append("entrata")
    if entrata_max is not None:
        riconosciuto.append("entrata_fascia")
    # Un ordine limite/stop non e' "a mercato", qualunque parola ci sia nel messaggio: si entra a
    # un prezzo preciso, piu' tardi.
    if tipo_ordine:
        a_mercato = False
        riconosciuto.append("tipo_" + tipo_ordine)
    if a_mercato:
        riconosciuto.append("a_mercato")
    if sl_vals:
        riconosciuto.append("stop_loss")
    if tp_vals:
        riconosciuto.append("take_profit")

    # ---- CONTROLLO DI COERENZA: i numeri devono stare dalla parte giusta.
    # E' il filtro che intercetta gli scambi di campo, il tipo di errore piu' costoso qui dentro:
    # uno stop messo dove va il target trasforma una perdita limitata in una senza fondo.
    avvisi: List[str] = []
    if direzione_dedotta:
        avvisi.append("direzione dedotta dai livelli: la sala la scrive con un'immagine (stop %s target)"
                      % ("sopra i" if direzione == "SELL" else "sotto i"))
    sl = sl_vals[0] if sl_vals else None
    # PREZZI FUORI SCALA: uno stop o un target a piu' del 20% dall'entrata non e' un prezzo ma un
    # numero qualunque del messaggio (persone ammesse, percentuali, orari). Si scarta, con avviso.
    if entrata is not None and entrata > 0:
        fuori = [v for v in tp_vals if abs(v - entrata) / entrata > 0.2]
        if fuori:
            avvisi.append("target fuori scala scartati: %s" % ", ".join("%g" % v for v in fuori))
            tp_vals = [v for v in tp_vals if v not in fuori]
        if sl is not None and abs(sl - entrata) / entrata > 0.2:
            avvisi.append("stop loss fuori scala scartato: %g" % sl)
            sl = None
    tps, scarto = _scarta_target_fuori_sequenza([v for v in tp_vals], direzione)
    if scarto:
        avvisi.append(scarto)

    # SECONDA ENTRATA ("MORE BUY @ 4173"): un ordine in piu' allo stesso stop e agli stessi
    # target. LIMIT se e' a un prezzo migliore della prima entrata (piu' basso per un BUY), STOP
    # se e' peggiore; senza prima entrata, limite.
    ordini_aggiuntivi = []
    for riga in righe:
        if not _e_seconda_entrata(riga):
            continue
        n_riga = [n for n in _numeri(riga) if n >= 1]
        if not n_riga:
            continue
        prezzo = n_riga[0]
        tipo = "limit"
        if entrata is not None:
            migliore = prezzo < entrata if direzione == "BUY" else prezzo > entrata
            tipo = "limit" if migliore else "stop"
        ordini_aggiuntivi.append({"tipo_ordine": tipo, "entrata": prezzo, "riga": riga.strip()})
    rif = entrata if entrata is not None else (tps[0] if tps else sl)
    if sl is not None and rif is not None:
        if direzione == "BUY" and sl >= rif:
            avvisi.append("lo stop loss non e' sotto l'entrata")
        if direzione == "SELL" and sl <= rif:
            avvisi.append("lo stop loss non e' sopra l'entrata")
    if entrata is not None:
        for tp in tps:
            if direzione == "BUY" and tp <= entrata:
                avvisi.append("un take profit non e' sopra l'entrata")
                break
            if direzione == "SELL" and tp >= entrata:
                avvisi.append("un take profit non e' sotto l'entrata")
                break
    if sl is None:
        avvisi.append("rischio_non_definito: nessuno stop loss nel messaggio")

    # ---- CONFIDENZA: quanto ci si puo' fidare di questa lettura.
    confidenza = 40  # strumento + direzione, il minimo per esistere
    if entrata is not None or a_mercato:
        confidenza += 20
    if sl is not None:
        confidenza += 25
    if tps:
        confidenza += 15
    confidenza -= 25 * len([a for a in avvisi if not a.startswith("rischio_non_definito")])
    confidenza = max(0, min(100, confidenza))

    # DIREZIONE SOLO DA EMOJI (segnalato: "🎯 XAUUSD 🚀 4-6 Daily Accurate Signals 📊" aperto come
    # BUY, il razzo come direzione e "4-6" come fascia d'entrata). Senza BUY/SELL in lettere il
    # messaggio e' un ordine solo se ha stop loss E almeno un target: un'emoji non basta mai per
    # aprire "a mercato" o con lo stop calcolato dall'app.
    a_parole = _direzione_a_parole(testo_utile)
    if not a_parole and not direzione_dedotta and not (sl is not None and tps):
        return None
    # Direzione solo DESCRITTA ("bias: Bullish"): basta solo con un ordine completo, stop e target.
    forte = _direzione_forte(testo_utile)
    if not forte and not (sl is not None and tps):
        return None
    # Messaggio di ANALISI: vale solo con la parola operativa E almeno un target.
    if _e_analisi(grezzo) and not (forte and tps):
        return None

    # NESSUN PREZZO = NESSUN ORDINE. Senza entrata, stop loss e target non c'e' niente da eseguire
    # (l'unica eccezione e' l'ordine a mercato dichiarato, "BUY GOLD NOW"). E se il messaggio ha
    # l'aria di una pubblicita', anche "a mercato" non basta: "market" compare in mille frasi.
    ha_livelli = entrata is not None or sl is not None or bool(tps)
    if not ha_livelli and (not a_mercato or _e_pubblicita(grezzo)):
        return None
    # Pubblicita' con qualche numero dentro ("17 key GOLD patterns", "Real XAUUSD examples"): si
    # accetta solo se e' comunque un ordine completo, con stop loss e almeno un target.
    if _e_pubblicita(grezzo) and not (sl is not None and tps):
        return None

    # Messaggio di ESITO ("TP1 HIT", "CLOSED +120 PIPS"): non e' un ordine. Si lascia passare solo
    # se e' comunque un ordine inequivocabile - direzione, strumento, stop loss e almeno un target
    # tutti presenti. Senza uno di quelli e' un commento, e un commento non deve diventare una
    # posizione.
    if _e_esito(grezzo):
        completo = (direzione is not None and strumento is not None
                    and sl is not None and bool(tps))
        if not completo:
            return None

    return {
        "strumento": strumento,
        "direzione": direzione,
        "entrata": entrata,
        # Estremo superiore quando la sala indica una FASCIA invece di un prezzo secco. None
        # quando l'entrata e' un prezzo solo: chi esegue decide se usare la fascia o il primo
        # prezzo, ma il dato non va perso per strada.
        "entrata_max": entrata_max,
        "a_mercato": a_mercato,
        # BUY/SELL scritto in lettere (non un'emoji, non dedotto dai livelli): l'app apre senza stop
        # e senza target SOLO in questo caso.
        "direzione_esplicita": a_parole,
        # "limit", "stop" o None (la sala non l'ha detto: decide chi esegue, confrontando l'entrata
        # con il prezzo del momento).
        "tipo_ordine": tipo_ordine,
        "stop_loss": sl,
        "take_profit": tps,
        # Ordini in piu' chiesti dalla sala nello stesso messaggio ("MORE BUY @ 4173"): il ponte li
        # trasforma in segnali a parte, con lo stesso stop e gli stessi target.
        "ordini_aggiuntivi": ordini_aggiuntivi,
        "confidenza": confidenza,
        "riconosciuto": riconosciuto,
        "avvisi": avvisi,
        # Il testo originale viaggia SEMPRE: chi conferma deve poter leggere cosa e' arrivato
        # davvero, non solo come lo abbiamo capito noi.
        "testo": grezzo.strip(),
    }
