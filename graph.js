/* 链记 · Canvas 力导向图谱（自写，无依赖）。 */
(function(root){
'use strict';
function Graph(cv,opts){
  this.cv=cv;this.ctx=cv.getContext('2d');this.o=opts||{};this.nodes=[];this.edges=[];this.map=new Map();
  this.view={x:0,y:0,k:1};this.alpha=1;this.cur=null;this.hover=null;this.drag=null;this.ptrs=new Map();this.dirty=true;this.running=false;this.w=0;this.h=0;
  this.bind();
}
Graph.prototype.resize=function(){
  const r=this.cv.getBoundingClientRect();const dpr=Math.min(2,window.devicePixelRatio||1);
  if(!r.width||!r.height)return;
  this.w=r.width;this.h=r.height;this.cv.width=Math.round(r.width*dpr);this.cv.height=Math.round(r.height*dpr);this.dpr=dpr;this.dirty=true;this.kick();
};
Graph.prototype.setData=function(nodes,edges,keepView){
  const old=this.map;this.map=new Map();
  const n=nodes.length;
  this.nodes=nodes.map((d,i)=>{const p=old.get(d.id);const a=i/Math.max(1,n)*Math.PI*2,r=60+Math.sqrt(n)*18;
    const o=p?Object.assign(p,d):Object.assign({x:Math.cos(a)*r+(Math.random()-.5)*20,y:Math.sin(a)*r+(Math.random()-.5)*20,vx:0,vy:0},d);o.deg=0;this.map.set(d.id,o);return o;});
  this.edges=[];for(const [a,b] of edges){const A=this.map.get(a),B=this.map.get(b);if(A&&B&&A!==B){this.edges.push([A,B]);A.deg++;B.deg++;}}
  this.nodes.forEach(n=>{n.r=5+Math.min(11,Math.sqrt(n.deg)*3);if(n.type==='tag')n.r+=1;});
  this.alpha=1;if(!keepView)this.reset(true);this.dirty=true;this.kick();
};
Graph.prototype.reset=function(noKick){this.touched=false;this.view={x:this.w/2,y:this.h/2,k:1};
  // 自动缩放到合适大小（稍后布局稳定后再微调一次）
  this.fitSoon=true;this.dirty=true;if(!noKick)this.kick();};
Graph.prototype.fit=function(){
  if(!this.nodes.length||!this.w)return;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const n of this.nodes){x0=Math.min(x0,n.x);x1=Math.max(x1,n.x);y0=Math.min(y0,n.y);y1=Math.max(y1,n.y);}
  const gw=Math.max(80,x1-x0),gh=Math.max(80,y1-y0);const k=Math.min(1.8,Math.max(.25,Math.min((this.w-120)/gw,(this.h-120)/gh)));
  this.view={k,x:this.w/2-(x0+x1)/2*k,y:this.h/2-(y0+y1)/2*k};this.dirty=true;
};
Graph.prototype.setCurrent=function(id){this.cur=id;this.dirty=true;this.kick();};
Graph.prototype.kick=function(){if(this.running)return;this.running=true;const loop=()=>{
  if(this.alpha>0.015||this.drag)this.tick();
  if(this.fitSoon&&this.alpha<0.35){this.fit();this.fitSoon=false;this.fin=true;}
  if(this.fin&&!this.touched&&this.alpha<0.03){this.fit();this.fin=false;}
  if(this.dirty){this.draw();this.dirty=false;}
  if(this.alpha>0.015||this.drag||this.dirty)requestAnimationFrame(loop);else this.running=false;};requestAnimationFrame(loop);};
Graph.prototype.tick=function(){
  const N=this.nodes,a=this.alpha;const n=N.length;if(!n)return;
  const rep=3200+Math.min(n,400)*22;const grav=n>80?0.004:0.012;
  for(let i=0;i<n;i++){const A=N[i];for(let j=i+1;j<n;j++){const B=N[j];let dx=A.x-B.x,dy=A.y-B.y;let d2=dx*dx+dy*dy;if(d2>250000)continue;if(d2<1){dx=Math.random()-.5;dy=Math.random()-.5;d2=1;}
    const f=rep/d2*a;const d=Math.sqrt(d2);dx/=d;dy/=d;A.vx+=dx*f;A.vy+=dy*f;B.vx-=dx*f;B.vy-=dy*f;}}
  for(const [A,B] of this.edges){let dx=B.x-A.x,dy=B.y-A.y;const d=Math.sqrt(dx*dx+dy*dy)||1;const f=(d-(A.type==="tag"||B.type==="tag"?120:110))*0.04*a;dx/=d;dy/=d;A.vx+=dx*f;A.vy+=dy*f;B.vx-=dx*f;B.vy-=dy*f;}
  for(const A of N){A.vx-=A.x*grav*a;A.vy-=A.y*grav*a;if(A===this.drag){A.vx=A.vy=0;continue;}A.vx*=0.78;A.vy*=0.78;A.x+=A.vx;A.y+=A.vy;}
  this.alpha*=0.975;this.dirty=true;
};
Graph.prototype.toWorld=function(px,py){return [(px-this.view.x)/this.view.k,(py-this.view.y)/this.view.k];};
Graph.prototype.pick=function(px,py){const [x,y]=this.toWorld(px,py);let best=null,bd=1e9;for(const n of this.nodes){const dx=n.x-x,dy=n.y-y;const d=Math.sqrt(dx*dx+dy*dy);const r=n.r+6/this.view.k;if(d<r&&d<bd){bd=d;best=n;}}return best;};
Graph.prototype.draw=function(){
  const c=this.ctx,dpr=this.dpr||1;if(!this.w)return;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,this.w,this.h);
  const g=c.createRadialGradient(this.w*.6,this.h*.35,10,this.w*.5,this.h*.5,Math.max(this.w,this.h)*.8);g.addColorStop(0,'#0b3a54');g.addColorStop(1,'#071a22');c.fillStyle=g;c.fillRect(0,0,this.w,this.h);
  const {x,y,k}=this.view;c.save();c.translate(x,y);c.scale(k,k);
  const hot=new Set();const focus=this.hover||null;if(focus){hot.add(focus);for(const [A,B] of this.edges){if(A===focus)hot.add(B);if(B===focus)hot.add(A);}}
  const cur=this.cur?this.map.get(this.cur):null;
  c.lineWidth=1/k;
  for(const [A,B] of this.edges){const on=focus&&(A===focus||B===focus);const oncur=cur&&(A===cur||B===cur);
    c.strokeStyle=on?'#c6d9e6':oncur?'#7fb0c8':(focus?'#39718b22':'#39718b66');c.lineWidth=(on||oncur?1.6:1)/k;c.beginPath();c.moveTo(A.x,A.y);c.lineTo(B.x,B.y);c.stroke();}
  for(const n of this.nodes){
    const dim=focus&&!hot.has(n);c.globalAlpha=dim?.25:1;
    c.beginPath();c.arc(n.x,n.y,n.r,0,7);
    if(n.type==='ghost'){c.setLineDash([3/k,3/k]);c.strokeStyle='#8aa0ab';c.lineWidth=1.3/k;c.stroke();c.setLineDash([]);}
    else{c.fillStyle=n.type==='tag'?'#39718b':n.type==='daily'?'#8fb4c8':'#dfe9ef';c.fill();}
    if(n===cur){c.beginPath();c.arc(n.x,n.y,n.r+4,0,7);c.strokeStyle='#f6f6f0';c.lineWidth=2/k;c.stroke();}
    c.globalAlpha=1;
  }
  c.font=(12/Math.max(.7,Math.min(k,1.4)))+'px Inter,"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';c.textAlign='center';c.textBaseline='top';
  for(const n of this.nodes){const show=n===cur||n===focus||hot.has(n)||k>=0.85||n.deg>=3;if(!show)continue;if(focus&&!hot.has(n))continue;
    const t=(n.type==='tag'?'#':'')+(n.label.length>16?n.label.slice(0,15)+'…':n.label);
    c.fillStyle=n.type==='ghost'?'#9fb2bb':n.type==='tag'?'#9fc6d9':'#e8f0f4';c.fillText(t,n.x,n.y+n.r+3);}
  c.restore();
};
Graph.prototype.bind=function(){
  const cv=this.cv;const pos=e=>{const r=cv.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
  cv.style.touchAction='none';
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);const [px,py]=pos(e);this.ptrs.set(e.pointerId,{x:px,y:py});
    if(this.ptrs.size===2){const [a,b]=[...this.ptrs.values()];this.pinch={d:Math.hypot(a.x-b.x,a.y-b.y),k:this.view.k};this.drag=null;this.pan=null;return;}
    this.touched=true;const n=this.pick(px,py);this.moved=0;this.downAt=[px,py];
    if(n){this.drag=n;this.alpha=Math.max(this.alpha,.3);this.kick();}else this.pan={x:px-this.view.x,y:py-this.view.y};});
  cv.addEventListener('pointermove',e=>{const [px,py]=pos(e);const p=this.ptrs.get(e.pointerId);if(p){p.x=px;p.y=py;}
    if(this.pinch&&this.ptrs.size===2){const [a,b]=[...this.ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);const nk=Math.max(.15,Math.min(4,this.pinch.k*d/this.pinch.d));const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
      const [wx,wy]=this.toWorld(cx,cy);this.view.k=nk;this.view.x=cx-wx*nk;this.view.y=cy-wy*nk;this.dirty=true;this.kick();return;}
    if(this.drag){const [wx,wy]=this.toWorld(px,py);this.drag.x=wx;this.drag.y=wy;this.moved=Math.hypot(px-this.downAt[0],py-this.downAt[1]);this.dirty=true;this.kick();return;}
    if(this.pan){this.view.x=px-this.pan.x;this.view.y=py-this.pan.y;this.moved=Math.hypot(px-this.downAt[0],py-this.downAt[1]);this.dirty=true;this.kick();return;}
    const h=this.pick(px,py);if(h!==this.hover){this.hover=h;cv.style.cursor=h?'pointer':'grab';this.dirty=true;this.kick();if(this.o.onHover)this.o.onHover(h,px,py);}});
  const up=e=>{const [px,py]=pos(e);const was=this.drag;this.ptrs.delete(e.pointerId);if(this.ptrs.size<2)this.pinch=null;
    if(was&&this.moved<5&&this.o.onOpen)this.o.onOpen(was);this.drag=null;this.pan=null;};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('pointerleave',()=>{if(!this.drag&&this.hover){this.hover=null;this.dirty=true;this.kick();if(this.o.onHover)this.o.onHover(null);}});
  cv.addEventListener('wheel',e=>{this.touched=true;e.preventDefault();const [px,py]=pos(e);const f=Math.exp(-e.deltaY*0.0015);const nk=Math.max(.15,Math.min(4,this.view.k*f));const [wx,wy]=this.toWorld(px,py);this.view.k=nk;this.view.x=px-wx*nk;this.view.y=py-wy*nk;this.dirty=true;this.kick();},{passive:false});
  window.addEventListener('resize',()=>this.resize());
};
root.Graph=Graph;
})(self);
