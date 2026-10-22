# -*- coding: utf-8 -*-
"""Capitolo 8: la finestra PIP e i cartellini dei gruppi.

Tre cose del proprietario (22 ottobre 2026), tutte misurate prima di essere toccate:

1) "in modalita' pip viene mostrata la barra delle informazioni del sito, con about blank, e
   quella deve essere tolta" + "deve essere una seconda schermata della STESSA applicazione,
   non un qualcosa collegato via web" + "la finestra non ha il logo come la pagina madre".
   La finestra era un popup aperto con window.open('') su una pagina VUOTA (about:blank): per
   questo il browser le metteva la barra con "about:blank" e nessun titolo/icona dell'app.
   Ora si prova prima la Document Picture-in-Picture nativa (finestra senza barra, senza
   indirizzo, con lo STESSO documento dentro) e, se non c'e', si cade sul popup di prima ma
   con l'icona dell'app e una barra in alto con il logo e il nome: la finestra si VEDE come
   l'app.

2) "il puntatore e' sfasato di posizione sia dell'asse X che dell'asse Y: io punto il mouse
   sopra il grafico e la posizione effettiva e' spostata in alto a sinistra".
   Misurato (Chromium, finestra staccata, scala UI 130%): il canvas era largo 950 px di
   layout ma 730 px a schermo, perche' il CONTRO-ZOOM della scala UI (che sta sul #chartWrap
   e viaggia col nodo spostato) rimpicciolisce il grafico senza che il body della finestra
   sia zoomato con lui. Il mirino finiva 78 px a sinistra e 55 px in alto. Il contro-zoom si
   toglie quando il grafico cambia finestra e si rimette al rientro.

3) "la linea in fondo a destra di ogni posizione deve essere visualizzata anche all'interno
   dei gruppi, ma anche all'esterno... se c'e' una posizione che e' piu' vicina allo stop
   profit mi visualizza il cartellino blu, se e' piu' vicina a un TP il verde, se a uno stop
   loss il rosso". La riga del gruppo non aveva affatto la striscia (e, per questo, una
   cella in meno: tutte le celle del gruppo erano spostate di una colonna a sinistra).

Le sostituzioni sono per NUMERO DI RIGA e ogni riga di confine viene verificata prima di
scrivere: se il file e' cambiato, lo script si ferma invece di scrivere nel posto sbagliato.
Le modifiche si applicano DAL BASSO IN ALTO (dalla riga piu' alta alla piu' bassa): cosi' i
numeri di riga delle modifiche ancora da fare restano validi.
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


def controlla(num, frammento, nome):
    """La riga di confine deve contenere davvero il pezzo atteso: se il file e' cambiato
    sotto i piedi, me ne accorgo invece di scrivere nel posto sbagliato."""
    testo = righe[num - 1]
    if frammento not in testo:
        print('CONFINE NON TROVATO (riga %d, %s): %r' % (num, nome, testo))
        sys.exit(1)


def sostituisci_righe(righe, inizio, fine, nuovo_testo, nome, frammento):
    controlla(inizio, frammento, nome)
    return righe[:inizio - 1] + nuovo_testo.split('\n') + righe[fine:]


# ---------------------------------------------------------------------------
# I BLOCCHI NUOVI
# ---------------------------------------------------------------------------

# La barra col logo e il nome dell'app dentro la finestra staccata.
BARRA_PIP = r"""// La barra in alto della finestra staccata: il LOGO e il nome dell'APP. Serve a una cosa
// sola - che la finestra si VEDA come l'app e non come una pagina web (la lamentela era
// proprio questa: "la finestra non ha il logo come la pagina madre"). Non e' un browser che
// mostra un sito: e' la stessa app, in una seconda finestra.
function fblPipBarCrea(doc){
 try{
  if(!doc||!doc.body||doc.getElementById('fblPipBar'))return null;
  const bar=doc.createElement('div');
  bar.id='fblPipBar';
  bar.style.cssText='display:flex;align-items:center;gap:9px;padding:4px 10px;background:#0b1016;border-bottom:1px solid #2b3541;flex:none;user-select:none';
  const img=doc.createElement('img');
  img.src=new URL('icon-192.png',location.href).href;
  img.alt='BacktestLAB';
  img.style.cssText='width:20px;height:20px;border-radius:5px;object-fit:cover;flex:none;box-shadow:0 2px 8px rgba(62,166,255,.25)';
  const nome=doc.createElement('span');
  // NB: il CSS dell'app ha "input,select,button{width:100%}" e i testi che vanno a capo: senza
  // questi due ritocchi il pulsante di chiusura si allargava a tutta la finestra (1092 px
  // misurati) e il nome dell'app andava su due righe (barra alta 51 px invece di 28).
  nome.style.cssText='white-space:nowrap;flex:none;line-height:1.2';
  nome.innerHTML='<span style="font-weight:800;font-size:13px;color:#e8edf3;letter-spacing:-.02em">Backtest<span style="color:#3ea6ff">LAB</span></span>'
   +'<span style="font-size:9px;letter-spacing:.2em;color:#7f8b9a;font-weight:700;margin-left:8px">FOREX EDITION</span>';
  const chiudi=doc.createElement('button');
  chiudi.type='button';
  chiudi.textContent='\u2715';
  chiudi.title='Chiudi la finestra e riporta il grafico alla pagina principale';
  chiudi.style.cssText='margin-left:auto;width:auto;flex:none;background:transparent;border:1px solid #2b3541;color:#8b96a5;border-radius:6px;cursor:pointer;font-size:11px;padding:1px 8px;line-height:1.4';
  chiudi.addEventListener('click',()=>{ try{ if(floatingWin&&!floatingWin.closed)floatingWin.close(); }catch(e){} });
  bar.appendChild(img); bar.appendChild(nome); bar.appendChild(chiudi);
  doc.body.insertBefore(bar,doc.body.firstChild);
  return bar;
 }catch(e){ return null; }
}"""

# L'apertura della finestra: prima la Picture-in-Picture nativa, poi il popup di sempre.
APERTURA_PIP = r""" // LA FINESTRA SEPARATA (PIP): una VERA finestra dell'app, non una pagina web.
 // Prima era un popup su una pagina VUOTA (window.open('')): il browser lo mostrava come una
 // pagina qualsiasi, con la barra delle informazioni del sito in alto che diceva "about:blank"
 // e senza titolo ne' icona dell'app - non sembrava piu' l'app, sembrava un sito. Ora si prova
 // prima la Document Picture-in-Picture nativa (Chrome/Edge): finestra SENZA barra, SENZA
 // indirizzo, SENZA "about:blank", che contiene lo STESSO documento - quindi stesso stato e
 // stesso motore: nessuna seconda copia, nessun doppio collegamento al conto. Se l'API non c'e'
 // o il browser la rifiuta, si cade sul popup di prima (con icona dell'app e barra col logo).
 let pipNativa=false;
 try{
  if(window.documentPictureInPicture&&typeof window.documentPictureInPicture.requestWindow==='function'){
   const w=await window.documentPictureInPicture.requestWindow({width:900,height:600});
   if(w&&w.document){ floatingWin=w; pipNativa=true; }
  }
 }catch(e){ floatingWin=null; }
 if(!floatingWin){
  floatingWin=window.open('','forexFloatingChart','width=900,height=600');
  if(!floatingWin){
   $('status').textContent="Impossibile aprire la finestra separata: controlla che il browser non blocchi i popup per questa pagina.";
   floatingHomeParent=null; floatingHomeNext=null;
   return;
  }
 }
 floatingWinPip=pipNativa;
 try{ floatingWin.document.title='Forex Backtest Lab'; }catch(e){}
 floatingDoc=floatingWin.document;
 copyStylesInto(floatingDoc);
 // Icona dell'app nella barra del titolo (solo nel popup: la finestra Picture-in-Picture
 // nativa non ha barra del titolo). Cosi' anche il fallback mostra il logo, non una pagina
 // anonima.
 try{
  const link=floatingDoc.createElement('link');
  link.rel='icon'; link.type='image/png'; link.href=new URL('icon-192.png',location.href).href;
  floatingDoc.head.appendChild(link);
 }catch(e){}
 // La barra con il logo e il nome dell'app dentro la finestra: e' cio' che mancava.
 fblPipBarCrea(floatingDoc);"""

# Il layout nella finestra: il grafico sta sotto la barra col logo, e il contro-zoom della
# scala UI viene tolto (e' la causa misurata dello sfasamento del puntatore).
LAYOUT_PIP = r""" floatingDoc.body.style.margin='0';
 floatingDoc.body.style.background='#0b1016';
 floatingDoc.body.style.height='100vh';
 // La finestra e' gia' a grandezza schermo: il grafico sta sotto la barra col logo.
 floatingDoc.body.style.display='flex';
 floatingDoc.body.style.flexDirection='column';
 floatingDoc.body.appendChild(wrap);
 // IL CONTRO-ZOOM DELLA SCALA UI: sta sul #chartWrap (perche' il body della pagina e' zoomato)
 // e VIAGGIA col nodo quando il grafico si sposta in un'altra finestra. Ma in quella finestra il
 // body NON e' zoomato - e non deve esserlo: la finestra e' gia' a grandezza schermo. Il
 // contro-zoom, da solo, rimpicciolisce il grafico senza che nessuno lo misuri, e il
 // puntatore finisce per puntare un punto DIVERSO da quello indicato (misurato: 950 px di
 // layout contro 730 px a schermo, con il mirino 78 px a sinistra e 55 px in alto). Qui il
 // contro-zoom si toglie; al rientro (restoreChartToMainPage) si rimette.
 try{ wrap.style.zoom=''; }catch(e){}
 wrap.style.flex='1 1 auto';
 wrap.style.minHeight='0';
 wrap.style.height='auto';"""

MESSAGGIO_PIP = r""" $('status').textContent=floatingWinPip
  ? 'Grafico spostato nella finestra Picture-in-Picture: una finestra vera dell\'app, senza barra e senza indirizzo. Ridimensionala dal bordo e spostala pure su un altro monitor.'
  : 'Grafico spostato nella finestra separata: trascina i bordi/angoli della finestra per ridimensionarla quanto vuoi, oppure spostala pure su un altro monitor.';"""

MANIGLIE_PIP = r""" if(!floatingWinPip)enableManualResize(floatingWin); // la finestra PiP nativa si ridimensiona da sola (le maniglie coprirebbero il bordo)"""

# Il rientro: il grafico torna nella pagina principale (che ha il body zoomato).
RIENTRO = r""" if(wrap && floatingHomeParent){
  if(floatingHomeNext&&floatingHomeNext.parentNode===floatingHomeParent)floatingHomeParent.insertBefore(wrap,floatingHomeNext);
  else floatingHomeParent.appendChild(wrap);
 }
 // La finestra staccata aveva fatto del #chartWrap un blocco flessibile ("flex:1", altezza
 // automatica) per stare sotto la barra col logo: qui si rimette com'era (l'altezza la
 // decide il CSS).
 try{ wrap.style.flex=''; wrap.style.minHeight=''; wrap.style.height=''; }catch(e){}
 // LA SCALA UI: al rientro il grafico torna nel documento principale, il cui body e' zoomato:
 // il contro-zoom sul #chartWrap va rimesso, altrimenti il grafico resta sfasato (troppo
 // grande) e il puntatore torna a puntare il punto sbagliato.
 try{ if(typeof fblScalaUiApplica==='function')fblScalaUiApplica(document,fblScalaUi); }catch(e){}"""

# La cella della riga di GRUPPO: il cartellino della posizione piu' vicina a un livello.
STRISCIA_GRUPPO = r"""// LA STRISCIA DELLA RIGA DI GRUPPO. La riga del gruppo non ha una posizione unica, ma una
// cosa sola conta: quale delle sue posizioni sta per toccare un livello per prima. Si sceglie
// quella con la percentuale piu' bassa (la piu' vicina) e se ne mostra il cartellino (blu =
// stop a profitto, verde = take profit, rosso = stop loss), con il numero della posizione
// dentro il gruppo: cosi' si sa QUALE posizione guardare.
function fblStrisciaGruppoCellaHtml(dati){
 let best=null;
 (dati||[]).forEach((d,i)=>{
  const p=d&&d.p; if(!p)return;
  const st=fblStrisciaPosizione({side:p.side,entry:p.entry,sl:p.sl,tp:p.tp,prezzo:d.prezzo,ultimoTp:p.ultimoTpRaggiunto});
  if(!st)return;
  const perc=Number.isFinite(st.perc)?st.perc:0;
  if(!best||perc<best.perc)best={st:st,perc:perc,i:i};
 });
 if(!best)return '<td class="fblStrisciaCella"></td>';
 const chi='Posizione '+(best.i+1)+' di '+(dati.length)+': '+String(best.st.titolo);
 return '<td class="fblStrisciaCella" title="'+chi.replace(/"/g,'&quot;')+'">'
  +'<span class="fblStriscia" style="background:'+best.st.colore+'"></span></td>';
}"""

RIGA_GRUPPO = r"""       +`<td>${gotoG}${azioniG}</td>`+fblStrisciaGruppoCellaHtml(dati)+`</tr>`"""

# ---------------------------------------------------------------------------
# LE MODIFICHE, DALLA RIGA PIU' ALTA VERSO LA PIU' BASSA
# ---------------------------------------------------------------------------

# (1) il messaggio finale: dice quale tipo di finestra e' aperta
righe = sostituisci_righe(righe, 23595, 23595, MESSAGGIO_PIP,
    'messaggio finale PIP', "$('status').textContent='Grafico spostato nella finestra separata")

# (2) le maniglie di ridimensionamento: nella finestra PiP nativa la finestra si ridimensiona
#     da sola, e le maniglie (8 px di bordo) coprirebbero proprio il bordo dove si punta
righe = sostituisci_righe(righe, 23590, 23590, MANIGLIE_PIP,
    'maniglie ridimensionamento', 'enableManualResize(floatingWin);')

# (3) il layout nella finestra staccata (e la rimozione del contro-zoom)
righe = sostituisci_righe(righe, 23562, 23566, LAYOUT_PIP,
    'layout finestra PIP', "floatingDoc.body.style.margin='0';")

# (4) l'apertura della finestra
righe = sostituisci_righe(righe, 23541, 23554, APERTURA_PIP,
    'apertura finestra PIP', '// Richiesto esplicitamente: niente Document Picture-in-Picture nativa')

# (5) la funzione della barra col logo, prima di openFloatingChart
righe = sostituisci_righe(righe, 23536, 23536,
    BARRA_PIP + "\nasync function openFloatingChart(){",
    'funzione fblPipBarCrea', 'async function openFloatingChart()')

# (6) il rientro: contro-zoom e layout riportati come erano
righe = sostituisci_righe(righe, 23470, 23473, RIENTRO,
    'rientro grafico + contro-zoom', 'if(wrap && floatingHomeParent)')

# (7) il flag della finestra Picture-in-Picture
righe = sostituisci_righe(righe, 23169, 23169,
    'let floatingWin=null, floatingHomeParent=null, floatingHomeNext=null, floatingWinPip=false;',
    'flag floatingWinPip', 'let floatingWin=null,')

# (8) la funzione della striscia di gruppo, prima di usedMargin
righe = sostituisci_righe(righe, 19708, 19708,
    STRISCIA_GRUPPO + "\nfunction usedMargin(){ return positions.reduce((s,p)=>s+(p.marginUsed||0),0); }",
    'funzione fblStrisciaGruppoCellaHtml', 'function usedMargin()')

# (9) i cartellini: la percentuale serve a scegliere la posizione piu' vicina
righe = sostituisci_righe(righe, 19698, 19698,
    r""" if(qTp!=null)return {colore:'#2fbf71',perc:qTp,titolo:'Vicina al take profit: manca il '+qTp+'%'};""",
    'perc verde (take profit)', "if(qTp!=null)return {colore:'#2fbf71'")

righe = sostituisci_righe(righe, 19697, 19697,
    r""" if(qSl!=null&&(qTp==null||qSl<=qTp))return {colore:'#e05252',perc:qSl,titolo:'Vicina allo stop loss: manca il '+qSl+'%'};""",
    'perc rosso (stop loss)', "if(qSl!=null&&(qTp==null||qSl<=qTp))return {colore:'#e05252'")

righe = sostituisci_righe(righe, 19692, 19692,
    r"""  if(q!=null)return {colore:'#4bb3e8',perc:q,titolo:'Vicina allo stop a profitto'+(da!=null?' (misurata dall\'ultimo target raggiunto)':'')+': manca il '+q+'%'};""",
    'perc blu (stop a profitto)', "if(q!=null)return {colore:'#4bb3e8'")

# (10) la riga del gruppo mostra la striscia (e cosi' ha tutte le colonne come le altre righe)
righe = sostituisci_righe(righe, 11190, 11190, RIGA_GRUPPO,
    'striscia sulla riga del gruppo', '${gotoG}${azioniG}')

with io.open(PERCORSO, 'w', encoding='utf-8', newline='') as f:
    f.write(NL.join(righe))

print('Fatto: finestra PIP (nativa + barra col logo), contro-zoom della scala UI, striscia del gruppo.')
