/**
 * admin.js — Shadow ToDo Admin Dashboard
 * Provides:
 *   - User management (add, edit, delete)
 *   - Role assignment per user
 *   - Permission configuration per role
 *   - Integrated with ShadowAuth user store
 */
const ShadowAdmin = (() => {
  let activeTab = 'users';
  let editingUserId = null;
  let userFilter = '';

  // ── Open / Close ─────────────────────────────────────────────────────────
  function open() {
    if (!ShadowAuth.hasPermission('manageUsers')) {
      alert('You do not have permission to access the Admin Dashboard.');
      return;
    }
    _ensureModal();
    document.getElementById('adminDashboardModal').classList.add('open');
    _switchTab('users');
  }

  function close() {
    const modal = document.getElementById('adminDashboardModal');
    if (modal) modal.classList.remove('open');
    editingUserId = null;
  }

  function _ensureModal() {
    if (document.getElementById('adminDashboardModal')) return;
    const el = document.createElement('div');
    el.id = 'adminDashboardModal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Admin Dashboard');
    el.innerHTML = _buildModalHTML();
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) close(); });
  }

  function _buildModalHTML() {
    return `
      <div class="admin-modal-inner">
        <div class="admin-modal-header">
          <h2><i class="fa-solid fa-shield-halved"></i> Admin Dashboard</h2>
          <button class="icon-btn" onclick="ShadowAdmin.close()" title="Close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="admin-modal-body">
          <div class="admin-tabs-nav">
            <div class="admin-tab-nav-item active" data-tab="users" onclick="ShadowAdmin._switchTab('users')">
              <i class="fa-solid fa-users"></i> Users
            </div>
            <div class="admin-tab-nav-item" data-tab="add-user" onclick="ShadowAdmin._switchTab('add-user')">
              <i class="fa-solid fa-user-plus"></i> Add User
            </div>
            <div class="admin-tab-nav-item" data-tab="permissions" onclick="ShadowAdmin._switchTab('permissions')">
              <i class="fa-solid fa-key"></i> Permissions
            </div>
          </div>
          <div class="admin-content" id="adminContent">
          </div>
        </div>
      </div>
    `;
  }

  // ── Tab switching ─────────────────────────────────────────────────────────
  function _switchTab(tab) {
    activeTab = tab;
    editingUserId = null;
    // Update nav
    document.querySelectorAll('.admin-tab-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    const content = document.getElementById('adminContent');
    if (!content) return;
    if (tab === 'users')       content.innerHTML = _renderUsersTab();
    if (tab === 'add-user')    content.innerHTML = _renderAddUserTab();
    if (tab === 'permissions') content.innerHTML = _renderPermissionsTab();
  }

  // ── Users tab ─────────────────────────────────────────────────────────────
  function _renderUsersTab() {
    const users   = ShadowAuth.getUsers();
    const current = ShadowAuth.getCurrentUser();
    const filtered = userFilter
      ? users.filter(u => u.name.toLowerCase().includes(userFilter) || u.email.toLowerCase().includes(userFilter))
      : users;

    const rows = filtered.map(u => {
      const isSelf   = current && u.id === current.id;
      const roleClass = 'role-' + u.role;
      const roleLabel = ShadowAuth.ROLE_LABELS[u.role] || u.role;
      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <div class="user-avatar-sm" style="background:${u.color}">${u.avatar}</div>
              <div>
                <div style="font-weight:600">${_esc(u.name)}${isSelf ? ' <span style="font-size:11px;color:#667eea">(you)</span>' : ''}</div>
                <div style="font-size:12px;color:#718096">${_esc(u.email)}</div>
              </div>
            </div>
          </td>
          <td><span class="role-badge-pill ${roleClass}">${roleLabel}</span></td>
          <td style="font-size:12px;color:#a0aec0">${_formatDate(u.createdAt)}</td>
          <td>
            <div style="display:flex;gap:6px">
              <button class="admin-btn admin-btn-outline" onclick="ShadowAdmin._editUser('${u.id}')" title="Edit user">
                <i class="fa-solid fa-pen"></i>
              </button>
              ${!isSelf ? `<button class="admin-btn admin-btn-danger" onclick="ShadowAdmin._deleteUser('${u.id}')" title="Delete user">
                <i class="fa-solid fa-trash"></i>
              </button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="admin-users-toolbar">
        <input class="admin-search-input" type="text" placeholder="Search users..."
          value="${_esc(userFilter)}"
          oninput="ShadowAdmin._filterUsers(this.value)" />
        <button class="admin-btn admin-btn-primary" onclick="ShadowAdmin._switchTab('add-user')">
          <i class="fa-solid fa-plus"></i> Add User
        </button>
      </div>
      ${filtered.length === 0 ? '<div class="admin-empty">No users found.</div>' : `
      <table class="admin-users-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`}
    `;
  }

  // ── Add/Edit User form ────────────────────────────────────────────────────
  function _renderAddUserTab(prefill) {
    const editing = !!prefill;
    const p = prefill || {};
    const roleOpts = ['admin','member','viewer'].map(r => `
      <option value="${r}" ${p.role === r ? 'selected' : ''}>${ShadowAuth.ROLE_LABELS[r]}</option>
    `).join('');

    return `
      <h3 style="margin:0 0 20px;font-size:16px;color:#1a202c">${editing ? 'Edit User' : 'Add New User'}</h3>
      <div class="admin-form-row">
        <div class="admin-form-field">
          <label>Full Name *</label>
          <input type="text" id="afu-name" value="${_esc(p.name||'')}" placeholder="Full name" />
        </div>
        <div class="admin-form-field">
          <label>Email *</label>
          <input type="email" id="afu-email" value="${_esc(p.email||'')}" placeholder="email@company.com" ${editing ? 'disabled' : ''} />
        </div>
      </div>
      <div class="admin-form-row">
        <div class="admin-form-field">
          <label>${editing ? 'New Password (leave blank to keep)' : 'Password *'}</label>
          <input type="password" id="afu-pass" placeholder="${editing ? 'Leave blank to keep current' : 'Min. 6 characters'}" />
        </div>
        <div class="admin-form-field">
          <label>Role *</label>
          <select id="afu-role">${roleOpts}</select>
        </div>
      </div>
      <p class="sa-error" id="afu-error"></p>
      <div class="admin-form-actions">
        <button class="admin-btn admin-btn-outline" onclick="ShadowAdmin._switchTab('users')">Cancel</button>
        <button class="admin-btn admin-btn-primary" onclick="ShadowAdmin._saveUser('${editing ? p.id : ''}')">
          ${editing ? 'Save Changes' : 'Create User'}
        </button>
      </div>
    `;
  }

  // ── Permissions tab ───────────────────────────────────────────────────────
  function _renderPermissionsTab() {
    const perms = ShadowAuth.getPerms();
    const roles  = ['admin','member','viewer'];
    const allPerms = [
      { key: 'createTask',   label: 'Create Tasks' },
      { key: 'editTask',     label: 'Edit Tasks' },
      { key: 'deleteTask',   label: 'Delete Tasks' },
      { key: 'createGroup',  label: 'Create Groups' },
      { key: 'editGroup',    label: 'Edit Groups' },
      { key: 'deleteGroup',  label: 'Delete Groups' },
      { key: 'assignTask',   label: 'Assign Tasks' },
      { key: 'manageUsers',  label: 'Manage Users' },
      { key: 'viewAll',      label: 'View All Tasks' },
    ];

    const headerCols = roles.map(r => `<th>${ShadowAuth.ROLE_LABELS[r]}</th>`).join('');
    const rows = allPerms.map(p => {
      const cols = roles.map(r => {
        const checked = perms[r]?.[p.key] ? 'checked' : '';
        const disabled = r === 'admin' && (p.key === 'manageUsers' || p.key === 'viewAll') ? 'disabled' : '';
        return `<td><input type="checkbox" ${checked} ${disabled}
          onchange="ShadowAdmin._setPerm('${r}','${p.key}',this.checked)" /></td>`;
      }).join('');
      return `<tr><td>${p.label}</td>${cols}</tr>`;
    }).join('');

    return `
      <h3 style="margin:0 0 8px;font-size:16px;color:#1a202c">Role Permissions</h3>
      <p style="font-size:13px;color:#718096;margin:0 0 20px">Configure what each role can do in the app.</p>
      <table class="perms-grid">
        <thead><tr><th>Permission</th>${headerCols}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:16px;font-size:12px;color:#a0aec0">
        <i class="fa-solid fa-circle-info"></i> Changes take effect on next page load.
        Admin always retains Manage Users &amp; View All.
      </div>
    `;
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  function _filterUsers(q) {
    userFilter = q.toLowerCase();
    const content = document.getElementById('adminContent');
    if (content && activeTab === 'users') content.innerHTML = _renderUsersTab();
  }

  function _editUser(id) {
    editingUserId = id;
    const user = ShadowAuth.getUsers().find(u => u.id === id);
    if (!user) return;
    const content = document.getElementById('adminContent');
    if (content) content.innerHTML = _renderAddUserTab(user);
    // Mark nav
    document.querySelectorAll('.admin-tab-nav-item').forEach(el => el.classList.remove('active'));
  }

  function _deleteUser(id) {
    if (!confirm('Delete this user? This action cannot be undone.')) return;
    const res = ShadowAuth.adminDeleteUser(id);
    if (!res.ok) { alert(res.error); return; }
    // Refresh members in app state
    if (typeof state !== 'undefined') {
      state.members = ShadowAuth.getOrgMembers();
    }
    _switchTab('users');
  }

  function _saveUser(existingId) {
    const name  = document.getElementById('afu-name')?.value.trim();
    const email = document.getElementById('afu-email')?.value.trim();
    const pass  = document.getElementById('afu-pass')?.value;
    const role  = document.getElementById('afu-role')?.value;
    const errEl = document.getElementById('afu-error');

    if (!name) { errEl.textContent = 'Name is required'; return; }

    if (existingId) {
      // Edit
      const updates = { name, role };
      if (pass) updates.password = pass;
      const res = ShadowAuth.adminUpdateUser(existingId, updates);
      if (!res.ok) { errEl.textContent = res.error; return; }
      // Update session if editing self
      const current = ShadowAuth.getCurrentUser();
      if (current && current.id === existingId) {
        ShadowAuth.setSession({ ...current, ...updates, avatar: ShadowAuth.getInitials(name) });
        ShadowAuth.updateUserUI();
      }
    } else {
      // Create
      if (!email || !email.includes('@')) { errEl.textContent = 'Valid email required'; return; }
      if (!pass || pass.length < 6) { errEl.textContent = 'Password must be 6+ characters'; return; }
      const res = ShadowAuth.register(name, email, pass, true); // noLogin=true so admin stays logged in
      if (!res.ok) { errEl.textContent = res.error; return; }
      // Override role set by register
      ShadowAuth.adminUpdateUser(res.user.id, { role });
    }

    // Refresh members in app state
    if (typeof state !== 'undefined') {
      state.members = ShadowAuth.getOrgMembers();
    }
    _switchTab('users');
  }

  function _setPerm(role, perm, value) {
    const res = ShadowAuth.adminUpdatePerms(role, perm, value);
    if (!res.ok) alert(res.error);
  }

  // ── Utils ─────────────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _formatDate(ts) {
    if (!ts) return '-';
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return { open, close, _switchTab, _filterUsers, _editUser, _deleteUser, _saveUser, _setPerm };
})();

// ── Expose admin button in header ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Wait for app to render header
  setTimeout(() => {
    const headerRight = document.querySelector('.header-right');
    if (headerRight && !document.getElementById('adminDashBtn')) {
      const btn = document.createElement('button');
      btn.id = 'adminDashBtn';
      btn.className = 'icon-btn';
      btn.title = 'Admin Dashboard';
      btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i>';
      btn.onclick = () => ShadowAdmin.open();
      btn.style.cssText = 'flex-shrink:0';
      // Insert before the avatar
      const avatar = headerRight.querySelector('.avatar');
      if (avatar) headerRight.insertBefore(btn, avatar);
      else headerRight.prepend(btn);
    }
  }, 500);
});
