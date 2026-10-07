#!/usr/bin/env python3
"""Impedisce di mettere chiavi e sessioni dentro git.

Regola del progetto (cervello/REGOLE.md): mai chiavi API nel repository, nel cloud o nei messaggi.
Finora era scritta e basta: nessun controllo la imponeva. Un `git add -A` in una cartella che
contiene `API_KEY_ORACLE.txt` o `sessione_segnali.session` la infrange in silenzio, e una chiave
finita nella storia di git non si toglie piu' cancellando il file: vanno riscritti i commit, e se
nel frattempo e' partito un push la chiave e' bruciata e va cambiata.

Un `.gitignore` protegge UNA cartella. Questo controllo vale ovunque Claude lanci git, anche in una
cartella che un `.gitignore` non ce l'ha (e' esattamente il caso della cartella di lavoro sul
Desktop, repository senza commit e senza `.gitignore` fino al 7 ottobre 2026).

Si guarda cosa git sta DAVVERO per aggiungere, non il testo del comando: `git add -A` non nomina
nessun file, ed e' proprio il comando piu' pericoloso.
"""
import json
import os
import re
import subprocess
import sys

# Nomi che non devono entrare in git. Si guarda il NOME del file, non il contenuto: leggere il
# contenuto di ogni file aggiunto sarebbe lento e, su un file grosso, inutile.
SOSPETTI = re.compile(
    r"(api[_\- ]?key"          # API KEY ANTHROPIC.txt, API_KEY_ORACLE.txt
    r"|[_\- ]token"            # API_KEY_TOKEN_ACCESSO.txt
    r"|recovery|recupero"      # github-recovery-codes.txt
    r"|credenzial|password"
    r"|\.session$|\.session-journal$"   # entrare nell'account senza password
    r"|^accesso_remoto\.json$"
    r"|^configurazione\.json$"          # quella con api_id/api_hash veri
    r"|^mt5-accounts\.json$|^mt5-config\.json$|^capital-config\.json$"
    r"|^cors\.json$"
    r"|\.pem$|\.key$|^id_rsa|^id_ed25519)",
    re.I)

# L'esempio SENZA segreti deve poter entrare: serve a chi installa.
AMMESSI = re.compile(r"(esempio|example|sample|\.gitignore$)", re.I)


def file_in_arrivo(cartella):
    """I file che il prossimo commit aggiungerebbe: gia' in scaletta, piu' quelli non tracciati.

    `git add -A` prende tutto quello che git vede, quindi si guarda tutto quello che git vede e
    non e' ignorato. --porcelain li elenca con lo stato davanti.
    """
    try:
        r = subprocess.run(["git", "status", "--porcelain", "--untracked-files=all"],
                           cwd=cartella, capture_output=True, text=True, timeout=20)
    except Exception:
        return []
    if r.returncode != 0:
        return []
    fuori = []
    for riga in (r.stdout or "").splitlines():
        if len(riga) < 4:
            continue
        percorso = riga[3:].strip().strip('"')
        if " -> " in percorso:                 # file rinominato: conta la destinazione
            percorso = percorso.split(" -> ")[-1].strip().strip('"')
        fuori.append(percorso)
    return fuori


def pericolosi(percorsi):
    out = []
    for p in percorsi:
        nome = os.path.basename(p)
        if AMMESSI.search(nome):
            continue
        if SOSPETTI.search(nome):
            out.append(p)
    return out


def main():
    try:
        dati = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    cmd = (dati.get("tool_input") or {}).get("command") or ""

    # Solo i comandi che sono davvero git (anche dopo && ; |): il testo dentro echo o in un
    # heredoc non e' un comando.
    pezzi = [c.strip() for c in re.split(r"&&|\|\||;|\n", cmd)]
    git_veri = [c for c in pezzi if re.match(r"^(sudo\s+)?git\s", c)]
    aggiunge = [c for c in git_veri
                if re.match(r"^(sudo\s+)?git\s+add\b", c)
                or re.match(r"^(sudo\s+)?git\s+commit\b.*\s-[a-zA-Z]*a", c)]
    if not aggiunge:
        sys.exit(0)

    cartella = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    brutti = pericolosi(file_in_arrivo(cartella))
    if not brutti:
        sys.exit(0)

    elenco = "\n".join("  - " + b for b in brutti[:12])
    extra = "" if len(brutti) <= 12 else "\n  …e altri %d." % (len(brutti) - 12)
    print(
        "Bloccato: con questo comando finirebbero in git dei file che sembrano contenere "
        "segreti.\n" + elenco + extra +
        "\n\nUna chiave finita nella storia di git non si toglie cancellando il file. "
        "Mettili in .gitignore (o aggiungi i file uno per uno, per nome), poi riprova."
        "\nRegola: cervello/REGOLE.md.",
        file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()
