# -*- coding: utf-8 -*-
"""Test: il parser riconosce le coppie forex scritte con spazi e barra ("AUD / CAD").

Sintra scrive gli strumenti cosi'. Prima della fix, "AUD / CAD SELL ..." non era riconosciuto
(mancava lo strumento) e il segnale veniva scartato in silenzio.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parser_segnali import interpreta, trova_strumento  # noqa: E402


class TestSyntraAudCad(unittest.TestCase):
    def test_aud_cad_con_spazi_e_barra(self):
        msg = (
            "AUD / CAD SELL ATTIVATO (ordine in attesa eseguito) 0.993\n"
            "SL 0.997\n"
            "TP1 0.991\n"
            "TP2 0.99\n"
            "TP3 0.989\n"
            "TP4 0.987\n"
            "TP5 0.985"
        )
        r = interpreta(msg)
        self.assertIsNotNone(r, "il segnale Syntra AUD/CAD non è riconosciuto")
        self.assertEqual(r["strumento"], "AUDCAD")
        self.assertEqual(r["direzione"], "SELL")
        self.assertEqual(r["entrata"], 0.993)
        self.assertEqual(r["stop_loss"], 0.997)
        self.assertEqual(r["take_profit"], [0.991, 0.99, 0.989, 0.987, 0.985])

    def test_altre_coppie_con_spazi(self):
        for testo, atteso in [
            ("EUR / GBP BUY 0.85 SL 0.84 TP 0.86", "EURGBP"),
            ("USD / JPY SELL 150 SL 151 TP 149", "USDJPY"),
            ("NZD / CAD BUY 0.91 SL 0.90 TP 0.92", "NZDCAD"),
        ]:
            with self.subTest(testo=testo):
                self.assertEqual(trova_strumento(testo), atteso)

    def test_regression_housoil_non_e_usoil(self):
        # "HOUSOIL" non deve essere letto come "USOIL"
        self.assertIsNone(trova_strumento("HOUSOIL BUY"))

    def test_regression_xauuro_e_oro(self):
        self.assertEqual(trova_strumento("XAUUSD SELL 4156 SL 4170 TP 4151"), "XAUUSD")
        self.assertEqual(trova_strumento("GOLD SELL 4150 SL 4170 TP 4140"), "XAUUSD")


if __name__ == "__main__":
    unittest.main()
