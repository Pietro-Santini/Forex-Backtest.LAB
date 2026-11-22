# -*- coding: utf-8 -*-
import os, sys
QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.dirname(os.path.dirname(QUI))
sys.path.insert(0, os.path.join(RADICE, "installer_build", "build"))

import agente_pc


def test_stato_iniziale():
    st = agente_pc.stato()
    assert isinstance(st, dict)
    assert "connesso" in st


def test_ferma_non_esplode():
    agente_pc.ferma_agente()
    st = agente_pc.stato()
    assert st["attivo"] is False
