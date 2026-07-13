// ════════════════════════════════════════════
// PROGRESS TIMELINE (替代原"月度日历"：按天/周/月/年浏览个人任务进展，可排序、可导出)
// 设计上始终只展示当前登录用户自己的进展，不支持管理员查看他人（与团队约定一致）
// ════════════════════════════════════════════
let progGran='month', progAnchor=today(), progSort='desc', progData=null;

function progRange(){
  const d=new Date(progAnchor+'T00:00:00');
  if(progGran==='day') return {start:progAnchor,end:progAnchor};
  if(progGran==='week'){
    const diffToMon=(d.getDay()+6)%7;
    const mon=new Date(d); mon.setDate(d.getDate()-diffToMon);
    const sun=new Date(mon); sun.setDate(mon.getDate()+6);
    return {start:toLocalDateStr(mon),end:toLocalDateStr(sun)};
  }
  if(progGran==='month'){
    const y=d.getFullYear(),m=d.getMonth();
    return {start:toLocalDateStr(new Date(y,m,1)),end:toLocalDateStr(new Date(y,m+1,0))};
  }
  const y=d.getFullYear();
  return {start:y+'-01-01',end:y+'-12-31'};
}
function progRangeLabel(start,end){
  if(progGran==='day') return start;
  if(progGran==='week') return start+' ~ '+end;
  if(progGran==='month') return start.slice(0,7);
  return start.slice(0,4)+'年';
}
function progShift(dir){
  const d=new Date(progAnchor+'T00:00:00');
  if(progGran==='day') d.setDate(d.getDate()+dir);
  else if(progGran==='week') d.setDate(d.getDate()+dir*7);
  else if(progGran==='month') d.setMonth(d.getMonth()+dir);
  else d.setFullYear(d.getFullYear()+dir);
  progAnchor=toLocalDateStr(d);
  loadProgress();
}
function progToday(){ progAnchor=today(); loadProgress(); }
function progSetGran(g){ progGran=g; loadProgress(); }

async function renderProgress(){
  document.getElementById('tb-title').textContent='进展记录';
  document.getElementById('ct').innerHTML=`
  <div class="phd">
    <div class="ptitle">📅 我的进展记录</div>
    <button class="btn" onclick="exportProgress()">↓ 导出Excel</button>
  </div>
  <div class="card">
    <div class="fbar" style="flex-wrap:wrap;align-items:center;gap:10px;justify-content:space-between">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div class="ttabs" id="prog-gran-tabs"></div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-sm" onclick="progShift(-1)">‹</button>
          <strong id="prog-range-label" style="min-width:150px;text-align:center;display:inline-block"></strong>
          <button class="btn btn-sm" onclick="progShift(1)">›</button>
          <button class="btn btn-sm" onclick="progToday()">今天</button>
        </div>
      </div>
      <select class="fi" id="prog-sort" style="width:120px" onchange="progSort=this.value;loadProgress()">
        <option value="desc">时间倒序</option>
        <option value="asc">时间正序</option>
      </select>
    </div>
    <div id="prog-pivot"></div>
    <div id="prog-view">加载中...</div>
  </div>`;
  document.getElementById('prog-sort').value=progSort;
  await loadProgress();
}

function renderProgGranTabs(){
  const el=document.getElementById('prog-gran-tabs');
  if(!el) return;
  const opts=[['day','日'],['week','周'],['month','月'],['year','年']];
  el.innerHTML=opts.map(([g,l])=>`<button class="ttab${progGran===g?' active':''}" onclick="progSetGran('${g}')">${l}</button>`).join('');
}

async function loadProgress(){
  renderProgGranTabs();
  const {start,end}=progRange();
  const lbl=document.getElementById('prog-range-label');
  if(lbl) lbl.textContent=progRangeLabel(start,end);
  const view=document.getElementById('prog-view');
  if(view) view.innerHTML='加载中...';
  progData=await GET(`/tasks/progress?start=${start}&end=${end}&sort=${progSort}`);
  if(!progData) return;
  renderProgPivot();
  renderProgViewBody();
}

function renderProgPivot(){
  const el=document.getElementById('prog-pivot');
  if(!el) return;
  const TYPE_SC={REQUIREMENT:'sc-blue',ISSUE:'sc-red',ONSITE:'sc-teal',OTHER:'sc-purple'};
  const types=['REQUIREMENT','ISSUE','ONSITE','OTHER'];
  el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:14px 0">
    <div class="sc sc-slate" style="text-align:center;padding:14px">
      <div style="font-size:22px;font-weight:800">${progData.totalHours}</div>
      <div style="font-size:11px;opacity:.8">总工时（小时）</div>
    </div>
    ${types.map(t=>`<div class="sc ${TYPE_SC[t]}" style="text-align:center;padding:14px">
      <div style="font-size:20px;font-weight:800">${progData.byType[t]||0}</div>
      <div style="font-size:11px;opacity:.85">${TZ[t]}</div>
    </div>`).join('')}
    <div class="sc sc-slate" style="text-align:center;padding:14px">
      <div style="font-size:22px;font-weight:800">${progData.totalLogs}</div>
      <div style="font-size:11px;opacity:.8">进展条数</div>
    </div>
  </div>`;
}

function renderProgViewBody(){
  const el=document.getElementById('prog-view');
  if(!el) return;
  if(progGran==='day') el.innerHTML=renderProgTimeline(progData.logs);
  else if(progGran==='week') el.innerHTML=renderProgWeekGrid();
  else if(progGran==='month') el.innerHTML=renderProgMonthGrid();
  else el.innerHTML=renderProgYearGrid();
}

function renderProgTimeline(logs){
  if(!logs.length) return '<div class="empty">这段时间暂无进展记录</div>';
  return `<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
    ${logs.map(l=>`<div style="display:flex;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;align-items:flex-start">
      <div style="min-width:90px;color:var(--tx3);font-size:12px;flex-shrink:0">${l.log_date}<br>${esc((l.created_at||'').slice(11,16))}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
          ${tbadge(l.task_type)}<strong style="font-size:13px">${esc(l.task_title||'')}</strong>
          ${l.progress_snapshot!=null?`<span class="bd bd-blue">${l.progress_snapshot}%</span>`:''}
          ${l.hours?`<span class="bd bd-amber">${l.hours}h</span>`:''}
        </div>
        <div style="font-size:13px;color:var(--tx2)">${esc(l.content||'')}</div>
      </div>
    </div>`).join('')}
  </div>`;
}

function renderProgWeekGrid(){
  const {start}=progRange();
  const startD=new Date(start+'T00:00:00');
  const days=[];
  for(let i=0;i<7;i++){ const d=new Date(startD); d.setDate(startD.getDate()+i); days.push(toLocalDateStr(d)); }
  return `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-top:10px">
    ${days.map(dt=>{
      const hrs=progData.byDate[dt]||0;
      const cnt=progData.logs.filter(l=>l.log_date===dt).length;
      const isToday=dt===today();
      return `<div class="card" style="padding:10px;cursor:${cnt?'pointer':'default'};margin-bottom:0;${isToday?'border-color:var(--pri)':''}" ${cnt?`onclick="openProgDayModal('${dt}')"`:''}>
        <div style="font-size:12px;color:var(--tx3)">${dt.slice(5)}</div>
        <div style="font-size:18px;font-weight:800;margin:4px 0">${hrs}h</div>
        <div style="font-size:11px;color:var(--tx2)">${cnt} 条进展</div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderProgMonthGrid(){
  const {start}=progRange();
  const [y,m]=start.split('-').map(Number);
  const first=new Date(y,m-1,1);
  const daysInMonth=new Date(y,m,0).getDate();
  const startWeekday=(first.getDay()+6)%7; // 周一=0
  const cells=[];
  for(let i=0;i<startWeekday;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(y+'-'+pad2(m)+'-'+pad2(d));
  while(cells.length%7!==0) cells.push(null);
  const weekLabels=['一','二','三','四','五','六','日'];
  let html='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:10px;font-size:12px;color:var(--tx3);text-align:center">'
    +weekLabels.map(w=>`<div>${w}</div>`).join('')+'</div>';
  html+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:4px">';
  html+=cells.map(dt=>{
    if(!dt) return '<div></div>';
    const hrs=progData.byDate[dt]||0;
    const cnt=progData.logs.filter(l=>l.log_date===dt).length;
    const isToday=dt===today();
    const intensity=hrs>0?Math.min(1,hrs/8):0;
    const bg=hrs>0?`rgba(59,130,246,${(0.12+intensity*0.35).toFixed(2)})`:'var(--s2)';
    return `<div style="padding:8px 6px;border-radius:8px;cursor:${cnt?'pointer':'default'};background:${bg};${isToday?'border:1px solid var(--pri)':'border:1px solid transparent'};min-height:56px" ${cnt?`onclick="openProgDayModal('${dt}')"`:''}>
      <div style="font-size:11px;color:var(--tx3)">${Number(dt.slice(8))}</div>
      ${hrs?`<div style="font-size:13px;font-weight:700;margin-top:2px">${hrs}h</div>`:''}
      ${cnt?`<div style="font-size:10px;color:var(--tx2)">${cnt}条</div>`:''}
    </div>`;
  }).join('');
  html+='</div>';
  return html;
}

function renderProgYearGrid(){
  const {start}=progRange();
  const y=Number(start.slice(0,4));
  const monthTotals=Array(12).fill(0);
  Object.entries(progData.byDate).forEach(([dt,h])=>{
    monthTotals[Number(dt.slice(5,7))-1]+=h;
  });
  const curY=Number(today().slice(0,4)), curM=Number(today().slice(5,7));
  return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px">
    ${monthTotals.map((hrs,i)=>{
      const mm=i+1;
      const isCur=y===curY&&mm===curM;
      const intensity=hrs>0?Math.min(1,hrs/40):0;
      const bg=hrs>0?`rgba(59,130,246,${(0.12+intensity*0.4).toFixed(2)})`:'var(--s2)';
      return `<div style="padding:16px;border-radius:10px;cursor:pointer;background:${bg};${isCur?'border:1px solid var(--pri)':'border:1px solid transparent'};text-align:center"
        onclick="progGran='month';progAnchor='${y}-${pad2(mm)}-01';loadProgress()">
        <div style="font-size:14px;color:var(--tx2)">${mm}月</div>
        <div style="font-size:20px;font-weight:800;margin-top:4px">${Math.round(hrs*100)/100}h</div>
      </div>`;
    }).join('')}
  </div>`;
}

function openProgDayModal(dt){
  const logs=progData.logs.filter(l=>l.log_date===dt);
  openModal('📅 '+dt+' 进展详情',renderProgTimeline(logs),closeModal,true);
}

async function exportProgress(){
  const {start,end}=progRange();
  const blob=await fetch(`/api/export/progress?start=${start}&end=${end}&sort=${progSort}`).then(r=>r.blob());
  dlBlob(blob,`进展记录_${start}_${end}.xlsx`);
}
