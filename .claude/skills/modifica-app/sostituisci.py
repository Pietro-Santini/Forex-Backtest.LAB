# -*- coding: utf-8 -*-
"""Sostituzioni mirate dentro un file grande, fatte in modo che non possano passare inosservate.

Serve per `app.html` (4 MB, un solo blocco `<script>`), ma va bene per qualunque file che non si
puo' riscrivere intero.

Le tre cose che fa, e perche':

1. **Converte gli a capo.** `app.html` ha a capo Windows (CRLF). Un blocco cercato con l'a capo
   normale di Python non combacia MAI, e l'errore che si legge ("0 occorrenze, attesa 1") fa
   pensare che il testo sia sbagliato mentre e' giusto. E' la trappola che fa perdere piu' tempo.

2. **Pretende UNA occorrenza sola.** Un `replace` alla cieca su un file cosi' grande puo' colpire
   dieci punti senza che nessuno se ne accorga fino a quando si rompe qualcos'altro, magari fra
   una settimana.

3. **Scrive il file solo alla fine.** Se il terzo passo fallisce, il file resta com'era: niente
   mezze modifiche da ripulire a mano, e si puo' rilanciare lo script corretto senza pensarci.

Uso:

    from sostituisci import Modifica
    m = Modifica("app.html")
    m.una(vecchio, nuovo, "cosa cambia, detto a parole")
    m.salva()
"""
import io
import re

_ACAPO = re.compile(r"\r?\n")


class Modifica:
    def __init__(self, percorso):
        self.percorso = percorso
        # newline='' per non far convertire gli a capo a Python: il file deve tornare identico
        # tranne dove lo si cambia davvero.
        with io.open(percorso, encoding="utf-8", newline="") as f:
            self.testo = f.read()
        self.originale = self.testo
        self.fatte = []

    def una(self, vecchio, nuovo, etichetta):
        """Sostituisce `vecchio` con `nuovo`, una volta sola. Alza AssertionError se non torna."""
        v = _ACAPO.sub("\r\n", vecchio)
        n = _ACAPO.sub("\r\n", nuovo)
        quante = self.testo.count(v)
        if quante != 1:
            raise AssertionError(
                "%s: trovate %d occorrenze, ne serve 1.\n"
                "Se sono 0: quasi sempre e' un pezzo di testo cambiato, oppure stai cercando un "
                "blocco che nel file e' scritto in un altro modo.\n"
                "Se sono piu' di 1: allunga il blocco finche' non e' unico, non cambiarli tutti."
                % (etichetta, quante))
        self.testo = self.testo.replace(v, n)
        self.fatte.append(etichetta)
        print("  ok  " + etichetta)
        return self

    def deve_esserci(self, testo, etichetta):
        """Controllo di sicurezza: il file DEVE gia' contenere questo, altrimenti ci si e' sbagliati
        di file o di versione. Utile prima di una serie di sostituzioni."""
        if _ACAPO.sub("\r\n", testo) not in self.testo:
            raise AssertionError("%s: non trovato. File o versione sbagliata?" % etichetta)
        return self

    def salva(self):
        if self.testo == self.originale:
            raise AssertionError("Nessuna modifica: non si salva un file identico.")
        with io.open(self.percorso, "w", encoding="utf-8", newline="") as f:
            f.write(self.testo)
        print("\n%s: %d -> %d caratteri (%d modifiche)"
              % (self.percorso, len(self.originale), len(self.testo), len(self.fatte)))
