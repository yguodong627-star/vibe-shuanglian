const {chromium}=require('/workspace/tools/node_modules/playwright-core');const fs=require('fs'),http=require('http'),path=require('path');
const ROOT=path.join(__dirname,'..');const SH=path.join(ROOT,'screenshots');fs.mkdirSync(SH,{recursive:true});
const mt={'.js':'text/javascript','.html':'text/html','.css':'text/css','.ttf':'font/ttf'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end();}r.setHeader('content-type',mt[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f));}).listen(0);
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x);
async function run(tag,ctxOpts){
  const M=tag==='mobile';
  const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-gpu']});
  const c=await b.newContext({...ctxOpts,acceptDownloads:true});const pg=await c.newPage();const errs=[];
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  let dlg=[];pg.on('dialog',d=>{dlg.push(d.message().slice(0,40));d.accept('清空')});
  await new Promise(r=>srv.listening?r():srv.once('listening',r));
  await pg.goto('http://localhost:'+srv.address().port+'/');await pg.waitForFunction(()=>window.LJ);await pg.waitForTimeout(500);
  await pg.screenshot({path:`${SH}/${tag}-1-home.png`});
  const nav=v=>pg.click(M?`#tabbar [data-view=${v}]`:`#snav [data-view=${v}]`);
  // 新建笔记
  await pg.click('#btnNew');await pg.waitForTimeout(200);
  await pg.fill('#ttl','读书笔记 · 间隔效应');await pg.press('#ttl','Enter');
  await pg.fill('#body','# 间隔效应\n\n#读书 #心理学\n\n分散学习比集中突击更牢固，参见 [[双链是什么]] 里提到的方法。\n\n- [ ] 找原论文\n- [x] 做摘要\n\n关键结论：==间隔效应== 与 ==遗忘曲线== 相关。\n\n还要写 [[尚未创建的想法]]。\n\n| 方法 | 间隔 |\n|---|---|\n| 集中 | 无 |\n| 分散 | 有 |\n\n```js\nconst x = [[1]];\n```\n<script>window.__x=1</script>');
  await pg.waitForTimeout(700);
  const html=await pg.innerHTML('#prev');
  ok('wikilink rendered',html.includes('data-wl="双链是什么"')&&!html.includes('class="wl ghost" href="#" data-wl="双链是什么"'));
  ok('ghost link',html.includes('wl ghost'));
  ok('html escaped',!html.includes('<script')&&html.includes('&lt;script'));
  ok('table',html.includes('<table>'));ok('code protected',html.includes('[[1]]')&&!html.includes('data-wl="1"'));
  // 双链补全
  await pg.click('#body');await pg.keyboard.press('Control+End');await pg.keyboard.type('\n\n延伸：[[间隔');await pg.waitForTimeout(200);
  const acShown=await pg.isVisible('#ac');await pg.keyboard.press('Enter');await pg.waitForTimeout(300);
  const bodyV=await pg.inputValue('#body');ok('autocomplete',acShown&&bodyV.includes('[[间隔复习怎么用]]'),bodyV.slice(-20));
  await pg.waitForTimeout(500);
  if(M){await pg.click('#modeSeg [data-m=view]');await pg.waitForTimeout(200);}
  await pg.screenshot({path:`${SH}/${tag}-2-editor.png`});
  // 反向链接：打开“双链是什么”
  await pg.evaluate(()=>{const n=LJ.notes().find(n=>n.title==='双链是什么');LJ.openNote(n.id);});await pg.waitForTimeout(300);
  if(M){await pg.click('#modeSeg [data-m=links]');await pg.waitForTimeout(200);}
  const railTxt=await pg.innerText('#railIn');ok('backlink shows',railTxt.includes('读书笔记 · 间隔效应'),railTxt.replace(/\n/g,' ').slice(0,160));
  await pg.screenshot({path:`${SH}/${tag}-3-backlinks.png`});
  // 改名并同步链接
  await pg.evaluate(()=>{const n=LJ.notes().find(n=>n.title==='读书笔记 · 间隔效应');LJ.openNote(n.id);});await pg.waitForTimeout(200);
  if(M)await pg.click('#modeSeg [data-m=edit]');
  await pg.evaluate(()=>{const n=LJ.notes().find(n=>n.title==='双链是什么');LJ.openNote(n.id);});
  if(M)await pg.click('#modeSeg [data-m=edit]');
  await pg.fill('#ttl','双向链接入门');await pg.press('#ttl','Tab');await pg.waitForTimeout(500);
  const rew=await pg.evaluate(()=>LJ.notes().find(n=>n.title==='读书笔记 · 间隔效应').body.includes('[[双向链接入门]]')&&LJ.notes().filter(n=>n.body.includes('[[双链是什么]]')).length);
  ok('rename rewrites links',rew===0,String(rew)+' '+dlg.join('|'));
  // 点击未创建的链接 -> 新建
  const before=await pg.evaluate(()=>LJ.notes().length);
  await pg.evaluate(()=>{const n=LJ.notes().find(n=>n.title==='读书笔记 · 间隔效应');LJ.openNote(n.id);});
  if(M)await pg.click('#modeSeg [data-m=view]');else await pg.waitForTimeout(100);
  await pg.click('#prev a.wl.ghost');await pg.waitForTimeout(400);
  const after=await pg.evaluate(()=>[LJ.notes().length,LJ.cur().title]);ok('click ghost creates',after[0]===before+1&&after[1]==='尚未创建的想法',after.join());
  // 勾选任务
  await pg.evaluate(()=>{const n=LJ.notes().find(n=>n.title==='读书笔记 · 间隔效应');LJ.openNote(n.id);});
  if(M)await pg.click('#modeSeg [data-m=view]');
  await pg.click('#prev input[data-task]');await pg.waitForTimeout(200);
  ok('toggle task',(await pg.evaluate(()=>LJ.cur().body)).includes('- [x] 找原论文'));
  // 日记
  if(M)await pg.click('#btnBack');
  await pg.click('#btnDaily');await pg.waitForTimeout(300);const d1=await pg.evaluate(()=>LJ.notes().filter(n=>/^\d{4}-\d{2}-\d{2}$/.test(n.title)).length);
  if(M)await pg.click('#btnBack');await pg.click('#btnDaily');await pg.waitForTimeout(300);const d2=await pg.evaluate(()=>LJ.notes().filter(n=>/^\d{4}-\d{2}-\d{2}$/.test(n.title)).length);
  ok('daily idempotent',d1===d2&&d1>=1,d1+','+d2);
  if(M){await pg.click('#btnBack');}
  // 搜索
  await pg.fill('#q','遗忘曲线');await pg.waitForTimeout(300);const s1=await pg.$$eval('#list .li',e=>e.length);
  await pg.fill('#q','#心理学');await pg.waitForTimeout(300);const s2=await pg.$$eval('#list .li',e=>e.length);
  await pg.fill('#q','不存在的词语xyz');await pg.waitForTimeout(300);const s3=await pg.$$eval('#list .li',e=>e.length);
  await pg.fill('#q','遗忘曲线');await pg.waitForTimeout(300);
  ok('search',s1===1&&s2===1&&s3===0,[s1,s2,s3].join());
  await pg.screenshot({path:`${SH}/${tag}-4-search.png`});await pg.fill('#q','');
  // 图谱
  await nav('graph');await pg.waitForTimeout(2500);
  await pg.screenshot({path:`${SH}/${tag}-5-graph.png`});
  await pg.click('#gMode [data-g=tag]');await pg.waitForTimeout(2200);await pg.screenshot({path:`${SH}/${tag}-6-taggraph.png`});
  const gn=await pg.evaluate(()=>LJ.G().nodes.length);ok('graph nodes',gn>=3,String(gn));
  // 复习
  await nav('review');await pg.waitForTimeout(300);
  const due0=await pg.innerText('#rvNum');
  await pg.screenshot({path:`${SH}/${tag}-7-review.png`});
  await pg.click('#rvShow');await pg.waitForTimeout(200);await pg.screenshot({path:`${SH}/${tag}-8-review-answer.png`});
  await pg.click('#rvCard [data-g="3"]');await pg.waitForTimeout(300);
  const rv=await pg.evaluate(()=>LJ.notes().filter(n=>n.rv).map(n=>[n.title,n.rv.interval,n.rv.due]));
  ok('review schedule',due0==='1'&&rv.some(x=>x[1]===1),JSON.stringify(rv)+' due0='+due0);
  // 备份
  await nav('backup');await pg.waitForTimeout(300);await pg.screenshot({path:`${SH}/${tag}-9-backup.png`});
  const snap=await pg.evaluate(()=>JSON.stringify(LJ.notes().map(n=>[n.id,n.title,n.body,!!n.rv]).sort()));
  const [dz]=await Promise.all([pg.waitForEvent('download'),pg.click('#exZip')]);await dz.saveAs(path.join(__dirname,'export-test.zip'));
  const [dj]=await Promise.all([pg.waitForEvent('download'),pg.click('#exJson')]);await dj.saveAs(path.join(__dirname,'backup-test.json'));
  await pg.click('#wipe');await pg.waitForTimeout(400);const w0=await pg.evaluate(()=>LJ.notes().length);
  await pg.setInputFiles('#impFile',path.join(__dirname,'backup-test.json'));await pg.waitForTimeout(1200);
  const snap2=await pg.evaluate(()=>JSON.stringify(LJ.notes().map(n=>[n.id,n.title,n.body,!!n.rv]).sort()));
  ok('json roundtrip',w0===0&&snap===snap2,'wiped='+w0);
  // zip 导入到清空后的库
  await pg.click('#wipe');await pg.waitForTimeout(300);
  await pg.setInputFiles('#impFile',path.join(__dirname,'export-test.zip'));await pg.waitForTimeout(1500);
  const n3=await pg.evaluate(()=>LJ.notes().map(n=>n.title).sort());ok('zip(md) import',n3.length===JSON.parse(snap).length,n3.length+'/'+JSON.parse(snap).length);
  await pg.setInputFiles('#impFile',path.join(__dirname,'export-test.zip'));await pg.waitForTimeout(1200);
  const n4=await pg.evaluate(()=>LJ.notes().length);ok('re-import idempotent',n4===n3.length,String(n4));
  console.log(tag,'errors:',errs);
  await b.close();
}
(async()=>{if(!process.argv[2])await run('desktop',{viewport:{width:1440,height:900}});await run('mobile',{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});srv.close();})().catch(e=>{console.log('FAIL',e.stack);process.exit(1)});
