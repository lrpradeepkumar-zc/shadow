/**
 * Shadow ToDo - Workflow Patch
 * ----------------------------------------------------------------------------
 * Surgical fixes for the Workflow builder (workflow.html) and Group Settings.
 *
 * Fixes:
 *   1. Group Mapping: builder's Group dropdown was reading window.state.groups
 *      which does not exist on workflow.html. Now reads from ShadowDB.Groups
 *      filtered to groups the current user is actually mapped to.
 *   2. Auto-Update: re-fetches & re-populates when ShadowDB data changes.
 *   3. Group Settings "Assigned Workflows": ensures rules saved from the
 *      builder receive groupId + scope='group' so the existing
 *      renderWorkflowsTab() in group-ui.js can list them.
 *   4. DB Parity:
 *        - assignee param becomes a <select> of valid users from DB
 *        - priority param becomes a <select> of valid enum values
 *        - group dropdown only shows groups mapped to the current user
 *
 * CRITICAL: This patch only touches Workflow logic and the Group settings
 * Assigned-Workflows surface. It does not alter any other flow or layout.
 */
(function(){
  'use strict';

  var DEBUG = false;
  function log(){ if(DEBUG) try{ console.log.apply(console, ['[wf-patch]'].concat([].slice.call(arguments))); }catch(e){} }

  // ------------------------------------------------------------------ cache
  var cache = {
    uid: null,
    users: null,         // [{id,name,email,role}]
    userGroups: null,    // [{id,name}]
    fetchedAt: 0
  };
  var TTL_MS = 30000;
  var inflight = null;

  function now(){ return Date.now(); }

  function sb(){ return window.ShadowDB && window.ShadowDB._sb; }

  // -------------------------------------------------------- data loaders --
  async function loadCurrentUserId(){
    var c = sb(); if(!c) return null;
    try{
      var s = await c.auth.getSession();
      return s && s.data && s.data.session && s.data.session.user ? s.data.session.user.id : null;
    }catch(e){ return null; }
  }

  async function loadUsers(){
    var c = sb(); if(!c) return [];
    try{
      var r = await c.from('users').select('id,name,email,role').order('name');
      if(r.error){ log('loadUsers error', r.error.message); return []; }
      return r.data || [];
    }catch(e){ return []; }
  }

  async function loadGroupsMappedToUser(uid){
    var c = sb(); if(!c) return [];
    try{
      // 1) Owner of group
      var ownedRes = await c.from('groups').select('id,name').eq('owner_id', uid);
      var owned = (ownedRes && ownedRes.data) || [];
      // 2) Member rows authored by user (owner_id == uid)
      var m1Res = await c.from('members').select('group_id').eq('owner_id', uid);
      var m1 = (m1Res && m1Res.data) || [];
      // 3) Member rows pointing to this user via data.userId / data.uid
      var m2Res = await c.from('members').select('group_id, data');
      var m2 = (m2Res && m2Res.data) || [];
      var ids = {};
      owned.forEach(function(g){ ids[g.id] = g.name; });
      m1.forEach(function(m){ if(m.group_id) ids[m.group_id] = ids[m.group_id] || null; });
      m2.forEach(function(m){
        var d = m.data || {};
        if(d && (d.userId === uid || d.uid === uid) && m.group_id){ ids[m.group_id] = ids[m.group_id] || null; }
      });
      var groupIds = Object.keys(ids);
      if(!groupIds.length) return [];
      // Resolve missing names
      var gRes = await c.from('groups').select('id,name').in('id', groupIds);
      var gArr = (gRes && gRes.data) || [];
      // Only return groups that exist in the groups table (DB parity)
      var byId = {};
      gArr.forEach(function(g){ byId[g.id] = g; });
      var out = [];
      groupIds.forEach(function(id){ if(byId[id]) out.push(byId[id]); });
      // Sort alphabetically
      out.sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
      return out;
    }catch(e){ log('loadGroupsMappedToUser error', e); return []; }
  }

  async function refreshData(force){
    if(!force && cache.users && cache.userGroups && (now() - cache.fetchedAt) < TTL_MS){
      return cache;
    }
    if(inflight) return inflight;
    inflight = (async function(){
      var uid = cache.uid || await loadCurrentUserId();
      cache.uid = uid;
      var users = await loadUsers();
      var groups = uid ? await loadGroupsMappedToUser(uid) : [];
      cache.users = users;
      cache.userGroups = groups;
      cache.fetchedAt = now();
      inflight = null;
      try{ window.dispatchEvent(new CustomEvent('shadow-wf-data-refreshed', {detail:{groups: groups, users: users}})); }catch(e){}
      return cache;
    })();
    return inflight;
  }

  // ------------------------------------------------ Group select patcher --
  function findGroupSelect(){ return document.getElementById('wfGroupSelect'); }

  function paintGroupSelect(sel, groups, currentValue){
    if(!sel) return;
    var prev = currentValue != null ? currentValue : sel.value;
    var html = '<option value="">Select group…</option>';
    for(var i=0;i<groups.length;i++){
      var g = groups[i];
      var safe = String(g.name == null ? g.id : g.name).replace(/&/g,'&amp;').replace(/</g,'&lt;');
      var sel2 = (prev === g.id) ? ' selected' : '';
      html += '<option value="'+g.id+'"'+sel2+'>'+safe+'</option>';
    }
    sel.innerHTML = html;
    if(prev && Array.prototype.some.call(sel.options, function(o){ return o.value===prev; })){
      sel.value = prev;
    }
  }

  async function repopulateGroupSelect(force){
    var sel = findGroupSelect();
    if(!sel) return;
    var prev = sel.value;
    var data = await refreshData(force);
    paintGroupSelect(sel, data.userGroups || [], prev);
  }

  // ---------------------------------------------- Action params patcher --
  // Replace input fields for 'assignee' and 'priority' inside the
  // currently-rendered actions list with select dropdowns sourced from DB.
  var PRIORITY_VALUES = ['Low','Medium','High','Urgent'];

  function htmlEscape(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function buildUserSelect(currentValue, users){
    var opts = '<option value="">Select user…</option>';
    var found = false;
    users.forEach(function(u){
      var v = u.name || u.email || u.id;
      var s = (currentValue === v || currentValue === u.id) ? ' selected' : '';
      if(s) found = true;
      opts += '<option value="'+htmlEscape(v)+'"'+s+'>'+htmlEscape(u.name || u.email || u.id)+'</option>';
    });
    // Preserve unknown legacy values so existing rules aren't silently re-mapped.
    if(currentValue && !found){
      opts += '<option value="'+htmlEscape(currentValue)+'" selected>'+htmlEscape(currentValue)+' (legacy)</option>';
    }
    return opts;
  }

  function buildPrioritySelect(currentValue){
    var opts = '<option value="">Select priority…</option>';
    var found = false;
    PRIORITY_VALUES.forEach(function(p){
      var s = (currentValue === p) ? ' selected' : '';
      if(s) found = true;
      opts += '<option value="'+p+'"'+s+'>'+p+'</option>';
    });
    if(currentValue && !found){
      opts += '<option value="'+htmlEscape(currentValue)+'" selected>'+htmlEscape(currentValue)+' (legacy)</option>';
    }
    return opts;
  }

  function upgradeParamInputs(root){
    if(!root) return;
    var inputs = root.querySelectorAll('input.action-param[data-param-key]');
    if(!inputs || !inputs.length) return;
    var users = (cache.users || []);
    Array.prototype.forEach.call(inputs, function(inp){
      var key = inp.getAttribute('data-param-key');
      if(key !== 'assignee' && key !== 'recipients' && key !== 'priority') return;
      // Already upgraded?
      if(inp.getAttribute('data-wf-upgraded') === '1') return;
      var currentVal = inp.value;
      var sel = document.createElement('select');
      sel.className = inp.className.replace(/\binput\b/,'').trim();
      // Copy data attributes
      Array.prototype.forEach.call(inp.attributes, function(a){
        if(a.name.indexOf('data-') === 0 || a.name === 'style' || a.name === 'class'){
          if(a.name !== 'class') sel.setAttribute(a.name, a.value);
        }
      });
      sel.setAttribute('data-wf-upgraded','1');
      if(key === 'priority'){
        sel.innerHTML = buildPrioritySelect(currentVal);
      } else {
        // assignee or recipients (single user)
        sel.innerHTML = buildUserSelect(currentVal, users);
      }
      inp.parentNode.replaceChild(sel, inp);
      // The original code listens via event delegation on input.action-param[data-param-key].
      // Replicate the same dispatch path on change.
      sel.addEventListener('change', function(ev){
        try{
          var idx = parseInt(sel.getAttribute('data-idx'), 10);
          // Trigger an 'input' event so any delegated listener sees the new value.
          var inputEvt = new Event('input', {bubbles:true});
          sel.dispatchEvent(inputEvt);
        }catch(e){}
      });
    });
  }

  // -------------------------- Scope/groupId enforcement on rule save --
  // workflow-ui.js builds currentRule with scope='personal'/groupId=null
  // by default. When the user picks a group in the builder, the rule
  // should be saved with scope='group' + groupId=<picked>.
  function patchRuleScope(){
    var eng = window.WorkflowEngine;
    if(!eng || eng.__wfPatched) return;
    var origAdd = eng.addRule;
    var origUpd = eng.updateRule;
    if(typeof origAdd === 'function'){
      eng.addRule = function(ruleData){
        ruleData = enforceScope(ruleData);
        return origAdd.call(eng, ruleData);
      };
    }
    if(typeof origUpd === 'function'){
      eng.updateRule = function(id, updates){
        updates = enforceScope(updates);
        return origUpd.call(eng, id, updates);
      };
    }
    eng.__wfPatched = true;
  }

  function enforceScope(data){
    if(!data || typeof data !== 'object') return data;
    var sel = findGroupSelect();
    var pickedGroup = sel && sel.value ? sel.value : null;
    if(pickedGroup){
      data.groupId = pickedGroup;
      data.scope = 'group';
    } else if(data.groupId === undefined && data.scope === undefined){
      // leave defaults alone
    }
    return data;
  }

  // ------------------------------------------------ Boot / observers ----
  var moBuilder = null;
  function installObservers(){
    if(moBuilder) return;
    moBuilder = new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        var m = muts[i];
        if(m.addedNodes && m.addedNodes.length){
          for(var j=0;j<m.addedNodes.length;j++){
            var n = m.addedNodes[j];
            if(n.nodeType !== 1) continue;
            // Re-populate group select if it (re)appeared
            if(n.id === 'wfGroupSelect' || (n.querySelector && n.querySelector('#wfGroupSelect'))){
              repopulateGroupSelect(false);
            }
            // Upgrade action params on actions list re-render
            if(n.id === 'actionsList' || (n.querySelector && n.querySelector('#actionsList'))){
              upgradeParamInputs(document.getElementById('actionsList') || n);
            }
            if(n.classList && n.classList.contains('action-param-row')){
              upgradeParamInputs(n.parentNode || n);
            }
          }
        }
      }
      // Also upgrade any param inputs that appeared from in-place innerHTML updates.
      var al = document.getElementById('actionsList');
      if(al) upgradeParamInputs(al);
    });
    moBuilder.observe(document.body, {childList:true, subtree:true});
  }

  function hookOpenBuilder(){
    var B = window.ShadowWorkflowBuilder;
    if(!B || B.__wfPatched) return;
    var origOpen = B.openBuilder;
    if(typeof origOpen !== 'function') return;
    B.openBuilder = function(opts){
      var ret = origOpen.apply(B, arguments);
      // After the builder DOM is mounted, refresh data and paint.
      setTimeout(function(){
        repopulateGroupSelect(true);
        var al = document.getElementById('actionsList');
        if(al) upgradeParamInputs(al);
      }, 0);
      return ret;
    };
    B.__wfPatched = true;
  }

  function boot(){
    var tries = 0;
    function tryInit(){
      tries++;
      var ready = sb() && window.WorkflowEngine && window.ShadowWorkflowBuilder;
      if(!ready){
        if(tries < 60) setTimeout(tryInit, 250);
        return;
      }
      hookOpenBuilder();
      patchRuleScope();
      installObservers();
      // Prime cache; if the builder is already open on this page, paint it.
      refreshData(true).then(function(){
        repopulateGroupSelect(true);
        var al = document.getElementById('actionsList');
        if(al) upgradeParamInputs(al);
      });
    }
    tryInit();
  }

  // Listen for storage changes (cross-tab) and re-prime cache.
  window.addEventListener('storage', function(e){
    if(!e.key) return;
    if(/^(shadow|sb-)/.test(e.key)) refreshData(true).then(function(){ repopulateGroupSelect(true); });
  });

  // Listen for app-level data events emitted by the main app and re-fetch.
  ['shadow:groups-changed','shadow:members-changed','shadow:db-changed'].forEach(function(evt){
    window.addEventListener(evt, function(){ refreshData(true).then(function(){ repopulateGroupSelect(true); }); });
  });

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Public hooks
  window.ShadowWorkflowPatch = {
    refresh: function(){ return refreshData(true).then(function(){ repopulateGroupSelect(true); }); },
    _cache: cache
  };
})();
