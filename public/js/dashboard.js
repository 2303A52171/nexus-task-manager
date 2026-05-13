// Dashboard View
async function renderDashboard() {
  const view = document.getElementById('view-dashboard');
  view.innerHTML = loading();

  try {
    const data = await API.dashboard();
    const { stats, assigned_tasks, activity } = data;

    const total = (stats.status.todo || 0) + (stats.status.in_progress || 0) + (stats.status.review || 0) + (stats.status.done || 0);

    view.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card green">
          <div class="stat-value">${stats.projects}</div>
          <div class="stat-label">PROJECTS</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-value">${total}</div>
          <div class="stat-label">TOTAL TASKS</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-value">${stats.status.in_progress || 0}</div>
          <div class="stat-label">IN PROGRESS</div>
        </div>
        <div class="stat-card red">
          <div class="stat-value">${stats.overdue}</div>
          <div class="stat-label">OVERDUE</div>
        </div>
      </div>

      <div class="dash-grid">
        <div>
          <div class="section-header">
            <div class="section-title">ASSIGNED TO ME</div>
          </div>
          <div id="my-tasks-list">
            ${assigned_tasks.length === 0
              ? empty('◫', 'NO TASKS', 'You have no assigned tasks')
              : assigned_tasks.map(t => taskItemHTML(t)).join('')}
          </div>
        </div>

        <div>
          <div class="section-header">
            <div class="section-title">RECENT ACTIVITY</div>
          </div>
          <div class="nx-card" style="padding:16px">
            ${activity.length === 0
              ? '<div class="empty-state" style="padding:20px"><p>No activity yet</p></div>'
              : activity.map(a => activityItemHTML(a)).join('')}
          </div>
        </div>
      </div>
    `;

    // Attach task click handlers
    view.querySelectorAll('[data-task-id]').forEach(el => {
      el.addEventListener('click', () => {
        openTaskDetail(el.dataset.projectId, el.dataset.taskId);
      });
    });

  } catch (err) {
    view.innerHTML = `<div class="empty-state"><p>Failed to load dashboard: ${err.message}</p></div>`;
  }
}

function taskItemHTML(task) {
  return `
    <div class="task-item" data-task-id="${task.id}" data-project-id="${task.project_id}">
      <div class="task-priority-bar pri-${task.priority}"></div>
      <div class="task-info">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          <span class="status-badge status-${task.status}">${statusLabel(task.status)}</span>
          ${task.project_name ? `<span style="color:var(--text3)">${escapeHtml(task.project_name)}</span>` : ''}
          ${dueBadge(task.due_date)}
        </div>
      </div>
    </div>
  `;
}

function activityItemHTML(a) {
  const icons = {
    task_created: '◈', task_updated: '◉', project_created: '◫',
    member_added: '◎', comment_added: '◌'
  };
  return `
    <div class="activity-item">
      ${avatarEl(a.user_name || '?', a.avatar_color, 24)}
      <div>
        <div class="activity-text">
          <strong>${escapeHtml(a.user_name || 'Someone')}</strong>
          ${escapeHtml(a.details || a.action)}
          ${a.project_name ? `<span style="color:var(--text3)"> · ${escapeHtml(a.project_name)}</span>` : ''}
        </div>
        <div class="activity-time">${timeAgo(a.created_at)}</div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
