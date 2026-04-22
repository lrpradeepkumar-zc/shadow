/**
 * Shadow ToDo - RBAC UI Helpers
 * -----------------------------------------------------------------------------
 * Thin UI layer on top of rbac.js.  Provides:
 *   1. <Gate permission="..." groupId="..."> style helper: RBACUI.gate(el, perm)
 *      - hides or disables the element based on RBAC.can()
 *   2. RBACUI.applyAll(root?) - scan DOM for [data-rbac-perm] or
 *      [data-rbac-role-min] attributes and apply hide/disable.
 *   3. RBACUI.injectRoleSwitcher(anchorEl) - floating role dropdown for QA.
 *   4. RBACUI.badge(role) -> HTMLString for role chip.
 *
 * Attributes supported on any element:
 *   data-rbac-perm="task.delete"         -> requires that permission
 *   data-rbac-perm="task.delete|task.update" (OR across | separator)
 *   data-rbac-role-min="group_admin"     -> requires rank >= group_admin
 *   data-rbac-group-id="<group id>"      -> context for group-scoped check
 *   data-rbac-mode="hide" | "disable"    -> default "hide"
 *
 * On role change via RBAC.setCurrentUser(), applyAll() re-runs automatically.
 * -----------------------------------------------------------------------------
 */
(function RBACUI(){
  "use strict";

  function gate(el, perm, opts){
    if (!el || !window.RBAC) return;
    opts = opts || {};
    var ctx = opts.groupId ? { groupId: opts.groupId } : undefined;
    var ok;
    if (perm && perm.indexOf("|") >= 0) {
      ok = perm.split("|").some(function(p){ return window.RBAC.can(p.trim(), ctx); });
    } else if (perm) {
      ok = window.RBAC.can(perm, ctx);
    } else {
      ok = true;
    }
    var mode = opts.mode || "hide";
    if (ok) {
      el.removeAttribute("disabled");
      el.style.removeProperty("display");
      el.classList.remove("rbac-disabled");
    } else {
      if (mode === "disable") {
        el.setAttribute("disabled", "disabled");
        el.classList.add("rbac-disabled");
        el.title = (el.title ? el.title + " — " : "") + "You don't have permission for this action.";
      } else {
        el.style.display = "none";
      }
    }
  }

  function applyAll(root){
    if (!window.RBAC) return;
    root = root || document;
    // [data-rbac-perm]
    root.querySelectorAll("[data-rbac-perm]").forEach(function(el){
      gate(el, el.getAttribute("data-rbac-perm"), {
        groupId: el.getAttribute("data-rbac-group-id"),
        mode:    el.getAttribute("data-rbac-mode") || "hide"
      });
    });
    // [data-rbac-role-min]
    root.querySelectorAll("[data-rbac-role-min]").forEach(function(el){
      var required = el.getAttribute("data-rbac-role-min");
      var currentRole = window.RBAC.getEffectiveRole({ groupId: el.getAttribute("data-rbac-group-id") });
      var reqRank = (window.RBAC.RoleMeta[required] || {}).rank || 0;
      var curRank = (window.RBAC.RoleMeta[currentRole] || {}).rank || 0;
      var mode = el.getAttribute("data-rbac-mode") || "hide";
      if (curRank >= reqRank) {
        el.removeAttribute("disabled");
        el.style.removeProperty("display");
        el.classList.remove("rbac-disabled");
      } else if (mode === "disable") {
        el.setAttribute("disabled", "disabled");
        el.classList.add("rbac-disabled");
      } else {
        el.style.display = "none";
      }
    });
    // Viewer-mode full lockdown: disable all form inputs marked [data-rbac-writable]
    if (window.RBAC.isViewer()) {
      root.querySelectorAll("[data-rbac-writable]").forEach(function(el){
        el.setAttribute("disabled", "disabled");
        el.classList.add("rbac-disabled");
      });
    }
  }

  function badge(role){
    var meta = (window.RBAC && window.RBAC.RoleMeta[role]) || { label: role || "—", color: "#6b7280" };
    return '<span class="rbac-badge" style="background:' + meta.color + '22;color:' + meta.color +
           ';border:1px solid ' + meta.color + '55">' + meta.label + '</span>';
  }

  function injectRoleSwitcher(anchor){
    if (!window.RBAC) return;
    if (document.getElementById("rbacRoleSwitcher")) return; // idempotent
    var wrap = document.createElement("div");
    wrap.id = "rbacRoleSwitcher";
    wrap.className = "rbac-switcher";
    wrap.title = "DEV: switch your logged-in role to preview UI gating";
    var current = window.RBAC.getCurrentUser();
    var opts = window.RBAC.MockUsers.map(function(u){
      var meta = window.RBAC.RoleMeta[u.globalRole];
      var sel = u.id === current.id ? " selected" : "";
      return '<option value="' + u.id + '"' + sel + '>' + u.name + ' — ' + meta.label + '</option>';
    }).join("");
    wrap.innerHTML =
      '<span class="rbac-switcher-label"><i class="fa-solid fa-user-shield"></i> Role</span>' +
      '<select id="rbacRoleSelect">' + opts + '</select>' +
      '<span id="rbacCurrentBadge">' + badge(current.globalRole) + '</span>';

    (anchor || document.body).appendChild(wrap);
    document.getElementById("rbacRoleSelect").addEventListener("change", function(e){
      window.RBAC.setCurrentUser(e.target.value);
      // Soft refresh of gated UI across the page
      applyAll();
      var u = window.RBAC.getCurrentUser();
      document.getElementById("rbacCurrentBadge").innerHTML = badge(u.globalRole);
    });
  }

  // Wire up on load + re-apply on role change
  function onReady(fn){
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }
  onReady(function(){
    applyAll();
    injectRoleSwitcher();
    if (window.RBAC && typeof window.RBAC.subscribe === "function") {
      window.RBAC.subscribe(function(){ applyAll(); });
    }
    // Re-apply on dynamic DOM (debounced)
    var t = null;
    var mo = new MutationObserver(function(){
      clearTimeout(t);
      t = setTimeout(function(){ applyAll(); }, 120);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  });

  window.RBACUI = { gate: gate, applyAll: applyAll, badge: badge, injectRoleSwitcher: injectRoleSwitcher };
})();
