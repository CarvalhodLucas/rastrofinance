import { cn } from '@/lib/utils';
import { useSmartSheet } from '@/contexts/SmartSheetContext';
import { VIEWS } from '@/types/smartsheet';

export function ViewSelector() {
  const { state, loadView } = useSmartSheet();

  if (VIEWS.length <= 1) return null;

  return (
    <div className="border-b border-border bg-[#13141f] px-4 pt-2">
      <div className="flex items-end overflow-x-auto scrollbar-none gap-1">
        {VIEWS.map((view) => {
          const active = state.activeView === view.id;
          return (
            <button
              key={view.id}
              onClick={() => void loadView(view.id, state.period)}
              className={cn(
                'flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-t-lg transition-all duration-150 border-t border-l border-r',
                active
                  ? 'border-border bg-bg-card text-accent-gold font-bold shadow-[0_-2px_8px_rgba(245,158,11,0.08)] translate-y-[1px] z-10'
                  : 'border-transparent bg-[#1b1c26]/60 text-text-secondary hover:text-text-primary hover:bg-[#1b1c26]/90'
              )}
            >
              <span className="text-sm leading-none">{view.icon}</span>
              <span>{view.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

