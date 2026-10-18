import { useEffect, useState } from 'react';
import { X, History, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import { useCurrency } from '@/contexts/CurrencyContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface TradeHistoryItem {
  id: string;
  type: 'CONVERT' | 'FIAT';
  date: string;
  from_asset: string;
  from_amount: number;
  to_asset: string;
  to_amount: number;
  unit_price_brl: number;
  total_brl: number;
}

export function BinanceHistoryModal({ open, onClose }: Props) {
  const { notify } = useToast();
  const { fmt } = useCurrency();
  const [history, setHistory] = useState<TradeHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getBinanceHistory();
      setHistory(data.history);
    } catch (err) {
      notify('Falha ao carregar histórico da Binance.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void fetchHistory();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Histórico de Compras — Binance</h2>
              <p className="text-xs text-text-secondary">Extrato oficial de conversões e depósitos capturados da API</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={fetchHistory} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-text-secondary">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-amber-500" />
              Buscando histórico na Binance...
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-text-secondary">
              <History className="h-10 w-10 text-text-secondary/30 mb-2" />
              <p className="font-semibold text-text-primary">Nenhuma conversão recente encontrada</p>
              <p className="text-xs text-text-secondary mt-1">
                Suas compras realizadas via Binance Convert ou PIX aparecerão listadas aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-bg-primary">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-bg-elevated/60 text-text-secondary">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Operação</th>
                    <th className="px-4 py-3">Qtd Adquirida</th>
                    <th className="px-4 py-3">Preço Unitário Época</th>
                    <th className="px-4 py-3 text-right">Total Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((item) => {
                    const formattedDate = new Date(item.date).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <tr key={item.id} className="hover:bg-bg-elevated/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-text-secondary">
                          {formattedDate}
                        </td>

                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                            item.type === 'CONVERT'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {item.type === 'CONVERT' ? 'Binance Convert' : 'Depósito PIX'}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-medium text-text-primary">
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="text-text-secondary">
                              {item.from_amount.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} {item.from_asset}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 text-accent-gold shrink-0" />
                            <span className="font-bold text-text-primary">
                              {item.to_amount.toLocaleString('pt-BR', { maximumFractionDigits: 8 })} {item.to_asset}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-mono font-bold text-accent-gold">
                          {item.to_amount.toLocaleString('pt-BR', { maximumFractionDigits: 8 })} {item.to_asset}
                        </td>

                        <td className="px-4 py-3 font-mono text-text-primary">
                          {fmt(item.unit_price_brl)}
                        </td>

                        <td className="px-4 py-3 font-mono font-bold text-right text-text-primary">
                          {fmt(item.total_brl)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border p-4 bg-bg-elevated/30">
          <span className="text-xs text-text-secondary">
            Total de operações encontradas: <strong className="text-text-primary">{history.length}</strong>
          </span>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
