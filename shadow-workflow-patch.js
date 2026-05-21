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
 *   5. ShadowDB.Settings.get for owner-scoped keys (workflow_rules,
 *      workflow_logs): the original .maybeSingle() throws once >1 user
 *      has a row. We add the missing owner_id filter so each user reads
 *      only their own row.
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
      var ownedRes = await c.from('groups').select('id,name').eq('owner_id', uid);
      var owned = (ownedRes && ownedRes.data) || [];
      var m1Res = await c.from('members').select('group_id').eq('owner_id', uid);
      var m1 = (m1Res && m1Res.data) || [];
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
      var gRes = await c.from('groups').select('id,name').in('id', groupIds);
      var gArr = (gRes && gRes.data) || [];
      var byId = {};
      gArr.forEach(function(g){ byId[g.id] = g; });
      var out = [];
      groupIds.forEach(function(id){ if(byId[id]) out.push(byId[id]); });
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
    var html = '<option value="">Select group\u2026</option>';
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
  var PRIORITY_VALUES = ['Low','Medium','High','Urgent'];

  function htmlEscape(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function buildUserSelect(currentValue, users){
    var opts = '<option value="">Select user\u2026</option>';
    var found = false;
    users.forEach(function(u){
      var v = u.name || u.email || u.id;
      var s = (currentValue === v || currentValue === u.id) ? ' selected' : '';
      if(s) found = true;
      opts += '<option value="'+htmlEscape(v)+'"'+s+'>'+htmlEscape(u.name || u.email || u.id)+'</option>';
    });
    if(currentValue && !found){
      opts += '<option value="'+htmlEscape(currentValue)+'" selected>'+htmlEscape(currentValue)+' (legacy)</option>';
    }
    return opts;
  }

  function buildPrioritySelect(currentValue){
    var opts = '<option value="">Select priority\u2026</option>';
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
    var inputs = root.querySelectorAll('input.action-param[data-param]');
    if(!inputs || !inputs.length) return;
    var users = (cache.users || []);
    Array.prototype.forEach.call(inputs, function(inp){
      var key = inp.getAttribute('data-param');
      if(key !== 'assignee' && key !== 'recipients' && key !== 'priority') return;
      if(inp.getAttribute('data-wf-upgraded') === '1') return;
      var currentVal = inp.value;
      var sel = document.createElement('select');
      sel.className = inp.className;
      Array.prototype.forEach.call(inp.attributes, function(a){
        if(a.name.indexOf('data-') === 0 || a.name === 'style'){
          sel.setAttribute(a.name, a.value);
        }
      });
      sel.setAttribute('data-wf-upgraded','1');
      if(key === 'priority'){
        sel.innerHTML = buildPrioritySelect(currentVal);
      } else {
        sel.innerHTML = buildUserSelect(currentVal, users);
      }
      inp.parentNode.replaceChild(sel, inp);
      sel.addEventListener('change', function(){
        try{ sel.dispatchEvent(new Event('input', {bubbles:true})); }catch(e){}
      });
    });
  }

  // -------------------------- Scope/groupId enforcement on rule save --
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
    }
    return data;
  }

  // -------- Patch ShadowDB.Settings.get for owner-scoped keys ----------
  // workflow_rules / workflow_logs are saved per-user but Settings.get does
  // not filter by owner_id, which throws "multiple rows" once >1 user has
  // a row. Add the missing filter only for these known per-user keys so
  // each user reads only their own row (and engine.loadRules can hydrate).
  var OWNER_SCOPED_KEYS = {'workflow_rules':1, 'workflow_logs':1};
  function patchSettingsGet(){
    var S = window.ShadowDB && window.ShadowDB.Settings;
    if(!S || S.__wfPatched) return;
    var origGet = S.get;
    S.get = async function(key){
      if(OWNER_SCOPED_KEYS[key]){
        var c = sb(); if(!c) return null;
        try{
          var s = await c.auth.getSession();
          var uid = s && s.data && s.data.session && s.data.session.user ? s.data.session.user.id : null;
          if(!uid) return null;
          var r = await c.from('settings').select('value').eq('key', key).eq('owner_id', uid).maybeSingle();
          if(r && r.error){ log('Settings.get scoped error', r.error.message); return null; }
          return r && r.data ? r.data.value : null;
        }catch(e){ log('Settings.get scoped exception', e); return null; }
      }
      return origGet.call(S, key);
    };
    S.__wfPatched = true;
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
            if(n.id === 'wfGroupSelect' || (n.querySelector && n.querySelector('#wfGroupSelect'))){
              repopulateGroupSelect(false);
            }
            if(n.id === 'actionsList' || (n.querySelector && n.querySelector('#actionsList'))){
              upgradeParamInputs(document.getElementById('actionsList') || n);
            }
          }
        }
      }
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
      patchSettingsGet();
      // Re-init engine so its rules array hydrates via the now-scoped Settings.get.
      try{ if(window.WorkflowEngine.init) window.WorkflowEngine.init(); }catch(e){ log('engine re-init failed', e); }
      hookOpenBuilder();
      patchRuleScope();
      installObservers();
      refreshData(true).then(function(){
        repopulateGroupSelect(true);
        var al = document.getElementById('actionsList');
        if(al) upgradeParamInputs(al);
      });
    }
    tryInit();
  }

  window.addEventListener('storage', function(e){
    if(!e.key) return;
    if(/^(shadow|sb-)/.test(e.key)) refreshData(true).then(function(){ repopulateGroupSelect(true); });
  });

  ['shadow:groups-changed','shadow:members-changed','shadow:db-changed'].forEach(function(evt){
    window.addEventListener(evt, function(){ refreshData(true).then(function(){ repopulateGroupSelect(true); }); });
  });

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.ShadowWorkflowPatch = {
    refresh: function(){ return refreshData(true).then(function(){ repopulateGroupSelect(true); }); },
    _cache: cache
  };
})();
