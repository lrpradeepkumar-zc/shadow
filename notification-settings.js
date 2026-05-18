// notification-settings.js
// Unified Notification Centre for Shadow ToDo
// Handles: Desktop, Reminder, Email, Priority Users, Notification Preference panels
(function () {
  'use strict';

  var STORAGE_KEY = 'shadow_notif_prefs';

  var TRIGGERS = [
    { id: 'task_assigned',         label: 'Task Assigned',              mandatory: true  },
    { id: 'task_completed',        label: 'Task Completed',             mandatory: true  },
    { id: 'comment_added',         label: 'Comment Added',              mandatory: true  },
    { id: 'reminder_triggered',    label: 'Reminder Triggered',         mandatory: true  },
    { id: 'comment_mention',       label: 'Task Comment @Mention',      mandatory: true  },
    { id: 'task_updated',          label: 'Task Updated',               mandatory: true  },
    { id: 'task_reassigned',       label: 'Task Reassigned',            mandatory: true  },
    { id: 'due_date_changed',      label: 'Task Due Date Changed',      mandatory: true  },
    { id: 'priority_changed',      label: 'Task Priority Changed',      mandatory: true  },
    { id: 'subtask_assigned',      label: 'Subtask Assigned',           mandatory: true  },
    { id: 'set_due_date',          label: 'Set Due Date',               mandatory: true  },
    { id: 'task_created',          label: 'Task Created',               mandatory: false },
    { id: 'task_deleted',          label: 'Task Deleted',               mandatory: false },
    { id: 'task_archived',         label: 'Task Archived',              mandatory: false },
    { id: 'task_status_changed',   label: 'Task Status Changed',        mandatory: false },
    { id: 'task_tagged',           label: 'Task Tagged',                mandatory: false },
    { id: 'subtask_completed',     label: 'Subtask Completed',          mandatory: false },
    { id: 'attachment_added',      label: 'Attachment Added',           mandatory: false },
    { id: 'member_added',          label: 'Member Added to Group',      mandatory: false },
    { id: 'member_removed',        label: 'Member Removed from Group',  mandatory: false },
    { id: 'daily_agenda',          label: 'Daily Agenda Email',         mandatory: false },
  ];

  var ESSENTIAL_IDS = ['task_assigned','task_completed','comment_added','reminder_triggered',
    'comment_mention','task_updated','task_reassigned','due_date_changed','priority_changed',
    'subtask_assigned','set_due_date'];

  function buildDefaultGroupPref(groupId) {
    return { groupId: groupId, bucket: 'All', channels: { pop: true, cliq: true, email: true, mobile: true } };
  }

  function getDefaultPrefs() {
    var s = window.state;
    var groups = (s && s.groups) ? s.groups.filter(function(g){ return g.type !== 'personal'; }) : [];
    var groupPrefs = {};
    groups.forEach(function(g){ groupPrefs[g.id] = buildDefaultGroupPref(g.id); });
    groupPrefs['personal'] = { groupId: 'personal', bucket: 'All', channels: { pop: true, cliq: true, email: true, mobile: true } };
    return {
      notificationsEnabled: true,
      desktop: { enabled: true, showSenderDetails: true, duration: '10', mobileFallbackEnabled: true, mobileFallbackDelay: '10', disableMobileWhenActive: true },
      reminder: { enabled: true, showOrganizerDetails: true, showEventDetails: true },
      email: { enabled: true, dailyAgenda: true, dailyAgendaTime: '08:00', triggers: {} },
      priorityUsers: [],
      dnd: { enabled: false, startTime: '22:00', endTime: '08:00', allowPriorityUsers: true },
      triggers: {},
      groupPrefs: groupPrefs
    };
  }

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { var saved = JSON.parse(raw); return deepMerge(getDefaultPrefs(), saved); }
    } catch(e) {}
    return getDefaultPrefs();
  }

  function savePrefs(prefs) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch(e) {}
    window.dispatchEvent(new CustomEvent('notifPrefsChanged', { detail: prefs }));
  }

  function deepMerge(target, source) {
    var result = Object.assign({}, target);
    Object.keys(source).forEach(function(k) {
      if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
        result[k] = deepMerge(target[k] || {}, source[k]);
      } else { result[k] = source[k]; }
    });
    return result;
  }

  function avatarColor(name) {
    var colors = ['#667eea','#48bb78','#ed8936','#e53e3e','#9f7aea','#38b2ac','#f6ad55'];
    if (!name) return colors[0];
    var h = 0; for (var i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))&0xffff;
    return colors[h%colors.length];
  }
  function getInitials(name) {
    if (!name) return '?';
    var p = name.trim().split(' ').filter(Boolean);
    return p.length===1 ? p[0][0].toUpperCase() : (p[0][0]+p[p.length-1][0]).toUpperCase();
  }

  function sel(opts, cur) {
    return opts.map(function(o){ return '<option value="'+o+'" '+(cur===o?'selected':'')+'>'+o+'</option>'; }).join('');
  }

  // ââ Desktop ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function renderDesktopSection(prefs, c) {
    var d = prefs.desktop;
    c.innerHTML =
      '<div class="ns-section-header"><h2>Desktop Notification</h2><p>Get notified when you are accessing different browser tab or application.</p></div>'+
      '<div class="ns-block">'+
        '<label class="ns-checkbox-row"><input type="checkbox" id="ns-desktop-sender" '+(d.showSenderDetails?'checked':'')+'>'+
        '<span>Show the sender details and message content preview</span></label>'+
        '<div class="ns-notif-preview">'+
          '<div class="ns-preview-icon"><i class="fa-brands fa-chrome"></i></div>'+
          '<div class="ns-preview-content"><div class="ns-preview-title">Task Assigned - Task Release</div>'+
          '<div class="ns-preview-sub">2 Mar 2023, 12:00 pm</div><div class="ns-preview-sub">Pradeep Kumar</div></div>'+
          '<div class="ns-preview-icon-right"><i class="fa-solid fa-check-double" style="color:#1a73e8"></i></div>'+
        '</div>'+
        '<div class="ns-row"><span class="ns-label">Notification Duration</span>'+
        '<select id="ns-desktop-duration" class="ns-select"><option value="5" '+(d.duration==='5'?'selected':'')+'>5 sec</option>'+
        '<option value="10" '+(d.duration==='10'?'selected':'')+'>10 sec</option>'+
        '<option value="15" '+(d.duration==='15'?'selected':'')+'>15 sec</option>'+
        '<option value="30" '+(d.duration==='30'?'selected':'')+'>30 sec</option></select></div>'+
      '</div>'+
      '<div class="ns-block"><h3 class="ns-sub-heading">Notify me in mobile</h3>'+
        '<label class="ns-checkbox-row"><input type="checkbox" id="ns-mobile-fallback" '+(d.mobileFallbackEnabled?'checked':'')+'>'+
        '<span>When I\'m inactive for</span>'+
        '<select id="ns-mobile-delay" class="ns-select ns-select-sm">'+
          '<option value="5" '+(d.mobileFallbackDelay==='5'?'selected':'')+'>5 Minutes</option>'+
          '<option value="10" '+(d.mobileFallbackDelay==='10'?'selected':'')+'>10 Minutes</option>'+
          '<option value="15" '+(d.mobileFallbackDelay==='15'?'selected':'')+'>15 Minutes</option>'+
          '<option value="30" '+(d.mobileFallbackDelay==='30'?'selected':'')+'>30 Minutes</option></select></label>'+
        '<label class="ns-checkbox-row"><input type="checkbox" id="ns-disable-mobile-active" '+(d.disableMobileWhenActive?'checked':'')+'>'+
        '<span>Disable mobile notifications when I\'m actively using my desktop</span></label>'+
      '</div>'+
      '<div class="ns-block"><h3 class="ns-sub-heading">Do Not Disturb (DND)</h3>'+
        '<label class="ns-toggle-row"><input type="checkbox" class="ns-toggle-input" id="ns-dnd-enabled" '+(prefs.dnd.enabled?'checked':'')+'>'+
        '<span class="ns-toggle-track"></span><span>Enable Quiet Mode</span></label>'+
        '<div class="ns-dnd-times '+(prefs.dnd.enabled?'':'ns-hidden')+'" id="ns-dnd-times">'+
          '<div class="ns-row"><span class="ns-label">From</span><input type="time" id="ns-dnd-start" value="'+prefs.dnd.startTime+'" class="ns-time-input">'+
          '<span class="ns-label" style="margin-left:12px">To</span><input type="time" id="ns-dnd-end" value="'+prefs.dnd.endTime+'" class="ns-time-input"></div>'+
          '<label class="ns-checkbox-row" style="margin-top:8px"><input type="checkbox" id="ns-dnd-priority" '+(prefs.dnd.allowPriorityUsers?'checked':'')+'>'+
          '<span>Allow Priority Users to bypass DND</span></label>'+
        '</div>'+
      '</div>';
    c.querySelector('#ns-desktop-sender').onchange = function(){ prefs.desktop.showSenderDetails=this.checked; };
    c.querySelector('#ns-desktop-duration').onchange = function(){ prefs.desktop.duration=this.value; };
    c.querySelector('#ns-mobile-fallback').onchange = function(){ prefs.desktop.mobileFallbackEnabled=this.checked; };
    c.querySelector('#ns-mobile-delay').onchange = function(){ prefs.desktop.mobileFallbackDelay=this.value; };
    c.querySelector('#ns-disable-mobile-active').onchange = function(){ prefs.desktop.disableMobileWhenActive=this.checked; };
    c.querySelector('#ns-dnd-enabled').onchange = function(){ prefs.dnd.enabled=this.checked; c.querySelector('#ns-dnd-times').classList.toggle('ns-hidden',!this.checked); };
    c.querySelector('#ns-dnd-start').onchange = function(){ prefs.dnd.startTime=this.value; };
    c.querySelector('#ns-dnd-end').onchange = function(){ prefs.dnd.endTime=this.value; };
    c.querySelector('#ns-dnd-priority').onchange = function(){ prefs.dnd.allowPriorityUsers=this.checked; };
  }

  // ââ Reminder âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function renderReminderSection(prefs, c) {
    var r = prefs.reminder;
    c.innerHTML =
      '<div class="ns-section-header"><h2>Reminder Notification</h2>'+
      '<p>Choose whether to receive a Reminder notification in email each day that shows your calendar event and task.</p></div>'+
      '<div class="ns-block">'+
        '<label class="ns-checkbox-row"><input type="checkbox" id="ns-reminder-organizer" '+(r.showOrganizerDetails?'checked':'')+'>'+
        '<span>Show organiser details in desktop notification</span></label>'+
        '<label class="ns-checkbox-row"><input type="checkbox" id="ns-reminder-event" '+(r.showEventDetails?'checked':'')+'>'+
        '<span>Show event details in desktop notification</span></label>'+
        '<div class="ns-reminder-preview">'+
          '<div class="ns-rp-header"><span class="ns-rp-title">Task Reminder</span></div>'+
          '<div class="ns-rp-task">Task enhancements - @Venkatachalapathy</div>'+
          '<div class="ns-rp-row"><i class="fa-solid fa-clock" style="color:#e53e3e"></i><span>Time: Fri, Mar 08, 2023 12:10</span></div>'+
          '<div class="ns-rp-actions">'+
            '<button class="ns-btn-dismiss">Dismiss</button>'+
            '<div class="ns-snooze-wrap"><span>Snooze for 5 min</span><i class="fa-solid fa-chevron-down" style="font-size:11px;margin-left:4px"></i></div>'+
          '</div>'+
        '</div>'+
      '</div>';
    c.querySelector('#ns-reminder-organizer').onchange = function(){ prefs.reminder.showOrganizerDetails=this.checked; };
    c.querySelector('#ns-reminder-event').onchange = function(){ prefs.reminder.showEventDetails=this.checked; };
  }

  // ââ Email âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function renderEmailSection(prefs, c) {
    var e = prefs.email;
    c.innerHTML =
      '<div class="ns-section-header"><h2>Email Notification</h2><p>Configure which task events trigger email notifications.</p></div>'+
      '<div class="ns-block">'+
        '<label class="ns-toggle-row"><input type="checkbox" class="ns-toggle-input" id="ns-email-enabled" '+(e.enabled?'checked':'')+'>'+
        '<span class="ns-toggle-track"></span><span>Enable Email Notifications</span></label>'+
      '</div>'+
      '<div class="ns-block" id="ns-email-body" style="'+(e.enabled?'':'opacity:.5;pointer-events:none')+'">'+
        '<div class="ns-block-title">Daily Agenda Email</div>'+
        '<label class="ns-checkbox-row"><input type="checkbox" id="ns-daily-agenda" '+(e.dailyAgenda?'checked':'')+'>'+
        '<span>Send daily agenda email</span>'+
        '<input type="time" id="ns-agenda-time" value="'+e.dailyAgendaTime+'" class="ns-time-input" style="margin-left:12px"></label>'+
        '<div class="ns-block-title" style="margin-top:16px">Trigger-Level Email Controls</div>'+
        '<div class="ns-triggers-grid" id="ns-email-triggers">'+renderTriggersGrid(prefs,'email')+'</div>'+
      '</div>';
    c.querySelector('#ns-email-enabled').onchange = function(){
      e.enabled=this.checked;
      var b=c.querySelector('#ns-email-body'); b.style.opacity=this.checked?'1':'0.5'; b.style.pointerEvents=this.checked?'':'none';
    };
    c.querySelector('#ns-daily-agenda').onchange = function(){ e.dailyAgenda=this.checked; };
    c.querySelector('#ns-agenda-time').onchange = function(){ e.dailyAgendaTime=this.value; };
    wireTriggerCheckboxes(c.querySelector('#ns-email-triggers'), prefs, 'email');
  }

  function renderTriggersGrid(prefs, channel) {
    return TRIGGERS.map(function(t){
      var key=channel+'_'+t.id; var checked=prefs.triggers[key]!==false;
      return '<label class="ns-trigger-item '+(t.mandatory?'ns-mandatory':'')+'">'+
        '<input type="checkbox" data-trigger="'+t.id+'" data-channel="'+channel+'" '+(checked?'checked':'')+' '+(t.mandatory?'disabled':'')+'>'+
        '<span class="ns-trigger-label">'+t.label+(t.mandatory?'<span class="ns-mandatory-tag">Required</span>':'')+
        '</span></label>';
    }).join('');
  }

  function wireTriggerCheckboxes(container, prefs, channel) {
    if(!container) return;
    container.querySelectorAll('input[type=checkbox]').forEach(function(cb){
      cb.onchange=function(){ prefs.triggers[this.dataset.channel+'_'+this.dataset.trigger]=this.checked; };
    });
  }

  // ââ Priority Users ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function renderPriorityUsersSection(prefs, c) {
    var members=(window.state&&window.state.members)||[];
    var priorityIds=prefs.priorityUsers||[];
    c.innerHTML =
      '<div class="ns-section-header"><h2>Priority Users</h2>'+
      '<p>Notifications from Priority Users will bypass Do Not Disturb mode and always be delivered.</p></div>'+
      '<div class="ns-block">'+
        '<div class="ns-info-box"><i class="fa-solid fa-circle-info"></i> Priority users can send notifications even during your quiet hours.</div>'+
        '<div class="ns-block-title">Select Priority Users</div>'+
        '<div class="ns-users-grid" id="ns-users-grid">'+
          members.map(function(m){
            var ip=priorityIds.indexOf(m.id)!==-1;
            return '<div class="ns-user-card '+(ip?'ns-user-priority':'')+'" data-uid="'+m.id+'">'+
              '<div class="ns-user-avatar" style="background:'+avatarColor(m.name)+'">'+getInitials(m.name)+'</div>'+
              '<div class="ns-user-info"><div class="ns-user-name">'+m.name+'</div><div class="ns-user-email">'+(m.email||'')+'</div></div>'+
              '<div class="ns-user-badge '+(ip?'':'ns-hidden')+'"><i class="fa-solid fa-star"></i></div>'+
            '</div>';
          }).join('')+
        '</div>'+
      '</div>';
    c.querySelector('#ns-users-grid').addEventListener('click',function(e){
      var card=e.target.closest('.ns-user-card'); if(!card) return;
      var uid=card.dataset.uid; var idx=priorityIds.indexOf(uid);
      if(idx!==-1){ priorityIds.splice(idx,1); card.classList.remove('ns-user-priority'); card.querySelector('.ns-user-badge').classList.add('ns-hidden'); }
      else{ priorityIds.push(uid); card.classList.add('ns-user-priority'); card.querySelector('.ns-user-badge').classList.remove('ns-hidden'); }
      prefs.priorityUsers=priorityIds;
    });
  }

  // ââ Notification Preference âââââââââââââââââââââââââââââââââââââââââââââââ
  function renderNotifPreferenceSection(prefs, c) {
    var s=window.state;
    var groups=(s&&s.groups)?s.groups.filter(function(g){return g.type!=='personal';}):[]; 
    var allItems=[{id:'personal',name:'Personal tasks',type:'personal'}].concat(groups);
    var channels=['pop','cliq','email','mobile'];
    var channelLabels={pop:'Pop',cliq:'Cliq',email:'Email',mobile:'Mobile'};
    var channelIcons={pop:'fa-desktop',cliq:'fa-comments',email:'fa-envelope',mobile:'fa-mobile-screen'};
    c.innerHTML =
      '<div class="ns-section-header"><h2>Notification Preferences</h2>'+
      '<p>Customize your Tasks notification settings based on your preferences.</p></div>'+
      '<div class="ns-block">'+
        '<h3 class="ns-sub-heading">Manage Task Activities</h3>'+
        '<p class="ns-desc">Select the following task activities for which you would like to receive notifications.</p>'+
        '<div class="ns-info-box ns-info-orange">If an activity is disabled, then the actions related to it will not be notified.</div>'+
        '<div class="ns-pref-search-row"><div class="ns-pref-search-wrap">'+
          '<i class="fa-solid fa-magnifying-glass"></i><input type="text" id="ns-pref-search" placeholder="Search Groups" class="ns-pref-search">'+
        '</div></div>'+
        '<div class="ns-pref-table-wrap"><table class="ns-pref-table"><thead><tr>'+
          '<th class="ns-th-group">Group / List</th><th class="ns-th-bucket">Bucket</th>'+
          channels.map(function(ch){return '<th class="ns-th-channel"><i class="fa-regular '+channelIcons[ch]+'"></i> '+channelLabels[ch]+'</th>';}).join('')+
        '</tr></thead><tbody id="ns-pref-tbody">'+
          allItems.map(function(item){
            var pref=prefs.groupPrefs[item.id]||buildDefaultGroupPref(item.id);
            return '<tr class="ns-pref-row" data-group-id="'+item.id+'" data-group-name="'+item.name+'">'+
              '<td class="ns-td-group"><div class="ns-group-cell">'+
                (item.type==='personal'?'<i class="fa-regular fa-user" style="color:var(--text-muted)"></i>':'<i class="fa-solid fa-users" style="color:var(--text-muted)"></i>')+
                '<span>'+item.name+'</span></div></td>'+
              '<td class="ns-td-bucket"><select class="ns-bucket-select" data-group-id="'+item.id+'">'+
                ['All','Essential','Non'].map(function(b){return '<option value="'+b+'" '+(pref.bucket===b?'selected':'')+'>'+b+'</option>';}).join('')+
              '</select></td>'+
              channels.map(function(ch){
                return '<td class="ns-td-channel"><input type="checkbox" class="ns-ch-cb" data-group-id="'+item.id+'" data-channel="'+ch+'" '+(pref.channels[ch]?'checked':'')+'/></td>';
              }).join('')+
            '</tr>';
          }).join('')+
        '</tbody></table></div>'+
      '</div>';
    // Wire table changes
    c.querySelector('#ns-pref-tbody').addEventListener('change',function(e){
      var el=e.target; var gid=el.dataset.groupId; if(!gid) return;
      if(!prefs.groupPrefs[gid]) prefs.groupPrefs[gid]=buildDefaultGroupPref(gid);
      if(el.classList.contains('ns-bucket-select')){
        prefs.groupPrefs[gid].bucket=el.value;
        var allOn=el.value!=='Non';
        channels.forEach(function(ch){
          var cb=c.querySelector('.ns-ch-cb[data-group-id="'+gid+'"][data-channel="'+ch+'"]');
          if(cb){ cb.checked=allOn; prefs.groupPrefs[gid].channels[ch]=allOn; }
        });
      }
      if(el.classList.contains('ns-ch-cb')){ prefs.groupPrefs[gid].channels[el.dataset.channel]=el.checked; }
    });
    // Search
    c.querySelector('#ns-pref-search').oninput=function(){
      var q=this.value.toLowerCase();
      c.querySelectorAll('.ns-pref-row').forEach(function(row){
        row.style.display=(row.dataset.groupName||'').toLowerCase().includes(q)?'':'none';
      });
    };
  }

  // ââ Main Render âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function renderNotificationSettings(prefs) {
    var overlay=document.getElementById('ns-overlay'); if(!overlay) return;
    var panels=[
      {id:'desktop',label:'Desktop Notification',icon:'fa-desktop',fn:renderDesktopSection},
      {id:'reminder',label:'Reminder Notification',icon:'fa-bell',fn:renderReminderSection},
      {id:'email',label:'Email Notification',icon:'fa-envelope',fn:renderEmailSection},
      {id:'priority',label:'Priority Users',icon:'fa-star',fn:renderPriorityUsersSection},
      {id:'preference',label:'Notification Preference',icon:'fa-sliders',fn:renderNotifPreferenceSection},
    ];
    overlay.innerHTML =
      '<div class="ns-layout">'+
        '<div class="ns-nav-bar">'+
          '<div class="ns-nav-header">'+
            '<span>Notification</span>'+
            '<label class="ns-toggle-row ns-nav-toggle"><input type="checkbox" class="ns-toggle-input" id="ns-master-toggle" '+(prefs.notificationsEnabled?'checked':'')+'>'+
            '<span class="ns-toggle-track"></span></label>'+
          '</div>'+
          '<ul class="ns-nav-list">'+
            panels.map(function(p,i){
              return '<li class="ns-nav-item '+(i===0?'active':'')+'" data-panel="'+p.id+'">'+
                '<i class="fa-solid '+p.icon+'"></i><span>'+p.label+'</span></li>';
            }).join('')+
          '</ul>'+
        '</div>'+
        '<div class="ns-content-area">'+
          panels.map(function(p,i){
            return '<div class="ns-panel '+(i===0?'ns-panel-active':'')+'" id="ns-panel-'+p.id+'"></div>';
          }).join('')+
          '<div class="ns-save-row"><button class="ns-save-btn" id="ns-save-btn">Save</button>'+
          '<button class="ns-cancel-btn" id="ns-cancel-btn">Cancel</button></div>'+
        '</div>'+
      '</div>';
    // Render first panel
    panels[0].fn(prefs, document.getElementById('ns-panel-'+panels[0].id));
    document.getElementById('ns-panel-'+panels[0].id).dataset.rendered='1';
    // Nav switching
    overlay.querySelectorAll('.ns-nav-item').forEach(function(item){
      item.addEventListener('click',function(){
        overlay.querySelectorAll('.ns-nav-item').forEach(function(n){n.classList.remove('active');});
        overlay.querySelectorAll('.ns-panel').forEach(function(p){p.classList.remove('ns-panel-active');});
        this.classList.add('active');
        var panelEl=document.getElementById('ns-panel-'+this.dataset.panel);
        panelEl.classList.add('ns-panel-active');
        var panel=panels.find(function(p){return p.id===item.dataset.panel;});
        if(panel&&!panelEl.dataset.rendered){ panel.fn(prefs,panelEl); panelEl.dataset.rendered='1'; }
      });
    });
    overlay.querySelector('#ns-master-toggle').onchange=function(){ prefs.notificationsEnabled=this.checked; };
    overlay.querySelector('#ns-save-btn').onclick=function(){
      savePrefs(prefs);
      showToast('Notification preferences saved!');
    };
    overlay.querySelector('#ns-cancel-btn').onclick=function(){
      // Reload with saved state
      renderNotificationSettings(loadPrefs());
    };
  }

  function showToast(msg) {
    var t=document.createElement('div');
    t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a73e8;color:#fff;padding:10px 22px;border-radius:8px;font-size:13px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.3)';
    t.textContent=msg; document.body.appendChild(t); setTimeout(function(){t.remove();},2500);
  }

  // ââ Integration âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function boot() {
    var section=document.getElementById('section-notification'); if(!section) return;
    var overlay=document.getElementById('ns-overlay');
    if(!overlay){ overlay=document.createElement('div'); overlay.id='ns-overlay'; overlay.style.height='100%'; section.appendChild(overlay); }

    // Wire nav click to render
    var navItem=document.querySelector('.settings-nav-item[data-section="notification"]');
    if(navItem){
      navItem.addEventListener('click',function(){
        setTimeout(function(){ renderNotificationSettings(loadPrefs()); },50);
      });
    }
  }

  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,400); }); }
  else { setTimeout(boot,400); }

  // Public API
  window.NotificationSettings={
    load:loadPrefs, save:savePrefs, render:renderNotificationSettings,
    TRIGGERS:TRIGGERS, ESSENTIAL_IDS:ESSENTIAL_IDS
  };

  window.isInDndMode=function(){
    var p=loadPrefs(); if(!p.dnd.enabled) return false;
    var now=new Date(); var cur=now.getHours()*60+now.getMinutes();
    var s=p.dnd.startTime.split(':'); var e=p.dnd.endTime.split(':');
    var st=parseInt(s[0])*60+parseInt(s[1]); var en=parseInt(e[0])*60+parseInt(e[1]);
    return st<=en ? (cur>=st&&cur<en) : (cur>=st||cur<en);
  };

  window.isPriorityUser=function(userId){
    return (loadPrefs().priorityUsers||[]).indexOf(userId)!==-1;
  };
})();
