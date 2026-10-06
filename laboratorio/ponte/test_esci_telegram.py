"""Ponte segnali: "esci da Telegram" chiude davvero la sessione e dimentica il numero."""
import asyncio
import json
import os

import _percorsi  # noqa: F401

os.environ["FBL_SEGNALI_DATI"] = os.path.join(os.environ["APPDATA"], "segnali")
import segnali_bridge as sb  # noqa: E402


class ClientFinto:
    def __init__(self):
        self.uscito = False
        self.chiuso = False

    def is_connected(self):
        return True

    async def connect(self):
        pass

    async def is_user_authorized(self):
        return True

    async def log_out(self):
        self.uscito = True
        return True

    async def disconnect(self):
        self.chiuso = True


def test_esci_chiude_la_sessione_e_dimentica_il_numero():
    cartella = sb.CARTELLA_DATI
    with open(sb.FILE_CONFIG, "w", encoding="utf-8") as f:
        json.dump({"api_id": 1, "api_hash": "x" * 32, "chat": ["a"], "telefono": "+393331234567"}, f)
    sessione = os.path.join(cartella, "sessione_segnali")
    open(sessione + ".session", "w").close()
    finto = ClientFinto()
    sb._CLIENT, sb._FILE_SESSIONE = finto, sessione

    esito = asyncio.run(sb.esci_da_telegram())

    assert esito["tipo"] == "uscito" and esito["ok"] and esito["logout"]
    assert finto.uscito and finto.chiuso
    assert not os.path.exists(sessione + ".session")
    assert json.load(open(sb.FILE_CONFIG, encoding="utf-8")).get("telefono") is None
    assert sb.STATO["uscito"] is True and sb.STATO["collegato"] is False
    assert sb._CLIENT is None


def test_esci_senza_rete_cancella_comunque_la_sessione():
    class ClientGiu(ClientFinto):
        async def log_out(self):
            raise ConnectionError("rete giu")
    sessione = os.path.join(sb.CARTELLA_DATI, "sessione_segnali")
    open(sessione + ".session", "w").close()
    sb._CLIENT, sb._FILE_SESSIONE = ClientGiu(), sessione
    esito = asyncio.run(sb.esci_da_telegram())
    assert esito["ok"] and esito["logout"] is False
    assert not os.path.exists(sessione + ".session")
