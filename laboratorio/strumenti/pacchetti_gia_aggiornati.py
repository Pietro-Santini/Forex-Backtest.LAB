# -*- coding: utf-8 -*-
"""Il wizard MT5: se i pacchetti sono gia' installati e l'app qui e' gia' aggiornata, il
pulsante di download sparisce.

Il problema del proprietario (22 ottobre 2026): «30-40 file nella cartella Download invece
di uno sostituito». Il pulsante di download dei pacchetti, quando i pacchetti sono gia'
installati, aggiungeva un file alla cartella Download senza portare niente: l'app qui e'
gia' aggiornata, quindi riscaricare non cambierebbe niente.

Lo script sposta le righe byte per byte (emoji e trattini lunghi intatti) e non scrive nulla
se un aggancio non e' unico.
"""
import io
import os
import sys

PERCORSO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'app.html'))

with io.open(PERCORSO, 'r', encoding='utf-8', newline='') as f:
    TESTO = f.read()


def sostituisce(testo, vecchio, nuovo, perche):
    quante = testo.count(vecchio)
    if quante != 1:
        print('FERMA (%s): trovati %d riscontri, ne serve esattamente 1' % (perche, quante))
        sys.exit(1)
    return testo.replace(vecchio, nuovo, 1)


# ---- 1. Il ramo "pacchetti gia' installati": il download sparisce se l'app e' aggiornata ----
VECCHIO_1 = '\r\n'.join([
    "  // Il download resta raggiungibile, ma non e' piu' la cosa da fare: non deve stare per primo.",
    "  if(scarica)scarica.textContent='Scarica di nuovo i pacchetti (solo se il problema resta)';",
])
NUOVO_1 = '\r\n'.join([
    "  // IL DOWNLOAD SPARE IL FILE: se anche l'app qui è già aggiornata, riscaricare il pacchetto",
    "  // non cambierebbe niente (il programma sa aggiornarsi da solo) e aggiungerebbe un file alla",
    "  // cartella Download a ogni richiesta. Il pulsante sparisce; resta un link per reinstallarlo a",
    "  // mano se il problema è un altro (vedi fblAppQuiGiaAggiornata).",
    "  if(await fblAppQuiGiaAggiornata()){",
    "    if(scarica)scarica.style.display='none';",
    "    if(testo)testo.innerHTML='I pacchetti su questo computer <b>risultano già installati</b> e '",
    "      +'l\\'app qui è <b>già aggiornata</b>: riscaricarli non cambierebbe niente e aggiungerebbe solo '",
    "      +'un file alla cartella Download. Quasi sempre vuol dire che il computer è appena stato acceso '",
    "      +'e il servizio non ha ancora fatto in tempo a partire: <b>riavvia il computer</b> e premi '",
    "      +'«Riprova». Se il problema resta, l\\'installatore si può riscaricare a mano dalla '",
    "      +'<a href=\"'+DESKTOP_APP_DOWNLOAD_URL+'\" target=\"_blank\" rel=\"noopener\">pagina delle versioni</a>.';",
    "  }else{",
    "    // Il download resta raggiungibile, ma non e' piu' la cosa da fare: non deve stare per primo.",
    "    if(scarica)scarica.textContent='Scarica di nuovo i pacchetti (solo se il problema resta)';",
    "  }",
])
TESTO = sostituisce(TESTO, VECCHIO_1, NUOVO_1, 'ramo pacchetti gia installati')

# ---- 2. I due chiamanti aspettano le parole (la funzione ora e' asincrona) ----
VECCHIO_2 = " if(!health.ok){ mt5Passo1Parole(pontGiaVisto); mt5ShowStepVisible(1); return; }"
NUOVO_2 = " if(!health.ok){ await mt5Passo1Parole(pontGiaVisto); mt5ShowStepVisible(1); return; }"
TESTO = sostituisce(TESTO, VECCHIO_2, NUOVO_2, 'chiamante mt5StartLoginFlow')

VECCHIO_3 = '\r\n'.join([
    "   mt5Passo1Parole(pontGiaVisto);",
    "   mt5ShowStepVisible(1);",
])
NUOVO_3 = '\r\n'.join([
    "   await mt5Passo1Parole(pontGiaVisto);",
    "   mt5ShowStepVisible(1);",
])
TESTO = sostituisce(TESTO, VECCHIO_3, NUOVO_3, 'chiamante del gate')

with io.open(PERCORSO, 'w', encoding='utf-8', newline='') as f:
    f.write(TESTO)
print('fatto: il wizard non scarica piu\' i pacchetti quando l\'app e\' gia\' aggiornata')
