(function(){
"use strict";
const bank=window.CHEM_BANK;
if(bank&&Array.isArray(bank.reactions)){
 const extras=[...(window.CHEM_EXTRA||[]),...(window.CHEM_EXTRA_2||[]),...(window.CHEM_EXTRA_3||[])];
 const merged=new Map();
 for(const card of [...bank.reactions,...extras]){
  const key=card.lhs.replace(/\s+/g,"")+"→"+card.rhs.replace(/\s+/g,"");
  if(!merged.has(key))merged.set(key,{...card});
  else if(card.special){
   const first=merged.get(key);
   first.special=true;
   if(!first.source&&card.source)first.source=card.source;
  }
 }
 bank.reactions=[...merged.values()];
}
const get=id=>document.getElementById(id);
if(!bank||!Array.isArray(bank.compounds)||!Array.isArray(bank.reactions)){
 document.querySelector(".workspace").innerHTML='<div class="empty">Не удалось загрузить банк карточек. Обновите страницу.</div>';
 return;
}
const key="chemistry-flashcards-2026-v1";
const defaults={mode:"names",direction:"formula",topic:"all",queue:[],pos:0,flipped:false};
let state={...defaults};
try{const saved=JSON.parse(localStorage.getItem(key)||"null");if(saved&&typeof saved==="object")state={...defaults,...saved};}catch(_){}
if(!["names","reactions"].includes(state.mode))state.mode="names";
if(!["formula","name"].includes(state.direction))state.direction="formula";
const dataFor=()=>state.mode==="names"?bank.compounds:bank.reactions;
const escapeHTML=s=>String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});
const chem=s=>escapeHTML(s).replace(/([A-Za-z\)\]])(\d+)/g,"$1<sub>$2</sub>");
function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch(_){}}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function topics(){return [...new Set(dataFor().map(x=>x.topic))];}
function selected(){return dataFor().filter(x=>state.topic==="all"||(state.topic==="__special__"&&!!x.special)||x.topic===state.topic);}
function refreshTopicOptions(){
 const ts=topics();
 if(state.topic!=="all"&&!(state.topic==="__special__"&&state.mode==="reactions")&&!ts.includes(state.topic))state.topic="all";
 const special=state.mode==="reactions"?'<option value="__special__">★ Все особые реакции ('+dataFor().filter(x=>x.special).length+')</option>':"";
 get("topic").innerHTML='<option value="all">Все темы</option>'+special+ts.map(t=>'<option value="'+escapeHTML(t)+'">'+escapeHTML(t)+'</option>').join("");
 get("topic").value=state.topic;
}
function resetDeck(randomize){
 const list=selected().map(x=>x.id);
 state.queue=randomize?shuffle(list):list;
 state.pos=0;state.flipped=false;save();render();
}
function ensureDeck(){
 const expected=selected().map(x=>x.id);
 const same=Array.isArray(state.queue)&&state.queue.length===expected.length&&new Set(state.queue).size===expected.length&&state.queue.every(id=>expected.includes(id));
 if(!same){resetDeck(true);return;}
 state.pos=Math.max(0,Math.min(expected.length-1,Number(state.pos)||0));
 render();
}
function setMode(mode){
 if(state.mode===mode)return;state.mode=mode;state.topic="all";refreshTopicOptions();resetDeck(true);
}
function text(el,txt){el.textContent=txt;}
function applyNames(card){
 const frontIsFormula=state.direction==="formula";
 text(get("front-label"),frontIsFormula?"ВСПОМНИТЕ НАЗВАНИЕ":"ВСПОМНИТЕ ФОРМУЛУ");
 const a=get("front-main"),b=get("back-main");
 a.className="main-formula"+(frontIsFormula?"":" name");
 b.className="main-formula"+(frontIsFormula?" name":"");
 a.innerHTML=frontIsFormula?chem(card.formula):escapeHTML(card.name);
 b.innerHTML=frontIsFormula?escapeHTML(card.name):chem(card.formula);
 get("front-sub").textContent="";
 get("back-sub").textContent=frontIsFormula?"Формула: "+card.formula:"Название: "+card.name;
}
function applyReaction(card){
 text(get("front-label"),"НАЗОВИТЕ ПРОДУКТЫ РЕАКЦИИ");
 const a=get("front-main"),b=get("back-main");
 a.className="main-formula react";b.className="equation";
 a.innerHTML=chem(card.lhs)+" <span style='color:#128871'>→ ?</span>";
 b.innerHTML=chem(card.lhs)+' <span class="arrow">→</span> '+chem(card.rhs);
 get("front-sub").innerHTML=card.condition?'<span class="condition">'+escapeHTML(card.condition)+'</span>':"";
 const sources={"N":"Neorganika.pdf","P":"Неорганическая хими 2.pdf","W":"неорганика 1.pdf"};
 const ref=card.source?card.source.match(/^([NPW])(\d+)$/):null;
 get("back-sub").textContent=card.explanation+(ref?" · Источник: "+sources[ref[1]]+", стр. "+ref[2]:"");
}
function render(){
 const mode=state.mode;
 get("tab-names").classList.toggle("active",mode==="names");
 get("tab-reactions").classList.toggle("active",mode==="reactions");
 get("tab-names").setAttribute("aria-pressed",String(mode==="names"));
 get("tab-reactions").setAttribute("aria-pressed",String(mode==="reactions"));
 get("direction-wrap").hidden=mode==="reactions";
 get("direction").value=state.direction;
 get("total-names").textContent=bank.compounds.length;
 get("total-reactions").textContent=bank.reactions.length;
 const cards=new Map(dataFor().map(c=>[c.id,c]));
 const card=cards.get(state.queue[state.pos]);
 if(!card){text(get("progress-text"),"0 / 0");text(get("deck-label"),"Нет карточек");get("flashcard").hidden=true;return;}
 get("flashcard").hidden=false;
 text(get("badge"),card.topic);
 text(get("deck-label"),state.topic==="all"?"Все темы · "+state.queue.length+" карточек":state.topic==="__special__"?"Особые реакции · "+state.queue.length+" карточек":state.queue.length+" карточек в разделе");
 text(get("progress-text"),(state.pos+1)+" / "+state.queue.length);
 get("progress-fill").style.width=(((state.pos+1)/state.queue.length)*100)+"%";
 get("prev").disabled=state.pos===0;
 text(get("next"),state.pos===state.queue.length-1?"↺ Сначала":"Далее →");
 if(mode==="names")applyNames(card);else applyReaction(card);
 get("flashcard").classList.toggle("is-flipped",!!state.flipped);
 get("flashcard").setAttribute("aria-pressed",String(!!state.flipped));
 get("front").setAttribute("aria-hidden",String(!!state.flipped));
 get("back").setAttribute("aria-hidden",String(!state.flipped));
 text(get("flip-button"),state.flipped?"↶ К вопросу":"↻ Перевернуть");
}
function flip(){
 state.flipped=!state.flipped;save();render();
}
function move(delta){
 if(delta<0&&state.pos===0)return;
 state.pos=delta>0&&state.pos===state.queue.length-1?0:state.pos+delta;
 state.flipped=false;save();render();
}
get("tab-names").addEventListener("click",()=>setMode("names"));
get("tab-reactions").addEventListener("click",()=>setMode("reactions"));
get("direction").addEventListener("change",e=>{state.direction=e.target.value;state.flipped=false;save();render();});
get("topic").addEventListener("change",e=>{state.topic=e.target.value;resetDeck(true);});
get("shuffle").addEventListener("click",()=>resetDeck(true));
get("flashcard").addEventListener("click",flip);
get("flip-button").addEventListener("click",flip);
get("prev").addEventListener("click",()=>move(-1));
get("next").addEventListener("click",()=>move(1));
document.addEventListener("keydown",e=>{
 if(e.altKey||e.ctrlKey||e.metaKey||["SELECT","INPUT","TEXTAREA"].includes(document.activeElement?.tagName))return;
 if(e.code==="Space"){e.preventDefault();flip();}
 if(e.key==="ArrowRight"){e.preventDefault();move(1);}
 if(e.key==="ArrowLeft"){e.preventDefault();move(-1);}
});
refreshTopicOptions();ensureDeck();
})();