# -*- coding: utf-8 -*-
"""Accesso da altri dispositivi con Tailscale Serve, provato contro i TRE servizi veri.

Tailscale Serve gira le richieste del tablet ai servizi in locale: arrivano da 127.0.0.1, con
X-Forwarded-For (l'indirizzo vero del tablet) e con l'Host originale (nome-pc.xxxx.ts.net).
Qui si mandano richieste identiche, e si controlla che:
  - il PC (nessuna intestazione) passi sempre, come prima;
  - il tablet senza chiave, o con la chiave sbagliata, venga respinto - HTTP e WebSocket;
  - il tablet con la chiave passi;
  - la chiave e le impostazioni NON si possano leggere/cambiare dal tablet, nemmeno con la chiave;
  - spegnere l'accesso valga subito anche per grafico e segnali, senza riavviarli;
  - "Consenti" dia a Tailscale i tre comandi giusti, e li tolga quando si spegne.

Niente Windows, niente MetaTrader, niente Tailscale vero: MetaTrader5 e' finto, e "tailscale" e'
un piccolo programma finto che registra i comandi e risponde come quello vero.
    python test_accesso_tailscale.py
"""
import http.client
import json
import os
import shutil
import socket
import sys
import tempfile
import textwrap
import threading
import time
import types

QUI = os.path.dirname(os.path.abspath(__file__))
CHIAVE = "chiave-di-prova-lunga-abbastanza"
NOME_PC = "pc-di-prova.tail1234.ts.net"
TABLET = "100.101.102.103"
PORTE = {"ordini": 18000, "grafico": 18001, "segnali": 18769}

OK = True


def prova(nome, cond, extra=""):
    global OK
    if not cond:
        OK = False
    print(("  " + nome).ljust(74) + ("ok" if cond else "PROBLEMA") + (("   " + str(extra)) if extra else ""))


# --------------------------------------------------------------- preparazione in una copia
LAVORO = tempfile.mkdtemp(prefix="fbl_tailscale_")
COPIA = os.path.join(LAVORO, "build")
shutil.copytree(QUI, COPIA, ignore=shutil.ignore_patterns("__pycache__", "accesso_remoto.json",
                                                           "configurazione.json", "*.session"))
FILE_ACCESSO = os.path.join(COPIA, "accesso_remoto.json")


def scrivi_accesso(rete):
    with open(FILE_ACCESSO, "w", encoding="utf-8") as f:
        json.dump({"rete": rete, "chiave": CHIAVE}, f)
    time.sleep(0.05)   # mtime diverso anche sui file system con risoluzione grossolana


scrivi_accesso(True)

# Finto tailscale: registra ogni comando in un file e tiene lo stato delle regole di Serve.
CARTELLA_TS = os.path.join(LAVORO, "bin")
os.makedirs(CARTELLA_TS)
REGISTRO_TS = os.path.join(LAVORO, "comandi_tailscale.txt")
STATO_TS = os.path.join(LAVORO, "serve.json")
MODO_TS = os.path.join(LAVORO, "modo.txt")
FINTO = os.path.join(CARTELLA_TS, "finto_tailscale.py")
with open(FINTO, "w", encoding="utf-8") as f:
    f.write(textwrap.dedent('''
        import json, os, sys
        reg, stato, modo = %r, %r, %r
        a = sys.argv[1:]
        with open(reg, "a", encoding="utf-8") as f:
            f.write(" ".join(a) + "\\n")
        web = json.load(open(stato)) if os.path.isfile(stato) else {}
        if a[:2] == ["status", "--json"]:
            print(json.dumps({"BackendState": "Running", "Self": {"DNSName": %r + ".",
                  "TailscaleIPs": ["100.120.227.56", "fd7a:115c:a1e0::1"]}}))
        elif a[:3] == ["serve", "status", "--json"]:
            print(json.dumps({"Web": web} if web else {}))
        elif a and a[0] == "serve":
            if os.path.isfile(modo) and open(modo).read().strip() == "senza_https":
                print("Serve is not enabled on your tailnet.")
                print("To enable, visit:\\n\\n         https://login.tailscale.com/f/serve?node=abc123")
                sys.exit(1)
            porta = [x for x in a if x.startswith("--https=")][0].split("=")[1]
            chiave = %r + ".:" + porta
            if a[-1] == "off":
                web.pop(chiave, None)
            else:
                web[chiave] = {"Handlers": {"/": {"Proxy": a[-1]}}}
            json.dump(web, open(stato, "w"))
    ''' % (REGISTRO_TS, STATO_TS, MODO_TS, NOME_PC, NOME_PC)))
if os.name == "nt":
    with open(os.path.join(CARTELLA_TS, "tailscale.cmd"), "w") as f:
        f.write('@"%s" "%s" %%*\r\n' % (sys.executable, FINTO))
else:
    lanciatore = os.path.join(CARTELLA_TS, "tailscale")
    with open(lanciatore, "w") as f:
        f.write('#!/bin/sh\nexec "%s" "%s" "$@"\n' % (sys.executable, FINTO))
    os.chmod(lanciatore, 0o755)
os.environ["PATH"] = CARTELLA_TS + os.pathsep + os.environ.get("PATH", "")

# MetaTrader5 esiste solo su Windows: al suo posto un modulo che risponde a qualunque nome.
finto_mt5 = types.ModuleType("MetaTrader5")
finto_mt5.__dict__["__getattr__"] = lambda nome: (lambda *a, **k: None)
sys.modules["MetaTrader5"] = finto_mt5

sys.path[:0] = [COPIA, os.path.join(COPIA, "segnali_telegram")]
import accesso_condiviso  # noqa: E402
import bridge  # noqa: E402
import mt5_feed_server  # noqa: E402
import segnali_bridge  # noqa: E402

segnali_bridge.STATO["sim"] = True
segnali_bridge.STATO["verbose"] = False


def avvia(app, porta):
    import uvicorn
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=porta, log_level="critical"))
    threading.Thread(target=server.run, daemon=True).start()
    return server


for app_, porta in ((bridge.app, PORTE["ordini"]), (mt5_feed_server.app, PORTE["grafico"]),
                    (segnali_bridge.app, PORTE["segnali"])):
    avvia(app_, porta)
time.sleep(2.5)


# ----------------------------------------------------------------------- richieste
def richiesta(porta, percorso, metodo="GET", tablet=False, host=None, corpo=None, intest=None):
    """Tablet = come arriva da Tailscale Serve: da 127.0.0.1, con X-Forwarded-For e Host .ts.net."""
    h = dict(intest or {})
    h["Host"] = host or ((NOME_PC + ":%d" % porta) if tablet else ("127.0.0.1:%d" % porta))
    if tablet:
        h["X-Forwarded-For"] = TABLET
    dati = None
    if corpo is not None:
        dati = json.dumps(corpo)
        h["Content-Type"] = "application/json"
    c = http.client.HTTPConnection("127.0.0.1", porta, timeout=60)
    c.request(metodo, percorso, body=dati, headers=h)
    r = c.getresponse()
    testo = r.read().decode("utf-8", errors="replace")
    c.close()
    return r.status, dict((k.lower(), v) for k, v in r.getheaders()), testo


def websocket(porta, percorso, tablet=False):
    """Solo la stretta di mano: 101 = aperta, altro = rifiutata. Senza librerie: nessun proxy."""
    s = socket.create_connection(("127.0.0.1", porta), timeout=10)
    righe = ["GET %s HTTP/1.1" % percorso,
             "Host: " + ((NOME_PC + ":%d" % porta) if tablet else ("127.0.0.1:%d" % porta)),
             "Upgrade: websocket", "Connection: Upgrade",
             "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==", "Sec-WebSocket-Version: 13"]
    if tablet:
        righe.append("X-Forwarded-For: " + TABLET)
    s.sendall(("\r\n".join(righe) + "\r\n\r\n").encode())
    risposta = s.recv(200).decode("latin-1")
    s.close()
    try:
        return int(risposta.split(" ")[1])
    except Exception:
        return None


print("\nIl PC, come prima\n")
for nome, porta in PORTE.items():
    st, _, _ = richiesta(porta, "/health")
    prova("PC -> %s /health" % nome, st == 200, st)
st, _, corpo = richiesta(PORTE["ordini"], "/accesso-remoto")
prova("PC -> legge chiave e stato di Tailscale", st == 200 and CHIAVE in corpo, st)

print("\nIl tablet via Tailscale Serve, SENZA chiave\n")
for nome, porta in PORTE.items():
    st, h, _ = richiesta(porta, "/health", tablet=True)
    prova("tablet -> %s /health  respinto" % nome, st == 403, st)
st, h, _ = richiesta(PORTE["ordini"], "/health", tablet=True)
prova("il rifiuto ha il CORS (dal sito si legge \"chiave sbagliata\")",
      h.get("access-control-allow-origin") == "*", h.get("access-control-allow-origin"))
st, _, _ = richiesta(PORTE["segnali"], "/inietta", "POST", tablet=True,
                corpo={"chat": "GOLD Snipers", "testo": "XAUUSD BUY\nENTRY 4150\nSL 4100\nTP 4200"})
prova("tablet -> segnali POST /inietta (segnale finto)  respinto", st == 403, st)
prova("tablet -> segnali WebSocket  respinto", websocket(PORTE["segnali"], "/ws/segnali", tablet=True) == 403)
prova("tablet -> grafico WebSocket /ws/ticks  respinto",
      websocket(PORTE["grafico"], "/ws/ticks/EURUSD", tablet=True) == 403)

print("\nIl tablet con la chiave SBAGLIATA, o che finge di essere il PC\n")
st, _, _ = richiesta(PORTE["ordini"], "/health?chiave=sbagliata", tablet=True)
prova("chiave sbagliata  respinto", st == 403, st)
st, _, _ = richiesta(PORTE["ordini"], "/health", tablet=True, host="127.0.0.1:%d" % PORTE["ordini"])
prova("Host 127.0.0.1 ma con X-Forwarded-For  respinto", st == 403, st)
st, _, _ = richiesta(PORTE["ordini"], "/health", host="attaccante.example:%d" % PORTE["ordini"])
prova("nessun X-Forwarded-For ma Host estraneo (DNS rebinding)  respinto", st == 403, st)

print("\nIl tablet con la chiave GIUSTA\n")
q = "?chiave=" + CHIAVE
for nome, porta in PORTE.items():
    st, _, _ = richiesta(porta, "/health" + q, tablet=True)
    prova("tablet -> %s /health  passa" % nome, st == 200, st)
prova("tablet -> segnali WebSocket  passa", websocket(PORTE["segnali"], "/ws/segnali" + q, tablet=True) == 101)
prova("tablet -> grafico WebSocket  passa", websocket(PORTE["grafico"], "/ws/ticks/EURUSD" + q, tablet=True) == 101)
st, _, corpo = richiesta(PORTE["ordini"], "/accesso-remoto" + q, tablet=True)
prova("tablet CON chiave -> leggere la chiave  respinto", st == 403 and CHIAVE not in corpo, st)
st, _, _ = richiesta(PORTE["ordini"], "/accesso-remoto" + q, "POST", tablet=True, corpo={"rigenera_chiave": True})
prova("tablet CON chiave -> cambiare la chiave  respinto", st == 403, st)
st, _, _ = richiesta(PORTE["ordini"], "/disconnect" + q, "POST", tablet=True)
st2, _, _ = richiesta(PORTE["ordini"], "/health")
prova("tablet CON chiave -> spegnere MT5 e il ponte  respinto, ponte vivo", st == 403 and st2 == 200, (st, st2))

print("\nPermesso di Chrome per la rete privata\n")
st, h, _ = richiesta(PORTE["ordini"], "/health", "OPTIONS", tablet=True, intest={
    "Origin": "https://pietro-santini.github.io", "Access-Control-Request-Method": "GET",
    "Access-Control-Request-Private-Network": "true"})
prova("sito dell'app -> permesso concesso (200 + Allow-Private-Network)",
      st == 200 and h.get("access-control-allow-private-network") == "true", st)
st, h, _ = richiesta(PORTE["ordini"], "/order/buy", "OPTIONS", intest={
    "Origin": "https://sito-qualunque.example", "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Private-Network": "true"})
prova("sito qualunque sul PC -> permesso NEGATO", h.get("access-control-allow-private-network") != "true", st)

print("\nSpegnere vale SUBITO anche per grafico e segnali (niente riavvio)\n")
scrivi_accesso(False)
for nome, porta in PORTE.items():
    st, _, corpo = richiesta(porta, "/health" + q, tablet=True)
    prova("spento: tablet con chiave -> %s  respinto" % nome, st == 403 and "spento" in corpo, st)
scrivi_accesso(True)
bridge.ACCESSO_REMOTO.update({"rete": True, "chiave": CHIAVE})

print("\n\"Consenti\" dall'app: i comandi dati a Tailscale\n")
open(REGISTRO_TS, "w").close()
st, _, corpo = richiesta(PORTE["ordini"], "/accesso-remoto", "POST", corpo={"rete": True})
r = json.loads(corpo) if st == 200 else {}
comandi = [x for x in open(REGISTRO_TS).read().splitlines() if x.startswith("serve --")]
attesi = ["serve --bg --https=%d http://127.0.0.1:%d" % (p, p) for p in accesso_condiviso.PORTE_SERVIZI]
prova("acceso: i tre comandi 'tailscale serve' giusti", comandi == attesi, comandi if comandi != attesi else "")
ts = (r.get("tailscale") or {})
prova("acceso: esito ok, lette le tre regole", ts.get("ok") is True
      and all(ts.get("stato", {}).get("serve", {}).get(str(p)) for p in accesso_condiviso.PORTE_SERVIZI), ts.get("detail", ""))
prova("acceso: nome da scrivere sul tablet", ts.get("stato", {}).get("nome") == NOME_PC, ts.get("stato", {}).get("nome"))
prova("acceso: nessun riavvio richiesto", r.get("riavvio_necessario") is False)

open(REGISTRO_TS, "w").close()
st, _, corpo = richiesta(PORTE["ordini"], "/accesso-remoto", "POST", corpo={"rete": False})
r = json.loads(corpo) if st == 200 else {}
comandi = [x for x in open(REGISTRO_TS).read().splitlines() if x.startswith("serve --")]
prova("spento: le tre regole tolte", comandi == ["serve --https=%d off" % p for p in accesso_condiviso.PORTE_SERVIZI], comandi)
prova("spento: nessuna regola rimasta", not any((r.get("tailscale") or {}).get("stato", {}).get("serve", {}).values()))

print("\nHTTPS non ancora abilitato nella rete Tailscale\n")
with open(MODO_TS, "w") as f:
    f.write("senza_https")
st, _, corpo = richiesta(PORTE["ordini"], "/accesso-remoto", "POST", corpo={"rete": True})
ts = (json.loads(corpo).get("tailscale") or {}) if st == 200 else {}
prova("l'app riceve il link per abilitarlo", str(ts.get("link", "")).startswith("https://login.tailscale.com/"), ts.get("link"))
prova("e non dichiara 'fatto'", ts.get("ok") is False)

shutil.rmtree(LAVORO, ignore_errors=True)
print("\nESITO:", "tutto ok" if OK else "ci sono problemi")
os._exit(0 if OK else 1)
