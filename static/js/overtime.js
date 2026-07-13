// ════════════════════════════════════════════
// OVERTIME MANAGEMENT
// ════════════════════════════════════════════
let otMonth=thisMonth(), otList=[], otEditId=null;
let otExportGroups=[], otAllGroups=[];
const OT_TYPES=['转加班费','转调休'];

function nextSaturday(){
  const d=new Date();
  const diff=(6-d.getDay()+7)%7;
  d.setDate(d.getDate()+diff);
  return d.toISOString().slice(0,10);
}

async function renderOvertime(){
  document.getElementById('tb-title').textContent='加班管理';
  const isSuperAdmin=ME.is_admin&&ME.username==='admin';
  if(isSuperAdmin&&!otAllGroups.length){
    const allM=await GET('/members/active')||[];
    const seen={};otAllGroups=[];
    allM.forEach(m=>{if(m.group_name&&!seen[m.group_name]){seen[m.group_name]=1;otAllGroups.push(m.group_name);}});
    otAllGroups.sort();
  }
  document.getElementById('ct').innerHTML=`
  <div class="phd">
    <div class="ptitle">🕒 加班管理</div>
    <div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center">
      ${ME.is_admin?`
        ${isSuperAdmin?'<div id="ot-group-filter"></div>':''}
        <button class="btn" onclick="exportOvertime('month')">📥 导出本月</button>
        <button class="btn" onclick="exportOvertime('year')">📥 导出全年</button>
      `:''}
      <button class="btn btn-pri" onclick="openOvertimeModal(null)">＋ 申请加班</button>
    </div>
  </div>
  <div class="card">
    <div class="fbar" style="flex-wrap:wrap;align-items:center;gap:10px">
      <input class="fi" type="month" style="width:150px" value="${otMonth}" onchange="otMonth=this.value;loadOvertimeList()">
    </div>
    <div id="ot-tbl">加载中...</div>
  </div>`;
  if(isSuperAdmin) renderOtGroupFilter();
  await loadOvertimeList();
}

function renderOtGroupFilter(){
  const el=document.getElementById('ot-group-filter');
  if(!el) return;
  const wasOpen=document.getElementById('ot-group-dd')?.style.display==='block';
  const label=otExportGroups.length?`已选${otExportGroups.length}组`:'全部组';
  el.innerHTML=`<div class="ms-dd" style="position:relative;display:inline-block">
    <button type="button" class="btn btn-sm" style="min-width:130px;text-align:left" onclick="toggleDropdown('ot-group-dd')">导出分组：${label} ▾</button>
    <div id="ot-group-dd" class="ms-dd-panel" style="display:${wasOpen?'block':'none'};position:absolute;top:100%;left:0;margin-top:4px;z-index:20;background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px;min-width:170px;max-height:260px;overflow:auto;box-shadow:0 4px 16px rgba(0,0,0,.25)">
      ${otAllGroups.map(g=>
        `<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:4px 4px">
          <input type="checkbox" value="${esc(g)}" ${otExportGroups.includes(g)?'checked':''} onchange="toggleOtExportGroup('${esc(g)}',this.checked)" style="accent-color:var(--pri)"> ${esc(g)}</label>`
      ).join('')}
      <div style="display:flex;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
        <button type="button" class="btn btn-sm" onclick="otExportGroups=[];renderOtGroupFilter()">清空（全部组）</button>
        <button type="button" class="btn btn-sm" onclick="document.getElementById('ot-group-dd').style.display='none'">完成</button>
      </div>
    </div>
  </div>`;
}
function toggleOtExportGroup(g,checked){
  if(checked){ if(!otExportGroups.includes(g)) otExportGroups.push(g); }
  else { otExportGroups=otExportGroups.filter(x=>x!==g); }
  renderOtGroupFilter();
}

async function loadOvertimeList(){
  otList=await GET('/overtime?month='+otMonth)||[];
  renderOvertimeTbl();
}

function renderOvertimeTbl(){
  const el=document.getElementById('ot-tbl');
  if(!el) return;
  if(!otList.length){el.innerHTML='<div class="empty">该月暂无加班记录</div>';return;}
  el.innerHTML=`<table><thead><tr>
    <th>工号</th><th>姓名</th><th>开始</th><th>结束</th><th>休息时段</th><th>类型</th><th>理由</th><th>状态</th><th style="width:150px">操作</th>
  </tr></thead><tbody>
  ${otList.map(r=>{
    const isOwner=r.member_id===ME.id;
    const canEdit=!r.locked&&(ME.is_admin||isOwner);
    const statusLabel=r.locked?'🔒 已锁定':'🔓 未锁定';
    let ops='';
    if(canEdit) ops+=`<button class="btn btn-sm" onclick="openOvertimeModal(${r.id})">编辑</button><button class="btn btn-sm btn-err" onclick="delOvertime(${r.id})">删除</button>`;
    if(ME.is_admin){
      ops+=r.locked?`<button class="btn btn-sm" onclick="toggleOvertimeLock(${r.id},false)">解锁</button>`
                    :`<button class="btn btn-sm" onclick="toggleOvertimeLock(${r.id},true)">确认锁定</button>`;
    }
    return `<tr>
      <td>${esc(r.employee_no||'')}</td><td>${esc(r.member_name||'')}</td>
      <td>${r.start_date} ${r.start_time}</td><td>${r.end_date} ${r.end_time}</td>
      <td>${r.rest_start_time&&r.rest_end_time?esc(r.rest_start_time)+'~'+esc(r.rest_end_time):'-'}</td>
      <td>${esc(r.overtime_type||'')}</td><td>${esc(r.reason||'')}</td>
      <td>${statusLabel}</td>
      <td style="white-space:nowrap">${ops||'-'}</td>
    </tr>`;
  }).join('')}
  </tbody></table>`;
}

function openOvertimeModal(id){
  otEditId=id;
  let r;
  if(id){
    r=otList.find(x=>x.id===id);
  }else{
    if(!ME.employee_no){toast('请先联系管理员在成员管理中配置工号','err');return;}
    const sd=nextSaturday();
    r={employee_no:ME.employee_no,member_name:ME.name,start_date:sd,start_time:'09:00',end_date:sd,end_time:'',
       rest_start_time:'12:30',rest_end_time:'14:00',overtime_type:'转加班费',reason:''};
  }
  const body=`<div class="frow c2">
    <div class="fgroup"><label class="flabel">工号</label><input id="ot-empno" class="fi" value="${esc(r.employee_no||'')}" disabled></div>
    <div class="fgroup"><label class="flabel">姓名</label><input id="ot-name" class="fi" value="${esc(r.member_name||'')}" disabled></div>
  </div>
  <div class="frow c2">
    <div class="fgroup"><label class="flabel">开始日期 <span class="req">*</span></label><input id="ot-sdate" class="fi" type="date" value="${r.start_date||''}" onchange="onOtStartDateChange(this.value)"></div>
    <div class="fgroup"><label class="flabel">开始时间 <span class="req">*</span></label><input id="ot-stime" class="fi" type="time" value="${r.start_time||''}"></div>
  </div>
  <div class="frow c2">
    <div class="fgroup"><label class="flabel">结束日期 <span class="req">*</span></label><input id="ot-edate" class="fi" type="date" value="${r.end_date||''}"></div>
    <div class="fgroup"><label class="flabel">结束时间 <span class="req">*</span></label><input id="ot-etime" class="fi" type="time" value="${r.end_time||''}"></div>
  </div>
  <div class="frow c2">
    <div class="fgroup"><label class="flabel">休息开始</label><input id="ot-rstart" class="fi" type="time" value="${r.rest_start_time||''}"></div>
    <div class="fgroup"><label class="flabel">休息结束</label><input id="ot-rend" class="fi" type="time" value="${r.rest_end_time||''}"></div>
  </div>
  <div class="frow c2">
    <div class="fgroup"><label class="flabel">加班类型 <span class="req">*</span></label>
      <select id="ot-type" class="fi">${OT_TYPES.map(t=>`<option${r.overtime_type===t?' selected':''}>${t}</option>`).join('')}</select></div>
    <div class="fgroup"><label class="flabel">加班理由</label><input id="ot-reason" class="fi" value="${esc(r.reason||'')}"></div>
  </div>`;
  otStartDateTouched=false;
  openModal(id?'编辑加班记录':'申请加班',body,saveOvertimeEditor,true);
}

let otStartDateTouched=false;
function onOtStartDateChange(v){
  otStartDateTouched=true;
  const edate=document.getElementById('ot-edate');
  if(edate&&!otEditId) edate.value=v;
}

async function saveOvertimeEditor(){
  const start_date=gv('ot-sdate'),start_time=gv('ot-stime'),end_date=gv('ot-edate'),end_time=gv('ot-etime'),overtime_type=gv('ot-type');
  if(!start_date||!start_time||!end_date||!end_time||!overtime_type){toast('请填写完整的必填项','err');return;}
  const payload={employee_no:gv('ot-empno'),start_date,start_time,end_date,end_time,
    rest_start_time:gv('ot-rstart'),rest_end_time:gv('ot-rend'),overtime_type,reason:gv('ot-reason')};
  const res=otEditId?await PUT('/overtime/'+otEditId,payload):await POST('/overtime',payload);
  if(res){toast(otEditId?'更新成功':'申请成功');closeModal();loadOvertimeList();}
}

async function delOvertime(id){
  if(!confirm('确认删除该加班记录？')) return;
  await DEL('/overtime/'+id);
  toast('已删除');
  loadOvertimeList();
}

async function toggleOvertimeLock(id,locked){
  if(locked&&!confirm('确认锁定该记录？锁定后需先解锁才能修改')) return;
  await POST('/overtime/'+id+'/lock',{locked});
  toast(locked?'已锁定':'已解锁');
  loadOvertimeList();
}

async function exportOvertime(mode){
  const [y,m]=otMonth.split('-');
  let url=mode==='year'?`/api/export/overtime?year=${y}`:`/api/export/overtime?year=${y}&month=${parseInt(m)}`;
  if(ME.is_admin&&ME.username==='admin'&&otExportGroups.length) url+=`&groups=${encodeURIComponent(otExportGroups.join(','))}`;
  const blob=await fetch(url).then(r=>r.blob());
  dlBlob(blob,mode==='year'?`加班记录_${y}年.xlsx`:`加班记录_${y}年${m}月.xlsx`);
}

