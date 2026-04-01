/**
 * Shadow Playground - Interactive POC Environment
 */
(function() {
    'use strict';

    // ===== STATE =====
    const files = {
        poc: "// Shadow ToDo - Proof of Concept\n// Use ShadowDB API to interact with data\n\nasync function runPOC() {\n  // Get all tasks from the backend\n  const tasks = await ShadowDB.Tasks.getAll();\n  console.log('Total tasks:', tasks.length);\n\n  // Get task statistics\n  const stats = await ShadowDB.Tasks.getStats();\n  console.log('Stats:', JSON.stringify(stats, null, 2));\n\n  // Render a task list in the preview\n  const container = document.getElementById('poc-output');\n  container.innerHTML = '<h2>Task Dashboard</h2>';\n\n  const statsHtml = '<div class=\"stats-row\">' +\n    '<div class=\"stat-card\"><div class=\"stat-num\">' + stats.total + '</div><div>Total</div></div>' +\n    '<div class=\"stat-card open\"><div class=\"stat-num\">' + stats.open + '</div><div>Open</div></div>' +\n    '<div class=\"stat-card done\"><div class=\"stat-num\">' + stats.completed + '</div><div>Done</div></div>' +\n    '<div class=\"stat-card overdue\"><div class=\"stat-num\">' + stats.overdue + '</div><div>Overdue</div></div>' +\n    '</div>';\n  container.innerHTML += statsHtml;\n\n  // List tasks\n  const listHtml = tasks.map(t =>\n    '<div class=\"task-item ' + (t.status === \"Completed\" ? \"completed\" : \"\") + '\">' +\n    '<span class=\"priority ' + t.priority.toLowerCase() + '\">' + t.priority[0] + '</span>' +\n    '<span class=\"title\">' + t.title + '</span>' +\n    '<span class=\"status\">' + t.status + '</span>' +\n    '</div>'\n  ).join('');\n  container.innerHTML += '<div class=\"task-list\">' + listHtml + '</div>';\n}\n\nrunPOC();",
        template: '<!-- POC HTML Template -->\n<div id="poc-output" style="padding:16px;font-family:Inter,sans-serif;color:#e6edf3;"></div>',
        style: "/* POC Styles */\n.stats-row { display: flex; gap: 12px; margin: 16px 0; }\n.stat-card { background: #21262d; border: 1px solid #30363d; border-radius: 8px; padding: 16px; text-align: center; flex: 1; }\n.stat-card .stat-num { font-size: 28px; font-weight: 700; margin-bottom: 4px; }\n.stat-card.open .stat-num { color: #58a6ff; }\n.stat-card.done .stat-num { color: #3fb950; }\n.stat-card.overdue .stat-num { color: #f85149; }\n.task-list { margin-top: 16px; }\n.task-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #161b22; border: 1px solid #30363d; border-radius: 6px; margin-bottom: 6px; font-size: 13px; }\n.task-item.completed { opacity: 0.5; text-decoration: line-through; }\n.priority { width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; }\n.priority.high { background: #f85149; }\n.priority.medium { background: #d29922; }\n.priority.low { background: #3fb950; }\n.title { flex: 1; }\n.status { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #30363d; }"
    };
    let currentFile = 'poc';
    let savedPOCs = JSON.parse(localStorage.getItem('shadowPOCs') || '{}');

    // Base URL for scripts
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);

    // ===== INIT =====
    async function init() {
        await ShadowDB.init();
        setupTabs();
        setupEditor();
        setupConsole();
        setupFeatures();
        setupAPI();
        setupDataExplorer();
        setupButtons();
        loadEditor(currentFile);
        logConsole('Shadow Playground ready. ShadowDB initialized.', 'success');
        logConsole('Type ShadowDB commands in the console below.', 'info');
        runCode();
    }

    // ===== TABS =====
    function setupTabs() {
        document.querySelectorAll('.pg-nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.pg-nav-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const tabName = tab.dataset.tab;
                // Show/hide panels
                document.getElementById('editorPanel').style.display = tabName === 'editor' ? 'flex' : 'none';
                document.getElementById('previewSection').style.display = (tabName === 'editor') ? 'flex' : 'none';
                document.getElementById('consoleSection').style.display = (tabName === 'editor' || tabName === 'api') ? 'flex' : 'none';
                document.getElementById('featuresPanel').classList.toggle('active', tabName === 'features');
                document.getElementById('apiPanel').classList.toggle('active', tabName === 'api');
                document.getElementById('dataPanel').classList.toggle('active', tabName === 'data');
                if (tabName === 'data') refreshDataExplorer();
                if (tabName === 'features' || tabName === 'data') {
                    document.getElementById('rightPanel').style.width = '100%';
                } else {
                    document.getElementById('rightPanel').style.width = '480px';
                }
            });
        });
        // File tabs
        document.querySelectorAll('.pg-file-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                files[currentFile] = document.getElementById('codeEditor').value;
                document.querySelectorAll('.pg-file-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentFile = tab.dataset.file;
                loadEditor(currentFile);
            });
        });
    }

    // ===== EDITOR =====
    function setupEditor() {
        const editor = document.getElementById('codeEditor');
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = editor.selectionStart;
                editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(editor.selectionEnd);
                editor.selectionStart = editor.selectionEnd = start + 2;
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                runCode();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                savePOC();
            }
        });
        editor.addEventListener('input', () => {
            document.getElementById('editorStatus').textContent = 'Modified';
        });
    }

    function loadEditor(file) {
        document.getElementById('codeEditor').value = files[file] || '';
        document.getElementById('editorStatus').textContent = 'Ready';
    }

    // ===== RUN CODE =====
    function runCode() {
        files[currentFile] = document.getElementById('codeEditor').value;
        const iframe = document.getElementById('previewFrame');
        const html = (files.template || '').replace(/\\n/g, '\n');
        const css = (files.style || '').replace(/\\n/g, '\n');
        const js = (files.poc || '').replace(/\\n/g, '\n');

        const doc = `<!DOCTYPE html><html><head>
<style>${css}</style>
<script src="${baseUrl}backend.js"><\/script>
</head><body style="background:#0d1117;margin:0;">
${html}
<script>
(function(parentLog) {
    var origConsole = window.console;
    window.console = {
        log: function() {
            var a = Array.from(arguments).map(function(v) {
                return typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
            }).join(' ');
            origConsole.log.apply(origConsole, arguments);
            parentLog('log', a);
        },
        error: function() {
            var a = Array.from(arguments).map(String).join(' ');
            origConsole.error.apply(origConsole, arguments);
            parentLog('error', a);
        },
        warn: function() {
            var a = Array.from(arguments).map(String).join(' ');
            origConsole.warn.apply(origConsole, arguments);
            parentLog('warn', a);
        },
        info: function() {
            var a = Array.from(arguments).map(String).join(' ');
            origConsole.info.apply(origConsole, arguments);
            parentLog('info', a);
        }
    };
    window.onerror = function(msg) { parentLog('error', msg); };
    ShadowDB.init().then(function() {
        ${js}
    }).catch(function(err) {
        parentLog('error', 'ShadowDB init failed: ' + err.message);
    });
})(function(type, msg) {
    window.parent.postMessage({ type: 'console', level: type, message: msg }, '*');
});
<\/script></body></html>`;

        iframe.srcdoc = doc;
        document.getElementById('editorStatus').textContent = 'Running...';
        setTimeout(() => {
            document.getElementById('editorStatus').textContent = 'Executed';
        }, 500);
    }

    // Listen for console messages from iframe
    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'console') {
            logConsole(e.data.message, e.data.level);
        }
    });

    // ===== CONSOLE =====
    function setupConsole() {
        const input = document.getElementById('consoleInput');
        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const cmd = input.value.trim();
                if (!cmd) return;
                logConsole('> ' + cmd, 'info');
                input.value = '';
                try {
                    const result = await eval(cmd);
                    if (result !== undefined) {
                        logConsole(typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result), 'success');
                    }
                } catch (err) {
                    logConsole('Error: ' + err.message, 'error');
                }
            }
        });
        document.getElementById('clearConsole').addEventListener('click', () => {
            document.getElementById('consoleOutput').innerHTML = '';
        });
    }

    function logConsole(msg, level) {
        const output = document.getElementById('consoleOutput');
        const time = new Date().toLocaleTimeString();
        const line = document.createElement('div');
        line.className = 'pg-console-line ' + (level || 'info');
        line.innerHTML = '<span class="timestamp">' + time + '</span><span>' + escapeHtml(msg) + '</span>';
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }

    function escapeHtml(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ===== FEATURES / POC LAB =====
    function setupFeatures() {
        const panel = document.getElementById('featuresPanel');
        panel.innerHTML = '<h2 style="margin-bottom:20px;font-size:18px;"><i class="fa-solid fa-flask" style="color:var(--accent);margin-right:8px;"></i>POC Lab - Feature Prototyping</h2>' +
            '<div class="pg-feature-section"><h3><i class="fa-solid fa-list-check"></i> Task Management POCs</h3>' +
            featureCard('Kanban Board', 'Drag-and-drop Kanban board with columns for each status. Tests real-time status updates via ShadowDB.', 'kanban') +
            featureCard('Task Timeline', 'Gantt-style timeline view showing task durations and dependencies.', 'timeline') +
            featureCard('Batch Operations', 'Multi-select tasks and apply bulk actions (status change, assign, tag).', 'batch') +
            featureCard('Smart Filters', 'Advanced filter builder with AND/OR conditions across all task fields.', 'smartfilter') +
            '</div>' +
            '<div class="pg-feature-section"><h3><i class="fa-solid fa-chart-bar"></i> Analytics POCs</h3>' +
            featureCard('Dashboard Charts', 'Task completion charts, priority distribution, and team workload analysis.', 'charts') +
            featureCard('Burndown Chart', 'Sprint-style burndown chart tracking task completion over time.', 'burndown') +
            '</div>' +
            '<div class="pg-feature-section"><h3><i class="fa-solid fa-gear"></i> Automation POCs</h3>' +
            featureCard('Auto-assign Rules', 'Automatically assign tasks based on category or tag rules.', 'autoassign') +
            featureCard('Due Date Alerts', 'Notification system for approaching and overdue task deadlines.', 'alerts') +
            featureCard('Recurring Tasks', 'Automatically create recurring tasks on schedule (daily, weekly, monthly).', 'recurring') +
            '</div>' +
            '<div class="pg-feature-section"><h3><i class="fa-solid fa-puzzle-piece"></i> UI Component POCs</h3>' +
            featureCard('Custom Status Workflow', 'Configurable status workflow with transitions and validations.', 'workflow') +
            featureCard('Rich Text Notes', 'Markdown-powered notes editor with live preview.', 'richtext') +
            featureCard('Tag Manager', 'Advanced tag management with color picker and hierarchy.', 'tagmgr') +
            '</div>';
        panel.querySelectorAll('.pg-btn[data-poc]').forEach(btn => {
            btn.addEventListener('click', () => loadPOCTemplate(btn.dataset.poc));
        });
    }

    function featureCard(title, desc, pocId) {
        return '<div class="pg-feature-card">' +
            '<div class="pg-feature-card-header"><span class="pg-feature-card-title">' + title + '</span></div>' +
            '<div class="pg-feature-card-desc">' + desc + '</div>' +
            '<div class="pg-feature-card-actions">' +
            '<button class="pg-btn primary" data-poc="' + pocId + '"><i class="fa-solid fa-play"></i> Load POC</button>' +
            '<button class="pg-btn" onclick=""><i class="fa-solid fa-code"></i> View Code</button>' +
            '</div></div>';
    }

    // ===== POC TEMPLATES =====
    function loadPOCTemplate(pocId) {
        const templates = {
            kanban: {
                poc: "async function runPOC() {\n  const tasks = await ShadowDB.Tasks.getAll();\n  const statuses = ['Open', 'In Progress', 'In Review', 'Completed'];\n  const container = document.getElementById('poc-output');\n  container.innerHTML = '<h2>Kanban Board</h2><div class=\"kanban-board\">' +\n    statuses.map(s => {\n      const sTasks = tasks.filter(t => t.status === s);\n      return '<div class=\"kanban-col\">' +\n        '<div class=\"kanban-header\">' + s + ' <span class=\"count\">' + sTasks.length + '</span></div>' +\n        sTasks.map(t => '<div class=\"kanban-card\" draggable=\"true\" data-id=\"' + t.id + '\">' +\n          '<div class=\"card-title\">' + t.title + '</div>' +\n          '<div class=\"card-meta\"><span class=\"priority-dot ' + t.priority.toLowerCase() + '\"></span>' + t.assignee + '</div>' +\n          '</div>').join('') +\n        '</div>';\n    }).join('') + '</div>';\n}\nrunPOC();",
                style: ".kanban-board{display:flex;gap:12px;margin-top:16px;overflow-x:auto;padding-bottom:12px}.kanban-col{min-width:220px;flex:1;background:#161b22;border-radius:8px;padding:12px}.kanban-header{font-size:13px;font-weight:600;padding:8px;margin-bottom:8px;border-bottom:1px solid #30363d;display:flex;justify-content:space-between}.count{background:#30363d;padding:1px 8px;border-radius:10px;font-size:11px}.kanban-card{background:#21262d;border:1px solid #30363d;border-radius:6px;padding:10px;margin-bottom:8px;cursor:grab;transition:border-color .15s}.kanban-card:hover{border-color:#58a6ff}.card-title{font-size:13px;margin-bottom:6px}.card-meta{font-size:11px;color:#8b949e;display:flex;align-items:center;gap:6px}.priority-dot{width:8px;height:8px;border-radius:50%}.priority-dot.high{background:#f85149}.priority-dot.medium{background:#d29922}.priority-dot.low{background:#3fb950}",
                template: '<div id="poc-output" style="padding:16px;font-family:Inter,sans-serif;color:#e6edf3;"></div>'
            },
            charts: {
                poc: "async function runPOC() {\n  const stats = await ShadowDB.Tasks.getStats();\n  const container = document.getElementById('poc-output');\n  const maxVal = Math.max(...Object.values(stats.byStatus));\n  container.innerHTML = '<h2>Task Analytics</h2>' +\n    '<div class=\"chart-section\"><h3>Tasks by Status</h3><div class=\"bar-chart\">' +\n    Object.entries(stats.byStatus).map(([k,v]) =>\n      '<div class=\"bar-row\"><span class=\"bar-label\">' + k + '</span>' +\n      '<div class=\"bar-track\"><div class=\"bar-fill\" style=\"width:' + (v/maxVal*100) + '%\">' + v + '</div></div></div>'\n    ).join('') + '</div></div>' +\n    '<div class=\"chart-section\"><h3>Completion Rate</h3>' +\n    '<div class=\"donut-wrapper\"><div class=\"donut\" style=\"--pct:' + stats.completionRate + '\"><span>' + stats.completionRate + '%</span></div><div class=\"donut-label\">Tasks Completed</div></div></div>' +\n    '<div class=\"chart-section\"><h3>Priority Distribution</h3><div class=\"pie-legend\">' +\n    '<div class=\"legend-item\"><span class=\"dot high\"></span>High: ' + stats.byPriority.high + '</div>' +\n    '<div class=\"legend-item\"><span class=\"dot medium\"></span>Medium: ' + stats.byPriority.medium + '</div>' +\n    '<div class=\"legend-item\"><span class=\"dot low\"></span>Low: ' + stats.byPriority.low + '</div></div></div>';\n}\nrunPOC();",
                style: ".chart-section{margin:20px 0}.chart-section h3{font-size:14px;margin-bottom:12px;color:#8b949e}.bar-chart{display:flex;flex-direction:column;gap:8px}.bar-row{display:flex;align-items:center;gap:10px}.bar-label{width:100px;font-size:12px;text-align:right;color:#8b949e}.bar-track{flex:1;background:#21262d;border-radius:4px;height:24px;overflow:hidden}.bar-fill{height:100%;background:linear-gradient(90deg,#58a6ff,#bc8cff);border-radius:4px;display:flex;align-items:center;padding:0 8px;font-size:11px;font-weight:600;min-width:30px;transition:width .5s}.donut-wrapper{text-align:center}.donut{width:120px;height:120px;border-radius:50%;background:conic-gradient(#3fb950 calc(var(--pct) * 1%),#21262d 0);display:inline-flex;align-items:center;justify-content:center;margin:0 auto}.donut span{background:#0d1117;width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700}.donut-label{margin-top:8px;font-size:13px;color:#8b949e}.pie-legend{display:flex;gap:16px;margin-top:8px}.legend-item{font-size:12px;display:flex;align-items:center;gap:6px}.dot{width:10px;height:10px;border-radius:50%}.dot.high{background:#f85149}.dot.medium{background:#d29922}.dot.low{background:#3fb950}",
                template: '<div id="poc-output" style="padding:16px;font-family:Inter,sans-serif;color:#e6edf3;"></div>'
            },
            smartfilter: {
                poc: "async function runPOC() {\n  const tasks = await ShadowDB.Tasks.getAll();\n  const container = document.getElementById('poc-output');\n  container.innerHTML = '<h2>Smart Filter Builder</h2>' +\n    '<div class=\"filter-builder\">' +\n    '<div class=\"filter-row\"><select id=\"f-field\"><option>status</option><option>priority</option><option>assignee</option><option>group</option></select>' +\n    '<select id=\"f-op\"><option>equals</option><option>not equals</option><option>contains</option></select>' +\n    '<input id=\"f-val\" placeholder=\"Value...\" />' +\n    '<button onclick=\"applyFilter()\">Apply</button></div></div>' +\n    '<div id=\"filter-results\"></div>';\n  window.applyFilter = function() {\n    var field = document.getElementById('f-field').value;\n    var op = document.getElementById('f-op').value;\n    var val = document.getElementById('f-val').value;\n    var filtered = tasks.filter(function(t) {\n      var v = String(t[field] || '').toLowerCase();\n      var q = val.toLowerCase();\n      if (op === 'equals') return v === q;\n      if (op === 'not equals') return v !== q;\n      if (op === 'contains') return v.includes(q);\n      return true;\n    });\n    document.getElementById('filter-results').innerHTML = '<p>' + filtered.length + ' results</p>' + filtered.map(function(t) { return '<div class=\"result-item\">' + t.title + ' - ' + t.status + ' (' + t.priority + ')</div>'; }).join('');\n  };\n}\nrunPOC();",
                style: ".filter-builder{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;margin:16px 0}.filter-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.filter-row select,.filter-row input{background:#21262d;border:1px solid #30363d;color:#e6edf3;padding:6px 10px;border-radius:4px;font-size:12px}.filter-row button{background:#58a6ff;color:#000;border:none;padding:6px 14px;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer}.result-item{padding:8px 12px;background:#161b22;border:1px solid #30363d;border-radius:4px;margin:4px 0;font-size:13px}",
                template: '<div id="poc-output" style="padding:16px;font-family:Inter,sans-serif;color:#e6edf3;"></div>'
            }
        };

        const defaultPoc = {
            poc: "async function runPOC() {\n  const container = document.getElementById('poc-output');\n  container.innerHTML = '<h2>Feature POC: " + pocId + "</h2><p>This POC template is ready for your implementation.</p><p>Use ShadowDB API to build your feature prototype.</p>';\n  const tasks = await ShadowDB.Tasks.getAll();\n  console.log('Loaded', tasks.length, 'tasks for POC');\n}\nrunPOC();",
            style: files.style,
            template: files.template
        };

        const tmpl = templates[pocId] || defaultPoc;
        files.poc = tmpl.poc;
        files.style = tmpl.style;
        files.template = tmpl.template;
        currentFile = 'poc';
        document.querySelectorAll('.pg-file-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.pg-file-tab[data-file="poc"]').classList.add('active');
        document.querySelectorAll('.pg-nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.pg-nav-tab[data-tab="editor"]').classList.add('active');
        document.getElementById('editorPanel').style.display = 'flex';
        document.getElementById('previewSection').style.display = 'flex';
        document.getElementById('consoleSection').style.display = 'flex';
        document.getElementById('featuresPanel').classList.remove('active');
        document.getElementById('rightPanel').style.width = '480px';
        loadEditor('poc');
        runCode();
        logConsole('POC template "' + pocId + '" loaded and executed.', 'success');
    }

    // ===== API DOCS =====
    function setupAPI() {
        const panel = document.getElementById('apiPanel');
        panel.innerHTML = '<h2 style="margin-bottom:20px;font-size:18px;"><i class="fa-solid fa-book" style="color:var(--purple);margin-right:8px;"></i>ShadowDB API Reference</h2>' +
            apiGroup('Tasks', [
                { method: 'GET', path: 'ShadowDB.Tasks.getAll()', desc: 'Get all tasks' },
                { method: 'GET', path: 'ShadowDB.Tasks.get(id)', desc: 'Get task by ID' },
                { method: 'POST', path: 'ShadowDB.Tasks.create({title, status, priority, ...})', desc: 'Create a new task' },
                { method: 'PUT', path: 'ShadowDB.Tasks.update(task)', desc: 'Update a task' },
                { method: 'DELETE', path: 'ShadowDB.Tasks.delete(id)', desc: 'Delete a task' },
                { method: 'PUT', path: 'ShadowDB.Tasks.complete(id)', desc: 'Mark task as completed' },
                { method: 'GET', path: 'ShadowDB.Tasks.search(query)', desc: 'Search tasks by title/description' },
                { method: 'GET', path: 'ShadowDB.Tasks.getStats()', desc: 'Get task statistics' },
                { method: 'GET', path: 'ShadowDB.Tasks.getByGroup(groupId)', desc: 'Get tasks by group' },
                { method: 'PUT', path: 'ShadowDB.Tasks.addSubtask(taskId, {title})', desc: 'Add subtask to a task' },
            ]) +
            apiGroup('Groups', [
                { method: 'GET', path: 'ShadowDB.Groups.getAll()', desc: 'Get all groups' },
                { method: 'POST', path: 'ShadowDB.Groups.create({name, color, type})', desc: 'Create a group' },
                { method: 'PUT', path: 'ShadowDB.Groups.update(group)', desc: 'Update a group' },
                { method: 'DELETE', path: 'ShadowDB.Groups.delete(id)', desc: 'Delete a group' },
            ]) +
            apiGroup('Tags', [
                { method: 'GET', path: 'ShadowDB.Tags.getAll()', desc: 'Get all tags' },
                { method: 'POST', path: 'ShadowDB.Tags.create({name, color})', desc: 'Create a tag' },
            ]) +
            apiGroup('Members', [
                { method: 'GET', path: 'ShadowDB.Members.getAll()', desc: 'Get all members' },
                { method: 'GET', path: 'ShadowDB.Members.getByGroup(groupId)', desc: 'Get members by group' },
                { method: 'POST', path: 'ShadowDB.Members.create({name, email, role, group})', desc: 'Add a member' },
            ]) +
            apiGroup('Activity & Settings', [
                { method: 'GET', path: 'ShadowDB.Activity.getRecent(50)', desc: 'Get recent activity log' },
                { method: 'GET', path: 'ShadowDB.Settings.get(key)', desc: 'Get a setting value' },
                { method: 'PUT', path: 'ShadowDB.Settings.set(key, value)', desc: 'Set a setting value' },
            ]) +
            apiGroup('Utilities', [
                { method: 'POST', path: 'ShadowDB.resetAll()', desc: 'Reset database to seed data' },
                { method: 'GET', path: 'ShadowDB.exportAll()', desc: 'Export all data as JSON' },
                { method: 'POST', path: 'ShadowDB.importAll(data)', desc: 'Import data from JSON' },
            ]);
        panel.querySelectorAll('.pg-api-item').forEach(item => {
            item.addEventListener('click', () => {
                const path = item.querySelector('.pg-api-path').textContent;
                document.getElementById('consoleInput').value = path;
                document.getElementById('consoleInput').focus();
            });
        });
    }

    function apiGroup(title, items) {
        return '<div class="pg-api-group"><h3><i class="fa-solid fa-cube"></i> ' + title + '</h3>' +
            items.map(i => {
                const mc = i.method.toLowerCase();
                return '<div class="pg-api-item"><span class="pg-api-method ' + mc + '">' + i.method + '</span>' +
                    '<code class="pg-api-path">' + i.path + '</code>' +
                    '<div class="pg-api-desc">' + i.desc + '</div></div>';
            }).join('') + '</div>';
    }

    // ===== DATA EXPLORER =====
    let currentStore = 'tasks';

    function setupDataExplorer() {
        const panel = document.getElementById('dataPanel');
        panel.innerHTML = '<div class="pg-data-stores" id="dataStores"></div><div class="pg-data-table" id="dataTable"></div>';
        const storesEl = document.getElementById('dataStores');
        Object.keys(ShadowDB.STORES).forEach(store => {
            const btn = document.createElement('div');
            btn.className = 'pg-data-store' + (store === currentStore ? ' active' : '');
            btn.textContent = store;
            btn.addEventListener('click', () => {
                currentStore = store;
                document.querySelectorAll('.pg-data-store').forEach(s => s.classList.remove('active'));
                btn.classList.add('active');
                refreshDataExplorer();
            });
            storesEl.appendChild(btn);
        });
    }

    async function refreshDataExplorer() {
        const data = await ShadowDB._raw.getAll(ShadowDB.STORES[currentStore]);
        const tableEl = document.getElementById('dataTable');
        if (!data || data.length === 0) {
            tableEl.innerHTML = '<p style="padding:20px;color:var(--text2)">No data in ' + currentStore + '</p>';
            return;
        }
        const keys = Object.keys(data[0]).filter(k => !['subtasks','customFields','data'].includes(k));
        let html = '<table><thead><tr>' + keys.map(k => '<th>' + k + '</th>').join('') + '</tr></thead><tbody>';
        data.forEach(row => {
            html += '<tr>' + keys.map(k => {
                let v = row[k];
                if (Array.isArray(v)) v = v.length + ' items';
                else if (typeof v === 'object' && v !== null) v = JSON.stringify(v).substring(0, 50);
                else if (v === null || v === undefined) v = '-';
                return '<td>' + String(v) + '</td>';
            }).join('') + '</tr>';
        });
        html += '</tbody></table>';
        tableEl.innerHTML = html;
    }

    // ===== BUTTONS =====
    function setupButtons() {
        document.getElementById('runBtn').addEventListener('click', runCode);
        document.getElementById('refreshPreview').addEventListener('click', runCode);
        document.getElementById('resetBtn').addEventListener('click', async () => {
            await ShadowDB.resetAll();
            logConsole('Database reset to seed data.', 'warn');
            runCode();
        });
        document.getElementById('saveBtn').addEventListener('click', savePOC);
        document.getElementById('snippetBtn').addEventListener('click', showSnippets);
        document.getElementById('formatBtn').addEventListener('click', () => {
            logConsole('Code formatted.', 'info');
        });
    }

    function savePOC() {
        files[currentFile] = document.getElementById('codeEditor').value;
        const name = prompt('Name your POC:', 'My POC ' + new Date().toLocaleDateString());
        if (name) {
            savedPOCs[name] = { ...files, savedAt: new Date().toISOString() };
            localStorage.setItem('shadowPOCs', JSON.stringify(savedPOCs));
            logConsole('POC "' + name + '" saved!', 'success');
            document.getElementById('editorStatus').textContent = 'Saved';
        }
    }

    function showSnippets() {
        const snippets = [
            { name: 'Get All Tasks', code: 'const tasks = await ShadowDB.Tasks.getAll();\nconsole.log(tasks);' },
            { name: 'Create Task', code: 'const task = await ShadowDB.Tasks.create({\n  title: "New Task",\n  priority: "High",\n  status: "Open"\n});\nconsole.log("Created:", task);' },
            { name: 'Get Stats', code: 'const stats = await ShadowDB.Tasks.getStats();\nconsole.log(stats);' },
            { name: 'Search Tasks', code: 'const results = await ShadowDB.Tasks.search("bug");\nconsole.log(results);' },
        ];
        const choice = prompt('Snippets:\n' + snippets.map((s, i) => (i + 1) + '. ' + s.name).join('\n') + '\n\nEnter number:');
        if (choice && snippets[parseInt(choice) - 1]) {
            const editor = document.getElementById('codeEditor');
            const snippet = snippets[parseInt(choice) - 1].code;
            const pos = editor.selectionStart;
            editor.value = editor.value.substring(0, pos) + snippet + editor.value.substring(pos);
            logConsole('Snippet inserted: ' + snippets[parseInt(choice) - 1].name, 'info');
        }
    }

    // ===== START =====
    init();
})();
