// ════════════════════════════════════════════
// TEAM VIEW (member read-only)
// ════════════════════════════════════════════
async function renderTeamView(){
  document.getElementById('tb-title').textContent='团队视图';
  document.getElementById('ct').innerHTML='<div style="color:var(--tx2);padding:60px;text-align:center">加载中...</div>';
  const [tasks,members]=await Promise.all([GET('/tasks'),GET('/members/active')]);
  const t=tasks||[], m=members||[];
  const active=t.filter(x=>!['DELIVERED','COMPLETED','RESOLVED','CLOSED','CANCELLED','REJECTED'].includes(x.status));
  const risk=t.filter(x=>x.has_risk&&!['DELIVERED','COMPLETED','RESOLVED','CLOSED','CANCELLED'].includes(x.status));
  document.getElementById('ct').innerHTML=`
  <div class="sgrid">
    <div class="sc sc-blue"><div class="sl">团队成员</div><div class="sv">${m.filter(x=>!x.is_admin).length}</div></div>
    <div class="sc sc-teal"><div class="sl">进行中任务</div><div class="sv">${active.length}</div></div>
    <div class="sc sc-amber"><div class="sl">风险任务</div><div class="sv">${risk.length}</div></div>
    <div class="sc sc-red"><div class="sl">问题单</div><div class="sv">${t.filter(x=>x.task_type==='ISSUE'&&['OPEN','IN_PROGRESS'].includes(x.status)).length}</div></div>
  </div>
  ${risk.length>0?`<div class="alert al-warn">⚠️ 团队有 ${risk.length} 个任务存在风险</div>`:''}
  <div class="card">
    <div class="card-hd"><div class="ctitle">进行中任务一览</div></div>
    <div class="twrap"><table><thead><tr><th>任务</th><th>类型</th><th>负责人</th><th>状态</th><th>进度</th><th>截止</th></tr></thead><tbody>
    ${active.slice(0,15).map(x=>`<tr ${x.assignee_id===ME.id||x.created_by===ME.id?'class="hi"':''}>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${x.assignee_id===ME.id||x.created_by===ME.id?'<span class="tag-me">我</span> ':''}
        ${x.has_risk?'⚠️ ':''}${esc(x.title)}
      </td>
      <td>${tbadge(x.task_type)}</td>
      <td>${esc(x.assignee_name||'')}</td>
      <td>${sbadge(x.status)}</td>
      <td style="min-width:80px"><div class="prog"><div class="pf" style="width:${x.progress||0}%;background:${x.has_risk?'var(--err)':'var(--pri)'}"></div></div><small style="color:var(--tx3)">${x.progress||0}%</small></td>
      <td style="color:${x.plan_end_date&&x.plan_end_date<today()?'var(--err)':'inherit'}">${x.plan_end_date||'-'}</td>
    </tr>`).join('')||'<tr><td colspan="6" class="empty">暂无进行中任务</td></tr>'}
    </tbody></table></div>
  </div>`;
}

// ════════════════════════════════════════════
// TEAM (admin)
// ════════════════════════════════════════════
let memPage=1;
async function renderTeam(){
  document.getElementById('tb-title').textContent='成员管理';
  document.getElementById('ct').innerHTML=`
  <div class="phd"><div class="ptitle">👥 成员管理</div>
    <div style="display:flex;gap:8px">
      <button class="btn" onclick="openGroupManager()">🏷️ 分组管理</button>
      <button class="btn btn-pri" onclick="openMemModal(null)">＋ 添加成员</button>
    </div>
  </div>
  <div class="card"><div id="mem-tbl">加载中...</div></div>`;
  loadTeam();
}

// ── 分组管理 ─────────────────────────────────
async function openGroupManager(){
  await renderGroupManagerBody();
}
async function renderGroupManagerBody(){
  const groups=await GET('/groups')||[];
  const row=g=>`<div style="display:flex;gap:6px;align-items:center;padding:8px;border:1px solid var(--border);border-radius:6px;margin-bottom:6px">
    <input class="fi" id="grp-name-${g.id}" value="${esc(g.name)}" style="flex:1">
    <span style="font-size:12px;color:var(--tx3);white-space:nowrap">${g.member_count} 人</span>
    <button class="btn btn-sm" onclick="saveGroupRename(${g.id})">保存</button>
    <button class="btn btn-sm btn-err" ${g.member_count>0?'disabled title="分组下还有成员，无法删除"':''} onclick="delGroup(${g.id})">删除</button>
  </div>`;
  const body=`<div style="display:flex;flex-direction:column">
    ${groups.length?groups.map(row).join(''):'<div class="empty">暂无分组</div>'}
    <div style="display:flex;gap:6px;margin-top:4px">
      <input class="fi" id="grp-new-name" placeholder="新分组名称" style="flex:1">
      <button class="btn btn-pri btn-sm" onclick="addGroup()">＋ 新增分组</button>
    </div>
  </div>`;
  openModal('🏷️ 分组管理',body,closeModal,true);
}
async function addGroup(){
  const name=gv('grp-new-name');
  if(!name){toast('请输入分组名称','err');return;}
  const res=await POST('/groups',{name});
  if(res){toast('添加成功');renderGroupManagerBody();}
}
async function saveGroupRename(id){
  const name=gv('grp-name-'+id);
  if(!name){toast('分组名称不能为空','err');return;}
  const res=await PUT('/groups/'+id,{name});
  if(res){toast('保存成功');renderGroupManagerBody();loadTeam();}
}
async function delGroup(id){
  if(!confirm('确认删除该分组？'))return;
  await DEL('/groups/'+id);
  toast('已删除');renderGroupManagerBody();
}
async function loadTeam(page){
  memPage=page||memPage;
  const all=await GET('/members')||[];
  const {rows,page:p,pages}=paginate(all,memPage);
  document.getElementById('mem-tbl').innerHTML=`
  <table><thead><tr><th>姓名</th><th>用户名</th><th>工号</th><th>角色</th><th>所在组</th><th>权限</th><th>状态</th><th>操作</th></tr></thead><tbody>
  ${rows.map(m=>`<tr>
    <td><strong>${esc(m.name)}</strong></td><td style="color:var(--tx2)">${esc(m.username)}</td>
    <td>${esc(m.employee_no||'')}</td>
    <td><span class="bd bd-blue">${esc(m.role||'')}</span></td>
    <td>${esc(m.group_name||'')}</td>
    <td>${m.is_admin?'<span class="bd bd-purple">管理员</span>':'<span class="bd bd-gray">成员</span>'}${m.can_cross_group?' <span class="bd bd-teal" title="可跨组建任务">跨组</span>':''}</td>
    <td>${m.is_active?'<span class="bd bd-green">在职</span>':'<span class="bd bd-red">停用</span>'}</td>
    <td style="white-space:nowrap">
      <button class="btn btn-sm" onclick="openMemModal(${m.id})">编辑</button>
      ${m.username!=='admin'?`<button class="btn btn-sm btn-err" onclick="delMem(${m.id})">停用</button>`:''}
    </td>
  </tr>`).join('')||'<tr><td colspan="8" class="empty">暂无成员</td></tr>'}
  </tbody></table>${pgr(p,pages,'loadTeam')}`;
}
async function openMemModal(id){
  let m={is_active:true,role:'DEVELOPER',group_name:ME.group_name};
  const groupsReq=GET('/groups');
  if(id){const all=await GET('/members')||[];m=all.find(x=>x.id===id)||m;}
  const groupRows=await groupsReq||[];
  const groups=groupRows.map(g=>g.name);
  if(m.group_name&&!groups.includes(m.group_name)) groups.push(m.group_name);
  const roles=['LEADER','DEVELOPER','TESTER','PM','DESIGNER','DEVOPS','OTHER'];
  openModal(id?'编辑成员':'添加成员',`
  <div class="frow c2">
    <div class="fgroup"><label class="flabel">姓名 <span class="req">*</span></label><input id="mf-name" class="fi" value="${esc(m.name||'')}"></div>
    <div class="fgroup"><label class="flabel">用户名 <span class="req">*</span></label><input id="mf-uname" class="fi" value="${esc(m.username||'')}"></div>
  </div>
  <div class="frow c2">
    <div class="fgroup"><label class="flabel">${id?'重置密码（留空不改）':'初始密码（默认123456）'}</label><input id="mf-pw" class="fi" type="password"></div>
    <div class="fgroup"><label class="flabel">邮箱</label><input id="mf-email" class="fi" value="${esc(m.email||'')}"></div>
  </div>
  <div class="frow c3">
    <div class="fgroup"><label class="flabel">角色</label>
      <select id="mf-role" class="fi">${roles.map(r=>`<option${m.role===r?' selected':''}>${r}</option>`).join('')}</select></div>
    <div class="fgroup"><label class="flabel">所在组</label>
      <select id="mf-gn" class="fi">${groups.map(g=>`<option${m.group_name===g?' selected':''}>${g}</option>`).join('')}</select></div>
    <div class="fgroup"><label class="flabel">状态</label>
      <select id="mf-active" class="fi"><option value="1" ${m.is_active!==false?'selected':''}>在职</option><option value="0" ${m.is_active===false?'selected':''}>停用</option></select></div>
  </div>
  <div class="frow c2">
    <div class="fgroup"><label class="flabel">工号</label><input id="mf-empno" class="fi" value="${esc(m.employee_no||'')}"></div>
    <div class="fgroup"><label class="flabel">管理员权限</label>
      <select id="mf-admin" class="fi"><option value="0" ${!m.is_admin?'selected':''}>普通成员</option><option value="1" ${m.is_admin?'selected':''}>管理员</option></select></div>
  </div>
  <div class="frow c2">
    <div class="fgroup"><label class="flabel">跨组建任务权限</label>
      <select id="mf-cross-group" class="fi"><option value="0" ${!m.can_cross_group?'selected':''}>无（仅本组）</option><option value="1" ${m.can_cross_group?'selected':''}>允许（可为任意组成员建任务）</option></select></div>
  </div>`,
  async()=>{
    const name=gv('mf-name'),username=gv('mf-uname');
    if(!name||!username){toast('姓名用户名必填','err');return;}
    const payload={name,username,email:gv('mf-email'),role:gv('mf-role'),group_name:gv('mf-gn'),
      employee_no:gv('mf-empno'),
      is_admin:gv('mf-admin')==='1',is_active:gv('mf-active')==='1',can_cross_group:gv('mf-cross-group')==='1'};
    const pw=gv('mf-pw'); if(pw)payload.password=pw; else if(!id)payload.password='123456';
    const res=id?await PUT('/members/'+id,payload):await POST('/members',payload);
    if(res){toast(id?'更新成功':'添加成功');closeModal();loadTeam();}
  });
}
async function delMem(id,hardDelete){
  if(hardDelete){
    if(!confirm('确认永久删除该成员？此操作不可恢复')) return;
    var res=await fetch('/api/members/'+id+'/delete',{method:'DELETE'});
    if(res.ok){toast('已永久删除');loadTeam();}
    else{var d=await res.json();toast(d.error||'删除失败','err');}
  }else{
    if(!confirm('确认停用该成员？'))return;
    await DEL('/members/'+id);toast('已停用');loadTeam();
  }
}

