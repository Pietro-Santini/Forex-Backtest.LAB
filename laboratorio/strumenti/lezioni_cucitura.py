# -*- coding: utf-8 -*-
"""Aggiunge a LEZIONI.md la lezione sulla cucitura (la porta giusta per interrogare il ponte)."""
import io
import os
import sys

PERCORSO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'cervello', 'LEZIONI.md'))

LEZIONE = """
- Una porta nuova per interrogare il ponte e' una porta che nessuno conosce. (22 ottobre 2026.)
  Per decidere se il pacchetto di installazione serviva, ho scritto una sonda con una `fetch`
  sua (3 secondi, AbortController). Il test di prima, `versione_due_numerazioni`, e' diventato
  rosso: mockava `fetchMt5WithTimeout`, non `fetch`. La sonda e' passata dalla STESSA porta di
  sempre (`fetchMt5WithTimeout('/health')`) e il test e' tornato verde senza toccarlo. Quando
  serve una domanda nuova al ponte, si passa dalla porta che c'e': i test di prima devono
  continuare a poter parlare con lui, e il tempo di attesa deve restare quello gia' pensato
  (su localhost un servizio spento rifiuta la connessione all'istante: il timeout e' solo un
  soffitto, non un'attesa).

- Un pulsante che scarica una cosa inutile non e' un pulsante, e' un distributore di file. (22
  ottobre 2026.) «30-40 file nella cartella Download invece di uno sostituito»: ogni release
  pubblicata scaricava un Setup, e ogni Setup era un file in piu'. Il nome con il suffisso
  `(1)`, `(2)` lo mette il BROWSER (una pagina web non puo' sostituire un file nella cartella
  dell'utente), ma il file lo scaricavano NOI, e lo scaricavamo anche quando non serviva a
  niente: il programma installato gia' sapeva aggiornarsi da solo. Prima di litigare con il
  nome del file, bisogna chiedersi se il file serve.

- Il prodotto spesso sa gia' la risposta: e' il prodotto che non se la chiede. (22 ottobre 2026.)
  Il ponte dichiarava gia' in `/health` quale copia dell'app stava servendo (`app.da`): se e'
  una copia aggiornata, il Setup non avrebbe portato niente. La domanda esisteva, la risposta
  era gia' li', e noi scaricavamo lo stesso. Il costo piu' grosso non e' stato scrivere la
  funzione: e' stato accorgersi che la domanda si poteva fare.
"""


def main():
    with io.open(PERCORSO, 'r', encoding='utf-8', newline='') as f:
        testo = f.read()
    if 'una porta che nessuno conosce' in testo:
        print('FERMA: la lezione c\'e\' gia\'')
        sys.exit(1)
    righe = LEZIONE.replace('\r\n', '\n').split('\n')
    nuovo = '\r\n'.join(righe)
    if not testo.endswith('\r\n'):
        testo = testo + '\r\n'
    testo = testo + nuovo.lstrip('\r\n')
    if not testo.endswith('\r\n'):
        testo = testo + '\r\n'
    with io.open(PERCORSO, 'w', encoding='utf-8', newline='') as f:
        f.write(testo)
    print('lezioni aggiornate')


main()
