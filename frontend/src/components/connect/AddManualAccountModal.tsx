import { useState, useEffect } from 'react';
import { X, Save, Loader2, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import type { ConnectedAccount } from '@/types/finance';

interface Props {
  open: boolean;
  accountToEdit?: ConnectedAccount | null;
  onClose: () => void;
  onSuccess: () => void;
}

const INSTITUTIONS = [
  'Wise',
  'Nubank',
  'Banco do Brasil',
  'Itaú',
  'Bradesco',
  'Santander',
  'Inter',
  'C6 Bank',
  'Dinheiro Físico',
  'Outro',
];

const ACCOUNT_TYPES = [
  { value: 'CHECKING', label: 'Conta Corrente / Saldo' },
  { value: 'CREDIT', label: 'Cartão de Crédito (Fatura)' },
  { value: 'SAVINGS', label: 'Poupança / Caixinha' },
  { value: 'INVESTMENT', label: 'Investimentos' },
];

const CURRENCIES = [
  { value: 'BRL', label: '🇧🇷 Real (BRL R$)' },
  { value: 'USD', label: '🇺🇸 Dólar (USD $)' },
  { value: 'EUR', label: '🇪🇺 Euro (EUR €)' },
  { value: 'CLP', label: '🇨🇱 Peso Chileno (CLP $)' },
];

export function AddManualAccountModal({ open, accountToEdit, onClose, onSuccess }: Props) {
  const { notify } = useToast();
  const [loading, setLoading] = useState(false);

  const [institutionName, setInstitutionName] = useState('Wise');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('CHECKING');
  const [currency, setCurrency] = useState('BRL');
  const [balance, setBalance] = useState('');

  useEffect(() => {
    if (open) {
      if (accountToEdit) {
        setInstitutionName(accountToEdit.institution_name || 'Wise');
        setAccountName(accountToEdit.account_name);
        setAccountType(accountToEdit.account_type || 'CHECKING');
        setCurrency(accountToEdit.currency || 'BRL');
        setBalance(accountToEdit.balance.toString());
      } else {
        setInstitutionName('Wise');
        setAccountName('');
        setAccountType('CHECKING');
        setCurrency('BRL');
        setBalance('');
      }
    }
  }, [open, accountToEdit]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) {
      notify('Digite o nome da conta.', 'error');
      return;
    }
    if (!balance || isNaN(parseFloat(balance))) {
      notify('Informe um valor de saldo válido.', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.addManualAccount({
        id: accountToEdit?.id || accountToEdit?.pluggy_account_id,
        institutionName,
        accountName,
        accountType,
        currency,
        balance: parseFloat(balance),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-border bg-bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-accent-gold" />
            <h3 className="text-sm font-bold text-text-primary">
              {accountToEdit ? 'Editar Saldo da Conta' : 'Cadastrar Saldo / Conta Manual'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:bg-bg-elevated hover:text-text-primary transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Nome da Conta */}
          <div>
            <label className="block text-text-secondary font-medium mb-1">
              Nome da Conta / Caixinha *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Wise Dólar, Caixinha Nubank, Reserva Euro"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-bg-elevated px-3 text-xs text-text-primary outline-none focus:border-accent-gold"
            />
          </div>

          {/* Instituição & Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-text-secondary font-medium mb-1">Instituição</label>
              <select
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-text-primary outline-none focus:border-accent-gold cursor-pointer"
              >
                {INSTITUTIONS.map((inst) => (
                  <option key={inst} value={inst}>{inst}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-text-secondary font-medium mb-1">Tipo de Conta</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-text-primary outline-none focus:border-accent-gold cursor-pointer"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Moeda & Saldo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-text-secondary font-medium mb-1">Moeda</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-bg-elevated px-2 text-xs font-bold text-text-primary outline-none focus:border-accent-gold cursor-pointer"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-text-secondary font-medium mb-1">Saldo Atual *</label>
              <input
                type="number"
                step="any"
                required
                placeholder="Ex: 4168.53"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-bg-elevated px-3 font-mono font-bold text-xs text-text-primary outline-none focus:border-accent-gold"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
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
