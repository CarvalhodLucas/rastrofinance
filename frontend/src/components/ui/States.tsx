import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from './Button';

/** Estado de erro padrão, em português, com ação de retry. */
export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-accent-red" />
      <p className="text-sm text-text-secondary">
        {message ?? 'Algo deu errado ao carregar os dados.'}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

/** Estado vazio encorajador, com ação sugerida opcional. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 p-10 text-center">
      <Inbox className="h-8 w-8 text-text-muted" />
      <div>
        <p className="font-medium text-text-primary">{title}</p>
        {description && (
          <p className="mt-1 max-w-sm text-sm text-text-secondary">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
