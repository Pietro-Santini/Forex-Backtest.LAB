"""IL MERCATO DI UNO STRUMENTO E' APERTO ADESSO? — e perche' la prima cura non funzionava.

SEGNALATO DAL PROPRIETARIO (3 novembre 2026): «ogni asset apre e chiude in fasce orarie diverse.
NZD/CAD adesso il mercato e' aperto e invece l'app dice che e' chiuso e apre tra 17 minuti a
mezzanotte. Ed e' impossibile, perche' sul terminale MT5 il mercato e' aperto e il P/L live si
aggiorna.»

LA PRIMA CURA (v2.0.71) ERA INERTE, e questo test esiste perche' non si ripeta. Leggeva
`getattr(info, "trade_allowed", False)`: quel campo su `mt5.symbol_info()` NON ESISTE — sta su
`terminal_info()` e `account_info()`, che parlano del terminale e del conto, non del simbolo.
Il getattr restituiva quindi sempre il valore di ripiego, FALSO, per ogni strumento e a
qualunque ora. Misurato con la libreria vera (MetaTrader5 5.0.6231):

    'trade_allowed' in mt5.symbol_info('EURUSD')._asdict()   ->   False

Nessun test guardava quella rotta, e il difetto e' sopravvissuto a una versione pubblicata.

LA REGOLA DI ADESSO, deliberatamente asimmetrica (sbagliare nei due versi non costa uguale):
  - APERTO certo: il tick e' fresco. E' la prova piu' forte che esista.
  - CHIUSO certo: SOLO se il broker dichiara il simbolo non negoziabile.
  - NON SO: tutto il resto -> l'app resta sull'orario fisso, cioe' si comporta come prima.
"""
import os
import sys
import time
import types

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))


class _FintoMt5:
    """MetaTrader5 finto, quanto basta per IMPORTARE mt5_feed_server anche dove la libreria vera
    non c'e' (il collaudo di GitHub gira su Ubuntu). Il modulo, appena importato, costruisce la
    tabella dei timeframe leggendo mt5.TIMEFRAME_*: senza quelle costanti l'import esplode prima
    ancora di arrivare al codice che ci interessa. Qui qualunque TIMEFRAME_* vale 1 — non serve
    che siano i numeri veri, serve che esistano."""
    SYMBOL_TRADE_MODE_DISABLED = 0

    # Queste tre esistono per nome invece di cadere nel ripiego qui sotto: il modulo le cerca
    # all'import e durante le prove, e una lambda generica le farebbe passare in silenzio.
    # (Chi deve contare le chiamate non usa questo stub: monta _Terminale piu' sotto.)
    def symbol_select(self, *a, **k):
        return True

    def symbol_info_tick(self, *a, **k):
        return None

    def symbol_info(self, *a, **k):
        return None

    def __getattr__(self, nome):
        if nome.startswith("TIMEFRAME_"):
            return 1
        if nome.isupper():
            return 0
        return lambda *a, **k: None


def _feed():
    """Importa mt5_feed_server, qualunque finto MetaTrader5 abbia gia' messo un ALTRO test.

    SCOPERTO FACENDO GIRARE IL COLLAUDO INTERO: da solo questo file passava, dentro la cartella
    falliva tutto. `test_aggiorna_programma.py` installa in sys.modules un finto MetaTrader5 che
    gli basta per bridge.py (un SimpleNamespace con quattro funzioni) ma che NON ha le costanti
    TIMEFRAME_*; mt5_feed_server, appena importato, costruisce la tabella dei timeframe leggendo
    proprio quelle, e l'import esplodeva prima di arrivare al codice da provare. Chi gira prima
    decideva l'esito: un test che dipende dall'ordine non sorveglia niente.

    Qui non si sostituisce lo stub altrui (altri moduli ci hanno gia' legato il loro `mt5`): gli
    si AGGIUNGE quello che manca, finche' l'import non passa. Si impara dall'errore invece di
    tenere a mano un elenco di costanti che un domani cambierebbe."""
    if "MetaTrader5" not in sys.modules:
        sys.modules["MetaTrader5"] = _FintoMt5()
    finto = sys.modules["MetaTrader5"]
    # E QUELLO CHE SERVE A RUNTIME, non solo all'import. Lo stub dell'altro test non ha
    # symbol_info_tick: leggerlo solleva AttributeError, che _mercato_aperto_adesso inghiotte
    # col suo `except Exception: pass` (giusto in produzione — quella funzione non deve mai far
    # cadere una rotta) e restituisce "non lo so". Il test vedeva la risposta prudente e la
    # scambiava per un difetto della cura. Qui si completa lo stub, cosi' si misura il codice e
    # non il banco.
    for nome, ripiego in (("symbol_info_tick", lambda *a, **k: None),
                          ("symbol_select", lambda *a, **k: True),
                          ("symbol_info", lambda *a, **k: None),
                          ("SYMBOL_TRADE_MODE_DISABLED", 0)):
        if not hasattr(finto, nome):
            setattr(finto, nome, ripiego)
    for _ in range(80):
        try:
            import mt5_feed_server
            return mt5_feed_server
        except AttributeError as e:
            # "'...' object has no attribute 'TIMEFRAME_M1'" -> si aggiunge e si riprova.
            testo = str(e)
            if "has no attribute" not in testo:
                raise
            nome = testo.rsplit("'", 2)[1]
            setattr(finto, nome, 1)
            sys.modules.pop("mt5_feed_server", None)
    raise AssertionError("non riesco a importare mt5_feed_server col MetaTrader5 finto")


def _info(trade_mode=4, select=True):
    return types.SimpleNamespace(trade_mode=trade_mode, select=select, visible=select)


def _tick(epoch):
    return types.SimpleNamespace(time=epoch, bid=1.1, ask=1.1)


def test_il_campo_trade_allowed_non_esiste_su_symbol_info():
    """LA PROVA CHE LA CURA PRECEDENTE ERA INERTE, scritta una volta per tutte.

    Se un domani qualcuno rimettesse `getattr(info, "trade_allowed", False)`, questo test
    spiega in una riga perche' quel numero non vuol dire niente: il campo non c'e', e il
    getattr restituisce il ripiego — cioe' "chiuso" — sempre."""
    info = _info()
    assert not hasattr(info, "trade_allowed"), (
        "symbol_info non ha trade_allowed: quel campo sta su terminal_info/account_info")
    assert getattr(info, "trade_allowed", False) is False, (
        "ecco il difetto: il ripiego e' False, quindi ogni simbolo risultava sempre chiuso")


def test_tick_fresco_vuol_dire_mercato_aperto(monkeypatch):
    """IL CASO DEL PROPRIETARIO. NZD/CAD sta quotando adesso: il ponte deve dire APERTO, e
    l'app smettere di annunciare una riapertura a mezzanotte."""
    F = _feed()
    adesso = time.time()
    monkeypatch.setattr(F, "_mt5_call", lambda fn, *a: _tick(adesso + 7200))
    monkeypatch.setattr(F, "_server_time_offset_seconds", lambda tick: 7200)
    r = F._mercato_aperto_adesso("NZDCAD", _info())
    assert r["mercato_aperto"] is True, r
    assert r["trade_allowed"] is True, "l'app legge ancora questo campo: deve dire vero"


def test_simbolo_non_negoziabile_e_l_unico_chiuso_certo(monkeypatch):
    """CHIUSO si dice solo quando il broker lo dichiara, non quando lo si deduce."""
    F = _feed()
    monkeypatch.setattr(F.mt5, "SYMBOL_TRADE_MODE_DISABLED", 0, raising=False)
    r = F._mercato_aperto_adesso("XAUUSD", _info(trade_mode=0))
    assert r["mercato_aperto"] is False, r
    assert r["trade_allowed"] is False


def test_silenzio_lungo_non_e_una_prova_di_chiusura(monkeypatch):
    """PROVA DI CONTROLLO, ed e' la piu' importante. Uno strumento poco liquido puo' tacere per
    minuti a mercato apertissimo: far congelare il grafico per quello sarebbe un danno peggiore
    del difetto che stiamo curando. Qui la risposta deve essere "non lo so" (None), cosi' l'app
    resta sull'orario fisso e al peggio si comporta come prima — mai "chiuso" inventato."""
    F = _feed()
    adesso = time.time()
    vecchio = adesso + 7200 - 3600          # ultimo tick di un'ora fa, in ora del server
    monkeypatch.setattr(F, "_mt5_call", lambda fn, *a: _tick(vecchio))
    monkeypatch.setattr(F, "_server_time_offset_seconds", lambda tick: 7200)
    r = F._mercato_aperto_adesso("XAUUSD", _info())
    assert r["mercato_aperto"] is None, r
    assert r["trade_allowed"] is None, "deve essere 'non lo so', MAI un falso che sa di certezza"
    assert r["tick_eta_s"] > 3000, "e deve comunque dire quanto e' vecchio, per poterlo capire"


def test_senza_lo_scarto_del_broker_non_si_inventa_niente(monkeypatch):
    """PROVA DI CONTROLLO. L'eta' del tick si misura contro l'orologio del BROKER: senza quello
    il conto darebbe due ore di differenza solo per il fuso, e ogni simbolo risulterebbe muto."""
    F = _feed()
    monkeypatch.setattr(F, "_mt5_call", lambda fn, *a: _tick(time.time() + 7200))
    monkeypatch.setattr(F, "_server_time_offset_seconds", lambda tick: None)
    r = F._mercato_aperto_adesso("EURUSD", _info())
    assert r["mercato_aperto"] is None, "senza scarto non si risponde, non si tira a indovinare"


class _Terminale:
    """Un terminale finto per QUESTO test, montato dentro il modulo al posto di `mt5`.

    PERCHE' COSI' E NON COL NOME DELLA FUNZIONE: la prima versione riconosceva la chiamata da
    `fn.__name__ == "symbol_select"`. Funzionava da sola e falliva dentro il collaudo completo,
    perche' un ALTRO test installa prima il suo finto MetaTrader5 in sys.modules e li' quel
    metodo e' una lambda, che si chiama '<lambda>'. Il test dipendeva dall'ordine dei test: un
    test che cambia esito secondo chi gira prima non sorveglia niente. Qui si confronta
    l'IDENTITA' della funzione, che non puo' essere ambigua."""
    SYMBOL_TRADE_MODE_DISABLED = 0

    def __init__(self, tick_epoch, gia_quotato):
        self.tick_epoch = tick_epoch
        self.quotato = gia_quotato
        self.selezioni = 0

    def symbol_select(self, nome, attiva):
        self.selezioni += 1
        self.quotato = True
        return True

    def symbol_info_tick(self, nome):
        return _tick(self.tick_epoch) if self.quotato else None


def _monta(F, monkeypatch, terminale):
    monkeypatch.setattr(F, "mt5", terminale)
    monkeypatch.setattr(F, "_mt5_call", lambda fn, *a: fn(*a))
    monkeypatch.setattr(F, "_server_time_offset_seconds", lambda tick: 7200)
    monkeypatch.setattr(F.time, "sleep", lambda s: None)


def test_un_simbolo_non_nel_market_watch_viene_selezionato(monkeypatch):
    """IL CASO CHE RENDEVA LA CURA INUTILE PROPRIO SU NZD/CAD. MT5 non quota un simbolo che non
    e' nel Market Watch: misurato, `tick: None` e last_error (-4, 'Terminal: Not found'). Senza
    selezionarlo non si sarebbe mai potuto sapere niente dello strumento della segnalazione.
    Selezionare non e' un'invadenza nuova: questo stesso file lo fa gia' in sei punti."""
    F = _feed()
    term = _Terminale(time.time() + 7200, gia_quotato=False)
    _monta(F, monkeypatch, term)
    r = F._mercato_aperto_adesso("NZDCAD", _info(select=False))
    assert term.selezioni == 1, "un simbolo muto e non selezionato va messo nel Market Watch"
    assert r["mercato_aperto"] is True, r


def test_un_simbolo_gia_selezionato_non_si_tocca(monkeypatch):
    """PROVA DI CONTROLLO: non si va a selezionare mezzo broker. Se il simbolo quota gia', non si
    chiama symbol_select per niente."""
    F = _feed()
    term = _Terminale(time.time() + 7200, gia_quotato=True)
    _monta(F, monkeypatch, term)
    r = F._mercato_aperto_adesso("EURUSD", _info(select=True))
    assert term.selezioni == 0, "il simbolo quotava gia': non c'era niente da selezionare"
    assert r["mercato_aperto"] is True


def test_selezionato_ma_ancora_muto_non_inventa_niente(monkeypatch):
    """PROVA DI CONTROLLO. Appena selezionato, il terminale puo' metterci un istante prima di
    quotare: in quel momento la risposta onesta e' "non lo so", non "chiuso". Fra 30 secondi
    l'app richiede e a quel punto il tick c'e'."""
    F = _feed()
    term = _Terminale(time.time() + 7200, gia_quotato=False)
    term.symbol_select = lambda nome, attiva: True   # selezione che non fa ancora quotare
    _monta(F, monkeypatch, term)
    r = F._mercato_aperto_adesso("NZDCAD", _info(select=False))
    assert r["mercato_aperto"] is None, r
    assert r["trade_allowed"] is None, "mai un falso che sa di certezza"
