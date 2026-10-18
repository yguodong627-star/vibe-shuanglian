(()=>{
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=MD.esc,key=MD.key;
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const todayStr=()=>SCHED.dstr(new Date());
const isDaily=n=>/^\d{4}-\d{2}-\d{2}$/.test(n.title);
const WEEK=['日','一','二','三','四','五','六'];
const mobile=()=>matchMedia('(max-width:900px)').matches;
function toast(m,ms=2400){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,ms);}

/* ---------- IndexedDB ---------- */
let db;
const openDB=()=>new Promise((res,rej)=>{const r=indexedDB.open('lianji',1);r.onupgradeneeded=()=>r.result.createObjectStore('notes',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
const txw=fn=>new Promise((res,rej)=>{const t=db.transaction('notes','readwrite');const s=t.objectStore('notes');fn(s);t.oncomplete=res;t.onerror=t.onabort=()=>rej(t.error);});
const dbAll=()=>new Promise((res,rej)=>{const r=db.transaction('notes').objectStore('notes').getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
const dbPut=n=>txw(s=>s.put(strip(n)));const dbDel=id=>txw(s=>s.delete(id));
function strip(n){const o={};for(const k in n)if(k[0]!=='_')o[k]=n[k];return o;}

/* ---------- 状态与派生 ---------- */
let notes=[],byKey=new Map(),byId=new Map(),back=new Map(),tagMap=new Map();
let curId=null,view='notes',mode='split',kind='all',tagF='',q='';
function derive(){
  byKey=new Map();byId=new Map();back=new Map();tagMap=new Map();
  for(const n of notes){byKey.set(key(n.title),n);byId.set(n.id,n);n._links=MD.extractLinks(n.body);n._tags=MD.extractTags(n.body);}
  for(const n of notes){n._out=[];n._ghost=[];
    for(const t of n._links){const tg=byKey.get(key(t));if(tg&&tg!==n){n._out.push(tg.id);(back.get(tg.id)||back.set(tg.id,[]).get(tg.id)).push(n.id);}else if(!tg)n._ghost.push(t);}
    for(const t of n._tags)(tagMap.get(t)||tagMap.set(t,[]).get(t)).push(n.id);}
}
const cur=()=>byId.get(curId)||null;
const wc=s=>{const t=MD.stripCode(s);return (t.match(/[\u3400-\u9fff]/g)||[]).length+(t.replace(/[\u3400-\u9fff]/g,' ').match(/[A-Za-z0-9]+/g)||[]).length;};
const fmtD=t=>{const d=new Date(t);return (d.getMonth()+1)+'月'+d.getDate()+'日 '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
function uniqueTitle(base){let t=base,i=1;while(byKey.has(key(t)))t=base+' '+(++i);return t;}

/* ---------- 搜索 ---------- */
function terms(s){return s.trim().toLowerCase().split(/\s+/).filter(Boolean);}
function searchNotes(s){
  let tg='';const tt=terms(s).filter(t=>{if(t[0]==='#'&&t.length>1){tg=t.slice(1);return false;}return true;});
  const out=[];
  for(const n of notes){
    if(tg&&!n._tags.some(x=>x.toLowerCase()===tg))continue;
    const title=n.title.toLowerCase(),body=n.body.toLowerCase();let sc=0,ok=true;
    for(const t of tt){const a=title.includes(t),b=body.includes(t),c=n._tags.some(x=>x.toLowerCase().includes(t));if(!a&&!b&&!c){ok=false;break;}
      sc+=(a?(title===t?30:10):0)+(c?6:0)+(b?Math.min(5,body.split(t).length-1):0);}
    if(ok)out.push({n,sc});
  }
  return {list:out,terms:tt};
}
function snippet(n,tt){
  const raw=MD.front(n.body).rest.replace(/[#>*`\[\]]/g,'').replace(/\n+/g,' ');
  if(!tt.length)return esc(raw.slice(0,70));
  const low=raw.toLowerCase();let i=-1;for(const t of tt){i=low.indexOf(t);if(i>=0)break;}
  if(i<0)return esc(raw.slice(0,70));
  const s=Math.max(0,i-18),e=Math.min(raw.length,i+60);let seg=esc(raw.slice(s,e));
  for(const t of tt){seg=seg.replace(new RegExp(esc(t).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),m=>'\u0001'+m+'\u0002');}
  return (s>0?'…':'')+seg.replace(/\u0001/g,'<mark>').replace(/\u0002/g,'</mark>');
}

/* ---------- 列表 ---------- */
function visible(){
  let list;let tt=[];
  if(q.trim()||tagF){const r=searchNotes((tagF?'#'+tagF+' ':'')+q);list=r.list.sort((a,b)=>b.sc-a.sc||b.n.updated-a.n.updated).map(x=>x.n);tt=r.terms;}
  else list=[...notes].sort((a,b)=>b.updated-a.updated);
  if(kind==='daily')list=list.filter(isDaily);else if(kind==='note')list=list.filter(n=>!isDaily(n));
  else if(kind==='orphan')list=list.filter(n=>!n._out.length&&!(back.get(n.id)||[]).length&&!n._ghost.length);
  return {list,tt};
}
function renderList(){
  const {list,tt}=visible();const L=$('#list');
  L.innerHTML=list.length?list.map(n=>`<button class="li ${n.id===curId?'on':''}" data-id="${n.id}"><b>${tt.length?esc(n.title):esc(n.title)}</b><span>${snippet(n,tt)||'（空）'}</span><small>${fmtD(n.updated)}${n._tags.slice(0,2).map(t=>'<i>#'+esc(t)+'</i>').join('')}${(back.get(n.id)||[]).length?'<i>↩ '+back.get(n.id).length+'</i>':''}${n.rv?'<i>⟳</i>':''}</small></button>`).join(''):`<div class="nolist">${notes.length?'没有符合条件的笔记。':'还没有笔记。'}</div>`;
  const tags=[...tagMap.entries()].sort((a,b)=>b[1].length-a[1].length).slice(0,14);
  $('#tagbar').innerHTML=tags.map(([t,a])=>`<button class="tg-chip ${t===tagF?'on':''}" data-tag="${esc(t)}">#${esc(t)} ${a.length}</button>`).join('');
  const due=dueList().length;for(const id of ['#dueN','#dueN2']){const e=$(id);e.textContent=due;e.hidden=!due;}
}
$('#list').onclick=e=>{const b=e.target.closest('.li');if(b)openNote(b.dataset.id);};
$('#tagbar').onclick=e=>{const b=e.target.closest('[data-tag]');if(!b)return;tagF=tagF===b.dataset.tag?'':b.dataset.tag;renderList();};
$('#kinds').onclick=e=>{const b=e.target.closest('[data-k]');if(!b)return;kind=b.dataset.k;$$('#kinds button').forEach(x=>x.classList.toggle('on',x===b));renderList();};
$('#q').addEventListener('input',e=>{q=e.target.value;renderList();});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setView('notes');setPane('list');$('#q').focus();$('#q').select();}});

/* ---------- 视图切换 ---------- */
function railFlag(){document.body.dataset.rail=(view==='notes'&&cur())?'1':'0';}
function setView(v){view=v;document.body.dataset.view=v;
  $$('.v').forEach(x=>x.classList.toggle('on',x.id==='v-'+v));
  $$('[data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===v));
  railFlag();
  if(v==='graph'){requestAnimationFrame(()=>{G.resize();buildGraph();});}
  if(v==='review')renderReview();
  if(v==='backup')renderStorage();
}
function setPane(p){document.body.dataset.pane=p;}
$$('[data-view]').forEach(b=>b.onclick=()=>{setView(b.dataset.view);if(b.dataset.view==='notes'&&!curId)setPane('list');});
$('#btnBack').onclick=()=>{setPane('list');};
function setMode(m){mode=m;document.body.dataset.mode=m;$('#panes').dataset.m=m;$$('#modeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));if(m==='view'||m==='split')renderPreview();}
$('#modeSeg').onclick=e=>{const b=e.target.closest('[data-m]');if(b)setMode(b.dataset.m);};

/* ---------- 打开 / 新建 / 日记 ---------- */
function openNote(id,opts={}){
  const n=byId.get(id);if(!n)return;curId=id;setView('notes');setPane('edit');
  $('#emptyNote').hidden=true;$('#editor').hidden=false;
  $('#ttl').value=n.title;$('#body').value=n.body;
  if(mobile()&&(mode==='split'||mode==='links'))setMode('edit');else if(!mobile()&&mode==='links')setMode('split');else setMode(mode);
  if(mobile()&&opts.view)setMode('view');
  renderPreview();renderRail();renderList();updateMeta();
  railFlag();
  history.replaceState(null,'','#'+encodeURIComponent(n.title));
  if(G&&view==='graph')G.setCurrent(id);
}
async function createNote(title,body='',open=true){
  const now=Date.now();const n={id:uid(),title,body,created:now,updated:now,rv:null};
  notes.push(n);derive();await dbPut(n);renderList();if(open)openNote(n.id);return n;
}
$('#btnNew').onclick=async()=>{const n=await createNote(uniqueTitle('未命名笔记'),'');setMode(mobile()?'edit':'split');const t=$('#ttl');t.focus();t.select();};
async function openDaily(date){
  date=date||todayStr();let n=byKey.get(key(date));
  if(!n){const [y,m,d]=date.split('-').map(Number);const w=WEEK[new Date(y,m-1,d).getDay()];
    n=await createNote(date,`# ${date} 星期${w}\n\n#日记\n\n## 今天做了什么\n\n- \n\n## 想记下的\n\n- \n`,false);}
  openNote(n.id);
  setMode(mobile()?'edit':'split');
}
$('#btnDaily').onclick=()=>openDaily();

/* ---------- 编辑与自动保存 ---------- */
let saveT=null;
function markDirty(){const n=cur();if(!n)return;n.updated=Date.now();$('#saved').textContent='保存中…';clearTimeout(saveT);saveT=setTimeout(flush,500);}
async function flush(){const n=cur();if(!n)return;clearTimeout(saveT);saveT=null;try{await dbPut(n);$('#saved').textContent='已保存';}catch(e){$('#saved').textContent='保存失败';toast('保存失败：'+e.message);}}
window.addEventListener('beforeunload',()=>{if(saveT)flush();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&saveT)flush();});
let derT=null;
$('#body').addEventListener('input',e=>{const n=cur();if(!n)return;n.body=e.target.value;markDirty();updateMeta();
  clearTimeout(derT);derT=setTimeout(()=>{derive();renderPreview();renderRail();renderList();if(view==='graph')buildGraph(true);},250);acCheck();});
function updateMeta(){const n=cur();if(!n)return;$('#meta').textContent=n.body.length?wc(n.body)+' 字 · 创建 '+fmtD(n.created):'新笔记';}
/* 标题改名（含同步改写别处的 [[旧标题]]） */
$('#ttl').addEventListener('change',async e=>{
  const n=cur();if(!n)return;const nt=e.target.value.trim();const old=n.title;
  if(!nt){e.target.value=old;return toast('标题不能为空');}
  if(nt===old)return;
  const dup=byKey.get(key(nt));if(dup&&dup!==n){e.target.value=old;return toast('已有同名笔记「'+nt+'」，请换一个标题');}
  if(/[\[\]|#]/.test(nt)){e.target.value=old;return toast('标题不能包含 [ ] | #');}
  const linkers=notes.filter(m=>m!==n&&m._links.some(t=>key(t)===key(old)));
  let rewrite=false;if(linkers.length)rewrite=confirm(`有 ${linkers.length} 篇笔记链接了「${old}」。\n点“确定”：把它们里面的 [[${old}]] 同步改成 [[${nt}]]；\n点“取消”：只改本篇标题（那些链接会变成未创建的链接）。`);
  n.title=nt;n.updated=Date.now();
  if(rewrite){const re=new RegExp('\\[\\['+old.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=(#[^\\]|]*)?(\\|[^\\]]*)?\\]\\])','gi');
    for(const m of linkers){const nb=m.body.replace(re,'[['+nt);if(nb!==m.body){m.body=nb;m.updated=Date.now();await dbPut(m);}}}
  derive();await dbPut(n);renderList();renderRail();renderPreview();toast(rewrite?'已改名并同步 '+linkers.length+' 篇的链接':'已改名');history.replaceState(null,'','#'+encodeURIComponent(nt));
});
$('#ttl').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.target.blur();$('#body').focus();}});

/* 工具栏插入 */
$('#tb').onclick=e=>{const b=e.target.closest('button');if(!b)return;const ta=$('#body');const s=ta.selectionStart,en=ta.selectionEnd,v=ta.value;
  if(b.dataset.ins){const [a,c]=b.dataset.ins.split('|');const sel=v.slice(s,en);const ins=a+(sel||'')+(c||'');ta.setRangeText(ins,s,en,'end');if(!sel&&c)ta.setSelectionRange(s+a.length,s+a.length);}
  else if(b.dataset.line){const ls=v.lastIndexOf('\n',s-1)+1;ta.setRangeText(b.dataset.line,ls,ls,'preserve');ta.setSelectionRange(s+b.dataset.line.length,en+b.dataset.line.length);}
  ta.focus();ta.dispatchEvent(new Event('input'));};
/* [[ 自动补全 */
let acIdx=0,acItems=[];
function acCheck(){
  const ta=$('#body');const pos=ta.selectionStart;const before=ta.value.slice(0,pos);const m=/\[\[([^\[\]\n|#]*)$/.exec(before);
  if(!m){$('#ac').hidden=true;return;}
  const qq=m[1].trim().toLowerCase();const c=cur();
  acItems=notes.filter(n=>n!==c&&(!qq||n.title.toLowerCase().includes(qq))).sort((a,b)=>b.updated-a.updated).slice(0,7).map(n=>({t:n.title,new:false}));
  if(qq&&!byKey.has(qq))acItems.push({t:m[1].trim(),new:true});
  if(!acItems.length){$('#ac').hidden=true;return;}
  acIdx=Math.min(acIdx,acItems.length-1);renderAc(m[0].length);
}
function renderAc(len){const a=$('#ac');a.hidden=false;a.dataset.len=len;a.innerHTML=acItems.map((x,i)=>`<button data-i="${i}" class="${i===acIdx?'on':''}">${esc(x.t)}${x.new?'<small>新建并链接</small>':''}</button>`).join('');}
function acPick(i){const x=acItems[i];if(!x)return;const ta=$('#body');const pos=ta.selectionStart;const len=+$('#ac').dataset.len;const after=ta.value.slice(pos);const close=after.startsWith(']]')?2:0;
  ta.setRangeText(x.t+']]',pos-len+2,pos+close,'end');$('#ac').hidden=true;ta.focus();ta.dispatchEvent(new Event('input'));
  if(x.new&&!byKey.has(key(x.t)))toast('「'+x.t+'」尚未创建，预览里点击即可新建');}
$('#ac').onmousedown=e=>{const b=e.target.closest('[data-i]');if(b){e.preventDefault();acPick(+b.dataset.i);}};
$('#body').addEventListener('keydown',e=>{const a=$('#ac');if(a.hidden)return;
  if(e.key==='ArrowDown'){e.preventDefault();acIdx=(acIdx+1)%acItems.length;renderAc(+a.dataset.len);}
  else if(e.key==='ArrowUp'){e.preventDefault();acIdx=(acIdx-1+acItems.length)%acItems.length;renderAc(+a.dataset.len);}
  else if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();acPick(acIdx);}
  else if(e.key==='Escape'){a.hidden=true;}});
$('#body').addEventListener('blur',()=>setTimeout(()=>$('#ac').hidden=true,150));

/* ---------- 预览 ---------- */
const ctx={exists:t=>byKey.has(key(t))};
function renderPreview(){const n=cur();if(!n||mode==='edit'&&!mobile()&&false)return;$('#prev').innerHTML=MD.render(n.body,ctx)||'<p style="color:var(--mute)">（空白笔记）</p>';}
async function followLink(title){const ex=byKey.get(key(title));if(ex)return openNote(ex.id,{view:mobile()});
  const n=await createNote(title,'',true);toast('已新建「'+title+'」');setMode(mobile()?'edit':'split');}
function mdClicks(el){el.addEventListener('click',e=>{
  const w=e.target.closest('[data-wl]');if(w){e.preventDefault();followLink(w.dataset.wl);return;}
  const t=e.target.closest('[data-tag]');if(t){e.preventDefault();tagF=t.dataset.tag;setView('notes');setPane('list');renderList();return;}
  const cb=e.target.closest('input[data-task]');if(cb){const n=cur();const ln=+cb.dataset.task;const ls=n.body.replace(/\r\n?/g,'\n').split('\n');
    ls[ln]=ls[ln].replace(/\[( |x|X)\]/,cb.checked?'[x]':'[ ]');n.body=ls.join('\n');$('#body').value=n.body;markDirty();derive();renderPreview();}});}
mdClicks($('#prev'));

/* ---------- 右栏：反向链接等 ---------- */
function ctxLine(n,title){const re=new RegExp('\\[\\['+title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:#[^\\]|]*)?(?:\\|[^\\]]*)?\\]\\]','i');
  const line=n.body.split('\n').find(l=>re.test(l))||'';return line.replace(/`/g,'').replace(/^[\s#>\-*\d.]+/,'').replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g,(m,a,b)=>b||a).slice(0,90);}
function unlinked(n){if(n.title.length<2)return [];const t=n.title.toLowerCase();const linked=new Set(back.get(n.id)||[]);
  return notes.filter(m=>m!==n&&!linked.has(m.id)&&MD.stripCode(m.body).toLowerCase().includes(t)).slice(0,6);}
function renderRail(){
  const n=cur();const R=$('#railIn');
  if(!n){R.innerHTML='<div class="rail-empty">打开一篇笔记后，这里显示它的反向链接、出链、标签与复习状态。</div>';return;}
  const bl=(back.get(n.id)||[]).map(id=>byId.get(id)).filter(Boolean);
  const out=n._out.map(id=>byId.get(id)),ghost=[...new Set(n._ghost)];
  const um=unlinked(n);
  const rv=n.rv;
  R.innerHTML=`<button class="rail-back" id="railBack">‹ 返回笔记</button>
  <div class="rs"><h4>此笔记</h4><div class="stat"><span>字数</span><b>${wc(n.body)}</b><span>修改</span><b>${fmtD(n.updated)}</b><span>出链 / 反链</span><b>${out.length+ghost.length} / ${bl.length}</b></div></div>
  <div class="rs"><h4>反向链接<em>${bl.length}</em></h4>${bl.length?bl.map(m=>`<a data-id="${m.id}"><b>${esc(m.title)}</b><small>${esc(ctxLine(m,n.title))}</small></a>`).join(''):'<div class="none">还没有笔记链接到这里。在别的笔记里写 [['+esc(n.title)+']] 即可。</div>'}</div>
  <div class="rs"><h4>出链<em>${out.length+ghost.length}</em></h4>${out.map(m=>`<a data-id="${m.id}"><b>${esc(m.title)}</b></a>`).join('')}${ghost.map(t=>`<a class="gh" data-new="${esc(t)}"><b>${esc(t)}</b><small>未创建 · 点击新建</small></a>`).join('')}${out.length+ghost.length?'':'<div class="none">本篇没有 [[双链]]。</div>'}</div>
  <div class="rs"><h4>未链接的提及<em>${um.length}</em></h4>${um.length?um.map(m=>`<a data-id="${m.id}"><b>${esc(m.title)}</b><small>正文提到了“${esc(n.title)}”但没加 [[ ]]</small></a>`).join(''):'<div class="none">没有发现。</div>'}</div>
  <div class="rs"><h4>标签</h4>${n._tags.length?'<div class="tags">'+n._tags.map(t=>`<a data-tag="${esc(t)}">#${esc(t)} · ${(tagMap.get(t)||[]).length}</a>`).join('')+'</div>':'<div class="none">正文里写 #标签 即可（如 #读书）。</div>'}</div>
  <div class="rs"><h4>间隔复习</h4>${rv?`<div class="stat"><span>下次复习</span><b>${dueLabel(rv.due)}</b><span>间隔 / 熟悉度</span><b>${rv.interval} 天 / ${rv.ease}</b><span>已复习 / 遗忘</span><b>${rv.reps} / ${rv.lapses}</b></div><div class="row-b"><button class="pill glass" id="rvOff">移出复习</button></div>`:'<div class="none">把这篇加入复习清单，按“忘了/模糊/记得/简单”自动安排下次时间。用 ==挖空== 可制作填空卡。</div><div class="row-b"><button class="pill glass" id="rvOn">加入复习</button></div>'}</div>
  <div class="rs"><h4>操作</h4><div class="row-b"><button class="pill glass" id="dlMd">下载本篇 .md</button><button class="pill danger" id="delNote">删除</button></div></div>`;
}
$('#railIn').onclick=async e=>{
  const n=cur();
  if(e.target.id==='railBack'){setMode('edit');return;}
  const a=e.target.closest('[data-id]');if(a){openNote(a.dataset.id);return;}
  const g=e.target.closest('[data-new]');if(g){followLink(g.dataset.new);return;}
  const t=e.target.closest('[data-tag]');if(t){tagF=t.dataset.tag;setView('notes');setPane('list');renderList();return;}
  if(!n)return;
  if(e.target.id==='rvOn'){n.rv=SCHED.fresh(todayStr());await dbPut(n);renderRail();renderList();toast('已加入复习，今天就会出现');}
  if(e.target.id==='rvOff'){n.rv=null;await dbPut(n);renderRail();renderList();}
  if(e.target.id==='dlMd'){dl(new Blob([toMd(n)],{type:'text/markdown'}),fname(n.title)+'.md');}
  if(e.target.id==='delNote'){if(!confirm('删除「'+n.title+'」？不可撤销（建议先导出备份）。其他笔记里指向它的链接会变成未创建的链接。'))return;
    await dbDel(n.id);notes=notes.filter(x=>x!==n);curId=null;derive();$('#editor').hidden=true;$('#emptyNote').hidden=false;setPane('list');renderList();renderRail();railFlag();toast('已删除');}
};
function dueLabel(d){const x=SCHED.diffDays(d,todayStr());return x<0?'逾期 '+(-x)+' 天':x===0?'今天':x===1?'明天':x+' 天后（'+d.slice(5)+'）';}

/* ---------- 图谱 ---------- */
let G=null,gMode='link';
function buildGraph(keep){
  const local=$('#gLocal').checked,ghosts=$('#gGhost').checked;let nodes=[],edges=[];const c=cur();
  if(gMode==='link'){
    const ns=new Map();notes.forEach(n=>ns.set(n.id,{id:n.id,label:n.title,type:isDaily(n)?'daily':'note'}));
    const ed=[];
    for(const n of notes){for(const id of n._out)ed.push([n.id,id]);if(ghosts)for(const t of new Set(n._ghost)){const gid='g:'+key(t);if(!ns.has(gid))ns.set(gid,{id:gid,label:t,type:'ghost'});ed.push([n.id,gid]);}}
    let keepSet=null;
    if(local&&c){keepSet=new Set([c.id]);for(let d=0;d<2;d++){for(const [a,b] of ed){if(keepSet.has(a)||keepSet.has(b)){keepSet.add(a);keepSet.add(b);}}}}
    nodes=[...ns.values()].filter(x=>!keepSet||keepSet.has(x.id));const ids=new Set(nodes.map(x=>x.id));edges=ed.filter(([a,b])=>ids.has(a)&&ids.has(b));
    $('#gLeg').innerHTML='<span><i style="background:#dfe9ef"></i>笔记</span><span><i style="background:#8fb4c8"></i>日记</span><span><i style="border:1.3px dashed #8aa0ab"></i>未创建</span><span>点击打开 · 拖动节点 · 滚轮/双指缩放</span>';
  }else{
    const ns=new Map(),ed=[];
    for(const n of notes){if(!n._tags.length)continue;ns.set(n.id,{id:n.id,label:n.title,type:isDaily(n)?'daily':'note'});for(const t of n._tags){const tid='t:'+t;if(!ns.has(tid))ns.set(tid,{id:tid,label:t,type:'tag'});ed.push([n.id,tid]);}}
    let keepSet=null;if(local&&c&&c._tags.length){keepSet=new Set([c.id]);c._tags.forEach(t=>keepSet.add('t:'+t));for(const [a,b] of ed)if(keepSet.has(b))keepSet.add(a);}
    nodes=[...ns.values()].filter(x=>!keepSet||keepSet.has(x.id));const ids=new Set(nodes.map(x=>x.id));edges=ed.filter(([a,b])=>ids.has(a)&&ids.has(b));
    $('#gLeg').innerHTML='<span><i style="background:#39718b"></i>标签</span><span><i style="background:#dfe9ef"></i>笔记</span><span>只显示带标签的笔记</span>';
  }
  G.setData(nodes,edges,keep);G.setCurrent(curId);
  if(!nodes.length){G.draw();const x=G.ctx;x.fillStyle='#b0c2cc';x.font='15px sans-serif';x.textAlign='center';x.fillText(gMode==='link'?'还没有双链。在笔记里写双链 [[另一篇笔记]] 就会出现连线。':'还没有标签。在正文里写 #标签 就会出现。',G.w/2,G.h/2);}
}
$('#gMode').onclick=e=>{const b=e.target.closest('[data-g]');if(!b)return;gMode=b.dataset.g;$$('#gMode button').forEach(x=>x.classList.toggle('on',x===b));buildGraph();};
$('#gLocal').onchange=()=>buildGraph();$('#gGhost').onchange=()=>buildGraph();$('#gReset').onclick=()=>{G.reset();};
async function graphOpen(n){
  if(n.type==='tag'){tagF=n.label;setView('notes');setPane('list');renderList();return;}
  if(n.type==='ghost'){await followLink(n.label);return;}
  openNote(n.id);
}

/* ---------- 复习 ---------- */
const dueList=()=>notes.filter(n=>n.rv&&n.rv.due<=todayStr()).sort((a,b)=>a.rv.due.localeCompare(b.rv.due));
let session=[],showAns=false;
const GR=[[1,'忘了'],[2,'模糊'],[3,'记得'],[4,'简单']];
function renderReview(){
  const due=dueList();const all=notes.filter(n=>n.rv);
  $('#rvNum').textContent=due.length;
  $('#rvSub').textContent=all.length?`清单共 ${all.length} 篇。先回忆，再翻开，最后诚实打分——打分决定下次出现的时间。`:'清单是空的：打开一篇笔记，在右栏点“加入复习”。';
  if(!session.length||session.some(id=>!byId.get(id)))session=due.map(n=>n.id);
  const curN=byId.get(session[0]);
  const card=$('#rvCard');
  if(!all.length){card.innerHTML='<div class="rv-done"><h2>还没有复习内容</h2><p>在“笔记”里打开一篇，右栏点“加入复习”。<br>正文里用 <code>==关键词==</code> 标出要记住的词，复习时会被遮住。</p></div>';}
  else if(!curN){card.innerHTML='<div class="rv-done"><h2>今天的都复习完了</h2><p>下一篇：'+(all.filter(n=>n.rv.due>todayStr()).sort((a,b)=>a.rv.due.localeCompare(b.rv.due))[0]?dueLabel(all.filter(n=>n.rv.due>todayStr()).sort((a,b)=>a.rv.due.localeCompare(b.rv.due))[0].rv.due):'—')+'</p></div>';}
  else{
    const hasCloze=/==[^=\n]+==/.test(curN.body);const html=MD.render(MD.front(curN.body).rest.replace(/^\s*#\s+[^\n]*\n/,''),ctx);
    const prog=`第 ${Math.max(1,due.length-session.length+1)} / ${due.length}`;
    card.innerHTML=`<div class="eyebrow">${prog} · ${hasCloze?'填空卡（==挖空==）':'整篇回忆'}</div><h2>${esc(curN.title)}</h2>
    <div class="rv-md md" id="rvMd">${showAns||!hasCloze&&showAns?html:(hasCloze?html.replace(/<mark class="cloze">/g,'<mark class="cloze hide">'):'<p style="color:var(--mute)">先在脑子里回忆这篇的要点，再点“显示答案”。</p>')}</div>
    ${showAns?`<div class="grades">${GR.map(([g,l])=>`<button data-g="${g}"><b>${l}</b><small>${nextLabel(curN,g)}</small></button>`).join('')}</div>`:`<button class="pill ink reveal" id="rvShow">显示答案</button>`}
    <div style="margin-top:14px"><button class="link" id="rvOpen" style="background:none;border:0;color:var(--focus);cursor:pointer;text-decoration:underline">打开这篇笔记</button></div>`;
  }
  const L=all.sort((a,b)=>a.rv.due.localeCompare(b.rv.due));
  $('#rvList').innerHTML=L.length?L.map(n=>`<button data-id="${n.id}"><b style="font-weight:500">${esc(n.title)}</b><span class="${n.rv.due<todayStr()?'od':''}">${dueLabel(n.rv.due)} · ${n.rv.interval}天</span></button>`).join(''):'<div style="color:var(--mute);padding:10px 0">—</div>';
  renderList();
}
function nextLabel(n,g){const r=SCHED.next(n.rv,g,todayStr());return r.interval+' 天后';}
$('#rvCard').onclick=async e=>{
  if(e.target.id==='rvShow'){showAns=true;renderReview();return;}
  if(e.target.id==='rvOpen'){openNote(session[0]);return;}
  const m=e.target.closest('mark.cloze.hide');if(m){m.classList.remove('hide');return;}
  const gb=e.target.closest('[data-g]');if(gb){const id=session.shift();const n=byId.get(id);const g=+gb.dataset.g;n.rv=SCHED.next(n.rv,g,todayStr());await dbPut(n);
    if(g===1)session.push(id);showAns=false;renderReview();}
};
$('#rvList').onclick=e=>{const b=e.target.closest('[data-id]');if(b)openNote(b.dataset.id);};
$('#rules').innerHTML=[['新笔记','加入后今天到期。'],['忘了','回到“0 次”，明天再看，熟悉度 −0.20（最低 1.30），本次会话稍后再出现一次。'],['模糊','间隔 ×1.2（至少 1 天），熟悉度 −0.15。'],['记得','第 1 次 → 1 天；第 2 次 → 3 天；之后 间隔 × 熟悉度（初始 2.30）。'],['简单','第 1 次 → 3 天；第 2 次 → 7 天；之后 间隔 × 熟悉度 × 1.3，熟悉度 +0.15。'],['上限','单次间隔最长 365 天。按你本机的日期计算。']].map(([a,b])=>`<div><b>${a}</b><span>${b}</span></div>`).join('');

/* ---------- 导出 / 导入 ---------- */
function dl(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},4000);}
const fname=t=>t.replace(/[\\\/:*?"<>|]/g,'_').replace(/\s+$/,'').slice(0,100)||'未命名';
const iso=t=>new Date(t).toISOString();
function toMd(n){return `---\ntitle: ${JSON.stringify(n.title)}\ncreated: ${iso(n.created)}\nupdated: ${iso(n.updated)}\n---\n\n${n.body}\n`;}
$('#exZip').onclick=async()=>{
  if(!notes.length)return toast('还没有笔记');await flush();
  const files=[{name:'README.txt',data:'由「链记」导出。每个 .md 是一篇笔记，[[双链]] 与 #标签 原样保留，可直接用 Obsidian / Logseq 等打开。\n导出时间：'+new Date().toLocaleString('zh-CN')+'\n笔记数：'+notes.length+'\n'}];
  for(const n of notes)files.push({name:(isDaily(n)?'日记/':'笔记/')+fname(n.title)+'.md',data:toMd(n)});
  dl(await MiniZip.makeZip(files),'链记_Markdown_'+todayStr()+'.zip');toast('已导出 '+notes.length+' 篇');
};
$('#exJson').onclick=async()=>{await flush();if(!notes.length)return toast('还没有笔记');
  dl(new Blob([JSON.stringify({app:'lianji',version:1,exportedAt:iso(Date.now()),notes:notes.map(strip)},null,1)],{type:'application/json'}),'链记备份_'+todayStr()+'.json');toast('已导出 JSON 备份');};
$('#imp').onclick=()=>$('#impFile').click();
function parseMd(text,fallback){
  let title=fallback,created=null,updated=null,body=text.replace(/\r\n?/g,'\n');
  const m=/^---\n([\s\S]*?)\n---\n?/.exec(body);
  if(m){const meta=m[1];const g=k=>{const r=new RegExp('^'+k+':\\s*(.*)$','m').exec(meta);if(!r)return null;let v=r[1].trim();try{v=JSON.parse(v);}catch(e){v=v.replace(/^["']|["']$/g,'');}return v;};
    const t=g('title');if(t)title=String(t);const c=Date.parse(g('created'));if(c)created=c;const u=Date.parse(g('updated'));if(u)updated=u;body=body.slice(m[0].length).replace(/^\n/,'');}
  return {title:title.replace(/[\[\]|#]/g,'').trim()||fallback,body:body.replace(/\n+$/,'\n'),created,updated};
}
$('#impFile').onchange=async e=>{
  const fs=[...e.target.files];e.target.value='';let add=0,upd=0,skip=0,ren=0;const items=[];
  try{
    for(const f of fs){
      if(/\.json$/i.test(f.name)){const j=JSON.parse(await f.text());if(j.app!=='lianji'||!Array.isArray(j.notes))throw new Error(f.name+' 不是链记的备份文件');j.notes.forEach(n=>items.push({json:true,n}));}
      else if(/\.zip$/i.test(f.name)){const es=await MiniZip.readZip(f);for(const en of es){if(/\.(md|markdown|txt)$/i.test(en.name)&&!/(^|\/)README/i.test(en.name)){items.push({md:new TextDecoder().decode(en.data),name:en.name.split('/').pop().replace(/\.[^.]+$/,'')});}}}
      else if(/\.(md|markdown|txt)$/i.test(f.name)){items.push({md:await f.text(),name:f.name.replace(/\.[^.]+$/,'')});}
      else toast('已忽略：'+f.name);
    }
    for(const it of items){
      let n;if(it.json){n={...it.n};if(!n.id||!n.title)continue;
        const ex=byId.get(n.id);if(ex){if((n.updated||0)>ex.updated){Object.assign(ex,n);await dbPut(ex);upd++;derive();}else skip++;continue;}}
      else{const p=parseMd(it.md,it.name);n={id:uid(),title:p.title,body:p.body,created:p.created||Date.now(),updated:p.updated||Date.now(),rv:null};}
      const same=byKey.get(key(n.title));
      if(same){if(same.body.trim()===n.body.trim()){skip++;continue;}n.title=uniqueTitle(n.title+' (导入)');ren++;}
      if(!n.id||byId.has(n.id))n.id=uid();
      n.created=n.created||Date.now();n.updated=n.updated||Date.now();n.rv=n.rv||null;
      notes.push(n);derive();await dbPut(n);add++;
    }
    derive();renderList();renderRail();if(view==='graph')buildGraph();
    toast(`导入完成：新增 ${add}，更新 ${upd}，跳过 ${skip}${ren?'，其中 '+ren+' 篇因重名改名':''}`,4200);
  }catch(err){alert('导入失败：'+err.message);}
};
async function renderStorage(){try{const e=await navigator.storage.estimate();const p=navigator.storage.persisted?await navigator.storage.persisted():false;
  $('#storeInfo').textContent=`共 ${notes.length} 篇笔记，本站占用约 ${(e.usage/1024).toFixed(0)} KB。持久存储：${p?'已授予':'未授予（浏览器空间紧张时可能清理本站数据）'}。`;}catch(e){$('#storeInfo').textContent='共 '+notes.length+' 篇笔记。当前浏览器不提供存储用量。';}}
$('#persist').onclick=async()=>{try{toast(await navigator.storage.persist()?'已授予持久存储':'浏览器未授予');renderStorage();}catch(e){toast('当前浏览器不支持');}};
$('#wipe').onclick=async()=>{if(!confirm('删除本站保存的全部笔记，不可撤销。建议先导出备份。继续？'))return;if(prompt('请输入“清空”确认')!=='清空')return;
  await txw(s=>s.clear());notes=[];curId=null;derive();$('#editor').hidden=true;$('#emptyNote').hidden=false;renderList();renderRail();railFlag();toast('已清空');renderStorage();};
$('#limits').innerHTML=[
['数据在哪','全部在本浏览器的 IndexedDB 里，不上传、无账号、无统计。清理站点数据/隐私模式/换设备会丢，请用“导出”。多个标签页同时编辑同一篇，后保存的会覆盖先保存的（没有冲突合并）。'],
['双链规则','[[标题]] 按“标题”精确匹配（忽略大小写）。支持 [[标题|显示文字]] 与 [[标题#小节]]（小节只是显示，不做跳转）。标题不能含 [ ] | #。改名时可同步改写其他笔记里的链接。'],
['标签规则','正文里 #标签（# 后紧跟文字、前面是空白或标点）即标签；纯数字不算；代码块与行内代码里的不算。标题行 “# 标题”（# 后有空格）不是标签。'],
['Markdown','自写的轻量渲染：标题、粗斜体、删除线、行内/块代码、引用、有序/无序/嵌套列表、待办（预览里可勾选）、表格、分割线、链接。不支持图片、HTML、脚注、数学公式、Mermaid；为了安全，原始 HTML 会被转义显示。'],
['图谱','Canvas 自绘力导向布局，几百篇以内流畅；上千篇会变慢。布局是示意性的，位置不代表语义。'],
['复习','SM-2 的简化版（规则见复习页），不同于 Anki 的 FSRS 等新算法，没有学习阶段/按卡片分钟级重学。'],
['移动端','手机上列表/编辑/预览/链接分页切换；[[ 补全在手机输入法下可用，但不跟随光标位置显示。'],
['免费','没有付费版、授权码、数量/容量限制（受浏览器存储配额约束）。']
].map(([a,b])=>`<div><b>${a}</b><span>${b}</span></div>`).join('');

/* ---------- 首次示例 ---------- */
async function seed(){
  if(localStorage.getItem('lianji.seeded'))return;localStorage.setItem('lianji.seeded','1');
  const now=Date.now();const T=todayStr();const mk=(title,body,rv)=>({id:uid(),title,body,created:now,updated:now-Math.floor(Math.random()*3e6),rv:rv||null});
  const arr=[
   mk('欢迎使用链记',`# 欢迎使用链记\n\n#入门\n\n这是一个**只存在你浏览器里**的笔记本。几个要点：\n\n- 在正文里连续输入两个左方括号，会弹出补全，选一篇就建立了双链，比如 [[双链是什么]]；右边栏会显示“反向链接”。\n- 写 #标签 归类（试试点上面的 #入门）。\n- 用 ==挖空== 标出要记住的词，再去 [[间隔复习怎么用]]。\n- 点左下“图谱”，看笔记之间的连线。\n- 想带走数据：“备份”页导出 Markdown ZIP 或 JSON。\n\n- [ ] 删掉这三篇示例笔记，开始写你自己的\n`),
   mk('双链是什么',`# 双链是什么\n\n#入门 #方法\n\n双链（bidirectional link）指：A 里写了 [[欢迎使用链记]]，那么在“欢迎使用链记”里也能看到“A 链接过来”（**反向链接**）。\n\n好处：不用先想好放哪个文件夹，**先写，再用链接把想法连起来**。\n\n关键概念：==反向链接== 让你从被引用的笔记回看所有引用它的地方。\n`,SCHED.fresh(T)),
   mk('间隔复习怎么用',`# 间隔复习怎么用\n\n#入门 #方法\n\n1. 打开笔记，右栏点 **加入复习**。\n2. 到“复习”页，先回忆，再点“显示答案”。\n3. 诚实打分：忘了 / 模糊 / 记得 / 简单。\n\n间隔的核心：每次“记得”，下次间隔变长；==忘了== 就从头开始。规则全部公开，写在复习页右侧。\n\n相关：[[双链是什么]]\n`)
  ];
  const [y,m,d]=T.split('-').map(Number);const w=WEEK[new Date(y,m-1,d).getDay()];
  arr.push(mk(T,`# ${T} 星期${w}\n\n#日记\n\n## 今天做了什么\n\n- 试用了 [[欢迎使用链记]]\n\n## 想记下的\n\n- \n`));
  for(const n of arr){notes.push(n);await dbPut(n);}
}

/* ---------- 启动 ---------- */
(async()=>{
  try{db=await openDB();notes=await dbAll();}catch(e){alert('无法打开浏览器本地数据库：'+e.message+'\n（隐私模式下可能不可用）');}
  if(db)await seed();
  derive();
  G=new Graph($('#cv'),{onOpen:graphOpen,onHover:(n,x,y)=>{const t=$('#gTip');if(!n){t.hidden=true;return;}t.hidden=false;t.textContent=(n.type==='tag'?'#':'')+n.label+(n.type==='ghost'?'（未创建）':'')+' · '+n.deg+' 条连线';t.style.left=Math.min(x+14,innerWidth-280)+'px';t.style.top=(y+14)+'px';}});
  renderList();renderRail();setMode('split');setView('notes');
  const h=decodeURIComponent(location.hash.slice(1));const n=h&&byKey.get(key(h));
  if(n)openNote(n.id);else{setPane('list');if(!mobile()&&notes.length){const t=[...notes].sort((a,b)=>b.updated-a.updated)[0];openNote(t.id);}}
  railFlag();
  window.LJ={notes:()=>notes,openNote,createNote,openDaily,derive,setView,flush,buildGraph:()=>buildGraph(),cur,G:()=>G,renderReview};
})();
})();
