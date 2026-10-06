# Laboratorio — banco di prova di Forex Backtest LAB

`bash laboratorio/collauda.sh` prova tutto e scrive il riassunto in `risultati/ultimo.md`:

| Passo | Cosa controlla |
|---|---|
| sintassi_app | ogni `<script>` di app.html si compila |
| versione_sw | `sw.js` ha il `CACHE_NAME` |
| ponte_python | `ponte/`: conto Kraken simulato (TP/SL sulle candele), ordini pendenti |
| interprete_segnali | i test dell'interprete delle sale (messaggi veri di 6 canali) |
| app_browser | `app/`: avvio (anche da telefono), barra ordini Kraken, pendenti, Trade Journal, posizione a grafico |

Su GitHub gira da solo a ogni push (flusso **Collaudo**); schermate e log in "Artifacts".

Cosa NON può collaudare il cloud: sessione Telegram vera, Syntra (BlueStacks), MT5 (Windows),
conti con soldi veri. Per quelli vale il collaudo a mano sul PC, su conto demo/simulato.

`pc/strix_con_omniroute.bat`: ricerca di vulnerabilità con Strix sul PC, con OmniRoute come
fornitore del modello AI.
