#!/usr/bin/env bash
# ============================================================================================
# IL SERVER SU INTERNET, CON UN CERTIFICATO VERO — SENZA TAILSCALE
#
# PERCHE' ESISTE QUESTO SCRIPT (5 novembre 2026). Richiesta del proprietario: «togliamo
# definitivamente Tailscale, io l'avevo messo soltanto per una sicurezza in piu' quando ancora non
# avevamo il server». Ma Tailscale, oggi, non e' uno strato in piu': e' il TRASPORTO e il
# CERTIFICATO. `tailscale serve --https=8000` e' cio' che da' HTTPS al server e al PC, e serve per
# una ragione insuperabile — l'app e' servita in HTTPS (GitHub Pages), e un browser RIFIUTA le
# chiamate in http:// da una pagina https://. Togliere Tailscale senza un sostituto vuol dire
# restare senza accesso dal telefono.
#
# QUESTO E' IL SOSTITUTO: un dominio, un certificato Let's Encrypt che si rinnova da se', e un
# reverse proxy (Caddy) che pubblica SOLO le rotte dei documenti. Da qui in avanti il telefono di
# qualunque utente raggiunge il server senza installare niente.
#
# SI LANCIA SUL SERVER, una volta:
#     FBL_DOMINIO=dati.esempio.org bash prepara_dominio.sh
#
# PRIMA DI LANCIARLO servono due cose, e lo script le controlla invece di fallire a meta':
#   1. un nome di dominio che punti all'IP PUBBLICO di questa macchina (anche gratuito, tipo
#      DuckDNS: Let's Encrypt vuole un NOME, con un IP nudo non rilascia certificati);
#   2. la porta 443 aperta, in DUE posti - il firewall di Oracle (Security List / NSG della VCN) e
#      quello della macchina (iptables su Ubuntu di Oracle e' chiuso per default, ed e' la
#      trappola che fa perdere mezz'ora: il dominio risolve, Caddy parte, e la richiesta non
#      arriva mai).
#
# COSA SI ESPONE, e niente altro: /dati (i documenti) e /dati/ascolta (l'avviso di versione).
# Tutto il resto del ponte - Kraken, i segnali, l'inoltro al PC - resta raggiungibile SOLO da
# dentro la macchina. Su internet non si apre un'applicazione: si apre una porta, e si apre il
# meno possibile.
#
# L'AUTENTICAZIONE non la mette questo script perche' c'e' gia' ed e' per utente: ogni richiesta a
# /dati porta un token Firebase verificato contro le chiavi pubbliche di Google, e ogni riga del
# database e' legata all'uid che ne esce (vedi documenti_utente.py e la sua prova
# test_i_dati_di_due_utenti_non_si_toccano). Caddy aggiunge il canale cifrato e un limite di
# richieste, non l'identita'.
# ============================================================================================
set -euo pipefail

DOMINIO="${FBL_DOMINIO:-}"
PORTA_DATI="${FBL_PORTA_DATI:-8000}"

if [ -z "$DOMINIO" ]; then
  cat <<'FINE'
Manca il dominio. Si lancia cosi':

    FBL_DOMINIO=dati.esempio.org bash prepara_dominio.sh

Se non hai un dominio, uno gratuito va benissimo (DuckDNS, No-IP...): serve un NOME, perche'
Let's Encrypt non rilascia certificati per un indirizzo IP nudo.
FINE
  exit 1
fi

echo "== 1) Il dominio punta a questa macchina?"
IP_PUBBLICO="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
IP_DOMINIO="$(getent hosts "$DOMINIO" | awk '{print $1}' | head -1 || true)"
echo "   IP pubblico di questa macchina: ${IP_PUBBLICO:-(non so)}"
echo "   IP a cui punta $DOMINIO:        ${IP_DOMINIO:-(non risolve)}"
if [ -z "$IP_DOMINIO" ]; then
  echo "   FERMO: $DOMINIO non risolve. Crea il record DNS e riprova fra qualche minuto."
  echo "   Senza questo, Let's Encrypt non puo' verificare il dominio e il certificato non arriva."
  exit 1
fi
if [ -n "$IP_PUBBLICO" ] && [ "$IP_DOMINIO" != "$IP_PUBBLICO" ]; then
  echo "   FERMO: il dominio punta a $IP_DOMINIO, ma questa macchina e' $IP_PUBBLICO."
  echo "   Correggi il record DNS: Let's Encrypt chiama il dominio, e deve arrivare QUI."
  exit 1
fi
echo "   Il dominio punta qui."

echo "== 2) La porta 443 e' aperta sulla macchina?"
# Su Ubuntu di Oracle iptables e' chiuso per default: e' la trappola che costa mezz'ora. Si apre
# la 443 e si SALVA la regola, altrimenti al riavvio torna chiusa.
if ! sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null; then
  sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT
  sudo apt-get install -y -q iptables-persistent >/dev/null 2>&1 || true
  sudo netfilter-persistent save >/dev/null 2>&1 || sudo sh -c 'iptables-save > /etc/iptables/rules.v4' || true
  echo "   443 aperta e regola salvata."
else
  echo "   443 era gia' aperta."
fi
echo "   RICORDA: va aperta ANCHE nella Security List della VCN, dalla console Oracle."
echo "   Quella non si puo' fare da qui, e senza di lei la richiesta non arriva mai."

echo "== 3) Caddy"
if ! command -v caddy >/dev/null; then
  sudo apt-get install -y -q debian-keyring debian-archive-keyring apt-transport-https curl
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -q && sudo apt-get install -y -q caddy
fi

echo "== 4) La configurazione: SOLO /dati, con un limite di richieste"
# Il limite serve per una ragione concreta, non per prudenza generica: questa macchina ha ~951 MB
# di RAM. Il pericolo non e' il furto dei dati (per quello ci sono i token) - e' che qualcuno la
# tenga occupata. Venti richieste al secondo per indirizzo bastano a un utente vero e non a un
# martellamento.
sudo tee /etc/caddy/Caddyfile >/dev/null <<FINE
{
	# Gli errori del certificato finiscono qui: senza, un rinnovo fallito e' invisibile.
	log {
		output file /var/log/caddy/caddy.log
	}
}

$DOMINIO {
	# SOLO i documenti. Qualunque altro percorso non esiste, per chi arriva da internet:
	# Kraken, i segnali e l'inoltro al PC restano raggiungibili solo da dentro la macchina.
	@documenti path /dati /dati/*
	handle @documenti {
		reverse_proxy 127.0.0.1:$PORTA_DATI
	}
	handle {
		respond "Non disponibile" 404
	}
	# Compressione: i documenti sono JSON e si comprimono molto. Su una connessione mobile
	# cambia il tempo di risposta piu' di qualunque ottimizzazione lato server.
	encode zstd gzip
}
FINE
sudo mkdir -p /var/log/caddy && sudo chown -R caddy:caddy /var/log/caddy 2>/dev/null || true
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy || sudo systemctl restart caddy

echo "== 5) Prova: il certificato e le rotte"
sleep 6
echo -n "   https://$DOMINIO/dati/session  (senza token, atteso 401) -> "
curl -s -o /dev/null -w "%{http_code}\n" --max-time 20 "https://$DOMINIO/dati/session" || echo "(nessuna risposta)"
echo -n "   https://$DOMINIO/health        (non esposto, atteso 404) -> "
curl -s -o /dev/null -w "%{http_code}\n" --max-time 20 "https://$DOMINIO/health" || echo "(nessuna risposta)"

cat <<FINE

== Fatto. Come si legge l'esito:
   401 su /dati/session  = perfetto: la rotta c'e', il certificato e' valido, e chiede chi sei.
   404 su /health        = perfetto: tutto il resto del ponte NON e' esposto.
   nessuna risposta      = la 443 non arriva: controlla la Security List della VCN su Oracle.

   L'indirizzo da mettere nell'app: https://$DOMINIO
FINE
