/**
 * onboarding.js - First-time user onboarding experience for Shadow ToDo
 * Shows a multi-step wizard introducing features and clears dummy data
 */

const ShadowOnboarding = (() => {
  let currentStep = 0;
  const totalSteps = 2;

  function start() {
    currentStep = 0;
    clearDummyData().then(() => {
      renderOnboarding();
    });
  }

    async function clearDummyData() {
    try {
      // Delete the entire IndexedDB to get a completely fresh start
      if (typeof ShadowDB !== 'undefined' && ShadowDB._db) {
        ShadowDB._db.close();
      }
      await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase('ShadowToDoDB');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve(); // resolve even if blocked
      });
      console.log('Database deleted for fresh start');
    } catch(e) {
      console.error('Error clearing data:', e);
    }
    }

  function renderOnboarding() {
    const existing = document.getElementById('shadow-onboarding');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'shadow-onboarding';

    const user = typeof ShadowAuth !== 'undefined' ? ShadowAuth.getCurrentUser() : null;
    const userName = user ? user.name.split(' ')[0] : 'there';

    overlay.innerHTML = '<div class="onboarding-container">' +
      '<div class="onboarding-header">' +
        '<h2>Welcome, ' + userName + '! \ud83c\udf89</h2>' +
        '<p>Let us show you around Shadow ToDo</p>' +
      '</div>' +
      '<div class="onboarding-body">' +
        '<div class="onboarding-progress" id="ob-progress"></div>' +
        '<div id="ob-steps"></div>' +
      '</div>' +
      '<div class="onboarding-actions">' +
        '<button class="onboarding-btn secondary" id="ob-back">Back</button>' +
        '<button class="onboarding-btn primary" id="ob-next">Next</button>' +
      '</div>' +
    '</div>';

    document.body.appendChild(overlay);
    renderProgress();
    renderStep();
    bindActions();
  }

  function renderProgress() {
    const container = document.getElementById('ob-progress');
    if (!container) return;
    let html = '';
    for (let i = 0; i < totalSteps; i++) {
      let cls = 'progress-dot';
      if (i === currentStep) cls += ' active';
      else if (i < currentStep) cls += ' completed';
      html += '<div class="' + cls + '"></div>';
    }
    container.innerHTML = html;
  }

  function renderStep() {
    const container = document.getElementById('ob-steps');
    if (!container) return;

    const steps = [
      // Step 1: Welcome & Features
      '<div class="onboarding-step active">' +
        '<h3>What you can do with Shadow ToDo</h3>' +
        '<ul class="feature-list">' +
          '<li>' +
            '<div class="feature-icon" style="background:#e74c3c20;color:#e74c3c"><i class="fas fa-tasks"></i></div>' +
            '<div class="feature-text"><strong>Personal & Group Tasks</strong><span>Create tasks for yourself or collaborate with your team in groups</span></div>' +
          '</li>' +
          '<li>' +
            '<div class="feature-icon" style="background:#3498db20;color:#3498db"><i class="fas fa-columns"></i></div>' +
            '<div class="feature-text"><strong>Board & List Views</strong><span>Switch between kanban board and list view to manage tasks your way</span></div>' +
          '</li>' +
          '<li>' +
            '<div class="feature-icon" style="background:#2ecc7120;color:#2ecc71"><i class="fas fa-repeat"></i></div>' +
            '<div class="feature-text"><strong>Recurring Tasks</strong><span>Set daily, weekly, monthly, or yearly recurring tasks</span></div>' +
          '</li>' +
          '<li>' +
            '<div class="feature-icon" style="background:#9b59b620;color:#9b59b6"><i class="fas fa-sitemap"></i></div>' +
            '<div class="feature-text"><strong>Subtasks & Custom Fields</strong><span>Break tasks into subtasks and add custom fields for detailed tracking</span></div>' +
          '</li>' +
        '</ul>' +
      '</div>',


      // Step 3: Get Started
      '<div class="onboarding-step active">' +
        '<h3>You are all set!</h3>' +
        '<div style="text-align:center;padding:20px 0">' +
          '<div style="font-size:60px;margin-bottom:16px">\ud83d\ude80</div>' +
          '<p style="font-size:16px;color:#2c3e50;margin:0 0 8px">Your workspace is ready</p>' +
          '<p style="font-size:14px;color:#7f8c8d;margin:0 0 20px">We have cleared all demo data so you can start fresh.</p>' +
          '<div style="background:#f8f9fa;border-radius:12px;padding:16px;text-align:left">' +
            '<p style="font-weight:600;margin:0 0 10px;color:#2c3e50">Quick tips to get started:</p>' +
            '<p style="margin:0 0 6px;font-size:13px;color:#555"><i class="fas fa-plus-circle" style="color:#e74c3c;margin-right:6px"></i> Click <strong>+ New Task</strong> to create your first task</p>' +
            '<p style="margin:0 0 6px;font-size:13px;color:#555"><i class="fas fa-users" style="color:#3498db;margin-right:6px"></i> Create a <strong>Group</strong> to collaborate with others</p>' +
            '<p style="margin:0 0 6px;font-size:13px;color:#555"><i class="fas fa-cog" style="color:#95a5a6;margin-right:6px"></i> Visit <strong>Settings</strong> to customize your workspace</p>' +
            '<p style="margin:0;font-size:13px;color:#555"><i class="fas fa-keyboard" style="color:#2ecc71;margin-right:6px"></i> Press <strong>/</strong> to quickly search tasks</p>' +
          '</div>' +
        '</div>' +
      '</div>'
    ];

    container.innerHTML = steps[currentStep] || '';
    renderProgress();

    // Update buttons
    const backBtn = document.getElementById('ob-back');
    const nextBtn = document.getElementById('ob-next');
    if (backBtn) backBtn.style.visibility = currentStep === 0 ? 'hidden' : 'visible';
    if (nextBtn) nextBtn.textContent = currentStep === totalSteps - 1 ? 'Get Started' : 'Next';
  }


  function bindActions() {
    const backBtn = document.getElementById('ob-back');
    const nextBtn = document.getElementById('ob-next');

    if (backBtn) {
      backBtn.onclick = () => {
        if (currentStep > 0) {
          currentStep--;
          renderStep();
        }
      };
    }

    if (nextBtn) {
      nextBtn.onclick = () => {
        if (currentStep < totalSteps - 1) {
          currentStep++;
          renderStep();
        } else {
          finishOnboarding();
        }
      };
    }
  }

  function finishOnboarding() {
    localStorage.setItem('shadow_onboarded', 'true');
    const overlay = document.getElementById('shadow-onboarding');
    if (overlay) {
      overlay.style.animation = 'loginFadeOut 0.3s ease forwards';
      setTimeout(() => {
        overlay.remove();
        // Apply role restrictions and update UI
        if (typeof ShadowAuth !== 'undefined') {
          ShadowAuth.updateUserUI();
        }
        // Reload to show clean state
        location.reload();
      }, 300);
    }
  }

  return { start, clearDummyData, finishOnboarding };
})();
