// Shared UI components

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' error' : type === 'warn' ? ' warn' : ''}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function showModal(html, onClose) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.innerHTML = html;
  overlay.classList.remove('hidden');
  
  const close = () => {
    overlay.classList.add('hidden');
    if (onClose) onClose();
  };
  
  overlay.onclick = e => { if (e.target === overlay) close(); };
  content.querySelector('.modal-close')?.addEventListener('click', close);
  
  // ESC key
  const esc = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }};
  document.addEventListener('keydown', esc);
  
  return { close, content };
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function avatarInitials(name) {
  return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
}

function avatarEl(name, color, size = 28) {
  return `<div class="user-avatar" style="background:${color || '#555'};width:${size}px;height:${size}px;font-size:${size * 0.4}px">${avatarInitials(name)}</div>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

function dueBadge(dueDate) {
  if (!dueDate) return '';
  const today = new Date();
  today.setHours(0,0,0,0);
  const due = new Date(dueDate);
  const diff = (due - today) / 86400000;
  
  if (diff < 0) return `<span class="due-badge due-overdue">OVERDUE</span>`;
  if (diff <= 2) return `<span class="due-badge due-soon">DUE ${formatDate(dueDate)}</span>`;
  return `<span class="due-badge due-ok">${formatDate(dueDate)}</span>`;
}

function statusLabel(s) {
  return { todo: 'TODO', in_progress: 'IN PROGRESS', review: 'REVIEW', done: 'DONE' }[s] || s;
}

function priorityLabel(p) {
  return { low: 'LOW', medium: 'MED', high: 'HIGH', critical: '🔴 CRIT' }[p] || p;
}

const PROJECT_COLORS = ['#00ff88','#ff6b35','#7b2fff','#ff2d78','#00d4ff','#ffd700','#ff8c42','#00b4d8'];

function colorPicker(selectedColor, onSelect) {
  const div = document.createElement('div');
  div.className = 'color-picker';
  PROJECT_COLORS.forEach(c => {
    const sw = document.createElement('div');
    sw.className = `color-swatch${c === selectedColor ? ' selected' : ''}`;
    sw.style.background = c;
    sw.title = c;
    sw.onclick = () => {
      div.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      onSelect(c);
    };
    div.appendChild(sw);
  });
  return div;
}

function loading() {
  return '<div class="loading">LOADING</div>';
}

function empty(icon, title, sub) {
  return `<div class="empty-state"><div class="empty-state-icon">${icon}</div><h3>${title}</h3><p>${sub}</p></div>`;
}
