// Settings Page JavaScript - Shadow ToDo (with Approval Integration)
document.addEventListener('DOMContentLoaded', () => {
    initSettings();
});

function initSettings() {
    // Navigation
    setupNavigation();
    // Groups
    setupGroups();
    // Group Detail
    setupGroupDetail();
    // Task Settings Sub-navigation
    setupTaskSettingsNav();
    // Theme handlers
    setupThemeHandlers();
    // Close button
    setupCloseButton();
    // Shortcuts toggle
    setupShortcutsToggle();
}

// ============ NAVIGATION ============
function setupNavigation() {
    const navItems = document.querySelectorAll('.settings-nav-item');
    const sections = document.querySelectorAll('.settings-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.dataset.section;
            
            // Update nav active state
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            // Show corresponding section
            sections.forEach(s => s.classList.remove('active'));
            const targetSection = document.getElementById('section-' + sectionId);
            if (targetSection) {
                targetSection.classList.add('active');
            }
            
            // If switching to groups, ensure list view
            if (sectionId === 'groups') {
                document.getElementById('groupsListView').classList.remove('hidden');
                document.getElementById('groupDetailView').classList.add('hidden');
            }
        });
    });
}

// ============ CLOSE BUTTON ============
function setupCloseButton() {
    const closeBtn = document.getElementById('closeSettings');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('settingsOverlay').style.display='none';
        });
    }
}

// ============ THEME HANDLERS ============
function setupThemeHandlers() {
    // Left panel theme
    const panelOptions = document.querySelectorAll('.theme-panel-option');
    panelOptions.forEach(option => {
        option.addEventListener('click', () => {
            panelOptions.forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
        });
    });
    
    // Font family change
    const fontFamily = document.getElementById('fontFamily');
    const fontPreview = document.getElementById('fontPreview');
    if (fontFamily && fontPreview) {
        fontFamily.addEventListener('change', () => {
            fontPreview.style.fontFamily = fontFamily.value;
        });
    }
    
    // Font size change  
    const fontSize = document.getElementById('fontSize');
    if (fontSize && fontPreview) {
        fontSize.addEventListener('change', () => {
            const sizes = { browser: '18px', small: '14px', medium: '16px', large: '20px' };
            fontPreview.style.fontSize = sizes[fontSize.value] || '18px';
        });
    }
    
    // Save settings to localStorage
    document.querySelectorAll('input[name="themeColor"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const colors = {
                cobalt: '#4285f4', fern: '#0f9d58', tangerine: '#f4b400',
                cardinal: '#db4437', storm: '#9e9e9e', vintage: '#e8a735'
            };
            document.documentElement.style.setProperty('--accent', colors[radio.value] || '#4285f4');
            localStorage.setItem('themeColor', radio.value);
        });
    });
    
    // Load saved theme color
    const savedColor = localStorage.getItem('themeColor');
    if (savedColor) {
        const radio = document.querySelector('input[name="themeColor"][value="' + savedColor + '"]');
        if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
        }
    }

        // Appearance mode (light/dark/system)
        document.querySelectorAll('input[name="appearance"]').forEach(radio => {
                    radio.addEventListener('change', () => {
                                    const mode = radio.value;
                                    localStorage.setItem('shadow-theme', mode);
                                    if (mode === 'light') {
                                                        document.body.classList.add('light-theme');
                                    } else if (mode === 'night') {
                                                        document.body.classList.remove('light-theme');
                                    } else if (mode === 'system') {
                                                        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                                                                                document.body.classList.add('light-theme');
                                                        } else {
                                                                                document.body.classList.remove('light-theme');
                                                        }
                                    }
                    });
        });

        // Load saved appearance mode and set the correct radio
        const savedTheme = localStorage.getItem('shadow-theme');
        if (savedTheme) {
                    const radio = document.querySelector('input[name="appearance"][value="' + savedTheme + '"]');
                    if (radio) {
                                    radio.checked = true;
                    }
                    if (savedTheme === 'light') {
                                    document.body.classList.add('light-theme');
                    } else if (savedTheme === 'system') {
                                    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                                                        document.body.classList.add('light-theme');
                                    }
                    }
        }
}

// ============ SHORTCUTS TOGGLE ============
function setupShortcutsToggle() {
    const toggle = document.getElementById('shortcutsToggle');
    if (toggle) {
        toggle.addEventListener('change', () => {
            const container = document.querySelector('.shortcuts-container');
            if (container) {
                container.style.opacity = toggle.checked ? '1' : '0.4';
                container.style.pointerEvents = toggle.checked ? 'auto' : 'none';
            }
            const label = document.querySelector('.toggle-label');
            if (label) {
                label.textContent = toggle.checked ? 'On' : 'Off';
            }
        });
    }
}


// ============ GROUPS - REAL DATA FROM ShadowDB ============
let groupsData = [];
let currentGroupId = null;
const DEFAULT_STATUSES = [
  { id:'Open', name:'Open', color:'#e53e3e' },
  { id:'In Progress', name:'In Progress', color:'#d69e2e' },
  { id:'Fixed', name:'Fixed', color:'#3182ce' },
  { id:'Completed', name:'Completed', color:'#38a169' },
  { id:'Closed', name:'Closed', color:'#718096' }
];
const GROUP_COLORS = ['#4285f4','#0f9d58','#f4b400','#db4437','#9c27b0','#00bcd4','#ff5722','#607d8b','#795548','#009688'];
function groupColor(id){ const n=String(id).split('').reduce((a,c)=>a+c.charCodeAt(0),0); return GROUP_COLORS[n%GROUP_COLORS.length]; }
function groupInitials(name){ return (name||'').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()||'?'; }

async function loadGroupsFromDB(){
  const db=window.ShadowDB; if(!db) return [];
  const [rawGroups,allTasks,allCats,allMembers,allFields,allTags]=await Promise.all([
    db.Groups.getAll(),db.Tasks.getAll(),db.Categories.getAll(),
    db.Members.getAll(),db.CustomFields.getAll(),db.Tags.getAll()
  ]);
  const users=JSON.parse(localStorage.getItem('shadow_users')||'[]');
  return rawGroups.map(g=>{
    const gTasks=allTasks.filter(t=>t.group===g.id);
    const gCats=allCats.filter(c=>c.groupId===g.id);
    const gFields=allFields.filter(f=>f.groupId===g.id);
    const gTags=allTags.filter(t=>t.groupId===g.id||!t.groupId);
    const assignees=users.map(u=>({id:u.id,name:u.name,email:u.email,role:u.role||'member',color:u.color||'#667eea',avatar:u.avatar||u.name.charAt(0)}));
    [...new Set(gTasks.map(t=>t.assignee).filter(Boolean))].forEach(name=>{
      if(!assignees.find(a=>a.name===name)) assignees.push({id:name,name,email:'',role:'member',color:'#667eea',avatar:name.charAt(0)});
    });
    return {id:g.id,name:g.name,role:g.role||'owner',type:g.type||'personal',
      streams:g.streamsEnabled!==false,hidden:g.hidden||false,
      memberCount:assignees.length,taskCount:gTasks.length,
      initials:groupInitials(g.name),bgColor:groupColor(g.id),
      members:assignees,categories:gCats,statuses:DEFAULT_STATUSES,tags:gTags,
      customFields:gFields,taskSLA:g.taskSLA||'none',
      sendOverdueNotif:g.sendOverdueNotif||false,showAllSubtasks:g.showAllSubtasks||false,_raw:g};
  });
}

async function saveGroupSetting(groupId,patch){
  const db=window.ShadowDB; if(!db) return;
  const e=await db.Groups.getById(groupId);
  if(e) await db.Groups.update(groupId,Object.assign({},e,patch));
}

function setupGroups(){
  const countEl=document.querySelector('.groups-count');
  loadGroupsFromDB().then(groups=>{
    groupsData=groups;
    if(countEl) countEl.textContent=groups.length+' Group'+(groups.length!==1?'s':'');
    renderGroupCards(groupsData);
  });
  const si=document.getElementById('groupsSearch')||document.querySelector('.groups-search-wrap input');
  if(si) si.addEventListener('input',()=>{ const q=si.value.toLowerCase(); renderGroupCards(groupsData.filter(g=>g.name.toLowerCase().includes(q))); });
  document.querySelectorAll('input[name="groupType"]').forEach(r=>r.addEventListener('change',filterGroups));
  document.querySelectorAll('input[name="groupRole"]').forEach(r=>r.addEventListener('change',filterGroups));
  const cb=document.querySelector('.btn-create-group');
  if(cb) cb.addEventListener('click',async()=>{
    const name=prompt('New group name:'); if(!name||!name.trim()) return;
    const db=window.ShadowDB; if(!db) return;
    await db.Groups.create({id:'g_'+Date.now(),name:name.trim(),createdAt:new Date().toISOString(),modifiedDate:new Date().toISOString()});
    const groups=await loadGroupsFromDB(); groupsData=groups;
    if(countEl) countEl.textContent=groups.length+' Group'+(groups.length!==1?'s':'');
    renderGroupCards(groupsData);
  });
}

function filterGroups(){
  const tp=document.querySelector('input[name="groupType"]:checked')?.value||'all';
  const rl=document.querySelector('input[name="groupRole"]:checked')?.value||'all';
  let f=[...groupsData];
  if(tp!=='all') f=f.filter(g=>g.type===tp);
  if(rl!=='all') f=f.filter(g=>g.role===rl);
  renderGroupCards(f);
}

function renderGroupCards(groups){
  const grid=document.getElementById('groupsGrid'); if(!grid) return;
  if(groups.length===0){ grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999">No groups found</div>'; return; }
  grid.innerHTML=groups.map(g=>{
    const ex=g.memberCount>4?'<div class="member-extra">+'+(g.memberCount-4)+'</div>':'';
    const av=(g.members||[]).slice(0,4).map(m=>'<div class="member-avatar" style="background:'+(m.color||'#667eea')+'">'+(m.avatar||m.name.charAt(0))+'</div>').join('');
    return '<div class="group-card" data-group-id="'+g.id+'">' +
      '<div class="group-card-icon colored" style="background:'+g.bgColor+'">'+g.initials+'</div>' +
      '<div class="group-card-name">'+g.name+'</div>' +
      '<div class="group-card-role '+g.role+'">'+capitalize(g.role)+'</div>' +
      '<div class="group-card-members">'+av+ex+'</div>' +
      '<div style="font-size:0.78rem;color:#999;margin-top:4px">'+g.taskCount+' task'+(g.taskCount!==1?'s':'')+'</div>' +
      '</div>';
  }).join('');
  grid.querySelectorAll('.group-card').forEach(card=>{ card.addEventListener('click',()=>openGroupDetail(card.dataset.groupId)); });
}

function capitalize(str){ return str?str.charAt(0).toUpperCase()+str.slice(1):''; }

function openGroupDetail(groupId){
  const group=groupsData.find(g=>g.id===groupId); if(!group) return;
  currentGroupId=groupId;
  document.getElementById('groupsListView').classList.add('hidden');
  document.getElementById('groupDetailView').classList.remove('hidden');
  const t=document.querySelector('.group-detail-title'); if(t) t.textContent=group.name;
  document.querySelectorAll('.group-tab').forEach(t=>t.classList.remove('active'));
  const ft=document.querySelector('.group-tab[data-tab="general"]'); if(ft) ft.classList.add('active');
  document.querySelectorAll('.group-tab-content').forEach(c=>c.classList.remove('active'));
  const gc=document.getElementById('tab-general'); if(gc) gc.classList.add('active');
  renderGeneralSettings(group);
  renderMembers(group.members,group.memberCount);
  renderCategories(group.categories);
  renderStatuses(group.statuses);
  renderAssignees(group.members);
  renderTags(group.tags);
  renderCustomFields(group.customFields);
  renderOtherSettings(group);
  setupTaskSettingsActions();
}

function renderGeneralSettings(group){
  const ne=document.getElementById('groupDetailName'); if(ne) ne.textContent=group.name;
  const se=document.getElementById('groupStreamsEnabled'); if(se) se.textContent=group.streams?'Yes':'No';
  const he=document.getElementById('groupHidden');
  if(he){ he.checked=group.hidden||false; he.onchange=()=>saveGroupSetting(group.id,{hidden:he.checked}); }
}

function memberCard(m){
  const bg=m.color||'#667eea'; const av=m.avatar||m.name.charAt(0).toUpperCase();
  return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f0f0f0">' +
    '<div style="background:'+bg+';width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:0.9rem;flex-shrink:0">'+av+'</div>' +
    '<div style="flex:1"><div style="font-weight:500;font-size:0.92rem">'+m.name+'</div><div style="color:#999;font-size:0.8rem">'+(m.email||'')+'</div></div>' +
    '<div style="font-size:0.8rem;color:#667eea;background:#f0f4ff;padding:2px 8px;border-radius:10px">'+capitalize(m.role||'member')+'</div>' +
    '</div>';
}

function renderMembers(members){
  const list=document.getElementById('membersList'); if(!list) return;
  if(!members||members.length===0){ list.innerHTML='<div style="text-align:center;padding:24px;color:#999">No members yet.</div>'; return; }
  const ar=['admin','moderator','owner'];
  const own=members.filter(m=>ar.includes(m.role)); const reg=members.filter(m=>!ar.includes(m.role));
  let h='';
  if(own.length){ h+='<div style="font-size:0.78rem;font-weight:600;color:#999;text-transform:uppercase;padding:8px 0 4px">Admins</div>'; own.forEach(m=>{h+=memberCard(m);}); }
  if(reg.length){ h+='<div style="font-size:0.78rem;font-weight:600;color:#999;text-transform:uppercase;padding:8px 0 4px">Members</div>'; reg.forEach(m=>{h+=memberCard(m);}); }
  list.innerHTML=h;
}

function listItemHtml(item, delFn){
  return '<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #f5f5f5">' +
    (item.color?'<div style="background:'+(item.color)+';width:14px;height:14px;border-radius:3px;flex-shrink:0"></div>':'') +
    '<span style="flex:1;font-size:0.9rem">'+item.name+'</span>' +
    '<button onclick="'+delFn+'(\''+item.id+'\',\''+currentGroupId+'\')" style="background:none;border:none;cursor:pointer;color:#e53e3e;font-size:1rem;padding:2px 6px">&#10005;</button>' +
    '</div>';
}

function renderCategories(categories){
  const list=document.getElementById('categoryList'); if(!list) return;
  if(!categories||categories.length===0){ list.innerHTML='<div style="color:#999;padding:16px 0;font-size:0.9rem">No categories yet. Type above and press Enter.</div>'; return; }
  list.innerHTML=categories.map(c=>
    '<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #f5f5f5">' +
    '<div style="background:'+(c.color||'#667eea')+';width:14px;height:14px;border-radius:3px;flex-shrink:0"></div>' +
    '<span style="flex:1;font-size:0.9rem">'+c.name+'</span>' +
    '<button data-del-cat="'+c.id+'" style="background:none;border:none;cursor:pointer;color:#e53e3e;font-size:1rem;padding:2px 6px">&#10005;</button>' +
    '</div>'
  ).join('');
  list.querySelectorAll('[data-del-cat]').forEach(btn=>btn.addEventListener('click',async()=>{
    if(!confirm('Delete?')) return;
    await window.ShadowDB.Categories.delete(btn.dataset.delCat);
    const g=groupsData.find(g=>g.id===currentGroupId); if(g){ g.categories=g.categories.filter(c=>c.id!==btn.dataset.delCat); renderCategories(g.categories); }
  }));
}

function renderStatuses(statuses){
  const list=document.getElementById('statusList'); if(!list) return;
  list.innerHTML=(statuses||DEFAULT_STATUSES).map(s=>
    '<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #f5f5f5">' +
    '<div style="background:'+(s.color||'#667eea')+';width:14px;height:14px;border-radius:3px;flex-shrink:0"></div>' +
    '<span style="flex:1;font-size:0.9rem">'+s.name+'</span></div>'
  ).join('');
}

function renderAssignees(members){
  const list=document.getElementById('assigneeList'); if(!list) return;
  if(!members||members.length===0){ list.innerHTML='<div style="color:#999;padding:16px 0;font-size:0.9rem">No assignees.</div>'; return; }
  list.innerHTML=members.map(m=>
    '<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #f5f5f5">' +
    '<div style="background:'+(m.color||'#667eea')+';width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.78rem;font-weight:600;flex-shrink:0">'+(m.avatar||m.name.charAt(0))+'</div>' +
    '<span style="flex:1;font-size:0.9rem">'+m.name+'</span>' +
    '<span style="font-size:0.78rem;color:#999">'+(m.email||'')+'</span></div>'
  ).join('');
}

function renderTags(tags){
  const list=document.getElementById('tagsList'); if(!list) return;
  if(!tags||tags.length===0){ list.innerHTML='<div style="color:#999;padding:16px 0;font-size:0.9rem">No tags yet. Type above and press Enter.</div>'; return; }
  list.innerHTML=tags.map(t=>
    '<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #f5f5f5">' +
    '<div style="background:'+(t.color||'#667eea')+';width:14px;height:14px;border-radius:3px;flex-shrink:0"></div>' +
    '<span style="flex:1;font-size:0.9rem">'+t.name+'</span>' +
    '<button data-del-tag="'+t.id+'" style="background:none;border:none;cursor:pointer;color:#e53e3e;font-size:1rem;padding:2px 6px">&#10005;</button>' +
    '</div>'
  ).join('');
  list.querySelectorAll('[data-del-tag]').forEach(btn=>btn.addEventListener('click',async()=>{
    if(!confirm('Delete?')) return;
    await window.ShadowDB.Tags.delete(btn.dataset.delTag);
    const g=groupsData.find(g=>g.id===currentGroupId); if(g){ g.tags=g.tags.filter(t=>t.id!==btn.dataset.delTag); renderTags(g.tags); }
  }));
}

function renderCustomFields(fields){
  const list=document.getElementById('customFieldsList'); if(!list) return;
  if(!fields||fields.length===0){ list.innerHTML='<div style="color:#999;padding:16px 0;font-size:0.9rem">No custom fields yet.</div>'; return; }
  list.innerHTML=fields.map(f=>
    '<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #f5f5f5">' +
    '<span style="flex:1;font-size:0.9rem">'+f.name+'</span>' +
    '<span style="font-size:0.78rem;color:#999;background:#f5f5f5;padding:2px 8px;border-radius:8px">'+(f.type||'text')+'</span>' +
    '<button data-del-cf="'+f.id+'" style="background:none;border:none;cursor:pointer;color:#e53e3e;font-size:1rem;padding:2px 6px">&#10005;</button>' +
    '</div>'
  ).join('');
  list.querySelectorAll('[data-del-cf]').forEach(btn=>btn.addEventListener('click',async()=>{
    if(!confirm('Delete?')) return;
    await window.ShadowDB.CustomFields.delete(btn.dataset.delCf);
    const g=groupsData.find(g=>g.id===currentGroupId); if(g){ g.customFields=g.customFields.filter(f=>f.id!==btn.dataset.delCf); renderCustomFields(g.customFields); }
  }));
}

function renderOtherSettings(group){
  const sla=document.getElementById('taskSLA');
  const od=document.getElementById('overdueNotification');
  const st=document.getElementById('showSubtasks');
  if(sla){ sla.value=group.taskSLA||'none'; sla.onchange=()=>saveGroupSetting(group.id,{taskSLA:sla.value}); }
  if(od){ od.checked=group.sendOverdueNotif||false; od.onchange=()=>saveGroupSetting(group.id,{sendOverdueNotif:od.checked}); }
  if(st){ st.checked=group.showAllSubtasks||false; st.onchange=()=>saveGroupSetting(group.id,{showAllSubtasks:st.checked}); }
}

function setupTaskSettingsActions(){
  const ci=document.getElementById('categorySearchInput')||document.querySelector('#tsection-category input[type="text"]');
  if(ci&&!ci._wired){ ci._wired=true; ci.placeholder='Type name + Enter to add...';
    ci.addEventListener('keydown',async(e)=>{ if(e.key!=='Enter'||!ci.value.trim()||!currentGroupId) return;
      const db=window.ShadowDB; if(!db) return;
      const C=['#e53e3e','#3182ce','#38a169','#d69e2e','#805ad5','#ed8936'];
      const nc={id:'cat_'+Date.now(),name:ci.value.trim(),groupId:currentGroupId,color:C[Math.floor(Math.random()*C.length)]};
      await db.Categories.create(nc); const g=groupsData.find(g=>g.id===currentGroupId); if(g){g.categories.push(nc);renderCategories(g.categories);} ci.value='';
    });
  }
  const ti=document.getElementById('tagSearchInput')||document.querySelector('#tsection-tags input[type="text"]');
  if(ti&&!ti._wired){ ti._wired=true; ti.placeholder='Type name + Enter to add...';
    ti.addEventListener('keydown',async(e)=>{ if(e.key!=='Enter'||!ti.value.trim()||!currentGroupId) return;
      const db=window.ShadowDB; if(!db) return;
      const C=['#e53e3e','#3182ce','#38a169','#d69e2e','#805ad5'];
      const nt={id:'tag_'+Date.now(),name:ti.value.trim(),groupId:currentGroupId,color:C[Math.floor(Math.random()*C.length)]};
      await db.Tags.create(nt); const g=groupsData.find(g=>g.id===currentGroupId); if(g){g.tags.push(nt);renderTags(g.tags);} ti.value='';
    });
  }
  const cfb=document.getElementById('addCustomFieldBtn')||document.querySelector('#tsection-customFields .btn-add');
  if(cfb&&!cfb._wired){ cfb._wired=true;
    cfb.addEventListener('click',async()=>{
      const name=prompt('Custom field name:'); if(!name||!name.trim()||!currentGroupId) return;
      const type=prompt('Field type (text/number/date/dropdown):','text')||'text';
      const db=window.ShadowDB; if(!db) return;
      const nf={id:'cf_'+Date.now(),name:name.trim(),type:type.trim(),groupId:currentGroupId};
      await db.CustomFields.create(nf); const g=groupsData.find(g=>g.id===currentGroupId); if(g){g.customFields.push(nf);renderCustomFields(g.customFields);}
    });
  }
}


function setupGroupDetail() {
    // Back button
    const backBtn = document.getElementById('backToGroups');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('groupsListView').classList.remove('hidden');
            document.getElementById('groupDetailView').classList.add('hidden');
        });
    }
    
    // Tab switching
    document.querySelectorAll('.group-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.group-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.group-tab-content').forEach(c => c.classList.remove('active'));
            const targetTab = document.getElementById('tab-' + tab.dataset.tab);
            if (targetTab) targetTab.classList.add('active');
        });
    });
}

function setupTaskSettingsNav() {
    document.querySelectorAll('.task-settings-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.task-settings-nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.task-settings-section').forEach(s => s.classList.remove('active'));
            const target = document.getElementById('tsection-' + item.dataset.tsection);
            if (target) target.classList.add('active');
        });
    });
}

// ============ RENDER FUNCTIONS ============
function setupApprovalSettings() {
  // Extend the task settings nav click handler to handle the approvals tab
  document.querySelectorAll('.task-settings-nav-item').forEach(item => {
    item.addEventListener('click', async function() {
      if (this.dataset.tsection === 'approvals') {
        // Show approval section
        document.querySelectorAll('.task-settings-nav-item').forEach(n => n.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.task-settings-section').forEach(s => s.classList.remove('active'));
        var target = document.getElementById('tsection-approvals');
        if (target) target.classList.add('active');

        // Mount the approval settings panel
        var mount = document.getElementById('approvalSettingsMount');
        // Resolve current group safely (no undefined ReferenceError).
        // Prefer settings.js' own currentGroupId/groupsData, then window.state.filterGroup, else first available group.
        var _resolvedGroup = null;
        try {
          if (typeof currentGroupId !== 'undefined' && currentGroupId && typeof groupsData !== 'undefined' && Array.isArray(groupsData)) {
            _resolvedGroup = groupsData.find(function(g){ return g.id === currentGroupId; }) || null;
          }
          if (!_resolvedGroup && window.state) {
            var fg = window.state.filterGroup;
            if (fg && window.state.groups) {
              _resolvedGroup = window.state.groups.find(function(g){ return g.id === fg; }) || null;
            }
            if (!_resolvedGroup && window.state.groups && window.state.groups[0]) {
              _resolvedGroup = window.state.groups[0];
            }
          }
        } catch(_e) {}
        if (mount && typeof ApprovalUI !== 'undefined' && _resolvedGroup) {
          // Race-safe single-source-of-truth: skip if another handler is rendering or already did.
          if (mount.dataset && mount.dataset.approvalRendering === '1') {
            // Another handler in-flight
          } else if (mount.querySelector && mount.querySelector('.approval-settings-card')) {
            // Already rendered by patch or previous run
          } else {
            if (mount.dataset) mount.dataset.approvalRendering = '1';
            mount.innerHTML = ''; // Clear previous
            try {
              await ShadowDB.init();
              await ApprovalWorkflow.init();
              var groupId = _resolvedGroup.id;
              var panel = await ApprovalUI.renderSettingsPanel(groupId);
              // Re-check after await
              if (!mount.querySelector('.approval-settings-card')) {
                mount.appendChild(panel);
              }
            } catch(e) {
              mount.innerHTML = '<p style="color:var(--text-secondary)">Unable to load approval settings. Make sure the database is initialized.</p>';
              console.error('Approval settings error:', e);
            } finally {
              if (mount.dataset) delete mount.dataset.approvalRendering;
            }
          }
        } else if (mount && typeof ApprovalUI !== 'undefined' && !_resolvedGroup) {
          mount.innerHTML = '<p style="color:var(--text-secondary)">Select a group to configure approval settings.</p>';
        }
      }
    });
  });
}

// Call it after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupApprovalSettings);
} else {
  setupApprovalSettings();
}

// ============ CUSTOM FIELD CREATION IN SETTINGS ============
// Adds "Create Custom Field" functionality to Task Settings > Custom Fields
(function setupCustomFieldCreation() {
      function enhanceCustomFieldsSection() {
              var cfSection = document.getElementById('tsection-customfields');
              if (!cfSection) return;
              if (cfSection.querySelector('.create-cf-btn')) return;

              // Add Create button
              var header = cfSection.querySelector('h3') || cfSection.querySelector('.tsection-title');
              var createBtn = document.createElement('button');
              createBtn.className = 'create-cf-btn';
              createBtn.textContent = '+ Create Custom Field';
              createBtn.style.cssText = 'background:#4285f4;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer;margin:12px 0;display:block;';
              createBtn.addEventListener('click', showCreateCustomFieldForm);

              if (header) {
                        header.parentElement.insertBefore(createBtn, header.nextElementSibling);
              } else {
                        cfSection.appendChild(createBtn);
              }

              // Also add it after the search bar if it exists
              var searchBar = cfSection.querySelector('input[type="search"], input[placeholder*="Search"]');
              if (searchBar) {
                        searchBar.parentElement.insertBefore(createBtn, searchBar.nextElementSibling);
              }
      }

      function showCreateCustomFieldForm() {
              var existing = document.getElementById('createCFModal');
              if (existing) existing.remove();

              var modal = document.createElement('div');
              modal.id = 'createCFModal';
              modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:10000;display:flex;align-items:center;justify-content:center;';
              modal.innerHTML = '<div style="background:var(--bg-primary,#fff);border-radius:12px;padding:24px;min-width:400px;max-width:500px;box-shadow:0 8px 24px rgba(0,0,0,0.2);">' +
                        '<h3 style="margin:0 0 16px 0;font-size:16px;">Create Custom Field</h3>' +
                        '<div style="margin-bottom:12px;">' +
                          '<label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">Field Name *</label>' +
                          '<input type="text" id="cfName" placeholder="e.g., Location, Sprint, Component" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;">' +
                        '</div>' +
                        '<div style="margin-bottom:12px;">' +
                          '<label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">Field Type *</label>' +
                          '<select id="cfType" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:13px;">' +
                            '<option value="text">Text Field</option>' +
                            '<option value="numeric">Numeric</option>' +
                            '<option value="dropdown">Dropdown</option>' +
                            '<option value="multichoice">MultiChoice</option>' +
                          '</select>' +
                        '</div>' +
                        '<div id="cfOptionsContainer" style="margin-bottom:12px;display:none;">' +
                          '<label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">Options (one per line)</label>' +
                          '<textarea id="cfOptions" rows="4" placeholder="Option 1&#10;Option 2&#10;Option 3" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;resize:vertical;"></textarea>' +
                        '</div>' +
                        '<div style="margin-bottom:16px;">' +
                          '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">' +
                            '<input type="checkbox" id="cfMandatory"> Make this field mandatory' +
                          '</label>' +
                        '</div>' +
                        '<div id="cfPreview" style="margin-bottom:16px;padding:12px;background:var(--bg-secondary,#f8f9fa);border-radius:8px;display:none;">' +
                          '<div style="font-size:11px;color:#999;margin-bottom:4px;">Preview</div>' +
                          '<div id="cfPreviewContent"></div>' +
                        '</div>' +
                        '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
                          '<button id="cfCancelBtn" style="padding:8px 20px;border:1px solid #ddd;border-radius:6px;background:transparent;cursor:pointer;font-size:13px;">Cancel</button>' +
                          '<button id="cfCreateBtn" style="padding:8px 20px;border:none;border-radius:6px;background:#4285f4;color:#fff;cursor:pointer;font-size:13px;">Create</button>' +
                        '</div>' +
                      '</div>';
              document.body.appendChild(modal);

              // Show/hide options based on type
              document.getElementById('cfType').addEventListener('change', function() {
                        var optContainer = document.getElementById('cfOptionsContainer');
                        var preview = document.getElementById('cfPreview');
                        if (this.value === 'dropdown' || this.value === 'multichoice') {
                                    optContainer.style.display = 'block';
                        } else {
                                    optContainer.style.display = 'none';
                        }
                        updateCFPreview();
              });

              document.getElementById('cfName').addEventListener('input', updateCFPreview);
              document.getElementById('cfOptions').addEventListener('input', updateCFPreview);
              document.getElementById('cfMandatory').addEventListener('change', updateCFPreview);

              document.getElementById('cfCancelBtn').addEventListener('click', function() {
                        modal.remove();
              });

              document.getElementById('cfCreateBtn').addEventListener('click', async function() {
                        var name = document.getElementById('cfName').value.trim();
                        var type = document.getElementById('cfType').value;
                        var mandatory = document.getElementById('cfMandatory').checked;
                        var optionsText = document.getElementById('cfOptions').value.trim();
                        var options = optionsText ? optionsText.split('\n').map(function(o) { return o.trim(); }).filter(function(o) { return o; }) : [];

                        if (!name) {
                                    alert('Please enter a field name');
                                    return;
                        }

                        // Get current group ID
                        var groupId = 1; // default to personal
                        if (typeof currentGroup !== 'undefined' && currentGroup) {
                                    groupId = currentGroup.id;
                        }

                        try {
                                    await ShadowDB.init();
                                    await ShadowDB.CustomFields.create({
                                                  name: name,
                                                  type: type,
                                                  group: groupId,
                                                  mandatory: mandatory,
                                                  options: options
                                    });
                                    modal.remove();
                                    // Refresh the custom fields list
                                    refreshCustomFieldsList(groupId);
                                    alert('Custom field "' + name + '" created successfully!');
                        } catch (e) {
                                    console.error('Error creating custom field:', e);
                                    alert('Error creating custom field: ' + e.message);
                        }
              });

              modal.addEventListener('click', function(e) {
                        if (e.target === modal) modal.remove();
              });
      }

      function updateCFPreview() {
              var name = document.getElementById('cfName').value.trim();
              var type = document.getElementById('cfType').value;
              var preview = document.getElementById('cfPreview');
              var content = document.getElementById('cfPreviewContent');
              if (!name) { preview.style.display = 'none'; return; }
              preview.style.display = 'block';

              var html = '<div style="display:flex;align-items:center;gap:8px;">';
              html += '<label style="min-width:80px;font-size:12px;font-weight:600;">' + name + '</label>';
              if (type === 'text') {
                        html += '<input type="text" disabled placeholder="Text value" style="flex:1;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;">';
              } else if (type === 'numeric') {
                        html += '<input type="number" disabled placeholder="0" style="flex:1;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;">';
              } else if (type === 'dropdown') {
                        var opts = document.getElementById('cfOptions').value.trim().split('\n').filter(function(o) { return o.trim(); });
                        html += '<select disabled style="flex:1;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;"><option>Select...</option>';
                        opts.forEach(function(o) { html += '<option>' + o.trim() + '</option>'; });
                        html += '</select>';
              } else if (type === 'multichoice') {
                        var opts = document.getElementById('cfOptions').value.trim().split('\n').filter(function(o) { return o.trim(); });
                        html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
                        opts.forEach(function(o) { html += '<label style="font-size:11px;"><input type="checkbox" disabled> ' + o.trim() + '</label>'; });
                        html += '</div>';
              }
              html += '</div>';
              content.innerHTML = html;
      }

      async function refreshCustomFieldsList(groupId) {
              try {
                        await ShadowDB.init();
                        var fields = await ShadowDB.CustomFields.getByGroup(groupId);
                        var container = document.querySelector('#tsection-customfields .custom-fields-list') ||
                                                  document.querySelector('#tsection-customfields');
                        if (!container) return;

                        // Find or create the list area
                        var listArea = container.querySelector('.cf-items-list');
                        if (!listArea) {
                                    listArea = document.createElement('div');
                                    listArea.className = 'cf-items-list';
                                    container.appendChild(listArea);
                        }

                        if (fields.length === 0) {
                                    listArea.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;">No custom fields configured</p>';
                                    return;
                        }

                        var html = '';
                        fields.forEach(function(f) {
                                    html += '<div class="cf-item" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border-color,#eee);">';
                                    html += '<i class="fa-regular fa-square-check" style="color:#999;"></i>';
                                    html += '<div><div style="font-size:11px;color:#999;">' + (f.type === 'multichoice' ? 'Multi Choice' : f.type.charAt(0).toUpperCase() + f.type.slice(1)) + '</div>';
                                    html += '<div style="font-size:13px;font-weight:500;">' + f.name + '</div></div>';
                                    html += '<button class="delete-cf-btn" data-cf-id="' + f.id + '" style="margin-left:auto;background:none;border:none;color:#e74c3c;cursor:pointer;font-size:12px;" title="Delete"><i class="fa-solid fa-trash"></i></button>';
                                    html += '</div>';
                        });
                        listArea.innerHTML = html;

                        // Add delete handlers
                        listArea.querySelectorAll('.delete-cf-btn').forEach(function(btn) {
                                    btn.addEventListener('click', async function() {
                                                  var cfId = parseInt(this.getAttribute('data-cf-id'));
                                                  if (confirm('Delete this custom field?')) {
                                                                  await ShadowDB.CustomFields.delete(cfId);
                                                                  refreshCustomFieldsList(groupId);
                                                  }
                                    });
                        });
              } catch (e) {
                        console.error('Error refreshing custom fields:', e);
              }
      }

      // Observe for section changes
      var observer = new MutationObserver(function() {
              enhanceCustomFieldsSection();
      });
      observer.observe(document.body, { childList: true, subtree: true });

      // Initial setup
      setTimeout(enhanceCustomFieldsSection, 1000);
})();
