package com.pietrosantini.forexbacktestlab;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Serve a distinguere il PRIMO riprendo (l'app che si apre) dai successivi (l'utente
    // che torna dal browser per approvare l'accesso su un altro dispositivo).
    private boolean primoRiprendo = true;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Login con Google dentro l'app: Google blocca i browser incorporati (WebView).
        // Presentiamo un User-Agent di Chrome mobile normale, senza il marcatore "wv"
        // con cui Android identifica i WebView, cosi' il login non viene rifiutato.
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                String ua = settings.getUserAgentString();
                if (ua != null) {
                    ua = ua.replace("; wv", "").replace("Version/4.0 ", "");
                    settings.setUserAgentString(ua);
                }
            }
        } catch (Exception e) {
            // Non bloccante: se qualcosa va storto l'app parte comunque.
        }
    }

    // RETE DI SICUREZZA: l'app non deve mai restare ferma su una pagina che non e' sua.
    //
    // MISURATO il 20 ottobre 2026 dal proprietario: "quando premo il pulsante Google mi da'
    // tutta schermata bianca". Il giro di accesso era finito su una pagina di errore di
    // Google dentro la WebView, e quella pagina era rimasta li': riaprendo l'app si
    // vedeva ancora quella, e non si poteva fare piu' niente (ne' tornare alla pagina di
    // accesso, ne' uscire).
    //
    // Quando l'app si apre (o viene riaperta dopo che il sistema l'ha chiusa), se la WebView
    // e' su una pagina ESTERNA che non fa parte del giro di accesso, si torna alla pagina
    // dell'app. Il giro di accesso in corso non viene toccato: durante il giro l'app non
    // viene riaperta, e il controllo gira solo al PRIMO riprendo.
    @Override
    public void onResume() {
        super.onResume();
        try {
            if (!primoRiprendo) return;
            primoRiprendo = false;
            WebView webView = getBridge().getWebView();
            if (webView == null) return;
            String url = webView.getUrl();
            if (url == null) return;
            String dentroLApp = getBridge().getServerUrl();
            String inizio = getBridge().getAppUrl();
            if (dentroLApp == null || inizio == null) return;
            if (url.startsWith(dentroLApp)) return;   // gia' sulla pagina dell'app: tutto bene
            // Una pagina del giro di accesso (Google o Firebase): si lascia stare, il giro
            // sta proseguendo e l'utente deve poterlo completare.
            if (url.contains("google.com") || url.contains("firebaseapp.com")) return;
            webView.loadUrl(inizio);
        } catch (Exception e) {
            // Non bloccante: se qualcosa va storto l'app parte comunque.
        }
    }
}
