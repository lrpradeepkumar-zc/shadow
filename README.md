# Shadow ToDo

A replica of **Zoho ToDo** – Task Management Application built with pure HTML, CSS, and JavaScript.

## Features

### Views
- **Agenda View** – Tasks organized by timeline (Delayed, Today, This Week, This Month)
- **My Day** – Tasks due today
- **Created by Me** – Tasks created by the current user
- **Assigned to Me** – Tasks assigned to the current user
- **Shared with Me** – Collaboratively shared tasks
- **Personal Tasks** – Personal task list with categories
- **Unified View** – All tasks in one place

### View Types
- **Board View** – Kanban-style columns with task cards
- **List View** – Tabular view with columns (Task Title, Assignee, Status, Due Date)

### Task Management
- Create new tasks with full details
- Set task title, description, and notes
- Assign tasks to team members
- Set start date and due date
- Set priority levels (None, Low, Medium, High)
- Set reminders
- Add subtasks with completion tracking
- Tag tasks with colored labels
- Set task status (Open, In Progress, Fixed, Closed)
- Set recurring tasks
- Add attachments
- Activity timeline tracking
- Comments on tasks

### Organization
- **Groups** – Create and manage task groups with categories
- **Tags** – Color-coded tags for task categorization
- **Categories** – Sub-organization within groups
- **Sorting** – Sort by Due Date, Created Time, Priority, Title
- **Filtering** – Filter tasks by various criteria

### UI Features
- Dark theme (matching Zoho ToDo)
- Responsive sidebar navigation
- Board and List view toggles
- Task detail panel with inline editing
- Modal dialogs for task creation
- Search functionality
- Right sidebar with quick actions (Settings, Calendar, Zia AI)
- Stats display showing task counts

### Settings
- **System** – Startup, display language, font, theme (dark/light), appearance, banner, downloads
- **Keyboard Shortcuts** – Global, search, and notification shortcuts
- **Groups** – Group management with filters (type, role, streams)
- **Group Detail** – General settings, members, task settings (category, status, assignee, tags, custom fields)

### Backend (ShadowDB)
- **IndexedDB** powered persistent storage
- 9 data stores: tasks, groups, tags, categories, members, customFields, comments, activity, settings
- Full CRUD operations for all entities
- Task-specific operations (complete, reopen, addSubtask, search, getStats)
- Event bus for real-time updates
- Seed data with 10 tasks, 3 groups, 7 tags, 4 members
- Export/Import functionality
- Database reset

### Interactive Playground
- **Code Editor** – Write and execute POC code with live preview
- **POC Lab** – 12 pre-built feature templates across 4 categories:
  - Task Management: Kanban Board, Task Timeline, Batch Operations, Smart Filters
  - Analytics: Dashboard Charts, Burndown Chart
  - Automation: Auto-assign Rules, Due Date Alerts, Recurring Tasks
  - UI Components: Custom Status Workflow, Rich Text Notes, Tag Manager
- **API Console** – Full ShadowDB API reference with clickable endpoints
- **Data Explorer** – Browse all 9 database stores in table format
- **Console** – Execute JavaScript commands with ShadowDB API

### Approval Workflow
- **State Machine** – Three-state approval flow: Pending Approval → Approved | Changes Requested
- **Single Active Request** – One active approval request constraint per task enforced at DB level
- **Task Locking** – Task fields are locked during pending approval to prevent edits
- **In-Flight Preservation** – Toggling approval feature OFF does not cancel existing requests
- **Audit Trail** – Immutable audit trail with timestamped entries for all approval events
- **Notification System** – Notification system for approval events
- **Admin Settings Panel** – Per-group approval workflow configuration with enable/disable toggle
- **Decision Interface** – Approve/Request Changes modal with comments for reviewers
- **Lock Indicators** – Visual lock indicators on tasks pending approval
- **Audit Timeline** – Full audit history timeline viewable per task
- **Dark/Light Theme Support** – Complete CSS styling with dark and light theme support

## Tech Stack
- Pure HTML5
- CSS3 with CSS Variables
- Vanilla JavaScript (ES6+)
- Font Awesome 6.5 for icons
- IndexedDB for data persistence

## Getting Started
1. Clone the repository
2. Open index.html in a browser
3. Start managing your tasks!

## File Structure
- index.html – Main application structure and UI components
- styles.css – Complete styling with dark theme
- app.js – Application logic, task CRUD, views, and navigation
- backend.js – IndexedDB powered ShadowDB with full CRUD API
- settings.html – Settings page UI
- settings.css – Settings page styles
- settings.js – Settings page logic
- playground.html – Interactive POC playground UI
- playground.js – Playground logic with code editor, POC templates, API console
- workflow-engine.js – Rule-based automation engine with triggers, conditions, and actions
- workflow-ui.js – Visual rule builder UI logic and interactions
- workflow.html – Workflow automation page UI
- workflow.css – Workflow page styles
- approval-backend.js – Approval workflow backend with state machine, audit trail, and task locking
- approval-ui.js – Approval workflow UI with modals, lock indicators, and audit timeline
- approval.css – Approval workflow styles with dark/light theme support
- README.md – This file

## Live Demo
- **Main App**: https://lrpradeepkumar-zc.github.io/shadow/
- **Settings**: https://lrpradeepkumar-zc.github.io/shadow/settings.html
- **Playground**: https://lrpradeepkumar-zc.github.io/shadow/playground.html
