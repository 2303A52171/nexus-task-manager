// API Client
const API = {
  base: '/api',
  
  token() { return localStorage.getItem('nx_token'); },
  
  async request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const token = this.token();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);
    
    const res = await fetch(this.base + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  
  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  delete(path) { return this.request('DELETE', path); },

  // Auth
  login(email, password) { return this.post('/auth/login', { email, password }); },
  signup(name, email, password) { return this.post('/auth/signup', { name, email, password }); },
  me() { return this.get('/auth/me'); },

  // Dashboard
  dashboard() { return this.get('/dashboard'); },

  // Projects
  projects() { return this.get('/projects'); },
  createProject(data) { return this.post('/projects', data); },
  getProject(id) { return this.get(`/projects/${id}`); },
  updateProject(id, data) { return this.put(`/projects/${id}`, data); },
  deleteProject(id) { return this.delete(`/projects/${id}`); },
  
  // Members
  getMembers(projectId) { return this.get(`/projects/${projectId}/members`); },
  addMember(projectId, email, role) { return this.post(`/projects/${projectId}/members`, { email, role }); },
  updateMember(projectId, userId, role) { return this.put(`/projects/${projectId}/members/${userId}`, { role }); },
  removeMember(projectId, userId) { return this.delete(`/projects/${projectId}/members/${userId}`); },
  getActivity(projectId) { return this.get(`/projects/${projectId}/activity`); },

  // Tasks
  getTasks(projectId, filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.get(`/projects/${projectId}/tasks${params ? '?' + params : ''}`);
  },
  createTask(projectId, data) { return this.post(`/projects/${projectId}/tasks`, data); },
  getTask(projectId, taskId) { return this.get(`/projects/${projectId}/tasks/${taskId}`); },
  updateTask(projectId, taskId, data) { return this.put(`/projects/${projectId}/tasks/${taskId}`, data); },
  deleteTask(projectId, taskId) { return this.delete(`/projects/${projectId}/tasks/${taskId}`); },

  // Comments
  getComments(projectId, taskId) { return this.get(`/projects/${projectId}/tasks/${taskId}/comments`); },
  addComment(projectId, taskId, content) { return this.post(`/projects/${projectId}/tasks/${taskId}/comments`, { content }); }
};
