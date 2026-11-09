"""LA PAGINA SI APRE ANCHE DIRETTAMENTE, E DA LI' DEVE USCIRE LA COPIA AGGIORNATA.

SEGNALATO dal proprietatore (9 novembre 2026): «è ritornato questo problema passato che sembrava
risolto e invece no... secondo me fa conflitto dei file collegamenti nel nostro pc. Altrimenti non
si spiega». E il conflitto c'era, MISURATO: /app.html rispondeva v2.2.2 mentre /sw.js rispondeva
v2.2.3.

CAUSA MISURATA: la pagina si apre con http://127.0.0.1:8000/app.html (lo fa il guscio pywebview,
lo fa chi prova a mano). Quell'indirizzo non aveva una rotta sua: finiva nel mount StaticFiles
messo in fondo al file, che serve dalla cartella del PACCHETTO — per un .exe, la copia congelata
DENTRO l'eseguibile, vecchia di mesi — e non dalla copia aggiornata che percorso_app() sceglierebbe.
La radice "/" e sw.js invece hanno rotte dedicate che passano da percorso_app(), cioè dalla copia
aggiornata. Risultato: la pagina girava VECCHIA e il service worker NUovo. Il pannello versione
legge sw.js, quindi diceva l'ultima, mentre il codice che girava era un altro: è così che si
insegue per un pomeriggio un difetto «già curato».

Qui si misura il COMPORTAMENTO: i due indirizzi devono restituire la STESSA pagina, e quella
pagina deve essere quella scelta da percorso_app().
"""
import os
import sys
import types

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))


def _ponte(monkeypatch):
    """Il ponte vero, con MetaTrader5 e pywinauto sostituiti: sul banco non esistono, e senza
    questi due moduli il ponte non si importa nemmeno. E con il controllo di accesso che lascia
    passare: chi è "il PC" lo decide l'indirizzo di rete, che sul banco non c'è — quella regola ha
    le sue prove in test_chiave_personale.py, qui si prova DA CHE CARTELLA esce il file.
    monkeypatch (e non un'assegnazione diretta) perché pytest la rimette a posto: quel controllo
    è un modulo condiviso e lasciarlo sporco faceva cadere due prove di test_server_oracle."""
    if "MetaTrader5" not in sys.modules:
        sys.modules["MetaTrader5"] = types.SimpleNamespace(
            initialize=lambda *a, **k: False, shutdown=lambda: None,
            terminal_info=lambda: None, account_info=lambda: None, last_error=lambda: (0, ""))
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    os.environ.setdefault("FBL_DATI", __import__("tempfile").mkdtemp(prefix="fbl_dati_prova_"))
    import accesso_condiviso
    monkeypatch.setattr(accesso_condiviso, "motivo_rifiuto", lambda request: None)
    import bridge
    return bridge


def _riempitivo():
    """Un commento HTML che porta il file sopra i 500 KB: la regola 3 del ponte (il controllo
    "sia un'app", non una pagina di errore) rifiuta tutto cio' che è più piccolo."""
    return "<!-- " + ("x" * 520000) + " -->"


def _prepara(tmp_path, monkeypatch, bridge):
    """Due cartelle: una è il pacchetto (copia vecchia), l'altra è quella degli aggiornamenti.
    I file sono volutamente PIU' GRANDI DI 500 KB: _coppia_valida() rifiuta una copia piccola
    (regola 3: un file da 200 byte che dice "404" ha HTTP 200 su certi hosting), quindi senza
    questo la prova misurerebbe il rifiuto e non il percorso."""
    (tmp_path / "app.html").write_text("<html>COPIA-CONGELATA" + _riempitivo() + "</html>", encoding="utf-8")
    (tmp_path / "sw.js").write_text("const CACHE_NAME='forex-backtest-lab-v1.0.0';", encoding="utf-8")
    agg = tmp_path / "app_aggiornata"
    agg.mkdir()
    (agg / "app.html").write_text("<html>COPIA-AGGIORNATA" + _riempitivo() + "</html>", encoding="utf-8")
    (agg / "sw.js").write_text("const CACHE_NAME='forex-backtest-lab-v9.9.9';", encoding="utf-8")
    (agg / "login.html").write_text("<html>login</html>", encoding="utf-8")
    monkeypatch.setattr(bridge, "_CARTELLA_APP", str(agg))
    monkeypatch.setattr(bridge, "_BASE_DIR", str(tmp_path))


def test_app_html_esce_dallo_stesso_posto_della_radice(monkeypatch, tmp_path):
    """Il comportamento, non il testo: i due indirizzi devono dare la stessa pagina, e quella
    pagina deve essere quella aggiornata."""
    from fastapi.testclient import TestClient
    b = _ponte(monkeypatch)
    _prepara(tmp_path, monkeypatch, b)

    cli = TestClient(b.app)
    da_radice = cli.get("/")
    da_app_html = cli.get("/app.html")

    assert da_radice.status_code == 200, da_radice.text
    assert da_app_html.status_code == 200, da_app_html.text
    assert "COPIA-AGGIORNATA" in da_app_html.text, (
        "/app.html deve uscire dalla copia scelta da percorso_app(), non dal mount StaticFiles "
        "che servirebbe la copia vecchia congelata nell'eseguibile: " + da_app_html.text[:80])
    assert da_app_html.text == da_radice.text, (
        "i due indirizzi devono dare la stessa pagina, o la coppia si divide (misurato: v2.2.2 "
        "da una parte e v2.2.3 dall'altra)")


def test_la_copia_congelata_non_vince_su_quella_aggiornata(monkeypatch, tmp_path):
    """PROVA DI CONTROLLO: anche con una copia nella cartella del pacchetto (quella che il mount
    StaticFiles servirebbe) deve vincere l'aggiornata. Se vincesse la vecchia, l'app girerebbe
    sempre col codice del giorno in cui è stato compilato l'eseguibile."""
    from fastapi.testclient import TestClient
    b = _ponte(monkeypatch)
    _prepara(tmp_path, monkeypatch, b)

    r = TestClient(b.app).get("/app.html")
    assert "COPIA-AGGIORNATA" in r.text, (
        "con una copia aggiornata presente deve vincere lei: " + r.text[:80])
    assert "COPIA-CONGELATA" not in r.text, (
        "la copia congelata nell'eseguibile non deve mai vincere: " + r.text[:80])
