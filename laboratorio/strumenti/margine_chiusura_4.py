# -*- coding: utf-8 -*-
"""Punto 4 della consegna del 22 ottobre 2026: il margine dello spread SOLO intorno alla
chiusura e alla riapertura del mercato.

La richiesta del proprietario: «il pareggio resta zero nelle condizioni normali, ma nella fase
di chiusura e riapertura del mercato si adotta il margine dello spread, tornando al pareggio
esatto quando il mercato si e' stabilizzato. Con un interruttore nelle impostazioni».

Il conflitto con il pareggio esatto e' gia' noto e pagato (vedi la nota lunga su
mt5PrezzoPareggio): il 21 ottobre il margine era stato tolto perche' faceva chiudere in
perdita di circa due euro ogni operazione. Ma quel margine era SEMPRE attivo: ogni stop a
pareggio finiva fuori dal pareggio esatto, per sempre, anche a mercato aperto. Qui il margine
vale solo nella finestra in cui il mercato chiude e riapre; il resto del tempo il pareggio e'
esattamente quello di prima, e quando la finestra finisce lo stop torna al pareggio esatto.

COME E' FATTA LA PATCH: ogni riga di confine viene verificata e ogni modifica e' una
TRASFORMAZIONE della riga vera (non una riscrittura a mano): se il file e' diverso da come
era quando lo script e' stato scritto, lo script si ferma invece di scrivere a caso.
I numeri di riga sono quelli del file di PARTENZA: le modifiche sono applicate dalla riga
piu' alta verso la piu' bassa e ogni inserimento tiene conto dello spostamento (DELTA).
"""
import io
import re
import sys

PERCORSO = 'app.html'
NL = '\r\n'

with io.open(PERCORSO, 'r', encoding='utf-8', newline='') as f:
    s = f.read()

righe = s.split(NL)
DELTA = [0]


def ferma(messaggio):
    print('FERMATO: ' + messaggio)
    sys.exit(1)


def _riga(num):
    """La riga numero num del file di PARTENZA.

    Le modifiche si applicano dalla riga piu' alta verso la piu' bassa: una modifica sposta
    solo le righe CHE VENGONO DOPO, quindi le righe delle modifiche successive restano al
    loro posto e il numero di partenza resta valido."""
    i = num - 1
    if i < 0 or i >= len(righe):
        ferma('riga %d fuori dal file' % num)
    return i


def _controlla(num, frammento, nome):
    if frammento not in righe[_riga(num)]:
        riga = righe[_riga(num)]
        stampato = ''.join(c if 32 <= ord(c) < 127 else '<%04X>' % ord(c) for c in riga)
        ferma('confine non trovato (riga %d, %s) - riga trovata: %s' % (num, nome, stampato))


def sost(riga, vecchio, nuovo, nome):
    """Sostituisce un pezzo dentro una riga: se il pezzo non c'e', si ferma."""
    if vecchio not in riga:
        ferma('pezzo non trovato (%s): %r' % (nome, vecchio))
    return riga.replace(vecchio, nuovo)


def trasforma(num, fn, nome, frammento):
    """Applica una funzione alla riga indicata, partendo dal testo VERO della riga."""
    _controlla(num, frammento, nome)
    i = _riga(num)
    nuova = fn(righe[i])
    if nuova == righe[i]:
        ferma('la trasformazione non ha cambiato nulla (riga %d, %s)' % (num, nome))
    righe[i] = nuova


def sostituisci_blocco(num_inizio, num_fine, nuove_righe, nome, frammento):
    _controlla(num_inizio, frammento, nome)
    i = _riga(num_inizio)
    j = _riga(num_fine)
    vecchie = righe[i:j + 1]
    righe[i:j + 1] = nuove_righe
    DELTA[0] += len(nuove_righe) - len(vecchie)


def inserisci(num, nuove_righe, nome, frammento):
    """Inserisce delle righe PRIMA della riga indicata."""
    _controlla(num, frammento, nome)
    i = _riga(num)
    righe[i:i] = nuove_righe
    DELTA[0] += len(nuove_righe)


def inserisci_dopo(num, nuove_righe, nome, frammento):
    _controlla(num, frammento, nome)
    i = _riga(num) + 1
    righe[i:i] = nuove_righe
    DELTA[0] += len(nuove_righe)


# ---------------------------------------------------------------------------
# IL BLOCCO NUOVO: la finestra del mercato, il prezzo dello stop, la decisione, il giro.
# ---------------------------------------------------------------------------

MARGINE_BLOCCO = r"""/* IL MARGINE DELLO SPREAD SOLO INTORNO ALLA CHIUSURA E ALLA RIAPERTURA DEL MERCATO.
 *
 * RICHIESTA del proprietario (22 ottobre 2026): il pareggio resta zero nelle condizioni
 * normali, ma nella fase di chiusura e riapertura del mercato si adotta il margine dello
 * spread, tornando al pareggio esatto quando il mercato si e' stabilizzato, con un
 * interruttore nelle impostazioni.
 *
 * IL CONFLITTO CON IL PAREGGIO ESATTO, e perche' questa volta si puo' fare. Il 21 ottobre il
 * margine era stato tolto perche' faceva chiudere in perdita di circa due euro ogni operazione:
 * il proprietario lo aveva detto «la cosa piu' importante di tutte», e aveva ragione - un
 * pareggio che perde non e' un pareggio. Ma quel margine era SEMPRE attivo: ogni stop a pareggio
 * finiva fuori dal pareggio esatto, per sempre, anche a mercato aperto. Qui il margine vale solo
 * nella finestra in cui il mercato chiude e riapre: il resto del tempo il pareggio e'
 * esattamente quello di prima (profitto netto zero, commissioni e swap compresi) e, quando la
 * finestra finisce, lo stop torna al pareggio esatto da solo.
 *
 * LA DIREZIONE. Lo stop di un acquisto si esegue sul BID e quello di una vendita sull'ASK: al
 * cambio giornata e' il lato che si allarga a mangiare lo stop. Percio' il margine allontana lo
 * stop DALL'ENTRATA, dalla parte da cui il prezzo si muove: un acquisto con lo stop sotto
 * l'entrata, una vendita con lo stop sopra. Misurato il 21 ottobre su EURCHF (spread da 0,2 a
 * 50 pip alle 00:00:42, due vendite a 0,92828 con lo stop a 0,92827, cioe' un decimo di pip,
 * chiuse tutte in quell'istante): con il margine - la forbice del rollover, quella misurata -
 * lo stop delle vendite sarebbe stato a 0,92828 + 0,0050 = 0,93328, e l'ask di allora era
 * 0,92961: lo stop non sarebbe stato preso.
 *
 * CHI LO COMANDA: l'interruttore #fblMargineChiusura nelle impostazioni (acceso di default).
 * Spento, il pareggio e' sempre esatto e questo blocco non fa niente.
 */
const FBL_MARGINE_CHIUSURA_MIN=30;      // minuti prima della chiusura
const FBL_MARGINE_RIAPERTURA_MIN=30;   // minuti dopo la riapertura
const FBL_MARGINE_CHIUSURA_KEY='fbl_margine_chiusura';
// L'interruttore comanda: se la casella c'e', comanda lei; se non c'e' ancora (il DOM non e'
// pronto) si usa quello salvato; e se non c'e' nemmeno salvato, ACCESO (che e' quello che
// chiede il proprietario).
function fblMargineChiusuraAttivo(){
 try{
  const el=document.getElementById('fblMargineChiusura');
  if(el)return !!el.checked;
  return localStorage.getItem(FBL_MARGINE_CHIUSURA_KEY)!=='0';
 }catch(e){ return true; }
}
function fblMargineChiusuraSalva(){
 try{ localStorage.setItem(FBL_MARGINE_CHIUSURA_KEY,fblMargineChiusuraAttivo()?'1':'0'); }catch(e){}
 try{ update(); }catch(e){}
}
function fblMargineChiusuraRipristina(){
 try{
  const el=document.getElementById('fblMargineChiusura');
  if(el)el.checked=localStorage.getItem(FBL_MARGINE_CHIUSURA_KEY)!=='0';
 }catch(e){}
}
// LA FINESTRA DEL MERCATO. Risponde a: siamo dentro la chiusura, dentro la riapertura, dentro
// il mercato chiuso, o in un'ora normale?
// {calda, fase:'chiusura'|'riapertura'|'chiuso'|null, chiudeAt, apreAt}
// 'calda' vuol dire: adesso il mercato chiude o sta riaprendo, e il margine dello spread serve.
// Il mercato chiuso NON e' caldo: li' dentro nessuno puo' eseguire un ordine, e il margine
// starebbe a fare danno per un'ora intera senza proteggere niente.
function fblFinestraChiusura(asset,t){
 const fuori={calda:false,fase:null,chiudeAt:null,apreAt:null};
 if(!asset)return fuori;
 const quando=Number.isFinite(t)?t:Date.now();
 try{ if(binanceSymbolForAsset(asset))return fuori; }catch(e){}   // le crypto non chiudono mai
 // 1) gli orari veri dello strumento (quelli che manda il broker)
 try{
  const o=orariAsset[asset];
  if(o&&o.giorni&&Object.keys(o.giorni).length){
   const iv=orariIntervalli(o,quando);
   const dentro=iv.find(x=>quando>=x[0]&&quando<x[1]);
   if(dentro){
    if((quando-dentro[0])<=FBL_MARGINE_RIAPERTURA_MIN*60000)return {calda:true,fase:'riapertura',chiudeAt:dentro[1],apreAt:dentro[0]};
    if((dentro[1]-quando)<=FBL_MARGINE_CHIUSURA_MIN*60000)return {calda:true,fase:'chiusura',chiudeAt:dentro[1],apreAt:null};
    return fuori;
   }
   // Il mercato e' CHIUSO: si aspetta la riapertura.
   const pross=iv.find(x=>x[0]>quando);
   return {calda:false,fase:'chiuso',chiudeAt:null,apreAt:pross?pross[0]:null};
  }
 }catch(e){}
 // 2) ripiego: l'orario con cui l'app segue MT5
 try{
  const chiusura=fblProssimaChiusura(asset,quando);
  if(chiusura!=null&&(chiusura-quando)<=FBL_MARGINE_CHIUSURA_MIN*60000)return {calda:true,fase:'chiusura',chiudeAt:chiusura,apreAt:null};
  if(liveScheduleAppliesNow()&&liveSessionPhaseAt(quando)==='closed')return {calda:false,fase:'chiuso',chiudeAt:null,apreAt:null};
 }catch(e){}
 return fuori;
}
// Un numero in pip, per l'asset indicato (la stessa misura che usa il rifiuto dello stop
// dentro la forbice).
function fblInPip(asset,n){
 try{
  let pip=0; try{ pip=pipSizeForAsset(asset); }catch(e){}
  return (pip>0)?(Math.round(n/pip*10)/10+' pip'):fmtPrice(n);
 }catch(e){ return String(n); }
}
// Il margine in PREZZO: la forbice del cambio giornata (quella misurata, se c'e'; altrimenti la
// stima dichiarata) per l'asset indicato.
function fblMargineChiusuraPrezzo(asset){
 try{
  let passo=0; try{ passo=pipSizeForAsset(asset); }catch(e){}
  if(!(passo>0))return 0;
  return fblSpreadRolloverPips(asset)*passo;
 }catch(e){ return 0; }
}
// Il prezzo VERO adesso per una posizione reale: il BID per un acquisto (il lato su cui si
// chiude), l'ASK per una vendita. Se non c'e', il prezzo di chiusura che l'app usa di solito.
function fblPrezzoVeroPosizione(pos){
 try{
  if(pos&&pos.mt5Ticket!=null){
   const rp=(mt5RealPositions||[]).find(x=>String(x.ticket)===String(pos.mt5Ticket));
   if(rp){
    const lato=Number(pos.side==='BUY'?rp.bid:rp.ask);
    if(Number.isFinite(lato)&&lato>0)return lato;
   }
  }
 }catch(e){}
 try{
  const v=(typeof fblPrezzoChiusura==='function')?fblPrezzoChiusura(pos):null;
  return Number.isFinite(v)?v:null;
 }catch(e){ return null; }
}
// IL PREZZO DELLO STOP A PAREGGIO, ADESSO: il pareggio esatto, oppure il pareggio esatto
// allontanato di uno spread se il mercato sta chiudendo o riaprendo (e l'interruttore e'
// acceso).
function fblPareggioPerStop(pos,t){
 const esatto=mt5PrezzoPareggio(pos);
 const fuori={prezzo:esatto,esatto:esatto,margine:0,fase:null,motivo:''};
 if(!Number.isFinite(esatto))return fuori;
 if(!pos||pos.mt5Ticket==null)return fuori;      // simulata: lo spread e' gia' dentro l'entrata
 if(!fblMargineChiusuraAttivo())return fuori;     // interruttore spento: pareggio esatto e basta
 const asset=pos.asset||currentAssetKey;
 const fin=fblFinestraChiusura(asset,t);
 if(!fin.calda)return fuori;
 const margine=fblMargineChiusuraPrezzo(asset);
 if(!(margine>0))return fuori;
 const prezzo=(pos.side==='BUY')?esatto-margine:esatto+margine;
 return {prezzo:prezzo,esatto:esatto,margine:margine,fase:fin.fase,motivo:fin.fase};
}
// COSA FARE, ADESSO, CON LO STOP DI QUESTA POSIZIONE. E' il cervello del meccanismo:
//  - nella finestra calda, se lo stop e' al pareggio esatto, si allontana di uno spread;
//  - finita la finestra (e mercato aperto), se lo stop e' quello col margine, torna al pareggio
//    esatto;
//  - in tutti gli altri casi non si tocca niente: uno stop spostato a mano non si sposta mai.
// {azione:'nessuna'|'margine'|'pareggio', prezzo, esatto, margine, fase, motivo}
function fblPareggioChiusuraDecide(pos,t){
 const fuori={azione:'nessuna',prezzo:null,esatto:null,margine:0,fase:null,motivo:''};
 if(!pos||pos.mt5Ticket==null)return fuori;
 const asset=pos.asset||currentAssetKey;
 const esatto=mt5PrezzoPareggio(pos);
 if(!Number.isFinite(esatto))return fuori;
 const scelta=fblPareggioPerStop(pos,t);
 const sl=Number(pos.sl);
 let pip=0; try{ pip=pipSizeForAsset(asset); }catch(e){}
 const tol=(pip>0)?pip/2:1e-9;
 const ora=fblPrezzoVeroPosizione(pos);
 const troppoVicino=(prezzo)=>{ try{ return fblPareggioTroppoVicino(pos,prezzo,ora).vicino; }catch(e){ return false; } };
 const oltre=(prezzo)=>{   // uno stop oltre il prezzo di adesso chiuderebbe subito
  if(!Number.isFinite(ora))return false;
  return (pos.side==='BUY')?(prezzo>=ora):(prezzo<=ora);
 };
 const fin=fblFinestraChiusura(asset,t);
 if(scelta.margine>0){
  // FINESTRA CALDA: lo stop a pareggio si allontana di uno spread.
  if(!(Number.isFinite(sl)&&Math.abs(sl-esatto)<=tol))return fuori;   // non e' a pareggio: non si tocca
  if(troppoVicino(scelta.prezzo))return fuori;                          // non sta fuori dalla forbice
  if(oltre(scelta.prezzo))return fuori;                                 // chiuderebbe subito
  // Non si insiste a ogni giro (due secondi): se il conto non prende lo stop, si riprova ogni
  // cinque minuti, non ogni due secondi.
  const tentativo=(pos.beChiusura&&Number.isFinite(pos.beChiusura.at))?pos.beChiusura.at:0;
  if(tentativo&&(Date.now()-tentativo)<5*60000)return fuori;
  return {azione:'margine',prezzo:scelta.prezzo,esatto:esatto,margine:scelta.margine,fase:scelta.fase,motivo:scelta.motivo};
 }
 // FINESTRA FINITA: lo stop col margine torna al pareggio esatto.
 if(fin.fase==='chiuso')return fuori;   // mercato chiuso: si aspetta la riapertura
 const segno=pos.beChiusura;
 if(!(segno&&Number.isFinite(segno.prezzo)))return fuori;         // non era mai stato spostato
 if(!(Number.isFinite(sl)&&Math.abs(sl-segno.prezzo)<=tol)){ pos.beChiusura=null; return fuori; }  // spostato a mano: non si tocca
 if(troppoVicino(esatto))return fuori;                              // dentro la forbice: aspetta che il prezzo si allontani
 if(oltre(esatto))return fuori;                                     // chiuderebbe subito
 return {azione:'pareggio',prezzo:esatto,esatto:esatto,margine:0,fase:null,motivo:'mercato stabilizzato'};
}
// Sposta lo stop sul conto MT5 (bridge) senza la baraonda di messaggi: qui si chiama da solo,
// ogni due secondi, e non deve riempire la barra di stato.
async function fblMt5SpostaStop(pos,prezzo){
 if(!pos||pos.mt5Ticket==null||!Number.isFinite(prezzo))return false;
 try{
  let tp=0;
  const live=(mt5RealPositions||[]).find(rp=>String(rp.ticket)===String(pos.mt5Ticket));
  if(live&&Number.isFinite(Number(live.tp)))tp=Number(live.tp);
  else if(Number.isFinite(Number(pos.tp)))tp=Number(pos.tp);
  const r=await fetchMt5WithTimeout('/order/modify',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({ticket:pos.mt5Ticket,sl:prezzo,tp:tp})});
  return !!(r&&r.ok);
 }catch(e){ return false; }
}
// IL GIRO: insieme al polling delle posizioni reali (ogni due secondi). Applica le decisioni di
// fblPareggioChiusuraDecide e parla col conto MT5 quando la posizione e' reale.
async function fblPareggioChiusuraGiro(t){
 const quando=Number.isFinite(t)?t:Date.now();
 let allontanate=0,tornate=0,fallite=0;
 try{
  const lista=(typeof positions!=='undefined')?(positions||[]):[];
  for(const pos of lista){
   if(!pos)continue;
   const d=fblPareggioChiusuraDecide(pos,quando);
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
   else tornate++;
  }
 }catch(e){}
 if(allontanate||tornate||fallite){
  try{ draw(); update(); }catch(e){}
  try{
   const pezzi=[];
   if(allontanate)pezzi.push(allontanate+(allontanate===1?' posizione ha':' posizioni hanno')+' lo stop a pareggio allontanato di uno spread, per non farsi prendere dalla forbice del cambio giornata');
   if(tornate)pezzi.push(tornate+(tornate===1?' posizione e tornata':' posizioni sono tornate')+' al pareggio esatto (profitto netto zero)');
   if(fallite)pezzi.push(fallite+(fallite===1?' posizione non ha potuto':' posizioni non hanno potuto')+' spostare lo stop sul conto MT5');
   $('status').textContent='\u2696\ufe0f Pareggio e cambio giornata: '+pezzi.join('; ')+'.';
  }catch(e){}
 }
 return allontanate+tornate;
}"""

# La sezione nelle impostazioni.
IMPOSTAZIONI_HTML = """            <div class="fbSettingsSectionTitle">\U0001f552 Chiusura mercato</div>
            <div class="fbOptRow">
              <label style="flex:none;min-width:110px" title="Intorno alla chiusura e alla riapertura del mercato, lo stop a pareggio viene allontanato di uno spread, cosi' il cambio giornata non lo prende; quando il mercato si stabilizza lo stop torna al pareggio esatto">Margine di chiusura</label>
              <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;cursor:pointer">
                <input type="checkbox" id="fblMargineChiusura" checked>
                allontana lo stop a pareggio intorno alla chiusura
              </label>
            </div>
            <div class="hint" style="margin:-4px 0 10px">
              Vale solo intorno alla chiusura e alla riapertura del mercato, non sempre: lo stop a
              pareggio viene allontanato di uno spread, cosi' il cambio giornata non lo prende a
              tradimento. Quando il mercato si stabilizza, lo stop torna al pareggio esatto
              (profitto netto zero, commissioni e swap compresi).
            </div>""".split('\n')

# ---------------------------------------------------------------------------
# LE MODIFICHE, DALLA RIGA PIU' ALTA VERSO LA PIU' BASSA
# (i numeri di riga sono quelli del file di partenza: DELTA tiene conto degli spostamenti)
# ---------------------------------------------------------------------------

# (1) il giro del pareggio: accanto al polling delle posizioni reali
trasforma(35474, lambda r: r + """
      // IL PAREGGIO INTORNO ALLA CHIUSURA DEL MERCATO: qui, e non in un timer sparato, si
      // riallinea lo stop a pareggio quando il mercato si stabilizza (e lo allontana di uno
      // spread quando il mercato sta chiudendo).
      try{ fblPareggioChiusuraGiro(Date.now()); }catch(e){}""",
    'giro pareggio nel polling', 'mt5RealPositions=result.data;')

# (2) il pareggio che si regola da solo: deve usare lo stesso prezzo del pulsante BE
trasforma(35266, lambda r: sost(r, 'const nb=mt5PrezzoPareggio(p);',
                                 'const nb=fblPareggioPerStop(p).prezzo;', 'pareggio che si regola da solo'),
          'pareggio che si regola da solo', 'const nb=mt5PrezzoPareggio(p);')

# (3) il blocco di funzioni, prima di saveMt5OpenAnchorsToStorage
inserisci(35026, MARGINE_BLOCCO.split('\n'), 'blocco del margine di chiusura',
          'function saveMt5OpenAnchorsToStorage(){')


# (4) il pulsante BE della tabella MT5: la posizione tracciata in app
def t_be_diretto_tracciata(r):
    return sost(
        r,
        'trackedPos.sl=beSl; trackedPos.slAt=Date.now(); trackedPos.beMarkerSl=beSl;',
        'trackedPos.sl=stopSl; trackedPos.slAt=Date.now(); trackedPos.beMarkerSl=beSl; '
        'trackedPos.beChiusura=(scelta.margine>0)?{prezzo:stopSl,esatto:beSl,margine:scelta.margine,fase:scelta.fase,at:Date.now()}:null;',
        'BE diretto: posizione tracciata')


trasforma(21944, t_be_diretto_tracciata, 'BE diretto: posizione tracciata', 'trackedPos.sl=beSl;')


# (5) il messaggio del pulsante BE diretto: due varianti, una per il margine
def t_messaggio_be_diretto(r):
    m = re.match(r"^(\s*)\$\('status'\)\.textContent=`(.*)`;\s*$", r)
    if not m:
        ferma('messaggio BE diretto non riconosciuto: %r' % r)
    indent, messaggio = m.group(1), m.group(2)
    punto = messaggio[0] if messaggio and ord(messaggio[0]) > 127 else ''
    con_margine = (punto + ' Stop Loss di ${live.symbol} (ticket ${live.ticket}) spostato a pareggio'
                   ' + margine di chiusura (${fmtPrice(stopSl)}) su MT5: il pareggio esatto e'
                   ' ${fmtPrice(beSl)}, ma il mercato sta chiudendo e la forbice del cambio'
                   ' giornata e ~${fblInPip(live.symbol,scelta.margine)}.')
    return (indent + "$('status').textContent=scelta.margine>0\n"
            + indent + " ?" + "`" + con_margine + "`\n"
            + indent + " :" + "`" + messaggio + "`;")


trasforma(21936, t_messaggio_be_diretto, 'messaggio BE diretto', 'spostato a pareggio su MT5')

# (6) il comando che va al bridge
trasforma(21933, lambda r: sost(r, 'sl:beSl,tp:', 'sl:stopSl,tp:', 'comando BE diretto'),
          'comando BE diretto', 'sl:beSl,tp:')

# (7) la conferma: con il margine deve dire la verita'
trasforma(21929, lambda r: sost(
    r,
    'a pareggio (${fmtPrice(beSl)}: profitto netto 0,00 con commissioni e swap)',
    'a ${scelta.margine>0?`pareggio + margine di chiusura (${fmtPrice(stopSl)}: il pareggio esatto '
    'e ${fmtPrice(beSl)}, il mercato sta chiudendo)`:`pareggio (${fmtPrice(beSl)}: profitto netto '
    '0,00 con commissioni e swap)`}',
    'conferma BE diretto'),
    'conferma BE diretto', 'a pareggio (${fmtPrice(beSl)}: profitto netto 0,00 con commissioni e swap)')

# (8) il rifiuto dello stop dentro la forbice, nel pulsante BE diretto
trasforma(21925, lambda r: sost(r, 'fblPareggioTroppoVicino(finta,beSl,oraQui)',
                                 'fblPareggioTroppoVicino(finta,stopSl,oraQui)', 'rifiuto forbice BE diretto'),
          'rifiuto forbice BE diretto', 'fblPareggioTroppoVicino(finta,beSl,oraQui);')

# (9) il prezzo del pareggio nel pulsante BE diretto
trasforma(21919, lambda r: sost(
    r,
    'const beSl=mt5PrezzoPareggio(finta);',
    'const scelta=fblPareggioPerStop(finta);\n  const beSl=scelta.esatto;\n  const stopSl=scelta.prezzo;',
    'prezzo pareggio BE diretto'),
    'prezzo pareggio BE diretto', 'const beSl=mt5PrezzoPareggio(finta);')


# (10) il messaggio del pulsante BE della tabella posizioni: due varianti, una per il margine
def t_messaggio_be_posizioni(r_testo, r_ternario, r_colon):
    m1 = re.match(r"^(\s*)\?`(.*)`\s*$", r_ternario)
    m2 = re.match(r"^(\s*):`(.*)`;\s*$", r_colon)
    if not m1 or not m2:
        ferma('messaggio BE non riconosciuto')
    msg1, msg2 = m1.group(2), m2.group(2)
    nuovo1 = sost(msg1,
                  'spostato a pareggio (${fmtPrice(beSl)}: profitto netto 0,00 con commissioni e swap)',
                  'spostato a pareggio + margine di chiusura (${fmtPrice(stopSl)}): il pareggio esatto '
                  'e ${fmtPrice(beSl)}, ma il mercato sta chiudendo e la forbice del cambio giornata '
                  'e ~${fblInPip((pos&&pos.asset)||currentAssetKey,scelta.margine)} '
                  '\u2014 lo stop viene tenuto fuori dalla forbice e torna al pareggio esatto quando il '
                  'mercato si stabilizza',
                  'messaggio BE (con margine)')
    nuovo2 = sost(msg2,
                  'spostato a pareggio (${fmtPrice(beSl)}).',
                  'spostato a pareggio + margine di chiusura (${fmtPrice(stopSl)}): il pareggio esatto '
                  'e ${fmtPrice(beSl)}, il mercato sta chiudendo e la forbice e '
                  '~${fblInPip((pos&&pos.asset)||currentAssetKey,scelta.margine)}.',
                  'messaggio BE (con margine, breve)')
    return [
        '  if(scelta.margine>0){',
        '  ' + r_testo.strip(),
        '    ?`' + nuovo1 + '`',
        '    :`' + nuovo2 + '`;',
        '  }else{',
        r_testo,
        r_ternario,
        r_colon,
        '  }',
    ]


sostituisci_blocco(21906, 21908,
                   t_messaggio_be_posizioni(righe[_riga(21906)], righe[_riga(21907)], righe[_riga(21908)]),
                   'messaggio BE', 'textContent=pos.mt5Ticket!=null')

# (11) il segno del margine, nel pulsante BE della tabella posizioni
trasforma(21903, lambda r: r + """
  // CON IL MARGINE DI CHIUSURA lo stop NON e' al pareggio: e' il pareggio esatto allontanato di
  // uno spread, per non farsi prendere dalla forbice del cambio giornata. Il segno serve per
  // riportarlo al pareggio esatto quando il mercato si stabilizza.
  pos.beChiusura=(scelta.margine>0)?{prezzo:stopSl,esatto:beSl,margine:scelta.margine,fase:scelta.fase,at:Date.now()}:null;""",
          'segno del margine', 'pos.beMarkerSl=beSl;')

# (12) lo stop spostato, nel pulsante BE della tabella posizioni
trasforma(21902, lambda r: sost(r, 'pos.sl=beSl;', 'pos.sl=stopSl;', 'stop spostato'),
          'stop spostato', 'pos.sl=beSl; pos.slAt=Date.now();')

# (13) il rifiuto dello stop dentro la forbice, nel pulsante BE della tabella posizioni
trasforma(21891, lambda r: sost(r, 'fblPareggioTroppoVicino(pos,beSl)',
                                 'fblPareggioTroppoVicino(pos,stopSl,fblPrezzoVeroPosizione(pos))',
                                 'rifiuto forbice BE'),
          'rifiuto forbice BE', 'fblPareggioTroppoVicino(pos,beSl);')

# (14) il prezzo del pareggio, nel pulsante BE della tabella posizioni
trasforma(21884, lambda r: sost(
    r,
    'const beSl=mt5PrezzoPareggio(pos);',
    'const scelta=fblPareggioPerStop(pos);\n  const beSl=scelta.esatto;\n  const stopSl=scelta.prezzo;',
    'prezzo pareggio BE'),
    'prezzo pareggio BE', 'const beSl=mt5PrezzoPareggio(pos);')

# (15) l'interruttore: salvato come gli altri
trasforma(19649, lambda r: r + """
  if(ev.target&&ev.target.id==='fblMargineChiusura')fblMargineChiusuraSalva();""",
          'interruttore del margine', 'ev.target&&(')

# (16) l'interruttore: rimesso al suo posto appena la pagina c'e'
def t_ripristino_else(r):
    m = re.match(r"^(\s*)else\s+(\w+)\(\);\s*$", r)
    if not m:
        ferma('else non riconosciuto: %r' % r)
    return m.group(1) + 'else { ' + m.group(2) + '(); fblMargineChiusuraRipristina(); }'


trasforma(19655, t_ripristino_else, 'ripristino interruttore (else)', 'else ')


def t_ripristino_listener(r):
    m = re.match(r"^(\s*)if\(document\.readyState==='loading'\)document\.addEventListener\('DOMContentLoaded',(\w+)\);\s*$", r)
    if not m:
        ferma('DOMContentLoaded non riconosciuto: %r' % r)
    return (m.group(1) + "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{ "
            + m.group(2) + '(); fblMargineChiusuraRipristina(); });')


trasforma(19654, t_ripristino_listener, 'ripristino interruttore', "document.readyState==='loading'")

# (17) la sezione nelle impostazioni, dopo il blocco delle strisce di vicinanza
_controlla(2583, 'che le mette a sinistra', 'testo delle impostazioni')
inserisci_dopo(2584, IMPOSTAZIONI_HTML, 'sezione chiusura mercato nelle impostazioni',
               '</div>')

with io.open(PERCORSO, 'w', encoding='utf-8', newline='') as f:
    f.write(NL.join(righe))

print('Fatto: il margine dello spread solo intorno alla chiusura e alla riapertura del mercato.')
