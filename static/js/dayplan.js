// ════════════════════════════════════════════
// DAILY PLAN (每日计划)
// ════════════════════════════════════════════
let dpDate=today(), dpTemplates=[], dpSelectedTemplate='', dpSlots=[], dpMyTasksCache=[];
let dpEditSlots=[], dpEditTplId=null;

async function renderDayPlan(){
  document.getElementById('tb-title').textContent='每日计划';
  document.getElementById('ct').innerHTML=`
  <div class="phd">
    <div class="ptitle">🗓️ 每日计划</div>
    <div style="display:flex;gap:7px;flex-wrap:wrap">
      <button class="btn" onclick="openDpHistory()">📜 历史计划</button>
      <button class="btn" onclick="openReminderManager()">⏰ 提醒事项</button>
      <button class="btn" onclick="openTemplateManager()">📋 管理模板</button>
      <button class="btn" onclick="saveTodayAsTemplate()">📌 另存为模板</button>
      <button class="btn btn-pri" onclick="saveDayPlan()">💾 保存</button>
    </div>
  </div>
  <div id="dp-reminders"></div>
  <div class="card">
    <div class="fbar" style="flex-wrap:wrap;align-items:center;gap:10px">
      <input class="fi" type="date" style="width:150px" value="${dpDate}" onchange="dpDate=this.value;loadDpDay()">
      <select class="fi" id="dp-tpl-sel" style="width:180px"></select>
      <button class="btn btn-sm" onclick="applyDpTemplate()">应用模板</button>
      <button class="btn btn-sm" onclick="addDpSlot()">＋ 添加时间段</button>
    </div>
    <div id="dp-grid">加载中...</div>
  </div>`;
  const [tpls,mytasks]=await Promise.all([GET('/plan/templates'),GET('/tasks/mine')]);
  dpTemplates=tpls||[]; dpMyTasksCache=mytasks||[];
  renderDpTemplateOptions();
  await loadDpDay();
}

function renderDpTemplateOptions(){
  const sel=document.getElementById('dp-tpl-sel');
  if(!sel) return;
  sel.innerHTML='<option value="">选择模板…</option>'+dpTemplates.map(t=>
    `<option value="${t.id}" ${String(dpSelectedTemplate)===String(t.id)?'selected':''}>${esc(t.name)}</option>`).join('');
  sel.onchange=function(){dpSelectedTemplate=this.value;};
}

async function loadDpDay(){
  const grid=document.getElementById('dp-grid');
  if(grid) grid.innerHTML='加载中...';
  const res=await GET('/plan/day/'+dpDate)||{slots:[]};
  dpSlots=(res.slots||[]).map(s=>({start_time:s.start_time,end_time:s.end_time,content:s.content||'',task_id:s.task_id||'',completed:!!s.completed,progress:s.progress,hours:s.hours||0}));
  dpActiveReminders=res.reminders||[];
  renderDpGrid();
  renderDpReminderAlerts();
}

// ── 提醒事项（提前录入截止日/待办，临近时在每日计划中提醒）──────
let dpActiveReminders=[], dpReminders=[];
function renderDpReminderAlerts(){
  const el=document.getElementById('dp-reminders');
  if(!el) return;
  if(!dpActiveReminders.length){el.innerHTML='';return;}
  el.innerHTML=dpActiveReminders.map(r=>{
    const label=r.is_overdue?`<span style="color:#f87171;font-weight:700">已逾期 ${Math.abs(r.days_left)} 天</span>`
      :r.days_left===0?`<span style="color:#f87171;font-weight:700">今天截止</span>`
      :`<span style="color:#fbbf24;font-weight:700">还剩 ${r.days_left} 天（${r.due_date}）</span>`;
    return `<div class="alert ${r.is_overdue||r.days_left===0?'al-warn':'al-info'}" style="justify-content:space-between;flex-wrap:wrap">
      <span>⏰ ${esc(r.content)} · ${label}</span>
      <span style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-sm" onclick="addReminderToPlan(${r.id})">＋ 加入计划</button>
        <button class="btn btn-sm" onclick="markReminderDone(${r.id})">✓ 标记完成</button>
      </span>
    </div>`;
  }).join('');
}
function addReminderToPlan(rid){
  const r=dpActiveReminders.find(x=>x.id===rid);
  if(!r) return;
  dpSlots.push({start_time:'',end_time:'',content:r.content,task_id:''});
  renderDpGrid();
  toast('已加入当天计划，请填写时间段后保存');
}
async function markReminderDone(rid){
  await PUT('/plan/reminders/'+rid,{status:'DONE'});
  toast('已标记完成');
  loadDpDay();
}

async function openReminderManager(){
  dpReminders=await GET('/plan/reminders')||[];
  renderReminderManagerBody();
}
function renderReminderManagerBody(){
  const pending=dpReminders.filter(r=>r.status==='PENDING').sort((a,b)=>a.due_date<b.due_date?-1:1);
  const done=dpReminders.filter(r=>r.status==='DONE');
  const row=r=>{
    const d=new Date(r.due_date), left=Math.round((d-new Date(today()))/86400000);
    const leftLabel=r.status==='DONE'?'<span style="color:var(--tx3)">已完成</span>':
      left<0?`<span style="color:#f87171">已逾期 ${Math.abs(left)} 天</span>`:
      left===0?'<span style="color:#f87171">今天截止</span>':`<span style="color:var(--tx3)">还剩 ${left} 天</span>`;
    return `<div class="reminder-row${r.status==='DONE'?' is-done':''}">
      <div class="rr-main">
        <div class="rr-content">${esc(r.content)}</div>
        <div class="rr-meta">截止 ${r.due_date} · 提前 ${r.remind_days} 天提醒 · ${leftLabel}</div>
      </div>
      <span class="rr-actions">
        ${r.status==='PENDING'?`<button class="btn btn-sm" onclick="markReminderDoneInMgr(${r.id})">✓ 完成</button>`:`<button class="btn btn-sm" onclick="reopenReminder(${r.id})">↺ 恢复</button>`}
        <button class="btn btn-sm" onclick="openReminderEditor(${r.id})">编辑</button>
        <button class="btn btn-sm btn-err" onclick="delPlanReminder(${r.id})">删除</button>
      </span>
    </div>`;
  };
  const body=`<div style="display:flex;flex-direction:column">
    ${pending.length?pending.map(row).join(''):'<div class="empty">暂无待办提醒</div>'}
    ${done.length?`<details class="reminder-done-toggle"><summary>已完成 (${done.length})</summary>${done.map(row).join('')}</details>`:''}
    <button class="btn btn-pri" style="margin-top:10px" onclick="openReminderEditor(null)">＋ 新建提醒</button>
  </div>`;
  openModal('⏰ 提醒事项（截止日/待办）',body,closeModal,true);
}
async function markReminderDoneInMgr(id){
  await PUT('/plan/reminders/'+id,{status:'DONE'});
  dpReminders=await GET('/plan/reminders')||[];
  renderReminderManagerBody();
  if(document.getElementById('dp-reminders')) loadDpDay();
}
async function reopenReminder(id){
  await PUT('/plan/reminders/'+id,{status:'PENDING'});
  dpReminders=await GET('/plan/reminders')||[];
  renderReminderManagerBody();
  if(document.getElementById('dp-reminders')) loadDpDay();
}
async function delPlanReminder(id){
  if(!confirm('确认删除该提醒？')) return;
  await DEL('/plan/reminders/'+id);
  dpReminders=await GET('/plan/reminders')||[];
  renderReminderManagerBody();
  if(document.getElementById('dp-reminders')) loadDpDay();
}
let dpEditReminderId=null;
function openReminderEditor(id){
  dpEditReminderId=id;
  const r=id?dpReminders.find(x=>x.id===id):{content:'',due_date:today(),remind_days:2};
  const body=`<div class="fgroup"><label class="flabel">事项内容</label><input id="pr-content" class="fi" value="${esc(r.content||'')}" placeholder="例如：提交周报 / XX需求验收"></div>
  <div class="frow c2">
    <div class="fgroup"><label class="flabel">截止日期 / 需要做的那天</label><input id="pr-due" class="fi" type="date" value="${r.due_date||today()}"></div>
    <div class="fgroup"><label class="flabel">提前几天开始提醒</label><input id="pr-days" class="fi" type="number" min="0" max="30" value="${r.remind_days!=null?r.remind_days:2}"></div>
  </div>`;
  openModal(id?'编辑提醒':'新建提醒',body,saveReminderEditor,true);
}
async function saveReminderEditor(){
  const content=gv('pr-content'), due_date=gv('pr-due'), remind_days=parseInt(gv('pr-days')||'2');
  if(!content){toast('事项内容不能为空','err');return;}
  if(!due_date){toast('请选择日期','err');return;}
  const payload={content,due_date,remind_days};
  const res=dpEditReminderId?await PUT('/plan/reminders/'+dpEditReminderId,payload):await POST('/plan/reminders',payload);
  if(res){
    toast('保存成功');
    dpReminders=await GET('/plan/reminders')||[];
    renderReminderManagerBody();
    if(document.getElementById('dp-reminders')) loadDpDay();
  }
}


// ── 拖拽排序支持 ──────────────────────────────
let dpDragIdx=null;

function dpDragStart(e,i){
  // 阻止在输入框/按钮上误触拖拽
  if(e.target.closest('input,button,select,textarea')){e.preventDefault();return;}
  dpDragIdx=i;
  const tr=e.currentTarget;
  tr.classList.add('dp-dragging');
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain','');
  // 设置拖拽图像为行本身，避免默认的幽灵图
  if(tr){const rect=tr.getBoundingClientRect();e.dataTransfer.setDragImage(tr,rect.width/2,rect.height/2);}
}

let dpDragOverKey=null;

function dpDragOver(e,i){
  e.preventDefault();
  if(dpDragIdx===null||dpDragIdx===i) return;
  const rows=document.querySelectorAll('#dp-table tbody tr');
  const row=rows[i];
  if(!row) return;
  const rect=row.getBoundingClientRect();
  const before=(e.clientY-rect.top)<rect.height/2;
  const key=i+(before?'b':'a');
  if(key===dpDragOverKey) return; // 位置未变化，跳过重复更新，避免闪烁
  dpDragOverKey=key;
  rows.forEach(r=>r.classList.remove('dp-drag-over','dp-drag-before'));
  row.classList.add(before?'dp-drag-before':'dp-drag-over');
}

function dpDragLeave(e,i){
  // Over-parent checking: only act if truly leaving the row
  const tr=e.currentTarget;
  if(!tr) return;
  const related=e.relatedTarget;
  if(related&&tr.contains(related)) return;
  tr.classList.remove('dp-drag-over','dp-drag-before');
  dpDragOverKey=null;
}

function dpDrop(e,i){
  e.preventDefault();
  if(dpDragIdx===null||dpDragIdx===i) return;
  const tr=e.target.closest('tr');
  if(!tr) return;
  const rect=tr.getBoundingClientRect();
  const pos=e.clientY-rect.top;
  let targetIdx=pos<rect.height/2?i:i+1;
  if(targetIdx>dpDragIdx) targetIdx--;
  dpSlots.splice(targetIdx,0,dpSlots.splice(dpDragIdx,1)[0]);
  dpDragIdx=null;
  dpDragOverKey=null;
  renderDpGrid();
}

function dpDragEnd(e){
  const tr=e.currentTarget;
  if(tr) tr.classList.remove('dp-dragging');
  document.querySelectorAll('#dp-table tbody tr').forEach(r=>r.classList.remove('dp-drag-over','dp-drag-before'));
  dpDragIdx=null;
  dpDragOverKey=null;
}

function renderDpGrid(){
  const grid=document.getElementById('dp-grid');
  if(!grid) return;
  if(!dpSlots.length){grid.innerHTML='<div class="empty">当天暂无计划，选择模板后点击"应用模板"生成时间段，或点击"添加时间段"手动新增</div>';return;}
  grid.innerHTML=`<table id="dp-table"><thead><tr><th style="width:32px"></th><th style="width:210px">时间段</th><th>内容</th><th style="width:180px">关联任务</th><th style="width:150px">进度/工时</th><th style="width:60px">完成</th><th style="width:60px"></th></tr></thead><tbody>
  ${dpSlots.map((s,i)=>{
    const st=dpMyTasksCache.find(t=>String(t.id)===String(s.task_id));
    return `<tr draggable="true"
      ondragstart="dpDragStart(event,${i})"
      ondragover="dpDragOver(event,${i})"
      ondragleave="dpDragLeave(event,${i})"
      ondrop="dpDrop(event,${i})"
      ondragend="dpDragEnd(event)">
    <td class="dp-handle" title="拖拽排序"><span class="dp-grip"></span></td>
    <td><input class="fi" type="time" style="width:90px;display:inline-block" value="${s.start_time||''}" onchange="dpSlots[${i}].start_time=this.value">
      ~ <input class="fi" type="time" style="width:90px;display:inline-block" value="${s.end_time||''}" onchange="dpSlots[${i}].end_time=this.value"></td>
    <td><input class="fi" value="${esc(s.content||'')}" onchange="dpSlots[${i}].content=this.value" placeholder="这个时间段做什么"></td>
    <td><button type="button" class="btn btn-sm" style="max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block" title="${esc(st?st.title:'')}" onclick="openDpTaskPicker(${i})">${st?esc(st.title):'不关联'}</button></td>
    <td>${st?`<div style="display:flex;gap:4px">
      <input class="fi" type="number" min="0" max="100" style="width:65px" placeholder="进度%" value="${s.progress!=null?s.progress:''}" onchange="dpSlots[${i}].progress=this.value?parseInt(this.value):null">
      <input class="fi" type="number" min="0" step="0.5" style="width:65px" placeholder="工时h" value="${s.hours||''}" onchange="dpSlots[${i}].hours=parseFloat(this.value)||0">
    </div>${st.progress!=null?`<div style="font-size:11px;color:var(--tx2);margin-top:3px">当前任务进度：${st.progress}%</div>`:''}`:''}</td>
    <td><input type="checkbox" ${s.completed?'checked':''} onchange="toggleDpSlotComplete(${i},this.checked)"></td>
    <td><button class="btn btn-sm btn-err" onclick="removeDpSlot(${i})">删</button></td>
  </tr>`;
  }).join('')}
  </tbody></table>`;
}

async function toggleDpSlotComplete(i,checked){
  dpSlots[i].completed=checked;
  if(checked&&dpSlots[i].task_id){
    const payload={content:'每日计划：'+(dpSlots[i].content||'完成'),log_date:dpDate};
    if(dpSlots[i].progress!=null&&dpSlots[i].progress!=='') payload.progress=dpSlots[i].progress;
    if(dpSlots[i].hours) payload.hours=dpSlots[i].hours;
    await POST('/tasks/'+dpSlots[i].task_id+'/logs',payload);
    if(payload.progress!=null){
      const t=dpMyTasksCache.find(x=>String(x.id)===String(dpSlots[i].task_id));
      if(t) t.progress=parseInt(payload.progress);
      renderDpGrid();
    }
    toast('已同步到任务进展');
  }
  await saveDayPlan();
}

function addDpSlot(){ dpSlots.push({start_time:'',end_time:'',content:'',task_id:''}); renderDpGrid(); }
function removeDpSlot(i){ dpSlots.splice(i,1); renderDpGrid(); }

// ── 关联任务选择器（支持按状态/交付月份/标题关键字搜索）──────
let dpPickIdx=null, dpPickStatus='', dpPickMonth='', dpPickKw='';
function openDpTaskPicker(i){
  dpPickIdx=i; dpPickStatus=''; dpPickMonth=today().slice(0,7); dpPickKw='';
  const statusOpts=[...new Set(dpMyTasksCache.map(t=>t.status))];
  const body=`<div class="frow c3" style="margin-bottom:8px">
    <div class="fgroup"><label class="flabel">状态</label>
      <select id="dpp-status" class="fi" onchange="dpPickStatus=this.value;renderDpPickList()">
        <option value="">全部状态</option>${statusOpts.map(s=>`<option value="${s}">${SZ[s]||s}</option>`).join('')}
      </select></div>
    <div class="fgroup"><label class="flabel">交付月份</label>
      <input id="dpp-month" class="fi" type="month" value="${dpPickMonth}" onchange="dpPickMonth=this.value;renderDpPickList()"></div>
    <div class="fgroup"><label class="flabel">标题关键字</label>
      <input id="dpp-kw" class="fi" placeholder="模糊搜索标题" oninput="dpPickKw=this.value;renderDpPickList()"></div>
  </div>
  <div style="margin-bottom:8px"><button type="button" class="btn btn-sm" onclick="selectDpTask(null)">✕ 清除关联</button></div>
  <div id="dpp-list" style="max-height:320px;overflow:auto"></div>`;
  openModal('选择关联任务',body,closeModal,true);
  renderDpPickList();
}
function renderDpPickList(){
  const el=document.getElementById('dpp-list');
  if(!el) return;
  const kw=dpPickKw.trim().toLowerCase();
  const list=dpMyTasksCache.filter(t=>
    (!dpPickStatus||t.status===dpPickStatus) &&
    (!dpPickMonth||t.delivery_month===dpPickMonth) &&
    (!kw||(t.title||'').toLowerCase().includes(kw)));
  el.innerHTML=list.length?list.map(t=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);cursor:pointer" onclick="selectDpTask(${t.id})">
    <span>${tbadge(t.task_type)} ${esc(t.title)}</span>
    <span style="display:flex;gap:6px;align-items:center;flex-shrink:0">${sbadge(t.status)}<small style="color:var(--tx3)">${t.delivery_month||''}</small></span>
  </div>`).join(''):'<div class="empty">无匹配任务</div>';
}
function selectDpTask(tid){
  if(dpPickIdx==null) return;
  dpSlots[dpPickIdx].task_id=tid||'';
  closeModal();
  renderDpGrid();
}

async function applyDpTemplate(){
  if(!dpSelectedTemplate){toast('请先选择模板','err');return;}
  if(dpSlots.length && !confirm('应用模板将覆盖当天已填写的内容，确定继续？')) return;
  const res=await POST('/plan/day/apply_template',{date:dpDate,template_id:parseInt(dpSelectedTemplate)});
  if(res){
    dpSlots=(res.slots||[]).map(s=>({start_time:s.start_time,end_time:s.end_time,content:s.content||'',task_id:s.task_id||'',completed:!!s.completed,progress:s.progress,hours:s.hours||0}));
    renderDpGrid(); toast('已应用模板');
  }
}

async function saveDayPlan(){
  const slots=dpSlots.filter(s=>s.start_time&&s.end_time);
  const res=await POST('/plan/day',{date:dpDate,slots});
  if(res) toast('保存成功');
}

// ── 历史每日计划预览 ──────────────────────────
let dpHistMonth=today().slice(0,7);
function openDpHistory(){
  const body=`<div class="fgroup"><label class="flabel">月份</label>
    <input id="dph-month" class="fi" type="month" style="max-width:180px" value="${dpHistMonth}" onchange="dpHistMonth=this.value;loadDpHistoryList()"></div>
  <div id="dph-list" style="max-height:360px;overflow:auto;margin-top:8px"></div>`;
  openModal('📜 历史每日计划',body,closeModal,true);
  loadDpHistoryList();
}
async function loadDpHistoryList(){
  const el=document.getElementById('dph-list');
  if(!el) return;
  el.innerHTML='加载中...';
  const list=await GET('/plan/history?month='+dpHistMonth)||[];
  el.innerHTML=list.length?`<div class="dp-hist-list">${list.map(d=>{
    const done=d.completed_count||0, total=d.slot_count||0;
    const allDone=total>0&&done>=total;
    const statusTag=total?`<span class="dp-hist-status ${allDone?'is-done':'is-undone'}">${allDone?'✓ 全部完成':`已完成 ${done}/${total}`}</span>`:'';
    return `<div class="dp-hist-item" onclick="previewDpDate('${d.plan_date}')">
    <span class="dp-hist-date">${d.plan_date}${d.plan_date===today()?' <span class="tag-me">今天</span>':''}</span>
    <span style="display:flex;gap:6px;align-items:center;flex-shrink:0">${statusTag}<span class="dp-hist-count">${d.slot_count} 个时间段 ›</span></span>
  </div>`;}).join('')}</div>`:'<div class="empty">该月暂无历史计划记录</div>';
}
async function previewDpDate(dt){
  const res=await GET('/plan/day/'+dt)||{slots:[]};
  const slots=res.slots||[];
  const body=`<button class="btn btn-sm" style="margin-bottom:10px" onclick="openDpHistory()">← 返回列表</button>
  ${slots.length?`<div class="dp-hist-slots">
    ${slots.map(s=>{
      const t=dpMyTasksCache.find(x=>String(x.id)===String(s.task_id));
      const done=!!s.completed;
      return `<div class="dp-hist-slot${done?' is-done':''}">
        <span class="dp-hist-slot-flag ${done?'is-done':'is-undone'}">${done?'✓ 已完成':'未完成'}</span>
        <div class="dp-hist-slot-time">${s.start_time||''}~${s.end_time||''}</div>
        <div class="dp-hist-slot-content">${esc(s.content||'')}</div>
        ${t?`<span class="bd bd-blue" style="flex-shrink:0">${esc(t.title)}</span>`:''}
      </div>`;
    }).join('')}
  </div>`:'<div class="empty">当天暂无计划记录</div>'}`;
  openModal('📅 '+dt+' 计划预览',body,closeModal,true);
}

// ── 模板管理 ──────────────────────────────────
function openTemplateManager(){
  const body=`<div style="display:flex;flex-direction:column;gap:8px">
    ${dpTemplates.map(t=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border:1px solid var(--border);border-radius:6px">
      <span>${esc(t.name)} <small style="color:var(--tx3)">（${(t.slots||[]).length} 个时间段）</small></span>
      <span style="display:flex;gap:6px">
        <button class="btn btn-sm" onclick="openTemplateEditor(${t.id})">编辑</button>
        <button class="btn btn-sm btn-err" onclick="delPlanTemplate(${t.id})">删除</button>
      </span>
    </div>`).join('')||'<div class="empty">暂无模板</div>'}
    <button class="btn btn-pri" style="margin-top:4px" onclick="openTemplateEditor(null)">＋ 新建模板</button>
  </div>`;
  openModal('我的计划模板',body,closeModal,true);
}

function openTemplateEditor(id){
  const tpl=id?dpTemplates.find(t=>t.id===id):{name:'',slots:[]};
  dpEditTplId=id;
  dpEditSlots=(tpl.slots||[]).map(s=>({start_time:s.start_time,end_time:s.end_time,default_content:s.default_content||''}));
  const copyHtml=(!id&&dpTemplates.length)?`<div class="fgroup"><label class="flabel">从已有模板复制（可选，可复制后再修改）</label>
    <select id="tpl-copy-src" class="fi" onchange="copyTplFromExisting(this.value)">
      <option value="">不复制，从空白开始</option>
      ${dpTemplates.map(t=>`<option value="${t.id}">${esc(t.name)}（${(t.slots||[]).length} 个时间段）</option>`).join('')}
    </select></div>`:'';
  const body=`${copyHtml}<div class="fgroup"><label class="flabel">模板名称</label><input id="tpl-name" class="fi" value="${esc(tpl.name||'')}"></div>
  <div id="tpl-slots"></div>
  <button class="btn btn-sm" onclick="addTplSlotRow()">＋ 添加时间段</button>`;
  openModal(id?'编辑模板':'新建模板',body,saveTemplateEditor,true);
  renderTplSlotRows();
}

function saveTodayAsTemplate(){
  if(!dpSlots.filter(s=>s.start_time&&s.end_time).length){toast('当天暂无有效时间段可保存为模板','err');return;}
  dpEditTplId=null;
  dpEditSlots=dpSlots.filter(s=>s.start_time&&s.end_time).map(s=>({start_time:s.start_time,end_time:s.end_time,default_content:s.content||''}));
  const body=`<div class="fgroup"><label class="flabel">模板名称</label><input id="tpl-name" class="fi" value=""></div>
  <div id="tpl-slots"></div>
  <button class="btn btn-sm" onclick="addTplSlotRow()">＋ 添加时间段</button>`;
  openModal('另存为模板',body,saveTemplateEditor,true);
  renderTplSlotRows();
}

function copyTplFromExisting(srcId){
  const src=dpTemplates.find(t=>String(t.id)===String(srcId));
  dpEditSlots=src?(src.slots||[]).map(s=>({start_time:s.start_time,end_time:s.end_time,default_content:s.default_content||''})):[];
  const nameInput=document.getElementById('tpl-name');
  if(nameInput&&src&&!nameInput.value) nameInput.value=src.name+' 副本';
  renderTplSlotRows();
}

function renderTplSlotRows(){
  const el=document.getElementById('tpl-slots');
  if(!el) return;
  el.innerHTML=dpEditSlots.map((s,i)=>`<div class="frow c3" style="align-items:end">
    <div class="fgroup"><label class="flabel">开始</label><input class="fi" type="time" value="${s.start_time||''}" onchange="dpEditSlots[${i}].start_time=this.value"></div>
    <div class="fgroup"><label class="flabel">结束</label><input class="fi" type="time" value="${s.end_time||''}" onchange="dpEditSlots[${i}].end_time=this.value"></div>
    <div class="fgroup"><label class="flabel">默认内容（可选）</label><div style="display:flex;gap:6px">
      <input class="fi" value="${esc(s.default_content||'')}" onchange="dpEditSlots[${i}].default_content=this.value">
      <button class="btn btn-sm btn-err" onclick="removeTplSlotRow(${i})">删</button>
    </div></div>
  </div>`).join('')||'<div class="empty">暂无时间段，点击下方按钮添加</div>';
}

function addTplSlotRow(){ dpEditSlots.push({start_time:'',end_time:'',default_content:''}); renderTplSlotRows(); }
function removeTplSlotRow(i){ dpEditSlots.splice(i,1); renderTplSlotRows(); }

async function saveTemplateEditor(){
  const name=gv('tpl-name');
  if(!name){toast('模板名称必填','err');return;}
  const slots=dpEditSlots.filter(s=>s.start_time&&s.end_time);
  if(!slots.length){toast('至少添加一个有效时间段','err');return;}
  const payload={name,slots};
  const res=dpEditTplId?await PUT('/plan/templates/'+dpEditTplId,payload):await POST('/plan/templates',payload);
  if(res){
    toast('保存成功');
    dpTemplates=await GET('/plan/templates')||[];
    renderDpTemplateOptions();
    openTemplateManager();
  }
}

async function delPlanTemplate(id){
  if(!confirm('确认删除该模板？')) return;
  await DEL('/plan/templates/'+id);
  toast('已删除');
  dpTemplates=await GET('/plan/templates')||[];
  if(String(dpSelectedTemplate)===String(id)) dpSelectedTemplate='';
  renderDpTemplateOptions();
  openTemplateManager();
}

