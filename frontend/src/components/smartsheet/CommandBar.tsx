import { useEffect, useRef, useState } from 'react';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSmartSheet } from '@/contexts/SmartSheetContext';

const PLACEHOLDERS = [
  'compare meus gastos de junho com maio...',
  'mostre todas as minhas assinaturas ativas...',
  'quanto gastei com delivery esse mês?',
  'quais foram meus 5 maiores gastos?',
  'projete meus gastos para o próximo mês...',
  'de onde veio meu dinheiro esse mês?',
  'analise meus gastos com transporte...',
  'quanto economizei comparado ao mês passado?',
];

const QUICK_COMMANDS = [
  { label: 'compare os últimos meses', icon: '📊' },
  { label: 'mostre assinaturas ativas', icon: '🔄' },
  { label: 'maiores gastos do mês', icon: '💸' },
  { label: 'projete o fim do mês', icon: '📈' },
  { label: 'raio-x de delivery', icon: '🍕' },
  { label: 'de onde veio meu dinheiro?', icon: '💰' },
];

export function CommandBar() {
  const { state, executeCommand } = useSmartSheet();
  const [value, setValue] = useState('');
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]!);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const isLoading = state.isLoading;

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Rotate placeholders
  useEffect(() => {
    let idx = 0;
    const id = setInterval(() => {
      idx = (idx + 1) % PLACEHOLDERS.length;
      setPlaceholder(PLACEHOLDERS[idx]!);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const submit = async () => {
    const cmd = value.trim();
    if (!cmd || isLoading) return;
    setValue('');
    setHistoryIndex(-1);
    await executeCommand(cmd);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { void submit(); return; }
    if (e.key === 'Escape') { setValue(''); setHistoryIndex(-1); return; }
    if (e.key === 'ArrowUp' && value === '') {
      e.preventDefault();
      const next = Math.min(historyIndex + 1, state.commandHistory.length - 1);
      setHistoryIndex(next);
      setValue(state.commandHistory[next] ?? '');
    }
    if (e.key === 'ArrowDown' && historyIndex >= 0) {
      e.preventDefault();
      const next = historyIndex - 1;
      setHistoryIndex(next);
      setValue(next < 0 ? '' : (state.commandHistory[next] ?? ''));
    }
  };

  const isFocused = document.activeElement === inputRef.current;

  return (
    <div className="border-b border-border bg-bg-card px-4 py-3 md:px-6">
      {/* Input */}
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border bg-bg-elevated px-4 py-3 transition-all duration-200',
          isLoading
            ? 'border-accent-gold animate-pulse'
            : 'border-border focus-within:border-accent-gold focus-within:shadow-[0_0_0_2px_rgba(245,158,11,0.15)]',
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent-gold" />
        ) : (
          <Sparkles className={cn('h-4 w-4 shrink-0 transition-colors', isFocused || value ? 'text-accent-gold' : 'text-text-muted')} />
        )}

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); setHistoryIndex(-1); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none disabled:opacity-50"
        />

        <button
          onClick={() => void submit()}
          disabled={!value.trim() || isLoading}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
            value.trim() && !isLoading
              ? 'bg-accent-gold text-bg-primary hover:bg-amber-400'
              : 'bg-bg-primary text-text-muted opacity-50 cursor-not-allowed',
          )}
          aria-label="Executar comando"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Error */}
      {state.error && (
        <p className="mt-2 text-xs text-accent-red">{state.error}</p>
      )}

      {/* Quick commands */}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd.label}
            onClick={() => { setValue(cmd.label); void executeCommand(cmd.label); }}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-accent-gold/50 hover:text-text-primary disabled:opacity-40"
          >
            <span>{cmd.icon}</span>
            <span>{cmd.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
