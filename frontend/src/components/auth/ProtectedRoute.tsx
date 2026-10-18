import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Activity, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-primary text-text-primary">
        <div className="relative flex flex-col items-center gap-4">
          {/* Ambient Glow */}
          <div className="absolute -inset-4 rounded-full bg-accent-gold/15 blur-xl animate-pulse" />
          
          {/* Logo */}
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-card border border-accent-gold/30 shadow-2xl shadow-accent-gold/10">
            <Activity className="h-8 w-8 text-accent-gold animate-bounce" />
          </div>

          <div className="flex flex-col items-center gap-1.5 z-10">
            <span className="text-xl font-bold tracking-tight text-text-primary">
              Rastro<span className="text-accent-gold"> Finance</span>
            </span>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-gold" />
              <span>Verificando autenticação...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
