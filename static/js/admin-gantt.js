// ════════════════════════════════════════════
// ADMIN GANTT (multi-member)
// ════════════════════════════════════════════
let agMembers=[], agYear=new Date().getFullYear(), agMonth=new Date().getMonth()+1, agAllMembers=[];
let agFilterGroup='';
let agShowAll=true;
let agLogFilter='all';
let agHighlightDate='';
let currentGroup='';

function getYesterday(){
  var d=new Date(); d.setDate(d.getDate()-1);
  return toLocalDateStr(d);
}
// 生成日期高亮按钮（点击切换，激活时蓝色）
function makeHlBtn(label, dateStr){
  var active=agHighlightDate===dateStr;
  var cls='btn btn-sm'+(active?' btn-pri':'');
  // onclick: 再次点击同一个日期则清除，否则设置
  return '<button class="'+cls+'" onclick="agHighlightDate=agHighlightDate===\''+dateStr+'\'?\'\':\' '+dateStr+'\';agHighlightDate=agHighlightDate.trim();renderAdminGantt()">'+label+'</button>';
}

async function renderAdminGantt(){
  document.getElementById('tb-title').textContent='\u7518\u7279\u56fe\uff08\u7ba1\u7406\u5458\uff09';
  // 包含所有活跃成员（含管理员自身），超级管理员账号也可选
  agAllMembers=(await GET('/members/active')||[]);

  var yearOpts=[2024,2025,2026,2027].map(function(y){
    return '<option'+(y===agYear?' selected':'')+'>'+y+'</option>';
  }).join('');
  var monOpts='<option value="">\u5168\u5e74</option>'+Array.from({length:12},function(_,i){
    return '<option value="'+(i+1)+'"'+(i+1===agMonth?' selected':'')+'>'+(i+1)+'\u6708</option>';
  }).join('');
  // 获取所有分组
  var seen={}, agGroups=[];
  agAllMembers.forEach(function(m){if(m.group_name&&!seen[m.group_name]){seen[m.group_name]=1;agGroups.push(m.group_name);}});
  agGroups.sort();

  // 分组按钮：点击自动勾选该组所有成员
  var groupBtns='';
  if(agGroups.length>1){
    groupBtns='<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap">'
      +'<span style="font-size:12px;color:var(--tx2);font-weight:600">\u6309\u7ec4\u9009\u4eba\uff1a</span>'
      +agGroups.map(function(g){
        var ids=agAllMembers.filter(function(m){return m.group_name===g;}).map(function(m){return m.id;});
        var allSel=ids.length>0&&ids.every(function(id){return agShowAll||agMembers.includes(id);});
        var a=allSel?'background:var(--pri);color:#fff;border-color:var(--pri)':'';
        return '<button class="btn btn-sm" style="'+a+'" onclick="selectGroupMembers(\''+g+'\')">'
          +g+'<span style="font-size:10px;margin-left:4px;opacity:.75">'+ids.length+'人</span></button>';
      }).join('')
      +'</div>';
  }

  var memCbs='';
  if(agGroups.length>1){
    // 按组分组展示
    agGroups.forEach(function(g){
      var groupMembers=agAllMembers.filter(function(m){return m.group_name===g;});
      memCbs+='<div style="width:100%;display:flex;align-items:center;gap:6px;margin:4px 0 2px">'
        +'<span style="font-size:11px;font-weight:600;color:var(--tx2);white-space:nowrap">'+esc(g)+'</span>'
        +'<div style="flex:1;height:1px;background:var(--border)"></div>'
        +'</div>';
      groupMembers.forEach(function(m){
        var chk=agShowAll||agMembers.includes(m.id);
        var tag=m.is_admin?' <span style="font-size:10px;color:var(--acc)">(管)</span>':'';
        memCbs+='<label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--s2)">'
          +'<input type="checkbox" value="'+m.id+'" '+(chk?'checked':'')+' onchange="toggleAgMember('+m.id+',this.checked)" style="accent-color:var(--pri)"> '+esc(m.name)+tag+'</label>';
      });
    });
  }else{
    agAllMembers.forEach(function(m){
      var chk=agShowAll||agMembers.includes(m.id);
      var tag=m.is_admin?' <span style="font-size:10px;color:var(--acc)">(管)</span>':'';
      memCbs+='<label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--s2)">'
        +'<input type="checkbox" value="'+m.id+'" '+(chk?'checked':'')+' onchange="toggleAgMember('+m.id+',this.checked)" style="accent-color:var(--pri)"> '+esc(m.name)+tag+'</label>';
    });
  }

  // 日期高亮筛选按钮
  var t0=today(), y0=getYesterday();
  var btnToday=makeHlBtn('今天',t0);
  var btnYest=makeHlBtn('昨天',y0);
  var btnClear=agHighlightDate?'<button class="btn btn-sm btn-ghost" onclick="agHighlightDate=\'\';renderAdminGantt()">清除</button>':'';

  document.getElementById('ct').innerHTML=
    '<div class="phd">'
      +'<div class="ptitle">\uD83D\uDCCA \u7518\u7279\u56fe</div>'
      +'<div style="display:flex;gap:7px;align-items:center">'
        +'<select class="fi" style="width:88px" onchange="agYear=parseInt(this.value);loadAdminGantt()">'+yearOpts+'</select>'
        +'<select class="fi" style="width:78px" onchange="agMonth=this.value?parseInt(this.value):null;loadAdminGantt()">'+monOpts+'</select>'
      +'</div>'
    +'</div>'
    +'<div class="card" style="margin-bottom:12px">'
      +groupBtns
      +'<div style="font-size:12px;color:var(--tx2);margin-bottom:8px">\u9009\u62e9\u6210\u5458\uff08\u4e0d\u9009\u5219\u663e\u793a\u5168\u90e8\uff09\uff1a</div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap" id="ag-filter">'
        +memCbs
        +'<button class="btn btn-sm" onclick="selectAllAgMembers()">\u5168\u9009</button>'
        +'<button class="btn btn-sm btn-ghost" onclick="agMembers=[];agShowAll=false;renderAdminGantt()">\u5168\u4e0d\u9009</button>'
      +'</div>'
      +'<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
        +'<span style="font-size:12px;color:var(--tx2);font-weight:600">\u67e5\u770b\u8fdb\u5c55\uff1a</span>'
        +btnToday+btnYest
        +'<input type="date" class="fi" style="width:140px" value="'+agHighlightDate+'" onchange="agHighlightDate=this.value.trim();renderAdminGantt()">'
        +btnClear
        +(agHighlightDate?'<span style="font-size:12px;color:var(--warn)">\u9ad8\u4eae '+agHighlightDate+' \u7684\u8fdb\u5c55</span>':'')
      +'</div>'
    +'</div>'
    +'<div id="ag-content">\u52a0\u8f7d\u4e2d...</div>';

  loadAdminGantt();
}

function selectAllAgMembers(){
  agShowAll=true; agMembers=[];
  agAllMembers.forEach(function(m){agMembers.push(m.id);});
  document.querySelectorAll('#ag-filter input').forEach(function(cb){cb.checked=true;});
  loadAdminGantt();
}

// 点击分组按钮：选中该组所有成员（切换：全选→全不选）
function selectGroupMembers(groupName){
  agShowAll=false;
  var ids=agAllMembers.filter(function(m){return m.group_name===groupName;}).map(function(m){return m.id;});
  var allSel=ids.every(function(id){return agMembers.includes(id);});
  if(allSel){
    // 全部已选则取消该组
    agMembers=agMembers.filter(function(id){return !ids.includes(id);});
  }else{
    // 否则选中该组所有成员
    ids.forEach(function(id){if(!agMembers.includes(id))agMembers.push(id);});
  }
  if(agMembers.length===0) agShowAll=false;
  renderAdminGantt();
}

function toggleAgMember(mid,checked){
  if(checked){if(!agMembers.includes(mid))agMembers.push(mid);}
  else agMembers=agMembers.filter(x=>x!==mid);
  loadAdminGantt();
}

// Render gantt tracks - unified bar color (no task-type color)
function renderGanttTracks(tasks,start,end,totalDays,todayOff,dayStep,agMonth,highlightDate){
  var out='';
  for(var i=0;i<tasks.length;i++){
    var t=tasks[i];
    var ts=new Date(t.plan_start_date),te=new Date(t.plan_end_date);
    var so=Math.max(0,Math.ceil((ts-start)/86400000));
    var eo=Math.min(totalDays-1,Math.ceil((te-start)/86400000));
    var bl=(so/totalDays*100).toFixed(2),bw=Math.max(0.5,(eo-so+1)/totalDays*100).toFixed(2);
    var done=['DELIVERED','COMPLETED','RESOLVED','CLOSED'].includes(t.status);
    var color=done?'#047857':(t.has_risk?'#dc2626':'#3b82f6');
    var ld=t.log_dates||[];
    var noLog=!done&&todayOff>=0&&todayOff<totalDays&&!ld.includes(today());
    var hlRow=highlightDate&&ld.includes(highlightDate);
    var rc='gantt-row'+(noLog?' gantt-row-no-log':'')+(hlRow?' gantt-row-hl':'');
    var mk='';
    for(var j=0;j<ld.length;j++){
      var off=Math.ceil((new Date(ld[j])-start)/86400000);
      if(off<0||off>=totalDays) continue;
      var bg=ld[j]===highlightDate?'rgba(251,191,36,.85)':'rgba(16,185,129,.55)';
      mk+='<div style="position:absolute;left:'+(off/totalDays*100).toFixed(2)+'%;top:0;width:'+Math.max(0.8,(1/totalDays*100)).toFixed(2)+'%;height:100%;background:'+bg+';z-index:3;pointer-events:none" title="'+ld[j]+'"></div>';
    }
    var tl=todayOff>=0&&todayOff<totalDays?'<div class="gantt-today-line" style="left:'+(todayOff/totalDays*100).toFixed(2)+'%"></div>':'';
    var safe=esc(t.title||'');
    var lm={};(t.logs||[]).forEach(function(l){if(!lm[l.log_date])lm[l.log_date]=[];lm[l.log_date].push(l.content);});
    var lmj=JSON.stringify(lm).replace(/"/g,'&quot;');
    var ldj=JSON.stringify(ld).replace(/"/g,'&quot;');
    out+='<div class="'+rc+'" data-tid="'+t.id+'" data-title="'+safe+'" data-ld="'+ldj+'" data-lm="'+lmj+'"'
      +' onmouseenter="ganttTipFromData(event,this)" onmouseleave="hideGanttTip()"'
      +' onclick="openLogPanel('+t.id+')" style="cursor:pointer">'
      +'<div class="gantt-name" title="'+safe+'">'+tbadge(t.task_type)+' '+safe+'</div>'
      +'<div class="gantt-track">'
      +'<div class="gantt-bar" style="left:'+bl+'%;width:'+bw+'%;background:'+color+';opacity:'+(done?0.65:1)+'" title="'+safe+'">'+(t.progress||0)+'%'+(t.estimated_days?' (预估'+t.estimated_days+'天)':'')+'</div>'
      +mk+tl+'</div></div>';
  }
  return out;
}
function ganttTipFromData(event,el){
  var tid=parseInt(el.dataset.tid);
  var title=el.dataset.title||'';
  var ld=[];try{ld=JSON.parse(el.dataset.ld||'[]');}catch(e){}
  var lm={};try{lm=JSON.parse(el.dataset.lm||'{}');}catch(e){}
  showGanttTip(event,tid,title,ld,lm);
}

function buildDayHeaders(start, totalDays, dayStep, agMonth){
  let hdrs='';
  for(let d=0;d<totalDays;d+=dayStep){
    const dt=new Date(start); dt.setDate(dt.getDate()+d);
    const isToday=toLocalDateStr(dt)===today();
    const meta=ganttDayMeta(dt);
    const lbl=agMonth?dt.getDate():(dt.getMonth()+1)+'/'+dt.getDate();
    const dayCls=(isToday?' today':'')+(meta.holiday?' holiday':meta.weekend?' weekend':'');
    const dayTitle=meta.holiday?' title="'+esc(meta.holiday)+'"':(meta.weekend?' title="周末"':'');
    const holTag=(dayStep===1&&meta.holiday)?'<div class="gantt-day-tag">'+esc(meta.holiday.slice(0,2))+'</div>':'';
    hdrs+='<div class="gantt-day'+dayCls+'" style="flex:'+dayStep+';min-width:'+(agMonth?'18px':'22px')+'"'+dayTitle+'><div class="gantt-day-num">'+lbl+'</div>'+holTag+'</div>';
  }
  return hdrs;
}

const GANTT_LEGEND='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;font-size:12px">'+'<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#3b82f6"></span> 进行中</span>'+'<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#047857"></span> 已完成</span>'+'<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#dc2626"></span> 有风险</span>'+'<span><span style="display:inline-block;width:6px;height:14px;background:rgba(16,185,129,.55);vertical-align:middle"></span> 有进展</span>'+'<span><span style="display:inline-block;width:6px;height:14px;background:rgba(251,191,36,.85);vertical-align:middle"></span> 高亮日</span>'+'<span><span class="gantt-day weekend" style="display:inline-block;padding:0 5px">6</span> 周末（日期加粗变色）</span>'+'<span><span class="gantt-day holiday" style="display:inline-block;padding:0 5px">1</span> 法定节假日</span>'+'</div>';

async function loadAdminGantt(){
  if(!agShowAll&&agMembers.length===0){document.getElementById('ag-content').innerHTML='<div class="empty" style="padding:40px">未选择任何成员</div>';return;}
  await loadCnHolidays();
  var mids=(!agShowAll||agMembers.length)?agMembers.join(','):'';
  var gn=agFilterGroup||currentGroup||ME.group_name;
  // 如果 gn 为空（旧数据库 admin 无组），自动取第一个活跃成员的组
  if(!gn){
    const allM=await GET('/members/active')||[];
    const first=allM.find(function(m){return m.group_name;});
    if(first) gn=first.group_name;
  }
  if(!gn){document.getElementById('ag-content').innerHTML='<div class="empty" style="padding:40px">暂无成员数据，请先在成员管理中添加成员并设置所在组</div>';return;}
  var params='year='+agYear+(agMonth?'&month='+agMonth:'')+'&group_name='+encodeURIComponent(gn)+(mids?'&member_ids='+mids:'');
  var data=await GET('/tasks/gantt_multi?'+params); if(!data)return;
  var members=data.members,startDate=data.startDate,endDate=data.endDate;
  var start=new Date(startDate),end=new Date(endDate);
  var totalDays=Math.ceil((end-start)/86400000)+1;
  var todayOff=Math.ceil((new Date(today())-start)/86400000);
  var dayStep=agMonth?1:Math.ceil(totalDays/30);
  var dayHdrs=buildDayHeaders(start,totalDays,dayStep,agMonth);
  var DONE=['DELIVERED','COMPLETED','RESOLVED','CLOSED'];
  var selCnt=agShowAll?members.length:agMembers.length;
  var isSingle=selCnt===1;
  var html='',slHtml='';

  // 按 group_name 分组
  var groupMap={}, groupOrder=[];
  for(var mi=0;mi<members.length;mi++){
    var gn2=members[mi].member.group_name||'未分组';
    if(!groupMap[gn2]){groupMap[gn2]=[];groupOrder.push(gn2);}
    groupMap[gn2].push(members[mi]);
  }

  for(var gi=0;gi<groupOrder.length;gi++){
    var grpName=groupOrder[gi];
    var grpItems=groupMap[grpName];

    // 组标题行（多个组时才显示）
    if(groupOrder.length>1){
      html+='<div style="display:flex;align-items:center;gap:8px;padding:6px 0;margin-top:'+(gi===0?'0':'14px')+';">'
        +'<div style="height:2px;flex:none;width:14px;background:var(--pri);border-radius:1px"></div>'
        +'<span style="font-size:13px;font-weight:700;color:var(--pri)">'+grpName+'</span>'
        +'<span style="color:var(--tx3);font-size:11px">'+grpItems.length+' 人</span>'
        +'<div style="flex:1;height:1px;background:rgba(59,130,246,.2)"></div>'
        +'</div>';
    }

    for(var mj=0;mj<grpItems.length;mj++){
      var mem=grpItems[mj].member, tasks=grpItems[mj].tasks;
      if(!tasks.length) continue;
      var ft=tasks.filter(function(t){
        if(agLogFilter==='has_log') return (t.log_dates||[]).length>0;
        if(agLogFilter==='no_log') return !DONE.includes(t.status)&&!(t.log_dates||[]).includes(today());
        return true;
      });
      if(!ft.length) continue;
      var nl=ft.filter(function(t){return !DONE.includes(t.status)&&!(t.log_dates||[]).includes(today());}).length;
      var sn=esc(mem.name||'');
      html+='<div class="gm-member-section">'
        +'<div class="gm-member-label gm-hover-label" data-mid="'+mem.id+'" data-nm="'+sn+'"'
        +' onclick="showSingleGantt('+mem.id+',this.dataset.nm)"'
        +' style="cursor:pointer;border-radius:8px;padding:6px 10px;background:var(--s2);margin-bottom:6px">'
        +'<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--pri),var(--acc));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">'+mem.name.slice(0,1)+'</div>'
        +'<span style="font-size:14px">'+sn+'</span>'
        +'<span style="color:var(--tx3);font-size:11px">'+esc(mem.role||'')+' · '+ft.length+'个任务</span>'
        +(nl>0?'<span class="bd bd-amber" style="font-size:10px">⚠ '+nl+'未投入</span>':'<span class="bd bd-green" style="font-size:10px">✓ 均有进展</span>')
        +'<span style="margin-left:auto;font-size:11px;color:var(--pri)">点击详情 →</span></div>';
      html+=renderGanttTracks(ft,start,end,totalDays,todayOff,dayStep,agMonth,agHighlightDate);
      html+='</div>';
      if(isSingle&&agHighlightDate){
        var lr='';
        ft.forEach(function(t){
          var dl=(t.logs||[]).filter(function(l){return l.log_date===agHighlightDate;});
          if(!dl.length) return;
          lr+='<div style="padding:8px 0;border-bottom:1px solid rgba(51,65,85,.3)"><div style="font-weight:600;margin-bottom:4px">'+esc(t.title)+'</div>';
          dl.forEach(function(l){lr+='<div style="color:var(--ok);font-size:13px">✓ '+esc(l.content||'')+'<span style="color:var(--tx3);font-size:11px;margin-left:8px">进度 '+(l.progress_snapshot||0)+'%</span></div>';});
          lr+='</div>';
        });
        if(lr) slHtml='<div class="card" style="margin-bottom:12px;border-color:rgba(251,191,36,.4);background:rgba(251,191,36,.05)"><div class="card-hd"><div class="ctitle" style="color:#fbbf24">&#x1F4C5; '+agHighlightDate+' 进展明细</div></div>'+lr+'</div>';
      }
    }
  }
  document.getElementById('ag-content').innerHTML=slHtml
    +'<div class="card">'+GANTT_LEGEND+'<div class="gm-wrap">'
    +'<div class="gantt-hdr"><div class="gantt-label" style="width:280px">任务</div><div class="gantt-days">'+dayHdrs+'</div></div>'
    +(html||'<div class="empty">无符合条件的任务</div>')
    +'</div></div>';
}

// ── Single member gantt detail (modal) ───────────────────────────────────────
async function showSingleGantt(memberId, memberName){
  // Fetch full year data for this member
  const yr=agYear;
  // Allow month drill-down: start with current agMonth if set, else full year
  let curMonth=agMonth;

  async function renderSingle(mo){
    const params=`year=${yr}${mo?'&month='+mo:''}&member_ids=${memberId}&group_name=${encodeURIComponent(ME.group_name)}`;
    const data=await GET('/tasks/gantt_multi?'+params);
    if(!data) return '<div class="empty">无数据</div>';
    const {members,startDate,endDate}=data;
    const mData=members[0];
    if(!mData||!mData.tasks.length) return '<div class="empty">该时段暂无设置了日期的任务</div>';
    const tasks=mData.tasks;
    const start=new Date(startDate), end=new Date(endDate);
    const totalDays=Math.ceil((end-start)/86400000)+1;
    const todayOff=Math.ceil((new Date(today())-start)/86400000);
    const dayStep=mo?1:Math.ceil(totalDays/30);
    const dayHdrs=buildDayHeaders(start,totalDays,dayStep,mo);
    // Stats
    const done=tasks.filter(t=>['DELIVERED','COMPLETED','RESOLVED','CLOSED'].includes(t.status)).length;
    const noLog=tasks.filter(t=>!['DELIVERED','COMPLETED','RESOLVED','CLOSED'].includes(t.status)&&!(t.log_dates||[]).includes(today())).length;
    return `<div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
      <span class="bd bd-blue">共 ${tasks.length} 个任务</span>
      <span class="bd bd-green">已完成 ${done}</span>
      <span class="bd ${noLog>0?'bd-amber':'bd-green'}">${noLog>0?`⚠ 今日 ${noLog} 个未投入`:'✓ 今日均有进展'}</span>
    </div>
    ${GANTT_LEGEND}
    <div class="gm-wrap">
      <div class="gantt-hdr"><div class="gantt-label" style="width:190px">任务</div><div class="gantt-days">${dayHdrs}</div></div>
      ${renderGanttTracks(tasks,start,end,totalDays,todayOff,dayStep,mo)}
    </div>`;
  }

  // Build modal content
  const monthSel=Array.from({length:12},(_,i)=>`<option value="${i+1}"${i+1===curMonth?' selected':''}>${i+1}月</option>`).join('');
  document.getElementById('mw').innerHTML=`
  <div class="ov" id="mov">
    <div class="modal" style="max-width:96vw;width:96vw;max-height:92vh">
      <div class="mhd">
        <div style="display:flex;align-items:center;gap:12px;flex:1;flex-wrap:wrap">
          <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--pri),var(--acc));display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">${memberName.slice(0,1)}</div>
          <div class="mtitle">${esc(memberName)} — 甘特图详情</div>
          <select class="fi" style="width:88px" id="sg-year" onchange="refreshSingleGantt(${memberId},'${esc(memberName)}')">
            ${[2024,2025,2026,2027].map(y=>`<option${y===yr?' selected':''}>${y}</option>`).join('')}
          </select>
          <select class="fi" style="width:78px" id="sg-month" onchange="refreshSingleGantt(${memberId},'${esc(memberName)}')">
            <option value="">全年</option>${monthSel}
          </select>
          <select class="fi" style="width:110px" id="sg-type" onchange="refreshSingleGantt(${memberId},'${esc(memberName)}')">
            <option value="">全部类型</option>
            ${Object.entries(TZ).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
        <button class="xbtn" onclick="closeModal()">✕</button>
      </div>
      <div class="mbd" id="sg-body">加载中...</div>
      <div class="mft"><button class="btn btn-ghost" onclick="closeModal()">关闭</button></div>
    </div>
  </div>`;

  // Load initial content
  const content=await renderSingle(curMonth);
  document.getElementById('sg-body').innerHTML=content;

  // Store renderSingle reference for refresh
  window._sgRender=renderSingle;
}

async function refreshSingleGantt(memberId, memberName){
  const yr=parseInt(document.getElementById('sg-year')?.value||agYear);
  const moVal=document.getElementById('sg-month')?.value;
  const mo=moVal?parseInt(moVal):null;
  const typeFilter=document.getElementById('sg-type')?.value||'';

  const params=`year=${yr}${mo?'&month='+mo:''}&member_ids=${memberId}&group_name=${encodeURIComponent(ME.group_name)}`;
  const data=await GET('/tasks/gantt_multi?'+params);
  if(!data) return;
  const {members,startDate,endDate}=data;
  const mData=members[0];

  let tasks=(mData?.tasks||[]).filter(t=>t.plan_start_date&&t.plan_end_date);
  if(typeFilter) tasks=tasks.filter(t=>t.task_type===typeFilter);

  const start=new Date(startDate), end=new Date(endDate);
  const totalDays=Math.ceil((end-start)/86400000)+1;
  const todayOff=Math.ceil((new Date(today())-start)/86400000);
  const dayStep=mo?1:Math.ceil(totalDays/30);
  const dayHdrs=buildDayHeaders(start,totalDays,dayStep,mo);

  if(!tasks.length){
    document.getElementById('sg-body').innerHTML='<div class="empty">该时段暂无设置了日期的任务</div>';
    return;
  }
  const done=tasks.filter(t=>['DELIVERED','COMPLETED','RESOLVED','CLOSED'].includes(t.status)).length;
  const noLog=tasks.filter(t=>!['DELIVERED','COMPLETED','RESOLVED','CLOSED'].includes(t.status)&&!(t.log_dates||[]).includes(today())).length;

  document.getElementById('sg-body').innerHTML=`
  <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
    <span class="bd bd-blue">共 ${tasks.length} 个任务</span>
    <span class="bd bd-green">已完成 ${done}</span>
    <span class="bd bd-teal">进行中 ${tasks.length-done}</span>
    <span class="bd ${noLog>0?'bd-amber':'bd-green'}">${noLog>0?`⚠ 今日 ${noLog} 个未投入`:'✓ 今日均有进展'}</span>
  </div>
  ${GANTT_LEGEND}
  <div class="gm-wrap">
    <div class="gantt-hdr"><div class="gantt-label" style="width:190px">任务</div><div class="gantt-days">${dayHdrs}</div></div>
    ${renderGanttTracks(tasks,start,end,totalDays,todayOff,dayStep,mo)}
  </div>`;
}

let _tipEl=null;
function showGanttTip(e,tid,title,logDates,logMapStr){
  hideGanttTip();
  let logMap={};
  try{logMap=JSON.parse(logMapStr.replace(/&quot;/g,'"'));}catch{}
  const todayLog=logMap[today()];
  const recentDates=logDates.slice(-3);
  let html=`<strong>${title}</strong><br><span style="color:var(--tx3)">点击添加/查看日志</span>`;
  if(todayLog&&todayLog.length){
    html+=`<br><br><span style="color:var(--ok)">📝 今日进展：</span><br>${todayLog.map(t=>esc(t.slice(0,60))).join('<br>')}`;
  }else{
    html+=`<br><span style="color:var(--warn)">⚠ 今日尚未记录进展</span>`;
  }
  if(recentDates.length){html+=`<br><span style="color:var(--tx3);font-size:11px">最近进展日：${recentDates.join(', ')}</span>`;}
  _tipEl=document.createElement('div');
  _tipEl.className='tooltip-box';
  _tipEl.innerHTML=html;
  _tipEl.style.left=(e.pageX+12)+'px';
  _tipEl.style.top=(e.pageY-10)+'px';
  document.body.appendChild(_tipEl);
}
function hideGanttTip(){if(_tipEl){_tipEl.remove();_tipEl=null;}}

