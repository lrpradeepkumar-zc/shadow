/**
 * Shadow ToDo - Backend Layer
 * IndexedDB-powered persistent storage with REST-like API
 * Provides full CRUD operations for all entities
 */
const ShadowDB = (function() {
    'use strict';
    const DB_NAME = 'ShadowToDoDB';
    const DB_VERSION = 2;
    let db = null;

    const STORES = {
        tasks: 'tasks',
        groups: 'groups',
        tags: 'tags',
        categories: 'categories',
        members: 'members',
        customFields: 'customFields',
        comments: 'comments',
        activity: 'activity',
        settings: 'settings'
    };

    // ===== DATABASE INITIALIZATION =====
    function openDB() {
        return new Promise((resolve, reject) => {
            if (db) { resolve(db); return; }
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => { db = request.result; resolve(db); };
            request.onupgradeneeded = (e) => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains(STORES.tasks)) {
                    const ts = d.createObjectStore(STORES.tasks, { keyPath: 'id', autoIncrement: true });
                    ts.createIndex('group', 'group', { unique: false });
                    ts.createIndex('status', 'status', { unique: false });
                    ts.createIndex('assignee', 'assignee', { unique: false });
                    ts.createIndex('category', 'category', { unique: false });
                    ts.createIndex('priority', 'priority', { unique: false });
                    ts.createIndex('dueDate', 'dueDate', { unique: false });
                }
                if (!d.objectStoreNames.contains(STORES.groups)) {
                    const gs = d.createObjectStore(STORES.groups, { keyPath: 'id', autoIncrement: true });
                    gs.createIndex('name', 'name', { unique: false });
                }
                if (!d.objectStoreNames.contains(STORES.tags)) {
                    d.createObjectStore(STORES.tags, { keyPath: 'id', autoIncrement: true });
                }
                if (!d.objectStoreNames.contains(STORES.categories)) {
                    const cs = d.createObjectStore(STORES.categories, { keyPath: 'id', autoIncrement: true });
                    cs.createIndex('group', 'group', { unique: false });
                }
                if (!d.objectStoreNames.contains(STORES.members)) {
                    const ms = d.createObjectStore(STORES.members, { keyPath: 'id', autoIncrement: true });
                    ms.createIndex('group', 'group', { unique: false });
                }
                if (!d.objectStoreNames.contains(STORES.customFields)) {
                    const cf = d.createObjectStore(STORES.customFields, { keyPath: 'id', autoIncrement: true });
                    cf.createIndex('group', 'group', { unique: false });
                }
                if (!d.objectStoreNames.contains(STORES.comments)) {
                    const cm = d.createObjectStore(STORES.comments, { keyPath: 'id', autoIncrement: true });
                    cm.createIndex('taskId', 'taskId', { unique: false });
                }
                if (!d.objectStoreNames.contains(STORES.activity)) {
                    const ac = d.createObjectStore(STORES.activity, { keyPath: 'id', autoIncrement: true });
                    ac.createIndex('taskId', 'taskId', { unique: false });
                    ac.createIndex('timestamp', 'timestamp', { unique: false });
                }
                if (!d.objectStoreNames.contains(STORES.settings)) {
                    d.createObjectStore(STORES.settings, { keyPath: 'key' });
                }
            };
        });
    }

    // ===== GENERIC CRUD OPERATIONS =====
    function _tx(storeName, mode) {
        return db.transaction(storeName, mode).objectStore(storeName);
    }

    function create(storeName, data) {
        return new Promise((resolve, reject) => {
            const item = { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            const req = _tx(storeName, 'readwrite').add(item);
            req.onsuccess = () => { item.id = req.result; _logActivity('create', storeName, item); resolve(item); };
            req.onerror = () => reject(req.error);
        });
    }

    function getById(storeName, id) {
        return new Promise((resolve, reject) => {
            const req = _tx(storeName, 'readonly').get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    function getAll(storeName) {
        return new Promise((resolve, reject) => {
            const req = _tx(storeName, 'readonly').getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const store = _tx(storeName, 'readonly');
            const idx = store.index(indexName);
            const req = idx.getAll(value);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function update(storeName, data) {
        return new Promise((resolve, reject) => {
            const item = { ...data, updatedAt: new Date().toISOString() };
            const req = _tx(storeName, 'readwrite').put(item);
            req.onsuccess = () => { _logActivity('update', storeName, item); resolve(item); };
            req.onerror = () => reject(req.error);
        });
    }

    function remove(storeName, id) {
        return new Promise((resolve, reject) => {
            const req = _tx(storeName, 'readwrite').delete(id);
            req.onsuccess = () => { _logActivity('delete', storeName, { id }); resolve(true); };
            req.onerror = () => reject(req.error);
        });
    }

    function clearStore(storeName) {
        return new Promise((resolve, reject) => {
            const req = _tx(storeName, 'readwrite').clear();
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    function count(storeName) {
        return new Promise((resolve, reject) => {
            const req = _tx(storeName, 'readonly').count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    // ===== ACTIVITY LOGGING =====
    function _logActivity(action, entity, data) {
        try {
            const store = _tx(STORES.activity, 'readwrite');
            store.add({
                action: action,
                entity: entity,
                entityId: data.id,
                summary: action + ' ' + entity + (data.title ? ': ' + data.title : (data.name ? ': ' + data.name : '')),
                timestamp: new Date().toISOString(),
                data: JSON.parse(JSON.stringify(data))
            });
        } catch(e) { /* silent */ }
    }

    // ===== TASK-SPECIFIC OPERATIONS =====
    const Tasks = {
        create: (task) => create(STORES.tasks, {
            title: task.title || 'Untitled',
            description: task.description || '',
            notes: task.notes || '',
            status: task.status || 'Open',
            priority: task.priority || 'Medium',
            assignee: task.assignee || 'Me',
            group: task.group || 'personal',
            category: task.category || 'General',
            dueDate: task.dueDate || null,
            startDate: task.startDate || null,
            tags: task.tags || [],
            subtasks: task.subtasks || [],
            recurrence: task.recurrence || null,
            reminder: task.reminder || null,
            customFields: task.customFields || {},
            completedAt: null,
            order: task.order || 0
        }),
        get: (id) => getById(STORES.tasks, id),
        getAll: () => getAll(STORES.tasks),
        getByGroup: (group) => getByIndex(STORES.tasks, 'group', group),
        getByStatus: (status) => getByIndex(STORES.tasks, 'status', status),
        getByAssignee: (assignee) => getByIndex(STORES.tasks, 'assignee', assignee),
        update: (task) => update(STORES.tasks, task),
        delete: (id) => remove(STORES.tasks, id),
        complete: async (id) => {
            const task = await getById(STORES.tasks, id);
            if (task) {
                task.status = 'Completed';
                task.completedAt = new Date().toISOString();
                return update(STORES.tasks, task);
            }
        },
        reopen: async (id) => {
            const task = await getById(STORES.tasks, id);
            if (task) { task.status = 'Open'; task.completedAt = null; return update(STORES.tasks, task); }
        },
        addSubtask: async (taskId, subtask) => {
            const task = await getById(STORES.tasks, taskId);
            if (task) {
                task.subtasks = task.subtasks || [];
                task.subtasks.push({ id: Date.now(), title: subtask.title, completed: false, createdAt: new Date().toISOString() });
                return update(STORES.tasks, task);
            }
        },
        toggleSubtask: async (taskId, subtaskId) => {
            const task = await getById(STORES.tasks, taskId);
            if (task && task.subtasks) {
                const st = task.subtasks.find(s => s.id === subtaskId);
                if (st) { st.completed = !st.completed; return update(STORES.tasks, task); }
            }
        },
        search: async (query) => {
            const all = await getAll(STORES.tasks);
            const q = query.toLowerCase();
            return all.filter(t => (t.title && t.title.toLowerCase().includes(q)) || (t.description && t.description.toLowerCase().includes(q)));
        },
        getStats: async () => {
            const all = await getAll(STORES.tasks);
            const now = new Date();
            return {
                total: all.length,
                open: all.filter(t => t.status === 'Open').length,
                completed: all.filter(t => t.status === 'Completed').length,
                overdue: all.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'Completed').length,
                byPriority: { high: all.filter(t => t.priority === 'High').length, medium: all.filter(t => t.priority === 'Medium').length, low: all.filter(t => t.priority === 'Low').length },
                byStatus: all.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {}),
                byGroup: all.reduce((acc, t) => { acc[t.group] = (acc[t.group] || 0) + 1; return acc; }, {}),
                completionRate: all.length ? Math.round((all.filter(t => t.status === 'Completed').length / all.length) * 100) : 0
            };
        },
        count: () => count(STORES.tasks)
    };

    // ===== GROUP OPERATIONS =====
    const Groups = {
        create: (group) => create(STORES.groups, {
            name: group.name || 'New Group',
            description: group.description || '',
            color: group.color || '#4285f4',
            type: group.type || 'personal',
            streams: group.streams !== undefined ? group.streams : true,
            hidden: false,
            categories: group.categories || ['General'],
            statuses: group.statuses || ['Open', 'In Progress', 'Completed'],
            icon: group.icon || null,
            order: group.order || 0
        }),
        get: (id) => getById(STORES.groups, id),
        getAll: () => getAll(STORES.groups),
        update: (group) => update(STORES.groups, group),
        delete: (id) => remove(STORES.groups, id),
        count: () => count(STORES.groups)
    };

    // ===== TAG OPERATIONS =====
    const Tags = {
        create: (tag) => create(STORES.tags, { name: tag.name, color: tag.color || '#4285f4' }),
        get: (id) => getById(STORES.tags, id),
        getAll: () => getAll(STORES.tags),
        update: (tag) => update(STORES.tags, tag),
        delete: (id) => remove(STORES.tags, id)
    };

    // ===== CATEGORY OPERATIONS =====
    const Categories = {
        create: (cat) => create(STORES.categories, { name: cat.name, color: cat.color || '#4285f4', group: cat.group }),
        getAll: () => getAll(STORES.categories),
        getByGroup: (group) => getByIndex(STORES.categories, 'group', group),
        update: (cat) => update(STORES.categories, cat),
        delete: (id) => remove(STORES.categories, id)
    };

    // ===== MEMBER OPERATIONS =====
    const Members = {
        create: (member) => create(STORES.members, { name: member.name, email: member.email || '', role: member.role || 'Member', group: member.group, avatar: member.avatar || null }),
        getAll: () => getAll(STORES.members),
        getByGroup: (group) => getByIndex(STORES.members, 'group', group),
        update: (member) => update(STORES.members, member),
        delete: (id) => remove(STORES.members, id)
    };

    // ===== CUSTOM FIELD OPERATIONS =====
    const CustomFields = {
        create: (field) => create(STORES.customFields, { name: field.name, type: field.type || 'Text', group: field.group, options: field.options || [], required: field.required || false }),
        getAll: () => getAll(STORES.customFields),
        getByGroup: (group) => getByIndex(STORES.customFields, 'group', group),
        update: (field) => update(STORES.customFields, field),
        delete: (id) => remove(STORES.customFields, id)
    };

    // ===== COMMENT OPERATIONS =====
    const Comments = {
        create: (comment) => create(STORES.comments, { taskId: comment.taskId, text: comment.text, author: comment.author || 'Me' }),
        getByTask: (taskId) => getByIndex(STORES.comments, 'taskId', taskId),
        delete: (id) => remove(STORES.comments, id)
    };

    // ===== ACTIVITY LOG =====
    const Activity = {
        getAll: () => getAll(STORES.activity),
        getByTask: (taskId) => getByIndex(STORES.activity, 'taskId', taskId),
        getRecent: async (limit) => {
            const all = await getAll(STORES.activity);
            return all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit || 50);
        },
        clear: () => clearStore(STORES.activity)
    };

    // ===== SETTINGS =====
    const Settings = {
        get: async (key) => {
            const store = _tx(STORES.settings, 'readonly');
            return new Promise((resolve, reject) => {
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result ? req.result.value : null);
                req.onerror = () => reject(req.error);
            });
        },
        set: async (key, value) => {
            const store = _tx(STORES.settings, 'readwrite');
            return new Promise((resolve, reject) => {
                const req = store.put({ key: key, value: value, updatedAt: new Date().toISOString() });
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error);
            });
        },
        getAll: async () => {
            const all = await getAll(STORES.settings);
            return all.reduce((acc, s) => { acc[s.key] = s.value; return acc; }, {});
        }
    };

    // ===== SEED DATA =====
    async function seed() {
        const taskCount = await Tasks.count();
        if (taskCount > 0) return false;

        // Seed groups
        const g1 = await Groups.create({ name: 'Personal tasks', color: '#4285f4', type: 'personal', categories: ['General', 'My tasks', 'Calendar'] });
        const g2 = await Groups.create({ name: 'Development', color: '#0f9d58', type: 'org-email', categories: ['General', 'Frontend', 'Backend', 'DevOps'] });
        const g3 = await Groups.create({ name: 'Design Team', color: '#f4b400', type: 'personal', categories: ['General', 'UI', 'UX'] });

        // Seed tags
        await Tags.create({ name: 'P1 Items', color: '#e67e22' });
        await Tags.create({ name: 'General Notes', color: '#e67e22' });
        await Tags.create({ name: 'Bug Fix', color: '#e74c3c' });
        await Tags.create({ name: 'Feature', color: '#3498db' });
        await Tags.create({ name: 'Enhancement', color: '#2ecc71' });
        await Tags.create({ name: 'Task Notes', color: '#2ecc71' });
        await Tags.create({ name: 'Urgent', color: '#9b59b6' });

        // Seed members
        await Members.create({ name: 'Pradeep Kumar', email: 'pradeep@example.com', role: 'Owner', group: g1.id });
        await Members.create({ name: 'Alex Johnson', email: 'alex@example.com', role: 'Moderator', group: g2.id });
        await Members.create({ name: 'Sarah Chen', email: 'sarah@example.com', role: 'Member', group: g2.id });
        await Members.create({ name: 'Rachel Kim', email: 'rachel@example.com', role: 'Moderator', group: g3.id });

        // Seed tasks
        const today = new Date();
        const pastDate = (d) => { const dt = new Date(today); dt.setDate(dt.getDate() - d); return dt.toISOString().split('T')[0]; };
        const futureDate = (d) => { const dt = new Date(today); dt.setDate(dt.getDate() + d); return dt.toISOString().split('T')[0]; };

        await Tasks.create({ title: 'Overdue task - review PR', status: 'Open', priority: 'High', group: g2.id, category: 'Frontend', assignee: 'Pradeep', dueDate: pastDate(5), tags: ['P1 Items'] });
        await Tasks.create({ title: 'Setup CI/CD pipeline', status: 'Open', priority: 'High', group: g2.id, category: 'DevOps', assignee: 'Alex', dueDate: pastDate(2), tags: ['Feature'] });
        await Tasks.create({ title: 'Design new landing page', status: 'In Progress', priority: 'Medium', group: g3.id, category: 'UI', assignee: 'Rachel', dueDate: futureDate(3), description: 'Create mockups for the new landing page redesign' });
        await Tasks.create({ title: 'Write API documentation', status: 'Open', priority: 'Medium', group: g2.id, category: 'Backend', assignee: 'Sarah', dueDate: futureDate(7), tags: ['General Notes'] });
        await Tasks.create({ title: 'Fix login bug', status: 'Open', priority: 'High', group: g2.id, category: 'Frontend', assignee: 'Pradeep', dueDate: today.toISOString().split('T')[0], tags: ['Bug Fix', 'P1 Items'], subtasks: [{ id: 1, title: 'Reproduce the bug', completed: true }, { id: 2, title: 'Write fix', completed: false }, { id: 3, title: 'Add tests', completed: false }] });
        await Tasks.create({ title: 'Meeting noted at 5PM tomorrow', status: 'Open', priority: 'Low', group: g1.id, category: 'General', assignee: 'Pradeep', dueDate: futureDate(30), subtasks: [{ id: 4, title: 'Prepare agenda', completed: false }] });
        await Tasks.create({ title: 'Update user profile component', status: 'Completed', priority: 'Medium', group: g2.id, category: 'Frontend', assignee: 'Sarah', dueDate: pastDate(1), completedAt: pastDate(1) });
        await Tasks.create({ title: 'Code review - auth module', status: 'Open', priority: 'Medium', group: g2.id, category: 'Backend', assignee: 'Alex', dueDate: futureDate(2) });
        await Tasks.create({ title: 'Personal grocery list', status: 'Open', priority: 'Low', group: g1.id, category: 'My tasks', assignee: 'Pradeep', dueDate: futureDate(1) });
        await Tasks.create({ title: 'UX research survey', status: 'Open', priority: 'Medium', group: g3.id, category: 'UX', assignee: 'Rachel', dueDate: futureDate(14), tags: ['Enhancement'] });

        // Seed settings
        await Settings.set('theme', 'dark');
        await Settings.set('themeColor', 'cobalt');
        await Settings.set('leftPanel', 'dark');
        await Settings.set('appearance', 'night');
        await Settings.set('startupView', 'agenda');
        await Settings.set('fontFamily', 'Lato');
        await Settings.set('fontSize', 'browser');
        await Settings.set('keyboardShortcuts', true);

        return true;
    }

    // ===== EXPORT / IMPORT =====
    async function exportAll() {
        const data = {};
        for (const key of Object.keys(STORES)) {
            data[key] = await getAll(STORES[key]);
        }
        return data;
    }

    async function importAll(data) {
        for (const key of Object.keys(STORES)) {
            if (data[key]) {
                await clearStore(STORES[key]);
                const store = _tx(STORES[key], 'readwrite');
                for (const item of data[key]) {
                    store.add(item);
                }
            }
        }
        return true;
    }

    async function resetAll() {
        for (const key of Object.keys(STORES)) {
            await clearStore(STORES[key]);
        }
        return seed();
    }

    // ===== EVENT BUS (for real-time updates) =====
    const _listeners = {};
    function on(event, callback) {
        if (!_listeners[event]) _listeners[event] = [];
        _listeners[event].push(callback);
        return () => { _listeners[event] = _listeners[event].filter(cb => cb !== callback); };
    }
    function emit(event, data) {
        if (_listeners[event]) _listeners[event].forEach(cb => cb(data));
    }

    // Wrap CRUD to emit events
    const _origTaskCreate = Tasks.create;
    Tasks.create = async (task) => { const r = await _origTaskCreate(task); emit('task:created', r); emit('data:changed', { entity: 'tasks', action: 'create' }); return r; };
    const _origTaskUpdate = Tasks.update;
    Tasks.update = async (task) => { const r = await _origTaskUpdate(task); emit('task:updated', r); emit('data:changed', { entity: 'tasks', action: 'update' }); return r; };
    const _origTaskDelete = Tasks.delete;
    Tasks.delete = async (id) => { const r = await _origTaskDelete(id); emit('task:deleted', { id }); emit('data:changed', { entity: 'tasks', action: 'delete' }); return r; };

    // ===== INIT =====
    async function init() {
        await openDB();
        await seed();
        emit('db:ready', true);
        return true;
    }

    return {
        init, openDB, seed, resetAll, exportAll, importAll,
        Tasks, Groups, Tags, Categories, Members, CustomFields, Comments, Activity, Settings,
        on, emit, STORES,
        _raw: { create, getById, getAll, getByIndex, update, remove, clearStore, count }
    };
})();

// Auto-initialize if loaded
if (typeof window !== 'undefined') {
    window.ShadowDB = ShadowDB;
}
