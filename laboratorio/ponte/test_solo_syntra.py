"""Il ponte dei segnali in modalita' "solo Syntra": non deve toccare Telegram.

DECISO dal proprietario (8 ottobre 2026): due ponti, Telegram sul server (che legge anche ad app
chiusa) e Syntra sul computer (unico posto dove esiste BlueStacks).

IL RISCHIO VERO non e' che Syntra non parta: e' che parta ANCHE Telegram. Il file di sessione sta
sul server; avviando qui la sorgente Telegram, il computer si metterebbe a chiedere numero e codice
per un account gia' collegato altrove, e due ponti litigherebbero per la stessa sessione. Questo
test guarda proprio quello.
"""
import asyncio

import _percorsi  # noqa: F401
import segnali_bridge as sb


def _accende(monkeypatch, solo_syntra):
    """Esegue l'avvio del ponte contando chi parte. Torna (telegram_partito, syntra_partito)."""
    partiti = {"telegram": False, "syntra": False, "simulatore": False}

    async def finta_telegram():
        partiti["telegram"] = True

    async def finta_sim():
        partiti["simulatore"] = True

    monkeypatch.setattr(sb, "_sorgente_telegram_sempre", finta_telegram)
    monkeypatch.setattr(sb, "sorgente_simulatore", finta_sim)
    monkeypatch.setattr(sb, "avvia_syntra", lambda: partiti.__setitem__("syntra", True))
    monkeypatch.setitem(sb.STATO, "solo_syntra", solo_syntra)
    monkeypatch.setitem(sb.STATO, "sim", False)

    async def gira():
        async with sb._ciclo(None):
            await asyncio.sleep(0)       # lascia partire i task
    asyncio.run(gira())
    return partiti


def test_in_solo_syntra_telegram_non_parte(monkeypatch):
    """IL PUNTO. Telegram sta sull'altro ponte: qui non si tocca."""
    p = _accende(monkeypatch, solo_syntra=True)
    assert p["telegram"] is False, \
        "avviare Telegram qui vorrebbe dire chiedere il codice per un account gia' collegato altrove"
    assert p["simulatore"] is False
    assert p["syntra"] is True, "Syntra invece deve partire: e' l'unico motivo per cui questo ponte esiste"


def test_senza_la_modalita_resta_tutto_come_prima(monkeypatch):
    """Nessuna regressione per chi ha un ponte solo, sul computer."""
    p = _accende(monkeypatch, solo_syntra=False)
    assert p["telegram"] is True
    assert p["syntra"] is True


def test_la_modalita_si_legge_da_fuori(monkeypatch):
    """L'app deve poter sapere cosa sta facendo questo ponte, senza indovinarlo."""
    monkeypatch.setitem(sb.STATO, "solo_syntra", True)
    assert sb._modalita() == "solo-syntra"
    monkeypatch.setitem(sb.STATO, "solo_syntra", False)
    monkeypatch.setitem(sb.STATO, "sim", False)
    assert sb._modalita() == "telegram"
    monkeypatch.setitem(sb.STATO, "sim", True)
    assert sb._modalita() == "simulatore"


def test_riconfigurare_le_sale_non_resuscita_telegram(monkeypatch):
    """Cambiando le sale dall'app si riavvia la sorgente: in solo-syntra non deve accenderla."""
    partito = {"telegram": False}

    async def finta():
        partito["telegram"] = True

    monkeypatch.setattr(sb, "_sorgente_telegram_sempre", finta)
    monkeypatch.setitem(sb.STATO, "solo_syntra", True)
    asyncio.run(sb.riavvia_sorgente())
    assert partito["telegram"] is False,         "una riconfigurazione delle sale non deve far partire Telegram su questo ponte"
