// Projects View
async function renderProjectsView() {
  const view = document.getElementById('view-projects');
  view.innerHTML = loading();

  try {
    const projects = await API.projects();
    
    view.innerHTML = `
      <div class="section-header" style="margin-bottom:20px">
        <div class="section-title">ALL PROJECTS (${projects.length})</div>
        <button class="nx-btn primary small" onclick="showNewProjectModal()">+ NEW PROJECT</button>
      </div>
      ${projects.length === 0
        ? empty('◫', 'NO PROJECTS YET', 'Create your first project to get started')
        : `<div class="projects-grid">${projects.map(p => projectCardHTML(p)).join('')}</div>`}
    `;

    view.querySelectorAll('[data-project-id]').forEach(el => {
      el.addEventListener('click', () => loadProjectDetail(el.dataset.projectId));
    });

  } catch (err) {
    view.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

function projectCardHTML(p) {
  const progress = p.task_count > 0 ? Math.round((p.done_count / p.task_count) * 100) : 0;
  return `
    <div class="project-card" data-project-id="${p.id}" style="--pc:${p.color || '#00ff88'}">
      <style>.project-card[data-project-id="${p.id}"]::before { background: ${p.color || '#00ff88'}; }</style>
      <span class="role-badge role-${p.my_role}">${p.my_role.toUpperCase()}</span>
      <div class="project-card-name">${escapeHtml(p.name)}</div>
      <div class="project-card-desc">${escapeHtml(p.description) || 'No description'}</div>
      <div class="project-card-stats">
        <div class="project-stat"><span>${p.task_count || 0}</span> TASKS</div>
        <div class="project-stat"><span>${p.done_count || 0}</span> DONE</div>
        <div class="project-stat"><span>${p.member_count || 0}</span> MEMBERS</div>
      </div>
      <div class="project-progress">
        <div class="project-progress-fill" style="width:${progress}%;background:${p.color || '#00ff88'}"></div>
      </div>
    </div>
  `;
}

function showNewProjectModal(callback) {
  let selectedColor = PROJECT_COLORS[0];

  const { content, close } = showModal(`
    <div class="modal-header">
      <div class="modal-title">NEW PROJECT</div>
      <button class="modal-close">✕</button>
    </div>
    <div class="field-group">
      <label class="field-label">PROJECT NAME *</label>
      <input type="text" id="proj-name" class="nx-input" placeholder="My awesome project" />
    </div>
    <div class="field-group">
      <label class="field-label">DESCRIPTION</label>
      <textarea id="proj-desc" class="nx-input" placeholder="What is this project about?"></textarea>
    </div>
    <div class="field-group">
      <label class="field-label">COLOR</label>
      <div id="proj-color-picker"></div>
    </div>
    <div id="proj-error" class="form-error hidden"></div>
    <div class="modal-actions">
      <button class="nx-btn ghost" id="proj-cancel">CANCEL</button>
      <button class="nx-btn primary" id="proj-submit">CREATE PROJECT</button>
    </div>
  `);

  const picker = colorPicker(selectedColor, c => { selectedColor = c; });
  content.querySelector('#proj-color-picker').appendChild(picker);
  content.querySelector('#proj-cancel').onclick = close;
  content.querySelector('#proj-name').focus();

  content.querySelector('#proj-submit').onclick = async () => {
    const name = content.querySelector('#proj-name').value.trim();
    const desc = content.querySelector('#proj-desc').value.trim();
    const errEl = content.querySelector('#proj-error');
    
    if (!name) { errEl.textContent = 'Project name is required'; errEl.classList.remove('hidden'); return; }
    
    try {
      const p = await API.createProject({ name, description: desc, color: selectedColor });
      toast('Project created!');
      close();
      refreshSidebarProjects();
      if (callback) callback(p);
      else loadProjectDetail(p.id);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  };
}

async function loadProjectDetail(projectId) {
  // Show project detail view
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-project-detail').classList.remove('hidden');
  
  // Update nav
  document.querySelectorAll('.nav-item, .sidebar-project-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-project-id="${projectId}"]`)?.classList.add('active');

  await renderProjectDetail(projectId);
}
