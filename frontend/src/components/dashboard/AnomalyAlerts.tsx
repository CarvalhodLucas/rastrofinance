import { useState } from 'react';
import { AlertTriangle, Zap, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateShort } from '@/lib/format';
import { useFmt } from '@/contexts/CurrencyContext';
import type { Transaction } from '@/types/finance';

interface Props {
  anomalies: Transaction[];
}

/**
 * Faixa de alertas de anomalia. Não renderiza nada quando não há anomalias.
 * HIGH → vermelho; MEDIUM → âmbar; LOW → indicador sutil.
 */
export function AnomalyAlerts({ anomalies }: Props) {
  const fmt = useFmt();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = anomalies.filter((a) => !dismissed.has(a.id));

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((a) => {
        // Sem severity persistida na transação; usamos o valor como heurística visual.
        const high = Math.abs(a.amount) >= 500;
        return (
          <div
            key={a.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3 text-sm animate-fade-in',
              high
                ? 'border-accent-red/40 bg-accent-red/10'
                : 'border-accent-gold/40 bg-accent-gold/10',
            )}
          >
            {high ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent-red" />
            ) : (
              <Zap className="mt-0.5 h-5 w-5 shrink-0 text-accent-gold" />
            )}
            <div className="flex-1">
              <p className="text-text-primary">
                {a.anomaly_reason ?? 'Gasto atípico detectado.'}
              </p>
              <p className="mt-0.5 text-xs text-text-secondary">
                {a.description} · {fmt(a)} ·{' '}
                {formatDateShort(a.date)}
              </p>
            </div>
            <button
              className="cursor-pointer text-text-muted transition-colors hover:text-text-primary"
              onClick={() => setDismissed((s) => new Set(s).add(a.id))}
              aria-label="Dispensar alerta"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
