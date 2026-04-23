const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('fr_token');
}

function setSession(token, name) {
  localStorage.setItem('fr_token', token);
  localStorage.setItem('fr_name', name);
}

function clearSession() {
  localStorage.removeItem('fr_token');
  localStorage.removeItem('fr_name');
}

function getUserName() {
  return localStorage.getItem('fr_name') || 'there';
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

function logout() {
  clearSession();
  window.location.href = '/index.html';
}
