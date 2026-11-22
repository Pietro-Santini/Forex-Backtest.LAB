# -*- coding: utf-8 -*-
"""Controlli 7-bis per le rotte ordini esposte via dominio pubblico.

Prima di togliere Tailscale, le rotte che toccano i soldi (/pc/8000/*) devono
rifiutare: segreto mancante, segreto revocato, origine non ammessa. Ogni rifiuto
va nel registro.
"""
from __future__ import annotations

import json
import os
import time
from typing import Optional

ORIGINI_APP = {
    "https://pietro-santini.github.io",
    "https://localhost",
    "http://localhost",
    "https://127.0.0.1",
    "http://127.0.0.1",
}

PORTE_ORDINI = {8000}

# Rate limit semplice in memoria (per-IP, finestra 60s). Sufficiente come primo argine.
# 600/min: il polling ordini/grafico/conto dell'app genera molte richieste legittime.
_RATE_FINESTRA_S = 60
_RATE_MAX_RICHIESTE = 600
_RATE_BUCKET = {}  # ip -> [timestamp, ...]


def _dati_dir() -> str:
    return os.environ.get("FBL_DATI") or "/dati"


def percorso_registro() -> str:
    return os.path.join(_dati_dir(), "registro_rifiuti.jsonl")


def registra_rifiuto(motivo: str, request, dettaglio: str = "") -> None:
    voce = {
        "ts": time.time(),
        "motivo": motivo,
        "metodo": getattr(request, "method", ""),
        "path": str(getattr(getattr(request, "url", None), "path", "")),
        "origin": str(request.headers.get("origin") or ""),
        "host": str(request.headers.get("host") or ""),
        "xff": str(request.headers.get("x-forwarded-for") or ""),
    }
    if dettaglio:
        voce["dettaglio"] = str(dettaglio)[:200]
    p = percorso_registro()
    try:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "a", encoding="utf-8") as f:
            f.write(json.dumps(voce, ensure_ascii=False) + "\n")
    except Exception:
        # Il rifiuto conta più del log: non si apre per un errore di scrittura log.
        pass


def _chiave_inviata(request) -> str:
    try:
        return str(request.headers.get("x-fbl-chiave") or request.query_params.get("chiave") or "")
    except Exception:
        return ""


def _origine_ammessa(request) -> bool:
    origin = str(request.headers.get("origin") or "").strip()
    if not origin:
        return False
    return origin in ORIGINI_APP


def porta_da_path(path: str) -> Optional[int]:
    # /pc/8000/..., /pc/8001/...; /pc/<percorso> senza porta = 8000
    p = str(path or "")
    if not p.startswith("/pc/"):
        return None
    resto = p[4:]  # dopo /pc/
    parti = resto.split("/", 1)
    prima = parti[0]
    if prima.isdigit():
        return int(prima)
    # /pc/registra, /pc (stato) - non una porta ordini
    if prima in ("registra", ""):
        return None
    return 8000


def e_rotta_ordini(request) -> bool:
    path = str(getattr(getattr(request, "url", None), "path", ""))
    if path == "/pc" or path == "/pc/":
        return False
    # Sync dati (Firebase token) non è un'operazione ordini: non va bloccata da 7-bis.
    if path.endswith("/dati/ascolta"):
        return False
    porta = porta_da_path(path)
    return porta in PORTE_ORDINI


def _ip_richiesta(request) -> str:
    xff = str(request.headers.get("x-forwarded-for") or "")
    if xff:
        return xff.split(",")[0].strip()
    try:
        return str(request.client.host) if request.client else ""
    except Exception:
        return ""


def _rate_limit_superato(request) -> bool:
    ip = _ip_richiesta(request) or "?"
    ora = time.time()
    bucket = _RATE_BUCKET.setdefault(ip, [])
    # tieni solo finestra
    soglia = ora - _RATE_FINESTRA_S
    while bucket and bucket[0] < soglia:
        bucket.pop(0)
    if len(bucket) >= _RATE_MAX_RICHIESTE:
        return True
    bucket.append(ora)
    return False


def motivo_rifiuto_7bis(request) -> Optional[str]:
    """None se ok, altrimenti motivo stringa per registro/risposta."""
    if not e_rotta_ordini(request):
        return None
    # Richieste davvero locali (PC stesso): non sono esposizione pubblica.
    try:
        import accesso_condiviso as accesso
        if accesso.richiesta_locale(request):
            return None
    except Exception:
        pass
    # 7-bis si applica all'esposizione via proxy/dominio (Caddy/Tailscale): c'e' X-Forwarded-For/Host.
    # Le chiamate interne senza proxy non sono la superficie pubblica che stiamo proteggendo.
    try:
        intest = request.headers
        if not (intest.get("x-forwarded-for") or intest.get("forwarded") or intest.get("x-forwarded-host")):
            return None
    except Exception:
        return None
    if _rate_limit_superato(request):
        return "limite_richieste"
    # Origine: deve essere dell'app.
    if not _origine_ammessa(request):
        return "origine_non_ammessa"
    chiave = _chiave_inviata(request)
    if not chiave:
        return "segreto_mancante"
    # Revocato?
    try:
        import auth_server
        if auth_server.chiave_revocata(chiave):
            return "segreto_revocato"
    except Exception:
        pass
    # Valido? (chiave personale o condivisa)
    try:
        import accesso_condiviso as accesso
        dati = accesso.carica_accesso()
        if accesso.chiave_valida(request, dati):
            return None
        import auth_server
        if auth_server.valida_chiave(chiave) is not None:
            return None
    except Exception:
        pass
    # Chiave presente ma non valida: se era revocata l'abbiamo già colta; altrimenti è mancante/errata.
    return "segreto_mancante"


def messaggio_rifiuto(motivo: str) -> str:
    if motivo == "origine_non_ammessa":
        return "Origine non ammessa."
    if motivo == "segreto_revocato":
        return "Segreto revocato."
    if motivo == "limite_richieste":
        return "Troppe richieste: riprova tra poco."
    return "Segreto mancante o non valido."
