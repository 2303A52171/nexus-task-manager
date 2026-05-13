// Main App Controller
window.currentUser = null;

async function init() {
  const token = localStorage.getItem('nx_token');
  if (token) {
    try {
      const { user } = await API.me();
      window.currentUser = user;
      showApp();
    } catch {
      localStorage.removeItem('nx_token');
      showAuth();
    }
  } else {
    showAuth();
  }
}

function showAuth() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  
  const u = window.currentUser;
  document.getElementById('sidebar-username').textContent = u.name;
  const av = document.getElementById('sidebar-avatar');
  av.textContent = avatarInitials(u.name);
  av.style.background = u.avatar_color || '#00ff88';

  refreshSidebarProjects();
  switchView('dashboard');
}

async function refreshSidebarProjects() {
  try {
    const projects = await API.projects();
    const container = document.getElementById('sidebar-projects');
    container.innerHTML = projects.map(p => `
      <div class="sidebar-project-item" data-project-id="${p.id}" onclick="loadProjectDetail('${p.id}')">
        <div class="project-dot" style="background:${p.color || '#00ff88'}"></div>
        <span style="overflow:hidden;text-overflow:ellipsis">${escapeHtml(p.name)}</span>
      </div>
    `).join('');
  } catch {}
}

function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.nav-item, .sidebar-project-item').forEach(n => n.classList.remove('active'));
  
  if (view === 'dashboard') {
    document.getElementById('view-dashboard').classList.remove('hidden');
    document.querySelector('[data-view="dashboard"]')?.classList.add('active');
    document.getElementById('topbar-title').textContent = 'DASHBOARD';
    document.getElementById('topbar-actions').innerHTML = '';
    renderDashboard();
  } else if (view === 'projects') {
    document.getElementById('view-projects').classList.remove('hidden');
    document.querySelector('[data-view="projects"]')?.classList.add('active');
    document.getElementById('topbar-title').textContent = 'PROJECTS';
    document.getElementById('topbar-actions').innerHTML = `
      <button class="nx-btn primary small" onclick="showNewProjectModal()">+ NEW PROJECT</button>
    `;
    renderProjectsView();
  }
}

// Auth form handling
document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('login-form').classList.toggle('hidden', btn.dataset.tab !== 'login');
      document.getElementById('signup-form').classList.toggle('hidden', btn.dataset.tab !== 'signup');
    });
  });

  // Login
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    try {
      const { token, user } = await API.login(email, password);
      localStorage.setItem('nx_token', token);
      window.currentUser = user;
      showApp();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });

  // Signup
  document.getElementById('signup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const errEl = document.getElementById('signup-error');
    try {
      const { token, user } = await API.signup(name, email, password);
      localStorage.setItem('nx_token', token);
      window.currentUser = user;
      showApp();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });

  // Nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      switchView(item.dataset.view);
    });
  });

  // New project button in sidebar
  document.getElementById('new-project-btn').onclick = showNewProjectModal;

  // Logout
  document.getElementById('logout-btn').onclick = () => {
    localStorage.removeItem('nx_token');
    window.currentUser = null;
    showAuth();
  };

  init();
});
