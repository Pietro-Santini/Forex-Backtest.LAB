"""IL PONTE NON PUO' FAR CRESCERE IL LOTTO. Mai, per nessun motivo.

TROVATO con un audit del 17 novembre 2026, non da una segnalazione: `_round_volume` arrotondava
il volume richiesto al piu' VICINO multiplo del passo del simbolo, e poi lo ALZAVA al
`volume_min`:

    vol = round(round(volume / step) * step, 8)
    vol = max(info.volume_min, min(info.volume_max, vol))

Su un simbolo con passo o minimo 0,1 - indici e molti CFD cripto - 0,03 lot richiesti diventavano
0,1: il rischio scelto dall'utente moltiplicato per tre. La pagina calcola sempre col passo 0,01
(`opz.passo` e' valorizzato solo per Kraken) e non confronta il volume tornato con quello chiesto,
quindi la differenza non si vedeva da nessuna parte.

Il commento della funzione parlava di «far rifiutare l'intero ordine dal broker»: era stata
scritta pensando al rifiuto tecnico, non al rischio. Sono due problemi diversi e qui vince il
rischio.

LA REGOLA, e non e' negoziabile: il volume eseguito e' <= del volume richiesto. Sempre.
  - si arrotonda PER DIFETTO al passo del simbolo;
  - il tetto `volume_max` si applica (ridurre e' sicuro);
  - se quel che resta e' sotto il `volume_min` del simbolo, l'ordine si RIFIUTA con un motivo
    scritto: non si apre una posizione piu' grande di quella decisa.

La prova di controllo e' l'ultima: col passo 0,01, che e' il caso di tutti i giorni, i numeri non
cambiano di una virgola.
"""
import sys
import types
import importlib

import pytest
from fastapi import HTTPException


@pytest.fixture
def bridge(monkeypatch):
    """bridge.py con MT5 finto. monkeypatch: lo stato globale non resta sporco (lezione gia' pagata)."""
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
    importlib.reload(b)
    return b


def simbolo(passo, minimo, massimo=100.0):
    return types.SimpleNamespace(volume_min=minimo, volume_max=massimo, volume_step=passo)


# --- IL CUORE: il volume non cresce ------------------------------------------------------------

def test_passo_grosso_arrotonda_per_difetto_non_al_piu_vicino(bridge):
    """Passo 0,1 e 0,37 richiesti: 0,3 (per difetto), non 0,4.

    Col vecchio arrotondamento al piu' vicino uscivano 0,4, cioe' l'8% di rischio in piu' del
    dovuto su ogni singolo ordine.
    """
    info = simbolo(passo=0.1, minimo=0.1)
    assert bridge._round_volume(info, 0.37) == pytest.approx(0.3, abs=1e-9)


def test_mai_sopra_il_richiesto_su_una_griglia_di_valori(bridge):
    """La regola generale, provata su molte combinazioni invece che su un caso fortunato.

    L'attesa si ricava dall'ARROTONDAMENTO PER DIFETTO, non dal minimo: con un passo piu'
    grosso del minimo (passo 0,1 e minimo 0,01, che esiste) 0,01 richiesti scendono a zero e
    l'ordine va rifiutato, anche se 0,01 era >= del minimo. Dedurre l'attesa dal solo minimo
    era il difetto della prima stesura di questo banco.
    """
    for passo, minimo in ((0.01, 0.01), (0.1, 0.1), (0.1, 0.01), (0.5, 0.5), (1.0, 1.0)):
        info = simbolo(passo=passo, minimo=minimo)
        for richiesto in (0.01, 0.03, 0.07, 0.12, 0.29, 0.37, 0.99, 1.0, 1.49, 2.5, 7.77):
            atteso = int(round(richiesto / passo, 9)) * passo   # il per difetto, fatto a mano
            if atteso < minimo - 1e-9:
                with pytest.raises(HTTPException):
                    bridge._round_volume(info, richiesto)
                continue
            vol = bridge._round_volume(info, richiesto)
            assert vol <= richiesto + 1e-9, (
                "passo %s minimo %s: richiesti %s, eseguiti %s - il volume e' CRESCIUTO"
                % (passo, minimo, richiesto, vol))
            assert vol == pytest.approx(atteso, abs=1e-9), (
                "passo %s: richiesti %s, attesi %s per difetto, tornati %s"
                % (passo, richiesto, atteso, vol))


def test_un_multiplo_esatto_non_viene_ridotto_dal_binario(bridge):
    """0,29 con passo 0,01 e' un multiplo esatto, ma in binario fa 28,999999999999996.

    Un floor ingenuo tornerebbe 0,28: una riduzione silenziosa del rischio su un volume che
    era GIA' giusto. Meno pericoloso di un aumento, ma e' comunque un numero inventato.
    """
    info = simbolo(passo=0.01, minimo=0.01)
    for v in (0.29, 0.07, 0.58, 1.16, 3.33):
        assert bridge._round_volume(info, v) == pytest.approx(v, abs=1e-9), (
            "%s e' un multiplo esatto del passo: non si tocca" % v)


def test_sotto_il_minimo_del_simbolo_si_rifiuta_non_si_gonfia(bridge):
    """0,03 richiesti su un simbolo che ha minimo 0,1: si rifiuta.

    Era il caso peggiore: diventavano 0,1, cioe' piu' del TRIPLO del rischio scelto, in silenzio.
    """
    info = simbolo(passo=0.1, minimo=0.1)
    with pytest.raises(HTTPException) as e:
        bridge._round_volume(info, 0.03)
    assert e.value.status_code == 400
    # il motivo va detto in italiano, coi due numeri dentro: chi legge deve capire cosa fare
    testo = str(e.value.detail).lower()
    assert "0.1" in testo or "0,1" in testo
    assert "0.03" in testo or "0,03" in testo


def test_anche_col_passo_fine_un_volume_troppo_piccolo_si_rifiuta(bridge):
    """Passo e minimo 0,01, richiesti 0,005: prima diventavano 0,01, cioe' il doppio."""
    info = simbolo(passo=0.01, minimo=0.01)
    with pytest.raises(HTTPException):
        bridge._round_volume(info, 0.005)


# --- le riduzioni restano permesse: ridurre e' sempre sicuro -----------------------------------

def test_il_tetto_massimo_del_simbolo_riduce_e_va_bene(bridge):
    """Il volume_max taglia: e' una riduzione, quindi non viola la regola."""
    info = simbolo(passo=0.01, minimo=0.01, massimo=5.0)
    assert bridge._round_volume(info, 500.0) == pytest.approx(5.0, abs=1e-9)


# --- prova di controllo: il caso di tutti i giorni non cambia ----------------------------------

def test_controllo_col_passo_di_sempre_i_numeri_non_cambiano(bridge):
    """Passo 0,01: gli stessi valori di prima, alla virgola. Nessuna regressione."""
    info = simbolo(passo=0.01, minimo=0.01)
    assert bridge._round_volume(info, 0.07) == pytest.approx(0.07, abs=1e-9)
    assert bridge._round_volume(info, 0.01) == pytest.approx(0.01, abs=1e-9)
    assert bridge._round_volume(info, 1.23) == pytest.approx(1.23, abs=1e-9)
    assert bridge._round_volume(info, 18.51) == pytest.approx(18.51, abs=1e-9)


def test_controllo_un_passo_assente_vale_001_come_prima(bridge):
    """volume_step a 0 o None: si ripiega su 0,01, come faceva prima."""
    info = types.SimpleNamespace(volume_min=0.01, volume_max=100.0, volume_step=None)
    assert bridge._round_volume(info, 0.07) == pytest.approx(0.07, abs=1e-9)
    info0 = types.SimpleNamespace(volume_min=0.01, volume_max=100.0, volume_step=0)
    assert bridge._round_volume(info0, 0.07) == pytest.approx(0.07, abs=1e-9)
