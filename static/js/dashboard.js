// ════════════════════════════════════════════
// ADMIN DASHBOARD
// ════════════════════════════════════════════
async function renderAdminDash(){
  document.getElementById('tb-title').textContent='总览';
  document.getElementById('ct').innerHTML='<div style="color:var(--tx2);padding:60px;text-align:center">加载中...</div>';
  const [risk,overdue,members,todayTodos]=await Promise.all([GET('/tasks/risk'),GET('/tasks?type=ISSUE'),GET('/members/active'),GET('/tasks/today_todo')]);
  if(!risk)return;
  const rk=risk||[],mem=members||[];
  const ov=(overdue||[]).filter(i=>['OPEN','IN_PROGRESS'].includes(i.status)&&i.plan_end_date&&i.plan_end_date<today());
  document.getElementById('ct').innerHTML=`
  <div class="sgrid">
    <div class="sc sc-blue"><div class="sl">团队成员</div><div class="sv">${mem.filter(m=>!m.is_admin).length}</div><div class="ss">在职人员</div></div>
    <div class="sc sc-amber"><div class="sl">风险任务</div><div class="sv">${rk.length}</div><div class="ss">需关注</div></div>
    <div class="sc sc-red"><div class="sl">超期问题单</div><div class="sv">${ov.length}</div><div class="ss">待处理</div></div>
    <div class="sc sc-teal"><div class="sl">今日</div><div class="sv" style="font-size:18px">${new Date().toLocaleDateString('zh-CN',{month:'short',day:'numeric'})}</div><div class="ss">${['周日','周一','周二','周三','周四','周五','周六'][new Date().getDay()]}</div></div>
  </div>
  ${rk.length>0?`<div class="alert al-warn">⚠️ 当前有 <strong>${rk.length}</strong> 个任务存在风险</div>`:''}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
    <div class="card">
      <div class="card-hd"><div class="ctitle">⚠️ 风险任务</div><span class="bd bd-amber">${rk.length}</span></div>
      <div class="twrap"><table><thead><tr><th>标题</th><th>类型</th><th>负责人</th><th>进度</th></tr></thead><tbody>
      ${rk.slice(0,6).map(r=>`<tr><td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.title)}</td><td>${tbadge(r.task_type)}</td><td>${esc(r.assignee_name||'')}</td><td><div class="prog"><div class="pf" style="width:${r.progress||0}%;background:var(--err)"></div></div><small style="color:var(--tx3)">${r.progress||0}%</small></td></tr>`).join('')||'<tr><td colspan="4" class="empty">暂无风险任务 ✅</td></tr>'}
      </tbody></table></div>
    </div>
    <div class="card">
      <div class="card-hd"><div class="ctitle">🐛 超期问题单</div><span class="bd bd-red">${ov.length}</span></div>
      <div class="twrap"><table><thead><tr><th>标题</th><th>严重度</th><th>负责人</th></tr></thead><tbody>
      ${ov.slice(0,6).map(i=>`<tr><td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.title)}</td><td><span class="bd ${SEV[i.severity]||'bd-gray'}">${i.severity||''}</span></td><td>${esc(i.assignee_name||'')}</td></tr>`).join('')||'<tr><td colspan="3" class="empty">暂无超期问题单 ✅</td></tr>'}
      </tbody></table></div>
    </div>
  </div>
  ${(todayTodos||[]).length>0?`<div class='card' style='margin-top:14px'>
    <div class='card-hd'><div class='ctitle'>📌 今日全组待办 (${(todayTodos||[]).length}项)</div>
      <button class='btn btn-sm' onclick='exportTodayTodo()'>↓ 导出今日待办</button></div>
    <div class='twrap'><table><thead><tr><th>任务</th><th>类型</th><th>负责人</th><th>进度</th><th>截止</th><th>今日状态</th><th></th></tr></thead><tbody>
    ${(todayTodos||[]).map(t=>`<tr><td style='max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'><strong>${esc(t.title)}</strong></td><td>${tbadge(t.task_type)}</td><td>${esc(t.assignee_name||'')}</td><td><div class='prog'><div class='pf' style='width:${t.progress||0}%;background:var(--pri)'></div></div><small>${t.progress||0}%</small></td><td>${t.plan_end_date||'-'}</td><td>${t.has_today_log?`<span class='bd bd-green'>✓ 有进展</span>`:`<span class='bd bd-amber'>⚠ 未投入</span>`}</td><td><button class='btn btn-sm' onclick='openLogPanel(${t.id})'>📝</button></td></tr>`).join('')}
    </tbody></table></div></div>`:''}
  `;
}

// ════════════════════════════════════════════
// MEMBER DASHBOARD
// ════════════════════════════════════════════
async function renderMemberDash(){
  document.getElementById('tb-title').textContent='我的工作台';
  document.getElementById('ct').innerHTML='<div style="color:var(--tx2);padding:60px;text-align:center">加载中...</div>';
  const [myTasks,ciToday,recentLogs,todayTodos,todayPlan]=await Promise.all([GET('/tasks/mine'),GET('/checkin/today'),GET('/tasks/logs/mine?days=3'),GET('/tasks/today_todo'),GET('/plan/day/'+today())]);
  const tasks=myTasks||[], logs=recentLogs||[];
  const planSlots=(todayPlan&&todayPlan.slots)||[];
  const nowHM=new Date().toTimeString().slice(0,5);
  const active=tasks.filter(t=>!['DELIVERED','COMPLETED','RESOLVED','CLOSED','CANCELLED','REJECTED'].includes(t.status));
  const risk=tasks.filter(t=>t.has_risk&&!['DELIVERED','COMPLETED','RESOLVED','CLOSED','CANCELLED'].includes(t.status));
  const ci=ciToday;
  const ciLabel={PRESENT:'✅ 已出勤',ABSENT:'❌ 缺勤',LATE:'⏰ 迟到',LEAVE:'🏖️ 请假',REMOTE:'💻 远程办公'};
  const ciClass={PRESENT:'bd-green',ABSENT:'bd-red',LATE:'bd-amber',LEAVE:'bd-blue',REMOTE:'bd-purple'};

  document.getElementById('ct').innerHTML=`
  <div style="margin-bottom:18px">
    <div style="font-size:19px;font-weight:800;margin-bottom:3px">你好，${esc(ME.name)} 👋</div>
    <div style="color:var(--tx2);font-size:13px">${esc(ME.group_name||'')} · ${esc(ME.role||'')}</div>
  </div>
  ${risk.length>0?`<div class="alert al-warn">⚠️ 你有 <strong>${risk.length}</strong> 个任务存在风险，请尽快处理</div>`:''}
  <div class="sgrid" style="grid-template-columns:repeat(3,1fr)">
    <div class="sc sc-teal"><div class="sl">今日签到</div>
      <div class="sv" style="font-size:17px">${ci?ciLabel[ci.status]||ci.status:'未签到'}</div>
      <div class="ss">${ci?'':'点击下方快速签到'}</div>
    </div>
    <div class="sc sc-blue"><div class="sl">进行中任务</div><div class="sv">${active.length}</div><div class="ss">全部 ${tasks.length} 个</div></div>
    <div class="sc ${risk.length>0?'sc-amber':'sc-green'}"><div class="sl">风险任务</div><div class="sv">${risk.length}</div><div class="ss">${risk.length>0?'需关注':'一切正常'}</div></div>
  </div>
  ${!ci?`<div class="card">
    <div class="card-hd"><div class="ctitle">⏰ 快速签到</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${[['PRESENT','✅ 出勤','ok'],['REMOTE','💻 远程','ok'],['LATE','⏰ 迟到','warn'],['LEAVE','🏖️ 请假','info']].map(([s,l])=>`
        <button class="btn btn-pri" style="flex:1;min-width:90px;justify-content:center;padding:10px" onclick="quickCI('${s}')">${l}</button>`).join('')}
    </div>
  </div>`:''}
  <div class="card">
    <div class="card-hd"><div class="ctitle">🗓️ 今日计划</div>
      <button class="btn btn-sm" onclick="showPage('day-plan')">查看/编辑</button>
    </div>
    ${planSlots.length?`<div style="display:flex;flex-direction:column;gap:4px;max-height:220px;overflow:auto">
      ${planSlots.map(s=>{
        const isNow=s.start_time&&s.end_time&&nowHM>=s.start_time&&nowHM<s.end_time;
        const t=tasks.find(x=>String(x.id)===String(s.task_id));
        return `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;${isNow?'background:rgba(59,130,246,.15);border:1px solid var(--pri)':'border:1px solid transparent'}">
          <span style="font-size:12px;min-width:96px;font-weight:${isNow?'700':'400'};color:${isNow?'var(--pri)':'var(--tx3)'}">${s.start_time||''}~${s.end_time||''}</span>
          <span style="font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.content||'')}</span>
          ${t?`<span class="bd bd-blue" style="flex-shrink:0;font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.title)}</span>`:''}
        </div>`;
      }).join('')}
    </div>`:'<div class="empty">今天还没有制定计划<br><small>点击"查看/编辑"前往每日计划页面</small></div>'}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
    <div class="card">
      <div class="card-hd"><div class="ctitle">📋 进行中任务</div>
        <button class="btn btn-sm btn-pri" onclick="showPage('my-tasks')">查看全部</button>
      </div>
      <div class="twrap"><table><thead><tr><th>任务</th><th>类型</th><th>进度</th></tr></thead><tbody>
      ${active.slice(0,5).map(t=>`<tr ${t.has_risk?'class="hi"':''}>
        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.has_risk?'⚠️ ':''}${esc(t.title)}</td>
        <td>${tbadge(t.task_type)}</td>
        <td><div class="prog"><div class="pf" style="width:${t.progress||0}%;background:${t.has_risk?'var(--err)':'var(--pri)'}"></div></div>
        <small style="color:var(--tx3)">${t.progress||0}%</small></td>
      </tr>`).join('')||'<tr><td colspan="3" class="empty">暂无进行中任务</td></tr>'}
      </tbody></table></div>
    </div>
    <div class="card">
      <div class="card-hd"><div class="ctitle">📝 近期工作日志</div>
        <button class="btn btn-sm" onclick="showPage('my-tasks')">添加日志</button>
      </div>
      ${logs.length?logs.slice(0,4).map(l=>`
        <div style="padding:8px 0;border-bottom:1px solid var(--border2)">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
            <span style="font-size:11px;color:var(--tx3)">${l.log_date}</span>
            <span style="font-size:11px;color:var(--tx2)">${tbadge(l.task_type)}</span>
            <span style="font-size:12px;color:var(--tx);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100px">${esc(l.task_title)}</span>
          </div>
          <div style="font-size:13px;color:var(--tx2);line-height:1.5">${esc(l.content)}</div>
        </div>`).join('')
      :'<div class="empty">近期暂无工作日志<br><small>在"我的任务"里添加进展记录</small></div>'}
    </div>
  </div>`;
}


async function exportTodayTodo(){
  const todos=await GET('/tasks/today_todo')||[];
  if(!todos.length){toast('今日暂无待办','warn');return;}
  const lines2=['今日待办事项 - '+today(),''];
  todos.forEach((t,ix)=>{
    lines2.push((ix+1)+'. ['+(TZ[t.task_type]||t.task_type)+'] '+t.title);
    lines2.push('   负责人: '+(t.assignee_name||'未指定'));
    lines2.push('   时间段: '+t.plan_start_date+' ~ '+t.plan_end_date+' | 进度: '+(t.progress||0)+'%');
    lines2.push('   今日状态: '+(t.has_today_log?'✓ 已有进展记录':'⚠ 尚未记录今日进展'));
    lines2.push('');
  });
  const blob=new Blob([lines2.join('\n')],{type:'text/plain;charset=utf-8'});
  dlBlob(blob,'今日待办_'+today()+'.txt');
}

async function quickCI(status){
  // Members: PRESENT/LATE auto-detected server-side; LEAVE/REMOTE/ABSENT are explicit overrides
  const d=await POST('/checkin',{date:today(),status,memberId:ME.id,clientIp:CLIENT_IP});
  if(d){
    const label={PRESENT:'已签到 ✅',REMOTE:'远程签到 💻',LATE:'已记录迟到 ⏰',LEAVE:'请假登记 🏖️',ABSENT:'缺勤记录'}[d.status]||'签到成功';
    toast(label); renderMemberDash();
  }
}

