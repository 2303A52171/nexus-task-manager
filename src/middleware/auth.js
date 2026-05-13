const jwt = require('jsonwebtoken');
const { getDB } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-secret-key-change-in-production';

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDB();
    const stmt = db.prepare('SELECT id, name, email, avatar_color FROM users WHERE id = ?');
    const result = stmt.getAsObject([decoded.id]);
    if (!result.id) return res.status(401).json({ error: 'User not found' });
    req.user = result;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireProjectRole(roles) {
  return (req, res, next) => {
    const db = getDB();
    const projectId = req.params.projectId || req.body.project_id;
    
    const stmt = db.prepare(`
      SELECT pm.role FROM project_members pm 
      WHERE pm.project_id = ? AND pm.user_id = ?
    `);
    const member = stmt.getAsObject([projectId, req.user.id]);
    
    if (!member.role) {
      // Check if user is project owner
      const ownerStmt = db.prepare('SELECT owner_id FROM projects WHERE id = ?');
      const project = ownerStmt.getAsObject([projectId]);
      if (project.owner_id === req.user.id) {
        req.projectRole = 'admin';
        return next();
      }
      return res.status(403).json({ error: 'Not a project member' });
    }
    
    if (roles && !roles.includes(member.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    req.projectRole = member.role;
    next();
  };
}

module.exports = { authenticate, requireProjectRole, JWT_SECRET };
