(function () {
  'use strict';
  const STORE_KEY='shadow_templates',MAX_DEPTH=2,MAX_SUB=20,MAX_SHARE=50,MAX_NAME=100;
  const PRESET_CATEGORIES=[
    {id:'featured',label:'Featured',icon:'\u2B50'},
    {id:'work',label:'Work',icon:'\uD83D\uDCBC'},
    {id:'development',label:'Development',icon:'\uD83D\uDCBB'},
    {id:'design',label:'Design & Product',icon:'\uD83C\uDFA8'},
    {id:'personal',label:'Personal',icon:'\uD83C\uDFE0'},
    {id:'management',label:'Management',icon:'\uD83D\uDCCA'},
  ];
  const PRESET_TEMPLATES=[
    {id:'preset_weekly_review',name:'Weekly Review',category:'featured',emoji:'\uD83D\uDCC5',
     description:'A GTD-friendly checklist to review your week and plan ahead.',
     priority:'medium',tags:['Weekly','Review'],
     subtasks:[
      {id:'ps1',order:0,title:'Review completed tasks from last week',priority:'medium',tags:[],description:''},
      {id:'ps2',order:1,title:'Clear and process inbox',priority:'medium',tags:[],description:''},
      {id:'ps3',order:2,title:'Update project statuses',priority:'high',tags:[],description:''},
      {id:'ps4',order:3,title:'Set top 3 priorities for next week',priority:'high',tags:[],description:''},
      {id:'ps5',order:4,title:'Schedule key meetings and deadlines',priority:'medium',tags:[],description:''},
    ]},
    {id:'preset_project_kickoff',name:'Project Kickoff',category:'featured',emoji:'\uD83D\uDE80',
     description:'Everything you need to launch a new project successfully.',
     priority:'high',tags:['Project','Planning'],
     subtasks:[
      {id:'pk1',order:0,title:'Define project scope and objectives',priority:'high',tags:[],description:''},
      {id:'pk2',order:1,title:'Identify stakeholders and team members',priority:'high',tags:[],description:''},
      {id:'pk3',order:2,title:'Create project timeline and milestones',priority:'high',tags:[],description:''},
      {id:'pk4',order:3,title:'Set up communication channels',priority:'medium',tags:[],description:''},
      {id:'pk5',order:4,title:'Schedule kickoff meeting',priority:'medium',tags:[],description:''},
      {id:'pk6',order:5,title:'Prepare initial risk assessment',priority:'medium',tags:[],description:''},
    ]},
    {id:'preset_meeting_prep',name:'Meeting Preparation',category:'work',emoji:'\uD83D\uDCCB',
     description:'Prepare effectively for any important meeting.',
     priority:'medium',tags:['Meeting'],
     subtasks:[
      {id:'mp1',order:0,title:'Define meeting agenda and goals',priority:'high',tags:[],description:''},
      {id:'mp2',order:1,title:'Send calendar invites to attendees',priority:'medium',tags:[],description:''},
      {id:'mp3',order:2,title:'Prepare supporting materials and slides',priority:'medium',tags:[],description:''},
      {id:'mp4',order:3,title:'Review action items from previous meeting',priority:'low',tags:[],description:''},
      {id:'mp5',order:4,title:'Send follow-up notes and action items',priority:'medium',tags:[],description:''},
    ]},
    {id:'preset_onboarding',name:'New Employee Onboarding',category:'work',emoji:'\uD83D\uDC4B',
     description:'Onboard a new team member smoothly and efficiently.',
     priority:'high',tags:['HR','Onboarding'],
     subtasks:[
      {id:'ob1',order:0,title:'Set up accounts and access credentials',priority:'high',tags:[],description:''},
      {id:'ob2',order:1,title:'Provide equipment and workspace setup',priority:'high',tags:[],description:''},
      {id:'ob3',order:2,title:'Schedule intro meetings with team',priority:'medium',tags:[],description:''},
      {id:'ob4',order:3,title:'Share team processes and documentation',priority:'medium',tags:[],description:''},
      {id:'ob5',order:4,title:'Assign first project or task',priority:'medium',tags:[],description:''},
      {id:'ob6',order:5,title:'30-day check-in scheduled',priority:'low',tags:[],description:''},
    ]},
    {id:'preset_bug_fix',name:'Bug Fix Workflow',category:'development',emoji:'\uD83D\uDC1B',
     description:'A structured workflow for investigating and fixing bugs.',
     priority:'high',tags:['Bug','Dev'],
     subtasks:[
      {id:'bf1',order:0,title:'Reproduce the bug consistently',priority:'high',tags:[],description:''},
      {id:'bf2',order:1,title:'Identify root cause',priority:'high',tags:[],description:''},
      {id:'bf3',order:2,title:'Implement the fix',priority:'high',tags:[],description:''},
      {id:'bf4',order:3,title:'Write or update unit tests',priority:'medium',tags:[],description:''},
      {id:'bf5',order:4,title:'Code review',priority:'medium',tags:[],description:''},
      {id:'bf6',order:5,title:'Deploy to staging and verify fix',priority:'medium',tags:[],description:''},
    ]},
    {id:'preset_feature_release',name:'Feature Release',category:'development',emoji:'\uD83C\uDF89',
     description:'Steps to ship a new feature safely to production.',
     priority:'high',tags:['Dev','Release'],
     subtasks:[
      {id:'fr1',order:0,title:'Feature complete and code reviewed',priority:'high',tags:[],description:''},
      {id:'fr2',order:1,title:'QA testing passed',priority:'high',tags:[],description:''},
      {id:'fr3',order:2,title:'Update documentation',priority:'medium',tags:[],description:''},
      {id:'fr4',order:3,title:'Prepare release notes',priority:'medium',tags:[],description:''},
      {id:'fr5',order:4,title:'Deploy to production',priority:'high',tags:[],description:''},
      {id:'fr6',order:5,title:'Monitor metrics post-release',priority:'medium',tags:[],description:''},
    ]},
    {id:'preset_code_review',name:'Code Review Checklist',category:'development',emoji:'\uD83D\uDD0D',
     description:'Thorough checklist for reviewing pull requests.',
     priority:'medium',tags:['Dev','Review'],
     subtasks:[
      {id:'cr1',order:0,title:'Check code logic and correctness',priority:'high',tags:[],description:''},
      {id:'cr2',order:1,title:'Review for edge cases and error handling',priority:'high',tags:[],description:''},
      {id:'cr3',order:2,title:'Verify test coverage',priority:'medium',tags:[],description:''},
      {id:'cr4',order:3,title:'Check naming conventions and readability',priority:'low',tags:[],description:''},
      {id:'cr5',order:4,title:'Approve or request changes',priority:'medium',tags:[],description:''},
    ]},
    {id:'preset_design_sprint',name:'Design Sprint',category:'design',emoji:'\u270F\uFE0F',
     description:'A 5-day sprint process to design and test solutions.',
     priority:'high',tags:['Design','Sprint'],
     subtasks:[
      {id:'ds1',order:0,title:'Understand: map problem and user journey',priority:'high',tags:[],description:''},
      {id:'ds2',order:1,title:'Diverge: sketch competing solutions',priority:'medium',tags:[],description:''},
      {id:'ds3',order:2,title:'Decide: choose best solution',priority:'high',tags:[],description:''},
      {id:'ds4',order:3,title:'Prototype: build realistic prototype',priority:'high',tags:[],description:''},
      {id:'ds5',order:4,title:'Test: validate with real users',priority:'high',tags:[],description:''},
    ]},
    {id:'preset_travel_plan',name:'Trip Planning',category:'personal',emoji:'\u2708\uFE0F',
     description:'Everything you need to plan a stress-free trip.',
     priority:'medium',tags:['Travel','Personal'],
     subtasks:[
      {id:'tp1',order:0,title:'Book flights and accommodation',priority:'high',tags:[],description:''},
      {id:'tp2',order:1,title:'Research destination and activities',priority:'medium',tags:[],description:''},
      {id:'tp3',order:2,title:'Pack essentials checklist',priority:'medium',tags:[],description:''},
      {id:'tp4',order:3,title:'Arrange travel insurance',priority:'medium',tags:[],description:''},
      {id:'tp5',order:4,title:'Notify bank of travel dates',priority:'low',tags:[],description:''},
    ]},
    {id:'preset_sprint_planning',name:'Sprint Planning',category:'management',emoji:'\uD83D\uDCCA',
     description:'Plan and kick off a productive development sprint.',
     priority:'high',tags:['Sprint','Agile'],
     subtasks:[
      {id:'sp1',order:0,title:'Review and prioritize backlog',priority:'high',tags:[],description:''},
      {id:'sp2',order:1,title:'Define sprint goal',priority:'high',tags:[],description:''},
      {id:'sp3',order:2,title:'Assign tasks to team members',priority:'medium',tags:[],description:''},
      {id:'sp4',order:3,title:'Estimate story points',priority:'medium',tags:[],description:''},
      {id:'sp5',order:4,title:'Set up sprint board',priority:'low',tags:[],description:''},
    ]},
    {id:'preset_retro',name:'Sprint Retrospective',category:'management',emoji:'\uD83D\uDD04',
     description:'Reflect on the sprint and continuously improve.',
     priority:'medium',tags:['Sprint','Agile'],
     subtasks:[
      {id:'rt1',order:0,title:'Gather team feedback (What went well?)',priority:'medium',tags:[],description:''},
      {id:'rt2',order:1,title:'Identify improvements (What to change?)',priority:'high',tags:[],description:''},
      {id:'rt3',order:2,title:'Create action items from feedback',priority:'high',tags:[],description:''},
      {id:'rt4',order:3,title:'Update team processes documentation',priority:'low',tags:[],description:''},
    ]},
  ];
  const TM={templates:[],activeFilter:'all',activeSort:'recent',searchQuery:'',previewId:null,editingId:null,shareTargetId:null,applyingId:null,dragSrc:null,activePresetCat:'featured',init:false};
  function loadTemplates(){try{TM.templates=JSON.parse(localStorage.getItem(STORE_KEY))||[];}catch(e){TM.templates=[];}}
  function saveTemplates(){localStorage.setItem(STORE_KEY,JSON.stringify(TM.templates));}
  function uid(){return 'tm_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);}
  function currentUserId(){return (window.state&&window.state.currentUserId)||'user_1';}
  function currentUserName(){return (window.state&&window.state.currentUserName)||'Admin';}
  function isOwner(tpl){return tpl.createdBy===currentUserId();}
  function getGroups(){return (window.state&&window.state.groups)||[];}
  function getMembers(){return (window.state&&window.state.members)||[];}
  function priColor(p){return p==='high'?'var(--priority-high,#e53935)':p==='medium'?'var(--priority-medium,#f59e0b)':p==='low'?'var(--priority-low,#10b981)':'var(--text-muted,#aaa)';}
  function taskCountLabel(n){return n+' task'+(n!==1?'s':'');}
  function sharedLabel(tpl){if(!tpl.sharedWith||!tpl.sharedWith.length)return '';return tpl.sharedWith.length+' shared';}
  function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function showToast(msg,type){
    const el=document.createElement('div');
    el.className='tm-toast'+(type==='error'?' tm-toast--error':'');
    el.textContent=msg;
    document.body.appendChild(el);
    requestAnimationFrame(()=>{el.classList.add('tm-toast--show');});
    setTimeout(()=>{el.classList.remove('tm-toast--show');setTimeout(()=>el.remove(),400);},2800);
  }
  function createTemplate(data){
    if(!data.name||!data.name.trim()){showToast('Template name is required','error');return null;}
    if(data.name.length>MAX_NAME){showToast('Name too long (max '+MAX_NAME+' chars)','error');return null;}
    const subs=(data.subtasks||[]).slice(0,MAX_SUB);
    if((data.subtasks||[]).length>MAX_SUB){showToast('Capped at '+MAX_SUB+' subtasks','error');}
    const tpl={id:uid(),version:1,name:data.name.trim(),parentTitle:data.parentTitle||data.name.trim(),
      priority:data.priority||'none',tags:Array.isArray(data.tags)?data.tags:[],description:data.description||'',
      subtasks:subs.map((s,i)=>({id:s.id||uid(),order:i,title:s.title||'',priority:s.priority||'none',tags:s.tags||[],description:s.description||''})),
      createdBy:currentUserId(),createdByName:currentUserName(),createdAt:Date.now(),updatedAt:Date.now(),
      isFavourite:false,sharedWith:[],usageCount:0};
    TM.templates.unshift(tpl);saveTemplates();updateSidebarCount();return tpl;
  }
  function updateTemplate(id,patch){
    const tpl=TM.templates.find(t=>t.id===id);if(!tpl)return;
    Object.assign(tpl,patch,{updatedAt:Date.now()});
    if(patch.subtasks)tpl.subtasks=patch.subtasks.map((s,i)=>Object.assign({},s,{order:i}));
    saveTemplates();
  }
  function deleteTemplate(id){TM.templates=TM.templates.filter(t=>t.id!==id);saveTemplates();updateSidebarCount();}
  function toggleFavourite(id){const tpl=TM.templates.find(t=>t.id===id);if(tpl){tpl.isFavourite=!tpl.isFavourite;saveTemplates();}}
  function extractFromTask(taskId){
    if(!window.ShadowDB||!window.ShadowDB.Tasks)return null;
    const task=window.ShadowDB.Tasks.get(taskId);if(!task)return null;
    return{name:task.title||'Untitled Template',parentTitle:task.title||'',priority:task.priority||'none',
      tags:task.tags||'',description:task.description||'',
      subtasks:(task.subtasks||[]).slice(0,MAX_SUB).map((s,i)=>({id:uid(),order:i,title:s.title||'',priority:s.priority||'none',tags:s.tags||[],description:s.description||''}))};
  }
  function buildApplyConfig(tpl,overrides){
    return{title:overrides.title||tpl.parentTitle||tpl.name,priority:overrides.priority||tpl.priority,
      tags:overrides.tags||tpl.tags,groupId:overrides.groupId||null,assignee:null,dueDate:null,
      subtasks:tpl.subtasks.slice().sort((a,b)=>a.order-b.order).map(s=>({title:s.title,priority:s.priority,tags:s.tags,description:s.description,assignee:null,dueDate:null}))};
  }
  function applyTemplate(tplId,overrides){
    const tpl=TM.templates.find(t=>t.id===tplId)||PRESET_TEMPLATES.find(t=>t.id===tplId);
    if(!tpl)return;
    if(!window.ShadowDB||!window.ShadowDB.Tasks){showToast('DB not ready','error');return;}
    const cfg=buildApplyConfig(tpl,overrides||{});
    window.ShadowDB.Tasks.create({title:cfg.title,priority:cfg.priority,tags:cfg.tags,description:tpl.description||'',
      assignee:null,dueDate:null,groupId:cfg.groupId,subtasks:cfg.subtasks,fromTemplate:tplId});
    if(tpl.id&&!tpl.id.startsWith('preset_'))updateTemplate(tpl.id,{usageCount:(tpl.usageCount||0)+1});
    showToast('\u2705 Template applied! Tasks created.');
    if(window.pushBellNotification)window.pushBellNotification({type:'template',title:'Template Applied',body:cfg.title+' created from template'});
  }
  function shareTemplate(tplId,targets){
    const tpl=TM.templates.find(t=>t.id===tplId);
    if(!tpl||!isOwner(tpl)){showToast('Only the creator can share','error');return;}
    if(!targets||targets.length===0){showToast('Select at least one recipient','error');return;}
    if(targets.length>MAX_SHARE){showToast('Max '+MAX_SHARE+' recipients per share','error');return;}
    const now=Date.now();
    targets.forEach(t=>{const exists=tpl.sharedWith.find(s=>s.id===t.id&&s.type===t.type);if(!exists)tpl.sharedWith.push({type:t.type,id:t.id,name:t.name,sharedAt:now});});
    saveTemplates();showToast('\uD83D\uDCE4 Template shared with '+targets.length+' recipient(s)');
  }
  function unshareTemplate(tplId,targetId){
    const tpl=TM.templates.find(t=>t.id===tplId);
    if(!tpl||!isOwner(tpl))return;
    tpl.sharedWith=tpl.sharedWith.filter(s=>s.id!==targetId);saveTemplates();
  }
  function injectSidebarSection(){
    if(document.getElementById('tm-sidebar-section'))return;
    const sidebar=document.querySelector('nav.sidebar,.sidebar');if(!sidebar)return;
    const sec=document.createElement('div');
    sec.id='tm-sidebar-section';sec.className='sidebar-section';
    sec.style.cssText='display:block !important;margin-top:8px;';
    sec.innerHTML='<div class="sidebar-section-header" style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;font-size:11px;font-weight:600;color:var(--text-muted,#888);text-transform:uppercase;letter-spacing:.06em;">'+
      '<span>Templates</span><span id="tm-sidebar-count" style="background:var(--accent-blue,#2563eb);color:#fff;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700;display:none;">0</span></div>'+
      '<div id="tm-sidebar-links" style="padding:2px 8px;">'+
      '<div class="nav-item" data-view="templates" id="tm-library-link" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:13px;color:var(--text-primary,#222);">'+
      '<i class="fa-solid fa-layer-group" style="width:16px;text-align:center;color:var(--accent-blue,#2563eb);"></i><span>Browse Templates</span></div>'+
      '<div class="nav-item" data-view="new-template" id="tm-new-link" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:13px;color:var(--text-primary,#222);">'+
      '<i class="fa-solid fa-plus" style="width:16px;text-align:center;color:var(--accent-blue,#2563eb);"></i><span>New Template</span></div></div>';
    sidebar.appendChild(sec);
    sec.querySelector('#tm-library-link').addEventListener('click',openLibrary);
    sec.querySelector('#tm-new-link').addEventListener('click',openCreateModal);
  }
  function updateSidebarCount(){const el=document.getElementById('tm-sidebar-count');if(!el)return;const n=TM.templates.length;el.textContent=n;el.style.display=n>0?'inline-block':'none';}
  function forceShowSidebar(){const el=document.getElementById('tm-sidebar-section');if(el)el.style.cssText='display:block !important;margin-top:8px;';}
  function openLibrary(){closeLibrary();TM.activePresetCat='featured';
    const overlay=document.createElement('div');overlay.id='tm-library-overlay';overlay.className='tm-library-overlay';
    overlay.innerHTML=renderLibraryHTML();document.body.appendChild(overlay);wireLibrary(overlay);
  }
  function closeLibrary(){const el=document.getElementById('tm-library-overlay');if(el)el.remove();TM.previewId=null;}
  function renderLibraryHTML(){
    return '<div class="tm-lib-panel">'+
      '<div class="tm-lib-sidebar">'+
      '<div class="tm-lib-sidebar-title">Templates</div>'+
      '<div class="tm-lib-search"><i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="Search templates" id="tm-lib-search-input"></div>'+
      '<div class="tm-lib-sidebar-section-label">MY TEMPLATES</div>'+
      '<div class="tm-lib-nav-item tm-lib-nav-mine" data-view="my"><i class="fa-solid fa-user"></i>&nbsp;My Templates&nbsp;<span class="tm-lib-nav-count" id="tm-mine-count">0</span></div>'+
      '<div class="tm-lib-sidebar-section-label" style="margin-top:16px;">CATEGORIES</div>'+
      PRESET_CATEGORIES.map(cat=>'<div class="tm-lib-nav-item tm-lib-nav-cat'+(cat.id==='featured'?' active':'')+'        '" data-cat="'+cat.id+'">'+cat.icon+' '+escHtml(cat.label)+'</div>').join('')+
      '</div>'+
      '<div class="tm-lib-main">'+
      '<div class="tm-lib-main-header">'+
      '<div><div id="tm-lib-main-title" class="tm-lib-main-title">Featured</div>'+
      '<div id="tm-lib-main-subtitle" class="tm-lib-main-subtitle">Start with our most popular templates</div></div>'+
      '<button class="tm-lib-close" id="tm-lib-close-btn" title="Close">&times;</button></div>'+
      '<div id="tm-lib-content" class="tm-lib-content">'+renderLibraryContent('featured')+'</div>'+
      '</div>'+
      '<div class="tm-lib-preview" id="tm-lib-preview">'+renderPreviewEmpty()+'</div>'+
      '</div>';
  }
  function renderLibraryContent(view){
    if(view==='my')return renderMyTemplates();
    const presets=PRESET_TEMPLATES.filter(p=>p.category===view||(view==='featured'&&(p.category==='featured')));
    if(!presets.length)return '<div class="tm-lib-empty"><i class="fa-solid fa-layer-group"></i><p>No templates in this category yet.</p></div>';
    return '<div class="tm-preset-grid">'+presets.map(p=>renderPresetCard(p)).join('')+'</div>';
  }
  function renderPresetCard(p){
    const subCount=(p.subtasks||[]).length;
    const priDot=p.priority!=='none'?'<span style="color:'+priColor(p.priority)+';font-size:11px;">\u25CF '+p.priority+'</span>':'';
    const tags=(p.tags||[]).map(t=>'<span class="tm-tag">'+escHtml(t)+'</span>').join('');
    return '<div class="tm-preset-card" data-preset-id="'+p.id+'">'+
      '<div class="tm-preset-card-emoji">'+(p.emoji||'\uD83D\uDCCB')+'</div>'+
      '<div class="tm-preset-card-body">'+
      '<div class="tm-preset-card-name">'+escHtml(p.name)+'</div>'+
      '<div class="tm-preset-card-desc">'+escHtml(p.description||'')+'</div>'+
      '<div class="tm-preset-card-meta">'+priDot+'<i class="fa-solid fa-list-check" style="margin-left:6px;"></i> '+subCount+' tasks '+tags+'</div>'+
      '</div>'+
      '<div class="tm-preset-card-actions">'+
      '<button class="tm-btn-secondary tm-preset-preview-btn" data-preset-id="'+p.id+'">Preview</button>'+
      '<button class="tm-btn-primary tm-preset-apply-btn" data-preset-id="'+p.id+'">Apply</button>'+
      '</div></div>';
  }
  function getFilteredMyTemplates(){
    let list=TM.templates.slice();
    const q=TM.searchQuery.toLowerCase().trim();
    if(q)list=list.filter(t=>t.name.toLowerCase().includes(q));
    if(TM.activeFilter==='personal')list=list.filter(t=>!t.sharedWith||!t.sharedWith.length);
    if(TM.activeFilter==='shared')list=list.filter(t=>t.sharedWith&&t.sharedWith.some(s=>s.type==='user'));
    if(TM.activeFilter==='group')list=list.filter(t=>t.sharedWith&&t.sharedWith.some(s=>s.type==='group'));
    if(TM.activeSort==='favourite')list.sort((a,b)=>(b.isFavourite?1:0)-(a.isFavourite?1:0));
    else list.sort((a,b)=>b.updatedAt-a.updatedAt);
    return list;
  }
  function renderMyTemplates(){
    const filtered=getFilteredMyTemplates();
    if(!filtered.length)return '<div class="tm-lib-empty-my">'+
      '<div class="tm-lib-empty-icon">\uD83D\uDCCB</div>'+
      '<div class="tm-lib-empty-title">No templates yet</div>'+
      '<div class="tm-lib-empty-sub">Save a task as a template, or start from a preset in the categories on the left.</div>'+
      '<button class="tm-btn-primary" id="tm-empty-create-btn" style="margin-top:16px;">+ Create Template</button>'+
      '<div style="margin-top:12px;font-size:12px;color:var(--text-muted);">Tip: Right-click any task card \u2192 Save as Template</div>'+
      '</div>';
    return '<div class="tm-my-grid">'+filtered.map(t=>renderMyTemplateCard(t)).join('')+'</div>';
  }
  function renderMyTemplateCard(t){
    const subCount=(t.subtasks||[]).length;
    const tags=(t.tags||[]).map(tag=>'<span class="tm-tag">'+escHtml(tag)+'</span>').join('');
    const favIcon=t.isFavourite?'\u2605':'\u2606';
    const shared=sharedLabel(t);
    return '<div class="tm-my-card" data-tpl-id="'+t.id+'">'+
      '<div class="tm-my-card-header"><div class="tm-my-card-name">'+escHtml(t.name)+'</div>'+
      '<button class="tm-fav-btn" data-tpl-id="'+t.id+'" title="Favourite" style="color:'+(t.isFavourite?'#f59e0b':'var(--text-muted)')+'">'+favIcon+'</button></div>'+
      '<div class="tm-my-card-meta"><span style="color:'+priColor(t.priority)+';">\u25CF '+(t.priority||'none')+'</span>&nbsp;\u00B7&nbsp;<i class="fa-solid fa-list-check"></i> '+taskCountLabel(subCount)+
      (shared?'&nbsp;\u00B7&nbsp;<i class="fa-solid fa-share-nodes"></i> '+shared:'')+'</div>'+
      '<div class="tm-my-card-tags">'+tags+'</div>'+
      '<div class="tm-my-card-actions">'+
      '<button class="tm-btn-secondary tm-my-preview-btn" data-tpl-id="'+t.id+'">Preview</button>'+
      '<button class="tm-btn-primary tm-my-apply-btn" data-tpl-id="'+t.id+'">Apply</button>'+
      '<button class="tm-icon-btn tm-my-edit-btn" data-tpl-id="'+t.id+'" title="Edit"><i class="fa-solid fa-pen"></i></button>'+
      '<button class="tm-icon-btn tm-my-share-btn" data-tpl-id="'+t.id+'" title="Share"><i class="fa-solid fa-share-nodes"></i></button>'+
      '<button class="tm-icon-btn tm-my-del-btn" data-tpl-id="'+t.id+'" title="Delete" style="color:#e53935;"><i class="fa-solid fa-trash"></i></button>'+
      '</div></div>';
  }
  function renderPreviewEmpty(){
    return '<div class="tm-preview-empty"><i class="fa-solid fa-eye" style="font-size:28px;color:var(--text-muted,#aaa);margin-bottom:10px;"></i><div style="color:var(--text-muted,#aaa);font-size:13px;">Click a template to preview</div></div>';
  }
  function renderPreviewPanel(tpl,isPreset){
    const subs=(tpl.subtasks||[]).slice().sort((a,b)=>a.order-b.order);
    const subRows=subs.map(s=>'<div class="tm-prev-sub"><i class="fa-solid fa-circle-dot" style="color:var(--text-muted);font-size:10px;margin-right:6px;"></i><span>'+escHtml(s.title)+'</span><span style="color:'+priColor(s.priority)+';font-size:10px;margin-left:auto;">\u25CF '+s.priority+'</span></div>').join('');
    const tags=(tpl.tags||[]).map(t=>'<span class="tm-tag">'+escHtml(t)+'</span>').join('');
    const ownerLine=isPreset?'<span>Built-in</span>':'<span>by '+escHtml(tpl.createdByName||'You')+'</span>';
    const canEdit=!isPreset&&tpl.createdBy===currentUserId();
    return '<div class="tm-preview-content">'+
      '<div class="tm-prev-header"><div class="tm-prev-emoji">'+(tpl.emoji||'\uD83D\uDCCB')+'</div>'+
      '<div><div class="tm-prev-name">'+escHtml(tpl.name)+'</div><div class="tm-prev-meta">'+ownerLine+'&nbsp;\u00B7&nbsp;<i class="fa-solid fa-list-check"></i> '+(tpl.subtasks||[]).length+' tasks</div></div></div>'+
      (tpl.description?'<div class="tm-prev-desc">'+escHtml(tpl.description)+'</div>':'')+
      '<div class="tm-prev-tags">'+tags+'</div>'+
      '<div class="tm-prev-task-list"><div class="tm-prev-parent"><i class="fa-solid fa-square-check" style="color:var(--accent-blue,#2563eb);margin-right:6px;"></i>'+escHtml(tpl.parentTitle||tpl.name)+'</div>'+subRows+'</div>'+
      '<div class="tm-prev-footer">'+
      (canEdit?'<button class="tm-btn-secondary tm-prev-edit-btn" data-tpl-id="'+tpl.id+'">Edit</button>':'')+
      '<button class="tm-btn-primary tm-prev-apply-btn" data-tpl-id="'+tpl.id+'"'+(isPreset?' data-preset="true"':'')+'>Apply Template</button>'+
      '</div></div>';
  }
  function wireLibrary(overlay){
    const root=overlay.querySelector('.tm-lib-panel');if(!root)return;
    overlay.querySelector('#tm-lib-close-btn').addEventListener('click',closeLibrary);
    const titleMap={featured:['Featured','Start with our most popular templates'],
      work:['Work','Stay on top of your projects and meetings'],
      development:['Development','Streamline your engineering workflows'],
      design:['Design & Product','Templates for designers and product teams'],
      personal:['Personal','Organize your personal life'],
      management:['Management','Lead your team with structured workflows']};
    root.querySelectorAll('.tm-lib-nav-cat').forEach(el=>{
      el.addEventListener('click',()=>{
        root.querySelectorAll('.tm-lib-nav-cat,.tm-lib-nav-mine').forEach(e=>e.classList.remove('active'));
        el.classList.add('active');
        const cat=el.dataset.cat;TM.activePresetCat=cat;
        const[title,sub]=titleMap[cat]||[cat,''];
        overlay.querySelector('#tm-lib-main-title').textContent=title;
        overlay.querySelector('#tm-lib-main-subtitle').textContent=sub;
        overlay.querySelector('#tm-lib-content').innerHTML=renderLibraryContent(cat);
        wireContentEvents(overlay);
        overlay.querySelector('#tm-lib-preview').innerHTML=renderPreviewEmpty();
      });
    });
    root.querySelector('.tm-lib-nav-mine').addEventListener('click',()=>{
      root.querySelectorAll('.tm-lib-nav-cat,.tm-lib-nav-mine').forEach(e=>e.classList.remove('active'));
      root.querySelector('.tm-lib-nav-mine').classList.add('active');
      overlay.querySelector('#tm-lib-main-title').textContent='My Templates';
      overlay.querySelector('#tm-lib-main-subtitle').textContent='Templates you have created';
      overlay.querySelector('#tm-lib-content').innerHTML=renderMyTemplates();
      wireContentEvents(overlay);
    });
    overlay.querySelector('#tm-lib-search-input').addEventListener('input',e=>{
      TM.searchQuery=e.target.value;
      const active=root.querySelector('.tm-lib-nav-mine.active');
      if(active){overlay.querySelector('#tm-lib-content').innerHTML=renderMyTemplates();wireContentEvents(overlay);}
    });
    const mineCount=overlay.querySelector('#tm-mine-count');
    if(mineCount)mineCount.textContent=TM.templates.length;
    wireContentEvents(overlay);
  }
  function wireContentEvents(overlay){
    const content=overlay.querySelector('#tm-lib-content');if(!content)return;
    content.querySelectorAll('.tm-preset-preview-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{const tpl=PRESET_TEMPLATES.find(p=>p.id===btn.dataset.presetId);if(tpl){overlay.querySelector('#tm-lib-preview').innerHTML=renderPreviewPanel(tpl,true);wirePrevFooter(overlay,true);}});
    });
    content.querySelectorAll('.tm-preset-apply-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{const tpl=PRESET_TEMPLATES.find(p=>p.id===btn.dataset.presetId);if(tpl)openApplyModal(tpl,true);});
    });
    content.querySelectorAll('.tm-my-preview-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{const tpl=TM.templates.find(t=>t.id===btn.dataset.tplId);if(tpl){overlay.querySelector('#tm-lib-preview').innerHTML=renderPreviewPanel(tpl,false);wirePrevFooter(overlay,false);}});
    });
    content.querySelectorAll('.tm-my-apply-btn').forEach(btn=>{btn.addEventListener('click',()=>{const tpl=TM.templates.find(t=>t.id===btn.dataset.tplId);if(tpl)openApplyModal(tpl,false);});});
    content.querySelectorAll('.tm-my-edit-btn').forEach(btn=>{btn.addEventListener('click',()=>{const tpl=TM.templates.find(t=>t.id===btn.dataset.tplId);if(tpl)openEditModal(tpl);});});
    content.querySelectorAll('.tm-my-share-btn').forEach(btn=>{btn.addEventListener('click',()=>{const tpl=TM.templates.find(t=>t.id===btn.dataset.tplId);if(tpl)openShareModal(tpl);});});
    content.querySelectorAll('.tm-my-del-btn').forEach(btn=>{btn.addEventListener('click',()=>confirmDelete(btn.dataset.tplId,overlay));});
    content.querySelectorAll('.tm-fav-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{toggleFavourite(btn.dataset.tplId);const active=overlay.querySelector('.tm-lib-nav-mine.active');if(active){overlay.querySelector('#tm-lib-content').innerHTML=renderMyTemplates();wireContentEvents(overlay);}});
    });
    const createBtn=content.querySelector('#tm-empty-create-btn');
    if(createBtn)createBtn.addEventListener('click',()=>{closeLibrary();openCreateModal();});
  }
  function wirePrevFooter(overlay,isPreset){
    const prev=overlay.querySelector('#tm-lib-preview');if(!prev)return;
    const applyBtn=prev.querySelector('.tm-prev-apply-btn');
    if(applyBtn)applyBtn.addEventListener('click',()=>{const id=applyBtn.dataset.tplId;const tpl=isPreset?PRESET_TEMPLATES.find(p=>p.id===id):TM.templates.find(t=>t.id===id);if(tpl)openApplyModal(tpl,isPreset);});
    const editBtn=prev.querySelector('.tm-prev-edit-btn');
    if(editBtn)editBtn.addEventListener('click',()=>{const tpl=TM.templates.find(t=>t.id===editBtn.dataset.tplId);if(tpl)openEditModal(tpl);});
  }
  function confirmDelete(tplId,overlay){
    const tpl=TM.templates.find(t=>t.id===tplId);if(!tpl)return;
    if(!confirm('Delete template "'+tpl.name+'"? This cannot be undone.'))return;
    deleteTemplate(tplId);overlay.querySelector('#tm-lib-content').innerHTML=renderMyTemplates();wireContentEvents(overlay);showToast('Template deleted');
  }
  function openApplyModal(tpl,isPreset){
    const overlay=document.createElement('div');overlay.className='tm-modal-overlay';overlay.id='tm-apply-overlay';
    const groups=getGroups();
    const groupOptions=groups.map(g=>'<option value="'+g.id+'">'+escHtml(g.name)+'</option>').join('');
    const subs=(tpl.subtasks||[]).slice().sort((a,b)=>a.order-b.order);
    const subList=subs.map(s=>'<div class="tm-prow"><i class="fa-solid fa-circle-dot" style="color:var(--text-muted);margin-right:6px;"></i>'+escHtml(s.title)+'</div>').join('');
    overlay.innerHTML='<div class="tm-modal tm-modal--wide">'+
      '<div class="tm-modal-header"><span class="tm-modal-title">Apply Template: '+escHtml(tpl.name)+'</span><button class="tm-modal-close" id="tm-apply-close">&times;</button></div>'+
      '<div class="tm-modal-body">'+
      '<div class="tm-alert-info"><i class="fa-solid fa-circle-info"></i> Assignee and Due Date will not be set \u2014 apply them after creating tasks.</div>'+
      '<div class="tm-field-row"><label class="tm-label">Task Title</label><input type="text" class="tm-input" id="tm-apply-title" value="'+escHtml(tpl.parentTitle||tpl.name)+'"></div>'+
      '<div class="tm-field-row"><label class="tm-label">Group</label><select class="tm-select" id="tm-apply-group"><option value="">-- Personal tasks --</option>'+groupOptions+'</select></div>'+
      '<div class="tm-field-row"><label class="tm-label">Priority</label><select class="tm-select" id="tm-apply-priority">'+
      '<option value="none"'+(tpl.priority==='none'?' selected':'')+'>None</option>'+
      '<option value="low"'+(tpl.priority==='low'?' selected':'')+'>Low</option>'+
      '<option value="medium"'+(tpl.priority==='medium'?' selected':'')+'>Medium</option>'+
      '<option value="high"'+(tpl.priority==='high'?' selected':'')+'>High</option>'+
      '</select></div>'+
      '<div class="tm-field-row"><label class="tm-label">Subtasks ('+subs.length+')</label>'+
      '<div class="tm-apply-preview">'+(subList||'<em style="color:var(--text-muted);">No subtasks</em>')+'</div></div>'+
      '</div>'+
      '<div class="tm-modal-footer"><button class="tm-btn-secondary" id="tm-apply-cancel">Cancel</button><button class="tm-btn-primary" id="tm-apply-confirm"><i class="fa-solid fa-bolt"></i> Create Tasks</button></div>'+
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#tm-apply-close').addEventListener('click',()=>overlay.remove());
    overlay.querySelector('#tm-apply-cancel').addEventListener('click',()=>overlay.remove());
    overlay.querySelector('#tm-apply-confirm').addEventListener('click',()=>{
      const title=overlay.querySelector('#tm-apply-title').value.trim();
      const groupId=overlay.querySelector('#tm-apply-group').value||null;
      const priority=overlay.querySelector('#tm-apply-priority').value;
      if(!title){showToast('Task title is required','error');return;}
      applyTemplate(tpl.id,{title,groupId,priority});overlay.remove();closeLibrary();
    });
  }
  function renderSubRow(s,i){
    return '<div class="tm-subtask-row" data-sub-idx="'+i+'">'+
      '<i class="fa-solid fa-grip-lines tm-drag-handle"></i>'+
      '<input type="text" class="tm-input tm-sub-title" value="'+escHtml(s.title||'')+'        '" placeholder="Subtask title...">'+
      '<select class="tm-select tm-sub-priority">'+
      '<option value="none"'+(s.priority==='none'?' selected':'')+'>\u2014</option>'+
      '<option value="low"'+(s.priority==='low'?' selected':'')+'>Low</option>'+
      '<option value="medium"'+(s.priority==='medium'?' selected':'')+'>Med</option>'+
      '<option value="high"'+(s.priority==='high'?' selected':'')+'>High</option>'+
      '</select>'+
      '<button class="tm-icon-btn tm-remove-sub-btn" style="color:#e53935;"><i class="fa-solid fa-xmark"></i></button>'+
      '</div>';
  }
  function openCreateModal(prefill){
    const overlay=document.createElement('div');overlay.className='tm-modal-overlay';overlay.id='tm-create-overlay';
    const data=prefill||{name:'',priority:'none',tags:[],description:'',subtasks:[]};
    const subs=(data.subtasks||[]).map((s,i)=>renderSubRow(s,i)).join('');
    overlay.innerHTML='<div class="tm-modal tm-modal--wide">'+
      '<div class="tm-modal-header"><span class="tm-modal-title">Create Template</span><button class="tm-modal-close" id="tm-create-close">&times;</button></div>'+
      '<div class="tm-modal-body">'+
      '<div class="tm-field-row"><label class="tm-label">Template Name <span id="tm-name-count" style="color:var(--text-muted);font-size:11px;">0/'+MAX_NAME+'</span></label>'+
      '<input type="text" class="tm-input" id="tm-create-name" maxlength="'+MAX_NAME+'" value="'+escHtml(data.name)+'" placeholder="e.g. Bug Fix Workflow"></div>'+
      '<div class="tm-field-row"><label class="tm-label">Priority</label><select class="tm-select" id="tm-create-priority">'+
      '<option value="none"'+(data.priority==='none'?' selected':'')+'>None</option>'+
      '<option value="low"'+(data.priority==='low'?' selected':'')+'>Low</option>'+
      '<option value="medium"'+(data.priority==='medium'?' selected':'')+'>Medium</option>'+
      '<option value="high"'+(data.priority==='high'?' selected':'')+'>High</option>'+
      '</select></div>'+
      '<div class="tm-field-row"><label class="tm-label">Tags (comma-separated)</label><input type="text" class="tm-input" id="tm-create-tags" value="'+escHtml((data.tags||[]).join(', '))+'" placeholder="Bug, Backend"></div>'+
      '<div class="tm-field-row"><label class="tm-label">Description</label><textarea class="tm-textarea" id="tm-create-desc" rows="2" placeholder="Optional description...">'+escHtml(data.description||'')+'</textarea></div>'+
      '<div class="tm-field-row"><label class="tm-label">Subtasks <span id="tm-sub-count" style="color:var(--text-muted);font-size:11px;">(0/'+MAX_SUB+')</span></label>'+
      '<div id="tm-create-subs">'+subs+'</div>'+
      '<button class="tm-btn-outline" id="tm-add-sub-btn" style="margin-top:8px;"><i class="fa-solid fa-plus"></i> Add Subtask</button></div>'+
      '<div class="tm-alert-info" style="margin-top:12px;"><i class="fa-solid fa-circle-info"></i> Assignees and Due Dates are stripped \u2014 set them when you apply.</div>'+
      '</div>'+
      '<div class="tm-modal-footer"><button class="tm-btn-secondary" id="tm-create-cancel">Cancel</button><button class="tm-btn-primary" id="tm-create-save">Save Template</button></div>'+
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#tm-create-close').addEventListener('click',()=>overlay.remove());
    overlay.querySelector('#tm-create-cancel').addEventListener('click',()=>overlay.remove());
    const nameInput=overlay.querySelector('#tm-create-name');
    const nameCount=overlay.querySelector('#tm-name-count');
    nameInput.addEventListener('input',()=>{nameCount.textContent=nameInput.value.length+'/'+MAX_NAME;});
    overlay.querySelector('#tm-add-sub-btn').addEventListener('click',()=>{
      const container=overlay.querySelector('#tm-create-subs');
      const idx=container.querySelectorAll('.tm-subtask-row').length;
      if(idx>=MAX_SUB){showToast('Max '+MAX_SUB+' subtasks','error');return;}
      const div=document.createElement('div');
      div.innerHTML=renderSubRow({title:'',priority:'none'},idx);
      container.appendChild(div.firstElementChild);
      const cnt=overlay.querySelector('#tm-sub-count');
      if(cnt)cnt.textContent='('+container.querySelectorAll('.tm-subtask-row').length+'/'+MAX_SUB+')';
      wireRemoveSubs(overlay,'#tm-create-subs');
    });
    wireRemoveSubs(overlay,'#tm-create-subs');
    overlay.querySelector('#tm-create-save').addEventListener('click',()=>{
      const name=nameInput.value.trim();
      if(!name){showToast('Name required','error');nameInput.focus();return;}
      const priority=overlay.querySelector('#tm-create-priority').value;
      const tags=overlay.querySelector('#tm-create-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
      const desc=overlay.querySelector('#tm-create-desc').value.trim();
      const subEls=overlay.querySelectorAll('#tm-create-subs .tm-subtask-row');
      const subtasks=Array.from(subEls).map((r,i)=>({id:uid(),order:i,title:r.querySelector('.tm-sub-title').value.trim(),priority:r.querySelector('.tm-sub-priority').value,tags:[],description:''})).filter(s=>s.title);
      const tpl=createTemplate({name,priority,tags,description:desc,subtasks});
      if(tpl){overlay.remove();showToast('\uD83D\uDCCB Template saved: '+tpl.name);}
    });
  }
  function wireRemoveSubs(overlay,containerSel){
    overlay.querySelectorAll(containerSel+' .tm-remove-sub-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        btn.closest('.tm-subtask-row').remove();
        const cnt=overlay.querySelector('#tm-sub-count');
        if(cnt){const n=overlay.querySelectorAll(containerSel+' .tm-subtask-row').length;cnt.textContent='('+n+'/'+MAX_SUB+')';}
      });
    });
  }
  function openEditModal(tpl){
    if(!isOwner(tpl)){showToast('Only the creator can edit','error');return;}
    const overlay=document.createElement('div');overlay.className='tm-modal-overlay';overlay.id='tm-edit-overlay';
    const subs=(tpl.subtasks||[]).slice().sort((a,b)=>a.order-b.order);
    const subRows=subs.map((s,i)=>renderSubRow(s,i)).join('');
    overlay.innerHTML='<div class="tm-modal tm-modal--wide">'+
      '<div class="tm-modal-header"><span class="tm-modal-title">Edit Template</span><button class="tm-modal-close" id="tm-edit-close">&times;</button></div>'+
      '<div class="tm-modal-body">'+
      '<div class="tm-alert-warn"><i class="fa-solid fa-triangle-exclamation"></i> Changes only affect future uses. Tasks already created are unchanged.</div>'+
      '<div class="tm-field-row"><label class="tm-label">Template Name</label><input type="text" class="tm-input" id="tm-edit-name" maxlength="'+MAX_NAME+'" value="'+escHtml(tpl.name)+'"></div>'+
      '<div class="tm-field-row"><label class="tm-label">Priority</label><select class="tm-select" id="tm-edit-priority">'+
      '<option value="none"'+(tpl.priority==='none'?' selected':'')+'>None</option>'+
      '<option value="low"'+(tpl.priority==='low'?' selected':'')+'>Low</option>'+
      '<option value="medium"'+(tpl.priority==='medium'?' selected':'')+'>Medium</option>'+
      '<option value="high"'+(tpl.priority==='high'?' selected':'')+'>High</option>'+
      '</select></div>'+
      '<div class="tm-field-row"><label class="tm-label">Tags (comma-separated)</label><input type="text" class="tm-input" id="tm-edit-tags" value="'+escHtml((tpl.tags||[]).join(', '))+'"></div>'+
      '<div class="tm-field-row"><label class="tm-label">Description</label><textarea class="tm-textarea" id="tm-edit-desc" rows="2">'+escHtml(tpl.description||'')+'</textarea></div>'+
      '<div class="tm-field-row"><label class="tm-label">Subtasks (drag to reorder)</label>'+
      '<div id="tm-edit-subs">'+subRows+'</div>'+
      '<button class="tm-btn-outline" id="tm-edit-add-sub" style="margin-top:8px;"><i class="fa-solid fa-plus"></i> Add Subtask</button></div>'+
      '</div>'+
      '<div class="tm-modal-footer"><button class="tm-btn-secondary" id="tm-edit-cancel">Cancel</button><button class="tm-btn-primary" id="tm-edit-save">Save Changes</button></div>'+
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#tm-edit-close').addEventListener('click',()=>overlay.remove());
    overlay.querySelector('#tm-edit-cancel').addEventListener('click',()=>overlay.remove());
    overlay.querySelector('#tm-edit-add-sub').addEventListener('click',()=>{
      const container=overlay.querySelector('#tm-edit-subs');
      const idx=container.querySelectorAll('.tm-subtask-row').length;
      if(idx>=MAX_SUB){showToast('Max '+MAX_SUB+' subtasks','error');return;}
      const div=document.createElement('div');
      div.innerHTML=renderSubRow({title:'',priority:'none'},idx);
      container.appendChild(div.firstElementChild);
      wireRemoveSubs(overlay,'#tm-edit-subs');
      initDragDrop(container);
    });
    wireRemoveSubs(overlay,'#tm-edit-subs');
    overlay.querySelector('#tm-edit-save').addEventListener('click',()=>{
      const name=overlay.querySelector('#tm-edit-name').value.trim();
      if(!name){showToast('Name required','error');return;}
      const priority=overlay.querySelector('#tm-edit-priority').value;
      const tags=overlay.querySelector('#tm-edit-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
      const desc=overlay.querySelector('#tm-edit-desc').value.trim();
      const subEls=overlay.querySelectorAll('#tm-edit-subs .tm-subtask-row');
      const subtasks=Array.from(subEls).map((r,i)=>({id:uid(),order:i,title:r.querySelector('.tm-sub-title').value.trim(),priority:r.querySelector('.tm-sub-priority').value,tags:[],description:''})).filter(s=>s.title);
      updateTemplate(tpl.id,{name,priority,tags,description:desc,subtasks});overlay.remove();showToast('Template updated');
    });
    initDragDrop(overlay.querySelector('#tm-edit-subs'));
  }
  function initDragDrop(container){
    if(!container)return;
    container.querySelectorAll('.tm-subtask-row').forEach(row=>{
      row.setAttribute('draggable','true');
      row.addEventListener('dragstart',()=>{TM.dragSrc=row;row.classList.add('tm-dragging');});
      row.addEventListener('dragend',()=>{TM.dragSrc=null;row.classList.remove('tm-dragging');container.querySelectorAll('.tm-drag-over').forEach(r=>r.classList.remove('tm-drag-over'));});
      row.addEventListener('dragover',e=>{e.preventDefault();row.classList.add('tm-drag-over');});
      row.addEventListener('dragleave',()=>row.classList.remove('tm-drag-over'));
      row.addEventListener('drop',e=>{e.preventDefault();row.classList.remove('tm-drag-over');if(TM.dragSrc&&TM.dragSrc!==row){const allRows=Array.from(container.querySelectorAll('.tm-subtask-row'));const srcIdx=allRows.indexOf(TM.dragSrc);const tgtIdx=allRows.indexOf(row);if(srcIdx<tgtIdx)container.insertBefore(TM.dragSrc,row.nextSibling);else container.insertBefore(TM.dragSrc,row);}});
    });
  }
  function openShareModal(tpl){
    if(!isOwner(tpl)){showToast('Only the creator can share','error');return;}
    const overlay=document.createElement('div');overlay.className='tm-modal-overlay';overlay.id='tm-share-overlay';
    const members=getMembers().filter(m=>m.id!==currentUserId());
    const groups=getGroups();
    const memberOpts=members.map(m=>'<option value="u:'+m.id+'">'+escHtml(m.name||m.displayName||m.id)+'</option>').join('');
    const groupOpts=groups.map(g=>'<option value="g:'+g.id+'">'+escHtml(g.name)+'</option>').join('');
    const sharedChips=(tpl.sharedWith||[]).map(s=>'<div class="tm-shared-chip"><i class="fa-solid '+(s.type==='group'?'fa-users':'fa-user')+'"></i> '+escHtml(s.name)+'<button class="tm-chip-remove" data-sid="'+s.id+'">\u00D7</button></div>').join('');
    overlay.innerHTML='<div class="tm-modal">'+
      '<div class="tm-modal-header"><span class="tm-modal-title">Share Template</span><button class="tm-modal-close" id="tm-share-close">&times;</button></div>'+
      '<div class="tm-modal-body">'+
      '<div class="tm-alert-info"><i class="fa-solid fa-lock"></i> Recipients have read-only access. Max '+MAX_SHARE+' per action.</div>'+
      '<div class="tm-field-row"><label class="tm-label">Share with (Groups or Users)</label>'+
      '<select multiple class="tm-select" id="tm-share-select" style="height:120px;">'+
      (groupOpts?'<optgroup label="Groups">'+groupOpts+'</optgroup>':'')+
      (memberOpts?'<optgroup label="Members">'+memberOpts+'</optgroup>':'')+
      '</select></div>'+
      (sharedChips?'<div class="tm-field-row"><label class="tm-label">Currently shared with</label><div class="tm-shared-chips" id="tm-shared-chips">'+sharedChips+'</div></div>':'')+
      '</div>'+
      '<div class="tm-modal-footer"><button class="tm-btn-secondary" id="tm-share-cancel">Cancel</button><button class="tm-btn-primary" id="tm-share-confirm">Share</button></div>'+
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#tm-share-close').addEventListener('click',()=>overlay.remove());
    overlay.querySelector('#tm-share-cancel').addEventListener('click',()=>overlay.remove());
    overlay.querySelectorAll('.tm-chip-remove').forEach(btn=>{btn.addEventListener('click',()=>{unshareTemplate(tpl.id,btn.dataset.sid);overlay.remove();const t2=TM.templates.find(t=>t.id===tpl.id);if(t2)openShareModal(t2);});});
    overlay.querySelector('#tm-share-confirm').addEventListener('click',()=>{
      const sel=overlay.querySelector('#tm-share-select');
      const chosen=Array.from(sel.selectedOptions).map(opt=>{const[type,id]=opt.value.split(':');return{type:type==='g'?'group':'user',id,name:opt.text};});
      if(!chosen.length){showToast('Select at least one recipient','error');return;}
      shareTemplate(tpl.id,chosen);overlay.remove();
    });
  }
  function injectContextMenu(){
    document.addEventListener('contextmenu',e=>{
      const card=e.target.closest('.svk-card,.list-row,[data-task-id],[data-taskid]');
      if(!card)return;
      const taskId=card.dataset.taskid||card.dataset.taskId;
      if(!taskId)return;
      e.preventDefault();removeCtxMenu();
      const menu=document.createElement('div');
      menu.id='tm-ctx-menu';menu.className='tm-ctx-menu';
      menu.style.cssText='position:fixed;top:'+e.clientY+'px;left:'+e.clientX+'px;z-index:99999;';
      menu.innerHTML='<div class="tm-ctx-item" id="tm-ctx-save"><i class="fa-solid fa-layer-group"></i> Save as Template</div>';
      document.body.appendChild(menu);
      menu.querySelector('#tm-ctx-save').addEventListener('click',()=>{
        const data=extractFromTask(taskId);
        if(data)openCreateModal(data);else showToast('Could not extract task data','error');
        removeCtxMenu();
      });
      document.addEventListener('click',removeCtxMenu,{once:true});
    });
  }
  function removeCtxMenu(){const m=document.getElementById('tm-ctx-menu');if(m)m.remove();}
  function tryInjectNTMButton(){
    const topbar=document.querySelector('.ntm-topbar-actions,.ntm-actions');
    if(!topbar||topbar.querySelector('#tm-ntm-btn'))return;
    const btn=document.createElement('button');
    btn.id='tm-ntm-btn';btn.className='tm-ntm-item';btn.title='Apply Template';
    btn.innerHTML='<i class="fa-solid fa-layer-group"></i>';
    btn.addEventListener('click',()=>openLibrary());
    topbar.insertBefore(btn,topbar.firstChild);
  }
  function watchNTM(){const observer=new MutationObserver(()=>tryInjectNTMButton());observer.observe(document.body,{childList:true,subtree:true});}
  function watchSidebar(){
    const sidebar=document.querySelector('nav.sidebar,.sidebar');if(!sidebar)return;
    const obs=new MutationObserver(()=>{forceShowSidebar();if(!document.getElementById('tm-sidebar-section'))injectSidebarSection();});
    obs.observe(sidebar,{childList:true,subtree:true,attributes:true});
  }
  function init(){
    if(window._tmInitDone)return;window._tmInitDone=true;
    loadTemplates();injectSidebarSection();updateSidebarCount();
    injectContextMenu();watchNTM();watchSidebar();
    console.log('[TaskTemplates] v2 Initialized. Templates:',TM.templates.length,'Presets:',PRESET_TEMPLATES.length);
  }
  window.TaskTemplates={open:openLibrary,create:openCreateModal,getTemplates:()=>TM.templates.slice(),getPresets:()=>PRESET_TEMPLATES.slice(),apply:applyTemplate};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else setTimeout(init,200);
}());
