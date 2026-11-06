(function(){
"use strict";
const bank=window.CHEM_BANK;
const groups=window.CHEM_CARD_GROUPS||{specialIds:[],qualityIds:[]};
const specialIds=new Set(groups.specialIds),qualityIds=new Set(groups.qualityIds);
const categoryFor=id=>qualityIds.has(id)?"quality":specialIds.has(id)?"special":"standard";
if(bank&&Array.isArray(bank.reactions)){
 const extras=[...(window.CHEM_EXTRA||[]),...(window.CHEM_EXTRA_2||[]),...(window.CHEM_EXTRA_3||[])];
 const merged=new Map();
 for(const card of [...bank.reactions,...extras]){
  const key=card.lhs.replace(/\s+/g,"")+"→"+card.rhs.replace(/\s+/g,"");
  const category=categoryFor(card.id);
  if(!merged.has(key))merged.set(key,{...card,category});
  else {
   const first=merged.get(key);
   if(first.category==="standard"&&category!=="standard")first.category=category;
   if(category==="quality")first.category="quality";
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
if(!["names","reactions","special","quality"].includes(state.mode))state.mode="names";
if(state.mode==="reactions"&&state.topic==="__special__"){state.mode="special";state.topic="all";}
if(!["formula","name"].includes(state.direction))state.direction="formula";
const dataFor=()=>state.mode==="names"?bank.compounds:state.mode==="reactions"?bank.reactions:bank.reactions.filter(x=>x.category===state.mode);
const escapeHTML=s=>String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});
const chem=s=>escapeHTML(s).replace(/([A-Za-z\)\]])(\d+)/g,"$1<sub>$2</sub>");
function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch(_){}}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function topics(){return [...new Set(dataFor().map(x=>x.topic))];}
function selected(){return dataFor().filter(x=>state.topic==="all"||x.topic===state.topic);}
function refreshTopicOptions(){
 const ts=topics();
 if(state.topic!=="all"&&!ts.includes(state.topic))state.topic="all";
 get("topic").innerHTML='<option value="all">Все темы</option>'+ts.map(t=>'<option value="'+escapeHTML(t)+'">'+escapeHTML(t.replace(/^Особые:\s*/,""))+'</option>').join("");
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
function stripEditorialNotes(value){
 return String(value||"")
  .replace(/\s*\(схема пособия\)/gi,"")
  .replace(/[,;]\s*схема пособия/gi,"")
  .replace(/[,;]\s*исправлен коэффициент(?: Cl2 в записи источника)?/gi,"")
  .replace(/[,;]\s*исправлены продукты OCR-таблицы/gi,"")
  .replace(/[,;]\s*пример из пособия/gi,"")
  .replace(/^схема из пособия$/i,"")
  .replace(/[,;]\s*$/,"")
  .trim();
}
function applyReaction(card){
 text(get("front-label"),state.mode==="quality"?"НАЗОВИТЕ ПРОДУКТЫ И ПРИЗНАК РЕАКЦИИ":"НАЗОВИТЕ ПРОДУКТЫ РЕАКЦИИ");
 const a=get("front-main"),b=get("back-main");
 a.className="main-formula react";b.className="equation";
 a.innerHTML=chem(card.lhs)+" <span style='color:#128871'>→ ?</span>";
 b.innerHTML=chem(card.lhs)+' <span class="arrow">→</span> '+chem(card.rhs);
 const visibleCondition=stripEditorialNotes(card.condition);
 get("front-sub").innerHTML=visibleCondition?'<span class="condition">'+escapeHTML(visibleCondition)+'</span>':"";
 // Показываем только химическое пояснение, без ссылок на учебные файлы и редакторских пометок.
 get("back-sub").textContent=stripEditorialNotes(card.explanation);
}
function render(){
 const mode=state.mode;
 for(const value of ["names","reactions","special","quality"]){
  get("tab-"+value).classList.toggle("active",mode===value);
  get("tab-"+value).setAttribute("aria-pressed",String(mode===value));
 }
 get("direction-wrap").hidden=mode!=="names";
 get("direction").value=state.direction;
 get("total-names").textContent=bank.compounds.length;
 get("total-reactions").textContent=bank.reactions.length;
 get("special-count").textContent=bank.reactions.filter(x=>x.category==="special").length;
 get("quality-count").textContent=bank.reactions.filter(x=>x.category==="quality").length;
 const cards=new Map(dataFor().map(c=>[c.id,c]));
 const card=cards.get(state.queue[state.pos]);
 if(!card){text(get("progress-text"),"0 / 0");text(get("deck-label"),"Нет карточек");get("flashcard").hidden=true;return;}
 get("flashcard").hidden=false;
 text(get("badge"),card.topic.replace(/^Особые:\s*/,""));
 text(get("deck-label"),state.topic==="all"?(mode==="special"?"Нестандартные случаи":mode==="quality"?"Признаки реакций":mode==="reactions"?"Все реакции":"Все вещества")+" · "+state.queue.length+" карточек":state.queue.length+" карточек в разделе");
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
get("tab-special").addEventListener("click",()=>setMode("special"));
get("tab-quality").addEventListener("click",()=>setMode("quality"));
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