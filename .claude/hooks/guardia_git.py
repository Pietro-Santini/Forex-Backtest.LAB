#!/usr/bin/env python3
"""Ferma i comandi git pericolosi (cervello/REGOLE.md).

Pubblicare su main e' permesso (decisione del proprietario, 6 ottobre 2026) SOLO con il collaudo
verde da meno di 30 minuti: laboratorio/risultati/ultimo.md deve dire "Falliti: 0".
Si controlla solo un vero comando "git push" (non il testo dentro echo o file).
"""
import json, os, re, subprocess, sys, time


def cache_name_non_alzato(radice):
    """Messaggio di blocco se app.html cambia ma sw.js tiene lo stesso CACHE_NAME; altrimenti None.

    CACHE_NAME e' l'unica cosa che costringe telefoni e tablet a buttare via la copia in cache e
    riprendere i file nuovi. Pubblicare un app.html senza alzarlo vuol dire che la correzione non
    arriva a chi ha gia' aperto l'app, e SENZA nessun errore visibile: per chi l'ha scritta "non
    funziona", mentre in realta' non e' mai arrivata al browser. E' scritto in cervello/REGOLE.md e
    in trenta righe di commento dentro sw.js — segno che e' gia' stato dimenticato.
    """
    def git(*args):
        """Esegue git leggendo l'uscita come UTF-8.

        Senza `encoding` espliciti, su Windows Python decodifica con la codifica locale (cp1252) e
        su app.html scoppia dentro un thread di lettura: l'eccezione non arriva qui, il risultato
        resta vuoto e il controllo non blocca mai. Un controllo che fallisce in silenzio e' peggio
        di un controllo assente, perche' si crede di essere protetti.
        """
        try:
            return subprocess.run(["git"] + list(args), cwd=radice, capture_output=True,
                                  encoding="utf-8", errors="replace", timeout=25)
        except Exception:
            return None

    def nome_cache(testo):
        if not testo:
            return None
        m = re.search(r'CACHE_NAME\s*=\s*"([^"]+)"', testo)
        return m.group(1) if m else None

    # Si chiede a git se app.html differisce, invece di leggere e confrontare 4 MB: piu' veloce, e
    # nessun problema di codifica. Senza riferimento (niente rete, repo appena clonato) non si
    # blocca: un controllo che non puo' sapere non deve fermare il lavoro.
    rif = git("rev-parse", "--verify", "--quiet", "origin/main")
    if not rif or rif.returncode != 0:
        return None
    diverso = git("diff", "--quiet", "origin/main", "--", "app.html")
    if diverso is None or diverso.returncode == 0:
        return None                 # app.html non cambia: il CACHE_NAME puo' restare com'e'

    try:
        with open(os.path.join(radice, "sw.js"), encoding="utf-8", newline="") as f:
            sw_locale = f.read()
    except OSError:
        return None
    pubblicato_sw = git("show", "origin/main:sw.js")
    adesso = nome_cache(sw_locale)
    prima = nome_cache(pubblicato_sw.stdout if pubblicato_sw and pubblicato_sw.returncode == 0 else None)
    if adesso and prima and adesso == prima:
        return ("Bloccato: app.html cambia ma sw.js ha ancora lo stesso CACHE_NAME (%s).\n"
                "Senza un numero nuovo, telefoni e tablet continuano a usare la copia in cache: la "
                "correzione non arriva a nessuno, e non lo segnala nessun errore.\n"
                "Alza di uno il numero in sw.js e riprova. Regola: cervello/REGOLE.md." % adesso)
    return None


try:
    cmd = (json.load(sys.stdin).get("tool_input") or {}).get("command") or ""
except Exception:
    sys.exit(0)

# Solo i comandi che iniziano davvero con git (anche dopo && ; |): il testo dentro echo,
# heredoc o stringhe non e' un push.
comandi = [c.strip() for c in re.split(r"&&|\|\||;|\n", cmd)]
git_veri = [c for c in comandi if re.match(r"^(sudo\s+)?git\s", c)]

for c in git_veri:
    if re.match(r"^(sudo\s+)?git\s+push\b.*(\s--force(-with-lease)?\b|\s-f\b)", c):
        print("Bloccato (niente push forzati). Vedi cervello/REGOLE.md.", file=sys.stderr)
        sys.exit(2)
    if re.match(r"^(sudo\s+)?git\s+reset\s+--hard", c):
        print("Bloccato (niente reset --hard: si perdono modifiche). Vedi cervello/REGOLE.md.", file=sys.stderr)
        sys.exit(2)
    if re.match(r"^(sudo\s+)?git\s+push\b", c) and re.search(r"(\s|:)main\b", c):
        radice = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
        f = os.path.join(radice, "laboratorio", "risultati", "ultimo.md")
        try:
            verde = "Falliti: 0" in open(f, encoding="utf-8").read() and time.time() - os.path.getmtime(f) < 1800
        except OSError:
            verde = False
        if not verde:
            print("Bloccato: su main si pubblica solo con il collaudo verde da meno di 30 minuti. "
                  "Lancia prima: bash laboratorio/collauda.sh", file=sys.stderr)
            sys.exit(2)
        manca = cache_name_non_alzato(radice)
        if manca:
            print(manca, file=sys.stderr)
            sys.exit(2)
