// ════════════════════════════════════════════
// PROFILE
// ════════════════════════════════════════════
function renderProfile(){
  document.getElementById('tb-title').textContent='个人设置';
  const hasBg=!!localStorage.getItem('tm_bg_img');
  const curTheme=localStorage.getItem('tm_theme')||'dark-blue';
  document.getElementById('ct').innerHTML=`
  <div style="max-width:540px">
    <div class="card">
      <div class="card-hd"><div class="ctitle">👤 我的信息</div></div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
        <div style="width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,var(--pri),var(--acc));display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800">${ME.name.slice(0,1)}</div>
        <div>
          <div style="font-size:17px;font-weight:700">${esc(ME.name)}</div>
          <div style="color:var(--tx2);font-size:12px">${esc(ME.username)} · ${ME.is_admin?'管理员':esc(ME.role||'成员')} · ${esc(ME.group_name||'')}</div>
        </div>
      </div>
      <div class="frow c2">
        <div class="fgroup"><label class="flabel">邮箱</label><input id="pf-email" class="fi" value="${esc(ME.email||'')}"></div>
        <div class="fgroup"><label class="flabel">电话</label><input id="pf-phone" class="fi" value="${esc(ME.phone||'')}"></div>
      </div>
      <button class="btn btn-pri" onclick="saveProfile()">保存信息</button>
    </div>
    <div class="card">
      <div class="card-hd"><div class="ctitle">🔐 修改密码</div></div>
      <div class="fgroup"><label class="flabel">当前密码</label><input id="pf-opw" class="fi" type="password"></div>
      <div class="fgroup"><label class="flabel">新密码（≥6位）</label><input id="pf-npw" class="fi" type="password"></div>
      <div class="fgroup"><label class="flabel">确认新密码</label><input id="pf-npw2" class="fi" type="password"></div>
      <button class="btn btn-pri" onclick="changePw()">修改密码</button>
    </div>
    ${ME.is_admin?`<div class="card">
      <div class="card-hd"><div class="ctitle">🎨 外观主题</div></div>
      <div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:600;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">配色方案</div>
        <div style="display:flex;flex-wrap:wrap;gap:12px">
          ${Object.entries(THEMES).map(([id,t])=>`<div class="sw-item" data-theme="${id}" onclick="applyTheme('${id}')" style="display:flex;flex-direction:column;align-items:center;gap:5px">
            <div class="theme-sw" data-theme="${id}">
              <div style="flex:2;background:${t.bg}"></div>
              <div style="flex:1;background:${t.pri}"></div>
            </div>
            <span style="font-size:10px">${t.name}</span>
          </div>`).join('')}
        </div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">自定义背景图</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <label class="btn" style="cursor:pointer">🖼️ 上传背景图<input type="file" accept="image/*" style="display:none" onchange="handleBgUpload(event)"></label>
          <button class="btn btn-ghost" onclick="clearBgImage()">清除背景</button>
        </div>
        <div id="bg-preview-wrap" style="display:${hasBg?'block':'none'}">
          <img style="max-width:240px;max-height:110px;border-radius:8px;border:1px solid var(--border);object-fit:cover;display:block">
          <div style="font-size:11px;color:var(--tx3);margin-top:5px">已设置自定义背景图（存储于本地）</div>
        </div>
        <div id="bg-no-img" style="display:${hasBg?'none':'block'};font-size:12px;color:var(--tx3)">暂未设置背景图，支持 JPG / PNG / WebP，建议使用大尺寸图片（≥1920×1080）</div>
      </div>
    </div>`:''}
  </div>`;
  if(ME.is_admin){
    // mark active theme swatch
    document.querySelectorAll('.sw-item').forEach(el=>{
      const a=el.dataset.theme===curTheme;
      const sw=el.querySelector('.theme-sw');
      if(sw){sw.style.borderColor=a?'var(--pri)':'transparent';sw.style.boxShadow=a?'0 0 0 3px rgba(59,130,246,.3)':'none';}
      const lbl=el.querySelector('span');
      if(lbl) lbl.style.color=a?'var(--pri)':'var(--tx3)';
    });
    // set bg preview image src (avoid embedding data in template)
    if(hasBg){
      const img=document.querySelector('#bg-preview-wrap img');
      if(img) img.src=localStorage.getItem('tm_bg_img');
    }
  }
}
async function saveProfile(){
  const res=await PUT('/members/'+ME.id,{name:ME.name,username:ME.username,role:ME.role,
    group_name:ME.group_name,is_active:ME.is_active,is_admin:ME.is_admin,
    email:gv('pf-email'),phone:gv('pf-phone')});
  if(res){ME.email=res.email;ME.phone=res.phone;toast('已保存');}
}
async function changePw(){
  const op=gv('pf-opw'),np=gv('pf-npw'),np2=gv('pf-npw2');
  if(np!==np2){toast('两次密码不一致','err');return;}
  const res=await POST('/auth/change_password',{old_password:op,new_password:np});
  if(res){toast('密码修改成功');sv('pf-opw','');sv('pf-npw','');sv('pf-npw2','');}
}

