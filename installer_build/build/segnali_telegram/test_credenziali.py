# -*- coding: utf-8 -*-
"""Prova del salvataggio delle credenziali Telegram dall'app.

Si lavora su una copia della configurazione in una cartella temporanea: il file vero dell'utente
non viene toccato in nessun caso.

Quello che conta qui:
 - i valori sbagliati vengono fermati SUBITO, con un messaggio comprensibile (scoprirlo al primo
   collegamento, con un errore di Telegram, sarebbe molto peggio);
 - il salvataggio UNISCE e non sovrascrive: l'elenco delle sale non deve sparire;
 - il numero di telefono si puo' dimenticare;
 - nei log non finisce mai nessun valore.
"""
import io
import json
import os
import shutil
import sys
import tempfile

import segnali_bridge as b

OK = True


def prova(nome, cond, extra=""):
    global OK
    if not cond:
        OK = False
    print(("  " + nome).ljust(58) + ("ok" if cond else "PROBLEMA") + (("   " + str(extra)) if extra else ""))


base = tempfile.mkdtemp(prefix="provacfg")
vero = b.FILE_CONFIG
b.FILE_CONFIG = os.path.join(base, "configurazione.json")
righe_log = []
vero_log = b._log
b._log = lambda v, t: righe_log.append(t)

try:
    # Si parte da una configurazione che contiene gia' delle sale: il salvataggio non deve
    # cancellarle.
    io.open(b.FILE_CONFIG, "w", encoding="utf-8").write(json.dumps(
        {"chat": ["goldsnipers11", "fthgold"], "sessione": "sessione_segnali"}))

    print("\nValori sbagliati: fermati subito\n")
    for etichetta, api_id, api_hash in [
        ("API ID non numerico", "abc", "0123456789abcdef0123456789abcdef"),
        ("API ID vuoto", "", "0123456789abcdef0123456789abcdef"),
        ("hash troppo corto", "12345678", "abcd"),
        ("hash con caratteri strani", "12345678", "zzzz56789abcdef0123456789abcdef!"),
    ]:
        coppia, errore = b._credenziali_valide(api_id, api_hash)
        prova(etichetta + " -> rifiutato", coppia is None and bool(errore), errore)

    print("\nValori buoni: accettati e salvati\n")
    coppia, errore = b._credenziali_valide(" 12345678 ", " 0123456789ABCDEF0123456789abcdef ")
    prova("coppia valida accettata", coppia is not None and errore is None, errore or "")
    prova("api_id diventa un numero", coppia and coppia[0] == 12345678, coppia and coppia[0])
    prova("spazi intorno tolti", coppia and len(coppia[1]) == 32, coppia and len(coppia[1]))

    err = b.salva_configurazione({"api_id": coppia[0], "api_hash": coppia[1]})
    prova("salvataggio riuscito", err is None, err or "")
    cfg = json.loads(io.open(b.FILE_CONFIG, encoding="utf-8").read())
    prova("le sale non sono state cancellate", cfg.get("chat") == ["goldsnipers11", "fthgold"], cfg.get("chat"))
    prova("il nome sessione resta", cfg.get("sessione") == "sessione_segnali")
    prova("api_id salvato", cfg.get("api_id") == 12345678)
    prova("api_hash salvato", len(cfg.get("api_hash") or "") == 32)

    print("\nNumero di telefono: si salva e si puo' dimenticare\n")
    b.salva_configurazione({"telefono": "393331234567"})
    cfg = json.loads(io.open(b.FILE_CONFIG, encoding="utf-8").read())
    prova("numero salvato", cfg.get("telefono") == "393331234567")
    b.salva_configurazione({"telefono": None})
    cfg = json.loads(io.open(b.FILE_CONFIG, encoding="utf-8").read())
    prova("numero dimenticato", cfg.get("telefono") is None)
    prova("ma le sale ci sono ancora", cfg.get("chat") == ["goldsnipers11", "fthgold"])

    print("\nNiente credenziali nei log\n")
    segreti = ["0123456789abcdef0123456789abcdef", "12345678", "393331234567"]
    sporche = [r for r in righe_log if any(x in r for x in segreti)]
    prova("nessun valore finisce nei log", not sporche, " | ".join(sporche))

finally:
    b._log = vero_log
    b.FILE_CONFIG = vero
    shutil.rmtree(base, ignore_errors=True)

print("\nESITO:", "tutto ok" if OK else "ci sono problemi")
sys.exit(0 if OK else 1)
