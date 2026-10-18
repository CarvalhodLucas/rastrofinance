import { Landmark, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { timeAgo } from '@/lib/format';

interface ConnectionStatusCardProps {
  status: 'disconnected' | 'active' | 'expiring' | 'expired';
  daysLeft?: number;
  lastSync?: string | null;
}

export function ConnectionStatusCard({ status, daysLeft, lastSync }: ConnectionStatusCardProps) {
  
  if (status === 'disconnected') {
    return (
      <div className="rounded-xl border border-border bg-bg-elevated p-6 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-card border border-border">
          <Landmark className="h-6 w-6 text-text-secondary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Nenhuma conta conectada ainda</h3>
          <p className="text-xs text-text-secondary">Conecte sua conta do Santander España para sincronização diária.</p>
        </div>
      </div>
    );
  }

  if (status === 'active') {
    return (
      <div className="rounded-xl border border-accent-green/30 bg-accent-green/5 p-6 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-green/20">
          <CheckCircle2 className="h-6 w-6 text-accent-green" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Conexão Ativa — Santander España</h3>
          <p className="text-xs text-text-secondary">
            Última sincronização: {lastSync ? timeAgo(lastSync) : 'recentemente'}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'expiring') {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-amber-500">Conexão expira em {daysLeft} dias</h3>
          <p className="text-xs text-text-secondary">
            Por favor, reautorize a conexão para não perder o acesso aos seus dados.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
          <XCircle className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-red-500">Reconexão necessária</h3>
          <p className="text-xs text-text-secondary">
            Sua conexão expirou. É necessário reautorizar o acesso no seu banco.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
