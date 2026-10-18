import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/services/api';
import type { Transaction } from '@/types/finance';

export type Currency = 'BRL' | 'USD' | 'EUR' | 'CLP';

const LOCALE: Record<Currency, string> = { BRL: 'pt-BR', USD: 'en-US', EUR: 'pt-PT', CLP: 'es-CL' };
const STORAGE_KEY = 'rastro_currency';
const RATES_URL =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/brl.json';

// Fallback rates (approximate BRL to Target) in case the API is unreachable
const FALLBACK_RATES: Record<string, number> = { brl: 1.0, usd: 0.18, eur: 0.17, clp: 175.0 };

export interface BalanceValue {
  balance: number;
  currency?: Currency | string;
}

export function convertAmount(
  amount: number,
  fromCurr: Currency,
  toCurr: Currency,
  rates: Record<string, number>,
): number {
  if (fromCurr === toCurr) return amount;
  const fromKey = fromCurr.toLowerCase();
  const toKey = toCurr.toLowerCase();

  const rFrom = fromKey === 'brl' ? 1 : (rates[fromKey] ?? FALLBACK_RATES[fromKey] ?? 0.17);
  const rTo = toKey === 'brl' ? 1 : (rates[toKey] ?? FALLBACK_RATES[toKey] ?? 0.17);

  // Convert to BRL first
  const amountBRL = fromKey === 'brl' ? amount : amount / rFrom;

  // Convert BRL to target currency
  return toKey === 'brl' ? amountBRL : amountBRL * rTo;
}

function makeFormatter(currency: Currency, rates: Record<string, number>) {
  return (value: number | Transaction | BalanceValue) => {
    let num: number;
    let curr = currency;

    if (typeof value === 'object' && value !== null) {
      if ('balance' in value) {
        const acc = value as BalanceValue;
        const accCurr = ((acc.currency as Currency) || 'BRL').toUpperCase() as Currency;
        num = convertAmount(acc.balance, accCurr, curr, rates);
      } else if ('amount' in value) {
        const tx = value as Transaction;
        const txCurr = (tx.original_currency || 'BRL').toUpperCase() as Currency;
        const origAmt = tx.original_amount !== undefined && tx.original_amount !== null ? Math.abs(tx.original_amount) : Math.abs(tx.amount);
        num = convertAmount(origAmt, txCurr, curr, rates);
      } else {
        num = 0;
      }
    } else {
      num = convertAmount(value, 'BRL', curr, rates);
    }

    return new Intl.NumberFormat(LOCALE[curr], { style: 'currency', currency: curr }).format(num);
  };
}

function makeCompactFormatter(currency: Currency, rates: Record<string, number>) {
  return (value: number | Transaction | BalanceValue) => {
    let num: number;
    let curr = currency;

    if (typeof value === 'object' && value !== null) {
      if ('balance' in value) {
        const acc = value as BalanceValue;
        const accCurr = ((acc.currency as Currency) || 'BRL').toUpperCase() as Currency;
        num = convertAmount(acc.balance, accCurr, curr, rates);
      } else if ('amount' in value) {
        const tx = value as Transaction;
        const txCurr = (tx.original_currency || 'BRL').toUpperCase() as Currency;
        const origAmt = tx.original_amount !== undefined && tx.original_amount !== null ? Math.abs(tx.original_amount) : Math.abs(tx.amount);
        num = convertAmount(origAmt, txCurr, curr, rates);
      } else {
        num = 0;
      }
    } else {
      num = convertAmount(value, 'BRL', curr, rates);
    }

    return new Intl.NumberFormat(LOCALE[curr], {
      style: 'currency',
      currency: curr,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  };
}

export interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => Promise<void>;
  rate: number;
  rates: Record<string, number>;
  rateDate: string;
  fmt: (value: number | Transaction | BalanceValue) => string;
  fmtCompact: (value: number | Transaction | BalanceValue) => string;
  isLoadingRate: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(
    () => (localStorage.getItem(STORAGE_KEY) as Currency) ?? 'BRL',
  );
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const [rateDate, setRateDate] = useState('');
  const [isLoadingRate, setIsLoadingRate] = useState(false);

  const fetchRates = useCallback(async () => {
    setIsLoadingRate(true);
    try {
      const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,CLP-BRL');
      if (res.ok) {
        const data: any = await res.json();
        const usdBrl = parseFloat(data.USDBRL?.ask || data.USDBRL?.bid || '5.22');
        const eurBrl = parseFloat(data.EURBRL?.ask || data.EURBRL?.bid || '6.04');
        const clpBrl = parseFloat(data.CLPBRL?.ask || data.CLPBRL?.bid || '0.00565');

        setRates({
          brl: 1.0,
          usd: 1 / usdBrl,
          eur: 1 / eurBrl,
          clp: 1 / clpBrl,
        });
        setRateDate(new Date().toISOString().split('T')[0] || '');
        return;
      }
    } catch (e) {
      console.warn('[currency] Falha ao buscar taxas da AwesomeAPI, tentando fallback:', e);
    }

    try {
      const res = await fetch(RATES_URL);
      const data = (await res.json()) as { date: string; brl: Record<string, number> };
      if (data.brl) {
        setRates({ ...FALLBACK_RATES, ...data.brl });
        setRateDate(data.date);
      }
    } catch {
      setRates(FALLBACK_RATES);
    } finally {
      setIsLoadingRate(false);
    }
  }, []);

  const setCurrency = useCallback(
    async (c: Currency) => {
      setCurrencyState(c);
      localStorage.setItem(STORAGE_KEY, c);
      await Promise.all([
        fetchRates(),
        api.updateSettings({ currency: c }).catch(() => {}),
      ]);
    },
    [fetchRates],
  );

  useEffect(() => {
    void fetchRates();
  }, [fetchRates]);

  const currentRate = rates[currency.toLowerCase()] ?? FALLBACK_RATES[currency.toLowerCase()] ?? 1;

  const fmt        = useCallback(makeFormatter(currency, rates), [currency, rates]);
  const fmtCompact = useCallback(makeCompactFormatter(currency, rates), [currency, rates]);

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, rate: currentRate, rates, rateDate, fmt, fmtCompact, isLoadingRate }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be inside CurrencyProvider');
  return ctx;
}

/** Shorthand: returns the currency-aware format function. */
export function useFmt() {
  return useCurrency().fmt;
}

/** Shorthand: returns the compact currency-aware format function. */
export function useFmtCompact() {
  return useCurrency().fmtCompact;
}
