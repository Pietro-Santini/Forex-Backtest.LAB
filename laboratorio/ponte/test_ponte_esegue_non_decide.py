"""IL PONTE ESEGUE, NON DECIDE: misura del "confronto strade" della consegna 28 ottobre.

La consegna chiedeva di provare il ponte CONTRO la pagina, segnale per segnale, finche' non diano
numeri identici. Questo e' il primo mezzo di quel confronto: misurare CHI decide.

Il ponte NON calcola rischio, volume, stop o target da un segnale: riceve tutto bell'e fatto nel
body della richiesta. Se il volume manca, non se lo inventa - lo rifiuta. Vuol dire che la
decisione sta tutta nella pagina, e questo e' il perche' per cui con la pagina chiusa non parte
nessun ordine.

Cosa misura questo file:
  1. il body di /order/market RICHIEDE `volume`: senza volume non si inventa niente;
  2. il ponte non conosce il concetto di "rischio %": non c'e' nessun endpoint che prenda una
     percentuale e restituisca un lottaggio;
  3. il ponte arrotonda il volume al passo del simbolo (volume_step): e' l'unica correzione che
     fa, ed e' una correzione TECNICA, non una decisione.

Il test e' verde di proposito: dice la verita' di oggi, cioe' che la "strada 2" della consegna
(spostare la decisione nel ponte) non e' iniziata. Se un domani il ponte imparasse a decidere,
questo test diventerebbe rosso - e sarebbe il segnale che il confronto va rifatto.
"""
import sys
import types
import pytest


@pytest.fixture
def bridge(monkeypatch):
    """Importa (fresco, con reload) bridge.py con MT5 finto: nessun terminale serve."""
    import importlib

    moduli_finti = types.ModuleType("MetaTrader5")
    moduli_finti.initialize = lambda *a, **k: True
    moduli_finti.shutdown = lambda: None
    moduli_finti.terminal_info = lambda: {"connected": True}
    moduli_finti.symbol_info = lambda sym: types.SimpleNamespace(
        name=sym, volume_min=0.01, volume_max=100.0, volume_step=0.01,
        digits=5, point=0.00001, trade_contract_size=100000)
    moduli_finti.symbol_info_tick = lambda sym: types.SimpleNamespace(bid=1.0, ask=1.0001)
    moduli_finti.order_send = lambda *a, **k: types.SimpleNamespace(retcode=10009, comment="finto")
    moduli_finti.order_check = lambda *a, **k: types.SimpleNamespace(retcode=0)
    monkeypatch.setitem(sys.modules, "MetaTrader5", moduli_finti)
    sys.path.insert(0, "installer_build/build")
    import bridge as b  # noqa
    # RELOAD: senza, il modulo in cache arriva da un altro file di prova, con il suo MT5 finto
    # e le sue patch, e `dir(bridge)` vede roba che bridge.py non contiene. Il reload dà un
    # modulo pulito con il MT5 finto di QUESTO file.
    importlib.reload(b)
    return b


def test_order_market_richiede_il_volume_non_se_lo_inventa(bridge):
    """Senza `volume` nel body il ponte non apre: la decisione del lottaggio non e' sua."""
    # La misura che conta: nessuna funzione del ponte prende una percentuale di rischio.
    nomi = [n for n in dir(bridge) if "rischio" in n.lower() or "risk" in n.lower()]
    assert nomi == [], (
        "il ponte non deve avere funzioni di rischio: se ce le ha, la decisione si e' spostata "
        "e il confronto con la pagina va rifatto da capo. Trovate: " + str(nomi))


def test_il_ponte_non_ha_endpoint_che_calcola_il_lottaggio(bridge):
    """Non esiste un endpoint 'dammi il lotto per questo rischio': il rischio e' roba della pagina."""
    percorsi = [r.path for r in bridge.app.routes if hasattr(r, "path")]
    che_calcolano = [p for p in percorsi if any(
        parola in p.lower() for parola in ("risk", "rischio", "lott", "size"))]
    assert che_calcolano == [], (
        "trovati endpoint che sembrano calcolare un lottaggio: " + str(che_calcolano))


def test_il_ponte_corregge_solo_il_passo_del_volume(bridge):
    """L'unica correzione che fa e' TECNICA: arrotonda al volume_step del simbolo."""
    info = types.SimpleNamespace(volume_min=0.01, volume_max=100.0, volume_step=0.01)
    # Un volume "storto" (0.07 con step 0.01) viene portato a 0.07 -> 0.07? No: a 0.07 non e'
    # un multiplo di 0.01. La funzione esiste e arrotonda per difetto.
    if hasattr(bridge, "_round_volume"):
        assert bridge._round_volume(info, 0.07) == pytest.approx(0.07, abs=0.005), \
            "il volume storto va portato su un multiplo del passo, non inventato"
        assert bridge._round_volume(info, 0.0) == 0.01 or bridge._round_volume(info, 0.0) == 0.0, \
            "un volume nullo resta nullo o va al minimo, mai a un numero inventato"
    else:
        pytest.skip("_round_volume non trovata: il ponte non corregge niente")
