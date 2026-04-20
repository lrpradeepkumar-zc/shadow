// backend.js — Supabase-backed drop-in replacement for ShadowDB.
// Public API identical to the previous IndexedDB backend used by app.js.


// Stub so app.js never hits "ShadowDB is not defined" during early init.
// Every call becomes a promise that resolves once the real backend boots.
(function () {
    if (window.ShadowDB) return;
    const pending = [];
    window.__shadowdbReady = () => new Promise(res => pending.push(res));
    window.__shadowdbFlush = () => { pending.splice(0).forEach(r => r()); };
    const wrap = (ns, m) => async (...a) => { await window.__shadowdbReady(); return window.ShadowDB[ns][m](...a); };
    const ns = (name) => {
          const methods = ['create','get','getById','getAll','update','delete','count',
                                 'complete','reopen','addSubtask','toggleSubtask','search','getStats',
                                 'getByGroup','getByStatus','getByAssignee','getByTask','getRecent','clear','set'];
          const o = {}; methods.forEach(m => o[m] = wrap(name, m)); return o;
    };
    window.ShadowDB = {
          STORES:{tasks:'tasks',groups:'groups',tags:'tags',categories:'categories',members:'members',customFields:'customFields',comments:'comments',activity:'activity',settings:'settings'},
          on:() => {}, emit:() => {},
          init: async () => { await window.__shadowdbReady(); return window.ShadowDB.init(); },
          openDB: async () => { await window.__shadowdbReady(); return true; },
          Tasks:ns('Tasks'), Groups:ns('Groups'), Tags:ns('Tags'), Categories:ns('Categories'),
          Members:ns('Members'), CustomFields:ns('CustomFields'), Comments:ns('Comments'),
          Activity:ns('Activity'), Settings:ns('Settings')
    };
})();

(function () {
  // 1) Fill these two in:
  const SUPABASE_URL  = 'https://ycysvoolkezntbxcfrnq.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljeXN2b29sa2V6bnRieGNmcm5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzY5MjksImV4cCI6MjA5MjAxMjkyOX0.Y0OFF8Bdc3iSp_Bm9G7Io3Szy0amnHVuO3k8nspqxCk';

  // Load supabase-js from CDN
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  s.onload = boot;
  document.head.appendChild(s);

  const STORES = {
    tasks: 'tasks', groups: 'groups', tags: 'tags', categories: 'categories',
    members: 'members', customFields: 'customFields', comments: 'comments',
    activity: 'activity', settings: 'settings'
  };

  const listeners = {};
  const on   = (evt, fn) => (listeners[evt] = listeners[evt] || []).push(fn);
  const emit = (evt, payload) => (listeners[evt] || []).forEach(fn => { try { fn(payload); } catch(_){} });
  const uid  = () => (crypto.randomUUID ? crypto.randomUUID() : 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2));

  function boot() {
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    const ownerId = async () => {
      const { data } = await sb.auth.getUser();
      return data?.user?.id || null;
    };

    function splitRow(table, obj) {
      const o = { ...obj };
      const columns = {
        tasks:       ['id','group_id','status','assignee_id'],
        groups:      ['id','name'],
        tags:        ['id'],
        categories:  ['id','group_id'],
        members:     ['id','group_id'],
        customFields:['id','group_id'],
        comments:    ['id','task_id'],
        activity:    ['id','task_id'],
      }[table] || ['id'];

      if (o.groupId    != null && o.group_id    == null) o.group_id    = o.groupId;
      if (o.group      != null && o.group_id    == null) o.group_id    = o.group;
      if (o.taskId     != null && o.task_id     == null) o.task_id     = o.taskId;
      if (o.assigneeId != null && o.assignee_id == null) o.assignee_id = o.assigneeId;
      if (o.assignee   != null && o.assignee_id == null) o.assignee_id = o.assignee;

      const row = {};
      for (const c of columns) if (o[c] !== undefined) row[c] = o[c];
      const leftover = { ...o };
      for (const c of columns) delete leftover[c];
      delete leftover.groupId; delete leftover.taskId; delete leftover.assigneeId;
      row.data = leftover;
      return row;
    }

    function joinRow(table, row) {
      if (!row) return row;
      const out = { ...(row.data || {}), id: row.id };
      if ('group_id'    in row && row.group_id    != null) out.group    = row.group_id;
      if ('status'      in row && row.status      != null) out.status   = row.status;
      if ('assignee_id' in row && row.assignee_id != null) out.assignee = row.assignee_id;
      if ('task_id'     in row && row.task_id     != null) out.taskId   = row.task_id;
      if ('name'        in row && row.name        != null) out.name     = row.name;
      if (row.created_at) out.createdAt    = out.createdAt    || row.created_at;
      if (row.updated_at) out.modifiedDate = out.modifiedDate || row.updated_at;
      return out;
    }

    function crud(table) {
      return {
        async create(obj) {
          const owner = await ownerId();
          if (!owner) throw new Error('Not signed in to Supabase');
          const row = splitRow(table, { id: obj.id || uid(), ...obj });
          row.owner_id = owner;
          const { data, error } = await sb.from(table).insert(row).select().single();
          if (error) throw error;
          const out = joinRow(table, data);
          emit(table.slice(0,-1) + ':created', out);
          emit('data:changed', { entity: table, action: 'create' });
          return out;
        },
        async get(id)     { return this.getById(id); },
        async getById(id) {
          const { data, error } = await sb.from(table).select('*').eq('id', id).maybeSingle();
          if (error) throw error; return joinRow(table, data);
        },
        async getAll() {
          const { data, error } = await sb.from(table).select('*').order('created_at', { ascending: true });
          if (error) throw error; return (data || []).map(r => joinRow(table, r));
        },
        async update(obj) {
          if (!obj || !obj.id) throw new Error('update() needs an id');
          const row = splitRow(table, obj);
          row.updated_at = new Date().toISOString();
          const { data, error } = await sb.from(table).update(row).eq('id', obj.id).select().single();
          if (error) throw error;
          const out = joinRow(table, data);
          emit(table.slice(0,-1) + ':updated', out);
          emit('data:changed', { entity: table, action: 'update' });
          return out;
        },
        async delete(id) {
          const { error } = await sb.from(table).delete().eq('id', id);
          if (error) throw error;
          emit(table.slice(0,-1) + ':deleted', { id });
          emit('data:changed', { entity: table, action: 'delete' });
          return true;
        },
        async count() {
          const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
          if (error) throw error; return count || 0;
        }
      };
    }

    const Tasks = crud('tasks');
    Tasks.getByGroup    = async gid => (await Tasks.getAll()).filter(t => t.group === gid);
    Tasks.getByStatus   = async st  => (await Tasks.getAll()).filter(t => t.status === st);
    Tasks.getByAssignee = async aid => (await Tasks.getAll()).filter(t => t.assignee === aid);
    Tasks.complete      = async id  => Tasks.update({ id, status: 'done', completedAt: new Date().toISOString() });
    Tasks.reopen        = async id  => Tasks.update({ id, status: 'todo', completedAt: null });
    Tasks.addSubtask    = async (id, sub) => {
      const t = await Tasks.getById(id); const subs = Array.isArray(t.subtasks) ? t.subtasks : [];
      subs.push({ id: sub.id || uid(), done: false, ...sub });
      return Tasks.update({ ...t, subtasks: subs });
    };
    Tasks.toggleSubtask = async (id, subId) => {
      const t = await Tasks.getById(id);
      const subs = (t.subtasks || []).map(s => s.id === subId ? { ...s, done: !s.done } : s);
      return Tasks.update({ ...t, subtasks: subs });
    };
    Tasks.search = async q => {
      const all = await Tasks.getAll(); const n = (q || '').toLowerCase();
      return all.filter(t => (t.title||'').toLowerCase().includes(n) || (t.description||'').toLowerCase().includes(n));
    };
    Tasks.getStats = async () => {
      const all = await Tasks.getAll();
      return { total: all.length, done: all.filter(t => t.status === 'done').length, open: all.filter(t => t.status !== 'done').length };
    };

    const Groups       = crud('groups');
    const Tags         = crud('tags');
    const Categories   = crud('categories'); Categories.getByGroup = async gid => (await Categories.getAll()).filter(c => c.group === gid);
    const Members      = crud('members');    Members.getByGroup    = async gid => (await Members.getAll()).filter(m => m.group === gid);
    const CustomFields = crud('customFields');CustomFields.getByGroup = async gid => (await CustomFields.getAll()).filter(f => f.group === gid);

    const Comments = {
      ...crud('comments'),
      getByTask: async tid => {
        const { data, error } = await sb.from('comments').select('*').eq('task_id', tid).order('created_at',{ascending:true});
        if (error) throw error; return (data||[]).map(r=>joinRow('comments', r));
      }
    };

    const Activity = {
      async getAll()        { const {data,error}=await sb.from('activity').select('*').order('created_at',{ascending:false}); if(error)throw error; return (data||[]).map(r=>joinRow('activity',r)); },
      async getByTask(tid)  { const {data,error}=await sb.from('activity').select('*').eq('task_id',tid).order('created_at',{ascending:false}); if(error)throw error; return (data||[]).map(r=>joinRow('activity',r)); },
      async getRecent(n=50) { const {data,error}=await sb.from('activity').select('*').order('created_at',{ascending:false}).limit(n); if(error)throw error; return (data||[]).map(r=>joinRow('activity',r)); },
      async clear()         { const {error}=await sb.from('activity').delete().neq('id',''); if(error)throw error; return true; }
    };

    const Settings = {
      async get(key)   { const {data,error}=await sb.from('settings').select('value').eq('key',key).maybeSingle(); if(error)throw error; return data?data.value:null; },
      async set(key,v) { const owner=await ownerId(); const {error}=await sb.from('settings').upsert({owner_id:owner,key,value:v,updated_at:new Date().toISOString()}); if(error)throw error; return true; },
      async getAll()   { const {data,error}=await sb.from('settings').select('key,value'); if(error)throw error; return Object.fromEntries((data||[]).map(r=>[r.key,r.value])); }
    };

    const ShadowDB = {
      STORES, _sb: sb, on, emit,
      init: async () => {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) { try { await sb.auth.signInAnonymously(); } catch (e) { console.warn('Anon sign-in failed:', e); } }
        return true;
      },
      openDB: async () => true,
      seed: async () => true,
      resetAll: async () => {
        for (const t of ['activity','comments','tasks','customFields','members','categories','tags','groups','settings']) {
          await sb.from(t).delete().neq('id', '');
        }
        emit('data:changed', { entity: 'all', action: 'reset' }); return true;
      },
      exportAll: async () => {
        const out = {};
        for (const t of Object.keys(STORES)) { const { data } = await sb.from(t).select('*'); out[t] = data || []; }
        return out;
      },
      importAll: async (payload) => {
        const owner = await ownerId();
        for (const [t, rows] of Object.entries(payload || {})) {
          if (!rows || !rows.length) continue;
          const stamped = rows.map(r => ({ ...r, owner_id: owner }));
          await sb.from(t).upsert(stamped);
        }
        emit('data:changed', { entity: 'all', action: 'import' }); return true;
      },
      Tasks, Groups, Tags, Categories, Members, CustomFields, Comments, Activity, Settings
    };

    window.ShadowDB = ShadowDB;

    // Make sure a session always exists so RLS works
    if (typeof window.__shadowdbFlush === 'function') window.__shadowdbFlush();
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) sb.auth.signInAnonymously().catch(err => console.warn('Anon sign-in error:', err));
    });

    document.dispatchEvent(new CustomEvent('shadowdb:ready'));
  }
})();
