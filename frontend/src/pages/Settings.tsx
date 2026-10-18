import { useEffect, useState } from 'react';
import {
  Save,
  RefreshCw,
  Sparkles,
  Trash2,
  Plus,
  Loader2,
  Send,
  MessageSquare,
  Globe,
  Target,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Clock,
  Phone,
  Key,
  Hash,
  Eye,
  EyeOff,
  Building2,
  Check,
  Zap,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import { CATEGORY_NAMES } from '@/lib/categories';
import { cn } from '@/lib/utils';
import { useCurrency, useFmt, type Currency } from '@/contexts/CurrencyContext';
import type { FinancialGoal } from '@/types/finance';
import { Link } from 'react-router-dom';

interface SettingsState {
  whatsapp_enabled: boolean;
  ai_analysis_enabled: boolean;
  daily_report_time: string;
  whatsapp_number: string;
  telegram_enabled: boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;
}

const CURRENCY_OPTIONS: { code: Currency; label: string; flag: string; symbol: string }[] = [
  { code: 'BRL', label: 'Real', flag: '🇧🇷', symbol: 'R$' },
  { code: 'USD', label: 'Dólar', flag: '🇺🇸', symbol: '$' },
  { code: 'EUR', label: 'Euro', flag: '🇪🇺', symbol: '€' },
  { code: 'CLP', label: 'Peso Chileno', flag: '🇨🇱', symbol: '$' },
];

type ActiveTab = 'all' | 'notifications' | 'currency' | 'goals' | 'system';

export function Settings() {
  const { notify } = useToast();
  const { currency, setCurrency, rate, rateDate, isLoadingRate } = useCurrency();
  const fmt = useFmt();

  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [form, setForm] = useState<SettingsState>({
    whatsapp_enabled: true,
    ai_analysis_enabled: true,
    daily_report_time: '08:00',
    whatsapp_number: '',
    telegram_enabled: false,
    telegram_bot_token: '',
    telegram_chat_id: '',
  });

  // Novo goal state
  const [goalName, setGoalName] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [goalCategory, setGoalCategory] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { settings, goals } = await api.getSettings();
      setForm({
        whatsapp_enabled: (settings.whatsapp_enabled as boolean) ?? true,
        ai_analysis_enabled: (settings.ai_analysis_enabled as boolean) ?? true,
        daily_report_time: (settings.daily_report_time as string) ?? '08:00',
        whatsapp_number: (settings.whatsapp_number as string) ?? '',
        telegram_enabled: (settings.telegram_enabled as boolean) ?? false,
        telegram_bot_token: (settings.telegram_bot_token as string) ?? '',
        telegram_chat_id: (settings.telegram_chat_id as string) ?? '',
      });
      setGoals(goals);
      setHasUnsavedChanges(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao carregar configurações.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateForm = (fields: Partial<SettingsState>) => {
    setForm((prev) => ({ ...prev, ...fields }));
    setHasUnsavedChanges(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.updateSettings({ ...form });
      notify('Configurações salvas com sucesso.', 'success');
      setHasUnsavedChanges(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao salvar configurações.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    key: string,
    fn: () => Promise<unknown>,
    okMsg: string,
  ) => {
    setBusy(key);
    try {
      await fn();
      notify(okMsg, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha na operação.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const addGoal = async () => {
    const amount = Number(goalAmount.replace(',', '.'));
    if (!goalName || !amount) {
      notify('Informe o nome e o valor da meta.', 'error');
      return;
    }
    setBusy('goal');
    try {
      const { goal } = await api.createGoal({
        name: goalName,
        type: goalCategory ? 'CATEGORY_BUDGET' : 'SPENDING_LIMIT',
        target_amount: amount,
        category: goalCategory || null,
      });
      setGoals((g) => [...g, goal]);
      setGoalName('');
      setGoalAmount('');
      setGoalCategory('');
      notify('Meta financeira criada.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao criar meta.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const removeGoal = async (id: string) => {
    setBusy(id);
    try {
      await api.deleteGoal(id);
      setGoals((g) => g.filter((x) => x.id !== id));
      notify('Meta removida.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao remover meta.', 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const isWhatsappActive = form.whatsapp_enabled && form.whatsapp_number.trim().length > 0;
  const isTelegramActive = form.telegram_enabled && form.telegram_bot_token.trim().length > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      {/* Top Header Banner & Global Actions */}
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-gold/10 text-accent-gold">
              <Sliders className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-text-primary">Configurações & Preferências</h1>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Personalize notificações automáticas, moedas de exibição, limites financeiros e automações de IA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
              <AlertCircle className="h-4 w-4 animate-pulse" />
              Alterações não salvas
            </span>
          )}
          <Button
            onClick={save}
            disabled={saving}
            className={cn(
              'relative overflow-hidden transition-all duration-200',
              hasUnsavedChanges ? 'shadow-lg shadow-accent-gold/20 ring-2 ring-accent-gold/50' : ''
            )}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </div>

      {/* Tabs Switcher Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-border/60 pb-2 scrollbar-none">
        <TabButton
          active={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          icon={<Sliders className="h-4 w-4" />}
          label="Visão Geral"
        />
        <TabButton
          active={activeTab === 'notifications'}
          onClick={() => setActiveTab('notifications')}
          icon={<MessageSquare className="h-4 w-4" />}
          label="Notificações"
          badge={
            (isWhatsappActive || isTelegramActive) ? (
              <span className="h-2 w-2 rounded-full bg-accent-green inline-block" />
            ) : undefined
          }
        />
        <TabButton
          active={activeTab === 'currency'}
          onClick={() => setActiveTab('currency')}
          icon={<Globe className="h-4 w-4" />}
          label="Moeda & Região"
          badge={<span className="text-xs font-mono font-bold text-accent-gold">{currency}</span>}
        />
        <TabButton
          active={activeTab === 'goals'}
          onClick={() => setActiveTab('goals')}
          icon={<Target className="h-4 w-4" />}
          label="Metas Financeiras"
          badge={goals.length > 0 ? <span className="rounded-full bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-secondary">{goals.length}</span> : undefined}
        />
        <TabButton
          active={activeTab === 'system'}
          onClick={() => setActiveTab('system')}
          icon={<Zap className="h-4 w-4" />}
          label="Ações do Sistema"
        />
      </div>

      {/* Grid Layout: Main Content (left) + System Summary Sidebar (right) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main Content Area */}
        <div className="space-y-6 lg:col-span-8">
          {/* SECTION: NOTIFICAÇÕES */}
          {(activeTab === 'all' || activeTab === 'notifications') && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-accent-green" />
                  Notificações & Canais de Alerta
                </h2>
                <span className="text-xs text-text-secondary">
                  Receba relatórios e análises preditivas direto no seu celular.
                </span>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* WHATSAPP CARD */}
                <Card className="flex flex-col justify-between transition-all duration-200 hover:border-border/80">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-green/10 text-accent-green">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        WhatsApp
                      </CardTitle>
                      <StatusBadge
                        active={isWhatsappActive}
                        label={isWhatsappActive ? 'Ativo' : 'Desativado'}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="rounded-lg bg-bg-elevated/40 p-3 space-y-3 border border-border/40">
                      <Toggle
                        label="Resumos automáticos no WhatsApp"
                        description="Envia balanços de ganhos e gastos"
                        checked={form.whatsapp_enabled}
                        onChange={(v) => updateForm({ whatsapp_enabled: v })}
                      />
                      <div className="h-px bg-border/40" />
                      <Toggle
                        label="Análise e alertas de IA"
                        description="Detecta anomalias e dicas preditivas"
                        checked={form.ai_analysis_enabled}
                        onChange={(v) => updateForm({ ai_analysis_enabled: v })}
                      />
                    </div>

                    <Field label="Horário do Relatório Diário" icon={<Clock className="h-3.5 w-3.5" />}>
                      <input
                        type="time"
                        value={form.daily_report_time}
                        onChange={(e) => updateForm({ daily_report_time: e.target.value })}
                        className="input font-mono"
                      />
                    </Field>

                    <Field label="Número WhatsApp (DDI + DDD + Número)" icon={<Phone className="h-3.5 w-3.5" />}>
                      <input
                        type="text"
                        placeholder="Ex: 5511999999999"
                        value={form.whatsapp_number}
                        onChange={(e) => updateForm({ whatsapp_number: e.target.value })}
                        className="input font-mono"
                      />
                    </Field>
                  </CardContent>
                </Card>

                {/* TELEGRAM CARD */}
                <Card className="flex flex-col justify-between transition-all duration-200 hover:border-border/80">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-blue/10 text-accent-blue">
                          <Send className="h-4 w-4 text-accent-blue" />
                        </div>
                        Telegram Bot
                      </CardTitle>
                      <StatusBadge
                        active={isTelegramActive}
                        label={isTelegramActive ? 'Ativo' : 'Pendente'}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="rounded-lg bg-bg-elevated/40 p-3 border border-border/40">
                      <Toggle
                        label="Enviar resumos pelo Telegram"
                        description="Mensagens automáticas via Bot dedicado"
                        checked={form.telegram_enabled}
                        onChange={(v) => updateForm({ telegram_enabled: v })}
                      />
                    </div>

                    <Field label="Bot Token" icon={<Key className="h-3.5 w-3.5" />}>
                      <div className="relative">
                        <input
                          type={showTelegramToken ? 'text' : 'password'}
                          placeholder="123456:ABC-DEF1234ghIkl..."
                          value={form.telegram_bot_token}
                          onChange={(e) => updateForm({ telegram_bot_token: e.target.value })}
                          className="input font-mono text-xs pr-9"
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          onClick={() => setShowTelegramToken((s) => !s)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                        >
                          {showTelegramToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </Field>

                    <Field label="Chat ID" icon={<Hash className="h-3.5 w-3.5" />}>
                      <input
                        type="text"
                        placeholder="Ex: 987654321"
                        value={form.telegram_chat_id}
                        onChange={(e) => updateForm({ telegram_chat_id: e.target.value })}
                        className="input font-mono"
                      />
                    </Field>

                    {/* Guia Rápido Telegram */}
                    <div className="rounded-lg border border-accent-blue/20 bg-accent-blue/5 p-3 text-xs text-text-secondary space-y-1.5">
                      <div className="flex items-center gap-1.5 font-medium text-text-primary">
                        <HelpCircle className="h-3.5 w-3.5 text-accent-blue" />
                        <span>Como configurar o Telegram:</span>
                      </div>
                      <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                        <li>Fale com <span className="font-semibold text-accent-blue">@BotFather</span> no Telegram e digite <code className="bg-bg-elevated px-1 py-0.5 rounded text-text-primary font-mono">/newbot</code>.</li>
                        <li>Copie o <strong>Bot Token</strong> gerado e cole no campo acima.</li>
                        <li>Envie qualquer mensagem para o seu bot e acesse o endpoint <code className="bg-bg-elevated px-1 rounded text-text-primary font-mono">getUpdates</code> para pegar seu <strong>Chat ID</strong>.</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* SECTION: MOEDA DE EXIBIÇÃO */}
          {(activeTab === 'all' || activeTab === 'currency') && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <Globe className="h-5 w-5 text-accent-gold" />
                      Moeda de Exibição do Sistema
                    </CardTitle>
                    <p className="mt-1 text-xs text-text-secondary">
                      Todos os valores e gráficos do painel serão convertidos automaticamente em tempo real.
                    </p>
                  </div>
                  <span className="rounded-full bg-accent-gold/10 px-3 py-1 text-xs font-semibold text-accent-gold border border-accent-gold/20">
                    {currency} ({CURRENCY_OPTIONS.find((c) => c.code === currency)?.symbol})
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Balanced 4-column Grid for all viewports */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {CURRENCY_OPTIONS.map((c) => {
                    const isSelected = currency === c.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={async () => {
                          setSavingCurrency(true);
                          try {
                            await setCurrency(c.code);
                            notify(`Moeda de exibição alterada para ${c.label} (${c.symbol}).`, 'success');
                          } catch {
                            notify('Falha ao salvar preferência de moeda.', 'error');
                          } finally {
                            setSavingCurrency(false);
                          }
                        }}
                        disabled={savingCurrency}
                        className={cn(
                          'relative flex flex-col items-center justify-center gap-1.5 rounded-xl border p-4 transition-all duration-200 text-center disabled:opacity-60',
                          isSelected
                            ? 'border-accent-gold bg-accent-gold/10 shadow-md shadow-accent-gold/5 ring-1 ring-accent-gold/30'
                            : 'border-border bg-bg-elevated/50 hover:border-accent-gold/50 hover:bg-bg-elevated'
                        )}
                      >
                        {isSelected && (
                          <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent-gold text-bg-primary text-[10px]">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </span>
                        )}
                        <span className="text-3xl transition-transform duration-200 hover:scale-110">{c.flag}</span>
                        <span className="font-mono text-sm font-bold text-text-primary">{c.symbol} · {c.code}</span>
                        <span className="text-xs text-text-secondary">{c.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Status da Cotação em Tempo Real */}
                {currency !== 'BRL' && (
                  <div className="rounded-xl border border-border/80 bg-bg-elevated/70 p-3.5 text-xs text-text-secondary">
                    {isLoadingRate ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-accent-gold" />
                        Buscando cotação em tempo real para {currency}...
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-2 w-2 rounded-full bg-accent-green animate-pulse" />
                          <span>Cotação atualizada:</span>
                          <span className="font-mono font-bold text-text-primary">
                            1 BRL = {rate.toFixed(4)} {currency}
                          </span>
                          {rateDate && <span className="text-text-muted">({rateDate})</span>}
                        </div>
                        <div className="rounded-md bg-bg-primary/60 px-2.5 py-1 text-text-muted font-mono">
                          Exemplo: R$ 100,00 = <strong className="text-accent-gold">{fmt(100)}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* SECTION: METAS FINANCEIRAS */}
          {(activeTab === 'all' || activeTab === 'goals') && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <Target className="h-5 w-5 text-accent-blue" />
                      Metas & Limites Orçamentários
                    </CardTitle>
                    <p className="mt-1 text-xs text-text-secondary">
                      Defina orçamentos por categoria ou limite geral de gastos para monitoramento inteligente.
                    </p>
                  </div>
                  <span className="rounded-full bg-bg-elevated px-3 py-1 text-xs text-text-secondary font-mono">
                    {goals.length} {goals.length === 1 ? 'meta' : 'metas'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Form para Adicionar Meta */}
                <div className="rounded-xl border border-border/80 bg-bg-elevated/40 p-3.5 space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5 text-accent-gold" />
                    Nova Meta Financeira
                  </span>
                  <div className="grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <input
                        placeholder="Ex: Teto da Fatura, Reserva..."
                        value={goalName}
                        onChange={(e) => setGoalName(e.target.value)}
                        className="input"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        placeholder="Valor (R$)"
                        value={goalAmount}
                        onChange={(e) => setGoalAmount(e.target.value)}
                        className="input font-mono"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <select
                        value={goalCategory}
                        onChange={(e) => setGoalCategory(e.target.value)}
                        className="input cursor-pointer"
                      >
                        <option value="">Geral (Sem categoria)</option>
                        {CATEGORY_NAMES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={addGoal}
                      disabled={busy === 'goal'}
                    >
                      {busy === 'goal' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Adicionar Meta
                    </Button>
                  </div>
                </div>

                {/* Lista de Metas */}
                <div className="space-y-2">
                  {goals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-8 text-center">
                      <Target className="h-8 w-8 text-text-muted/60 mb-2" />
                      <p className="text-sm font-medium text-text-primary">Nenhuma meta configurada</p>
                      <p className="text-xs text-text-secondary mt-0.5">Adicione um limite de gastos para receber alertas de estouro.</p>
                    </div>
                  ) : (
                    goals.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between rounded-xl border border-border bg-bg-elevated px-4 py-3 transition-colors hover:border-border/80"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-blue/10 text-accent-blue">
                            <Target className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{g.name}</p>
                            <div className="flex items-center gap-2 text-xs text-text-secondary">
                              <span className="font-mono font-medium text-accent-gold">{fmt(g.target_amount)}</span>
                              {g.category && (
                                <span className="rounded bg-bg-primary px-1.5 py-0.5 text-[10px] text-text-secondary">
                                  {g.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="danger"
                          size="icon"
                          onClick={() => removeGoal(g.id)}
                          disabled={busy === g.id}
                          aria-label="Remover meta"
                        >
                          {busy === g.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* SECTION: AÇÕES DO SISTEMA */}
          {(activeTab === 'all' || activeTab === 'system') && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Zap className="h-5 w-5 text-accent-gold" />
                  Ações Manuais & Execução de Jobs
                </CardTitle>
                <p className="text-xs text-text-secondary">
                  Execute gatilhos manuais de sincronização e geração de relatórios de IA sob demanda.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Button
                    variant="secondary"
                    className="flex flex-col items-start gap-1 p-3.5 h-auto justify-start text-left"
                    onClick={() => runAction('sync', () => api.sync(), 'Sincronização bancária concluída.')}
                    disabled={busy === 'sync'}
                  >
                    <div className="flex items-center gap-2 font-medium text-text-primary">
                      {busy === 'sync' ? (
                        <Loader2 className="h-4 w-4 animate-spin text-accent-gold" />
                      ) : (
                        <RefreshCw className="h-4 w-4 text-accent-blue" />
                      )}
                      Sincronizar Bancos
                    </div>
                    <span className="text-[11px] text-text-secondary leading-tight">
                      Atualizar extratos e saldos
                    </span>
                  </Button>

                  <Button
                    variant="secondary"
                    className="flex flex-col items-start gap-1 p-3.5 h-auto justify-start text-left"
                    onClick={() => runAction('daily', () => api.generateInsight('DAILY'), 'Insight diário gerado.')}
                    disabled={busy === 'daily'}
                  >
                    <div className="flex items-center gap-2 font-medium text-text-primary">
                      {busy === 'daily' ? (
                        <Loader2 className="h-4 w-4 animate-spin text-accent-gold" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-accent-gold" />
                      )}
                      Insight Diário
                    </div>
                    <span className="text-[11px] text-text-secondary leading-tight">
                      Gerar análise IA de hoje
                    </span>
                  </Button>

                  <Button
                    variant="secondary"
                    className="flex flex-col items-start gap-1 p-3.5 h-auto justify-start text-left"
                    onClick={() => runAction('monthly', () => api.generateInsight('MONTHLY'), 'Relatório mensal gerado.')}
                    disabled={busy === 'monthly'}
                  >
                    <div className="flex items-center gap-2 font-medium text-text-primary">
                      {busy === 'monthly' ? (
                        <Loader2 className="h-4 w-4 animate-spin text-accent-gold" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-accent-gold" />
                      )}
                      Relatório Mensal
                    </div>
                    <span className="text-[11px] text-text-secondary leading-tight">
                      Gerar compilado do mês
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* SIDEBAR COLUMN (Fills the right area on large displays seamlessly!) */}
        <div className="space-y-6 lg:col-span-4">
          {/* Card: Status do Sistema */}
          <Card className="border-border/80">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-text-secondary flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent-green" />
                Resumo do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                <span className="text-text-secondary flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-accent-green" /> WhatsApp
                </span>
                <span className={cn('font-semibold', isWhatsappActive ? 'text-accent-green' : 'text-text-muted')}>
                  {isWhatsappActive ? `Ativo (${form.daily_report_time})` : 'Desativado'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                <span className="text-text-secondary flex items-center gap-2">
                  <Send className="h-3.5 w-3.5 text-accent-blue" /> Telegram
                </span>
                <span className={cn('font-semibold', isTelegramActive ? 'text-accent-blue' : 'text-text-muted')}>
                  {isTelegramActive ? 'Conectado' : 'Pendente'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                <span className="text-text-secondary flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-accent-gold" /> Moeda Ativa
                </span>
                <span className="font-mono font-semibold text-text-primary">
                  {currency} ({CURRENCY_OPTIONS.find((c) => c.code === currency)?.symbol})
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-text-secondary flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-accent-blue" /> Metas Ativas
                </span>
                <span className="font-semibold text-text-primary">{goals.length} ativas</span>
              </div>
            </CardContent>
          </Card>

          {/* Card: Integrações Rápidas */}
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-text-secondary flex items-center gap-2">
                <Building2 className="h-4 w-4 text-accent-gold" />
                Conectores Bancários
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-border/70 bg-bg-elevated/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-500 font-bold text-xs">
                      S
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-text-primary">Banco Santander</p>
                      <p className="text-[10px] text-text-secondary">Open Finance / API Santander</p>
                    </div>
                  </div>
                  <span className="rounded bg-accent-green/10 px-2 py-0.5 text-[10px] font-semibold text-accent-green">
                    Disponível
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Conecte sua conta jurídica ou física Santander para sincronizar transações em tempo real.
                </p>
                <Link to="/configuracoes/conectar-santander">
                  <Button variant="secondary" size="sm" className="w-full justify-between text-xs mt-1">
                    <span>Configurar Santander</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Card: Segurança & Criptografia */}
          <div className="rounded-xl border border-accent-gold/20 bg-accent-gold/5 p-4 text-xs text-text-secondary space-y-2">
            <div className="flex items-center gap-2 font-semibold text-text-primary">
              <ShieldCheck className="h-4 w-4 text-accent-gold" />
              <span>Privacidade & Segurança</span>
            </div>
            <p className="text-[11px] leading-relaxed text-text-secondary">
              Seus tokens do Telegram e dados bancários são armazenados com criptografia de ponta e nunca expostos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Tab Button Sub-component */
function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-medium transition-all duration-200',
        active
          ? 'bg-accent-gold/15 text-accent-gold font-semibold shadow-sm border border-accent-gold/20'
          : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
      )}
    >
      {icon}
      <span>{label}</span>
      {badge}
    </button>
  );
}

/* Status Badge Sub-component */
function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border',
        active
          ? 'border-accent-green/30 bg-accent-green/10 text-accent-green'
          : 'border-border bg-bg-elevated text-text-muted'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          active ? 'bg-accent-green animate-pulse' : 'bg-text-muted'
        )}
      />
      {label}
    </span>
  );
}

/* Toggle Switch Sub-component */
function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <div>
        <p className="text-xs font-medium text-text-primary">{label}</p>
        {description && <p className="text-[11px] text-text-secondary">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-gold',
          checked ? 'bg-accent-green' : 'bg-text-muted/40'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

/* Field Container Sub-component */
function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

