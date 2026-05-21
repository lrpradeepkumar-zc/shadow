/* ===== TASK TEMPLATES FEATURE - ZOHO TODO v2.0 ===== */
(function () {
'use strict';

/* ---------- CONSTANTS ---------- */
var STORE_KEY = 'shadow_templates';
var MAX_SUB = 20, MAX_SHARE = 50, MAX_NAME = 100;

/* ---------- INJECT CSS ---------- */
function tmInjectCSS() {
  if (document.getElementById('tm-styles')) return;
  var css = [
    '/* === TASK TEMPLATES STYLES === */',
    '#tm-sidebar-section{margin-bottom:8px}',
    '#tm-sidebar-item{padding:8px 16px;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:10px;color:var(--text-secondary);border-left:3px solid transparent}',
    '#tm-sidebar-item:hover{background:var(--bg-hover)}',
    '#tm-sidebar-item.active{background:var(--bg-tertiary);color:var(--text-primary);border-left-color:var(--accent-blue)}',
    '#tm-sidebar-item i{width:16px;text-align:center;font-size:14px}',
    '#tm-sidebar-item .tm-count{margin-left:auto;font-size:12px;color:var(--text-muted)}',
    '.tm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;animation:tmFadeIn 0.15s ease}',
    '@keyframes tmFadeIn{from{opacity:0}to{opacity:1}}',
    '.tm-library{background:var(--bg-primary);border-radius:12px;width:1100px;max-width:96vw;height:86vh;display:flex;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.25);position:relative}',
    '.tm-lib-sidebar{width:220px;flex-shrink:0;background:var(--bg-secondary);border-right:1px solid var(--border-color);display:flex;flex-direction:column;padding:16px 0}',
    '.tm-lib-sidebar-logo{padding:8px 16px 16px;font-size:15px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px}',
    '.tm-lib-sidebar-logo i{color:var(--accent-blue)}',
    '.tm-lib-nav-item{padding:8px 16px;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:8px;color:var(--text-secondary);border-left:3px solid transparent}',
    '.tm-lib-nav-item:hover{background:var(--bg-hover);color:var(--text-primary)}',
    '.tm-lib-nav-item.active{background:var(--bg-tertiary);color:var(--accent-blue);border-left-color:var(--accent-blue);font-weight:500}',
    '.tm-lib-nav-item .tm-lib-badge{margin-left:auto;background:var(--accent-blue);color:white;font-size:10px;border-radius:10px;padding:1px 6px;font-weight:600}',
    '.tm-lib-divider{margin:8px 16px;border:none;border-top:1px solid var(--border-color)}',
    '.tm-library-main{flex:1;display:flex;flex-direction:column;min-width:0}',
    '.tm-library-header{padding:16px 24px 0;border-bottom:1px solid var(--border-color)}',
    '.tm-lib-toolbar{display:flex;align-items:center;gap:12px;padding:0 0 12px;flex-wrap:wrap}',
    '.tm-search-box{display:flex;align-items:center;gap:8px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;padding:6px 12px;flex:1;max-width:320px}',
    '.tm-search-box i{color:var(--text-muted);font-size:12px}',
    '.tm-search-box input{background:none;border:none;outline:none;color:var(--text-primary);font-size:13px;width:100%}',
    '.tm-filter-tabs{display:flex;gap:0;border-bottom:2px solid transparent}',
    '.tm-filter-tab{padding:8px 16px;font-size:13px;cursor:pointer;color:var(--text-secondary);border-bottom:2px solid transparent;margin-bottom:-2px;white-space:nowrap}',
    '.tm-filter-tab:hover{color:var(--text-primary)}',
    '.tm-filter-tab.active{color:var(--accent-blue);border-bottom-color:var(--accent-blue);font-weight:500}',
    '.tm-sort-btn{display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;cursor:pointer;font-size:12px;color:var(--text-secondary);white-space:nowrap;position:relative}',
    '.tm-sort-btn:hover{background:var(--bg-hover)}',
    '.tm-sort-dropdown{position:absolute;top:100%;right:0;margin-top:4px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:100;min-width:160px;overflow:hidden}',
    '.tm-sort-opt{padding:10px 16px;font-size:13px;cursor:pointer;color:var(--text-secondary)}',
    '.tm-sort-opt:hover{background:var(--bg-hover)}',
    '.tm-sort-opt.active{color:var(--accent-blue);font-weight:500}',
    '.tm-new-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;background:var(--accent-blue);color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;white-space:nowrap;margin-left:auto}',
    '.tm-new-btn:hover{opacity:0.9}',
    '.tm-library-body{flex:1;display:flex;overflow:hidden}',
    '.tm-grid-panel{flex:1;overflow-y:auto;padding:16px 20px}',
    '.tm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}',
    '.tm-card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:16px;cursor:pointer;transition:all 0.15s;position:relative}',
    '.tm-card:hover{border-color:var(--accent-blue);box-shadow:0 4px 12px rgba(0,0,0,0.08)}',
    '.tm-card.selected{border-color:var(--accent-blue);box-shadow:0 0 0 2px rgba(26,115,232,0.2)}',
    '.tm-card-header{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}',
    '.tm-card-emoji{font-size:24px;flex-shrink:0;line-height:1}',
    '.tm-card-info{flex:1;min-width:0}',
    '.tm-card-name{font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.tm-card-desc{font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}',
    '.tm-card-fav{position:absolute;top:10px;right:10px;background:none;border:none;cursor:pointer;font-size:14px;color:var(--text-muted);padding:4px}',
    '.tm-card-fav:hover,.tm-card-fav.active{color:#f59e0b}',
    '.tm-card-meta{display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:11px;color:var(--text-muted)}',
    '.tm-card-meta i{font-size:10px}',
    '.tm-card-tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px}',
    '.tm-tag{background:var(--bg-tertiary);color:var(--text-secondary);padding:2px 8px;border-radius:10px;font-size:11px}',
    '.tm-card-actions{display:flex;gap:6px}',
    '.tm-btn-primary{flex:1;padding:7px 12px;background:var(--accent-blue);color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500}',
    '.tm-btn-primary:hover{opacity:0.9}',
    '.tm-btn-secondary{flex:1;padding:7px 12px;background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color);border-radius:6px;cursor:pointer;font-size:12px}',
    '.tm-btn-secondary:hover{background:var(--bg-hover);color:var(--text-primary)}',
    '.tm-icon-btn{background:none;border:1px solid var(--border-color);border-radius:6px;cursor:pointer;color:var(--text-muted);padding:7px 9px;font-size:12px;display:flex;align-items:center}',
    '.tm-icon-btn:hover{background:var(--bg-hover);color:var(--text-primary)}',
    '.tm-icon-btn.danger:hover{color:#e53935}',
    '.tm-preview-panel{width:340px;flex-shrink:0;border-left:1px solid var(--border-color);display:flex;flex-direction:column;background:var(--bg-secondary)}',
    '.tm-preview-header{padding:16px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:8px}',
    '.tm-preview-title{font-size:14px;font-weight:600;color:var(--text-primary);flex:1}',
    '.tm-preview-body{flex:1;overflow-y:auto;padding:16px}',
    '.tm-preview-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted);text-align:center;gap:10px}',
    '.tm-preview-empty i{font-size:32px}',
    '.tm-preview-empty-text{font-size:13px}',
    '.tm-preview-name{font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:4px}',
    '.tm-preview-meta{font-size:12px;color:var(--text-muted);margin-bottom:12px;display:flex;gap:12px;flex-wrap:wrap}',
    '.tm-preview-desc{font-size:13px;color:var(--text-secondary);margin-bottom:14px;padding:10px;background:var(--bg-tertiary);border-radius:6px;line-height:1.5}',
    '.tm-preview-tasks-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted);margin-bottom:8px}',
    '.tm-task-tree{display:flex;flex-direction:column;gap:4px}',
    '.tm-tree-parent{background:var(--bg-tertiary);border-radius:6px;padding:8px 10px;font-size:13px;font-weight:500;color:var(--text-primary);display:flex;align-items:center;gap:8px}',
    '.tm-tree-sub{padding:5px 10px 5px 28px;font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:6px}',
    '.tm-preview-actions{padding:12px 16px;border-top:1px solid var(--border-color);display:flex;gap:8px}',
    '.tm-preview-actions .tm-btn-primary{flex:1}',
    '.tm-preview-readonly-badge{background:#f59e0b22;color:#b45309;font-size:11px;border-radius:4px;padding:2px 6px;font-weight:500}',
    '.tm-empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center;color:var(--text-muted)}',
    '.tm-empty-icon{font-size:48px;margin-bottom:16px;opacity:0.5}',
    '.tm-empty-title{font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:8px}',
    '.tm-empty-sub{font-size:13px;color:var(--text-muted);margin-bottom:20px;max-width:300px;line-height:1.5}',
    '.tm-empty-state .tm-new-btn{margin-left:0}',
    '.tm-modal{background:var(--bg-primary);border-radius:12px;width:680px;max-width:95vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.25);animation:tmSlideUp 0.2s ease}',
    '@keyframes tmSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}',
    '.tm-modal-header{padding:20px 24px 16px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:10px}',
    '.tm-modal-title{font-size:16px;font-weight:600;color:var(--text-primary);flex:1}',
    '.tm-modal-close{background:none;border:none;cursor:pointer;color:var(--text-secondary);font-size:18px;padding:4px 8px;border-radius:4px}',
    '.tm-modal-close:hover{background:var(--bg-hover)}',
    '.tm-modal-body{flex:1;overflow-y:auto;padding:20px 24px}',
    '.tm-modal-footer{padding:16px 24px;border-top:1px solid var(--border-color);display:flex;gap:8px;justify-content:flex-end}',
    '.tm-field-row{margin-bottom:16px}',
    '.tm-field-row label{display:block;font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:.4px}',
    '.tm-input{width:100%;padding:9px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;outline:none;box-sizing:border-box}',
    '.tm-input:focus{border-color:var(--accent-blue)}',
    '.tm-select{width:100%;padding:9px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;outline:none;cursor:pointer}',
    '.tm-textarea{width:100%;padding:9px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;outline:none;resize:vertical;min-height:80px;box-sizing:border-box;font-family:inherit}',
    '.tm-textarea:focus{border-color:var(--accent-blue)}',
    '.tm-subtask-section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}',
    '.tm-subtask-section-label{font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.4px}',
    '.tm-subtask-list{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}',
    '.tm-sub-row{display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg-tertiary);border-radius:6px;border:1px solid transparent}',
    '.tm-sub-row:hover{border-color:var(--border-color)}',
    '.tm-sub-row.dragging{opacity:0.5;border:2px dashed var(--accent-blue)}',
    '.tm-sub-row.drag-over{border-color:var(--accent-blue);background:rgba(26,115,232,0.05)}',
    '.tm-drag-handle{color:var(--text-muted);cursor:grab;font-size:11px;padding:2px}',
    '.tm-sub-input{flex:1;background:none;border:none;outline:none;color:var(--text-primary);font-size:13px}',
    '.tm-sub-pri{padding:2px 6px;border-radius:4px;background:var(--bg-secondary);border:1px solid var(--border-color);color:var(--text-secondary);font-size:11px;cursor:pointer}',
    '.tm-sub-remove{background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:12px;padding:2px 4px;border-radius:3px}',
    '.tm-sub-remove:hover{color:#e53935}',
    '.tm-add-sub-btn{display:flex;align-items:center;gap:6px;padding:7px 12px;background:none;border:1px dashed var(--border-color);border-radius:6px;cursor:pointer;font-size:12px;color:var(--text-muted);width:100%}',
    '.tm-add-sub-btn:hover{border-color:var(--accent-blue);color:var(--accent-blue);background:rgba(26,115,232,0.03)}',
    '.tm-alert-info{display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(26,115,232,0.08);border:1px solid rgba(26,115,232,0.2);border-radius:6px;font-size:12px;color:var(--accent-blue,#1a73e8);margin-top:12px}',
    '.tm-alert-warn{display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(234,67,53,0.08);border:1px solid rgba(234,67,53,0.2);border-radius:6px;font-size:12px;color:#e53935;margin-top:8px}',
    '.tm-name-counter{float:right;color:var(--text-muted);font-size:11px}',
    '.tm-char-limit{color:#e53935}',
    '.tm-tab-bar{display:flex;gap:0;border-bottom:1px solid var(--border-color);margin-bottom:20px}',
    '.tm-tab{padding:8px 16px;font-size:13px;cursor:pointer;color:var(--text-secondary);border-bottom:2px solid transparent;margin-bottom:-1px}',
    '.tm-tab:hover{color:var(--text-primary)}',
    '.tm-tab.active{color:var(--accent-blue);border-bottom-color:var(--accent-blue);font-weight:500}',
    '.tm-tab-panel{display:none}',
    '.tm-tab-panel.active{display:block}',
    '.tm-ai-box{background:linear-gradient(135deg,rgba(26,115,232,0.06),rgba(103,58,183,0.06));border:1px solid rgba(26,115,232,0.2);border-radius:10px;padding:20px}',
    '.tm-ai-title{font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px;display:flex;align-items:center;gap:8px}',
    '.tm-ai-subtitle{font-size:12px;color:var(--text-muted);margin-bottom:14px}',
    '.tm-ai-input-row{display:flex;gap:8px}',
    '.tm-ai-input{flex:1;padding:10px 14px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;outline:none}',
    '.tm-ai-input:focus{border-color:var(--accent-blue)}',
    '.tm-ai-generate-btn{padding:10px 18px;background:var(--accent-blue);color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;white-space:nowrap;display:flex;align-items:center;gap:6px}',
    '.tm-ai-generate-btn:hover{opacity:0.9}',
    '.tm-ai-generate-btn:disabled{opacity:0.6;cursor:not-allowed}',
    '.tm-ai-result{margin-top:16px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:8px;padding:14px}',
    '.tm-ai-result-title{font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px}',
    '.tm-ai-result-tasks{display:flex;flex-direction:column;gap:4px}',
    '.tm-ai-result-parent{font-size:13px;color:var(--text-primary);font-weight:500;display:flex;align-items:center;gap:6px}',
    '.tm-ai-result-sub{font-size:12px;color:var(--text-secondary);padding-left:18px;display:flex;align-items:center;gap:6px}',
    '.tm-ai-spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:tmSpin 0.8s linear infinite}',
    '@keyframes tmSpin{to{transform:rotate(360deg)}}',
    '.tm-ai-example-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}',
    '.tm-ai-chip{padding:4px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;font-size:11px;cursor:pointer;color:var(--text-secondary)}',
    '.tm-ai-chip:hover{border-color:var(--accent-blue);color:var(--accent-blue);background:rgba(26,115,232,0.05)}',
    '.tm-apply-preview-list{display:flex;flex-direction:column;gap:6px;margin:16px 0;max-height:250px;overflow-y:auto}',
    '.tm-apply-task-row{padding:10px 14px;background:var(--bg-tertiary);border-radius:6px;border:1px solid var(--border-color)}',
    '.tm-apply-task-title{font-size:13px;font-weight:500;color:var(--text-primary);display:flex;align-items:center;gap:8px;margin-bottom:4px}',
    '.tm-apply-task-meta{display:flex;gap:8px;font-size:11px;color:var(--text-muted)}',
    '.tm-apply-sub-row{padding:6px 14px 6px 28px;font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:6px}',
    '.tm-apply-options{background:var(--bg-secondary);border-radius:8px;padding:14px;margin-bottom:16px}',
    '.tm-apply-options-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);margin-bottom:10px}',
    '.tm-apply-option-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}',
    '.tm-apply-option-label{font-size:13px;color:var(--text-secondary);min-width:100px}',
    '.tm-share-recipient-list{display:flex;flex-wrap:wrap;gap:6px;padding:10px 0;min-height:44px;border-bottom:1px solid var(--border-color);margin-bottom:12px}',
    '.tm-share-chip{display:flex;align-items:center;gap:6px;background:rgba(26,115,232,0.1);color:var(--accent-blue,#1a73e8);padding:4px 10px;border-radius:12px;font-size:12px}',
    '.tm-share-chip button{background:none;border:none;cursor:pointer;color:inherit;font-size:10px;padding:0;margin-left:2px}',
    '.tm-share-select-box{width:100%;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);padding:9px 12px;font-size:13px;outline:none;height:160px}',
    '.tm-share-limit-warn{color:#e53935;font-size:12px;margin-top:4px}',
    '.tm-share-readonly-note{display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:6px;font-size:12px;color:#92400e;margin-top:12px}',
    '.tm-toast-wrap{position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none}',
    '.tm-toast{padding:12px 18px;border-radius:8px;font-size:13px;font-weight:500;color:white;box-shadow:0 4px 12px rgba(0,0,0,0.2);animation:tmToastIn 0.3s ease;pointer-events:auto}',
    '.tm-toast.success{background:#34a853}.tm-toast.error{background:#ea4335}.tm-toast.info{background:#1a73e8}',
    '@keyframes tmToastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}',
    '#tm-ntm-btn{display:flex;align-items:center;gap:5px;padding:5px 10px;background:linear-gradient(135deg,var(--accent-blue,#1a73e8),#6750e4);color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:500;margin-right:4px}',
    '#tm-ntm-btn:hover{opacity:0.9}',
    '#tm-ntm-btn i{font-size:11px}',
    '.tm-ctx-menu{position:fixed;background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:9999;min-width:200px;overflow:hidden}',
    '.tm-ctx-item{padding:10px 16px;font-size:13px;cursor:pointer;color:var(--text-secondary);display:flex;align-items:center;gap:8px}',
    '.tm-ctx-item:hover{background:var(--bg-hover);color:var(--text-primary)}',
    '.tm-ctx-item i{width:16px}',
    '.tm-edit-hint{font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px}',
    '.tm-lib-section{padding:16px 16px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text-muted)}',
    '.tm-lib-sidebar-item{padding:7px 16px;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:8px;color:var(--text-secondary)}',
    '.tm-lib-sidebar-item:hover{background:var(--bg-hover);color:var(--text-primary)}',
    '.tm-lib-sidebar-item.active{color:var(--accent-blue);font-weight:500}',
    '.tm-modal-corner-close{position:absolute;top:12px;right:14px;background:none;border:none;cursor:pointer;font-size:20px;color:var(--text-secondary);line-height:1;padding:4px 6px;border-radius:4px;z-index:10}',
    '.tm-modal-corner-close:hover{background:var(--bg-hover)}'
  ].join('\n');
  var style = document.createElement('style');
  style.id = 'tm-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

/* ---------- UTILITY FUNCTIONS ---------- */
function tmUid() { return 'tpl_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }
function tmEsc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function tmGetUserId() { return (window.state||{}).currentUserId || 'guest'; }
function tmGetUserName() { return (window.state||{}).currentUserName || 'You'; }
function tmGetGroups() { return (window.state||{}).groups || []; }
function tmGetMembers() { return (window.state||{}).members || []; }
function tmPriColor(p) { return {high:'#e53935',medium:'#f59f00',low:'#1a73e8',none:'#9ca3af'}[p||'none']||'#9ca3af'; }
function tmPriLabel(p) { return {high:'High',medium:'Medium',low:'Low',none:'None'}[p||'none']||'None'; }
function tmCanEdit(tpl) { return tpl.createdBy === tmGetUserId(); }
function tmIsGroupAdmin(g) { var uid = tmGetUserId(); if (!g) return false; if (g.createdBy === uid) return true; var ad = g.adminIds || []; return ad.indexOf(uid) > -1; }
function tmCanCreateTemplate() {
  if (TM.activeFilter !== 'group') return true;
  var gid = TM.selectedGroupId; if (!gid) return false;
  var g = tmGetGroups().find(function(x) { return x.id === gid; });
  return tmIsGroupAdmin(g);
}
function tmCanDeleteTemplate(t) {
  if (!t) return false;
  var uid = tmGetUserId();
  if (t.createdBy === uid) return true;
  var sw = t.sharedWith || [];
  var groupShare = sw.find(function(s) { return s.type === 'group'; });
  if (groupShare) {
    var g = tmGetGroups().find(function(x) { return x.id === groupShare.id; });
    return tmIsGroupAdmin(g);
  }
  return false;
}

/* ---------- TOAST ---------- */
function tmShowToast(msg, type) {
  type = type || 'success';
  var w = document.getElementById('tm-toast-wrap');
  if (!w) { w = document.createElement('div'); w.id = 'tm-toast-wrap'; w.className = 'tm-toast-wrap'; document.body.appendChild(w); }
  var t = document.createElement('div'); t.className = 'tm-toast ' + type; t.textContent = msg; w.appendChild(t);
  setTimeout(function() { t.style.transition = 'opacity 0.3s'; t.style.opacity = '0'; setTimeout(function() { t.remove(); }, 300); }, 3000);
}

/* ---------- STORAGE / TM OBJECT ---------- */
var STORE_KEY_LOCAL = 'shadow_templates';
window.TM = {
  templates: [], searchQuery: '', activeFilter: 'all', activeSort: 'recent', previewId: null, selectedGroupId: null,
  MAX_SUB: MAX_SUB, MAX_SHARE: MAX_SHARE, MAX_NAME: MAX_NAME,
  load: function() {
    var self = this;
    if (window.ShadowDB && ShadowDB._sb) {
      ShadowDB._sb.from('templates').select('*').then(function(res) {
        if (res.data) {
          self.templates = res.data.map(function(t) {
            return { id: t.id, name: t.name, emoji: t.emoji || '', description: t.description || '', priority: t.priority || 'medium', tags: t.tags || [], subtasks: t.subtasks || [], isFavourite: t.is_favourite || false, source: t.source || 'custom', ownerId: t.owner_id, createdBy: t.created_by, createdByName: t.created_by_name || '' };
          });
        } else {
          self.templates = JSON.parse(localStorage.getItem(STORE_KEY_LOCAL) || '[]');
        }
        if (typeof tmRender === 'function') tmRender();
        tmUpdateSidebarCount();
      });
    } else {
      self.templates = JSON.parse(localStorage.getItem(STORE_KEY_LOCAL) || '[]');
      tmUpdateSidebarCount();
    }
  },
  save: function() {
    var self = this;
    localStorage.setItem(STORE_KEY_LOCAL, JSON.stringify(this.templates));
    tmUpdateSidebarCount();
    if (window.ShadowDB && ShadowDB._sb) {
      var userId = (window.__shadowSession && __shadowSession.uid) || null;
      var upsertData = this.templates.map(function(t) {
        return { id: t.id, owner_id: t.ownerId || userId, name: t.name, emoji: t.emoji || '', description: t.description || '', priority: t.priority || 'medium', tags: t.tags || [], subtasks: t.subtasks || [], is_favourite: t.isFavourite || false, source: t.source || 'custom', created_by: t.createdBy || userId, created_by_name: t.createdByName || '' };
      });
      ShadowDB._sb.from('templates').upsert(upsertData, { onConflict: 'id' }).then(function(res) { if (res.error) console.warn('[TM] save error:', res.error.message); });
    }
  },
  find: function(id) { return this.templates.find(function(t) { return t.id === id; }); },
  create: function(data) {
    var subs = (data.subtasks || []).filter(function(s) { return s.title && s.title.trim(); }).slice(0, MAX_SUB);
    var tpl = { id: tmUid(), name: data.name, emoji: data.emoji || '\uD83D\uDCCB', description: data.description || '',
      priority: data.priority || 'none', tags: data.tags || [], subtasks: subs,
      createdBy: tmGetUserId(), createdByName: tmGetUserName(),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      isFavourite: false, sharedWith: [], source: data.source || 'manual' };
    this.templates.unshift(tpl); this.save(); return tpl;
  },
  update: function(id, data) {
    var idx = this.templates.findIndex(function(t) { return t.id === id; });
    if (idx < 0) return null;
    this.templates[idx] = Object.assign({}, this.templates[idx], data, { updatedAt: new Date().toISOString() });
    this.save(); return this.templates[idx];
  },
  delete: function(id) { this.templates = this.templates.filter(function(t) { return t.id !== id; }); this.save(); },
  toggleFav: function(id) { var t = this.find(id); if (t) { t.isFavourite = !t.isFavourite; this.save(); } },
  share: function(id, recipients) {
    var t = this.find(id); if (!t) return false;
    var merged = (t.sharedWith || []).slice();
    recipients.forEach(function(r) { if (!merged.find(function(e) { return e.id === r.id; })) merged.push(r); });
    if (merged.length > MAX_SHARE) { tmShowToast('Max ' + MAX_SHARE + ' recipients', 'error'); return false; }
    t.sharedWith = merged; this.save(); return true;
  },
  getFiltered: function() {
    var list = this.templates.slice(), uid = tmGetUserId();
    var q = (this.searchQuery || '').toLowerCase().trim();
    if (q) list = list.filter(function(t) { return t.name.toLowerCase().indexOf(q) > -1 || (t.description || '').toLowerCase().indexOf(q) > -1; });
    if (this.activeFilter === 'personal') list = list.filter(function(t) { return t.createdBy === uid && (!t.sharedWith || t.sharedWith.length === 0); });
    if (this.activeFilter === 'shared') list = list.filter(function(t) { var sw = t.sharedWith || []; if (!sw.length) return false; if (t.createdBy === uid) return true; return sw.some(function(s) { return s.id === uid; }); });
    if (this.activeFilter === 'group') { var selGid = this.selectedGroupId; list = list.filter(function(t) { var sw = t.sharedWith || []; if (!selGid) return false; return sw.some(function(s) { return s.type === 'group' && s.id === selGid; }); }); }
    if (this.activeSort === 'favourite') list.sort(function(a, b) { return (b.isFavourite ? 1 : 0) - (a.isFavourite ? 1 : 0); });
    else list.sort(function(a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); });
    return list;
  }
};

/* ---------- PRESET TEMPLATES ---------- */
window.PRESET_TEMPLATES = [
  {id:'pre_weekly',name:'Weekly Review',emoji:'\uD83D\uDDD3\uFE0F',description:'A GTD-friendly checklist to review your week.',priority:'medium',tags:['Review','Weekly'],createdByName:'Built-in',createdBy:'__preset',subtasks:[{id:'pw1',order:0,title:'Review completed tasks from last week',priority:'medium',tags:[],description:''},{id:'pw2',order:1,title:'Clear and process inbox',priority:'medium',tags:[],description:''},{id:'pw3',order:2,title:'Update project statuses',priority:'high',tags:[],description:''},{id:'pw4',order:3,title:'Set top 3 priorities for next week',priority:'high',tags:[],description:''},{id:'pw5',order:4,title:'Schedule key meetings and deadlines',priority:'medium',tags:[],description:''}]},
  {id:'pre_launch',name:'Product Launch',emoji:'\uD83D\uDE80',description:'Everything to ship a feature successfully.',priority:'high',tags:['Product','Launch'],createdByName:'Built-in',createdBy:'__preset',subtasks:[{id:'pl1',order:0,title:'Define launch goals and metrics',priority:'high',tags:[],description:''},{id:'pl2',order:1,title:'Finalize scope and release notes',priority:'high',tags:[],description:''},{id:'pl3',order:2,title:'QA testing and sign-off',priority:'high',tags:[],description:''},{id:'pl4',order:3,title:'Prepare marketing assets',priority:'medium',tags:[],description:''},{id:'pl5',order:4,title:'Deploy to production',priority:'high',tags:[],description:''},{id:'pl6',order:5,title:'Monitor post-launch metrics',priority:'medium',tags:[],description:''}]},
  {id:'pre_sprint',name:'Sprint Planning',emoji:'\u26A1',description:'Plan and kick off a productive sprint.',priority:'high',tags:['Sprint','Agile'],createdByName:'Built-in',createdBy:'__preset',subtasks:[{id:'sp1',order:0,title:'Review and prioritize backlog',priority:'high',tags:[],description:''},{id:'sp2',order:1,title:'Define sprint goal',priority:'high',tags:[],description:''},{id:'sp3',order:2,title:'Assign tasks to team members',priority:'medium',tags:[],description:''},{id:'sp4',order:3,title:'Estimate story points',priority:'medium',tags:[],description:''},{id:'sp5',order:4,title:'Set up sprint board',priority:'low',tags:[],description:''}]},
  {id:'pre_meeting',name:'Meeting Prep',emoji:'\uD83D\uDCAC',description:'Prepare for any important meeting.',priority:'medium',tags:['Meeting'],createdByName:'Built-in',createdBy:'__preset',subtasks:[{id:'mp1',order:0,title:'Define meeting agenda and goals',priority:'high',tags:[],description:''},{id:'mp2',order:1,title:'Send calendar invites to attendees',priority:'medium',tags:[],description:''},{id:'mp3',order:2,title:'Prepare materials and slides',priority:'medium',tags:[],description:''},{id:'mp4',order:3,title:'Review action items from previous meeting',priority:'low',tags:[],description:''}]},
  {id:'pre_onboard',name:'Employee Onboarding',emoji:'\uD83E\uDDD1\u200D\uD83D\uDCBC',description:'Onboard a new team member efficiently.',priority:'high',tags:['HR','Onboarding'],createdByName:'Built-in',createdBy:'__preset',subtasks:[{id:'ob1',order:0,title:'Set up accounts and credentials',priority:'high',tags:[],description:''},{id:'ob2',order:1,title:'Workspace setup',priority:'high',tags:[],description:''},{id:'ob3',order:2,title:'Intro meetings with team',priority:'medium',tags:[],description:''},{id:'ob4',order:3,title:'Share documentation and processes',priority:'medium',tags:[],description:''},{id:'ob5',order:4,title:'30-day check-in scheduled',priority:'low',tags:[],description:''}]},
  {id:'pre_bugfix',name:'Bug Fix Workflow',emoji:'\uD83D\uDC1B',description:'Structured workflow for fixing bugs.',priority:'high',tags:['Bug','Dev'],createdByName:'Built-in',createdBy:'__preset',subtasks:[{id:'bf1',order:0,title:'Reproduce the bug consistently',priority:'high',tags:[],description:''},{id:'bf2',order:1,title:'Identify root cause',priority:'high',tags:[],description:''},{id:'bf3',order:2,title:'Write failing test case',priority:'medium',tags:[],description:''},{id:'bf4',order:3,title:'Implement fix',priority:'high',tags:[],description:''},{id:'bf5',order:4,title:'Verify and run test suite',priority:'high',tags:[],description:''}]},
  {id:'pre_design',name:'Design Sprint',emoji:'\u270F\uFE0F',description:'5-day design sprint process.',priority:'high',tags:['Design','Sprint'],createdByName:'Built-in',createdBy:'__preset',subtasks:[{id:'ds1',order:0,title:'Map problem and user journey',priority:'high',tags:[],description:''},{id:'ds2',order:1,title:'Sketch competing solutions',priority:'medium',tags:[],description:''},{id:'ds3',order:2,title:'Choose best solution',priority:'high',tags:[],description:''},{id:'ds4',order:3,title:'Build realistic prototype',priority:'high',tags:[],description:''},{id:'ds5',order:4,title:'Test with real users',priority:'high',tags:[],description:''}]},
  {id:'pre_qr',name:'Quarterly Review',emoji:'\uD83D\uDCCA',description:'Thorough quarterly business review.',priority:'medium',tags:['Review','Management'],createdByName:'Built-in',createdBy:'__preset',subtasks:[{id:'qr1',order:0,title:'Gather team feedback and metrics',priority:'medium',tags:[],description:''},{id:'qr2',order:1,title:'Identify improvements and opportunities',priority:'high',tags:[],description:''},{id:'qr3',order:2,title:'Create action items for next quarter',priority:'high',tags:[],description:''},{id:'qr4',order:3,title:'Update goals and OKRs',priority:'medium',tags:[],description:''}]}
];

/* ---------- AI PROMPTS ---------- */
var AI_PROMPTS = {
  'product launch': {name:'Product Launch Plan',emoji:'\uD83D\uDE80',priority:'high',tags:['Product','Launch'],description:'A comprehensive plan for launching a product.',subtasks:[{title:'Define launch goals',priority:'high'},{title:'Finalize scope and changelog',priority:'high'},{title:'QA testing and sign-off',priority:'high'},{title:'Prepare marketing assets',priority:'medium'},{title:'Brief sales and support teams',priority:'medium'},{title:'Deploy to production',priority:'high'},{title:'Send launch announcement',priority:'medium'},{title:'Monitor post-launch metrics',priority:'medium'}]},
  'sprint': {name:'Sprint Planning',emoji:'\u26A1',priority:'high',tags:['Sprint','Agile'],description:'Plan and kick off a productive sprint.',subtasks:[{title:'Review and prioritize backlog',priority:'high'},{title:'Define sprint goal',priority:'high'},{title:'Assign tasks to team',priority:'medium'},{title:'Estimate story points',priority:'medium'},{title:'Set up sprint board',priority:'low'}]},
  'marketing': {name:'Marketing Campaign',emoji:'\uD83D\uDCE2',priority:'high',tags:['Marketing'],description:'End-to-end campaign planning.',subtasks:[{title:'Define campaign KPIs',priority:'high'},{title:'Research target audience',priority:'high'},{title:'Create content calendar',priority:'medium'},{title:'Design creative assets',priority:'medium'},{title:'Launch campaign',priority:'high'},{title:'Monitor and optimize',priority:'medium'}]},
  'onboard': {name:'Employee Onboarding',emoji:'\uD83E\uDDD1\u200D\uD83D\uDCBC',priority:'high',tags:['HR'],description:'Onboard new team member efficiently.',subtasks:[{title:'Set up accounts and credentials',priority:'high'},{title:'Workspace setup',priority:'high'},{title:'Intro meetings with team',priority:'medium'},{title:'Share processes and documentation',priority:'medium'},{title:'Assign first tasks',priority:'medium'}]},
  'review': {name:'Quarterly Review',emoji:'\uD83D\uDCCA',priority:'medium',tags:['Review'],description:'Thorough quarterly review.',subtasks:[{title:'Gather metrics and feedback',priority:'medium'},{title:'Identify improvements',priority:'high'},{title:'Create action items',priority:'high'},{title:'Update goals and OKRs',priority:'medium'}]},
  'bug': {name:'Bug Fix Workflow',emoji:'\uD83D\uDC1B',priority:'high',tags:['Bug','Dev'],description:'Structured bug fix workflow.',subtasks:[{title:'Reproduce bug consistently',priority:'high'},{title:'Identify root cause',priority:'high'},{title:'Write failing test',priority:'medium'},{title:'Implement fix',priority:'high'},{title:'Verify and run test suite',priority:'high'}]},
  'design': {name:'Design Sprint',emoji:'\u270F\uFE0F',priority:'high',tags:['Design'],description:'5-day design sprint.',subtasks:[{title:'Map problem and user journey',priority:'high'},{title:'Sketch solutions',priority:'medium'},{title:'Choose best solution',priority:'high'},{title:'Build prototype',priority:'high'},{title:'Test with users',priority:'high'}]}
};

function tmAiGenerate(prompt) {
  var p = prompt.toLowerCase();
  for (var key in AI_PROMPTS) { if (p.indexOf(key) > -1) return AI_PROMPTS[key]; }
  var words = prompt.replace(/[^a-z0-9\s]/gi, '').split(/\s+/).filter(function(w) { return w.length > 3; }).slice(0, 5);
  return {
    name: words.length > 0 ? words.map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ') + ' Workflow' : 'Custom Workflow',
    emoji: '\uD83D\uDCCB', priority: 'medium', tags: [], description: 'Auto-generated for: ' + prompt,
    subtasks: [{title:'Plan and define scope',priority:'high'},{title:'Identify stakeholders',priority:'medium'},{title:'Break down into tasks',priority:'high'},{title:'Assign responsibilities',priority:'medium'},{title:'Set milestones',priority:'medium'},{title:'Execute and track',priority:'high'},{title:'Review and adjust',priority:'medium'},{title:'Final sign-off',priority:'high'}]
  };
}

/* ---------- SIDEBAR COUNT ---------- */
function tmUpdateSidebarCount() {
  var b = document.getElementById('tm-sidebar-count');
  if (b) b.textContent = window.TM.templates.length || '';
}

/* ---------- RENDER HELPERS ---------- */
function tmRenderEmptyState() {
  var isEmpty = TM.templates.length === 0;
  return '<div class="tm-empty-state">' +
    '<div class="tm-empty-icon">' + (isEmpty ? '\uD83D\uDCCB' : '\uD83D\uDD0D') + '</div>' +
    '<div class="tm-empty-title">' + (isEmpty ? 'No templates yet' : 'No matching templates') + '</div>' +
    '<div class="tm-empty-sub">' + (isEmpty ? 'Save a task as a template, or start from scratch.' : 'Try adjusting your search or filters.') + '</div>' +
    (isEmpty ? '<button class="tm-new-btn" id="tm-empty-create" style="margin-left:0;"><i class="fa-solid fa-plus"></i> Create Template</button>' : '') +
    '</div>';
}

function tmRenderCard(t) {
  var subCount = (t.subtasks || []).length;
  var favIcon = t.isFavourite ? '\u2B50' : '\u2606';
  var tags = (t.tags || []).map(function(tag) { return '<span class="tm-tag">' + tmEsc(tag) + '</span>'; }).join('');
  var isOwner = t.createdBy === tmGetUserId();
  var sharedBadge = !isOwner ? '<span style="font-size:10px;background:rgba(26,115,232,0.1);color:var(--accent-blue,#1a73e8);padding:1px 6px;border-radius:8px;margin-left:4px;">Shared</span>' : '';
  var ownerLine = (TM.activeFilter === 'shared' || (TM.activeFilter === 'group' && !isOwner)) ? '<div class="tm-card-owner" style="font-size:11px;color:var(--text-muted);margin-top:2px;"><i class="fa-regular fa-user" style="margin-right:4px;"></i>Created by ' + tmEsc(t.createdByName || 'Unknown') + '</div>' : '';
  return '<div class="tm-card' + (TM.previewId === t.id ? ' selected' : '') + '" data-tpl-id="' + t.id + '" data-action="preview">' +
    '<button class="tm-card-fav' + (t.isFavourite ? ' active' : '') + '" data-tpl-id="' + t.id + '" data-action="fav" title="Favourite">' + favIcon + '</button>' +
    '<div class="tm-card-header"><div class="tm-card-emoji">' + (t.emoji || '\uD83D\uDCCB') + '</div>' +
    '<div class="tm-card-info"><div class="tm-card-name">' + tmEsc(t.name) + sharedBadge + '</div>' +
    '<div class="tm-card-desc">' + tmEsc(t.description || 'No description') + '</div>' + ownerLine + '</div></div>' +
    '<div class="tm-card-meta"><span><i class="fa-solid fa-list-check"></i> ' + subCount + ' task' + (subCount !== 1 ? 's' : '') + '</span>' +
    '<span>\u2022</span><span style="color:' + tmPriColor(t.priority) + ';font-weight:500;">' + tmPriLabel(t.priority) + '</span>' +
    (t.sharedWith && t.sharedWith.length ? '<span>\u2022 <i class="fa-solid fa-share-nodes"></i> Shared</span>' : '') + '</div>' +
    (tags ? '<div class="tm-card-tags">' + tags + '</div>' : '') +
    '<div class="tm-card-actions">' +
    '<button class="tm-btn-secondary" data-tpl-id="' + t.id + '" data-action="preview">Preview</button>' +
    '<button class="tm-btn-primary" data-tpl-id="' + t.id + '" data-action="apply">Apply</button>' +
    (isOwner ? '<button class="tm-icon-btn" data-tpl-id="' + t.id + '" data-action="edit" title="Edit"><i class="fa-solid fa-pen"></i></button>' +
    '<button class="tm-icon-btn" data-tpl-id="' + t.id + '" data-action="share" title="Share"><i class="fa-solid fa-share-nodes"></i></button>' : '') +
    (tmCanDeleteTemplate(t) ? '<button class="tm-icon-btn danger" data-tpl-id="' + t.id + '" data-action="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>' : '') +
    '</div></div>';
}

function tmRenderPreviewContent(tpl, isPreset) {
  isPreset = isPreset || false;
  var subs = (tpl.subtasks || []).slice().sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
  var subRows = subs.map(function(s) {
    return '<div class="tm-tree-sub"><i class="fa-solid fa-circle-dot" style="font-size:8px;color:' + tmPriColor(s.priority) + ';"></i>' +
      '<span>' + tmEsc(s.title) + '</span><span style="font-size:10px;color:var(--text-muted);margin-left:auto;">' + tmPriLabel(s.priority) + '</span></div>';
  }).join('');
  var ownerLine = isPreset ? '<span>Built-in</span>' : '<span>by ' + tmEsc(tpl.createdByName || 'You') + '</span>';
  return '<div class="tm-preview-name">' + (tpl.emoji || '\uD83D\uDCCB') + ' ' + tmEsc(tpl.name) + '</div>' +
    '<div class="tm-preview-meta">' + ownerLine +
    '<span>\u2022</span><span style="color:' + tmPriColor(tpl.priority) + ';font-weight:500;">' + tmPriLabel(tpl.priority) + '</span>' +
    '<span>\u2022</span><span>' + (tpl.subtasks || []).length + ' subtasks</span></div>' +
    (tpl.description ? '<div class="tm-preview-desc">' + tmEsc(tpl.description) + '</div>' : '') +
    ((tpl.tags || []).length ? '<div class="tm-card-tags" style="margin-bottom:12px;">' + (tpl.tags || []).map(function(t) { return '<span class="tm-tag">' + tmEsc(t) + '</span>'; }).join('') + '</div>' : '') +
    '<div class="tm-preview-tasks-label"><i class="fa-solid fa-list-check"></i> TASK STRUCTURE</div>' +
    '<div class="tm-task-tree"><div class="tm-tree-parent">' +
    '<i class="fa-regular fa-square-check" style="font-size:12px;color:var(--accent-blue,#1a73e8);"></i>' +
    '<span>' + tmEsc(tpl.name) + '</span>' +
    '<span style="margin-left:auto;width:8px;height:8px;border-radius:50%;background:' + tmPriColor(tpl.priority) + ';display:inline-block;"></span></div>' +
    subRows + '</div>' +
    (!isPreset && !tmCanEdit(tpl) ? '<div style="margin-top:12px;padding:10px;background:rgba(245,158,11,0.08);border-radius:6px;font-size:12px;color:#92400e;display:flex;align-items:center;gap:6px;"><i class="fa-solid fa-lock"></i> Read-only \u2014 apply only</div>' : '') +
    '<div class="tm-alert-info" style="margin-top:12px;"><i class="fa-solid fa-circle-info"></i> Assignees and Due Dates are not saved.</div>';
}

/* ---------- LIBRARY RENDER ---------- */
var _tmLibOverlay = null;

function tmRenderLibrary() {
  var myFiltered = TM.getFiltered(), uid = tmGetUserId();
  var allCount = TM.templates.length;
  var personalCount = TM.templates.filter(function(t) { return t.createdBy === uid; }).length;
  var sharedCount = TM.templates.filter(function(t) { var sw = t.sharedWith || []; return t.createdBy !== uid && sw.some(function(s) { return s.id === uid; }); }).length;
  var groupCount = TM.templates.filter(function(t) { var sw = t.sharedWith || [], mg = tmGetGroups().map(function(g) { return g.id; }); return sw.some(function(s) { return s.type === 'group' && mg.indexOf(s.id) > -1; }); }).length;
  var filters = [{id:'all',label:'All',icon:'fa-layer-group',count:allCount},{id:'personal',label:'My Templates',icon:'fa-user',count:personalCount},{id:'shared',label:'Shared',icon:'fa-share-nodes',count:sharedCount},{id:'group',label:'Group',icon:'fa-users',count:groupCount}];
  var libNav = filters.map(function(f) {
    return '<div class="tm-lib-nav-item' + (TM.activeFilter === f.id ? ' active' : '') + '" data-filter="' + f.id + '">' +
      '<i class="fa-solid ' + f.icon + '"></i>' + f.label +
      (f.count > 0 ? '<span class="tm-lib-badge">' + f.count + '</span>' : '') + '</div>';
  }).join('');
  var presetNav = window.PRESET_TEMPLATES.map(function(p) {
    return '<div class="tm-lib-sidebar-item tm-preset-nav" data-preset-id="' + p.id + '">' +
      '<span>' + p.emoji + '</span>' + tmEsc(p.name.length > 18 ? p.name.slice(0, 18) + '\u2026' : p.name) + '</div>';
  }).join('');
  var gridContent = myFiltered.length === 0 ? tmRenderEmptyState() : '<div class="tm-grid">' + myFiltered.map(tmRenderCard).join('') + '</div>';
  var lhsGroupSelector = '';
  if (TM.activeFilter === 'group') {
    var userGroups = tmGetGroups().filter(function(g) { return !g.isPersonal && String(g.id).indexOf('pg_') !== 0; });
    var gOpts = '<option value="">Select a group...</option>' + userGroups.map(function(g) { return '<option value="' + g.id + '"' + (TM.selectedGroupId === g.id ? ' selected' : '') + '>' + tmEsc(g.name) + '</option>'; }).join('');
    lhsGroupSelector = '<div class="tm-lib-section" style="margin-top:8px;"><i class="fa-solid fa-users" style="margin-right:4px;"></i>SELECT GROUP</div>' + '<div style="padding:4px 12px 12px 12px;"><select id="tm-group-select" class="tm-select" style="width:100%;padding:6px 8px;font-size:13px;">' + gOpts + '</select></div>';
    if (!TM.selectedGroupId) gridContent = '<div class="tm-empty" style="padding:40px;text-align:center;color:var(--text-muted);"><i class="fa-solid fa-users" style="font-size:32px;margin-bottom:12px;display:block;"></i><div>Select a group from the sidebar to view its templates</div></div>';
  }
  var previewTpl = TM.previewId ? TM.find(TM.previewId) : null;
  var previewContent = previewTpl ? tmRenderPreviewContent(previewTpl) : '<div class="tm-preview-empty"><i class="fa-regular fa-eye" style="font-size:32px;color:var(--text-muted);"></i><div class="tm-preview-empty-text">Click a template to preview its structure</div></div>';
  return '<div class="tm-lib-sidebar">' +
    '<div class="tm-lib-sidebar-logo"><i class="fa-solid fa-layer-group"></i> Templates</div>' +
    libNav + lhsGroupSelector + '<hr class="tm-lib-divider"><div class="tm-lib-section">PRESET TEMPLATES</div>' + presetNav + '</div>' +
    '<div class="tm-library-main">' +
    '<div class="tm-library-header">' +
    '<div class="tm-library-title" style="display:none;"></div>' +
    '<div class="tm-lib-toolbar">' +
    '<div class="tm-search-box"><i class="fa-solid fa-magnifying-glass"></i>' +
    '<input id="tm-lib-search" placeholder="Search templates..." value="' + tmEsc(TM.searchQuery || '') + '" type="text"></div>' +
    '<div class="tm-filter-tabs">' + filters.map(function(f) { return '<div class="tm-filter-tab' + (TM.activeFilter === f.id ? ' active' : '') + '" data-filter="' + f.id + '">' + f.label + '</div>'; }).join('') + '</div>' +
    '<div style="position:relative;"><button class="tm-sort-btn" id="tm-sort-btn"><i class="fa-solid fa-arrow-up-wide-short"></i>' + (TM.activeSort === 'favourite' ? 'Favourites' : 'Most Recent') + '<i class="fa-solid fa-chevron-down" style="font-size:10px;"></i></button>' +
    '<div class="tm-sort-dropdown" id="tm-sort-dropdown" style="display:none;">' +
    '<div class="tm-sort-opt' + (TM.activeSort === 'recent' ? ' active' : '') + '" data-sort="recent"><i class="fa-regular fa-clock"></i> Most Recent</div>' +
    '<div class="tm-sort-opt' + (TM.activeSort === 'favourite' ? ' active' : '') + '" data-sort="favourite"><i class="fa-solid fa-star"></i> Favourites</div></div></div>' +
    (tmCanCreateTemplate() ? '<button class="tm-new-btn" id="tm-lib-new"><i class="fa-solid fa-plus"></i> New Template</button>' : '') +
    '</div></div>' +
    '<div class="tm-library-body">' +
    '<div class="tm-grid-panel" id="tm-grid-panel">' + gridContent + '</div>' +
    '<div class="tm-preview-panel">' +
    '<div class="tm-preview-header"><i class="fa-solid fa-eye" style="color:var(--text-muted);font-size:13px;"></i><span class="tm-preview-title">Preview</span></div>' +
    '<div class="tm-preview-body" id="tm-preview-body">' + previewContent + '</div>' +
    '<div class="tm-preview-actions" id="tm-preview-actions" style="' + (previewTpl ? '' : 'display:none;') + '">' +
    (!previewTpl || tmCanEdit(previewTpl) ? '' : '<span class="tm-preview-readonly-badge">Read-only</span>') +
    (previewTpl && tmCanEdit(previewTpl) ? '<button class="tm-icon-btn" id="tm-prev-edit" title="Edit"><i class="fa-solid fa-pen"></i></button><button class="tm-icon-btn" id="tm-prev-share" title="Share"><i class="fa-solid fa-share-nodes"></i></button>' : '') +
    '<button class="tm-btn-primary" id="tm-prev-apply">Apply Template</button></div>' +
    '</div></div></div>';
}

/* ---------- LIBRARY OPEN / CLOSE / REFRESH ---------- */
function tmOpenLibrary(filterOverride) {
  if (filterOverride) TM.activeFilter = filterOverride;
  if (_tmLibOverlay) { _tmLibOverlay.remove(); _tmLibOverlay = null; }
  var overlay = document.createElement('div'); overlay.className = 'tm-overlay'; overlay.id = 'tm-lib-overlay';
  var lib = document.createElement('div'); lib.className = 'tm-library';
  lib.innerHTML = tmRenderLibrary(); overlay.appendChild(lib); document.body.appendChild(overlay);
  _tmLibOverlay = overlay;
  tmBindLibraryEvents(overlay, lib);
  /* Close button top-right of the modal */
  var cb = document.createElement('button'); cb.className = 'tm-modal-corner-close'; cb.innerHTML = '&times;'; cb.title = 'Close';
  cb.addEventListener('click', tmCloseLibrary); lib.appendChild(cb);
  var si = document.getElementById('tm-sidebar-item'); if (si) si.classList.add('active');
  setTimeout(function() { var s = overlay.querySelector('#tm-lib-search'); if (s) s.focus(); }, 100);
}

function tmCloseLibrary() {
  if (_tmLibOverlay) { _tmLibOverlay.remove(); _tmLibOverlay = null; }
  var si = document.getElementById('tm-sidebar-item'); if (si) si.classList.remove('active');
}

function tmRefreshLibrary() {
  if (!_tmLibOverlay) return;
  var lib = _tmLibOverlay.querySelector('.tm-library');
  if (!lib) return;
  lib.innerHTML = tmRenderLibrary();
  tmBindLibraryEvents(_tmLibOverlay, lib);
  var cb = document.createElement('button'); cb.className = 'tm-modal-corner-close'; cb.innerHTML = '&times;'; cb.title = 'Close';
  cb.addEventListener('click', tmCloseLibrary); lib.appendChild(cb);
}

function tmUpdatePreviewPanel(lib, tpl) {
  var prevBody = lib.querySelector('#tm-preview-body'), prevActions = lib.querySelector('#tm-preview-actions');
  if (prevBody) prevBody.innerHTML = tmRenderPreviewContent(tpl);
  if (prevActions) {
    prevActions.style.display = 'flex';
    prevActions.innerHTML =
      (!tmCanEdit(tpl) ? '<span class="tm-preview-readonly-badge">Read-only</span>' : '') +
      (tmCanEdit(tpl) ? '<button class="tm-icon-btn" id="tm-prev-edit"><i class="fa-solid fa-pen"></i></button><button class="tm-icon-btn" id="tm-prev-share"><i class="fa-solid fa-share-nodes"></i></button>' : '') +
      '<button class="tm-btn-primary" id="tm-prev-apply">Apply Template</button>';
    var pa = lib.querySelector('#tm-prev-apply'); if (pa) pa.addEventListener('click', function() { tmOpenApplyModal(tpl); });
    var pe = lib.querySelector('#tm-prev-edit'); if (pe) pe.addEventListener('click', function() { if (tmCanEdit(tpl)) tmOpenEditModal(tpl); });
    var ps = lib.querySelector('#tm-prev-share'); if (ps) ps.addEventListener('click', function() { if (tmCanEdit(tpl)) tmOpenShareModal(tpl); });
  }
}

function tmBindLibraryEvents(overlay, lib) {
  overlay.addEventListener('click', function(e) { if (e.target === overlay) tmCloseLibrary(); });
  var nb = lib.querySelector('#tm-lib-new'); if (nb) nb.addEventListener('click', function() { tmOpenCreateModal(); });
  var ec = lib.querySelector('#tm-empty-create'); if (ec) ec.addEventListener('click', function() { tmOpenCreateModal(); });
  var si = lib.querySelector('#tm-lib-search');
  if (si) si.addEventListener('input', function(e) {
    TM.searchQuery = e.target.value;
    var panel = lib.querySelector('#tm-grid-panel');
    if (panel) { var f = TM.getFiltered(); panel.innerHTML = f.length === 0 ? tmRenderEmptyState() : '<div class="tm-grid">' + f.map(tmRenderCard).join('') + '</div>'; tmBindGridEvents(lib); }
  });
  var sortBtn = lib.querySelector('#tm-sort-btn'), sortDd = lib.querySelector('#tm-sort-dropdown');
  if (sortBtn && sortDd) {
    sortBtn.addEventListener('click', function(e) { e.stopPropagation(); sortDd.style.display = sortDd.style.display === 'none' ? 'block' : 'none'; });
    document.addEventListener('click', function() { if (sortDd) sortDd.style.display = 'none'; }, {once: true});
  }
  lib.querySelectorAll('.tm-sort-opt').forEach(function(opt) { opt.addEventListener('click', function(e) { TM.activeSort = e.currentTarget.dataset.sort; if (sortDd) sortDd.style.display = 'none'; tmRefreshLibrary(); }); });
  lib.querySelectorAll('.tm-filter-tab,.tm-lib-nav-item[data-filter]').forEach(function(tab) { tab.addEventListener('click', function(e) { var f = e.currentTarget.dataset.filter; if (f) { TM.activeFilter = f; TM.previewId = null; if (f !== 'group') TM.selectedGroupId = null; tmRefreshLibrary(); } }); });
  var gs = lib.querySelector('#tm-group-select'); if (gs) gs.addEventListener('change', function(e) { TM.selectedGroupId = e.target.value || null; TM.previewId = null; tmRefreshLibrary(); });
  lib.querySelectorAll('.tm-preset-nav').forEach(function(item) { item.addEventListener('click', function(e) { var pid = e.currentTarget.dataset.presetId; var preset = window.PRESET_TEMPLATES.find(function(p) { return p.id === pid; }); if (preset) tmShowPresetPreview(preset, lib); }); });
  tmBindGridEvents(lib);
  var pa = lib.querySelector('#tm-prev-apply'); if (pa) pa.addEventListener('click', function() { var t = TM.previewId ? TM.find(TM.previewId) : null; if (t) tmOpenApplyModal(t); });
  var pe = lib.querySelector('#tm-prev-edit'); if (pe) pe.addEventListener('click', function() { var t = TM.previewId ? TM.find(TM.previewId) : null; if (t && tmCanEdit(t)) tmOpenEditModal(t); });
  var ps = lib.querySelector('#tm-prev-share'); if (ps) ps.addEventListener('click', function() { var t = TM.previewId ? TM.find(TM.previewId) : null; if (t && tmCanEdit(t)) tmOpenShareModal(t); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { tmCloseLibrary(); document.removeEventListener('keydown', esc); } });
}

function tmBindGridEvents(lib) {
  lib.querySelectorAll('[data-action]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      var action = e.currentTarget.dataset.action;
      var id = e.currentTarget.dataset.tplId || (e.currentTarget.closest('[data-tpl-id]') && e.currentTarget.closest('[data-tpl-id]').dataset.tplId);
      switch (action) {
        case 'preview':
          TM.previewId = id;
          lib.querySelectorAll('.tm-card').forEach(function(c) { c.classList.remove('selected'); });
          var card = lib.querySelector('.tm-card[data-tpl-id="' + id + '"]'); if (card) card.classList.add('selected');
          var tpl = TM.find(id); if (tpl) tmUpdatePreviewPanel(lib, tpl);
          break;
        case 'fav':
          TM.toggleFav(id);
          var fb = lib.querySelector('.tm-card-fav[data-tpl-id="' + id + '"]');
          if (fb) { var t2 = TM.find(id); if (t2) { fb.textContent = t2.isFavourite ? '\u2B50' : '\u2606'; fb.classList.toggle('active', t2.isFavourite); } }
          break;
        case 'apply':
          var t3 = TM.find(id); if (t3) { tmCloseLibrary(); setTimeout(function() { tmOpenApplyModal(t3); }, 150); }
          break;
        case 'edit':
          var t4 = TM.find(id); if (t4 && tmCanEdit(t4)) tmOpenEditModal(t4);
          break;
        case 'share':
          var t5 = TM.find(id); if (t5 && tmCanEdit(t5)) tmOpenShareModal(t5);
          break;
        case 'delete':
          var tDel = TM.find(id);
          if (!tmCanDeleteTemplate(tDel)) { tmShowToast('You do not have permission to delete this template', 'error'); break; }
          if (confirm('Delete this template? Previously created tasks will NOT be affected.')) {
            TM.delete(id); if (TM.previewId === id) TM.previewId = null; tmRefreshLibrary(); tmShowToast('Template deleted');
          }
          break;
      }
    });
  });
}

function tmShowPresetPreview(preset, lib) {
  TM.previewId = null;
  lib.querySelectorAll('.tm-card').forEach(function(c) { c.classList.remove('selected'); });
  var prevBody = lib.querySelector('#tm-preview-body'), prevActions = lib.querySelector('#tm-preview-actions');
  if (prevBody) prevBody.innerHTML = tmRenderPreviewContent(preset, true);
  if (prevActions) {
    prevActions.style.display = 'flex';
    prevActions.innerHTML = '<button class="tm-btn-secondary" id="tm-prev-save-preset" style="flex:1;">Save to Library</button><button class="tm-btn-primary" id="tm-prev-apply-preset">Apply</button>';
    var sb = lib.querySelector('#tm-prev-save-preset');
    if (sb) sb.addEventListener('click', function() {
      var saved = TM.create(Object.assign({}, preset, {id: undefined, source: 'preset', subtasks: preset.subtasks.map(function(s, i) { return Object.assign({}, s, {id: tmUid(), order: i}); })}));
      TM.previewId = saved.id; tmRefreshLibrary(); tmShowToast('Preset saved to your templates!', 'success');
    });
    var ab = lib.querySelector('#tm-prev-apply-preset');
    if (ab) ab.addEventListener('click', function() { tmOpenApplyModal(preset, true); });
  }
}

/* ---------- CREATE MODAL ---------- */
function tmBuildSubRow(s, i) {
  var priOpts = ['none','low','medium','high'].map(function(p) { return '<option value="' + p + '"' + ((s.priority || 'none') === p ? ' selected' : '') + '>' + tmPriLabel(p) + '</option>'; }).join('');
  return '<div class="tm-sub-row" data-idx="' + i + '" draggable="true">' +
    '<span class="tm-drag-handle" title="Reorder"><i class="fa-solid fa-grip-vertical"></i></span>' +
    '<input class="tm-sub-input" placeholder="Subtask title..." value="' + tmEsc(s.title || '') + '" data-idx="' + i + '" type="text">' +
    '<select class="tm-sub-pri" data-idx="' + i + '">' + priOpts + '</select>' +
    '<button class="tm-sub-remove" data-idx="' + i + '" title="Remove"><i class="fa-solid fa-xmark"></i></button></div>';
}

function tmOpenCreateModal(prefill) {
  var data = prefill ? Object.assign({}, prefill) : {name: '', priority: 'none', tags: [], description: '', subtasks: [], emoji: '\uD83D\uDCCB'};
  var isFromTask = !!(prefill && !prefill._isBlank);
  var currentSubs = (data.subtasks || []).slice(0, MAX_SUB).map(function(s, i) { return Object.assign({}, s, {order: i, id: s.id || tmUid()}); });
  var activeTab = 'manual', dragSrcIdx = null;
  var overlay = document.createElement('div'); overlay.className = 'tm-overlay'; overlay.id = 'tm-create-overlay'; document.body.appendChild(overlay);

  function buildHTML() {
    var subRows = currentSubs.map(tmBuildSubRow).join('');
    var sc = currentSubs.length;
    var priOpts = ['none','low','medium','high'].map(function(p) { return '<option value="' + p + '"' + ((data.priority || 'none') === p ? ' selected' : '') + '>' + tmPriLabel(p) + '</option>'; }).join('');
    var tabBar = !isFromTask ? '<div class="tm-tab-bar"><div class="tm-tab' + (activeTab === 'manual' ? ' active' : '') + '" data-tab="manual"><i class="fa-solid fa-pen"></i> Manual</div><div class="tm-tab' + (activeTab === 'ai' ? ' active' : '') + '" data-tab="ai"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Generate</div></div>' : '';
    var manualPanel = '<div class="tm-tab-panel' + (activeTab === 'manual' ? ' active' : '') + '" id="tm-tab-manual">' +
      '<div class="tm-field-row"><label>Template Name <span class="tm-name-counter" id="tm-name-count">' + tmEsc(data.name || '').length + '/100</span></label>' +
      '<input class="tm-input" id="tm-create-name" type="text" placeholder="e.g. Bug Fix Workflow" maxlength="100" value="' + tmEsc(data.name || '') + '"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
      '<div class="tm-field-row"><label>Priority</label><select class="tm-select" id="tm-create-priority">' + priOpts + '</select></div>' +
      '<div class="tm-field-row"><label>Emoji</label><input class="tm-input" id="tm-create-emoji" type="text" placeholder="\uD83D\uDCCB" maxlength="4" value="' + tmEsc(data.emoji || '\uD83D\uDCCB') + '"></div></div>' +
      '<div class="tm-field-row"><label>Tags <span style="font-weight:400;text-transform:none;font-size:11px;color:var(--text-muted)">(comma-separated)</span></label>' +
      '<input class="tm-input" id="tm-create-tags" type="text" placeholder="Bug, Backend, Frontend" value="' + tmEsc((data.tags || []).join(', ')) + '"></div>' +
      '<div class="tm-field-row"><label>Description</label><textarea class="tm-textarea" id="tm-create-desc" rows="2" placeholder="Optional description...">' + tmEsc(data.description || '') + '</textarea></div>' +
      '<div class="tm-field-row"><div class="tm-subtask-section-header"><span class="tm-subtask-section-label">Subtasks <span id="tm-sub-count">(' + sc + '/20)</span></span>' +
      '<span style="font-size:11px;color:var(--text-muted)">Max 2 levels (Parent > Subtask)</span></div>' +
      '<div class="tm-subtask-list" id="tm-sub-list">' + subRows + '</div>' +
      (sc >= MAX_SUB ? '<div class="tm-alert-warn"><i class="fa-solid fa-triangle-exclamation"></i> Maximum 20 subtasks reached</div>' : '') +
      (sc < MAX_SUB ? '<button class="tm-add-sub-btn" id="tm-add-sub"><i class="fa-solid fa-plus"></i> Add Subtask</button>' : '') +
      '<div class="tm-alert-info"><i class="fa-solid fa-circle-info"></i> Assignees and Due Dates are stripped when applying.</div></div></div>';
    var aiPanel = '<div class="tm-tab-panel' + (activeTab === 'ai' ? ' active' : '') + '" id="tm-tab-ai">' +
      '<div class="tm-ai-box"><div class="tm-ai-title"><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--accent-blue,#1a73e8);"></i> AI Template Generator</div>' +
      '<div class="tm-ai-subtitle">Describe your workflow and AI will generate a structured template</div>' +
      '<div class="tm-ai-example-chips">' + ['Product launch','Sprint planning','Bug fix workflow','Employee onboarding','Quarterly review'].map(function(ex) { return '<span class="tm-ai-chip">' + ex + '</span>'; }).join('') + '</div>' +
      '<div class="tm-ai-input-row"><input class="tm-ai-input" id="tm-ai-prompt" type="text" placeholder="e.g. Create a template for a product launch">' +
      '<button class="tm-ai-generate-btn" id="tm-ai-generate"><i class="fa-solid fa-wand-magic-sparkles"></i> Generate</button></div></div>' +
      '<div id="tm-ai-result-area"></div></div>';
    return '<div class="tm-modal" id="tm-create-modal">' +
      '<div class="tm-modal-header"><i class="fa-solid fa-layer-group" style="color:var(--accent-blue,#1a73e8);font-size:16px;"></i>' +
      '<span class="tm-modal-title">' + (isFromTask ? 'Save as Template' : 'Create Template') + '</span>' +
      '<button class="tm-modal-close" id="tm-create-close">&times;</button></div>' +
      '<div class="tm-modal-body">' + tabBar + manualPanel + aiPanel + '</div>' +
      '<div class="tm-modal-footer"><button class="tm-btn-secondary" style="padding:9px 20px;" id="tm-create-cancel">Cancel</button>' +
      '<button class="tm-btn-primary" style="padding:9px 24px;" id="tm-create-save"><i class="fa-solid fa-floppy-disk"></i> Save Template</button></div></div>';
  }

  function render() { overlay.innerHTML = buildHTML(); bindEvents(); }

  function bindEvents() {
    overlay.querySelector('#tm-create-close').addEventListener('click', function() { overlay.remove(); });
    overlay.querySelector('#tm-create-cancel').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    overlay.querySelectorAll('.tm-tab').forEach(function(tab) { tab.addEventListener('click', function(e) { activeTab = e.currentTarget.dataset.tab; render(); }); });
    var ni = overlay.querySelector('#tm-create-name'), nc = overlay.querySelector('#tm-name-count');
    if (ni && nc) ni.addEventListener('input', function() { nc.textContent = ni.value.length + '/100'; nc.classList.toggle('tm-char-limit', ni.value.length >= 100); });
    overlay.querySelectorAll('.tm-sub-input').forEach(function(inp) { inp.addEventListener('input', function(e) { var i = parseInt(e.target.dataset.idx); if (!isNaN(i)) currentSubs[i].title = e.target.value; }); });
    overlay.querySelectorAll('.tm-sub-pri').forEach(function(sel) { sel.addEventListener('change', function(e) { var i = parseInt(e.target.dataset.idx); if (!isNaN(i)) currentSubs[i].priority = e.target.value; }); });
    overlay.querySelectorAll('.tm-sub-remove').forEach(function(btn) { btn.addEventListener('click', function(e) { currentSubs.splice(parseInt(e.currentTarget.dataset.idx), 1); render(); }); });
    var asb = overlay.querySelector('#tm-add-sub');
    if (asb) asb.addEventListener('click', function() {
      if (currentSubs.length >= MAX_SUB) { tmShowToast('Max 20 subtasks allowed', 'error'); return; }
      currentSubs.push({id: tmUid(), title: '', priority: 'none', tags: [], description: '', order: currentSubs.length}); render();
      var inps = overlay.querySelectorAll('.tm-sub-input'); if (inps.length) inps[inps.length - 1].focus();
    });
    var sl = overlay.querySelector('#tm-sub-list');
    if (sl) {
      sl.addEventListener('dragstart', function(e) { var r = e.target.closest('.tm-sub-row'); if (r) { dragSrcIdx = parseInt(r.dataset.idx); r.classList.add('dragging'); } });
      sl.addEventListener('dragover', function(e) { e.preventDefault(); var r = e.target.closest('.tm-sub-row'); sl.querySelectorAll('.tm-sub-row').forEach(function(x) { x.classList.remove('drag-over'); }); if (r) r.classList.add('drag-over'); });
      sl.addEventListener('drop', function(e) {
        e.preventDefault(); var r = e.target.closest('.tm-sub-row');
        sl.querySelectorAll('.tm-sub-row').forEach(function(x) { x.classList.remove('drag-over', 'dragging'); });
        if (!r || dragSrcIdx === null) return;
        var di = parseInt(r.dataset.idx); if (di !== dragSrcIdx) { var m = currentSubs.splice(dragSrcIdx, 1)[0]; currentSubs.splice(di, 0, m); currentSubs.forEach(function(x, i) { x.order = i; }); }
        dragSrcIdx = null; render();
      });
    }
    overlay.querySelectorAll('.tm-ai-chip').forEach(function(c) { c.addEventListener('click', function(e) { var i = overlay.querySelector('#tm-ai-prompt'); if (i) { i.value = e.target.textContent; i.focus(); } }); });
    var gb = overlay.querySelector('#tm-ai-generate');
    if (gb) gb.addEventListener('click', function() {
      var pi = overlay.querySelector('#tm-ai-prompt'), prompt = pi ? pi.value.trim() : '';
      if (!prompt) { tmShowToast('Enter a prompt first', 'error'); return; }
      gb.disabled = true; gb.innerHTML = '<span class="tm-ai-spinner"></span> Generating...';
      setTimeout(function() {
        var aiResult = tmAiGenerate(prompt);
        if (aiResult.subtasks.length > MAX_SUB) aiResult.subtasks = aiResult.subtasks.slice(0, MAX_SUB);
        var ra = overlay.querySelector('#tm-ai-result-area');
        if (ra) {
          var sp = aiResult.subtasks.map(function(s) { return '<div class="tm-ai-result-sub"><i class="fa-solid fa-circle-dot" style="color:' + tmPriColor(s.priority) + ';font-size:8px;"></i> ' + tmEsc(s.title) + '</div>'; }).join('');
          ra.innerHTML = '<div class="tm-ai-result"><div class="tm-ai-result-title">' + (aiResult.emoji || '\uD83D\uDCCB') + ' ' + tmEsc(aiResult.name) + '</div>' +
            '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">' + tmEsc(aiResult.description || '') + ' &bull; ' + aiResult.subtasks.length + ' subtasks &bull; ' + tmPriLabel(aiResult.priority) + '</div>' +
            '<div class="tm-ai-result-tasks"><div class="tm-ai-result-parent"><i class="fa-regular fa-square-check" style="font-size:11px;color:var(--accent-blue,#1a73e8);"></i> ' + tmEsc(aiResult.name) + '</div>' + sp + '</div>' +
            (aiResult.subtasks.length >= MAX_SUB ? '<div class="tm-alert-warn" style="margin-top:8px;"><i class="fa-solid fa-triangle-exclamation"></i> Capped at 20 subtasks (limit enforced)</div>' : '') +
            '<div style="margin-top:12px;display:flex;gap:8px;"><button class="tm-btn-secondary" style="flex:1;" id="tm-ai-edit">Edit in Manual Mode</button><button class="tm-btn-primary" style="flex:1;" id="tm-ai-save">Save to Library</button></div></div>';
          overlay.querySelector('#tm-ai-edit').addEventListener('click', function() {
            currentSubs = aiResult.subtasks.map(function(s, i) { return {id: tmUid(), title: s.title, priority: s.priority || 'none', tags: [], description: '', order: i}; });
            data.name = aiResult.name; data.priority = aiResult.priority; data.tags = aiResult.tags || []; data.description = aiResult.description || ''; data.emoji = aiResult.emoji || '\uD83D\uDCCB';
            activeTab = 'manual'; render();
            setTimeout(function() {
              var n = overlay.querySelector('#tm-create-name'), p = overlay.querySelector('#tm-create-priority'), t = overlay.querySelector('#tm-create-tags'), d = overlay.querySelector('#tm-create-desc'), em = overlay.querySelector('#tm-create-emoji');
              if (n) n.value = aiResult.name || ''; if (p) p.value = aiResult.priority || 'none'; if (t) t.value = (aiResult.tags || []).join(', '); if (d) d.value = aiResult.description || ''; if (em) em.value = aiResult.emoji || '\uD83D\uDCCB';
            }, 50);
          });
          overlay.querySelector('#tm-ai-save').addEventListener('click', function() {
            var saved = TM.create({name: aiResult.name, emoji: aiResult.emoji || '\uD83D\uDCCB', priority: aiResult.priority || 'none', tags: aiResult.tags || [], description: aiResult.description || '',
              subtasks: aiResult.subtasks.slice(0, MAX_SUB).map(function(s, i) { return {id: tmUid(), title: s.title, priority: s.priority || 'none', tags: [], description: '', order: i}; }), source: 'ai'});
            overlay.remove(); tmShowToast('\u2728 AI template "' + saved.name + '" saved!', 'success'); tmUpdateSidebarCount();
          });
        }
        gb.disabled = false; gb.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Regenerate';
      }, 1500);
    });
    overlay.querySelector('#tm-create-save').addEventListener('click', function() {
      var name = (overlay.querySelector('#tm-create-name') && overlay.querySelector('#tm-create-name').value || '').trim();
      if (!name) { tmShowToast('Template name is required', 'error'); overlay.querySelector('#tm-create-name') && overlay.querySelector('#tm-create-name').focus(); return; }
      if (name.length > MAX_NAME) { tmShowToast('Name too long (max 100 chars)', 'error'); return; }
      var validSubs = currentSubs.filter(function(s) { return s.title && s.title.trim(); });
      if (validSubs.length > MAX_SUB) { tmShowToast('Maximum 20 subtasks allowed', 'error'); return; }
      var priority = overlay.querySelector('#tm-create-priority') && overlay.querySelector('#tm-create-priority').value || 'none';
      var tags = (overlay.querySelector('#tm-create-tags') && overlay.querySelector('#tm-create-tags').value || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean);
      var desc = overlay.querySelector('#tm-create-desc') && overlay.querySelector('#tm-create-desc').value || '';
      var emoji = overlay.querySelector('#tm-create-emoji') && overlay.querySelector('#tm-create-emoji').value || '\uD83D\uDCCB';
      if (prefill && prefill.id) {
        TM.update(prefill.id, {name: name, priority: priority, tags: tags, description: desc, emoji: emoji, subtasks: validSubs.map(function(s, i) { return Object.assign({}, s, {order: i}); })});
        tmShowToast('Template updated', 'success');
      } else {
        var saved = TM.create({name: name, priority: priority, tags: tags, description: desc, emoji: emoji, subtasks: validSubs.map(function(s, i) { return Object.assign({}, s, {order: i}); }), source: isFromTask ? 'task' : 'manual'});
        tmShowToast('\uD83D\uDCCB Template "' + saved.name + '" saved!', 'success');
      }
      overlay.remove(); tmUpdateSidebarCount();
    });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); } });
  }
  render();
}

/* ---------- APPLY MODAL ---------- */
function tmOpenApplyModal(tpl, isPreset) {
  isPreset = isPreset || false;
  var subs = (tpl.subtasks || []).slice().sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
  var groups = tmGetGroups(), defaultGroup = (window.state && window.state.filterGroup) || (groups[0] && groups[0].id) || '';
  var overlay = document.createElement('div'); overlay.className = 'tm-overlay'; overlay.id = 'tm-apply-overlay'; document.body.appendChild(overlay);
  var parentRow = '<div class="tm-apply-task-row"><div class="tm-apply-task-title"><i class="fa-regular fa-square-check" style="color:var(--accent-blue,#1a73e8);font-size:12px;"></i>' +
    '<strong>' + tmEsc(tpl.name) + '</strong>' +
    '<span style="width:8px;height:8px;border-radius:50%;background:' + tmPriColor(tpl.priority) + ';display:inline-block;margin-left:4px;"></span></div>' +
    '<div class="tm-apply-task-meta"><span><i class="fa-solid fa-tag"></i> ' + ((tpl.tags || []).join(', ') || 'No tags') + '</span> &bull; <span>' + tmPriLabel(tpl.priority) + '</span></div></div>' +
    subs.map(function(s) { return '<div class="tm-apply-sub-row"><i class="fa-solid fa-circle-dot" style="color:' + tmPriColor(s.priority) + ';font-size:8px;"></i> ' + tmEsc(s.title) + '<span style="margin-left:auto;font-size:10px;color:var(--text-muted);">' + tmPriLabel(s.priority) + '</span></div>'; }).join('');
  var groupOpts = groups.map(function(g) { return '<option value="' + g.id + '"' + (g.id === defaultGroup ? ' selected' : '') + '>' + tmEsc(g.name) + '</option>'; }).join('');
  overlay.innerHTML = '<div class="tm-modal" style="width:560px;max-width:95vw;"><div class="tm-modal-header">' +
    '<i class="fa-solid fa-bolt" style="color:#f59f00;font-size:15px;"></i>' +
    '<span class="tm-modal-title">Apply Template: ' + tmEsc(tpl.name) + '</span>' +
    '<button class="tm-modal-close" id="tm-apply-close">&times;</button></div>' +
    '<div class="tm-modal-body">' +
    '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">This will instantly create <strong>' + (1 + subs.length) + '</strong> task' + (1 + subs.length > 1 ? 's' : '') + ' (1 parent + ' + subs.length + ' subtask' + (subs.length !== 1 ? 's' : '') + ').</div>' +
    '<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);margin-bottom:8px;">TASK STRUCTURE</div>' +
    '<div class="tm-apply-preview-list">' + parentRow + '</div>' +
    '<div class="tm-apply-options"><div class="tm-apply-options-title">CUSTOMIZE BEFORE APPLYING</div>' +
    '<div class="tm-apply-option-row"><span class="tm-apply-option-label">Group</span><select class="tm-select" id="tm-apply-group" style="flex:1;">' + groupOpts + '</select></div>' +
    '<div class="tm-apply-option-row"><span class="tm-apply-option-label">Priority</span>' +
    '<select class="tm-select" id="tm-apply-priority" style="flex:1;"><option value="">Keep template priority (' + tmPriLabel(tpl.priority) + ')</option>' +
    ['none','low','medium','high'].map(function(p) { return '<option value="' + p + '">' + tmPriLabel(p) + '</option>'; }).join('') + '</select></div>' +
    '<div class="tm-apply-option-row"><span class="tm-apply-option-label">Start Date</span><input type="date" class="tm-input" id="tm-apply-start" style="flex:1;"></div></div>' +
    '<div class="tm-alert-info"><i class="fa-solid fa-circle-info"></i> Assignees and Due Dates are not set automatically.</div>' +
    '<div class="tm-alert-warn" style="margin-top:8px;"><i class="fa-solid fa-triangle-exclamation"></i> Editing the template later will <strong>not</strong> affect tasks created now.</div>' +
    '</div><div class="tm-modal-footer"><button class="tm-btn-secondary" style="padding:9px 20px;" id="tm-apply-cancel">Cancel</button>' +
    '<button class="tm-btn-primary" style="padding:9px 24px;" id="tm-apply-confirm"><i class="fa-solid fa-bolt"></i> Apply Template</button></div></div>';
  overlay.querySelector('#tm-apply-close').addEventListener('click', function() { overlay.remove(); });
  overlay.querySelector('#tm-apply-cancel').addEventListener('click', function() { overlay.remove(); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#tm-apply-confirm').addEventListener('click', function() {
    var group = overlay.querySelector('#tm-apply-group') && overlay.querySelector('#tm-apply-group').value || '';
    var priorityOverride = overlay.querySelector('#tm-apply-priority') && overlay.querySelector('#tm-apply-priority').value || '';
    var appliedPriority = priorityOverride || tpl.priority || 'Medium';
    var applyStartDate = overlay.querySelector('#tm-apply-start') && overlay.querySelector('#tm-apply-start').value || '';
    overlay.remove();
    tmCloseLibrary();
    setTimeout(function() {
      if (typeof window.ntmResetAndOpenWith === 'function') {
        window.ntmResetAndOpenWith({ groupId: group, subtasks: tpl.subtasks || [], startDate: applyStartDate || null });
      } else {
        var m = document.getElementById('taskModal'); if (m) m.style.display = 'flex';
      }
      setTimeout(function() {
        var titleEl = document.getElementById('modalTaskTitle');
        if (titleEl) { titleEl.value = tpl.name || ''; }
        var descEl = document.getElementById('modalDesc');
        if (descEl) { descEl.value = tpl.description || ''; }
        var priorityDrop = document.getElementById('ntmPriorityDropdown');
        if (priorityDrop) {
          var pItem = priorityDrop.querySelector('[data-val="' + appliedPriority + '"]');
          if (!pItem) pItem = priorityDrop.querySelector('[data-val="Medium"]');
          if (pItem) pItem.click();
        }
        if (titleEl) titleEl.focus();
      }, 100);
    }, 150);
  });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); } });
}

/* ---------- SHARE MODAL ---------- */
function tmOpenShareModal(tpl) {
  if (!tmCanEdit(tpl)) { tmShowToast('Only the template owner can share it', 'error'); return; }
  var groups = tmGetGroups().filter(function(g) { return !g.id.startsWith('pg_'); });
  var members = tmGetMembers().filter(function(m) { return m.id !== tmGetUserId(); });
  var selectedRecipients = (tpl.sharedWith || []).slice();
  var overlay = document.createElement('div'); overlay.className = 'tm-overlay'; overlay.id = 'tm-share-overlay'; document.body.appendChild(overlay);
  var groupOpts = groups.map(function(g) { return '<option value="g:' + g.id + ':' + g.name + '">' + tmEsc('\uD83C\uDFE2 Group: ' + g.name) + '</option>'; }).join('');
  var memberOpts = members.map(function(m) { return '<option value="u:' + m.id + ':' + m.name + '">' + tmEsc('\uD83D\uDC64 ' + m.name) + '</option>'; }).join('');
  overlay.innerHTML = '<div class="tm-modal" style="width:520px;max-width:95vw;">' +
    '<div class="tm-modal-header"><i class="fa-solid fa-share-nodes" style="color:var(--accent-blue,#1a73e8);font-size:15px;"></i>' +
    '<span class="tm-modal-title">Share Template: ' + tmEsc(tpl.name) + '</span>' +
    '<button class="tm-modal-close" id="tm-share-close">&times;</button></div>' +
    '<div class="tm-modal-body">' +
    '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">Select groups or users. Recipients can <strong>apply</strong> but <strong>not edit</strong> this template.</div>' +
    '<div class="tm-field-row"><label>Add Recipients (max 50 per action)</label>' +
    '<div style="display:flex;gap:8px;"><select class="tm-select" id="tm-share-select" style="flex:1;" size="5" multiple>' +
    '<optgroup label="Groups">' + groupOpts + '</optgroup><optgroup label="Members">' + memberOpts + '</optgroup></select>' +
    '<button class="tm-btn-primary" id="tm-share-add" style="padding:8px 16px;align-self:flex-start;"><i class="fa-solid fa-plus"></i> Add</button></div>' +
    '<div class="tm-share-limit-warn" id="tm-share-limit-warn" style="display:none;"><i class="fa-solid fa-triangle-exclamation"></i> Maximum 50 recipients reached</div></div>' +
    '<div class="tm-field-row"><label>Recipients <span id="tm-share-count" style="font-weight:400;text-transform:none;color:var(--text-muted);font-size:11px;"></span></label>' +
    '<div id="tm-share-chips" class="tm-share-recipient-list"></div></div>' +
    '<div class="tm-share-readonly-note"><i class="fa-solid fa-lock" style="color:#92400e;"></i>' +
    '<div>Recipients will have <strong>read-only</strong> access \u2014 they can apply but not edit the template structure.</div></div>' +
    '</div><div class="tm-modal-footer"><button class="tm-btn-secondary" style="padding:9px 20px;" id="tm-share-cancel">Cancel</button>' +
    '<button class="tm-btn-primary" style="padding:9px 24px;" id="tm-share-confirm"><i class="fa-solid fa-share-nodes"></i> Share Template</button></div></div>';
  function renderChips() {
    var chips = overlay.querySelector('#tm-share-chips');
    if (!chips) return;
    chips.innerHTML = selectedRecipients.length === 0 ? '<span style="color:var(--text-muted);font-size:12px;">No recipients selected</span>' :
      selectedRecipients.map(function(r) { return '<div class="tm-share-chip" data-id="' + r.id + '">' + (r.type === 'group' ? '\uD83C\uDFE2' : '\uD83D\uDC64') + ' ' + tmEsc(r.name) + '<button class="tm-share-chip-remove" data-id="' + r.id + '" title="Remove">\u00D7</button></div>'; }).join('');
    chips.querySelectorAll('.tm-share-chip-remove').forEach(function(btn) { btn.addEventListener('click', function(e) { selectedRecipients = selectedRecipients.filter(function(r) { return r.id !== e.currentTarget.dataset.id; }); renderChips(); updateCount(); }); });
    updateCount();
  }
  function updateCount() {
    var cnt = overlay.querySelector('#tm-share-count'), warn = overlay.querySelector('#tm-share-limit-warn');
    if (cnt) cnt.textContent = selectedRecipients.length + '/50 recipients selected';
    if (warn) warn.style.display = selectedRecipients.length >= MAX_SHARE ? 'block' : 'none';
  }
  renderChips();
  overlay.querySelector('#tm-share-close').addEventListener('click', function() { overlay.remove(); });
  overlay.querySelector('#tm-share-cancel').addEventListener('click', function() { overlay.remove(); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#tm-share-add').addEventListener('click', function() {
    if (selectedRecipients.length >= MAX_SHARE) { tmShowToast('Max 50 recipients', 'error'); return; }
    var sel = overlay.querySelector('#tm-share-select'), opts = Array.from(sel.selectedOptions);
    if (!opts.length) { tmShowToast('Select at least one recipient', 'error'); return; }
    var added = 0;
    opts.forEach(function(opt) {
      var parts = opt.value.split(':'), type = parts[0] === 'g' ? 'group' : 'user', id = parts[1], name = parts.slice(2).join(':');
      if (!selectedRecipients.find(function(r) { return r.id === id; }) && selectedRecipients.length < MAX_SHARE) { selectedRecipients.push({id: id, name: name, type: type}); added++; }
    });
    if (added) renderChips(); else tmShowToast('Already added or limit reached', 'info');
  });
  overlay.querySelector('#tm-share-confirm').addEventListener('click', function() {
    if (!selectedRecipients.length) { tmShowToast('Add at least one recipient', 'error'); return; }
    var ok = TM.share(tpl.id, selectedRecipients);
    if (ok) { overlay.remove(); tmShowToast('Template shared with ' + selectedRecipients.length + ' recipient' + (selectedRecipients.length > 1 ? 's' : ''), 'success'); tmRefreshLibrary(); }
  });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); } });
}

/* ---------- EDIT MODAL ---------- */
function tmOpenEditModal(tpl) {
  if (!tmCanEdit(tpl)) { tmShowToast('Only the template owner can edit it', 'error'); return; }
  var currentSubs = (tpl.subtasks || []).slice().sort(function(a, b) { return (a.order || 0) - (b.order || 0); }).map(function(s, i) { return Object.assign({}, s, {order: i}); });
  var dragSrcIdx = null;
  var overlay = document.createElement('div'); overlay.className = 'tm-overlay'; overlay.id = 'tm-edit-overlay'; document.body.appendChild(overlay);
  function render() {
    var subRows = currentSubs.map(function(s, i) {
      var priOpts = ['none','low','medium','high'].map(function(p) { return '<option value="' + p + '"' + ((s.priority || 'none') === p ? ' selected' : '') + '>' + tmPriLabel(p) + '</option>'; }).join('');
      return '<div class="tm-sub-row" data-idx="' + i + '" draggable="true">' +
        '<span class="tm-drag-handle"><i class="fa-solid fa-grip-vertical"></i></span>' +
        '<input class="tm-sub-input" placeholder="Subtask title..." value="' + tmEsc(s.title || '') + '" data-idx="' + i + '" type="text">' +
        '<select class="tm-sub-pri" data-idx="' + i + '">' + priOpts + '</select>' +
        '<button class="tm-sub-remove" data-idx="' + i + '"><i class="fa-solid fa-xmark"></i></button></div>';
    }).join('');
    var sc = currentSubs.length;
    var ePriOpts = ['none','low','medium','high'].map(function(p) { return '<option value="' + p + '"' + ((tpl.priority || 'none') === p ? ' selected' : '') + '>' + tmPriLabel(p) + '</option>'; }).join('');
    overlay.innerHTML = '<div class="tm-modal" id="tm-edit-modal">' +
      '<div class="tm-modal-header"><i class="fa-solid fa-pen" style="color:var(--accent-blue,#1a73e8);font-size:15px;"></i>' +
      '<span class="tm-modal-title">Edit Template</span>' +
      '<span style="background:rgba(245,158,11,0.15);color:#92400e;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:500;margin-left:4px;">EDIT MODE</span>' +
      '<button class="tm-modal-close" id="tm-edit-close">&times;</button></div>' +
      '<div class="tm-modal-body">' +
      '<div class="tm-alert-warn" style="margin-bottom:16px;"><i class="fa-solid fa-triangle-exclamation"></i>' +
      '<strong>Note:</strong> Changes only affect <em>future</em> uses. Tasks already created are <strong>not</strong> updated.</div>' +
      '<div class="tm-field-row"><label>Template Name <span id="tm-edit-name-count" class="tm-name-counter">' + tmEsc(tpl.name || '').length + '/100</span></label>' +
      '<input class="tm-input" id="tm-edit-name" type="text" maxlength="100" value="' + tmEsc(tpl.name || '') + '"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">' +
      '<div class="tm-field-row"><label>Priority</label><select class="tm-select" id="tm-edit-priority">' + ePriOpts + '</select></div>' +
      '<div class="tm-field-row"><label>Emoji</label><input class="tm-input" id="tm-edit-emoji" type="text" maxlength="4" value="' + tmEsc(tpl.emoji || '\uD83D\uDCCB') + '"></div>' +
      '<div class="tm-field-row"><label>Tags</label><input class="tm-input" id="tm-edit-tags" type="text" value="' + tmEsc((tpl.tags || []).join(', ')) + '"></div></div>' +
      '<div class="tm-field-row"><label>Description</label><textarea class="tm-textarea" id="tm-edit-desc" rows="2">' + tmEsc(tpl.description || '') + '</textarea></div>' +
      '<div class="tm-field-row"><div class="tm-subtask-section-header"><span class="tm-subtask-section-label">Subtasks <span id="tm-edit-sub-count">(' + sc + '/20)</span></span>' +
      '<span class="tm-edit-hint"><i class="fa-solid fa-grip-vertical"></i> Drag to reorder</span></div>' +
      '<div class="tm-subtask-list" id="tm-edit-sub-list">' + subRows + '</div>' +
      (sc >= MAX_SUB ? '<div class="tm-alert-warn"><i class="fa-solid fa-triangle-exclamation"></i> Maximum 20 subtasks</div>' : '') +
      (sc < MAX_SUB ? '<button class="tm-add-sub-btn" id="tm-edit-add-sub"><i class="fa-solid fa-plus"></i> Add Subtask</button>' : '') +
      '</div></div>' +
      '<div class="tm-modal-footer"><button class="tm-btn-secondary" style="padding:9px 20px;" id="tm-edit-cancel">Cancel</button>' +
      '<button class="tm-btn-primary" style="padding:9px 24px;" id="tm-edit-save"><i class="fa-solid fa-floppy-disk"></i> Save Changes</button></div></div>';
    overlay.querySelector('#tm-edit-close').addEventListener('click', function() { overlay.remove(); });
    overlay.querySelector('#tm-edit-cancel').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    var ni = overlay.querySelector('#tm-edit-name'), nc = overlay.querySelector('#tm-edit-name-count');
    if (ni && nc) ni.addEventListener('input', function() { nc.textContent = ni.value.length + '/100'; });
    overlay.querySelectorAll('.tm-sub-input').forEach(function(inp) { inp.addEventListener('input', function(e) { var i = parseInt(e.target.dataset.idx); if (!isNaN(i)) currentSubs[i].title = e.target.value; }); });
    overlay.querySelectorAll('.tm-sub-pri').forEach(function(sel) { sel.addEventListener('change', function(e) { var i = parseInt(e.target.dataset.idx); if (!isNaN(i)) currentSubs[i].priority = e.target.value; }); });
    overlay.querySelectorAll('.tm-sub-remove').forEach(function(btn) { btn.addEventListener('click', function(e) { currentSubs.splice(parseInt(e.currentTarget.dataset.idx), 1); currentSubs.forEach(function(x, i) { x.order = i; }); render(); }); });
    var asb = overlay.querySelector('#tm-edit-add-sub');
    if (asb) asb.addEventListener('click', function() {
      if (currentSubs.length >= MAX_SUB) { tmShowToast('Max 20 subtasks', 'error'); return; }
      currentSubs.push({id: tmUid(), title: '', priority: 'none', tags: [], description: '', order: currentSubs.length}); render();
      var inps = overlay.querySelectorAll('.tm-sub-input'); if (inps.length) inps[inps.length - 1].focus();
    });
    var sl = overlay.querySelector('#tm-edit-sub-list');
    if (sl) {
      sl.addEventListener('dragstart', function(e) { var r = e.target.closest('.tm-sub-row'); if (r) { dragSrcIdx = parseInt(r.dataset.idx); r.classList.add('dragging'); } });
      sl.addEventListener('dragover', function(e) { e.preventDefault(); var r = e.target.closest('.tm-sub-row'); sl.querySelectorAll('.tm-sub-row').forEach(function(x) { x.classList.remove('drag-over'); }); if (r) r.classList.add('drag-over'); });
      sl.addEventListener('drop', function(e) {
        e.preventDefault(); var r = e.target.closest('.tm-sub-row');
        sl.querySelectorAll('.tm-sub-row').forEach(function(x) { x.classList.remove('drag-over', 'dragging'); });
        if (!r || dragSrcIdx === null) return;
        var di = parseInt(r.dataset.idx); if (di !== dragSrcIdx) { var m = currentSubs.splice(dragSrcIdx, 1)[0]; currentSubs.splice(di, 0, m); currentSubs.forEach(function(x, i) { x.order = i; }); }
        dragSrcIdx = null; render();
      });
      sl.addEventListener('dragend', function() { sl.querySelectorAll('.tm-sub-row').forEach(function(x) { x.classList.remove('dragging', 'drag-over'); }); });
    }
    overlay.querySelector('#tm-edit-save').addEventListener('click', function() {
      var name = (overlay.querySelector('#tm-edit-name') && overlay.querySelector('#tm-edit-name').value || '').trim();
      if (!name) { tmShowToast('Name required', 'error'); return; }
      var validSubs = currentSubs.filter(function(s) { return s.title && s.title.trim(); });
      if (validSubs.length > MAX_SUB) { tmShowToast('Max 20 subtasks', 'error'); return; }
      var priority = overlay.querySelector('#tm-edit-priority') && overlay.querySelector('#tm-edit-priority').value || 'none';
      var tags = (overlay.querySelector('#tm-edit-tags') && overlay.querySelector('#tm-edit-tags').value || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean);
      var desc = overlay.querySelector('#tm-edit-desc') && overlay.querySelector('#tm-edit-desc').value || '';
      var emoji = overlay.querySelector('#tm-edit-emoji') && overlay.querySelector('#tm-edit-emoji').value || '\uD83D\uDCCB';
      TM.update(tpl.id, {name: name, priority: priority, tags: tags, description: desc, emoji: emoji, subtasks: validSubs.map(function(s, i) { return Object.assign({}, s, {order: i}); })});
      overlay.remove(); tmShowToast('Template updated \u2014 future uses only', 'success'); tmRefreshLibrary();
    });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); } });
  }
  render();
}

/* ---------- TASK EXTRACTION (Save as Template from context menu) ---------- */
function tmExtractFromTask(taskId) {
  var tasks = (window.state || {}).tasks || [];
  var task = tasks.find(function(t) { return t.id === taskId; });
  if (!task) return null;
  var subtasks = (task.subtasks || []).map(function(s, i) {
    return {id: tmUid(), title: typeof s === 'string' ? s : (s.title || s.name || ''), priority: s.priority || 'none', tags: s.tags || [], description: s.description || '', order: i};
  }).filter(function(s) { return s.title; });
  if (subtasks.length > MAX_SUB) tmShowToast('Task has ' + subtasks.length + ' subtasks \u2014 only first 20 will be saved (limit enforced)', 'info');
  /* NOTE: assignee, dueDate, startDate are intentionally NOT extracted */
  return {name: task.title || task.name || '', priority: task.priority || 'none', tags: (task.tags || []).slice(), description: task.description || '', emoji: '\uD83D\uDCCB', subtasks: subtasks.slice(0, MAX_SUB)};
}

/* ---------- CONTEXT MENU INJECTION ---------- */
function tmInjectContextMenu() {
  if (window._tmCtxMenuInjected) return;
  window._tmCtxMenuInjected = true;
  document.addEventListener('contextmenu', function(e) {
    var taskEl = e.target.closest('.svk-card,.list-row,[data-task-id],[data-taskid]');
    if (!taskEl) return;
    var taskId = taskEl.dataset.taskId || taskEl.dataset.taskid;
    if (!taskId) return;
    e.preventDefault();
    var old = document.getElementById('tm-ctx-menu'); if (old) old.remove();
    var menu = document.createElement('div'); menu.id = 'tm-ctx-menu'; menu.className = 'tm-ctx-menu';
    menu.style.cssText = 'top:' + e.clientY + 'px;left:' + e.clientX + 'px';
    menu.innerHTML = '<div class="tm-ctx-item" id="tm-ctx-save"><i class="fa-solid fa-layer-group"></i> Save as Template</div>';
    document.body.appendChild(menu);
    document.getElementById('tm-ctx-save').addEventListener('click', function() {
      var data = tmExtractFromTask(taskId);
      if (data) tmOpenCreateModal(data); else tmShowToast('Could not extract task data', 'error');
      menu.remove();
    });
    document.addEventListener('click', function() { menu.remove(); }, {once: true});
  });
}

/* ---------- NTM BUTTON INJECTION ---------- */
function tmInjectNTMButton() {
  if (document.getElementById('tm-ntm-btn')) return;
  var actions = document.querySelector('.ntm-topbar-actions,.ntm-actions');
  if (!actions) return;
  var btn = document.createElement('button');
  btn.id = 'tm-ntm-btn'; btn.title = 'Apply Template';
  btn.innerHTML = '<i class="fa-solid fa-layer-group"></i> Templates';
  btn.addEventListener('click', function() { tmOpenLibrary(); });
  actions.insertBefore(btn, actions.firstChild);
}

/* ---------- SIDEBAR INJECTION ---------- */
function tmInjectSidebar() {
  if (document.getElementById('tm-sidebar-section')) return;
  var sidebar = document.querySelector('#sidebar,nav.sidebar,.sidebar'); if (!sidebar) return;
  var section = document.createElement('div'); section.id = 'tm-sidebar-section'; section.className = 'sidebar-section';
  section.innerHTML = '<div class="section-title"><span>TEMPLATES</span></div>' +
    '<div class="nav-item" id="tm-sidebar-item" title="Task Templates"><i class="fa-solid fa-layer-group"></i><span>Templates</span>' +
    '<span class="tm-count" id="tm-sidebar-count"></span></div>';
  var sections = sidebar.querySelectorAll('.sidebar-section');
  if (sections.length >= 1) sidebar.insertBefore(section, sections[1] || null); else sidebar.appendChild(section);
  document.getElementById('tm-sidebar-item').addEventListener('click', function() { tmOpenLibrary(); });
  tmUpdateSidebarCount();
}

/* ---------- OBSERVERS ---------- */
function tmWatchNTM() {
  if (window._tmNTMObserver) return;
  window._tmNTMObserver = new MutationObserver(function() {
    var modal = document.getElementById('taskModal');
    if (modal && modal.style.display !== 'none' && !document.getElementById('tm-ntm-btn')) setTimeout(tmInjectNTMButton, 100);
  });
  window._tmNTMObserver.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class']});
}

function tmWatchSidebar() {
  if (window._tmSidebarObserver) return;
  var sidebar = document.querySelector('#sidebar,.sidebar');
  if (!sidebar) return;
  window._tmSidebarObserver = new MutationObserver(function() { if (!document.getElementById('tm-sidebar-section')) tmInjectSidebar(); });
  window._tmSidebarObserver.observe(sidebar, {childList: true, subtree: true});
}

/* ---------- PUBLIC API ---------- */
window.TaskTemplates = {
  open: tmOpenLibrary,
  create: tmOpenCreateModal,
  apply: tmOpenApplyModal,
  share: tmOpenShareModal,
  edit: tmOpenEditModal,
  getTemplates: function() { return TM.templates.slice(); },
  getPresets: function() { return window.PRESET_TEMPLATES.slice(); }
};

/* ---------- INIT ---------- */
function init() {
  if (window._tmInitDone) return;
  window._tmInitDone = true;
  tmInjectCSS();
  TM.load();
  tmInjectSidebar();
  tmInjectNTMButton();
  tmInjectContextMenu();
  tmWatchNTM();
  tmWatchSidebar();
  console.log('[TaskTemplates] v2.0 initialized. Templates:', TM.templates.length);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else setTimeout(init, 200);

})();
