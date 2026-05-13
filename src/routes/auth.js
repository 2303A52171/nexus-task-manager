const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDB, saveDB } = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const COLORS = ['#00ff88', '#ff6b35', '#7b2fff', '#ff2d78', '#00d4ff', '#ffd700', '#ff8c42'];

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  
  if (!name || !email || !password) 
    return res.status(400).json({ error: 'All fields required' });
  if (password.length < 6) 
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email format' });

  try {
    const db = getDB();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').getAsObject([email]);
    if (existing.id) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const id = uuidv4();
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    db.run('INSERT INTO users (id, name, email, password, avatar_color) VALUES (?, ?, ?, ?, ?)',
      [id, name.trim(), email.toLowerCase(), hashed, color]);
    saveDB();

    const token = jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ 
      token, 
      user: { id, name: name.trim(), email: email.toLowerCase(), avatar_color: color } 
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'All fields required' });

  try {
    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').getAsObject([email.toLowerCase()]);
    if (!user.id) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { id: user.id, name: user.name, email: user.email, avatar_color: user.avatar_color } 
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth').authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
