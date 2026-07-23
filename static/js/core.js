// ════════════════════════════════════════════
// CORE
// ════════════════════════════════════════════
let ME=null, PAGE='dash';

const ICO={
  dash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  ci:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  task:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  gantt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  team:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  rpt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  cfg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
};

async function api(path,opts={}){
  try{
    const r=await fetch('/api'+path,{headers:{'Content-Type':'application/json'},...opts});
    if(r.status===401){showLogin();return null;}
    if(r.status===204) return true;
    const ct=r.headers.get('content-type')||'';
    if(ct.includes('json')){
      const d=await r.json();
      if(!r.ok){toast(d.error||'操作失败','err');return null;}
      return d;
    }
    return await r.blob();
  }catch(e){toast('网络错误','err');return null;}
}
const GET=p=>api(p);
const POST=(p,d)=>api(p,{method:'POST',body:JSON.stringify(d)});
const PUT=(p,d)=>api(p,{method:'PUT',body:JSON.stringify(d)});
const DEL=p=>api(p,{method:'DELETE'});

// ── GANTT: weekend / CN holiday markers (shared by tasks.js & admin-gantt.js) ──
let CN_HOLIDAYS={};
async function loadCnHolidays(){
  const cfg=await GET('/config')||{};
  try{CN_HOLIDAYS=JSON.parse(cfg.cn_holidays||'{}');}catch{CN_HOLIDAYS={};}
}
function ganttDayMeta(dt){
  const wknd=dt.getDay()===0||dt.getDay()===6;
  return {weekend:wknd,holiday:CN_HOLIDAYS[toLocalDateStr(dt)]||null};
}
// One background-shading string reused across every Gantt row's .gantt-track
// (holiday takes priority over weekend on the same day); no per-row recompute.
function buildGanttBgMarkers(startDate,totalDays){
  let out='';
  for(let d=0;d<totalDays;d++){
    const dt=new Date(startDate); dt.setDate(dt.getDate()+d);
    const meta=ganttDayMeta(dt);
    if(!meta.weekend&&!meta.holiday) continue;
    const left=(d/totalDays*100).toFixed(3), width=Math.max(0.15,(1/totalDays*100)).toFixed(3);
    const cls=meta.holiday?'gantt-holiday-mark':'gantt-wknd-mark';
    const title=meta.holiday?` title="${esc(meta.holiday)}"`:'';
    out+=`<div class="${cls}" style="left:${left}%;width:${width}%"${title}></div>`;
  }
  return out;
}

// ── APPEARANCE ────────────────────────────────────────────────
const THEMES={
  'dark-blue':{name:'深海蓝',bg:'#0f172a',pri:'#3b82f6',vars:{'--bg':'#0f172a','--bg-rgb':'15,23,42','--s1':'#1e293b','--s1-rgb':'30,41,59','--s2':'#273348','--s2-rgb':'39,51,72','--s3':'#1a2744','--border':'#334155','--border2':'#2d3f5a','--pri':'#3b82f6','--pri2':'#1d4ed8','--acc':'#06b6d4','--ok':'#10b981','--warn':'#f59e0b','--err':'#ef4444','--tx':'#f1f5f9','--tx2':'#94a3b8','--tx3':'#64748b','--row-hover':'rgba(30,41,59,.4)','--login-g1':'#0f3460','--login-g2':'#0c2a4a'}},
  'ocean':{name:'深邃海洋',bg:'#0a1628',pri:'#0ea5e9',vars:{'--bg':'#0a1628','--bg-rgb':'10,22,40','--s1':'#112236','--s1-rgb':'17,34,54','--s2':'#1a3050','--s2-rgb':'26,48,80','--s3':'#0e1e3a','--border':'#1e3a5f','--border2':'#1a3352','--pri':'#0ea5e9','--pri2':'#0284c7','--acc':'#22d3ee','--ok':'#10b981','--warn':'#f59e0b','--err':'#ef4444','--tx':'#e0f2fe','--tx2':'#7dd3fc','--tx3':'#0369a1','--row-hover':'rgba(17,34,54,.5)','--login-g1':'#061624','--login-g2':'#0a1e38'}},
  'forest':{name:'森林夜晚',bg:'#0a1a0e',pri:'#10b981',vars:{'--bg':'#0a1a0e','--bg-rgb':'10,26,14','--s1':'#132518','--s1-rgb':'19,37,24','--s2':'#1a3022','--s2-rgb':'26,48,34','--s3':'#0f1f12','--border':'#2d5a36','--border2':'#234d2b','--pri':'#10b981','--pri2':'#059669','--acc':'#34d399','--ok':'#34d399','--warn':'#f59e0b','--err':'#ef4444','--tx':'#ecfdf5','--tx2':'#6ee7b7','--tx3':'#065f46','--row-hover':'rgba(19,37,24,.5)','--login-g1':'#061a08','--login-g2':'#0a1f0d'}},
  'purple':{name:'紫色黄昏',bg:'#130a2a',pri:'#a855f7',vars:{'--bg':'#130a2a','--bg-rgb':'19,10,42','--s1':'#1e1040','--s1-rgb':'30,16,64','--s2':'#271852','--s2-rgb':'39,24,82','--s3':'#170d36','--border':'#4c3080','--border2':'#3d2468','--pri':'#a855f7','--pri2':'#7c3aed','--acc':'#e879f9','--ok':'#10b981','--warn':'#f59e0b','--err':'#f87171','--tx':'#f3e8ff','--tx2':'#c084fc','--tx3':'#7c3aed','--row-hover':'rgba(30,16,64,.5)','--login-g1':'#0d0620','--login-g2':'#160930'}},
  'warm':{name:'暖色夜晚',bg:'#1a0e08',pri:'#f97316',vars:{'--bg':'#1a0e08','--bg-rgb':'26,14,8','--s1':'#2a1a0e','--s1-rgb':'42,26,14','--s2':'#35221a','--s2-rgb':'53,34,26','--s3':'#22140a','--border':'#6b3a25','--border2':'#5a2f1e','--pri':'#f97316','--pri2':'#ea580c','--acc':'#fbbf24','--ok':'#10b981','--warn':'#fbbf24','--err':'#ef4444','--tx':'#fff7ed','--tx2':'#fdba74','--tx3':'#c2410c','--row-hover':'rgba(42,26,14,.5)','--login-g1':'#3d1506','--login-g2':'#2a0f04'}},
  'slate':{name:'暮色灰调',bg:'#111827',pri:'#6366f1',vars:{'--bg':'#111827','--bg-rgb':'17,24,39','--s1':'#1f2937','--s1-rgb':'31,41,55','--s2':'#2d3748','--s2-rgb':'45,55,72','--s3':'#1a2234','--border':'#374151','--border2':'#2d3a4e','--pri':'#6366f1','--pri2':'#4f46e5','--acc':'#818cf8','--ok':'#10b981','--warn':'#f59e0b','--err':'#ef4444','--tx':'#f9fafb','--tx2':'#9ca3af','--tx3':'#6b7280','--row-hover':'rgba(31,41,55,.5)','--login-g1':'#1a1f3a','--login-g2':'#0d1025'}},
  'rose':{name:'玫瑰夜色',bg:'#1a0810',pri:'#f43f5e',vars:{'--bg':'#1a0810','--bg-rgb':'26,8,16','--s1':'#2a1018','--s1-rgb':'42,16,24','--s2':'#361820','--s2-rgb':'54,24,32','--s3':'#220c12','--border':'#7f1d2f','--border2':'#6b1625','--pri':'#f43f5e','--pri2':'#e11d48','--acc':'#fb7185','--ok':'#10b981','--warn':'#f59e0b','--err':'#fb7185','--tx':'#fff1f2','--tx2':'#fda4af','--tx3':'#be123c','--row-hover':'rgba(42,16,24,.5)','--login-g1':'#3d0515','--login-g2':'#2a040f'}},
  'light':{name:'清新白昼',bg:'#f0f4f8',pri:'#3b82f6',vars:{'--bg':'#f0f4f8','--bg-rgb':'240,244,248','--s1':'#ffffff','--s1-rgb':'255,255,255','--s2':'#f1f5f9','--s2-rgb':'241,245,249','--s3':'#e2e8f0','--border':'#cbd5e1','--border2':'#e2e8f0','--pri':'#3b82f6','--pri2':'#1d4ed8','--acc':'#06b6d4','--ok':'#059669','--warn':'#d97706','--err':'#dc2626','--tx':'#0f172a','--tx2':'#475569','--tx3':'#94a3b8','--row-hover':'rgba(15,23,42,.05)','--login-g1':'#dbeafe','--login-g2':'#e0f2fe'}}
};
function applyTheme(id){
  const t=THEMES[id]||THEMES['dark-blue'];
  const root=document.documentElement;
  Object.entries(t.vars).forEach(([k,v])=>root.style.setProperty(k,v));
  localStorage.setItem('tm_theme',id);
  document.querySelectorAll('.sw-item').forEach(el=>{
    const a=el.dataset.theme===id;
    const sw=el.querySelector('.theme-sw');
    if(sw){sw.style.borderColor=a?'var(--pri)':'transparent';sw.style.boxShadow=a?'0 0 0 3px rgba(59,130,246,.3)':'none';}
    const lbl=el.querySelector('span');
    if(lbl) lbl.style.color=a?'var(--pri)':'var(--tx3)';
  });
}
function applyBgImage(dataUrl){
  if(dataUrl){
    document.body.style.backgroundImage='url('+dataUrl+')';
    document.body.classList.add('has-bg-img');
    localStorage.setItem('tm_bg_img',dataUrl);
  } else {
    document.body.style.backgroundImage='';
    document.body.classList.remove('has-bg-img');
    localStorage.removeItem('tm_bg_img');
  }
}
function clearBgImage(){
  applyBgImage(null);
  const wrap=document.getElementById('bg-preview-wrap');
  if(wrap){wrap.style.display='none';}
  const empty=document.getElementById('bg-no-img');
  if(empty) empty.style.display='block';
  toast('背景图已清除');
}
function handleBgUpload(e){
  const file=e.target.files[0];
  if(!file) return;
  if(file.size>8*1024*1024){toast('图片大小请控制在8MB以内','err');return;}
  const reader=new FileReader();
  reader.onload=function(ev){
    try{
      applyBgImage(ev.target.result);
      const wrap=document.getElementById('bg-preview-wrap');
      if(wrap){
        const img=wrap.querySelector('img');
        if(img) img.src=ev.target.result;
        wrap.style.display='block';
      }
      const empty=document.getElementById('bg-no-img');
      if(empty) empty.style.display='none';
      toast('背景图已设置');
    }catch(ex){toast('图片太大，无法保存到本地','err');}
  };
  reader.readAsDataURL(file);
}
function initAppearance(){
  const tid=localStorage.getItem('tm_theme')||'dark-blue';
  const t=THEMES[tid]||THEMES['dark-blue'];
  const root=document.documentElement;
  Object.entries(t.vars).forEach(([k,v])=>root.style.setProperty(k,v));
  const img=localStorage.getItem('tm_bg_img');
  if(img){document.body.style.backgroundImage='url('+img+')';document.body.classList.add('has-bg-img');}
}

function toast(msg,type='ok'){
  const el=document.createElement('div');
  el.className='toast t-'+type; el.textContent=msg;
  document.getElementById('toast').appendChild(el);
  setTimeout(()=>el.remove(),3000);
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function pad2(n){return String(n).padStart(2,'0')}
// Local calendar date as YYYY-MM-DD. Deliberately NOT toISOString().slice(0,10) —
// that's UTC-based and returns the wrong (previous) date for any positive-UTC-offset
// timezone (e.g. UTC+8) during local 00:00-08:00, which broke early-morning check-in.
function toLocalDateStr(d){return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())}
function today(){return toLocalDateStr(new Date())}
function thisMonth(){const d=new Date();return d.getFullYear()+'-'+pad2(d.getMonth()+1)}
function yearStart(){return new Date().getFullYear()+'-01'}
function gv(id){return document.getElementById(id)?.value||''}
function sv(id,v){const el=document.getElementById(id);if(el)el.value=v||''}
function dlBlob(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}

const SZ={PENDING:'待处理',IN_PROGRESS:'进行中',TESTING:'测试中',DELIVERED:'已交付',
  CANCELLED:'已取消',OPEN:'待处理',RESOLVED:'已解决',CLOSED:'已关闭',REJECTED:'已拒绝',
  ONGOING:'进行中',COMPLETED:'已完成'};
const SC={PENDING:'bd-gray',IN_PROGRESS:'bd-blue',TESTING:'bd-amber',DELIVERED:'bd-green',
  CANCELLED:'bd-gray',OPEN:'bd-amber',RESOLVED:'bd-green',CLOSED:'bd-gray',REJECTED:'bd-red',
  ONGOING:'bd-teal',COMPLETED:'bd-green'};
const TZ={REQUIREMENT:'需求',ISSUE:'问题单',ONSITE:'现场支撑',OTHER:'其他事务',QUALITY:'质量深耕'};
const TC={REQUIREMENT:'bd-blue',ISSUE:'bd-red',ONSITE:'bd-teal',OTHER:'bd-purple',QUALITY:'bd-green'};
const SEV={LOW:'bd-gray',MEDIUM:'bd-blue',HIGH:'bd-amber',CRITICAL:'bd-red'};
function taskStatusesFor(type){
  if(type==='ALL') return ['PENDING','IN_PROGRESS','TESTING','DELIVERED','OPEN','RESOLVED','CLOSED','REJECTED','ONGOING','COMPLETED','CANCELLED'];
  return type==='ISSUE'?['OPEN','IN_PROGRESS','RESOLVED','CLOSED','REJECTED']:
    (type==='REQUIREMENT'||type==='QUALITY'?['PENDING','IN_PROGRESS','TESTING','DELIVERED','CANCELLED']:
     ['PENDING','ONGOING','COMPLETED','CANCELLED']);
}
const PRI={LOW:'bd-gray',MEDIUM:'bd-blue',HIGH:'bd-amber',CRITICAL:'bd-red'};

function sbadge(s){return`<span class="bd ${SC[s]||'bd-gray'}">${SZ[s]||s}</span>`}
function tbadge(t){return`<span class="bd ${TC[t]||'bd-gray'}">${TZ[t]||t}</span>`}
function pgr(page,pages,fn){
  if(pages<=1)return'';
  let h='<div class="pgr">';
  h+=`<div class="pb" onclick="${fn}(${Math.max(1,page-1)})">‹</div>`;
  for(let i=1;i<=pages;i++){
    if(i===1||i===pages||Math.abs(i-page)<=1)
      h+=`<div class="pb${i===page?' active':''}" onclick="${fn}(${i})">${i}</div>`;
    else if(Math.abs(i-page)===2) h+='<div class="pb" style="pointer-events:none">…</div>';
  }
  h+=`<div class="pb" onclick="${fn}(${Math.min(pages,page+1)})">›</div>`;
  return h+'</div>';
}
function paginate(rows,page,size=15){
  const pages=Math.ceil(rows.length/size)||1,p=Math.max(1,Math.min(page,pages));
  return{rows:rows.slice((p-1)*size,p*size),page:p,pages,total:rows.length};
}

// ── AUTH ─────────────────────────────────────────────────────
function showLogin(){
  document.getElementById('lp').style.display='flex';
  document.getElementById('app').style.display='none';
  document.getElementById('lerr').textContent='';
}
function showApp(){
  document.getElementById('lp').style.display='none';
  document.getElementById('app').style.display='block';
}
function sha256hex(msg){
  function n(v){return(v>>>0).toString(16).padStart(8,'0');}
  function r(v,t){return(v>>>t)|(v<<(32-t));}
  var H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  var K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  var bytes=[];
  for(var i=0;i<msg.length;i++){var c=msg.charCodeAt(i);if(c<128)bytes.push(c);else if(c<2048){bytes.push(192|(c>>6));bytes.push(128|(c&63));}else{bytes.push(224|(c>>12));bytes.push(128|((c>>6)&63));bytes.push(128|(c&63));}}
  var bl=bytes.length*8;bytes.push(0x80);
  while((bytes.length%64)!==56)bytes.push(0);
  for(var i=7;i>=0;i--)bytes.push((bl/Math.pow(2,i*8))&255);
  for(var ch=0;ch<bytes.length;ch+=64){
    var w=[];
    for(var j=0;j<16;j++)w.push((bytes[ch+j*4]<<24)|(bytes[ch+j*4+1]<<16)|(bytes[ch+j*4+2]<<8)|bytes[ch+j*4+3]);
    for(var j=16;j<64;j++){var s0=r(w[j-15],7)^r(w[j-15],18)^(w[j-15]>>>3);var s1=r(w[j-2],17)^r(w[j-2],19)^(w[j-2]>>>10);w.push((w[j-16]+s0+w[j-7]+s1)|0);}
    var a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for(var j=0;j<64;j++){var S1=r(e,6)^r(e,11)^r(e,25);var ch2=(e&f)^((~e)&g);var t1=(h+S1+ch2+K[j]+w[j])|0;var S0=r(a,2)^r(a,13)^r(a,22);var mj=(a&b)^(a&c)^(b&c);var t2=(S0+mj)|0;h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
    H[0]=(H[0]+a)|0;H[1]=(H[1]+b)|0;H[2]=(H[2]+c)|0;H[3]=(H[3]+d)|0;H[4]=(H[4]+e)|0;H[5]=(H[5]+f)|0;H[6]=(H[6]+g)|0;H[7]=(H[7]+h)|0;
  }
  return H.map(n).join('');
}
async function doLogin(){
  var username=document.getElementById('lu').value.trim();
  var password=document.getElementById('lp2').value;
  document.getElementById('lerr').textContent='';
  if(!username||!password){document.getElementById('lerr').textContent='请输入用户名和密码';return;}
  var d=await POST('/auth/login',{username:username,password:sha256hex(password),hashed:true});
  if(!d)return;
  ME=d.user; initApp();
}
async function doLogout(){await POST('/auth/logout',{});ME=null;showLogin();}
async function checkAuth(){
  const d=await GET('/auth/me');
  if(d&&d.user){ME=d.user;initApp();}else showLogin();
}

// ── INIT ─────────────────────────────────────────────────────
let VIEW_MODE='admin'; // 'admin' | 'member'
let CLIENT_IP=''; // 登录时获取一次，签到时携带

function initApp(){
  showApp();
  VIEW_MODE=ME.is_admin?'admin':'member';
  document.getElementById('sb-av').textContent=ME.name.slice(0,1);
  document.getElementById('sb-name').textContent=ME.name;
  var roleLabel=ME.username==='admin'?'超级管理员':(ME.is_admin?'管理员':(ME.role||'成员'));
  document.getElementById('sb-role').textContent=roleLabel;
  if(ME.is_admin) currentGroup=ME.group_name||'';
  buildNav();
  showPage('dash');
  // 获取客户端 IP，然后自动签到
  GET('/myip').then(function(r){
    if(r&&r.ip) CLIENT_IP=r.ip;
    setTimeout(autoCheckIn, 100);
  });
}

async function autoCheckIn(){
  // 超级管理员 admin 不自动签到
  if(ME.username==='admin') return;
  var ci=await GET('/checkin/today');
  if(ci&&ci.status){
    // 已有签到记录，如果是请假/调休则弹出提示允许修改
    if(ci.status==='LEAVE'||ci.status==='OFF'){
      var labels={'LEAVE':'请假','OFF':'调休'};
      if(confirm('今日状态为【'+( labels[ci.status]||ci.status)+'】，是否修改为出勤或其他状态？')){
        openQuickCiModal();
      }
    }
    // 其他状态（PRESENT/LATE/REMOTE）不打扰
    return;
  }
  // 当天无签到记录，自动签出勤
  var d=await POST('/checkin',{date:today(),status:'PRESENT',memberId:ME.id,clientIp:CLIENT_IP});
  if(d) toast('已自动签到：出勤 ✅');
}

// 快速签到修改弹窗（供自动签到后调整使用）
function openQuickCiModal(){
  var opts=['PRESENT','REMOTE','LATE','LEAVE','OFF'].map(function(s){
    var labels={PRESENT:'出勤',REMOTE:'远程',LATE:'迟到',LEAVE:'请假',OFF:'调休'};
    return '<label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--s2)">'
      +'<input type="radio" name="qci-status" value="'+s+'" style="accent-color:var(--pri)"'+(s==='PRESENT'?' checked':'')+'>'+labels[s]+'</label>';
  }).join('');
  openModal('修改今日签到状态',
    '<div style="display:flex;flex-direction:column;gap:8px">'+opts+'</div>'
    +'<div style="margin-top:12px"><label class="flabel">备注</label><input id="qci-remark" class="fi" placeholder="选填"></div>',
    async function(){
      var status=document.querySelector('input[name="qci-status"]:checked');
      if(!status)return;
      var d=await POST('/checkin',{date:today(),status:status.value,remark:document.getElementById('qci-remark').value,memberId:ME.id,clientIp:CLIENT_IP});
      if(d){toast('签到状态已更新：'+status.value);closeModal();}
    }
  );
}

function buildNav(){
  var nav=document.getElementById('sb-nav');
  var adminMenus=[
    {k:'dash',l:'总览',i:'dash'},{k:'ci',l:'签到管理',i:'ci'},
    {k:'tasks',l:'任务管理',i:'task'},{k:'member-view',l:'成员视图',i:'team'},
    {k:'admin-gantt',l:'甘特图',i:'gantt'},{k:'progress',l:'进展记录',i:'task'},
    {k:'day-plan',l:'每日计划',i:'task'},{k:'overtime',l:'加班管理',i:'ci'},
    {k:'team',l:'成员管理',i:'team'},{k:'config-mgmt',l:'配置管理',i:'cfg'},
    {k:'reports',l:'报表中心',i:'rpt'},{k:'help',l:'操作说明',i:'rpt'}
  ];
  var memberMenus=[
    {k:'dash',l:'我的工作台',i:'dash'},{k:'my-ci',l:'我的签到',i:'ci'},
    {k:'my-tasks',l:'我的任务',i:'task'},{k:'gantt',l:'甘特图',i:'gantt'},
    {k:'progress',l:'进展记录',i:'task'},{k:'day-plan',l:'每日计划',i:'task'},
    {k:'overtime',l:'加班管理',i:'ci'},
    {k:'team-view',l:'团队视图',i:'team'},
    {k:'reports',l:'报表中心',i:'rpt'},{k:'help',l:'操作说明',i:'rpt'}
  ];
  var isAdminView=ME.is_admin&&VIEW_MODE==='admin';
  var menus=isAdminView?adminMenus:memberMenus;
  var btns=menus.map(function(m){
    return '<button class="ni" id="ni-'+m.k+'" onclick="showPage(\''+m.k+'\')">'+(ICO[m.i]||'')+' '+m.l+'</button>';
  }).join('');
  // 管理员在底部加切换按钮
  if(ME.is_admin){
    var switchLabel=VIEW_MODE==='admin'?'切换到成员视图':'切换到管理员视图';
    var switchIcon=VIEW_MODE==='admin'?ICO['team']:ICO['dash'];
    btns+='<button class="ni" onclick="toggleViewMode()" style="margin-top:8px;border-top:1px solid var(--border);color:var(--acc);opacity:.85">'+(switchIcon||'')+'  '+switchLabel+'</button>';
  }
  nav.innerHTML=btns;
}

function toggleViewMode(){
  VIEW_MODE=VIEW_MODE==='admin'?'member':'admin';
  buildNav();
  showPage('dash');
}

function showPage(name){
  PAGE=name;
  document.querySelectorAll('.ni').forEach(function(e){e.classList.remove('active');});
  var btn=document.getElementById('ni-'+name);if(btn)btn.classList.add('active');
  var isAdminView=ME.is_admin&&VIEW_MODE==='admin';
  var map=isAdminView?{
    dash:renderAdminDash,ci:renderCi,tasks:renderTasks,team:renderTeam,reports:renderReports,
    profile:renderProfile,'member-view':renderMemberView,'admin-gantt':renderAdminGantt,progress:renderProgress,
    'day-plan':renderDayPlan,overtime:renderOvertime,help:renderHelp,'config-mgmt':renderConfigMgmt
  }:{
    dash:renderMemberDash,'my-ci':renderMyCi,'my-tasks':renderMyTasks,gantt:renderGantt,
    'team-view':renderTeamView,profile:renderProfile,progress:renderProgress,'day-plan':renderDayPlan,
    overtime:renderOvertime,help:renderHelp,
    reports:renderReports
  };
  (map[name]||(isAdminView?renderAdminDash:renderMemberDash))();
}
let _modalSave=null;
function openModal(title,body,onSave,wide=false){
  _modalSave=onSave;
  document.getElementById('mw').innerHTML=`
  <div class="ov" id="mov">
    <div class="modal" style="${wide?'max-width:720px':''}">
      <div class="mhd"><div class="mtitle">${title}</div><button class="xbtn" onclick="closeModal()">✕</button></div>
      <div class="mbd" id="mbd">${body}</div>
      <div class="mft">
        <button class="btn btn-ghost" onclick="closeModal()">取消</button>
        <button class="btn btn-pri" onclick="_modalSave&&_modalSave()">保存</button>
      </div>
    </div>
  </div>`;
}
function closeModal(){document.getElementById('mw').innerHTML='';_modalSave=null;}

// ── Generic multi-select dropdown (used by list filters) ──────
function toggleDropdown(id){
  document.querySelectorAll('.ms-dd-panel').forEach(p=>{if(p.id!==id)p.style.display='none';});
  const el=document.getElementById(id);
  if(el) el.style.display=el.style.display==='block'?'none':'block';
}
document.addEventListener('click',e=>{
  if(!e.target.closest('.ms-dd')) document.querySelectorAll('.ms-dd-panel').forEach(p=>p.style.display='none');
});

