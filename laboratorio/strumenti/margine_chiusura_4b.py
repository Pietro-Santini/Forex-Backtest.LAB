# -*- coding: utf-8 -*-
"""Punto 4, seconda parte: tre correzioni al blocco del margine di chiusura.

1) IL METRO DEL "TROPPO VICINO" ERA SBAGLIATO PER IL MARGINE.
   `fblPareggioTroppoVicino` confronta la distanza fra lo stop e il prezzo con la FORBICE
   DEL CAMBIO GIORNATA. Ma il margine di chiusura E' quella forbice: confrontarli tra loro
   significa dire che il margine non e' mai abbastanza lontano, e il margine non
   scatterebbe mai. Il metro giusto per il margine e' con lo spread ORDINARIO: lo stop non
   deve trovarsi cosi' vicino al prezzo da essere preso al primo allargamento. Stesso metro
   per il ritorno al pareggio esatto: il mercato si e' stabilizzato, quindi vale lo spread
   di tutti i giorni. La regola del 21 ottobre (forbice) resta per il pareggio esatto.

2) IL GIRO AGGIORNAVA LO STATO LOCALE PRIMA DI SAPERE SE IL CONTO AVESSE PRESO LO STOP.
   Se il ponte rifiuta, lo stato locale diceva una cosa e il conto un'altra. Inoltre il
   tentativo non era tracciato: il giro successivo (due secondi dopo) riprovava e
   riprovava. Ora: si prova, si aspetta cinque minuti, e lo stato locale si aggiorna solo
   se il conto ha davvero preso lo stop.

3) IL TEMPO ERA QUELLO DELL'OROLOGIO, QUELLO INIETTATO NO.
   La decisione e il giro prendono il tempo che viene passato, cosi' i test non dipendono
   dall'ora vera.

Il file viene scritto solo in fondo: se una trasformazione non torna, il file resta come
era.
"""
import io
import sys

PERCORSO = 'app.html'

with io.open(PERCORSO, 'r', encoding='utf-8', newline='') as f:
    testo = f.read()

# La patch precedente aveva lasciato quindici righe a capo sciolte: il file originale e' tutto
# CRLF, e cosi' deve restare (il diff non deve sporcare le righe vicine).
import re
testo = re.sub(r'\r?\n', '\r\n', testo)

if testo.count('\n') != testo.count('\r\n'):
    print('FERMATO: il file ha righe a capo miste')
    sys.exit(1)


def ferma(messaggio):
    print('FERMATO: ' + messaggio)
    sys.exit(1)


def sost(testo, vecchio, nuovo, nome):
    """Sostituisce un pezzo unico, tenendo conto delle righe a capo CRLF."""
    v = vecchio.replace('\n', '\r\n')
    n = nuovo.replace('\n', '\r\n')
    quante = testo.count(v)
    if quante != 1:
        ferma('%s: pezzo trovato %d volte (atteso 1)' % (nome, quante))
    return testo.replace(v, n)


# ---------------------------------------------------------------------------
# (1) LE DUE FUNZIONI NUOVE: lo spread ordinario, e il metro del "troppo vicino"
# ---------------------------------------------------------------------------
FUNZIONI_NUOVE = """// Lo spread ORDINARIO in prezzo: quello con cui il mercato cammina di solito. Serve a dire
// "lo stop non verrebbe preso subito". E' una cosa DIVERSA dalla forbice del cambio giornata:
// quella e' il margine di chiusura, e confrontare il margine con se stesso direbbe che il
// margine non e' mai abbastanza lontano dal prezzo - e il margine non scatterebbe mai.
function fblSpreadNormalePrezzo(asset){
 try{
  const s=spreadCostForAsset(asset);
  return (Number.isFinite(s)&&s>0)?s:0;
 }catch(e){ return 0; }
}
// IL METRO DEL "TROPPO VICINO", con la scelta esplicita.
//  'forbice' : lo stop cadrebbe dentro la forbice del CAMBIO GIORNATA -> non si mette.
//              E' la regola del 21 ottobre, quella che non costa niente a nessuno.
//  'normale' : lo stop cadrebbe dentro lo spread ORDINARIO -> non si mette.
// Per il MARGINE DI CHIUSURA il metro e' 'normale': il margine E' la forbice del cambio
// giornata, quindi confrontare il margine con la forbice vorrebbe dire che il margine non
// e' mai abbastanza lontano dal prezzo - e il margine non scatterebbe mai.
// Per il RITORNO al pareggio esatto il metro e' 'normale' perche' il mercato si e'
// stabilizzato: a quel punto vale lo spread di tutti i giorni, non quello del cambio giornata.
function fblStopTroppoVicino(pos,prezzoStop,ora,metro){
 try{
  if(!pos||!Number.isFinite(prezzoStop))return {vicino:false,distanza:null,forbice:null};
  const asset=(pos&&pos.asset)||currentAssetKey;
  if(metro==='normale'){
   const normale=fblSpreadNormalePrezzo(asset);
   if(!(normale>0)||!Number.isFinite(ora))return {vicino:false,distanza:null,forbice:normale};
   const dist=(pos.side==='BUY')?(ora-prezzoStop):(prezzoStop-ora);
   return {vicino:dist<normale,distanza:dist,forbice:normale};
  }
  return fblPareggioTroppoVicino(pos,prezzoStop,ora);
 }catch(e){ return {vicino:false,distanza:null,forbice:null}; }
}
"""

testo = sost(
    testo,
    "// Il margine in PREZZO: la forbice del cambio giornata",
    FUNZIONI_NUOVE + "// Il margine in PREZZO: la forbice del cambio giornata",
    'funzioni nuove')

# ---------------------------------------------------------------------------
# (2) IL MARGINE NON SI METTE SE IL PREZZO E' GIA' OLTRE LO STOP
# ---------------------------------------------------------------------------
testo = sost(
    testo,
    """ const prezzo=(pos.side==='BUY')?esatto-margine:esatto+margine;
 return {prezzo:prezzo,esatto:esatto,margine:margine,fase:fin.fase,motivo:fin.fase};""",
    """ const prezzo=(pos.side==='BUY')?esatto-margine:esatto+margine;
 // Se il prezzo e' gia' oltre lo stop, quello stop verrebbe preso subito: meglio il pareggio
 // esatto (che il rifiuto del "troppo vicino" giudica) che uno stop gia' superato.
 const oraAdesso=fblPrezzoVeroPosizione(pos);
 if(Number.isFinite(oraAdesso)&&((pos.side==='BUY')?(prezzo>=oraAdesso):(prezzo<=oraAdesso)))return fuori;
 return {prezzo:prezzo,esatto:esatto,margine:margine,fase:fin.fase,motivo:fin.fase};""",
    'margine oltre lo stop')

# ---------------------------------------------------------------------------
# (3) LA DECISIONE: tempo iniettato, metro giusto, tentativo tracciato
# ---------------------------------------------------------------------------
testo = sost(
    testo,
    """ const scelta=fblPareggioPerStop(pos,t);
 const sl=Number(pos.sl);""",
    """ const adesso=Number.isFinite(t)?t:Date.now();
 const scelta=fblPareggioPerStop(pos,adesso);
 const sl=Number(pos.sl);""",
    'decisione: tempo iniettato')

testo = sost(
    testo,
    " const troppoVicino=(prezzo)=>{ try{ return fblPareggioTroppoVicino(pos,prezzo,ora).vicino; }catch(e){ return false; } };",
    " const troppoVicino=(prezzo)=>{ try{ return fblStopTroppoVicino(pos,prezzo,ora,'normale').vicino; }catch(e){ return false; } };",
    'decisione: metro giusto')

testo = sost(
    testo,
    "  const tentativo=(pos.beChiusura&&Number.isFinite(pos.beChiusura.at))?pos.beChiusura.at:0;\n  if(tentativo&&(Date.now()-tentativo)<5*60000)return fuori;",
    "  // Il tentativo si ricorda anche se fallisce: se il conto non prende lo stop, si riprova\n"
    "  // ogni cinque minuti, non ogni due secondi.\n"
    "  const tentativo=Number.isFinite(pos.beChiusuraTentativo)?pos.beChiusuraTentativo:0;\n"
    "  if(tentativo&&(adesso-tentativo)<5*60000)return fuori;",
    'decisione: tentativo col tempo iniettato')

# ---------------------------------------------------------------------------
# (4) IL GIRO: lo stato locale aspetta il conto
# ---------------------------------------------------------------------------
testo = sost(
    testo,
    """   const d=fblPareggioChiusuraDecide(pos,quando);
   if(!d||d.azione==='nessuna')continue;
   pos.sl=d.prezzo; pos.slAt=Date.now();
   if(d.azione==='margine'){
    pos.beChiusura={prezzo:d.prezzo,esatto:d.esatto,margine:d.margine,fase:d.fase,at:Date.now()};
   }else{
    pos.beChiusura=null;
    pos.beMarkerSl=d.prezzo;   // ora lo stop e' davvero al pareggio: il Journal puo' dire "BE"
   }
   let ok=true;
   if(pos.mt5Ticket!=null)ok=await fblMt5SpostaStop(pos,d.prezzo);
   if(!ok)fallite++;
   else if(d.azione==='margine')allontanate++;
   else tornate++;""",
    """   const d=fblPareggioChiusuraDecide(pos,quando);
   if(!d||d.azione==='nessuna')continue;
   // Il tentativo si traccia PRIMA: se il ponte rifiuta, il giro dopo non riprova subito.
   pos.beChiusuraTentativo=quando;
   let ok=true;
   if(pos.mt5Ticket!=null)ok=await fblMt5SpostaStop(pos,d.prezzo);
   // Se il conto non ha preso lo stop, lo stato locale resta com'era: meglio dire la
   // verita' (il conto ha ancora lo stop di prima) che mostrare uno stop che non c'e'.
   if(!ok){ fallite++; continue; }
   pos.sl=d.prezzo; pos.slAt=Date.now();
   if(d.azione==='margine'){
    pos.beChiusura={prezzo:d.prezzo,esatto:d.esatto,margine:d.margine,fase:d.fase,at:quando};
   }else{
    pos.beChiusura=null;
    pos.beMarkerSl=d.prezzo;   // ora lo stop e' davvero al pareggio: il Journal puo' dire "BE"
   }
   if(d.azione==='margine')allontanate++;
   else tornate++;""",
    'giro: lo stato aspetta il conto')

# ---------------------------------------------------------------------------
# (5) I DUE PULSANTI BE: il metro dipende dal margine
# ---------------------------------------------------------------------------
testo = sost(
    testo,
    " const spazio=fblPareggioTroppoVicino(pos,stopSl,fblPrezzoVeroPosizione(pos));",
    " const spazio=fblStopTroppoVicino(pos,stopSl,fblPrezzoVeroPosizione(pos),scelta.margine>0?'normale':'forbice');",
    'BE posizioni: metro')

testo = sost(
    testo,
    "   +' dal prezzo, dentro la forbice del cambio giornata (~'+inPip(spazio.forbice)+'). '",
    "  +' dal prezzo, '+(scelta.margine>0?'dentro lo spread normale':'dentro la forbice del cambio giornata')+' (~'+inPip(spazio.forbice)+'). '",
    'BE posizioni: messaggio')

testo = sost(
    testo,
    " const spazio=fblPareggioTroppoVicino(finta,stopSl,oraQui);",
    " const spazio=fblStopTroppoVicino(finta,stopSl,oraQui,scelta.margine>0?'normale':'forbice');",
    'BE MT5: metro')

with io.open(PERCORSO, 'w', encoding='utf-8', newline='') as f:
    f.write(testo)

print('Fatto: il metro giusto per il margine, lo stato che aspetta il conto, e il tempo iniettato.')
