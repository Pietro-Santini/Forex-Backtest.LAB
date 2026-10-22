# -*- coding: utf-8 -*-
import io
p = 'app.html'
s = io.open(p, encoding='utf-8', newline='').read()
NL = '\r\n'

def sub(s, v, n, nome):
    v = v.replace('\n', NL); n = n.replace('\n', NL)
    assert s.count(v) == 1, (nome, s.count(v))
    return s.replace(v, n)

s = sub(s, u'''async function saveFootprintTicksNow(){
 if(!footprintTicksDirty)return;
 footprintTicksDirty=false;
 const ok=await idbPut('footprintTicks',footprintTickLogByAsset);
 if(!ok)footprintTicksDirty=true; // scrittura fallita: riprova al prossimo giro invece di perdere il flag
}''',
u'''// IL REGISTRO DEI TICK SI SALVA A BLOCCHI, NON TUTTO INTERO.
//
// MISURATO sulla macchina del proprietario (22 ottobre): «scatto peggiore 1.264 ms», cioe' un
// blocco di oltre un secondo in cui l'app non risponde. Con i suoi 197.373 tick di footprint, sul
// banco di prova salvare l'intero registro su IndexedDB costa 100 ms (138 ms la sola copia
// strutturata che IndexedDB fa del valore) - e la sua macchina, dal confronto dei disegni, e'
// circa dieci volte piu' lenta. I conti tornano: era il salvataggio automatico.
//
// PERCHE' COSTAVA TANTO: si riscriveva TUTTO il registro a ogni salvataggio, anche se nel
// frattempo erano arrivati tre tick. IndexedDB deve copiare per intero il valore che gli si da',
// e duecentomila oggetti sono duecentomila copie.
//
// ADESSO: ogni asset e' spezzato in blocchi da FOOTPRINT_BLOCCO tick, e si riscrive SOLO il
// blocco in coda - l'unico che cambia quando arriva un tick. I blocchi pieni non si toccano mai
// piu'. Il costo di un salvataggio passa da «tutto il registro» a «al massimo un blocco».
//
// SI CONTINUA A LEGGERE ANCHE IL VECCHIO FORMATO: chi aggiorna l'app ha su disco un unico blob
// sotto la chiave 'footprintTicks', e buttarlo via vorrebbe dire perdere lo storico del footprint
// gia' raccolto. Si legge, si riscrive a blocchi, e da li' in poi si va con quelli.
const FOOTPRINT_BLOCCO=20000;
function fblTickChiave(asset,i){ return 'ftick:'+asset+':'+i; }
async function saveFootprintTicksNow(){
 if(!footprintTicksDirty)return;
 footprintTicksDirty=false;
 let tutteBene=true;
 try{
  const indice={};
  for(const asset in footprintTickLogByAsset){
   const log=footprintTickLogByAsset[asset]||[];
   const nBlocchi=Math.max(1,Math.ceil(log.length/FOOTPRINT_BLOCCO));
   indice[asset]={n:nBlocchi,tot:log.length};
   // Solo i blocchi la cui lunghezza e' cambiata: quelli pieni restano identici per sempre.
   const gia=(fblTickBlocchiScritti[asset]||{});
   const ora={};
   for(let i=0;i<nBlocchi;i++){
    const pezzo=log.slice(i*FOOTPRINT_BLOCCO,(i+1)*FOOTPRINT_BLOCCO);
    ora[i]=pezzo.length;
    if(gia[i]===pezzo.length&&i<nBlocchi-1)continue;   // blocco pieno e gia' scritto
    if(gia[i]===pezzo.length&&i===nBlocchi-1)continue; // coda non cresciuta dall'ultima volta
    const ok=await idbPut(fblTickChiave(asset,i),pezzo);
    if(!ok){ tutteBene=false; ora[i]=-1; }
   }
   fblTickBlocchiScritti[asset]=ora;
  }
  const ok=await idbPut('ftickIndice',indice);
  if(!ok)tutteBene=false;
 }catch(e){ tutteBene=false; }
 if(!tutteBene)footprintTicksDirty=true; // riprova al prossimo giro invece di perdere il flag
}
// Quanti tick aveva ogni blocco l'ultima volta che e' stato scritto: serve a non riscrivere
// quelli che non sono cambiati. Vive solo in memoria, e se si perde si riscrive tutto una volta.
let fblTickBlocchiScritti={};
// Rilegge il registro dai blocchi. `null` se non c'e' niente in questo formato, cosi' chi chiama
// puo' ricadere sul vecchio blob.
async function fblTickLeggiBlocchi(){
 try{
  const indice=await idbGet('ftickIndice');
  if(!indice||typeof indice!=='object')return null;
  const fuori={};
  for(const asset in indice){
   const n=Math.max(0,Number(indice[asset]&&indice[asset].n)||0);
   let log=[];
   for(let i=0;i<n;i++){
    const pezzo=await idbGet(fblTickChiave(asset,i));
    if(Array.isArray(pezzo))log=log.concat(pezzo);
   }
   if(log.length)fuori[asset]=log;
  }
  return Object.keys(fuori).length?fuori:null;
 }catch(e){ return null; }
}''', 'salva a blocchi')

s = sub(s, u''' if(savedFootprintTicks&&typeof savedFootprintTicks==='object'){
   footprintTickLogByAsset=savedFootprintTicks;''',
u''' // PRIMA I BLOCCHI (formato nuovo), POI il vecchio blob unico: chi aggiorna l'app ha ancora
 // quello su disco, e buttarlo via vorrebbe dire perdere lo storico del footprint gia' raccolto.
 try{
   const aBlocchi=await fblTickLeggiBlocchi();
   if(aBlocchi)savedFootprintTicks=aBlocchi;
 }catch(e){}
 if(savedFootprintTicks&&typeof savedFootprintTicks==='object'){
   footprintTickLogByAsset=savedFootprintTicks;''', 'leggi blocchi')

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
