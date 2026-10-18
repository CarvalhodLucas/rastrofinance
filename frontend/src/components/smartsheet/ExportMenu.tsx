import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useSmartSheet } from '@/contexts/SmartSheetContext';
import { api } from '@/services/api';

function rowsToCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))];
  return lines.join('\n');
}

export function ExportMenu() {
  const { state } = useSmartSheet();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const exportCsv = () => {
    const { columns, rows } = state;
    const headers = columns.map((c) => c.key);
    const csv = rowsToCsv(headers, rows as Array<Record<string, unknown>>);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rastro-finance-${state.activeView}-${state.period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const sendInsight = async () => {
    if (!state.insight || sending) return;
    setSending(true);
    setOpen(false);
    try {
      await api.smartsheetSendInsight(state.insight);
    } catch { /* silently fail */ }
    finally { setSending(false); }
  };

  return (
    <div ref={ref} className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)} className="gap-1.5">
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Exportar</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 min-w-[180px] overflow-hidden rounded-xl border border-border bg-bg-card shadow-xl">
          <button
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
            onClick={exportCsv}
          >
            <FileText className="h-4 w-4" />
            Exportar como CSV
          </button>
          <button
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary disabled:opacity-40"
            onClick={() => void sendInsight()}
            disabled={!state.insight || sending}
          >
            <Send className="h-4 w-4" />
            {sending ? 'Enviando…' : 'Enviar resumo no WhatsApp'}
          </button>
        </div>
      )}
    </div>
  );
}
