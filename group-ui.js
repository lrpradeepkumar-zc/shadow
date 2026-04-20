// group-ui.js — adds "Create Group" and "Create task in group" flows.
(function () {
      const ready = () => (window.ShadowDB && window.ShadowDB._sb);
      const getGid = (row) => row.dataset.group || row.dataset.groupId;

   function boot() {
           wireCreateGroupButton();
           decorateGroupRows();
           const list = document.getElementById('groupsList');
           if (list) new MutationObserver(decorateGroupRows).observe(list, { childList: true, subtree: true });
           seedDefaultGroupIfEmpty();
   }
      if (ready()) boot();
      else document.addEventListener('shadowdb:ready', boot, { once: true });

   function wireCreateGroupButton() {
           const btn = document.getElementById('addGroupBtn');
           if (!btn || btn.dataset.wired === '1') return;
           btn.dataset.wired = '1';
           btn.style.cursor = 'pointer';
           btn.addEventListener('click', async (e) => {
                     e.stopPropagation();
                     const name = (prompt('New group name:') || '').trim();
                     if (!name) return;
                     const id = 'g_' + Date.now().toString(36);
                     try {
                                 await ShadowDB.Groups.create({ id, name });
                                 if (window.state) window.state.groups = await ShadowDB.Groups.getAll();
                                 if (typeof window.renderSidebar === 'function') window.renderSidebar();
                                 if (typeof window.updateGroupSelects === 'function') window.updateGroupSelects();
                                 if (typeof window.renderView === 'function') window.renderView();
                     } catch (err) { alert('Could not create group: ' + err.message); }
           });
   }

   function decorateGroupRows() {
           document.querySelectorAll('#groupsList .group-item').forEach(row => {
                     if (row.querySelector('.group-add-task')) return;
                     const gid = getGid(row);
                     if (!gid) return;
                     const add = document.createElement('i');
                     add.className = 'fa-solid fa-plus group-add-task';
                     add.title = 'New task in this group';
                     add.style.cssText = 'margin-left:6px;cursor:pointer;opacity:.7;';
                     add.addEventListener('click', async (e) => {
                                 e.stopPropagation();
                                 const title = (prompt('New task title:') || '').trim();
                                 if (!title) return;
                                 try {
                                               await ShadowDB.Tasks.create({
                                                               id: 't_' + Date.now().toString(36),
                                                               title, group: gid, status: 'todo', priority: 'P3',
                                                               createdAt: new Date().toISOString()
                                               });
                                               if (window.state) window.state.tasks = await ShadowDB.Tasks.getAll();
                                               if (typeof window.renderView === 'function') window.renderView();
                                               if (typeof window.renderSidebar === 'function') window.renderSidebar();
                                 } catch (err) { alert('Could not create task: ' + err.message); }
                     });
                     row.appendChild(add);
           });
   }

   async function seedDefaultGroupIfEmpty() {
           try {
                     const gs = await ShadowDB.Groups.getAll();
                     if (gs.length) return;
                     await ShadowDB.Groups.create({ id: 'personal', name: 'Personal' });
                     if (window.state) window.state.groups = await ShadowDB.Groups.getAll();
                     if (typeof window.renderSidebar === 'function') window.renderSidebar();
                     if (typeof window.updateGroupSelects === 'function') window.updateGroupSelects();
           } catch (_) {}
   }
})();
