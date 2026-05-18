/* =======================================================
   task-templates.js  -  Shadow ToDo  -  Task Templates
   Flows: Create | Library | Apply | Share | Edit
   Persistence: localStorage (shadow_templates)
   AC: AC1-AC6 | TC: TC1-TC10
======================================================= */
(function() {
  'use strict';

  // âââ CONSTANTS ââââââââââââââââââââââââââââââââââââââââ
  const STORE_KEY   = 'shadow_templates';
  const MAX_DEPTH   = 2;   // Parent > Subtask only
  const MAX_SUB     = 20;  // max subtasks per template
  const MAX_SHARE   = 50;  // max users per share action
  const MAX_NAME    = 100; // template name char limit
  const TMPL_VER    = 1;

  // âââ STATE ââââââââââââââââââââââââââââââââââââââââââââ
  const TM = {
    templates   : [],   // all templates for current user
    activeFilter: 'all', // all | personal | shared | group
    activeSort  : 'recent', // recent | favourite
    searchQuery : '',
    previewId   : null,
    editingId   : null,
    shareTargetId: null,
    applyingId  : null,
    dragSrc     : null,
    init        : false
  };

  // âââ UTILS ââââââââââââââââââââââââââââââââââââââââââââ
  function uid() { return 'tm_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }
  function now() { return new Date().toISOString(); }
  function esc(s) { return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function currentUserId()   { return window.state?.currentUserId  || 'u_unknown'; }
  function currentUserName() { return window.state?.currentUserName || 'User'; }
  function getGroups()       { return window.state?.groups || []; }
  function getMembers()      { return window.state?.members || []; }

  // âââ PERSISTENCE ââââââââââââââââââââââââââââââââââââââ
  function loadTemplates() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      TM.templates = raw ? JSON.parse(raw) : [];
    } catch(e) { TM.templates = []; }
  }
  function saveTemplates() {
    localStorage.setItem(STORE_KEY, JSON.stringify(TM.templates));
  }
  function findTmpl(id) { return TM.templates.find(t => t.id === id); }
  function isOwner(tmpl) { return tmpl && tmpl.createdBy === currentUserId(); }

  // âââ FILTERED + SORTED LIST âââââââââââââââââââââââââââ
  function getFilteredTemplates() {
    let list = TM.templates.slice();
    const uid = currentUserId();

    // filter by scope
    if (TM.activeFilter === 'personal') {
      list = list.filter(t => t.createdBy === uid && (!t.sharedWith || t.sharedWith.length === 0));
    } else if (TM.activeFilter === 'shared') {
      list = list.filter(t => t.createdBy !== uid && t.sharedWith &&
        t.sharedWith.some(s => s.type === 'user' && s.id === uid));
    } else if (TM.activeFilter === 'group') {
      const myGroupIds = getGroups().filter(g => g.memberIds?.includes(uid) || g.adminIds?.includes(uid)).map(g => g.id);
      list = list.filter(t => t.sharedWith &&
        t.sharedWith.some(s => s.type === 'group' && myGroupIds.includes(s.id)));
    } else { // all - show own + shared to me
      list = list.filter(t => t.createdBy === uid ||
        (t.sharedWith && t.sharedWith.some(s =>
          (s.type === 'user' && s.id === uid) ||
          (s.type === 'group' && getGroups().some(g => g.id === s.id && (g.memberIds?.includes(uid) || g.adminIds?.includes(uid))))
        ))
      );
    }

    // search
    if (TM.searchQuery) {
      const q = TM.searchQuery.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q));
    }

    // sort
    if (TM.activeSort === 'favourite') {
      list.sort((a,b) => (b.isFavourite?1:0) - (a.isFavourite?1:0) || new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      list.sort((a,b) => new Date(b.updatedAt||b.createdAt) - new Date(a.updatedAt||a.createdAt));
    }

    return list;
  }

  // âââ FLOW 1: CREATE TEMPLATE âââââââââââââââââââââââââââ
  // Extract template data from a task object (strips assignees/dueDates)
  function extractFromTask(task) {
    const subtasks = (task.subtasks || []).slice(0, MAX_SUB).map(st => ({
      title      : st.title || st.name || '',
      priority   : st.priority || 'None',
      tags       : (st.tags || []).slice(),
      description: st.description || ''
      // no assignee, no dueDate
    }));
    return {
      parentTitle: task.title || '',
      priority   : task.priority || 'None',
      tags       : (task.tags || []).slice(),
      description: task.description || '',
      subtasks
    };
  }

  // Main create function called from Save-As-Template dialog
  function createTemplate(name, taskData, options) {
    name = (name || '').trim();
    if (!name)               { alert('Template name is required.'); return null; }
    if (name.length > MAX_NAME) { alert('Template name must be ' + MAX_NAME + ' characters or fewer.'); return null; }
    const subCount = (taskData.subtasks || []).length;
    if (subCount > MAX_SUB) {
      alert('This task has ' + subCount + ' subtasks. Templates support a maximum of ' + MAX_SUB + ' subtasks. Please reduce subtasks before saving as template.'); // TC1
      return null;
    }
    const tmpl = {
      id          : uid(),
      version     : TMPL_VER,
      name,
      parentTitle : taskData.parentTitle || '',
      priority    : taskData.priority    || 'None',
      tags        : taskData.tags        || [],
      description : taskData.description || '',
      subtasks    : (taskData.subtasks   || []).map((st, i) => ({
        id         : uid(),
        order      : i,
        title      : st.title || '',
        priority   : st.priority || 'None',
        tags       : st.tags   || [],
        description: st.description || ''
      })),
      createdBy   : currentUserId(),
      createdByName: currentUserName(),
      createdAt   : now(),
      updatedAt   : now(),
      isFavourite : false,
      sharedWith  : [],  // {type:'user'|'group', id, name}
      usageCount  : 0
    };
    TM.templates.push(tmpl);
    saveTemplates();
    return tmpl;
  }

  // Update an existing template (edit flow) - AC6: does NOT alter previously created tasks
  function updateTemplate(id, changes) {
    const tmpl = findTmpl(id);
    if (!tmpl || !isOwner(tmpl)) return false;
    Object.assign(tmpl, changes, { updatedAt: now() });
    saveTemplates();
    return true;
  }

  function deleteTemplate(id) {
    const idx = TM.templates.findIndex(t => t.id === id);
    if (idx === -1) return;
    if (!isOwner(TM.templates[idx])) return;
    TM.templates.splice(idx, 1);
    saveTemplates();
  }

  function toggleFavourite(id) {
    const tmpl = findTmpl(id);
    if (tmpl) { tmpl.isFavourite = !tmpl.isFavourite; tmpl.updatedAt = now(); saveTemplates(); }
  }

  // âââ FLOW 3: APPLY TEMPLATE ââââââââââââââââââââââââââââââ
  // Build apply-preview config from template + optional user overrides
  function buildApplyConfig(tmpl, overrides) {
    overrides = overrides || {};
    return {
      title      : overrides.title       || tmpl.parentTitle || tmpl.name,
      priority   : overrides.priority    || tmpl.priority,
      tags       : overrides.tags        || tmpl.tags.slice(),
      description: overrides.description || tmpl.description,
      group      : overrides.group       || null, // user selects at apply time
      category   : overrides.category    || null,
      subtasks   : tmpl.subtasks.map((st, i) => ({
        title      : (overrides.subtasks && overrides.subtasks[i]?.title) || st.title,
        priority   : (overrides.subtasks && overrides.subtasks[i]?.priority) || st.priority,
        tags       : (overrides.subtasks && overrides.subtasks[i]?.tags)  || st.tags.slice(),
        description: (overrides.subtasks && overrides.subtasks[i]?.description) || st.description
      }))
      // Note: assignee and dueDate are NEVER copied from template (TC2)
    };
  }

  // Actually apply a template - creates parent task + subtasks via ShadowDB
  function applyTemplate(tmplId, overrides, groupId) {
    const tmpl = findTmpl(tmplId);
    if (!tmpl) return;
    const cfg = buildApplyConfig(tmpl, overrides);
    if (!window.ShadowDB || !window.ShadowDB.Tasks) { alert('Task system not ready.'); return; }

    const parentData = {
      title      : cfg.title,
      priority   : cfg.priority,
      tags       : cfg.tags,
      description: cfg.description,
      group      : groupId || null,
      category   : cfg.category || 'General',
      status     : 'Open',
      assignee   : null,  // stripped - TC2
      assignees  : [],    // stripped - TC2
      dueDate    : null,  // stripped - TC2
      startDate  : null,
      subtasks   : cfg.subtasks.map(st => ({
        title      : st.title,
        priority   : st.priority,
        tags       : st.tags,
        description: st.description,
        status     : 'Open',
        done       : false
      })),
      fromTemplate: tmplId  // audit trail
    };

    const task = window.ShadowDB.Tasks.create(parentData);
    if (task) {
      tmpl.usageCount = (tmpl.usageCount || 0) + 1;
      tmpl.updatedAt = now();
      saveTemplates();
      // Push bell notification
      if (window.pushBellNotification) {
        window.pushBellNotification(currentUserName() + ' applied template â' + tmpl.name + 'â â ' + cfg.subtasks.length + ' subtask(s) created');
      }
    }
    return task;
  }

  // âââ FLOW 4: SHARE TEMPLATE âââââââââââââââââââââââââââââââ
  // AC5: max 50 users per share action, recipients are read-only
  function shareTemplate(tmplId, targets) {
    // targets = [{type:'user'|'group', id, name}, ...]
    const tmpl = findTmpl(tmplId);
    if (!tmpl || !isOwner(tmpl)) { alert('Only the template owner can share it.'); return false; }

    // count users in this action (TC8)
    const userTargets = targets.filter(t => t.type === 'user');
    if (userTargets.length > MAX_SHARE) {
      alert('You can share with a maximum of ' + MAX_SHARE + ' users per action. Selected: ' + userTargets.length); // TC8
      return false;
    }

    // merge without dupes
    targets.forEach(target => {
      const exists = tmpl.sharedWith.find(s => s.type === target.type && s.id === target.id);
      if (!exists) tmpl.sharedWith.push({ type: target.type, id: target.id, name: target.name, sharedAt: now() });
    });
    tmpl.updatedAt = now();
    saveTemplates();
    return true;
  }

  function unshareTemplate(tmplId, type, targetId) {
    const tmpl = findTmpl(tmplId);
    if (!tmpl || !isOwner(tmpl)) return;
    tmpl.sharedWith = tmpl.sharedWith.filter(s => !(s.type === type && s.id === targetId));
    tmpl.updatedAt = now();
    saveTemplates();
  }

  // âââ UI HELPERS âââââââââââââââââââââââââââââââââââââââââ
  function priColor(p) {
    return {High:'#ea4335',Medium:'#f59f00',Low:'#1a73e8',None:'#9ca3af'}[p] || '#9ca3af';
  }
  function priLabel(p) {
    return {High:'â High',Medium:'â Medium',Low:'â Low',None:'â None'}[p] || p;
  }
  function taskCountLabel(tmpl) {
    const sub = tmpl.subtasks.length;
    return 1 + sub + ' task' + (1+sub !== 1 ? 's':'') + (sub > 0 ? ' (1 parent + '+sub+' subtasks)':'');
  }
  function sharedLabel(tmpl) {
    if (!tmpl.sharedWith || !tmpl.sharedWith.length) return '';
    return 'Shared with ' + tmpl.sharedWith.length + ' recipient(s)';
  }
  function isMine(tmpl) { return tmpl.createdBy === currentUserId(); }

  // âââ SIDEBAR ENTRY âââââââââââââââââââââââââââââââââââââ
  function injectSidebarEntry() {
    if (document.getElementById('tm-sidebar-item')) return;
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // Find or create TEMPLATES section
    const section = document.createElement('div');
    section.className = 'sidebar-section';
    section.id = 'tm-sidebar-section';
    section.innerHTML =
      '<div class="section-title">TEMPLATES</div>' +
      '<div class="nav-item" id="tm-sidebar-item" data-view="templates">' +
      '  <i class="fa-solid fa-file-lines"></i> Templates' +
      '  <span class="count" id="tm-sidebar-count">0</span>' +
      '</div>' +
      '<div class="nav-item" id="tm-new-blank-item" title="Create blank template">' +
      '  <i class="fa-regular fa-file-plus" style="color:#1a73e8"></i>' +
      '  <span style="color:#1a73e8;font-size:12px;margin-left:4px">New Template</span>' +
      '</div>';

    // Insert before TAGS section or append
    const tagsSection = [...sidebar.querySelectorAll('.sidebar-section')]
      .find(s => s.querySelector('.section-title')?.textContent?.includes('TAGS'));
    if (tagsSection) sidebar.insertBefore(section, tagsSection);
    else sidebar.appendChild(section);

    // Wire clicks
    document.getElementById('tm-sidebar-item').onclick = () => openLibrary();
    document.getElementById('tm-new-blank-item').onclick = () => openCreateModal(null);
    updateSidebarCount();
  }

  function updateSidebarCount() {
    const el = document.getElementById('tm-sidebar-count');
    if (el) el.textContent = getFilteredTemplates().length;
  }

  // --- FLOW 2: LIBRARY PANEL
  function openLibrary() {
    document.querySelectorAll('[id^=tm-]:not(#tm-library)').forEach(el => el.style && (el.style.display='none'));
    var panel = document.getElementById('tm-library');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'tm-library';
      panel.className = 'tm-library-panel';
      document.body.appendChild(panel);
    }
    panel.style.display = 'flex';
    renderLibrary(panel);
    document.querySelectorAll('.nav-item').forEach(function(el){el.classList.remove('active');});
    var si = document.getElementById('tm-sidebar-item');
    if (si) si.classList.add('active');
  }

  function renderLibrary(panel) {
    var list = getFilteredTemplates();
    var cardsHTML = list.length ? list.map(renderTemplateCard).join('') :
      '<div class="tm-empty"><i class="fa-regular fa-folder-open"></i><p>No templates found. Create one to get started!</p></div>';
    panel.innerHTML =
      '<div class="tm-library-header">' +
      '<div class="tm-library-title"><i class="fa-solid fa-file-lines"></i> Task Templates</div>' +
      '<div class="tm-library-actions">' +
      '<button class="tm-btn tm-btn-primary" id="tm-create-blank-btn"><i class="fa-solid fa-plus"></i> New Template</button>' +
      '<button class="tm-icon-btn" id="tm-library-close"><i class="fa-solid fa-xmark"></i></button>' +
      '</div></div>' +
      '<div class="tm-library-toolbar">' +
      '<div class="tm-search-wrap"><i class="fa-solid fa-magnifying-glass"></i>' +
      '<input class="tm-search-input" id="tm-lib-search" placeholder="Search templates..." value="' + esc(TM.searchQuery) + '">'  +
      '</div>' +
      '<select class="tm-select" id="tm-lib-sort">' +
      '<option value="recent"' + (TM.activeSort==='recent'?' selected':'') + '>Most Recent</option>' +
      '<option value="favourite"' + (TM.activeSort==='favourite'?' selected':'') + '>Favourites First</option>' +
      '</select></div>' +
      '<div class="tm-filter-tabs">' +
      ['all','personal','shared','group'].map(function(f){
        return '<button class="tm-tab' + (TM.activeFilter===f?' active':'') + '" data-filter="' + f + '">' + f.charAt(0).toUpperCase()+f.slice(1) + '</button>';
      }).join('') +
      '</div>' +
      '<div class="tm-library-body">' +
      '<div class="tm-card-grid" id="tm-card-grid">' + cardsHTML + '</div>' +
      '<div class="tm-preview-panel" id="tm-preview-panel" style="display:none">' +
      '<div class="tm-preview-header"><span id="tm-preview-title">Preview</span>' +
      '<button class="tm-icon-btn" id="tm-preview-close"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="tm-preview-body" id="tm-preview-body"></div>' +
      '<div class="tm-preview-footer">' +
      '<button class="tm-btn tm-btn-primary" id="tm-preview-apply-btn"><i class="fa-solid fa-bolt"></i> Apply Template</button>' +
      '<button class="tm-btn tm-btn-secondary" id="tm-preview-edit-btn"><i class="fa-solid fa-pen"></i> Edit</button>' +
      '<button class="tm-btn tm-btn-secondary" id="tm-preview-share-btn"><i class="fa-solid fa-share-nodes"></i> Share</button>' +
      '</div></div></div>';
    wireLibraryEvents(panel);
  }

  function wireLibraryEvents(panel) {
    var closeBtn = document.getElementById('tm-library-close');
    if (closeBtn) closeBtn.onclick = function(){ closeLibrary(); };
    var createBtn = document.getElementById('tm-create-blank-btn');
    if (createBtn) createBtn.onclick = function(){ openCreateModal(null); };
    var searchEl = document.getElementById('tm-lib-search');
    if (searchEl) searchEl.oninput = function(e){ TM.searchQuery = e.target.value; renderLibrary(panel); };
    var sortEl = document.getElementById('tm-lib-sort');
    if (sortEl) sortEl.onchange = function(e){ TM.activeSort = e.target.value; renderLibrary(panel); };
    panel.querySelectorAll('.tm-tab').forEach(function(btn){
      btn.onclick = function(){ TM.activeFilter = btn.dataset.filter; renderLibrary(panel); };
    });
    panel.querySelectorAll('.tm-card').forEach(function(card){
      var tid = card.dataset.id;
      var preBtn = card.querySelector('.tm-card-preview-btn');
      var appBtn = card.querySelector('.tm-card-apply-btn');
      var favBtn = card.querySelector('.tm-card-fav-btn');
      var edtBtn = card.querySelector('.tm-card-edit-btn');
      var shrBtn = card.querySelector('.tm-card-share-btn');
      var delBtn = card.querySelector('.tm-card-delete-btn');
      if (preBtn) preBtn.onclick = function(e){ e.stopPropagation(); openPreview(tid, panel); };
      if (appBtn) appBtn.onclick = function(e){ e.stopPropagation(); openApplyModal(tid); };
      if (favBtn) favBtn.onclick = function(e){ e.stopPropagation(); toggleFavourite(tid); renderLibrary(panel); };
      if (edtBtn) edtBtn.onclick = function(e){ e.stopPropagation(); openEditModal(tid); };
      if (shrBtn) shrBtn.onclick = function(e){ e.stopPropagation(); openShareModal(tid); };
      if (delBtn) delBtn.onclick = function(e){ e.stopPropagation(); confirmDeleteTemplate(tid, panel); };
    });
  }

  function closeLibrary() {
    var p = document.getElementById('tm-library'); if (p) p.style.display = 'none';
  }
  // --- Template Card HTML renderer
  function renderTemplateCard(tmpl) {
    var mine = isMine(tmpl);
    var shared = sharedLabel(tmpl);
    var fav = tmpl.isFavourite;
    return '<div class="tm-card' + (fav?' tm-card--fav':'') + '" data-id="' + esc(tmpl.id) + '">'
      + '<div class="tm-card-header">' 
      + '<div class="tm-card-name">' + esc(tmpl.name) + '</div>'
      + '<button class="tm-icon-btn tm-card-fav-btn" title="' + (fav?'Remove from Favourites':'Add to Favourites') + '">'
      + '<i class="' + (fav?'fa-solid':'fa-regular') + ' fa-star"></i></button>'
      + '</div>'
      + '<div class="tm-card-meta">' + esc(taskCountLabel(tmpl)) + '</div>'
      + '<div class="tm-card-pri" style="color:' + priColor(tmpl.priority) + '">'
      + priLabel(tmpl.priority) + '</div>'
      + (tmpl.tags.length ? '<div class="tm-card-tags">' + tmpl.tags.map(function(t){return '<span class="tm-tag">'+esc(t)+'</span>';}).join('') + '</div>' : '') 
      + (shared ? '<div class="tm-card-shared"><i class="fa-solid fa-share-nodes"></i> ' + esc(shared) + '</div>' : '') 
      + '<div class="tm-card-footer">' 
      + '<button class="tm-btn tm-btn-primary tm-card-apply-btn"><i class="fa-solid fa-bolt"></i> Apply</button>'
      + '<button class="tm-btn tm-btn-secondary tm-card-preview-btn"><i class="fa-regular fa-eye"></i> Preview</button>'
      + (mine ? '<button class="tm-icon-btn tm-card-edit-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>' : '') 
      + (mine ? '<button class="tm-icon-btn tm-card-share-btn" title="Share"><i class="fa-solid fa-share-nodes"></i></button>' : '') 
      + (mine ? '<button class="tm-icon-btn tm-card-delete-btn tm-danger" title="Delete"><i class="fa-solid fa-trash"></i></button>' : '') 
      + '</div>' 
      + '</div>';
  }

  // --- Preview Panel (TC5)
  function openPreview(tmplId, panel) {
    var tmpl = findTmpl(tmplId);
    if (!tmpl) return;
    TM.previewId = tmplId;
    var previewPanel = document.getElementById('tm-preview-panel');
    var previewBody  = document.getElementById('tm-preview-body');
    var previewTitle = document.getElementById('tm-preview-title');
    if (!previewPanel) return;
    previewTitle.textContent = esc(tmpl.name);
    previewBody.innerHTML = renderPreviewBody(tmpl);
    previewPanel.style.display = 'flex';
    // Wire preview buttons
    var applyBtn = document.getElementById('tm-preview-apply-btn');
    var editBtn  = document.getElementById('tm-preview-edit-btn');
    var shareBtn = document.getElementById('tm-preview-share-btn');
    var closeBtn = document.getElementById('tm-preview-close');
    if (applyBtn) applyBtn.onclick = function(){ openApplyModal(tmplId); };
    if (editBtn)  editBtn.onclick  = function(){ openEditModal(tmplId); };
    if (shareBtn) shareBtn.onclick = function(){ openShareModal(tmplId); };
    if (closeBtn) closeBtn.onclick = function(){ previewPanel.style.display='none'; TM.previewId=null; };
    // show/hide edit+share only for owner
    var mine = isMine(tmpl);
    if (editBtn)  editBtn.style.display  = mine ? ''  : 'none';
    if (shareBtn) shareBtn.style.display = mine ? ''  : 'none';
  }

  function renderPreviewBody(tmpl) {
    var html = '<div class="tm-preview-task tm-preview-parent">'
      + '<div class="tm-preview-task-title"><i class="fa-regular fa-circle-dot"></i> ' + esc(tmpl.parentTitle || tmpl.name) + '</div>'
      + '<div class="tm-preview-task-meta">'
      + '<span class="tm-preview-pri" style="color:' + priColor(tmpl.priority) + '">'+ priLabel(tmpl.priority) +'</span>'
      + (tmpl.tags.length ? '<span class="tm-preview-tags">' + tmpl.tags.map(function(t){return '<span class="tm-tag">'+esc(t)+'</span>';}).join('') + '</span>' : '') 
      + '</div>' 
      + (tmpl.description ? '<div class="tm-preview-desc">' + esc(tmpl.description) + '</div>' : '') 
      + '</div>';
    if (tmpl.subtasks.length) {
      html += '<div class="tm-preview-subtasks">'
        + '<div class="tm-preview-sub-label">Subtasks (' + tmpl.subtasks.length + ')</div>';
      tmpl.subtasks.forEach(function(st){
        html += '<div class="tm-preview-task tm-preview-sub">' 
          + '<div class="tm-preview-task-title"><i class="fa-regular fa-circle"></i> ' + esc(st.title) + '</div>'
          + '<div class="tm-preview-task-meta">'
          + '<span class="tm-preview-pri" style="color:' + priColor(st.priority) + '">'+ priLabel(st.priority) +'</span>'
          + (st.tags.length ? '<span class="tm-preview-tags">' + st.tags.map(function(t){return '<span class="tm-tag">'+esc(t)+'</span>';}).join('') + '</span>' : '') 
          + '</div></div>';
      });
      html += '</div>';
    }
    html += '<div class="tm-preview-footer-meta">' 
      + '<span>Created by ' + esc(tmpl.createdByName) + '</span>' 
      + '<span>Used ' + (tmpl.usageCount||0) + ' time(s)</span>' 
      + '</div>';
    return html;
  }
  // --- FLOW 1: CREATE TEMPLATE MODAL
  function openCreateModal(taskId) {
    var existing = null;
    if (taskId) {
      var t = (window.state && window.state.tasks) ? window.state.tasks.find(function(t){return t.id===taskId;}) : null;
      existing = t ? extractFromTask(t) : null;
    }
    renderCreateModal(existing);
  }

  function renderCreateModal(prefill) {
    removeTmModal('tm-create-modal');
    prefill = prefill || { parentTitle:'', priority:'None', tags:[], description:'', subtasks:[] };

    // Warn if too many subtasks (TC1)
    var subList = (prefill.subtasks || []).slice(0, MAX_SUB);
    var truncated = (prefill.subtasks||[]).length > MAX_SUB;

    var el = document.createElement('div');
    el.id = 'tm-create-modal';
    el.className = 'tm-modal-overlay';
    el.innerHTML =
      '<div class="tm-modal">' +
      '<div class="tm-modal-header"><h3><i class="fa-solid fa-file-plus"></i> Create Template</h3>' +
      '<button class="tm-icon-btn tm-modal-close"><i class="fa-solid fa-xmark"></i></button></div>' +
      (truncated ? '<div class="tm-alert tm-alert-warn"><i class="fa-solid fa-triangle-exclamation"></i> This task has more than 20 subtasks. Only the first 20 will be saved.</div>' : '') +
      '<div class="tm-modal-body">' +
      '<label class="tm-label">Template Name <span class="tm-required">*</span></label>' +
      '<input id="tm-crt-name" class="tm-input" maxlength="' + MAX_NAME + '" placeholder="e.g. Bug Fix Workflow" value="' + esc(prefill.parentTitle) + '">'  +
      '<div class="tm-char-limit" id="tm-crt-charlimit">' + (prefill.parentTitle||''). length + '/ ' + MAX_NAME + '</div>' +
      '<label class="tm-label">Parent Task Title</label>' +
      '<input id="tm-crt-parent" class="tm-input" placeholder="Parent task title" value="' + esc(prefill.parentTitle) + '">'  +
      '<label class="tm-label">Priority</label>' +
      '<select id="tm-crt-pri" class="tm-select">'  +
      ['None','Low','Medium','High'].map(function(p){
        return '<option value="'+p+'"' + (prefill.priority===p?' selected':'') + '>'+p+'</option>';
      }).join('') +
      '</select>' +
      '<label class="tm-label">Tags (comma-separated)</label>' +
      '<input id="tm-crt-tags" class="tm-input" placeholder="e.g. backend, urgent" value="' + esc((prefill.tags||[]).join(', ')) + '">'  +
      '<label class="tm-label">Description</label>' +
      '<textarea id="tm-crt-desc" class="tm-textarea" placeholder="Optional description...">' + esc(prefill.description) + '</textarea>' +
      '<label class="tm-label">Subtasks (' + subList.length + '/ ' + MAX_SUB + ')</label>' +
      '<div id="tm-crt-subtasks" class="tm-subtask-list">' +
      subList.map(function(st, i){
        return '<div class="tm-subtask-row" data-idx="'+i+'">'
          + '<input class="tm-input tm-sub-title" data-idx="'+i+'" placeholder="Subtask title" value="' + esc(st.title) + '">'
          + '<select class="tm-select tm-sub-pri" data-idx="'+i+'">'
          + ['None','Low','Medium','High'].map(function(p){return '<option value="'+p+'"' + (st.priority===p?' selected':'') + '>'+p+'</option>';}).join('') 
          + '</select>' 
          + '<button class="tm-icon-btn tm-remove-sub tm-danger" data-idx="'+i+'"><i class="fa-solid fa-minus"></i></button></div>';
      }).join('') +
      '</div>' +
      (subList.length < MAX_SUB ? '<button class="tm-btn tm-btn-outline" id="tm-crt-add-sub"><i class="fa-solid fa-plus"></i> Add Subtask</button>' : '') +
      '</div>' +
      '<div class="tm-modal-footer">' +
      '<button class="tm-btn tm-btn-primary" id="tm-crt-save">Save Template</button>' +
      '<button class="tm-btn tm-btn-secondary" id="tm-crt-cancel">Cancel</button>' +
      '</div></div>';

    document.body.appendChild(el);
    wireCreateModal(el, prefill);
  }

  function wireCreateModal(el, prefill) {
    el.querySelector('.tm-modal-close').onclick = function(){ removeTmModal('tm-create-modal'); };
    el.querySelector('#tm-crt-cancel').onclick  = function(){ removeTmModal('tm-create-modal'); };
    el.querySelector('#tm-crt-name').oninput = function(e){
      var lbl = el.querySelector('#tm-crt-charlimit');
      if (lbl) lbl.textContent = e.target.value.length + ' / ' + MAX_NAME;
    };
    el.onclick = function(e){ if (e.target === el) removeTmModal('tm-create-modal'); };

    // Add subtask button
    var addSubBtn = el.querySelector('#tm-crt-add-sub');
    if (addSubBtn) {
      addSubBtn.onclick = function() {
        var list = el.querySelector('#tm-crt-subtasks');
        var rows = list.querySelectorAll('.tm-subtask-row');
        if (rows.length >= MAX_SUB) return;
        var idx = rows.length;
        var row = document.createElement('div');
        row.className = 'tm-subtask-row';
        row.dataset.idx = idx;
        row.innerHTML = '<input class="tm-input tm-sub-title" data-idx="'+idx+'" placeholder="Subtask title" value="">' 
          + '<select class="tm-select tm-sub-pri" data-idx="'+idx+'">'
          + ['None','Low','Medium','High'].map(function(p){return '<option>'+p+'</option>';}).join('') + '</select>'
          + '<button class="tm-icon-btn tm-remove-sub tm-danger" data-idx="'+idx+'"><i class="fa-solid fa-minus"></i></button>';
        list.appendChild(row);
        wireRemoveSubBtns(el);
        var countLbl = el.querySelector('.tm-label:last-of-type');
        // hide add btn if at limit
        if (list.querySelectorAll('.tm-subtask-row').length >= MAX_SUB) addSubBtn.style.display='none';
      };
    }
    wireRemoveSubBtns(el);

    el.querySelector('#tm-crt-save').onclick = function() {
      var name    = el.querySelector('#tm-crt-name').value.trim();
      var parent  = el.querySelector('#tm-crt-parent').value.trim();
      var pri     = el.querySelector('#tm-crt-pri').value;
      var tagsRaw = el.querySelector('#tm-crt-tags').value;
      var desc    = el.querySelector('#tm-crt-desc').value.trim();
      var tags    = tagsRaw.split(',').map(function(t){return t.trim();}).filter(Boolean);
      var rows    = el.querySelectorAll('.tm-subtask-row');
      var subtasks = [];
      rows.forEach(function(row){
        var title = row.querySelector('.tm-sub-title').value.trim();
        var pri2  = row.querySelector('.tm-sub-pri').value;
        if (title) subtasks.push({ title: title, priority: pri2, tags:[], description:''});
      });
      var tmpl = createTemplate(name, { parentTitle: parent||name, priority: pri, tags: tags, description: desc, subtasks: subtasks });
      if (tmpl) {
        removeTmModal('tm-create-modal');
        updateSidebarCount();
        var lib = document.getElementById('tm-library');
        if (lib && lib.style.display !== 'none') renderLibrary(lib);
        showToast('Template "' + tmpl.name + '" created!');
      }
    };
  }

  function wireRemoveSubBtns(el) {
    el.querySelectorAll('.tm-remove-sub').forEach(function(btn){
      btn.onclick = function(){
        btn.closest('.tm-subtask-row').remove();
        var addSubBtn = el.querySelector('#tm-crt-add-sub');
        if (addSubBtn) addSubBtn.style.display = '';
      };
    });
  }
  // --- FLOW 3: APPLY TEMPLATE MODAL
  function openApplyModal(tmplId) {
    var tmpl = findTmpl(tmplId);
    if (!tmpl) return;
    TM.applyingId = tmplId;
    removeTmModal('tm-apply-modal');
    var groups = getGroups();
    var el = document.createElement('div');
    el.id = 'tm-apply-modal';
    el.className = 'tm-modal-overlay';
    el.innerHTML =
      '<div class="tm-modal">' +
      '<div class="tm-modal-header"><h3><i class="fa-solid fa-bolt"></i> Apply Template: ' + esc(tmpl.name) + '</h3>' +
      '<button class="tm-icon-btn tm-modal-close"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="tm-modal-body">' +
      '<div class="tm-alert tm-alert-info"><i class="fa-solid fa-info-circle"></i> Assignee and Due Date will not be set (they can be added after creation).</div>' +
      '<label class="tm-label">Task Title</label>' +
      '<input id="tm-apl-title" class="tm-input" value="' + esc(tmpl.parentTitle || tmpl.name) + '">'  +
      '<label class="tm-label">Group</label>' +
      '<select id="tm-apl-group" class="tm-select">' +
      '<option value="">No Group (Personal)</option>' +
      groups.map(function(g){return '<option value="'+esc(g.id)+'">'+ esc(g.name) +'</option>';}).join('') +
      '</select>' +
      '<label class="tm-label">Priority</label>' +
      '<select id="tm-apl-pri" class="tm-select">' +
      ['None','Low','Medium','High'].map(function(p){return '<option value="'+p+'"' + (tmpl.priority===p?' selected':'') + '>'+p+'</option>';}).join('') +
      '</select>' +
      '<div class="tm-apply-preview">' +
      '<div class="tm-label">Preview (' + (1+tmpl.subtasks.length) + ' tasks will be created)</div>' +
      '<div class="tm-preview-mini">' +
      '<div class="tm-prow tm-prow--parent"><i class="fa-regular fa-circle-dot"></i> ' + esc(tmpl.parentTitle||tmpl.name) + '</div>' +
      tmpl.subtasks.map(function(st){
        return '<div class="tm-prow tm-prow--sub"><i class="fa-regular fa-circle"></i> ' + esc(st.title) + '</div>';
      }).join('') + '</div></div>' +
      '</div>' +
      '<div class="tm-modal-footer">' +
      '<button class="tm-btn tm-btn-primary" id="tm-apl-confirm"><i class="fa-solid fa-bolt"></i> Apply &amp; Create Tasks</button>' +
      '<button class="tm-btn tm-btn-secondary" id="tm-apl-cancel">Cancel</button>' +
      '</div></div>';
    document.body.appendChild(el);
    el.querySelector('.tm-modal-close').onclick = function(){ removeTmModal('tm-apply-modal'); };
    el.querySelector('#tm-apl-cancel').onclick  = function(){ removeTmModal('tm-apply-modal'); };
    el.onclick = function(e){ if (e.target===el) removeTmModal('tm-apply-modal'); };
    el.querySelector('#tm-apl-confirm').onclick = function() {
      var title = el.querySelector('#tm-apl-title').value.trim();
      var group = el.querySelector('#tm-apl-group').value;
      var pri   = el.querySelector('#tm-apl-pri').value;
      if (!title) { alert('Task title is required.'); return; }
      var task = applyTemplate(tmplId, { title: title, priority: pri }, group || null);
      if (task) {
        removeTmModal('tm-apply-modal');
        var lib = document.getElementById('tm-library');
        if (lib && lib.style.display !== 'none') renderLibrary(lib);
        showToast('Template applied! ' + (1+tmpl.subtasks.length) + ' task(s) created.');
        // Trigger app refresh
        if (window.ShadowDB) window.ShadowDB.emit('tasks:updated', {});
        if (typeof renderCurrentView === 'function') renderCurrentView();
      }
    };
  }
  // --- FLOW 5: EDIT TEMPLATE MODAL (AC6: only affects future, not past tasks)
  function openEditModal(tmplId) {
    var tmpl = findTmpl(tmplId);
    if (!tmpl) return;
    if (!isMine(tmpl)) { showToast('Only the template owner can edit it.'); return; }
    TM.editingId = tmplId;
    removeTmModal('tm-edit-modal');
    var el = document.createElement('div');
    el.id = 'tm-edit-modal';
    el.className = 'tm-modal-overlay';
    el.innerHTML =
      '<div class="tm-modal tm-modal--wide">' +
      '<div class="tm-modal-header">' +
      '<h3><i class="fa-solid fa-pen"></i> Edit Template</h3>' +
      '<button class="tm-icon-btn tm-modal-close"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="tm-alert tm-alert-info"><i class="fa-solid fa-info-circle"></i> Changes only affect future uses. Tasks already created from this template are unchanged. (AC6)</div>' +
      '<div class="tm-modal-body">' +
      '<label class="tm-label">Template Name <span class="tm-required">*</span></label>' +
      '<input id="tm-edt-name" class="tm-input" maxlength="' + MAX_NAME + '" value="' + esc(tmpl.name) + '">'  +
      '<label class="tm-label">Parent Task Title</label>' +
      '<input id="tm-edt-parent" class="tm-input" value="' + esc(tmpl.parentTitle) + '">'  +
      '<label class="tm-label">Priority</label>' +
      '<select id="tm-edt-pri" class="tm-select">' +
      ['None','Low','Medium','High'].map(function(p){return '<option value="'+p+'"' + (tmpl.priority===p?' selected':'') + '>'+p+'</option>';}).join('') + '</select>' +
      '<label class="tm-label">Tags (comma-separated)</label>' +
      '<input id="tm-edt-tags" class="tm-input" value="' + esc(tmpl.tags.join(', ')) + '">'  +
      '<label class="tm-label">Description</label>' +
      '<textarea id="tm-edt-desc" class="tm-textarea">' + esc(tmpl.description) + '</textarea>' +
      '<label class="tm-label">Subtasks (drag to reorder) &mdash; ' + tmpl.subtasks.length + '/ ' + MAX_SUB + '</label>' +
      '<div id="tm-edt-subtasks" class="tm-subtask-list tm-drag-list">'  +
      tmpl.subtasks.map(function(st, i){
        return '<div class="tm-subtask-row tm-drag-item" draggable="true" data-idx="'+i+'">'
          + '<span class="tm-drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>'
          + '<input class="tm-input tm-sub-title" data-idx="'+i+'" value="' + esc(st.title) + '">'
          + '<select class="tm-select tm-sub-pri" data-idx="'+i+'">'
          + ['None','Low','Medium','High'].map(function(p){return '<option value="'+p+'"' + (st.priority===p?' selected':'') + '>'+p+'</option>';}).join('') 
          + '</select>' 
          + '<button class="tm-icon-btn tm-remove-sub tm-danger" data-idx="'+i+'"><i class="fa-solid fa-minus"></i></button></div>';
      }).join('') + '</div>' +
      (tmpl.subtasks.length < MAX_SUB ? '<button class="tm-btn tm-btn-outline" id="tm-edt-add-sub"><i class="fa-solid fa-plus"></i> Add Subtask</button>' : '') +
      '</div>' +
      '<div class="tm-modal-footer">' +
      '<button class="tm-btn tm-btn-primary" id="tm-edt-save">Save Changes</button>' +
      '<button class="tm-btn tm-btn-secondary" id="tm-edt-cancel">Cancel</button>' +
      '</div></div>';
    document.body.appendChild(el);
    wireEditModal(el, tmpl);
    initDragDrop(el.querySelector('#tm-edt-subtasks'));
  }

  function wireEditModal(el, tmpl) {
    el.querySelector('.tm-modal-close').onclick = function(){ removeTmModal('tm-edit-modal'); };
    el.querySelector('#tm-edt-cancel').onclick  = function(){ removeTmModal('tm-edit-modal'); };
    el.onclick = function(e){ if (e.target===el) removeTmModal('tm-edit-modal'); };
    var addSubBtn = el.querySelector('#tm-edt-add-sub');
    if (addSubBtn) {
      addSubBtn.onclick = function() {
        var list = el.querySelector('#tm-edt-subtasks');
        if (list.querySelectorAll('.tm-subtask-row').length >= MAX_SUB) return;
        var idx = list.querySelectorAll('.tm-subtask-row').length;
        var row = document.createElement('div');
        row.className = 'tm-subtask-row tm-drag-item';
        row.draggable = true;
        row.dataset.idx = idx;
        row.innerHTML = '<span class="tm-drag-handle"><i class="fa-solid fa-grip-vertical"></i></span>'
          + '<input class="tm-input tm-sub-title" data-idx="'+idx+'" placeholder="Subtask title" value="">' 
          + '<select class="tm-select tm-sub-pri">'
          + ['None','Low','Medium','High'].map(function(p){return '<option>'+p+'</option>';}).join('') + '</select>'
          + '<button class="tm-icon-btn tm-remove-sub tm-danger"><i class="fa-solid fa-minus"></i></button>';
        list.appendChild(row);
        wireRemoveSubBtnsEdit(el);
        initDragDrop(list);
      };
    }
    wireRemoveSubBtnsEdit(el);
    el.querySelector('#tm-edt-save').onclick = function() {
      var name    = el.querySelector('#tm-edt-name').value.trim();
      var parent  = el.querySelector('#tm-edt-parent').value.trim();
      var pri     = el.querySelector('#tm-edt-pri').value;
      var tagsRaw = el.querySelector('#tm-edt-tags').value;
      var desc    = el.querySelector('#tm-edt-desc').value.trim();
      var tags    = tagsRaw.split(',').map(function(t){return t.trim();}).filter(Boolean);
      var rows    = el.querySelectorAll('.tm-subtask-row');
      var subtasks = [];
      rows.forEach(function(row, i){
        var title = row.querySelector('.tm-sub-title').value.trim();
        var p2    = row.querySelector('.tm-sub-pri').value;
        subtasks.push({ id: uid(), order: i, title: title, priority: p2, tags:[], description:''});
      });
      var ok = updateTemplate(tmpl.id, { name:name, parentTitle:parent||name, priority:pri, tags:tags, description:desc, subtasks:subtasks });
      if (ok) {
        removeTmModal('tm-edit-modal');
        var lib = document.getElementById('tm-library');
        if (lib && lib.style.display !== 'none') renderLibrary(lib);
        showToast('Template updated (future uses only).');
      }
    };
  }

  function wireRemoveSubBtnsEdit(el) {
    el.querySelectorAll('.tm-remove-sub').forEach(function(btn){
      btn.onclick = function(){
        btn.closest('.tm-subtask-row').remove();
        var addSubBtn = el.querySelector('#tm-edt-add-sub');
        if (addSubBtn) addSubBtn.style.display = '';
      };
    });
  }
  // --- Drag & Drop (TC10)
  function initDragDrop(list) {
    if (!list) return;
    var items = list.querySelectorAll('.tm-drag-item');
    items.forEach(function(item) {
      item.ondragstart = function(e) {
        TM.dragSrc = item;
        e.dataTransfer.effectAllowed = 'move';
        item.classList.add('tm-dragging');
      };
      item.ondragend = function() {
        item.classList.remove('tm-dragging');
        list.querySelectorAll('.tm-drag-over').forEach(function(el){ el.classList.remove('tm-drag-over'); });
        TM.dragSrc = null;
      };
      item.ondragover = function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (TM.dragSrc && TM.dragSrc !== item) item.classList.add('tm-drag-over');
        return false;
      };
      item.ondragleave = function() { item.classList.remove('tm-drag-over'); };
      item.ondrop = function(e) {
        e.stopPropagation();
        if (TM.dragSrc && TM.dragSrc !== item) {
          var allItems = [...list.querySelectorAll('.tm-drag-item')];
          var srcIdx  = allItems.indexOf(TM.dragSrc);
          var destIdx = allItems.indexOf(item);
          if (srcIdx < destIdx) list.insertBefore(TM.dragSrc, item.nextSibling);
          else list.insertBefore(TM.dragSrc, item);
          initDragDrop(list); // re-wire
        }
        item.classList.remove('tm-drag-over');
        return false;
      };
    });
  }

  // --- FLOW 4: SHARE TEMPLATE MODAL
  function openShareModal(tmplId) {
    var tmpl = findTmpl(tmplId);
    if (!tmpl) return;
    if (!isMine(tmpl)) { showToast('Only the owner can share this template.'); return; }
    removeTmModal('tm-share-modal');
    var members = getMembers();
    var groups  = getGroups().filter(function(g){ return !g.isPersonal; });
    var el = document.createElement('div');
    el.id = 'tm-share-modal';
    el.className = 'tm-modal-overlay';
    el.innerHTML =
      '<div class="tm-modal">' +
      '<div class="tm-modal-header"><h3><i class="fa-solid fa-share-nodes"></i> Share Template: ' + esc(tmpl.name) + '</h3>' +
      '<button class="tm-icon-btn tm-modal-close"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="tm-modal-body">' +
      '<div class="tm-alert tm-alert-info"><i class="fa-solid fa-info-circle"></i> Recipients receive read-only access. Max ' + MAX_SHARE + ' users per action. (AC5)</div>' +
      '<label class="tm-label">Share with Groups</label>' +
      '<div class="tm-share-group-list">' +
      groups.map(function(g){
        var already = tmpl.sharedWith.some(function(s){ return s.type==='group' && s.id===g.id; });
        return '<label class="tm-share-item"><input type="checkbox" value="'+esc(g.id)+'" data-name="'+esc(g.name)+'" data-type="group" ' + (already?'checked':'') + '> '+esc(g.name)+'</label>';
      }).join('') +
      '</div>' +
      '<label class="tm-label">Share with Users <span class="tm-hint">(max ' + MAX_SHARE + ' per action)</span></label>' +
      '<div class="tm-share-user-list">' +
      members.filter(function(m){ return m.id !== currentUserId(); }).map(function(m){
        var already = tmpl.sharedWith.some(function(s){ return s.type==='user' && s.id===m.id; });
        return '<label class="tm-share-item"><input type="checkbox" value="'+esc(m.id)+'" data-name="'+esc(m.name)+'" data-type="user" ' + (already?'checked':'') + '> '+esc(m.name)+' ('+esc(m.email)+')</label>';
      }).join('') +
      '</div>' +
      (tmpl.sharedWith.length ? '<label class="tm-label" style="margin-top:12px">Currently Shared With</label>' +
      '<div class="tm-shared-current">' +
      tmpl.sharedWith.map(function(s){
        return '<span class="tm-shared-chip">' + esc(s.name) + ' ('+s.type+')' +
          '<button class="tm-chip-remove" data-type="'+s.type+'" data-id="'+esc(s.id)+'">Ã</button></span>';
      }).join('') + '</div>' : '') +
      '</div>' +
      '<div class="tm-modal-footer">' +
      '<button class="tm-btn tm-btn-primary" id="tm-shr-confirm"><i class="fa-solid fa-share-nodes"></i> Share</button>' +
      '<button class="tm-btn tm-btn-secondary" id="tm-shr-cancel">Cancel</button>' +
      '</div></div>';
    document.body.appendChild(el);
    el.querySelector('.tm-modal-close').onclick = function(){ removeTmModal('tm-share-modal'); };
    el.querySelector('#tm-shr-cancel').onclick  = function(){ removeTmModal('tm-share-modal'); };
    el.onclick = function(e){ if (e.target===el) removeTmModal('tm-share-modal'); };
    // Remove existing share
    el.querySelectorAll('.tm-chip-remove').forEach(function(btn){
      btn.onclick = function(e){
        e.preventDefault();
        unshareTemplate(tmplId, btn.dataset.type, btn.dataset.id);
        openShareModal(tmplId); // re-render
      };
    });
    el.querySelector('#tm-shr-confirm').onclick = function() {
      var checked = [...el.querySelectorAll('input[type=checkbox]:checked')];
      var targets = checked.map(function(cb){ return { type: cb.dataset.type, id: cb.value, name: cb.dataset.name }; });
      // De-dup against already shared
      targets = targets.filter(function(t){
        return !tmpl.sharedWith.some(function(s){ return s.type===t.type && s.id===t.id; });
      });
      if (targets.length === 0) { showToast('No new recipients selected.'); return; }
      var ok = shareTemplate(tmplId, targets);
      if (ok) {
        removeTmModal('tm-share-modal');
        var lib = document.getElementById('tm-library');
        if (lib && lib.style.display !== 'none') renderLibrary(lib);
        showToast('Template shared successfully.');
      }
    };
  }
  // --- CONTEXT MENU: "Save as Template" on task card right-click (AC1)
  function hookTaskContextMenu() {
    document.addEventListener('contextmenu', function(e) {
      var card = e.target.closest('.svk-card, .list-row, [data-task-id]');
      if (!card) return;
      var taskId = card.dataset.taskId || card.dataset.id;
      if (!taskId) return;
      e.preventDefault();
      var existing = document.getElementById('tm-ctx-menu');
      if (existing) existing.remove();
      var menu = document.createElement('div');
      menu.id = 'tm-ctx-menu';
      menu.className = 'tm-ctx-menu';
      menu.style.left = e.pageX + 'px';
      menu.style.top  = e.pageY + 'px';
      menu.innerHTML = '<div class="tm-ctx-item" id="tm-ctx-save"><i class="fa-solid fa-file-plus"></i> Save as Template</div>';
      document.body.appendChild(menu);
      menu.querySelector('#tm-ctx-save').onclick = function() {
        menu.remove();
        var task = window.state && window.state.tasks ? window.state.tasks.find(function(t){return t.id===taskId;}) : null;
        if (!task) { showToast('Task not found.'); return; }
        // TC1: check subtask count
        var subCount = (task.subtasks||[]).length;
        if (subCount > MAX_SUB) {
          if (!confirm('This task has ' + subCount + ' subtasks (max ' + MAX_SUB + ' allowed). Only the first 20 will be saved. Continue?')) return;
        }
        var prefill = extractFromTask(task);
        renderCreateModal(prefill);
      };
      // Close on outside click
      function closeMenu(ev) {
        if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', closeMenu); }
      }
      setTimeout(function(){ document.addEventListener('click', closeMenu); }, 10);
    }, true);
  }

  // --- NTM (New Task Modal) "Apply Template" button injection
  function injectNtmTemplateBtn() {
    if (document.getElementById('ntm-tmpl-btn')) return;
    var ntmActions = document.querySelector('.ntm-topbar-actions');
    if (!ntmActions) return;
    var btn = document.createElement('button');
    btn.id = 'ntm-tmpl-btn';
    btn.className = 'ntm-icon-btn';
    btn.title = 'Apply Template';
    btn.innerHTML = '<i class="fa-solid fa-file-lines"></i>';
    ntmActions.insertBefore(btn, ntmActions.firstChild);
    btn.onclick = function(e) {
      e.stopPropagation();
      openTemplatePickerForNtm();
    };
  }

  function openTemplatePickerForNtm() {
    var list = getFilteredTemplates();
    removeTmModal('tm-ntm-picker');
    if (!list.length) { showToast('No templates available. Create one first!'); return; }
    var el = document.createElement('div');
    el.id = 'tm-ntm-picker';
    el.className = 'tm-modal-overlay';
    el.innerHTML = '<div class="tm-modal"><div class="tm-modal-header"><h3><i class="fa-solid fa-file-lines"></i> Choose a Template</h3>' +
      '<button class="tm-icon-btn tm-modal-close"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="tm-modal-body">' +
      '<input class="tm-input" id="tm-ntm-search" placeholder="Search templates..." style="margin-bottom:12px">' +
      '<div id="tm-ntm-list">' +
      list.map(function(t){
        return '<div class="tm-ntm-item" data-id="'+esc(t.id)+'">' +
          '<div class="tm-ntm-name">' + esc(t.name) + '</div>' +
          '<div class="tm-ntm-meta">' + esc(taskCountLabel(t)) + '</div></div>';
      }).join('') +
      '</div></div></div>';
    document.body.appendChild(el);
    el.querySelector('.tm-modal-close').onclick = function(){ removeTmModal('tm-ntm-picker'); };
    el.onclick = function(e){ if(e.target===el) removeTmModal('tm-ntm-picker'); };
    el.querySelector('#tm-ntm-search').oninput = function(e){
      var q = e.target.value.toLowerCase();
      el.querySelectorAll('.tm-ntm-item').forEach(function(item){
        item.style.display = item.querySelector('.tm-ntm-name').textContent.toLowerCase().includes(q) ? '':'none';
      });
    };
    el.querySelectorAll('.tm-ntm-item').forEach(function(item){
      item.onclick = function() {
        removeTmModal('tm-ntm-picker');
        openApplyModal(item.dataset.id);
      };
    });
  }
  // --- TOAST NOTIFICATION
  function showToast(msg) {
    var t = document.createElement('div');
    t.className = 'tm-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function(){ t.classList.add('tm-toast--show'); });
    setTimeout(function(){ t.classList.remove('tm-toast--show'); setTimeout(function(){ t.remove(); }, 400); }, 3000);
  }

  function removeTmModal(id) {
    var el = document.getElementById(id); if (el) el.remove();
  }

  function confirmDeleteTemplate(tmplId, panel) {
    var tmpl = findTmpl(tmplId);
    if (!tmpl) return;
    if (!confirm('Delete template "' + tmpl.name + '"? This cannot be undone.')) return;
    deleteTemplate(tmplId);
    updateSidebarCount();
    if (panel) renderLibrary(panel);
    showToast('Template deleted.');
  }

  // --- PUBLIC API
  window.TaskTemplates = {
    openLibrary       : openLibrary,
    openCreateModal   : openCreateModal,
    openApplyModal    : openApplyModal,
    openEditModal     : openEditModal,
    openShareModal    : openShareModal,
    createTemplate    : createTemplate,
    applyTemplate     : applyTemplate,
    shareTemplate     : shareTemplate,
    getTemplates      : function() { return TM.templates.slice(); },
    getFiltered       : getFilteredTemplates
  };

  // --- INIT
  function init() {
    if (window._tmInitDone) return;
    window._tmInitDone = true;
    loadTemplates();
    // Wait for DOM + app to be ready
    function tryInject() {
      if (document.querySelector('.sidebar')) {
        injectSidebarEntry();
        hookTaskContextMenu();
        // Watch for NTM box appearing
        var ntmObserver = new MutationObserver(function() {
          if (document.querySelector('.ntm-box') && !document.getElementById('ntm-tmpl-btn')) {
            injectNtmTemplateBtn();
          }
        });
        ntmObserver.observe(document.body, { childList: true, subtree: true });
        // Watch for sidebar section being hidden by app re-renders
        var sidebarObserver = new MutationObserver(function() {
          var tmSec = document.getElementById('tm-sidebar-section');
          if (tmSec) {
            if (tmSec.style.display === 'none' || getComputedStyle(tmSec).display === 'none') {
              tmSec.style.display = 'block';
            }
          } else { injectSidebarEntry(); }
        });
        var sbEl = document.querySelector('.sidebar');
        if (sbEl) sidebarObserver.observe(sbEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
        // Also try immediately in case NTM already exists
        if (document.querySelector('.ntm-box')) injectNtmTemplateBtn();
      } else {
        setTimeout(tryInject, 300);
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryInject);
    } else {
      tryInject();
    }
  }

  init();
})(); // end IIFE
