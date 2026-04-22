// group-ui.js - create group + group-task flows.
(function () {
        const ready = () => (window.ShadowDB && window.ShadowDB._sb);
        const getGid = (row) => row.dataset.group || row.dataset.groupId;

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
                                                                         title: title, group: gid, status: 'todo', priority: 'P3',
                                                                         createdAt: new Date().toISOString()
                                                       });
                                                       if (window.state) window.state.tasks = await ShadowDB.Tasks.getAll();
                                                       if (typeof window.renderView === 'function') window.renderView();
                                                       if (typeof window.renderSidebar === 'function') window.renderSidebar();
                                       } catch (err) { alert('Could not create task: ' + err.message); }
                         });
                         row.appendChild(add);
    
          // --- Settings gear: opens the Group Settings modal (Workflows tab) ---
          if (!row.querySelector(".group-settings-gear")) {
            const gear = document.createElement("i");
            gear.className = "fa-solid fa-gear group-settings-gear";
            gear.title = "Group settings (Workflows & Rules)";
            gear.style.cssText = "margin-left:6px;cursor:pointer;opacity:.6;";
            gear.addEventListener("mouseenter", () => gear.style.opacity = "1");
            gear.addEventListener("mouseleave", () => gear.style.opacity = ".6");
            gear.addEventListener("click", (ev) => {
              ev.stopPropagation();
              if (typeof window.openGroupSettings === "function") {
                window.openGroupSettings(gid, "workflows");
              } else {
                // Fallback: go straight to the workflow page scoped by query param
                window.location.href = "workflow.html?groupId=" + encodeURIComponent(gid);
              }
            });
            row.appendChild(gear);
          }
             });
   }

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
                                       await ShadowDB.Groups.create({ id: id, name: name });
                                       if (window.state) window.state.groups = await ShadowDB.Groups.getAll();
                                       if (typeof window.renderSidebar === 'function') window.renderSidebar();
                                       if (typeof window.updateGroupSelects === 'function') window.updateGroupSelects();
                                       if (typeof window.renderView === 'function') window.renderView();
                         } catch (err) { alert('Could not create group: ' + err.message); }
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

   function boot() {
             wireCreateGroupButton();
             seedDefaultGroupIfEmpty();
             setInterval(decorateGroupRows, 500);
   }
        if (ready()) boot();
        else document.addEventListener('shadowdb:ready', boot, { once: true });


  // ---------------------------------------------------------------------------
  // Group Settings modal — opens a lightweight modal with tabs. Currently wires
  // the "Workflows & Rules" tab: lists rules mapped to the group (via
  // WorkflowEngine.getRulesByGroup) and offers a "+ New Rule" button that
  // launches the builder pre-bound to this group.
  //
  // Exposed as window.openGroupSettings(groupId, initialTab).
  // ---------------------------------------------------------------------------
  function openGroupSettings(groupId, initialTab) {
    initialTab = initialTab || "workflows";
    // Reuse an existing modal if already in DOM
    var overlay = document.getElementById("grpSettingsOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "grpSettingsOverlay";
      overlay.className = "modal-overlay grp-settings-modal";
      overlay.style.cssText = "display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9998;";
      overlay.innerHTML =
        '<div class="modal-content" style="width:560px;max-width:92vw;max-height:82vh;display:flex;flex-direction:column;">' +
          '<div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;">' +
            '<h3 id="grpSettingsTitle" style="margin:0;">Group settings</h3>' +
            '<button class="icon-btn" id="grpSettingsClose" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
          '</div>' +
          '<div class="grp-settings-tabs" style="display:flex;gap:4px;border-bottom:1px solid var(--border-color,#e5e7eb);padding:8px 12px 0;">' +
            '<button class="tab-btn active" data-tab="workflows"><i class="fa-solid fa-bolt"></i> Workflows &amp; Rules</button>' +
            '<button class="tab-btn" data-tab="general"><i class="fa-solid fa-gear"></i> General</button>' +
                '<button class="tab-btn" data-tab="members"><i class="fa-solid fa-users"></i> Members</button>' +
                '<button class="tab-btn" data-tab="preferences"><i class="fa-solid fa-sliders"></i> Preferences</button>' +
          '</div>' +
          '<div class="grp-settings-body" id="grpSettingsBody" style="padding:14px;overflow:auto;"></div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeGroupSettings();
      });
      overlay.querySelector("#grpSettingsClose").addEventListener("click", closeGroupSettings);
      overlay.querySelectorAll(".tab-btn").forEach(function (b) {
        b.addEventListener("click", function () {
          overlay.querySelectorAll(".tab-btn").forEach(function (x) { x.classList.remove("active"); });
          b.classList.add("active");
          renderTab(groupId, b.getAttribute("data-tab"));
        });
      });
    }
    // Update title
    var group = findGroup(groupId);
    var title = overlay.querySelector("#grpSettingsTitle");
    if (title) title.textContent = (group ? group.name : "Group") + " — settings";
    // Activate the requested tab
    var tabBtn = overlay.querySelector('.tab-btn[data-tab="' + initialTab + '"]');
    overlay.querySelectorAll(".tab-btn").forEach(function (x) { x.classList.remove("active"); });
    if (tabBtn) tabBtn.classList.add("active");
    renderTab(groupId, initialTab);
    overlay.style.display = "flex";
  }

  function closeGroupSettings() {
    var overlay = document.getElementById("grpSettingsOverlay");
    if (overlay) overlay.style.display = "none";
  }

  function findGroup(gid) {
    if (!window.state || !Array.isArray(window.state.groups)) return null;
    return window.state.groups.find(function (g) { return g.id === gid; }) || null;
  }

  function renderTab(groupId, tab) {
        var body = document.getElementById("grpSettingsBody");
        if (!body) return;
        if (tab === "workflows")   return renderWorkflowsTab(body, groupId);
        if (tab === "members")     return renderMembersTab(body, groupId);
        if (tab === "preferences") return renderPreferencesTab(body, groupId);
        return renderGeneralTab(body, groupId);
      }

  function renderGeneralTab(body, groupId) {
    var group = findGroup(groupId);
    if (!group) { body.innerHTML = "<p>Group not found.</p>"; return; }
    body.innerHTML =
      '<div style="font-size:13px;color:var(--text-secondary,#64748b);">Group Id</div>' +
      '<div style="font-family:monospace;margin-bottom:10px;">' + escapeHtml(group.id) + '</div>' +
      '<div style="font-size:13px;color:var(--text-secondary,#64748b);">Group name</div>' +
      '<div style="font-weight:500;margin-bottom:10px;">' + escapeHtml(group.name) + '</div>' +
      '<div style="font-size:12px;color:var(--text-secondary,#64748b);">TODO: expose rename / members / personal toggle here.</div>';
  }

  function renderMembersTab(body, groupId) {
        var group = findGroup(groupId);
        if (!group) { body.innerHTML = "<p>Group not found.</p>"; return; }
        var rbac = window.RBAC;
        var canManage = rbac ? rbac.canManageGroup(groupId) : true;
        var mockUsers = (rbac && rbac.MockUsers) || [];
        var adminIds = group.adminIds || [];
        var memberIds = group.memberIds || [];
        var allGroupUserIds = Array.from(new Set([].concat(adminIds, memberIds)));
        var rows = allGroupUserIds.length === 0
          ? '<div style="padding:16px;text-align:center;color:var(--text-secondary,#64748b);font-size:13px;">No members yet.</div>'
          : allGroupUserIds.map(function(uid){
              var u = mockUsers.find(function(x){ return x.id === uid; }) || { id: uid, name: uid, email: "—" };
              var isAdmin = adminIds.indexOf(uid) >= 0;
              var roleLabel = isAdmin ? "Group Admin" : "Group Member";
              var roleColor = isAdmin ? "#f59e0b" : "#10b981";
              var actions = "";
              if (canManage) {
                if (!isAdmin) {
                  actions += '<button class="wf-btn gs-promote" data-uid="' + escapeAttr(uid) + '" title="Promote to Group Admin"><i class="fa-solid fa-arrow-up"></i></button> ';
                }
                actions += '<button class="wf-btn gs-remove" data-uid="' + escapeAttr(uid) + '" title="Remove from group"><i class="fa-solid fa-user-minus"></i></button>';
              }
              return '<div class="gs-member-row">' +
                     '<div class="gs-member-info"><b>' + escapeHtml(u.name) + '</b><small>' + escapeHtml(u.email) + '</small></div>' +
                     '<span class="rbac-badge" style="background:' + roleColor + '22;color:' + roleColor + ';border:1px solid ' + roleColor + '55">' + roleLabel + '</span>' +
                     '<span>' + (canManage ? actions : '<span class="rbac-readonly-pill"><i class="fa-solid fa-lock"></i> read-only</span>') + '</span>' +
                     '</div>';
            }).join("");
        var addBlock = canManage
          ? '<div class="gs-members-toolbar">' +
            '  <div style="font-size:12px;color:var(--text-secondary,#64748b);">' + allGroupUserIds.length + ' member(s)</div>' +
            '  <div style="display:flex;gap:6px;">' +
            '    <select id="gsAddMemberSelect" style="font-size:12px;padding:4px 6px;"><option value="">Add member…</option>' +
                 mockUsers.filter(function(u){ return allGroupUserIds.indexOf(u.id) < 0; })
                          .map(function(u){ return '<option value="' + escapeAttr(u.id) + '">' + escapeHtml(u.name) + '</option>'; }).join("") +
            '    </select>' +
            '    <button class="wf-btn primary" id="gsAddMemberBtn"><i class="fa-solid fa-plus"></i> Add</button>' +
            '  </div>' +
            '</div>'
          : '<div class="gs-members-toolbar"><span class="rbac-readonly-pill"><i class="fa-solid fa-lock"></i> You need Group Admin or Org Admin permission to manage members.</span></div>';
        body.innerHTML = addBlock + rows;
        if (canManage) {
          var addBtn = body.querySelector("#gsAddMemberBtn");
          if (addBtn) addBtn.addEventListener("click", async function(){
            var sel = body.querySelector("#gsAddMemberSelect");
            var uid = sel && sel.value;
            if (!uid) return;
            group.memberIds = Array.from(new Set((group.memberIds || []).concat([uid])));
            try {
              if (window.ShadowDB && window.ShadowDB.Groups && window.ShadowDB.Groups.update) {
                await window.ShadowDB.Groups.update(groupId, { memberIds: group.memberIds });
              }
            } catch(_) {}
            renderMembersTab(body, groupId);
          });
          body.querySelectorAll(".gs-promote").forEach(function(btn){
            btn.addEventListener("click", async function(){
              var uid = btn.getAttribute("data-uid");
              group.adminIds = Array.from(new Set((group.adminIds || []).concat([uid])));
              group.memberIds = (group.memberIds || []).filter(function(x){ return x !== uid; });
              try {
                if (window.ShadowDB && window.ShadowDB.Groups && window.ShadowDB.Groups.update) {
                  await window.ShadowDB.Groups.update(groupId, { adminIds: group.adminIds, memberIds: group.memberIds });
                }
              } catch(_) {}
              renderMembersTab(body, groupId);
            });
          });
          body.querySelectorAll(".gs-remove").forEach(function(btn){
            btn.addEventListener("click", async function(){
              var uid = btn.getAttribute("data-uid");
              if (!confirm("Remove this member from the group?")) return;
              group.adminIds  = (group.adminIds  || []).filter(function(x){ return x !== uid; });
              group.memberIds = (group.memberIds || []).filter(function(x){ return x !== uid; });
              try {
                if (window.ShadowDB && window.ShadowDB.Groups && window.ShadowDB.Groups.update) {
                  await window.ShadowDB.Groups.update(groupId, { adminIds: group.adminIds, memberIds: group.memberIds });
                }
              } catch(_) {}
              renderMembersTab(body, groupId);
            });
          });
        }
      }

      function renderPreferencesTab(body, groupId) {
        var group = findGroup(groupId);
        if (!group) { body.innerHTML = "<p>Group not found.</p>"; return; }
        var rbac = window.RBAC;
        var canManage = rbac ? rbac.canManageGroup(groupId) : true;
        var disabled = canManage ? "" : " disabled";
        body.innerHTML =
          '<div style="display:flex;flex-direction:column;gap:14px;">' +
          (canManage ? '' : '<div><span class="rbac-readonly-pill"><i class="fa-solid fa-lock"></i> read-only — Group Admin or Org Admin only</span></div>') +
          '  <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;">' +
          '    <span style="color:var(--text-secondary,#64748b);">Group name</span>' +
          '    <input id="gsPrefName" type="text" value="' + escapeAttr(group.name || "") + '"' + disabled + ' style="padding:6px 8px;border:1px solid var(--border-color,#334155);background:var(--bg-secondary,#0f172a);color:inherit;border-radius:6px;">' +
          '  </label>' +
          '  <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;">' +
          '    <span style="color:var(--text-secondary,#64748b);">Description</span>' +
          '    <textarea id="gsPrefDesc" rows="3"' + disabled + ' style="padding:6px 8px;border:1px solid var(--border-color,#334155);background:var(--bg-secondary,#0f172a);color:inherit;border-radius:6px;">' + escapeHtml(group.description || "") + '</textarea>' +
          '  </label>' +
          '  <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;">' +
          '    <span style="color:var(--text-secondary,#64748b);">Default task categories (comma-separated)</span>' +
          '    <input id="gsPrefCats" type="text" value="' + escapeAttr((group.defaultCategories || []).join(", ")) + '"' + disabled + ' style="padding:6px 8px;border:1px solid var(--border-color,#334155);background:var(--bg-secondary,#0f172a);color:inherit;border-radius:6px;">' +
          '  </label>' +
          (canManage ? '<div><button class="wf-btn primary" id="gsPrefSave"><i class="fa-solid fa-save"></i> Save preferences</button></div>' : '') +
          '</div>';
        if (canManage) {
          body.querySelector("#gsPrefSave").addEventListener("click", async function(){
            var patch = {
              name: body.querySelector("#gsPrefName").value.trim() || group.name,
              description: body.querySelector("#gsPrefDesc").value,
              defaultCategories: body.querySelector("#gsPrefCats").value.split(",").map(function(s){ return s.trim(); }).filter(Boolean)
            };
            Object.assign(group, patch);
            try {
              if (window.ShadowDB && window.ShadowDB.Groups && window.ShadowDB.Groups.update) {
                await window.ShadowDB.Groups.update(groupId, patch);
              }
              if (typeof window.renderSidebar === "function") window.renderSidebar();
            } catch(e) { alert("Could not save: " + e.message); return; }
            var t = document.getElementById("grpSettingsTitle");
            if (t) t.textContent = group.name + " — settings";
            alert("Preferences saved.");
          });
        }
      }

      function renderWorkflowsTab(body, groupId) {
    var engine = window.WorkflowEngine;
    if (!engine || typeof engine.getRulesByGroup !== "function") {
      body.innerHTML = '<p>Workflow engine not available.</p>';
      return;
    }
    var rules = engine.getRulesByGroup(groupId) || [];
    var canManage = engine.canManage && engine.canManage(groupId);

    var header = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
      '<div style="font-size:12px;color:var(--text-secondary,#64748b);">' +
      rules.length + ' rule(s) mapped to this group' +
      (canManage ? "" : ' <span class="wf-rule-lock"><i class="fa-solid fa-lock"></i> read-only</span>') +
      '</div>' +
      (canManage ?
        '<button class="wf-btn primary" id="grpAddRuleBtn"><i class="fa-solid fa-plus"></i> New Rule</button>' +
        ' <a class="wf-btn" href="workflow.html?groupId=' + encodeURIComponent(groupId) + '"><i class="fa-solid fa-up-right-from-square"></i> Open Workflow Window</a>'
        : '') +
      '</div>';

    var list = rules.length === 0
      ? '<div style="padding:20px;text-align:center;color:var(--text-secondary,#64748b);font-size:13px;">No rules yet for this group.</div>'
      : '<div class="wf-group-rules-list">' + rules.map(function (r) {
          var st = (r.state || "draft").toLowerCase();
          return '<div class="wf-mini-rule" data-rule-id="' + escapeAttr(r.id) + '">' +
            '<i class="fa-solid fa-bolt" style="color:#4285f4;"></i>' +
            '<span class="wf-mini-name">' + escapeHtml(r.name || "Untitled rule") + '</span>' +
            '<span class="state-chip ' + st + '">' + st + '</span>' +
            (canManage
              ? '<button class="icon-btn grp-rule-edit" title="Edit"><i class="fa-solid fa-pen"></i></button>'
              : '') +
          '</div>';
        }).join("") + '</div>';

    body.innerHTML = header + list;

    var addBtn = body.querySelector("#grpAddRuleBtn");
    if (addBtn) addBtn.addEventListener("click", function () {
      if (window.ShadowWorkflowBuilder && window.ShadowWorkflowBuilder.openBuilder) {
        window.ShadowWorkflowBuilder.openBuilder({ groupId: groupId, lockGroup: true });
        closeGroupSettings();
      } else {
        window.location.href = "workflow.html?groupId=" + encodeURIComponent(groupId) + "&new=1";
      }
    });
    // Edit handlers
    body.querySelectorAll(".grp-rule-edit").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var id = btn.closest(".wf-mini-rule").getAttribute("data-rule-id");
        window.location.href = "workflow.html?groupId=" + encodeURIComponent(groupId) +
                               "&ruleId=" + encodeURIComponent(id);
      });
    });
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s).replace(/[&<>"\']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "\'": "&#39;" })[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }

  // Expose entry point
  window.openGroupSettings = openGroupSettings;

})();
