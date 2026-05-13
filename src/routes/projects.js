const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB, saveDB } = require('../db/database');
const { authenticate, requireProjectRole } = require('../middleware/auth');

const router = express.Router();

function logActivity(db, userId, projectId, taskId, action, details) {
  db.run('INSERT INTO activity_log (id, user_id, project_id, task_id, action, details) VALUES (?,?,?,?,?,?)',
    [uuidv4(), userId, projectId, taskId, action, details]);
}

// GET /api/projects — all projects user is member of
router.get('/', authenticate, (req, res) => {
  const db = getDB();
  const stmt = db.prepare(`
    SELECT p.*, u.name as owner_name,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_count,
      (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id) as member_count,
      pm.role as my_role
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
    JOIN users u ON u.id = p.owner_id
    ORDER BY p.created_at DESC
  `);
  const projects = [];
  stmt.bind([req.user.id]);
  while (stmt.step()) projects.push(stmt.getAsObject());
  res.json(projects);
});

// POST /api/projects
router.post('/', authenticate, (req, res) => {
  const { name, description, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name required' });

  const db = getDB();
  const id = uuidv4();
  const projectColor = color || '#00ff88';

  db.run('INSERT INTO projects (id, name, description, color, owner_id) VALUES (?,?,?,?,?)',
    [id, name.trim(), description || '', projectColor, req.user.id]);
  
  // Add owner as admin member
  db.run('INSERT INTO project_members (id, project_id, user_id, role) VALUES (?,?,?,?)',
    [uuidv4(), id, req.user.id, 'admin']);
  
  logActivity(db, req.user.id, id, null, 'project_created', `Created project "${name}"`);
  saveDB();

  res.status(201).json({ id, name: name.trim(), description, color: projectColor, owner_id: req.user.id, my_role: 'admin' });
});

// GET /api/projects/:projectId
router.get('/:projectId', authenticate, requireProjectRole(), (req, res) => {
  const db = getDB();
  const p = db.prepare(`
    SELECT p.*, u.name as owner_name, pm.role as my_role
    FROM projects p JOIN users u ON u.id = p.owner_id
    JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
    WHERE p.id = ?
  `).getAsObject([req.user.id, req.params.projectId]);
  if (!p.id) return res.status(404).json({ error: 'Project not found' });
  res.json(p);
});

// PUT /api/projects/:projectId
router.put('/:projectId', authenticate, requireProjectRole(['admin']), (req, res) => {
  const { name, description, color, status } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const db = getDB();
  db.run('UPDATE projects SET name=?, description=?, color=?, status=? WHERE id=?',
    [name, description || '', color || '#00ff88', status || 'active', req.params.projectId]);
  saveDB();
  res.json({ success: true });
});

// DELETE /api/projects/:projectId
router.delete('/:projectId', authenticate, requireProjectRole(['admin']), (req, res) => {
  const db = getDB();
  const p = db.prepare('SELECT owner_id FROM projects WHERE id=?').getAsObject([req.params.projectId]);
  if (p.owner_id !== req.user.id) return res.status(403).json({ error: 'Only owner can delete' });
  db.run('DELETE FROM tasks WHERE project_id=?', [req.params.projectId]);
  db.run('DELETE FROM project_members WHERE project_id=?', [req.params.projectId]);
  db.run('DELETE FROM projects WHERE id=?', [req.params.projectId]);
  saveDB();
  res.json({ success: true });
});

// GET /api/projects/:projectId/members
router.get('/:projectId/members', authenticate, requireProjectRole(), (req, res) => {
  const db = getDB();
  const stmt = db.prepare(`
    SELECT u.id, u.name, u.email, u.avatar_color, pm.role, pm.joined_at
    FROM project_members pm JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ? ORDER BY pm.role DESC, pm.joined_at ASC
  `);
  const members = [];
  stmt.bind([req.params.projectId]);
  while (stmt.step()) members.push(stmt.getAsObject());
  res.json(members);
});

// POST /api/projects/:projectId/members — invite by email
router.post('/:projectId/members', authenticate, requireProjectRole(['admin']), (req, res) => {
  const { email, role } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  
  const db = getDB();
  const user = db.prepare('SELECT id, name FROM users WHERE email=?').getAsObject([email.toLowerCase()]);
  if (!user.id) return res.status(404).json({ error: 'User not found. They must sign up first.' });

  const existing = db.prepare('SELECT id FROM project_members WHERE project_id=? AND user_id=?')
    .getAsObject([req.params.projectId, user.id]);
  if (existing.id) return res.status(409).json({ error: 'User already a member' });

  const memberRole = role === 'admin' ? 'admin' : 'member';
  db.run('INSERT INTO project_members (id, project_id, user_id, role) VALUES (?,?,?,?)',
    [uuidv4(), req.params.projectId, user.id, memberRole]);
  logActivity(db, req.user.id, req.params.projectId, null, 'member_added', `Added ${user.name} as ${memberRole}`);
  saveDB();
  res.status(201).json({ success: true, user: { id: user.id, name: user.name } });
});

// PUT /api/projects/:projectId/members/:userId — change role
router.put('/:projectId/members/:userId', authenticate, requireProjectRole(['admin']), (req, res) => {
  const { role } = req.body;
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const db = getDB();
  
  // Prevent removing self if owner
  const p = db.prepare('SELECT owner_id FROM projects WHERE id=?').getAsObject([req.params.projectId]);
  if (req.params.userId === p.owner_id) return res.status(403).json({ error: 'Cannot change owner role' });

  db.run('UPDATE project_members SET role=? WHERE project_id=? AND user_id=?',
    [role, req.params.projectId, req.params.userId]);
  saveDB();
  res.json({ success: true });
});

// DELETE /api/projects/:projectId/members/:userId
router.delete('/:projectId/members/:userId', authenticate, requireProjectRole(['admin']), (req, res) => {
  const db = getDB();
  const p = db.prepare('SELECT owner_id FROM projects WHERE id=?').getAsObject([req.params.projectId]);
  if (req.params.userId === p.owner_id) return res.status(403).json({ error: 'Cannot remove owner' });
  db.run('DELETE FROM project_members WHERE project_id=? AND user_id=?', [req.params.projectId, req.params.userId]);
  saveDB();
  res.json({ success: true });
});

// GET /api/projects/:projectId/activity
router.get('/:projectId/activity', authenticate, requireProjectRole(), (req, res) => {
  const db = getDB();
  const stmt = db.prepare(`
    SELECT al.*, u.name as user_name, u.avatar_color
    FROM activity_log al LEFT JOIN users u ON u.id = al.user_id
    WHERE al.project_id = ? ORDER BY al.created_at DESC LIMIT 50
  `);
  const logs = [];
  stmt.bind([req.params.projectId]);
  while (stmt.step()) logs.push(stmt.getAsObject());
  res.json(logs);
});

module.exports = router;
