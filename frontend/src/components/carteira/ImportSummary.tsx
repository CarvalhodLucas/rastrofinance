import { CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useCurrency } from '@/contexts/CurrencyContext';

interface ImportSummaryProps {
  importedCount: number;
  newHoldingsCount: number;
  totalInvested: number;
  onReset: () => void;
}

export function ImportSummary({
  importedCount,
  newHoldingsCount,
  totalInvested,
  onReset,
}: ImportSummaryProps) {
  const navigate = useNavigate();
  const { fmt } = useCurrency();

  return (
    <div className="w-full max-w-md mx-auto text-center space-y-8 p-8 rounded-2xl border border-border/80 bg-gradient-to-b from-[#131b2e] to-[#0d1324] shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
      {/* Icon with glowing animation */}
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-green/10 text-accent-green relative">
          <CheckCircle2 className="h-12 w-12 relative z-10" />
          <div className="absolute inset-0 rounded-full bg-accent-green/20 animate-pulse-soft" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">
          Importação concluída!
        </h2>
        <p className="text-sm text-text-secondary">
          Os dados do seu extrato B3 foram processados com sucesso.
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-3 text-left">
        <div className="p-4 rounded-xl bg-bg-elevated border border-border/40 flex items-center justify-between">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Transações Importadas
          </span>
          <span className="text-lg font-bold text-text-primary font-mono">
            {importedCount}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-bg-elevated border border-border/40 flex items-center justify-between">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Ativos em Carteira
          </span>
          <span className="text-lg font-bold text-text-primary font-mono">
            {newHoldingsCount}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-bg-elevated border border-border/40 flex items-center justify-between">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Total Investido do Lote
          </span>
          <span className="text-lg font-bold text-accent-gold font-mono">
            {fmt(totalInvested)}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={onReset}
          variant="secondary"
          className="flex-1 cursor-pointer"
        >
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span>Importar Outro</span>
        </Button>

        <Button
          onClick={() => navigate('/investments?tab=TRADES')}
          variant="primary"
          className="flex-1 shadow-[0_0_15px_rgba(245,158,11,0.2)] cursor-pointer"
        >
          <span>Ver Carteira</span>
          <ChevronRight className="h-4 w-4 shrink-0" />
        </Button>
      </div>
    </div>
  );
}
