/* 链记 · 间隔复习调度（SM-2 简化版，规则公开，见页面“规则”）。浏览器与 Node 通用 */
(function(root){
'use strict';
function pad(n){return String(n).padStart(2,'0');}
function dstr(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function addDays(s,n){const [y,m,d]=s.split('-').map(Number);return dstr(new Date(y,m-1,d+n));}
function diffDays(a,b){const f=s=>{const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d);};return Math.round((f(a)-f(b))/864e5);}
function fresh(today){return {due:today,interval:0,ease:2.3,reps:0,lapses:0,last:null};}
/* grade: 1 忘了 / 2 模糊 / 3 记得 / 4 简单 */
function next(rv,grade,today){
  let {interval,ease,reps,lapses}=rv;let iv;
  if(grade===1){reps=0;lapses++;ease=Math.max(1.3,ease-0.2);iv=1;}
  else if(grade===2){iv=Math.max(1,Math.round(Math.max(1,interval)*1.2));ease=Math.max(1.3,ease-0.15);}
  else if(grade===3){iv=reps===0?1:reps===1?3:Math.round(interval*ease);reps++;}
  else{iv=reps===0?3:reps===1?7:Math.round(interval*ease*1.3);ease+=0.15;reps++;}
  iv=Math.max(1,Math.min(365,iv));ease=Math.round(ease*100)/100;
  return {due:addDays(today,iv),interval:iv,ease,reps,lapses,last:today};
}
const api={next,fresh,addDays,diffDays,dstr};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SCHED=api;
})(typeof self!=='undefined'?self:this);
