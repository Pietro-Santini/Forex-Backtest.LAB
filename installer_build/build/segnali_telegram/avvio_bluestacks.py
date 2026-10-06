"""Avvio automatico di BlueStacks e di Syntra, ridotti a icona (Forex Backtest LAB).

RICHIESTO: "quando attiviamo 'Leggi le operazioni condivise su Syntra', se BlueStacks e' chiuso lo
apre da solo e apre Syntra, senza che l'utente tocchi nulla; e gira in background, ridotto a icona".

- Trova BlueStacks 5 (HD-Player.exe) dal registro di Windows (BlueStacks_nxt -> InstallDir) o
  nelle cartelle standard; il percorso si puo' anche scrivere a mano nelle impostazioni.
- Trova l'istanza giusta dal file bluestacks.conf: quella con la porta ADB dell'indirizzo
  impostato (es. 127.0.0.1:5555 -> 5555); se non la trova, la prima.
- Lo avvia con "--instance <istanza> --cmd launchApp --package io.syntra.app" (apre gia' Syntra) e
  ne riduce a icona la finestra SENZA portarla davanti (SW_SHOWMINNOACTIVE), solo nei primi
  secondi dopo l'avvio: se poi l'utente la riapre per guardare, non gliela si richiude addosso.
- Syntra in primo piano dentro l'emulatore: se no, la si riapre via ADB (monkey sul pacchetto).
Fuori da Windows non fa niente.
"""
import os
import re
import subprocess
import time
from typing import List, Optional

PACCHETTO = "io.syntra.app"
ESEGUIBILE = "HD-Player.exe"


def _win() -> bool:
    return os.name == "nt"


def _registro(chiave: str, valore: str) -> Optional[str]:
    if not _win():
        return None
    try:
        import winreg
        for radice in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
            for vista in (0, getattr(winreg, "KEY_WOW64_64KEY", 0), getattr(winreg, "KEY_WOW64_32KEY", 0)):
                try:
                    with winreg.OpenKey(radice, chiave, 0, winreg.KEY_READ | vista) as k:
                        v, _ = winreg.QueryValueEx(k, valore)
                        if v:
                            return str(v)
                except OSError:
                    continue
    except Exception:
        pass
    return None


def trova_player(percorso_scelto: str = "") -> Optional[str]:
    candidati: List[str] = []
    if percorso_scelto:
        candidati.append(percorso_scelto)
    d = _registro(r"SOFTWARE\BlueStacks_nxt", "InstallDir")
    if d:
        candidati.append(os.path.join(d, ESEGUIBILE))
    for base in (os.environ.get("ProgramFiles", r"C:\Program Files"), os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")):
        candidati += [os.path.join(base, "BlueStacks_nxt", ESEGUIBILE), os.path.join(base, "BlueStacks", ESEGUIBILE)]
    for c in candidati:
        if c and os.path.isfile(c):
            return c
    return None


def trova_adb(percorso_scelto: str = "") -> Optional[str]:
    """adb da usare per Syntra, senza chiedere niente all'utente (RICHIESTO: deve funzionare dopo il
    Setup, senza scaricare altro). In ordine: quello scritto nelle impostazioni, quello che BlueStacks
    5 installa gia' (HD-Adb.exe, accanto a HD-Player.exe), un adb nel PATH, C:\\platform-tools."""
    import shutil
    candidati: List[str] = []
    if percorso_scelto:
        candidati.append(percorso_scelto)
    d = _registro(r"SOFTWARE\BlueStacks_nxt", "InstallDir")
    if d:
        candidati.append(os.path.join(d, "HD-Adb.exe"))
    for base in (os.environ.get("ProgramFiles", r"C:\Program Files"), os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")):
        candidati += [os.path.join(base, "BlueStacks_nxt", "HD-Adb.exe"), os.path.join(base, "BlueStacks", "HD-Adb.exe")]
    for nome in ("adb.exe", "adb"):
        w = shutil.which(nome)
        if w:
            candidati.append(w)
    candidati.append(r"C:\platform-tools\adb.exe")
    for c in candidati:
        if c and os.path.isfile(c):
            return c
    return None


def trova_istanza(porta_adb: Optional[int]) -> Optional[str]:
    cartella = _registro(r"SOFTWARE\BlueStacks_nxt", "UserDefinedDir") or os.path.join(os.environ.get("ProgramData", r"C:\ProgramData"), "BlueStacks_nxt")
    conf = os.path.join(cartella, "bluestacks.conf")
    try:
        testo = open(conf, encoding="utf-8", errors="replace").read()
    except OSError:
        return None
    istanze = []
    for m in re.finditer(r'^bst\.instance\.([^.]+)\.status\.adb_port="(\d+)"', testo, re.M):
        istanze.append((m.group(1), int(m.group(2))))
    if not istanze:
        nomi = re.findall(r'^bst\.instance\.([^.]+)\.', testo, re.M)
        return nomi[0] if nomi else None
    for nome, porta in istanze:
        if porta_adb and porta == porta_adb:
            return nome
    return istanze[0][0]


def in_esecuzione() -> bool:
    if not _win():
        return True
    try:
        r = subprocess.run(["tasklist", "/FI", "IMAGENAME eq %s" % ESEGUIBILE, "/NH"], capture_output=True, text=True,
                           timeout=15, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        return ESEGUIBILE.lower() in (r.stdout or "").lower()
    except Exception:
        return True      # nel dubbio non si lancia un secondo emulatore


def avvia(player: str, istanza: Optional[str]) -> None:
    args = [player]
    if istanza:
        args += ["--instance", istanza]
    args += ["--cmd", "launchApp", "--package", PACCHETTO]
    flag = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    subprocess.Popen(args, close_fds=True, creationflags=flag)


def riduci_a_icona() -> int:
    """Riduce a icona, senza attivarle, le finestre visibili di HD-Player.exe. Restituisce quante."""
    if not _win():
        return 0
    import ctypes
    from ctypes import wintypes
    user32, kernel32 = ctypes.windll.user32, ctypes.windll.kernel32
    trovate = []

    def nome_processo(pid: int) -> str:
        h = kernel32.OpenProcess(0x1000, False, pid)        # PROCESS_QUERY_LIMITED_INFORMATION
        if not h:
            return ""
        try:
            buf = ctypes.create_unicode_buffer(1024)
            n = wintypes.DWORD(1024)
            if kernel32.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(n)):
                return os.path.basename(buf.value)
            return ""
        finally:
            kernel32.CloseHandle(h)

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def ogni(hwnd, _):
        if user32.IsWindowVisible(hwnd) and not user32.IsIconic(hwnd) and user32.GetWindowTextLengthW(hwnd) > 0:
            pid = wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
            if nome_processo(pid.value).lower() == ESEGUIBILE.lower():
                trovate.append(hwnd)
        return True

    user32.EnumWindows(ogni, 0)
    for hwnd in trovate:
        user32.ShowWindow(hwnd, 7)        # SW_SHOWMINNOACTIVE: ridotta, senza rubare il primo piano
    return len(trovate)


def porta_da_indirizzo(indirizzo: str) -> Optional[int]:
    m = re.search(r":(\d+)$", indirizzo or "")
    return int(m.group(1)) if m else None
