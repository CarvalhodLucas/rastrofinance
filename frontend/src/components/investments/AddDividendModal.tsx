import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Coins, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import { POPULAR_INSTITUTIONS } from '@/components/investments/AddInvestmentModal';
import rastroAssets from '@/data/assetsDatabase.json';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefillTicker?: string;
  prefillInstitution?: string;
}

export function AddDividendModal({
  open,
  onClose,
  onSuccess,
  prefillTicker = '',
  prefillInstitution = '',
}: Props) {
  const { notify } = useToast();
  const [ticker, setTicker] = useState(prefillTicker);
  const [institution, setInstitution] = useState(prefillInstitution || 'XP Investimentos');
  const [type, setType] = useState<'DIVIDEND' | 'JCP' | 'FII' | 'OTHER'>('DIVIDEND');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTickerChange = (val: string) => {
    const clean = val.toUpperCase();
    setTicker(clean);

    if (clean.endsWith('11')) setType('FII');

    if (clean.trim().length >= 1) {
      const matches = rastroAssets.filter(
        (a) =>
          a.ticker.toUpperCase().includes(clean.trim()) ||
          a.name.toUpperCase().includes(clean.trim())
      ).slice(0, 8);
      setSuggestions(matches);
      setShowSuggestions(true);

      const exact = rastroAssets.find((a) => a.ticker.toUpperCase() === clean.trim());
      if (exact) {
        if (exact.type === 'FIIs' || exact.ticker.endsWith('11')) setType('FII');
        else if (exact.type === 'Ações') setType('DIVIDEND');
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (item: (typeof rastroAssets)[0]) => {
    setTicker(item.ticker);
    setShowSuggestions(false);
    if (item.type === 'FIIs' || item.ticker.endsWith('11')) {
      setType('FII');
    } else if (item.type === 'Ações') {
      setType('DIVIDEND');
    }
  };

  useEffect(() => {
    if (open) {
      setTicker(prefillTicker || '');
      setInstitution(prefillInstitution || 'XP Investimentos');
      setAmount('');
      setDate(new Date().toISOString().substring(0, 10));
      setNotes('');
      if (prefillTicker?.toUpperCase().endsWith('11')) {
        setType('FII');
      } else {
        setType('DIVIDEND');
      }
    }
  }, [open, prefillTicker, prefillInstitution]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTicker = ticker.trim().toUpperCase();
    if (!cleanTicker) {
      notify('O ticker ou código do ativo é obrigatório.', 'error');
      return;
    }
    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      notify('Informe um valor de provento maior que zero.', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.createDividend({
        ticker: cleanTicker,
        institution: institution.trim() || 'Manual',
        date,
        type,
        amount: val,
        notes: notes.trim() || undefined,
      });

      notify(`✓ Provento de R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para ${cleanTicker} lançado com sucesso!`, 'success');
      onSuccess();
      window.dispatchEvent(new Event('dividends:changed'));
      onClose();
    } catch (err: any) {
      notify(err?.message || 'Falha ao lançar provento.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-border bg-bg-card p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Coins className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-text-primary">
                Lançar Proventos / Dividendos
              </h2>
              <p className="text-xs text-text-secondary">
                Atualiza na hora a aba de Proventos dos Investimentos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:bg-bg-elevated hover:text-text-primary transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Ticker & Tipo de Provento */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative" ref={searchRef}>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                Ativo / Ticker *
              </label>
              <input
                type="text"
                required
                value={ticker}
                onChange={(e) => handleTickerChange(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                placeholder="Ex: PETR4, MXRF11..."
                className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-sm font-mono font-bold text-accent-gold uppercase focus:border-accent-gold focus:outline-none"
              />

              {showSuggestions && suggestions.length > 0 && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-bg-card p-1.5 shadow-2xl z-50 animate-fade-in space-y-1"
                >
                  {suggestions.map((item) => (
                    <button
                      key={item.ticker}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion(item);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion(item);
                      }}
                      className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left hover:bg-bg-elevated transition-colors cursor-pointer group"
                    >
                      <div className="flex flex-col truncate">
                        <span className="font-bold font-mono text-accent-gold group-hover:text-amber-300">
                          {item.ticker}
                        </span>
                        <span className="text-[11px] text-text-secondary truncate">
                          {item.name}
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-bg-primary text-text-secondary border border-border">
                        {item.type || 'B3'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                Tipo de Provento *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-sm font-medium text-text-primary focus:border-accent-gold focus:outline-none cursor-pointer"
              >
                <option value="DIVIDEND">Dividendo</option>
                <option value="JCP">JCP (Juros s/ Capital)</option>
                <option value="FII">Rendimento FII</option>
                <option value="OTHER">Outro Provento</option>
              </select>
            </div>
          </div>

          {/* Valor Líquido & Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                Valor Total Recebido (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-accent-gold">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-xl border border-accent-gold/40 bg-bg-primary pl-9 pr-3 py-2 text-sm font-mono font-bold text-text-primary focus:border-accent-gold focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-accent-gold" />
                <span>Data do Recebimento *</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-sm font-medium text-text-primary focus:border-accent-gold focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Instituição / Corretora */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
              Corretora / Banco de Custódia
            </label>
            <input
              type="text"
              list="inst-dividend-options"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="Ex: XP Investimentos, NuInvest, BTG Pactual"
              className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-gold focus:outline-none"
            />
            <datalist id="inst-dividend-options">
              {POPULAR_INSTITUTIONS.map((inst) => (
                <option key={inst} value={inst} />
              ))}
            </datalist>
          </div>

          {/* Observações opcionais */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
              Observação (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Pagamento referente a Outubro"
              className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary/50 focus:border-accent-gold focus:outline-none"
            />
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="text-xs">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-accent-gold text-black font-semibold text-xs">
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Coins className="mr-1.5 h-3.5 w-3.5" />
                  Salvar Provento
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

