"""Inietta la versione del bundle in app.html PRESERVANDO la codifica UTF-8.

PERCHE' ESISTE (difetto misurato il 25 ottobre 2026):
la versione veniva iniettata con PowerShell —

    (Get-Content 'app.html' -Raw) -replace '__FBL_VERSIONE__', '2.0.27' |
        Set-Content 'app.html' -NoNewline -Encoding UTF8

In Windows PowerShell 5.1 `Get-Content` senza `-Encoding` legge i byte come ANSI
(Windows-1252), e `Set-Content -Encoding UTF8` risalva con BOM. Il file prodotto
era UTF-8 valido ma con il testo gia' rovinato: ogni emoji diventava "ðŸ..."
e ogni trattino lungo "â€”". Nel telefono (APK) TUTTE le icone accanto ai testi
sparivano, sostituite da lettere strane. Misurato sull'app.html dentro l'APK
v2.0.27: 800 "ðŸ", 1965 "â€", 4852 "Ã", 0 emoji vere.

Leggere e scrivere sempre in UTF-8 esplicito, senza BOM, senza tradurre i fine
riga (newline='' conserva i CRLF del file di partenza).

Uso:  python strumenti/inietta_versione.py <file.html> <versione>
"""
import io
import sys

SEGNAPOSTO = "__FBL_VERSIONE__"


def inietta(percorso, versione):
    """Sostituisce il segnaposto con la versione. Ritorna quante volte l'ha fatto."""
    with io.open(percorso, "r", encoding="utf-8", newline="") as f:
        testo = f.read()
    nuovo = testo.replace(SEGNAPOSTO, versione)
    with io.open(percorso, "w", encoding="utf-8", newline="") as f:
        f.write(nuovo)
    return testo.count(SEGNAPOSTO)


def main(argv):
    if len(argv) != 3:
        print("Uso: inietta_versione.py <file.html> <versione>")
        return 2
    percorso, versione = argv[1], argv[2]
    if not versione or versione == SEGNAPOSTO:
        print("ERRORE: versione non valida: %r" % (versione,))
        return 1
    quante = inietta(percorso, versione)
    print("Versione %s iniettata (%d occorrenze) in %s" % (versione, quante, percorso))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
