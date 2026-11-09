# IL PONTE LOCALE DEVE POTER VERIFICARE I TOKEN FIREBASE, o «tieni i dati sul mio computer»
# non scrive nulla: /dati risponde 401 a tutti e la cartella E:\Forex Backtest Lab\dati resta
# vuota. documenti_utente.py verifica il token con google.oauth2.id_token (riga ~34) e mette
# _FB_AUTH_OK=False se quell'import non c'è — e quell'import c'e' solo se google-auth e'
# installata. Il server la ha (Dockerfile riga 11), il ponte locale no: e' il difetto misurato
# (cartella E: creata ma senza dati_utenti.db, Firestore con traffico, /dati 401).
#
# Non e' un test sul testo del codice per se': e' un INVARIANTE DI FORMA su una dipendenza,
# perche' una dipendenza mancante e' un difetto silenzioso — nessun test di comportamento
# potrebbe accorgersene senza il Setup installato su un PC con Firebase.
import os
import pathlib

RADICE = pathlib.Path(__file__).resolve().parents[2]
REQ = RADICE / "installer_build" / "build" / "requirements.txt"


def _dipendenze():
    nomi = []
    for riga in REQ.read_text(encoding="utf-8").splitlines():
        riga = riga.split("#", 1)[0].strip()
        if not riga:
            continue
        nomi.append(riga.split("==")[0].split(">")[0].split("<")[0].split("[")[0].strip().lower())
    return nomi


def test_il_ponte_dipende_da_google_auth():
    assert REQ.is_file(), "manca installer_build/build/requirements.txt"
    nomi = _dipendenze()
    assert "google-auth" in nomi, (
        "il ponte non elenca google-auth: _FB_AUTH_OK resta False, /dati rifiuta ogni token, "
        "E:\\Forex Backtest Lab\\dati resta vuota. Aggiungi 'google-auth' al requirements."
    )


def test_anche_il_server_ce_lha_prova_di_controllo():
    # Il server già la ha (Dockerfile): se un giorno sparisse da lì, è un guasto gemello.
    docker = RADICE / "server_oracle" / "Dockerfile"
    assert docker.is_file()
    assert "google-auth" in docker.read_text(encoding="utf-8"), (
        "il Dockerfile del server non installa piu' google-auth: il /dati del server "
        "smotterebbe di verificare i token."
    )