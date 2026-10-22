# TOLTI I BLOCCHI DUPLICATI DEL PANNELLO «COLLEGAMENTO».
#
# PERCHE' ESISTE UNO SCRIPT E NON UNA MODIFICA A MANO:
# il file ha 46.000 righe e i blocchi da togliere contengono trattini lunghi ed emoji: copiarli
# a mano rischia di cancellare il blocco SBAGLIATO (ne esistono due identici), e la lezione
# scritta in cervello/LEZIONI.md dice che uno script che sbaglia deve dirlo, non tacere.
#
# LA REGOLA: si tiene il PRIMO di ogni id e si cancella il SECONDO.
# Motivo misurato: il codice cerca i controlli con getElementById, che restituisce IL PRIMO.
# Quindi il secondo era gia' morto: il secondo «Collegamento: -» non cambiava mai testo e non
# reagiva, la seconda casella api_id non accettava piu' scrittura. Non era un difetto di stile:
# erano controlli fantasma.
#
# TRE CONTROLLI, IN QUESTO ORDINE:
#  1. prima di scrivere, ogni blocco da togliere deve contenere davvero l'id atteso (il file
#     potrebbe essere cambiato sotto i piedi: in quel caso lo script esce e NON tocca niente);
#  2. il pezzo VIVO (il primo) deve restare nel file;
#  3. dopo aver scritto, ogni id deve esistere ESATTAMENTE una volta nel testo.
#
# Uso: python laboratorio/strumenti/togli_dup_id.py
import io
import os
import sys

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FILE = os.path.join(RADICE, 'app.html')

# Gli id che devono restare UNO per uno. Ognuno di questi aveva due copie: si tiene la prima.
ID_DA_TENERE_UNO = [
    'tgToggleBtn', 'tgSetupBox', 'tgApiId', 'tgApiHash', 'tgSalvaCredBtn',
    'tgDimenticaTelBtn', 'tgTelefonoForgetBtn', 'tgTelefonoSalvatoLbl',
]

# (riga iniziale, riga finale, id che DEVE comparire nella riga)
# Le righe sono 1-based e riferite al file PRIMA della modifica.
BLOCCHI = [
    # Secondo «Collegamento», secondo «Esci da Telegram (dimentica il numero)», l'intestazione
    # «ACCESSO A TELEGRAM» rimasta appesa, e la seconda riga del numero salvato.
    (1921, 1931, 'tgToggleBtn'),
    # Il paragrafo sul numero ricordato (ripetuto identico) e il secondo blocco «Prima
    # configurazione» con api_id, api_hash e «Salva su questo dispositivo».
    (1979, 1999, 'tgSetupBox'),
]


def conta(testo, id_):
    return testo.count('id="%s"' % id_)


def main():
    with io.open(FILE, 'r', encoding='utf-8', newline='') as f:
        testo = f.read()
    righe = testo.split('\r\n')
    if righe and righe[-1] == '':
        righe = righe[:-1]          # ultima riga vuota: il file finisce con CRLF
    else:
        sys.exit('ERRORE: il file non termina con CRLF: non lo tocco per non stravolgerlo.')

    if len(righe) < 1999:
        sys.exit('ERRORE: il file ha solo %d righe, mi aspettavo almeno 1999.' % len(righe))

    # CONTROLLO 1: ogni blocco contiene l'id atteso, e ogni id era davvero in due copie.
    for (a, b, id_atteso) in BLOCCHI:
        blocco = '\n'.join(righe[a - 1:b])
        if ('id="%s"' % id_atteso) not in blocco:
            sys.exit('ERRORE: il blocco %d-%d non contiene id="%s": il file è cambiato, '
                     'non lo tocco. Contenuto:\n%s' % (a, b, id_atteso, blocco[:400]))
    for id_ in ID_DA_TENERE_UNO:
        n = conta(testo, id_)
        if n != 2:
            sys.exit('ERRORE: id="%s" compare %d volte (mi aspettavo 2): il file è diverso '
                     'da quello che ho letto, non lo tocco.' % (id_, n))

    # CONTROLLO 2: il pezzo VIVO (il primo) resta, e sta PRIMA del blocco da togliere.
    # Si conta quanti id di quel nome compaiono PRIMA della riga 'a': ne deve essere esattamente
    # uno (il pezzo vivo), altrimenti non saprei quale delle due copie il codice sta usando.
    for (a, b, id_atteso) in BLOCCHI:
        offset_a = len('\r\n'.join(righe[:a - 1]))
        prima = testo.count('id="%s"' % id_atteso, 0, offset_a)
        if prima != 1:
            sys.exit('ERRORE: prima della riga %d ci sono %d copie di id="%s" (ne deve essere 1): '
                     'non so quale sia quella che il codice usa, non lo tocco.' % (a, prima, id_atteso))

    # Dal fondo verso l'alto: cosi' i numeri di riga delle righe successive non cambiano.
    tolte = []
    for (a, b, id_atteso) in sorted(BLOCCHI, key=lambda x: -x[0]):
        tolte.append((a, b, id_atteso, righe[a - 1:b]))
        del righe[a - 1:b]

    nuovo = '\r\n'.join(righe) + '\r\n'

    # CONTROLLO 3: nel testo finale ogni id deve esistere UNA volta sola.
    for id_ in ID_DA_TENERE_UNO:
        n = conta(nuovo, id_)
        if n != 1:
            sys.exit('ERRORE DOPO LA MODIFICA: id="%s" compare %d volte invece di 1: '
                     'non scrivo il file.' % (id_, n))

    with io.open(FILE, 'w', encoding='utf-8', newline='') as f:
        f.write(nuovo)

    for (a, b, id_atteso, contenuto) in sorted(tolte, key=lambda x: x[0]):
        print('TOLTO righe %d-%d (id "%s"): %d righe' % (a, b, id_atteso, len(contenuto)))
    print('RIGHE: %d -> %d' % (len(testo.split('\r\n')) - 1, len(righe)))


if __name__ == '__main__':
    main()
