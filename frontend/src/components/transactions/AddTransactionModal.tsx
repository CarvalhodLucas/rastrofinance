import { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  TrendingDown,
  TrendingUp,
  Loader2,
  Camera,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Layers,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api, getDefaultAccountId, setDefaultAccountId } from '@/services/api';
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

interface BatchItem {
  id: string;
  isExpense: boolean;
  amount: string;
  description: string;
  category: string;
  date: string;
  accountId: string;
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
  const amountInputRef = useRef<HTMLInputElement>(null);
  const prevOpenRef = useRef(false);
  const prevEditIdRef = useRef<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<'next' | 'close' | 'batch' | null>(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);

  // Abas de Modo: Individual/Sequencial vs Em Lote
  const [activeTab, setActiveTab] = useState<'SINGLE' | 'BATCH'>('SINGLE');

  // Modo Contínuo (Salvar e continuar adicionando)
  const [continuousMode, setContinuousMode] = useState(false);
  const [sessionSavedCount, setSessionSavedCount] = useState(0);
  const [sessionTotalAmount, setSessionTotalAmount] = useState(0);

  // Campos do formulário individual
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
  const [defaultAccountId, setDefaultAccountIdState] = useState<string | null>(() => getDefaultAccountId());

  const handleToggleDefaultAccount = (id: string) => {
    if (!id) return;
    if (defaultAccountId === id) {
      setDefaultAccountId(null);
      setDefaultAccountIdState(null);
      notify('Conta padrão desmarcada.', 'info');
    } else {
      setDefaultAccountId(id);
      setDefaultAccountIdState(id);
      const acc = accountOptions.find((a) => a.id === id);
      const name = acc?.institution_name === 'Dinheiro' ? 'Dinheiro (Espécie)' : (acc?.account_name || 'Conta');
      notify(`⭐ "${name}" definida como conta padrão para novos lançamentos!`, 'success');
    }
  };

  // Lista de itens para o modo Em Lote
  const createEmptyBatchItem = (defAcc = ''): BatchItem => ({
    id: Math.random().toString(36).substring(2, 9),
    isExpense: true,
    amount: '',
    description: '',
    category: '',
    date: todayISO(),
    accountId: defAcc,
  });

  const [batchItems, setBatchItems] = useState<BatchItem[]>(() => [
    createEmptyBatchItem(),
    createEmptyBatchItem(),
    createEmptyBatchItem(),
  ]);

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
    if (!open) {
      prevOpenRef.current = false;
      return;
    }

    const isNewlyOpened = !prevOpenRef.current;
    const isEditChanged = (transactionToEdit?.id || null) !== prevEditIdRef.current;
    prevOpenRef.current = true;
    prevEditIdRef.current = transactionToEdit?.id || null;

    if (!isNewlyOpened && !isEditChanged) {
      return;
    }

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
      setActiveTab('SINGLE');
    } else {
      setSelectedCurrency(currency);
      setIsRecurring(false);
      // Prioriza a conta marcada como padrão pelo usuário
      const savedDefault = getDefaultAccountId();
      const hasSavedDefault = savedDefault && accountOptions.some((a) => a.id === savedDefault);
      const cashAcc = accountOptions.find(
        (a: ConnectedAccount) =>
          a.institution_name.toLowerCase() === 'dinheiro' ||
          a.account_name.toLowerCase().includes('dinheiro'),
      );
      const defAccId = hasSavedDefault
        ? (savedDefault as string)
        : cashAcc
          ? cashAcc.id
          : (accountOptions[0]?.id ?? '');

      setAccountId(defAccId);
      setDefaultAccountIdState(savedDefault);

      setBatchItems((prev) =>
        prev.map((item) => ({
          ...item,
          accountId: item.accountId || defAccId,
        })),
      );

      if (autoTriggerScan) {
        setTimeout(() => fileInputRef.current?.click(), 150);
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
        if (!res.ok) throw new Error('Falha ao obter cotação');
        const data = (await res.json()) as { date: string; brl: Record<string, number> };
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
    setSessionSavedCount(0);
    setSessionTotalAmount(0);
    setActiveTab('SINGLE');
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
      const savedDefault = getDefaultAccountId();
      const hasSavedDefault = savedDefault && accountOptions.some((a) => a.id === savedDefault);
      const cashAcc = accountOptions.find(
        (a: ConnectedAccount) =>
          a.institution_name.toLowerCase() === 'dinheiro' ||
          a.account_name.toLowerCase().includes('dinheiro'),
      );
      const defAccId = hasSavedDefault
        ? (savedDefault as string)
        : cashAcc
          ? cashAcc.id
          : (accountOptions[0]?.id ?? '');

      setAccountId(defAccId);
      setDefaultAccountIdState(savedDefault);
      setSelectedCurrency(currency);
      setExchangeRate(1);
      setBatchItems([
        createEmptyBatchItem(defAccId),
        createEmptyBatchItem(defAccId),
        createEmptyBatchItem(defAccId),
      ]);
    }
    setScanningReceipt(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const compressImageForOcr = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => {
        resolve({ base64: '', mimeType: file.type || 'image/jpeg' });
      };
      reader.onload = (e) => {
        const rawUrl = (e.target?.result as string) || '';
        const img = new Image();
        img.onerror = () => {
          resolve({ base64: rawUrl, mimeType: file.type || 'image/jpeg' });
        };
        img.onload = () => {
          try {
            const MAX_DIM = 1600;
            let width = img.width;
            let height = img.height;
            if (width > MAX_DIM || height > MAX_DIM) {
              if (width > height) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              } else {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve({ base64: rawUrl, mimeType: file.type || 'image/jpeg' });
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const compressedUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve({ base64: compressedUrl, mimeType: 'image/jpeg' });
          } catch {
            resolve({ base64: rawUrl, mimeType: file.type || 'image/jpeg' });
          }
        };
        img.src = rawUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleScanFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      notify('Por favor, selecione um arquivo de imagem (foto, print ou comprovante).', 'error');
      return;
    }
    setScanningReceipt(true);
    try {
      const { base64, mimeType } = await compressImageForOcr(file);
      if (!base64) {
        throw new Error('Falha ao processar o arquivo da imagem.');
      }

      const res = await api.scanReceipt(base64, mimeType);

      // Prioriza a conta/banco que o usuário já selecionou no formulário
      let targetAccountId = accountId;
      if (!targetAccountId) {
        const savedDefault = getDefaultAccountId();
        targetAccountId = (savedDefault && accountOptions.some((a) => a.id === savedDefault))
          ? (savedDefault as string)
          : (accountOptions[0]?.id ?? '');
        setAccountId(targetAccountId);
      }

      if (res.currency) {
        setSelectedCurrency(res.currency);
      }

      const scannedList = (res.transactions && res.transactions.length > 0)
        ? res.transactions
        : (res.amount !== undefined && res.amount !== null)
          ? [{
              amount: res.amount,
              currency: res.currency,
              date: res.date || date || todayISO(),
              description: res.description || res.merchant_name || 'Sem descrição',
              merchant_name: res.merchant_name,
              category: res.category,
              transaction_type: res.transaction_type,
              is_expense: res.is_expense !== false,
            }]
          : [];

      const accObj = accountOptions.find((a) => a.id === targetAccountId);
      const accName = accObj
        ? (accObj.institution_name === 'Dinheiro' ? 'Dinheiro' : `${accObj.institution_name} — ${accObj.account_name}`)
        : 'Banco selecionado';

      if (scannedList.length > 1) {
        // MÚLTIPLAS TRANSAÇÕES NA FOTO: abre em Lote com todas as transações vinculadas ao banco
        setActiveTab('BATCH');
        const newBatchItems: BatchItem[] = scannedList.map((t) => ({
          id: Math.random().toString(36).substring(2, 9),
          isExpense: t.is_expense !== false,
          amount: String(Math.abs(Number(t.amount) || 0)),
          description: t.description || t.merchant_name || 'Sem descrição',
          category: t.category || '',
          date: t.date || date || todayISO(),
          accountId: targetAccountId, // Expressamente vinculado ao banco selecionado
        }));
        setBatchItems(newBatchItems);

        notify(`✓ ${scannedList.length} transações identificadas na foto e vinculadas a "${accName}"!`, 'success');
      } else if (scannedList.length === 1) {
        // 1 TRANSAÇÃO: preenche lançamento rápido vinculado ao banco
        const item = scannedList[0];
        if (item.amount !== undefined && item.amount !== null) {
          setAmount(String(Math.abs(Number(item.amount) || 0)));
        }
        if (item.date) {
          setDate(item.date);
        }
        if (item.description || item.merchant_name) {
          setDescription(item.description || item.merchant_name || '');
        }
        if (item.category) {
          setCategory(item.category);
        }
        if (item.transaction_type) {
          setTxType(item.transaction_type);
        }
        if (item.is_expense !== undefined) {
          setIsExpense(item.is_expense);
        }
        setBatchItems((prev) =>
          prev.map((b) => ({ ...b, accountId: b.accountId || targetAccountId })),
        );

        notify(`✓ Comprovante analisado e vinculado a "${accName}"!`, 'success');
      } else {
        notify('Nenhuma transação foi identificada na imagem.', 'error');
      }
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

  const handleSubmit = async (e: React.FormEvent, keepOpen = false) => {
    e.preventDefault();
    const num = parseFloat(amount.replace(',', '.'));
    if (!num || !description.trim() || !date) {
      notify('Preencha o valor e a descrição.', 'error');
      return;
    }

    if (!accountId) {
      notify('Por favor, selecione a conta ou forma de pagamento.', 'error');
      return;
    }

    setSaving(true);
    setSavingAction(keepOpen ? 'next' : 'close');
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
        notify('Transação atualizada com sucesso!', 'success');
      } else {
        await api.createTransaction(payload);
        const newCount = sessionSavedCount + 1;
        setSessionSavedCount(newCount);
        setSessionTotalAmount((prev) => prev + num);
        notify(
          keepOpen
            ? `✓ Lançamento #${newCount} salvo com sucesso! Pronto para o próximo.`
            : 'Transação adicionada com sucesso!',
          'success',
        );
      }

      onCreated();
      window.dispatchEvent(new Event('transactions:changed'));

      if (keepOpen && !transactionToEdit) {
        // Limpa valor e descrição para o próximo lançamento sem fechar
        setAmount('');
        setDescription('');
        setTimeout(() => {
          amountInputRef.current?.focus();
        }, 80);
      } else {
        handleClose();
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao criar transação.', 'error');
    } finally {
      setSaving(false);
      setSavingAction(null);
    }
  };

  // Funções do Modo Em Lote (Batch)
  const addBatchRow = () => {
    setBatchItems((prev) => [...prev, createEmptyBatchItem(accountId)]);
  };

  const removeBatchRow = (id: string) => {
    if (batchItems.length <= 1) return;
    setBatchItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateBatchItem = (id: string, updates: Partial<BatchItem>) => {
    setBatchItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const handleSaveBatch = async () => {
    const validItems = batchItems.filter((item) => {
      const num = parseFloat(item.amount.replace(',', '.'));
      return !isNaN(num) && num > 0 && item.description.trim().length > 0;
    });

    if (validItems.length === 0) {
      notify('Preencha ao menos uma transação com valor e descrição.', 'error');
      return;
    }

    setSaving(true);
    setSavingAction('batch');
    try {
      const payload = validItems.map((item) => {
        const num = parseFloat(item.amount.replace(',', '.'));
        const itemAcc = item.accountId || accountId;
        const baseBrlAmount = num * exchangeRate;
        return {
          date: item.date || date,
          amount: item.isExpense ? -Math.abs(baseBrlAmount) : Math.abs(baseBrlAmount),
          description: item.description.trim(),
          category: item.category || undefined,
          transaction_type: (item.isExpense ? 'DEBIT' : 'CREDIT') as string,
          account_id: itemAcc || undefined,
          original_currency: selectedCurrency,
          original_amount: item.isExpense ? -Math.abs(num) : Math.abs(num),
          exchange_rate: exchangeRate,
        };
      });

      const res = await api.createTransactionsBatch(payload);
      notify(`✓ ${res.count || validItems.length} transações salvas de uma vez com sucesso!`, 'success');
      onCreated();
      window.dispatchEvent(new Event('transactions:changed'));
      handleClose();
    } catch (err: any) {
      notify(err.message || 'Falha ao salvar transações em lote.', 'error');
    } finally {
      setSaving(false);
      setSavingAction(null);
    }
  };

  const validBatchCount = batchItems.filter((item) => {
    const num = parseFloat(item.amount.replace(',', '.'));
    return !isNaN(num) && num > 0 && item.description.trim().length > 0;
  }).length;

  const totalBatchAmount = batchItems.reduce((acc, item) => {
    const num = parseFloat(item.amount.replace(',', '.'));
    if (!isNaN(num) && num > 0 && item.description.trim().length > 0) {
      return acc + (item.isExpense ? -num : num);
    }
    return acc;
  }, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4"
      onPaste={handlePaste}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        className={cn(
          'relative w-full rounded-t-3xl sm:rounded-2xl border border-border bg-bg-card shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden transition-all duration-200',
          activeTab === 'BATCH' ? 'max-w-md sm:max-w-2xl' : 'max-w-md sm:max-w-lg',
        )}
      >
        {/* Header Principal */}
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-bg-elevated/40 select-none">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base text-text-primary tracking-tight">
              {transactionToEdit ? 'Editar Transação' : 'Nova Transação'}
            </h2>
            {sessionSavedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                {sessionSavedCount} salvo{sessionSavedCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-text-muted hover:bg-bg-elevated hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Abas de Modo: Individual vs Em Lote (apenas na criação) */}
        {!transactionToEdit && (
          <div className="flex border-b border-border/80 bg-bg-elevated/60 p-1.5 gap-1.5 select-none">
            <button
              type="button"
              onClick={() => setActiveTab('SINGLE')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                activeTab === 'SINGLE'
                  ? 'bg-bg-card text-accent-gold shadow-sm border border-accent-gold/30'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-card/50',
              )}
            >
              <span>Lançamento Rápido</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-gold/15 text-accent-gold font-normal hidden xs:inline">
                + Salvar e Novo
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('BATCH')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                activeTab === 'BATCH'
                  ? 'bg-bg-card text-accent-gold shadow-sm border border-accent-gold/30'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-card/50',
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Lançamento em Lote</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue font-normal hidden xs:inline">
                Vários de uma vez
              </span>
            </button>
          </div>
        )}

        {/* Banner IA Escanear Foto/Comprovante - acessível para ambos os modos (Individual ou Lote) */}
        {!transactionToEdit && (
          <div className="border-b border-border/60 bg-accent-gold/5 px-4 sm:px-5 py-2.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 text-accent-gold shrink-0 animate-pulse" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">
                  Preenchimento com IA (OCR)
                </p>
                <p className="text-[10px] text-text-secondary truncate">
                  Envie foto de comprovante, extrato com várias compras ou cole (Ctrl+V)
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
              className="text-xs h-7.5 px-2.5 gap-1.5 border-accent-gold/30 hover:border-accent-gold shrink-0 cursor-pointer"
            >
              {scanningReceipt ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-gold" />
                  <span>Lendo foto...</span>
                </>
              ) : (
                <>
                  <Camera className="h-3.5 w-3.5 text-accent-gold" />
                  <span>Escanear Foto</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 1: LANÇAMENTO RÁPIDO (COM SUPORTE A "SALVAR E PRÓXIMO" / MÚLTIPLOS)     */}
        {/* ========================================================================= */}
        {activeTab === 'SINGLE' && (
          <div className="flex-1 overflow-y-auto">

            {/* Banner de Feedback de Sessão Múltipla */}
            {sessionSavedCount > 0 && !transactionToEdit && (
              <div className="mx-5 mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-emerald-400">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span className="truncate">
                    <strong>{sessionSavedCount}</strong> lançamento{sessionSavedCount > 1 ? 's' : ''} salvo{sessionSavedCount > 1 ? 's' : ''}!
                    <span className="text-text-muted ml-1">
                      (Soma: {CURRENCY_SYMBOLS[selectedCurrency]} {sessionTotalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="font-bold underline text-emerald-300 hover:text-white cursor-pointer text-[11px] shrink-0 ml-2"
                >
                  Concluir
                </button>
              </div>
            )}

            <form onSubmit={(e) => void handleSubmit(e, continuousMode)} className="space-y-4 p-5">
              {/* Tipo: Despesa / Receita */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setIsExpense(true); setTxType('DEBIT'); }}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-colors cursor-pointer',
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
                    'flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-colors cursor-pointer',
                    !isExpense
                      ? 'border-accent-green bg-accent-green/10 text-accent-green'
                      : 'border-border bg-bg-elevated text-text-secondary hover:border-accent-green/50',
                  )}
                >
                  <TrendingUp className="h-4 w-4" />
                  Receita
                </button>
              </div>

              {/* Moeda e Valor */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
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

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Valor ({selectedCurrency})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-text-muted">
                      {CURRENCY_SYMBOLS[selectedCurrency]}
                    </span>
                    <input
                      ref={amountInputRef}
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0,00"
                      className="input pl-9 font-mono text-base font-medium"
                    />
                  </div>
                </div>
              </div>

              {selectedCurrency !== 'BRL' && (
                <p className="text-xs text-text-secondary flex flex-col gap-0.5 -mt-2">
                  {loadingRate ? (
                    <span className="text-text-muted">Carregando cotação do dia...</span>
                  ) : (
                    <>
                      <span>Cotação do dia: 1 {selectedCurrency} = {exchangeRate.toFixed(4)} BRL</span>
                      {amount && (
                        <span className="text-accent-gold font-medium">
                          Equivale a R$ {(parseFloat(amount.replace(',', '.')) * exchangeRate || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </>
                  )}
                </p>
              )}

              {/* Descrição */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Descrição
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Mercado, Salário, Farmácia, Combustível…"
                  className="input"
                />
              </div>

              {/* Data */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Data
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input cursor-pointer"
                />
              </div>

              {/* Categoria + Tipo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
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
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
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

              {/* Conta / Forma de Pagamento */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Conta / Forma de Pagamento
                  </label>
                  <div className="flex items-center gap-2">
                    {accountId && !transactionToEdit && (
                      <button
                        type="button"
                        onClick={() => handleToggleDefaultAccount(accountId)}
                        className={cn(
                          'text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-all cursor-pointer',
                          defaultAccountId === accountId
                            ? 'bg-accent-gold/20 text-accent-gold border-accent-gold/50 shadow-xs'
                            : 'bg-bg-elevated/60 text-text-muted border-border hover:text-accent-gold hover:border-accent-gold/40',
                        )}
                        title={
                          defaultAccountId === accountId
                            ? 'Esta é a sua conta padrão para novos lançamentos'
                            : 'Definir esta conta como padrão para novos lançamentos'
                        }
                      >
                        <Star className={cn('h-3 w-3', defaultAccountId === accountId && 'fill-accent-gold text-accent-gold')} />
                        <span>{defaultAccountId === accountId ? 'Conta Padrão' : 'Definir como Padrão'}</span>
                      </button>
                    )}
                    <span className="text-[10px] font-bold text-accent-red">Obrigatório</span>
                  </div>
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
                      {defaultAccountId === a.id ? '⭐ ' : ''}
                      {a.institution_name === 'Dinheiro'
                        ? '💵 Dinheiro (Espécie)'
                        : `${a.institution_name} — ${a.account_name}`}
                      {defaultAccountId === a.id ? ' (Padrão)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Opção: Assinatura / Recorrência Mensal */}
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

              {/* Opção: Modo Múltiplos Lançamentos (Não fechar) */}
              {!transactionToEdit && (
                <div className="flex items-center justify-between rounded-xl border border-border/80 bg-bg-elevated/40 px-3.5 py-2.5 text-xs">
                  <label htmlFor="continuous_mode_cb" className="flex items-center gap-2.5 cursor-pointer select-none text-text-primary font-medium">
                    <input
                      type="checkbox"
                      id="continuous_mode_cb"
                      checked={continuousMode}
                      onChange={(e) => setContinuousMode(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-accent-gold focus:ring-accent-gold cursor-pointer"
                    />
                    <span>Modo múltiplos lançamentos</span>
                  </label>
                  <span className="text-[10px] text-accent-gold/90 bg-accent-gold/10 px-2 py-0.5 rounded-full font-semibold">
                    Mantém aberto após salvar
                  </span>
                </div>
              )}

              {/* Barra de Botões */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="ghost"
                  className="order-3 sm:order-1 sm:flex-1 text-xs cursor-pointer"
                  onClick={handleClose}
                  disabled={saving}
                >
                  {sessionSavedCount > 0 ? 'Concluir' : 'Cancelar'}
                </Button>

                {!transactionToEdit && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="order-2 sm:order-2 sm:flex-1 text-xs gap-1.5 border-accent-gold/40 text-accent-gold hover:bg-accent-gold/15 cursor-pointer"
                    disabled={saving || !amount || !description.trim() || !accountId}
                    onClick={(e) => void handleSubmit(e, true)}
                    title="Salva este lançamento e mantém a janela aberta para o próximo"
                  >
                    {saving && savingAction === 'next' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    <span>Salvar e Próximo</span>
                  </Button>
                )}

                <Button
                  type="submit"
                  className="order-1 sm:order-3 sm:flex-1 text-xs font-bold cursor-pointer"
                  disabled={saving || !amount || !description.trim() || !accountId}
                >
                  {saving && savingAction === 'close' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  <span>{transactionToEdit ? 'Salvar Alterações' : continuousMode ? 'Salvar (+)' : 'Salvar e Fechar'}</span>
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: LANÇAMENTO EM LOTE (TABELA / LISTA COM VÁRIOS DE UMA VEZ)            */}
        {/* ========================================================================= */}
        {activeTab === 'BATCH' && !transactionToEdit && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Cabeçalho de padrões comuns para o lote */}
            <div className="bg-bg-elevated/40 border-b border-border/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary uppercase tracking-wide flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-accent-gold" />
                  Padrões para todos os lançamentos
                </span>
                <span className="text-[11px] text-text-muted">
                  Preencha as linhas abaixo e salve tudo de uma vez
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-text-secondary">
                      Conta Padrão
                    </label>
                    {accountId && (
                      <button
                        type="button"
                        onClick={() => handleToggleDefaultAccount(accountId)}
                        className={cn(
                          'text-[10px] font-semibold flex items-center gap-0.5 transition-colors cursor-pointer',
                          defaultAccountId === accountId
                            ? 'text-accent-gold'
                            : 'text-text-muted hover:text-accent-gold',
                        )}
                        title="Definir esta conta como padrão geral"
                      >
                        <Star className={cn('h-2.5 w-2.5', defaultAccountId === accountId && 'fill-accent-gold')} />
                        <span>{defaultAccountId === accountId ? 'Padrão' : 'Fixar padrão'}</span>
                      </button>
                    )}
                  </div>
                  <select
                    value={accountId}
                    onChange={(e) => {
                      const newAcc = e.target.value;
                      setAccountId(newAcc);
                      setBatchItems((prev) =>
                        prev.map((it) => ({ ...it, accountId: it.accountId || newAcc })),
                      );
                    }}
                    className="input py-1.5 text-xs cursor-pointer"
                  >
                    {accountOptions.map((a: ConnectedAccount) => (
                      <option key={a.id} value={a.id}>
                        {defaultAccountId === a.id ? '⭐ ' : ''}
                        {a.institution_name === 'Dinheiro'
                          ? '💵 Dinheiro (Espécie)'
                          : `${a.institution_name} — ${a.account_name}`}
                        {defaultAccountId === a.id ? ' (Padrão)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                    Data Padrão
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setDate(newDate);
                      setBatchItems((prev) =>
                        prev.map((it) => ({ ...it, date: it.date || newDate })),
                      );
                    }}
                    className="input py-1.5 text-xs cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                    Moeda
                  </label>
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value as Currency)}
                    className="input py-1.5 text-xs cursor-pointer"
                  >
                    <option value="BRL">🇧🇷 Real (BRL)</option>
                    <option value="USD">🇺🇸 Dólar (USD)</option>
                    <option value="EUR">🇪🇺 Euro (EUR)</option>
                    <option value="CLP">🇨🇱 Peso Chileno (CLP)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Lista Dinâmica de Itens */}
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {batchItems.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border/80 bg-bg-elevated/30 p-3 space-y-2.5 transition-all hover:border-accent-gold/40"
                >
                  {/* Topo da linha: Índice, Despesa/Receita e Excluir */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-bg-card border border-border text-[10px] font-mono font-bold text-text-muted">
                        {index + 1}
                      </span>
                      {/* Toggle Rápido Despesa / Receita */}
                      <div className="inline-flex rounded-lg bg-bg-card p-0.5 border border-border/70">
                        <button
                          type="button"
                          onClick={() => updateBatchItem(item.id, { isExpense: true })}
                          className={cn(
                            'px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer',
                            item.isExpense
                              ? 'bg-accent-red/20 text-accent-red font-bold'
                              : 'text-text-muted hover:text-text-secondary',
                          )}
                        >
                          - Despesa
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBatchItem(item.id, { isExpense: false })}
                          className={cn(
                            'px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer',
                            !item.isExpense
                              ? 'bg-accent-green/20 text-accent-green font-bold'
                              : 'text-text-muted hover:text-text-secondary',
                          )}
                        >
                          + Receita
                        </button>
                      </div>
                    </div>

                    {batchItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBatchRow(item.id)}
                        className="rounded-lg p-1 text-text-muted hover:bg-red-500/15 hover:text-red-400 transition-colors cursor-pointer"
                        title="Remover este lançamento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Campos da linha */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    {/* Descrição */}
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateBatchItem(item.id, { description: e.target.value })}
                        placeholder="Descrição (ex: Almoço, Uber)"
                        className="input py-2 text-xs"
                      />
                    </div>

                    {/* Valor */}
                    <div className="sm:col-span-3">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-text-muted">
                          {CURRENCY_SYMBOLS[selectedCurrency]}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.amount}
                          onChange={(e) => updateBatchItem(item.id, { amount: e.target.value })}
                          placeholder="0,00"
                          className="input pl-8 py-2 text-xs font-mono font-medium"
                        />
                      </div>
                    </div>

                    {/* Categoria */}
                    <div className="sm:col-span-4">
                      <select
                        value={item.category}
                        onChange={(e) => updateBatchItem(item.id, { category: e.target.value })}
                        className="input py-2 text-xs cursor-pointer"
                      >
                        <option value="">Sem categoria</option>
                        {categoryNames.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              {/* Botão de Adicionar Mais uma Linha */}
              <button
                type="button"
                onClick={addBatchRow}
                className="w-full py-2.5 rounded-xl border border-dashed border-accent-gold/40 bg-accent-gold/5 hover:bg-accent-gold/10 text-accent-gold text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Adicionar outro lançamento (+ linha)</span>
              </button>
            </div>

            {/* Rodapé e Ação do Modo Em Lote */}
            <div className="border-t border-border/80 bg-bg-card p-4 space-y-3 select-none">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">
                  <strong>{validBatchCount}</strong> de <strong>{batchItems.length}</strong> linhas prontas para salvar
                </span>
                <span className="font-semibold text-text-primary">
                  Balanço do lote:{' '}
                  <span className={cn(totalBatchAmount >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                    {totalBatchAmount >= 0 ? '+' : '-'} {CURRENCY_SYMBOLS[selectedCurrency]}{' '}
                    {Math.abs(totalBatchAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 text-xs cursor-pointer"
                  onClick={handleClose}
                  disabled={saving}
                >
                  Cancelar
                </Button>

                <Button
                  type="button"
                  className="flex-2 text-xs font-bold gap-2 cursor-pointer"
                  disabled={saving || validBatchCount === 0}
                  onClick={() => void handleSaveBatch()}
                >
                  {saving && savingAction === 'batch' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>Salvar Todos ({validBatchCount}) Lançamentos</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ManageCategoriesModal
        open={manageCatOpen}
        onClose={() => setManageCatOpen(false)}
      />
    </div>
  );
}
