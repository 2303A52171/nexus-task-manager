const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB, saveDB } = require('../db/database');
const { authenticate, requireProjectRole } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

function logActivity(db, userId, projectId, taskId, action, details) {
  db.run('INSERT INTO activity_log (id, user_id, project_id, task_id, action, details) VALUES (?,?,?,?,?,?)',
    [uuidv4(), userId, projectId, taskId, action, details]);
}

// GET /api/projects/:projectId/tasks
router.get('/', authenticate, requireProjectRole(), (req, res) => {
  const db = getDB();
  const { status, priority, assignee } = req.query;
  
  let query = `
    SELECT t.*, 
      u.name as assignee_name, u.avatar_color as assignee_color,
      c.name as creator_name,
      (SELECT COUNT(*) FROM comments cm WHERE cm.task_id = t.id) as comment_count
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.creator_id
    WHERE t.project_id = ?
  `;
  const params = [req.params.projectId];
  
  if (status) { query += ' AND t.status = ?'; params.push(status); }
  if (priority) { query += ' AND t.priority = ?'; params.push(priority); }
  if (assignee) { query += ' AND t.assignee_id = ?'; params.push(assignee); }
  query += ' ORDER BY t.created_at DESC';

  const stmt = db.prepare(query);
  const tasks = [];
  stmt.bind(params);
  while (stmt.step()) tasks.push(stmt.getAsObject());
  res.json(tasks);
});

// POST /api/projects/:projectId/tasks
router.post('/', authenticate, requireProjectRole(), (req, res) => {
  const { title, description, status, priority, assignee_id, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'Task title required' });
  
  const validStatuses = ['todo', 'in_progress', 'review', 'done'];
  const validPriorities = ['low', 'medium', 'high', 'critical'];
  if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (priority && !validPriorities.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });

  const db = getDB();
  
  // Validate assignee is a project member
  if (assignee_id) {
    const member = db.prepare('SELECT id FROM project_members WHERE project_id=? AND user_id=?')
      .getAsObject([req.params.projectId, assignee_id]);
    if (!member.id) return res.status(400).json({ error: 'Assignee is not a project member' });
  }

  const id = uuidv4();
  db.run(`INSERT INTO tasks (id, title, description, status, priority, project_id, assignee_id, creator_id, due_date)
    VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, title.trim(), description || '', status || 'todo', priority || 'medium',
     req.params.projectId, assignee_id || null, req.user.id, due_date || null]);

  logActivity(db, req.user.id, req.params.projectId, id, 'task_created', `Created task "${title}"`);
  saveDB();

  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.avatar_color as assignee_color
    FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.id=?
  `).getAsObject([id]);
  res.status(201).json(task);
});

// GET /api/projects/:projectId/tasks/:taskId
router.get('/:taskId', authenticate, requireProjectRole(), (req, res) => {
  const db = getDB();
  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.avatar_color as assignee_color, c.name as creator_name
    FROM tasks t 
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.creator_id
    WHERE t.id=? AND t.project_id=?
  `).getAsObject([req.params.taskId, req.params.projectId]);
  if (!task.id) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// PUT /api/projects/:projectId/tasks/:taskId
router.put('/:taskId', authenticate, requireProjectRole(), (req, res) => {
  const { title, description, status, priority, assignee_id, due_date } = req.body;
  const db = getDB();
  
  const existing = db.prepare('SELECT * FROM tasks WHERE id=? AND project_id=?')
    .getAsObject([req.params.taskId, req.params.projectId]);
  if (!existing.id) return res.status(404).json({ error: 'Task not found' });

  // Members can only update tasks assigned to them or created by them
  if (req.projectRole === 'member' && existing.creator_id !== req.user.id && existing.assignee_id !== req.user.id) {
    // Members can still update status
    if (Object.keys(req.body).some(k => k !== 'status')) {
      return res.status(403).json({ error: 'Members can only update tasks assigned to them' });
    }
  }

  const newTitle = title || existing.title;
  const newStatus = status || existing.status;
  const changes = [];
  if (newTitle !== existing.title) changes.push(`title changed`);
  if (newStatus !== existing.status) changes.push(`status: ${existing.status} → ${newStatus}`);

  db.run(`UPDATE tasks SET title=?, description=?, status=?, priority=?, assignee_id=?, due_date=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?`,
    [newTitle, description ?? existing.description, newStatus, priority || existing.priority,
     assignee_id !== undefined ? (assignee_id || null) : existing.assignee_id, 
     due_date !== undefined ? (due_date || null) : existing.due_date,
     req.params.taskId]);

  if (changes.length) logActivity(db, req.user.id, req.params.projectId, req.params.taskId, 'task_updated', changes.join(', '));
  saveDB();
  res.json({ success: true });
});

// DELETE /api/projects/:projectId/tasks/:taskId
router.delete('/:taskId', authenticate, requireProjectRole(['admin']), (req, res) => {
  const db = getDB();
  db.run('DELETE FROM comments WHERE task_id=?', [req.params.taskId]);
  db.run('DELETE FROM tasks WHERE id=? AND project_id=?', [req.params.taskId, req.params.projectId]);
  saveDB();
  res.json({ success: true });
});

// GET /api/projects/:projectId/tasks/:taskId/comments
router.get('/:taskId/comments', authenticate, requireProjectRole(), (req, res) => {
  const db = getDB();
  const stmt = db.prepare(`
    SELECT cm.*, u.name as user_name, u.avatar_color 
    FROM comments cm JOIN users u ON u.id = cm.user_id
    WHERE cm.task_id=? ORDER BY cm.created_at ASC
  `);
  const comments = [];
  stmt.bind([req.params.taskId]);
  while (stmt.step()) comments.push(stmt.getAsObject());
  res.json(comments);
});

// POST /api/projects/:projectId/tasks/:taskId/comments
router.post('/:taskId/comments', authenticate, requireProjectRole(), (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
  
  const db = getDB();
  const id = uuidv4();
  db.run('INSERT INTO comments (id, task_id, user_id, content) VALUES (?,?,?,?)',
    [id, req.params.taskId, req.user.id, content.trim()]);
  logActivity(db, req.user.id, req.params.projectId, req.params.taskId, 'comment_added', 'Added a comment');
  saveDB();
  
  const comment = db.prepare(`
    SELECT cm.*, u.name as user_name, u.avatar_color FROM comments cm 
    JOIN users u ON u.id = cm.user_id WHERE cm.id=?
  `).getAsObject([id]);
  res.status(201).json(comment);
});

module.exports = router;
