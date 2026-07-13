// ════════════════════════════════════════════
// REPORTS (admin)
// ════════════════════════════════════════════
let rptTab='DELIVERY', rptStart=yearStart(), rptEnd=thisMonth(), rptYear=new Date().getFullYear();
let rptTimeStart=thisMonth(), rptTimeEnd=thisMonth();
let rptSelMembers=[];  // selected member ids for filter
let rptTimeMember=null;  // single selected member id for time-allocation report
let rptMembersCache=[];  // non-admin members for current group (checkbox filters), rebuilt on renderReports()
let rptTimeMembersCache=[];  // all active members (incl. admins) for current group, used by TIMELOG dropdown

async function renderReports(){
  document.getElementById('tb-title').textContent='报表中心';
  const isAdminView=ME.is_admin&&VIEW_MODE==='admin';
  var gn=isAdminView?(currentGroup||ME.group_name):ME.group_name;
  var groupBtns='';
  if(isAdminView){
    if(!gn){const allM=await GET('/members/active')||[];const fi=allM.find(function(m){return m.group_name;});if(fi){gn=fi.group_name;currentGroup=gn;}}
    const allM2=await GET('/members/active')||[];
    const allMembers=allM2.filter(function(m){return !m.is_admin&&(!gn||m.group_name===gn);});
    rptMembersCache=allMembers;
    rptTimeMembersCache=allM2.filter(function(m){return !gn||m.group_name===gn;});
    // 获取所有分组供选择
    const seen={},groups=[];
    allM2.forEach(function(m){if(m.group_name&&!seen[m.group_name]){seen[m.group_name]=1;groups.push(m.group_name);}});
    groups.sort();
    groupBtns=groups.length>1?('<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">'
      +'<span style="font-size:12px;color:var(--tx2);font-weight:600">分组：</span>'
      +groups.map(function(g){var a=g===gn?'background:var(--pri);color:#fff;border-color:var(--pri)':'';return '<button class="btn btn-sm" style="'+a+'" onclick="currentGroup=\''+g+'\';renderReports()">'+g+'</button>';}).join('')
      +'</div>'):'';
  }
  var tabBtns=[['DELIVERY','交付排名'],['REQUIREMENT','需求'],['ISSUE','问题单'],['ONSITE','现场支撑'],['OTHER','其他'],['TIMELOG','工时统计'],['CI','签到']].map(function(tb){
    return '<button class="ttab'+(rptTab===tb[0]?' active':'')+'" id="rtab-'+tb[0]+'" onclick="switchRptTab(\''+tb[0]+'\')">'+tb[1]+'</button>';
  }).join('');
  document.getElementById('ct').innerHTML=
    '<div class="phd"><div class="ptitle">📈 报表中心</div>'
    +'<div id="rpt-range" style="display:flex;gap:7px;align-items:center;flex-wrap:wrap"></div></div>'
    +'<div class="card">'
    +groupBtns
    +(isAdminView?'':'<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">📌 仅展示本人相关数据</div>')
    +'<div class="ttabs" style="margin-bottom:14px">'+tabBtns+'</div>'
    +'<div id="rpt-filter" style="margin-bottom:12px"></div>'
    +'<div id="rpt-ct">加载中...</div></div>';
  loadRpt();
}

function toggleRptMember(mid, checked){
  if(checked){ if(!rptSelMembers.includes(mid)) rptSelMembers.push(mid); }
  else { rptSelMembers=rptSelMembers.filter(x=>x!==mid); }
  loadRpt();
}

function switchRptTab(tab){
  rptTab=tab;
  document.querySelectorAll('[id^="rtab-"]').forEach(b=>b.classList.toggle('active',b.id==='rtab-'+tab));
  loadRpt();
}
async function loadRpt(){
  const el=document.getElementById('rpt-ct');if(!el)return;
  const isAdminView=ME.is_admin&&VIEW_MODE==='admin';
  var gn=isAdminView?(currentGroup||ME.group_name):ME.group_name;
  if(isAdminView&&!gn){const allM=await GET('/members/active')||[];const fi=allM.find(function(m){return m.group_name;});if(fi)gn=fi.group_name;}
  const memberFilter=rptSelMembers.length?rptSelMembers.join(','):'';

  // Sync tab UI
  document.querySelectorAll('.ttab').forEach(b=>{
    const m=b.getAttribute('onclick')||'';
    const match=m.match(/rptTab='(\w+)'/);
    if(match) b.classList.toggle('active',match[1]===rptTab);
  });

  // Month range: TIMELOG tab defaults to current month (rptTimeStart/rptTimeEnd), other tabs keep year-to-date (rptStart/rptEnd)
  const rangeEl=document.getElementById('rpt-range');
  if(rangeEl){
    if(rptTab==='TIMELOG'){
      rangeEl.innerHTML='<input class="fi" type="month" value="'+rptTimeStart+'" style="width:130px" onchange="rptTimeStart=this.value;loadRpt()">'
        +'<span style="color:var(--tx2);font-size:13px">至</span>'
        +'<input class="fi" type="month" value="'+rptTimeEnd+'" style="width:130px" onchange="rptTimeEnd=this.value;loadRpt()">';
    }else{
      rangeEl.innerHTML='<input class="fi" type="month" value="'+rptStart+'" style="width:130px" onchange="rptStart=this.value;loadRpt()">'
        +'<span style="color:var(--tx2);font-size:13px">至</span>'
        +'<input class="fi" type="month" value="'+rptEnd+'" style="width:130px" onchange="rptEnd=this.value;loadRpt()">';
    }
  }

  // Filter panel (single-member select for TIMELOG, multi-checkbox otherwise; locked to self for non-admin view)
  const filterEl=document.getElementById('rpt-filter');
  if(filterEl){
    if(rptTab==='TIMELOG'){
      if(isAdminView){
        if(!rptTimeMember||!rptTimeMembersCache.some(m=>m.id===rptTimeMember)){
          rptTimeMember=rptTimeMembersCache.length?rptTimeMembersCache[0].id:null;
        }
        filterEl.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:6px">选择成员（查看该成员的工时分配）：</div>'
          +'<select class="fi" style="width:180px" onchange="rptTimeMember=parseInt(this.value);loadRpt()">'
          +rptTimeMembersCache.map(m=>`<option value="${m.id}"${m.id===rptTimeMember?' selected':''}>${esc(m.name)}${m.is_admin?'（管理员）':''}</option>`).join('')
          +'</select>';
      }else{
        rptTimeMember=ME.id;
        filterEl.innerHTML=`<div style="font-size:12px;color:var(--tx2)">当前查看：<strong>${esc(ME.name)}</strong>（仅可查看本人工时）</div>`;
      }
    }else if(isAdminView){
      filterEl.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:6px">筛选成员（不选则显示全部）：</div>'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap">'
        +rptMembersCache.map(m=>`<label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--s2)" id="rml-${m.id}">`
          +`<input type="checkbox" value="${m.id}" ${rptSelMembers.includes(m.id)?'checked':''} onchange="toggleRptMember(${m.id},this.checked)" style="accent-color:var(--pri)"> ${esc(m.name)}</label>`).join('')
        +'</div>';
    }else{
      filterEl.innerHTML='';
    }
  }

  // ── TIME ALLOCATION (single member) ───────────────────────
  if(rptTab==='TIMELOG'){
    if(!rptTimeMember){el.innerHTML='<div class="empty">暂无成员数据</div>';return;}
    const params=`member_id=${rptTimeMember}&startMonth=${rptTimeStart}&endMonth=${rptTimeEnd}`;
    const data=await GET(`/stats/timelog?${params}`);if(!data)return;
    const byTask=data.byTask||[], byType=data.byType||{}, byDate=data.byDate||{};
    const TYPE_COLORS={REQUIREMENT:'#3b82f6',ISSUE:'#ef4444',ONSITE:'#06b6d4',OTHER:'#8b5cf6'};
    const maxTaskHours=Math.max(1,...byTask.map(t=>t.hours));
    const typeTotal=Object.values(byType).reduce((a,b)=>a+b,0)||1;
    const dateEntries=Object.entries(byDate).sort((a,b)=>a[0]<b[0]?-1:1);
    const maxDateHours=Math.max(1,...dateEntries.map(([,v])=>v));
    el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <strong>工时统计 · ${esc(data.memberName||'')}</strong>
      <span style="font-size:12px;color:var(--tx2)">${rptTimeStart} ~ ${rptTimeEnd}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
      <div class="sc sc-slate" style="text-align:center;padding:14px">
        <div style="font-size:22px;font-weight:800">${data.totalHours}</div>
        <div style="font-size:11px;opacity:.75">总计耗时（小时）</div>
      </div>
      <div class="sc sc-slate" style="text-align:center;padding:14px">
        <div style="font-size:22px;font-weight:800">${data.totalWorkDays}</div>
        <div style="font-size:11px;opacity:.75">区间工作日数</div>
      </div>
      <div class="sc sc-slate" style="text-align:center;padding:14px">
        <div style="font-size:22px;font-weight:800">${data.avgHoursPerWorkday}</div>
        <div style="font-size:11px;opacity:.75">日均工时（小时/工作日）</div>
      </div>
    </div>
    <div class="ctitle" style="margin-bottom:10px">⏱ 时间分配（按事务类型）</div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px;font-size:12px">
      ${Object.keys(TYPE_COLORS).map(k=>`<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:${TYPE_COLORS[k]};display:inline-block"></span>${TZ[k]}</span>`).join('')}
    </div>
    <div style="display:flex;border-radius:6px;overflow:hidden;height:24px;margin-bottom:6px;background:var(--s2)">
      ${Object.entries(byType).map(([k,v])=>`<div title="${TZ[k]||k}: ${v}h" style="width:${(v/typeTotal*100).toFixed(1)}%;background:${TYPE_COLORS[k]||'#64748b'}"></div>`).join('')}
    </div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--tx2);margin-bottom:20px">
      ${Object.entries(byType).map(([k,v])=>`<span>${TZ[k]||k} ${v}h（${(v/typeTotal*100).toFixed(0)}%）</span>`).join('')||'暂无数据'}
    </div>
    <div class="ctitle" style="margin-bottom:10px">📅 每日耗时分布</div>
    <div style="margin-bottom:20px">
      ${dateEntries.length?dateEntries.map(([d,v])=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:5px">
        <div style="width:80px;font-size:11px;color:var(--tx2)">${d}</div>
        <div style="flex:1;background:var(--s2);border-radius:4px;height:16px;overflow:hidden">
          <div style="width:${(v/maxDateHours*100).toFixed(1)}%;height:100%;background:var(--pri)"></div>
        </div>
        <div style="width:36px;font-size:11px;color:var(--tx2)">${v}h</div>
      </div>`).join(''):'<div class="empty">暂无记录</div>'}
    </div>
    <div class="ctitle" style="margin-bottom:10px">📋 各需求/任务耗时明细</div>
    <div class="card" style="background:var(--s2)">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr>
        <th style="padding:9px 11px;text-align:left;color:var(--tx2);border-bottom:1px solid var(--border)">任务</th>
        <th style="padding:9px 11px;text-align:center;color:var(--tx2);border-bottom:1px solid var(--border);width:90px">类型</th>
        <th style="padding:9px 11px;text-align:center;color:var(--tx2);border-bottom:1px solid var(--border);width:70px">日志数</th>
        <th style="padding:9px 11px;text-align:left;color:var(--tx2);border-bottom:1px solid var(--border)">耗时</th>
      </tr></thead>
      <tbody>
      ${byTask.map(t=>`<tr>
        <td style="padding:9px 11px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.title||'')}</td>
        <td style="padding:9px 11px;text-align:center">${tbadge(t.taskType)}</td>
        <td style="padding:9px 11px;text-align:center;color:var(--tx2)">${t.logCount}</td>
        <td style="padding:9px 11px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;background:var(--s1);border-radius:4px;height:8px;max-width:160px">
              <div style="width:${(t.hours/maxTaskHours*100).toFixed(1)}%;height:100%;background:${TYPE_COLORS[t.taskType]||'var(--pri)'};border-radius:4px"></div>
            </div>
            <span style="font-weight:600;flex-shrink:0">${t.hours}h</span>
          </div>
        </td>
      </tr>`).join('')||'<tr><td colspan="4" class="empty">暂无耗时记录</td></tr>'}
      </tbody>
    </table>
    </div>`;
    return;
  }

  // ── DELIVERY RANKING ──────────────────────────────────────
  if(rptTab==='DELIVERY'){
    const params=`group_name=${encodeURIComponent(gn)}&startMonth=${rptStart}&endMonth=${rptEnd}${memberFilter?'&member_ids='+memberFilter:''}`;
    const data=await GET(`/stats/delivery?${params}`);if(!data)return;
    const members=data.members||[], top3=data.top3||[];
    const medals=['🥇','🥈','🥉'];
    el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <strong>需求准点交付排名</strong>
      <span style="font-size:12px;color:var(--tx2)">${rptStart} ~ ${rptEnd} · 共 ${members.length} 人</span>
    </div>
    ${top3.length?`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
      ${top3.map((m,i)=>`
      <div class="sc ${i===0?'sc-amber':i===1?'sc-slate':'sc-slate'}" style="text-align:center;padding:18px 12px">
        <div style="font-size:28px;margin-bottom:6px">${medals[i]}</div>
        <div style="font-size:15px;font-weight:800">${esc(m.memberName)}</div>
        <div style="font-size:24px;font-weight:800;margin:8px 0">${m.onTimeRate}%</div>
        <div style="font-size:11px;opacity:.75">准时率 · ${m.onTime}/${m.delivered} 准时交付</div>
        <div style="font-size:11px;opacity:.65;margin-top:3px">共 ${m.total} 个需求</div>
      </div>`).join('')}
    </div>`:''}
    <div class="card" style="background:var(--s2)">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr>
        <th style="padding:9px 11px;text-align:center;color:var(--tx2);border-bottom:1px solid var(--border);width:36px">排名</th>
        <th style="padding:9px 11px;text-align:left;color:var(--tx2);border-bottom:1px solid var(--border)">成员</th>
        <th style="padding:9px 11px;text-align:center;color:var(--tx2);border-bottom:1px solid var(--border)">总需求</th>
        <th style="padding:9px 11px;text-align:center;color:var(--tx2);border-bottom:1px solid var(--border)">已交付</th>
        <th style="padding:9px 11px;text-align:center;color:var(--tx2);border-bottom:1px solid var(--border)">准时</th>
        <th style="padding:9px 11px;text-align:center;color:var(--tx2);border-bottom:1px solid var(--border)">延迟</th>
        <th style="padding:9px 11px;text-align:center;color:var(--tx2);border-bottom:1px solid var(--border)">进行中</th>
        <th style="padding:9px 11px;text-align:center;color:var(--tx2);border-bottom:1px solid var(--border)">准时率</th>
      </tr></thead>
      <tbody>
      ${members.map((m,i)=>{
        const rateColor=m.onTimeRate>=90?'var(--ok)':m.onTimeRate>=70?'var(--warn)':'var(--err)';
        return`<tr ${i<3?'style="background:rgba(59,130,246,.04)"':''}>
          <td style="padding:9px 11px;text-align:center;font-size:16px">${medals[i]||i+1}</td>
          <td style="padding:9px 11px;font-weight:600">${esc(m.memberName)}</td>
          <td style="padding:9px 11px;text-align:center">${m.total}</td>
          <td style="padding:9px 11px;text-align:center;color:var(--ok)">${m.delivered}</td>
          <td style="padding:9px 11px;text-align:center;color:var(--ok)">${m.onTime}</td>
          <td style="padding:9px 11px;text-align:center;color:${m.lateDelivery>0?'var(--err)':'var(--tx2)'}">${m.lateDelivery}</td>
          <td style="padding:9px 11px;text-align:center;color:var(--tx2)">${m.inProgress}</td>
          <td style="padding:9px 11px;text-align:center">
            <span style="font-size:15px;font-weight:700;color:${rateColor}">${m.onTimeRate}%</span>
            <div style="width:100%;background:var(--s1);border-radius:4px;height:4px;margin-top:4px">
              <div style="width:${m.onTimeRate}%;height:100%;background:${rateColor};border-radius:4px"></div>
            </div>
          </td>
        </tr>`;
      }).join('')||'<tr><td colspan="8" class="empty">暂无交付数据</td></tr>'}
      </tbody>
    </table>
    </div>`;
    return;
  }

  // ── ANNUAL CI ─────────────────────────────────────────────
  if(rptTab==='CI'){
    const data=await GET(`/checkin/summary/annual/${encodeURIComponent(gn)}?year=${rptYear}`);if(!data)return;
    el.innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <strong>全年出勤趋势</strong>
      <select class="fi" style="width:86px" onchange="rptYear=parseInt(this.value);loadRpt()">
        ${[2024,2025,2026,2027].map(y=>`<option${y===rptYear?' selected':''}>${y}</option>`).join('')}
      </select>
      ${isAdminView?`<button class="btn btn-sm" onclick="exportCi()">↓ 导出</button>`:''}
    </div>
    ${(data.monthlyData||[]).map(m=>{
      const total=(m.members||[]).reduce((s,mm)=>s+(mm.presentDays||0)+(mm.remoteDays||0),0);
      const wd=m.totalWorkDays||0,mc=m.memberCount||1;
      const rate=wd>0?(total/(wd*mc)*100):0;
      const rateF=rate.toFixed(1);
      const color=rate>=90?'#10b981':rate>=70?'#f59e0b':'#ef4444';
      return`<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
        <div style="width:36px;font-size:12px;color:var(--tx2)">${m.month}月</div>
        <div style="flex:1;background:var(--s2);border-radius:4px;height:20px;overflow:hidden">
          <div style="width:${rateF}%;height:100%;background:${color};display:flex;align-items:center;padding-left:6px;font-size:11px;color:rgba(255,255,255,.8)">${rateF}%</div>
        </div>
        <div style="width:38px;font-size:12px;color:var(--tx2)">${rateF}%</div>
      </div>`;
    }).join('')}`;
    return;
  }

  // ── TASK MONTHLY CHART ────────────────────────────────────
  const data=await GET(`/tasks/stats/${encodeURIComponent(gn)}?type=${rptTab}&startMonth=${rptStart}&endMonth=${rptEnd}`);
  if(!data)return;
  const months=Object.keys(data.monthlyStats||{}).sort();
  const COLORS={PENDING:'#475569',IN_PROGRESS:'#3b82f6',TESTING:'#f59e0b',DELIVERED:'#10b981',
    CANCELLED:'#374151',OPEN:'#f59e0b',RESOLVED:'#10b981',CLOSED:'#475569',REJECTED:'#374151',
    ONGOING:'#06b6d4',COMPLETED:'#10b981'};
  const maxVal=Math.max(1,...months.map(m=>Object.values(data.monthlyStats[m]).reduce((a,b)=>a+b,0)));
  el.innerHTML=`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <strong>${TZ[rptTab]||rptTab}月度统计</strong>
    <div style="display:flex;gap:8px;font-size:12px;align-items:center">
      ${Object.entries(COLORS).slice(0,5).map(([s,c])=>`<span style="display:flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:2px;background:${c};display:inline-block"></span>${SZ[s]||s}</span>`).join('')}
      ${isAdminView?`<button class="btn btn-sm" onclick="exportTasks()">↓ 导出</button>`:''}
    </div>
  </div>
  ${months.map(m=>{
    const stats=data.monthlyStats[m]||{};
    const total=Object.values(stats).reduce((a,b)=>a+b,0);
    return`<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
      <div style="width:66px;font-size:12px;color:var(--tx2);text-align:right;flex-shrink:0">${m}</div>
      <div style="flex:1;background:var(--s2);border-radius:4px;height:22px;overflow:hidden;display:flex">
        ${Object.entries(stats).map(([s,v])=>`<div style="width:${(v/maxVal*100).toFixed(1)}%;background:${COLORS[s]||'#475569'};display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(255,255,255,.8)">${v>0&&total>3?v:''}</div>`).join('')}
      </div>
      <div style="width:28px;font-size:12px;color:var(--tx2)">${total}</div>
    </div>`;
  }).join('')||'<div class="empty">暂无数据</div>'}`;
}

