# -*- coding: utf-8 -*-
"""IL CUSTODE DEL SERVIZIO DATI: se la porta 8001 muore, deve rinascere da sola.

SEGNALATO dal proprietario il 30 ottobre 2026, ore 09:17, misurato sul suo computer e non
ipotizzato:
    servizio Ordini (computer, tramite il server): risponde in 319 ms
    servizio Grafico (computer): il computer non risponde in 355 ms
    servizio Segnali (server): risponde in 434 ms
Il ponte degli ordini era vivo e inoltrava benissimo, e il server (Tailscale) non c'entrava
niente: era morta la porta 8001, il servizio dati del grafico (mt5_feed_server.py). E restava
morta, perche' `_start_mt5_feed_server()` veniva chiamata UNA VOLTA SOLA, nel blocco principale
di bridge.py: se quel processo moriva dopo - crash, memoria, Windows, un kill_stale_instances di
un'altra istanza - nessuno se ne accorgeva piu' e l'app restava su Capital.com per sempre.

Questi test misurano il COMPORTAMENTO del custode, non la presenza di una stringa nel codice:
quante volte avvia, quando NON avvia, quando smette di insistere, e se si spegne col ponte.
"""
import os
import sys
import time
import types

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))


def _bridge():
    """bridge.py senza MetaTrader5 ne' pywinauto veri: il ponte non si tocca, si guarda."""
    if "MetaTrader5" not in sys.modules:
        sys.modules["MetaTrader5"] = types.SimpleNamespace(
            initialize=lambda *a, **k: False, shutdown=lambda: None,
            terminal_info=lambda: None, account_info=lambda: None,
            last_error=lambda: (0, ""), login=lambda *a, **k: False)
    if "pywinauto" not in sys.modules:
        sys.modules["pywinauto"] = types.ModuleType("pywinauto")
    import bridge
    return bridge


def _prepara(bridge, monkeypatch, porta_viva, nostro=True, collegato=False, con_file=True):
    """Il custode con le sue dipendenze finte, e il suo contatore azzerato (il modulo resta in
    memoria fra un test e l'altro, e uno stato vecchio farebbe fallire il test dopo)."""
    stato = {"viva": porta_viva}
    avvii = []
    monkeypatch.setattr(bridge, "_servizio_gia_vivo", lambda porta, timeout=0.4: stato["viva"])
    monkeypatch.setattr(bridge, "_mt5_feed_proc", object() if nostro else None)
    monkeypatch.setattr(bridge, "mt5_connected", collegato)
    monkeypatch.setattr(bridge, "_mt5_feed_server_exe_path",
                        (lambda: "Mt5FeedServer.exe") if con_file else (lambda: None))
    monkeypatch.setattr(bridge, "_start_mt5_feed_server", lambda: avvii.append(1))
    monkeypatch.setattr(bridge, "_custode_tentativi", 0)
    monkeypatch.setattr(bridge, "_custode_avvisato", False)
    return stato, avvii


def test_se_la_porta_muore_il_custode_avvia_il_servizio(monkeypatch):
    """Il difetto del proprietario, ridotto all'osso: la 8001 non risponde piu'. Deve provare a
    riavviarla, non restare a guardare."""
    bridge = _bridge()
    stato, avvii = _prepara(bridge, monkeypatch, porta_viva=False)
    esito = bridge._custode_un_giro()
    assert esito == "riavviato", "con la porta muta il custode deve richiamare l'avvio"
    assert len(avvii) == 1, "e lo deve fare davvero, non solo dirlo"


def test_se_la_porta_risponde_il_custode_non_tocca_niente(monkeypatch):
    """La controprova che conta: senza questa, un custode che avvia il servizio a ogni giro
    passerebbe il test qui sopra e lascerebbe tre processi accesi - che e' gia' stato un dubbio
    del proprietario."""
    bridge = _bridge()
    stato, avvii = _prepara(bridge, monkeypatch, porta_viva=True)
    esito = bridge._custode_un_giro()
    assert esito == "vivo", "con la porta che risponde non c'e' niente da fare"
    assert avvii == [], "non si avvia un secondo servizio se uno risponde gia'"


def test_morto_vivo_e_poi_di_nuovo_morto(monkeypatch):
    """La sequenza reale, non un singolo istante: il servizio muore, il custode lo riavvia, la
    porta torna a rispondere, e se muore di nuovo deve riavviare di nuovo. La cura che funzisce
    una volta sola non e' una cura."""
    bridge = _bridge()
    stato, avvii = _prepara(bridge, monkeypatch, porta_viva=False)
    assert bridge._custode_un_giro() == "riavviato"
    assert len(avvii) == 1
    stato["viva"] = True
    assert bridge._custode_un_giro() == "vivo"
    assert len(avvii) == 1, "se la porta risponde il custode sta zitto"
    stato["viva"] = False
    assert bridge._custode_un_giro() == "riavviato"
    assert len(avvii) == 2, "morta di nuovo, deve riavviare di nuovo: e' esattamente il difetto"


def test_il_custode_non_rianima_cio_che_non_ha_avviato_lui(monkeypatch):
    """Servizio dati spento di proposito (disconnessione) o avanzato da un altro ponte: non tocca
    a questo custode riaccenderlo. Il resto del programma deve poter spegnere i processi."""
    bridge = _bridge()
    stato, avvii = _prepara(bridge, monkeypatch, porta_viva=False,
                            nostro=False, collegato=False)
    esito = bridge._custode_un_giro()
    assert esito == "spento", "se non l'ha avviato questa istanza e MT5 non e' collegato, non tocca a lui"
    assert avvii == []


def test_con_mt5_collegato_il_custode_riavvia_anche_un_servizio_non_suo(monkeypatch):
    """L'altra meta' della regola: con MT5 collegato il grafico serve ADESSO, quindi il servizio
    dati si avvia anche se non l'ha partito questa istanza."""
    bridge = _bridge()
    stato, avvii = _prepara(bridge, monkeypatch, porta_viva=False,
                            nostro=False, collegato=True)
    esito = bridge._custode_un_giro()
    assert esito == "riavviato", "con MT5 collegato il grafico serve: si riavvia"
    assert len(avvii) == 1


def test_se_il_file_del_servizio_non_esiste_non_insiste(monkeypatch, capsys):
    """Installer vecchio, o sviluppo senza mt5_feed_server.py: non c'e' niente da tentare, e ogni
    tentativo in piu' stamperebbe la stessa riga per sempre. Si dice una volta, poi silenzio -
    e soprattutto NON si chiama l'avvio, che non potrebbe fare niente lo stesso."""
    bridge = _bridge()
    stato, avvii = _prepara(bridge, monkeypatch, porta_viva=False, con_file=False)
    esiti = [bridge._custode_un_giro() for _ in range(20)]
    assert set(esiti) == {"senza_file"}, "con il file assente il custode non deve tentare altro"
    assert avvii == [], "senza file non si chiama l'avvio: sarebbe solo rumore"
    detti = capsys.readouterr().out.count("[Mt5Feed] custode:")
    assert detti == 1, "il motivo va detto una volta sola, non 20 (trovati %d)" % detti


def test_dopo_tanti_tentativi_il_custode_si_arrende_e_lo_dice_una_volta_sola(monkeypatch, capsys):
    """Il limite che impedisce al custode di martellare: se la porta non risponde mai, si arriva
    al tetto, lo si DICE una volta, e poi non si chiama piu' l'avvio."""
    bridge = _bridge()
    stato, avvii = _prepara(bridge, monkeypatch, porta_viva=False)
    esiti = [bridge._custode_un_giro() for _ in range(25)]
    massimo = bridge._TENTATIVI_CUSTODE_MT5_FEED
    assert len(avvii) == massimo, "gli avvii si fermano al tetto (%d), non 25 (trovati %d)" % (
        massimo, len(avvii))
    assert esiti[-1] == "arinreso", "esauriti i tentativi il custode smette di provare"
    detti = capsys.readouterr().out.count("custode: %d tentativi" % massimo)
    assert detti == 1, "l'avviso di resa va stampato una sola volta (trovati %d)" % detti


def test_nessuna_eccezione_esce_dal_custode(monkeypatch):
    """Il custode sta in sottofondo accanto all'esecuzione degli ordini: se una sua controllata
    solleva, deve stamparlo e vivere per il giro dopo. Un custode morto e' peggio di nessun
    custode, perche' sembra che tutto funzioni."""
    bridge = _bridge()
    stato, avvii = _prepara(bridge, monkeypatch, porta_viva=False)

    def _esplode(porta, timeout=0.4):
        raise RuntimeError("controllo della porta impossibile")

    monkeypatch.setattr(bridge, "_servizio_gia_vivo", _esplode)
    assert bridge._custode_un_giro() == "errore", "un controllo che solleva non deve uscire dal custode"
    monkeypatch.setattr(bridge, "_servizio_gia_vivo", lambda porta, timeout=0.4: False)
    monkeypatch.setattr(bridge, "_mt5_feed_server_exe_path", lambda: "Mt5FeedServer.exe")
    monkeypatch.setattr(bridge, "_start_mt5_feed_server",
                        lambda: (_ for _ in ()).throw(RuntimeError("avvio impossibile")))
    assert bridge._custode_un_giro() == "errore", "nemmeno un avvio che solleva deve uscire"


def test_il_custode_e_un_thread_che_si_spegne_col_ponte(monkeypatch):
    """Da un lato deve stare in piedi da solo (thread daemon, unico); dall'altro deve chiudersi
    quando il ponte chiude, senno' riaccenderebbe il servizio dati appena spento."""
    bridge = _bridge()
    _prepara(bridge, monkeypatch, porta_viva=True)  # porta viva: i giri non fanno niente
    try:
        assert bridge._avvia_custode_mt5_feed() is True, "il custode deve partire"
        thr = bridge._custode_thr
        assert thr.daemon is True, "deve morire col processo, senza bloccare la chiusura"
        assert thr.is_alive() is True, "e deve essere vivo, non solo creato"
        assert bridge._avvia_custode_mt5_feed() is False, "un secondo avvio non fa un secondo thread"
        time.sleep(0.1)
        bridge._ferma_custode_mt5_feed()
        thr.join(3)
        assert thr.is_alive() is False, "chiesto di fermarsi, si deve fermare"
    finally:
        bridge._ferma_custode_mt5_feed()


def test_lo_spegnimento_ferma_il_custode_prima_del_servizio(monkeypatch):
    """L'ordine conta: se il custode girasse ancora mentre `_stop_mt5_feed_server()` chiude il
    processo dati, lo riaccenderebbe al giro dopo - e la disconnessione non spegnerebbe niente."""
    bridge = _bridge()
    ordine = []
    monkeypatch.setattr(bridge, "_ferma_custode_mt5_feed", lambda: ordine.append("custode"))
    monkeypatch.setattr(bridge, "_stop_mt5_feed_server", lambda: ordine.append("servizio"))
    monkeypatch.setattr(bridge, "_try_close_mt5_terminal", lambda: None)
    monkeypatch.setattr(bridge.mt5, "shutdown", lambda: None)
    monkeypatch.setattr(bridge.os, "_exit", lambda code: ordine.append("uscita"))
    bridge._spegni_tutto_adesso()
    assert "custode" in ordine and "servizio" in ordine, "il custode e il servizio devono essere toccati"
    assert ordine.index("custode") < ordine.index("servizio"), \
        "il custode va fermato PRIMA di spegnere il servizio dati"


def test_la_disconnessione_ferma_il_custode_prima_di_spegnere_il_servizio(monkeypatch):
    """Stessa regola dall'altro punto di uscita (/disconnect, quello dei pulsanti dell'app)."""
    from fastapi.testclient import TestClient
    bridge = _bridge()
    ordine = []
    monkeypatch.setattr(bridge, "_ferma_custode_mt5_feed", lambda: ordine.append("custode"))
    monkeypatch.setattr(bridge, "_stop_mt5_feed_server", lambda: ordine.append("servizio"))
    monkeypatch.setattr(bridge, "_try_close_mt5_terminal", lambda: None)
    monkeypatch.setattr(bridge.mt5, "shutdown", lambda: None)
    monkeypatch.setattr(bridge.subprocess, "run", lambda *a, **k: None)
    monkeypatch.setattr(bridge.os, "_exit", lambda code: ordine.append("uscita"))
    client = TestClient(bridge.app, client=("127.0.0.1", 50000))
    try:
        # richiesta_locale() esige anche un Host locale (127.0.0.1/localhost): senza, sembra
        # Tailscale Serve che gira per conto di un altro dispositivo, e risponde 403.
        risposta = client.post("/disconnect", headers={"Host": "127.0.0.1"})
        assert risposta.status_code == 200, "la disconnessione deve rispondere, non cadere"
        time.sleep(1.2)  # il timer di chiusura scada qui, senza lasciare appeso pytest
        assert ordine.index("custode") < ordine.index("servizio"), \
            "il custode va fermato PRIMA di spegnere il servizio dati"
    finally:
        bridge._annulla_spegnimento()


def test_il_custode_non_martella_una_porta_che_risponde(monkeypatch):
    """Prova di controllo estrema: con la porta viva il custode non chiama l'avvio nemmeno dopo
    dieci giri di fila - cioe' il costo di tenerlo acceso e' zero quando tutto va bene."""
    bridge = _bridge()
    stato, avvii = _prepara(bridge, monkeypatch, porta_viva=True)
    for _ in range(10):
        assert bridge._custode_un_giro() == "vivo"
    assert avvii == [], "dieci giri con la porta viva, zero avvii"
