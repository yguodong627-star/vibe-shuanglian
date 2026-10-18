/* 链记 · Markdown 渲染与双链/标签提取（自写，转义优先，无外部库）。浏览器与 Node 通用 */
(function(root){
'use strict';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const WL=/\[\[([^\[\]\n|#]+?)(#[^\[\]\n|]*)?(?:\|([^\[\]\n]*))?\]\]/g;
const TAG=/(^|[\s>（(，。、；：,;])#([\p{L}\p{N}_][\p{L}\p{N}_\-\/]*)/gu;
const key=t=>String(t).trim().toLowerCase();
function stripCode(src){return src.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm,m=>m.replace(/[^\n]/g,' ')).replace(/`[^`\n]*`/g,m=>' '.repeat(m.length));}
function extractLinks(body){const s=stripCode(body);const out=[];let m;WL.lastIndex=0;while((m=WL.exec(s))){const t=m[1].trim();if(t)out.push(t);}return [...new Set(out)];}
function extractTags(body){const s=stripCode(body);const out=new Set();let m;TAG.lastIndex=0;
  while((m=TAG.exec(s))){const t=m[2];if(/^\d+$/.test(t))continue;out.add(t);TAG.lastIndex=m.index+m[0].length-0;}return [...out];}
function safeUrl(u){u=u.trim();return /^(https?:\/\/|mailto:)/i.test(u)?u:null;}

/* 行内：先抽走代码/链接/双链，换成占位符，再处理强调与标签，最后还原 */
function inline(text,ctx){
  const hold=[];const ph=h=>{hold.push(h);return '\u0000'+(hold.length-1)+'\u0000';};
  let s=text;
  s=s.replace(/`([^`\n]+)`/g,(m,c)=>ph('<code>'+esc(c)+'</code>'));
  s=s.replace(WL,(m,t,h,alias)=>{const title=t.trim();const ex=ctx&&ctx.exists?ctx.exists(title):true;const label=(alias&&alias.trim())||title+(h&&h.length>1?' › '+h.slice(1):'');
    return ph('<a class="wl'+(ex?'':' ghost')+'" href="#" data-wl="'+esc(title)+'"'+(ex?'':' title="尚未创建，点击新建"')+'>'+esc(label)+'</a>');});
  s=s.replace(/\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,(m,t,u)=>{const url=safeUrl(u);return url?ph('<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(t)+'</a>'):ph(esc(m));});
  s=s.replace(/(^|[^"'>\w])((?:https?:\/\/)[^\s<>"'）)，。]+)/g,(m,p,u)=>p+ph('<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(u)+'</a>'));
  s=esc(s);
  s=s.replace(/\*\*([^*\n]+?)\*\*/g,'<strong>$1</strong>').replace(/__([^_\n]+?)__/g,'<strong>$1</strong>');
  s=s.replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\*)/g,'$1<em>$2</em>').replace(/(^|[^_\w])_([^_\n]+?)_(?![_\w])/g,'$1<em>$2</em>');
  s=s.replace(/~~([^~\n]+?)~~/g,'<del>$1</del>');
  s=s.replace(/==([^=\n]+?)==/g,(m,c)=>'<mark class="cloze">'+c+'</mark>');
  s=s.replace(TAG,(m,p,t)=>/^\d+$/.test(t)?m:p+'<a class="tg" href="#" data-tag="'+t+'">#'+t+'</a>');
  s=s.replace(/\u0000(\d+)\u0000/g,(m,i)=>hold[+i]);
  return s;
}
function render(src,ctx){
  const lines=String(src).replace(/\r\n?/g,'\n').split('\n');const out=[];let i=0;
  const isTable=(a,b)=>a&&b&&a.includes('|')&&/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(b);
  const cells=l=>l.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>c.trim());
  // 去掉 YAML front matter（不渲染）
  if(lines[0]==='---'){const e=lines.indexOf('---',1);if(e>0){for(let k=0;k<=e;k++)lines[k]=null;}}
  const L=lines;
  while(i<L.length){
    let l=L[i];
    if(l===null){i++;continue;}
    let m;
    if((m=/^(```|~~~)\s*([\w+-]*)/.exec(l))){const fence=m[1];const buf=[];i++;while(i<L.length&&!(L[i]!==null&&L[i].startsWith(fence))){buf.push(L[i]);i++;}i++;out.push('<pre><code'+(m[2]?' class="lang-'+esc(m[2])+'"':'')+'>'+esc(buf.join('\n'))+'</code></pre>');continue;}
    if(!l.trim()){i++;continue;}
    if((m=/^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l))){const n=m[1].length;out.push('<h'+n+'>'+inline(m[2],ctx)+'</h'+n+'>');i++;continue;}
    if(/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)){out.push('<hr>');i++;continue;}
    if(isTable(l,L[i+1])){const head=cells(l);i+=2;const rows=[];while(i<L.length&&L[i]&&L[i].includes('|')){rows.push(cells(L[i]));i++;}
      out.push('<div class="tbl"><table><thead><tr>'+head.map(c=>'<th>'+inline(c,ctx)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+inline(c,ctx)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>');continue;}
    if(/^\s*>/.test(l)){const buf=[];while(i<L.length&&L[i]!==null&&/^\s*>/.test(L[i])){buf.push(L[i].replace(/^\s*>\s?/,''));i++;}out.push('<blockquote>'+render(buf.join('\n'),ctx)+'</blockquote>');continue;}
    if(/^(\s*)([-*+]|\d+[.)])\s+/.test(l)){
      // 列表（按缩进嵌套）
      const items=[];while(i<L.length&&L[i]!==null&&(/^(\s*)([-*+]|\d+[.)])\s+/.test(L[i])||(/^\s{2,}\S/.test(L[i])&&items.length))){
        const mm=/^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(L[i]);
        if(mm){const ind=mm[1].replace(/\t/g,'    ').length;const ord=/\d/.test(mm[2]);let txt=mm[3];let task=null;const t=/^\[( |x|X)\]\s+(.*)$/.exec(txt);if(t){task={done:t[1]!==' ',line:i};txt=t[2];}
          items.push({ind,ord,txt,task});}else{items[items.length-1].txt+=' '+L[i].trim();}
        i++;}
      const build=(from,ind)=>{let h='';let k=from;const ord=items[from].ord;h+=ord?'<ol>':'<ul>';
        while(k<items.length&&items[k].ind>=ind){const it=items[k];if(it.ind>ind){const r=build(k,it.ind);h=h.replace(/<\/li>$/,r.html+'</li>');k=r.next;continue;}
          h+='<li'+(it.task?' class="task"':'')+'>'+(it.task?'<input type="checkbox" data-task="'+it.task.line+'"'+(it.task.done?' checked':'')+'> ':'')+inline(it.txt,ctx)+'</li>';k++;}
        h+=ord?'</ol>':'</ul>';return {html:h,next:k};};
      const base=Math.min(...items.map(x=>x.ind));let k=0;while(k<items.length){const r=build(k,base);out.push(r.html);k=r.next>k?r.next:k+1;}
      continue;}
    // 段落
    const buf=[l];i++;while(i<L.length&&L[i]!==null&&L[i].trim()&&!/^(#{1,6}\s|```|~~~|\s*>|\s*([-*+]|\d+[.)])\s+|\s*([-*_])(\s*\3){2,}\s*$)/.test(L[i])&&!isTable(L[i],L[i+1])){buf.push(L[i]);i++;}
    out.push('<p>'+buf.map(x=>inline(x.trim(),ctx)).join('<br>')+'</p>');
  }
  return out.join('\n');
}
/* 用于复习：把 ==挖空== 变成可遮盖 */
function front(body){const m=/^---\n([\s\S]*?)\n---\n?/.exec(body);return m?{meta:m[1],rest:body.slice(m[0].length)}:{meta:'',rest:body};}
const api={render,extractLinks,extractTags,stripCode,key,esc,front};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MD=api;
})(typeof self!=='undefined'?self:this);
