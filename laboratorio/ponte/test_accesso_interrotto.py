# -*- coding: utf-8 -*-
"""Quando l'accesso a Telegram non si completa, il messaggio dice cosa succedera' dopo.

SEGNALATO dal proprietario (7 ottobre 2026): «quando tento la connessione col Telegram il ponte mi
dice "accesso a Telegram interrotto, nessun codice ricevuto, premi di nuovo collegamento per
riprovare". Quando succede questo, quello che deve fare e': verificare innanzitutto se il numero di
telefono e' stato inserito; se c'e', inviare il codice e aprire il popup del codice; se non c'e',
aprire prima il popup del numero e poi quello del codice».

Il comportamento c'era gia'; quello che mancava era DIRLO. Un messaggio che dice solo "riprova"
lascia la domanda che rende fastidioso un accesso fallito: dovro' riscrivere tutto?
"""
import os
import re
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.dirname(os.path.dirname(QUI))
SORGENTE = os.path.join(RADICE, "installer_build", "build", "segnali_telegram", "segnali_bridge.py")


def _testo():
    with open(SORGENTE, encoding="utf-8") as f:
        return f.read()


def test_il_messaggio_dice_cosa_succede_col_numero_salvato():
    t = _testo()
    assert "_cosa_succede_dopo" in t, "manca la spiegazione di cosa accadra' al prossimo tentativo"
    # Col numero gia' salvato: si rimanda il codice, senza richiedere il numero.
    assert re.search(r"numero e' gia' salvato.*?rimando subito il codice", t, re.S), \
        "col numero salvato si deve dire che il codice riparte da solo"
    # Senza numero: prima il numero, poi il codice. L'ordine conta ed e' quello chiesto.
    assert re.search(r"chiedo prima il numero di telefono,\s*\"?\s*\n?\s*\"?\s*poi il codice", t), \
        "senza numero si deve dire che verra' chiesto prima il numero e poi il codice"


def test_niente_richiesta_a_meta_quando_si_interrompe():
    """Se resta in sospeso una richiesta, il tentativo dopo trova il ponte in uno stato strano.

    E' il motivo per cui a volte bisognava premere due volte: la richiesta vecchia era ancora li'.
    """
    t = _testo()
    # Nei due punti in cui si rinuncia (numero mancante, codice mancante) si deve azzerare.
    for pezzo in ("il numero di telefono non e' ", "il codice non e' arrivato"):
        i = t.find(pezzo)
        assert i > 0, "non trovo il punto in cui si rinuncia: " + pezzo
        prima = t[max(0, i - 400):i]
        assert 'ACCESSO["serve"] = None' in prima, \
            "prima di rinunciare si deve togliere la richiesta in sospeso (" + pezzo + ")"


def test_non_si_dice_piu_solo_riprova():
    t = _testo()
    assert "Premi di nuovo Collegamento per riprovare." not in t, \
        "il messaggio generico e' stato sostituito da uno che dice cosa succedera'"
