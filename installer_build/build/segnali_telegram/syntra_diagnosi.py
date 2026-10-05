"""SYNTRA - PASSO 1: DIAGNOSI.

Legge cosa "vede" Android nella schermata di Syntra aperta sul telefono, senza toccare niente.
Serve a capire SE e COME i dati (utente, asset, entrata, TP, SL) si possono leggere come testo.

Funziona con un EMULATORE ANDROID sul PC (nessun telefono). Prima di lanciarlo:
  1. Scarica "SDK Platform-Tools for Windows" (sito ufficiale Android developer), scompatta lo
     zip in C:\platform-tools  (dentro ci deve essere adb.exe).
  2. Emulatore:
     - Android Studio (Device Manager, immagine "Google Play"): adb lo vede da solo.
     - BlueStacks 5: Impostazioni -> Avanzate -> attiva "Android Debug Bridge (ADB)" e annota
       l'indirizzo (di solito 127.0.0.1:5555). Poi lancia lo script con  --indirizzo 127.0.0.1:5555
  3. Installa Syntra dal Play Store dell'emulatore, accedi, apri la schermata dell'operazione.

Uso (Prompt dei comandi, nella cartella di questo file):
    python syntra_diagnosi.py

Crea la cartella "diagnosi_syntra" con: schermo.png, schermo.xml, testi.txt. Mandameli tutti e tre.
Ripeti con la schermata ELENCO delle operazioni condivise (quella da cui si apre il dettaglio):
    python syntra_diagnosi.py elenco
Con BlueStacks aggiungi l'indirizzo:   python syntra_diagnosi.py elenco --indirizzo 127.0.0.1:5555
"""
import os
import shutil
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

CARTELLA = "diagnosi_syntra"


def trova_adb():
    for p in (shutil.which("adb"), r"C:\platform-tools\adb.exe",
              os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe")):
        if p and os.path.isfile(p):
            return p
    return None


SERIALE = []   # dispositivo scelto (-s ...), riempito in main()


def esegui(adb, *argomenti, binario=False):
    if argomenti and argomenti[0] not in ("devices", "connect"):
        argomenti = (*SERIALE, *argomenti)
    r = subprocess.run([adb, *argomenti], capture_output=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout).decode("utf-8", "replace").strip())
    return r.stdout if binario else r.stdout.decode("utf-8", "replace")


def main():
    argv = list(sys.argv[1:])
    indirizzo = None
    if "--indirizzo" in argv:
        i = argv.index("--indirizzo")
        indirizzo = argv[i + 1] if i + 1 < len(argv) else None
        del argv[i:i + 2]
    nome = argv[0] if argv else "dettaglio"
    adb = trova_adb()
    if not adb:
        print("Non trovo adb.exe. Scompatta Platform-Tools in C:\\platform-tools (vedi istruzioni in cima al file).")
        return 1
    if indirizzo:
        print(esegui(adb, "connect", indirizzo).strip())
    dispositivi = [r.split("\t") for r in esegui(adb, "devices").splitlines()[1:] if r.strip()]
    if indirizzo:
        dispositivi = [d for d in dispositivi if d[0] == indirizzo] or dispositivi
    if not dispositivi:
        print("Nessun emulatore trovato. Avvia l'emulatore (con BlueStacks attiva ADB e usa --indirizzo).")
        return 1
    if dispositivi[0][1] != "device":
        print("Emulatore trovato ma non autorizzato (%s): accetta la richiesta nell'emulatore." % dispositivi[0][1])
        return 1
    SERIALE[:] = ["-s", dispositivi[0][0]]
    print("Uso: %s" % dispositivi[0][0])
    os.makedirs(CARTELLA, exist_ok=True)
    base = os.path.join(CARTELLA, nome)

    # 1) Testo della schermata (albero dell'interfaccia): e' quello che useremo davvero.
    xml_ok = True
    try:
        esegui(adb, "shell", "uiautomator", "dump", "/sdcard/fbl_syntra.xml")
        esegui(adb, "pull", "/sdcard/fbl_syntra.xml", base + ".xml")
        esegui(adb, "shell", "rm", "/sdcard/fbl_syntra.xml")
    except Exception as e:
        xml_ok = False
        print("Lettura dell'interfaccia NON riuscita: %s" % e)

    # 2) Screenshot, per confrontare.
    try:
        with open(base + ".png", "wb") as f:
            f.write(esegui(adb, "exec-out", "screencap", "-p", binario=True))
    except Exception as e:
        print("Screenshot non riuscito (l'app potrebbe bloccarli): %s" % e)

    # 3) Elenco dei testi trovati, in ordine di posizione sullo schermo.
    righe = []
    if xml_ok:
        try:
            radice = ET.parse(base + ".xml").getroot()
            for n in radice.iter("node"):
                t = (n.get("text") or "").strip()
                d = (n.get("content-desc") or "").strip()
                if t or d:
                    righe.append("%-22s pacchetto=%s classe=%s id=%s | testo=%r | desc=%r" % (
                        n.get("bounds"), n.get("package"), n.get("class"), n.get("resource-id"), t, d))
        except Exception as e:
            righe.append("XML illeggibile: %s" % e)
    with open(base + "_testi.txt", "w", encoding="utf-8") as f:
        f.write("Syntra - diagnosi %s - %s\n\n" % (nome, time.strftime("%Y-%m-%d %H:%M:%S")))
        f.write("\n".join(righe) if righe else "NESSUN TESTO LETTO dall'interfaccia.\n")
    print("Fatto: %d testi letti. File in %s\\ (%s.xml, %s.png, %s_testi.txt)" % (len(righe), CARTELLA, nome, nome, nome))
    if xml_ok and not righe:
        print("ATTENZIONE: l'app non espone testi ad Android. Servira' la lettura dallo screenshot (OCR), piu' fragile.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
