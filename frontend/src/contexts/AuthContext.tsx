import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getStoredToken, setStoredToken } from '@/services/api';
import type { AuthUser } from '@/types/finance';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthUser | null>(() => {
    const cachedUser = localStorage.getItem('rastro_user');
    if (cachedUser) {
      try {
        return JSON.parse(cachedUser);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  const clearLocalUserData = () => {
    try {
      localStorage.removeItem('rastro_user');
      localStorage.removeItem('rastro_watchlist_cache');
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('rastro_watchlist_cache') || key.startsWith('investments_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
  };

  const logout = useCallback(() => {
    clearLocalUserData();
    setStoredToken(null);
    setToken(null);
    setUser(null);
    api.logout().catch(() => {});
  }, []);

  // Verificar validade do token ao iniciar a aplicação
  useEffect(() => {
    let isMounted = true;
    const verifySession = async () => {
      const storedToken = getStoredToken();
      if (!storedToken) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const { user: remoteUser } = await api.getMe();
        if (isMounted) {
          setUser(remoteUser);
          localStorage.setItem('rastro_user', JSON.stringify(remoteUser));
          setToken(storedToken);
        }
      } catch (err) {
        console.warn('[AuthContext] Sessão expirada ou inválida:', err);
        if (isMounted) {
          logout();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void verifySession();

    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      isMounted = false;
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [logout]);

  const login = async (username: string, password: string) => {
    clearLocalUserData();
    const res = await api.login(username, password);
    setStoredToken(res.token);
    localStorage.setItem('rastro_user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (username: string, password: string, name?: string) => {
    clearLocalUserData();
    const res = await api.register(username, password, name);
    setStoredToken(res.token);
    localStorage.setItem('rastro_user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: Boolean(token && user),
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
