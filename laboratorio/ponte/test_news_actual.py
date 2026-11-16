# -*- coding: utf-8 -*-
"""L'ACTUAL DELLE NOTIZIE PRESO DALLE FONTI UFFICIALI (non dal calendario).

CHIESTO dal proprietario (15 novembre 2026): «Cerchiamo in qualche modo di prendere in tempo
reale l'actual per le notizie appena viene pubblicato, che arrivano per le notizie medio/grave,
arancioni/gialle/rosse.» Fra quattro strade ha scelto: fonti ufficiali per i dati che contano.

IL FATTO GIA' MISURATO (vedi il commento sopra `_NEWS_FEED_URL` in bridge.py): il calendario
`ff_calendar_thisweek.json` non pubblica MAI l'actual, nemmeno per gli eventi gia' usciti da ore.
Non e' un problema di frequenza (il ponte passa gia' da 1 ora a 2 minuti vicino a un evento):
e' la fonte che non ha quel dato.

QUESTE PROVE METTONO IL PONTE NELLE CONDIZIONI VERE E GUARDANO L'EFFETTO, senza toccare la rete:
la fonte e' finta (come `test_scarto_server.py` fa con MetaTrader5) e si CONTA quante volte il
ponte la interroga, perche' il tetto di 25 interrogazioni al giorno della BLS e' il vincolo che
decide se questa rotta si puo' usare o no.

L'OROLOGIO E' CONGELATO, E NON PER ELEGANZA (punto 7 della revisione del 15 novembre 2026). Le
provi di prima prendevano "adesso" dall'orologio vero in due punti indipendenti - `_quando(-60)`
per l'orario dell'evento e `_mesi` per i periodi della serie finta. Se il collaudo girava fra le
00:00:00 e le 00:01:00 UTC del primo del mese, i due "adesso" cadevano in due mesi diversi e la
prova diventava ROSSA senza che niente fosse rotto: e' la famiglia di difetti che ha tenuto
GitHub rosso sette versioni. Ora tutto parte da UN istante esplicito, scelto nel mezzo del mese.
"""
import datetime
import json
import os
import sys
import tempfile
import types

import pytest

import _percorsi  # noqa: F401  (moduli del ponte nel percorso, APPDATA isolato, rete esterna bloccata)

RADICE = _percorsi.RADICE

# Il 15 del mese, alle 14:30 UTC: lontano da qualunque confine di mese, cosi' un evento di un
# minuto prima sta nello STESSO mese dell'istante in cui il ponte lo calcola.
ISTANTE_FISSO = datetime.datetime(2026, 11, 15, 14, 30, 0,
                                  tzinfo=datetime.timezone.utc).timestamp()


class Orologio:
    """L'orologio del ponte nelle prove: fermo su un istante esplicito, avanzabile a mano.

    Essere un oggetto chiamabile (e non una lambda) serve a due cose: le prove lo leggono per
    sapere dove si trova (`ponte._orologio_del_banco.istante`) e, quando hanno bisogno di tempo
    che passi - un errore che scade, una quota che si consuma - lo muovono loro invece di dormire.
    """

    def __init__(self, istante):
        self.istante = istante

    def __call__(self):
        return self.istante

    def avanza(self, secondi):
        self.istante += secondi

    def salta_a(self, istante):
        self.istante = istante


# ---------------------------------------------------------------------------------------
# Il ponte, con i due moduli che sul banco non esistono.
# ---------------------------------------------------------------------------------------
def _ponte():
    if "MetaTrader5" not in sys.modules:
        sys.modules["MetaTrader5"] = types.SimpleNamespace(
            initialize=lambda *a, **k: False, shutdown=lambda: None,
            terminal_info=lambda: None, account_info=lambda: None,
            last_error=lambda: (0, ""))
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    os.environ.setdefault("FBL_DATI", tempfile.mkdtemp(prefix="fbl_dati_news_"))
    import bridge
    return bridge


@pytest.fixture()
def ponte(monkeypatch, tmp_path):
    """Ponte pulito per ogni prova: cache dell'actual vuota, contatori delle quote a zero, e la
    cache su disco di /news puntata su una cartella temporanea (nessun file scritto nel repo)."""
    b = _ponte()
    monkeypatch.setattr(b, "_news_actual_cache", {})
    monkeypatch.setattr(b, "_news_actual_quota", {"giorno": None, "usate": 0})
    monkeypatch.setattr(b, "_news_actual_quota_fed", {"giorno": None, "usate": 0})
    monkeypatch.setattr(b, "_NEWS_CACHE_FILE_PATH", str(tmp_path / "news_cache.json"))
    monkeypatch.setattr(b, "_news_cache", {"events": None, "fetched_at": 0.0, "last_error": None})
    monkeypatch.setattr(b, "_save_news_cache_to_disk", lambda *a, **k: None)
    b.app.dependency_overrides.clear()
    orologio = Orologio(ISTANTE_FISSO)
    monkeypatch.setattr(b.time, "time", orologio)
    setattr(b, "_orologio_del_banco", orologio)
    yield b
    # L'orologio e' un appendino del BANCO, non una cosa del ponte: alla fine della prova si
    # toglie, cosi' il modulo resta com'era per chi lo usa dopo nella stessa sessione.
    try:
        delattr(b, "_orologio_del_banco")
    except AttributeError:
        pass


@pytest.fixture()
def cliente(ponte):
    from fastapi.testclient import TestClient
    # Il ponte ha il controllo della chiave per chi non e' il PC (accesso_condiviso.richiesta_locale:
    # indirizzo di loopback E Host locale). Il TestClient, da solo, si presenta come "testclient"
    # e si becca un 403 che non c'entra niente con queste prove.
    return TestClient(ponte.app, client=("127.0.0.1", 50000),
                      headers={"host": "127.0.0.1:8000"})


# ---------------------------------------------------------------------------------------
# Fonti finte
# ---------------------------------------------------------------------------------------
class ReteFinta:
    """Sostituisce `_http_get_bytes`: registra OGNI indirizzo chiesto e risponde con quel che
    il test ha preparato. Un indirizzo non previsto non risponde di nascosto: finisce in
    `imprevisti`, cosi' un test che si aspetta «nessuna richiesta» non puo' passare per sbaglio."""

    def __init__(self, risposte=None):
        self.risposte = dict(risposte or {})
        self.chiamate = []
        self.imprevisti = []

    def __call__(self, url, timeout=10, headers=None):
        self.chiamate.append(url)
        for chiave, risposta in self.risposte.items():
            if chiave in url:
                if isinstance(risposta, Exception):
                    raise risposta
                return risposta
        self.imprevisti.append(url)
        raise ValueError("indirizzo non previsto dal banco: " + url)


def _mesi(primo_indietro, quanti, istante=None):
    """Elenco di periodi 'YYYY-MM' a partire da `primo_indietro` mesi prima di `istante`
    (l'istante congelato, se non si dice altrimenti)."""
    if istante is None:
        istante = ISTANTE_FISSO
    d = datetime.datetime.fromtimestamp(istante, datetime.timezone.utc).replace(day=1)
    for _ in range(primo_indietro):
        d = (d - datetime.timedelta(days=1)).replace(day=1)
    periodi = []
    for _ in range(quanti):
        periodi.append("%04d-%02d" % (d.year, d.month))
        d = (d - datetime.timedelta(days=1)).replace(day=1)
    return periodi


def _bls_risposta(punti):
    return json.dumps({"status": "REQUEST_SUCCEEDED",
                       "Results": {"series": [{"seriesID": "finta", "data": punti}]}}
                      ).encode("utf-8")


def _bls_punti(valori, periodi):
    """I punti nel formato BLS, accoppiati uno a uno ai periodi (NON riordinati: l'ordine della
    risposta e' roba della fonte, e una prova puo' volerlo cambiare)."""
    return [{"year": p[:4], "period": "M" + p[5:], "periodName": "", "value": v}
            for p, v in zip(periodi, valori)]


def _bls_finto(valori, primo_indietro=1, istante=None):
    """Risposta BLS finta. `valori` dal piu' recente; con primo_indietro=1 il dato piu' recente
    e' quello del mese scorso, cioe' il valore dell'evento E' GIA' USCITO. Con 2 o piu' la
    fonte e' indietro e il valore dell'evento NON e' ancora disponibile."""
    if istante is None:
        istante = ISTANTE_FISSO
    return _bls_risposta(_bls_punti(valori, _mesi(primo_indietro, len(valori), istante)))


def _quando(secondi_da_adesso, istante=None):
    """Orario dell'evento in ISO 8601 con fuso, come lo manda il calendario: sempre rispetto
    all'istante congelato, mai rispetto all'orologio vero."""
    if istante is None:
        istante = ISTANTE_FISSO
    return datetime.datetime.fromtimestamp(
        istante + secondi_da_adesso, datetime.timezone.utc).isoformat()


# Le serie del CPI come le hanno date le MISURE VERE del 15 novembre 2026 (nel commento in cima
# alla sezione dell'actual in bridge.py): il mercato chiama «CPI m/m» la variazione sull'indice
# DESTAGIONALIZZATO (CUSR0000SA0) e «CPI y/y» quella sull'indice NON destagionalizzato
# (CUUR0000SA0). Sono due indirizzi BLS diversi, quindi due interrogazioni.
# Valori misurati: ott 2026 = 337.476 su 336.298 (destag., m/m +0,35%) / 337.511 su 336.940
# (non destag., m/m +0,17%). Il dodicesimo punto indietro e' ottobre 2025 e serve allo y/y.
CPI_DESTAG_14_MESI = ["337.476", "336.298", "334.131", "333.202", "332.500", "331.950",
                      "331.200", "330.400", "329.800", "329.100", "328.600", "328.000",
                      "325.100", "323.900"]
CPI_NON_DESTAG_14_MESI = ["337.511", "336.940", "334.980", "333.918", "333.952", "335.123",
                          "334.200", "333.100", "332.500", "331.900", "331.000", "330.200",
                          "326.700", "325.000"]
# Core CPI: CUSR0000SA0L1E misurato (200, 2148 byte, ott 2026 = 339.900 su set = 338.896).
CORE_DESTAG_14_MESI = ["339.900", "338.896", "337.765", "336.900", "336.100", "335.400",
                       "334.700", "333.900", "333.200", "332.500", "331.900", "331.200",
                       "328.000", "326.700"]
CORE_NON_DESTAG_14_MESI = ["339.921", "339.000", "337.800", "336.900", "336.000", "335.300",
                           "334.600", "333.800", "333.100", "332.400", "331.800", "331.100",
                           "328.300", "327.000"]


def _chiedi(cliente, titolo="CPI m/m", valuta="USD", quando=None, impatto="High"):
    if quando is None:
        quando = _quando(-60)   # un minuto fa: dentro la finestra, evento gia' uscito
    return cliente.get("/news/actual", params={"titolo": titolo, "valuta": valuta,
                                               "quando": quando, "impatto": impatto})


# ---------------------------------------------------------------------------------------
# 1-2. Il caso che conta: dentro la finestra, il numero giusto sulla serie giusta.
# ---------------------------------------------------------------------------------------
def test_cpi_dentro_la_finestra_prende_il_valore_e_chiede_una_volta_sola(ponte, cliente, monkeypatch):
    """«CPI m/m» si calcola sull'indice DESTAGIONALIZZATO (misurato: +0,35% a ottobre 2026, non
    +0,17%). La serie e' una sola, quindi dentro la finestra si chiede UNA volta sola."""
    rete = ReteFinta({"CUSR0000SA0": _bls_finto(CPI_DESTAG_14_MESI)})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    r = _chiedi(cliente)
    assert r.status_code == 200
    dati = r.json()
    assert dati["valore"] == pytest.approx(0.35, abs=0.01), dati
    assert dati["unita"] == "%"
    assert dati["serie"] == "CUSR0000SA0", dati
    assert dati["quando"] == _mesi(1, 1)[0]
    assert dati["motivo"] is None
    assert len(rete.chiamate) == 1, rete.chiamate
    assert not rete.imprevisti

    # La SECONDA chiamata non deve rifare la richiesta: la cache del ponte (una per computer)
    # e' quello che tiene il ponte sotto le 25 interrogazioni al giorno della BLS.
    r2 = _chiedi(cliente)
    assert r2.json()["valore"] == pytest.approx(0.35, abs=0.01)
    assert len(rete.chiamate) == 1, "la seconda chiamata ha interrogato di nuovo la fonte"
    assert r2.json()["cache"] is True


def test_cpi_y_y_usa_l_altra_serie_e_quindi_una_seconda_interrogazione(ponte, cliente, monkeypatch):
    """La variazione ANNUA si calcola sull'indice NON destagionalizzato: «CPI m/m» e «CPI y/y»
    non condividono piu' la lettura (prima del 15 novembre 2026' lo facevano, e l'm/m mostrava il
    numero non destagionalizzato invece di quello destagionalizzato). Due eventi, due serie, due
    interrogazioni: e' il prezzo della correttezza, contato."""
    rete = ReteFinta({"CUSR0000SA0": _bls_finto(CPI_DESTAG_14_MESI),
                      "CUUR0000SA0": _bls_finto(CPI_NON_DESTAG_14_MESI)})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    m = _chiedi(cliente, titolo="CPI m/m", quando=_quando(-60)).json()
    a = _chiedi(cliente, titolo="CPI y/y", quando=_quando(-60)).json()
    assert m["valore"] == pytest.approx(0.35, abs=0.01), m
    assert m["serie"] == "CUSR0000SA0"
    assert a["valore"] == pytest.approx(3.31, abs=0.02), a
    assert a["serie"] == "CUUR0000SA0"
    assert len(rete.chiamate) == 2, rete.chiamate
    assert "CUSR0000SA0" in rete.chiamate[0] and "CUUR0000SA0" in rete.chiamate[1]
    assert not rete.imprevisti


def test_non_farm_payrolls_e_il_cambio_in_migliaia(ponte, cliente, monkeypatch):
    valori = ["159293", "159128"] + ["159000"] * 12
    rete = ReteFinta({"CES0000000001": _bls_finto(valori)})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    dati = _chiedi(cliente, titolo="Non-Farm Employment Change", quando=_quando(-120)).json()
    assert dati["valore"] == 165
    assert dati["unita"] == "migliaia"
    assert "CES0000000001" in rete.chiamate[0]


def test_il_valore_si_sceglie_per_periodo_non_per_posizione_nella_risposta(ponte, cliente, monkeypatch):
    """IL NUMERO SI SCEGLIE PER POSIZIONE, NON PER PERIODO (punto 1 della revisione del
    15 novembre 2026). La BLS mette i dati dal piu' recente, ma NESSUNA regola la obbliga a
    farlo: se la fonte li rimanda in ordine crescente il valore deve essere lo STESSO. Prima
    `punti[0]` prendeva il primo della risposta, cioe' con l'ordine invertito il punto piu' VECCHIO
    diventava «il valore di questo evento». Qui si invertono insieme periodi e valori: il dato
    piu' recente e' sempre quello di 2026-10, ma arriva per ULTIMO nella risposta."""
    ordine_crescente = _bls_risposta(_bls_punti(
        list(reversed(CPI_DESTAG_14_MESI)),
        list(reversed(_mesi(1, len(CPI_DESTAG_14_MESI))))))
    rete = ReteFinta({"CUSR0000SA0": ordine_crescente})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    dati = _chiedi(cliente).json()
    assert dati["valore"] == pytest.approx(0.35, abs=0.01), dati
    assert dati["quando"] == _mesi(1, 1)[0], dati          # il mese piu' recente, non il piu' vecchio
    assert dati["motivo"] is None


def test_la_variazione_annua_non_si_calcola_contro_il_mese_sbagliato(ponte, cliente, monkeypatch):
    """MISURATO il 15 novembre 2026 sulla serie CPI vera: nella serie BLS **manca 2025-10** (i
    prezzi non sono stati raccolti durante l'arresto del governo americano). Con il confronto
    «dodicesimo punto all'indietro» la variazione annua usciva 3,91% contro settembre 2025 invece
    che contro ottobre 2025: un numero sbagliato che sembra buono. Il confronto giusto e' PER
    PERIODO, e quando quel mese non c'e' il valore onesto e' «non si puo' calcolare».
    Con le DUE serie del CPI il buco va messo dove serve a quel calcolo: nella serie NON
    destagionalizzata, che e' quella dello y/y."""
    periodi = _mesi(1, len(CPI_NON_DESTAG_14_MESI) + 1)
    buco = periodi[12]   # il mese di dodici prima del piu' recente: quello che serve alla y/y
    reperti = [{"year": p[:4], "period": "M" + p[5:], "periodName": "", "value": v}
               for p, v in zip(periodi, CPI_NON_DESTAG_14_MESI) if p != buco]
    rete = ReteFinta({"CUUR0000SA0": _bls_risposta(reperti),
                      "CUSR0000SA0": _bls_finto(CPI_DESTAG_14_MESI)})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    annua = _chiedi(cliente, titolo="CPI y/y").json()
    assert annua["valore"] is None, annua
    assert buco in annua["motivo"], annua["motivo"]
    # la mensile invece si calcola benissimo: il buco e' in un'altra serie
    mensile = _chiedi(cliente, titolo="CPI m/m").json()
    assert mensile["valore"] == pytest.approx(0.35, abs=0.01)
    assert len(rete.chiamate) == 2, "le due domande costano due letture, una per serie"


# ---------------------------------------------------------------------------------------
# 3-5. Quando NON si deve chiedere niente.
# ---------------------------------------------------------------------------------------
def test_fuori_dalla_finestra_non_si_chiede_niente(ponte, cliente, monkeypatch):
    rete = ReteFinta({"CUSR0000SA0": _bls_finto(CPI_DESTAG_14_MESI)})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    dati = _chiedi(cliente, quando=_quando(-3 * 3600)).json()   # tre ore dopo: fuori
    assert dati["valore"] is None
    assert "finestra" in dati["motivo"]
    assert rete.chiamate == [], "ha interrogato la fonte fuori dalla finestra"
    assert rete.imprevisti == []


def test_evento_a_bassa_importanza_non_si_chiede_niente(ponte, cliente, monkeypatch):
    rete = ReteFinta({"CUSR0000SA0": _bls_finto(CPI_DESTAG_14_MESI)})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    dati = _chiedi(cliente, impatto="Low").json()
    assert dati["valore"] is None
    assert "impatto" in dati["motivo"].lower()
    assert rete.chiamate == []


def test_serie_non_in_tabella_non_si_chiede_niente(ponte, cliente, monkeypatch):
    rete = ReteFinta({"": _bls_finto(CPI_DESTAG_14_MESI)})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    dati = _chiedi(cliente, titolo="Retail Sales m/m").json()
    assert dati["valore"] is None
    assert "nessuna fonte" in dati["motivo"]
    assert rete.chiamate == []
    assert rete.imprevisti == []


def test_una_valuta_diversa_non_usa_la_serie_americana(ponte, cliente, monkeypatch):
    """«CPI m/m» esiste anche per EUR e GBP: senza la valuta si mostrerebbe il CPI americano
    sotto un evento europeo. La tabella e' per (valuta, titolo), non per titolo."""
    rete = ReteFinta({"CUSR0000SA0": _bls_finto(CPI_DESTAG_14_MESI)})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    dati = _chiedi(cliente, valuta="EUR").json()
    assert dati["valore"] is None
    assert rete.chiamate == []


def test_core_cpi_non_finisce_nella_serie_del_cpi_generico(ponte, cliente, monkeypatch):
    """«Core CPI m/m» contiene le stesse parole di «CPI m/m»: se la regola generica vincesse, il
    core mostrerebbe il numero del CPI normale, che e' un altro numero. Si guarda QUALE serie e'
    stata interrogata, non solo che un valore sia tornato."""
    rete = ReteFinta({"CUSR0000SA0L1E": _bls_finto(CORE_DESTAG_14_MESI)})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    dati = _chiedi(cliente, titolo="Core CPI m/m").json()
    assert dati["serie"] == "CUSR0000SA0L1E"
    assert dati["valore"] == pytest.approx(0.30, abs=0.01), dati
    assert len(rete.chiamate) == 1 and "CUSR0000SA0L1E" in rete.chiamate[0]


def test_senza_titolo_o_senza_valuta_lo_dice_invece_di_tentare(ponte, cliente, monkeypatch):
    rete = ReteFinta({"": _bls_finto(CPI_DESTAG_14_MESI)})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    for parametri in ({}, {"titolo": "CPI m/m"}, {"valuta": "USD"}):
        r = cliente.get("/news/actual", params={**parametri, "quando": _quando(-60),
                                                "impatto": "High"})
        assert r.status_code == 200
        assert r.json()["valore"] is None
        assert r.json()["motivo"]
    assert rete.chiamate == []


def test_un_dato_definitivo_non_vale_per_sempre(ponte, cliente, monkeypatch):
    """Il dato del mese atteso si tiene 6 ore, non fino al riavvio: il mese dopo lo stesso evento
    deve tornare a chiedere, altrimenti mostrerebbe per sempre il numero del mese scorso."""
    rete = ReteFinta({"CUSR0000SA0": _bls_finto(CPI_DESTAG_14_MESI)})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    assert _chiedi(cliente).json()["valore"] == pytest.approx(0.35, abs=0.01)
    assert len(rete.chiamate) == 1
    # sette ore dopo: la voce "definitiva" e' scaduta, si richiede
    voce = ponte._news_actual_cache["CUSR0000SA0"]
    voce["letto_il"] -= ponte._NEWS_ACTUAL_TTL_DEFINITIVO + 3600
    assert _chiedi(cliente, quando=_quando(-60)).json()["valore"] == pytest.approx(0.35, abs=0.01)
    assert len(rete.chiamate) == 2, rete.chiamate


# ---------------------------------------------------------------------------------------
# 6. Le fonti che si rompono: la rotta dice perche', il ponte resta vivo.
# ---------------------------------------------------------------------------------------
@pytest.mark.parametrize("risposta", [
    b"<html><body>Rate limited</body></html>",
    ValueError("HTTP Error 500: Internal Server Error"),
    b'{"status":"REQUEST_NOT_PROCESSED","message":["quota superata"]}',
])
def test_fonte_rotta_risponde_200_con_il_motivo_e_il_ponte_resta_vivo(ponte, cliente, monkeypatch, risposta):
    rete = ReteFinta({"CUSR0000SA0": risposta})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    r = _chiedi(cliente)
    assert r.status_code == 200, "una fonte rotta non deve far cadere la rotta"
    dati = r.json()
    assert dati["valore"] is None
    assert dati["motivo"], "senza motivo l'app non puo' dire perche' manca il valore"
    # il servizio e' ancora vivo: un'altra richiesta risponde
    assert cliente.get("/news/actual", params={"titolo": "x", "valuta": "USD",
                                               "quando": _quando(-60), "impatto": "High"}
                       ).status_code == 200


def test_la_fonte_che_e_indietro_non_spaccia_un_dato_vecchio_per_quello_di_oggi(ponte, cliente, monkeypatch):
    """IL CASO PIU' PERICOLOSO: prima che la BLS pubblichi, l'indice piu' recente e' quello del
    mese PRIMA ANCORA. Restituirlo come «il valore di questo evento» sarebbe un numero giusto
    con la data sbagliata, cioe' la cosa peggiore che una tabella di notizie possa fare."""
    rete = ReteFinta({"CUSR0000SA0": _bls_finto(CPI_DESTAG_14_MESI, primo_indietro=2)})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    dati = _chiedi(cliente, quando=_quando(-30)).json()   # l'evento e' appena uscito
    assert dati["valore"] is None
    assert _mesi(2, 1)[0] in dati["motivo"], dati["motivo"]
    assert "non" in dati["motivo"]


def test_y_y_di_gennaio_chiede_la_storia_di_due_anni_prima(ponte, cliente, monkeypatch):
    """LA VARIAZIONE ANNUA E' MUTA OGNI GENNAIO (punto 3 della revisione del 15 novembre 2026).
    La rotta chiedeva `startyear=anno-1`: per un evento di gennaio, che riporta dicembre, lo y/y
    ha pero' bisogno di dicembre di DUE anni prima - un mese che quella richiesta non porta mai.
    IL BANCO RISPETTA GLI ANNI CHE GLI SI CHIEDONO, come fa la BLS vera: se il ponte chiede la
    storia corta, la risposta non arriva e il valore non si calcola (ed e' rosso).
    L'orologio salta a un gennaio esplicito, senza `now` da nessuna parte."""
    anno = datetime.datetime.now(datetime.timezone.utc).year
    orologio = ponte._orologio_del_banco
    gennaio = datetime.datetime(anno + 1, 1, 20, 14, 30, 0,
                                tzinfo=datetime.timezone.utc).timestamp()
    orologio.salta_a(gennaio)

    # La serie NON destagionalizzata dal mese atteso (dicembre dell'anno) indietro di 14 mesi:
    # in fondo c'e' dicembre di anno-1, che serve allo y/y e che una richiesta "anno-1" non avrebbe.
    grezzo = _bls_finto(CPI_NON_DESTAG_14_MESI, istante=gennaio - 60)
    rete = ReteFinta({"startyear=%d&endyear=%d" % (anno - 2, anno): grezzo})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    dati = _chiedi(cliente, titolo="CPI y/y", quando=_quando(-60, gennaio)).json()
    assert dati["valore"] == pytest.approx(3.31, abs=0.02), dati
    assert dati["quando"] == "%04d-12" % anno, dati
    assert len(rete.chiamate) == 1
    assert rete.imprevisti == [], "il ponte ha chiesto una storia che non ha il mese dello y/y: %s" % rete.imprevisti


def test_quota_giornaliera_esaurita_lo_dice_invece_di_tacere(ponte, cliente, monkeypatch):
    """La BLS senza chiave concede 25 interrogazioni al giorno. Se il nostro tetto e' finito, la
    rotta lo dice: un valore che manca senza spiegazione manda a cercare un difetto che non c'e'."""
    rete = ReteFinta({"CUSR0000SA0": _bls_finto(CPI_DESTAG_14_MESI)})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)
    monkeypatch.setattr(ponte, "_news_actual_quota",
                        {"giorno": datetime.datetime.now(datetime.timezone.utc).date().isoformat(),
                         "usate": ponte._NEWS_ACTUAL_QUOTA_GIORNO})

    dati = _chiedi(cliente).json()
    assert dati["valore"] is None
    assert "quota" in dati["motivo"].lower()
    assert rete.chiamate == []


def test_venticinque_fallimenti_non_consumano_la_quota(ponte, cliente, monkeypatch):
    """LA QUOTA SI CONSUMA SOLO CON LE RICHIESTE RIUSCITE (punto 4 della revisione del
    15 novembre 2026). Prima si contava PRIMA della richiesta: con il TTL d'errore a 2 minuti un
    pomeriggio di timeout azzerava la giornata, e la rotta rispondeva «quota raggiunta» fino a
    domani dopo aver preso ZERO valori. Qui la fonte sbaglia 25 volte (piu' del tetto di 20) e la
    ventiseiesima lettura deve ancora passare."""
    rete = ReteFinta({"CUSR0000SA0": ValueError("HTTP Error 500: Internal Server Error")})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)
    # L'errore si ricorda poco (20 s) invece dei 2 minuti: cosi' ogni giro colpisce davvero la
    # fonte, come fa l'app che bussa al TTL. Il tempo lo fa avanzare l'orologio del banco,
    # non un sleep: la prova resta breve.
    monkeypatch.setattr(ponte, "_NEWS_ACTUAL_TTL_ERRORE", 20)

    orologio = ponte._orologio_del_banco
    for _ in range(25):
        orologio.avanza(30)
        dati = _chiedi(cliente).json()
        assert dati["valore"] is None
        assert "500" in dati["motivo"], dati["motivo"]   # ogni giro ha DAVVERO interrogato la fonte
    assert len(rete.chiamate) == 25, rete.chiamate
    assert ponte._news_actual_quota["usate"] == 0, "25 fallimenti non devono consumare niente"

    # La ventiseiesima lettura, con la fonte tornata buona: deve passare, non dire «quota».
    orologio.avanza(30)
    rete.risposte["CUSR0000SA0"] = _bls_finto(CPI_DESTAG_14_MESI, istante=orologio.istante - 60)
    dati = _chiedi(cliente).json()
    assert dati["valore"] == pytest.approx(0.35, abs=0.01), dati
    assert len(rete.chiamate) == 26, rete.chiamate
    assert ponte._news_actual_quota["usate"] == 1, "una sola richiesta riuscita = una sola consumata"


# ---------------------------------------------------------------------------------------
# 7. Il tasso Fed: due richieste (feed + comunicato), l'intervallo per esteso e i decimali.
# ---------------------------------------------------------------------------------------
FEED_FED = b"""<?xml version="1.0" encoding="utf-8" ?>
<rss version="2.0"><channel><title>FRB</title>
<item><title>Federal Reserve Board announces approval of an application</title>
<link>https://www.federalreserve.gov/newsevents/pressreleases/orders20261110a.htm</link>
<pubDate>Mon, 10 Nov 2026 16:00:00 GMT</pubDate></item>
<item><title>Federal Reserve issues FOMC statement</title>
<link>https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm</link>
<pubDate>Wed, 28 Oct 2026 18:00:00 GMT</pubDate></item>
<item><title>Federal Reserve issues FOMC statement</title>
<link>https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm</link>
<pubDate>Tue, 16 Sep 2026 18:00:00 GMT</pubDate></item>
</channel></rss>"""

COMUNICATO_FOMC = b"""<html><head><title>FOMC</title></head><body>
<p>Recent indicators suggest that economic activity has been expanding at a moderate pace.</p>
<p>The Committee decided to raise the target range for the federal funds rate at 3-3/4 to 4
percent, in support of the Federal Reserve's dual mandate.</p>
</body></html>"""

# La stessa frase scritta in DECIMALI. MISURATO il 15 novembre 2026: la vecchia regex
# `([0-9][^.;]{0,60}?)` vietava il punto e perdeva questo intervallo - il valore spariva e
# restava il motivo «il comunicato non contiene piu' la frase», che era falso. La regex nuova lo
# legge (misurata sui comunicati veri del 2011, 2016, 2019 e 2026: stesso esito di prima, piu' i
# decimali).
COMUNICATO_DECIMALI = b"""<html><head><title>FOMC</title></head><body>
<p>Recent indicators suggest that economic activity has been expanding at a moderate pace.</p>
<p>The Committee decided to raise the target range for the federal funds rate at 3.5 to 3.75
percent, in support of the Federal Reserve's dual mandate.</p>
</body></html>"""


def test_tasso_fed_dal_comunicato_ufficiale(ponte, cliente, monkeypatch):
    rete = ReteFinta({"press_all.xml": FEED_FED, "monetary20261028a.htm": COMUNICATO_FOMC})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    dati = _chiedi(cliente, titolo="Federal Funds Rate", quando=_quando(-90)).json()
    assert dati["valore"] == pytest.approx(4.0)
    assert dati["unita"] == "%"
    assert dati["intervallo"] == "3.75-4.00", dati
    assert dati["fonte"] == "Fed"
    assert len(rete.chiamate) == 2, rete.chiamate


def test_intervallo_scritto_in_decimali_non_sparisce(ponte, cliente, monkeypatch):
    """«3.5 to 3.75 percent» deve dare 3,75 e l'intervallo 3.50-3.75, non un motivo generico."""
    rete = ReteFinta({"press_all.xml": FEED_FED, "monetary20261028a.htm": COMUNICATO_DECIMALI})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    dati = _chiedi(cliente, titolo="Federal Funds Rate", quando=_quando(-90)).json()
    assert dati["valore"] == pytest.approx(3.75), dati
    assert dati["intervallo"] == "3.50-3.75", dati
    assert dati["motivo"] is None


def test_fed_che_non_dice_il_tasso_lo_dice_invece_di_inventarlo(ponte, cliente, monkeypatch):
    rete = ReteFinta({"press_all.xml": FEED_FED,
                      "monetary20261028a.htm": b"<html><body>pagina cambiata</body></html>"})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    dati = _chiedi(cliente, titolo="Federal Funds Rate", quando=_quando(-90)).json()
    assert dati["valore"] is None
    assert dati["motivo"]


def test_fed_oltre_il_tetto_non_insiste_e_lo_dice(ponte, cliente, monkeypatch):
    """Anche la Fed ha un tetto (40 letture al giorno, ognuna = due visite). Senza, in venti
    minuti di finestra sono ~22 visite a federalreserve.gov dallo stesso indirizzo, senza che
    niente lo fermi: un sito che poi risponde 403 ci lascia al buio senza sapere perche'."""
    rete = ReteFinta({"press_all.xml": FEED_FED, "monetary20261028a.htm": COMUNICATO_FOMC})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)
    monkeypatch.setattr(ponte, "_news_actual_quota_fed",
                        {"giorno": datetime.datetime.now(datetime.timezone.utc).date().isoformat(),
                         "usate": ponte._NEWS_ACTUAL_QUOTA_FED_GIORNO})

    dati = _chiedi(cliente, titolo="Federal Funds Rate", quando=_quando(-90)).json()
    assert dati["valore"] is None
    assert "quota" in dati["motivo"].lower()
    assert rete.chiamate == [], "oltre il tetto non si bussa nemmeno una volta"


def test_l_errore_della_fed_si_ricorda_piu_a_lungo_di_quello_della_bls(ponte, cliente, monkeypatch):
    """La BLS si ritenta dopo 2 minuti, la Fed dopo 10: una pagina di comunicato che cambia forma
    resta cambiata per settimane, e tornare a chiederla ogni 2 minuti sono decine di visite
    inutili verso un sito che non si lamenta - semplicemente chiude. L'evento resta sempre lo
    stesso (lo manda l'app); a muoversi e' solo l'orologio del ponte, che qui avanza a mano.
    Attenzione a contare per LETTURA, non per singola visita: la pagina del comunicato ha risposto
    con un errore, ma il feed era gia' stato preso, quindi una lettura = due indirizzi."""
    rete = ReteFinta({"press_all.xml": FEED_FED,
                      "monetary20261028a.htm": ValueError("timeout")})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    orologio = ponte._orologio_del_banco
    assert _chiedi(cliente, titolo="Federal Funds Rate", quando=_quando(-90)).json()["valore"] is None
    assert len(rete.chiamate) == 2, rete.chiamate
    # dopo quattro minuti l'errore e' ANCORA fresco: niente nuove visite
    orologio.avanza(4 * 60)
    assert _chiedi(cliente, titolo="Federal Funds Rate", quando=_quando(-90)).json()["valore"] is None
    assert len(rete.chiamate) == 2, "entro i 10 minuti la Fed non si richiede"
    # dopo undici minuti e' scaduto: si riprova
    orologio.avanza(7 * 60)
    assert _chiedi(cliente, titolo="Federal Funds Rate", quando=_quando(-90)).json()["valore"] is None
    assert len(rete.chiamate) == 4, rete.chiamate


# ---------------------------------------------------------------------------------------
# 8. Il seam: nessuna richiesta esce da un'altra porta.
# ---------------------------------------------------------------------------------------
def test_ogni_richiesta_passa_dal_seam_e_mai_dritta_a_urlopen(ponte, cliente, monkeypatch):
    """Se una futura aggiunta chiamasse `urlopen` per conto suo, il banco non la vedrebbe piu' e
    la prova che blocca la rete diventerebbe finta. Qui `urlopen` e' vietato: se qualcuno lo usa,
    la rotta lo trasforma in un motivo, ma `urlopen` deve risultare NON chiamato."""
    chiamate = []

    def urlopen_vietato(*a, **k):
        chiamate.append(a)
        raise AssertionError("richiesta HTTP fuori dal seam _http_get_bytes")

    monkeypatch.setattr(ponte.urllib.request, "urlopen", urlopen_vietato)
    rete = ReteFinta({"CUSR0000SA0": _bls_finto(CPI_DESTAG_14_MESI)})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    dati = _chiedi(cliente).json()
    assert dati["valore"] == pytest.approx(0.35, abs=0.01)
    assert chiamate == [], "qualcosa ha aggirato il seam"


def test_news_continua_a_funzionare_como_prima(ponte, cliente, monkeypatch):
    """La rotta /news e la sua cache su disco non devono cambiare: il calendario non sa l'actual,
    ma resta la fonte degli eventi e degli orari."""
    feed = json.dumps([{"title": "CPI m/m", "country": "USD",
                        "date": "2026-11-13T08:30:00-05:00", "impact": "High",
                        "forecast": "0.2%", "previous": "0.3%", "actual": None}]).encode("utf-8")
    rete = ReteFinta({"ff_calendar_thisweek.json": feed})
    monkeypatch.setattr(ponte, "_http_get_bytes", rete)

    r = cliente.get("/news")
    assert r.status_code == 200
    dati = r.json()
    assert dati["events"][0]["title"] == "CPI m/m"
    assert dati["cached"] is False
    assert rete.chiamate and "ff_calendar_thisweek.json" in rete.chiamate[0]