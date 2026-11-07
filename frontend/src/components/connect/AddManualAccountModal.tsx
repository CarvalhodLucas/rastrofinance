import { useState, useEffect, useMemo } from 'react';
import { X, Save, Loader2, Landmark, Globe, Layers, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import type { ConnectedAccount } from '@/types/finance';

interface Props {
  open: boolean;
  accountToEdit?: ConnectedAccount | null;
  onClose: () => void;
  onSuccess: () => void;
}

const BANK_PRESETS: Array<{ name: string; defaultCurrency: string; type?: string }> = [
  { name: 'Nubank', defaultCurrency: 'BRL' },
  { name: 'Santander', defaultCurrency: 'EUR' },
  { name: 'Itaú', defaultCurrency: 'BRL' },
  { name: 'Inter', defaultCurrency: 'BRL' },
  { name: 'Bradesco', defaultCurrency: 'BRL' },
  { name: 'C6 Bank', defaultCurrency: 'BRL' },
  { name: 'BTG Pactual', defaultCurrency: 'BRL' },
  { name: 'Banco do Brasil', defaultCurrency: 'BRL' },
  { name: 'Caixa', defaultCurrency: 'BRL' },
  { name: 'XP Investimentos', defaultCurrency: 'BRL', type: 'INVESTMENT' },
  { name: 'Wise', defaultCurrency: 'EUR' },
  { name: 'Revolut', defaultCurrency: 'EUR' },
  { name: 'N26', defaultCurrency: 'EUR' },
  { name: 'CaixaBank', defaultCurrency: 'EUR' },
  { name: 'BBVA', defaultCurrency: 'EUR' },
  { name: 'Nomad', defaultCurrency: 'USD' },
  { name: 'Avenue', defaultCurrency: 'USD' },
  { name: 'Binance', defaultCurrency: 'USD', type: 'INVESTMENT' },
  { name: 'Dinheiro', defaultCurrency: 'BRL' },
];

const ACCOUNT_TYPES = [
  { value: 'CHECKING', label: 'Conta Corrente / Saldo' },
  { value: 'SAVINGS', label: 'Poupança / Caixinha' },
  { value: 'CREDIT', label: 'Cartão de Crédito' },
  { value: 'INVESTMENT', label: 'Corretora / Investimentos' },
];

export const ACCOUNT_CURRENCIES = [
  { value: 'BRL', flag: '🇧🇷', short: 'BRL (R$)', label: '🇧🇷 Real (BRL R$)', symbol: 'R$' },
  { value: 'EUR', flag: '🇪🇺', short: 'EUR (€)', label: '🇪🇺 Euro (EUR €)', symbol: '€' },
  { value: 'USD', flag: '🇺🇸', short: 'USD ($)', label: '🇺🇸 Dólar (USD $)', symbol: '$' },
  { value: 'GBP', flag: '🇬🇧', short: 'GBP (£)', label: '🇬🇧 Libra (GBP £)', symbol: '£' },
  { value: 'CLP', flag: '🇨🇱', short: 'CLP ($)', label: '🇨🇱 Peso Chileno (CLP $)', symbol: '$' },
];

export function AddManualAccountModal({ open, accountToEdit, onClose, onSuccess }: Props) {
  const { notify } = useToast();
  const { convert, fmtRaw, currency: systemCurrency, fmt } = useCurrency();
  const [loading, setLoading] = useState(false);

  const [institutionName, setInstitutionName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('CHECKING');
  const [mainCurrency, setMainCurrency] = useState('BRL');
  const [balance, setBalance] = useState('0');
  const [enableMultiCurrency, setEnableMultiCurrency] = useState(false);

  // Saldos por moeda individual (Modo Multi-moeda opcional: Wise, Revolut, etc.)
  const [subBalances, setSubBalances] = useState<Record<string, string>>({
    EUR: '',
    USD: '',
    BRL: '',
    GBP: '',
    CLP: '',
  });

  useEffect(() => {
    if (open) {
      if (accountToEdit) {
        setInstitutionName(accountToEdit.institution_name || '');
        setAccountName(accountToEdit.account_name || accountToEdit.institution_name || '');
        setAccountType(accountToEdit.account_type || 'CHECKING');
        const curr = (accountToEdit.currency || systemCurrency || 'BRL').toUpperCase();
        setMainCurrency(curr);
        setBalance(String(accountToEdit.balance ?? 0));

        const newSubs: Record<string, string> = {
          EUR: '',
          USD: '',
          BRL: '',
          GBP: '',
          CLP: '',
        };

        let hasSavedMulti = false;
        if (accountToEdit.account_number && accountToEdit.account_number.startsWith('{')) {
          try {
            const parsed = JSON.parse(accountToEdit.account_number);
            if (parsed && typeof parsed === 'object') {
              const keys = Object.keys(parsed).filter((k) => parsed[k] !== undefined && parsed[k] !== null && parsed[k] !== 0);
              if (keys.length > 1) hasSavedMulti = true;
              Object.entries(parsed).forEach(([k, v]) => {
                newSubs[k] = v !== undefined && v !== null && v !== 0 ? v.toString() : '';
              });
            }
          } catch {}
        } else {
          newSubs[curr] = accountToEdit.balance ? accountToEdit.balance.toString() : '';
        }

        setEnableMultiCurrency(hasSavedMulti);
        setSubBalances(newSubs);
      } else {
        setInstitutionName('');
        setAccountName('');
        setAccountType('CHECKING');
        setMainCurrency(systemCurrency || 'BRL');
        setBalance('0');
        setEnableMultiCurrency(false);
        setSubBalances({
          EUR: '',
          USD: '',
          BRL: '',
          GBP: '',
          CLP: '',
        });
      }
    }
  }, [open, accountToEdit, systemCurrency]);

  const handleSelectBankPreset = (preset: typeof BANK_PRESETS[0]) => {
    const prevInst = institutionName;
    setInstitutionName(preset.name);
    if (!accountName.trim() || accountName.trim() === prevInst.trim()) {
      setAccountName(preset.name === 'Dinheiro' ? 'Dinheiro em Espécie' : preset.name);
    }
    if (!accountToEdit) {
      setMainCurrency(preset.defaultCurrency);
      if (preset.type) setAccountType(preset.type);
    }
  };

  const handleInstitutionInputChange = (val: string) => {
    const prev = institutionName;
    setInstitutionName(val);
    if (!accountName.trim() || accountName.trim() === prev.trim()) {
      setAccountName(val);
    }
  };

  // Calcula o total consolidado na Moeda Principal a partir dos sub-saldos quando Multi-moeda está ativo
  const calculatedTotal = useMemo(() => {
    if (!enableMultiCurrency) {
      const num = parseFloat((balance || '0').replace(',', '.'));
      return isNaN(num) ? 0 : num;
    }

    let total = 0;
    let hasAnyValue = false;

    Object.entries(subBalances).forEach(([c, val]) => {
      const num = parseFloat(val.replace(',', '.'));
      if (!isNaN(num) && num !== 0) {
        hasAnyValue = true;
        total += convert(num, c, mainCurrency);
      }
    });

    if (!hasAnyValue) {
      const fallback = parseFloat((balance || '0').replace(',', '.'));
      return isNaN(fallback) ? 0 : fallback;
    }

    return total;
  }, [enableMultiCurrency, subBalances, mainCurrency, balance, convert]);

  if (!open) return null;

  const handleSubBalanceChange = (code: string, value: string) => {
    const updated = { ...subBalances, [code]: value };
    setSubBalances(updated);

    if (code === mainCurrency && !Object.entries(updated).some(([c, v]) => c !== mainCurrency && Boolean(v))) {
      setBalance(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalInst = institutionName.trim() || accountName.trim();
    const finalAccName = accountName.trim() || finalInst;

    if (!finalInst) {
      notify('Digite ou escolha o nome do banco.', 'error');
      return;
    }

    const rawBal = enableMultiCurrency && calculatedTotal > 0
      ? parseFloat(calculatedTotal.toFixed(2))
      : parseFloat((balance || '0').replace(',', '.'));

    const finalBalance = isNaN(rawBal) ? 0 : rawBal;

    const filteredSubs: Record<string, number> = {};
    if (enableMultiCurrency) {
      Object.entries(subBalances).forEach(([c, v]) => {
        const num = parseFloat(v.replace(',', '.'));
        if (!isNaN(num) && num !== 0) {
          filteredSubs[c] = num;
        }
      });
      if (!filteredSubs[mainCurrency] && finalBalance > 0 && Object.keys(filteredSubs).length === 0) {
        filteredSubs[mainCurrency] = finalBalance;
      }
    }

    setLoading(true);
    try {
      await api.addManualAccount({
        id: accountToEdit?.id || accountToEdit?.pluggy_account_id,
        institutionName: finalInst,
        accountName: finalAccName,
        accountType,
        currency: mainCurrency,
        balance: finalBalance,
        subBalances: enableMultiCurrency && Object.keys(filteredSubs).length > 0 ? filteredSubs : undefined,
      });

      notify(
        accountToEdit
          ? `✓ Banco "${finalAccName}" (${mainCurrency}) atualizado com sucesso!`
          : `✓ Banco "${finalAccName}" (${mainCurrency}) adicionado com sucesso!`,
        'success',
      );
      window.dispatchEvent(new Event('transactions:changed'));
      onSuccess();
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao salvar banco/conta.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const currentCurrencyObj = ACCOUNT_CURRENCIES.find((c) => c.value === mainCurrency) || ACCOUNT_CURRENCIES[0]!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-bg-card p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 my-auto max-h-[92vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-border pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-gold/15 text-accent-gold border border-accent-gold/30">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">
                {accountToEdit ? 'Editar Banco, Moeda e Saldo' : 'Adicionar Banco / Conta'}
              </h3>
              <p className="text-xs text-text-secondary">
                Escolha ou digite o banco que você usa e a moeda da conta
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-bg-elevated hover:text-text-primary transition-colors cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 1. Escolha Rápida ou Digite o Nome do Banco */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
              1. Qual banco ou instituição você usa? *
            </label>

            {/* Chips de bancos populares */}
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1 py-0.5">
              {BANK_PRESETS.map((preset) => {
                const isSelected = institutionName.trim().toLowerCase() === preset.name.toLowerCase();
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleSelectBankPreset(preset)}
                    className={`px-2.5 py-1 rounded-lg border text-xs transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'border-accent-gold bg-accent-gold/20 text-accent-gold font-bold shadow-xs'
                        : 'border-border/70 bg-bg-elevated/50 text-text-secondary hover:text-text-primary hover:border-border'
                    }`}
                  >
                    <span>{preset.name}</span>
                    <span className="text-[10px] opacity-65">({preset.defaultCurrency})</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-text-secondary font-medium mb-1">
                  Nome do Banco / Instituição *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Digite qualquer banco (ex: Nubank, Revolut, Millenium...)"
                  value={institutionName}
                  onChange={(e) => handleInstitutionInputChange(e.target.value)}
                  className="w-full h-9.5 rounded-xl border border-border bg-bg-elevated px-3 text-xs sm:text-sm font-semibold text-text-primary outline-none focus:border-accent-gold"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-medium mb-1">
                  Apelido da Conta (como aparece na tela)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Nubank Principal, Santander EUR..."
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full h-9.5 rounded-xl border border-border bg-bg-elevated px-3 text-xs sm:text-sm text-text-primary outline-none focus:border-accent-gold"
                />
              </div>
            </div>
          </div>

          {/* 2. Seleção da Moeda do Banco (Destaque visual) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
                2. Moeda deste Banco / Conta *
              </label>
              <span className="text-[11px] font-semibold text-accent-gold">
                Moeda selecionada: {currentCurrencyObj.label}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {ACCOUNT_CURRENCIES.map((c) => {
                const isSelected = mainCurrency === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setMainCurrency(c.value)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-accent-gold bg-accent-gold/20 text-accent-gold font-bold shadow-sm ring-1 ring-accent-gold/40'
                        : 'border-border bg-bg-elevated/40 text-text-secondary hover:text-text-primary hover:border-border/90'
                    }`}
                  >
                    {isSelected && (
                      <Check className="h-3 w-3 text-accent-gold absolute top-1.5 right-1.5" />
                    )}
                    <span className="text-base leading-none mb-1">{c.flag}</span>
                    <span className="text-xs font-bold">{c.value}</span>
                    <span className="text-[10px] opacity-75 font-mono">{c.symbol}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Tipo de Conta e Saldo Atual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-text-secondary font-medium mb-1">
                Tipo de Conta
              </label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full h-10 rounded-xl border border-border bg-[#1c2333] px-3 text-xs sm:text-sm text-text-primary outline-none focus:border-accent-gold cursor-pointer [&>option]:bg-[#111827] [&>option]:text-[#f9fafb]"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value} className="bg-[#111827] text-[#f9fafb] py-1">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {!enableMultiCurrency && (
              <div>
                <label className="block text-text-secondary font-medium mb-1">
                  Saldo Atual ({currentCurrencyObj.short})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-accent-gold">
                    {currentCurrencyObj.symbol}
                  </span>
                  <input
                    type="number"
                    step="any"
                    placeholder="0,00"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="w-full h-10 rounded-xl border border-accent-gold/50 bg-bg-elevated pl-9 pr-3 font-mono font-bold text-sm text-text-primary outline-none focus:border-accent-gold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Alternador opcional para Conta Multi-moeda (Wise / Revolut) */}
          <div className="pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableMultiCurrency}
                onChange={(e) => setEnableMultiCurrency(e.target.checked)}
                className="h-4 w-4 rounded border-border text-accent-gold focus:ring-accent-gold cursor-pointer"
              />
              <span>Esta conta possui sub-saldos em várias moedas ao mesmo tempo (ex: Wise / Revolut)</span>
            </label>
          </div>

          {/* SEÇÃO MULTI-MOEDA OPCIONAL */}
          {enableMultiCurrency ? (
            <div className="rounded-xl border border-accent-gold/30 bg-bg-elevated/40 p-4 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-gold/20 text-accent-gold">
                    <Globe className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-text-primary text-xs">Saldos por Moeda</h4>
                    <p className="text-[11px] text-text-secondary">
                      Digite os valores que você possui em cada moeda dentro desta conta.
                    </p>
                  </div>
                </div>
                <span className="rounded bg-accent-gold/15 px-2 py-0.5 text-[10px] font-bold text-accent-gold border border-accent-gold/30">
                  Principal: {mainCurrency}
                </span>
              </div>

              <div className="space-y-2 pt-1">
                {ACCOUNT_CURRENCIES.map((c) => {
                  const isMain = c.value === mainCurrency;
                  const rawVal = subBalances[c.value] || '';
                  const numVal = parseFloat(rawVal.replace(',', '.'));
                  const hasVal = !isNaN(numVal) && numVal !== 0;
                  const convertedToMain = hasVal && !isMain ? convert(numVal, c.value, mainCurrency) : 0;

                  return (
                    <div
                      key={c.value}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border transition-all ${
                        isMain
                          ? 'border-accent-gold/50 bg-accent-gold/10'
                          : hasVal
                          ? 'border-border bg-bg-card'
                          : 'border-border/50 bg-bg-card/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-[130px]">
                        <span className="font-semibold text-text-primary text-xs">{c.label}</span>
                        {isMain && (
                          <span className="rounded bg-accent-gold/20 px-1.5 py-0.2 text-[9px] font-bold text-accent-gold">
                            Principal
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <div className="relative w-36">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-text-muted">
                            {c.symbol}
                          </span>
                          <input
                            type="number"
                            step="any"
                            placeholder="0,00"
                            value={rawVal}
                            onChange={(e) => handleSubBalanceChange(c.value, e.target.value)}
                            className="w-full h-8 rounded-md border border-border bg-bg-elevated pl-7 pr-2 font-mono text-xs text-text-primary outline-none focus:border-accent-gold text-right"
                          />
                        </div>

                        {!isMain && hasVal && (
                          <span className="text-[10px] font-mono text-text-muted w-24 text-right hidden sm:block truncate">
                            ≈ {fmtRaw(convertedToMain, mainCurrency)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg border border-accent-gold/40 bg-accent-gold/10 p-3 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-text-primary font-bold text-xs">
                    <Layers className="h-3.5 w-3.5 text-accent-gold" />
                    <span>Saldo Consolidado ({mainCurrency})</span>
                  </div>
                  <p className="text-[10px] text-text-secondary mt-0.5">
                    Soma convertida para a moeda principal da conta
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-base font-bold font-mono text-accent-gold">
                    {fmtRaw(calculatedTotal, mainCurrency)}
                  </div>
                  {mainCurrency !== systemCurrency && (
                    <div className="text-[10px] text-text-muted font-mono">
                      ≈ {fmt({ balance: calculatedTotal, currency: mainCurrency })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            balance && !isNaN(parseFloat(balance)) && parseFloat(balance) !== 0 && (
              <div className="rounded-xl border border-border/60 bg-bg-elevated/30 px-3.5 py-2.5 flex items-center justify-between text-xs">
                <span className="text-text-secondary">Resumo da conta:</span>
                <span className="font-bold text-text-primary font-mono">
                  {institutionName || accountName || 'Banco'} · {fmtRaw(parseFloat(balance), mainCurrency)} ({mainCurrency})
                  {mainCurrency !== systemCurrency && (
                    <span className="text-text-muted font-normal ml-1.5">
                      (~{fmt({ balance: parseFloat(balance), currency: mainCurrency })})
                    </span>
                  )}
                </span>
              </div>
            )
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={loading} className="gap-1.5 font-bold">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>{accountToEdit ? 'Salvar Alterações' : 'Adicionar Banco'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
