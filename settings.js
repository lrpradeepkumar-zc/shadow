// Settings Page JavaScript - Shadow ToDo
document.addEventListener('DOMContentLoaded', () => {
    initSettings();
});

function initSettings() {
    // Navigation
    setupNavigation();
    // Groups
    setupGroups();
    // Group Detail
    setupGroupDetail();
    // Task Settings Sub-navigation
    setupTaskSettingsNav();
    // Theme handlers
    setupThemeHandlers();
    // Close button
    setupCloseButton();
    // Shortcuts toggle
    setupShortcutsToggle();
}

// ============ NAVIGATION ============
function setupNavigation() {
    const navItems = document.querySelectorAll('.settings-nav-item');
    const sections = document.querySelectorAll('.settings-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.dataset.section;
            
            // Update nav active state
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            // Show corresponding section
            sections.forEach(s => s.classList.remove('active'));
            const targetSection = document.getElementById('section-' + sectionId);
            if (targetSection) {
                targetSection.classList.add('active');
            }
            
            // If switching to groups, ensure list view
            if (sectionId === 'groups') {
                document.getElementById('groupsListView').classList.remove('hidden');
                document.getElementById('groupDetailView').classList.add('hidden');
            }
        });
    });
}

// ============ CLOSE BUTTON ============
function setupCloseButton() {
    const closeBtn = document.getElementById('closeSettings');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
}

// ============ THEME HANDLERS ============
function setupThemeHandlers() {
    // Left panel theme
    const panelOptions = document.querySelectorAll('.theme-panel-option');
    panelOptions.forEach(option => {
        option.addEventListener('click', () => {
            panelOptions.forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
        });
    });
    
    // Font family change
    const fontFamily = document.getElementById('fontFamily');
    const fontPreview = document.getElementById('fontPreview');
    if (fontFamily && fontPreview) {
        fontFamily.addEventListener('change', () => {
            fontPreview.style.fontFamily = fontFamily.value;
        });
    }
    
    // Font size change  
    const fontSize = document.getElementById('fontSize');
    if (fontSize && fontPreview) {
        fontSize.addEventListener('change', () => {
            const sizes = { browser: '18px', small: '14px', medium: '16px', large: '20px' };
            fontPreview.style.fontSize = sizes[fontSize.value] || '18px';
        });
    }
    
    // Save settings to localStorage
    document.querySelectorAll('input[name="themeColor"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const colors = {
                cobalt: '#4285f4', fern: '#0f9d58', tangerine: '#f4b400',
                cardinal: '#db4437', storm: '#9e9e9e', vintage: '#e8a735'
            };
            document.documentElement.style.setProperty('--accent', colors[radio.value] || '#4285f4');
            localStorage.setItem('themeColor', radio.value);
        });
    });
    
    // Load saved theme color
    const savedColor = localStorage.getItem('themeColor');
    if (savedColor) {
        const radio = document.querySelector('input[name="themeColor"][value="' + savedColor + '"]');
        if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
        }
    }

        // Appearance mode (light/dark/system)
        document.querySelectorAll('input[name="appearance"]').forEach(radio => {
                    radio.addEventListener('change', () => {
                                    const mode = radio.value;
                                    localStorage.setItem('shadow-theme', mode);
                                    if (mode === 'light') {
                                                        document.body.classList.add('light-theme');
                                    } else if (mode === 'night') {
                                                        document.body.classList.remove('light-theme');
                                    } else if (mode === 'system') {
                                                        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                                                                                document.body.classList.add('light-theme');
                                                        } else {
                                                                                document.body.classList.remove('light-theme');
                                                        }
                                    }
                    });
        });

        // Load saved appearance mode and set the correct radio
        const savedTheme = localStorage.getItem('shadow-theme');
        if (savedTheme) {
                    const radio = document.querySelector('input[name="appearance"][value="' + savedTheme + '"]');
                    if (radio) {
                                    radio.checked = true;
                    }
                    if (savedTheme === 'light') {
                                    document.body.classList.add('light-theme');
                    } else if (savedTheme === 'system') {
                                    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                                                        document.body.classList.add('light-theme');
                                    }
                    }
        }
}

// ============ SHORTCUTS TOGGLE ============
function setupShortcutsToggle() {
    const toggle = document.getElementById('shortcutsToggle');
    if (toggle) {
        toggle.addEventListener('change', () => {
            const container = document.querySelector('.shortcuts-container');
            if (container) {
                container.style.opacity = toggle.checked ? '1' : '0.4';
                container.style.pointerEvents = toggle.checked ? 'auto' : 'none';
            }
            const label = document.querySelector('.toggle-label');
            if (label) {
                label.textContent = toggle.checked ? 'On' : 'Off';
            }
        });
    }
}

// ============ GROUPS DATA ============
const groupsData = [
    {
        id: 1, name: 'Development Team', role: 'moderator', type: 'org-email',
        streams: true, memberCount: 24,
        members: [
            { name: 'Alex Johnson', email: 'alex.j@company.com', role: 'Moderator' },
            { name: 'Sarah Chen', email: 'sarah.c@company.com', role: 'Moderator' },
            { name: 'Mike Peters', email: 'mike.p@company.com', role: 'Member' },
            { name: 'Lisa Wang', email: 'lisa.w@company.com', role: 'Member' },
            { name: 'Tom Brown', email: 'tom.b@company.com', role: 'Member' },
            { name: 'Emily Davis', email: 'emily.d@company.com', role: 'Member' }
        ],
        categories: [
            { name: 'General', color: '#db4437' },
            { name: 'Frontend', color: '#4285f4' },
            { name: 'Backend', color: '#0f9d58' },
            { name: 'DevOps', color: '#f4b400' },
            { name: 'Testing', color: '#9c27b0' }
        ],
        statuses: [
            { name: 'Open', color: '#db4437' },
            { name: 'In Progress', color: '#4285f4' },
            { name: 'In Review', color: '#f4b400' },
            { name: 'Completed', color: '#0f9d58' },
            { name: 'On Hold', color: '#9e9e9e' }
        ],
        tags: [
            { name: 'P1 Items', color: '#f4b400' },
            { name: 'Bug Fix', color: '#db4437' },
            { name: 'Feature', color: '#4285f4' },
            { name: 'Enhancement', color: '#0f9d58' }
        ],
        customFields: [
            { type: 'Dropdown', name: 'Sprint' },
            { type: 'Multi Choice', name: 'Components' },
            { type: 'Dropdown', name: 'Release Plan' }
        ]
    },
    {
        id: 2, name: 'Design Team', role: 'moderator', type: 'personal',
        streams: true, memberCount: 12,
        members: [
            { name: 'Rachel Kim', email: 'rachel.k@company.com', role: 'Moderator' },
            { name: 'David Lee', email: 'david.l@company.com', role: 'Member' },
            { name: 'Sophie Turner', email: 'sophie.t@company.com', role: 'Member' }
        ],
        categories: [
            { name: 'General', color: '#db4437' },
            { name: 'UI Design', color: '#4285f4' },
            { name: 'UX Research', color: '#9c27b0' },
            { name: 'Branding', color: '#f4b400' }
        ],
        statuses: [
            { name: 'Open', color: '#db4437' },
            { name: 'In Design', color: '#4285f4' },
            { name: 'Review', color: '#f4b400' },
            { name: 'Done', color: '#0f9d58' }
        ],
        tags: [
            { name: 'Urgent', color: '#db4437' },
            { name: 'Redesign', color: '#9c27b0' }
        ],
        customFields: [
            { type: 'Dropdown', name: 'Design System' }
        ]
    },
    {
        id: 3, name: 'Marketing', role: 'member', type: 'org-email',
        streams: true, memberCount: 45,
        members: [
            { name: 'John Smith', email: 'john.s@company.com', role: 'Moderator' },
            { name: 'Anna Wilson', email: 'anna.w@company.com', role: 'Member' },
            { name: 'Chris Taylor', email: 'chris.t@company.com', role: 'Member' }
        ],
        categories: [
            { name: 'General', color: '#db4437' },
            { name: 'Campaigns', color: '#4285f4' },
            { name: 'Content', color: '#0f9d58' },
            { name: 'Social Media', color: '#9c27b0' }
        ],
        statuses: [
            { name: 'Open', color: '#db4437' },
            { name: 'Active', color: '#4285f4' },
            { name: 'Completed', color: '#0f9d58' }
        ],
        tags: [
            { name: 'Q1 Campaign', color: '#f4b400' },
            { name: 'Blog Post', color: '#4285f4' }
        ],
        customFields: []
    },
    {
        id: 4, name: 'Product Team', role: 'moderator', type: 'org-no-email',
        streams: false, memberCount: 18,
        members: [
            { name: 'Diana Prince', email: 'diana.p@company.com', role: 'Moderator' },
            { name: 'Bruce Wayne', email: 'bruce.w@company.com', role: 'Member' }
        ],
        categories: [
            { name: 'General', color: '#db4437' },
            { name: 'Roadmap', color: '#4285f4' },
            { name: 'Customer Feedback', color: '#f4b400' }
        ],
        statuses: [
            { name: 'Backlog', color: '#9e9e9e' },
            { name: 'Planned', color: '#4285f4' },
            { name: 'In Development', color: '#f4b400' },
            { name: 'Released', color: '#0f9d58' }
        ],
        tags: [
            { name: 'Feature Request', color: '#4285f4' },
            { name: 'Customer Issue', color: '#db4437' }
        ],
        customFields: [
            { type: 'Dropdown', name: 'Priority Level' },
            { type: 'Dropdown', name: 'Quarter' }
        ]
    },
    {
        id: 5, name: 'Support', role: 'member', type: 'org-email',
        streams: true, memberCount: 156,
        members: [
            { name: 'Karen White', email: 'karen.w@company.com', role: 'Moderator' },
            { name: 'James Bond', email: 'james.b@company.com', role: 'Member' }
        ],
        categories: [
            { name: 'General', color: '#db4437' },
            { name: 'Tickets', color: '#4285f4' },
            { name: 'Escalations', color: '#f4b400' }
        ],
        statuses: [
            { name: 'New', color: '#db4437' },
            { name: 'In Progress', color: '#4285f4' },
            { name: 'Resolved', color: '#0f9d58' },
            { name: 'Closed', color: '#9e9e9e' }
        ],
        tags: [
            { name: 'Critical', color: '#db4437' },
            { name: 'Bug', color: '#f4b400' }
        ],
        customFields: [
            { type: 'Dropdown', name: 'Severity' }
        ]
    },
    {
        id: 6, name: 'Personal Tasks', role: 'owner', type: 'personal',
        streams: false, memberCount: 1,
        members: [
            { name: 'You', email: 'user@company.com', role: 'Owner' }
        ],
        categories: [
            { name: 'General', color: '#db4437' },
            { name: 'My Tasks', color: '#4285f4' },
            { name: 'Calendar', color: '#0f9d58' }
        ],
        statuses: [
            { name: 'Open', color: '#db4437' },
            { name: 'In Progress', color: '#4285f4' },
            { name: 'Done', color: '#0f9d58' }
        ],
        tags: [
            { name: 'Important', color: '#db4437' },
            { name: 'Personal', color: '#0f9d58' }
        ],
        customFields: []
    }
];

// ============ GROUPS SETUP ============
function setupGroups() {
    renderGroupCards(groupsData);
    
    // Search
    const searchInput = document.getElementById('groupsSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            const filtered = groupsData.filter(g => g.name.toLowerCase().includes(query));
            renderGroupCards(filtered);
        });
    }
    
    // Type filter
    document.querySelectorAll('input[name="groupType"]').forEach(radio => {
        radio.addEventListener('change', () => filterGroups());
    });
    
    // Role filter
    document.querySelectorAll('input[name="groupRole"]').forEach(radio => {
        radio.addEventListener('change', () => filterGroups());
    });
}

function filterGroups() {
    const typeFilter = document.querySelector('input[name="groupType"]:checked').value;
    const roleFilter = document.querySelector('input[name="groupRole"]:checked').value;
    
    let filtered = groupsData;
    
    if (typeFilter !== 'all') {
        filtered = filtered.filter(g => g.type === typeFilter);
    }
    if (roleFilter !== 'all') {
        filtered = filtered.filter(g => g.role === roleFilter);
    }
    
    renderGroupCards(filtered);
}

function renderGroupCards(groups) {
    const grid = document.getElementById('groupsGrid');
    const countEl = document.getElementById('groupsCount');
    if (!grid) return;
    
    if (countEl) countEl.textContent = groups.length + ' Groups';
    
    grid.innerHTML = groups.map(group => {
        const initials = group.name.split(' ').map(w => w[0]).join('').substring(0, 2);
        const colors = ['#4285f4', '#0f9d58', '#f4b400', '#db4437', '#9c27b0', '#00bcd4'];
        const bgColor = colors[group.id % colors.length];
        
        const memberAvatars = group.members.slice(0, 4).map(m => {
            const mi = m.name.split(' ').map(w => w[0]).join('');
            return '<div class="member-avatar" style="background:' + colors[(m.name.length) % colors.length] + '">' + mi + '</div>';
        }).join('');
        
        const extraCount = group.memberCount > 4 ? '<span class="member-count-badge">+' + (group.memberCount - 4) + '</span>' : '';
        
        return '<div class="group-card" data-group-id="' + group.id + '">' +
            '<div class="group-card-icon colored" style="background:' + bgColor + '">' + initials + '</div>' +
            '<div class="group-card-name">' + group.name + '</div>' +
            '<div class="group-card-role ' + group.role + '">' + capitalize(group.role) + '</div>' +
            '<div class="group-card-members">' + memberAvatars + extraCount + '</div>' +
            '</div>';
    }).join('');
    
    // Add click handlers
    grid.querySelectorAll('.group-card').forEach(card => {
        card.addEventListener('click', () => {
            const groupId = parseInt(card.dataset.groupId);
            openGroupDetail(groupId);
        });
    });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============ GROUP DETAIL ============
let currentGroup = null;

function openGroupDetail(groupId) {
    currentGroup = groupsData.find(g => g.id === groupId);
    if (!currentGroup) return;
    
    document.getElementById('groupsListView').classList.add('hidden');
    document.getElementById('groupDetailView').classList.remove('hidden');
    
    document.getElementById('groupDetailName').textContent = currentGroup.name;
    document.getElementById('groupNameValue').textContent = currentGroup.name;
    document.getElementById('groupStreamsValue').textContent = currentGroup.streams ? 'Yes' : 'No';
    
    // Reset to General tab
    document.querySelectorAll('.group-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.group-tab[data-tab="general"]').classList.add('active');
    document.querySelectorAll('.group-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-general').classList.add('active');
    
    // Populate members
    renderMembers(currentGroup.members, currentGroup.memberCount);
    
    // Populate task settings
    renderCategories(currentGroup.categories);
    renderStatuses(currentGroup.statuses);
    renderAssignees(currentGroup.members);
    renderTags(currentGroup.tags);
    renderCustomFields(currentGroup.customFields);
    
    // Reset task settings nav
    document.querySelectorAll('.task-settings-nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('.task-settings-nav-item[data-tsection="category"]').classList.add('active');
    document.querySelectorAll('.task-settings-section').forEach(s => s.classList.remove('active'));
    document.getElementById('tsection-category').classList.add('active');
}

function setupGroupDetail() {
    // Back button
    const backBtn = document.getElementById('backToGroups');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('groupsListView').classList.remove('hidden');
            document.getElementById('groupDetailView').classList.add('hidden');
        });
    }
    
    // Tab switching
    document.querySelectorAll('.group-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.group-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.group-tab-content').forEach(c => c.classList.remove('active'));
            const targetTab = document.getElementById('tab-' + tab.dataset.tab);
            if (targetTab) targetTab.classList.add('active');
        });
    });
}

function setupTaskSettingsNav() {
    document.querySelectorAll('.task-settings-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.task-settings-nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.task-settings-section').forEach(s => s.classList.remove('active'));
            const target = document.getElementById('tsection-' + item.dataset.tsection);
            if (target) target.classList.add('active');
        });
    });
}

// ============ RENDER FUNCTIONS ============
function renderMembers(members, totalCount) {
    const list = document.getElementById('membersList');
    const countEl = document.getElementById('membersCount');
    if (!list) return;
    
    if (countEl) countEl.textContent = totalCount + ' Members';
    
    // Group by role
    const moderators = members.filter(m => m.role === 'Moderator' || m.role === 'Owner');
    const regularMembers = members.filter(m => m.role === 'Member');
    
    let html = '';
    
    if (moderators.length > 0) {
        html += '<div class="members-role-header">Moderator (' + moderators.length + ')</div>';
        moderators.forEach(m => {
            const initials = m.name.split(' ').map(w => w[0]).join('');
            const colors = ['#4285f4', '#0f9d58', '#f4b400', '#db4437', '#9c27b0'];
            const bg = colors[m.name.length % colors.length];
            html += '<div class="member-item">' +
                '<div class="member-item-avatar" style="background:' + bg + '">' + initials + '</div>' +
                '<div class="member-item-info">' +
                '<div class="member-item-name">' + m.name + '</div>' +
                '<div class="member-item-email">' + m.email + '</div>' +
                '</div></div>';
        });
    }
    
    if (regularMembers.length > 0) {
        html += '<div class="members-role-header">Member (' + regularMembers.length + ')</div>';
        regularMembers.forEach(m => {
            const initials = m.name.split(' ').map(w => w[0]).join('');
            const colors = ['#4285f4', '#0f9d58', '#f4b400', '#db4437', '#9c27b0'];
            const bg = colors[m.name.length % colors.length];
            html += '<div class="member-item">' +
                '<div class="member-item-avatar" style="background:' + bg + '">' + initials + '</div>' +
                '<div class="member-item-info">' +
                '<div class="member-item-name">' + m.name + '</div>' +
                '<div class="member-item-email">' + m.email + '</div>' +
                '</div></div>';
        });
    }
    
    list.innerHTML = html;
}

function renderCategories(categories) {
    const list = document.getElementById('categoryList');
    if (!list) return;
    list.innerHTML = categories.map(c =>
        '<div class="settings-list-item"><div class="item-color" style="background:' + c.color + '"></div><span>' + c.name + '</span></div>'
    ).join('');
}

function renderStatuses(statuses) {
    const list = document.getElementById('statusList');
    if (!list) return;
    list.innerHTML = statuses.map(s =>
        '<div class="settings-list-item"><div class="item-color" style="background:' + s.color + '"></div><span>' + s.name + '</span></div>'
    ).join('');
}

function renderAssignees(members) {
    const list = document.getElementById('assigneeList');
    if (!list) return;
    const colors = ['#4285f4', '#0f9d58', '#f4b400', '#db4437', '#9c27b0'];
    list.innerHTML = members.map(m => {
        const initials = m.name.split(' ').map(w => w[0]).join('');
        const bg = colors[m.name.length % colors.length];
        return '<div class="settings-list-item">' +
            '<div class="member-item-avatar" style="background:' + bg + ';width:24px;height:24px;font-size:10px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white">' + initials + '</div>' +
            '<span>' + m.name + '</span></div>';
    }).join('');
}

function renderTags(tags) {
    const list = document.getElementById('tagsList');
    if (!list) return;
    list.innerHTML = tags.map(t =>
        '<div class="settings-list-item"><div class="item-color" style="background:' + t.color + '"></div><span>' + t.name + '</span></div>'
    ).join('');
}

function renderCustomFields(fields) {
    const list = document.getElementById('customFieldsList');
    if (!list) return;
    if (fields.length === 0) {
        list.innerHTML = '<div class="settings-list-item" style="color:var(--text-muted);justify-content:center">No custom fields configured</div>';
        return;
    }
    list.innerHTML = fields.map(f =>
        '<div class="settings-list-item"><svg class="item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><polyline points="9 11 12 14 22 4"/></svg>' +
        '<div class="custom-field-item"><div class="custom-field-type">' + f.type + '</div><div class="custom-field-name">' + f.name + '</div></div></div>'
    ).join('');
}

// ============ CREATE GROUP MODAL (placeholder) ============
const createGroupBtn = document.getElementById('createGroupBtn');
if (createGroupBtn) {
    createGroupBtn.addEventListener('click', () => {
        alert('Create new group feature - Coming soon!');
    });
}

// ============ PRINT / RESET SHORTCUTS ============
const printBtn = document.getElementById('printShortcuts');
if (printBtn) {
    printBtn.addEventListener('click', () => {
        window.print();
    });
}

const resetBtn = document.getElementById('resetShortcuts');
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        alert('Keyboard shortcuts have been reset to defaults.');
    });
}
