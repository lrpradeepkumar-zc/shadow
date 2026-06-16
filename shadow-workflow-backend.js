/* shadow-workflow-backend.js
 * Backend persistence + lifecycle tracking + webhook intake for Workflows.
 * - Stores workflow rules in settings table (existing, per-user owner_id scoped).
 * - Stores workflow instances + webhooks in dedicated Supabase tables.
 * - All lifecycle state (pending/running/completed/failed) lives in DB; no localStorage/sessionStorage/in-memory caches survive a refresh-as-source-of-truth.
 * - Realtime: subscribes to workflow_instances + settings rows so UI updates reactively, and so a workflow keeps running on the backend even if the user closes the browser.
 * - Exposes window.WorkflowBackend.{trigger, webhook, getInstance, listInstances, listWebhooks, resumePending}.
 */
(function(){
  'use strict';
  if (window.ShadowWorkflowBackend) return;

  function uid(prefix){ return (prefix||'id') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,9); }
  function nowIso(){ return new Date().toISOString(); }
  function log(){ try{ console.debug.apply(console, ['[WorkflowBackend]'].concat([].slice.call(arguments))); }catch(_){} }

  function getSb(){ return window.ShadowDB && window.ShadowDB._sb; }
  var _cachedOwnerId = null;
  function getOwnerId(){
    try{
      if (_cachedOwnerId) return _cachedOwnerId;
      var s = window.state && window.state.currentUser;
      if (s && s.ownerId) return (_cachedOwnerId = s.ownerId);
      if (window.ShadowDB && window.ShadowDB.ownerId) return (_cachedOwnerId = window.ShadowDB.ownerId);
      if (window.ShadowDB && typeof window.ShadowDB.getOwnerId === 'function') return (_cachedOwnerId = window.ShadowDB.getOwnerId());
    }catch(_){}
    return null;
  }
  async function getOwnerIdAsync(){
    var sync = getOwnerId(); if (sync) return sync;
    try{
      var sb = getSb(); if (!sb || !sb.auth) return null;
      var sess = await sb.auth.getSession();
      var uid = sess && sess.data && sess.data.session && sess.data.session.user && sess.data.session.user.id;
      if (uid) _cachedOwnerId = uid;
      return uid || null;
    }catch(_){ return null; }
  }

  var Backend = {
    TABLES: { INSTANCES: 'workflow_instances', WEBHOOKS: 'workflow_webhooks' },
    Status: { PENDING:'pending', RUNNING:'running', COMPLETED:'completed', FAILED:'failed', CANCELLED:'cancelled' },
    _channels: {},
    _listeners: { instance: [], webhook: [] }
  };

  // ---------- Instance CRUD ----------
  Backend.createInstance = async function(opts){
    var sb = getSb(); if(!sb) throw new Error('Supabase not ready');
    var owner = opts.ownerId || getOwnerId() || (await getOwnerIdAsync());
    if (!owner) throw new Error('No owner_id; user must be signed in to persist workflow state');
    var row = {
      id: opts.id || uid('inst'),
      owner_id: owner,
      rule_id: opts.ruleId,
      rule_name: opts.ruleName || null,
      scope: opts.scope || null,
      group_id: opts.groupId || null,
      trigger_type: opts.triggerType || 'manual',
      trigger_payload: opts.payload || {},
      task_id: opts.taskId || null,
      status: opts.status || Backend.Status.PENDING,
      step_index: 0,
      total_steps: opts.totalSteps || 0,
      result: {},
      source: opts.source || 'app',
      created_at: nowIso(),
      updated_at: nowIso()
    };
    var res = await sb.from(Backend.TABLES.INSTANCES).insert(row).select().maybeSingle();
    if (res.error) throw res.error;
    log('createInstance', res.data.id, res.data.status);
    return res.data;
  };

  Backend.updateInstance = async function(id, patch){
    var sb = getSb(); if(!sb) throw new Error('Supabase not ready');
    var p = Object.assign({}, patch, { updated_at: nowIso() });
    if (patch && patch.status === Backend.Status.RUNNING && !patch.started_at) p.started_at = nowIso();
    if (patch && (patch.status === Backend.Status.COMPLETED || patch.status === Backend.Status.FAILED || patch.status === Backend.Status.CANCELLED) && !patch.completed_at) p.completed_at = nowIso();
    var res = await sb.from(Backend.TABLES.INSTANCES).update(p).eq('id', id).select().maybeSingle();
    if (res.error) throw res.error;
    return res.data;
  };

  Backend.getInstance = async function(id){
    var sb = getSb(); if(!sb) return null;
    var res = await sb.from(Backend.TABLES.INSTANCES).select('*').eq('id', id).maybeSingle();
    if (res.error) throw res.error;
    return res.data;
  };

  Backend.listInstances = async function(filter){
    var sb = getSb(); if(!sb) return [];
    filter = filter || {};
    var q = sb.from(Backend.TABLES.INSTANCES).select('*');
    var owner = filter.ownerId || getOwnerId() || (await getOwnerIdAsync());
    if (owner) q = q.eq('owner_id', owner);
    if (filter.ruleId) q = q.eq('rule_id', filter.ruleId);
    if (filter.status) q = q.eq('status', filter.status);
    if (filter.groupId) q = q.eq('group_id', filter.groupId);
    q = q.order('created_at', { ascending: false }).limit(filter.limit || 100);
    var res = await q;
    if (res.error) throw res.error;
    return res.data || [];
  };

  // ---------- Trigger a rule -> creates an instance in DB, then executes ----------
  Backend.trigger = async function(opts){
    opts = opts || {};
    var engine = window.WorkflowEngine;
    var rule = opts.rule || (engine && opts.ruleId && engine.getRule && engine.getRule(opts.ruleId));
    if (!rule) throw new Error('Rule not found');
    var totalSteps = (rule.actions && rule.actions.length) || 0;
    var inst = await Backend.createInstance({
      ruleId: rule.id,
      ruleName: rule.name,
      scope: rule.scope,
      groupId: rule.groupId,
      triggerType: opts.triggerType || (rule.trigger && rule.trigger.type) || 'manual',
      payload: opts.payload || {},
      taskId: opts.taskId || null,
      totalSteps: totalSteps,
      source: opts.source || 'app',
      status: Backend.Status.PENDING
    });
    // Move to running, then execute synchronously (best-effort) while tracking state in DB.
    try{
      await Backend.updateInstance(inst.id, { status: Backend.Status.RUNNING });
      var result = null;
      if (engine && typeof engine.executeRule === 'function'){
        result = await Promise.resolve(engine.executeRule(rule, opts.context || opts.payload || {})).catch(function(e){ throw e; });
      }
      await Backend.updateInstance(inst.id, { status: Backend.Status.COMPLETED, result: { ok: true, value: result || null }, step_index: totalSteps });
      return await Backend.getInstance(inst.id);
    }catch(err){
      try{ await Backend.updateInstance(inst.id, { status: Backend.Status.FAILED, error: String(err && err.message || err) }); }catch(_){}
      throw err;
    }
  };

  // ---------- Webhook intake ----------
  // Records the incoming webhook to DB first, then resolves the rule and triggers.
  Backend.webhook = async function(opts){
    var sb = getSb(); if(!sb) throw new Error('Supabase not ready');
    var owner = opts.ownerId || getOwnerId() || (await getOwnerIdAsync());
    if (!owner) throw new Error('No owner_id; cannot persist webhook');
    var hook = {
      id: opts.id || uid('hook'),
      owner_id: owner,
      rule_id: opts.ruleId || null,
      source: opts.source || 'external',
      method: opts.method || 'POST',
      headers: opts.headers || {},
      payload: opts.payload || {},
      status: 'received',
      received_at: nowIso()
    };
    var ins = await sb.from(Backend.TABLES.WEBHOOKS).insert(hook).select().maybeSingle();
    if (ins.error) throw ins.error;
    var saved = ins.data;
    try{
      // Resolve which rule(s) match: explicit ruleId in opts/payload, or any rule with trigger.type === 'webhook' scoped to this owner.
      var engine = window.WorkflowEngine;
      var ruleId = opts.ruleId || (opts.payload && opts.payload.ruleId);
      var rule = null;
      if (ruleId && engine && engine.getRule) rule = engine.getRule(ruleId);
      if (!rule && engine && engine.getAllRules){
        var all = engine.getAllRules() || [];
        rule = all.find(function(r){ return r && r.trigger && r.trigger.type === 'webhook' && (r.state === 'published' || r.state === 'active'); }) || all[0];
      }
      // Fallback: read rules directly from DB if engine in-memory cache is empty (e.g., this is a headless/background session)
      if (!rule) {
        try{
          var sres = await sb.from('settings').select('value').eq('owner_id', owner).eq('key', 'workflow_rules').maybeSingle();
          var rulesArr = sres.data && sres.data.value ? JSON.parse(sres.data.value) : [];
          if (ruleId) rule = rulesArr.find(function(r){ return r && r.id === ruleId; });
          if (!rule) rule = rulesArr.find(function(r){ return r && r.trigger && r.trigger.type === 'webhook' && (r.state === 'published' || r.state === 'active'); }) || rulesArr[0];
        }catch(_){}
      }
      if (!rule) throw new Error('No matching workflow rule for webhook');
      var inst = await Backend.trigger({ rule: rule, payload: saved.payload, triggerType: 'webhook', source: 'webhook' });
      await sb.from(Backend.TABLES.WEBHOOKS).update({ status: 'processed', instance_id: inst.id, processed_at: nowIso() }).eq('id', saved.id);
      return { webhook: saved, instance: inst };
    }catch(err){
      try{ await sb.from(Backend.TABLES.WEBHOOKS).update({ status: 'failed', error: String(err && err.message || err), processed_at: nowIso() }).eq('id', saved.id); }catch(_){}
      throw err;
    }
  };

  // ---------- Resume any pending/running instances on app start ----------
  // If a user closes the browser mid-run, the DB row stays as 'running'. On next session we either:
  //   (a) leave it as-is so backend keeps source of truth, or
  //   (b) re-attempt if rule still exists. Default: only mark stale (>10m running) as failed, leave fresh as-is.
  Backend.resumePending = async function(){
    var sb = getSb(); if(!sb) return { resumed: 0, stale: 0 };
    var owner = getOwnerId() || (await getOwnerIdAsync()); if (!owner) return { resumed: 0, stale: 0 };
    var staleCutoff = new Date(Date.now() - 10*60*1000).toISOString();
    var res = await sb.from(Backend.TABLES.INSTANCES).select('id,status,updated_at').eq('owner_id', owner).in('status', [Backend.Status.PENDING, Backend.Status.RUNNING]);
    if (res.error) { log('resumePending err', res.error.message); return { resumed: 0, stale: 0 }; }
    var rows = res.data || [];
    var stale = rows.filter(function(r){ return (r.updated_at || '') < staleCutoff; });
    for (var i=0;i<stale.length;i++){
      try{ await Backend.updateInstance(stale[i].id, { status: Backend.Status.FAILED, error: 'Stale: session ended before completion' }); }catch(_){}
    }
    return { resumed: rows.length - stale.length, stale: stale.length };
  };

  // ---------- Realtime subscriptions ----------
  Backend.subscribe = async function(){
    var sb = getSb(); if(!sb) return;
    if (Backend._channels.instances) return; // idempotent
    var owner = getOwnerId() || (await getOwnerIdAsync());
    var ch = sb.channel('wf_inst_' + (owner || 'all'))
      .on('postgres_changes', { event: '*', schema: 'public', table: Backend.TABLES.INSTANCES }, function(p){
        try{
          var row = p.new || p.old;
          if (owner && row && row.owner_id && row.owner_id !== owner) return;
          Backend._listeners.instance.forEach(function(fn){ try{ fn(p); }catch(_){} });
          if (window.WorkflowEngine && typeof window.WorkflowEngine.emit === 'function') window.WorkflowEngine.emit('instance:change', p);
        }catch(_){}
      })
      .subscribe();
    Backend._channels.instances = ch;
    var ch2 = sb.channel('wf_settings_' + (owner || 'all'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: owner ? ('owner_id=eq.'+owner) : undefined }, function(p){
        try{
          var row = p.new || p.old;
          if (!row || (row.key !== 'workflow_rules' && row.key !== 'workflow_logs')) return;
          // Re-hydrate engine rules from DB so UI reflects external/other-session changes immediately.
          if (window.WorkflowEngine){
            // engine.init() short-circuits if already initialized; use reloadEngineRules to force-resync from DB.
            Backend.reloadEngineRules().catch(function(){});
          }
          if (window.WorkflowEngine && typeof window.WorkflowEngine.emit === 'function') window.WorkflowEngine.emit('rules:reloaded', p);
        }catch(_){}
      })
      .subscribe();
    Backend._channels.settings = ch2;
    log('realtime subscribed', Object.keys(Backend._channels));
  };

  Backend.onInstanceChange = function(fn){ Backend._listeners.instance.push(fn); return function(){ Backend._listeners.instance = Backend._listeners.instance.filter(function(f){ return f !== fn; }); }; };

  Backend.unsubscribe = function(){
    var sb = getSb(); if(!sb) return;
    Object.keys(Backend._channels).forEach(function(k){ try{ sb.removeChannel(Backend._channels[k]); }catch(_){} delete Backend._channels[k]; });
  };

  // ---------- Boot ----------
  // Force-reload engine rules from DB regardless of internal 'initialized' guard.
  // The core engine.init() short-circuits if already initialized, so realtime cross-session updates need this.
  Backend.reloadEngineRules = async function(){
    try{
      var sb = getSb(); if (!sb) return 0;
      var owner = getOwnerId() || (await getOwnerIdAsync()); if (!owner) return 0;
      var sres = await sb.from('settings').select('value').eq('owner_id', owner).eq('key', 'workflow_rules').maybeSingle();
      var dbRules = sres.data && sres.data.value ? JSON.parse(sres.data.value) : [];
      var eng = window.WorkflowEngine;
      if (!eng) return 0;
      var inMem = (eng.getAllRules && eng.getAllRules()) || [];
      var inMemIds = new Set(inMem.map(function(r){ return r && r.id; }));
      var dbIds = new Set(dbRules.map(function(r){ return r && r.id; }));
      // Add new rules to engine in-memory cache via addRule (which also writes back to settings, idempotent)
      for (var i=0;i<dbRules.length;i++){
        var r = dbRules[i];
        if (!inMemIds.has(r.id) && typeof eng.addRule === 'function'){ try{ await eng.addRule(r); }catch(_){} }
        else if (typeof eng.updateRule === 'function'){ try{ await eng.updateRule(r.id, r); }catch(_){} }
      }
      // Remove rules that no longer exist in DB
      for (var j=0;j<inMem.length;j++){
        var rr = inMem[j];
        if (!dbIds.has(rr.id) && typeof eng.deleteRule === 'function'){ try{ await eng.deleteRule(rr.id); }catch(_){} }
      }
      return dbRules.length;
    }catch(e){ log('reloadEngineRules err', e.message); return -1; }
  };

  async function boot(){
    if (!getSb()) { setTimeout(boot, 250); return; }
    // Ensure owner is resolved before subscribing
    await getOwnerIdAsync();
    await Backend.subscribe();
    // Best-effort cleanup of stale instances from prior sessions:
    Backend.resumePending().catch(function(){});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.WorkflowBackend = Backend;
  window.ShadowWorkflowBackend = { version: 1, table: Backend.TABLES };
  log('ready');
})();
