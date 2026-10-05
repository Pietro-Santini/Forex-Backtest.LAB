# -*- coding: utf-8 -*-
"""Accesso da altri dispositivi: la regola, una sola volta, per tutti e tre i servizi.

I servizi sono tre e girano separati:
  - ForexBacktestLAB.exe  porta 8000  ordini veri su MetaTrader
  - Mt5FeedServer.exe     porta 8001  dati del grafico
  - SegnaliBridge.exe     porta 8769  sale segnali Telegram

SOLO TAILSCALE
==============
I tre servizi ascoltano SOLO su 127.0.0.1, sempre. Dagli altri dispositivi ci si arriva con
Tailscale Serve, che risponde in HTTPS sul nome del PC (nome-pc.xxxx.ts.net) e gira le richieste
ai servizi qui, in locale. Niente porte aperte sulla Wi-Fi, niente regole del firewall, e sul
tablet si usa il sito normale: https verso https, lo stesso login.

La conseguenza che conta: "arriva da 127.0.0.1" NON vuol piu' dire "e' il PC". Ci arriva anche
Tailscale Serve, per conto del tablet. Lo si riconosce da due cose che Tailscale Serve fa SEMPRE
(verificato sul suo sorgente, ipn/ipnlocal/serve.go): imposta X-Forwarded-For con l'indirizzo vero
di chi chiede, e lascia l'Host originale (il nome .ts.net). Una richiesta e' del PC solo se non ha
nessuna delle due - vedi richiesta_locale(). Tutti e tre i servizi usano quella funzione e nessun
altro controllo: tre copie divergono, e una divergenza qui e' una porta aperta senza chiave.
"""
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
from typing import Optional

FILE_ACCESSO = "accesso_remoto.json"

# I tre servizi stanno nella stessa cartella dell'eseguibile principale. SegnaliBridge sta in una
# sottocartella quando si lavora dai sorgenti, quindi si risale finche' non si trova il file.
_MAX_RISALITA = 3

NOMI_LOCALI = ("127.0.0.1", "::1", "localhost")
PORTE_SERVIZI = (8000, 8001, 8769)      # ordini, grafico, segnali

# I soli siti a cui si concede il permesso per la rete privata (vedi installa_controllo_chiave):
# quello dell'app. Concederlo a tutti vorrebbe dire lasciare che QUALUNQUE sito aperto sul PC
# parli con i servizi su 127.0.0.1 - che per il PC stesso non chiedono la chiave.
ORIGINI_FIDATE = ("https://pietro-santini.github.io",)

MESSAGGI_RIFIUTO = {
    "spento": "L'accesso da altri dispositivi e' spento su questo PC. "
              "Si accende dall'app, in Collegamento/Modalita'.",
    "chiave": "Chiave d'accesso mancante o errata.",
}


def percorso_accesso() -> str:
    """Il file accanto all'eseguibile; dai sorgenti, risalendo dalla cartella dello script."""
    if getattr(sys, "frozen", False):
        base = os.path.dirname(os.path.abspath(sys.executable))
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    corrente = base
    for _ in range(_MAX_RISALITA):
        candidato = os.path.join(corrente, FILE_ACCESSO)
        if os.path.isfile(candidato):
            return candidato
        su = os.path.dirname(corrente)
        if su == corrente:
            break
        corrente = su
    # Non trovato: si crea accanto all'eseguibile, dove lo cerca anche bridge.py.
    return os.path.join(base, FILE_ACCESSO)


_CACHE = {"percorso": None, "mtime": None, "dati": None}


def carica_accesso() -> dict:
    """La configurazione, riletta ogni volta che il file cambia.

    Prima la si leggeva una volta all'avvio: accendere l'accesso o cambiare la chiave dall'app
    valeva per gli ordini (bridge.py riscrive il file) ma non per grafico e segnali finche' non si
    riavviavano. Il file non si crea qui: lo crea bridge.py. Se manca si risponde "spento", che e'
    il valore prudente.
    """
    percorso = percorso_accesso()
    try:
        mtime = os.path.getmtime(percorso)
    except OSError:
        mtime = None
    if _CACHE["dati"] is not None and _CACHE["percorso"] == percorso and _CACHE["mtime"] == mtime:
        return dict(_CACHE["dati"])
    dati = {}
    if mtime is not None:
        try:
            with open(percorso, "r", encoding="utf-8") as f:
                dati = json.load(f) or {}
        except Exception:
            dati = {}
    dati.setdefault("rete", False)
    dati.setdefault("chiave", "")
    _CACHE.update(percorso=percorso, mtime=mtime, dati=dict(dati))
    return dict(dati)


def host_di_ascolto(dati: Optional[dict] = None) -> str:
    """Sempre e solo 127.0.0.1.

    Tailscale Serve raggiunge i servizi da qui. Ascoltare sulla rete (0.0.0.0) non serve piu', e
    vorrebbe dire porte aperte anche sulla Wi-Fi - pubblica compresa. `dati` resta solo perche'
    i servizi lo passano ancora.
    """
    return "127.0.0.1"


def e_locale(host: Optional[str]) -> bool:
    """Solo l'indirizzo. NON basta per dire che una richiesta e' del PC: vedi richiesta_locale."""
    return str(host or "") in NOMI_LOCALI


def _host_senza_porta(valore: str) -> str:
    v = str(valore or "").strip().lower()
    if v.startswith("["):                      # IPv6 fra parentesi: [::1]:8000
        return v[1:v.find("]")] if "]" in v else v
    if v.count(":") == 1:
        return v.split(":", 1)[0]
    return v


def richiesta_locale(conn) -> bool:
    """True solo se la richiesta viene davvero dal PC stesso.

    `conn` e' una Request o una WebSocket di FastAPI: hanno entrambe .client e .headers.
    Tre condizioni, tutte necessarie:
      - arriva da un indirizzo di loopback;
      - NON porta X-Forwarded-For (ne' Forwarded / X-Forwarded-Host): Tailscale Serve lo mette
        sempre, e lo SOVRASCRIVE, quindi il tablet non puo' toglierlo;
      - l'Host e' 127.0.0.1 / localhost: Tailscale Serve lascia il nome .ts.net. Protegge anche
        dal "DNS rebinding" (un sito che si fa risolvere su 127.0.0.1).
    Una pagina sul PC che aggiungesse X-Forwarded-For da se' verrebbe trattata come remota: il
    senso dell'errore e' quello giusto, al massimo le serve la chiave.
    """
    try:
        cliente = conn.client.host if conn.client else None
    except Exception:
        cliente = None
    if not e_locale(cliente):
        return False
    try:
        intest = conn.headers
        if intest.get("x-forwarded-for") or intest.get("forwarded") or intest.get("x-forwarded-host"):
            return False
        host = _host_senza_porta(intest.get("host") or "")
    except Exception:
        return False
    return (not host) or host in NOMI_LOCALI


def chiave_valida(conn, dati: dict) -> bool:
    attesa = dati.get("chiave") or ""
    try:
        data = conn.headers.get("x-fbl-chiave") or conn.query_params.get("chiave") or ""
    except Exception:
        data = ""
    return bool(attesa) and secrets.compare_digest(str(data), str(attesa))


def motivo_rifiuto(conn) -> Optional[str]:
    """None se la richiesta puo' passare; altrimenti "spento" o "chiave"."""
    if richiesta_locale(conn):
        return None
    dati = carica_accesso()
    if not dati.get("rete"):
        return "spento"
    if not chiave_valida(conn, dati):
        return "chiave"
    return None


def opzioni_cors() -> dict:
    """Le opzioni CORS, uguali per i tre servizi.

    Niente allow_private_network qui: Starlette lo concederebbe a TUTTI i siti (le origini sono
    "*"). Il permesso per la rete privata lo da' installa_controllo_chiave(), solo al sito
    dell'app (ORIGINI_FIDATE).
    """
    return {"allow_origins": ["*"], "allow_methods": ["*"], "allow_headers": ["*"]}


def installa_controllo_chiave(app, dati: Optional[dict] = None, percorsi_liberi=()):
    """Aggiunge a un'app FastAPI il controllo della chiave per tutto cio' che non viene dal PC.

    `dati` non si usa piu' (la configurazione si rilegge dal file): resta per non cambiare la
    chiamata nei servizi.
    `percorsi_liberi`: pagine (solo GET) che si aprono anche senza chiave perche' sono loro a
    chiederla, come /prova del servizio segnali. Non contengono dati: ogni chiamata che fanno poi
    passa dal controllo normale, con la chiave inserita.
    """
    liberi = set(percorsi_liberi or ())
    from fastapi.responses import JSONResponse, Response

    @app.middleware("http")
    async def _controlla_chiave(request, call_next):
        # OPTIONS passa sempre: e' il preambolo che il browser manda da solo prima di una chiamata
        # con intestazioni personalizzate. Non porta dati e non esegue niente.
        if request.method == "OPTIONS":
            # Chrome chiede un permesso in piu' prima che un sito pubblico parli con un indirizzo
            # di una rete privata: Tailscale (100.64.0.0/10) o 127.0.0.1. Starlette lo rifiuta con
            # un 400, e senza permesso la chiamata vera non parte nemmeno. Lo si concede SOLO al
            # sito dell'app: a un sito qualunque aperto sul PC resta negato, come prima.
            origine = request.headers.get("origin") or ""
            if request.headers.get("access-control-request-private-network") and origine in ORIGINI_FIDATE:
                return Response(status_code=200, content="OK", headers={
                    "Access-Control-Allow-Origin": origine,
                    "Access-Control-Allow-Methods": request.headers.get("access-control-request-method") or "GET",
                    "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers") or "*",
                    "Access-Control-Allow-Private-Network": "true",
                    "Access-Control-Max-Age": "600",
                    "Vary": "Origin",
                })
            return await call_next(request)
        if request.method == "GET" and request.url.path in liberi:
            return await call_next(request)
        motivo = motivo_rifiuto(request)
        if motivo is None:
            return await call_next(request)
        # CORS anche sul rifiuto: senza, dal sito il browser nasconde il 403 e l'app vede solo
        # "irraggiungibile", invece di poter dire "la chiave non torna".
        return JSONResponse(status_code=403, content={"detail": MESSAGGI_RIFIUTO[motivo]},
                            headers={"Access-Control-Allow-Origin": "*"})

    return _controlla_chiave


def websocket_autorizzato(websocket, dati: Optional[dict] = None) -> bool:
    """Come sopra, per le WebSocket: il middleware HTTP non le vede."""
    return motivo_rifiuto(websocket) is None


# ----------------------------------------------------------------------------- Tailscale
# Il PC si presenta agli altri dispositivi con Tailscale Serve: una regola per ciascuna delle tre
# porte, https://nome-pc.xxxx.ts.net:PORTA -> http://127.0.0.1:PORTA. Stessi numeri di porta da una
# parte e dall'altra: l'app cambia solo "http://127.0.0.1" in "https://nome-pc.xxxx.ts.net".
_RE_LINK = re.compile(r"https://login\.tailscale\.com/\S+")


def _tailscale_exe() -> Optional[str]:
    trovato = shutil.which("tailscale")
    if trovato:
        return trovato
    for var in ("ProgramFiles", "ProgramW6432", "ProgramFiles(x86)"):
        base = os.environ.get(var)
        if base:
            candidato = os.path.join(base, "Tailscale", "tailscale.exe")
            if os.path.isfile(candidato):
                return candidato
    return None


def _esegui(argomenti, timeout: float = 15.0) -> dict:
    """Esegue la riga di comando di Tailscale senza finestre. Non solleva mai: torna un esito."""
    exe = _tailscale_exe()
    if not exe:
        return {"ok": False, "codice": None, "testo": "Tailscale non e' installato su questo PC."}
    flag = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if os.name == "nt" else 0
    try:
        r = subprocess.run([exe] + list(argomenti), capture_output=True, timeout=timeout,
                           creationflags=flag)
        uscita = (r.stdout or b"").decode("utf-8", errors="replace").strip()
        testo = (uscita + "\n" + (r.stderr or b"").decode("utf-8", errors="replace")).strip()
        return {"ok": r.returncode == 0, "codice": r.returncode, "testo": testo, "uscita": uscita}
    except subprocess.TimeoutExpired as e:
        # Quando HTTPS non e' ancora abilitato nella rete Tailscale, "serve" stampa un link e resta
        # in attesa che lo si apra. Non si aspetta: si prende il link e lo si mostra nell'app.
        parziale = ((e.stdout or b"") + b"\n" + (e.stderr or b""))
        if isinstance(parziale, bytes):
            parziale = parziale.decode("utf-8", errors="replace")
        return {"ok": False, "codice": None, "testo": str(parziale).strip(), "scaduto": True}
    except Exception as e:
        return {"ok": False, "codice": None, "testo": "%s: %s" % (e.__class__.__name__, e)}


def _porte_servite(config: dict) -> dict:
    """Da `tailscale serve status --json`: quali delle tre porte sono girate al servizio giusto."""
    fuori = {str(p): False for p in PORTE_SERVIZI}
    web = (config or {}).get("Web") or {}
    for chiave, voce in web.items():
        porta = str(chiave).rsplit(":", 1)[-1]
        if porta not in fuori:
            continue
        for gestore in ((voce or {}).get("Handlers") or {}).values():
            dest = str((gestore or {}).get("Proxy") or "").rstrip("/")
            if dest.endswith("127.0.0.1:" + porta) or dest.endswith("localhost:" + porta):
                fuori[porta] = True
    return fuori


def stato_tailscale() -> dict:
    """Tutto quello che l'app deve sapere per guidare l'utente, senza che debba aprire un terminale."""
    if not _tailscale_exe():
        return {"installato": False}
    st = _esegui(["status", "--json"], timeout=10)
    info = {"installato": True, "attivo": False, "nome": "", "ip": "", "serve": {str(p): False for p in PORTE_SERVIZI}}
    try:
        j = json.loads(st.get("uscita") or "")
    except Exception:
        j = None
    if isinstance(j, dict):
        io = j.get("Self") or {}
        info["attivo"] = (j.get("BackendState") == "Running")
        info["nome"] = str(io.get("DNSName") or "").rstrip(".")
        ips = [x for x in (io.get("TailscaleIPs") or []) if "." in str(x)]
        info["ip"] = ips[0] if ips else ""
    else:
        info["errore"] = st["testo"][:300]
    sv = _esegui(["serve", "status", "--json"], timeout=10)
    try:
        info["serve"] = _porte_servite(json.loads(sv.get("uscita") or "{}"))
    except Exception:
        pass            # nessuna regola, o uscita non JSON: le tre porte restano "non servite"
    return info


def attiva_serve(accendi: bool) -> dict:
    """Accende o spegne le tre regole di Tailscale Serve, e dice com'e' andata DAVVERO.

    L'esito si legge dallo stato finale, non dai codici d'uscita: spegnere una regola che non
    c'era da' errore e va benissimo, e un "ok" del comando non garantisce che la regola ci sia.
    """
    if not _tailscale_exe():
        return {"ok": False, "detail": "Tailscale non e' installato su questo PC.",
                "stato": {"installato": False}}
    passi = []
    for p in PORTE_SERVIZI:
        if accendi:
            argomenti = ["serve", "--bg", "--https=%d" % p, "http://127.0.0.1:%d" % p]
        else:
            argomenti = ["serve", "--https=%d" % p, "off"]
        esito = _esegui(argomenti, timeout=15)
        passi.append({"porta": p, "comando": "tailscale " + " ".join(argomenti),
                      "ok": esito["ok"], "testo": esito["testo"][:500]})
        link = _RE_LINK.search(esito["testo"] or "")
        if accendi and (link or esito.get("scaduto")):
            # HTTPS non abilitato nella rete Tailscale: inutile provare le altre due porte.
            return {"ok": False, "passi": passi, "link": link.group(0) if link else None,
                    "detail": "Tailscale deve prima abilitare HTTPS per la tua rete: si fa una volta "
                              "sola, dal link qui sotto.", "stato": stato_tailscale()}
    stato = stato_tailscale()
    voluto = bool(accendi)
    ok = all(stato.get("serve", {}).get(str(p)) == voluto for p in PORTE_SERVIZI)
    esito = {"ok": ok, "passi": passi, "stato": stato}
    if not ok:
        esito["detail"] = ("Tailscale non ha applicato tutte le regole. Qui sotto c'e' la risposta "
                           "di ogni comando.")
    return esito
