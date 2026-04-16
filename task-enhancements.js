/**
 * Shadow ToDo - Task Enhancements Module
 * Implements: Personal task management, Group task management,
 * Recurring tasks, Subtask management, Add task from Board/List views,
 * Custom fields for tasks, Custom field creation from settings
 */
(function() {
    'use strict';

   // Wait for ShadowDB and DOM to be ready
   function waitForReady(cb) {
         if (typeof ShadowDB !== 'undefined' && document.getElementById('boardColumns')) {
                 cb();
         } else {
                 setTimeout(function() { waitForReady(cb); }, 200);
         }
   }

   waitForReady(function() {
         initTaskEnhancements();
   });

   function initTaskEnhancements() {
         // === 1. INLINE ADD TASK FROM BOARD VIEW ===
      injectBoardInlineAdd();

      // === 2. INLINE ADD TASK FROM LIST VIEW ===
      injectListInlineAdd();

      // === 3. CUSTOM FIELDS IN TASK MODAL ===
      injectCustomFieldsInModal();

      // === 4. CUSTOM FIELDS IN TASK DETAIL PANEL ===
      injectCustomFieldsInDetail();

      // === 5. PERSONAL TASK SETTINGS ACCESS ===
      injectPersonalTaskSettings();

      // === 6. SEED CUSTOM FIELDS IF EMPTY ===
      seedCustomFieldsIfNeeded();

      // Re-inject after view changes
      observeViewChanges();

      console.log('Task Enhancements loaded');
   }

   // ============ INLINE ADD TASK FROM BOARD VIEW ============
   function injectBoardInlineAdd() {
         var columns = document.querySelectorAll('.board-column');
         columns.forEach(function(col) {
                 if (col.querySelector('.inline-add-task-board')) return;
                 var header = col.querySelector('.column-header');
                 if (!header) return;
                 // Add + button to column header
                               var addBtn = document.createElement('span');
                 addBtn.className = 'inline-add-btn-board';
                 addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
                 addBtn.title = 'Add task to this section';
                 addBtn.style.cssText = 'cursor:pointer;margin-left:8px;color:#4285f4;font-size:13px;opacity:0.7;';
                 addBtn.addEventListener('mouseenter', function() { addBtn.style.opacity = '1'; });
                 addBtn.addEventListener('mouseleave', function() { addBtn.style.opacity = '0.7'; });
                 header.appendChild(addBtn);

                               // Add inline input at bottom of column
                               var container = col.querySelector('.board-column-body') || col;
                 var inlineDiv = document.createElement('div');
                 inlineDiv.className = 'inline-add-task-board';
                 inlineDiv.style.cssText = 'padding:8px 12px;display:none;';
                 inlineDiv.innerHTML = '<input type="text" class="inline-task-input" placeholder="Task Title, @mention assignee" style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;background:var(--bg-secondary,#f8f9fa);color:var(--text-primary,#333);outline:none;">';
                 container.appendChild(inlineDiv);

                               var input = inlineDiv.querySelector('input');
                 addBtn.addEventListener('click', function() {
                           inlineDiv.style.display = inlineDiv.style.display === 'none' ? 'block' : 'none';
                           if (inlineDiv.style.display === 'block') input.focus();
                 });

                               input.addEventListener('keydown', function(e) {
                                         if (e.key === 'Enter' && input.value.trim()) {
                                                     createInlineTask(input.value.trim(), col);
                                                     input.value = '';
                                                     inlineDiv.style.display = 'none';
                                         }
                                         if (e.key === 'Escape') {
                                                     input.value = '';
                                                     inlineDiv.style.display = 'none';
                                         }
                               });

                               input.addEventListener('blur', function() {
                                         setTimeout(function() { inlineDiv.style.display = 'none'; }, 200);
                               });
         });
   }

   function createInlineTask(title, colElement) {
         var assignee = 'Pradeep';
         var atIdx = title.indexOf('@');
         if (atIdx > -1) {
                 assignee = title.substring(atIdx + 1).trim();
                 title = title.substring(0, atIdx).trim();
         }
         // Determine group and category from current view context
      var groupId = 1; // Default: Personal tasks
      var sidebarActive = document.querySelector('.nav-item.active');
         if (sidebarActive) {
                 var view = sidebarActive.getAttribute('data-view');
                 if (view && view.startsWith('group-')) {
                           groupId = parseInt(view.replace('group-', ''));
                 }
         }

      var taskData = {
              title: title,
              description: '',
              notes: 'NA',
              status: 'Open',
              priority: 'Medium',
              assignee: assignee,
              group: groupId,
              category: 'General',
              dueDate: null,
              startDate: null,
              tags: [],
              subtasks: [],
              recurrence: null,
              reminder: null,
              customFields: {},
              completedAt: null,
              order: 0
      };

      ShadowDB.Tasks.create(taskData).then(function() {
              // Trigger refresh
                                                 if (typeof ShadowDB.emit === 'function') {
                                                           ShadowDB.emit('data:changed', { entity: 'tasks' });
                                                 }
              location.reload();
      });
   }

   // ============ INLINE ADD TASK FROM LIST VIEW ============
   function injectListInlineAdd() {
         var listBody = document.getElementById('listBody');
         if (!listBody) return;

      // Add inline add row at the end of each section
      var sectionHeaders = listBody.querySelectorAll('.list-section-header');
         sectionHeaders.forEach(function(header) {
                 var nextEl = header.nextElementSibling;
                 // Find the last task row in this section
                                      while (nextEl && !nextEl.classList.contains('list-section-header')) {
                                                if (!nextEl.nextElementSibling || nextEl.nextElementSibling.classList.contains('list-section-header')) {
                                                            // This is the last item in the section
                                                  if (!nextEl.parentElement.querySelector('.inline-add-task-list[data-section="' + header.textContent.trim() + '"]')) {
                                                                var addRow = document.createElement('div');
                                                                addRow.className = 'inline-add-task-list';
                                                                addRow.setAttribute('data-section', header.textContent.trim());
                                                                addRow.style.cssText = 'padding:6px 16px;display:flex;align-items:center;gap:8px;cursor:pointer;color:#4285f4;font-size:13px;border-bottom:1px solid var(--border-color,#eee);';
                                                                addRow.innerHTML = '<i class="fa-solid fa-plus" style="font-size:11px;"></i><input type="text" class="inline-task-input-list" placeholder="Add task..." style="border:none;background:transparent;outline:none;flex:1;font-size:13px;color:var(--text-primary,#333);padding:4px 0;">';
                                                                nextEl.parentElement.insertBefore(addRow, nextEl.nextElementSibling);

                                                              var listInput = addRow.querySelector('input');
                                                                listInput.addEventListener('keydown', function(e) {
                                                                                if (e.key === 'Enter' && listInput.value.trim()) {
                                                                                                  createInlineTask(listInput.value.trim(), null);
                                                                                                  listInput.value = '';
                                                                                }
                                                                                if (e.key === 'Escape') {
                                                                                                  listInput.value = '';
                                                                                                  listInput.blur();
                                                                                }
                                                                });
                                                  }
                                                            break;
                                                }
                                                nextEl = nextEl.nextElementSibling;
                                      }
         });

      // Also add a global add row at the very bottom
      if (!listBody.querySelector('.inline-add-task-list-global')) {
              var globalAdd = document.createElement('div');
              globalAdd.className = 'inline-add-task-list-global';
              globalAdd.style.cssText = 'padding:10px 16px;display:flex;align-items:center;gap:8px;cursor:pointer;color:#4285f4;font-size:13px;margin-top:4px;';
              globalAdd.innerHTML = '<i class="fa-solid fa-plus" style="font-size:12px;"></i><input type="text" placeholder="Add new task..." style="border:none;background:transparent;outline:none;flex:1;font-size:13px;color:var(--text-primary,#333);padding:4px 0;">';
                      listBody.appendChild(globalAdd);
              var gInput = globalAdd.querySelector('input');
              gInput.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter' && gInput.value.trim()) {
                                    createInlineTask(gInput.value.trim(), null);
                                    gInput.value = '';
                        }
                        if (e.key === 'Escape') { gInput.value = ''; gInput.blur(); }
              });
      }
   }

   // ============ CUSTOM FIELDS IN TASK MODAL ============
   function injectCustomFieldsInModal() {
         var modalBody = document.querySelector('#taskModal .modal-body');
         if (!modalBody || modalBody.querySelector('.custom-fields-section')) return;

      // Insert custom fields section before Subtasks section
      var subtasksSection = null;
         var sections = modalBody.querySelectorAll('.detail-section');
         sections.forEach(function(s) {
                 if (s.querySelector('.section-label') && s.querySelector('.section-label').textContent.includes('Subtasks')) {
                           subtasksSection = s;
                 }
         });

      var cfSection = document.createElement('div');
         cfSection.className = 'detail-section custom-fields-section';
         cfSection.id = 'modalCustomFieldsSection';
         cfSection.innerHTML = '<div class="section-label"><i class="fa-solid fa-sliders"></i> Custom Fields</div><div id="modalCustomFieldsContainer"></div>';

      if (subtasksSection) {
              modalBody.insertBefore(cfSection, subtasksSection);
      } else {
              modalBody.appendChild(cfSection);
      }

      // Listen for group change to load appropriate custom fields
      var groupSelect = document.getElementById('modalGroup');
         if (groupSelect) {
                 groupSelect.addEventListener('change', function() {
                           renderModalCustomFields(parseInt(groupSelect.value));
                 });
                 // Initial render
           renderModalCustomFields(parseInt(groupSelect.value));
         }
   }

   async function renderModalCustomFields(groupId) {
         var container = document.getElementById('modalCustomFieldsContainer');
         if (!container) return;

      try {
              var fields = await ShadowDB.CustomFields.getByGroup(groupId);
              if (!fields || fields.length === 0) {
                        container.innerHTML = '<div style="color:#999;font-size:12px;padding:4px 0;">No custom fields configured. <a href="settings.html" style="color:#4285f4;">Add from Settings</a></div>';
                        return;
              }

           var html = '';
              fields.forEach(function(f) {
                        html += '<div class="custom-field-row" style="display:flex;align-items:center;gap:8px;margin:6px 0;" data-field-id="' + f.id + '">';
                        html += '<label style="min-width:100px;font-size:12px;color:#666;">' + f.name + (f.mandatory ? ' <span style="color:red;">*</span>' : '') + '</label>';

                                     if (f.type === 'text') {
                                                 html += '<input type="text" class="custom-field-input" data-field-name="' + f.name + '" style="flex:1;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;" placeholder="Enter ' + f.name + '">';
                                     } else if (f.type === 'numeric') {
                                                 html += '<input type="number" class="custom-field-input" data-field-name="' + f.name + '" style="flex:1;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;" placeholder="Enter number">';
                                     } else if (f.type === 'dropdown') {
                                                 html += '<select class="custom-field-input" data-field-name="' + f.name + '" style="flex:1;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;"><option value="">Select...</option>';
                                                 (f.options || []).forEach(function(opt) {
                                                               html += '<option value="' + opt + '">' + opt + '</option>';
                                                 });
                                                 html += '</select>';
                                     } else if (f.type === 'multichoice') {
                                                 html += '<div class="custom-field-input" data-field-name="' + f.name + '" data-field-type="multichoice" style="flex:1;display:flex;flex-wrap:wrap;gap:4px;">';
                                                 (f.options || []).forEach(function(opt) {
                                                               html += '<label style="font-size:11px;display:flex;align-items:center;gap:2px;"><input type="checkbox" value="' + opt + '"> ' + opt + '</label>';
                                                 });
                                                 html += '</div>';
                                     }
                        html += '</div>';
              });
              container.innerHTML = html;
      } catch (e) {
              container.innerHTML = '<div style="color:#999;font-size:12px;">Error loading custom fields</div>';
      }
   }

   // ============ CUSTOM FIELDS IN TASK DETAIL ============
   function injectCustomFieldsInDetail() {
         var detailBody = document.querySelector('#taskDetailPanel .detail-body');
         if (!detailBody || detailBody.querySelector('.custom-fields-detail-section')) return;

      var subtasksSection = null;
         var sections = detailBody.querySelectorAll('.detail-section');
         sections.forEach(function(s) {
                 if (s.querySelector('.section-label') && s.querySelector('.section-label').textContent.includes('Subtasks')) {
                           subtasksSection = s;
                 }
         });

      var cfSection = document.createElement('div');
         cfSection.className = 'detail-section custom-fields-detail-section';
         cfSection.id = 'detailCustomFieldsSection';
         cfSection.innerHTML = '<div class="section-label"><i class="fa-solid fa-sliders"></i> Custom Fields</div><div id="detailCustomFieldsContainer"></div>';

      if (subtasksSection) {
              detailBody.insertBefore(cfSection, subtasksSection);
      } else {
              detailBody.appendChild(cfSection);
      }
   }

   // Hook into task detail opening to render custom fields
   var origShowDetail = null;
    function hookTaskDetailOpen() {
          // Monitor for task detail panel becoming visible
      var panel = document.getElementById('taskDetailPanel');
          if (!panel) return;

      var observer = new MutationObserver(function(mutations) {
              mutations.forEach(function(m) {
                        if (m.attributeName === 'style' && panel.style.display !== 'none') {
                                    setTimeout(renderDetailCustomFields, 100);
                        }
              });
      });
          observer.observe(panel, { attributes: true });
    }

   async function renderDetailCustomFields() {
         var container = document.getElementById('detailCustomFieldsContainer');
         if (!container) return;

      // Get current task's group from the detail panel
      var groupBtn = document.getElementById('detailGroup');
         var groupName = groupBtn ? groupBtn.textContent.trim() : 'Personal tasks';
         var tasks = await ShadowDB.Tasks.getAll();
         var groups = await ShadowDB.Groups.getAll();

      var group = groups.find(function(g) { return g.name === groupName; });
         var groupId = group ? group.id : 1;

      // Get the task's current custom field values
      var titleEl = document.getElementById('detailTaskTitle');
         var taskTitle = titleEl ? titleEl.textContent.trim() : '';
         var task = tasks.find(function(t) { return t.title === taskTitle; });
         var cfValues = task && task.customFields ? task.customFields : {};

      try {
              var fields = await ShadowDB.CustomFields.getByGroup(groupId);
              if (!fields || fields.length === 0) {
                        container.innerHTML = '<div style="color:#999;font-size:12px;padding:4px 0;">No custom fields configured</div>';
                        return;
              }

           var html = '';
              fields.forEach(function(f) {
                        var val = cfValues[f.name] || '';
                        html += '<div class="custom-field-row" style="display:flex;align-items:center;gap:8px;margin:6px 0;">';
                        html += '<label style="min-width:100px;font-size:12px;color:#666;">' + f.name + '</label>';

                                     if (f.type === 'text') {
                                                 html += '<input type="text" class="cf-detail-input" data-field-name="' + f.name + '" value="' + (val || '') + '" style="flex:1;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;">';
                                     } else if (f.type === 'numeric') {
                                                 html += '<input type="number" class="cf-detail-input" data-field-name="' + f.name + '" value="' + (val || '') + '" style="flex:1;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;">';
                                     } else if (f.type === 'dropdown') {
                                                 html += '<select class="cf-detail-input" data-field-name="' + f.name + '" style="flex:1;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;"><option value="">Select...</option>';
                                                 (f.options || []).forEach(function(opt) {
                                                               html += '<option value="' + opt + '"' + (val === opt ? ' selected' : '') + '>' + opt + '</option>';
                                                 });
                                                 html += '</select>';
                                     } else if (f.type === 'multichoice') {
                                                 var selected = Array.isArray(val) ? val : [];
                                                 html += '<div class="cf-detail-input" data-field-name="' + f.name + '" data-field-type="multichoice" style="flex:1;display:flex;flex-wrap:wrap;gap:4px;">';
                                                 (f.options || []).forEach(function(opt) {
                                                               html += '<label style="font-size:11px;display:flex;align-items:center;gap:2px;"><input type="checkbox" value="' + opt + '"' + (selected.indexOf(opt) > -1 ? ' checked' : '') + '> ' + opt + '</label>';
                                                 });
                                                 html += '</div>';
                                     }
                        html += '</div>';
              });
              container.innerHTML = html;

           // Add change listeners to save custom field values
           container.querySelectorAll('.cf-detail-input').forEach(function(inp) {
                     var evtType = inp.tagName === 'SELECT' ? 'change' : 'blur';
                     if (inp.getAttribute('data-field-type') === 'multichoice') {
                                 inp.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
                                               cb.addEventListener('change', function() { saveDetailCustomFields(task); });
                                 });
                     } else {
                                 inp.addEventListener(evtType, function() { saveDetailCustomFields(task); });
                     }
           });
      } catch(e) {
              container.innerHTML = '<div style="color:#999;font-size:12px;">Error loading fields</div>';
      }
   }

   async function saveDetailCustomFields(task) {
         if (!task) return;
         var container = document.getElementById('detailCustomFieldsContainer');
         if (!container) return;

      var cf = {};
         container.querySelectorAll('.cf-detail-input').forEach(function(inp) {
                 var name = inp.getAttribute('data-field-name');
                 if (inp.getAttribute('data-field-type') === 'multichoice') {
                           var vals = [];
                           inp.querySelectorAll('input[type="checkbox"]:checked').forEach(function(cb) {
                                       vals.push(cb.value);
                           });
                           cf[name] = vals;
                 } else {
                           cf[name] = inp.value;
                 }
         });

      task.customFields = cf;
         await ShadowDB.Tasks.update(task);
   }

   // ============ PERSONAL TASK SETTINGS ACCESS ============
   function injectPersonalTaskSettings() {
         var personalNav = document.querySelector('.nav-item[data-view="personal"]');
         if (!personalNav || personalNav.querySelector('.personal-settings-icon')) return;

      var settingsIcon = document.createElement('i');
         settingsIcon.className = 'fa-solid fa-gear personal-settings-icon';
         settingsIcon.style.cssText = 'margin-left:auto;font-size:11px;color:#999;cursor:pointer;padding:2px 4px;';
         settingsIcon.title = 'Task Settings';
         settingsIcon.addEventListener('click', function(e) {
                 e.stopPropagation();
                 window.location.href = 'settings.html#personal-task-settings';
         });
         personalNav.style.display = 'flex';
         personalNav.style.alignItems = 'center';
         personalNav.appendChild(settingsIcon);

      // Also add More Actions > Task Settings to the toolbar
      var moreActionsBtn = document.getElementById('moreActionsBtn');
         if (moreActionsBtn) {
                 moreActionsBtn.addEventListener('click', function() {
                           setTimeout(function() {
                                       var existingMenu = document.querySelector('.more-actions-dropdown');
                                       if (!existingMenu) {
                                                     // Create a menu
                                         existingMenu = document.createElement('div');
                                                     existingMenu.className = 'more-actions-dropdown dropdown-menu';
                                                     existingMenu.style.cssText = 'display:block;position:absolute;right:60px;top:90px;z-index:1000;background:var(--bg-primary,#fff);border:1px solid var(--border-color,#ddd);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);min-width:180px;padding:4px 0;';
                                                     existingMenu.innerHTML = '<div class="dropdown-item" style="padding:8px 16px;cursor:pointer;font-size:13px;" data-action="taskSettings"><i class="fa-solid fa-gear" style="margin-right:8px;"></i>Task Settings</div>' +
                                                                     '<div class="dropdown-item" style="padding:8px 16px;cursor:pointer;font-size:13px;" data-action="importTasks"><i class="fa-solid fa-file-import" style="margin-right:8px;"></i>Import Tasks</div>' +
                                                                     '<div class="dropdown-item" style="padding:8px 16px;cursor:pointer;font-size:13px;" data-action="exportTasks"><i class="fa-solid fa-file-export" style="margin-right:8px;"></i>Export Tasks</div>';
                                                     document.body.appendChild(existingMenu);

                                         existingMenu.querySelector('[data-action="taskSettings"]').addEventListener('click', function() {
                                                         window.location.href = 'settings.html';
                                                         existingMenu.style.display = 'none';
                                         });
                                                     existingMenu.querySelector('[data-action="importTasks"]').addEventListener('click', function() {
                                                                     alert('Import Tasks feature - CSV, Trello, Google import');
                                                                     existingMenu.style.display = 'none';
                                                     });
                                                     existingMenu.querySelector('[data-action="exportTasks"]').addEventListener('click', function() {
                                                                     alert('Export Tasks feature');
                                                                     existingMenu.style.display = 'none';
                                                     });

                                         setTimeout(function() {
                                                         document.addEventListener('click', function closeMenu() {
                                                                           existingMenu.style.display = 'none';
                                                                           document.removeEventListener('click', closeMenu);
                                                         });
                                         }, 10);
                                       } else {
                                                     existingMenu.style.display = existingMenu.style.display === 'none' ? 'block' : 'none';
                                       }
                           }, 50);
                 });
         }
   }

   // ============ SEED CUSTOM FIELDS ============
   async function seedCustomFieldsIfNeeded() {
         try {
                 var allCF = await ShadowDB.CustomFields.getAll();
                 if (allCF.length === 0) {
                           // Seed custom fields for Development group (id: 2)
                   await ShadowDB.CustomFields.create({
                               name: 'Sprint',
                               type: 'dropdown',
                               group: 2,
                               mandatory: false,
                               options: ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Backlog']
                   });
                           await ShadowDB.CustomFields.create({
                                       name: 'Components',
                                       type: 'multichoice',
                                       group: 2,
                                       mandatory: false,
                                       options: ['Frontend', 'Backend', 'API', 'Database', 'DevOps', 'Testing']
                           });
                           await ShadowDB.CustomFields.create({
                                       name: 'Release Plan',
                                       type: 'dropdown',
                                       group: 2,
                                       mandatory: false,
                                       options: ['v1.0', 'v1.1', 'v2.0', 'Future']
                           });
                           // Seed custom fields for Personal Tasks (id: 1)
                   await ShadowDB.CustomFields.create({
                               name: 'Location',
                               type: 'text',
                               group: 1,
                               mandatory: false,
                               options: []
                   });
                           await ShadowDB.CustomFields.create({
                                       name: 'Effort (hours)',
                                       type: 'numeric',
                                       group: 1,
                                       mandatory: false,
                                       options: []
                           });
                           console.log('Custom fields seeded');
                 }
         } catch (e) {
                 console.error('Error seeding custom fields:', e);
         }
   }

   // ============ HOOK INTO SAVE TASK TO COLLECT CUSTOM FIELDS ============
   function hookSaveTask() {
         var saveBtn = document.getElementById('saveTaskBtn');
         if (!saveBtn || saveBtn._enhanced) return;
         saveBtn._enhanced = true;

      // Add a high-priority click listener that runs before existing ones
      saveBtn.addEventListener('click', function() {
              // Collect custom field values from modal
                                     var container = document.getElementById('modalCustomFieldsContainer');
              if (!container) return;
              var cf = {};
              container.querySelectorAll('.custom-field-input').forEach(function(inp) {
                        var name = inp.getAttribute('data-field-name');
                        if (inp.getAttribute('data-field-type') === 'multichoice') {
                                    var vals = [];
                                    inp.querySelectorAll('input[type="checkbox"]:checked').forEach(function(cb) {
                                                  vals.push(cb.value);
                                    });
                                    cf[name] = vals;
                        } else {
                                    cf[name] = inp.value;
                        }
              });
              // Store in a global so the main save function can pick it up
                                     window._pendingCustomFields = cf;
      }, true); // capture phase
   }

   // ============ OBSERVE VIEW CHANGES ============
   function observeViewChanges() {
         // Re-inject board/list inline add when view changes
      var boardView = document.getElementById('boardView');
         var listView = document.getElementById('listView');

      if (boardView) {
              var boardObs = new MutationObserver(function() {
                        setTimeout(injectBoardInlineAdd, 300);
              });
              boardObs.observe(boardView, { childList: true, subtree: true });
      }

      if (listView) {
              var listObs = new MutationObserver(function() {
                        setTimeout(injectListInlineAdd, 300);
              });
              listObs.observe(listView, { childList: true, subtree: true });
      }

      // Watch for task modal open
      var taskModal = document.getElementById('taskModal');
         if (taskModal) {
                 var modalObs = new MutationObserver(function() {
                           if (taskModal.style.display !== 'none') {
                                       setTimeout(function() {
                                                     injectCustomFieldsInModal();
                                                     var groupSelect = document.getElementById('modalGroup');
                                                     if (groupSelect) renderModalCustomFields(parseInt(groupSelect.value));
                                                     hookSaveTask();
                                       }, 200);
                           }
                 });
                 modalObs.observe(taskModal, { attributes: true, attributeFilter: ['style'] });
         }

      // Watch for task detail panel
      hookTaskDetailOpen();
   }

   // ============ ENHANCED GROUP TASK MANAGEMENT ============
   // Add group context menu items for group tasks in sidebar
   function enhanceGroupContextMenu() {
         var groupItems = document.querySelectorAll('#groupsList .nav-item');
         groupItems.forEach(function(item) {
                 if (item._groupEnhanced) return;
                 item._groupEnhanced = true;

                                  item.addEventListener('contextmenu', function(e) {
                                            e.preventDefault();
                                            var groupId = item.getAttribute('data-view');
                                            if (groupId) {
                                                        groupId = parseInt(groupId.replace('group-', ''));
                                            }
                                            showGroupTaskMenu(e, groupId);
                                  });
         });
   }

   function showGroupTaskMenu(e, groupId) {
         var existing = document.querySelector('.group-task-context-menu');
         if (existing) existing.remove();

      var menu = document.createElement('div');
         menu.className = 'group-task-context-menu';
         menu.style.cssText = 'position:fixed;left:' + e.clientX + 'px;top:' + e.clientY + 'px;z-index:10000;background:var(--bg-primary,#fff);border:1px solid var(--border-color,#ddd);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);min-width:160px;padding:4px 0;';
         menu.innerHTML = '<div class="ctx-item" data-action="addTask" style="padding:8px 14px;cursor:pointer;font-size:13px;"><i class="fa-solid fa-plus" style="margin-right:6px;"></i>Add Task</div>' +
                 '<div class="ctx-item" data-action="taskSettings" style="padding:8px 14px;cursor:pointer;font-size:13px;"><i class="fa-solid fa-gear" style="margin-right:6px;"></i>Task Settings</div>';
         document.body.appendChild(menu);

      menu.querySelector('[data-action="addTask"]').addEventListener('click', function() {
              // Open the new task modal with this group pre-selected
                                                                           var newTaskBtn = document.getElementById('newTaskBtn');
              if (newTaskBtn) newTaskBtn.click();
              setTimeout(function() {
                        var groupSelect = document.getElementById('modalGroup');
                        if (groupSelect) groupSelect.value = groupId;
              }, 200);
              menu.remove();
      });

      menu.querySelector('[data-action="taskSettings"]').addEventListener('click', function() {
              window.location.href = 'settings.html#group-' + groupId;
              menu.remove();
      });

      setTimeout(function() {
              document.addEventListener('click', function rm() {
                        menu.remove();
                        document.removeEventListener('click', rm);
              });
      }, 10);
   }

   // Periodically enhance new elements
   setInterval(function() {
         enhanceGroupContextMenu();
   }, 2000);

})();
