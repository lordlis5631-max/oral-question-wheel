(function(root){
'use strict';
const CLASSES=['7А','7Г','8А','8Б','8Г'];
const LEVELS={1:'Базовый',2:'Углублённый',3:'Продвинутый'};
const SECTIONS=['Фонетика','Морфемика','Лексикология','Морфология','Синтаксис и пунктуация','Орфография'];
const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const clone=x=>JSON.parse(JSON.stringify(x));
function newSession(config){return {id:uid(),started:new Date().toISOString(),config:clone(config),used:Object.fromEntries(CLASSES.map(c=>[c,[]])),records:[],current:null,finalGrades:{}};}
function initial(){const config={classes:['7А'],levels:[1,2],sections:[...SECTIONS]};return {schema:1,revision:0,config,profiles:Object.fromEntries(CLASSES.map(c=>[c,{}])),students:[],sessions:[newSession(config)],active:0};}
function eligible(q,cls,profiles){const grade=Number(cls[0]);if(!q.eligible_grades.includes(grade))return false;if(q.default_enabled[String(grade)])return true;const gate=grade===7?q.grade7_unlock:q.grade8_unlock;return !!gate&&!!profiles[cls]?.[gate];}
function pool(bank,state,cls){const s=state.sessions[state.active],cfg=state.config;return bank.filter(q=>cfg.levels.includes(q.difficulty)&&cfg.sections.includes(q.section)&&eligible(q,cls,state.profiles)&&!(s.used[cls]||[]).includes(q.id));}
function choose(bank,state,cls,rng=Math.random){const all=pool(bank,state,cls);if(!all.length)return null;const sections=SECTIONS.filter(s=>all.some(q=>q.section===s));const section=sections[Math.floor(rng()*sections.length)];const levels=[1,2,3].filter(l=>all.some(q=>q.section===section&&q.difficulty===l));const level=levels[Math.floor(rng()*levels.length)];const candidates=all.filter(q=>q.section===section&&q.difficulty===level);return candidates[Math.floor(rng()*candidates.length)];}
function begin(bank,state,name,cls,rng){const session=state.sessions[state.active];if(session.current)return session.current;if(!CLASSES.includes(cls)||!state.config.classes.includes(cls))throw Error('Выберите класс занятия.');name=String(name).trim().replace(/\s+/g,' ');if(!name||name.length>80)throw Error('Введите имя ученика — до 80 символов.');const q=choose(bank,state,cls,rng);if(!q)throw Error('Подходящих вопросов не осталось. Измените фильтры или начните новое занятие.');let student=state.students.find(x=>x.cls===cls&&x.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru'));if(!student){student={id:uid(),name,cls};state.students.push(student);}session.used[cls].push(q.id);session.current={id:uid(),studentId:student.id,name:student.name,cls,qid:q.id,revealed:false,asked:new Date().toISOString()};return session.current;}
function finish(state,score){const s=state.sessions[state.active],c=s.current;if(!c)throw Error('Нет текущего вопроса.');if(score!==null&&(!c.revealed||![2,3,4,5].includes(score)))throw Error('Сначала откройте ответ.');if(s.records.some(r=>r.id===c.id))throw Error('Ответ уже сохранён.');const record={...c,score,finished:new Date().toISOString()};s.records.push(record);s.current=null;return record;}
function sortRecords(records,order='class'){
 return [...records].reverse().sort((a,b)=>(order==='class'?CLASSES.indexOf(a.cls)-CLASSES.indexOf(b.cls):0)||Date.parse(b.finished)-Date.parse(a.finished));
}
function removeRecord(state,sessionId,recordId){
 const s=state.sessions.find(x=>x.id===sessionId);if(!s)throw Error('Занятие не найдено.');
 const index=s.records.findIndex(r=>r.id===recordId);if(index<0)throw Error('Запись уже удалена.');
 const [record]=s.records.splice(index,1),key=record.studentId+'|'+record.cls;let finalGrade=null;
 if(!s.records.some(r=>r.studentId===record.studentId&&r.cls===record.cls)&&Object.hasOwn(s.finalGrades,key)){finalGrade=s.finalGrades[key];delete s.finalGrades[key];}
 return {sessionId,record:clone(record),index,finalGrade};
}
function restoreRecord(state,removed){
 const s=state.sessions.find(x=>x.id===removed.sessionId);if(!s)throw Error('Занятие не найдено.');
 if(state.sessions.some(x=>x.records.some(r=>r.id===removed.record.id)))throw Error('Запись уже восстановлена.');
 s.records.splice(Math.min(removed.index,s.records.length),0,clone(removed.record));
 const key=removed.record.studentId+'|'+removed.record.cls;if(removed.finalGrade!==null&&!Object.hasOwn(s.finalGrades,key))s.finalGrades[key]=removed.finalGrade;
}
function summary(records,finalGrades={}){const map=new Map();for(const r of records){const key=r.studentId+'|'+r.cls;if(!map.has(key))map.set(key,{key,name:r.name,cls:r.cls,scores:[],skipped:0});const row=map.get(key);if(r.score===null)row.skipped++;else row.scores.push(r.score);}return [...map.values()].map(x=>({...x,count:x.scores.length,average:x.scores.length?x.scores.reduce((a,b)=>a+b,0)/x.scores.length:null,final:finalGrades[x.key]||null})).sort((a,b)=>a.cls.localeCompare(b.cls,'ru')||a.name.localeCompare(b.name,'ru'));}
function validateBackup(input,bank){
 if(!input||input.schema!==1||!Number.isInteger(input.revision)||input.revision<0||!Array.isArray(input.sessions)||!Array.isArray(input.students)||input.sessions.length>500||input.students.length>5000)throw Error('Неверный формат резервной копии.');
 const ids=new Set(bank.map(q=>q.id)),studentIds=new Set(),sessionIds=new Set(),attemptIds=new Set();
 const str=x=>typeof x==='string'&&x.length>0&&x.length<=200;
 const timestamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
 const validConfig=c=>c&&Array.isArray(c.classes)&&c.classes.length&&c.classes.every(x=>CLASSES.includes(x))&&Array.isArray(c.levels)&&c.levels.length&&c.levels.every(x=>[1,2,3].includes(x))&&Array.isArray(c.sections)&&c.sections.length&&c.sections.every(x=>SECTIONS.includes(x));
 if(!validConfig(input.config)||!Number.isInteger(input.active)||!input.sessions[input.active]||!input.profiles)throw Error('Повреждены настройки копии.');
 for(const c of CLASSES)if(!input.profiles[c]||typeof input.profiles[c]!=='object'||Array.isArray(input.profiles[c]))throw Error('Повреждены настройки класса.');
 for(const st of input.students){if(!str(st.id)||!str(st.name)||!CLASSES.includes(st.cls)||studentIds.has(st.id))throw Error('Повреждён список учеников.');studentIds.add(st.id);}
 let total=0;
 for(const s of input.sessions){
  if(!str(s.id)||sessionIds.has(s.id)||!timestamp(s.started)||!validConfig(s.config)||!s.used||!Array.isArray(s.records)||!s.finalGrades||typeof s.finalGrades!=='object'||Array.isArray(s.finalGrades))throw Error('Повреждено занятие.');
  sessionIds.add(s.id);
  for(const cls of CLASSES)if(!Array.isArray(s.used[cls])||s.used[cls].some(id=>!ids.has(id)))throw Error('Повреждён список вопросов.');
  const checkRecord=(r,current)=>{if(!r||!str(r.id)||attemptIds.has(r.id)||!str(r.name)||!studentIds.has(r.studentId)||!CLASSES.includes(r.cls)||!ids.has(r.qid)||typeof r.revealed!=='boolean'||!timestamp(r.asked)||!s.used[r.cls].includes(r.qid))throw Error('Повреждена запись ответа.');attemptIds.add(r.id);if(!current&&(!timestamp(r.finished)||!Object.hasOwn(r,'score')||(r.score!==null&&(![2,3,4,5].includes(r.score)||!r.revealed))))throw Error('Некорректная оценка или время ответа.');};
  s.records.forEach(r=>checkRecord(r,false));if(s.current)checkRecord(s.current,true);
  if(Object.values(s.finalGrades).some(g=>![2,3,4,5].includes(g)))throw Error('Некорректная итоговая оценка.');total+=s.records.length;
 }
 if(total>100000)throw Error('Слишком большая история.');return clone(input);
}
// Минимальный XLSX без сетевых библиотек. Все тексты записываются как строки, а не формулы.
function xlsx(sheets){const enc=new TextEncoder();const xml=s=>String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));const col=i=>{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;};const files={};files['[Content_Types].xml']='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>';
files['_rels/.rels']='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
files['xl/workbook.xml']='<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets></workbook>';
files['xl/_rels/workbook.xml.rels']='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+'</Relationships>';
sheets.forEach((s,i)=>{files[`xl/worksheets/sheet${i+1}.xml`]='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><sheetData>'+s.rows.map((row,r)=>`<row r="${r+1}">`+row.map((v,c)=>typeof v==='number'?`<c r="${col(c)}${r+1}"><v>${v}</v></c>`:`<c r="${col(c)}${r+1}" t="inlineStr"><is><t xml:space="preserve">${xml(v??'')}</t></is></c>`).join('')+'</row>').join('')+'</sheetData></worksheet>';});
const crc=bytes=>{let v=0xffffffff;for(const b of bytes){v^=b;for(let i=0;i<8;i++)v=(v>>>1)^((v&1)?0xedb88320:0);}return(v^0xffffffff)>>>0;};const chunks=[],central=[];let offset=0,size=0;const header=n=>new DataView(new ArrayBuffer(n));for(const [name,content]of Object.entries(files)){const n=enc.encode(name),b=enc.encode(content),check=crc(b);let h=header(30);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint32(14,check,true);h.setUint32(18,b.length,true);h.setUint32(22,b.length,true);h.setUint16(26,n.length,true);chunks.push(new Uint8Array(h.buffer),n,b);let c=header(46);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint32(16,check,true);c.setUint32(20,b.length,true);c.setUint32(24,b.length,true);c.setUint16(28,n.length,true);c.setUint32(42,offset,true);central.push(new Uint8Array(c.buffer),n);size+=46+n.length;offset+=30+n.length+b.length;}let end=header(22);end.setUint32(0,0x06054b50,true);end.setUint16(8,Object.keys(files).length,true);end.setUint16(10,Object.keys(files).length,true);end.setUint32(12,size,true);end.setUint32(16,offset,true);const result=new Uint8Array(offset+size+22);let p=0;for(const chunk of [...chunks,...central,new Uint8Array(end.buffer)]){result.set(chunk,p);p+=chunk.length;}return result;}
const api={CLASSES,LEVELS,SECTIONS,uid,clone,newSession,initial,eligible,pool,choose,begin,finish,sortRecords,removeRecord,restoreRecord,summary,validateBackup,xlsx};if(typeof module!=='undefined')module.exports=api;else root.WheelCore=api;
})(globalThis);
