import { useState, useEffect, useRef, useMemo } from 'react';
import { X, TrendingDown, TrendingUp, Loader2, Camera, Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import { useCategories } from '@/hooks/useCategories';
import { ManageCategoriesModal } from '@/components/categories/ManageCategoriesModal';
import { cn } from '@/lib/utils';
import { useCurrency, type Currency } from '@/contexts/CurrencyContext';
import type { ConnectedAccount, Transaction } from '@/types/finance';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  accounts: ConnectedAccount[];
  autoTriggerScan?: boolean;
  transactionToEdit?: Transaction | null;
}

const TX_TYPES = ['DEBIT', 'PIX', 'TED', 'BOLETO', 'CREDIT'] as const;

const CURRENCY_SYMBOLS: Record<Currency, string> = { BRL: 'R$', USD: '$', EUR: '€', CLP: '$' };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function AddTransactionModal({ open, onClose, onCreated, accounts, autoTriggerScan, transactionToEdit }: Props) {
  const { notify } = useToast();
  const { currency, rate: currentContextRate } = useCurrency();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [isExpense, setIsExpense] = useState(true);
  const [date, setDate] = useState(todayISO);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [txType, setTxType] = useState<string>('DEBIT');
  const [accountId, setAccountId] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [manageCatOpen, setManageCatOpen] = useState(false);

  const { categoryNames } = useCategories();

  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(currency);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [loadingRate, setLoadingRate] = useState(false);

  const accountOptions = useMemo(() => {
    const hasCash = accounts.some(
      (a: ConnectedAccount) =>
        a.institution_name.toLowerCase() === 'dinheiro' ||
        a.account_name.toLowerCase().includes('dinheiro'),
    );

    if (hasCash) return accounts;

    const cashFallback: ConnectedAccount = {
      id: 'cash_fallback',
      pluggy_item_id: 'manual_item_cash',
      pluggy_account_id: 'manual_cash_account',
      institution_name: 'Dinheiro',
      institution_logo: null,
      account_type: 'CHECKING',
      account_name: 'Dinheiro em Espécie',
      account_number: null,
      balance: 0,
      currency: 'BRL',
      is_active: true,
      last_synced_at: null,
      created_at: new Date().toISOString(),
    };

    return [cashFallback, ...accounts];
  }, [accounts]);

  useEffect(() => {
    if (open) {
      if (transactionToEdit) {
        setIsExpense(transactionToEdit.amount < 0);
        setDate(transactionToEdit.date);
        setAmount(Math.abs(transactionToEdit.original_amount ?? transactionToEdit.amount).toString());
        setDescription(transactionToEdit.description);
        setCategory(transactionToEdit.category ?? '');
        setTxType(transactionToEdit.transaction_type);
        setAccountId(transactionToEdit.account_id ?? '');
        setIsRecurring(transactionToEdit.is_recurring ?? false);
        setSelectedCurrency((transactionToEdit.original_currency as Currency) ?? currency);
        setExchangeRate(transactionToEdit.exchange_rate ?? 1);
      } else {
        setSelectedCurrency(currency);
        setIsRecurring(false);
        // Auto-seleciona a conta de Dinheiro se nenhuma estiver selecionada
        const cashAcc = accountOptions.find(
          (a: ConnectedAccount) =>
            a.institution_name.toLowerCase() === 'dinheiro' ||
            a.account_name.toLowerCase().includes('dinheiro'),
        );
        if (cashAcc) {
          setAccountId(cashAcc.id);
        } else if (accountOptions.length > 0) {
          setAccountId(accountOptions[0].id);
        }

        if (autoTriggerScan) {
          setTimeout(() => fileInputRef.current?.click(), 150);
        }
      }
    }
  }, [open, currency, autoTriggerScan, transactionToEdit, accountOptions]);

  useEffect(() => {
    if (!open) return;
    if (selectedCurrency === 'BRL') {
      setExchangeRate(1);
      return;
    }

    let active = true;
    setLoadingRate(true);

    const fetchRate = async () => {
      try {
        const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/brl.json`);
        if (!res.ok) throw new Error();
        const data = await res.json() as { date: string; brl: Record<string, number> };
        if (!active) return;
        const brlToCurr = data.brl[selectedCurrency.toLowerCase()];
        if (brlToCurr) {
          setExchangeRate(1 / brlToCurr);
        } else {
          setExchangeRate(selectedCurrency === currency ? 1 / currentContextRate : (selectedCurrency === 'USD' ? 5.5 : selectedCurrency === 'EUR' ? 6.0 : 0.0057));
        }
      } catch {
        if (!active) return;
        setExchangeRate(selectedCurrency === currency ? 1 / currentContextRate : (selectedCurrency === 'USD' ? 5.5 : selectedCurrency === 'EUR' ? 6.0 : 0.0057));
      } finally {
        if (active) setLoadingRate(false);
      }
    };

    void fetchRate();
    return () => {
      active = false;
    };
  }, [open, selectedCurrency, date, currency, currentContextRate]);

  if (!open) return null;

  const reset = () => {
    if (transactionToEdit) {
      setIsExpense(transactionToEdit.amount < 0);
      setDate(transactionToEdit.date);
      setAmount(Math.abs(transactionToEdit.original_amount ?? transactionToEdit.amount).toString());
      setDescription(transactionToEdit.description);
      setCategory(transactionToEdit.category ?? '');
      setTxType(transactionToEdit.transaction_type);
      setAccountId(transactionToEdit.account_id ?? '');
      setSelectedCurrency((transactionToEdit.original_currency as Currency) ?? currency);
      setExchangeRate(transactionToEdit.exchange_rate ?? 1);
    } else {
      setIsExpense(true);
      setDate(todayISO());
      setAmount('');
      setDescription('');
      setCategory('');
      setTxType('DEBIT');
      const cashAcc = accountOptions.find(
        (a: ConnectedAccount) =>
          a.institution_name.toLowerCase() === 'dinheiro' ||
          a.account_name.toLowerCase().includes('dinheiro'),
      );
      setAccountId(cashAcc ? cashAcc.id : accountOptions[0]?.id ?? '');
      setSelectedCurrency(currency);
      setExchangeRate(1);
    }
    setScanningReceipt(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleScanFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      notify('Por favor, selecione um arquivo de imagem (foto, print ou comprovante).', 'error');
      return;
    }
    setScanningReceipt(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await api.scanReceipt(base64, file.type);
      if (res.amount !== undefined && res.amount !== null) {
        setAmount(String(res.amount));
      }
      if (res.currency) {
        setSelectedCurrency(res.currency);
      }
      if (res.date) {
        setDate(res.date);
      }
      if (res.description || res.merchant_name) {
        setDescription(res.description || res.merchant_name || '');
      }
      if (res.category) {
        setCategory(res.category);
      }
      if (res.transaction_type) {
        setTxType(res.transaction_type);
      }
      if (res.is_expense !== undefined) {
        setIsExpense(res.is_expense);
      }
      notify('Comprovante analisado com sucesso pela IA!', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao analisar o comprovante.', 'error');
    } finally {
      setScanningReceipt(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleScanFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          void handleScanFile(file);
          break;
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount.replace(',', '.'));
    if (!num || !description || !date) return;

    if (!accountId) {
      notify('Por favor, selecione a conta ou forma de pagamento.', 'error');
      return;
    }

    setSaving(true);
    try {
      const baseBrlAmount = num * exchangeRate;
      const payload = {
        date,
        amount: isExpense ? -Math.abs(baseBrlAmount) : Math.abs(baseBrlAmount),
        description: description.trim(),
        category: category || undefined,
        transaction_type: txType as import('@/types/finance').TransactionType,
        account_id: accountId,
        is_recurring: isRecurring,
        original_currency: selectedCurrency,
        original_amount: isExpense ? -Math.abs(num) : Math.abs(num),
        exchange_rate: exchangeRate,
      };
      
      if (transactionToEdit) {
        await api.updateTransaction(transactionToEdit.id, payload);
        notify('Transação atualizada!', 'success');
      } else {
        await api.createTransaction(payload);
        notify('Transação adicionada!', 'success');
      }
      
      onCreated();
      handleClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao criar transação.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onPaste={handlePaste}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold text-text-primary">
            {transactionToEdit ? 'Editar transação' : 'Nova transação'}
          </h2>
          <button
            onClick={handleClose}
            className="cursor-pointer text-text-muted hover:text-text-primary"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Banner IA Escanear Foto/Comprovante */}
        <div className="border-b border-border bg-accent-gold/5 px-5 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-accent-gold shrink-0 animate-pulse" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">
                Preenchimento com IA (OCR)
              </p>
              <p className="text-[10px] text-text-secondary truncate">
                Envie foto de cupom, extrato ou cole (Ctrl+V)
              </p>
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanningReceipt || saving}
            className="text-xs h-8 px-2.5 gap-1.5 border-accent-gold/30 hover:border-accent-gold shrink-0"
          >
            {scanningReceipt ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-gold" />
                <span>Lendo...</span>
              </>
            ) : (
              <>
                <Camera className="h-3.5 w-3.5 text-accent-gold" />
                <span>Escanear Foto</span>
              </>
            )}
          </Button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-5">
          {/* Tipo: Despesa / Receita */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setIsExpense(true); setTxType('DEBIT'); }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors',
                isExpense
                  ? 'border-accent-red bg-accent-red/10 text-accent-red'
                  : 'border-border bg-bg-elevated text-text-secondary hover:border-accent-red/50',
              )}
            >
              <TrendingDown className="h-4 w-4" />
              Despesa
            </button>
            <button
              type="button"
              onClick={() => { setIsExpense(false); setTxType('CREDIT'); }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors',
                !isExpense
                  ? 'border-accent-green bg-accent-green/10 text-accent-green'
                  : 'border-border bg-bg-elevated text-text-secondary hover:border-accent-green/50',
              )}
            >
              <TrendingUp className="h-4 w-4" />
              Receita
            </button>
          </div>

          {/* Moeda */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-secondary">
              Moeda
            </label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value as Currency)}
              className="input cursor-pointer"
            >
              <option value="BRL">🇧🇷 Real (BRL)</option>
              <option value="USD">🇺🇸 Dólar (USD)</option>
              <option value="EUR">🇪🇺 Euro (EUR)</option>
              <option value="CLP">🇨🇱 Peso Chileno (CLP)</option>
            </select>
          </div>

          {/* Valor */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-secondary">
              Valor ({selectedCurrency})
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-text-muted">
                {CURRENCY_SYMBOLS[selectedCurrency]}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="input pl-9 font-mono"
              />
            </div>
            {selectedCurrency !== 'BRL' && (
              <p className="mt-1.5 text-xs text-text-secondary flex flex-col gap-0.5">
                {loadingRate ? (
                  <span className="text-text-muted">Carregando cotação do dia...</span>
                ) : (
                  <>
                    <span>Cotação histórica para o dia: 1 {selectedCurrency} = {exchangeRate.toFixed(4)} BRL</span>
                    {amount && (
                      <span className="text-accent-gold font-medium">
                        Equivale a R$ {(parseFloat(amount.replace(',', '.')) * exchangeRate || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </>
                )}
              </p>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-secondary">
              Descrição
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Mercado, Salário, Netflix…"
              className="input"
            />
          </div>

          {/* Data */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-secondary">
              Data
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </div>

          {/* Categoria + Tipo (lado a lado) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-secondary">
                Categoria
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input flex-1 cursor-pointer min-w-0"
                >
                  <option value="">Sem categoria</option>
                  {categoryNames.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setManageCatOpen(true)}
                  title="Criar ou Excluir Categorias"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent-gold/40 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold hover:text-black transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4 font-bold" />
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-secondary">
                Tipo
              </label>
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value)}
                className="input cursor-pointer"
              >
                {TX_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Conta / Forma de Pagamento (Obrigatório) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Conta / Forma de Pagamento
              </label>
              <span className="text-[10px] font-bold text-accent-red">Obrigatório</span>
            </div>
            <select
              required
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={cn(
                'input cursor-pointer',
                !accountId && 'border-accent-red/50 text-text-muted',
              )}
            >
              <option value="" disabled>
                Selecione a conta ou forma de pagamento...
              </option>
              {accountOptions.map((a: ConnectedAccount) => (
                <option key={a.id} value={a.id}>
                  {a.institution_name === 'Dinheiro'
                    ? '💵 Dinheiro (Espécie)'
                    : `${a.institution_name} — ${a.account_name}`}
                </option>
              ))}
            </select>
          </div>

          {/* Checkbox Assinatura / Recorrência Mensal */}
          <div className="flex items-start gap-2.5 rounded-xl border border-accent-gold/30 bg-accent-gold/5 p-3">
            <input
              type="checkbox"
              id="is_recurring_cb"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-accent-gold focus:ring-accent-gold cursor-pointer"
            />
            <label htmlFor="is_recurring_cb" className="text-xs font-medium text-text-primary cursor-pointer select-none">
              🔄 Marcar como Assinatura / Recorrência Mensal
              <span className="block text-[10px] text-text-secondary font-normal mt-0.5 leading-tight">
                Ex: Netflix, Spotify, iCloud, Academia, Aluguel. O sistema renovará este lançamento automaticamente todo mês no mesmo dia.
              </span>
            </label>
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={handleClose}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={saving || !amount || !description || !accountId}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </form>
      </div>

      <ManageCategoriesModal
        open={manageCatOpen}
        onClose={() => setManageCatOpen(false)}
      />
    </div>
  );
}
