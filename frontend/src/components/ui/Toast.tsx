import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  notify: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => remove(id), 4500);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      {/* Toasts no canto inferior direito */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex w-80 max-w-[90vw] animate-fade-in items-start gap-3 rounded-lg border bg-bg-elevated p-3 shadow-lg',
              t.kind === 'success' && 'border-accent-green/40',
              t.kind === 'error' && 'border-accent-red/40',
              t.kind === 'info' && 'border-border',
            )}
            role="status"
          >
            {t.kind === 'success' && (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-green" />
            )}
            {t.kind === 'error' && (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent-red" />
            )}
            <p className="flex-1 text-sm text-text-primary">{t.message}</p>
            <button
              className="cursor-pointer text-text-muted hover:text-text-primary"
              onClick={() => remove(t.id)}
              aria-label="Fechar notificação"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return ctx;
}
