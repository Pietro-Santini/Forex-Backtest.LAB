"""La cartella di BlueStacks si imposta dall'app, e arriva davvero al ponte.

SEGNALATO dal proprietario (21 ottobre 2026): «ora il programma mi dice di selezionare la cartella
syntra ma non me la fa selezionare».

LA CAUSA, misurata nel sorgente: nell'app c'erano un campo di testo e un pulsante «Scegli
cartella» con NESSUN gestore - il campo non veniva mai letto, il pulsante non faceva niente, e il
ponte non aveva nessun modo di riceverla. Erano interfaccia morta: aggiunta dal commit 229a16a
insieme al riordino delle schede e mai collegata.

E quel pulsante non avrebbe comunque potuto funzionare: un browser NON conosce il percorso reale
di una cartella (showDirectoryPicker restituisce un riferimento, non "C:\\..."), quindi da li' non
sarebbe mai uscito un percorso da dare al ponte. L'unica strada e' che il percorso si INCOLLI
nell'app e arrivi qui - ed e' quello che questi test misurano.

LE DUE REGOLE CHE DIFENDONO:
  - si UNISCE a configurazione.json, non lo si riscrive: quel file contiene anche api_id, api_hash
    e l'elenco delle sale, e sovrascriverlo le cancellerebbe (le credenziali non si ri-ottengono
    con un clic: si rifa' tutto il giro su my.telegram.org);
  - una cartella che non esiste si rifiuta SUBITO. Scoprirlo al prossimo avvio dell'emulatore, con
    un errore che parla d'altro, manderebbe a cercare il problema dalla parte sbagliata.
"""
import asyncio
import json
import os
import tempfile

import _percorsi  # noqa: F401

os.environ["FBL_SEGNALI_DATI"] = tempfile.mkdtemp()
import segnali_bridge as sb  # noqa: E402


def _scrivi_config(d):
    with open(sb.FILE_CONFIG, "w", encoding="utf-8") as f:
        json.dump(d, f)


def _leggi_config():
    with open(sb.FILE_CONFIG, encoding="utf-8") as f:
        return json.load(f)


def test_la_cartella_si_salva_e_si_rilegge():
    cartella = tempfile.mkdtemp()
    _scrivi_config({"api_id": 123, "api_hash": "x" * 32, "chat": ["sala1"], "sessione": "s"})

    r = asyncio.run(sb.scrivi_cartella_syntra({"cartella": cartella}))
    assert r["ok"] is True, r
    assert r["cartella"] == cartella

    letto = asyncio.run(sb.leggi_cartella_syntra())
    assert letto["cartella"] == cartella, "il ponte deve dire quello che ha davvero"


def test_le_credenziali_e_le_sale_NON_si_perdono():
    """Il motivo per cui si unisce invece di riscrivere: in quel file ci sono anche le chiavi di
    Telegram, e per riaverle bisogna rifare tutto il giro su my.telegram.org."""
    cartella = tempfile.mkdtemp()
    _scrivi_config({"api_id": 456, "api_hash": "y" * 32, "chat": ["sala1", "sala2"],
                    "sessione": "sessione_segnali"})
    asyncio.run(sb.scrivi_cartella_syntra({"cartella": cartella}))
    cfg = _leggi_config()
    assert cfg["api_id"] == 456, "le credenziali non si toccano"
    assert cfg["api_hash"] == "y" * 32
    assert cfg["chat"] == ["sala1", "sala2"], "l'elenco delle sale non si tocca"
    assert cfg["sessione"] == "sessione_segnali"
    assert cfg["bluestacks"] == cartella


def test_una_cartella_che_non_esiste_si_rifiuta_subito():
    _scrivi_config({"api_id": 1, "api_hash": "z" * 32, "bluestacks": "gia_impostata"})
    r = asyncio.run(sb.scrivi_cartella_syntra({"cartella": r"C:\questa_cartella_non_esiste_di_sicuro_123"}))
    assert r["ok"] is False
    assert "non esiste" in r["errore"], r
    # E soprattutto: quella buona di prima non e' stata sostituita da una sbagliata.
    assert _leggi_config()["bluestacks"] == "gia_impostata", "un valore rifiutato non deve scrivere niente"


def test_vuoto_vuol_dire_cercala_da_solo():
    """Toglierla e' una scelta legittima: il lettore torna a cercare BlueStacks da se', che e' il
    comportamento di sempre. Non e' un errore e non va rifiutato."""
    cartella = tempfile.mkdtemp()
    _scrivi_config({"api_id": 1, "api_hash": "z" * 32, "bluestacks": cartella})
    r = asyncio.run(sb.scrivi_cartella_syntra({"cartella": "   "}))
    assert r["ok"] is True, r
    assert _leggi_config()["bluestacks"] == ""


def test_le_virgolette_di_windows_non_rompono_niente():
    """Copiando un percorso da Esplora File con «Copia come percorso» arrivano le virgolette:
    "C:\\Program Files\\BlueStacks_nxt". Senza toglierle, os.path.isdir direbbe di no e l'utente
    vedrebbe «la cartella non esiste» con la cartella sotto gli occhi."""
    cartella = tempfile.mkdtemp()
    _scrivi_config({"api_id": 1, "api_hash": "z" * 32})
    r = asyncio.run(sb.scrivi_cartella_syntra({"cartella": '"%s"' % cartella}))
    assert r["ok"] is True, r
    assert _leggi_config()["bluestacks"] == cartella
