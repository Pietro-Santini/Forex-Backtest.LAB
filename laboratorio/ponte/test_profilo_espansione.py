"""Sul profilo di un utente Syntra: le posizioni si espandono una per una, e si scorre davvero.

SEGNALATO dal proprietario: "il robot esegue la procedura giusta, va in classifica, cerca l'utente,
entra nel profilo... pero' una volta che va sul profilo non esegue piu' nulla", e l'app riceveva
"storia completa letta dal profilo, 0 operazioni lette".

LA CAUSA, ed e' un cane che si morde la coda: leggi_schermata() riconosce una scheda SOLO se il suo
testo contiene la riga "Entrata:", che compare solo a dettaglio APERTO. Sul profilo le operazioni
arrivano CHIUSE. I pulsanti "Vedi dettagli TP/SL" venivano pero' cercati DENTRO le schede gia'
riconosciute: nessuna scheda riconosciuta -> nessun pulsante -> niente da espandere -> niente da
riconoscere. E lo scorrimento si calcolava dall'ingombro delle schede, quindi senza schede non
avveniva nemmeno: si restava fermi sulla stessa schermata per tutte le pagine previste.

Qui si guida il giro con un emulatore finto che si comporta come quello vero: le schede nascono
chiuse e si aprono quando si tocca il loro pulsante.
"""
import asyncio

import pytest

import _percorsi  # noqa: F401
import syntra_lettore as s


def _chiusa(i, y):
    """Una posizione COME ARRIVA sul profilo: niente "Entrata:", solo il pulsante per aprirla."""
    return ('<node content-desc="Vendita&#10;EURUSD&#10;%d set, 2:00 PM" bounds="[0,%d][100,%d]">'
            '<node content-desc="Vedi dettagli TP/SL" bounds="[10,%d][60,%d]"/>'
            '</node>') % (i, y, y + 40, y + 25, y + 38)


def _aperta(i, y):
    """La stessa, dopo il tocco: ora c'e' la riga "Entrata:" e i livelli."""
    return ('<node content-desc="Vendita&#10;EURUSD&#10;%d set, 2:00 PM&#10;Entrata:&#10;1.1%d" '
            'bounds="[0,%d][100,%d]">'
            '<node content-desc="TP #1:&#10;1.09"/><node content-desc="SL:&#10;1.12"/>'
            '</node>') % (i, i, y, y + 40)


def _pagina(aperte, quante=3, base=0):
    corpo = "".join((_aperta if i in aperte else _chiusa)(base + i, 100 + i * 50)
                    for i in range(quante))
    return ('<root><node bounds="[0,0][1000,1800]"/>'
            '<node content-desc="Info sul fornitore di setup" bounds="[0,0][300,40]"/>'
            + corpo + "</root>")


XML_CLASSIFICA = (
    '<root><node bounds="[0,0][1000,1800]"/>'
    '<node content-desc="Classifica" clickable="true" bounds="[0,1700][200,1780]"/>'
    '<node content-desc="Mario&#10;@mario&#10;Tasso di vincita 80%" bounds="[0,200][1000,300]"/>'
    '</root>')


class AdbFinto:
    """Emulatore finto che si comporta come quello vero: prima la Classifica, poi il profilo, dove
    le schede si aprono toccando il loro pulsante e lo scorrimento porta alla schermata dopo."""

    def __init__(self, pagine=1, davanti=True):
        self.pagine = pagine
        self.pagina = 0
        self.aperte = set()
        self.tocchi = []
        self.scorrimenti = []
        self.davanti = davanti
        self.riaperture = 0
        self.fase = "classifica"

    def _profilo(self):
        return _pagina(self.aperte, base=self.pagina * 10)

    async def schermata(self):
        return XML_CLASSIFICA if self.fase == "classifica" else self._profilo()

    async def tocca(self, x, y):
        if self.fase == "classifica":
            self.fase = "profilo"          # toccata la riga dell'utente: si apre il suo profilo
            return
        self.tocchi.append((x, y))
        # Il pulsante della posizione i sta a y = 100 + i*50 + 25..38
        for i in range(3):
            if 100 + i * 50 + 20 <= y <= 100 + i * 50 + 45:
                self.aperte.add(i)

    async def scorri(self, x, y1, y2):
        if self.fase == "classifica":
            return
        self.scorrimenti.append((x, y1, y2))
        if self.pagina < self.pagine - 1:
            self.pagina += 1
            self.aperte = set()

    async def indietro(self):
        pass

    async def syntra_davanti(self):
        return self.davanti

    async def apri_syntra(self):
        self.riaperture += 1
        self.davanti = True


def test_i_pulsanti_si_trovano_anche_su_una_scheda_chiusa():
    # E' il punto preciso in cui si inceppava: su una scheda chiusa leggi_schermata non vede nulla,
    # quindi il pulsante non poteva essere trovato cercandolo dentro le schede.
    xml = _pagina(aperte=set())
    assert s.leggi_schermata(xml)["schede"] == []
    esp = s.trova_espansori(xml)
    assert len(esp) == 3, "i tre pulsanti devono essere trovati nell'albero intero"
    assert esp[0][1] < esp[1][1] < esp[2][1], "dall'alto in basso"


def test_una_scheda_aperta_non_ha_piu_il_suo_pulsante():
    # Cosi' il giro si esaurisce da solo: espanse tutte, non restano pulsanti.
    xml = _pagina(aperte={0, 1, 2})
    assert s.trova_espansori(xml) == []
    assert len(s.leggi_schermata(xml)["schede"]) == 3


def test_sul_profilo_si_espandono_tutte_e_si_leggono():
    adb = AdbFinto()
    righe = []
    lette = asyncio.run(s.leggi_profilo(adb, "Mario", 1, righe.append, {}, None))
    assert len(lette) == 3, "tre posizioni espanse e lette, non zero: %s" % righe
    assert len(adb.tocchi) >= 3, "una per volta: almeno tre tocchi"
    for sc in lette:
        assert sc["entrata"] is not None, "il dettaglio deve risultare aperto"


def test_si_scorre_anche_quando_non_si_riconosce_niente():
    # Pagina che non contiene nessuna scheda e nessun pulsante: prima non si scorreva proprio,
    # perche' lo scorrimento si calcolava dall'ingombro delle schede. Ora si scorre lo stesso.
    class SoloTesto(AdbFinto):
        def _profilo(self):
            return ('<root><node bounds="[0,0][1000,1800]"/>'
                    '<node content-desc="Info sul fornitore di setup" bounds="[0,0][300,40]"/>'
                    '</root>')

    adb = SoloTesto()
    righe = []
    asyncio.run(s.leggi_profilo(adb, "Mario", 5, righe.append, {}, None))
    assert adb.scorrimenti, "senza schede si deve scorrere lo stesso"
    # ...ma non all'infinito: dopo tre schermate vuote ci si ferma.
    assert len(adb.scorrimenti) <= 3, "tre schermate vuote di fila e si smette: %s" % adb.scorrimenti
    assert any("non sembra la pagina dei setup" in r for r in righe), righe


def test_si_ferma_quando_la_pagina_non_scorre_piu():
    # Stessa pagina all'infinito: si legge una volta e si smette, invece di rifare 60 giri uguali.
    adb = AdbFinto(pagine=1)
    righe = []
    lette = asyncio.run(s.leggi_profilo(adb, "Mario", 30, righe.append, {}, None))
    assert len(lette) == 3
    assert any("non scorre piu'" in r for r in righe), righe
    assert len(adb.scorrimenti) <= 2, "non si continua a scorrere a vuoto: %s" % adb.scorrimenti


def test_piu_schermate_si_sommano():
    adb = AdbFinto(pagine=3)
    lette = asyncio.run(s.leggi_profilo(adb, "Mario", 10, lambda r: None, {}, None))
    assert len(lette) == 9, "tre schermate da tre posizioni ciascuna"


def test_se_syntra_e_chiusa_si_riapre_e_non_si_tocca_al_buio():
    # RICHIESTO: "a volte Syntra viene chiusa forzatamente e non viene riaperta".
    class Morta(AdbFinto):
        def __init__(self):
            super().__init__()
            self.davanti = False

        async def apri_syntra(self):
            self.riaperture += 1
            # Resta chiusa: l'emulatore non la fa tornare.

    adb = Morta()
    righe = []
    lette = asyncio.run(s.leggi_profilo(adb, "Mario", 5, righe.append, {}, None))
    assert adb.riaperture >= 1, "si deve tentare di riaprirla"
    assert lette == [], "e senza l'app davanti non si legge niente"
    assert adb.tocchi == [], "soprattutto: non si tocca lo schermo al buio"
    assert any("non e' tornata in primo piano" in r for r in righe), righe


def test_syntra_viva_torna_vero_quando_la_riapertura_riesce():
    adb = AdbFinto(davanti=False)      # apri_syntra() la rimette davanti
    assert asyncio.run(s.syntra_viva(adb, lambda r: None)) is True
    assert adb.riaperture == 1


def test_il_periodo_ferma_lo_scorrimento():
    # Le date delle pagine successive sono piu' vecchie: arrivati al periodo chiesto ci si ferma.
    adb = AdbFinto(pagine=5)
    righe = []
    futuro = s.data_ms("30 set, 2:00 PM")
    assert futuro is not None
    asyncio.run(s.leggi_profilo(adb, "Mario", 10, righe.append, {}, futuro + 86400000))
    assert any("periodo chiesto" in r for r in righe), righe
