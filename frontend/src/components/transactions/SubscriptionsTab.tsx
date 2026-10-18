import { useState, useMemo } from 'react';
import { Repeat, Calendar, Edit2, Ban, Plus, DollarSign, Clock, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useFmt } from '@/contexts/CurrencyContext';
import { categoryMeta } from '@/lib/categories';
import { api } from '@/services/api';
import type { ConnectedAccount, Transaction } from '@/types/finance';

interface Props {
  allTransactions: Transaction[];
  accounts: ConnectedAccount[];
  onReload: () => void;
  onEditSubscription: (tx: Transaction) => void;
  onOpenAddModal: () => void;
}

export function SubscriptionsTab({
  allTransactions,
  accounts,
  onReload,
  onEditSubscription,
  onOpenAddModal,
}: Props) {
  const fmt = useFmt();
  const { notify } = useToast();
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Filtrar apenas transações marcadas como recorrentes (assinaturas)
  // Agrupar por descrição única para mostrar cada assinatura ativa uma única vez
  const subscriptions = useMemo(() => {
    const map = new Map<string, Transaction>();
    const recurringList = allTransactions.filter((t) => t.is_recurring);

    for (const tx of recurringList) {
      const key = tx.description.toLowerCase().trim();
      const existing = map.get(key);
      if (!existing || new Date(tx.date).getTime() > new Date(existing.date).getTime()) {
        map.set(key, tx);
      }
    }

    let result = Array.from(map.values());

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.description.toLowerCase().includes(q) ||
          (s.category ?? '').toLowerCase().includes(q),
      );
    }

    return result.sort((a, b) => {
      const dayA = new Date(a.date).getDate();
      const dayB = new Date(b.date).getDate();
      return dayA - dayB;
    });
  }, [allTransactions, search]);

  const totalMonthly = useMemo(() => {
    return subscriptions.reduce((acc, s) => acc + Math.abs(s.original_amount ?? s.amount), 0);
  }, [subscriptions]);

  const nextUpcoming = useMemo(() => {
    if (subscriptions.length === 0) return null;
    const today = new Date().getDate();
    const sorted = [...subscriptions].sort((a, b) => {
      const dA = new Date(a.date).getDate();
      const dB = new Date(b.date).getDate();
      const diffA = dA >= today ? dA - today : dA + 31 - today;
      const diffB = dB >= today ? dB - today : dB + 31 - today;
      return diffA - diffB;
    });
    return sorted[0];
  }, [subscriptions]);

  const handleCancelSubscription = async (tx: Transaction) => {
    if (!window.confirm(`Tem certeza que deseja cancelar a assinatura "${tx.description}"? Ela não será mais renovada automaticamente.`)) {
      return;
    }

    setCancelingId(tx.id);
    try {
      await api.updateTransaction(tx.id, { is_recurring: false });
      notify(`Assinatura "${tx.description}" cancelada com sucesso! Não haverá novas renovações.`, 'success');
      onReload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao cancelar assinatura.', 'error');
    } finally {
      setCancelingId(null);
    }
  };

  const getAccountName = (accId?: string | null) => {
    if (!accId) return 'Sem conta associada';
    const acc = accounts.find((a) => a.id === accId || a.pluggy_account_id === accId);
    return acc ? `${acc.institution_name} (${acc.account_name})` : 'Conta Desconhecida';
  };

  const calculateNextRenewalDate = (dateStr: string) => {
    const txDate = new Date(dateStr);
    const day = txDate.getDate();
    const today = new Date();
    let nextMonth = today.getMonth();
    let nextYear = today.getFullYear();

    if (today.getDate() > day) {
      nextMonth += 1;
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear += 1;
      }
    }

    const nextDate = new Date(nextYear, nextMonth, day);
    return {
      day,
      formattedDate: nextDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-border bg-bg-card/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-text-secondary font-medium uppercase tracking-wider">
                Total Mensal em Assinaturas
              </p>
              <p className="text-xl font-bold font-mono text-amber-400 mt-1">
                {fmt(totalMonthly)} <span className="text-xs font-sans text-text-secondary font-normal">/ mês</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-bg-card/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-text-secondary font-medium uppercase tracking-wider">
                Assinaturas Ativas
              </p>
              <p className="text-xl font-bold text-text-primary mt-1">
                {subscriptions.length} <span className="text-xs text-text-secondary font-normal">serviços</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
              <Repeat className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-bg-card/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-text-secondary font-medium uppercase tracking-wider">
                Próxima Renovação
              </p>
              <p className="text-sm font-bold text-text-primary mt-1 truncate max-w-[180px]">
                {nextUpcoming ? nextUpcoming.description : 'Nenhuma'}
              </p>
              {nextUpcoming && (
                <p className="text-[11px] text-accent-gold mt-0.5">
                  Dia {new Date(nextUpcoming.date).getDate()} ({calculateNextRenewalDate(nextUpcoming.date).formattedDate})
                </p>
              )}
            </div>
            <div className="h-10 w-10 rounded-xl bg-accent-gold/10 text-accent-gold flex items-center justify-center font-bold">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Busca e Ação */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-bg-card/40 p-3 rounded-xl border border-border">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar assinatura (Netflix, Spotify...)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 rounded-lg border border-border bg-bg-elevated pl-9 pr-3 text-xs text-text-primary outline-none focus:border-accent-gold"
          />
        </div>

        <Button onClick={onOpenAddModal} size="sm" variant="primary" className="w-full sm:w-auto h-9 gap-1.5 font-bold text-xs">
          <Plus className="h-4 w-4" />
          <span>Nova Assinatura</span>
        </Button>
      </div>

      {/* Lista / Tabela de Assinaturas */}
      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-2xl bg-bg-card/20 p-6 space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <Repeat className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-text-primary">Nenhuma assinatura mensal ativa</h3>
          <p className="text-xs text-text-secondary max-w-sm">
            Marque a opção <b>"Marcar como Assinatura"</b> ao cadastrar despesas recorrentes como Netflix, Spotify, iCloud ou Aluguel para gerenciá-las aqui.
          </p>
          <Button size="sm" variant="primary" onClick={onOpenAddModal} className="gap-1.5 font-bold text-xs mt-2">
            <Plus className="h-4 w-4" />
            <span>Cadastrar Primeira Assinatura</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map((sub) => {
            const meta = categoryMeta(sub.category);
            const renewal = calculateNextRenewalDate(sub.date);
            const val = Math.abs(sub.original_amount ?? sub.amount);

            return (
              <Card key={sub.id} className="border-border bg-bg-card hover:border-accent-gold/40 transition-colors shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-elevated text-lg border border-border">
                        {meta.icon}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-text-primary truncate">
                          {sub.description}
                        </h4>
                        <span className="inline-flex items-center gap-1 text-[10px] text-text-secondary font-medium mt-0.5">
                          {sub.category || 'Geral'}
                        </span>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30 shrink-0">
                      <Repeat className="h-3 w-3" /> Assinatura
                    </span>
                  </div>

                  <div className="border-t border-b border-border/60 py-2.5 my-2 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">Valor Mensal:</span>
                      <span className="font-mono font-bold text-sm text-amber-400">
                        {fmt({ balance: val, currency: sub.original_currency || 'BRL' })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-secondary flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-accent-gold" /> Dia do Vencimento:
                      </span>
                      <span className="font-semibold text-text-primary">
                        Todo dia {renewal.day}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-secondary flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-blue-400" /> Próxima Cobrança:
                      </span>
                      <span className="font-mono font-semibold text-blue-400">
                        {renewal.formattedDate}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span className="text-text-secondary truncate max-w-[120px]">Forma / Conta:</span>
                      <span className="text-text-secondary font-medium truncate max-w-[150px]">
                        {getAccountName(sub.account_id)}
                      </span>
                    </div>
                  </div>

                  {/* Ações: Editar e Cancelar */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onEditSubscription(sub)}
                      className="h-8 gap-1 text-xs border-border hover:border-accent-gold/40 flex-1"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleCancelSubscription(sub)}
                      disabled={cancelingId === sub.id}
                      className="h-8 gap-1 text-xs flex-1"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      <span>Cancelar</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
