# -*- coding: utf-8 -*-
"""Capitolo 7b: i cronometri DENTRO draw(), sezione per sezione.

La misura del 22 ottobre ha detto che il 96,6% del costo del disegno sta nel CORPO di draw()
e non nelle funzioni che chiama. Per guardare li' serve un cronometro per sezione: questo
script mette i segnalini.

I segnalini sono inseriti per NUMERO DI RIGA (il file non cambia da quando le righe sono state
contate) e ogni riga di confine viene verificata prima di scrivere: se il file e' cambiato,
lo script si ferma invece di scrivere cose nel posto sbagliato.
"""
import io
import re
import sys

PERCORSO = 'app.html'
NL = '\r\n'

with io.open(PERCORSO, 'r', encoding='utf-8', newline='') as f:
    s = f.read()

righe = s.split(NL)


def cr(testo):
    """Il file e' CRLF: i pezzi di testo vanno convertiti tutti, non solo il primo."""
    return re.sub(r'\r?\n', NL, testo)


def sostituisce(s, vecchio, nuovo, nome):
    v = cr(vecchio)
    n = cr(nuovo)
    if s.count(v) != 1:
        print('AGGANCIO NON UNICO (%d): %s' % (s.count(v), nome))
        sys.exit(1)
    return s.replace(v, n)


# (riga di confine, pezzo di testo che DEVE esserci in quella riga, nome della sezione)
SEZIONI = [
    (15262, 'ctx.clearRect(0,0,w,h);ctx.fillStyle=chartBg', 'avvio'),
    (15316, 'priceAxisTicks.push({y:yy,text:fmtPrice(v)});}', 'grigliaPrezzi'),
    (15377, '});', 'grigliaTempo'),
    (15413, '}):null;', 'footprintPreparazione'),
    (15703, '}', 'heatmap'),
    (15741, '}', 'zoneLiquidita'),
    (15790, '}', 'zoneZeroPrint'),
    (15792, 'drawFootprintVpocLine(', 'lineaVPOC'),
    (15880, '});', 'candele'),
    (15909, '}', 'indicatori'),
    (15967, '}', 'palliniAR'),
    (16539, "catch(err){ console.error('Errore rendering disegni:'", 'disegniUtente'),
    (16726, '});', 'posizioniAperte'),
    (16750, 'fblCronoDisegna(', 'tradeChiusi'),
    (16858, '});', 'ordiniPendenti'),
    (17004, '}', 'lineeBozza'),
    (17052, '}catch(e){}', 'scalaEColonne'),
    (17121, '}', 'prezzoCorrente'),
    (17173, '})();', 'asseTempo'),
    (17177, 'drawFootprintSummary(', 'riassuntoFootprint'),
    (17250, '}', 'notizie'),
    (17295, '}', 'mirino'),
    (17324, 'updateDrawTextHint&&updateDrawTextHint();', 'coda'),
]

# La riga di draw() e' il punto in cui nasce il cronometro: la si verifica.
if righe[15224] != 'function draw(){':
    print('draw() non e\' alla riga 15225: il file e\' cambiato, lo script si ferma.')
    sys.exit(1)

# Ogni confine viene controllato PRIMA di scrivere.
for n, pezzo, nome in SEZIONI:
    riga = righe[n - 1]
    if pezzo not in riga:
        print('CONFINE NON COME PREVISTO alla riga %d (%s): %r' % (n, nome, riga[:110]))
        sys.exit(1)

# --- 1. i segnalini: una riga dopo ogni confine (dal fondo in alto, cosi' i numeri non cambiano)
for n, pezzo, nome in sorted(SEZIONI, reverse=True):
    righe.insert(n, " _tSez=fblSezFine('%s',_tSez);" % nome)

s = NL.join(righe)

# --- 2. l'orologio: dopo fblScadeDecimali(), che resta la prima riga di draw()
#        (c'e' un test che lo pretende: vedi replay_posizioni.test.mjs)
s = sostituisce(s, """function draw(){
 fblScadeDecimali();""",
              """function draw(){
 fblScadeDecimali();
 let _tSez=performance.now();   // vedi fblSezFine""", 'orologio in draw()')

# --- 3. il cronometro e i suoi aiuti, subito prima di draw()
AIUTO = """// ============ CRONOMETRI DEL DISEGNO, SEZIONE PER SEZIONE ============
//
// LA MISURA DEL 22 OTTOBRE (sul computer del proprietario) ha detto una cosa che cambia la
// ricerca: il disegno si mangia il 78% del tempo, ma tutti i pezzi cronometrati insieme (le
// funzioni che draw() chiama) fanno il 3,4%. Il 96,6% sta nel CORPO di draw().
//
// Qui dentro draw() ci sono i segnalini di sezione: ognuno dice quanto e' costata la sezione
// che precede. Non e' un abbellimento: e' l'unico modo di sapere QUALE pezzo del corpo di
// draw() pesa, invece di indovinare.
//
// I segnalini sono SPENTI di default: il disegno normale non paga niente. Si accendono solo
// durante la misura (vedi fblMisuraPrestazioni) e si spengono alla fine: uno strumento di
// misura che resta attaccato diventa la causa del rallentamento successivo.
let fblSezioniDraw={};      // nome della sezione -> ms accumulati
let fblCronoSezioni=false;  // spento di default: il disegno di tutti i giorni non paga niente
function fblSezFine(nome,t0){
 const ora=performance.now();
 if(!fblCronoSezioni)return ora;
 fblSezioniDraw[nome]=(fblSezioniDraw[nome]||0)+(ora-t0);
 return ora;
}
function draw(){"""

s = sostituisce(s, 'function draw(){', AIUTO, 'gli aiuti del cronometro')

# --- 4. la misura: accende i cronometri, e alla fine li spenge
s = sostituisce(s, """function fblMisuraPrestazioni(secondi){
 const durata=Math.max(1000,(Number(secondi)||5)*1000);""",
              """function fblMisuraPrestazioni(secondi){
 const durata=Math.max(1000,(Number(secondi)||5)*1000);
 // I CRONOMETRI DI SEZIONE del disegno: si accendono qui e si spengono alla fine della misura.
 // Fuori da qui il disegno non paga niente.
 fblCronoSezioni=true;
 fblSezioniDraw={};""", 'accensione dei cronometri')

s = sostituisce(s, """  st.call(window,()=>{
   vivo=false;""",
              """  st.call(window,()=>{
   vivo=false;
   fblCronoSezioni=false;   // i cronometri di sezione si spengono: dopo la misura il disegno torna come prima""",
              'spegnimento dei cronometri')

# --- 5. la misura riporta i numeri delle sezioni
s = sostituisce(s, """   if(cari.length){
    r.pezziDelDisegno_ms=cari.map(x=>x[0]+'='+x[1]).join('  ');
    r.pezziTotale_ms=cari.reduce((s2,x)=>s2+x[1],0);
   }""",
              """   if(cari.length){
    r.pezziDelDisegno_ms=cari.map(x=>x[0]+'='+x[1]).join('  ');
    r.pezziTotale_ms=cari.reduce((s2,x)=>s2+x[1],0);
   }
   // LE SEZIONI DI draw(): quanto costa ogni pezzo del CORPO del disegno. La misura del 22
   // ottobre ha detto che il 96,6% del costo sta qui dentro e non nelle funzioni che draw()
   // chiama: senza questi numeri si ottimizza a occhio, e la prima misura ha gia' smentito due
   // sospetti su due. Il numero e' il costo MEDIO di un disegno, in millisecondi.
   const sezioni=Object.keys(fblSezioniDraw||{})
     .map(nome=>[nome,Math.round((fblSezioniDraw[nome]/(nD||1))*100)/100])
     .filter(x=>x[1]>=0.02)
     .sort((a,b)=>b[1]-a[1]);
   if(sezioni.length){
    r.sezioniDelDisegno_ms=sezioni.map(x=>x[0]+'='+x[1]).join('  ');
    r.sezioniTotale_ms=Math.round(sezioni.reduce((s2,x)=>s2+x[1],0)*100)/100;
   }""", 'i numeri delle sezioni nella misura')

# --- 6. i candidati del CAMBIO ASSET (i 2.818 ms): si aggiungono all'elenco dei pezzi
s = sostituisce(s, """'krakenPosPannello','renderPositionsTable','fblScadeDecimali'];""",
              """'krakenPosPannello','renderPositionsTable','fblScadeDecimali',
                  // I CANDIDATI DEL CAMBIO ASSET (i 2.818 ms della misura del 22 ottobre): il
                  // salvataggio del registro tick, la ricostruzione dei bucket del footprint e
                  // il caricamento dello storico. Prima di 7a il primo costava un secondo.
                  'saveFootprintTicksNow','footprintRebuildBucketsForCurrentAsset',
                  'caricaStoricoPerSaltoAGrafico','binanceKlines'];""",
              'i candidati del cambio asset')

with io.open(PERCORSO, 'w', encoding='utf-8', newline='') as f:
    f.write(s)
print('fatto: %d cronometri di sezione dentro draw()' % len(SEZIONI))
