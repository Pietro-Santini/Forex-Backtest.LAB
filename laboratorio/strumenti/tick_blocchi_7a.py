# -*- coding: utf-8 -*-
"""Capitolo 7a: il registro dei tick si salva a BLOCCHI, in forma compatta.

Lo script non scrive se un aggancio non e' unico: meglio fallire che applicare a meta'."""
import io
import re
import sys

PERCORSO = 'app.html'
NL = '\r\n'

with io.open(PERCORSO, 'r', encoding='utf-8', newline='') as f:
    s = f.read()


def a_crlf(testo):
    # TUTTI i fine riga, non solo il primo: replace con una stringa sostituisce una volta sola.
    return re.sub(r'\r?\n', NL, testo)


def sub(s, vecchio, nuovo, nome):
    v = a_crlf(vecchio)
    n = a_crlf(nuovo)
    c = s.count(v)
    if c != 1:
        print('AGGANCIO NON UNICO (%d): %s' % (c, nome))
        sys.exit(1)
    return s.replace(v, n)


# ---------------------------------------------------------------- 1. idbDel
s = sub(s, """}catch(e){ console.warn('Lettura sessione fallita:',e); return null; }
}
// STEP 0b""", """}catch(e){ console.warn('Lettura sessione fallita:',e); return null; }
}
// ELIMINARE una chiave. Serve quando il registro tick passa ai blocchi (il blob unico vecchio
// non serve piu') e quando un blocco uscito dalla testa del registro sparisce dal disco.
async function idbDel(key){
 try{
  const db=await openSessionDB();
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction(SESSION_STORE,'readwrite');
   tx.objectStore(SESSION_STORE).delete(key);
   tx.oncomplete=()=>resolve(true);
   tx.onerror=()=>reject(tx.error);
  });
 }catch(e){ console.warn('Cancellazione sessione fallita:',e); return false; }
}
// STEP 0b""", 'idbDel')

# ------------------------------------------------- 2. il motore dei blocchi
MOTORE = """// ============ REGISTRO TICK A BLOCCHI ============
//
// MISURATO (22 ottobre 2026): il proprietario ha visto «scatto peggiore 1.264 ms» e l'ha
// indicato come il salvataggio del registro tick. Misura sul banco di prova, 150.000 tick (il
// tetto per asset):
//
//   scrittura di oggi (tutto il registro, ogni volta) ...... 105 ms
//   un blocco da 20.000 tick, con gli oggetti ..............  24 ms
//   un blocco da 20.000 tick, in forma compatta ............ 2,5 ms
//   tutto il registro in forma compatta .....................  12 ms
//
// Il costo e' quasi tutto nella COPIA STRUTTURATA di centinaia di migliaia di oggetti. La cura
// sono due cose insieme: (1) si scrive SOLO il blocco in coda, non tutto il registro; (2) il
// blocco si scrive in FORMA COMPATTA (quattro numeri per tick) invece che come oggetti.
//
// LA FORMA COMPATTA NON PERDE NULLA (controllato, non sperato): istante, prezzo, lato e peso ci
// sono sempre; 'aggr', 'vol', 'mode' e 'src' ci sono quando servono; un campo che non si conosce
// resta VERBATIM. Il footprint continua a sapere chi ha comprato e chi ha venduto, come prima.
//
// I BLOCCHI NON SI SPOSTANO. Il registro cresce in coda e si accorcia dalla testa (il tetto di
// 150.000 tick): quando si accorcia si butta via un BLOCCO INTERO, cosi' i blocchi restano
// allineati e quelli pieni non si riscrivono MAI. Ogni blocco ha un numero assoluto (base+j):
// buttar via il primo blocco non rinumera gli altri e non tocca niente di quello che era gia'
// scritto.
//
// LA MIGRAZIONE: il registro vecchio (un unico blob 'footprintTicks') si legge ancora. Se i
// blocchi non ci sono si usa il blob vecchio e al prossimo salvataggio viene riscritto a blocchi
// (e il blob vecchio cancellato). Se i blocchi ci sono, si usano loro.
const FOOTPRINT_BLOCCO_TICK=20000;        // i tick per blocco
const FOOTPRINT_TICK_CHIAVE='ftick:';      // ftick:<asset>:<numero assoluto del blocco>
const FOOTPRINT_TICK_INDICE='ftickIndice';  // l'indice dei blocchi (scritto DOPO i blocchi)
const FOOTPRINT_TICK_CAMPI=['t','price','side','weight','src','mode','aggr','vol'];
let footprintTickIndice={};        // asset -> {base, scritti:[], rigenera, daCancellare:[]}
let fblTickMigrato=false;          // il blob vecchio va cancellato dopo la prima scrittura a blocchi
function fblTickStato(asset){
 let st=footprintTickIndice[asset];
 if(!st)st=footprintTickIndice[asset]={base:0,scritti:[],rigenera:false,daCancellare:[]};
 return st;
}
// IL REGISTRO E' STATO RICOSTRUITO (backfill storico, import dal PC, pulizia all'avvio): i
// blocchi vecchi non valgono piu' niente e vanno riscritti tutti.
function fblTickRicostruito(asset){
 fblTickStato(asset).rigenera=true;
}
// IL REGISTRO HA SUPERATO IL TETTO: si butta via un BLOCCO INTERO dalla testa, cosi' i blocchi
// restano allineati e quelli pieni non si riscrivono.
function fblTickTaglia(asset,log){
 while(log&&log.length>FOOTPRINT_MAX_TICKS_PER_ASSET){
  log.splice(0,Math.min(FOOTPRINT_BLOCCO_TICK,log.length));
  const st=footprintTickIndice[asset];
  if(st){
   st.base++;
   if(st.scritti.length)st.scritti.shift();
   st.daCancellare.push(st.base-1);   // il blocco uscito dalla testa sparisce dal disco
  }
 }
}
// CODIFICA COMPATTA DI UN BLOCCO DI TICK.
function fblTickCodifica(blocco){
 const n=blocco.length;
 const t=new Float64Array(n),p=new Float64Array(n),s=new Int8Array(n),w=new Float64Array(n);
 const a=new Int8Array(n),o=new Float64Array(n),sc=new Uint8Array(n),md=new Uint8Array(n);
 const ds=[''],dm=[''];   // indice 0 = il campo non c'e'
 const extra=[];
 for(let i=0;i<n;i++){
  const x=blocco[i]||{};
  t[i]=Number(x.t)||0;
  p[i]=Number(x.price)||0;
  s[i]=(x.side>0)?1:((x.side<0)?-1:0);
  w[i]=Number.isFinite(x.weight)?x.weight:1;
  a[i]=Number.isFinite(x.aggr)?((x.aggr>0)?1:((x.aggr<0)?-1:0)):127;  // 127 = non c'e'
  o[i]=Number.isFinite(x.vol)?x.vol:NaN;
  const src=typeof x.src==='string'?x.src:'';
  let k=ds.indexOf(src); if(k<0){ds.push(src);k=ds.length-1;}
  sc[i]=k;
  const modo=typeof x.mode==='string'?x.mode:'';
  k=dm.indexOf(modo); if(k<0){dm.push(modo);k=dm.length-1;}
  md[i]=k;
  // QUALSIASI campo non previsto resta VERBATIM: niente si perde, niente si inventa.
  const ks=Object.keys(x);
  let strano=false;
  for(let j=0;j<ks.length;j++){ if(FOOTPRINT_TICK_CAMPI.indexOf(ks[j])<0){strano=true;break;} }
  if(strano)extra.push([i,x]);
 }
 return {v:1,n:n,t:t,p:p,s:s,w:w,a:a,o:o,sc:sc,md:md,ds:ds,dm:dm,x:(extra.length?extra:null)};
}
function fblTickDecodifica(c){
 if(!c)return [];
 const n=c.n||0;
 const ds=c.ds||[''],dm=c.dm||[''];
 const fuori=new Array(n);
 for(let i=0;i<n;i++){
  const x={t:c.t[i],price:c.p[i],side:c.s[i],weight:c.w[i]};
  if(c.sc&&c.sc[i])x.src=ds[c.sc[i]]||undefined;
  if(c.md&&c.md[i])x.mode=dm[c.md[i]]||undefined;
  if(c.a&&c.a[i]!==127)x.aggr=c.a[i];
  if(c.o&&Number.isFinite(c.o[i]))x.vol=c.o[i];
  fuori[i]=x;
 }
 if(c.x)for(let i=0;i<c.x.length;i++){ fuori[c.x[i][0]]=c.x[i][1]; }
 return fuori;
}
// SCRIVERE I BLOCCHI: solo quelli cambiati. Un blocco pieno non si riscrive MAI.
async function fblTickSalvaBlocchi(){
 const assets=Object.keys(footprintTickLogByAsset);
 for(let i=0;i<assets.length;i++){
  const asset=assets[i];
  const log=footprintTickLogByAsset[asset];
  if(!log||!log.length)continue;
  const st=fblTickStato(asset);
  const nB=Math.ceil(log.length/FOOTPRINT_BLOCCO_TICK);
  if(st.rigenera){
   // il contenuto e' cambiato tutto: si riscrive, e i blocchi in piu' spariscono dal disco
   for(let j=nB;j<st.scritti.length;j++)await idbDel(FOOTPRINT_TICK_CHIAVE+asset+':'+(st.base+j));
   st.scritti=[];
   st.rigenera=false;
  }
  for(let j=0;j<nB;j++){
   const len=Math.min(FOOTPRINT_BLOCCO_TICK,log.length-j*FOOTPRINT_BLOCCO_TICK);
   if(st.scritti[j]===len)continue;   // gia' scritto e identico: NON si riscrive
   const pezzo=log.slice(j*FOOTPRINT_BLOCCO_TICK,j*FOOTPRINT_BLOCCO_TICK+len);
   const ok=await idbPut(FOOTPRINT_TICK_CHIAVE+asset+':'+(st.base+j),fblTickCodifica(pezzo));
   if(!ok)return false;
   st.scritti[j]=len;
  }
  for(let j=0;j<st.daCancellare.length;j++)await idbDel(FOOTPRINT_TICK_CHIAVE+asset+':'+st.daCancellare[j]);
  st.daCancellare=[];
 }
 const idx={};
 for(let i=0;i<assets.length;i++){
  const st=footprintTickIndice[assets[i]];
  if(st)idx[assets[i]]={base:st.base,len:st.scritti.slice()};
 }
 if(!await idbPut(FOOTPRINT_TICK_INDICE,idx))return false;
 // il blob unico vecchio: dopo la migrazione non serve piu' (e occupa spazio)
 if(fblTickMigrato){ await idbDel('footprintTicks'); fblTickMigrato=false; }
 return true;
}
// LEGGERE I BLOCCHI: si rilegge quello che c'e' e si mette in fila.
async function fblTickCaricaBlocchi(){
 const idx=await idbGet(FOOTPRINT_TICK_INDICE);
 if(!idx||typeof idx!=='object')return null;
 const out={};
 const assets=Object.keys(idx);
 for(let i=0;i<assets.length;i++){
  const asset=assets[i];
  const st=idx[asset]||{};
  const base=st.base||0;
  const len=st.len||[];
  const blocchi=[];
  for(let j=0;j<len.length;j++){
   const c=await idbGet(FOOTPRINT_TICK_CHIAVE+asset+':'+(base+j));
   if(!c)continue;
   const d=fblTickDecodifica(c);
   for(let k=0;k<d.length;k++)blocchi.push(d[k]);
  }
  if(!blocchi.length)continue;
  out[asset]=blocchi;
  footprintTickIndice[asset]={base:base,scritti:len.slice(),rigenera:false,daCancellare:[]};
 }
 return out;
}
let footprintTicksDirty=false;"""

s = sub(s, """let footprintTicksDirty=false;
async function saveFootprintTicksNow(){
 if(!footprintTicksDirty)return;
 footprintTicksDirty=false;
 const ok=await idbPut('footprintTicks',footprintTickLogByAsset);
 if(!ok)footprintTicksDirty=true; // scrittura fallita: riprova al prossimo giro invece di perdere il flag
}""", MOTORE + """
async function saveFootprintTicksNow(){
 if(!footprintTicksDirty)return;
 footprintTicksDirty=false;
 const ok=await fblTickSalvaBlocchi();
 if(!ok)footprintTicksDirty=true; // scrittura fallita: riprova al prossimo giro invece di perdere il flag
}""", 'saveFootprintTicksNow')

# --------------------------------------------- 3. il taglio nel tick live
s = sub(s, """ log.push({t:timestamp,price,side,weight:w,src:source||undefined});
 if(log.length>FOOTPRINT_MAX_TICKS_PER_ASSET)log.splice(0,log.length-FOOTPRINT_MAX_TICKS_PER_ASSET);
 footprintTicksDirty=true; // vedi saveFootprintTicksNow(): persistito al prossimo giro debounced, non subito""",
        """ log.push({t:timestamp,price,side,weight:w,src:source||undefined});
 fblTickTaglia(assetKey,log);   // il tetto si rispetta buttando via un blocco intero: i blocchi restano allineati
 footprintTicksDirty=true; // vedi saveFootprintTicksNow(): persistito al prossimo giro debounced, non subito""",
        'taglio live')

# --------------------------------------- 4. il backfill storico (ricostruisce)
s = sub(s, """ footprintTickLogByAsset[assetKey]=merged.length>FOOTPRINT_MAX_TICKS_PER_ASSET
   ?merged.slice(merged.length-FOOTPRINT_MAX_TICKS_PER_ASSET):merged;
 footprintTicksDirty=true; // vedi saveFootprintTicksNow(): il backfill storico va persistito quanto i tick live""",
        """ fblTickRicostruito(assetKey);   // il registro e' stato rifatto: i blocchi vanno riscritti tutti
 fblTickTaglia(assetKey,merged);  // se supera il tetto si butta via un blocco intero
 footprintTickLogByAsset[assetKey]=merged;
 footprintTicksDirty=true; // vedi saveFootprintTicksNow(): il backfill storico va persistito quanto i tick live""",
        'backfill')

# ------------------------------------- 5. l'import dal PC (riordina: ricostruisce)
s = sub(s, """ log.sort((x,y)=>x.t-y.t);
 for(let i=1;i<log.length;i++){ const pr=log[i-1], c=log[i]; c.side=c.price>pr.price?1:(c.price<pr.price?-1:pr.side); }
 if(log.length>FOOTPRINT_MAX_TICKS_PER_ASSET)log.splice(0,log.length-FOOTPRINT_MAX_TICKS_PER_ASSET);
 footprintTicksDirty=true;""",
        """ log.sort((x,y)=>x.t-y.t);
 for(let i=1;i<log.length;i++){ const pr=log[i-1], c=log[i]; c.side=c.price>pr.price?1:(c.price<pr.price?-1:pr.side); }
 fblTickRicostruito(asset);   // l'ordinamento e' cambiato: i blocchi vanno riscritti tutti
 fblTickTaglia(asset,log);
 footprintTicksDirty=true;""",
        'import dal PC')

# ------------------------------------------------- 6. l'avvio: blocchi o blob
s = sub(s, """ if(savedFootprintTicks&&typeof savedFootprintTicks==='object'){
   footprintTickLogByAsset=savedFootprintTicks;
   // Ripulitura una tantum di quello gia' salvato: i tick MT5 dello storico finiti nelle fasce di
   // Capital.com prima della correzione (vedi footprintTickMt5FuoriFase). Senza, restavano visibili
   // fino a quando il tetto di tick non li avesse fatti scorrere via.
   try{
     for(const k of Object.keys(footprintTickLogByAsset)){
       const prima=(footprintTickLogByAsset[k]||[]).length;
       footprintTickLogByAsset[k]=footprintSenzaTickMt5FuoriFase(footprintTickLogByAsset[k],k);
       if((footprintTickLogByAsset[k]||[]).length!==prima)footprintTicksDirty=true;
     }
   }catch(e){}
 }""",
        """ // I BLOCCHI hanno la precedenza; il blob unico vecchio e' il ripiego. Se si usa il blob vecchio,
 // al prossimo salvataggio il registro viene riscritto a blocchi (e il blob vecchio cancellato).
 let blocchiTick=null;
 try{ blocchiTick=await fblTickCaricaBlocchi(); }catch(e){ blocchiTick=null; }
 if(blocchiTick&&Object.keys(blocchiTick).length){
   footprintTickLogByAsset=blocchiTick;
   footprintTicksDirty=true;   // l'indice dei blocchi va riscritto con la struttura di oggi
 }else if(savedFootprintTicks&&typeof savedFootprintTicks==='object'){
   footprintTickLogByAsset=savedFootprintTicks;
   fblTickMigrato=true;   // al prossimo salvataggio il blob vecchio sparisce
   // Ripulitura una tantum di quello gia' salvato: i tick MT5 dello storico finiti nelle fasce di
   // Capital.com prima della correzione (vedi footprintTickMt5FuoriFase). Senza, restavano visibili
   // fino a quando il tetto di tick non li avesse fatti scorrere via.
   try{
     for(const k of Object.keys(footprintTickLogByAsset)){
       const prima=(footprintTickLogByAsset[k]||[]).length;
       footprintTickLogByAsset[k]=footprintSenzaTickMt5FuoriFase(footprintTickLogByAsset[k],k);
       if((footprintTickLogByAsset[k]||[]).length!==prima){ footprintTicksDirty=true; fblTickRicostruito(k); }
     }
   }catch(e){}
   for(const k of Object.keys(footprintTickLogByAsset))fblTickRicostruito(k);
  }""",
        'avvio')

with io.open(PERCORSO, 'w', encoding='utf-8', newline='') as f:
    f.write(s)
print('fatto: il registro tick si salva a blocchi, in forma compatta')
