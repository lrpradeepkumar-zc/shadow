// =============================================================================
// Shadow ToDo - Created by Me view
// Zoho-style: Board (column cards), List (columnar table), drag & drop, detail panels
// =============================================================================
(function(){
  'use strict';

  const STATUS_BUCKETS = ['Open','In Progress','Pending Review','Completed'];
  const STATUS_COLORS = {
    'Open': '#fce4e4',
    'In Progress': '#fff2cc',
    'Pending Review': '#e8ddfb',
    'Completed': '#d4f4dd'
  };
  const STATUS_TEXT = {
    'Open': '#c0392b',
    'In Progress': '#9a6b00',
    'Pending Review': '#5b3aa0',
    'Completed': '#1f7a3a'
  };

  // --- Utility helpers ---
  function escapeHtml(s){ if(s==null) return ''; return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function hueFromName(name){ let h=0; const s=String(name||''); for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))>>>0; } return h%360; }
  function avatarHtml(name,size){ const n=String(name||'?').trim(); const init=n? n.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase():'?'; const hue=hueFromName(n); const sz=size||22; return '<span class="cbm-avatar" style="width:'+sz+'px;height:'+sz+'px;background:hsl('+hue+',55%,55%);font-size:'+Math.max(9,Math.floor(sz*0.42))+'px;">'+escapeHtml(init)+'</span>'; }
  function fmtDate(d){ if(!d) return ''; const dt = (d instanceof Date)?d:new Date(d); if(isNaN(dt)) return ''; const m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return dt.getDate().toString().padStart(2,'0')+' '+m[dt.getMonth()]+' '+dt.getFullYear(); }
  function isOverdue(d){ if(!d) return false; const dt=new Date(d); if(isNaN(dt)) return false; const today=new Date(); today.setHours(0,0,0,0); return dt<today; }
  function categoryOf(task, ctx){
    const groups = (ctx&&ctx.groups)||[];
    const gid = task.groupId||task.group||task.categoryId;
    if (gid){ const g = groups.find(x=>x.id===gid||x.name===gid); if(g) return g.name; }
    if (task.category) return task.category;
    return 'Personal Task';
  }
  function assigneeName(task, ctx){
    const a = task.assignee || task.assignedTo || task.assigneeName;
    if (a) return a;
    const members = (ctx&&ctx.members)||[];
    if (task.assigneeId){ const m = members.find(x=>x.id===task.assigneeId); if(m) return m.name; }
    return '';
  }
  function currentUserName(ctx){
    if (ctx && ctx.currentUserName) return ctx.currentUserName;
    const id = ctx && ctx.currentUserId;
    const members = (ctx&&ctx.members)||[];
    const m = members.find(x=>x.id===id);
    return m ? m.name : '';
  }

  // --- Data filters ---
  function filterCreatedByMe(tasks, ctx){
    const uid = ctx && ctx.currentUserId;
    const uname = currentUserName(ctx);
    return (tasks||[]).filter(t=>{
      // legacy: accept tasks without createdBy as current user's
      if (!t.createdBy) return true;
      return t.createdBy === uid || t.createdBy === uname || t.authorId === uid;
    });
  }
  function applySubFilter(tasks, sub, ctx){
    const me = currentUserName(ctx);
    const uid = ctx && ctx.currentUserId;
    if (sub==='me') return tasks.filter(t=>{ const a=assigneeName(t,ctx); return !a || a===me || t.assigneeId===uid; });
    if (sub==='delegated') return tasks.filter(t=>{ const a=assigneeName(t,ctx); return a && a!==me && t.assigneeId!==uid; });
    return tasks;
  }
  function statusBucket(t){
    const s = (t.status||'Open').trim();
    if (STATUS_BUCKETS.includes(s)) return s;
    if (/progress/i.test(s)) return 'In Progress';
    if (/review|approval|pending/i.test(s)) return 'Pending Review';
    if (/complete|done|closed|fixed/i.test(s)) return 'Completed';
    return 'Open';
  }
  function groupByStatus(tasks){
    const out = {}; STATUS_BUCKETS.forEach(b=>{ out[b]=[]; });
    tasks.forEach(t=>{ out[statusBucket(t)].push(t); });
    return out;
  }

  // --- Toast ---
  function toast(msg){
    let el = document.getElementById('cbmToast');
    if (!el){ el = document.createElement('div'); el.id='cbmToast'; el.className='cbm-toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(el.__t); el.__t = setTimeout(()=>el.classList.remove('show'), 2400);
  }

  // --- Status pill ---
  function statusPill(status){
    const s = statusBucket({status});
    return '<span class="cbm-pill" style="background:'+STATUS_COLORS[s]+';color:'+STATUS_TEXT[s]+'">'+escapeHtml(s)+'</span>';
  }

  // --- Board card (Zoho style: title wrapped, status pill, assignee, counts, due) ---
  function boardCard(task, ctx){
    const a = assigneeName(task, ctx);
    const due = task.dueDate;
    const subN = (task.subtasks||[]).length;
    const cmtN = (task.comments||[]).length;
    const cat = categoryOf(task, ctx);
    const overdue = isOverdue(due);
    const priDot = '<span class="cbm-pri-dot pri-'+escapeHtml(task.priority||'none')+'"></span>';
    return [
      '<div class="cbm-card" draggable="true" data-task-id="'+escapeHtml(task.id)+'" data-status="'+escapeHtml(statusBucket(task))+'">',
      '<div class="cbm-card-title">'+escapeHtml(task.title||'')+'</div>',
      cat ? '<div class="cbm-card-tag">'+escapeHtml(cat)+'</div>' : '',
      '<div class="cbm-card-foot">',
      '<div class="cbm-card-left">', statusPill(task.status), '</div>',
      '<div class="cbm-card-right">',
      a ? (avatarHtml(a,20)+'<span class="cbm-card-name">'+escapeHtml(a.split(' ')[0])+'</span>') : '',
      '</div></div>',
      '<div class="cbm-card-meta">',
      subN ? '<span class="cbm-meta-ico" title="Subtasks"><i class="fa-solid fa-diagram-project"></i> '+subN+'</span>' : '',
      cmtN ? '<span class="cbm-meta-ico" title="Comments"><i class="fa-regular fa-comment"></i> '+cmtN+'</span>' : '',
      due ? '<span class="cbm-meta-due '+(overdue?'overdue':'')+'"><i class="fa-regular fa-calendar"></i> '+escapeHtml(fmtDate(due))+'</span>' : '',
      '</div>',
      '</div>'
    ].join('');
  }

  // --- Board rendering ---
  function renderBoard(container, tasksOrCtx, maybeCtx){
    let ctx; let srcTasks;
    if (Array.isArray(tasksOrCtx)) { srcTasks = tasksOrCtx; ctx = maybeCtx || {}; ctx.tasks = srcTasks; }
    else { ctx = tasksOrCtx || {}; srcTasks = (ctx && ctx.tasks) || []; }
    const baseTasks = ctx.skipOwnerFilter ? srcTasks : filterCreatedByMe(srcTasks, ctx);
    const tasks = ctx.hideSubFilters ? baseTasks : applySubFilter(baseTasks, ctx.sub||'all', ctx);
    const groups = groupByStatus(tasks);
    const subCounts = { all: baseTasks.length, me: applySubFilter(baseTasks,'me',ctx).length, delegated: applySubFilter(baseTasks,'delegated',ctx).length };
    const html = [];
    html.push('<div class="cbm-wrap">');
    html.push(cbmHeader(ctx, subCounts));
    if (tasks.length===0){ html.push(emptyState(ctx)); html.push('</div>'); container.innerHTML = html.join(''); wireHeader(container, ctx); return; }
    html.push('<div class="cbm-board">');
    STATUS_BUCKETS.forEach(b=>{
      const list = groups[b]||[];
      html.push('<div class="cbm-col" data-status="'+escapeHtml(b)+'">');
      html.push('<div class="cbm-col-head" data-status="'+escapeHtml(b)+'"><span class="cbm-col-title">'+escapeHtml(b)+'</span><span class="cbm-col-count">'+list.length+'</span></div>');
      html.push('<div class="cbm-col-body" data-status="'+escapeHtml(b)+'">');
      list.forEach(t=>{ html.push(boardCard(t,ctx)); });
      html.push('<div class="cbm-drop-end" data-status="'+escapeHtml(b)+'"></div>');
      html.push('</div></div>');
    });
    html.push('</div></div>');
    container.innerHTML = html.join('');
    wireHeader(container, ctx);
    wireBoard(container, ctx);
  }

  // --- List view (table-like with collapsible status groups) ---
  function renderList(container, tasksOrCtx, maybeCtx){
    let ctx; let srcTasks;
    if (Array.isArray(tasksOrCtx)) { srcTasks = tasksOrCtx; ctx = maybeCtx || {}; ctx.tasks = srcTasks; }
    else { ctx = tasksOrCtx || {}; srcTasks = (ctx && ctx.tasks) || []; }
    const baseTasks = ctx.skipOwnerFilter ? srcTasks : filterCreatedByMe(srcTasks, ctx);
    const tasks = ctx.hideSubFilters ? baseTasks : applySubFilter(baseTasks, ctx.sub||'all', ctx);
    const groups = groupByStatus(tasks);
    const subCounts = { all: baseTasks.length, me: applySubFilter(baseTasks,'me',ctx).length, delegated: applySubFilter(baseTasks,'delegated',ctx).length };
    const html = [];
    html.push('<div class="cbm-wrap">');
    html.push(cbmHeader(ctx, subCounts));
    if (tasks.length===0){ html.push(emptyState(ctx)); html.push('</div>'); container.innerHTML = html.join(''); wireHeader(container, ctx); return; }
    html.push('<div class="cbm-list">');
    html.push('<div class="cbm-list-head">');
    html.push('<div class="cbm-lh c-title">TASK TITLE</div>');
    html.push('<div class="cbm-lh c-assignee">ASSIGNEE</div>');
    html.push('<div class="cbm-lh c-status">STATUS</div>');
    html.push('<div class="cbm-lh c-due">DUE DATE</div>');
    html.push('<div class="cbm-lh c-created">CREATED DATE</div>');
    html.push('<div class="cbm-lh c-cat">CATEGORY</div>');
    html.push('</div>');
    STATUS_BUCKETS.forEach(b=>{
      const list = groups[b]||[];
      if (!list.length) return;
      html.push('<div class="cbm-list-section" data-status="'+escapeHtml(b)+'">');
      html.push('<div class="cbm-sec-head" data-toggle="'+escapeHtml(b)+'"><span class="cbm-sec-caret"><i class="fa-solid fa-chevron-down"></i></span><span class="cbm-sec-dot" style="background:'+STATUS_TEXT[b]+'"></span><span class="cbm-sec-title">'+escapeHtml(b)+'</span><span class="cbm-sec-count">'+list.length+'</span></div>');
      html.push('<div class="cbm-sec-body" data-status="'+escapeHtml(b)+'">');
      list.forEach(t=>{ html.push(listRow(t, ctx)); });
      html.push('<div class="cbm-drop-end cbm-row-drop" data-status="'+escapeHtml(b)+'"></div>');
      html.push('</div></div>');
    });
    html.push('</div></div>');
    container.innerHTML = html.join('');
    wireHeader(container, ctx);
    wireList(container, ctx);
  }

  function listRow(task, ctx){
    const a = assigneeName(task, ctx);
    const due = task.dueDate;
    const overdue = isOverdue(due);
    const subN = (task.subtasks||[]).length;
    const cmtN = (task.comments||[]).length;
    const cat = categoryOf(task, ctx);
    const created = task.createdAt || task.created || task.createdDate;
    const priMark = task.priority==='high' ? '<span class="cbm-row-pri" title="High priority">!</span>' : '';
    return [
      '<div class="cbm-row" draggable="true" data-task-id="'+escapeHtml(task.id)+'" data-status="'+escapeHtml(statusBucket(task))+'">',
      '<div class="cbm-rc c-title">',
      '<span class="cbm-row-check" data-act="toggle"><i class="fa-regular fa-circle'+(statusBucket(task)==="Completed"?"-check":"")+'"></i></span>',
      priMark,
      '<span class="cbm-row-title '+(statusBucket(task)==="Completed"?"done":"")+'">'+escapeHtml(task.title||'')+'</span>',
      subN ? '<span class="cbm-row-ico"><i class="fa-solid fa-diagram-project"></i> '+subN+'</span>' : '',
      cmtN ? '<span class="cbm-row-ico"><i class="fa-regular fa-comment"></i> '+cmtN+'</span>' : '',
      '</div>',
      '<div class="cbm-rc c-assignee">'+(a?(avatarHtml(a,22)+'<span>'+escapeHtml(a)+'</span>'):'')+'</div>',
      '<div class="cbm-rc c-status">'+statusPill(task.status)+'</div>',
      '<div class="cbm-rc c-due '+(overdue?'overdue':'')+'">'+(due?('<i class="fa-regular fa-calendar"></i> '+escapeHtml(fmtDate(due))):'')+'</div>',
      '<div class="cbm-rc c-created">'+escapeHtml(fmtDate(created))+'</div>',
      '<div class="cbm-rc c-cat">'+escapeHtml(cat)+'</div>',
      '</div>'
    ].join('');
  }

  // --- Header (title + segmented tabs) ---
  function cbmHeader(ctx, counts){
 const sub = ctx.sub||'all';
 const title = ctx.title||'Created by me';
 const subtitle = ctx.subtitle||'Tasks you originated \u2014 track delegated work';
 const out = [];
 out.push('<div class="cbm-header">');
 out.push('<div class="cbm-title-block"><h2>'+escapeHtml(title)+'</h2><div class="cbm-sub">'+escapeHtml(subtitle)+'</div></div>');
 if (!ctx.hideSubFilters){
  out.push('<div class="cbm-tabs" role="tablist">');
  out.push('<button class="cbm-tab '+(sub==='all'?'active':'')+'" data-sub="all">All <span class="cbm-tab-count">'+counts.all+'</span></button>');
  out.push('<button class="cbm-tab '+(sub==='me'?'active':'')+'" data-sub="me">Assigned to me <span class="cbm-tab-count">'+counts.me+'</span></button>');
  out.push('<button class="cbm-tab '+(sub==='delegated'?'active':'')+'" data-sub="delegated">Delegated <span class="cbm-tab-count">'+counts.delegated+'</span></button>');
  out.push('</div>');
 }
 out.push('</div>');
 return out.join('');
} 
function emptyState(ctx){
    const msg = (ctx.sub==='delegated') ? "You haven't delegated any tasks yet." : (ctx.sub==='me' ? "No tasks assigned to you from your own creations." : "You haven't created any tasks yet.");
    return '<div class="cbm-empty"><i class="fa-regular fa-clipboard"></i><div>'+escapeHtml(msg)+'</div></div>';
  }

  function wireHeader(container, ctx){
    container.querySelectorAll('.cbm-tab').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const sub = btn.getAttribute('data-sub');
        if (ctx.onSubChange) ctx.onSubChange(sub);
      });
    });
  }

  // --- Drag & drop (shared) ---
  let __dragId = null;
  function clearDropIndicators(root){
    root.querySelectorAll('.cbm-drop-indicator').forEach(n=>n.remove());
    root.querySelectorAll('.cbm-drop-target').forEach(n=>n.classList.remove('cbm-drop-target'));
  }
  function insertIndicator(beforeEl){
    const ind = document.createElement('div'); ind.className='cbm-drop-indicator';
    beforeEl.parentNode.insertBefore(ind, beforeEl);
    return ind;
  }

  // --- Board wiring ---
  function wireBoard(container, ctx){
    container.querySelectorAll('.cbm-card').forEach(card=>{
      card.addEventListener('click', (e)=>{
        if (e.target.closest('[data-act]')) return;
        openDetail(card.getAttribute('data-task-id'), ctx, 'board');
      });
      card.addEventListener('dragstart', (e)=>{ __dragId = card.getAttribute('data-task-id'); card.classList.add('cbm-dragging'); try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', __dragId); }catch(_){} });
      card.addEventListener('dragend', ()=>{ card.classList.remove('cbm-dragging'); __dragId = null; clearDropIndicators(container); });
    });
    container.querySelectorAll('.cbm-col-body').forEach(col=>{
      col.addEventListener('dragover', (e)=>{
        e.preventDefault(); try{ e.dataTransfer.dropEffect='move'; }catch(_){ }
        clearDropIndicators(container); col.classList.add('cbm-drop-target');
        const siblings = Array.from(col.querySelectorAll('.cbm-card:not(.cbm-dragging)'));
        const y = e.clientY; let before = null;
        for (const s of siblings){ const r = s.getBoundingClientRect(); if (y < r.top + r.height/2){ before = s; break; } }
        if (before) insertIndicator(before); else { const end = col.querySelector('.cbm-drop-end'); if (end) insertIndicator(end); }
      });
      col.addEventListener('dragleave', (e)=>{ if (e.target===col){ col.classList.remove('cbm-drop-target'); }});
      col.addEventListener('drop', (e)=>{
        e.preventDefault();
        const taskId = __dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
        if (!taskId) return;
        const newStatus = col.getAttribute('data-status');
        const ind = container.querySelector('.cbm-drop-indicator');
        let before = null;
        if (ind){ const next = ind.nextElementSibling; if (next && next.classList.contains('cbm-card')) before = next.getAttribute('data-task-id'); }
        clearDropIndicators(container);
        if (ctx.onMove) ctx.onMove({ taskId, newStatus, beforeTaskId: before });
      });
    });
  }

  // --- List wiring ---
  function wireList(container, ctx){
    container.querySelectorAll('.cbm-sec-head').forEach(h=>{
      h.addEventListener('click', ()=>{
        const sec = h.parentElement;
        sec.classList.toggle('collapsed');
      });
    });
    container.querySelectorAll('.cbm-row').forEach(row=>{
      row.addEventListener('click', (e)=>{
        if (e.target.closest('[data-act]')) return;
        openDetail(row.getAttribute('data-task-id'), ctx, 'list');
      });
      const chk = row.querySelector('[data-act="toggle"]');
      if (chk) chk.addEventListener('click', (e)=>{ e.stopPropagation(); if (ctx.onToggleComplete) ctx.onToggleComplete(row.getAttribute('data-task-id')); });
      row.addEventListener('dragstart', (e)=>{ __dragId = row.getAttribute('data-task-id'); row.classList.add('cbm-dragging'); try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', __dragId); }catch(_){} });
      row.addEventListener('dragend', ()=>{ row.classList.remove('cbm-dragging'); __dragId=null; clearDropIndicators(container); });
    });
    container.querySelectorAll('.cbm-sec-body').forEach(body=>{
      body.addEventListener('dragover', (e)=>{
        e.preventDefault(); try{ e.dataTransfer.dropEffect='move'; }catch(_){ }
        clearDropIndicators(container); body.classList.add('cbm-drop-target');
        const siblings = Array.from(body.querySelectorAll('.cbm-row:not(.cbm-dragging)'));
        const y = e.clientY; let before = null;
        for (const s of siblings){ const r = s.getBoundingClientRect(); if (y < r.top + r.height/2){ before = s; break; } }
        if (before) insertIndicator(before); else { const end = body.querySelector('.cbm-drop-end'); if (end) insertIndicator(end); }
      });
      body.addEventListener('dragleave', (e)=>{ if (e.target===body){ body.classList.remove('cbm-drop-target'); }});
      body.addEventListener('drop', (e)=>{
        e.preventDefault();
        const taskId = __dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
        if (!taskId) return;
        const newStatus = body.getAttribute('data-status');
        const ind = container.querySelector('.cbm-drop-indicator');
        let before = null;
        if (ind){ const next = ind.nextElementSibling; if (next && next.classList.contains('cbm-row')) before = next.getAttribute('data-task-id'); }
        clearDropIndicators(container);
        if (ctx.onMove) ctx.onMove({ taskId, newStatus, beforeTaskId: before });
      });
    });
  }

  // --- Task detail (panel for list, modal for board) ---
  function ensureDetailShell(kind){
    // kind = 'panel' (right slide) or 'modal' (centered)
    let el = document.getElementById('cbmDetail_'+kind);
    if (!el){
      if (kind==='modal'){
        el = document.createElement('div'); el.id='cbmDetail_modal'; el.className='cbm-modal-backdrop'; el.innerHTML = '<div class="cbm-modal" role="dialog"></div>';
        el.addEventListener('click', (e)=>{ if (e.target===el) closeDetail(); });
      } else {
        el = document.createElement('aside'); el.id='cbmDetail_panel'; el.className='cbm-panel'; el.innerHTML = '<div class="cbm-panel-inner"></div>';
      }
      document.body.appendChild(el);
    }
    return el;
  }

  function closeDetail(){
    const a = document.getElementById('cbmDetail_modal'); if (a){ a.classList.remove('open'); }
    const b = document.getElementById('cbmDetail_panel'); if (b){ b.classList.remove('open'); }
  }
  window.addEventListener('keydown', (e)=>{ if (e.key==='Escape') closeDetail(); });

  function detailHtml(task, ctx){
    const a = assigneeName(task, ctx) || 'Unassigned';
    const due = task.dueDate;
    const start = task.startDate;
    const cat = categoryOf(task, ctx);
    const gname = (function(){ const g = (ctx.groups||[]).find(x=>x.id===task.groupId||x.name===task.groupId); return g?g.name:(task.groupName||cat); })();
    const created = task.createdAt || task.created || '';
    const createdBy = task.createdByName || currentUserName(ctx) || 'You';
    const subs = (task.subtasks||[]);
    const cmts = (task.comments||[]);
    const parts = [];
    parts.push('<div class="cbm-d-head">');
    parts.push('  <div class="cbm-d-head-left">');
    parts.push('    <span class="cbm-d-status">'+statusPill(task.status)+'</span>');
    parts.push('    <div class="cbm-d-assigned"><div class="cbm-d-lbl">Assigned to</div>'+avatarHtml(a,22)+'<span class="cbm-d-aname">'+escapeHtml(a)+'</span></div>');
    if (start){ parts.push('    <div class="cbm-d-dates"><div class="cbm-d-lbl">Start Date</div><div>'+escapeHtml(fmtDate(start))+'</div></div>'); }
    if (due){ parts.push('    <div class="cbm-d-dates"><div class="cbm-d-lbl">Due Date</div><div>'+escapeHtml(fmtDate(due))+'</div></div>'); }
    parts.push('  </div>');
    parts.push('  <div class="cbm-d-head-right">');
    parts.push('    <button class="cbm-d-icon" title="Comments"><i class="fa-regular fa-comment"></i></button>');
    parts.push('    <button class="cbm-d-icon" title="Tags"><i class="fa-solid fa-tag"></i></button>');
    parts.push('    <button class="cbm-d-icon" title="More"><i class="fa-solid fa-ellipsis-vertical"></i></button>');
    parts.push('    <button class="cbm-d-icon cbm-d-close" title="Close"><i class="fa-solid fa-xmark"></i></button>');
    parts.push('  </div>');
    parts.push('</div>');
    parts.push('<div class="cbm-d-body">');
    parts.push('  <h2 class="cbm-d-title" contenteditable="true" data-field="title">'+escapeHtml(task.title||'')+'</h2>');
    parts.push('  <div class="cbm-d-meta"><span>in</span> <span class="cbm-d-chip">'+escapeHtml(gname)+'</span> <span>&nbsp;|&nbsp; under</span> <span class="cbm-d-chip">'+escapeHtml(cat)+'</span> <span>&bull;</span> <span class="cbm-d-chip pri">'+escapeHtml(task.priority||'Medium')+'</span></div>');
    if (subs.length){
      parts.push('  <div class="cbm-d-section"><div class="cbm-d-sec-title"><i class="fa-solid fa-diagram-project"></i> Subtasks</div><ul class="cbm-d-subs">');
      subs.forEach(s=>{ parts.push('<li>'+escapeHtml(s.title||s)+'</li>'); });
      parts.push('</ul></div>');
    } else { parts.push('  <div class="cbm-d-section"><div class="cbm-d-sec-title"><i class="fa-solid fa-diagram-project"></i> Subtasks</div><div class="cbm-d-placeholder">+ Subtask Title, @mention assignee</div></div>'); }
    parts.push('  <div class="cbm-d-section"><div class="cbm-d-sec-title"><i class="fa-regular fa-rectangle-list"></i> Timeline</div>');
    parts.push('    <div class="cbm-d-timeline"><div class="cbm-d-tl-dot"></div><div><b>'+escapeHtml(createdBy)+'</b> created this task. <span class="cbm-d-time">'+escapeHtml(fmtDate(created))+'</span></div></div>');
    parts.push('  </div>');
    if (cmts.length){
      parts.push('  <div class="cbm-d-section"><div class="cbm-d-sec-title"><i class="fa-regular fa-comment"></i> Comments</div>');
      cmts.forEach(c=>{ parts.push('<div class="cbm-d-cmt">'+escapeHtml(typeof c==='string'?c:(c.text||''))+'</div>'); });
      parts.push('  </div>');
    }
    parts.push('  <div class="cbm-d-commentbox"><input type="text" placeholder="Write a Comment" /></div>');
    parts.push('</div>');
    return parts.join('\n');
  }

  function openDetail(taskId, ctx, source){
    const task = (ctx.tasks||[]).find(t=>t.id===taskId);
    if (!task) return;
    const kind = (source==='board') ? 'modal' : 'panel';
    const shell = ensureDetailShell(kind);
    const inner = (kind==='modal') ? shell.querySelector('.cbm-modal') : shell.querySelector('.cbm-panel-inner');
    inner.innerHTML = detailHtml(task, ctx);
    // wire
    const close = inner.querySelector('.cbm-d-close'); if (close) close.addEventListener('click', closeDetail);
    const titleEl = inner.querySelector('[data-field="title"]');
    if (titleEl){ titleEl.addEventListener('blur', ()=>{ if (ctx.onRename) ctx.onRename(taskId, titleEl.textContent.trim()); }); }
    shell.classList.add('open');
  }

  // --- Public API ---
  window.ShadowViewKit = window.ShadowCreatedByMe = {
    STATUS_BUCKETS, STATUS_COLORS,
    filterCreatedByMe, applySubFilter, groupByStatus, statusBucket,
    renderBoard, renderList, openDetail, closeDetail, toast
  };
})();
