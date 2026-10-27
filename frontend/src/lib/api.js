const rawBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';
const API_BASE = rawBase.replace(/\/+$/, '');

export const api = async (path, { method = 'GET', body } = {}) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  let res;
  try {
    res = await fetch(`${API_BASE}${cleanPath}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Please check your connection and try again.');
  }
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON response */ }
  if (!res.ok) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
};
