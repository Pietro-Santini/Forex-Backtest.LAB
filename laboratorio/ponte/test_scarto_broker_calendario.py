"""Lo scarto del server del broker si ricava dal calendario dell'ora legale (21 novembre 2026).

Il broker segue l'ora dell'Europa orientale: UTC+2 in inverno, UTC+3 quando vige l'ora legale europea.
Il servizio non deve mai usare un valore salvato di un'altra stagione."""
import datetime as dt

import _percorsi  # noqa: F401
import mt5_feed_server as m


def _t(s):
    return dt.datetime.fromisoformat(s).replace(tzinfo=dt.timezone.utc).timestamp()


def test_inverno_e_estate():
    assert m._scarto_broker_da_calendario(_t("2026-11-20T12:00:00")) == 7200
    assert m._scarto_broker_da_calendario(_t("2026-07-20T12:00:00")) == 10800


def test_cambio_di_marzo_e_di_ottobre():
    assert m._scarto_broker_da_calendario(_t("2026-03-29T00:59:00")) == 7200
    assert m._scarto_broker_da_calendario(_t("2026-03-29T01:01:00")) == 10800
    assert m._scarto_broker_da_calendario(_t("2026-10-25T00:59:00")) == 10800
    assert m._scarto_broker_da_calendario(_t("2026-10-25T01:01:00")) == 7200


def test_tick_vecchio_di_4h30_non_diventa_uno_scarto(monkeypatch):
    """IL CASO MISURATO sul PC del proprietario, sabato 21 novembre 2026: /history rispondeva
    "utc_offset_seconds_applied": -9000 e ogni candela usciva spostata. -9000 e' -2h30, un
    multiplo tondo di mezz'ora: passava la griglia, e la guardia sull'eta' accettava fino a 24 ore.
    Non e' un fuso: e' l'eta' di un tick fermo da 4 ore e mezza."""
    now = _t("2026-11-21T03:30:00")
    scarto_vero = 7200                      # il broker e' UTC+2 d'inverno
    # grezzo = scarto - eta'. Con 4h30 di eta': 7200 - 16200 = -9000.
    tick_vecchio = now + scarto_vero - 16200
    m._epoch_massimo_visto = 0
    assert m._scarto_fresco_da_epoch(tick_vecchio, now) is None, "un tick di 4h30 non misura un fuso"

    # Controprova: lo stesso broker con un tick FRESCO si misura ancora, subito.
    m._epoch_massimo_visto = 0
    assert m._scarto_fresco_da_epoch(now + scarto_vero, now) == scarto_vero


def test_un_valore_avvelenato_sul_disco_non_torna_a_galla(monkeypatch, tmp_path):
    """I -9000 scritti su disco da una versione precedente vanno buttati, non riusati."""
    f = tmp_path / "scarto.json"
    f.write_text('{"Upcomers-Server": {"scarto": -9000, "quando": 1795000000}}', encoding="utf-8")
    monkeypatch.setattr(m, "_FILE_SCARTO", str(f))
    monkeypatch.setattr(m, "_nome_server_broker", lambda: "Upcomers-Server")
    assert m._scarto_ricordato() is None, "lo scarto avvelenato sul disco non deve tornare"
