#!/usr/bin/env bash
# Prepara il server Oracle (Ubuntu) per Forex Backtest LAB. Si lancia UNA volta, sul server:
#   bash prepara_server.sh
# Fa: Docker, Tailscale, scarica il progetto, crea la chiave d'accesso, avvia i servizi e li
# pubblica sulla rete Tailscale (HTTPS). Rilanciarlo e' innocuo: aggiorna e riavvia.
set -euo pipefail
REPO="https://github.com/Pietro-Santini/Forex-Backtest.LAB.git"
RAMO="${FBL_RAMO:-main}"
DIR=/srv/fbl/progetto
DATI=/srv/fbl/dati

echo "== 1) Docker"
command -v docker >/dev/null || { curl -fsSL https://get.docker.com | sudo sh; sudo usermod -aG docker "$USER"; }

echo "== 2) Tailscale"
command -v tailscale >/dev/null || curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale status >/dev/null 2>&1 || { echo "Collega il server al tuo account Tailscale (apri il link che compare):"; sudo tailscale up; }

echo "== 3) Progetto ($RAMO)"
sudo mkdir -p "$DATI" /srv/fbl && sudo chown -R "$USER" /srv/fbl
if [ -d "$DIR/.git" ]; then git -C "$DIR" fetch -q origin "$RAMO" && git -C "$DIR" checkout -q "$RAMO" && git -C "$DIR" reset -q --hard "origin/$RAMO"
else git clone -q --branch "$RAMO" "$REPO" "$DIR"; fi

echo "== 4) Chiave d'accesso"
if [ ! -f "$DATI/accesso_remoto.json" ]; then
  CHIAVE=$(python3 -c "import secrets;print(secrets.token_urlsafe(24))")
  printf '{"rete": true, "chiave": "%s"}\n' "$CHIAVE" > "$DATI/accesso_remoto.json"
  chmod 600 "$DATI/accesso_remoto.json"
fi

echo "== 5) Servizi"
sudo docker compose -f "$DIR/server_oracle/docker-compose.yml" up -d --build

echo "== 6) Pubblicazione su Tailscale (HTTPS, solo per i tuoi dispositivi)"
sudo tailscale serve --bg --https=8000 http://127.0.0.1:8000
sudo tailscale serve --bg --https=8769 http://127.0.0.1:8769
sleep 3
curl -fsS http://127.0.0.1:8000/health && echo
NOME=$(tailscale status --json | python3 -c "import sys,json;print(json.load(sys.stdin)['Self']['DNSName'].rstrip('.'))")
echo
echo "FATTO. Nell'app, indirizzo del server:  https://$NOME"
echo "Chiave d'accesso (inseriscila nell'app, non mandarla a nessuno):"
python3 -c "import json;print(json.load(open('$DATI/accesso_remoto.json'))['chiave'])"
