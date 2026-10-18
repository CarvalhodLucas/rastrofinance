import { useState } from 'react';
import { X, FileSpreadsheet, Plus, Trash2, CheckCircle, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import type { AssetType } from '@/types/finance';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface B3ImportRow {
  id: string;
  name: string;
  ticker: string;
  type: AssetType;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
}

export function ImportB3Modal({ open, onClose, onSuccess }: Props) {
  const { notify } = useToast();
  const [rows, setRows] = useState<B3ImportRow[]>([
    {
      id: '1',
      name: 'Petrobras PN',
      ticker: 'PETR4',
      type: 'STOCK',
      quantity: 100,
      averagePrice: 32.50,
      currentPrice: 38.00,
    },
    {
      id: '2',
      name: 'MXRF11 FII',
      ticker: 'MXRF11',
      type: 'FII',
      quantity: 500,
      averagePrice: 10.10,
      currentPrice: 10.45,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [showPaste, setShowPaste] = useState(false);

  if (!open) return null;

  const handleAddRow = () => {
    setRows([
      ...rows,
      {
        id: String(Date.now()),
        name: '',
        ticker: '',
        type: 'STOCK',
        quantity: 0,
        averagePrice: 0,
        currentPrice: 0,
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter((r) => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof B3ImportRow, value: any) => {
    setRows(
      rows.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'ticker' && typeof value === 'string') {
          const upper = value.toUpperCase();
          updated.ticker = upper;
          if (upper.endsWith('11')) {
            updated.type = 'FII';
          }
        }
        return updated;
      })
    );
  };

  const parsePastedText = () => {
    if (!pastedText.trim()) return;
    const lines = pastedText.split('\n');
    const newRows: B3ImportRow[] = [];

    for (const line of lines) {
      const parts = line.split(/[\t,;]/).map((p) => p.trim());
      if (parts.length < 2) continue;

      const ticker = parts[0].toUpperCase();
      const qty = parseFloat(parts[1].replace(/\./g, '').replace(',', '.')) || 0;
      const avgPrice = parts[2] ? parseFloat(parts[2].replace(/\./g, '').replace(',', '.')) || 0 : 0;
      const curPrice = parts[3] ? parseFloat(parts[3].replace(/\./g, '').replace(',', '.')) || avgPrice : avgPrice;

      if (ticker) {
        newRows.push({
          id: Math.random().toString(36).substring(2, 9),
          name: ticker,
          ticker,
          type: ticker.endsWith('11') ? 'FII' : ticker.includes('TESOURO') ? 'FIXED_INCOME' : 'STOCK',
          quantity: qty,
          averagePrice: avgPrice,
          currentPrice: curPrice,
        });
      }
    }

    if (newRows.length > 0) {
      setRows(newRows);
      setShowPaste(false);
      setPastedText('');
      notify(`${newRows.length} ativo(s) detectado(s) do texto colado!`, 'success');
    } else {
      notify('Não foi possível identificar o formato dos dados.', 'error');
    }
  };

  const handleSubmit = async () => {
    const validRows = rows.filter((r) => r.ticker.trim() && r.quantity > 0);
    if (validRows.length === 0) {
      notify('Preencha ao menos um ativo com Ticker e Quantidade válidos.', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.importB3(
        validRows.map((r) => ({
          name: r.name.trim() || r.ticker.trim(),
          ticker: r.ticker.trim(),
          type: r.type,
          institution: 'B3',
          quantity: r.quantity,
          averagePrice: r.averagePrice,
          currentPrice: r.currentPrice || r.averagePrice,
        }))
      );
      notify(`Sucesso! ${validRows.length} ativo(s) da B3 foram importados.`, 'success');
      onSuccess();
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao importar ativos da B3.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-gold/10 text-accent-gold border border-accent-gold/20">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Importar Posição da B3</h2>
              <p className="text-xs text-text-secondary">Ações, FIIs e Renda Fixa negociados na Bolsa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="rounded-xl border border-border bg-bg-elevated/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-text-secondary">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-accent-gold shrink-0" />
              <span>Copie e cole a tabela do relatório da B3 ou preencha os ativos abaixo:</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPaste(!showPaste)}
              className="shrink-0 text-xs"
            >
              {showPaste ? 'Ocultar Caixa de Texto' : 'Colar Tabela (Copiar/Colar)'}
            </Button>
          </div>

          {showPaste && (
            <div className="rounded-xl border border-accent-gold/30 bg-bg-primary p-4 space-y-3">
              <label className="block text-xs font-medium text-text-primary">
                Cole o texto copiado da B3 ou Excel (Formato: Ticker [Tab] Quantidade [Tab] Preço Médio)
              </label>
              <textarea
                rows={4}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={"PETR4\t100\t32.50\t38.00\nMXRF11\t500\t10.10\t10.45"}
                className="w-full rounded-lg border border-border bg-bg-card p-3 text-xs font-mono text-text-primary placeholder:text-text-secondary/50 focus:border-accent-gold focus:outline-none"
              />
              <Button size="sm" onClick={parsePastedText} className="bg-accent-gold text-black font-medium">
                Processar Texto Colado
              </Button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-border bg-bg-primary">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-bg-elevated/60 text-text-secondary">
                <tr>
                  <th className="px-3.5 py-3">Ticker / Código</th>
                  <th className="px-3.5 py-3">Nome / Descrição</th>
                  <th className="px-3.5 py-3">Tipo</th>
                  <th className="px-3.5 py-3">Qtd</th>
                  <th className="px-3.5 py-3">Preço Médio (R$)</th>
                  <th className="px-3.5 py-3">Preço Atual (R$)</th>
                  <th className="px-3.5 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-bg-elevated/20 transition-colors">
                    <td className="p-2.5">
                      <input
                        type="text"
                        value={row.ticker}
                        onChange={(e) => handleUpdateRow(row.id, 'ticker', e.target.value)}
                        placeholder="Ex: PETR4"
                        className="w-24 rounded-lg border border-border bg-bg-card px-2.5 py-1.5 font-semibold uppercase text-text-primary focus:border-accent-gold focus:outline-none"
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => handleUpdateRow(row.id, 'name', e.target.value)}
                        placeholder="Ex: Petrobras PN"
                        className="w-full rounded-lg border border-border bg-bg-card px-2.5 py-1.5 text-text-primary focus:border-accent-gold focus:outline-none"
                      />
                    </td>
                    <td className="p-2.5">
                      <select
                        value={row.type}
                        onChange={(e) => handleUpdateRow(row.id, 'type', e.target.value as AssetType)}
                        className="rounded-lg border border-border bg-bg-card px-2 py-1.5 text-text-primary focus:border-accent-gold focus:outline-none"
                      >
                        <option value="STOCK">Ação</option>
                        <option value="FII">FII (Fundo Imob.)</option>
                        <option value="FIXED_INCOME">Renda Fixa</option>
                        <option value="OTHER">Outros</option>
                      </select>
                    </td>
                    <td className="p-2.5">
                      <input
                        type="number"
                        step="any"
                        value={row.quantity || ''}
                        onChange={(e) => handleUpdateRow(row.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-20 rounded-lg border border-border bg-bg-card px-2 py-1.5 text-text-primary focus:border-accent-gold focus:outline-none"
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="number"
                        step="any"
                        value={row.averagePrice || ''}
                        onChange={(e) => handleUpdateRow(row.id, 'averagePrice', parseFloat(e.target.value) || 0)}
                        className="w-24 rounded-lg border border-border bg-bg-card px-2 py-1.5 text-text-primary focus:border-accent-gold focus:outline-none"
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="number"
                        step="any"
                        value={row.currentPrice || ''}
                        onChange={(e) => handleUpdateRow(row.id, 'currentPrice', parseFloat(e.target.value) || 0)}
                        className="w-24 rounded-lg border border-border bg-bg-card px-2 py-1.5 text-text-primary focus:border-accent-gold focus:outline-none"
                      />
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        onClick={() => handleRemoveRow(row.id)}
                        className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button type="button" variant="outline" onClick={handleAddRow} className="w-full text-xs">
            <Plus className="mr-1.5 h-4 w-4" />
            Adicionar Linha de Ativo
          </Button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border p-4 bg-bg-elevated/30">
          <div className="text-xs text-text-secondary">
            Total de ativos a importar: <span className="font-semibold text-text-primary">{rows.length}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="bg-accent-gold text-black font-semibold">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar Importação
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
