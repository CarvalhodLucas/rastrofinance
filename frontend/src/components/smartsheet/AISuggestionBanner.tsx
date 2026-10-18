import { useState } from 'react';
import { Lightbulb, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useSmartSheet } from '@/contexts/SmartSheetContext';

export function AISuggestionBanner() {
  const { state, dispatch, loadView } = useSmartSheet();
  const [idx, setIdx] = useState(0);
  const { suggestions } = state;

  if (suggestions.length === 0) return null;

  const current = suggestions[Math.min(idx, suggestions.length - 1)]!;

  const handleAction = () => {
    if (current.action === 'VIEW_CATEGORIES') void loadView('categories', state.period);
    else if (current.action === 'VIEW_SUBSCRIPTIONS') void loadView('subscriptions', state.period);
    else if (current.action.startsWith('VIEW_XRAY:')) {
      const cat = current.action.split(':')[1] ?? '';
      void loadView('xray', state.period, cat);
    }
    dispatch({ type: 'DISMISS_SUGGESTION', payload: current.id });
  };

  const handleDismiss = () => {
    dispatch({ type: 'DISMISS_SUGGESTION', payload: current.id });
    setIdx((i) => Math.max(0, i - 1));
  };

  return (
    <div className="border-b border-border bg-bg-elevated px-4 py-2.5 md:px-6">
      <div className="flex items-center gap-3">
        <Lightbulb className="h-4 w-4 shrink-0 text-accent-gold" />

        <p className="flex-1 text-xs text-text-secondary">
          {current.message}
        </p>

        {/* Multi-suggestion nav */}
        {suggestions.length > 1 && (
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="disabled:opacity-30">
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span>{idx + 1}/{suggestions.length}</span>
            <button onClick={() => setIdx((i) => Math.min(suggestions.length - 1, i + 1))} disabled={idx === suggestions.length - 1} className="disabled:opacity-30">
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}

        <Button size="sm" variant="primary" onClick={handleAction} className="h-7 shrink-0 px-2.5 text-xs">
          {current.actionLabel}
        </Button>

        <button onClick={handleDismiss} className="text-text-muted hover:text-text-primary" aria-label="Ignorar sugestão">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
