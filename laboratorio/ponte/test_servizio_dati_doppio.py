# -*- coding: utf-8 -*-
"""NON SI AVVIA UN SECONDO SERVIZIO DATI SE UNO C'E' GIA'.

SEGNALATO dal proprietario, guardando il Gestione attivita': «come fanno a esserci tre processi
diversi dell'applicazione? E perche' ho due processi MT5 feed server? Io penso che il sistema di
lag derivi anche da questo».

PRIMA DI CORREGGERE, UNA MISURA CHE HA TOLTO UN SOSPETTO invece di aggiungerne uno: gli eseguibili
sono costruiti in modalita' "onefile" (lo dice Mt5FeedServer.spec: un EXE() senza COLLECT). In
quella modalita' PyInstaller mostra SEMPRE due processi con lo stesso nome - un avviatore che
scompatta i file in una cartella temporanea, e il processo vero. I numeri del proprietario lo
confermano: 72 K + 93.820 K per il servizio dati, 68 K + 15.016 K per la finestra desktop. Quei
"doppioni" sono normali e non consumano niente.

IL DOPPIONE VERO, invece, esiste ed e' un altro: il controllo che evitava di avviare due servizi
dati conosceva solo i processi avviati da QUELLA istanza del ponte. Se un ponte precedente moriva
male (chiuso di forza, crash, uno spegnimento a meta'), il suo servizio dati restava vivo e il
ponte nuovo ne lanciava un altro - che per di piu' non riusciva nemmeno a prendere la porta 8001.
Un processo inutile, e un sospetto in piu' ogni volta che si cerca la causa di un rallentamento.
"""
import os
import sys
import types

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))


def _bridge():
    if "MetaTrader5" not in sys.modules:
        sys.modules["MetaTrader5"] = types.SimpleNamespace(
            initialize=lambda *a, **k: False, shutdown=lambda: None,
            terminal_info=lambda: None, account_info=lambda: None, last_error=lambda: (0, ""))
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    import bridge
    return bridge


def test_la_porta_libera_e_la_porta_occupata_si_distinguono():
    """Il controllo deve dire la verita' in entrambi i versi, altrimenti o avvia doppioni o non
    avvia mai il servizio."""
    import socket
    bridge = _bridge()
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        s.listen(1)
        porta = s.getsockname()[1]
        assert bridge._servizio_gia_vivo(porta) is True, "una porta occupata va riconosciuta"
    # Chiuso il socket, la stessa porta non risponde piu'.
    assert bridge._servizio_gia_vivo(porta) is False, "una porta libera non deve sembrare occupata"


def test_non_si_avvia_un_secondo_servizio_dati(monkeypatch):
    """Il cuore: con qualcuno gia' in ascolto su 8001, non si lancia nessun processo."""
    bridge = _bridge()
    avviati = []
    monkeypatch.setattr(bridge, "_mt5_feed_proc", None)
    monkeypatch.setattr(bridge, "_servizio_gia_vivo", lambda porta, timeout=0.4: True)
    monkeypatch.setattr(bridge.subprocess, "Popen",
                        lambda *a, **k: avviati.append(a) or (_ for _ in ()).throw(
                            AssertionError("non doveva avviare niente")))
    bridge._start_mt5_feed_server()
    assert avviati == [], "con il servizio gia' vivo non si avvia un secondo processo"


def test_se_la_porta_e_libera_il_servizio_si_avvia(monkeypatch):
    """La prova di controllo: senza questa, un controllo rotto che dice sempre «c'e' gia'»
    passerebbe il test qui sopra e lascerebbe il grafico senza dati, in silenzio."""
    bridge = _bridge()
    avviati = []

    class ProcFinto:
        pid = 1234
        def poll(self): return None

    monkeypatch.setattr(bridge, "_mt5_feed_proc", None)
    monkeypatch.setattr(bridge, "_servizio_gia_vivo", lambda porta, timeout=0.4: False)
    monkeypatch.setattr(bridge, "_mt5_feed_server_exe_path", lambda: os.path.join(RADICE, "finto.exe"))
    monkeypatch.setattr(bridge.subprocess, "Popen",
                        lambda *a, **k: (avviati.append(a), ProcFinto())[1])
    bridge._start_mt5_feed_server()
    assert len(avviati) == 1, "con la porta libera il servizio dati deve partire"
