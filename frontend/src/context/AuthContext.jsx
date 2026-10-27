import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { email, password } });
    if (d.user) setUser(d.user);
    return d;
  }, []);

  const completeMfaLogin = useCallback(async (code) => {
    const d = await api('/auth/login/mfa', { method: 'POST', body: { code } });
    setUser(d.user);
    return d.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    return api('/auth/register', { method: 'POST', body: { name, email, password } });
  }, []);

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* cookie cleared best-effort */ }
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, completeMfaLogin, register, logout }}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
