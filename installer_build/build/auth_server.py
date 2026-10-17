import json
import os
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, Request


# --- Configurazione ---
# Dove vive l'elenco degli utenti. Sul server Oracle lo decide FBL_UTENTI_FILE e punta alla cartella
# dei dati (/dati), che e' un volume: se l'elenco stesse accanto al codice, ogni ricostruzione
# dell'immagine cancellerebbe le chiavi di tutti, e ognuno si ritroverebbe fuori senza capire
# perche'. Senza quella variabile (sul PC) resta accanto a questo file, come prima.
UTENTI_FILE = os.environ.get("FBL_UTENTI_FILE") or os.path.join(os.path.dirname(__file__),
                                                                "utenti_server.json")


def _carica_utenti():
    try:
        with open(UTENTI_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _salva_utenti(utenti):
    # La cartella puo' non esserci (primo avvio su una cartella dati nuova): si crea, altrimenti il
    # primo utente che si registra non riuscirebbe a salvare la propria chiave.
    try:
        os.makedirs(os.path.dirname(UTENTI_FILE), exist_ok=True)
    except Exception:
        pass
    with open(UTENTI_FILE, "w", encoding="utf-8") as f:
        json.dump(utenti, f, indent=2, ensure_ascii=False)


def verifica_token_firebase(token):
    try:
        import firebase_admin
        from firebase_admin import auth, credentials

        if not firebase_admin._apps:
            cred_path = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
            else:
                firebase_admin.initialize_app()

        decoded = auth.verify_id_token(token)
        return decoded
    except ImportError:
        pass
    except Exception:
        # Token non valido, oppure chiavi di Firebase non scaricabili: non e' un guasto del server,
        # si prova la strada REST qui sotto. Senza questo, un token sbagliato diventava un 500.
        pass

    try:
        import urllib.request
        url = "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyCz9y-5d9AxqjDtJPbBYyHaUOYRKDGUaO0"
        data = json.dumps({"idToken": token}).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            users = result.get("users", [])
            if users:
                u = users[0]
                return {"uid": u.get("localId"), "email": u.get("email", "")}
    except Exception:
        # Il motivo vero (compreso l'indirizzo chiamato, che contiene la chiave web di Firebase)
        # resta qui e non esce: /register ora e' raggiungibile senza chiave, e a chi bussa senza
        # credenziali non si racconta come e' fatta la serratura.
        raise HTTPException(status_code=401, detail="Token Firebase non valido")

    raise HTTPException(status_code=401, detail="Token Firebase non valido")


def registra_utente(token_firebase):
    decoded = verifica_token_firebase(token_firebase)
    uid = decoded.get("uid") or decoded.get("localId")
    email = decoded.get("email", "")

    if not uid:
        raise HTTPException(status_code=400, detail="Token non contiene uid")

    utenti = _carica_utenti()

    if uid in utenti:
        utenti[uid]["ultimo_accesso"] = datetime.now(timezone.utc).isoformat()
        _salva_utenti(utenti)
        return utenti[uid]["chiave"]

    chiave = str(uuid.uuid4())
    utenti[uid] = {
        "chiave": chiave,
        "email": email,
        "creato": datetime.now(timezone.utc).isoformat(),
        "ultimo_accesso": datetime.now(timezone.utc).isoformat(),
    }
    _salva_utenti(utenti)
    return chiave


def valida_chiave(chiave):
    if not chiave:
        return None
    utenti = _carica_utenti()
    for uid, info in utenti.items():
        if info.get("chiave") == chiave:
            return uid
    return None


def revoca_chiave(uid):
    utenti = _carica_utenti()
    if uid in utenti:
        del utenti[uid]
        _salva_utenti(utenti)
        return True
    return False


async def verifica_accesso(request: Request):
    chiave = request.headers.get("X-API-Key") or request.query_params.get("chiave")
    uid = valida_chiave(chiave)
    if not uid:
        raise HTTPException(status_code=403, detail="Chiave non valida o mancante")
    return uid


def registra_router(app):
    @app.post("/register")
    async def register_endpoint(request: Request):
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Body non valido")
        token = body.get("token", "")
        if not token:
            raise HTTPException(status_code=400, detail="Token mancante")
        chiave = registra_utente(token)
        return {"chiave": chiave, "ok": True}

    @app.get("/verifica_chiave")
    async def verifica_chiave_endpoint(request: Request):
        chiave = request.query_params.get("chiave") or request.headers.get("X-API-Key")
        uid = valida_chiave(chiave)
        if not uid:
            raise HTTPException(status_code=403, detail="Chiave non valida o mancante")
        return {"uid": uid, "ok": True}
