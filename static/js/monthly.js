// ════════════════════════════════════════════
// MONTHLY VIEW
// ════════════════════════════════════════════
let monYear=new Date().getFullYear(), monMonth=new Date().getMonth()+1, monSelMembers=[];

async function renderMonthly(){
  document.getElementById('tb-title').textContent='\u6708\u5ea6\u4efb\u52a1\u65e5\u5386';
  var allMem=(await GET('/members/active')||[]).filter(function(m){return !m.is_admin;});
  var yearOpts=[2024,2025,2026,2027].map(function(y){return '<option'+(y===monYear?' selected':'')+'>'+y+'</option>';}).join('');
  var monOpts=Array.from({length:12},function(_,i){return '<option value="'+(i+1)+'"'+(i+1===monMonth?' selected':'')+'>'+(i+1)+'\u6708</option>';}).join('');
  var filterHtml='';
  if(ME.is_admin){
    var memCbs=allMem.map(function(m){
      return '<label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--s2)"><input type="checkbox" value="'+m.id+'" onchange="toggleMonMember('+m.id+',this.checked)" style="accent-color:var(--pri)"> '+esc(m.name)+'</label>';
    }).join('');
    filterHtml='<div class="card" style="margin-bottom:10px"><div style="font-size:12px;color:var(--tx2);margin-bottom:6px">\u7b5b\u9009\u6210\u5458\uff1a</div><div style="display:flex;gap:6px;flex-wrap:wrap" id="mon-filter">'+memCbs+'</div></div>';
  }
  document.getElementById('ct').innerHTML=
    '<div class="phd"><div class="ptitle">\u6708\u5ea6\u4efb\u52a1\u65e5\u5386</div>'
    +'<div style="display:flex;gap:7px;align-items:center">'
    +'<select class="fi" style="width:88px" onchange="monYear=parseInt(this.value);loadMonthly()">'+yearOpts+'</select>'
    +'<select class="fi" style="width:78px" onchange="monMonth=parseInt(this.value);loadMonthly()">'+monOpts+'</select>'
    +'</div></div>'+filterHtml+'<div id="mon-content">\u52a0\u8f7d\u4e2d...</div>';
  loadMonthly();
}

function toggleMonMember(mid,checked){
  if(checked){if(!monSelMembers.includes(mid))monSelMembers.push(mid);}
  else monSelMembers=monSelMembers.filter(x=>x!==mid);
  loadMonthly();
}

async function loadMonthly(){
  const mids=monSelMembers.length?monSelMembers.join(','):'';
  var gn=currentGroup||ME.group_name;
  if(!gn){var allM2=await GET('/members/active')||[];var fi=allM2.find(function(m){return m.group_name;});if(fi)gn=fi.group_name;}
  var params='year='+monYear+'&month='+monMonth+'&group_name='+encodeURIComponent(gn)+(mids?'&member_ids='+mids:'');
  const data=await GET('/tasks/monthly_view?'+params);
  if(!data)return;
  const {tasks,dates}=data;
  if(!tasks.length){
    document.getElementById('mon-content').innerHTML='<div class="card"><div class="empty">本月暂无任务</div></div>';
    return;
  }
  // Only show work days + weekend indicator
  const dateHeaders=dates.map(d=>{
    const dt=new Date(d); const wd=dt.getDay();
    const isToday=d===today();
    const isWeekend=wd===0||wd===6;
    return{date:d,day:dt.getDate(),isToday,isWeekend,dow:['日','一','二','三','四','五','六'][wd]};
  });

  let table=`<div class="twrap"><table class="mon-table"><thead><tr>
    <th style="text-align:left;padding:6px 8px;min-width:140px;position:sticky;left:0;background:var(--s2);z-index:3">任务</th>
    <th style="padding:6px 4px;min-width:50px">类型/负责人</th>
    <th style="padding:6px 4px;min-width:60px">状态/进度</th>
    ${dateHeaders.map(h=>`<th style="background:${h.isToday?'rgba(59,130,246,.25)':h.isWeekend?'rgba(255,255,255,.03)':'var(--s2)'};color:${h.isToday?'var(--pri)':h.isWeekend?'var(--tx3)':'var(--tx2)'};min-width:26px">${h.day}<br><span style="font-size:9px">${h.dow}</span></th>`).join('')}
  </tr></thead><tbody>`;

  for(const t of tasks){
    const done=['DELIVERED','COMPLETED','RESOLVED','CLOSED'].includes(t.status);
    table+=`<tr>
      <td class="task-name" title="${esc(t.title)}">${tbadge(t.task_type)} ${esc(t.title)}</td>
      <td style="padding:5px 4px;font-size:11px;color:var(--tx2)">${esc(t.assignee_name||'')}</td>
      <td style="padding:5px 4px">${sbadge(t.status)}<br><small style="color:var(--tx3)">${t.progress||0}%</small></td>`;
    const logsByDate=t.logs_by_date||{};
    for(const {date,isWeekend} of dateHeaders){
      const taskStart=t.plan_start_date||'', taskEnd=t.plan_end_date||'';
      const inRange=(!taskStart||date>=taskStart)&&(!taskEnd||date<=taskEnd);
      const logs=logsByDate[date]||[];
      const hasLog=logs.length>0;
      let cellClass='', cellTitle='', cellContent='';
      if(!inRange){
        cellClass=''; cellContent='';
      }else if(done){
        cellClass='mon-cell-done'; cellContent='✓';
      }else if(hasLog){
        cellClass='mon-cell-log';
        cellTitle=logs.map(l=>l.content).join(' | ').slice(0,100);
        cellContent=`<span title="${esc(cellTitle)}" style="font-size:10px">📝${logs.length>1?logs.length:''}</span>`;
      }else if(inRange&&!isWeekend){
        cellClass='mon-cell-nolog'; cellContent='·';
      }
      table+=`<td class="${cellClass}" title="${esc(cellTitle)}" onclick="${hasLog?`showMonLog('${date}',${t.id})`:''}">
        ${cellContent}
      </td>`;
    }
    table+='</tr>';
  }
  table+='</tbody></table></div>';

  // Summary: active days per task
  const legend=`<div style="display:flex;gap:12px;font-size:12px;margin-bottom:10px;flex-wrap:wrap">
    <span><span style="display:inline-block;width:14px;height:14px;background:rgba(16,185,129,.15);border-radius:3px;vertical-align:middle"></span> 有进展记录</span>
    <span><span style="display:inline-block;width:14px;height:14px;background:rgba(245,158,11,.08);border-radius:3px;vertical-align:middle"></span> 计划中未投入</span>
    <span><span style="display:inline-block;width:14px;height:14px;background:rgba(16,185,129,.06);border-radius:3px;vertical-align:middle"></span> 已完成</span>
    <span style="color:var(--tx3)">点击📝格子可查看当日进展</span>
  </div>`;

  document.getElementById('mon-content').innerHTML=`<div class="card">${legend}${table}</div>`;
}

async function showMonLog(date,taskId){
  const logs=await GET('/tasks/'+taskId+'/logs')||[];
  const dayLogs=logs.filter(l=>l.log_date===date);
  if(!dayLogs.length){toast('当日暂无进展记录');return;}
  const task=await GET('/tasks/'+taskId);
  openModal(`${date} · ${esc(task?.title||'')} 进展`,
    dayLogs.map(l=>`<div style="padding:10px;background:var(--s2);border-radius:8px;margin-bottom:8px">
      <div style="font-size:12px;color:var(--tx2);margin-bottom:4px">by ${esc(l.member_name||'')} · 进度 ${l.progress_snapshot||0}%</div>
      <div style="font-size:13px">${esc(l.content)}</div>
    </div>`).join(''),
    ()=>closeModal());
}

