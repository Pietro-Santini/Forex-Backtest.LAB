"""Controlla che le icone (emoji) dentro l'APK siano ancora se stesse.

PERCHE' ESISTE: il 25 ottobre 2026 l'APK v2.0.27 e' finito in release con TUTTE le icone
rotte. L'app.html dentro l'APK conteneva 800 "ðŸ", 1965 "â€" e 4852 "Ã", e zero emoji vere:
l'iniezione della versione in `aggiorna_www.bat` rileggeva il file con la codifica ANSI di
Windows. Il Desktop era sano, quindi il difetto non si vedeva provando l'app sul PC.

Uso:  python strumenti/controlla_icone_apk.py [percorso.apk]
Senza argomenti guarda l'APK del progetto Capacitor. Esce con 1 se trova il testo rovinato.
"""
import io
import os
import re
import sys
import zipfile

APK_PREDEFINITO = os.path.join(
    os.path.expanduser("~"), "Desktop", "trading", "forex-backtest-mobile",
    "android", "app", "build", "outputs", "apk", "debug", "ForexBacktestLAB.apk")

# La console di Windows e' cp1252: stampare "✔" la fa cadere con UnicodeEncodeError.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROVINATO = {u"\u00f0\u0178": "ðŸ", u"\u00e2\u20ac": "â€", u"\u00c3": "Ã"}
EMOJI = re.compile(u"[\U0001F300-\U0001FAFF]")
SIMBOLI = re.compile(u"[\u2190-\u21FF\u2600-\u27BF\u2B00-\u2BFF]")


def controlla(percorso):
    if not os.path.exists(percorso):
        print("APK non trovato: %s" % percorso)
        return 2
    with zipfile.ZipFile(percorso) as z:
        nomi = [n for n in z.namelist() if n.endswith("app.html")]
        if not nomi:
            print("Dentro l'APK non c'e' nessun app.html: %s" % percorso)
            return 2
        dati = z.read(nomi[0])
    testo = dati.decode("utf-8")
    emoji = len(EMOJI.findall(testo))
    simboli = len(SIMBOLI.findall(testo))
    print("file: %s (%d byte, BOM: %s)" % (nomi[0], len(dati), dati.startswith(b"\xef\xbb\xbf")))
    print("emoji vere: %d   simboli (frecce, ✔, ★...): %d" % (emoji, simboli))
    rotto = False
    for chiave, etichetta in ROVINATO.items():
        quante = testo.count(chiave)
        if quante:
            rotto = True
            print("TESTO ROVINATO: %d occorrenze di %s" % (quante, etichetta))
    if not emoji and not simboli:
        rotto = True
        print("TESTO ROVINATO: nessuna emoji e nessun simbolo superstite")
    if rotto:
        print("ESITO: KO - le icone nell'APK non sono utilizzabili")
        return 1
    print("ESITO: OK - le icone sono intatte")
    return 0


if __name__ == "__main__":
    percorso = sys.argv[1] if len(sys.argv) > 1 else APK_PREDEFINITO
    sys.exit(controlla(percorso))
