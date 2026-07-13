// ════════════════════════════════════════════
// MY CHECK-IN
// ════════════════════════════════════════════
let ciY=new Date().getFullYear(),ciM=new Date().getMonth()+1;
async function renderMyCi(){
  document.getElementById('tb-title').textContent='我的签到';
  document.getElementById('ct').innerHTML=`
  <div class="phd">
    <div class="ptitle">📅 我的签到</div>
    <div style="display:flex;gap:7px;align-items:center">
      <select class="fi" style="width:88px" onchange="ciY=parseInt(this.value);loadMyCi()">${[2024,2025,2026,2027].map(y=>`<option${y===ciY?' selected':''}>${y}</option>`).join('')}</select>
      <select class="fi" style="width:78px" onchange="ciM=parseInt(this.value);loadMyCi()">${Array.from({length:12},(_,i)=>`<option value="${i+1}"${i+1===ciM?' selected':''}>${i+1}月</option>`).join('')}</select>
      <button class="btn btn-pri" onclick="openCiModal()">✏️ 签到/修改</button>
    </div>
  </div>
  <div id="ci-ct">加载中...</div>`;
  loadMyCi();
}
async function loadMyCi(){
  const gn=ME.group_name;
  const data=await GET(`/checkin/summary/group/${encodeURIComponent(gn)}?year=${ciY}&month=${ciM}`);
  if(!data)return;
  const me=(data.members||[]).find(m=>m.memberId===ME.id);
  if(!me){document.getElementById('ci-ct').innerHTML='<div class="empty">无数据</div>';return;}
  const wd=data.totalWorkDays||0;
  const rate=wd>0?((me.presentDays+me.remoteDays)/wd*100).toFixed(1):0;
  const SL={PRESENT:'出勤',ABSENT:'缺勤',LATE:'迟到',LEAVE:'请假',REMOTE:'远程'};
  document.getElementById('ci-ct').innerHTML=`
  <div class="sgrid" style="grid-template-columns:repeat(6,1fr)">
    <div class="sc sc-teal"><div class="sl">工作日</div><div class="sv" style="font-size:20px">${wd}</div></div>
    <div class="sc sc-green"><div class="sl">出勤</div><div class="sv" style="font-size:20px">${me.presentDays}</div></div>
    <div class="sc sc-red"><div class="sl">缺勤</div><div class="sv" style="font-size:20px">${me.absentDays}</div></div>
    <div class="sc sc-amber"><div class="sl">迟到</div><div class="sv" style="font-size:20px">${me.lateDays}</div></div>
    <div class="sc sc-blue"><div class="sl">请假</div><div class="sv" style="font-size:20px">${me.leaveDays}</div></div>
    <div class="sc sc-purple"><div class="sl">出勤率</div><div class="sv" style="font-size:20px">${rate}%</div></div>
  </div>
  <div class="card">
    <div class="card-hd"><div class="ctitle">本月签到记录</div></div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">
      ${(me.checkIns||[]).map(c=>`<div class="bd ci-${c.status}" style="flex-direction:column;align-items:center;padding:6px 10px;border-radius:8px;gap:1px;min-width:54px;background:var(--s2)">
        <span style="font-weight:700">${c.check_date.slice(8)}</span>
        <span style="font-size:11px">${SL[c.status]||c.status}</span>
        ${c.remark?`<span style="font-size:10px;opacity:.65">${esc(c.remark.slice(0,6))}</span>`:''}
      </div>`).join('')||'<div class="empty" style="width:100%">本月暂无签到记录</div>'}
    </div>
  </div>`;
}
function openCiModal(){
  openModal('补充签到说明',`
  <div class="alert al-info" style="margin-bottom:14px">
    ℹ️ 签到时间由系统自动记录，无法修改。如需请假/远程，请选择对应状态。
  </div>
  <div class="fgroup"><label class="flabel">状态</label>
    <select id="ci-status" class="fi">
      <option value="PRESENT">出勤（系统自动判断是否迟到）</option>
      <option value="REMOTE">远程办公</option>
      <option value="LEAVE">请假</option>
      <option value="ABSENT">缺勤</option>
    </select></div>
  <div class="fgroup"><label class="flabel">备注（可选）</label>
    <textarea id="ci-remark" class="fi" rows="2" placeholder="如：年假、病假、居家办公..."></textarea></div>`,
  async()=>{
    const d=await POST('/checkin',{date:today(),status:gv('ci-status'),remark:gv('ci-remark'),memberId:ME.id,clientIp:CLIENT_IP});
    if(d){toast('签到成功');closeModal();loadMyCi();}
  });
}

// ════════════════════════════════════════════
// ADMIN CHECK-IN
// ════════════════════════════════════════════
let ciDayDate = today();
let ciConfig = {};

async function renderCi(){
  document.getElementById('tb-title').textContent='签到管理';
  ciConfig = await GET('/config') || {};

  var yearOpts=[2024,2025,2026,2027].map(function(y){
    return '<option'+(y===ciY?' selected':'')+'>'+y+'</option>';
  }).join('');
  var monOpts=Array.from({length:12},function(_,i){
    return '<option value="'+(i+1)+'"'+(i+1===ciM?' selected':'')+'>'+(i+1)+'\u6708</option>';
  }).join('');

  // 超级管理员可以看所有组，普通管理员只看自己的组
  var groupTabsHtml='';
  if(ME.username==='admin'){
    var allM=await GET('/members/active')||[];
    var seen={},groups=[];
    allM.forEach(function(m){if(m.group_name&&!seen[m.group_name]){seen[m.group_name]=1;groups.push(m.group_name);}});
    groups.sort();
    if(!currentGroup&&groups.length) currentGroup=groups[0];
    if(groups.length>1){
      groupTabsHtml='<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap">'
        +'<span style="font-size:12px;color:var(--tx2);font-weight:600">\u5206\u7ec4\uff1a</span>'
        +groups.map(function(g){
          var a=g===currentGroup?'background:var(--pri);color:#fff;border-color:var(--pri)':'';
          return '<button class="btn btn-sm" style="'+a+'" onclick="currentGroup=\''+g+'\';loadGroupCi()">'+g+'</button>';
        }).join('')
        +'</div>';
    }
  }

  document.getElementById('ct').innerHTML=
    '<div class="phd"><div class="ptitle">\uD83D\uDCC5 \u7b7e\u5230\u7ba1\u7406</div>'
    +'<div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">'
    +'<select class="fi" style="width:88px" onchange="ciY=parseInt(this.value);loadGroupCi()">'+yearOpts+'</select>'
    +'<select class="fi" style="width:78px" onchange="ciM=parseInt(this.value);loadGroupCi()">'+monOpts+'</select>'
    +'<button class="btn btn-pri" onclick="openDayCi()">\uD83D\uDCCB \u4eca\u65e5\u5168\u5458\u8003\u52e4</button>'
    +'<button class="btn" onclick="openCiSettings()">\u2699\uFE0F \u8fdf\u5230\u8bbe\u7f6e</button>'
    +'<button class="btn" onclick="exportCi()">\u2193 \u5bfc\u51fa</button>'
    +'</div></div>'
    +'<div id="ci-group-tabs">'+groupTabsHtml+'</div>'
    +'<div id="ci-ct">\u52a0\u8f7d\u4e2d...</div>';
  loadGroupCi();
}

async function loadGroupCi(){
  // 超级管理员用 currentGroup，普通管理员用自己的组
  let gn = ME.username==='admin' ? (currentGroup||'') : (ME.group_name||'');
  if(!gn){
    const allM=await GET('/members/active')||[];
    const first=allM.find(m=>m.group_name);
    if(first){ gn=first.group_name; if(ME.username==='admin') currentGroup=gn; }
  }
  // 刷新分组按钮高亮（超级管理员）
  if(ME.username==='admin'){
    const tabsEl=document.getElementById('ci-group-tabs');
    if(tabsEl) tabsEl.querySelectorAll('button').forEach(function(b){
      var active=b.textContent===gn;
      b.style.background=active?'var(--pri)':'';
      b.style.color=active?'#fff':'';
      b.style.borderColor=active?'var(--pri)':'';
    });
  }
  if(!gn){document.getElementById('ci-ct').innerHTML='<div class="alert al-warn">\u6682\u65e0\u6210\u5458\u6570\u636e</div>';return;}
  const data=await GET('/checkin/summary/group/'+encodeURIComponent(gn)+'?year='+ciY+'&month='+ciM);
  if(!data)return;
  // 同时获取今日签到数据
  const todayCi=await GET('/checkin/today_all?group_name='+encodeURIComponent(gn))||[];
  const todayMap={};
  todayCi.forEach(t=>{todayMap[t.memberId]=t;});
  const wd=data.totalWorkDays||0, members=data.members||[];
  const threshold = ciConfig.late_threshold || '09:00';
  document.getElementById('ci-ct').innerHTML=`
  <div class="alert al-info" style="margin-bottom:10px">
    当前迟到判定时间：<strong>${threshold}</strong>（晚于此时间签到计为迟到）
  </div>
  <div class="card"><div class="twrap"><table><thead><tr><th>成员</th><th>今日签到</th><th>签到IP</th><th>工作日</th><th>出勤</th><th>缺勤</th><th>迟到</th><th>请假</th><th>远程</th><th>出勤率</th><th>操作</th></tr></thead><tbody>
  ${members.map(m=>{
    const p=m.presentDays,rv=m.remoteDays,rate=wd>0?((p+rv)/wd*100).toFixed(1):0;
    const tci=todayMap[m.memberId];
    let todayCell='<span style="color:var(--tx3)">未签到</span>';
    let ipCell='<span style="color:var(--tx3)">-</span>';
    if(tci&&tci.status){
      const timeStr=tci.check_in_time?tci.check_in_time.slice(11,16):'';
      todayCell=sbadge(tci.status)+(timeStr?` <span style="color:var(--tx2);font-size:11px">${timeStr}</span>`:'');
      if(tci.ip_address) ipCell=`<span style="font-size:11px;color:var(--tx2);font-family:monospace">${esc(tci.ip_address)}</span>`;
    }
    const lateCell=m.lateDays>0
      ?`<span style="color:var(--warn);cursor:pointer;text-decoration:underline;font-weight:600" onclick="showLateDetail(${m.memberId},'${esc(m.memberName)}',${ciY},${ciM})">${m.lateDays}</span>`
      :`<span style="color:var(--tx2)">0</span>`;
    return`<tr>
    <td><strong>${esc(m.memberName)}</strong></td>
    <td>${todayCell}</td>
    <td>${ipCell}</td>
    <td>${wd}</td>
    <td style="color:var(--ok)">${p}</td>
    <td style="color:${m.absentDays>0?'var(--err)':'var(--tx2)'}">${m.absentDays}</td>
    <td>${lateCell}</td>
    <td>${m.leaveDays}</td><td>${rv}</td>
    <td><span class="bd ${rate>=90?'bd-green':rate>=70?'bd-amber':'bd-red'}">${rate}%</span></td>
    <td style="white-space:nowrap">
      <button class="btn btn-sm" onclick="openEditCi(${m.memberId})">修改今日</button>
      <button class="btn btn-sm" onclick="showAllCiRecords(${m.memberId},'${esc(m.memberName)}')">全部记录</button>
    </td>
    </tr>`;
  }).join('')||'<tr><td colspan="11" class="empty">暂无数据</td></tr>'}
  </tbody></table></div></div>`;
}

// 点击迟到天数弹出迟到明细
async function showLateDetail(memberId, memberName, year, month){
  const recs=await GET('/checkin/member/'+memberId+'?year='+year+'&month='+month)||[];
  const lateRecs=recs.filter(r=>r.status==='LATE');
  if(!lateRecs.length){toast('本月无迟到记录');return;}
  const rows=lateRecs.map(r=>{
    const t=r.check_in_time?r.check_in_time.slice(11,16):'--:--';
    const ip=r.ip_address?`<span style="font-size:11px;font-family:monospace;color:var(--tx2)">${esc(r.ip_address)}</span>`:'<span style="color:var(--tx3)">-</span>';
    return`<tr><td>${r.check_date}</td><td>${sbadge('LATE')}</td><td><strong style="color:var(--warn)">${t}</strong></td><td>${ip}</td><td>${esc(r.remark||'-')}</td></tr>`;
  }).join('');
  openModal(memberName+' '+year+'年'+month+'月迟到明细',
    `<div class="twrap"><table><thead><tr><th>日期</th><th>状态</th><th>打卡时间</th><th>签到IP</th><th>备注</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    null);
}

// 查看全部签到记录
async function showAllCiRecords(memberId, memberName){
  const recs=await GET('/checkin/member/'+memberId+'?year='+ciY+'&month='+ciM)||[];
  if(!recs.length){toast('本月暂无签到记录','warn');return;}
  const rows=recs.map(r=>{
    const t=r.check_in_time?r.check_in_time.slice(11,16):'--:--';
    const ip=r.ip_address?`<span style="font-size:11px;font-family:monospace;color:var(--tx2)">${esc(r.ip_address)}</span>`:'<span style="color:var(--tx3)">-</span>';
    return`<tr><td>${r.check_date}</td><td>${sbadge(r.status)}</td><td>${t}</td><td>${ip}</td><td>${esc(r.remark||'-')}</td></tr>`;
  }).join('');
  openModal(memberName+' '+ciY+'年'+ciM+'月签到记录',
    `<div class="twrap"><table><thead><tr><th>日期</th><th>状态</th><th>打卡时间</th><th>签到IP</th><th>备注</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    null);
}

// Admin: edit single member checkin with time
async function openEditCi(memberId){
  const memberName = (await GET('/members/active')||[]).find(m=>m.id===memberId)?.name || memberId;
  openModal(`修改 ${memberName} 签到`,`
  <div class="fgroup"><label class="flabel">日期</label>
    <input id="ec-date" class="fi" type="date" value="${today()}"></div>
  <div class="fgroup"><label class="flabel">签到时间（HH:MM）</label>
    <input id="ec-time" class="fi" type="time" placeholder="如 09:05" value="${new Date().toTimeString().slice(0,5)}"></div>
  <div class="fgroup"><label class="flabel">状态（留空则按时间自动判断）</label>
    <select id="ec-status" class="fi">
      <option value="">按签到时间自动判断</option>
      <option value="PRESENT">出勤</option><option value="LATE">迟到</option>
      <option value="REMOTE">远程</option><option value="LEAVE">请假</option>
      <option value="ABSENT">缺勤</option>
    </select></div>
  <div class="fgroup"><label class="flabel">备注</label>
    <textarea id="ec-remark" class="fi" rows="2"></textarea></div>`,
  async()=>{
    const payload={memberId,date:gv('ec-date'),check_in_time:gv('ec-time'),remark:gv('ec-remark')};
    const st=gv('ec-status'); if(st) payload.status=st;
    const d=await POST('/checkin',payload);
    if(d){toast(`已修改 ${memberName} 的签到：${d.status} ${d.check_in_time||''}`);closeModal();loadGroupCi();}
  });
}

// Admin: bulk day attendance - all members in one form
async function openDayCi(){
  const members=(await GET('/members/active')||[]).filter(m=>!m.is_admin);
  const threshold = ciConfig.late_threshold || '09:00';
  openModal('今日全员考勤录入',`
  <div class="alert al-info" style="margin-bottom:10px">迟到判定：晚于 <strong>${threshold}</strong> 签到视为迟到（可为每人单独指定时间）</div>
  <div class="fgroup"><label class="flabel">考勤日期</label>
    <input id="bd-date" class="fi" type="date" value="${today()}"></div>
  <div style="max-height:340px;overflow-y:auto;margin-top:6px">
  <table style="width:100%;font-size:13px;border-collapse:collapse">
    <thead><tr>
      <th style="padding:6px 8px;text-align:left;color:var(--tx2);border-bottom:1px solid var(--border)">成员</th>
      <th style="padding:6px 8px;text-align:left;color:var(--tx2);border-bottom:1px solid var(--border)">状态</th>
      <th style="padding:6px 8px;text-align:left;color:var(--tx2);border-bottom:1px solid var(--border)">到岗时间</th>
      <th style="padding:6px 8px;text-align:left;color:var(--tx2);border-bottom:1px solid var(--border)">备注</th>
    </tr></thead>
    <tbody id="bd-rows">
    ${members.map(m=>`<tr>
      <td style="padding:5px 8px;font-weight:600">${esc(m.name)}</td>
      <td style="padding:5px 8px">
        <select class="fi" id="bd-status-${m.id}" style="padding:4px 6px;font-size:12px">
          <option value="PRESENT">出勤</option>
          <option value="REMOTE">远程</option>
          <option value="LATE">迟到</option>
          <option value="LEAVE">请假</option>
          <option value="ABSENT">缺勤</option>
        </select>
      </td>
      <td style="padding:5px 8px">
        <input class="fi" id="bd-time-${m.id}" type="time" style="padding:4px 6px;font-size:12px;width:100px">
      </td>
      <td style="padding:5px 8px">
        <input class="fi" id="bd-remark-${m.id}" type="text" placeholder="备注" style="padding:4px 6px;font-size:12px;width:100%">
      </td>
    </tr>`).join('')}
    </tbody>
  </table>
  </div>`,
  async()=>{
    const dt=gv('bd-date');
    const records=members.map(m=>({
      memberId:m.id,
      status:gv('bd-status-'+m.id),
      check_in_time:gv('bd-time-'+m.id)||null,
      remark:gv('bd-remark-'+m.id)||''
    }));
    const res=await POST('/checkin/bulk',{date:dt,records});
    if(res){toast(`已录入 ${res.count} 人考勤`);closeModal();loadGroupCi();}
  },true);
}

function openCiSettings(){
  const threshold = ciConfig.late_threshold || '09:00';
  openModal('签到设置',`
  <div class="alert al-info" style="margin-bottom:14px">
    设置迟到判定时间点，精确到分钟。晚于该时间签到自动标记为"迟到"。
  </div>
  <div class="fgroup">
    <label class="flabel">迟到判定时间（HH:MM）</label>
    <input id="cfg-threshold" class="fi" type="time" value="${threshold}">
    <div style="font-size:12px;color:var(--tx3);margin-top:5px">
      当前设置：晚于 <strong>${threshold}</strong> 签到 = 迟到
    </div>
  </div>`,
  async()=>{
    const val=gv('cfg-threshold');
    if(!val){toast('请填写时间','err');return;}
    const res=await POST('/config',{late_threshold:val});
    if(res){
      ciConfig.late_threshold=val;
      toast(`迟到判定时间已更新为 ${val}`);
      closeModal();loadGroupCi();
    }
  });
}

async function exportCi(){
  const blob=await fetch(`/api/export/checkin/${encodeURIComponent(ME.group_name)}?year=${ciY}&month=${ciM}`).then(r=>r.blob());
  dlBlob(blob,`签到报表_${ciY}年${ciM}月.xlsx`);
}

