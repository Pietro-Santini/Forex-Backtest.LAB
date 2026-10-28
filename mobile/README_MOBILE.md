# Forex Backtest LAB — App Mobile (Capacitor)

## Struttura
- `www/` — copia di app.html, sw.js, manifest.json, icone
- `android/` — progetto Android (Gradle)
- `ios/` — progetto iOS (Xcode, solo su Mac)

## Come compilare
### Android
1. Apri `android/` in Android Studio
2. Build → Build Bundle(s) / APK(s)
3. L'APK esce in `android/app/build/outputs/apk/`

### iOS (solo su Mac)
1. Apri `ios/App/App.xcworkspace` in Xcode
2. Product → Archive
3. Distribuisci su App Store Connect

## Note
- Il bridge MT5 reale non funziona su mobile (MetaTrader5 è solo Windows).
- Su mobile l'app usa solo dati simulati + live (Binance/Capital.com) + sync cloud.
- Gli ordini reali vanno fatti dal desktop (o dal server Windows quando sarà pronto).
- La PWA (manifest.json + service worker) permette l'installazione dal browser senza store.

## Aggiornamento
Per aggiornare l'app mobile dopo modifiche a app.html:
1. Copia i file aggiornati in `www/`
2. `npx cap sync`
3. Ricompila in Android Studio / Xcode
"""