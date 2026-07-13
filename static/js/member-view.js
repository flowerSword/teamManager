// ════════════════════════════════════════════
// MEMBER VIEW (admin: per-person task+log view)
// ════════════════════════════════════════════
let mvSelMembers=[], mvDate='', mvAllMembers=[];
async function renderMemberView(){
  document.getElementById('tb-title').textContent='成员视图';
  mvAllMembers=(await GET('/members/active')||[]).filter(m=>!m.is_admin);
  document.getElementById('ct').innerHTML=`
  <div class="phd">
    <div class="ptitle">👥 成员视图</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <input class="fi" type="date" value="${mvDate||today()}" style="width:140px" onchange="mvDate=this.value;loadMemberView()" placeholder="筛选日期">
      <button class="btn btn-sm btn-ghost" onclick="mvDate='';loadMemberView()">清除日期</button>
    </div>
  </div>
  <div class="card" style="margin-bottom:12px">
    <div style="font-size:12px;color:var(--tx2);margin-bottom:8px">选择成员（不选则显示全部）：</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap" id="mv-member-filter">
      ${mvAllMembers.map(m=>`<label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--s2)" id="mvlbl-${m.id}">
        <input type="checkbox" value="${m.id}" onchange="toggleMvMember(${m.id},this.checked)" style="accent-color:var(--pri)"> ${esc(m.name)}
      </label>`).join('')}
      <button class="btn btn-sm" onclick="selectAllMv()">全选</button>
      <button class="btn btn-sm btn-ghost" onclick="mvSelMembers=[];loadMemberView()">清除</button>
    </div>
  </div>
  <div id="mv-content">加载中...</div>`;
  loadMemberView();
}

function toggleMvMember(mid,checked){
  if(checked){if(!mvSelMembers.includes(mid))mvSelMembers.push(mid);}
  else mvSelMembers=mvSelMembers.filter(x=>x!==mid);
  loadMemberView();
}
function selectAllMv(){
  mvSelMembers=mvAllMembers.map(m=>m.id);
  document.querySelectorAll('#mv-member-filter input[type=checkbox]').forEach(cb=>cb.checked=true);
  loadMemberView();
}

async function loadMemberView(){
  const mids=mvSelMembers.length?mvSelMembers.join(','):'';
  const params=`group_name=${encodeURIComponent(ME.group_name)}${mids?'&member_ids='+mids:''}${mvDate?'&date='+mvDate:''}`;
  const data=await GET('/tasks/by_member?'+params)||[];
  const cols=Math.min(data.length,3);
  const gridStyle=`grid-template-columns:repeat(${cols||1},1fr)`;
  const dateLabel=mvDate?`筛选日期：${mvDate}`:'（显示全部任务，今日状态）';
  document.getElementById('mv-content').innerHTML=`
  <div style="font-size:12px;color:var(--tx2);margin-bottom:10px">${dateLabel} · 共 ${data.length} 人</div>
  <div class="mv-grid" style="${gridStyle}">
  ${data.map(({member,tasks})=>{
    const activeTasks=tasks.filter(t=>!['DELIVERED','COMPLETED','RESOLVED','CLOSED','CANCELLED','REJECTED'].includes(t.status));
    const todayLogs=tasks.filter(t=>t.has_today_log);
    const dateLogs=mvDate?tasks.filter(t=>t.has_date_log):[];
    return`<div class="mv-member-card">
      <div class="mv-member-hd">
        <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--pri),var(--acc));display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${member.name.slice(0,1)}</div>
        <span>${esc(member.name)}</span>
        <span style="font-size:11px;color:var(--tx3)">${esc(member.role||'')}</span>
        <span style="margin-left:auto;font-size:11px">${activeTasks.length}个进行中</span>
        ${mvDate?`<span class="bd ${dateLogs.length>0?'bd-green':'bd-amber'}" style="font-size:10px">${dateLogs.length>0?'当日有进展':'当日无进展'}</span>`
        :`<span class="bd ${todayLogs.length>0?'bd-green':'bd-amber'}" style="font-size:10px">${todayLogs.length}个今日有进展</span>`}
      </div>
      <div class="mv-tasks">
        ${activeTasks.length===0?'<div style="color:var(--tx3);font-size:12px;padding:8px 0">暂无进行中任务</div>':''}
        ${activeTasks.map(t=>{
          const checkDate=mvDate||today();
          const hasLog=mvDate?t.has_date_log:t.has_today_log;
          const recentLogs=(t.logs||[]).slice(0,2);
          return`<div class="mv-task-row ${hasLog?'has-log-today':'no-log-today'}" onclick="openLogPanel(${t.id})" style="cursor:pointer">
            <div style="flex:1;min-width:0">
              <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500">${tbadge(t.task_type)} ${esc(t.title)}</div>
              <div style="font-size:11px;color:var(--tx2);margin-top:2px">${sbadge(t.status)} 进度${t.progress||0}% · ${t.plan_end_date||'无截止'}</div>
              ${recentLogs.length>0&&hasLog?`<div style="font-size:11px;color:var(--ok);margin-top:2px">📝 ${esc((recentLogs[0].content||'').slice(0,40))}</div>`:''}
            </div>
            <span class="bd ${hasLog?'bd-green':'bd-amber'}" style="flex-shrink:0;font-size:10px">${hasLog?'✓':'⚠'}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('')||'<div class="empty">暂无数据</div>'}
  </div>`;
}

