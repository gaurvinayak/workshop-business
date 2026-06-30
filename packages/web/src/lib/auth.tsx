import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { PermissionCode } from '@workshopos/shared';
import { api } from './api';

interface Me {
  id: string;
  email: string;
  permissions: PermissionCode[];
}

interface AuthState {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (perm: PermissionCode) => boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Me>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    await api.post('/auth/login', { email, password });
    setUser(await api.get<Me>('/auth/me'));
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  const can = (perm: PermissionCode) => !!user?.permissions.includes(perm);

  return <AuthContext.Provider value={{ user, loading, login, logout, can }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
