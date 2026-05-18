// task-likes.js
// Like/Favourite functionality for individual tasks
// Stores likes as task.likes = [{userId, userName, likedAt}]
(function () {
  'use strict';

  // ─── CSS ───────────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '.tl-like-btn { position:relative; display:inline-flex; align-items:center; gap:4px; cursor:pointer; }',
    '.tl-like-btn i { font-size:15px; transition:color .15s,transform .15s; }',
    '.tl-like-btn.liked i { color:#e53e3e; }',
    '.tl-like-btn:not(.liked) i { color:var(--text-muted,#9ca3af); }',
    '.tl-like-btn:hover i { transform:scale(1.2); }',
    '.tl-like-count { font-size:12px; font-weight:600; color:var(--text-secondary,#6b7280); min-width:12px; }',
    '.tl-like-btn.liked .tl-like-count { color:#e53e3e; }',
    '.tl-likes-popover { position:absolute; top:calc(100% + 6px); right:0; background:var(--bg-secondary,#fff); border:1px solid var(--border-color,#e5e7eb); border-radius:10px; padding:10px 14px; min-width:160px; max-width:240px; box-shadow:0 4px 16px rgba(0,0,0,.15); z-index:9999; font-size:13px; color:var(--text-primary,#111); }',
    '.tl-likes-popover .tl-pop-title { font-weight:700; margin-bottom:8px; color:var(--text-secondary,#6b7280); font-size:11px; text-transform:uppercase; letter-spacing:.5px; }',
    '.tl-likes-popover .tl-pop-item { display:flex; align-items:center; gap:8px; padding:3px 0; }',
    '.tl-likes-popover .tl-pop-avatar { width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; color:#fff; flex-shrink:0; }',
    '.tl-likes-popover .tl-pop-name { color:var(--text-primary,#111); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
    '.tl-likes-popover .tl-pop-empty { color:var(--text-muted,#9ca3af); font-style:italic; }',
    '#ntmFavBtn.liked i { color:#e53e3e !important; }',
    '#ntmFavBtn .tl-like-count { font-size:11px; font-weight:700; margin-left:2px; }',
    '#ntmFavBtn.liked .tl-like-count { color:#e53e3e; }',
    '#tdpLikeBtn { position:relative; }',
  ].join('\n');
  document.head.appendChild(style);

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function currentUserId() { return window.state && window.state.currentUserId; }
  function currentUserName() {
    var s = window.state; if (!s) return 'User';
    var m = (s.members || []).find(function(m){ return m.id === s.currentUserId; });
    return m ? m.name : (s.currentUserId || 'User');
  }
  function avatarColor(name) {
    var colors = ['#667eea','#48bb78','#ed8936','#e53e3e','#9f7aea','#38b2ac','#f6ad55'];
    if (!name) return colors[0];
    var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
    return colors[h % colors.length];
  }
  function getInitials(name) {
    if (!name) return '?';
    var parts = name.trim().split(' ').filter(Boolean);
    return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // ─── Core toggle ───────────────────────────────────────────────────────────
  async function toggleLike(taskId) {
    var s = window.state; if (!s) return null;
    var task = (s.tasks || []).find(function(t) { return t.id === taskId; });
    if (!task) return null;
    if (!Array.isArray(task.likes)) task.likes = [];
    var uid = currentUserId();
    var existingIdx = task.likes.findIndex(function(l) { return l.userId === uid; });
    if (existingIdx !== -1) {
      task.likes.splice(existingIdx, 1);
    } else {
      task.likes.push({ userId: uid, userName: currentUserName(), likedAt: new Date().toISOString() });
    }
    task.modifiedDate = new Date().toISOString();
    try { await window.ShadowDB.Tasks.update(task); } catch(e) { console.warn('likes save error:', e); }
    if (window.ShadowDB && window.ShadowDB.Tasks) {
      s.tasks = await window.ShadowDB.Tasks.getAll();
    }
    return (s.tasks || []).find(function(t) { return t.id === taskId; }) || task;
  }

  // ─── Popover ───────────────────────────────────────────────────────────────
  function showLikesPopover(btn, likes) {
    document.querySelectorAll('.tl-likes-popover').forEach(function(p) { p.remove(); });
    var pop = document.createElement('div');
    pop.className = 'tl-likes-popover';
    if (!likes || !likes.length) {
      pop.innerHTML = '<div class="tl-pop-title">Likes</div><div class="tl-pop-empty">No likes yet</div>';
    } else {
      pop.innerHTML = '<div class="tl-pop-title">Liked by ' + likes.length + ' ' +
        (likes.length === 1 ? 'person' : 'people') + '</div>' +
        likes.map(function(l) {
          var col = avatarColor(l.userName);
          var ini = getInitials(l.userName);
          return '<div class="tl-pop-item"><div class="tl-pop-avatar" style="background:' + col + '">' + ini +
            '</div><span class="tl-pop-name">' + (l.userName || 'Unknown') + '</span></div>';
        }).join('');
    }
    btn.appendChild(pop);
    function outsideClick(e) {
      if (!btn.contains(e.target)) {
        pop.remove();
        document.removeEventListener('click', outsideClick, true);
      }
    }
    setTimeout(function() { document.addEventListener('click', outsideClick, true); }, 0);
  }

  // ─── ntmFavBtn (new task creation modal heart button) ─────────────────────
  var _pendingLikeOnCreate = false;

  function wireNtmFavBtn() {
    var btn = document.getElementById('ntmFavBtn');
    if (!btn || btn.dataset.likeWired) return;
    btn.dataset.likeWired = '1';
    // Add count span
    if (!btn.querySelector('.tl-like-count')) {
      var cnt = document.createElement('span');
      cnt.className = 'tl-like-count';
      cnt.style.display = 'none';
      btn.appendChild(cnt);
    }
    btn.addEventListener('click', async function(e) {
      e.stopPropagation();
      var taskId = btn.dataset.taskId;
      if (taskId) {
        var task = await toggleLike(taskId);
        if (task) updateNtmFavBtnState(task);
      } else {
        _pendingLikeOnCreate = !_pendingLikeOnCreate;
        updateNtmFavBtnPending(_pendingLikeOnCreate);
      }
    });
    // Right-click shows popover for existing task
    btn.addEventListener('contextmenu', function(e) {
      e.preventDefault(); e.stopPropagation();
      var taskId = btn.dataset.taskId;
      if (!taskId) return;
      var task = window.state && (window.state.tasks || []).find(function(t) { return t.id === taskId; });
      showLikesPopover(btn, task && task.likes || []);
    });
  }

  function updateNtmFavBtnState(task) {
    var btn = document.getElementById('ntmFavBtn');
    if (!btn) return;
    var uid = currentUserId();
    var likes = Array.isArray(task.likes) ? task.likes : [];
    var liked = likes.some(function(l) { return l.userId === uid; });
    btn.classList.toggle('liked', liked);
    var icon = btn.querySelector('i');
    if (icon) icon.className = liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    var cnt = btn.querySelector('.tl-like-count');
    if (cnt) {
      cnt.textContent = likes.length > 0 ? String(likes.length) : '';
      cnt.style.display = likes.length > 0 ? 'inline' : 'none';
    }
    btn.title = liked ? 'Unlike (' + likes.length + ' likes)' : 'Like (' + likes.length + ' likes)';
  }

  function updateNtmFavBtnPending(pending) {
    var btn = document.getElementById('ntmFavBtn');
    if (!btn) return;
    btn.classList.toggle('liked', pending);
    var icon = btn.querySelector('i');
    if (icon) icon.className = pending ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    btn.title = pending ? 'Will like on save' : 'Like';
  }

  function resetNtmFavBtn() {
    _pendingLikeOnCreate = false;
    var btn = document.getElementById('ntmFavBtn');
    if (!btn) return;
    delete btn.dataset.taskId;
    btn.classList.remove('liked');
    var icon = btn.querySelector('i');
    if (icon) icon.className = 'fa-regular fa-heart';
    btn.title = 'Like';
    var cnt = btn.querySelector('.tl-like-count');
    if (cnt) { cnt.style.display = 'none'; cnt.textContent = ''; }
  }

  // ─── Task Detail Panel like button ────────────────────────────────────────
  function ensureDetailLikeBtn() {
    if (document.getElementById('tdpLikeBtn')) return;
    var header = document.querySelector('#taskDetailPanel .tdp-header-actions');
    if (!header) return;
    var closeBtn = document.getElementById('detailCloseBtn');
    var likeBtn = document.createElement('button');
    likeBtn.className = 'icon-btn tl-like-btn';
    likeBtn.id = 'tdpLikeBtn';
    likeBtn.title = 'Like this task';
    likeBtn.innerHTML = '<i class="fa-regular fa-heart"></i><span class="tl-like-count" style="display:none"></span>';
    if (closeBtn) {
      header.insertBefore(likeBtn, closeBtn);
    } else {
      header.appendChild(likeBtn);
    }
    likeBtn.addEventListener('click', async function(e) {
      e.stopPropagation();
      // Close popover if open
      var existingPop = likeBtn.querySelector('.tl-likes-popover');
      if (existingPop) { existingPop.remove(); return; }
      var taskId = getDetailTaskId();
      if (!taskId) return;
      var task = await toggleLike(taskId);
      if (task) updateDetailLikeBtn(task);
    });
    // Click on count span shows who liked
    var cnt = likeBtn.querySelector('.tl-like-count');
    if (cnt) {
      cnt.addEventListener('click', function(e) {
        e.stopPropagation();
        var taskId = getDetailTaskId();
        var task = taskId && window.state && (window.state.tasks || []).find(function(t) { return t.id === taskId; });
        showLikesPopover(likeBtn, task && task.likes || []);
      });
    }
  }

  function getDetailTaskId() {
    var titleEl = document.getElementById('detailTitle');
    if (titleEl && titleEl.dataset.id) return titleEl.dataset.id;
    return window.state && window.state.selectedTaskId;
  }

  function updateDetailLikeBtn(task) {
    var likeBtn = document.getElementById('tdpLikeBtn');
    if (!likeBtn) return;
    var uid = currentUserId();
    var likes = Array.isArray(task.likes) ? task.likes : [];
    var liked = likes.some(function(l) { return l.userId === uid; });
    likeBtn.classList.toggle('liked', liked);
    var icon = likeBtn.querySelector('i');
    if (icon) icon.className = liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    var cnt = likeBtn.querySelector('.tl-like-count');
    if (cnt) {
      cnt.textContent = likes.length > 0 ? String(likes.length) : '';
      cnt.style.display = likes.length > 0 ? 'inline' : 'none';
    }
    likeBtn.title = liked
      ? 'Unlike · ' + likes.length + ' like' + (likes.length !== 1 ? 's' : '') + ' (click count to see who liked)'
      : 'Like · ' + likes.length + ' like' + (likes.length !== 1 ? 's' : '');
  }

  // ─── Patch showTaskDetail ──────────────────────────────────────────────────
  var _origShowTaskDetail = window.showTaskDetail;
  window.showTaskDetail = function(taskId, source) {
    if (_origShowTaskDetail) _origShowTaskDetail.apply(this, arguments);
    setTimeout(function() {
      ensureDetailLikeBtn();
      var task = window.state && (window.state.tasks || []).find(function(t) { return t.id === taskId; });
      if (task) updateDetailLikeBtn(task);
    }, 60);
  };

  // ─── Patch ntmResetAndOpen* to reset heart btn ────────────────────────────
  var _origNtmResetAndOpen = window.ntmResetAndOpen;
  window.ntmResetAndOpen = function() {
    if (_origNtmResetAndOpen) _origNtmResetAndOpen.apply(this, arguments);
    resetNtmFavBtn();
  };
  var _origNtmResetAndOpenWith = window.ntmResetAndOpenWith;
  window.ntmResetAndOpenWith = function(opts) {
    if (_origNtmResetAndOpenWith) _origNtmResetAndOpenWith.apply(this, arguments);
    resetNtmFavBtn();
  };

  // ─── Patch ShadowDB.Tasks.create to handle pending like ───────────────────
  function patchCreate() {
    if (!window.ShadowDB || !window.ShadowDB.Tasks || !window.ShadowDB.Tasks.create) return;
    if (window.ShadowDB.Tasks._likesPatched) return;
    window.ShadowDB.Tasks._likesPatched = true;
    var _origCreate = window.ShadowDB.Tasks.create;
    window.ShadowDB.Tasks.create = async function(task) {
      if (!Array.isArray(task.likes)) task.likes = [];
      if (_pendingLikeOnCreate) {
        task.likes.push({ userId: currentUserId(), userName: currentUserName(), likedAt: new Date().toISOString() });
        _pendingLikeOnCreate = false;
      }
      return _origCreate.apply(this, arguments);
    };
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  function boot() {
    wireNtmFavBtn();
    ensureDetailLikeBtn();
    patchCreate();
    // Update if detail panel already open
    if (window.state && window.state.selectedTaskId) {
      var task = (window.state.tasks || []).find(function(t) { return t.id === window.state.selectedTaskId; });
      if (task) updateDetailLikeBtn(task);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 500); });
  } else {
    setTimeout(boot, 500);
  }

  // Expose for debugging
  window.TaskLikes = {
    toggleLike: toggleLike,
    updateDetailLikeBtn: updateDetailLikeBtn,
    showLikesPopover: showLikesPopover
  };
})();
