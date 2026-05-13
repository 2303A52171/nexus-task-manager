// Project Detail + Tasks
let currentProject = null;
let currentMembers = [];

async function renderProjectDetail(projectId) {
  const view = document.getElementById('view-project-detail');
  view.innerHTML = loading();

  try {
    const [project, members] = await Promise.all([
      API.getProject(projectId),
      API.getMembers(projectId)
    ]);
    currentProject = project;
    currentMembers = members;

    document.getElementById('topbar-title').textContent = project.name.toUpperCase();
    document.getElementById('topbar-actions').innerHTML = `
      ${project.my_role === 'admin' ? `
        <button class="nx-btn ghost small" onclick="showEditProjectModal()">EDIT</button>
        <button class="nx-btn ghost small" onclick="showInviteModal()">+ INVITE</button>
      ` : ''}
      <button class="nx-btn primary small" onclick="showCreateTaskModal()">+ TASK</button>
    `;

    view.innerHTML = `
      <div class="project-detail-header">
        <div>
          <div class="project-detail-name" style="color:${project.color || '#00ff88'}">${escapeHtml(project.name)}</div>
          <div style="font-size:0.75rem;color:var(--text3);margin-top:4px">${escapeHtml(project.description) || ''}</div>
          <div style="font-size:0.65rem;color:var(--text3);margin-top:8px;letter-spacing:1px">
            OWNER: ${escapeHtml(project.owner_name)} &nbsp;·&nbsp; YOUR ROLE: <span style="color:${project.my_role === 'admin' ? 'var(--accent3)' : 'var(--text2)'}">${project.my_role.toUpperCase()}</span>
          </div>
        </div>
      </div>
      <div class="project-detail-tabs">
        <button class="detail-tab active" data-tab="kanban">KANBAN</button>
        <button class="detail-tab" data-tab="list">LIST</button>
        <button class="detail-tab" data-tab="members">MEMBERS (${members.length})</button>
        <button class="detail-tab" data-tab="activity">ACTIVITY</button>
      </div>
      <div id="project-tab-content"></div>
    `;

    // Tab switching
    view.querySelectorAll('.detail-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        view.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadProjectTab(tab.dataset.tab, projectId);
      });
    });

    loadProjectTab('kanban', projectId);

  } catch (err) {
    view.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

async function loadProjectTab(tab, projectId) {
  const container = document.getElementById('project-tab-content');
  container.innerHTML = loading();

  if (tab === 'kanban') await renderKanban(projectId, container);
  else if (tab === 'list') await renderTaskList(projectId, container);
  else if (tab === 'members') renderMembersTab(container);
  else if (tab === 'activity') await renderActivityTab(projectId, container);
}

async function renderKanban(projectId, container) {
  const tasks = await API.getTasks(projectId);
  const cols = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    review: tasks.filter(t => t.status === 'review'),
    done: tasks.filter(t => t.status === 'done')
  };

  container.innerHTML = `
    <div class="kanban-board">
      ${['todo','in_progress','review','done'].map(status => `
        <div class="kanban-col col-${status}">
          <div class="kanban-col-header">
            <span class="kanban-col-title">${statusLabel(status)}</span>
            <span class="kanban-count">${cols[status].length}</span>
          </div>
          <div class="kanban-cards" id="col-${status}">
            ${cols[status].map(t => kanbanCardHTML(t)).join('')}
            <button class="kanban-add-btn" onclick="showCreateTaskModal('${status}')">+ ADD TASK</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('click', () => openTaskDetail(projectId, card.dataset.taskId));
  });
}

function kanbanCardHTML(t) {
  return `
    <div class="kanban-card" data-task-id="${t.id}">
      <div class="kanban-card-title">${escapeHtml(t.title)}</div>
      <div class="kanban-card-footer">
        <span class="task-priority-bar pri-${t.priority}" style="display:inline-block;width:28px;height:3px;border-radius:2px;vertical-align:middle"></span>
        ${t.assignee_name
          ? `<div class="kanban-assignee" title="${escapeHtml(t.assignee_name)}" style="background:${t.assignee_color || '#555'}">${avatarInitials(t.assignee_name)}</div>`
          : '<span style="font-size:0.6rem;color:var(--text3)">UNASSIGNED</span>'}
      </div>
      ${t.due_date ? `<div style="margin-top:6px">${dueBadge(t.due_date)}</div>` : ''}
    </div>
  `;
}

async function renderTaskList(projectId, container) {
  const tasks = await API.getTasks(projectId);
  
  container.innerHTML = `
    <div class="filter-bar">
      <select class="nx-input" id="filter-status" style="width:auto">
        <option value="">ALL STATUS</option>
        <option value="todo">TODO</option>
        <option value="in_progress">IN PROGRESS</option>
        <option value="review">REVIEW</option>
        <option value="done">DONE</option>
      </select>
      <select class="nx-input" id="filter-priority" style="width:auto">
        <option value="">ALL PRIORITY</option>
        <option value="critical">CRITICAL</option>
        <option value="high">HIGH</option>
        <option value="medium">MEDIUM</option>
        <option value="low">LOW</option>
      </select>
    </div>
    <div id="task-list-items">
      ${tasks.length === 0
        ? empty('◫', 'NO TASKS', 'Create your first task')
        : tasks.map(t => taskListRowHTML(t)).join('')}
    </div>
  `;

  // Filters
  const applyFilters = async () => {
    const status = container.querySelector('#filter-status').value;
    const priority = container.querySelector('#filter-priority').value;
    const filtered = tasks.filter(t =>
      (!status || t.status === status) && (!priority || t.priority === priority)
    );
    container.querySelector('#task-list-items').innerHTML =
      filtered.length === 0
        ? empty('◫', 'NO TASKS', 'No tasks match filter')
        : filtered.map(t => taskListRowHTML(t)).join('');
    attachTaskRowHandlers(container, projectId);
  };
  container.querySelector('#filter-status').onchange = applyFilters;
  container.querySelector('#filter-priority').onchange = applyFilters;
  attachTaskRowHandlers(container, projectId);
}

function taskListRowHTML(t) {
  return `
    <div class="task-item" data-task-id="${t.id}">
      <div class="task-priority-bar pri-${t.priority}"></div>
      <div class="task-info">
        <div class="task-title">${escapeHtml(t.title)}</div>
        <div class="task-meta">
          <span class="status-badge status-${t.status}">${statusLabel(t.status)}</span>
          <span style="color:var(--text3)">${priorityLabel(t.priority)}</span>
          ${t.assignee_name ? `<span style="color:var(--text2)">${escapeHtml(t.assignee_name)}</span>` : '<span style="color:var(--text3)">UNASSIGNED</span>'}
          ${dueBadge(t.due_date)}
          ${t.comment_count > 0 ? `<span style="color:var(--text3)">💬 ${t.comment_count}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function attachTaskRowHandlers(container, projectId) {
  container.querySelectorAll('[data-task-id]').forEach(el => {
    el.addEventListener('click', () => openTaskDetail(projectId, el.dataset.taskId));
  });
}

function renderMembersTab(container) {
  const canManage = currentProject?.my_role === 'admin';
  container.innerHTML = `
    <div class="section-header" style="margin-bottom:16px">
      <div class="section-title">TEAM MEMBERS (${currentMembers.length})</div>
      ${canManage ? `<button class="nx-btn primary small" onclick="showInviteModal()">+ INVITE MEMBER</button>` : ''}
    </div>
    <div class="members-list">
      ${currentMembers.map(m => memberRowHTML(m, canManage)).join('')}
    </div>
  `;
}

function memberRowHTML(m, canManage) {
  const isOwner = currentProject?.owner_id === m.id;
  return `
    <div class="member-row">
      ${avatarEl(m.name, m.avatar_color, 36)}
      <div class="member-info">
        <div class="member-name">${escapeHtml(m.name)} ${isOwner ? '<span style="font-size:0.6rem;color:var(--accent3)">OWNER</span>' : ''}</div>
        <div class="member-email">${escapeHtml(m.email)}</div>
      </div>
      <span class="role-badge role-${m.role}">${m.role.toUpperCase()}</span>
      ${canManage && !isOwner ? `
        <div class="member-actions">
          <select class="nx-input small" onchange="changeMemberRole('${m.id}', this.value)" style="padding:4px 8px;font-size:0.65rem">
            <option value="member"${m.role==='member'?' selected':''}>MEMBER</option>
            <option value="admin"${m.role==='admin'?' selected':''}>ADMIN</option>
          </select>
          <button class="nx-btn danger small" onclick="removeMember('${m.id}')">REMOVE</button>
        </div>
      ` : ''}
    </div>
  `;
}

async function changeMemberRole(userId, role) {
  try {
    await API.updateMember(currentProject.id, userId, role);
    toast('Role updated');
    const m = currentMembers.find(m => m.id === userId);
    if (m) m.role = role;
  } catch (err) { toast(err.message, 'error'); }
}

async function removeMember(userId) {
  if (!confirm('Remove this member from the project?')) return;
  try {
    await API.removeMember(currentProject.id, userId);
    toast('Member removed');
    currentMembers = currentMembers.filter(m => m.id !== userId);
    renderMembersTab(document.getElementById('project-tab-content'));
  } catch (err) { toast(err.message, 'error'); }
}

async function renderActivityTab(projectId, container) {
  const logs = await API.getActivity(projectId);
  container.innerHTML = `
    <div class="nx-card">
      ${logs.length === 0
        ? empty('◌', 'NO ACTIVITY', 'Activity will appear here')
        : logs.map(a => activityItemHTML(a)).join('')}
    </div>
  `;
}

// ===== TASK MODALS =====
function showCreateTaskModal(defaultStatus = 'todo') {
  const { content, close } = showModal(`
    <div class="modal-header">
      <div class="modal-title">NEW TASK</div>
      <button class="modal-close">✕</button>
    </div>
    <div class="field-group">
      <label class="field-label">TITLE *</label>
      <input type="text" id="task-title" class="nx-input" placeholder="Task title" />
    </div>
    <div class="field-group">
      <label class="field-label">DESCRIPTION</label>
      <textarea id="task-desc" class="nx-input" placeholder="Details..."></textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field-group">
        <label class="field-label">STATUS</label>
        <select id="task-status" class="nx-input">
          <option value="todo"${defaultStatus==='todo'?' selected':''}>TODO</option>
          <option value="in_progress"${defaultStatus==='in_progress'?' selected':''}>IN PROGRESS</option>
          <option value="review"${defaultStatus==='review'?' selected':''}>REVIEW</option>
          <option value="done"${defaultStatus==='done'?' selected':''}>DONE</option>
        </select>
      </div>
      <div class="field-group">
        <label class="field-label">PRIORITY</label>
        <select id="task-priority" class="nx-input">
          <option value="low">LOW</option>
          <option value="medium" selected>MEDIUM</option>
          <option value="high">HIGH</option>
          <option value="critical">CRITICAL</option>
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field-group">
        <label class="field-label">ASSIGNEE</label>
        <select id="task-assignee" class="nx-input">
          <option value="">UNASSIGNED</option>
          ${currentMembers.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label class="field-label">DUE DATE</label>
        <input type="date" id="task-due" class="nx-input" />
      </div>
    </div>
    <div id="task-error" class="form-error hidden"></div>
    <div class="modal-actions">
      <button class="nx-btn ghost" id="task-cancel">CANCEL</button>
      <button class="nx-btn primary" id="task-submit">CREATE TASK</button>
    </div>
  `);

  content.querySelector('#task-cancel').onclick = close;
  content.querySelector('#task-title').focus();

  content.querySelector('#task-submit').onclick = async () => {
    const title = content.querySelector('#task-title').value.trim();
    const errEl = content.querySelector('#task-error');
    if (!title) { errEl.textContent = 'Title required'; errEl.classList.remove('hidden'); return; }

    try {
      await API.createTask(currentProject.id, {
        title,
        description: content.querySelector('#task-desc').value.trim(),
        status: content.querySelector('#task-status').value,
        priority: content.querySelector('#task-priority').value,
        assignee_id: content.querySelector('#task-assignee').value || null,
        due_date: content.querySelector('#task-due').value || null
      });
      toast('Task created!');
      close();
      // Refresh current tab
      const activeTab = document.querySelector('.detail-tab.active')?.dataset.tab || 'kanban';
      loadProjectTab(activeTab, currentProject.id);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  };
}

async function openTaskDetail(projectId, taskId) {
  const [task, comments] = await Promise.all([
    API.getTask(projectId, taskId),
    API.getComments(projectId, taskId)
  ]);

  const canEdit = currentProject?.my_role === 'admin' || task.creator_id === window.currentUser?.id || task.assignee_id === window.currentUser?.id;

  const { content, close } = showModal(`
    <div class="modal-header">
      <div class="modal-title" style="font-size:0.85rem">${escapeHtml(task.title)}</div>
      <button class="modal-close">✕</button>
    </div>
    <div class="task-detail-grid">
      <div>
        <div class="task-detail-section">
          <div class="task-detail-label">DESCRIPTION</div>
          <div style="font-size:0.8rem;color:var(--text2);line-height:1.6">${escapeHtml(task.description) || '<em style="color:var(--text3)">No description</em>'}</div>
        </div>
        <div class="comments-section">
          <div class="task-detail-label" style="margin-bottom:12px">COMMENTS (${comments.length})</div>
          <div id="comments-list">
            ${comments.map(c => commentHTML(c)).join('')}
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <textarea id="new-comment" class="nx-input" placeholder="Add a comment..." style="min-height:50px;flex:1"></textarea>
            <button class="nx-btn primary small" id="send-comment" style="align-self:flex-end">SEND</button>
          </div>
        </div>
      </div>
      <div class="task-detail-sidebar">
        <div>
          <div class="task-detail-label">STATUS</div>
          ${canEdit ? `
            <select class="nx-input" id="td-status" style="font-size:0.75rem">
              <option value="todo"${task.status==='todo'?' selected':''}>TODO</option>
              <option value="in_progress"${task.status==='in_progress'?' selected':''}>IN PROGRESS</option>
              <option value="review"${task.status==='review'?' selected':''}>REVIEW</option>
              <option value="done"${task.status==='done'?' selected':''}>DONE</option>
            </select>
          ` : `<span class="status-badge status-${task.status}">${statusLabel(task.status)}</span>`}
        </div>
        <div>
          <div class="task-detail-label">PRIORITY</div>
          <span class="task-priority-bar pri-${task.priority}" style="display:inline-block;width:40px;height:4px;border-radius:2px;vertical-align:middle;margin-right:6px"></span>
          <span style="font-size:0.75rem;color:var(--text2)">${priorityLabel(task.priority)}</span>
        </div>
        <div>
          <div class="task-detail-label">ASSIGNEE</div>
          ${task.assignee_name
            ? `<div style="display:flex;align-items:center;gap:6px">${avatarEl(task.assignee_name, task.assignee_color, 22)}<span style="font-size:0.75rem">${escapeHtml(task.assignee_name)}</span></div>`
            : `<span style="font-size:0.75rem;color:var(--text3)">UNASSIGNED</span>`}
        </div>
        <div>
          <div class="task-detail-label">DUE DATE</div>
          <span style="font-size:0.75rem;color:var(--text2)">${task.due_date ? formatDate(task.due_date) : 'None'}</span>
          ${dueBadge(task.due_date)}
        </div>
        <div>
          <div class="task-detail-label">CREATED BY</div>
          <span style="font-size:0.75rem;color:var(--text2)">${escapeHtml(task.creator_name)}</span>
        </div>
        ${canEdit && currentProject?.my_role === 'admin' ? `
          <button class="nx-btn danger small" id="delete-task-btn">DELETE TASK</button>
        ` : ''}
      </div>
    </div>
  `);

  // Status change
  content.querySelector('#td-status')?.addEventListener('change', async e => {
    try {
      await API.updateTask(projectId, taskId, { status: e.target.value });
      toast('Status updated');
    } catch (err) { toast(err.message, 'error'); }
  });

  // Comment
  content.querySelector('#send-comment').onclick = async () => {
    const txt = content.querySelector('#new-comment').value.trim();
    if (!txt) return;
    try {
      const c = await API.addComment(projectId, taskId, txt);
      content.querySelector('#new-comment').value = '';
      content.querySelector('#comments-list').insertAdjacentHTML('beforeend', commentHTML(c));
    } catch (err) { toast(err.message, 'error'); }
  };

  // Delete
  content.querySelector('#delete-task-btn')?.addEventListener('click', async () => {
    if (!confirm('Delete this task?')) return;
    try {
      await API.deleteTask(projectId, taskId);
      toast('Task deleted');
      close();
      const activeTab = document.querySelector('.detail-tab.active')?.dataset.tab || 'kanban';
      loadProjectTab(activeTab, currentProject.id);
    } catch (err) { toast(err.message, 'error'); }
  });
}

function commentHTML(c) {
  return `
    <div class="comment-item">
      ${avatarEl(c.user_name, c.avatar_color, 28)}
      <div class="comment-body">
        <div class="comment-header">
          <span class="comment-author">${escapeHtml(c.user_name)}</span>
          <span class="comment-time">${timeAgo(c.created_at)}</span>
        </div>
        <div class="comment-text">${escapeHtml(c.content)}</div>
      </div>
    </div>
  `;
}

// ===== INVITE MODAL =====
function showInviteModal() {
  const { content, close } = showModal(`
    <div class="modal-header">
      <div class="modal-title">INVITE MEMBER</div>
      <button class="modal-close">✕</button>
    </div>
    <div class="field-group">
      <label class="field-label">EMAIL ADDRESS</label>
      <input type="email" id="invite-email" class="nx-input" placeholder="user@domain.com" />
    </div>
    <div class="field-group">
      <label class="field-label">ROLE</label>
      <select id="invite-role" class="nx-input">
        <option value="member">MEMBER</option>
        <option value="admin">ADMIN</option>
      </select>
    </div>
    <div id="invite-error" class="form-error hidden"></div>
    <div class="modal-actions">
      <button class="nx-btn ghost" id="invite-cancel">CANCEL</button>
      <button class="nx-btn primary" id="invite-submit">INVITE</button>
    </div>
  `);

  content.querySelector('#invite-cancel').onclick = close;
  content.querySelector('#invite-email').focus();

  content.querySelector('#invite-submit').onclick = async () => {
    const email = content.querySelector('#invite-email').value.trim();
    const role = content.querySelector('#invite-role').value;
    const errEl = content.querySelector('#invite-error');
    
    if (!email) { errEl.textContent = 'Email required'; errEl.classList.remove('hidden'); return; }

    try {
      await API.addMember(currentProject.id, email, role);
      toast(`Member invited successfully!`);
      close();
      // Refresh members
      currentMembers = await API.getMembers(currentProject.id);
      // Re-render if on members tab
      const activeTab = document.querySelector('.detail-tab.active')?.dataset.tab;
      if (activeTab === 'members') renderMembersTab(document.getElementById('project-tab-content'));
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  };
}

// ===== EDIT PROJECT MODAL =====
function showEditProjectModal() {
  let selectedColor = currentProject.color || '#00ff88';

  const { content, close } = showModal(`
    <div class="modal-header">
      <div class="modal-title">EDIT PROJECT</div>
      <button class="modal-close">✕</button>
    </div>
    <div class="field-group">
      <label class="field-label">NAME</label>
      <input type="text" id="edit-proj-name" class="nx-input" value="${escapeHtml(currentProject.name)}" />
    </div>
    <div class="field-group">
      <label class="field-label">DESCRIPTION</label>
      <textarea id="edit-proj-desc" class="nx-input">${escapeHtml(currentProject.description || '')}</textarea>
    </div>
    <div class="field-group">
      <label class="field-label">COLOR</label>
      <div id="edit-color-picker"></div>
    </div>
    <div id="edit-proj-error" class="form-error hidden"></div>
    <div class="modal-actions">
      <button class="nx-btn danger" id="delete-proj-btn">DELETE PROJECT</button>
      <button class="nx-btn ghost" id="edit-cancel">CANCEL</button>
      <button class="nx-btn primary" id="edit-submit">SAVE</button>
    </div>
  `);

  const picker = colorPicker(selectedColor, c => { selectedColor = c; });
  content.querySelector('#edit-color-picker').appendChild(picker);
  content.querySelector('#edit-cancel').onclick = close;

  content.querySelector('#edit-submit').onclick = async () => {
    const name = content.querySelector('#edit-proj-name').value.trim();
    if (!name) return;
    try {
      await API.updateProject(currentProject.id, {
        name, description: content.querySelector('#edit-proj-desc').value.trim(), color: selectedColor
      });
      toast('Project updated');
      close();
      renderProjectDetail(currentProject.id);
      refreshSidebarProjects();
    } catch (err) {
      content.querySelector('#edit-proj-error').textContent = err.message;
      content.querySelector('#edit-proj-error').classList.remove('hidden');
    }
  };

  content.querySelector('#delete-proj-btn').onclick = async () => {
    if (!confirm('Delete this project and all its tasks? This cannot be undone.')) return;
    try {
      await API.deleteProject(currentProject.id);
      toast('Project deleted');
      close();
      refreshSidebarProjects();
      switchView('projects');
    } catch (err) { toast(err.message, 'error'); }
  };
}
