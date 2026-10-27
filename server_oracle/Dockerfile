# Servizi di Forex Backtest LAB per il server Oracle (Linux, ARM o x86).
# Un'immagine sola, due servizi (vedi docker-compose.yml): ponte (Kraken simulato, porta 8000) e
# segnali (Telegram, porta 8769). I dati stanno fuori dal contenitore, in /dati (volume).
FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 APPDATA=/dati FBL_ACCESSO_FILE=/dati/accesso_remoto.json FBL_SEGNALI_DATI=/dati/segnali
# Anche gli utenti stanno in /dati, il volume. Se stessero accanto al codice (che in un'immagine si
# ricostruisce), ogni aggiornamento cancellerebbe le chiavi personali di tutti e nessuno capirebbe
# perche' l'app smette di collegarsi.
ENV FBL_UTENTI_FILE=/dati/utenti_server.json
WORKDIR /fbl
RUN pip install --no-cache-dir fastapi uvicorn websockets pydantic telethon httpx google-auth
COPY installer_build/build /fbl/installer_build/build
COPY server_oracle /fbl/server_oracle
VOLUME ["/dati"]
