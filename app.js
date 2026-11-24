'use strict';
const STATUS=[['registered','تسجيل'],['collected','تم السحب'],['in_lab','في المعمل'],['pending_review','في انتظار المراجعة'],['approved','معتمد'],['delivered','تم التسليم']];
const KEYS=['kind','version','day','timezone','exportedAt','visits','statuses','receipts','expenses','netMovement','undatedPaymentVisits','invalidEntries'];
const OPT=['fictional'];
const DB='nile-summary',ST='summaries';
const $=id=>document.getElementById(id);
function open(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(ST,{keyPath:'day'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function tx(mode,fn){const d=await open();return new Promise((res,rej)=>{const t=d.transaction(ST,mode);const out=fn(t.objectStore(ST));t.oncomplete=()=>res(out&&out.result);t.onerror=()=>rej(t.error)})}
const all=()=>tx('readonly',s=>s.getAll());
const put=o=>tx('readwrite',s=>s.put(o));
const wipe=()=>tx('readwrite',s=>s.clear());
const num=v=>typeof v==='number'&&Number.isFinite(v);
const cnt=v=>Number.isInteger(v)&&v>=0&&v<1e6;
function validate(o){
  if(!o||typeof o!=='object'||Array.isArray(o))throw 'الملف مش ملخص معمل صالح';
  const ks=Object.keys(o);
  for(const k of ks)if(!KEYS.includes(k)&&!OPT.includes(k))throw 'الملف فيه بيانات زيادة مش متوقعة، اترفض عشان الخصوصية: '+k.slice(0,20);
  for(const k of KEYS)if(!(k in o))throw 'الملف ناقص حقل: '+k;
  if(o.kind!=='nile-lab-daily-summary'||o.version!==1)throw 'نوع أو إصدار الملف غير مدعوم';
  if(typeof o.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(o.day))throw 'تاريخ اليوم غير صالح';
  if(o.timezone!=='Africa/Cairo')throw 'المنطقة الزمنية غير متوقعة';
  if(typeof o.exportedAt!=='string'||isNaN(Date.parse(o.exportedAt)))throw 'وقت التصدير غير صالح';
  if(!cnt(o.visits)||!cnt(o.undatedPaymentVisits)||!cnt(o.invalidEntries))throw 'أعداد غير صالحة';
  if(!o.statuses||typeof o.statuses!=='object'||Object.keys(o.statuses).length!==STATUS.length)throw 'الحالات غير صالحة';
  for(const [k] of STATUS)if(!cnt(o.statuses[k]))throw 'حالة غير صالحة: '+k;
  for(const k of ['receipts','expenses','netMovement'])if(!num(o[k])||Math.abs(o[k])>1e9)throw 'مبلغ غير صالح';
  if('fictional' in o&&typeof o.fictional!=='boolean')throw 'علامة غير صالحة';
  return {kind:o.kind,version:1,day:o.day,timezone:o.timezone,exportedAt:o.exportedAt,visits:o.visits,statuses:Object.fromEntries(STATUS.map(([k])=>[k,o.statuses[k]])),receipts:o.receipts,expenses:o.expenses,netMovement:o.netMovement,undatedPaymentVisits:o.undatedPaymentVisits,invalidEntries:o.invalidEntries,fictional:o.fictional===true};
}
const money=v=>v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt=iso=>new Date(iso).toLocaleString('en-GB',{timeZone:'Africa/Cairo',hour12:false});
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let sel=null;
function ageNote(s){const h=(Date.now()-Date.parse(s.exportedAt))/36e5;if(h<0)return '';if(h>=24)return `<div class="warn stale"><b>الملخص ده قديم:</b> اتصدّر من ${Math.floor(h/24)||1} يوم تقريبًا. صدّر ملخص جديد من المعمل.</div>`;return h>=6?`<div class="warn">اتصدّر من حوالي ${Math.floor(h)} ساعات.</div>`:''}
function render(list){
  list.sort((a,b)=>b.day.localeCompare(a.day));
  const s=list.find(x=>x.day===sel)||list[0];
  if(!s){$('view').innerHTML='<div class="card"><h2>مفيش ملخص لسه</h2><p>اضغط "استيراد ملف ملخّص" واختار الملف اللي صدّرته من برنامج المعمل.</p></div>';$('hist').innerHTML='';return}
  sel=s.day;
  $('view').innerHTML=(s.fictional?'<div class="warn demo"><b>بيانات وهمية للتجربة</b>، مش شغل المعمل.</div>':'')+ageNote(s)+
  `<div class="card"><div class="small">يوم</div><div class="money">${esc(s.day)}</div><div class="small">آخر تحديث: ${esc(fmt(s.exportedAt))} بتوقيت القاهرة</div></div>
  <div class="card"><h2>الحالات المسجّلة في اليوم</h2><div class="big">${s.visits}</div><div class="small">عدد الزيارات، مش عدد التحاليل. حالتها وقت التصدير:</div>${STATUS.map(([k,l])=>`<div class="row"><span>${l}</span><b>${s.statuses[k]}</b></div>`).join('')}</div>
  <div class="card"><h2>حركة الفلوس خلال اليوم</h2>
  <div class="row"><span>المحصّل بتاريخ اليوم</span><span class="money">${money(s.receipts)} ج.م</span></div>
  <div class="row"><span>المصروفات بتاريخ اليوم</span><span class="money">${money(s.expenses)} ج.م</span></div>
  <div class="row"><span>صافي الحركة</span><span class="money">${money(s.netMovement)} ج.م</span></div></div>`+
  (s.undatedPaymentVisits>0?`<div class="warn">فيه ${s.undatedPaymentVisits} زيارة قديمة فيها سداد من غير تاريخ، مش محسوبة في المحصّل اليومي.</div>`:'')+
  (s.invalidEntries>0?`<div class="warn">فيه ${s.invalidEntries} حركة غير صالحة اتستبعدت من الحساب.</div>`:'');
  $('hist').innerHTML='<h2>الأيام المحفوظة على الموبايل</h2>'+list.map(x=>`<button class="${x.day===sel?'on':''}" data-d="${esc(x.day)}">${esc(x.day)} · ${x.visits} زيارة · ${money(x.netMovement)} ج.م${x.fictional?' · وهمي':''}</button>`).join('');
  $('hist').querySelectorAll('button').forEach(b=>b.onclick=()=>{sel=b.dataset.d;refresh()});
}
async function refresh(){render(await all())}
function msg(t,bad){$('msg').innerHTML=t?`<div class="warn ${bad?'stale':''}">${esc(t)}</div>`:''}
$('f').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  try{if(f.size>20000)throw 'الملف كبير على ملخص، اترفض';const o=validate(JSON.parse(await f.text()));
    const old=(await all()).find(x=>x.day===o.day);
    if(old&&Date.parse(old.exportedAt)>Date.parse(o.exportedAt))throw 'عندك نسخة أحدث لنفس اليوم، الملف ده اترفض';
    await put(o);sel=o.day;msg('اتستورد ملخص يوم '+o.day);await refresh()}
  catch(x){msg(typeof x==='string'?x:'الملف مش ملخص صالح',true)}};
$('clear').onclick=async()=>{if(confirm('تمسح كل الملخصات المحفوظة على الموبايل؟')){await wipe();sel=null;msg('اتمسحت');await refresh()}};
$('demo').onclick=async()=>{const n=new Date().toISOString();await put({kind:'nile-lab-daily-summary',version:1,day:'2026-11-24',timezone:'Africa/Cairo',exportedAt:n,visits:12,statuses:{registered:2,collected:2,in_lab:2,pending_review:2,approved:2,delivered:2},receipts:1650,expenses:250,netMovement:1400,undatedPaymentVisits:1,invalidEntries:0,fictional:true});sel='2026-11-24';await refresh()};
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
refresh();
