/**
 * backend.js v2 — Local-first ShadowDB
 * ---------------------------------------------------------------------------
 * Architecture:
 *   1. Every CRUD write goes to IndexedDB FIRST → emit db:local_update
 *   2. Supabase mutation fires in the background
 *   3. On Supabase resolve → reconcile IDB → emit db:sync_complete
 *   4. getAll() / getById() read from IDB (fast) and trigger a background
 *      Supabase refresh to keep the cache warm.
 *
 * window.Store — lightweight state manager
 *   Store.set(key, val)   writes to window.state + emits state:changed
 *   Store.get(key)        reads window.state[key]
 *
 * ShadowLinks — shareable deep-link generator
 *   ShadowLinks.task(id)            → #/task/{id}
 *   ShadowLinks.subtask(tid, sid)   → #/task/{tid}/subtask/{sid}
 *   ShadowLinks.group(gid)          → #/group/{gid}
 *   ShadowLinks.resolve()           → parses current hash, emits link:navigate
 * ---------------------------------------------------------------------------
 */

// ── Early stub so app.js never sees "ShadowDB is not defined" ───────────────
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
    STORES:{tasks:'tasks',groups:'groups',tags:'tags',categories:'categories',members:'members',
            customFields:'customFields',comments:'comments',activity:'activity',settings:'settings'},
    on:()=>{}, emit:()=>{},
    init: async () => { await window.__shadowdbReady(); return window.ShadowDB.init(); },
    openDB: async () => { await window.__shadowdbReady(); return true; },
    Tasks:ns('Tasks'), Groups:ns('Groups'), Tags:ns('Tags'), Categories:ns('Categories'),
    Members:ns('Members'), CustomFields:ns('CustomFields'), Comments:ns('Comments'),
    Activity:ns('Activity'), Settings:ns('Settings')
  };
})();

// ── Main backend IIFE ────────────────────────────────────────────────────────
(function () {
  const SUPABASE_URL  = 'https://ycysvoolkezntbxcfrnq.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljeXN2b29sa2V6bnRieGNmcm5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzY5MjksImV4cCI6MjA5MjAxMjkyOX0.Y0OFF8Bdc3iSp_Bm9G7Io3Szy0amnHVuO3k8nspqxCk';
  const IDB_NAME    = 'shadow_local_v2';
  const IDB_VERSION = 1;

  const STORES = {
    tasks:'tasks', groups:'groups', tags:'tags', categories:'categories',
    members:'members', customFields:'customFields', comments:'comments',
    activity:'activity', settings:'settings'
  };

  // ── Event bus ─────────────────────────────────────────────────────────────
  const listeners = {};
  const on   = (evt, fn) => (listeners[evt] = listeners[evt] || []).push(fn);
  const emit = (evt, payload) => (listeners[evt] || []).forEach(fn => { try { fn(payload); } catch(_){} });
  const uid  = () => crypto.randomUUID ? crypto.randomUUID() : 'id_'+Date.now()+'_'+Math.random().toString(36).slice(2);

  // ── window.Store ─────────────────────────────────────────────────────────
  window.Store = {
    set: function (key, val) {
      if (window.state) window.state[key] = val;
      emit('state:changed', { key: key, val: val });
      // Also dispatch as a CustomEvent for modules that don't use ShadowDB.on()
      try { window.dispatchEvent(new CustomEvent('state:changed', { detail: { key: key, val: val } })); } catch(_) {}
    },
    get: function (key) { return window.state ? window.state[key] : undefined; }
  };

  // ── IndexedDB layer ───────────────────────────────────────────────────────
  let _idb = null;

  function openIDB() {
    if (_idb) return Promise.resolve(_idb);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        Object.values(STORES).forEach(name => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'id' });
          }
        });
        // settings uses key as id
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      req.onsuccess = e => { _idb = e.target.result; resolve(_idb); };
      req.onerror   = e => { console.warn('[IDB] open failed:', e.target.error); resolve(null); };
    });
  }

  function idbGet(store, id) {
    return openIDB().then(db => {
      if (!db) return null;
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => resolve(null);
      });
    });
  }

  function idbGetAll(store) {
    return openIDB().then(db => {
      if (!db) return [];
      return new Promise(resolve => {
        const tx  = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => resolve([]);
      });
    });
  }

  function idbPut(store, obj) {
    return openIDB().then(db => {
      if (!db) return obj;
      return new Promise(resolve => {
        const tx  = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(obj);
        tx.oncomplete = () => resolve(obj);
        tx.onerror    = () => resolve(obj);
      });
    });
  }

  function idbDelete(store, id) {
    return openIDB().then(db => {
      if (!db) return;
      return new Promise(resolve => {
        const tx  = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror    = () => resolve();
      });
    });
  }

  function idbClear(store) {
    return openIDB().then(db => {
      if (!db) return;
      return new Promise(resolve => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).clear();
        tx.oncomplete = () => resolve();
        tx.onerror    = () => resolve();
      });
    });
  }

  // ── Supabase client ───────────────────────────────────────────────────────
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  s.onload = boot;
  document.head.appendChild(s);

  // ── Row mapping helpers ───────────────────────────────────────────────────
  function splitRow(table, obj) {
    const o = { ...obj };
    const columns = {
      tasks:        ['id','group_id','status','assignee_id','owner_id'],
      groups:       ['id','name','owner_id'],
      tags:         ['id','group_id'],
      categories:   ['id','group_id'],
      members:      ['id','group_id','user_id'],
      customFields: ['id','group_id'],
      comments:     ['id','task_id','author_id'],
      activity:     ['id','task_id','actor_id'],
    }[table] || ['id'];

    // camelCase → snake_case aliases
    if (o.groupId    != null && o.group_id    == null) o.group_id    = o.groupId;
    if (o.group      != null && o.group_id    == null) o.group_id    = o.group;
    if (o.taskId     != null && o.task_id     == null) o.task_id     = o.taskId;
    if (o.assigneeId != null && o.assignee_id == null) o.assignee_id = o.assigneeId;
    if (o.assignee   != null && o.assignee_id == null) o.assignee_id = o.assignee;
    if (o.authorId   != null && o.author_id   == null) o.author_id   = o.authorId;
    if (o.actorId    != null && o.actor_id    == null) o.actor_id    = o.actorId;
    if (o.userId     != null && o.user_id     == null) o.user_id     = o.userId;
    if (o.createdBy  != null && o.owner_id    == null && table === 'tasks') o.owner_id = o.createdBy;

    const row = {};
    for (const c of columns) if (o[c] !== undefined) row[c] = o[c];
    const leftover = { ...o };
    for (const c of columns) delete leftover[c];
    // Clean up alias keys from the JSONB blob
    ['groupId','taskId','assigneeId','authorId','actorId','userId'].forEach(k => delete leftover[k]);
    row.data = leftover;
    return row;
  }

  function joinRow(table, row) {
    if (!row) return row;
    const out = { ...(row.data || {}), id: row.id };
    if (row.group_id    != null) out.group      = row.group_id;
    if (row.status      != null) out.status      = row.status;
    if (row.assignee_id != null) out.assignee    = row.assignee_id;
    if (row.task_id     != null) out.taskId      = row.task_id;
    if (row.author_id   != null) out.authorId    = row.author_id;
    if (row.actor_id    != null) out.actorId     = row.actor_id;
    if (row.user_id     != null) out.userId      = row.user_id;
    if (row.owner_id    != null) out.createdBy   = out.createdBy || row.owner_id;
    if (row.name        != null) out.name        = row.name;
    if (row.created_at)          out.createdAt   = out.createdAt   || row.created_at;
    if (row.updated_at)          out.modifiedDate = out.modifiedDate || row.updated_at;
    return out;
  }

  // ── Local-first CRUD factory ──────────────────────────────────────────────
  function crud(table) {
    const eventPrefix = table.replace(/s$/, ''); // 'tasks' → 'task'

    return {
      // ── create ────────────────────────────────────────────────────────────
      async create(obj) {
        const now   = new Date().toISOString();
        const newId = obj.id || uid();
        const local = { ...obj, id: newId, createdAt: obj.createdAt || now, modifiedDate: now };

        // Auto-assign creator from Supabase session
        if (!local.createdBy && table === 'tasks') {
          try {
            const { data } = await _sb.auth.getUser();
            if (data && data.user) local.createdBy = data.user.id;
          } catch(_) {}
        }

        // Auto-generate shareToken for tasks (stable shareable ID)
        if (table === 'tasks' && !local.shareToken) local.shareToken = uid();

        // 1. Write to IDB immediately
        await idbPut(table, local);
        emit('db:local_update', { entity: table, action: 'create', data: local });
        emit(eventPrefix + ':created', local);
        emit('data:changed', { entity: table, action: 'create' });

        // 2. Push to Supabase in background
        (async () => {
          try {
            const ownerId = await _getOwnerId();
            if (!ownerId) return;
            const row = splitRow(table, local);
            row.owner_id   = row.owner_id || ownerId;
            row.created_at = now;
            row.updated_at = now;
            const { data, error } = await _sb.from(table).insert(row).select().single();
            if (error) { emit('db:sync_error', { entity: table, action: 'create', error: error.message }); return; }
            const synced = joinRow(table, data);
            await idbPut(table, synced); // reconcile with server data
            emit('db:sync_complete', { entity: table, action: 'create', data: synced });
          } catch(e) { emit('db:sync_error', { entity: table, action: 'create', error: e.message }); }
        })();

        return local;
      },

      // ── getById ───────────────────────────────────────────────────────────
      async get(id)     { return this.getById(id); },
      async getById(id) {
        // IDB first
        const cached = await idbGet(table, id);
        if (cached) {
          // Background refresh
          _sbFetchById(table, id).then(async fresh => {
            if (fresh) { await idbPut(table, fresh); }
          }).catch(()=>{});
          return cached;
        }
        return _sbFetchById(table, id);
      },

      // ── getAll ────────────────────────────────────────────────────────────
      async getAll() {
        const cached = await idbGetAll(table);
        if (cached.length) {
          // Hot cache: return immediately, refresh IDB in background
          _sbFetchAll(table).then(async rows => {
            if (!rows || !rows.length) return;
            await Promise.all(rows.map(r => idbPut(table, r)));
            emit('db:sync_complete', { entity: table, action: 'getAll' });
          }).catch(()=>{});
          return cached;
        }
        // Cold cache: single fetch — no duplicate concurrent request
        const rows = await _sbFetchAll(table).catch(() => []);
        if (rows && rows.length) {
          await Promise.all(rows.map(r => idbPut(table, r)));
          emit('db:sync_complete', { entity: table, action: 'getAll' });
        }
        return rows || [];
      },

      // ── update ────────────────────────────────────────────────────────────
      async update(obj) {
        if (!obj || !obj.id) throw new Error('update() needs an id');
        const now   = new Date().toISOString();
        const prev  = await idbGet(table, obj.id) || {};
        const local = { ...prev, ...obj, modifiedDate: now };

        await idbPut(table, local);
        emit('db:local_update', { entity: table, action: 'update', data: local });
        emit(eventPrefix + ':updated', local);
        emit('data:changed', { entity: table, action: 'update' });

        (async () => {
          try {
            const row = splitRow(table, obj);
            row.updated_at = now;
            const { data, error } = await _sb.from(table).update(row).eq('id', obj.id).select().single();
            if (error) { emit('db:sync_error', { entity: table, action: 'update', error: error.message }); return; }
            const synced = joinRow(table, data);
            await idbPut(table, synced);
            emit('db:sync_complete', { entity: table, action: 'update', data: synced });
          } catch(e) { emit('db:sync_error', { entity: table, action: 'update', error: e.message }); }
        })();

        return local;
      },

      // ── delete ────────────────────────────────────────────────────────────
      async delete(id) {
        await idbDelete(table, id);
        emit('db:local_update', { entity: table, action: 'delete', data: { id } });
        emit(eventPrefix + ':deleted', { id });
        emit('data:changed', { entity: table, action: 'delete' });

        (async () => {
          try {
            const { error } = await _sb.from(table).delete().eq('id', id);
            if (error) { emit('db:sync_error', { entity: table, action: 'delete', error: error.message }); return; }
            emit('db:sync_complete', { entity: table, action: 'delete', data: { id } });
          } catch(e) { emit('db:sync_error', { entity: table, action: 'delete', error: e.message }); }
        })();

        return true;
      },

      async count() {
        const all = await idbGetAll(table);
        if (all.length) return all.length;
        const { count, error } = await _sb.from(table).select('*', { count: 'exact', head: true });
        return error ? 0 : (count || 0);
      }
    };
  }

  // ── Supabase fetch helpers (background) ───────────────────────────────────
  let _sb; // set in boot()

  async function _getOwnerId() {
    try { const { data } = await _sb.auth.getUser(); return data?.user?.id || null; }
    catch(_) { return null; }
  }

  async function _sbFetchById(table, id) {
    try {
      const { data, error } = await _sb.from(table).select('*').eq('id', id).maybeSingle();
      if (error || !data) return null;
      return joinRow(table, data);
    } catch(_) { return null; }
  }

  async function _sbFetchAll(table) {
    try {
      const { data, error } = await _sb.from(table).select('*').order('created_at', { ascending: true });
      if (error) return null;
      return (data || []).map(r => joinRow(table, r));
    } catch(_) { return null; }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  async function boot() {
    _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    // Pre-open IDB so first reads are instant
    await openIDB();

    // ── Task-specific methods ─────────────────────────────────────────────
    const Tasks = crud('tasks');
    Tasks.getByGroup    = async gid => (await Tasks.getAll()).filter(t => t.group === gid);
    Tasks.getByStatus   = async st  => (await Tasks.getAll()).filter(t => t.status === st);
    Tasks.getByAssignee = async aid => (await Tasks.getAll()).filter(t => t.assignee === aid);
    Tasks.complete      = async id  => Tasks.update({ id, status: 'done', completedAt: new Date().toISOString() });
    Tasks.reopen        = async id  => Tasks.update({ id, status: 'todo', completedAt: null });

    Tasks.addSubtask = async (id, sub) => {
      const t    = await Tasks.getById(id);
      const subs = Array.isArray(t.subtasks) ? t.subtasks : [];
      // Each subtask gets a stable UUID for deep linking
      subs.push({ id: sub.id || uid(), done: false, createdAt: new Date().toISOString(), ...sub });
      return Tasks.update({ ...t, subtasks: subs });
    };

    Tasks.toggleSubtask = async (id, subId) => {
      const t    = await Tasks.getById(id);
      const subs = (t.subtasks || []).map(s => s.id === subId ? { ...s, done: !s.done, updatedAt: new Date().toISOString() } : s);
      return Tasks.update({ ...t, subtasks: subs });
    };

    Tasks.search = async q => {
      const all = await Tasks.getAll();
      const n   = (q || '').toLowerCase();
      return all.filter(t => (t.title||'').toLowerCase().includes(n) || (t.description||'').toLowerCase().includes(n));
    };

    Tasks.getStats = async () => {
      const all = await Tasks.getAll();
      return { total: all.length, done: all.filter(t => t.status === 'done').length, open: all.filter(t => t.status !== 'done').length };
    };

    // Share by token (for link-based access without knowing the UUID)
    Tasks.getByShareToken = async token => {
      const all = await Tasks.getAll();
      return all.find(t => t.shareToken === token) || null;
    };

    // ── Group / member methods ────────────────────────────────────────────
    const Groups       = crud('groups');
    const Tags         = crud('tags');
    const Categories   = crud('categories');
    Categories.getByGroup = async gid => (await Categories.getAll()).filter(c => c.group === gid);

    const Members = crud('members');
    Members.getByGroup = async gid => (await Members.getAll()).filter(m => m.group === gid);
    // Assign a workspace-level role to a user (stored in users table)
    Members.assignRole = async (userId, groupId, role) => {
      const existing = (await Members.getAll()).find(m => m.userId === userId && m.group === groupId);
      if (existing) return Members.update({ ...existing, role });
      return Members.create({ userId, group: groupId, role });
    };

    const CustomFields = crud('customFields');
    CustomFields.getByGroup = async gid => (await CustomFields.getAll()).filter(f => f.group === gid);

    // ── Comments ──────────────────────────────────────────────────────────
    const CommentsBase = crud('comments');
    const Comments = {
      ...CommentsBase,
      getByTask: async tid => {
        const cached = (await idbGetAll('comments')).filter(c => c.taskId === tid);
        if (cached.length) return cached;
        try {
          const { data, error } = await _sb.from('comments').select('*').eq('task_id', tid).order('created_at',{ascending:true});
          if (error) return [];
          const rows = (data||[]).map(r=>joinRow('comments',r));
          await Promise.all(rows.map(r => idbPut('comments', r)));
          return rows;
        } catch(_) { return []; }
      }
    };

    // ── Activity ──────────────────────────────────────────────────────────
    const Activity = {
      async getAll() {
        const cached = await idbGetAll('activity');
        if (cached.length) return cached.sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
        const { data, error } = await _sb.from('activity').select('*').order('created_at',{ascending:false});
        if (error) return [];
        const rows = (data||[]).map(r=>joinRow('activity',r));
        await Promise.all(rows.map(r => idbPut('activity', r)));
        return rows;
      },
      async getByTask(tid) {
        const cached = (await idbGetAll('activity')).filter(a => a.taskId === tid);
        if (cached.length) return cached.sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
        const { data, error } = await _sb.from('activity').select('*').eq('task_id',tid).order('created_at',{ascending:false});
        if (error) return [];
        return (data||[]).map(r=>joinRow('activity',r));
      },
      async getRecent(n=50) {
        const all = await this.getAll();
        return all.slice(0, n);
      },
      async create(obj) {
        const now   = new Date().toISOString();
        const local = { id: uid(), ...obj, createdAt: now };
        // Activity is write-once; skip IDB for brevity, push directly
        try {
          const ownerId = await _getOwnerId();
          const row = splitRow('activity', local);
          row.owner_id   = row.owner_id || ownerId;
          row.created_at = now;
          await _sb.from('activity').insert(row);
        } catch(_) {}
        await idbPut('activity', local);
        return local;
      },
      async clear() {
        await idbClear('activity');
        try { await _sb.from('activity').delete().neq('id',''); } catch(_) {}
        return true;
      }
    };

    // ── Settings ──────────────────────────────────────────────────────────
    const Settings = {
      async get(key) {
        const cached = await idbGet('settings', key);
        if (cached) return cached.value;
        try {
          const { data, error } = await _sb.from('settings').select('value').eq('key',key).maybeSingle();
          if (error || !data) return null;
          await idbPut('settings', { key, value: data.value });
          return data.value;
        } catch(_) { return null; }
      },
      async set(key, v) {
        await idbPut('settings', { key, value: v });
        emit('db:local_update', { entity: 'settings', action: 'set', data: { key, value: v } });
        (async () => {
          try {
            const ownerId = await _getOwnerId();
            await _sb.from('settings').upsert({ owner_id: ownerId, key, value: v, updated_at: new Date().toISOString() });
            emit('db:sync_complete', { entity: 'settings', action: 'set', data: { key } });
          } catch(e) { emit('db:sync_error', { entity: 'settings', action: 'set', error: e.message }); }
        })();
        return true;
      },
      async getAll() {
        const cached = await idbGetAll('settings');
        if (cached.length) return Object.fromEntries(cached.map(r => [r.key, r.value]));
        try {
          const { data, error } = await _sb.from('settings').select('key,value');
          if (error) return {};
          const obj = Object.fromEntries((data||[]).map(r => [r.key, r.value]));
          await Promise.all(Object.entries(obj).map(([k,v]) => idbPut('settings', { key: k, value: v })));
          return obj;
        } catch(_) { return {}; }
      }
    };

    // ── Bulk operations ───────────────────────────────────────────────────
    const _allTables = ['activity','comments','tasks','customFields','members','categories','tags','groups','settings'];

    const ShadowDB = {
      STORES, _sb: _sb, on, emit,

      init: async () => {
        const { data: { session } } = await _sb.auth.getSession();
        return !!session;
      },
      openDB: async () => true,
      seed:   async () => true,

      resetAll: async () => {
        await Promise.all(_allTables.map(t => idbClear(t)));
        for (const t of _allTables) {
          try { await _sb.from(t).delete().neq('id', ''); } catch(_) {}
        }
        emit('data:changed', { entity: 'all', action: 'reset' });
        return true;
      },

      exportAll: async () => {
        const out = {};
        for (const t of Object.keys(STORES)) {
          const { data } = await _sb.from(t).select('*').catch(()=>({data:[]}));
          out[t] = data || [];
        }
        return out;
      },

      importAll: async (payload) => {
        const ownerId = await _getOwnerId();
        for (const [t, rows] of Object.entries(payload || {})) {
          if (!rows || !rows.length) continue;
          const stamped = rows.map(r => ({ ...r, owner_id: ownerId }));
          await _sb.from(t).upsert(stamped).catch(()=>{});
          await Promise.all(stamped.map(r => idbPut(t, joinRow(t, r))));
        }
        emit('data:changed', { entity: 'all', action: 'import' });
        return true;
      },

      Tasks, Groups, Tags, Categories, Members, CustomFields, Comments, Activity, Settings
    };

    window.ShadowDB = ShadowDB;
    if (typeof window.__shadowdbFlush === 'function') window.__shadowdbFlush();
    document.dispatchEvent(new CustomEvent('shadowdb:ready'));

    // ── Supabase Realtime (invalidate IDB on remote changes) ──────────────
    _allTables.slice(0, 6).forEach(table => {
      try {
        _sb.channel('shadow:' + table)
          .on('postgres_changes', { event: '*', schema: 'public', table }, async payload => {
            if (payload.eventType === 'DELETE') {
              await idbDelete(table, payload.old.id);
            } else if (payload.new && payload.new.id) {
              await idbPut(table, joinRow(table, payload.new));
            }
            emit('data:changed', { entity: table, action: payload.eventType.toLowerCase(), realtime: true });
          })
          .subscribe();
      } catch(_) {}
    });
  }

  // ── ShadowLinks — shareable deep links ───────────────────────────────────
  window.ShadowLinks = {
    task: function (id) {
      return window.location.origin + window.location.pathname + '#/task/' + id;
    },
    subtask: function (taskId, subtaskId) {
      return window.location.origin + window.location.pathname + '#/task/' + taskId + '/subtask/' + subtaskId;
    },
    group: function (groupId) {
      return window.location.origin + window.location.pathname + '#/group/' + groupId;
    },

    /**
     * Copy a link to the clipboard and optionally show a toast.
     */
    copy: function (url) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          try { window.dispatchEvent(new CustomEvent('shadow:link_copied', { detail: { url: url } })); } catch(_) {}
        });
      }
    },

    /**
     * Parse the current URL hash and dispatch a navigation event so the
     * app can open the correct task / group.
     * Call once on page load after the app is ready.
     */
    resolve: function () {
      var hash = window.location.hash.replace(/^#\/?/, '');
      if (!hash) return;
      var taskMatch = hash.match(/^task\/([^/]+)(?:\/subtask\/([^/]+))?$/);
      if (taskMatch) {
        window.dispatchEvent(new CustomEvent('link:navigate', {
          detail: { type: 'task', taskId: taskMatch[1], subtaskId: taskMatch[2] || null }
        }));
        return;
      }
      var groupMatch = hash.match(/^group\/([^/]+)$/);
      if (groupMatch) {
        window.dispatchEvent(new CustomEvent('link:navigate', {
          detail: { type: 'group', groupId: groupMatch[1] }
        }));
      }
    }
  };

  // Resolve any deep link after the app is ready
  window.addEventListener('shadow_app_ready', function () {
    setTimeout(function () { window.ShadowLinks && window.ShadowLinks.resolve(); }, 300);
  });

  console.log('[ShadowDB v2] Local-first backend loading…');
})();
