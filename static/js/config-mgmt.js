// ════════════════════════════════════════════
// CONFIG MANAGEMENT (admin) — project options, module options, CN holidays
// ════════════════════════════════════════════
let cfgProjectOpts=[], cfgModuleOpts=[], cfgHolidays=[];

async function renderConfigMgmt(){
  document.getElementById('tb-title').textContent='配置管理';
  document.getElementById('ct').innerHTML='<div style="color:var(--tx2);padding:60px;text-align:center">加载中...</div>';
  const cfg=await GET('/config')||{};
  try{cfgProjectOpts=JSON.parse(cfg.project_options||'[]');}catch{cfgProjectOpts=[];}
  try{cfgModuleOpts=JSON.parse(cfg.module_options||'[]');}catch{cfgModuleOpts=[];}
  let holObj={};
  try{holObj=JSON.parse(cfg.cn_holidays||'{}');}catch{holObj={};}
  cfgHolidays=Object.keys(holObj).sort().map(d=>({date:d,name:holObj[d]}));

  document.getElementById('ct').innerHTML=`
  <div class="phd"><div class="ptitle">⚙️ 配置管理</div></div>
  <div class="card">
    <div class="card-hd"><div class="ctitle">项目选项</div></div>
    <div style="font-size:12px;color:var(--tx2);margin-bottom:8px">配置后，新建"需求 / 问题单 / 现场支撑 / 质量深耕"任务时须从这里选择所属项目（必填）</div>
    <div id="cfg-proj-rows"></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-sm" onclick="addCfgOptRow('project')">＋ 添加</button>
      <button class="btn btn-sm btn-pri" onclick="saveCfgOpts('project')">保存项目选项</button>
    </div>
  </div>
  <div class="card">
    <div class="card-hd"><div class="ctitle">模块选项</div></div>
    <div style="font-size:12px;color:var(--tx2);margin-bottom:8px">配置后，新建"需求"任务时模块字段将变为下拉选择；历史数据不受影响，仍可正常展示</div>
    <div id="cfg-mod-rows"></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-sm" onclick="addCfgOptRow('module')">＋ 添加</button>
      <button class="btn btn-sm btn-pri" onclick="saveCfgOpts('module')">保存模块选项</button>
    </div>
  </div>
  <div class="card">
    <div class="card-hd"><div class="ctitle">法定节假日</div></div>
    <div class="alert al-info" style="margin-bottom:10px">用于甘特图标识法定节假日。日期仅供参考，请以国务院官方公布为准，可自行增删调整</div>
    <div id="cfg-hol-rows"></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-sm" onclick="addCfgHolRow()">＋ 添加</button>
      <button class="btn btn-sm btn-pri" onclick="saveCfgHolidays()">保存节假日</button>
    </div>
  </div>`;
  renderCfgOptRows('project');
  renderCfgOptRows('module');
  renderCfgHolRows();
}

function cfgOptArr(kind){ return kind==='project'?cfgProjectOpts:cfgModuleOpts; }

function renderCfgOptRows(kind){
  const el=document.getElementById(kind==='project'?'cfg-proj-rows':'cfg-mod-rows');
  if(!el) return;
  const arr=cfgOptArr(kind);
  el.innerHTML=arr.map((v,i)=>`<div style="display:flex;gap:8px;margin-bottom:6px">
    <input class="fi" value="${esc(v)}" oninput="setCfgOptVal('${kind}',${i},this.value)">
    <button class="btn btn-sm btn-err" onclick="removeCfgOptRow('${kind}',${i})">删</button>
  </div>`).join('')||'<div class="empty">暂无选项，点击下方"添加"</div>';
}

function setCfgOptVal(kind,i,v){ cfgOptArr(kind)[i]=v; }
function addCfgOptRow(kind){ cfgOptArr(kind).push(''); renderCfgOptRows(kind); }
function removeCfgOptRow(kind,i){ cfgOptArr(kind).splice(i,1); renderCfgOptRows(kind); }

async function saveCfgOpts(kind){
  const cleaned=cfgOptArr(kind).map(s=>(s||'').trim()).filter(Boolean);
  if(kind==='project') cfgProjectOpts=cleaned; else cfgModuleOpts=cleaned;
  const key=kind==='project'?'project_options':'module_options';
  const res=await POST('/config',{[key]:JSON.stringify(cleaned)});
  if(res){toast('已保存');renderCfgOptRows(kind);}
}

function renderCfgHolRows(){
  const el=document.getElementById('cfg-hol-rows');
  if(!el) return;
  el.innerHTML=cfgHolidays.map((h,i)=>`<div class="frow c3" style="align-items:end;margin-bottom:6px">
    <div class="fgroup"><label class="flabel">日期</label><input class="fi" type="date" value="${h.date||''}" onchange="setCfgHolField(${i},'date',this.value)"></div>
    <div class="fgroup"><label class="flabel">名称</label><input class="fi" value="${esc(h.name||'')}" oninput="setCfgHolField(${i},'name',this.value)"></div>
    <div class="fgroup"><label class="flabel">&nbsp;</label><button class="btn btn-sm btn-err" onclick="removeCfgHolRow(${i})">删</button></div>
  </div>`).join('')||'<div class="empty">暂无节假日，点击下方"添加"</div>';
}
function setCfgHolField(i,field,v){ if(cfgHolidays[i]) cfgHolidays[i][field]=v; }
function addCfgHolRow(){ cfgHolidays.push({date:'',name:''}); renderCfgHolRows(); }
function removeCfgHolRow(i){ cfgHolidays.splice(i,1); renderCfgHolRows(); }

async function saveCfgHolidays(){
  const obj={};
  cfgHolidays.forEach(h=>{ if(h.date&&h.name) obj[h.date]=h.name; });
  cfgHolidays=Object.keys(obj).sort().map(d=>({date:d,name:obj[d]}));
  const res=await POST('/config',{cn_holidays:JSON.stringify(obj)});
  if(res){toast('已保存');renderCfgHolRows();CN_HOLIDAYS=obj;}
}
