(function(root){
'use strict';
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Split only outside quoted examples and parentheses. Keep every punctuation mark.
function sentences(text){
 text=String(text);const parts=[];let start=0,quotes=0,brackets=0,straight=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='«')quotes++;else if(c==='»')quotes=Math.max(0,quotes-1);else if(c==='"')straight=!straight;
  if(!quotes&&!straight){if(c==='(')brackets++;else if(c===')')brackets=Math.max(0,brackets-1);}
  if(quotes||straight||brackets)continue;
  const tail=text.slice(i+1),next=tail.match(/^\s+([А-ЯЁA-Z«\d])/u);
  const closesExample=c==='»'&&/[.!?]»$/.test(text.slice(0,i+1));
  const punctuation=/[.!?]/.test(c);
  const previousWord=text.slice(start,i).match(/([А-ЯЁа-яёA-Za-z\d]+)$/u)?.[1]||'';
  const abbreviation=c==='.'&&(previousWord.length===1||/^\d+$/.test(previousWord));
  if(next&&(closesExample||(punctuation&&!abbreviation))){const part=text.slice(start,i+1).trim();if(part)parts.push(part);start=i+1;}
 }
 const rest=text.slice(start).trim();if(rest)parts.push(rest);return parts;
}
function layout(text){
 const parts=sentences(text),numbered=/(?:^|\s)\d+[).]\s/.test(String(text));
 return {parts,numbered,list:!numbered&&String(text).length>=180&&parts.length>=3};
}
function emphasize(text){return escape(text).replace(/(^|[\s:;(])((?:составь|замени|объясни|докажи|сравни|сопоставь|назови|выдели|расставь|перестрой|проверь|покажи|исправь|определи|придумай|сохрани|произнеси|расскажи|запиши|подготовь|уточни))(?=[\s,:.!?]|$)/giu,'$1<strong>$2</strong>');}
function rich(text){
 let result='',start=0,quoteStart=-1,depth=0;
 for(let i=0;i<text.length;i++){
  if(text[i]==='«'){if(depth===0)quoteStart=i;depth++;}
  else if(text[i]==='»'&&depth){depth--;if(depth===0){let quoted=text.slice(quoteStart,i+1);if(quoted.length>=34&&/\s/.test(quoted)){
   const punctuation=text.slice(i+1).match(/^[.,;:!?]+/)?.[0]||'';quoted+=punctuation;i+=punctuation.length;
   result+=emphasize(text.slice(start,quoteStart))+`<blockquote class="question-example">${escape(quoted)}</blockquote>`;start=i+1;
  }}}
 }
 return result+emphasize(text.slice(start));
}
function render(text){
 const model=layout(text);if(!model.parts.length)return '';
 if(!model.list)return `<div class="question-content">${model.parts.map(p=>`<div class="question-paragraph">${rich(p)}</div>`).join('')}</div>`;
 return `<div class="question-content"><div class="question-lead">${rich(model.parts[0])}</div><p class="requirements-label">Что нужно сделать</p><ol class="question-requirements">${model.parts.slice(1).map(p=>`<li>${rich(p)}</li>`).join('')}</ol></div>`;
}
const api={sentences,layout,render};if(typeof module!=='undefined')module.exports=api;else root.QuestionView=api;
})(globalThis);
