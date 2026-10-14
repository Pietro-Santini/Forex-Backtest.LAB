# -*- coding: utf-8 -*-
"""PIU' UTENTI SULLO STESSO SERVER, senza che nessuno configuri niente.

RICHIESTO dal proprietario (14 ottobre 2026): «facciamo in modo che l'utente finale tocchi il meno
possibile le configurazioni del sistema. Lo scarica e lo utilizza subito».

IL PROBLEMA CHE QUESTO FILE RISOLVE
-----------------------------------
Fino a ieri il server raggiungeva il PC CHIAMANDOLO: `https://nome-pc.xxxx.ts.net:8000`, cioe' un
nome Tailscale della rete privata del proprietario. Per il PC di un altro utente quella strada non
esiste e non puo' esistere: non e' sulla stessa rete Tailscale, non ha una porta aperta su
internet, e chiedergli di aprirne una vorrebbe dire chiedergli di configurare il router - l'esatto
contrario di quello che e' stato chiesto. (Ed e' anche la causa dei "nessuna risposta" gia' pagati:
vedi la nota sul firewall nella memoria del progetto.)

LA SOLUZIONE: IL VERSO SI INVERTE
---------------------------------
Il PC apre LUI un canale verso il server e lo tiene aperto (`/agente`). Da quel momento il server
non deve piu' raggiungere nessuno: quando un telefono chiede qualcosa, il server infila la
richiesta dentro quel canale, il PC la esegue sul suo 127.0.0.1 e rimanda la risposta indietro.
Conseguenze, tutte volute:
  - nessuna porta da aprire, nessun indirizzo da scrivere, nessun Tailscale per l'utente finale;
  - funziona anche dietro il router di casa, dietro il 4G, ovunque il PC riesca a navigare;
  - il server non diventa un passaggio verso una porta qualsiasi: le porte restano le tre di
    sempre (ordini, grafico, segnali).

CHI E' CHI, SENZA CHE NESSUNO SCRIVA NIENTE
-------------------------------------------
`utente` e' l'identificativo dell'account con cui si entra nell'app; `chiave` e' un segreto lungo
che il PC genera UNA volta e che l'app custodisce nel profilo di quell'account - quindi arriva da
solo su telefono e tablet quando ci si accede. L'utente non copia nulla a mano.

Il server impara la coppia alla PRIMA registrazione e da li' non cambia piu': chi si presenta dopo
con quello stesso utente deve avere la stessa chiave. E' la regola "il primo che arriva ha
ragione", quella che usano i programmi quando non c'e' un'autorita' a garantire le identita'.
LIMITE ONESTO, scritto qui perche' non si dimentichi: non protegge da chi conoscesse
l'identificativo di un account PRIMA del suo proprietario e corresse a registrarlo per primo. Va
bene per le poche persone di adesso; quando gli utenti saranno tanti, l'identita' andra' verificata
con il token dell'account (Firebase) invece che con questa fiducia iniziale.
"""
import asyncio
import base64
import json
import os
import secrets
import time
from typing import Dict, Optional

FILE_UTENTI = os.path.join(os.environ.get("FBL_DATI") or "/dati", "utenti.json")
# Quanto si aspetta una risposta dal PC prima di dire che non risponde. Trenta secondi e' lo stesso
# limite della strada Tailscale: oltre, chi guarda il telefono ha gia' capito da un pezzo.
ATTESA_RISPOSTA_S = 30
# Le tre porte del PC raggiungibili dal server. Identiche a quelle della strada Tailscale: il
# tunnel non deve diventare un passaggio verso una porta qualunque del computer di qualcuno.
PORTE_PC = (8000, 8001, 8769)


def _percorso_utenti() -> str:
    # Riletto a ogni chiamata: nelle prove la cartella dei dati cambia a ogni test.
    return os.path.join(os.environ.get("FBL_DATI") or "/dati", "utenti.json")


def leggi_utenti() -> dict:
    try:
        with open(_percorso_utenti(), encoding="utf-8") as f:
            return json.load(f) or {}
    except Exception:
        return {}


def scrivi_utenti(dati: dict) -> None:
    p = _percorso_utenti()
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(dati, f, ensure_ascii=False, indent=2)


def utente_valido(utente: str, chiave: str) -> bool:
    """La coppia utente/chiave e' quella imparata alla prima registrazione?"""
    u = str(utente or "").strip()
    c = str(chiave or "")
    if not u or not c:
        return False
    nota = (leggi_utenti().get(u) or {}).get("chiave")
    return bool(nota) and secrets.compare_digest(str(nota), c)


def registra_utente(utente: str, chiave: str, nome: str = "") -> dict:
    """Impara (o riconferma) la coppia di questo utente. Torna {ok, nuovo} oppure alza ValueError.

    La chiave si accetta solo se lunga abbastanza: una corta sarebbe indovinabile, e qui dentro
    passano gli ordini di qualcuno.
    """
    u = str(utente or "").strip()
    c = str(chiave or "").strip()
    if not u or len(u) < 6:
        raise ValueError("Identificativo dell'account mancante o troppo corto.")
    if len(c) < 24:
        raise ValueError("La chiave dell'account e' troppo corta: ne serve una lunga, generata dall'app.")
    tutti = leggi_utenti()
    gia = tutti.get(u)
    if gia and gia.get("chiave") and not secrets.compare_digest(str(gia["chiave"]), c):
        raise PermissionError("Questo account e' gia' registrato su questo server con un'altra chiave.")
    nuovo = not gia
    tutti[u] = {"chiave": c, "nome": str(nome or (gia or {}).get("nome") or ""), "visto": time.time()}
    scrivi_utenti(tutti)
    return {"ok": True, "nuovo": nuovo}


# ===================================================================================== gli agenti
class Agente:
    """Un computer collegato col suo canale aperto. Uno per utente: l'ultimo che arriva vince.

    Sul canale viaggiano richieste e risposte mescolate, ognuna con il suo numero (`id`): e' quello
    che permette a dieci richieste di viaggiare insieme senza aspettarsi a vicenda - e dieci
    richieste insieme capitano al primo caricamento di un grafico.
    """

    def __init__(self, websocket, utente: str):
        self.ws = websocket
        self.utente = utente
        self.pendenti: Dict[str, asyncio.Future] = {}
        self.canali: Dict[str, asyncio.Queue] = {}
        self._seq = 0
        self.dal = time.time()

    def _nuovo_id(self) -> str:
        self._seq += 1
        return "r%d" % self._seq

    async def chiedi_http(self, porta: int, percorso: str, metodo: str, query: dict,
                          corpo: bytes, content_type: str) -> dict:
        """Manda una richiesta al PC e aspetta la sua risposta."""
        rid = self._nuovo_id()
        futuro: asyncio.Future = asyncio.get_event_loop().create_future()
        self.pendenti[rid] = futuro
        try:
            await self.ws.send_text(json.dumps({
                "id": rid, "tipo": "http", "porta": porta, "percorso": percorso,
                "metodo": metodo, "query": query or {},
                "corpo": base64.b64encode(corpo or b"").decode("ascii"),
                "content_type": content_type or "application/json",
            }))
            return await asyncio.wait_for(futuro, timeout=ATTESA_RISPOSTA_S)
        finally:
            self.pendenti.pop(rid, None)

    async def apri_canale(self, porta: int, percorso: str, query: dict) -> str:
        """Apre un canale continuo (i prezzi dal vivo) e torna il suo numero."""
        cid = self._nuovo_id()
        self.canali[cid] = asyncio.Queue()
        await self.ws.send_text(json.dumps({
            "id": cid, "tipo": "ws_apri", "porta": porta, "percorso": percorso, "query": query or {},
        }))
        return cid

    async def manda_su_canale(self, cid: str, testo: str) -> None:
        await self.ws.send_text(json.dumps({"id": cid, "tipo": "ws_dato", "dato": testo}))

    async def chiudi_canale(self, cid: str) -> None:
        self.canali.pop(cid, None)
        try:
            await self.ws.send_text(json.dumps({"id": cid, "tipo": "ws_chiudi"}))
        except Exception:
            pass

    def ricevi(self, messaggio: dict) -> None:
        """Una risposta (o un pezzo di canale) arrivata dal PC."""
        rid = str(messaggio.get("id") or "")
        tipo = str(messaggio.get("tipo") or "http")
        if tipo in ("ws_dato", "ws_chiuso"):
            coda = self.canali.get(rid)
            if coda is not None:
                coda.put_nowait(None if tipo == "ws_chiuso" else messaggio.get("dato"))
            return
        futuro = self.pendenti.get(rid)
        if futuro is not None and not futuro.done():
            futuro.set_result(messaggio)

    def spegni(self) -> None:
        for f in list(self.pendenti.values()):
            if not f.done():
                f.cancel()
        self.pendenti.clear()
        for coda in list(self.canali.values()):
            coda.put_nowait(None)
        self.canali.clear()


_agenti: Dict[str, Agente] = {}


def agente_di(utente: str) -> Optional[Agente]:
    return _agenti.get(str(utente or "").strip())


def collega(utente: str, websocket) -> Agente:
    """Registra il canale di questo computer. Se ce n'era gia' uno, quello vecchio si chiude: un
    computer che si ricollega (riavvio, rete caduta) non deve lasciare dietro un canale morto che
    si prende le richieste e non risponde piu'."""
    u = str(utente or "").strip()
    vecchio = _agenti.get(u)
    if vecchio is not None:
        vecchio.spegni()
    a = Agente(websocket, u)
    _agenti[u] = a
    return a


def scollega(utente: str, agente: Agente) -> None:
    u = str(utente or "").strip()
    if _agenti.get(u) is agente:
        _agenti.pop(u, None)
    agente.spegni()


def stato() -> dict:
    """Chi e' collegato adesso: serve a /health e alla schermata dell'app."""
    return {u: {"dal": a.dal, "richieste_in_corso": len(a.pendenti), "canali": len(a.canali)}
            for u, a in _agenti.items()}
