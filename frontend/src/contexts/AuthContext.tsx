import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  api,
  getStoredToken,
  setStoredToken,
  getStoredUser,
  setStoredUser,
} from '@/services/api';
import type { AuthUser } from '@/types/finance';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (username: string, password: string, name?: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  const clearLocalUserData = () => {
    try {
      localStorage.removeItem('rastro_user');
      sessionStorage.removeItem('rastro_user');
      localStorage.removeItem('rastro_watchlist_cache');
      sessionStorage.removeItem('rastro_watchlist_cache');

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('rastro_watchlist_cache') || key.startsWith('investments_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });
    } catch {}
  };

  const logout = useCallback(() => {
    clearLocalUserData();
    setStoredToken(null);
    setStoredUser(null);
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
          const isLocalStorage = Boolean(localStorage.getItem('rastro_token'));
          setUser(remoteUser);
          setStoredUser(remoteUser, isLocalStorage);
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

  const login = async (username: string, password: string, rememberMe: boolean = true) => {
    clearLocalUserData();
    const res = await api.login(username, password, rememberMe);
    setStoredToken(res.token, rememberMe);
    setStoredUser(res.user, rememberMe);
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (username: string, password: string, name?: string, rememberMe: boolean = true) => {
    clearLocalUserData();
    const res = await api.register(username, password, name, rememberMe);
    setStoredToken(res.token, rememberMe);
    setStoredUser(res.user, rememberMe);
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
