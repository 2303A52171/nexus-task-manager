# ⬛ NEXUS — Team Task Manager

> A cyberpunk-themed, full-stack team task management platform with role-based access control.

![NEXUS Screenshot](https://via.placeholder.com/900x500/0a0a0f/00ff88?text=NEXUS+TASK+MANAGER)

## 🚀 Live Demo

**[https://nexus-task-manager-production-a235.up.railway.app](https://nexus-task-manager-production-a235.up.railway.app)**

---

## ✨ Features

### 🔐 Authentication
- Secure JWT-based login & signup
- Password hashing with bcryptjs (12 salt rounds)
- Rate limiting on auth endpoints (20 req/15 min)
- Token expires in 7 days

### 📁 Project Management
- Create unlimited projects with custom colors
- View all projects you're part of (as owner or member)
- Track progress bar per project
- Delete projects (owner only)

### 👥 Team & Role-Based Access
| Feature | Admin | Member |
|---------|-------|--------|
| Create/edit project | ✅ | ❌ |
| Delete project | ✅ (owner only) | ❌ |
| Invite members | ✅ | ❌ |
| Change member roles | ✅ | ❌ |
| Remove members | ✅ | ❌ |
| Create tasks | ✅ | ✅ |
| Edit any task | ✅ | Only assigned/created |
| Delete tasks | ✅ | ❌ |
| Update task status | ✅ | ✅ |
| Add comments | ✅ | ✅ |

### ✅ Task Management
- Create tasks with title, description, status, priority, assignee, and due date
- 4 statuses: **TODO → IN PROGRESS → REVIEW → DONE**
- 4 priorities: **LOW / MEDIUM / HIGH / CRITICAL**
- Kanban board view (drag-free, click to manage)
- List view with filters (status, priority)
- Task comments/discussion thread
- Overdue detection with visual indicators

### 📊 Dashboard
- Stats: total projects, tasks, in-progress count, overdue count
- Tasks assigned to you (across all projects)
- Real-time activity feed (across all your projects)

### 🔔 Activity Log
- Every action is logged: task creation, status changes, member invites, comments
- Per-project activity timeline

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Framework | Express.js 4 |
| Database | SQLite via sql.js (file-based, zero-config) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Security | helmet, cors, express-rate-limit |
| Frontend | Vanilla JS + CSS (no framework) |
| Fonts | Syne (display) + Space Mono |
| Deployment | Railway |

---

## 📐 Database Schema

```
users               projects            project_members
──────────          ──────────          ────────────────
id (PK)             id (PK)             id (PK)
name                name                project_id (FK)
email (unique)      description         user_id (FK)
password (hashed)   status              role (admin/member)
avatar_color        color               joined_at
created_at          owner_id (FK)
                    created_at

tasks               comments            activity_log
──────────          ──────────          ─────────────
id (PK)             id (PK)             id (PK)
title               task_id (FK)        user_id (FK)
description         user_id (FK)        project_id (FK)
status              content             task_id (FK)
priority            created_at          action
project_id (FK)                         details
assignee_id (FK)                        created_at
creator_id (FK)
due_date
created_at / updated_at
```

---

## 🌐 REST API Reference

### Auth
```
POST /api/auth/signup     { name, email, password }
POST /api/auth/login      { email, password }
GET  /api/auth/me         (requires token)
```

### Projects
```
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id    (admin)
DELETE /api/projects/:id    (owner)
GET    /api/projects/:id/activity
```

### Members
```
GET    /api/projects/:id/members
POST   /api/projects/:id/members   { email, role }   (admin)
PUT    /api/projects/:id/members/:userId  { role }   (admin)
DELETE /api/projects/:id/members/:userId             (admin)
```

### Tasks
```
GET    /api/projects/:id/tasks     [?status=&priority=&assignee=]
POST   /api/projects/:id/tasks
GET    /api/projects/:id/tasks/:taskId
PUT    /api/projects/:id/tasks/:taskId
DELETE /api/projects/:id/tasks/:taskId    (admin)
```

### Comments
```
GET    /api/projects/:id/tasks/:taskId/comments
POST   /api/projects/:id/tasks/:taskId/comments   { content }
```

### Dashboard
```
GET    /api/dashboard
```

---

## 🚢 Deployment on Railway

### Quick Deploy

1. **Fork/clone this repo**
2. **Go to [railway.app](https://railway.app)** → New Project → Deploy from GitHub
3. **Select your repo** → Railway auto-detects Node.js
4. **Add environment variable:**
   ```
   JWT_SECRET=your-super-long-random-secret-key-here
   ```
5. **Add a Volume** (for SQLite persistence):
   - Go to your service → **Volumes** tab
   - Mount path: `/app/data`
   - This ensures your database persists across deployments
6. **Deploy** → Live in ~2 minutes

### Environment Variables
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | ✅ Yes | (none) | Secret for JWT signing — change this! |
| `PORT` | No | 3000 | Auto-set by Railway |
| `NODE_ENV` | No | development | Set to `production` on Railway |

---

## 💻 Local Development

```bash
# Clone
git clone https://github.com/yourusername/nexus-task-manager
cd nexus-task-manager

# Install
npm install

# Configure
cp .env.example .env
# Edit .env and set JWT_SECRET

# Run
npm start
# → http://localhost:3000
```

---

## 🗂️ Project Structure

```
nexus/
├── server.js                # Express app entry point
├── package.json
├── railway.toml             # Railway deployment config
├── .env.example
├── src/
│   ├── db/
│   │   └── database.js      # SQLite init & schema
│   ├── middleware/
│   │   └── auth.js          # JWT auth + role middleware
│   └── routes/
│       ├── auth.js          # Auth endpoints
│       ├── projects.js      # Project + member CRUD
│       ├── tasks.js         # Task + comment CRUD
│       └── dashboard.js     # Dashboard aggregation
├── public/
│   ├── index.html           # SPA shell
│   ├── css/
│   │   └── main.css         # Full cyberpunk UI theme
│   └── js/
│       ├── api.js           # Fetch wrapper
│       ├── components.js    # Shared UI utilities
│       ├── dashboard.js     # Dashboard view
│       ├── projects.js      # Projects view
│       ├── tasks.js         # Task detail + kanban
│       └── app.js           # Router + auth controller
└── data/                    # SQLite DB (gitignored)
    └── nexus.db
```

---

## 🎨 Design Philosophy

NEXUS uses a **cyberpunk brutalist** aesthetic:
- Dark terminal-inspired palette (`#0a0a0f` background)
- Neon green (`#00ff88`) as primary accent
- `Space Mono` for code-like text, `Syne` for headers
- Animated grid background on auth screen
- Glowing borders and scan-line effects
- No frameworks — pure CSS custom properties + vanilla JS

---

## 📝 License

MIT
