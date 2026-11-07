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
  ChevronDown,
  ChevronUp,
  ArrowLeftRight,
  ArrowRight,
  CreditCard,
  Coins,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api, getDefaultAccountId, setDefaultAccountId } from '@/services/api';
import { useCategories } from '@/hooks/useCategories';
import { ManageCategoriesModal } from '@/components/categories/ManageCategoriesModal';
import { cn } from '@/lib/utils';
import { useCurrency, type Currency } from '@/contexts/CurrencyContext';
import type { ConnectedAccount, SubTransaction, Transaction } from '@/types/finance';
import rastroAssets from '@/data/assetsDatabase.json';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  accounts: ConnectedAccount[];
  autoTriggerScan?: boolean;
  transactionToEdit?: Transaction | null;
  preferredAccountId?: string;
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

interface CreditCardSubItem {
  id: string;
  description: string;
  amount: string;
  category: string;
  date: string;
}

const TX_TYPES = ['DEBIT', 'PIX', 'TED', 'BOLETO', 'CREDIT_CARD', 'CREDIT'] as const;

const CURRENCY_SYMBOLS: Record<string, string> = { BRL: 'R$', USD: '$', EUR: '€', GBP: '£', CLP: '$' };

const TRANSFER_CURRENCIES = [
  { value: 'BRL', label: '🇧🇷 BRL (R$)' },
  { value: 'EUR', label: '🇪🇺 EUR (€)' },
  { value: 'USD', label: '🇺🇸 USD ($)' },
  { value: 'GBP', label: '🇬🇧 GBP (£)' },
  { value: 'CLP', label: '🇨🇱 CLP ($)' },
] as const;

function isTransferTransaction(tx?: Transaction | null): boolean {
  if (!tx) return false;
  return (
    tx.transaction_type === 'TRANSFER' ||
    tx.category === 'Transferências' ||
    (tx.pluggy_transaction_id || '').startsWith('transfer_')
  );
}

function isCreditCardTransaction(tx?: Transaction | null): boolean {
  if (!tx) return false;
  return (
    tx.transaction_type === 'CREDIT_CARD' ||
    tx.subcategory === 'CREDIT_CARD_BILL' ||
    (tx.pluggy_transaction_id || '').startsWith('credit_card_') ||
    Boolean(tx.sub_transactions && tx.sub_transactions.length > 0)
  );
}

function isAutoTransferDescription(desc?: string | null): boolean {
  if (!desc) return true;
  return desc.startsWith('Transferência para ') || desc.startsWith('Transferência de ');
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function AddTransactionModal({ open, onClose, onCreated, accounts, autoTriggerScan, transactionToEdit, preferredAccountId }: Props) {
  const { notify } = useToast();
  const { currency, rate: currentContextRate, convert } = useCurrency();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const prevOpenRef = useRef(false);
  const prevEditIdRef = useRef<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<'next' | 'close' | 'batch' | 'transfer' | 'credit_card' | null>(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);

  // Abas de Modo: Individual/Sequencial vs Cartão de Crédito vs Proventos vs Transferência vs Em Lote
  const [activeTab, setActiveTab] = useState<'SINGLE' | 'CREDIT_CARD' | 'DIVIDEND' | 'TRANSFER' | 'BATCH'>('SINGLE');

  // Estados do modo Lançar Provento / Dividendo
  const [divTicker, setDivTicker] = useState('');
  const [divAmount, setDivAmount] = useState('');
  const [divDate, setDivDate] = useState(todayISO);
  const [divType, setDivType] = useState<'DIVIDEND' | 'JCP' | 'FII' | 'OTHER'>('DIVIDEND');
  const [divNotes, setDivNotes] = useState('');
  const [divDepositAccount, setDivDepositAccount] = useState(true); // Se true, credita o saldo da conta selecionada
  const [divSuggestions, setDivSuggestions] = useState<any[]>([]);
  const [showDivSuggestions, setShowDivSuggestions] = useState(false);
  const divSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (divSearchRef.current && !divSearchRef.current.contains(e.target as Node)) {
        setShowDivSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDivTickerChange = (val: string) => {
    const clean = val.toUpperCase();
    setDivTicker(clean);

    if (clean.endsWith('11')) setDivType('FII');

    if (clean.trim().length >= 1) {
      const matches = rastroAssets.filter(
        (a) =>
          a.ticker.toUpperCase().includes(clean.trim()) ||
          a.name.toUpperCase().includes(clean.trim())
      ).slice(0, 8);
      setDivSuggestions(matches);
      setShowDivSuggestions(true);

      const exact = rastroAssets.find((a) => a.ticker.toUpperCase() === clean.trim());
      if (exact) {
        if (exact.type === 'FIIs' || exact.ticker.endsWith('11')) setDivType('FII');
        else if (exact.type === 'Ações') setDivType('DIVIDEND');
      }
    } else {
      setDivSuggestions([]);
      setShowDivSuggestions(false);
    }
  };

  const handleSelectDivSuggestion = (item: (typeof rastroAssets)[0]) => {
    setDivTicker(item.ticker);
    setShowDivSuggestions(false);
    if (item.type === 'FIIs' || item.ticker.endsWith('11')) {
      setDivType('FII');
    } else if (item.type === 'Ações') {
      setDivType('DIVIDEND');
    }
  };

  // Modo Contínuo (Salvar e continuar adicionando)
  const [continuousMode, setContinuousMode] = useState(false);
  const [sessionSavedCount, setSessionSavedCount] = useState(0);
  const [sessionTotalAmount, setSessionTotalAmount] = useState(0);

  // Estados do modo Cartão de Crédito (com Sub-transações)
  const createEmptySubItem = (defDate = todayISO()): CreditCardSubItem => ({
    id: Math.random().toString(36).substring(2, 9),
    description: '',
    amount: '',
    category: '',
    date: defDate,
  });
  const [ccDescription, setCcDescription] = useState('Fatura Cartão de Crédito');
  const [ccTotalAmount, setCcTotalAmount] = useState('');
  const [ccManualTotal, setCcManualTotal] = useState(false);
  const [ccSubItems, setCcSubItems] = useState<CreditCardSubItem[]>(() => [
    createEmptySubItem(),
    createEmptySubItem(),
    createEmptySubItem(),
  ]);

  // Estados do modo Transferência entre Contas
  const [transferSourceAccountId, setTransferSourceAccountId] = useState('');
  const [transferDestAccountId, setTransferDestAccountId] = useState('');
  const [transferSourceCurrency, setTransferSourceCurrency] = useState<string>('BRL');
  const [transferDestCurrency, setTransferDestCurrency] = useState<string>('BRL');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDestAmount, setTransferDestAmount] = useState('');
  const [destAmountManuallyEdited, setDestAmountManuallyEdited] = useState(false);
  const [transferDate, setTransferDate] = useState(todayISO);
  const [transferDescription, setTransferDescription] = useState('');
  const [loadingTransferPair, setLoadingTransferPair] = useState(false);

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
  const [batchDefaultsOpen, setBatchDefaultsOpen] = useState(false);

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
    const activeAccounts = accounts.filter((a: ConnectedAccount) => a.is_active !== false);
    const hasCash = activeAccounts.some(
      (a: ConnectedAccount) =>
        a.institution_name.toLowerCase() === 'dinheiro' ||
        a.account_name.toLowerCase().includes('dinheiro'),
    );

    if (hasCash) return activeAccounts;

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

    return [cashFallback, ...activeAccounts];
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

      if (isTransferTransaction(transactionToEdit)) {
        setActiveTab('TRANSFER');
        setTransferDate(transactionToEdit.date);

        const pluggyId = transactionToEdit.pluggy_transaction_id || '';
        const isOut = pluggyId.startsWith('transfer_out_') || (!pluggyId.startsWith('transfer_in_') && transactionToEdit.amount < 0);
        const txAccId = transactionToEdit.account_id || accountOptions[0]?.id || '';
        const fallbackOtherAcc = accountOptions.find((a) => a.id !== txAccId);
        const txCurr = (
          transactionToEdit.original_currency ||
          accountOptions.find((a) => a.id === txAccId)?.currency ||
          currency ||
          'BRL'
        ).toUpperCase();
        const txAmtStr = Math.abs(transactionToEdit.original_amount ?? transactionToEdit.amount).toString();

        if (isOut) {
          setTransferSourceAccountId(txAccId);
          setTransferSourceCurrency(txCurr);
          setTransferAmount(txAmtStr);
          setTransferDestAccountId(fallbackOtherAcc?.id || '');
          setTransferDestCurrency((fallbackOtherAcc?.currency || txCurr).toUpperCase());
          setTransferDestAmount(txAmtStr);
        } else {
          setTransferDestAccountId(txAccId);
          setTransferDestCurrency(txCurr);
          setTransferDestAmount(txAmtStr);
          setTransferSourceAccountId(fallbackOtherAcc?.id || '');
          setTransferSourceCurrency((fallbackOtherAcc?.currency || txCurr).toUpperCase());
          setTransferAmount(txAmtStr);
        }
        setDestAmountManuallyEdited(true);
        setTransferDescription(isAutoTransferDescription(transactionToEdit.description) ? '' : transactionToEdit.description);

        setLoadingTransferPair(true);
        api
          .getTransferPair(transactionToEdit.id)
          .then(({ sourceTransaction, destinationTransaction }) => {
            if (sourceTransaction) {
              const sAccId = sourceTransaction.account_id || txAccId;
              const sAcc = accountOptions.find((a) => a.id === sAccId);
              const sCurr = (sourceTransaction.original_currency || sAcc?.currency || 'BRL').toUpperCase();
              setTransferSourceAccountId(sAccId);
              setTransferSourceCurrency(sCurr);
              setTransferAmount(Math.abs(sourceTransaction.original_amount ?? sourceTransaction.amount).toString());
              setTransferDate(sourceTransaction.date);
            } else if (destinationTransaction) {
              // Tenta inferir conta de origem pela descrição "Transferência de ..."
              const desc = destinationTransaction.description || '';
              if (desc.startsWith('Transferência de ')) {
                const targetLabel = desc.replace('Transferência de ', '').trim().toLowerCase();
                const matched = accountOptions.find((a) => {
                  const label = a.institution_name === 'Dinheiro' ? 'dinheiro em espécie' : `${a.institution_name} — ${a.account_name}`.toLowerCase();
                  return label === targetLabel || a.institution_name.toLowerCase() === targetLabel || a.account_name.toLowerCase() === targetLabel;
                });
                if (matched) {
                  setTransferSourceAccountId(matched.id);
                  setTransferSourceCurrency((matched.currency || 'BRL').toUpperCase());
                }
              }
            }

            if (destinationTransaction) {
              const dAccId = destinationTransaction.account_id || fallbackOtherAcc?.id || '';
              const dAcc = accountOptions.find((a) => a.id === dAccId);
              const dCurr = (destinationTransaction.original_currency || dAcc?.currency || 'BRL').toUpperCase();
              setTransferDestAccountId(dAccId);
              setTransferDestCurrency(dCurr);
              setTransferDestAmount(Math.abs(destinationTransaction.original_amount ?? destinationTransaction.amount).toString());
            } else if (sourceTransaction) {
              // Tenta inferir conta de destino pela descrição "Transferência para ..."
              const desc = sourceTransaction.description || '';
              if (desc.startsWith('Transferência para ')) {
                const targetLabel = desc.replace('Transferência para ', '').trim().toLowerCase();
                const matched = accountOptions.find((a) => {
                  const label = a.institution_name === 'Dinheiro' ? 'dinheiro em espécie' : `${a.institution_name} — ${a.account_name}`.toLowerCase();
                  return label === targetLabel || a.institution_name.toLowerCase() === targetLabel || a.account_name.toLowerCase() === targetLabel;
                });
                if (matched) {
                  setTransferDestAccountId(matched.id);
                  setTransferDestCurrency((matched.currency || 'BRL').toUpperCase());
                }
              }
            }

            const customDesc =
              sourceTransaction && !isAutoTransferDescription(sourceTransaction.description)
                ? sourceTransaction.description
                : destinationTransaction && !isAutoTransferDescription(destinationTransaction.description)
                  ? destinationTransaction.description
                  : '';
            setTransferDescription(customDesc);
          })
          .catch(() => {})
          .finally(() => {
            setLoadingTransferPair(false);
          });
      } else if (isCreditCardTransaction(transactionToEdit)) {
        setActiveTab('CREDIT_CARD');
        setCcDescription(transactionToEdit.description || 'Fatura Cartão de Crédito');
        const txAbs = Math.abs(transactionToEdit.original_amount ?? transactionToEdit.amount);
        const existingSubs = transactionToEdit.sub_transactions ?? [];
        if (existingSubs.length > 0) {
          setCcSubItems(
            existingSubs.map((st) => ({
              id: st.id || Math.random().toString(36).substring(2, 9),
              description: st.description || '',
              amount: String(Math.abs(Number(st.amount) || 0)),
              category: st.category || '',
              date: st.date || transactionToEdit.date || todayISO(),
            })),
          );
          const subSum = existingSubs.reduce((acc, st) => acc + Math.abs(Number(st.amount) || 0), 0);
          const hasCustomTotal = Math.abs(txAbs - subSum) > 0.01;
          setCcManualTotal(hasCustomTotal);
          setCcTotalAmount(txAbs.toString());
        } else {
          setCcSubItems([
            createEmptySubItem(transactionToEdit.date || todayISO()),
            createEmptySubItem(transactionToEdit.date || todayISO()),
          ]);
          setCcManualTotal(true);
          setCcTotalAmount(txAbs.toString());
        }
      } else {
        setActiveTab('SINGLE');
      }
    } else {
      setSelectedCurrency(currency);
      setIsRecurring(false);
      // Prioriza a aba do banco ativa (preferredAccountId), depois a conta marcada como padrão pelo usuário
      const hasPreferred = preferredAccountId && accountOptions.some((a) => a.id === preferredAccountId);
      const savedDefault = getDefaultAccountId();
      const hasSavedDefault = savedDefault && accountOptions.some((a) => a.id === savedDefault);
      const cashAcc = accountOptions.find(
        (a: ConnectedAccount) =>
          a.institution_name.toLowerCase() === 'dinheiro' ||
          a.account_name.toLowerCase().includes('dinheiro'),
      );
      const defAccId = hasPreferred
        ? (preferredAccountId as string)
        : hasSavedDefault
          ? (savedDefault as string)
          : cashAcc
            ? cashAcc.id
            : (accountOptions[0]?.id ?? '');

      setAccountId(defAccId);
      setDefaultAccountIdState(savedDefault);

      setCcDescription('Fatura Cartão de Crédito');
      setCcTotalAmount('');
      setCcManualTotal(false);
      setCcSubItems([
        createEmptySubItem(todayISO()),
        createEmptySubItem(todayISO()),
        createEmptySubItem(todayISO()),
      ]);

      const srcAcc = accountOptions.find((a) => a.id === defAccId);
      if (hasPreferred && srcAcc?.currency) {
        setSelectedCurrency((srcAcc.currency.toUpperCase() as Currency) || currency);
      }
      const otherAcc = accountOptions.find((a) => a.id !== defAccId);
      const srcCurr = (srcAcc?.currency || currency || 'BRL').toUpperCase();
      const destCurr = (otherAcc?.currency || srcCurr).toUpperCase();

      setTransferSourceAccountId(defAccId);
      setTransferDestAccountId(otherAcc?.id || '');
      setTransferSourceCurrency(srcCurr);
      setTransferDestCurrency(destCurr);
      setTransferAmount('');
      setTransferDestAmount('');
      setDestAmountManuallyEdited(false);
      setTransferDate(todayISO());
      setTransferDescription('');
      setDivTicker('');
      setDivAmount('');
      setDivDate(todayISO());
      setDivType('DIVIDEND');
      setDivNotes('');
      setDivDepositAccount(true);

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
  }, [open, currency, autoTriggerScan, transactionToEdit, accountOptions, preferredAccountId]);

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
      if (isTransferTransaction(transactionToEdit)) {
        setActiveTab('TRANSFER');
      } else if (isCreditCardTransaction(transactionToEdit)) {
        setActiveTab('CREDIT_CARD');
      }
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
      setTransferAmount('');
      setTransferDestAmount('');
      setDestAmountManuallyEdited(false);
      setDivTicker('');
      setDivAmount('');
      setDivDate(todayISO());
      setDivType('DIVIDEND');
      setDivNotes('');
      setDivDepositAccount(true);
      setCcDescription('Fatura Cartão de Crédito');
      setCcTotalAmount('');
      setCcManualTotal(false);
      setCcSubItems([
        createEmptySubItem(todayISO()),
        createEmptySubItem(todayISO()),
        createEmptySubItem(todayISO()),
      ]);
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

      if (activeTab === 'CREDIT_CARD' && scannedList.length >= 1) {
        const newSubItems: CreditCardSubItem[] = scannedList.map((t) => ({
          id: Math.random().toString(36).substring(2, 9),
          description: t.description || t.merchant_name || 'Compra no Cartão',
          amount: String(Math.abs(Number(t.amount) || 0)),
          category: t.category || '',
          date: t.date || date || todayISO(),
        }));
        setCcSubItems((prev) => {
          const filled = prev.filter(
            (it) => it.description.trim().length > 0 || (parseFloat(it.amount.replace(',', '.')) || 0) > 0,
          );
          return [...filled, ...newSubItems];
        });
        setCcManualTotal(false);
        notify(
          `✓ ${scannedList.length} sub-transaç${scannedList.length === 1 ? 'ão adicionada' : 'ões adicionadas'} na fatura do Cartão de Crédito!`,
          'success',
        );
      } else if (scannedList.length > 1) {
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

  // Funções do Modo Cartão de Crédito (com Sub-transações)
  const addCcSubRow = () => {
    setCcSubItems((prev) => [...prev, createEmptySubItem(date || todayISO())]);
  };

  const removeCcSubRow = (id: string) => {
    if (ccSubItems.length <= 1) {
      setCcSubItems([createEmptySubItem(date || todayISO())]);
      return;
    }
    setCcSubItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateCcSubItem = (id: string, updates: Partial<CreditCardSubItem>) => {
    setCcSubItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const handleSubmitCreditCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      notify('Por favor, selecione a conta usada para pagar o cartão de crédito.', 'error');
      return;
    }

    const validSubItems = ccSubItems.filter((item) => {
      const num = parseFloat(item.amount.replace(',', '.'));
      return (!isNaN(num) && num > 0) || item.description.trim().length > 0;
    });

    for (const item of validSubItems) {
      const num = parseFloat(item.amount.replace(',', '.'));
      if (isNaN(num) || num <= 0) {
        notify(`Informe um valor maior que zero para a sub-transação "${item.description || 'sem descrição'}".`, 'error');
        return;
      }
    }

    const subItemsSum = validSubItems.reduce((acc, item) => {
      const num = parseFloat(item.amount.replace(',', '.'));
      return acc + (isNaN(num) ? 0 : Math.abs(num));
    }, 0);

    const parsedManualTotal = parseFloat(ccTotalAmount.replace(',', '.')) || 0;
    const finalTotal =
      ccManualTotal && parsedManualTotal > 0
        ? parsedManualTotal
        : subItemsSum > 0
          ? subItemsSum
          : parsedManualTotal;

    if (!finalTotal || finalTotal <= 0) {
      notify(
        'Adicione pelo menos uma sub-transação com valor ou informe o valor total da fatura do cartão.',
        'error',
      );
      return;
    }

    setSaving(true);
    setSavingAction('credit_card');
    try {
      const subTransactionsPayload: SubTransaction[] = validSubItems.map((it) => ({
        id: it.id,
        description: it.description.trim() || it.category || 'Compra no Cartão',
        amount: Math.abs(parseFloat(it.amount.replace(',', '.')) || 0),
        category: it.category || undefined,
        date: it.date || date,
      }));

      const baseBrlAmount = finalTotal * exchangeRate;
      const billTitle = ccDescription.trim() || 'Fatura Cartão de Crédito';

      const payload = {
        date,
        amount: -Math.abs(baseBrlAmount),
        description: billTitle,
        category: category || 'Cartão de Crédito',
        subcategory: 'CREDIT_CARD_BILL',
        transaction_type: 'CREDIT_CARD' as import('@/types/finance').TransactionType,
        account_id: accountId,
        is_recurring: isRecurring,
        original_currency: selectedCurrency,
        original_amount: -Math.abs(finalTotal),
        exchange_rate: exchangeRate,
        sub_transactions: subTransactionsPayload,
      };

      if (transactionToEdit) {
        await api.updateTransaction(transactionToEdit.id, payload);
        notify(
          `✓ Cartão de Crédito atualizado (${subTransactionsPayload.length} sub-transaç${subTransactionsPayload.length === 1 ? 'ão' : 'ões'})!`,
          'success',
        );
      } else {
        await api.createTransaction(payload);
        notify(
          `✓ Pagamento de Cartão de Crédito salvo com ${subTransactionsPayload.length} sub-transaç${subTransactionsPayload.length === 1 ? 'ão' : 'ões'}!`,
          'success',
        );
      }

      onCreated();
      window.dispatchEvent(new Event('transactions:changed'));
      handleClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao salvar transação de cartão de crédito.', 'error');
    } finally {
      setSaving(false);
      setSavingAction(null);
    }
  };

  // Funções do Modo Transferência entre Contas
  const handleSelectTransferSourceAccount = (newSrcId: string) => {
    setTransferSourceAccountId(newSrcId);
    const acc = accountOptions.find((a) => a.id === newSrcId);
    if (acc?.currency) {
      const nextCurr = acc.currency.toUpperCase();
      setTransferSourceCurrency(nextCurr);
      if (nextCurr === transferDestCurrency && !destAmountManuallyEdited && transferAmount) {
        setTransferDestAmount(transferAmount);
      }
    }
  };

  const handleSelectTransferDestAccount = (newDestId: string) => {
    setTransferDestAccountId(newDestId);
    const acc = accountOptions.find((a) => a.id === newDestId);
    if (acc?.currency) {
      const nextCurr = acc.currency.toUpperCase();
      setTransferDestCurrency(nextCurr);
      if (nextCurr === transferSourceCurrency && !destAmountManuallyEdited && transferAmount) {
        setTransferDestAmount(transferAmount);
      }
    }
  };

  const handleInvertTransferAccounts = () => {
    const prevSrcAcc = transferSourceAccountId;
    const prevDestAcc = transferDestAccountId;
    const prevSrcCurr = transferSourceCurrency;
    const prevDestCurr = transferDestCurrency;
    const prevSrcAmt = transferAmount;
    const prevDestAmt = transferDestAmount;

    setTransferSourceAccountId(prevDestAcc);
    setTransferDestAccountId(prevSrcAcc);
    setTransferSourceCurrency(prevDestCurr);
    setTransferDestCurrency(prevSrcCurr);
    if (prevDestAmt) {
      setTransferAmount(prevDestAmt);
      setTransferDestAmount(prevSrcAmt);
    }
  };

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const numSent = parseFloat(transferAmount.replace(',', '.'));
    if (!numSent || numSent <= 0) {
      notify('Por favor, informe um valor enviado maior que zero.', 'error');
      return;
    }

    const isDiffCurrency = transferSourceCurrency.toUpperCase() !== transferDestCurrency.toUpperCase();
    const rawDest = transferDestAmount.trim() ? parseFloat(transferDestAmount.replace(',', '.')) : (isDiffCurrency ? 0 : numSent);

    if (!rawDest || rawDest <= 0) {
      notify(
        isDiffCurrency
          ? `Por favor, informe o valor recebido em ${transferDestCurrency} (já descontando as taxas).`
          : 'Por favor, informe um valor recebido maior que zero.',
        'error',
      );
      return;
    }

    if (!transferSourceAccountId || !transferDestAccountId) {
      notify('Selecione a conta de origem e a conta de destino.', 'error');
      return;
    }
    if (transferSourceAccountId === transferDestAccountId) {
      notify('A conta de origem e destino não podem ser a mesma.', 'error');
      return;
    }

    setSaving(true);
    setSavingAction('transfer');
    try {
      const srcAcc = accountOptions.find((a) => a.id === transferSourceAccountId);
      const destAcc = accountOptions.find((a) => a.id === transferDestAccountId);
      const srcCurr = (transferSourceCurrency || srcAcc?.currency || 'BRL').toUpperCase();
      const destCurr = (transferDestCurrency || destAcc?.currency || srcCurr).toUpperCase();

      const payload = {
        sourceAccountId: transferSourceAccountId,
        destinationAccountId: transferDestAccountId,
        amount: numSent,
        date: transferDate,
        description: transferDescription.trim() || undefined,
        currency: srcCurr,
        destinationAmount: rawDest,
        destinationCurrency: destCurr,
      };

      const srcName = srcAcc?.institution_name === 'Dinheiro' ? 'Dinheiro' : (srcAcc?.account_name || 'Conta de Origem');
      const destName = destAcc?.institution_name === 'Dinheiro' ? 'Dinheiro' : (destAcc?.account_name || 'Conta de Destino');
      const symSent = CURRENCY_SYMBOLS[srcCurr] || srcCurr;
      const symDest = CURRENCY_SYMBOLS[destCurr] || destCurr;

      if (transactionToEdit) {
        await api.updateTransfer(transactionToEdit.id, payload);
        notify(
          `✓ Transferência atualizada: ${symSent} ${numSent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${srcName}) → ${symDest} ${rawDest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${destName})!`,
          'success',
        );
      } else {
        await api.createTransfer(payload);
        notify(
          srcCurr !== destCurr || numSent !== rawDest
            ? `✓ Transferência de ${symSent} ${numSent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de "${srcName}" → ${symDest} ${rawDest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em "${destName}" realizada com sucesso!`
            : `✓ Transferência de ${symSent} ${numSent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de "${srcName}" para "${destName}" realizada com sucesso!`,
          'success',
        );
      }

      onCreated();
      window.dispatchEvent(new Event('transactions:changed'));
      handleClose();
    } catch (err: any) {
      notify(err.message || 'Falha ao salvar transferência.', 'error');
    } finally {
      setSaving(false);
      setSavingAction(null);
    }
  };

  // Funções do Modo Lançar Provento / Dividendo
  const handleSubmitDividend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTicker = divTicker.trim().toUpperCase();
    if (!cleanTicker) {
      notify('Por favor, informe o ticker ou código do ativo.', 'error');
      return;
    }
    const val = parseFloat(divAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      notify('Informe um valor de provento maior que zero.', 'error');
      return;
    }

    setSaving(true);
    setSavingAction('close');
    try {
      const selectedAcc = accountOptions.find((a) => a.id === accountId);
      const instName = selectedAcc?.institution_name || 'B3 / Corretora';

      // 1. Cadastra o dividendo no backend de Investimentos -> reflete na aba de Proventos na hora!
      await api.createDividend({
        ticker: cleanTicker,
        institution: instName,
        date: divDate,
        type: divType,
        amount: val,
        notes: divNotes.trim() || undefined,
      });

      // 2. Se a opção de creditar na conta estiver ativa, cria também a transação de RECEITA na conta do usuário
      if (divDepositAccount && accountId) {
        let provLabel = 'Dividendo';
        if (divType === 'JCP') provLabel = 'JCP';
        else if (divType === 'FII' || cleanTicker.endsWith('11')) provLabel = 'Rendimento FII';

        await api.createTransaction({
          date: divDate,
          amount: Math.abs(val),
          description: `Provento: ${provLabel} ${cleanTicker}`,
          category: 'Investimentos / Proventos',
          transaction_type: 'CREDIT',
          account_id: accountId,
          original_currency: 'BRL',
          original_amount: Math.abs(val),
          exchange_rate: 1,
        });
      }

      notify(`✓ Provento de R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para ${cleanTicker} lançado com sucesso!`, 'success');
      onCreated();
      window.dispatchEvent(new Event('transactions:changed'));
      window.dispatchEvent(new Event('dividends:changed'));
      window.dispatchEvent(new Event('investments-updated'));
      handleClose();
    } catch (err: any) {
      notify(err?.message || 'Falha ao lançar provento.', 'error');
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
          activeTab === 'BATCH' || activeTab === 'CREDIT_CARD'
            ? 'max-w-md sm:max-w-2xl'
            : 'max-w-md sm:max-w-lg',
        )}
      >
        {/* Header Principal */}
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-bg-elevated/40 select-none">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base text-text-primary tracking-tight">
              {transactionToEdit
                ? activeTab === 'TRANSFER'
                  ? 'Editar Transferência entre Contas'
                  : activeTab === 'CREDIT_CARD'
                    ? 'Editar Cartão de Crédito e Sub-transações'
                    : 'Editar Transação'
                : 'Nova Transação'}
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

        {/* Abas de Modo: Individual vs Cartão de Crédito vs Transferência vs Em Lote */}
        <div className="flex border-b border-border/80 bg-bg-elevated/60 p-1.5 gap-1.5 select-none overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('SINGLE')}
            className={cn(
              'flex-1 min-w-[85px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer',
              activeTab === 'SINGLE'
                ? 'bg-bg-card text-accent-gold shadow-sm border border-accent-gold/30'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-card/50',
            )}
          >
            <span>Lançamento</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CREDIT_CARD')}
            className={cn(
              'flex-1 min-w-[125px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer',
              activeTab === 'CREDIT_CARD'
                ? 'bg-bg-card text-accent-gold shadow-sm border border-accent-gold/30'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-card/50',
            )}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Cartão de Crédito</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DIVIDEND')}
            className={cn(
              'flex-1 min-w-[95px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer',
              activeTab === 'DIVIDEND'
                ? 'bg-bg-card text-accent-gold shadow-sm border border-accent-gold/30'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-card/50',
            )}
          >
            <Coins className="h-3.5 w-3.5 text-amber-500" />
            <span>Proventos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TRANSFER')}
            className={cn(
              'flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer',
              activeTab === 'TRANSFER'
                ? 'bg-bg-card text-accent-gold shadow-sm border border-accent-gold/30'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-card/50',
            )}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Transferência</span>
          </button>

          {!transactionToEdit && (
            <button
              type="button"
              onClick={() => setActiveTab('BATCH')}
              className={cn(
                'flex-1 min-w-[85px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                activeTab === 'BATCH'
                  ? 'bg-bg-card text-accent-gold shadow-sm border border-accent-gold/30'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-card/50',
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Em Lote</span>
            </button>
          )}
        </div>

        {/* Banner IA Escanear Foto/Comprovante - acessível para Lançamento Rápido, Cartão de Crédito e Em Lote */}
        {(!transactionToEdit || activeTab === 'CREDIT_CARD') && activeTab !== 'TRANSFER' && activeTab !== 'DIVIDEND' && (
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
                    onChange={(e) => {
                      const val = e.target.value;
                      setTxType(val);
                      if (val === 'CREDIT_CARD') {
                        if (description.trim()) setCcDescription(description.trim());
                        if (amount.trim()) {
                          setCcTotalAmount(amount);
                          setCcManualTotal(true);
                        }
                        setActiveTab('CREDIT_CARD');
                      }
                    }}
                    className="input cursor-pointer"
                  >
                    {TX_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t === 'CREDIT_CARD' ? 'CARTÃO DE CRÉDITO (c/ sub-transações)' : t}
                      </option>
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
        {/* ABA CARTÃO DE CRÉDITO (COM SUB-TRANSAÇÕES DENTRO DA TRANSAÇÃO DO CARTÃO)    */}
        {/* ========================================================================= */}
        {activeTab === 'CREDIT_CARD' && (() => {
          const validSubItems = ccSubItems.filter((item) => {
            const num = parseFloat(item.amount.replace(',', '.'));
            return (!isNaN(num) && num > 0) || item.description.trim().length > 0;
          });
          const subItemsSum = ccSubItems.reduce((acc, item) => {
            const num = parseFloat(item.amount.replace(',', '.'));
            return acc + (isNaN(num) || num <= 0 ? 0 : num);
          }, 0);
          const parsedManualTotal = parseFloat(ccTotalAmount.replace(',', '.')) || 0;
          const displayTotal =
            ccManualTotal && parsedManualTotal > 0
              ? parsedManualTotal
              : subItemsSum > 0
                ? subItemsSum
                : parsedManualTotal;
          const sym = CURRENCY_SYMBOLS[selectedCurrency] || selectedCurrency;

          return (
            <form
              onSubmit={handleSubmitCreditCard}
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              {/* Cabeçalho da Fatura / Pagamento do Cartão */}
              <div className="border-b border-border/80 bg-bg-elevated/40 p-4 space-y-3 shrink-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-text-primary">
                        Pagamento de Cartão de Crédito
                      </p>
                      <p className="text-[10px] text-text-secondary">
                        Lance a fatura e adicione as compras individuais como sub-transações dentro do cartão
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 text-[10px] font-bold text-purple-300">
                    {validSubItems.length} sub-transaç{validSubItems.length === 1 ? 'ão' : 'ões'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  {/* Nome / Identificação do Cartão */}
                  <div className="sm:col-span-5">
                    <label className="mb-1 block text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                      Identificação do Cartão / Fatura
                    </label>
                    <input
                      type="text"
                      required
                      value={ccDescription}
                      onChange={(e) => setCcDescription(e.target.value)}
                      placeholder="Ex: Fatura Cartão Nubank, Cartão Inter..."
                      className="input py-1.5 text-xs"
                    />
                  </div>

                  {/* Conta de onde sai o pagamento */}
                  <div className="sm:col-span-4">
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                        Pagar com a Conta
                      </label>
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const selAcc = accountOptions.find((a) => a.id === accountId);
                          if (!selAcc) return null;
                          const accCurr = (selAcc.currency || 'BRL').toUpperCase();
                          const accSym = CURRENCY_SYMBOLS[accCurr] || accCurr;
                          return (
                            <span className="text-[10px] font-mono text-text-muted">
                              Saldo: {accSym} {Number(selAcc.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          );
                        })()}
                        {accountId && !transactionToEdit && (
                          <button
                            type="button"
                            onClick={() => handleToggleDefaultAccount(accountId)}
                            className={cn(
                              'text-[10px] font-semibold flex items-center gap-0.5 transition-colors cursor-pointer',
                              defaultAccountId === accountId
                                ? 'text-accent-gold'
                                : 'text-text-muted hover:text-accent-gold',
                            )}
                            title="Definir como conta padrão"
                          >
                            <Star className={cn('h-2.5 w-2.5', defaultAccountId === accountId && 'fill-accent-gold')} />
                            <span>{defaultAccountId === accountId ? 'Padrão' : 'Fixar'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <select
                      required
                      value={accountId}
                      onChange={(e) => {
                        const nextAccId = e.target.value;
                        setAccountId(nextAccId);
                        const nextAcc = accountOptions.find((a) => a.id === nextAccId);
                        if (nextAcc?.currency && !transactionToEdit) {
                          setSelectedCurrency((nextAcc.currency.toUpperCase() as Currency) || currency);
                        }
                      }}
                      className="input py-1.5 text-xs cursor-pointer"
                    >
                      <option value="" disabled>Selecione a conta...</option>
                      {accountOptions.map((a: ConnectedAccount) => {
                        const accCurr = (a.currency || 'BRL').toUpperCase();
                        const accSym = CURRENCY_SYMBOLS[accCurr] || accCurr;
                        const balFmt = Number(a.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                        return (
                          <option key={a.id} value={a.id}>
                            {defaultAccountId === a.id ? '⭐ ' : ''}
                            {a.institution_name === 'Dinheiro'
                              ? `💵 Dinheiro (Espécie) — ${accSym} ${balFmt}`
                              : `${a.institution_name} — ${a.account_name} (${accSym} ${balFmt})`}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Data do Pagamento */}
                  <div className="sm:col-span-3">
                    <label className="mb-1 block text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                      Data do Pagamento
                    </label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="input py-1.5 text-xs cursor-pointer"
                    />
                  </div>
                </div>

                {/* Linha 2: Moeda + Valor Total da Fatura (Automático pelas Sub-transações ou Manual) */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-0.5">
                  <div className="sm:col-span-3">
                    <label className="mb-1 block text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                      Moeda da Fatura
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

                  <div className="sm:col-span-9">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                        Valor Total a Pagar ({selectedCurrency})
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (ccManualTotal) {
                            setCcManualTotal(false);
                            setCcTotalAmount('');
                          } else {
                            setCcManualTotal(true);
                            setCcTotalAmount(subItemsSum > 0 ? subItemsSum.toFixed(2) : '');
                          }
                        }}
                        className="text-[10px] font-semibold text-accent-gold hover:underline cursor-pointer"
                      >
                        {ccManualTotal
                          ? `Usar soma automática das sub-transações (${sym} ${subItemsSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
                          : 'Informar valor total diferente (taxas/IOF/outros)'}
                      </button>
                    </div>

                    {ccManualTotal ? (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-text-muted">
                          {sym}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={ccTotalAmount}
                          onChange={(e) => setCcTotalAmount(e.target.value)}
                          placeholder="Valor total da fatura"
                          className="input pl-9 py-1.5 text-sm font-mono font-bold"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-xl border border-purple-500/30 bg-bg-card px-3 py-1.5">
                        <span className="text-xs text-text-secondary">
                          Soma das sub-transações lançadas abaixo:
                        </span>
                        <span className="font-mono text-sm font-bold text-accent-red">
                          {sym} {subItemsSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Lista de Sub-transações dentro do Cartão de Crédito */}
              <div className="p-4 space-y-2.5 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Sub-transações dentro do Cartão ({ccSubItems.length})
                  </p>
                  <button
                    type="button"
                    onClick={() => setManageCatOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-accent-gold/30 bg-accent-gold/10 px-2 py-1 text-[10px] font-semibold text-accent-gold hover:bg-accent-gold hover:text-black transition-colors cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Gerenciar Categorias</span>
                  </button>
                </div>

                {ccSubItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border/80 bg-bg-elevated/30 p-2.5 space-y-2 transition-all hover:border-purple-500/40"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      {/* Número + Descrição da compra no cartão */}
                      <div className="sm:col-span-4 flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/15 border border-purple-500/30 text-[10px] font-mono font-bold text-purple-300">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateCcSubItem(item.id, { description: e.target.value })}
                          placeholder="Compra (ex: Mercado, Uber, Netflix)"
                          className="input py-1.5 text-xs flex-1 min-w-0"
                        />
                      </div>

                      {/* Valor da sub-transação */}
                      <div className="sm:col-span-3">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-text-muted">
                            {sym}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={item.amount}
                            onChange={(e) => updateCcSubItem(item.id, { amount: e.target.value })}
                            placeholder="0,00"
                            className="input pl-8 py-1.5 text-xs font-mono font-semibold"
                          />
                        </div>
                      </div>

                      {/* Categoria da sub-transação */}
                      <div className="sm:col-span-3">
                        <select
                          value={item.category}
                          onChange={(e) => updateCcSubItem(item.id, { category: e.target.value })}
                          className="input py-1.5 text-xs cursor-pointer"
                        >
                          <option value="">Categoria da compra...</option>
                          {categoryNames.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Data da compra + Botão Remover */}
                      <div className="sm:col-span-2 flex items-center gap-1">
                        <input
                          type="date"
                          value={item.date}
                          onChange={(e) => updateCcSubItem(item.id, { date: e.target.value })}
                          className="input py-1.5 px-2 text-[11px] cursor-pointer flex-1 min-w-0"
                          title="Data da compra no cartão"
                        />
                        <button
                          type="button"
                          onClick={() => removeCcSubRow(item.id)}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-red-500/15 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                          title="Remover sub-transação"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Botão para adicionar nova sub-transação */}
                <button
                  type="button"
                  onClick={addCcSubRow}
                  className="w-full py-2.5 rounded-xl border border-dashed border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10 text-purple-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Adicionar sub-transação dentro do cartão (+ compra)</span>
                </button>
              </div>

              {/* Rodapé do modo Cartão de Crédito */}
              <div className="border-t border-border/80 bg-bg-card p-4 space-y-3 shrink-0 select-none">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-text-muted">
                    <strong>{validSubItems.length}</strong> sub-transaç{validSubItems.length === 1 ? 'ão lançada' : 'ões lançadas'} dentro do cartão
                  </span>
                  <div className="flex items-center gap-3">
                    {ccManualTotal && subItemsSum > 0 && Math.abs(displayTotal - subItemsSum) > 0.01 && (
                      <span className="text-[11px] text-text-secondary">
                        Sub-transações: {sym} {subItemsSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <span className="font-semibold text-text-primary">
                      Total do Cartão:{' '}
                      <span className="font-mono font-bold text-accent-red">
                        - {sym} {displayTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </span>
                  </div>
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
                    type="submit"
                    className="flex-2 text-xs font-bold gap-2 cursor-pointer"
                    disabled={saving || displayTotal <= 0 || !accountId}
                  >
                    {saving && savingAction === 'credit_card' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    <span>
                      {transactionToEdit
                        ? 'Salvar Alterações do Cartão'
                        : `Salvar Pagamento do Cartão (${validSubItems.length} sub-transaç${validSubItems.length === 1 ? 'ão' : 'ões'})`}
                    </span>
                  </Button>
                </div>
              </div>
            </form>
          );
        })()}

        {/* ========================================================================= */}
        {/* ABA PROVENTOS / DIVIDENDOS (ATUALIZA INVESTIMENTOS & TRANSAÇÕES NA HORA)  */}
        {/* ========================================================================= */}
        {activeTab === 'DIVIDEND' && (
          <form onSubmit={handleSubmitDividend} className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <Coins className="h-4 w-4" />
              </span>
              <div className="text-xs space-y-1">
                <p className="font-bold text-amber-300">
                  Lançamento de Dividendos / Proventos
                </p>
                <p className="text-text-secondary leading-relaxed">
                  Lançar aqui atualiza na hora a aba <strong>Proventos</strong> dos seus <strong>Investimentos</strong> e, opcionalmente, credita o saldo da sua conta bancária.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="relative" ref={divSearchRef}>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Código / Ticker do Ativo *
                </label>
                <input
                  type="text"
                  required
                  value={divTicker}
                  onChange={(e) => handleDivTickerChange(e.target.value)}
                  onFocus={() => {
                    if (divSuggestions.length > 0) setShowDivSuggestions(true);
                  }}
                  placeholder="Ex: PETR4, MXRF11, MAXR11..."
                  className="input font-mono font-bold text-accent-gold uppercase"
                />

                {showDivSuggestions && divSuggestions.length > 0 && (
                  <div
                    onMouseDown={(e) => e.preventDefault()}
                    className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-bg-card p-1.5 shadow-2xl z-50 animate-fade-in space-y-1"
                  >
                    {divSuggestions.map((item) => (
                      <button
                        key={item.ticker}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectDivSuggestion(item);
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          handleSelectDivSuggestion(item);
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
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Tipo de Provento *
                </label>
                <select
                  value={divType}
                  onChange={(e) => setDivType(e.target.value as any)}
                  className="input cursor-pointer"
                >
                  <option value="DIVIDEND">Dividendo</option>
                  <option value="JCP">JCP (Juros s/ Capital)</option>
                  <option value="FII">Rendimento FII</option>
                  <option value="OTHER">Outro Provento</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Valor Recebido (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-accent-gold">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={divAmount}
                    onChange={(e) => setDivAmount(e.target.value)}
                    placeholder="0,00"
                    className="input pl-9 font-mono text-base font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Data do Recebimento *
                </label>
                <input
                  type="date"
                  required
                  value={divDate}
                  onChange={(e) => setDivDate(e.target.value)}
                  className="input cursor-pointer"
                />
              </div>
            </div>

            {/* Conta onde caiu o dinheiro */}
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Conta que recebeu o provento
                </label>
                {accountId && (
                  <span className="text-[11px] font-mono text-emerald-400">
                    Saldo atual:{' '}
                    {(() => {
                      const acc = accountOptions.find((a) => a.id === accountId);
                      if (!acc) return '-';
                      return `${CURRENCY_SYMBOLS[acc.currency?.toUpperCase() || 'BRL'] || ''} ${(acc.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                    })()}
                  </span>
                )}
              </div>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="input cursor-pointer"
              >
                {accountOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.institution_name === 'Dinheiro' ? 'Dinheiro (Espécie)' : a.account_name}
                    {a.currency && a.currency !== 'BRL' ? ` (${a.currency.toUpperCase()})` : ''}
                    {' — Saldo: '}
                    {CURRENCY_SYMBOLS[a.currency?.toUpperCase() || 'BRL'] || ''}{' '}
                    {(a.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </option>
                ))}
              </select>

              <label className="mt-2.5 flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={divDepositAccount}
                  onChange={(e) => setDivDepositAccount(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-accent-gold focus:ring-accent-gold cursor-pointer"
                />
                <span>Creditar valor no saldo desta conta (cria entrada de provento nas transações)</span>
              </label>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Observações (opcional)
              </label>
              <input
                type="text"
                value={divNotes}
                onChange={(e) => setDivNotes(e.target.value)}
                placeholder="Ex: Pagamento referente ao exercício..."
                className="input text-xs"
              />
            </div>

            {/* Barra de Ações */}
            <div className="flex gap-2 pt-3 border-t border-border/80 mt-auto">
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
                type="submit"
                className="flex-2 text-xs font-bold gap-2 cursor-pointer bg-accent-gold text-slate-950 hover:bg-accent-gold/90"
                disabled={saving || !divTicker.trim() || !divAmount || parseFloat(divAmount) <= 0}
              >
                {saving && savingAction === 'close' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Coins className="h-4 w-4" />
                )}
                <span>Salvar Provento</span>
              </Button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: TRANSFERÊNCIA ENTRE CONTAS (MOVIMENTAÇÃO INTERNA & MULTI-MOEDA)    */}
        {/* ========================================================================= */}
        {activeTab === 'TRANSFER' && (() => {
          const srcAccount = accountOptions.find((a) => a.id === transferSourceAccountId);
          const destAccount = accountOptions.find((a) => a.id === transferDestAccountId);
          const srcCurr = (transferSourceCurrency || srcAccount?.currency || 'BRL').toUpperCase();
          const destCurr = (transferDestCurrency || destAccount?.currency || srcCurr).toUpperCase();
          const isDiffCurrency = srcCurr !== destCurr;

          const parsedTransferNum = parseFloat(transferAmount.replace(',', '.')) || 0;
          const parsedDestNum = transferDestAmount.trim()
            ? (parseFloat(transferDestAmount.replace(',', '.')) || 0)
            : (isDiffCurrency ? 0 : parsedTransferNum);

          const isSameAccount = transferSourceAccountId && transferDestAccountId && transferSourceAccountId === transferDestAccountId;
          const symSent = CURRENCY_SYMBOLS[srcCurr] || srcCurr;
          const symDest = CURRENCY_SYMBOLS[destCurr] || destCurr;

          const estimatedCommercialDest =
            isDiffCurrency && parsedTransferNum > 0
              ? convert(parsedTransferNum, srcCurr, destCurr)
              : 0;

          // Calcula cotação efetiva paga (com taxas/IOF)
          const effectiveRateText = (() => {
            if (!isDiffCurrency || parsedTransferNum <= 0 || parsedDestNum <= 0) return null;
            if (srcCurr === 'BRL') {
              return `1 ${destCurr} = R$ ${(parsedTransferNum / parsedDestNum).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
            }
            if (destCurr === 'BRL') {
              return `1 ${srcCurr} = R$ ${(parsedDestNum / parsedTransferNum).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
            }
            return `1 ${srcCurr} = ${(parsedDestNum / parsedTransferNum).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ${destCurr}`;
          })();

          return (
            <form onSubmit={handleSubmitTransfer} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                {loadingTransferPair && (
                  <div className="flex items-center gap-2 rounded-xl border border-accent-gold/30 bg-accent-gold/5 px-3 py-2 text-xs text-accent-gold">
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    <span>Carregando dados das duas pontas da transferência...</span>
                  </div>
                )}

                {/* Seletor Visual de Contas (Origem ⇄ Destino) */}
                <div className="rounded-2xl border border-border/80 bg-bg-elevated/40 p-3 sm:p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] gap-2 items-center">
                    {/* Conta de Origem */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                          De (Origem / Saída)
                        </label>
                        {srcAccount && (
                          <span className="text-[11px] font-mono text-text-muted">
                            Saldo: {CURRENCY_SYMBOLS[(srcAccount.currency || 'BRL').toUpperCase()] || srcAccount.currency}{' '}
                            {Number(srcAccount.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                      <select
                        value={transferSourceAccountId}
                        onChange={(e) => handleSelectTransferSourceAccount(e.target.value)}
                        className="input py-2 text-xs cursor-pointer w-full"
                        required
                      >
                        <option value="" disabled>Selecione a conta de origem</option>
                        {accountOptions.map((a: ConnectedAccount) => (
                          <option key={a.id} value={a.id} disabled={a.id === transferDestAccountId}>
                            {a.institution_name === 'Dinheiro'
                              ? '💵 Dinheiro em Espécie'
                              : `${a.institution_name} — ${a.account_name} (${(a.currency || 'BRL').toUpperCase()})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Botão de Inverter */}
                    <div className="flex justify-center sm:pt-4">
                      <button
                        type="button"
                        onClick={handleInvertTransferAccounts}
                        title="Inverter origem e destino"
                        className="h-8 w-8 rounded-full border border-border bg-bg-card hover:bg-bg-elevated hover:border-accent-gold text-accent-gold flex items-center justify-center transition-all cursor-pointer shadow-xs"
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Conta de Destino */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                          Para (Destino / Entrada)
                        </label>
                        {destAccount && (
                          <span className="text-[11px] font-mono text-text-muted">
                            Saldo: {CURRENCY_SYMBOLS[(destAccount.currency || 'BRL').toUpperCase()] || destAccount.currency}{' '}
                            {Number(destAccount.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                      <select
                        value={transferDestAccountId}
                        onChange={(e) => handleSelectTransferDestAccount(e.target.value)}
                        className="input py-2 text-xs cursor-pointer w-full"
                        required
                      >
                        <option value="" disabled>Selecione a conta de destino</option>
                        {accountOptions.map((a: ConnectedAccount) => (
                          <option key={a.id} value={a.id} disabled={a.id === transferSourceAccountId}>
                            {a.institution_name === 'Dinheiro'
                              ? '💵 Dinheiro em Espécie'
                              : `${a.institution_name} — ${a.account_name} (${(a.currency || 'BRL').toUpperCase()})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {isSameAccount && (
                    <p className="text-[11px] text-accent-red font-medium">
                      ⚠️ A conta de origem e destino não podem ser a mesma.
                    </p>
                  )}
                </div>

                {/* Valores e Moedas: Valor Enviado (Saída) vs Valor Recebido (Entrada líquida após taxas) */}
                <div className="rounded-2xl border border-border/80 bg-bg-elevated/25 p-3 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <ArrowLeftRight className="h-3.5 w-3.5 text-accent-gold" />
                      <span>Valores da Transferência {isDiffCurrency ? `(${srcCurr} → ${destCurr})` : ''}</span>
                    </span>
                    {isDiffCurrency && (
                      <span className="rounded-full bg-accent-gold/15 border border-accent-gold/30 px-2.5 py-0.5 text-[10px] font-bold text-accent-gold">
                        Moedas diferentes · Informe valor enviado e recebido (c/ taxas)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Coluna 1: Valor e Moeda que Enviei */}
                    <div className="rounded-xl border border-accent-red/25 bg-bg-card/80 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] font-bold text-accent-red uppercase tracking-wide">
                          Valor que Enviei (Saída)
                        </label>
                        <select
                          value={srcCurr}
                          onChange={(e) => {
                            const next = e.target.value;
                            setTransferSourceCurrency(next);
                            if (next === destCurr && !destAmountManuallyEdited && transferAmount) {
                              setTransferDestAmount(transferAmount);
                            }
                          }}
                          className="h-7 rounded-lg border border-border bg-bg-elevated px-2 text-[11px] font-bold text-text-primary cursor-pointer focus:border-accent-gold outline-none"
                          title="Moeda enviada"
                        >
                          {TRANSFER_CURRENCIES.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-text-muted">
                          {symSent}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={transferAmount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTransferAmount(val);
                            if (!isDiffCurrency && !destAmountManuallyEdited) {
                              setTransferDestAmount(val);
                            }
                          }}
                          placeholder="0,00"
                          className="input pl-9 text-base font-mono font-bold"
                          required
                        />
                      </div>
                      <p className="text-[10px] text-text-muted">
                        Total debitado na origem (já incluindo IOF / taxas)
                      </p>
                    </div>

                    {/* Coluna 2: Valor e Moeda que Recebi */}
                    <div className="rounded-xl border border-accent-green/25 bg-bg-card/80 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] font-bold text-accent-green uppercase tracking-wide">
                          Valor que Recebi (Entrada)
                        </label>
                        <select
                          value={destCurr}
                          onChange={(e) => {
                            const next = e.target.value;
                            setTransferDestCurrency(next);
                            if (next === srcCurr && !destAmountManuallyEdited && transferAmount) {
                              setTransferDestAmount(transferAmount);
                            }
                          }}
                          className="h-7 rounded-lg border border-border bg-bg-elevated px-2 text-[11px] font-bold text-text-primary cursor-pointer focus:border-accent-gold outline-none"
                          title="Moeda recebida"
                        >
                          {TRANSFER_CURRENCIES.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-text-muted">
                          {symDest}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={transferDestAmount}
                          onChange={(e) => {
                            setDestAmountManuallyEdited(true);
                            setTransferDestAmount(e.target.value);
                          }}
                          placeholder={isDiffCurrency ? 'Valor líquido recebido' : (transferAmount || '0,00')}
                          className="input pl-9 text-base font-mono font-bold"
                          required={isDiffCurrency}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[10px] text-text-muted">
                          Valor líquido creditado na conta de destino
                        </p>
                        {isDiffCurrency && estimatedCommercialDest > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setDestAmountManuallyEdited(true);
                              setTransferDestAmount(estimatedCommercialDest.toFixed(2));
                            }}
                            className="text-[10px] font-semibold text-accent-gold hover:underline cursor-pointer shrink-0"
                            title="Preencher com estimativa pelo câmbio comercial"
                          >
                            Ref: ~{symDest} {estimatedCommercialDest.toFixed(2)}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Resumo de Câmbio Efetivo / Taxas */}
                  {parsedTransferNum > 0 && parsedDestNum > 0 && (isDiffCurrency || parsedTransferNum !== parsedDestNum) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent-gold/30 bg-accent-gold/10 px-3 py-2 text-xs">
                      {isDiffCurrency ? (
                        <>
                          <span className="text-text-secondary font-medium">
                            Cotação efetiva (c/ taxas): <strong className="text-accent-gold font-mono">{effectiveRateText}</strong>
                          </span>
                          <span className="font-mono text-[11px] text-text-primary">
                            -{symSent} {parsedTransferNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} → +{symDest} {parsedDestNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-text-secondary font-medium">
                            Diferença / Taxas bancárias:
                          </span>
                          <span className="font-mono font-semibold text-accent-gold">
                            {symSent} {Math.abs(parsedTransferNum - parsedDestNum).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Data e Descrição Opcional */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">
                      Data da Movimentação
                    </label>
                    <input
                      type="date"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                      className="input cursor-pointer"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">
                      Descrição / Motivo <span className="text-[11px] font-normal text-text-muted">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={transferDescription}
                      onChange={(e) => setTransferDescription(e.target.value)}
                      placeholder={
                        srcAccount && destAccount
                          ? `Ex: Transferência de ${srcAccount.institution_name} para ${destAccount.institution_name}`
                          : 'Ex: Câmbio Wise, envio internacional, reserva...'
                      }
                      className="input text-xs"
                    />
                  </div>
                </div>

                {/* Resumo do Impacto nos Saldos */}
                {parsedTransferNum > 0 && parsedDestNum > 0 && srcAccount && destAccount && !isSameAccount && (
                  <div className="rounded-xl border border-accent-gold/20 bg-accent-gold/5 p-3 space-y-1.5 animate-in fade-in duration-150">
                    <p className="text-[11px] font-semibold text-accent-gold flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" />
                      <span>Resumo da movimentação nas contas:</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-bg-card/70 border border-border/60 p-2">
                        <p className="text-[10px] text-text-muted truncate">{srcAccount.institution_name} ({srcAccount.account_name})</p>
                        <p className="font-mono text-xs font-semibold text-accent-red">
                          - {symSent} {parsedTransferNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({srcCurr})
                        </p>
                        {!transactionToEdit && (
                          <p className="text-[10px] text-text-secondary">
                            Saldo estimado: {CURRENCY_SYMBOLS[(srcAccount.currency || 'BRL').toUpperCase()] || srcAccount.currency}{' '}
                            {(
                              Number(srcAccount.balance || 0) -
                              convert(parsedTransferNum, srcCurr, (srcAccount.currency || 'BRL').toUpperCase())
                            ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                      <div className="rounded-lg bg-bg-card/70 border border-border/60 p-2">
                        <p className="text-[10px] text-text-muted truncate">{destAccount.institution_name} ({destAccount.account_name})</p>
                        <p className="font-mono text-xs font-semibold text-accent-green">
                          + {symDest} {parsedDestNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({destCurr})
                        </p>
                        {!transactionToEdit && (
                          <p className="text-[10px] text-text-secondary">
                            Saldo estimado: {CURRENCY_SYMBOLS[(destAccount.currency || 'BRL').toUpperCase()] || destAccount.currency}{' '}
                            {(
                              Number(destAccount.balance || 0) +
                              convert(parsedDestNum, destCurr, (destAccount.currency || 'BRL').toUpperCase())
                            ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Ações */}
              <div className="flex gap-2 pt-3 border-t border-border/80">
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
                  type="submit"
                  className="flex-2 text-xs font-bold gap-2 cursor-pointer"
                  disabled={Boolean(
                    saving ||
                    !parsedTransferNum ||
                    !parsedDestNum ||
                    !transferSourceAccountId ||
                    !transferDestAccountId ||
                    isSameAccount
                  )}
                >
                  {saving && savingAction === 'transfer' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  <span>{transactionToEdit ? 'Salvar Alterações da Transferência' : 'Confirmar Transferência'}</span>
                </Button>
              </div>
            </form>
          );
        })()}

        {/* ========================================================================= */}
        {/* ABA 2: LANÇAMENTO EM LOTE (TABELA / LISTA COM VÁRIOS DE UMA VEZ)            */}
        {/* ========================================================================= */}
        {activeTab === 'BATCH' && !transactionToEdit && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Cabeçalho de padrões comuns para o lote - Colapsável */}
            <div className="bg-bg-elevated/70 border-b border-border/80 shrink-0">
              <button
                type="button"
                onClick={() => setBatchDefaultsOpen((prev) => !prev)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-bg-elevated transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="p-1 rounded-md bg-accent-gold/15 text-accent-gold shrink-0">
                    <Layers className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-text-primary uppercase tracking-wide truncate">
                      Padrões do Lote
                    </p>
                    {!batchDefaultsOpen && (
                      <p className="text-[10px] text-text-muted truncate">
                        {accountOptions.find((a) => a.id === accountId)?.account_name || 'Conta Padrão'} · {selectedCurrency} (Toque para alterar)
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg bg-bg-card border border-border/80 shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent-gold">
                    {batchDefaultsOpen ? 'Minimizar' : 'Configurar'}
                  </span>
                  {batchDefaultsOpen ? (
                    <ChevronUp className="h-3.5 w-3.5 text-accent-gold" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-accent-gold" />
                  )}
                </div>
              </button>

              {batchDefaultsOpen && (
                <div className="px-4 pb-3 pt-1 space-y-2.5 border-t border-border/50 bg-bg-card/40 animate-in fade-in duration-150">
                  <p className="text-[11px] text-text-muted">
                    Defina a conta, data e moeda padrão aplicados às novas linhas do lote:
                  </p>
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

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setBatchDefaultsOpen(false)}
                      className="text-[11px] font-semibold text-accent-gold bg-accent-gold/10 hover:bg-accent-gold/20 border border-accent-gold/30 rounded-lg px-3 py-1.5 flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <ChevronUp className="h-3 w-3" />
                      <span>Fechar e ver lançamentos</span>
                    </button>
                  </div>
                </div>
              )}
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
                        className="input py-1.5 sm:py-2 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:contents gap-2">
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
                            className="input pl-8 py-1.5 sm:py-2 text-xs font-mono font-medium"
                          />
                        </div>
                      </div>

                      {/* Categoria */}
                      <div className="sm:col-span-4">
                        <select
                          value={item.category}
                          onChange={(e) => updateBatchItem(item.id, { category: e.target.value })}
                          className="input py-1.5 sm:py-2 text-xs cursor-pointer"
                        >
                          <option value="">Sem categoria</option>
                          {categoryNames.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
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
