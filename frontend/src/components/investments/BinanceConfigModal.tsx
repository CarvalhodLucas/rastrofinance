import { useState } from 'react';
import { X, Key, ShieldCheck, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BinanceConfigModal({ open, onClose, onSuccess }: Props) {
  const { notify } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !apiSecret.trim()) {
      notify('Por favor, informe a API Key e a Secret Key da Binance.', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.syncBinance({
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
      });
      notify(`Sincronização concluída com sucesso! ${res.synced_count} ativo(s) atualizado(s).`, 'success');
      onSuccess();
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao conectar com a API Binance.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-bg-card p-6 shadow-2xl transition-all">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Conectar Binance API</h2>
              <p className="text-xs text-text-secondary">Sincronização automática de saldo de criptomoedas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3.5 text-xs text-blue-400 flex items-start gap-2.5">
            <ShieldCheck className="h-5 w-5 shrink-0 text-blue-400 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Dica de Segurança:</p>
              <p className="text-blue-300/90 leading-relaxed">
                Ao criar sua chave no portal da Binance (Gestão de API), selecione apenas a permissão de <strong className="text-blue-200">Habilitar Leitura</strong>. Nunca ative permissões de Saque ou Trade.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              API Key (Chave de API)
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Cole sua API Key aqui..."
              className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Secret Key (Chave Secreta)
            </label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Cole sua Secret Key aqui..."
              className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Salvar e Sincronizar
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
