// ════════════════════════════════════════════
// TASK LIST (共用，admin全组，member自己的)
// ════════════════════════════════════════════
let taskTab='REQUIREMENT', taskPage=1, taskFilter=[], taskDmFilter='', taskNoFilter='', taskAllCache=[];
async function renderMyTasks(){
  document.getElementById('tb-title').textContent='我的任务';
  renderTaskList(false);
}
async function renderTasks(){
  document.getElementById('tb-title').textContent='任务管理';
  renderTaskList(true);
}

function renderTaskList(isAdmin){
  document.getElementById('ct').innerHTML=`
  <div class="phd">
    <div class="ptitle">${isAdmin?'📋 任务管理':'📋 我的任务'}</div>
    <div style="display:flex;gap:7px">
      ${isAdmin?`<button class="btn" onclick="exportTasks()">↓ 导出</button>`:''}
      <button class="btn btn-pri" onclick="openTaskModal(null)">＋ 新建任务</button>
    </div>
  </div>
  <div class="ttabs">
    ${[['REQUIREMENT','需求'],['ISSUE','问题单'],['ONSITE','现场支撑'],['OTHER','其他事务']].map(([t,l])=>`
      <button class="ttab${taskTab===t?' active':''}" onclick="taskTab='${t}';taskPage=1;loadTaskTable(${isAdmin})">${l}</button>`).join('')}
  </div>
  <div id="task-stats" class="sgrid" style="grid-template-columns:repeat(4,1fr)"></div>
  <div class="card">
    <div class="fbar" style="flex-wrap:wrap;align-items:center;gap:10px">
      <div id="task-status-filter" style="display:flex;gap:6px;flex-wrap:wrap"></div>
      <div id="task-dm-filter"></div>
      <div id="task-no-filter"></div>
      <span style="color:var(--tx3);font-size:13px" id="task-count"></span>
    </div>
    <div id="task-table">加载中...</div>
  </div>`;
  loadTaskTable(isAdmin);
}

async function loadTaskTable(isAdmin, page){
  taskPage=page||taskPage;
  // Sync tab button active state
  document.querySelectorAll('.ttab').forEach(btn=>{
    const t=btn.getAttribute('onclick')||'';
    const match=t.match(/taskTab='(\w+)'/);
    if(match) btn.classList.toggle('active', match[1]===taskTab);
  });
  const endpoint=isAdmin?`/tasks?type=${taskTab}`:`/tasks/mine?type=${taskTab}`;
  taskAllCache=await GET(endpoint)||[];
  taskFilter=taskFilter.filter(s=>taskStatusesFor(taskTab).includes(s));
  renderTaskFilterBar(isAdmin);
  renderTaskRows(isAdmin);
}

function renderTaskFilterBar(isAdmin){
  const statusOpts=taskStatusesFor(taskTab);
  const sfEl=document.getElementById('task-status-filter');
  if(sfEl){
    const wasOpen=document.getElementById('task-status-dd')?.style.display==='block';
    const label=taskFilter.length?`已选${taskFilter.length}项`:'全部状态';
    sfEl.innerHTML=`<div class="ms-dd" style="position:relative;display:inline-block">
      <button type="button" class="btn btn-sm" style="min-width:130px;text-align:left" onclick="toggleDropdown('task-status-dd')">状态：${label} ▾</button>
      <div id="task-status-dd" class="ms-dd-panel" style="display:${wasOpen?'block':'none'};position:absolute;top:100%;left:0;margin-top:4px;z-index:20;background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px;min-width:170px;max-height:260px;overflow:auto;box-shadow:0 4px 16px rgba(0,0,0,.25)">
        ${statusOpts.map(s=>
          `<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:4px 4px">
            <input type="checkbox" value="${s}" ${taskFilter.includes(s)?'checked':''} onchange="toggleTaskStatusFilter('${s}',this.checked,${isAdmin})" style="accent-color:var(--pri)"> ${SZ[s]||s}</label>`
        ).join('')}
        <div style="display:flex;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
          <button type="button" class="btn btn-sm" onclick="taskFilter=[];taskPage=1;renderTaskFilterBar(${isAdmin});renderTaskRows(${isAdmin})">清空</button>
          <button type="button" class="btn btn-sm" onclick="document.getElementById('task-status-dd').style.display='none'">完成</button>
        </div>
      </div>
    </div>`;
  }
  const dmEl=document.getElementById('task-dm-filter');
  if(dmEl){
    dmEl.innerHTML=taskTab==='ONSITE'?'':
      `<input class="fi" type="month" style="width:130px" value="${taskDmFilter}" onchange="taskDmFilter=this.value;taskPage=1;renderTaskRows(${isAdmin})" title="按交付月份筛选">`;
  }
  const noEl=document.getElementById('task-no-filter');
  if(noEl){
    noEl.innerHTML=(taskTab==='REQUIREMENT'||taskTab==='ISSUE')?
      `<input class="fi" style="width:160px" value="${esc(taskNoFilter)}" placeholder="按${taskTab==='ISSUE'?'问题单号':'需求单号'}搜索" oninput="taskNoFilter=this.value;taskPage=1;renderTaskRows(${isAdmin})">`:'';
  }
}

function renderTaskRows(isAdmin){
  const all=taskAllCache;
  const filtered=all.filter(t=>
    (!taskFilter.length||taskFilter.includes(t.status)) &&
    (taskTab==='ONSITE'||!taskDmFilter||t.delivery_month===taskDmFilter) &&
    (!taskNoFilter||(t.requirement_no||'').toLowerCase().includes(taskNoFilter.toLowerCase())||(t.issue_no||'').toLowerCase().includes(taskNoFilter.toLowerCase())));
  const ct=document.getElementById('task-count');
  if(ct)ct.textContent=`共 ${filtered.length} 条`;
  const statsEl=document.getElementById('task-stats');
  if(statsEl){
    const done=['DELIVERED','COMPLETED','RESOLVED','CLOSED'];
    statsEl.innerHTML=`
    <div class="sc sc-blue"><div class="sl">总计</div><div class="sv">${all.length}</div></div>
    <div class="sc sc-teal"><div class="sl">进行中</div><div class="sv">${all.filter(t=>['IN_PROGRESS','ONGOING','TESTING'].includes(t.status)).length}</div></div>
    <div class="sc sc-green"><div class="sl">已完成</div><div class="sv">${all.filter(t=>done.includes(t.status)).length}</div></div>
    <div class="sc sc-amber"><div class="sl">有风险</div><div class="sv">${all.filter(t=>t.has_risk&&!done.includes(t.status)).length}</div></div>`;
  }
  const {rows,page:p,pages}=paginate(filtered,taskPage);
  let cols='';
  if(taskTab==='REQUIREMENT') cols=`<th>需求单号</th><th>负责人</th><th>状态</th><th>进度</th><th>计划结束</th><th>交付月</th><th>风险</th>`;
  else if(taskTab==='ISSUE') cols=`<th>问题单号</th><th>严重度</th><th>负责人</th><th>状态</th><th>计划解决</th><th>超期</th>`;
  else if(taskTab==='ONSITE') cols=`<th>地点</th><th>负责人</th><th>状态</th><th>开始</th><th>结束</th>`;
  else cols=`<th>负责人</th><th>状态</th><th>进度</th><th>计划结束</th>`;
  document.getElementById('task-table').innerHTML=`
  <table><thead><tr><th>标题</th>${cols}<th>操作</th></tr></thead><tbody>
  ${rows.map(t=>{
    const isMe=t.assignee_id===ME.id||t.created_by===ME.id;
    let cells='';
    if(taskTab==='REQUIREMENT') cells=`<td>${esc(t.requirement_no||'-')}</td><td>${esc(t.assignee_name||'')}</td><td>${sbadge(t.status)}</td>
      <td style="min-width:80px"><div class="prog"><div class="pf" style="width:${t.progress||0}%;background:${t.has_risk?'var(--err)':'var(--pri)'}"></div></div><small style="color:var(--tx3)">${t.progress||0}%</small></td>
      <td style="color:${t.plan_end_date&&t.plan_end_date<today()&&t.status!=='DELIVERED'?'var(--err)':'inherit'}">${t.plan_end_date||'-'}</td>
      <td>${t.delivery_month||'-'}</td>
      <td>${t.has_risk&&!['DELIVERED','CANCELLED'].includes(t.status)?`<span style="color:var(--warn);font-size:11px">⚠ ${esc((t.risk_description||'').slice(0,12))}</span>`:'<span style="color:var(--tx3)">正常</span>'}`;
    else if(taskTab==='ISSUE') cells=`<td>${esc(t.issue_no||'-')}</td><td><span class="bd ${SEV[t.severity]||'bd-gray'}">${t.severity||''}</span></td>
      <td>${esc(t.assignee_name||'')}</td><td>${sbadge(t.status)}</td>
      <td style="color:${t.plan_end_date&&t.plan_end_date<today()&&!['RESOLVED','CLOSED'].includes(t.status)?'var(--err)':'inherit'}">${t.plan_end_date||'-'}</td>
      <td>${t.plan_end_date&&t.plan_end_date<today()&&!['RESOLVED','CLOSED','REJECTED'].includes(t.status)?'<span class="bd bd-red">超期</span>':''}`;
    else if(taskTab==='ONSITE') cells=`<td>${esc(t.location||'')}</td><td>${esc(t.assignee_name||'')}</td><td>${sbadge(t.status)}</td><td>${t.plan_start_date||'-'}</td><td>${t.plan_end_date||'-'}`;
    else cells=`<td>${esc(t.assignee_name||'')}</td><td>${sbadge(t.status)}</td>
      <td><div class="prog"><div class="pf" style="width:${t.progress||0}%;background:var(--pri)"></div></div><small style="color:var(--tx3)">${t.progress||0}%</small></td>
      <td>${t.plan_end_date||'-'}`;
    return`<tr ${isMe?'class="hi"':''}>
      <td style="max-width:160px"><strong>${t.has_risk&&!['DELIVERED','COMPLETED','RESOLVED','CLOSED'].includes(t.status)?'⚠️ ':''}</strong>
        ${isMe?'<span class="tag-me">我</span> ':''}${esc(t.title)}</td>
      ${cells}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm" onclick="openTaskModal(${t.id})">编辑</button>
        <button class="btn btn-sm" onclick="openLogPanel(${t.id})">📝 日志</button>
        ${ME.is_admin||t.created_by===ME.id?`<button class="btn btn-sm btn-err" onclick="delTask(${t.id})">删</button>`:''}
      </td>
    </tr>`;
  }).join('')||'<tr><td colspan="8" class="empty">暂无任务，点击"新建任务"开始</td></tr>'}
  </tbody></table>${pgr(p,pages,`(function(pg){taskPage=pg;renderTaskRows(${isAdmin})})`)}`;
}

function toggleTaskStatusFilter(status, checked, isAdmin){
  if(checked){ if(!taskFilter.includes(status)) taskFilter.push(status); }
  else { taskFilter=taskFilter.filter(s=>s!==status); }
  taskPage=1; renderTaskFilterBar(isAdmin); renderTaskRows(isAdmin);
}

function taskNoFieldHtml(type,t){
  if(type==='REQUIREMENT') return `<div class="fgroup"><label class="flabel">需求单号</label>
    <input id="tf-rno" class="fi" value="${esc(t.requirement_no||'')}" placeholder="关联的需求单号"></div>`;
  if(type==='ISSUE') return `<div class="fgroup"><label class="flabel">问题单号</label>
    <input id="tf-ino" class="fi" value="${esc(t.issue_no||'')}" placeholder="关联的问题单号"></div>`;
  return '';
}

// ════════════════════════════════════════════
// TASK MODAL
// ════════════════════════════════════════════
async function openTaskModal(id){
  const members=await GET('/members/active')||[];
  let t={task_type:taskTab,status:'PENDING',priority:'MEDIUM',group_name:ME.group_name};
  if(id){t=await GET('/tasks/'+id)||t;}
  const memOpts=members.filter(m=>!m.is_admin).map(m=>`<option value="${m.id}" ${t.assignee_id==m.id?'selected':''}>${esc(m.name)}</option>`).join('');
  const isIssue=t.task_type==='ISSUE', isOnsite=t.task_type==='ONSITE';
  const statuses=taskStatusesFor(t.task_type);

  openModal(id?'编辑任务':'新建任务',`
  <form id="tf">
  <div class="fgroup"><label class="flabel">任务标题 <span class="req">*</span></label>
    <input id="tf-title" class="fi" value="${esc(t.title||'')}" required></div>
  <div class="fgroup"><label class="flabel">描述</label>
    <textarea id="tf-desc" class="fi">${esc(t.description||'')}</textarea></div>
  <div class="fgroup"><label class="flabel">任务类型</label>
    <select id="tf-type" class="fi" onchange="updateTaskFormType(this.value)">
      <option value="REQUIREMENT"${t.task_type==='REQUIREMENT'?' selected':''}>需求</option>
      <option value="ISSUE"${t.task_type==='ISSUE'?' selected':''}>问题单</option>
      <option value="ONSITE"${t.task_type==='ONSITE'?' selected':''}>现场支撑</option>
      <option value="OTHER"${t.task_type==='OTHER'?' selected':''}>其他事务</option>
    </select></div>
  <div id="tf-no-wrap">${taskNoFieldHtml(t.task_type,t)}</div>
  <div class="frow c3">
    <div class="fgroup"><label class="flabel">状态</label>
      <select id="tf-status" class="fi">${statuses.map(s=>`<option value="${s}"${t.status===s?' selected':''}>${SZ[s]||s}</option>`).join('')}</select></div>
    <div class="fgroup"><label class="flabel">优先级</label>
      <select id="tf-pri" class="fi">${['LOW','MEDIUM','HIGH','CRITICAL'].map(p=>`<option${t.priority===p?' selected':''}>${p}</option>`).join('')}</select></div>
    <div id="tf-sev-prog-wrap">${isIssue?`<div class="fgroup"><label class="flabel">严重度</label>
      <select id="tf-sev" class="fi">${['LOW','MEDIUM','HIGH','CRITICAL'].map(s=>`<option${t.severity===s?' selected':''}>${s}</option>`).join('')}</select></div>`
    :`<div class="fgroup"><label class="flabel">进度(%)</label>
      <input id="tf-prog" class="fi" type="number" min="0" max="100" value="${t.progress||0}"></div>`}</div>
  </div>
  <div class="frow c2">
    <div class="fgroup"><label class="flabel">负责人（默认为自己）</label>
      <select id="tf-aid" class="fi" onchange="document.getElementById('tf-an').value=this.options[this.selectedIndex].text">
        <option value="">请选择</option>${memOpts}
      </select></div>
    <div id="tf-loc-dm-wrap">${isOnsite?`<div class="fgroup"><label class="flabel">现场地点</label>
      <input id="tf-loc" class="fi" value="${esc(t.location||'')}"></div>`
    :`<div class="fgroup"><label class="flabel">交付月份</label>
      <input id="tf-dm" class="fi" type="month" value="${t.delivery_month||''}"></div>`}</div>
  </div>
  <div class="frow c3">
    <div class="fgroup"><label class="flabel">计划开始 <span class="req">*</span></label><input id="tf-psd" class="fi" type="date" value="${t.plan_start_date||''}"></div>
    <div class="fgroup"><label class="flabel">计划${isIssue?'解决':'结束'} <span class="req">*</span></label><input id="tf-ped" class="fi" type="date" value="${t.plan_end_date||''}"></div>
    <div class="fgroup"><label class="flabel">实际完成</label><input id="tf-aed" class="fi" type="date" value="${t.actual_end_date||''}"></div>
  </div>
  <div class="frow c3">
    <div class="fgroup"><label class="flabel">预估天数</label><input id="tf-est" class="fi" type="number" min="0" placeholder="工作日" value="${t.estimated_days||0}"></div>
    <div class="fgroup"><label class="flabel">模块</label><input id="tf-mod" class="fi" value="${esc(t.module||'')}"></div>
    <div class="fgroup"><label class="flabel">版本</label><input id="tf-ver" class="fi" value="${esc(t.version||'')}"></div>
  </div>
  <div class="frow c2">
    <div class="fgroup"><label class="flabel">风险</label>
      <select id="tf-risk" class="fi" onchange="var w=document.getElementById('tf-rdesc-wrap');var on=this.value==='1';w.style.display=on?'':'none';if(!on)document.getElementById('tf-rdesc').value='';">
        <option value="0" ${!t.has_risk?'selected':''}>无风险</option><option value="1" ${t.has_risk?'selected':''}>有风险</option></select></div>
    <div class="fgroup" id="tf-rdesc-wrap" style="display:${t.has_risk?'':'none'}"><label class="flabel">风险描述</label><input id="tf-rdesc" class="fi" value="${esc(t.risk_description||'')}"></div>
  </div>
  <input id="tf-an" type="hidden" value="${esc(t.assignee_name||'')}">
  <input id="tf-gn" type="hidden" value="${esc(t.group_name||ME.group_name)}">
  </form>`,async()=>{
    const title=gv('tf-title');
    if(!title){toast('标题必填','err');return;}
    var _psd=gv('tf-psd'),_ped=gv('tf-ped');
    if(!_psd||!_ped){toast('计划开始和结束日期必填','err');return;}
    if(_psd>_ped){toast('开始日期不能晚于结束日期','err');return;}
    const payload={
      title,description:gv('tf-desc'),task_type:gv('tf-type'),
      status:gv('tf-status'),priority:gv('tf-pri'),
      severity:gv('tf-sev')||null,
      assignee_id:gv('tf-aid')||null,assignee_name:gv('tf-an'),
      delivery_month:gv('tf-dm')||null,location:gv('tf-loc')||null,
      plan_start_date:gv('tf-psd')||null,plan_end_date:gv('tf-ped')||null,
      actual_end_date:gv('tf-aed')||null,
      progress:parseInt(gv('tf-prog'))||0,
      estimated_days:parseInt(gv('tf-est'))||0,
      has_risk:parseInt(gv('tf-risk'))||0,risk_description:gv('tf-rdesc'),
      module:gv('tf-mod'),version:gv('tf-ver'),
      group_name:gv('tf-gn')||ME.group_name,
      requirement_no:gv('tf-rno')||null,issue_no:gv('tf-ino')||null,
    };
    const res=id?await PUT('/tasks/'+id,payload):await POST('/tasks',payload);
    if(res){toast(id?'更新成功':'创建成功');closeModal();
      ME.is_admin?loadTaskTable(true):loadTaskTable(false);}
  },true);
}

function updateTaskFormType(type){
  const isIssue=type==='ISSUE', isOnsite=type==='ONSITE';
  const statuses=taskStatusesFor(type);
  const sel=document.getElementById('tf-status');
  if(sel){const cur=sel.value;sel.innerHTML=statuses.map(s=>`<option value="${s}"${cur===s?' selected':''}>${SZ[s]||s}</option>`).join('');}
  const sp=document.getElementById('tf-sev-prog-wrap');
  if(sp) sp.innerHTML=isIssue?
    `<div class="fgroup"><label class="flabel">严重度</label><select id="tf-sev" class="fi"><option>LOW</option><option selected>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></div>`:
    `<div class="fgroup"><label class="flabel">进度(%)</label><input id="tf-prog" class="fi" type="number" min="0" max="100" value="0"></div>`;
  const ld=document.getElementById('tf-loc-dm-wrap');
  if(ld) ld.innerHTML=isOnsite?
    `<div class="fgroup"><label class="flabel">现场地点</label><input id="tf-loc" class="fi" value=""></div>`:
    `<div class="fgroup"><label class="flabel">交付月份</label><input id="tf-dm" class="fi" type="month" value=""></div>`;
  const nw=document.getElementById('tf-no-wrap');
  if(nw) nw.innerHTML=taskNoFieldHtml(type,{});
}

async function delTask(id){
  if(!confirm('确认删除？'))return;
  await DEL('/tasks/'+id);toast('已删除');
  ME.is_admin?loadTaskTable(true):loadTaskTable(false);
}
async function exportTasks(){
  const sm=yearStart(),em=thisMonth();
  const blob=await fetch(`/api/export/tasks/${encodeURIComponent(ME.group_name)}?type=${taskTab}&startMonth=${sm}&endMonth=${em}`).then(r=>r.blob());
  dlBlob(blob,`${TZ[taskTab]||taskTab}报表.xlsx`);
}

// ════════════════════════════════════════════
// LOG PANEL (side panel for task logs)
// ════════════════════════════════════════════
async function openLogPanel(tid){
  const [task,logs]=await Promise.all([GET('/tasks/'+tid),GET('/tasks/'+tid+'/logs')]);
  if(!task)return;
  const allLogs=logs||[];
  const canEdit=ME.is_admin||task.assignee_id===ME.id||task.created_by===ME.id;
  document.getElementById('mw').innerHTML=`
  <div class="ov" id="mov">
    <div class="modal" style="max-width:680px">
      <div class="mhd">
        <div style="flex:1;min-width:0">
          <div class="mtitle" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${tbadge(task.task_type)} ${esc(task.title)}</div>
          <div style="font-size:12px;color:var(--tx2);margin-top:2px">${sbadge(task.status)} 进度 ${task.progress||0}% · 负责人 ${esc(task.assignee_name||'未指定')}</div>
        </div>
        <button class="xbtn" onclick="closeModal()">✕</button>
      </div>
      <div class="mbd">
        ${canEdit?`<div class="card" style="margin-bottom:14px;background:var(--s3)">
          <div class="ctitle" style="margin-bottom:10px">➕ 添加工作进展</div>
          <div class="fgroup"><label class="flabel">日志日期</label><input id="lg-date" class="fi" type="date" value="${today()}"></div>
          <div class="fgroup"><label class="flabel">今日工作内容 <span class="req">*</span></label>
            <textarea id="lg-content" class="fi" rows="3" placeholder="记录今天在这个任务上做了什么..."></textarea></div>
          <div class="frow c2">
            <div class="fgroup"><label class="flabel">更新进度(%)</label>
              <input id="lg-prog" class="fi" type="number" min="0" max="100" value="${task.progress||0}" placeholder="不填则不更新"></div>
            <div class="fgroup"><label class="flabel">更新状态（可选）</label>
              <select id="lg-status" class="fi"><option value="">不更改</option>
                ${(task.task_type==='ISSUE'?['OPEN','IN_PROGRESS','RESOLVED','CLOSED']:
                   task.task_type==='REQUIREMENT'?['PENDING','IN_PROGRESS','TESTING','DELIVERED']:
                   ['PENDING','ONGOING','COMPLETED']).map(s=>`<option value="${s}">${SZ[s]||s}</option>`).join('')}
              </select></div>
          </div>
          <div class="fgroup">
            <label class="flabel">耗时（小时，可选）</label>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <input id="lg-hours" class="fi" type="number" min="0" step="0.5" style="width:90px" placeholder="0">
              <div style="display:flex;gap:5px;flex-wrap:wrap">
                ${[0.5,1,2,3,4,6,8].map(h=>`<button type="button" class="btn btn-sm" onclick="sv('lg-hours','${h}')">${h}h</button>`).join('')}
              </div>
            </div>
          </div>
          <button class="btn btn-pri" style="width:100%" onclick="submitLog(${tid})">提交进展</button>
        </div>`:''}
        <div class="ctitle" style="margin-bottom:12px">📜 历史进展记录 (${allLogs.length}条)</div>
        <div class="log-tl" id="log-list">
          ${allLogs.length?allLogs.map(l=>`
          <div class="log-item">
            <div class="log-dot"></div>
            <div class="log-hd">
              <span class="log-date">${l.log_date}</span>
              <span class="log-author">by ${esc(l.member_name||'')}</span>
              ${l.progress_snapshot!=null?`<span class="bd bd-blue" style="font-size:10px">进度 ${l.progress_snapshot}%</span>`:''}
              ${l.status_snapshot?`<span class="bd ${SC[l.status_snapshot]||'bd-gray'}" style="font-size:10px">${SZ[l.status_snapshot]||l.status_snapshot}</span>`:''}
              ${l.hours?`<span class="bd bd-teal" style="font-size:10px">耗时 ${l.hours}h</span>`:''}
            </div>
            <div class="log-body">${esc(l.content)}</div>
          </div>`).join('')
          :'<div class="empty">暂无进展记录<br><small>添加第一条工作日志</small></div>'}
        </div>
      </div>
      <div class="mft"><button class="btn btn-ghost" onclick="closeModal()">关闭</button></div>
    </div>
  </div>`;
}

async function submitLog(tid){
  const content=gv('lg-content').trim();
  if(!content){toast('请填写工作内容','err');return;}
  const prog=gv('lg-prog'); const stat=gv('lg-status'); const hrs=gv('lg-hours');
  const payload={content,log_date:gv('lg-date')};
  if(prog!=='') payload.progress=parseInt(prog);
  if(stat) payload.status=stat;
  if(hrs!=='') payload.hours=parseFloat(hrs);
  const res=await POST('/tasks/'+tid+'/logs',payload);
  if(res){toast('进展已记录');openLogPanel(tid);}
}

// ════════════════════════════════════════════
// GANTT CHART
// ════════════════════════════════════════════
let ganttYear=new Date().getFullYear(), ganttMonth=new Date().getMonth()+1;
async function renderGantt(){
  document.getElementById('tb-title').textContent='甘特图';
  document.getElementById('ct').innerHTML=`
  <div class="phd">
    <div class="ptitle">📊 任务甘特图</div>
    <div style="display:flex;gap:7px;align-items:center">
      <select class="fi" style="width:88px" onchange="ganttYear=parseInt(this.value);loadGantt()">${[2024,2025,2026,2027].map(y=>`<option${y===ganttYear?' selected':''}>${y}</option>`).join('')}</select>
      <select class="fi" style="width:78px" onchange="ganttMonth=this.value?parseInt(this.value):null;loadGantt()">
        <option value="">全年</option>
        ${Array.from({length:12},(_,i)=>`<option value="${i+1}"${i+1===ganttMonth?' selected':''}>${i+1}月</option>`).join('')}
      </select>
    </div>
  </div>
  <div id="gantt-ct">加载中...</div>`;
  loadGantt();
}

async function loadGantt(){
  const params=ganttMonth?`year=${ganttYear}&month=${ganttMonth}`:`year=${ganttYear}`;
  const tasks=await GET(`/tasks/gantt?${params}&member_id=${ME.id}`)||[];
  if(!tasks.length){
    document.getElementById('gantt-ct').innerHTML=`<div class="card"><div class="empty">暂无设置了计划日期的任务<br><small>在任务编辑中设置"计划开始"和"计划结束"日期</small></div></div>`;
    return;
  }
  // Build date range
  const startDate=ganttMonth?new Date(ganttYear,ganttMonth-1,1):new Date(ganttYear,0,1);
  const endDate=ganttMonth?new Date(ganttYear,ganttMonth,0):new Date(ganttYear,11,31);
  const totalDays=Math.ceil((endDate-startDate)/(86400000))+1;
  const todayD=new Date(today());
  const todayOff=Math.ceil((todayD-startDate)/86400000);

  // Build day headers
  const dayStep=ganttMonth?1:Math.ceil(totalDays/30);
  let dayHdrs='';
  for(let d=0;d<totalDays;d+=dayStep){
    const dt=new Date(startDate); dt.setDate(dt.getDate()+d);
    const isToday=dt.toISOString().slice(0,10)===today();
    const lbl=ganttMonth?dt.getDate():(dt.getMonth()+1)+'/'+dt.getDate();
    dayHdrs+=`<div class="gantt-day${isToday?' today':''}" style="flex:${dayStep};min-width:${ganttMonth?'20px':'24px'}">${lbl}</div>`;
  }

  const COLORS={'REQUIREMENT':'#1d4ed8','ISSUE':'#b91c1c','ONSITE':'#0e7490','OTHER':'#6d28d9'};

  const rows=tasks.map(t=>{
    const ts=new Date(t.plan_start_date), te=new Date(t.plan_end_date);
    const startOff=Math.max(0,Math.ceil((ts-startDate)/86400000));
    const endOff=Math.min(totalDays-1,Math.ceil((te-startDate)/86400000));
    const barLeft=(startOff/totalDays*100).toFixed(2);
    const barWidth=((endOff-startOff+1)/totalDays*100).toFixed(2);
    const color=t.has_risk&&!['DELIVERED','COMPLETED','RESOLVED','CLOSED'].includes(t.status)?'#92400e':COLORS[t.task_type]||'#475569';
    const done=['DELIVERED','COMPLETED','RESOLVED','CLOSED'].includes(t.status);
    return`<div class="gantt-row" onclick="openLogPanel(${t.id})" style="cursor:pointer">
      <div class="gantt-name" title="${esc(t.title)}">${tbadge(t.task_type)} ${esc(t.title)}</div>
      <div class="gantt-track">
        <div class="gantt-bar" style="left:${barLeft}%;width:${barWidth}%;background:${done?'#047857':color};opacity:${done?.7:1}"
          title="${esc(t.title)} | ${t.plan_start_date} ~ ${t.plan_end_date} | ${t.progress||0}%">
          ${t.progress||0}%
        </div>
        ${todayOff>=0&&todayOff<totalDays?`<div class="gantt-today-line" style="left:${(todayOff/totalDays*100).toFixed(2)}%"></div>`:''}
      </div>
    </div>`;
  }).join('');

  document.getElementById('gantt-ct').innerHTML=`
  <div class="card">
    <div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap;font-size:12px">
      ${Object.entries(TZ).map(([k,v])=>`<span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:12px;border-radius:3px;background:${COLORS[k]};display:inline-block"></span>${v}</span>`).join('')}
      <span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:12px;border-radius:3px;background:#92400e;display:inline-block"></span>有风险</span>
      <span style="color:var(--tx3)">· 点击任务行可查看/添加日志</span>
    </div>
    <div class="gantt-wrap">
      <div class="gantt-hdr">
        <div class="gantt-label">任务</div>
        <div class="gantt-days">${dayHdrs}</div>
      </div>
      ${rows}
    </div>
  </div>`;
}

