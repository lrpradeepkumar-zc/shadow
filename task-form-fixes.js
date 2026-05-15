// task-form-fixes.

  // --- INLINE REMINDER MODAL ---
  function showReminderModalInline(current, callback) {
    document.querySelectorAll('.tfx-rem-modal').forEach(function(m){ m.remove(); });
    var curVal = '';
    if (current && current.date) {
      curVal = current.date + (current.time ? 'T' + current.time : '');
    }
    var modal = document.createElement('div');
    modal.className = 'tfx-rem-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100000;' +
      'display:flex;align-items:center;justify-content:center;';
    modal.innerHTML =
      '<div style="background:#1e293b;border-radius:12px;padding:24px;min-width:320px;box-shadow:0 20px 60px rgba(0,0,0,.5);">' +
        '<h3 style="margin:0 0 16px;color:#f1f5f9;font-size:16px;"><i class="fa-regular fa-bell" style="color:#f59e0b;"></i> Set Reminder</h3>' +
        '<label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:6px;">Date & Time</label>' +
        '<input id="tfxRemInp" type="datetime-local" value="'+curVal+'" style="width:100%;padding:8px 12px;' +
          'background:#0f172a;border:1px solid #334155;border-radius:6px;color:#f1f5f9;font-size:14px;' +
          'box-sizing:border-box;outline:none;color-scheme:dark;">' +
        '<div style="display:flex;gap:8px;margin-top:16px;justify-content:space-between;">' +
          '<button id="tfxRemClrBtn" style="padding:7px 16px;border-radius:6px;border:1px solid #ef4444;' +
            'background:transparent;color:#ef4444;cursor:pointer;font-size:13px;">Clear</button>' +
          '<div style="display:flex;gap:8px;">' +
            '<button id="tfxRemCnl" style="padding:7px 16px;border-radius:6px;border:1px solid #334155;' +
              'background:transparent;color:#94a3b8;cursor:pointer;font-size:13px;">Cancel</button>' +
            '<button id="tfxRemSv" style="padding:7px 16px;border-radius:6px;border:none;' +
              'background:#3b82f6;color:#fff;cursor:pointer;font-size:13px;font-weight:600;">Set</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelector('#tfxRemClrBtn').addEventListener('click', function(){ modal.remove(); callback(null); });
    modal.querySelector('#tfxRemCnl').addEventListener('click', function(){ modal.remove(); });
    modal.querySelector('#tfxRemSv').addEventListener('click', function(){
      var val = modal.querySelector('#tfxRemInp').value;
      if (!val) { callback(null); modal.remove(); return; }
      var dt = new Date(val);
      var date = dt.toISOString().split('T')[0];
      var time = val.includes('T') ? val.split('T')[1].substring(0,5) : '';
      modal.remove();
      callback({date: date, time: time});
    });
    modal.querySelector('#tfxRemInp').addEventListener('keydown', function(e){
      if (e.key === 'Enter') modal.querySelector('#tfxRemSv').click();
    });
    setTimeout(function(){ modal.querySelector('#tfxRemInp').focus(); }, 50);
  }

  // --- INLINE RECURRENCE MODAL ---
  function showRecurrenceModalInline(callback) {
    document.querySelectorAll('.tfx-rec-modal').forEach(function(m){ m.remove(); });
    var modal = document.createElement('div');
    modal.className = 'tfx-rec-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100000;' +
      'display:flex;align-items:center;justify-content:center;';
    var opts = [
      {val:'Daily', icon:'fa-calendar-day', desc:'Every day'},
      {val:'Weekly', icon:'fa-calendar-week', desc:'Every week'},
      {val:'Monthly', icon:'fa-calendar', desc:'Every month'},
      {val:'Weekdays', icon:'fa-briefcase', desc:'Mon - Fri'},
    ];
    modal.innerHTML =
      '<div style="background:#1e293b;border-radius:12px;padding:24px;min-width:320px;box-shadow:0 20px 60px rgba(0,0,0,.5);">' +
        '<h3 style="margin:0 0 16px;color:#f1f5f9;font-size:16px;"><i class="fa-solid fa-repeat" style="color:#3b82f6;"></i> Repeat Task</h3>' +
        '<div style="display:grid;gap:8px;">' +
          opts.map(function(o){
            return '<button class="tfx-rec-opt" data-val="'+o.val+'" style="display:flex;align-items:center;gap:12px;' +
              'padding:12px 16px;background:#0f172a;border:1px solid #334155;border-radius:8px;' +
              'color:#e2e8f0;cursor:pointer;text-align:left;transition:border-color .2s;">' +
              '<i class="fa-solid '+o.icon+'" style="color:#3b82f6;font-size:16px;width:20px;"></i>' +
              '<div><div style="font-weight:600;font-size:14px;">'+o.val+'</div>' +
              '<div style="font-size:12px;color:#64748b;">'+o.desc+'</div></div>' +
            '</button>';
          }).join('') +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:16px;justify-content:space-between;">' +
          '<button id="tfxRecNone" style="padding:7px 16px;border-radius:6px;border:1px solid #334155;' +
            'background:transparent;color:#94a3b8;cursor:pointer;font-size:13px;">No Repeat</button>' +
          '<button id="tfxRecCnl" style="padding:7px 16px;border-radius:6px;border:1px solid #334155;' +
            'background:transparent;color:#94a3b8;cursor:pointer;font-size:13px;">Cancel</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelectorAll('.tfx-rec-opt').forEach(function(btn){
      btn.addEventListener('mouseenter', function(){ btn.style.borderColor='#3b82f6'; });
      btn.addEventListener('mouseleave', function(){ btn.style.borderColor='#334155'; });
      btn.addEventListener('click', function(){ modal.remove(); callback(btn.getAttribute('data-val')); });
    });
    modal.querySelector('#tfxRecNone').addEventListener('click', function(){ modal.remove(); callback(null); });
    modal.querySelector('#tfxRecCnl').addEventListener('click', function(){ modal.remove(); });
  }
(function TaskFormFixes() {
  'use strict';

  // --- UTILITIES ---

  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function genId() {
    return 'tk_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
  }

  function getStatusColor(s) {
    var m = {'Open':'#3b82f6','In Progress':'#f59e0b','Fixed':'#8b5cf6',
      'Completed':'#10b981','Closed':'#6b7280','Delayed':'#ef4444'};
    return m[s] || '#94a3b8';
  }

  function getPriorityCfg(p) {
    var m = {
      'None':  {icon:'fa-minus',       color:'#94a3b8', bg:'#f1f5f9'},
      'Low':   {icon:'fa-arrow-down',  color:'#22c55e', bg:'#f0fdf4'},
      'Medium':{icon:'fa-arrow-right', color:'#f59e0b', bg:'#fffbeb'},
      'High':  {icon:'fa-arrow-up',    color:'#ef4444', bg:'#fef2f2'}
    };
    return m[p] || m['None'];
  }

  function getAllUsers() {
    try {
      var u = JSON.parse(localStorage.getItem('shadow_users') || '[]');
      if (u.length) return Promise.resolve(u);
    } catch(e){}
    if (typeof state !== 'undefined' && state.members && state.members.length)
      return Promise.resolve(state.members);
    return Promise.resolve([]);
  }

  function getGroupStatuses(groupId) {
    return ShadowDB.Groups.getAll().then(function(groups) {
      var g = groups.find(function(g){ return g.id === groupId; });
      if (g && g.statuses && g.statuses.length) return g.statuses;
      return ['Open','In Progress','Fixed','Completed','Closed'];
    }).catch(function() {
      return ['Open','In Progress','Fixed','Completed','Closed'];
    });
  }

  function getGroupCategories(groupId) {
    return ShadowDB.Categories.getAll().then(function(cats) {
      return cats.filter(function(c){ return !c.group || c.group === groupId; });
    }).catch(function(){ return []; });
  }

  function getAllTags() {
    return ShadowDB.Tags.getAll().catch(function(){ return []; });
  }

  function showDropdown(anchorEl, items, onSelect, opts) {
    opts = opts || {};
    document.querySelectorAll('.tfx-dropdown').forEach(function(d){ d.remove(); });
    var menu = document.createElement('div');
    menu.className = 'tfx-dropdown';
    menu.style.cssText = 'position:fixed;z-index:99999;background:#1e293b;border:1px solid #334155;' +
      'border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.4);min-width:160px;padding:4px 0;';
    if (opts.title) {
      var h = document.createElement('div');
      h.style.cssText = 'padding:8px 12px 4px;font-size:11px;color:#94a3b8;font-weight:600;' +
        'text-transform:uppercase;border-bottom:1px solid #334155;margin-bottom:4px;';
      h.textContent = opts.title;
      menu.appendChild(h);
    }
    items.forEach(function(item) {
      var el = document.createElement('div');
      el.className = 'tfx-dd-item';
      el.style.cssText = 'padding:8px 14px;cursor:pointer;font-size:13px;color:#e2e8f0;' +
        'display:flex;align-items:center;gap:8px;';
      el.innerHTML = item.html || item.label || item.value;
      el.addEventListener('mouseenter', function(){ el.style.background='#334155'; });
      el.addEventListener('mouseleave', function(){ el.style.background=''; });
      el.addEventListener('click', function(e){ e.stopPropagation(); onSelect(item); menu.remove(); });
      menu.appendChild(el);
    });
    document.body.appendChild(menu);
    var rect = anchorEl.getBoundingClientRect();
    var top = (rect.bottom + menu.offsetHeight > window.innerHeight) ? rect.top - menu.offsetHeight - 4 : rect.bottom + 4;
    menu.style.top = top + 'px';
    menu.style.left = Math.min(rect.left, window.innerWidth - 170) + 'px';
    setTimeout(function(){
      document.addEventListener('click', function h(){ menu.remove(); document.removeEventListener('click',h); },{once:true});
    }, 10);
  }

  // --- 1. STATUS BUTTON ---
  function setupStatusButton(btnId, groupSelectId) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    var fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    var newBtn = document.getElementById(btnId);

    function applyStatus(val) {
      newBtn.value = val;
      newBtn.textContent = val;
      newBtn.style.cssText = 'background:' + getStatusColor(val) + ';color:#fff;border:none;' +
        'border-radius:6px;padding:4px 12px;font-weight:600;font-size:12px;cursor:pointer;' +
        'letter-spacing:.02em;transition:background .2s;';
    }
    applyStatus(newBtn.value || newBtn.textContent.trim() || 'Open');

    newBtn.addEventListener('click', function(e) {
      e.preventDefault(); e.stopPropagation();
      var grpEl = document.getElementById(groupSelectId);
      var groupId = grpEl ? grpEl.value : '';
      getGroupStatuses(groupId).then(function(statuses) {
        var items = statuses.map(function(s) {
          return { value:s, html:'<span style="width:10px;height:10px;border-radius:50%;background:' +
            getStatusColor(s) + ';display:inline-block;"></span> ' + s };
        });
        showDropdown(newBtn, items, function(item){ applyStatus(item.value); }, {title:'Status'});
      });
    });
  }

  // --- 2. ASSIGNEE FROM REAL USERS ---
  function setupAssigneeSelect(selectId) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    getAllUsers().then(function(users) {
      var current = sel.value;
      sel.innerHTML = '<option value="">Unassigned</option>' +
        users.map(function(u) {
          var name = u.name || u.email || '';
          return '<option value="' + name + '"' + (current === name ? ' selected':'') + '>' + name + '</option>';
        }).join('');
      if (!current || current === 'Pradeep') {
        if (typeof state !== 'undefined' && state.currentUserId) {
          var me = users.find(function(u){ return u.id === state.currentUserId; });
          if (me) sel.value = me.name;
        }
      }
    });
  }

  // --- 3. PRIORITY BADGE UI ---
  function setupPrioritySelect(selectId) {
    var sel = document.getElementById(selectId);
    if (!sel || sel._tfxPri) return;
    sel._tfxPri = true;
    sel.style.display = 'none';

    var badge = document.createElement('button');
    badge.type = 'button';
    badge.style.cssText = 'display:inline-flex;align-items:center;gap:5px;padding:3px 10px;' +
      'border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid currentColor;' +
      'background:transparent;transition:all .2s;';
    sel.parentNode.insertBefore(badge, sel);

    function refreshBadge() {
      var cfg = getPriorityCfg(sel.value || 'None');
      badge.style.color = cfg.color;
      badge.style.borderColor = cfg.color;
      badge.style.background = cfg.bg;
      badge.innerHTML = '<i class="fa-solid ' + cfg.icon + '" style="font-size:10px;"></i> ' + (sel.value || 'None');
    }
    refreshBadge();

    badge.addEventListener('click', function(e) {
      e.preventDefault(); e.stopPropagation();
      var priorities = ['None','Low','Medium','High'];
      var items = priorities.map(function(p) {
        var cfg = getPriorityCfg(p);
        return { value:p, html:'<i class="fa-solid ' + cfg.icon + '" style="color:' + cfg.color +
          ';font-size:11px;"></i> <span style="color:' + cfg.color + '">' + p + '</span>' };
      });
      showDropdown(badge, items, function(item){
        sel.value = item.value; refreshBadge(); sel.dispatchEvent(new Event('change'));
      }, {title:'Priority'});
    });
    sel.addEventListener('change', refreshBadge);
  }

  // --- 4. TAGS WITH CREATE PROMPT ---
  function showCreateTagPrompt(callback) {
    document.querySelectorAll('.tfx-tag-modal').forEach(function(m){ m.remove(); });
    var colors = ['#e67e22','#e74c3c','#9b59b6','#2ecc71','#3498db','#1abc9c','#f39c12','#e91e63'];
    var modal = document.createElement('div');
    modal.className = 'tfx-tag-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100000;' +
      'display:flex;align-items:center;justify-content:center;';
    modal.innerHTML =
      '<div style="background:#1e293b;border-radius:12px;padding:24px;min-width:300px;box-shadow:0 20px 60px rgba(0,0,0,.5);">' +
        '<h3 style="margin:0 0 16px;color:#f1f5f9;font-size:16px;"><i class="fa-solid fa-tag"></i> Create Tag</h3>' +
        '<input id="tfxTagNameInp" placeholder="Tag name" style="width:100%;padding:8px 12px;background:#0f172a;' +
          'border:1px solid #334155;border-radius:6px;color:#f1f5f9;font-size:14px;box-sizing:border-box;outline:none;">' +
        '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;" id="tfxColorPkr">' +
          colors.map(function(c,i){
            return '<span data-color="' + c + '" class="tfx-cdot' + (i===0?' sel':'') + '" ' +
              'style="width:22px;height:22px;border-radius:50%;background:' + c + ';cursor:pointer;' +
              'border:2px solid ' + (i===0?'#fff':'transparent') + ';"></span>';
          }).join('') +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">' +
          '<button id="tfxTagCnl" style="padding:7px 16px;border-radius:6px;border:1px solid #334155;' +
            'background:transparent;color:#94a3b8;cursor:pointer;">Cancel</button>' +
          '<button id="tfxTagCrt" style="padding:7px 16px;border-radius:6px;border:none;' +
            'background:#3b82f6;color:#fff;cursor:pointer;font-weight:600;">Create</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelectorAll('.tfx-cdot').forEach(function(dot){
      dot.addEventListener('click', function(){
        modal.querySelectorAll('.tfx-cdot').forEach(function(d){ d.style.border='2px solid transparent'; d.classList.remove('sel'); });
        dot.style.border = '2px solid #fff'; dot.classList.add('sel');
      });
    });
    modal.querySelector('#tfxTagCnl').addEventListener('click', function(){ modal.remove(); callback(null); });
    modal.querySelector('#tfxTagCrt').addEventListener('click', function(){
      var name = modal.querySelector('#tfxTagNameInp').value.trim();
      if (!name) { modal.querySelector('#tfxTagNameInp').focus(); return; }
      var colorDot = modal.querySelector('.tfx-cdot.sel');
      var color = colorDot ? colorDot.getAttribute('data-color') : '#e67e22';
      modal.remove();
      callback({id:'tg_'+Date.now(), name:name, color:color});
    });
    modal.querySelector('#tfxTagNameInp').addEventListener('keydown', function(e){
      if (e.key==='Enter') modal.querySelector('#tfxTagCrt').click();
    });
    setTimeout(function(){ modal.querySelector('#tfxTagNameInp').focus(); }, 50);
  }

  function renderTagsInContainer(containerId, tags) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = (tags||[]).map(function(t){
      return '<span style="display:inline-flex;align-items:center;gap:3px;background:#334155;border-radius:10px;' +
        'padding:2px 8px;font-size:11px;color:#e2e8f0;margin:2px;">' +
        t + '<span data-tag="' + t + '" style="cursor:pointer;opacity:.7;margin-left:2px;" class="tfx-tr">&times;</span></span>';
    }).join('');
    el.querySelectorAll('.tfx-tr').forEach(function(x){
      x.addEventListener('click', function(e){
        e.stopPropagation();
        var name = x.getAttribute('data-tag');
        var idx = tags.indexOf(name);
        if (idx>=0){ tags.splice(idx,1); renderTagsInContainer(containerId, tags); }
      });
    });
  }

  function setupTagsButton(btnId, containerSpanId, tagsRef) {
    var btn = document.getElementById(btnId);
    if (!btn || btn._tfxTagsWired) return;
    btn._tfxTagsWired = true;
    var fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    var newBtn = document.getElementById(btnId);
    newBtn._tfxTagsWired = true;

    newBtn.addEventListener('click', function(e) {
      e.preventDefault(); e.stopPropagation();
      getAllTags().then(function(dbTags) {
        var stateTags = (typeof state!=='undefined' && state.tags) ? state.tags : [];
        var allTags = dbTags.concat(stateTags.filter(function(st){
          return !dbTags.find(function(d){ return d.id===st.id || d.name===st.name; });
        }));
        var currentTags = tagsRef || [];

        function buildPicker() {
          var items = allTags.map(function(t) {
            var isSel = currentTags.indexOf(t.name) >= 0;
            return { value:t.name, color:t.color||'#e67e22',
              html:'<span style="width:10px;height:10px;border-radius:50%;background:'+(t.color||'#e67e22')+';display:inline-block;"></span> '+
                t.name + (isSel?' <i class="fa-solid fa-check" style="color:#10b981;margin-left:auto;font-size:10px;"></i>':'') };
          });
          items.push({ value:'__create__',
            html:'<i class="fa-solid fa-plus" style="color:#3b82f6;"></i> <span style="color:#3b82f6;">Create new tag</span>' });
          showDropdown(newBtn, items, function(item){
            if (item.value==='__create__') {
              showCreateTagPrompt(function(newTag){
                if (!newTag) return;
                ShadowDB.Tags.create(newTag).then(function(saved){
                  var tag = saved || newTag;
                  if (typeof state !== 'undefined'){ state.tags=state.tags||[]; state.tags.push(tag); }
                  if (currentTags.indexOf(tag.name) < 0) currentTags.push(tag.name);
                  renderTagsInContainer(containerSpanId, currentTags);
                });
              });
              return;
            }
            var idx = currentTags.indexOf(item.value);
            if (idx>=0) currentTags.splice(idx,1); else currentTags.push(item.value);
            renderTagsInContainer(containerSpanId, currentTags);
          }, {title:'Tags'});
        }

        if (!allTags.length) {
          showCreateTagPrompt(function(newTag){
            if (!newTag) return;
            ShadowDB.Tags.create(newTag).then(function(saved){
              var tag = saved || newTag;
              if (typeof state !== 'undefined'){ state.tags=state.tags||[]; state.tags.push(tag); }
              if (currentTags.indexOf(tag.name) < 0) currentTags.push(tag.name);
              renderTagsInContainer(containerSpanId, currentTags);
            });
          });
        } else { buildPicker(); }
      });
    });
  }

  // --- 5. REPEAT/RECURRENCE BUTTON ---
  function setupRepeatButton() {
    var btn = document.getElementById('modalRepeatBtn');
    if (!btn) {
      // Find by icon since it has no ID
      document.querySelectorAll('.modal-header-right .icon-btn').forEach(function(b){
        if (b.querySelector('.fa-repeat') || b.title==='Recurrence') btn = b;
      });
    }
    if (!btn || btn._tfxRepeat) return;
    btn._tfxRepeat = true;
    btn.id = 'modalRepeatBtn';

    function updateIndicator() {
      var dot = btn.querySelector('.tfx-rep-dot');
      if (dot) dot.remove();
      var rec = typeof state!=='undefined' ? state.modalRecurrence : null;
      if (rec) {
        var d = document.createElement('span');
        d.className = 'tfx-rep-dot';
        d.style.cssText = 'position:absolute;top:2px;right:2px;width:6px;height:6px;background:#3b82f6;border-radius:50%;';
        btn.style.position = 'relative';
        btn.appendChild(d);
        btn.title = 'Repeat: ' + rec;
      } else { btn.title = 'Repeat Task'; }
    }

    btn.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      showRecurrenceModalInline(function(rec){
          if (typeof state !== 'undefined') state.modalRecurrence = rec;
          updateIndicator();
          var disp = document.getElementById('modalRecurrenceDisplay');
          if (disp) disp.innerHTML = rec ?
            '<span style="font-size:12px;color:#3b82f6;"><i class="fa-solid fa-repeat"></i> '+rec+'</span>' : '';
        });
    });
    updateIndicator();
  }

  // --- 6. ATTACHMENT BUTTON ---
  function setupAttachmentButton() {
    var btn = document.getElementById('modalAttachBtn');
    if (!btn) {
      document.querySelectorAll('.modal-header-right .icon-btn').forEach(function(b){
        if (b.querySelector('.fa-paperclip') || b.title==='Attachment') btn = b;
      });
    }
    if (!btn || btn._tfxAttach) return;
    btn._tfxAttach = true;
    btn.id = 'modalAttachBtn';
    btn.style.position = 'relative';

    function updateBadge() {
      var existing = btn.querySelector('.tfx-att-cnt');
      if (existing) existing.remove();
      var atts = (typeof state!=='undefined' && state.modalAttachments) ? state.modalAttachments : [];
      if (atts.length) {
        var badge = document.createElement('span');
        badge.className = 'tfx-att-cnt';
        badge.style.cssText = 'position:absolute;top:-4px;right:-4px;width:16px;height:16px;background:#3b82f6;' +
          'border-radius:50%;font-size:9px;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;';
        badge.textContent = atts.length;
        btn.appendChild(badge);
      }
      var listEl = document.getElementById('modalAttachmentsList');
      if (listEl) {
        listEl.innerHTML = atts.map(function(a){
          return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #1e293b;">' +
            '<i class="fa-solid fa-file" style="color:#3b82f6;"></i>' +
            '<span style="flex:1;font-size:13px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + a.name + '</span>' +
            '<span style="font-size:11px;color:#64748b;">' + (a.size ? Math.round(a.size/1024)+'KB' : '') + '</span>' +
            '<button data-n="'+a.name+'" class="tfx-adl" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:15px;">&times;</button>' +
          '</div>';
        }).join('');
        listEl.querySelectorAll('.tfx-adl').forEach(function(x){
          x.addEventListener('click', function(){
            var n = x.getAttribute('data-n');
            var arr = (typeof state!=='undefined' && state.modalAttachments) ? state.modalAttachments : [];
            var i = arr.findIndex(function(a){ return a.name===n; });
            if (i>=0) arr.splice(i,1);
            updateBadge();
          });
        });
      }
    }

    btn.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      if (typeof state !== 'undefined') state.modalAttachments = state.modalAttachments || [];
      var inp = document.createElement('input');
      inp.type='file'; inp.multiple=true; inp.style.display='none';
      inp.addEventListener('change', function(){
        Array.from(inp.files).forEach(function(f){
          state.modalAttachments.push({name:f.name, size:f.size, type:f.type, url:URL.createObjectURL(f)});
        });
        updateBadge(); inp.remove();
      });
      document.body.appendChild(inp); inp.click();
    });
  }

  // --- 7. CATEGORY SELECT ---
  function enhanceCategorySelect(selectId, groupSelectId) {
    var sel = document.getElementById(selectId);
    var grpSel = document.getElementById(groupSelectId);
    if (!sel) return;
    function refresh() {
      var groupId = grpSel ? grpSel.value : '';
      var current = sel.value;
      getGroupCategories(groupId).then(function(cats){
        sel.innerHTML = '<option value="">General</option>' +
          cats.map(function(c){
            return '<option value="'+c.name+'"'+(c.name===current?' selected':'')+'>'+c.name+'</option>';
          }).join('');
      });
    }
    refresh();
    if (grpSel && !grpSel._tfxCatWired) {
      grpSel._tfxCatWired = true;
      grpSel.addEventListener('change', refresh);
    }
  }

  // --- 8. REMINDER DISPLAY BELOW META ROW ---
  function fixReminderDisplay() {
    var body = document.querySelector('.modal-content.task-modal .modal-body');
    if (!body) return;
    var meta = body.querySelector('.detail-meta');
    if (!meta) return;

    var row = body.querySelector('.tfx-rem-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'tfx-rem-row';
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0 2px;min-height:16px;';
      meta.parentNode.insertBefore(row, meta.nextSibling);
    }

    function updateRow() {
      var r = typeof state!=='undefined' ? state.modalReminder : null;
      if (r && r.date) {
        var dateStr = new Date(r.date).toLocaleDateString();
        row.innerHTML = '<i class="fa-regular fa-bell" style="color:#f59e0b;font-size:12px;"></i>' +
          '<span style="font-size:12px;color:#f59e0b;font-weight:500;"> Reminder: '+dateStr+(r.time?' at '+r.time:'')+'</span>' +
          '<button id="tfxRemClr" style="background:none;border:none;cursor:pointer;color:#64748b;' +
          'font-size:15px;margin-left:auto;" title="Clear">&times;</button>';
        var clrBtn = row.querySelector('#tfxRemClr');
        if (clrBtn) clrBtn.addEventListener('click', function(e){
          e.stopPropagation();
          if (typeof state!=='undefined') state.modalReminder=null;
          var rb = document.getElementById('modalReminderBtn');
          if (rb) rb.innerHTML='<i class="fa-regular fa-calendar-check"></i> Set reminder';
          row.innerHTML='';
        });
      } else { row.innerHTML=''; }
    }

    var remBtn = document.getElementById('modalReminderBtn');
    if (remBtn && !remBtn._tfxRemWired) {
      remBtn._tfxRemWired = true;
      var fresh = remBtn.cloneNode(true);
      remBtn.parentNode.replaceChild(fresh, remBtn);
      var newBtn = document.getElementById('modalReminderBtn');
      newBtn._tfxRemWired = true;
      newBtn.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        showReminderModalInline(typeof state!=='undefined'?state.modalReminder:null, function(rem){
            if (typeof state!=='undefined') state.modalReminder=rem;
            if (rem && rem.date) {
              var ds = new Date(rem.date).toLocaleDateString();
              newBtn.innerHTML = '<i class="fa-regular fa-calendar-check" style="color:#f59e0b;"></i> '+ ds + (rem.time?' '+rem.time:'');
            } else {
              newBtn.innerHTML = '<i class="fa-regular fa-calendar-check"></i> Set reminder';
            }
            updateRow();
          });
      });
    }
    updateRow();
  }

  // --- 9. SUBTASKS WITH FULL ATTRIBUTES + PARENT-CHILD LINKING ---
  function setupSubtaskPanel(listId, inputId, addBtnId, isModal) {
    var list = document.getElementById(listId);
    var input = document.getElementById(inputId);
    var addBtn = document.getElementById(addBtnId);
    if (!list || !input || !addBtn || addBtn._tfxSub) return;
    addBtn._tfxSub = true;

    var freshBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(freshBtn, addBtn);
    var freshInp = input.cloneNode(true);
    input.parentNode.replaceChild(freshInp, input);
    var newBtn = document.getElementById(addBtnId);
    var newInp = document.getElementById(inputId);
    if (newBtn) newBtn._tfxSub = true;

    function renderList() {
      var items = isModal ? (typeof state!=='undefined' ? state.modalSubtasks||[] : []) : [];
      list.innerHTML = items.map(function(st, idx){
        var priColor = {High:'#ef4444',Medium:'#f59e0b',Low:'#22c55e'}[st.priority] || '#64748b';
        return '<div class="subtask-item" data-idx="'+idx+'" style="display:flex;align-items:center;gap:8px;'+
          'padding:7px 0;border-bottom:1px solid #1e293b;">' +
          '<input type="checkbox" class="stk-chk" data-idx="'+idx+'"' + (st.completed?' checked':'') +
            ' style="accent-color:#3b82f6;cursor:pointer;">' +
          '<span class="stk-id" style="font-size:10px;color:#64748b;background:#0f172a;padding:1px 5px;'+
            'border-radius:4px;font-family:monospace;user-select:all;" title="Subtask ID">' + (st.id||'') + '</span>' +
          '<span class="stk-title' + (st.completed?' stk-done':'') + '" style="flex:1;font-size:13px;color:' +
            (st.completed?'#64748b':'#e2e8f0') + ';' + (st.completed?'text-decoration:line-through;':'') + '">' +
            st.title + '</span>' +
          (st.assignee ? '<span style="font-size:11px;color:#64748b;">@'+st.assignee+'</span>' : '') +
          (st.priority && st.priority!=='None' ?
            '<span style="font-size:10px;font-weight:600;color:'+priColor+';">'+st.priority+'</span>' : '') +
          '<button class="stk-del" data-idx="'+idx+'" style="background:none;border:none;cursor:pointer;'+
            'color:#ef4444;font-size:16px;padding:0 4px;">&times;</button>' +
        '</div>';
      }).join('');

      list.querySelectorAll('.stk-chk').forEach(function(cb){
        cb.addEventListener('change', function(){
          var idx = parseInt(cb.getAttribute('data-idx'));
          if (isModal && state.modalSubtasks && state.modalSubtasks[idx]) {
            state.modalSubtasks[idx].completed = cb.checked;
            renderList();
          }
        });
      });
      list.querySelectorAll('.stk-del').forEach(function(b){
        b.addEventListener('click', function(){
          var idx = parseInt(b.getAttribute('data-idx'));
          if (isModal && state.modalSubtasks) { state.modalSubtasks.splice(idx,1); renderList(); }
        });
      });
    }

    function addSubtask() {
      var raw = newInp.value.trim();
      if (!raw) return;
      var title = raw, assignee = '', priority = 'None';
      var mMatch = raw.match(/@(\w+)/);
      if (mMatch) { assignee = mMatch[1]; title = raw.replace(/@\w+/,'').trim(); }
      var pMatch = title.match(/!(high|medium|low)/i);
      if (pMatch) {
        priority = pMatch[1].charAt(0).toUpperCase() + pMatch[1].slice(1).toLowerCase();
        title = title.replace(/!\w+/g,'').trim();
      }
      if (!title) return;
      var subtask = {
        id: genId(), title:title, assignee:assignee,
        status:'Open', priority:priority, completed:false,
        description:'', tags:[], attachments:[],
        createdAt:new Date().toISOString(), parentTaskId:null
      };
      if (isModal) {
        if (typeof state!=='undefined') {
          state.modalSubtasks = state.modalSubtasks||[];
          state.modalSubtasks.push(subtask);
          renderList();
        }
      }
      newInp.value='';
    }

    if (newBtn) newBtn.addEventListener('click', addSubtask);
    if (newInp) newInp.addEventListener('keydown', function(e){
      if (e.key==='Enter'){ e.preventDefault(); addSubtask(); }
    });
    renderList();
  }

  // Patch save: set parentTaskId on subtasks after task created
  function patchModalSave() {
    var saveBtn = document.getElementById('modalSaveBtn');
    if (!saveBtn || saveBtn._tfxSaveP) return;
    saveBtn._tfxSaveP = true;
    saveBtn.addEventListener('click', function(){
      setTimeout(function(){
        if (typeof state!=='undefined' && state.tasks && state.tasks.length) {
          var latest = state.tasks[state.tasks.length-1];
          if (latest && latest.subtasks && latest.subtasks.length) {
            var changed = false;
            latest.subtasks.forEach(function(st){
              if (!st.parentTaskId) { st.parentTaskId = latest.id; changed=true; }
            });
            if (changed) ShadowDB.Tasks.update(latest).catch(function(){});
          }
        }
      }, 600);
    }, false);
  }

  // --- DETAIL PANEL FIXES ---

  function fixDetailStatus() {
    var sel = document.getElementById('detailStatus');
    if (!sel || sel._tfxDS) return;
    sel._tfxDS = true;
    function style() {
      sel.style.cssText = 'background:'+getStatusColor(sel.value)+';color:#fff;border:none;'+
        'border-radius:6px;padding:4px 10px;font-weight:600;font-size:12px;cursor:pointer;'+
        'appearance:none;-webkit-appearance:none;min-width:80px;';
    }
    style();
    sel.addEventListener('change', style);
    // Populate from group statuses
    var task = typeof state!=='undefined' && state.openTaskId ?
      (state.tasks||[]).find(function(t){ return t.id===state.openTaskId; }) : null;
    if (task && task.group) {
      getGroupStatuses(task.group).then(function(statuses){
        var cur = sel.value;
        sel.innerHTML = statuses.map(function(s){
          return '<option value="'+s+'"'+(s===cur?' selected':'')+'>'+s+'</option>';
        }).join('');
        style();
      });
    }
  }

  function fixDetailAssignee() {
    var el = document.getElementById('detailAssignee');
    if (!el || el._tfxDA) return;
    el._tfxDA = true;
    el.style.cursor = 'pointer';
    el.title = 'Click to change assignee';
    el.addEventListener('click', function(e){
      e.stopPropagation();
      getAllUsers().then(function(users){
        var items = [{value:'',html:'<span style="color:#94a3b8">Unassigned</span>'}].concat(
          users.map(function(u){
            return {value:u.name, html:
              '<span style="width:22px;height:22px;border-radius:50%;background:'+(u.color||'#667eea')+
              ';display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;">'
              +(u.avatar||u.name[0])+'</span> '+u.name
            };
          })
        );
        showDropdown(el, items, function(item){
          var task = typeof state!=='undefined' && state.openTaskId ?
            (state.tasks||[]).find(function(t){ return t.id===state.openTaskId; }) : null;
          if (!task) return;
          task.assignee = item.value;
          el.textContent = item.value || 'Unassigned';
          var avatar = document.getElementById('detailAssigneeAvatar');
          if (avatar) {
            var u = users.find(function(u){ return u.name===item.value; });
            avatar.textContent = u ? (u.avatar||item.value[0]||'?') : '?';
            avatar.style.background = u ? (u.color||'#667eea') : '#94a3b8';
          }
          ShadowDB.Tasks.update(task).then(function(){
            if (typeof renderView==='function') renderView();
          });
        }, {title:'Assign To'});
      });
    });
  }

  // --- SUBTASK DETAIL VIEW: show parent link ---
  function patchShowTaskDetail() {
    var orig = window.showTaskDetail;
    if (!orig || window.__tfxSubHooked) return;
    window.__tfxSubHooked = true;
    window.showTaskDetail = function(taskId, mode) {
      orig.call(this, taskId, mode);
      setTimeout(function(){
        var panel = document.querySelector('.task-detail-panel');
        if (!panel) return;
        var task = typeof state!=='undefined' ?
          (state.tasks||[]).find(function(t){ return t.id===taskId; }) : null;
        if (!task) return;

        // Remove old parent link
        panel.querySelectorAll('.tfx-parent-bar,.tfx-sub-badge').forEach(function(e){ e.remove(); });

        if (task.parentTaskId) {
          var parent = typeof state!=='undefined' ?
            (state.tasks||[]).find(function(t){ return t.id===task.parentTaskId; }) : null;

          // Parent link bar
          var bar = document.createElement('div');
          bar.className = 'tfx-parent-bar';
          bar.style.cssText = 'background:#1e293b;border-left:3px solid #3b82f6;padding:6px 12px;'+
            'margin-bottom:8px;font-size:12px;color:#94a3b8;display:flex;align-items:center;gap:6px;'+
            'border-radius:0 4px 4px 0;cursor:pointer;';
          bar.innerHTML = '<i class="fa-solid fa-code-branch" style="color:#3b82f6;"></i> Subtask of: '+
            '<span class="tfx-par-link" style="color:#3b82f6;text-decoration:underline;">'
            + (parent ? parent.title : 'Parent task') + '</span>';
          bar.addEventListener('click', function(){
            if (parent && typeof window.showTaskDetail==='function') orig.call(window, task.parentTaskId, mode);
          });

          var titleEl = panel.querySelector('#detailTitle,.detail-task-title');
          if (titleEl && titleEl.parentNode) {
            titleEl.parentNode.insertBefore(bar, titleEl);
          }

          // Badge on title
          var badge = document.createElement('span');
          badge.className = 'tfx-sub-badge';
          badge.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#3b82f6;'+
            'background:#1e3a5f;padding:2px 7px;border-radius:10px;margin-left:8px;vertical-align:middle;';
          badge.innerHTML = '<i class="fa-solid fa-code-branch" style="font-size:9px;"></i> SUBTASK';
          if (titleEl) titleEl.appendChild(badge);
        }
      }, 120);
    };
  }

  // --- MODAL INIT ---
  function initModal() {
    if (typeof state !== 'undefined') {
      state.modalSubtasks = state.modalSubtasks || [];
      state.modalTags = state.modalTags || [];
      state.modalAttachments = state.modalAttachments || [];
    }

    setupStatusButton('modalStatusBtn', 'modalGroup');
    setupAssigneeSelect('modalAssignee');
    setupTagsButton('modalTagBtn', 'modalTagsContainer',
      typeof state!=='undefined' ? state.modalTags : []);
    setupRepeatButton();
    setupAttachmentButton();
    fixReminderDisplay();
    enhanceCategorySelect('modalCategory', 'modalGroup');
    setupSubtaskPanel('modalSubtasksList', 'modalSubtaskInput', 'modalAddSubtaskBtn', true);
    patchModalSave();

    // Ensure attachment list area exists
    var body = document.querySelector('.modal-content.task-modal .modal-body');
    if (body && !document.getElementById('modalAttachmentsList')) {
      var notesEl = body.querySelector('#modalNotes');
      if (notesEl) {
        var notesSection = notesEl.closest('.detail-section');
        if (notesSection) {
          var attSec = document.createElement('div');
          attSec.className = 'detail-section';
          attSec.style.marginTop = '8px';
          attSec.innerHTML = '<div class="section-label"><i class="fa-solid fa-paperclip"></i> Attachments</div>'+
            '<div id="modalAttachmentsList" style="padding:4px 0;min-height:4px;"></div>';
          notesSection.after(attSec);
        }
      }
    }

    // Ensure recurrence display area exists
    if (!document.getElementById('modalRecurrenceDisplay')) {
      var titleInp = document.getElementById('modalTaskTitle');
      if (titleInp) {
        var recDisp = document.createElement('div');
        recDisp.id = 'modalRecurrenceDisplay';
        recDisp.style.cssText = 'padding:2px 0;min-height:0;';
        titleInp.after(recDisp);
      }
    }
  }

  // --- HOOK BUTTONS ---
  function hookNewTaskBtn() {
    var btn = document.getElementById('newTaskBtn');
    if (!btn || btn._tfxHk) return;
    btn._tfxHk = true;
    btn.addEventListener('click', function(){
      setTimeout(initModal, 60);
    }, true);
  }

  function hookGroupTaskBtns() {
    document.querySelectorAll('.group-add-task').forEach(function(b){
      if (b._tfxHk) return;
      b._tfxHk = true;
      b.addEventListener('click', function(){ setTimeout(initModal, 80); }, true);
    });
  }

  function hookDetailPanel() {
    var panel = document.querySelector('.task-detail-panel');
    if (!panel || panel._tfxObs) return;
    panel._tfxObs = true;
    var obs = new MutationObserver(function(){
      if (panel.classList.contains('open')) {
        setTimeout(function(){
          fixDetailStatus();
          fixDetailAssignee();
          var dp = document.getElementById('detailPriority');
          if (dp) setupPrioritySelect('detailPriority');
        }, 40);
      }
    });
    obs.observe(panel, {attributes:true, attributeFilter:['class']});
    if (panel.classList.contains('open')) {
      setTimeout(function(){
        fixDetailStatus();
        fixDetailAssignee();
        var dp = document.getElementById('detailPriority');
        if (dp) setupPrioritySelect('detailPriority');
      }, 100);
    }
  }

  // --- INIT ---
  onReady(function(){
    setTimeout(function(){
      hookNewTaskBtn();
      hookGroupTaskBtns();
      hookDetailPanel();
      patchShowTaskDetail();
      // If modal already open
      var modal = document.getElementById('taskModal');
      if (modal && getComputedStyle(modal).display !== 'none') initModal();
    }, 300);
  });

})();
