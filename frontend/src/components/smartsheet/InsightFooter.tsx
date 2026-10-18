import { useState } from 'react';
import { Brain, Send, Check, Loader2, X, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useSmartSheet } from '@/contexts/SmartSheetContext';
import { api } from '@/services/api';

export function InsightFooter() {
  const { state } = useSmartSheet();
  const { insight, isLoading } = state;
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Widget stays closed by default until explicitly clicked by user

  const handleSend = async () => {
    if (!insight || sending) return;
    setSending(true);
    try {
      await api.smartsheetSendInsight(insight);
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch { /* silently fail */ }
    finally { setSending(false); }
  };

  if (!insight && !isLoading) return null;

  return (
    <div className="fixed bottom-4 right-6 z-40">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-full border border-accent-gold/40 bg-bg-card/95 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-accent-gold shadow-xl hover:border-accent-gold hover:bg-bg-elevated transition-all duration-200 group"
        >
          <Brain className="h-4 w-4 text-accent-gold group-hover:scale-110 transition-transform" />
          <span>Análise IA</span>
          <ChevronUp className="h-3.5 w-3.5 text-text-muted" />
        </button>
      ) : (
        <div className="w-80 md:w-96 rounded-2xl border border-accent-gold/30 bg-bg-card/95 backdrop-blur-md p-4 shadow-2xl space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-accent-gold" />
              <span className="text-xs font-bold uppercase tracking-wider text-accent-gold">Análise Inteligente</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-text-muted hover:text-text-primary transition-colors p-1"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-2 py-2">
              <div className="h-3.5 animate-pulse rounded bg-bg-elevated w-full" />
              <div className="h-3.5 animate-pulse rounded bg-bg-elevated w-4/5" />
              <div className="h-3.5 animate-pulse rounded bg-bg-elevated w-2/3" />
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-text-secondary">{insight}</p>
          )}

          {insight && !isLoading && (
            <div className="flex justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleSend()}
                disabled={sending || sent}
                className="h-7 gap-1.5 text-xs text-text-muted hover:text-text-primary"
              >
                {sending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : sent ? (
                  <Check className="h-3 w-3 text-accent-green" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                {sent ? 'Enviado!' : 'Enviar via WhatsApp'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

