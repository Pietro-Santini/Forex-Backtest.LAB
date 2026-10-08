"""Una emoji non deve poter uccidere il ponte dei segnali.

TROVATO nel diario del ponte (7 ottobre 2026, 16:29) cercando perche' Syntra non funzionava piu':

    UnicodeEncodeError: 'charmap' codec can't encode character '\u2705' in position 52
      File "segnali_bridge.py", line 150, in _log

Una spunta verde in un messaggio di una sala ha fatto morire il ponte, che da quel momento non ha
piu' letto niente - ne' Telegram ne' Syntra. La console di Windows scrive in cp1252: 256 caratteri,
nessuna emoji. E le sale segnali ne sono piene (spunte, frecce, semafori), quindi non era un caso
raro, era il caso normale: bastava aspettare.

NOTA SUI TEST: `print` scrive dove dice pytest, non dove diciamo noi, perche' pytest cattura
l'output. Quindi la parte che decide (`_scrivibile`) si prova da sola, e di `_log` si prova la cosa
che conta davvero: che non sollevi nulla, qualunque cosa gli si dia.
"""
import io

import pytest

import _percorsi  # noqa: F401
import segnali_bridge as sb


class ConsoleWindows(io.TextIOBase):
    """Una console come quella di Windows: dichiara cp1252 e scoppia su cio' che non sa scrivere."""

    encoding = "cp1252"

    def write(self, s):
        s.encode("cp1252")          # come fa print davvero: qui scoppiava
        return len(s)

    def flush(self):
        pass


@pytest.fixture
def console_windows(monkeypatch):
    monkeypatch.setattr(sb.sys, "stdout", ConsoleWindows())


def test_una_emoji_diventa_scrivibile():
    """IL DIFETTO: questo testo faceva morire il programma dentro print."""
    r = sb._scrivibile("SYNTRA BUY XAUUSD ✅ target \U0001F3AF raggiunto", "cp1252")
    r.encode("cp1252")              # se questa riga passa, print non puo' piu' cadere
    assert "SYNTRA BUY XAUUSD" in r, "si perde il disegnino, non il senso"
    assert "raggiunto" in r


def test_gli_accenti_italiani_non_si_perdono():
    """cp1252 gli accenti li sa scrivere: non si deve rovinare quello che andava gia' bene."""
    testo = "citta', pero', piu' — perché è arrivata"
    r = sb._scrivibile(testo, "cp1252")
    assert "citta'" in r and "perché" in r and "è" in r


def test_con_una_console_utf8_non_si_tocca_niente():
    """Sul server (Linux, UTF-8) le emoji si scrivono: lasciarle intere."""
    assert sb._scrivibile("BUY ✅", "utf-8") == "BUY ✅"


def test_log_non_solleva_mai(console_windows):
    """La riga di diario e' un di piu'; leggere i segnali e' il lavoro.

    Un di piu' non deve mai portarsi via il lavoro: qualunque cosa succeda scrivendo, il ponte va
    avanti. (Qui pytest cattura l'output, quindi non si guarda DOVE finisce la riga: si guarda che
    la chiamata non faccia cadere nulla.)
    """
    sb._log(True, "BUY XAUUSD ✅ da Veltrix", "\U0001F3AF", 42, None)


def test_log_non_cade_nemmeno_con_la_console_rotta(monkeypatch):
    class Rotta(io.TextIOBase):
        encoding = "cp1252"

        def write(self, s):
            raise OSError("console chiusa")

    monkeypatch.setattr(sb.sys, "stdout", Rotta())
    sb._log(True, "una riga qualsiasi ✅")
