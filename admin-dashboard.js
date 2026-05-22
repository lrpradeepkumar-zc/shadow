/**
 * Shadow ToDo - Admin Dashboard (Org Admin only)
 * -----------------------------------------------------------------------------
 * Renders into #adminDashboardRoot on admin.html with three tabs:
 *   1. User Management  - list, change role, invite, revoke
 *   2. Group Management - list, delete, reassign admin
 *   3. Billing & Global - placeholders
 *
 * Strictly relies on window.RBAC for gating.  If the current user is NOT
 * Org Admin, renders a 403 state with a link back to /index.html.
 * -----------------------------------------------------------------------------
 */
(function AdminDashboard(){
  "use strict";

  function init(){
    var root = document.getElementById("adminDashboardRoot");
    if (!root) return;

    // Route guard
    var guard = window.RBAC && window.RBAC.guardRoute("admin");
    if (!guard || !guard.ok) {
      root.innerHTML = renderForbidden(guard && guard.reason);
      return;
    }
    render(root);
  }

  function renderForbidden(reason){
    return '<div class="admin-403">' +
      '<i class="fa-solid fa-lock"></i>' +
      '<h2>403 - Access denied</h2>' +
      '<p>' + (reason || "This page is restricted to Org Admins.") + '</p>' +
      '<a class="wf-btn primary" href="index.html">Back to app</a>' +
      '</div>';
  }

  function render(root){
    root.innerHTML =
      '<div class="admin-shell">' +
      '  <aside class="admin-sidebar">' +
      '    <div class="admin-brand"><i class="fa-solid fa-shield-halved"></i> Admin</div>' +
      '    <nav>' +
      '      <button class="admin-nav-btn active" data-tab="users"><i class="fa-solid fa-users"></i> User Management</button>' +
      '      <button class="admin-nav-btn" data-tab="groups"><i class="fa-solid fa-people-group"></i> Group Management</button>' +
      '      <button class="admin-nav-btn" data-tab="billing"><i class="fa-solid fa-credit-card"></i> Billing & Global</button>' +
      '    </nav>' +
      '    <div class="admin-footer">' +
      '      <a href="index.html"><i class="fa-solid fa-arrow-left"></i> Back to app</a>' +
      '    </div>' +
      '  </aside>' +
      '  <main class="admin-main">' +
      '    <header class="admin-header">' +
      '      <h1 id="adminTabTitle">User Management</h1>' +
      '      <div id="adminRoleBadge"></div>' +
      '    </header>' +
      '    <section id="adminTabBody"></section>' +
      '  </main>' +
      '</div>';

    var cu = window.RBAC.getCurrentUser();
    document.getElementById("adminRoleBadge").innerHTML =
      '<span class="admin-cu">Signed in as <b>' + cu.name + '</b> ' + window.RBACUI.badge(cu.role) + '</span>';

    document.querySelectorAll(".admin-nav-btn").forEach(function(btn){
      btn.addEventListener("click", function(){
        document.querySelectorAll(".admin-nav-btn").forEach(function(b){ b.classList.remove("active"); });
        btn.classList.add("active");
        var tab = btn.getAttribute("data-tab");
        renderTab(tab);
      });
    });
    renderTab("users");
  }

  function renderTab(tab){
    var body = document.getElementById("adminTabBody");
    var title = document.getElementById("adminTabTitle");
    // renderUsers() is async — it populates the DOM itself and calls wireUsers() internally
    if (tab === "users")  { title.textContent = "User Management";  renderUsers(); }
    if (tab === "groups") { title.textContent = "Group Management"; body.innerHTML = renderGroups(); wireGroups(); }
    if (tab === "billing"){ title.textContent = "Billing & Global"; body.innerHTML = renderBilling(); }
  }

  // ================================================================== USERS
  function renderUsers(){
    var body = document.getElementById("adminTabBody");
    body.innerHTML = '<div class="admin-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading users…</div>';

    var auth = window.ShadowAuth;
    if (!auth || typeof auth.getOrgMembers !== 'function') {
      body.innerHTML = '<div class="admin-empty">User management is unavailable (ShadowAuth not loaded).</div>';
      return;
    }

    auth.getOrgMembers().then(function(users) {
      users = users || [];
      var roles = Object.keys(window.RBAC.RoleMeta);
      var rows = users.map(function(u){
        var roleOpts = roles.map(function(r){
          var rm = window.RBAC.RoleMeta[r];
          var sel = r === u.role ? " selected" : "";
          return '<option value="' + r + '"' + sel + '>' + rm.label + '</option>';
        }).join("");
        var initial = (u.name || u.email || '?').charAt(0).toUpperCase();
        return '<tr data-user-id="' + u.id + '">' +
               '  <td><div class="admin-user-cell">' +
               '    <div class="admin-avatar" style="background:' + (u.color || '#64748b') + '">' + initial + '</div>' +
               '    <div><div class="admin-uname">' + (u.name || '') + '</div><div class="admin-uemail">' + (u.email || '') + '</div></div>' +
               '  </div></td>' +
               '  <td>' + window.RBACUI.badge(u.role) + '</td>' +
               '  <td><select class="admin-role-select" data-user-id="' + u.id + '">' + roleOpts + '</select></td>' +
               '  <td>' +
               '    <button class="admin-btn danger" data-revoke="' + u.id + '" data-revoke-name="' + (u.name || u.email || '') + '"><i class="fa-solid fa-user-xmark"></i> Revoke</button>' +
               '  </td>' +
               '</tr>';
      }).join("");

      body.innerHTML =
        '<div class="admin-toolbar">' +
        '  <div class="admin-search"><i class="fa-solid fa-magnifying-glass"></i><input id="userSearch" placeholder="Search users…"></div>' +
        '  <button class="admin-btn primary" id="inviteUserBtn"><i class="fa-solid fa-user-plus"></i> Invite user</button>' +
        '</div>' +
        '<table class="admin-table">' +
        '<thead><tr><th>User</th><th>Current Role</th><th>Change Role</th><th>Actions</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '</table>';

      wireUsers(users);
    }).catch(function(err) {
      body.innerHTML = '<div class="admin-empty admin-error"><i class="fa-solid fa-circle-xmark"></i> Failed to load users: ' + (err.message || err) + '</div>';
    });
  }

  function wireUsers(users){
    var searchEl = document.getElementById("userSearch");
    if (searchEl) searchEl.addEventListener("input", function(e){
      var q = e.target.value.toLowerCase();
      document.querySelectorAll(".admin-table tbody tr").forEach(function(tr){
        tr.style.display = tr.textContent.toLowerCase().indexOf(q) >= 0 ? "" : "none";
      });
    });

    var invBtn = document.getElementById("inviteUserBtn");
    if (invBtn) invBtn.addEventListener("click", function(){ openInviteModal(); });

    document.querySelectorAll(".admin-role-select").forEach(function(sel){
      sel.addEventListener("change", async function(e){
        var uid = e.target.dataset.userId;
        var newRole = e.target.value;
        var user = (users || []).find(function(u){ return u.id === uid; });
        try {
          await window.ShadowAuth.adminUpdateUser(uid, { role: newRole });
          var tr = document.querySelector('tr[data-user-id="' + uid + '"]');
          if (tr) tr.querySelector("td:nth-child(2)").innerHTML = window.RBACUI.badge(newRole);
          toast("Role updated: " + (user ? user.name : uid) + " → " + window.RBAC.RoleMeta[newRole].label);
        } catch(err) {
          toast("Failed to update role: " + (err.message || err), "error");
          e.target.value = user ? (user.role || '') : '';
        }
      });
    });

    document.querySelectorAll("[data-revoke]").forEach(function(btn){
      btn.addEventListener("click", async function(){
        var uid = btn.getAttribute("data-revoke");
        var name = btn.getAttribute("data-revoke-name") || uid;
        if (!confirm("Revoke access for " + name + "? This will delete the user from the workspace.")) return;
        try {
          await window.ShadowAuth.adminDeleteUser(uid);
          renderTab("users");
          toast("Revoked access for " + name);
        } catch(err) {
          toast("Failed to revoke: " + (err.message || err), "error");
        }
      });
    });
  }

  function openInviteModal(){
    var m = document.createElement("div");
    m.className = "admin-modal-backdrop";
    m.innerHTML =
      '<div class="admin-modal">' +
      '  <div class="admin-modal-head"><h3>Invite user</h3><button class="admin-x" aria-label="Close">×</button></div>' +
      '  <div class="admin-modal-body">' +
      '    <label>Name <input type="text" id="invName" placeholder="Full name"></label>' +
      '    <label>Email <input type="email" id="invEmail" placeholder="name@company.com"></label>' +
      '    <label>Password <input type="password" id="invPassword" placeholder="Temporary password"></label>' +
      '    <label>Initial role <select id="invRole">' +
             Object.keys(window.RBAC.RoleMeta).map(function(r){
               return '<option value="' + r + '">' + window.RBAC.RoleMeta[r].label + '</option>';
             }).join("") +
      '    </select></label>' +
      '  </div>' +
      '  <div class="admin-modal-foot">' +
      '    <button class="admin-btn" data-cancel>Cancel</button>' +
      '    <button class="admin-btn primary" id="invSend"><i class="fa-solid fa-paper-plane"></i> Create user</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(m);
    function close(){ m.remove(); }
    m.querySelector(".admin-x").addEventListener("click", close);
    m.querySelector("[data-cancel]").addEventListener("click", close);
    m.addEventListener("click", function(e){ if (e.target === m) close(); });
    m.querySelector("#invSend").addEventListener("click", async function(){
      var name = m.querySelector("#invName").value.trim();
      var email = m.querySelector("#invEmail").value.trim();
      var password = m.querySelector("#invPassword").value;
      var role = m.querySelector("#invRole").value;
      if (!email) { alert("Email required"); return; }
      if (!password) { alert("Temporary password required"); return; }
      try {
        await window.ShadowAuth.adminCreateUser(name || email.split('@')[0], email, password, role);
        close();
        renderTab("users");
        toast("User created: " + email);
      } catch(err) {
        alert("Failed to create user: " + (err.message || err));
      }
    });
  }

  // ================================================================== GROUPS
  function renderGroups(){
    var groups = (window.state && window.state.groups) || [];
    var members = (window.state && window.state.members) || [];
    var adminOpts = members.map(function(u){
      return '<option value="' + u.id + '">' + (u.name || u.email || u.id) + '</option>';
    }).join("");

    if (groups.length === 0) {
      return '<div class="admin-empty"><i class="fa-regular fa-folder-open"></i> No groups yet.</div>';
    }
    var rows = groups.map(function(g){
      var adminIds = g.adminIds || [];
      var currentAdminName = adminIds.length
        ? members.filter(function(u){ return adminIds.indexOf(u.id) >= 0; })
            .map(function(u){ return u.name || u.email || u.id; }).join(", ") || adminIds.join(", ")
        : "—";
      var taskCount = ((window.state && window.state.tasks) || [])
        .filter(function(t){ return t.groupId === g.id; }).length;
      return '<tr data-group-id="' + g.id + '">' +
             '  <td><b>' + g.name + '</b></td>' +
             '  <td>' + currentAdminName + '</td>' +
             '  <td>' + taskCount + ' tasks</td>' +
             '  <td>' + new Date(g.createdAt || Date.now()).toLocaleDateString() + '</td>' +
             '  <td class="admin-group-actions">' +
             '    <select class="admin-reassign" data-group-id="' + g.id + '"><option value="">Reassign to…</option>' + adminOpts + '</select>' +
             '    <button class="admin-btn danger" data-del-group="' + g.id + '"><i class="fa-solid fa-trash"></i> Delete</button>' +
             '  </td>' +
             '</tr>';
    }).join("");
    return '<table class="admin-table">' +
      '<thead><tr><th>Group</th><th>Admin(s)</th><th>Tasks</th><th>Created</th><th>Actions</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
  }

  function wireGroups(){
    document.querySelectorAll("[data-del-group]").forEach(function(btn){
      btn.addEventListener("click", async function(){
        var gid = btn.getAttribute("data-del-group");
        var group = (window.state.groups || []).find(function(g){ return g.id === gid; });
        if (!group) return;
        if (!confirm("Delete group '" + group.name + "'? This cannot be undone.")) return;
        try {
          if (window.ShadowDB && window.ShadowDB.Groups && window.ShadowDB.Groups.delete) {
            await window.ShadowDB.Groups.delete(gid);
          }
          window.state.groups = (window.state.groups || []).filter(function(g){ return g.id !== gid; });
          renderTab("groups");
          toast("Group deleted: " + group.name);
        } catch(e) {
          toast("Error deleting group: " + e.message, "error");
        }
      });
    });
    document.querySelectorAll(".admin-reassign").forEach(function(sel){
      sel.addEventListener("change", async function(e){
        var gid = e.target.dataset.groupId;
        var newAdminId = e.target.value;
        if (!newAdminId) return;
        var group = (window.state.groups || []).find(function(g){ return g.id === gid; });
        if (!group) return;
        group.adminIds = [newAdminId];
        try {
          if (window.ShadowDB && window.ShadowDB.Groups && window.ShadowDB.Groups.update) {
            await window.ShadowDB.Groups.update(gid, { adminIds: group.adminIds });
          }
        } catch(_) {}
        var members2 = (window.state && window.state.members) || [];
        var newAdmin = members2.find(function(u){ return u.id === newAdminId; });
        renderTab("groups");
        toast("Reassigned '" + group.name + "' admin to " + (newAdmin ? (newAdmin.name || newAdmin.email || newAdminId) : newAdminId));
      });
    });
  }

  // ================================================================== BILLING
  function renderBilling(){
    return '<div class="admin-billing">' +
      '  <div class="admin-card">' +
      '    <h3><i class="fa-solid fa-credit-card"></i> Current plan</h3>' +
      '    <div class="admin-plan-pill">Team · $12/user/mo</div>' +
      '    <p>Next invoice on <b>May 15, 2026</b> — <b>$120.00</b> for 10 seats.</p>' +
      '    <button class="admin-btn primary" disabled>Change plan</button>' +
      '    <button class="admin-btn" disabled>Download invoice</button>' +
      '  </div>' +
      '  <div class="admin-card">' +
      '    <h3><i class="fa-solid fa-sliders"></i> Global settings</h3>' +
      '    <label class="admin-setting"><span>Default timezone</span>' +
      '      <select disabled><option>UTC</option></select></label>' +
      '    <label class="admin-setting"><span>Require 2FA for admins</span>' +
      '      <input type="checkbox" checked disabled></label>' +
      '    <label class="admin-setting"><span>Allow guest viewers</span>' +
      '      <input type="checkbox" disabled></label>' +
      '    <p class="admin-hint"><i class="fa-solid fa-circle-info"></i> Placeholder — wire to ShadowDB.Settings to persist.</p>' +
      '  </div>' +
      '</div>';
  }

  // ================================================================== TOAST
  function toast(msg, type){
    var c = document.getElementById("adminToasts");
    if (!c) {
      c = document.createElement("div");
      c.id = "adminToasts";
      c.className = "admin-toasts";
      document.body.appendChild(c);
    }
    var t = document.createElement("div");
    t.className = "admin-toast" + (type === "error" ? " error" : "");
    t.innerHTML = '<i class="fa-solid ' + (type === "error" ? "fa-circle-xmark" : "fa-circle-check") + '"></i> ' + msg;
    c.appendChild(t);
    setTimeout(function(){ t.classList.add("show"); }, 10);
    setTimeout(function(){
      t.classList.remove("show");
      setTimeout(function(){ t.remove(); }, 300);
    }, 2800);
  }

  // Expose for imperative re-renders
  window.AdminDashboard = { init: init, renderTab: renderTab };

  // Boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
