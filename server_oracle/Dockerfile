# Servizi di Forex Backtest LAB per il server Oracle (Linux, ARM o x86).
# Un'immagine sola, due servizi (vedi docker-compose.yml): ponte (Kraken simulato, porta 8000) e
# segnali (Telegram, porta 8769). I dati stanno fuori dal contenitore, in /dati (volume).
FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 APPDATA=/dati FBL_ACCESSO_FILE=/dati/accesso_remoto.json FBL_SEGNALI_DATI=/dati/segnali
WORKDIR /fbl
RUN pip install --no-cache-dir fastapi uvicorn websockets pydantic telethon
COPY installer_build/build /fbl/installer_build/build
COPY server_oracle /fbl/server_oracle
VOLUME ["/dati"]
