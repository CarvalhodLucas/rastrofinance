import { useState, useEffect, useMemo } from 'react';
import { X, Save, Loader2, Landmark, Globe, Layers, AlertCircle } from 'lucide-react';
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

const INSTITUTIONS = [
  'Wise',
  'Dinheiro',
  'Dinheiro Físico',
  'Binance',
  'Nubank',
  'Santander',
  'XP Investimentos',
  'NuInvest',
  'Banco do Brasil',
  'Itaú',
  'Bradesco',
  'Inter',
  'C6 Bank',
  'Outro',
];

const ACCOUNT_TYPES = [
  { value: 'CHECKING', label: 'Conta Corrente / Saldo' },
  { value: 'CREDIT', label: 'Cartão de Crédito (Fatura)' },
  { value: 'SAVINGS', label: 'Poupança / Caixinha' },
  { value: 'INVESTMENT', label: 'Investimentos' },
];

const CURRENCIES = [
  { value: 'BRL', label: '🇧🇷 Real (BRL R$)', symbol: 'R$' },
  { value: 'EUR', label: '🇪🇺 Euro (EUR €)', symbol: '€' },
  { value: 'USD', label: '🇺🇸 Dólar (USD $)', symbol: '$' },
  { value: 'GBP', label: '🇬🇧 Libra Esterlina (GBP £)', symbol: '£' },
  { value: 'CLP', label: '🇨🇱 Peso Chileno (CLP $)', symbol: '$' },
];

export function AddManualAccountModal({ open, accountToEdit, onClose, onSuccess }: Props) {
  const { notify } = useToast();
  const { convert, fmtRaw, currency: systemCurrency, fmt } = useCurrency();
  const [loading, setLoading] = useState(false);

  const [institutionName, setInstitutionName] = useState('Wise');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('CHECKING');
  const [mainCurrency, setMainCurrency] = useState('EUR');
  const [balance, setBalance] = useState('');

  const allInstitutions = useMemo(() => {
    const list = [...INSTITUTIONS];
    if (institutionName && !list.includes(institutionName)) {
      list.push(institutionName);
    }
    return list;
  }, [institutionName]);

  // Saldos por moeda individual (Wise Multi-moeda)
  const [subBalances, setSubBalances] = useState<Record<string, string>>({
    EUR: '',
    USD: '',
    BRL: '',
    GBP: '',
    CLP: '',
  });

  const isWise = institutionName.toLowerCase().includes('wise') || accountName.toLowerCase().includes('wise');

  useEffect(() => {
    if (open) {
      if (accountToEdit) {
        setInstitutionName(accountToEdit.institution_name || 'Wise');
        setAccountName(accountToEdit.account_name);
        setAccountType(accountToEdit.account_type || 'CHECKING');
        const curr = accountToEdit.currency || 'EUR';
        setMainCurrency(curr);
        setBalance(accountToEdit.balance.toString());

        // Carregar sub-saldos se existirem em account_number
        const newSubs: Record<string, string> = {
          EUR: '',
          USD: '',
          BRL: '',
          GBP: '',
          CLP: '',
        };

        if (accountToEdit.account_number && accountToEdit.account_number.startsWith('{')) {
          try {
            const parsed = JSON.parse(accountToEdit.account_number);
            if (parsed && typeof parsed === 'object') {
              Object.entries(parsed).forEach(([k, v]) => {
                newSubs[k] = v !== undefined && v !== null && v !== 0 ? v.toString() : '';
              });
            }
          } catch {}
        } else {
          // Se não havia sub-saldos salvos, inicializa a moeda principal com o saldo atual
          newSubs[curr] = accountToEdit.balance.toString();
        }

        setSubBalances(newSubs);
      } else {
        setInstitutionName('Wise');
        setAccountName('Wise');
        setAccountType('CHECKING');
        setMainCurrency('EUR');
        setBalance('');
        setSubBalances({
          EUR: '',
          USD: '',
          BRL: '',
          GBP: '',
          CLP: '',
        });
      }
    }
  }, [open, accountToEdit]);

  // Calcula o total consolidado na Moeda Principal a partir dos sub-saldos
  const calculatedTotal = useMemo(() => {
    if (!isWise) {
      const num = parseFloat(balance);
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
      const fallback = parseFloat(balance.replace(',', '.'));
      return isNaN(fallback) ? 0 : fallback;
    }

    return total;
  }, [isWise, subBalances, mainCurrency, balance, convert]);

  if (!open) return null;

  const handleSubBalanceChange = (code: string, value: string) => {
    const updated = { ...subBalances, [code]: value };
    setSubBalances(updated);

    // Se editou a moeda principal e ela é o único valor, sincroniza com o campo de saldo
    if (code === mainCurrency && !Object.entries(updated).some(([c, v]) => c !== mainCurrency && Boolean(v))) {
      setBalance(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) {
      notify('Digite o nome da conta.', 'error');
      return;
    }

    const finalBalance = isWise && calculatedTotal > 0
      ? parseFloat(calculatedTotal.toFixed(2))
      : parseFloat((balance || '0').replace(',', '.'));

    if (isNaN(finalBalance)) {
      notify('Informe um valor de saldo válido.', 'error');
      return;
    }

    // Filtrar apenas sub-saldos numéricos preenchidos
    const filteredSubs: Record<string, number> = {};
    if (isWise) {
      Object.entries(subBalances).forEach(([c, v]) => {
        const num = parseFloat(v.replace(',', '.'));
        if (!isNaN(num) && num !== 0) {
          filteredSubs[c] = num;
        }
      });
      // Garante que a moeda principal esteja registrada
      if (!filteredSubs[mainCurrency] && finalBalance > 0 && Object.keys(filteredSubs).length === 0) {
        filteredSubs[mainCurrency] = finalBalance;
      }
    }

    setLoading(true);
    try {
      await api.addManualAccount({
        id: accountToEdit?.id || accountToEdit?.pluggy_account_id,
        institutionName,
        accountName,
        accountType,
        currency: mainCurrency,
        balance: finalBalance,
        subBalances: isWise && Object.keys(filteredSubs).length > 0 ? filteredSubs : undefined,
      });

      notify(accountToEdit ? 'Saldo atualizado com sucesso!' : 'Conta manual cadastrada com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao salvar conta.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-gold/15 text-accent-gold">
              <Landmark className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary">
                {accountToEdit ? 'Editar Saldo da Conta' : 'Cadastrar Saldo / Conta Manual'}
              </h3>
              <p className="text-[11px] text-text-secondary">
                {isWise ? 'Conta Wise Multi-moeda com conversão automática' : 'Conta manual ou bancária'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:bg-bg-elevated hover:text-text-primary transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Nome da Conta & Instituição */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-text-secondary font-medium mb-1">
                Nome da Conta *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Wise, Santander EUR, Carteira"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-bg-elevated px-3 text-xs text-text-primary outline-none focus:border-accent-gold"
              />
            </div>

            <div>
              <label className="block text-text-secondary font-medium mb-1">Instituição</label>
              <select
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full h-9 rounded-lg border border-border bg-[#1c2333] px-2 text-xs text-text-primary outline-none focus:border-accent-gold cursor-pointer [&>option]:bg-[#111827] [&>option]:text-[#f9fafb]"
              >
                {allInstitutions.map((inst) => (
                  <option key={inst} value={inst} className="bg-[#111827] text-[#f9fafb] py-1">
                    {inst}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tipo de Conta & Moeda Principal */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-text-secondary font-medium mb-1">Tipo de Conta</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full h-9 rounded-lg border border-border bg-[#1c2333] px-2 text-xs text-text-primary outline-none focus:border-accent-gold cursor-pointer [&>option]:bg-[#111827] [&>option]:text-[#f9fafb]"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value} className="bg-[#111827] text-[#f9fafb] py-1">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-text-secondary font-medium mb-1 flex items-center justify-between">
                <span>Moeda Principal da Conta *</span>
                <span className="text-[10px] text-accent-gold font-bold">Referência</span>
              </label>
              <select
                value={mainCurrency}
                onChange={(e) => setMainCurrency(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full h-9 rounded-lg border border-accent-gold/60 bg-[#1c2333] px-2 text-xs font-bold text-text-primary outline-none focus:border-accent-gold cursor-pointer shadow-sm [&>option]:bg-[#111827] [&>option]:text-[#f9fafb]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value} className="bg-[#111827] text-[#f9fafb] py-1.5 font-medium">
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SEÇÃO WISE: MULTI-MOEDA COM CONVERSÃO E INDICAÇÃO DA MOEDA PRINCIPAL */}
          {isWise ? (
            <div className="rounded-xl border border-accent-gold/30 bg-bg-elevated/40 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-gold/20 text-accent-gold">
                    <Globe className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-text-primary text-xs">Saldos Multi-moeda (Wise)</h4>
                    <p className="text-[11px] text-text-secondary">
                      Digite os valores que você possui em cada moeda da sua Wise.
                    </p>
                  </div>
                </div>
                <span className="rounded bg-accent-gold/15 px-2 py-0.5 text-[10px] font-bold text-accent-gold border border-accent-gold/30">
                  Principal: {mainCurrency}
                </span>
              </div>

              {/* Lista de moedas */}
              <div className="space-y-2 pt-1">
                {CURRENCIES.map((c) => {
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

                        {/* Conversão em tempo real para a Moeda Principal da Conta */}
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

              {/* CARD DE SALDO TOTAL CONSOLIDADO (Sempre na Moeda Principal) */}
              <div className="rounded-lg border border-accent-gold/40 bg-accent-gold/10 p-3 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-text-primary font-bold text-xs">
                    <Layers className="h-3.5 w-3.5 text-accent-gold" />
                    <span>Saldo Total da Conta (Moeda Principal)</span>
                  </div>
                  <p className="text-[10px] text-text-secondary mt-0.5">
                    Soma unificada de todas as moedas convertidas para {mainCurrency}
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
            /* SEÇÃO NORMAL: CONTA COM UMA ÚNICA MOEDA */
            <div className="rounded-xl border border-border bg-bg-elevated/40 p-3.5 space-y-2">
              <label className="block text-text-secondary font-medium">
                Saldo Atual na Moeda da Conta ({mainCurrency}) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="Ex: 1250.50"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-bg-elevated px-3 font-mono font-bold text-sm text-text-primary outline-none focus:border-accent-gold"
                />
              </div>

              {balance && !isNaN(parseFloat(balance)) && (
                <div className="flex items-center justify-between text-[11px] text-text-secondary pt-1 border-t border-border/40">
                  <span>Saldo configurado:</span>
                  <span className="font-bold text-text-primary font-mono">
                    {fmtRaw(parseFloat(balance), mainCurrency)}
                    {mainCurrency !== systemCurrency && (
                      <span className="text-text-muted font-normal ml-1">
                        (~{fmt({ balance: parseFloat(balance), currency: mainCurrency })})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Dica informativa */}
          <div className="flex items-start gap-2 rounded-lg bg-bg-elevated/60 p-2.5 text-[11px] text-text-secondary border border-border/50">
            <AlertCircle className="h-3.5 w-3.5 text-accent-gold shrink-0 mt-0.5" />
            <span>
              O saldo desta conta será sempre apresentado em <strong>{mainCurrency}</strong> na lista de contas.
            </span>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/60">
            <Button size="sm" variant="ghost" type="button" onClick={onClose} disabled={loading} className="h-8 text-xs">
              Cancelar
            </Button>
            <Button size="sm" variant="primary" type="submit" disabled={loading} className="h-8 gap-1.5 text-xs font-bold">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>{accountToEdit ? 'Salvar Alterações' : 'Cadastrar Saldo'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
