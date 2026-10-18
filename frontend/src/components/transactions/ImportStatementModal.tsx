import { useState, useRef } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  Trash2,
  CheckSquare,
  Square,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  UploadCloud,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import { CATEGORY_NAMES } from '@/lib/categories';
import { useCurrency, type Currency } from '@/contexts/CurrencyContext';
import type { ConnectedAccount } from '@/types/finance';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  accounts: ConnectedAccount[];
  embedded?: boolean;
}

export interface StatementItem {
  id: string;
  selected: boolean;
  date: string;
  description: string;
  merchant_name?: string;
  amount: number;
  currency: Currency;
  category: string;
  transaction_type: string;
  is_expense: boolean;
}

const TX_TYPES = ['DEBIT', 'PIX', 'TED', 'BOLETO', 'CREDIT'] as const;

export function ImportStatementModal({ open, onClose, onImported, accounts, embedded = false }: Props) {
  const { notify } = useToast();
  const { currency } = useCurrency();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detectedInstitution, setDetectedInstitution] = useState<string | null>(null);
  const [items, setItems] = useState<StatementItem[]>([]);
  const [accountId, setAccountId] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');

  if (!open && !embedded) return null;

  const reset = () => {
    setScanning(false);
    setSaving(false);
    setDetectedInstitution(null);
    setItems([]);
    setAccountId('');
    setPastedText('');
    setActiveTab('upload');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleScanFile = async (file: File) => {
    const acceptedMimeTypes = [
      'application/pdf',
      'text/csv',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    
    const isImage = file.type.startsWith('image/');
    const isAcceptedDoc = acceptedMimeTypes.includes(file.type) || 
      file.name.endsWith('.csv') || 
      file.name.endsWith('.xlsx') || 
      file.name.endsWith('.xls');

    if (!isImage && !isAcceptedDoc) {
      notify('Por favor, selecione uma imagem (PNG/JPG), PDF, CSV ou planilha Excel.', 'error');
      return;
    }

    setScanning(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await api.scanStatement(base64, file.type);
      setDetectedInstitution(res.institution ?? null);

      const parsed: StatementItem[] = (res.transactions ?? []).map((t, index) => ({
        id: `scanned_${Date.now()}_${index}`,
        selected: true,
        date: t.date || new Date().toISOString().split('T')[0],
        description: t.description || t.merchant_name || 'Sem descrição',
        merchant_name: t.merchant_name,
        amount: Math.abs(Number(t.amount) || 0),
        currency: (t.currency as Currency) || (res.currency as Currency) || currency || 'BRL',
        category: t.category || '',
        transaction_type: t.transaction_type || 'DEBIT',
        is_expense: t.is_expense !== false,
      }));

      setItems(parsed);
      if (parsed.length > 0) {
        notify(`${parsed.length} transações identificadas pela IA!`, 'success');
      } else {
        notify('Nenhuma transação identificada no arquivo. Tente outro formato ou copie e cole o texto.', 'error');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao analisar o extrato.', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleScanText = async () => {
    if (!pastedText.trim()) return;
    setScanning(true);
    try {
      const res = await api.scanStatement(undefined, undefined, pastedText);
      setDetectedInstitution(res.institution ?? null);

      const parsed: StatementItem[] = (res.transactions ?? []).map((t, index) => ({
        id: `scanned_${Date.now()}_${index}`,
        selected: true,
        date: t.date || new Date().toISOString().split('T')[0],
        description: t.description || t.merchant_name || 'Sem descrição',
        merchant_name: t.merchant_name,
        amount: Math.abs(Number(t.amount) || 0),
        currency: (t.currency as Currency) || (res.currency as Currency) || currency || 'BRL',
        category: t.category || '',
        transaction_type: t.transaction_type || 'DEBIT',
        is_expense: t.is_expense !== false,
      }));

      setItems(parsed);
      if (parsed.length > 0) {
        notify(`${parsed.length} transações identificadas pela IA!`, 'success');
      } else {
        notify('Nenhuma transação identificada no texto fornecido.', 'error');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao analisar o extrato.', 'error');
    } finally {
      setScanning(false);
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
    const pasteItems = e.clipboardData.items;
    for (let i = 0; i < pasteItems.length; i++) {
      if (pasteItems[i].type.startsWith('image/')) {
        const file = pasteItems[i].getAsFile();
        if (file) {
          void handleScanFile(file);
          break;
        }
      }
    }
  };

  const toggleSelectAll = () => {
    const allSelected = items.every((i) => i.selected);
    setItems((prev) => prev.map((item) => ({ ...item, selected: !allSelected })));
  };

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)),
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, fields: Partial<StatementItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...fields } : item)),
    );
  };

  const handleImport = async () => {
    const selectedItems = items.filter((i) => i.selected && i.amount > 0);
    if (selectedItems.length === 0) {
      notify('Nenhuma transação selecionada para importar.', 'error');
      return;
    }

    setSaving(true);
    try {
      // Processa câmbio de cada transação selecionada se não for BRL
      const payload = await Promise.all(
        selectedItems.map(async (item) => {
          let exchangeRate = 1.0;
          if (item.currency !== 'BRL') {
            try {
              const res = await fetch(
                `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${item.date}/v1/currencies/brl.json`,
              );
              if (res.ok) {
                const data = (await res.json()) as { brl: Record<string, number> };
                const rate = data.brl[item.currency.toLowerCase()];
                if (rate) exchangeRate = 1 / rate;
              }
            } catch {
              // fallback
              exchangeRate = item.currency === 'USD' ? 5.5 : item.currency === 'EUR' ? 6.0 : 0.0057;
            }
          }

          const baseAmount = item.amount * exchangeRate;
          return {
            date: item.date,
            amount: item.is_expense ? -Math.abs(baseAmount) : Math.abs(baseAmount),
            description: item.description.trim(),
            category: item.category || undefined,
            transaction_type: item.transaction_type,
            account_id: accountId || undefined,
            original_currency: item.currency,
            original_amount: item.is_expense ? -Math.abs(item.amount) : Math.abs(item.amount),
            exchange_rate: exchangeRate,
          };
        }),
      );

      const res = await api.createTransactionsBatch(payload);
      notify(`${res.count} transações importadas com sucesso!`, 'success');
      onImported();
      handleClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao salvar as transações.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = items.filter((i) => i.selected).length;

  const content = (
    <div className={`relative flex w-full flex-col rounded-2xl border border-border bg-bg-card animate-fade-in ${embedded ? 'shadow-none' : 'max-h-[92vh] max-w-4xl shadow-2xl'}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-gold/15 text-accent-gold">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-text-primary">
              Importar Extrato com IA
            </h2>
            <p className="text-xs text-text-secondary">
              Carregue PDF, Excel, CSV, imagem ou cole o texto do seu extrato
            </p>
          </div>
        </div>
        {!embedded && (
          <button
            onClick={handleClose}
            className="cursor-pointer rounded-lg p-1.5 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

        {/* Upload Zone / Drop Area */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*,application/pdf,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {items.length === 0 && !scanning && (
          <div className="flex border-b border-border bg-bg-elevated/20 px-6">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
                activeTab === 'upload'
                  ? 'border-accent-gold text-accent-gold'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              <UploadCloud className="h-4 w-4" />
              Upload de Arquivo
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
                activeTab === 'paste'
                  ? 'border-accent-gold text-accent-gold'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              Colar Texto
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center sm:p-10 min-h-[350px]">
            {scanning ? (
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-gold/10 text-accent-gold">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <Sparkles className="absolute -right-1 -top-1 h-5 w-5 text-accent-gold animate-bounce" />
                </div>
                <div>
                  <h3 className="font-medium text-text-primary">
                    Analisando extrato com Inteligência Artificial...
                  </h3>
                  <p className="mt-1 max-w-sm text-xs text-text-secondary">
                    Identificando todas as transações, valores, datas e categorizando os lançamentos.
                  </p>
                </div>
              </div>
            ) : activeTab === 'upload' ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group flex w-full max-w-lg cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-8 transition-colors hover:border-accent-gold/60 hover:bg-bg-elevated/40"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-gold/10 text-accent-gold transition-transform group-hover:scale-110">
                  <UploadCloud className="h-7 w-7" />
                </div>
                <h3 className="font-medium text-text-primary">
                  Selecione ou arraste o extrato bancário
                </h3>
                <p className="mt-1 text-xs text-text-secondary">
                  Aceita PDF, Excel (.xlsx/.xls), CSV, TXT ou print de tela (PNG/JPG).
                </p>
                <div className="mt-4 flex items-center gap-2 rounded-full border border-border bg-bg-elevated px-3 py-1 text-[11px] text-text-muted">
                  <Sparkles className="h-3 w-3 text-accent-gold" />
                  Dica: você também pode arrastar o arquivo ou colar prints direto com <kbd className="font-mono font-semibold">Ctrl + V</kbd>
                </div>
                <Button size="sm" className="mt-5 gap-1.5" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                  <UploadCloud className="h-4 w-4" />
                  Escolher arquivo
                </Button>
              </div>
            ) : (
              <div className="w-full max-w-xl text-left bg-bg-elevated/30 border border-border p-5 rounded-2xl animate-fade-in">
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Cole aqui as transações copiadas:
                </label>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Exemplo de texto copiado:&#10;10/08/2026 Padaria Silva -R$ 15,00&#10;12/08/2026 PIX Recebido de João R$ 500,00&#10;Tarifa bancária mensal -R$ 29,90"
                  className="input min-h-[160px] w-full font-mono text-xs p-3 align-top resize-y"
                />
                <p className="mt-2 text-[11px] text-text-muted">
                  Nossa IA processa tabelas desformatadas, faturas de cartão e mensagens de banco para separar os dados corretamente.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPastedText('')}
                    disabled={!pastedText}
                  >
                    Limpar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void handleScanText()}
                    disabled={!pastedText || scanning}
                    className="gap-1.5"
                  >
                    <Sparkles className="h-4 w-4 text-accent-gold" />
                    Analisar Texto
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Header com ações e seleção de conta */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg-elevated/50 px-6 py-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
                >
                  {items.every((i) => i.selected) ? (
                    <CheckSquare className="h-4 w-4 text-accent-gold" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {selectedCount} de {items.length} selecionadas
                </button>
                {detectedInstitution && (
                  <span className="rounded-md bg-accent-gold/15 px-2.5 py-0.5 text-xs font-semibold text-accent-gold">
                    🏦 {detectedInstitution}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-text-muted hover:text-accent-gold transition-colors"
                >
                  Substituir print
                </button>
                {accounts.length > 0 && (
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="input h-8 text-xs py-1 cursor-pointer bg-bg-elevated"
                  >
                    <option value="">Nenhuma conta vinculada</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.institution_name} — {a.account_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Tabela de Transações Detectadas */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex flex-col gap-2 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center sm:gap-3 ${
                      item.selected
                        ? 'border-border bg-bg-elevated/60'
                        : 'border-border/40 bg-bg-card opacity-50'
                    }`}
                  >
                    {/* Checkbox e tipo (despesa/receita) */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        className="cursor-pointer text-text-secondary hover:text-text-primary"
                      >
                        {item.selected ? (
                          <CheckSquare className="h-4 w-4 text-accent-gold" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, { is_expense: !item.is_expense })}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                          item.is_expense
                            ? 'border-accent-red/40 bg-accent-red/10 text-accent-red'
                            : 'border-accent-green/40 bg-accent-green/10 text-accent-green'
                        }`}
                        title={item.is_expense ? 'Despesa' : 'Receita'}
                      >
                        {item.is_expense ? (
                          <TrendingDown className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingUp className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Data */}
                    <input
                      type="date"
                      value={item.date}
                      onChange={(e) => updateItem(item.id, { date: e.target.value })}
                      className="input h-8 w-32 shrink-0 text-xs"
                    />

                    {/* Descrição */}
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      placeholder="Descrição"
                      className="input h-8 flex-1 text-xs"
                    />

                    {/* Categoria */}
                    <select
                      value={item.category}
                      onChange={(e) => updateItem(item.id, { category: e.target.value })}
                      className="input h-8 w-36 shrink-0 text-xs cursor-pointer"
                    >
                      <option value="">Sem categoria</option>
                      {CATEGORY_NAMES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>

                    {/* Tipo */}
                    <select
                      value={item.transaction_type}
                      onChange={(e) => updateItem(item.id, { transaction_type: e.target.value })}
                      className="input h-8 w-24 shrink-0 text-xs cursor-pointer"
                    >
                      {TX_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>

                    {/* Moeda */}
                    <select
                      value={item.currency}
                      onChange={(e) => updateItem(item.id, { currency: e.target.value as Currency })}
                      className="input h-8 w-20 shrink-0 text-xs cursor-pointer"
                    >
                      <option value="BRL">BRL</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="CLP">CLP</option>
                    </select>

                    {/* Valor */}
                    <div className="relative w-28 shrink-0">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={item.amount || ''}
                        onChange={(e) =>
                          updateItem(item.id, { amount: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="0,00"
                        className="input h-8 w-full font-mono text-xs text-right font-semibold"
                      />
                    </div>

                    {/* Botão Remover */}
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="cursor-pointer p-1 text-text-muted hover:text-accent-red transition-colors shrink-0"
                      title="Excluir item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer com botão Importar */}
            <div className="flex items-center justify-between border-t border-border bg-bg-card p-4 sm:px-6">
              <span className="text-xs text-text-secondary">
                Total a importar: <strong className="font-mono text-text-primary">{selectedCount} transações</strong>
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleClose} disabled={saving}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleImport()}
                  disabled={saving || selectedCount === 0}
                  className="gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Importar {selectedCount} selecionada{selectedCount === 1 ? '' : 's'}
                </Button>
              </div>
            </div>
          </div>
        )}
    </div>
  );

  if (embedded) {
    return (
      <div className="w-full" onPaste={handlePaste}>
        {content}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      onPaste={handlePaste}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 animate-fade-in"
        onClick={handleClose}
        aria-hidden="true"
      />
      {content}
    </div>
  );
}
