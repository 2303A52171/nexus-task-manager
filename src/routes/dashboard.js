const express = require('express');
const { getDB } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard — aggregated stats for logged-in user
router.get('/', authenticate, (req, res) => {
  const db = getDB();
  const userId = req.user.id;

  // Projects count
  const projectCount = db.prepare(`SELECT COUNT(*) as count FROM project_members WHERE user_id=?`).getAsObject([userId]);

  // Tasks assigned to me
  const myTasks = db.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color
    FROM tasks t JOIN projects p ON p.id = t.project_id
    JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
    WHERE t.assignee_id = ? AND t.status != 'done'
    ORDER BY t.due_date ASC, t.priority DESC LIMIT 10
  `);
  const assignedTasks = [];
  myTasks.bind([userId, userId]);
  while (myTasks.step()) assignedTasks.push(myTasks.getAsObject());

  // Overdue tasks (due date in past, not done)
  const today = new Date().toISOString().split('T')[0];
  const overdueStmt = db.prepare(`
    SELECT COUNT(*) as count FROM tasks t
    JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
    WHERE t.assignee_id = ? AND t.status != 'done' AND t.due_date < ?
  `);
  const overdue = overdueStmt.getAsObject([userId, userId, today]);

  // Task status breakdown
  const statusStmt = db.prepare(`
    SELECT t.status, COUNT(*) as count FROM tasks t
    JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
    WHERE t.assignee_id = ?
    GROUP BY t.status
  `);
  const statusBreakdown = {};
  statusStmt.bind([userId, userId]);
  while (statusStmt.step()) {
    const row = statusStmt.getAsObject();
    statusBreakdown[row.status] = row.count;
  }

  // Recent activity across all my projects
  const activityStmt = db.prepare(`
    SELECT al.*, u.name as user_name, u.avatar_color, p.name as project_name
    FROM activity_log al
    LEFT JOIN users u ON u.id = al.user_id
    LEFT JOIN projects p ON p.id = al.project_id
    WHERE al.project_id IN (SELECT project_id FROM project_members WHERE user_id=?)
    ORDER BY al.created_at DESC LIMIT 15
  `);
  const activity = [];
  activityStmt.bind([userId]);
  while (activityStmt.step()) activity.push(activityStmt.getAsObject());

  // Priority breakdown
  const priorityStmt = db.prepare(`
    SELECT t.priority, COUNT(*) as count FROM tasks t
    JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
    WHERE t.assignee_id = ? AND t.status != 'done'
    GROUP BY t.priority
  `);
  const priorityBreakdown = {};
  priorityStmt.bind([userId, userId]);
  while (priorityStmt.step()) {
    const row = priorityStmt.getAsObject();
    priorityBreakdown[row.priority] = row.count;
  }

  res.json({
    stats: {
      projects: projectCount.count,
      assigned_tasks: assignedTasks.length,
      overdue: overdue.count,
      status: statusBreakdown,
      priority: priorityBreakdown
    },
    assigned_tasks: assignedTasks,
    activity
  });
});

module.exports = router;
