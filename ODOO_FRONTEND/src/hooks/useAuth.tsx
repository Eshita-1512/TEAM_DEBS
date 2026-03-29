import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthMe } from '@/types/api';
import { auth, setAccessToken, getAccessToken } from '@/api/client';
import { isMockToken, getMockUser } from '@/api/mock';

interface AuthContextType {
  user: AuthMe | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isManager: boolean;
  isEmployee: boolean;
  hasPermission: (perm: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthMe | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    const token = getAccessToken();
    // If it's a mock token, skip the API call entirely
    if (token && isMockToken(token)) {
      const mockUser = getMockUser(token);
      if (mockUser) {
        setUser(mockUser);
        setLoading(false);
        return;
      }
    }
    try {
      const res = await auth.me();
      setUser(res.data);
    } catch {
      // If API fails and we have a mock token, use mock data
      if (token && isMockToken(token)) {
        const mockUser = getMockUser(token);
        if (mockUser) {
          setUser(mockUser);
          setLoading(false);
          return;
        }
      }
      setAccessToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (getAccessToken()) {
      fetchMe();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (token: string) => {
    setAccessToken(token);
    await fetchMe();
  };

  const logout = () => {
    auth.logout().catch(() => {});
    setAccessToken(null);
    setUser(null);
  };

  const isAdmin = user?.user.role === 'admin';
  const isManager = user?.user.role === 'manager';
  const isEmployee = user?.user.role === 'employee';
  const hasPermission = (perm: string) => user?.permissions.includes(perm) ?? false;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isManager, isEmployee, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
