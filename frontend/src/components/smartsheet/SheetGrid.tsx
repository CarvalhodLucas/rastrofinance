import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Search, Grid, Table as TableIcon, Calculator, Columns, Rows } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateShort } from '@/lib/format';
import { useFmt } from '@/contexts/CurrencyContext';
import { categoryMeta } from '@/lib/categories';
import { useSmartSheet } from '@/contexts/SmartSheetContext';
import type { SheetColumn, SheetRow } from '@/types/smartsheet';

// --- Cell renderers ---

function CurrencyCell({ value, rowType }: { value: number | null; rowType?: string }) {
  const fmt = useFmt();
  if (value === null) return <span className="text-text-muted">—</span>;
  const isIncome = rowType === 'income' || value > 0;
  const isExpense = rowType === 'expense' || value < 0;
  return (
    <span className={cn(
      'font-mono text-xs font-semibold tabular-nums',
      isIncome ? 'text-accent-green' : isExpense ? 'text-accent-red' : value >= 0 ? 'text-accent-green' : 'text-accent-red'
    )}>
      {fmt(Math.abs(value))}
    </span>
  );
}

function VariationCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-text-muted">—</span>;
  const lower = value <= 0;
  return (
    <span className={cn('font-mono text-xs font-semibold tabular-nums', lower ? 'text-accent-green' : 'text-accent-red')}>
      {lower ? '↓' : '↑'} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function PercentageCell({ value, maxPct = 100 }: { value: number | null; maxPct?: number }) {
  if (value === null) return <span className="text-text-muted">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elevated">
        <div
          className="h-full rounded-full bg-accent-gold"
          style={{ width: `${Math.min((value / maxPct) * 100, 100)}%` }}
        />
      </div>
      <span className="w-10 text-right font-mono text-xs tabular-nums text-text-secondary">
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function TrendCell({ value }: { value: string | null }) {
  const colorMap: Record<string, string> = { '↗': 'text-accent-green', '↘': 'text-accent-red', '→': 'text-text-muted' };
  return <span className={cn('text-lg', colorMap[value as string] ?? 'text-text-muted')}>{value ?? '—'}</span>;
}

function BadgeCell({ value, col, row }: { value: string | null; col: string; row: SheetRow }) {
  if (!value) return <span className="text-text-muted">—</span>;

  if (row.isSectionHeader) {
    return <span className="font-bold tracking-wide uppercase text-sm">{value}</span>;
  }

  if (col === 'status') {
    const active = value === 'Ativo';
    return (
      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', active ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-gold/15 text-accent-gold')}>
        {value}
      </span>
    );
  }

  const meta = categoryMeta(value);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-text-primary">
      <span>{meta.icon}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function DateCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-text-muted">—</span>;
  return <span className="text-xs text-text-secondary">{formatDateShort(value)}</span>;
}

function CountCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-text-muted">—</span>;
  return <span className="text-center text-sm font-medium tabular-nums text-text-primary">{value}</span>;
}

function TextCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-text-muted">—</span>;
  return <span className="text-sm text-text-primary line-clamp-1">{value}</span>;
}

// --- Inline Sparkline helper ---
function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 60;
  const height = 16;
  const points = values.map((val, idx) => {
    const x = (idx / (values.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="flex items-center justify-center h-full">
      <svg width={width} height={height} className="overflow-visible stroke-accent-gold stroke-2 fill-none opacity-85 hover:opacity-100 transition-opacity">
        <polyline points={points} strokeLinecap="round" strokeLinejoin="round" />
        {values.map((val, idx) => {
          const x = (idx / (values.length - 1)) * width;
          const y = height - ((val - min) / range) * height;
          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r={2}
              className={idx === values.length - 1 ? 'fill-accent-gold' : 'fill-text-muted'}
            />
          );
        })}
      </svg>
    </div>
  );
}

function renderCell(col: SheetColumn, row: SheetRow, maxPct: number) {
  if (col.key === 'sparkline') {
    const m0 = Number(row.m0) || 0;
    const m1 = Number(row.m1) || 0;
    const m2 = Number(row.m2) || 0;
    return <Sparkline values={[m0, m1, m2]} />;
  }

  const val = row[col.key];
  switch (col.type) {
    case 'currency':   return <CurrencyCell value={val as number | null} rowType={row.rowType} />;
    case 'variation':  return <VariationCell value={val as number | null} />;
    case 'percentage': return <PercentageCell value={val as number | null} maxPct={maxPct} />;
    case 'trend':      return <TrendCell value={val as string | null} />;
    case 'badge':      return <BadgeCell value={val as string | null} col={col.key} row={row} />;
    case 'date':       return <DateCell value={val as string | null} />;
    case 'count':      return <CountCell value={val as number | null} />;
    default:           return <TextCell value={val as string | null} />;
  }
}

const WIDTH_CLASS: Record<string, string> = {
  sm: 'w-24',
  md: 'w-36',
  lg: 'w-64',
  auto: 'min-w-[8rem]',
};

const EXCEL_COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// --- Math formula evaluator helper ---
const parseAndEvaluate = (text: string): number | null => {
  if (!text.startsWith('=')) {
    const val = Number(text);
    return isNaN(val) ? null : val;
  }
  const expr = text.slice(1).trim().toUpperCase();
  if (expr.startsWith('SOMA(') && expr.endsWith(')')) {
    const inside = expr.slice(5, -1);
    const parts = inside.split(',').map(x => Number(x.trim()));
    const sum = parts.reduce((s, x) => s + (isNaN(x) ? 0 : x), 0);
    return sum;
  }
  const safeExpr = expr.replace(/[^0-9+\-*/.()]/g, '');
  try {
    const fn = new Function(`return (${safeExpr})`);
    const res = fn() as number;
    return typeof res === 'number' && !isNaN(res) ? res : null;
  } catch {
    return null;
  }
};

// --- Sub-row ---
function SubRow({
  row,
  columns,
  isLoading,
  excelMode,
  rowIndex,
  selectedCell,
  editingCell,
  onSelectCell,
  onDoubleClickCell,
  onChangeEditingVal,
  onSaveCell,
  getHeatmapStyle,
}: {
  row: SheetRow;
  columns: SheetColumn[];
  isLoading: boolean;
  excelMode: boolean;
  rowIndex: string;
  selectedCell: { rowId: string; colKey: string } | null;
  editingCell: { rowId: string; colKey: string; val: string } | null;
  onSelectCell: (rowId: string, colKey: string) => void;
  onDoubleClickCell: (rowId: string, colKey: string) => void;
  onChangeEditingVal: (val: string) => void;
  onSaveCell: (rowId: string, colKey: string, val: string) => void;
  getHeatmapStyle: (col: SheetColumn, row: SheetRow, val: unknown) => React.CSSProperties;
}) {
  return (
    <tr className={cn('border-b border-border/30 bg-bg-elevated/20', isLoading && 'animate-pulse opacity-40')}>
      {excelMode && (
        <td className={cn(
          'w-10 border-r border-border bg-bg-elevated px-2 py-1 text-center font-mono text-[10px] text-text-muted select-none transition-colors',
          selectedCell?.rowId === row.id && 'bg-accent-gold/15 text-accent-gold font-bold border-r-2 border-r-accent-gold'
        )}>
          {rowIndex}
        </td>
      )}
      {columns.map((col, ci) => {
        const isSelected = selectedCell?.rowId === row.id && selectedCell?.colKey === col.key;
        const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === col.key;
        const val = row[col.key];

        const isNumeric = col.type === 'currency' || col.key.startsWith('m');
        const canEdit = isNumeric;

        return (
          <td
            key={col.key}
            style={getHeatmapStyle(col, row, val)}
            className={cn(
              'px-4 py-2 text-xs relative select-none border-b border-border/20',
              ci === 0 && 'pl-10',
              excelMode && 'border-r border-border/40',
              isSelected && 'outline outline-2 -outline-offset-2 outline-accent-gold bg-accent-gold/5 shadow-[inset_0_0_8px_rgba(245,158,11,0.05)]',
              WIDTH_CLASS[col.width] ?? WIDTH_CLASS.auto
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSelectCell(row.id, col.key);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (canEdit) onDoubleClickCell(row.id, col.key);
            }}
          >
            {isEditing ? (
              <input
                type="text"
                value={editingCell.val}
                onChange={(e) => onChangeEditingVal(e.target.value)}
                className="absolute inset-0 w-full h-full bg-[#1b1c26] text-text-primary px-3 py-1 font-mono text-xs border border-accent-gold outline-none z-10"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    onSaveCell(row.id, col.key, editingCell.val);
                  }
                }}
                onBlur={() => {
                  onSaveCell(row.id, col.key, editingCell.val);
                }}
              />
            ) : (
              <div className="flex items-center gap-1 truncate">
                {ci === 0 && <span className="text-accent-gold/70 font-mono text-xs font-bold mr-1 select-none">└</span>}
                {renderCell(col, row, 100)}
              </div>
            )}

            {excelMode && isSelected && !isEditing && (
              <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-accent-gold z-10 cursor-crosshair" />
            )}
          </td>
        );
      })}
    </tr>
  );
}

// --- Main row ---
function GridRow({
  row,
  columns,
  expandable,
  isLoading,
  maxPct,
  excelMode,
  rowIndex,
  selectedCell,
  editingCell,
  onSelectCell,
  onDoubleClickCell,
  onChangeEditingVal,
  onSaveCell,
  expandedRows,
  toggleRowExpanded,
  getHeatmapStyle,
}: {
  row: SheetRow;
  columns: SheetColumn[];
  expandable: boolean;
  isLoading: boolean;
  maxPct: number;
  excelMode: boolean;
  rowIndex: number;
  selectedCell: { rowId: string; colKey: string } | null;
  editingCell: { rowId: string; colKey: string; val: string } | null;
  onSelectCell: (rowId: string, colKey: string) => void;
  onDoubleClickCell: (rowId: string, colKey: string) => void;
  onChangeEditingVal: (val: string) => void;
  onSaveCell: (rowId: string, colKey: string, val: string) => void;
  expandedRows: Set<string>;
  toggleRowExpanded: (rowId: string) => void;
  getHeatmapStyle: (col: SheetColumn, row: SheetRow, val: unknown) => React.CSSProperties;
}) {
  const expanded = expandedRows.has(row.id);
  const hasSubRows = expandable && Array.isArray(row.subRows) && (row.subRows as SheetRow[]).length > 0;

  const isSection = row.isSectionHeader;
  const rowBgClass = isSection
    ? row.rowType === 'header'
      ? row.id.includes('income')
        ? 'bg-accent-green/10 border-l-4 border-l-accent-green font-semibold'
        : 'bg-accent-red/10 border-l-4 border-l-accent-red font-semibold'
      : row.rowType === 'net'
      ? 'bg-accent-gold/15 border-l-4 border-l-accent-gold font-bold text-accent-gold'
      : 'bg-bg-elevated font-semibold'
    : row.rowType === 'income'
    ? 'hover:bg-accent-green/5'
    : row.rowType === 'expense'
    ? 'hover:bg-accent-red/5'
    : 'hover:bg-bg-elevated/60';

  return (
    <>
      <tr
        className={cn(
          'border-b border-border transition-colors',
          rowBgClass,
          hasSubRows && 'cursor-pointer',
          isLoading && 'animate-pulse opacity-40',
        )}
        onClick={() => { if (hasSubRows) toggleRowExpanded(row.id); }}
      >
        {excelMode && (
          <td className={cn(
            'w-10 border-r border-border bg-bg-card px-2 py-2.5 text-center font-mono text-[11px] text-text-muted select-none transition-colors',
            selectedCell?.rowId === row.id && 'bg-accent-gold/15 text-accent-gold font-bold border-r-2 border-r-accent-gold'
          )}>
            {rowIndex}
          </td>
        )}
        {columns.map((col, ci) => {
          const isSelected = selectedCell?.rowId === row.id && selectedCell?.colKey === col.key;
          const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === col.key;
          const val = row[col.key];

          const isNumeric = col.type === 'currency' || col.key.startsWith('m');
          const canEdit = !row.isSectionHeader && isNumeric;

          return (
            <td
              key={col.key}
              style={getHeatmapStyle(col, row, val)}
              className={cn(
                'px-4 py-2.5 transition-all relative border-b border-border/40 select-none text-xs',
                excelMode && 'border-r border-border/40',
                isSelected && 'outline outline-2 -outline-offset-2 outline-accent-gold bg-accent-gold/5 shadow-[inset_0_0_8px_rgba(245,158,11,0.05)]',
                WIDTH_CLASS[col.width] ?? WIDTH_CLASS.auto
              )}
              onClick={(e) => {
                e.stopPropagation();
                onSelectCell(row.id, col.key);
                if (hasSubRows) {
                  toggleRowExpanded(row.id);
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (canEdit) onDoubleClickCell(row.id, col.key);
              }}
            >
              {isEditing ? (
                <input
                  type="text"
                  value={editingCell.val}
                  onChange={(e) => onChangeEditingVal(e.target.value)}
                  className="absolute inset-0 w-full h-full bg-[#1b1c26] text-text-primary px-3 py-1 font-mono text-xs border border-accent-gold outline-none z-10"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      onSaveCell(row.id, col.key, editingCell.val);
                    }
                  }}
                  onBlur={() => {
                    onSaveCell(row.id, col.key, editingCell.val);
                  }}
                />
              ) : (
                <div className="flex items-center gap-2">
                  {ci === 0 && hasSubRows && (
                    <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-text-muted transition-transform', expanded && 'rotate-90')} />
                  )}
                  {renderCell(col, row, maxPct)}
                </div>
              )}

              {excelMode && isSelected && !isEditing && (
                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-accent-gold z-10 cursor-crosshair" />
              )}
            </td>
          );
        })}
      </tr>
      {expanded && hasSubRows && (row.subRows as SheetRow[]).map((sub, sIdx) => (
        <SubRow
          key={sub.id}
          row={sub}
          columns={columns}
          isLoading={isLoading}
          excelMode={excelMode}
          rowIndex={`${rowIndex}.${sIdx + 1}`}
          selectedCell={selectedCell}
          editingCell={editingCell}
          onSelectCell={onSelectCell}
          onDoubleClickCell={onDoubleClickCell}
          onChangeEditingVal={onChangeEditingVal}
          onSaveCell={onSaveCell}
          getHeatmapStyle={getHeatmapStyle}
        />
      ))}
    </>
  );
}

// --- Totals row ---
function TotalsRow({ rows, columns, isLoading, excelMode, selectedCell }: {
  rows: SheetRow[]; columns: SheetColumn[]; isLoading: boolean; excelMode: boolean;
  selectedCell: { rowId: string; colKey: string } | null;
}) {
  const totals: Record<string, number> = {};
  for (const col of columns) {
    if (col.type === 'currency' || col.key.startsWith('m')) {
      totals[col.key] = rows
        .filter((r) => !r.isSectionHeader)
        .reduce((s, r) => s + ((r[col.key] as number) ?? 0), 0);
    }
  }

  return (
    <tr className={cn('border-t-2 border-accent-gold bg-bg-elevated', isLoading && 'animate-pulse opacity-40')}>
      {excelMode && (
        <td className="w-10 border-r border-border bg-bg-card px-2 py-2 text-center font-mono text-[10px] font-bold text-accent-gold">
          ∑
        </td>
      )}
      {columns.map((col, ci) => {
        const isColSelected = selectedCell && columns.findIndex(c => c.key === selectedCell.colKey) === ci;
        return (
          <td
            key={col.key}
            className={cn(
              'px-4 py-3 font-bold',
              excelMode && 'border-r border-border/60',
              isColSelected && 'text-accent-gold bg-accent-gold/5',
              WIDTH_CLASS[col.width] ?? WIDTH_CLASS.auto
            )}
          >
            {ci === 0 ? (
              <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">TOTAL GERAL</span>
            ) : (col.type === 'currency' || col.key.startsWith('m')) && col.key in totals ? (
              <CurrencyCell value={totals[col.key]!} />
            ) : null}
          </td>
        );
      })}
    </tr>
  );
}

// --- Main component ---
interface SheetGridProps {
  columns: SheetColumn[];
  rows: SheetRow[];
  isLoading: boolean;
  showTotalsRow?: boolean;
  expandable?: boolean;
}

export function SheetGrid({ columns, rows, isLoading, showTotalsRow = true, expandable = true }: SheetGridProps) {
  const fmt = useFmt();
  const { state, dispatch } = useSmartSheet();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [excelMode, setExcelMode] = useState<boolean>(true);
  const [viewLayout, setViewLayout] = useState<'split' | 'matrix' | 'table'>('split');
  const [filterType] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string; val: string } | null>(null);
  const [heatmapActive, setHeatmapActive] = useState<boolean>(false);
  const [formulaBarText, setFormulaBarText] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);

  const toggleRowExpanded = (rowId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  // Filter rows based on search and type filter
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (r.isSectionHeader && !searchQuery) return true;

      if (filterType === 'income' && r.rowType === 'expense') return false;
      if (filterType === 'expense' && r.rowType === 'income') return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const catStr = String(r.category ?? '').toLowerCase();
        const descStr = String(r.description ?? '').toLowerCase();
        return catStr.includes(query) || descStr.includes(query);
      }

      return true;
    });
  }, [rows, filterType, searchQuery]);

  const sorted = useMemo(() => {
    return sortKey
      ? [...filteredRows].sort((a, b) => {
          if (a.isSectionHeader || b.isSectionHeader) return 0;
          const av = a[sortKey] as number | string;
          const bv = b[sortKey] as number | string;
          const dir = sortDir === 'asc' ? 1 : -1;
          if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
          return String(av).localeCompare(String(bv)) * dir;
        })
      : filteredRows;
  }, [filteredRows, sortKey, sortDir]);

  // Max pct for percentage bars
  const pctValues = rows.flatMap((r) =>
    columns.filter((c) => c.type === 'percentage').map((c) => (r[c.key] as number) ?? 0)
  );
  const maxPct = pctValues.length > 0 ? Math.max(...pctValues) : 100;

  // Flatten visible rows (including open subrows) for keyboard navigation
  const visibleRows = useMemo(() => {
    const list: SheetRow[] = [];
    sorted.forEach((row) => {
      list.push(row);
      const isExpanded = expandedRows.has(row.id);
      if (isExpanded && row.subRows) {
        (row.subRows as SheetRow[]).forEach((sub) => {
          list.push(sub);
        });
      }
    });
    return list;
  }, [sorted, expandedRows]);

  const selectedRowObj = useMemo(() => {
    if (!selectedCell) return null;
    return visibleRows.find((r) => r.id === selectedCell.rowId);
  }, [visibleRows, selectedCell]);

  // Sync top formula bar input
  useEffect(() => {
    if (selectedCell && selectedRowObj) {
      const val = selectedRowObj[selectedCell.colKey];
      const formula = (selectedRowObj[selectedCell.colKey + '_formula'] as string) || String(val ?? '');
      setFormulaBarText(formula);
    } else {
      setFormulaBarText('');
    }
  }, [selectedCell, selectedRowObj]);

  // Append Sparkline column if Comparison view
  const activeColumns = useMemo(() => {
    if (state.viewType === 'comparison') {
      return [
        ...columns,
        { key: 'sparkline', label: 'Histórico (3m)', type: 'text', sortable: false, width: 'sm' } as SheetColumn
      ];
    }
    return columns;
  }, [columns, state.viewType]);

  // Cell heatmap coloring calculation
  const getHeatmapStyle = (col: SheetColumn, row: SheetRow, val: unknown): React.CSSProperties => {
    if (!heatmapActive || (col.type !== 'currency' && !col.key.startsWith('m')) || row.isSectionHeader || val === null || typeof val !== 'number') {
      return {};
    }
    const vals = sorted
      .filter((r) => !r.isSectionHeader && typeof r[col.key] === 'number')
      .map((r) => r[col.key] as number);
    if (vals.length === 0) return {};
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const range = max - min || 1;
    const pct = (val - min) / range;

    if (row.rowType === 'income') {
      const alpha = 0.03 + pct * 0.22;
      return { backgroundColor: `rgba(16, 185, 129, ${alpha})` };
    } else {
      const alpha = 0.03 + pct * 0.22;
      return { backgroundColor: `rgba(239, 68, 68, ${alpha})` };
    }
  };

  // Keyboard navigation movement
  const moveSelection = (dir: 'up' | 'down' | 'left' | 'right') => {
    if (!selectedCell) return;
    const rIdx = visibleRows.findIndex((r) => r.id === selectedCell.rowId);
    const cIdx = activeColumns.findIndex((c) => c.key === selectedCell.colKey);
    if (rIdx === -1 || cIdx === -1) return;

    if (dir === 'up' && rIdx > 0) {
      setSelectedCell({ rowId: visibleRows[rIdx - 1]!.id, colKey: selectedCell.colKey });
    } else if (dir === 'down' && rIdx < visibleRows.length - 1) {
      setSelectedCell({ rowId: visibleRows[rIdx + 1]!.id, colKey: selectedCell.colKey });
    } else if (dir === 'left' && cIdx > 0) {
      setSelectedCell({ rowId: selectedCell.rowId, colKey: activeColumns[cIdx - 1]!.key });
    } else if (dir === 'right' && cIdx < activeColumns.length - 1) {
      setSelectedCell({ rowId: selectedCell.rowId, colKey: activeColumns[cIdx + 1]!.key });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selectedCell) return;

    if (editingCell) {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveCellEdit(editingCell.rowId, editingCell.colKey, editingCell.val);
        moveSelection('down');
      } else if (e.key === 'Tab') {
        e.preventDefault();
        saveCellEdit(editingCell.rowId, editingCell.colKey, editingCell.val);
        moveSelection('right');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditingCell(null);
        containerRef.current?.focus();
      }
      return;
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
      e.preventDefault();
      if (e.key === 'ArrowUp') {
        moveSelection('up');
      } else if (e.key === 'ArrowDown') {
        moveSelection('down');
      } else if (e.key === 'ArrowLeft') {
        moveSelection('left');
      } else if (e.key === 'ArrowRight') {
        moveSelection('right');
      } else if (e.key === 'Enter') {
        const row = visibleRows.find((r) => r.id === selectedCell.rowId);
        if (row && !row.isSectionHeader) {
          const isNumeric = activeColumns.find((c) => c.key === selectedCell.colKey)?.type === 'currency' 
            || selectedCell.colKey.startsWith('m');
          if (isNumeric) {
            const rawVal = (row[selectedCell.colKey + '_formula'] as string) || String(row[selectedCell.colKey] ?? '');
            setEditingCell({ rowId: selectedCell.rowId, colKey: selectedCell.colKey, val: rawVal });
          }
        }
      } else if (e.key === 'Escape') {
        setSelectedCell(null);
      }
    }
  };

  // Perform reactive sheet recalculation
  const recalculateSheet = (rowsList: SheetRow[], viewType: string) => {
    if (viewType === 'dre' || viewType === 'grid') {
      for (const row of rowsList) {
        if (row.subRows && row.subRows.length > 0) {
          let catTotal = 0;
          let catCount = 0;
          for (const sub of row.subRows) {
            const val = Number(sub.total);
            if (!isNaN(val)) {
              catTotal += val;
              catCount++;
            }
          }
          row.total = catTotal;
          row.count = catCount;
        }
      }

      let totalIncome = 0;
      let countIncome = 0;
      let totalExpense = 0;
      let countExpense = 0;

      for (const row of rowsList) {
        if (row.isSectionHeader) continue;
        if (row.rowType === 'income') {
          totalIncome += Number(row.total) || 0;
          countIncome += Number(row.count) || 0;
        } else if (row.rowType === 'expense') {
          totalExpense += Number(row.total) || 0;
          countExpense += Number(row.count) || 0;
        }
      }

      const hdrIncome = rowsList.find((r) => r.id === 'hdr-income');
      if (hdrIncome) {
        hdrIncome.total = totalIncome;
        hdrIncome.count = countIncome;
      }

      const hdrExpense = rowsList.find((r) => r.id === 'hdr-expense');
      if (hdrExpense) {
        hdrExpense.total = totalExpense;
        hdrExpense.count = countExpense;
      }

      const netResult = rowsList.find((r) => r.id === 'net-result');
      const netBalance = totalIncome - totalExpense;
      const savingsRate = totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;
      if (netResult) {
        netResult.total = netBalance;
        netResult.pct = savingsRate;
        netResult.category = netBalance >= 0 ? '⚖️ SOBRA LÍQUIDA (LUCRO)' : '⚠️ DÉFICIT DO PERÍODO';
      }

      for (const row of rowsList) {
        if (row.id === 'hdr-income' || row.id === 'hdr-expense') {
          row.pct = 100;
        } else if (row.rowType === 'income') {
          row.pct = totalIncome > 0 ? ((Number(row.total) || 0) / totalIncome) * 100 : 0;
        } else if (row.rowType === 'expense') {
          row.pct = totalExpense > 0 ? ((Number(row.total) || 0) / totalExpense) * 100 : 0;
        }
      }
    } else if (viewType === 'comparison') {
      let incM0 = 0, incM1 = 0, incM2 = 0;
      let expM0 = 0, expM1 = 0, expM2 = 0;

      for (const row of rowsList) {
        if (row.isSectionHeader) continue;
        const rType = row.rowType;
        const m0Val = Number(row.m0) || 0;
        const m1Val = Number(row.m1) || 0;
        const m2Val = Number(row.m2) || 0;

        if (rType === 'income') {
          incM0 += m0Val;
          incM1 += m1Val;
          incM2 += m2Val;
        } else {
          expM0 += m0Val;
          expM1 += m1Val;
          expM2 += m2Val;
        }

        row.totalVariation = m0Val > 0 ? ((m2Val - m0Val) / m0Val) * 100 : 0;
        row.trend = m2Val > m1Val * 1.05 ? '↗' : m2Val < m1Val * 0.95 ? '↘' : '→';
      }

      const rowIncome = rowsList.find((r) => r.id === 'cmp-row-income' || r.id === 'cmp-inc');
      if (rowIncome) {
        rowIncome.m0 = incM0;
        rowIncome.m1 = incM1;
        rowIncome.m2 = incM2;
        rowIncome.totalVariation = incM0 > 0 ? ((incM2 - incM0) / incM0) * 100 : 0;
        rowIncome.trend = incM2 > incM1 ? '↗' : '↘';
      }

      const rowExpense = rowsList.find((r) => r.id === 'cmp-row-expense' || r.id === 'cmp-exp');
      if (rowExpense) {
        rowExpense.m0 = expM0;
        rowExpense.m1 = expM1;
        rowExpense.m2 = expM2;
        rowExpense.totalVariation = expM0 > 0 ? ((expM2 - expM0) / expM0) * 100 : 0;
        rowExpense.trend = expM2 > expM1 ? '↗' : '↘';
      }

      const rowNet = rowsList.find((r) => r.id === 'cmp-row-net' || r.id === 'cmp-net');
      if (rowNet) {
        const netM0 = incM0 - expM0;
        const netM1 = incM1 - expM1;
        const netM2 = incM2 - expM2;
        rowNet.m0 = netM0;
        rowNet.m1 = netM1;
        rowNet.m2 = netM2;
        rowNet.totalVariation = netM0 > 0 ? ((netM2 - netM0) / netM0) * 100 : 0;
        rowNet.trend = netM2 >= netM1 ? '↗' : '↘';
      }
    } else if (viewType === 'cashflow') {
      let balance = 0;
      for (const row of rowsList) {
        const entrada = Number(row.entrada) || 0;
        const saida = Number(row.saida) || 0;
        balance += entrada - saida;
        row.saldo = balance;
      }
    }
  };

  const updateContextState = (updatedRows: SheetRow[]) => {
    let newPills = [...state.summaryPills];
    let newChartData = [...state.chartData];

    if (state.viewType === 'dre' || state.viewType === 'grid') {
      const hdrIncome = updatedRows.find((r) => r.id === 'hdr-income');
      const hdrExpense = updatedRows.find((r) => r.id === 'hdr-expense');

      const totalIncome = Number(hdrIncome?.total) || 0;
      const totalExpense = Number(hdrExpense?.total) || 0;
      const netBalance = totalIncome - totalExpense;
      const savingsRate = totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;

      newPills = [
        { label: 'Total Receitas', value: totalIncome.toFixed(2), color: 'green' },
        { label: 'Total Débitos',  value: totalExpense.toFixed(2), color: 'red' },
        { label: 'Saldo Líquido',  value: netBalance.toFixed(2), color: netBalance >= 0 ? 'green' : 'red' },
        { label: 'Taxa de Poupança', value: `${savingsRate.toFixed(1)}%`, color: savingsRate >= 20 ? 'green' : savingsRate >= 0 ? 'gold' : 'red' },
      ];

      newChartData = [
        { label: 'Receitas', valor: totalIncome },
        { label: 'Débitos',  valor: totalExpense },
        { label: 'Saldo Líquido', valor: netBalance },
      ];
    } else if (state.viewType === 'comparison') {
      const rowIncome = updatedRows.find((r) => r.id === 'cmp-row-income' || r.id === 'cmp-inc');
      const rowExpense = updatedRows.find((r) => r.id === 'cmp-row-expense' || r.id === 'cmp-exp');

      const m0Col = activeColumns.find((c) => c.key === 'm0');
      const m1Col = activeColumns.find((c) => c.key === 'm1');
      const m2Col = activeColumns.find((c) => c.key === 'm2');

      const label0 = m0Col?.label ?? 'Mês 1';
      const label1 = m1Col?.label ?? 'Mês 2';
      const label2 = m2Col?.label ?? 'Mês 3';

      const inc0 = Number(rowIncome?.m0) || 0;
      const inc1 = Number(rowIncome?.m1) || 0;
      const inc2 = Number(rowIncome?.m2) || 0;

      const exp0 = Number(rowExpense?.m0) || 0;
      const exp1 = Number(rowExpense?.m1) || 0;
      const exp2 = Number(rowExpense?.m2) || 0;

      const net0 = inc0 - exp0;
      const net1 = inc1 - exp1;
      const net2 = inc2 - exp2;

      const growth = net0 > 0 ? ((net2 - net0) / net0) * 100 : 0;

      newPills = [
        { label: `${label0} (Saldo)`, value: net0.toFixed(2), color: net0 >= 0 ? 'green' : 'red' },
        { label: `${label1} (Saldo)`, value: net1.toFixed(2), color: net1 >= 0 ? 'green' : 'red' },
        { label: `${label2} (Saldo)`, value: net2.toFixed(2), color: net2 >= 0 ? 'green' : 'red' },
        { label: 'Crescimento de Sobra', value: `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`, color: 'gold' },
      ];

      newChartData = [
        { label: label0, Receitas: inc0, Débitos: exp0, Saldo: net0 },
        { label: label1, Receitas: inc1, Débitos: exp1, Saldo: net1 },
        { label: label2, Receitas: inc2, Débitos: exp2, Saldo: net2 },
      ];
    } else if (state.viewType === 'cashflow') {
      let totalIn = 0;
      let totalOut = 0;
      for (const r of updatedRows) {
        totalIn += Number(r.entrada) || 0;
        totalOut += Number(r.saida) || 0;
      }
      newPills = [
        { label: 'Total entradas', value: totalIn.toFixed(2),              color: 'green' },
        { label: 'Total saídas',   value: totalOut.toFixed(2),             color: 'red' },
        { label: 'Saldo',          value: (totalIn - totalOut).toFixed(2), color: totalIn >= totalOut ? 'green' : 'red' },
        { label: 'Transações',     value: String(updatedRows.length) },
      ];
    }

    dispatch({
      type: 'SET_RESULT',
      payload: {
        rows: updatedRows,
        summaryPills: newPills,
        chartData: newChartData,
      }
    });
  };

  const saveCellEdit = (rowId: string, colKey: string, newStrVal: string) => {
    setEditingCell(null);
    containerRef.current?.focus();

    const updatedRows = JSON.parse(JSON.stringify(rows)) as SheetRow[];

    let targetRow: SheetRow | null = null;
    const findRow = (list: SheetRow[]): boolean => {
      for (const r of list) {
        if (r.id === rowId) {
          targetRow = r;
          return true;
        }
        if (r.subRows && findRow(r.subRows)) {
          return true;
        }
      }
      return false;
    };

    findRow(updatedRows);
    if (!targetRow) return;

    const evaluated = parseAndEvaluate(newStrVal);
    const rowAny = targetRow as any;
    if (evaluated !== null) {
      rowAny[colKey] = evaluated;
      if (newStrVal.startsWith('=')) {
        rowAny[colKey + '_formula'] = newStrVal;
      } else {
        delete rowAny[colKey + '_formula'];
      }
    } else {
      const isNumericCol = activeColumns.find((c) => c.key === colKey)?.type === 'currency' || colKey.startsWith('m');
      if (!isNumericCol) {
        rowAny[colKey] = newStrVal;
      }
    }

    recalculateSheet(updatedRows, state.viewType);
    updateContextState(updatedRows);
  };

  const handleFormulaBarSubmit = () => {
    if (selectedCell) {
      saveCellEdit(selectedCell.rowId, selectedCell.colKey, formulaBarText);
    }
  };

  const handleFormulaBarCancel = () => {
    if (selectedCell && selectedRowObj) {
      const val = selectedRowObj[selectedCell.colKey];
      const formula = (selectedRowObj[selectedCell.colKey + '_formula'] as string) || String(val ?? '');
      setFormulaBarText(formula);
      containerRef.current?.focus();
    }
  };

  // Find column selected coordinates letter
  const selectedColLetter = useMemo(() => {
    if (!selectedCell) return '';
    const idx = activeColumns.findIndex((c) => c.key === selectedCell.colKey);
    return EXCEL_COLS[idx] ?? `C${idx + 1}`;
  }, [selectedCell, activeColumns]);

  const selectedRowNumber = useMemo(() => {
    if (!selectedCell) return 0;
    return visibleRows.findIndex((r) => r.id === selectedCell.rowId) + 1;
  }, [selectedCell, visibleRows]);

  // Compute Income and Expense totals for Split Dual-Pane View
  const incomeTotal = useMemo(() => {
    return sorted
      .filter((r) => r.rowType === 'income' && !r.isSectionHeader)
      .reduce((s, r) => s + (Number(r.total) || 0), 0);
  }, [sorted]);

  const expenseTotal = useMemo(() => {
    return sorted
      .filter((r) => r.rowType === 'expense' && !r.isSectionHeader)
      .reduce((s, r) => s + (Number(r.total) || 0), 0);
  }, [sorted]);

  const incomeRowsList = useMemo(() => {
    return sorted.filter((r) => r.rowType === 'income' && !r.isSectionHeader);
  }, [sorted]);

  const expenseRowsList = useMemo(() => {
    return sorted.filter((r) => r.rowType === 'expense' && !r.isSectionHeader);
  }, [sorted]);

  const netRowObj = useMemo(() => {
    return sorted.find((r) => r.rowType === 'net' || r.id === 'net-result');
  }, [sorted]);

  const isDREOrGrid = state.viewType === 'dre' || state.viewType === 'grid';

  return (
    <div className="flex flex-col w-full h-full border-t border-border bg-bg-card">
      {/* Spreadsheet Control Toolbar & Formula Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-bg-elevated/80 px-4 py-2 text-xs">
        {/* Search & Layout Toggles */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar rubrica ou categoria..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-40 md:w-56 rounded-md border border-border bg-bg-card pl-8 pr-2 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent-gold"
            />
          </div>

          {/* Dual Pane vs Matrix Layout Switcher */}
          {isDREOrGrid && (
            <div className="flex items-center rounded-md border border-border bg-bg-card p-0.5">
              <button
                onClick={() => setViewLayout('split')}
                className={cn('flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors', viewLayout === 'split' ? 'bg-accent-gold/20 text-accent-gold font-bold' : 'text-text-secondary hover:text-text-primary')}
                title="Receitas no lado esquerdo, Débitos no lado direito (Sem Scroll)"
              >
                <Columns className="h-3 w-3" />
                <span>Lado a Lado (Sem Scroll)</span>
              </button>
              <button
                onClick={() => setViewLayout('matrix')}
                className={cn('flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors', viewLayout === 'matrix' ? 'bg-accent-gold/20 text-accent-gold font-bold' : 'text-text-secondary hover:text-text-primary')}
                title="Padrão de Matriz Excel compacta"
              >
                <Rows className="h-3 w-3" />
                <span>Matriz Excel</span>
              </button>
            </div>
          )}
        </div>

        {/* Spreadsheet Navigation Controls */}
        <div className="flex items-center gap-2">
          <span className="hidden lg:inline text-[10px] text-text-muted mr-1">
            setas ↑↓←→ para navegar • double-click para editar
          </span>

          <button
            onClick={() => setHeatmapActive(!heatmapActive)}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-all',
              heatmapActive
                ? 'border-accent-red bg-accent-red/15 text-accent-red'
                : 'border-border bg-bg-card text-text-secondary hover:text-text-primary'
            )}
            title="Destaca as células de acordo com o peso de gastos e receitas"
          >
            <span>🔥</span>
            <span>Mapa de Calor</span>
          </button>

          <button
            onClick={() => setExcelMode(!excelMode)}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-all',
              excelMode
                ? 'border-accent-gold bg-accent-gold/15 text-accent-gold'
                : 'border-border bg-bg-card text-text-secondary hover:text-text-primary'
            )}
          >
            {excelMode ? <Grid className="h-3.5 w-3.5" /> : <TableIcon className="h-3.5 w-3.5" />}
            {excelMode ? 'Planilha Viva (Grid Excel)' : 'Visão Tabela Limpa'}
          </button>
        </div>
      </div>

      {/* Formula Bar (Excel Style) */}
      <div className="flex items-center gap-2 border-b border-border bg-bg-card px-4 py-1.5 text-xs">
        <div className="flex items-center gap-1 rounded bg-bg-elevated px-2 py-0.5 font-mono text-[11px] font-bold text-accent-gold border border-border min-w-[36px] justify-center">
          <Calculator className="h-3 w-3" />
          <span>{selectedCell ? `${selectedColLetter}${selectedRowNumber}` : 'fx'}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <span className="font-mono text-xs text-text-muted select-none">Fórmula:</span>
        <input
          type="text"
          value={formulaBarText}
          onChange={(e) => setFormulaBarText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleFormulaBarSubmit();
            if (e.key === 'Escape') handleFormulaBarCancel();
          }}
          disabled={!selectedCell}
          placeholder={selectedCell ? "Digite um valor ou fórmula (ex: =SOMA(10, 20) ou =200+300)" : "Selecione uma célula para editar"}
          className="flex-1 bg-transparent font-mono text-xs text-text-primary outline-none focus:bg-bg-elevated px-2 py-0.5 rounded border border-transparent focus:border-border"
        />
      </div>

      {/* --- DUAL PANE SPLIT VIEW (Receitas on Left, Débitos on Right - ZERO VERTICAL SCROLL) --- */}
      {viewLayout === 'split' && isDREOrGrid ? (
        <div
          ref={containerRef}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          className="flex-1 flex flex-col p-2 gap-2 overflow-hidden bg-bg-primary focus:outline-none"
        >
          {/* Dual Tables Row */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 overflow-hidden">
            {/* Left Box: RECEITAS */}
            <div className="flex flex-col border border-accent-green/30 rounded-xl bg-bg-card overflow-hidden shadow-md">
              <div className="bg-accent-green/15 px-3 py-2 border-b border-accent-green/30 flex items-center justify-between">
                <span className="font-bold text-xs text-accent-green uppercase tracking-wider flex items-center gap-1.5">
                  <span>🟢</span> RECEITAS (ENTRADAS)
                </span>
                <span className="font-mono text-xs font-bold text-accent-green">
                  {fmt(incomeTotal)}
                </span>
              </div>
              <div className="flex-1 overflow-auto">
                <table className={cn('w-full text-left border-collapse text-xs', excelMode && 'border-border/40')}>
                  <thead>
                    <tr className="border-b border-border bg-bg-elevated/70 font-mono text-[10px] uppercase font-bold text-text-secondary select-none">
                      {excelMode && <th className="w-8 border-r border-border py-1 text-center text-text-muted">#</th>}
                      <th className="py-1.5 px-3 border-r border-border/40">Categoria / Rubrica</th>
                      <th className="py-1.5 px-2 border-r border-border/40 text-center w-12">Tx</th>
                      <th className="py-1.5 px-3 border-r border-border/40 text-right w-28">Valor Total</th>
                      <th className="py-1.5 px-3 text-right w-20">% Grupo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeRowsList.length === 0 ? (
                      <tr><td colSpan={5} className="py-8 text-center text-text-muted text-xs">Nenhuma receita registrada.</td></tr>
                    ) : (
                      incomeRowsList.map((row, idx) => (
                        <GridRow
                          key={row.id}
                          row={row}
                          columns={activeColumns}
                          expandable={expandable}
                          isLoading={false}
                          maxPct={maxPct}
                          excelMode={excelMode}
                          rowIndex={idx + 1}
                          selectedCell={selectedCell}
                          editingCell={editingCell}
                          onSelectCell={(rId, cKey) => {
                            setSelectedCell({ rowId: rId, colKey: cKey });
                            setEditingCell(null);
                          }}
                          onDoubleClickCell={(rId, cKey) => {
                            const r = visibleRows.find(x => x.id === rId);
                            if (r) {
                              const rawVal = (r[cKey + '_formula'] as string) || String(r[cKey] ?? '');
                              setEditingCell({ rowId: rId, colKey: cKey, val: rawVal });
                            }
                          }}
                          onChangeEditingVal={(val) => setEditingCell(prev => prev ? { ...prev, val } : null)}
                          onSaveCell={saveCellEdit}
                          expandedRows={expandedRows}
                          toggleRowExpanded={toggleRowExpanded}
                          getHeatmapStyle={getHeatmapStyle}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Box: DÉBITOS */}
            <div className="flex flex-col border border-accent-red/30 rounded-xl bg-bg-card overflow-hidden shadow-md">
              <div className="bg-accent-red/15 px-3 py-2 border-b border-accent-red/30 flex items-center justify-between">
                <span className="font-bold text-xs text-accent-red uppercase tracking-wider flex items-center gap-1.5">
                  <span>🔴</span> DÉBITOS (SAÍDAS)
                </span>
                <span className="font-mono text-xs font-bold text-accent-red">
                  {fmt(expenseTotal)}
                </span>
              </div>
              <div className="flex-1 overflow-auto">
                <table className={cn('w-full text-left border-collapse text-xs', excelMode && 'border-border/40')}>
                  <thead>
                    <tr className="border-b border-border bg-bg-elevated/70 font-mono text-[10px] uppercase font-bold text-text-secondary select-none">
                      {excelMode && <th className="w-8 border-r border-border py-1 text-center text-text-muted">#</th>}
                      <th className="py-1.5 px-3 border-r border-border/40">Categoria / Rubrica</th>
                      <th className="py-1.5 px-2 border-r border-border/40 text-center w-12">Tx</th>
                      <th className="py-1.5 px-3 border-r border-border/40 text-right w-28">Valor Total</th>
                      <th className="py-1.5 px-3 text-right w-20">% Grupo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseRowsList.length === 0 ? (
                      <tr><td colSpan={5} className="py-8 text-center text-text-muted text-xs">Nenhum débito registrado.</td></tr>
                    ) : (
                      expenseRowsList.map((row, idx) => (
                        <GridRow
                          key={row.id}
                          row={row}
                          columns={activeColumns}
                          expandable={expandable}
                          isLoading={false}
                          maxPct={maxPct}
                          excelMode={excelMode}
                          rowIndex={idx + 1}
                          selectedCell={selectedCell}
                          editingCell={editingCell}
                          onSelectCell={(rId, cKey) => {
                            setSelectedCell({ rowId: rId, colKey: cKey });
                            setEditingCell(null);
                          }}
                          onDoubleClickCell={(rId, cKey) => {
                            const r = visibleRows.find(x => x.id === rId);
                            if (r) {
                              const rawVal = (r[cKey + '_formula'] as string) || String(r[cKey] ?? '');
                              setEditingCell({ rowId: rId, colKey: cKey, val: rawVal });
                            }
                          }}
                          onChangeEditingVal={(val) => setEditingCell(prev => prev ? { ...prev, val } : null)}
                          onSaveCell={saveCellEdit}
                          expandedRows={expandedRows}
                          toggleRowExpanded={toggleRowExpanded}
                          getHeatmapStyle={getHeatmapStyle}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Bottom Consolidated Net Balance Bar */}
          <div className="rounded-xl border border-accent-gold/40 bg-accent-gold/10 p-2.5 flex items-center justify-between text-xs shadow-md shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">⚖️</span>
              <span className="font-bold text-accent-gold uppercase tracking-wider">
                {netRowObj ? (netRowObj.category as string) : 'SOBRA LÍQUIDA DO PERÍODO'}
              </span>
            </div>
            <div className="flex items-center gap-6 font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted text-xs">Entradas:</span>
                <span className="font-bold text-accent-green">{fmt(incomeTotal)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted text-xs">Saídas:</span>
                <span className="font-bold text-accent-red">{fmt(expenseTotal)}</span>
              </div>
              <div className="flex items-center gap-1.5 border-l border-accent-gold/30 pl-4">
                <span className="text-text-muted text-xs">Saldo Líquido:</span>
                <span className={cn('px-2.5 py-0.5 rounded-full font-bold text-sm', (incomeTotal - expenseTotal) >= 0 ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red')}>
                  {((incomeTotal - expenseTotal) >= 0 ? '+' : '') + fmt(incomeTotal - expenseTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* --- STANDARD SINGLE-TABLE MATRIX VIEW (Ultra-compact 28px density) --- */
        <div
          ref={containerRef}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          className="w-full flex-1 overflow-auto focus:outline-none"
        >
          {sorted.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="text-4xl">📭</span>
              <p className="text-sm text-text-secondary">Nenhuma transação encontrada com esses filtros.</p>
              <p className="text-xs text-text-muted">Tente mudar os termos de busca ou o período selecionado.</p>
            </div>
          ) : (
            <table className={cn('w-full border-collapse text-left', excelMode && 'border border-border/80')}>
              <thead>
                {/* Excel Column Letters Header */}
                {excelMode && (
                  <tr className="border-b border-border bg-bg-card/90 text-center font-mono text-[10px] font-semibold text-text-muted select-none">
                    <th className="w-9 border-r border-border bg-bg-elevated py-1"></th>
                    {activeColumns.map((col, idx) => {
                      const isColSelected = selectedCell && activeColumns.findIndex(c => c.key === selectedCell.colKey) === idx;
                      return (
                        <th
                          key={col.key}
                          className={cn(
                            'border-r border-border py-1 uppercase tracking-wider transition-colors',
                            isColSelected && 'bg-accent-gold/15 text-accent-gold font-bold border-b border-b-accent-gold'
                          )}
                        >
                          {EXCEL_COLS[idx] ?? `C${idx + 1}`}
                        </th>
                      );
                    })}
                  </tr>
                )}
                {/* Main Column Labels Header */}
                <tr className="border-b-2 border-accent-gold/60 bg-bg-elevated/40">
                  {excelMode && (
                    <th className="w-9 border-r border-border bg-bg-elevated px-2 py-1.5 text-center font-mono text-[10px] font-bold text-text-muted">
                      #
                    </th>
                  )}
                  {activeColumns.map((col, idx) => {
                    const isColSelected = selectedCell && activeColumns.findIndex(c => c.key === selectedCell.colKey) === idx;
                    return (
                      <th
                        key={col.key}
                        className={cn(
                          'px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-text-secondary transition-colors',
                          excelMode && 'border-r border-border/60',
                          isColSelected && 'text-accent-gold bg-accent-gold/5',
                          WIDTH_CLASS[col.width] ?? WIDTH_CLASS.auto,
                          col.sortable && 'cursor-pointer select-none hover:text-text-primary'
                        )}
                        onClick={() => { if (col.sortable) handleSort(col.key); }}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {col.sortable && (
                            sortKey === col.key
                              ? sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-accent-gold" /> : <ArrowDown className="h-3 w-3 text-accent-gold" />
                              : <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-border animate-pulse h-7">
                        {excelMode && <td className="w-9 border-r border-border bg-bg-card" />}
                        {activeColumns.map((col) => (
                          <td key={col.key} className="px-3 py-1">
                            <div className="h-3.5 rounded bg-bg-elevated opacity-60" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : sorted.map((row, idx) => (
                      <GridRow
                        key={row.id}
                        row={row}
                        columns={activeColumns}
                        expandable={expandable}
                        isLoading={false}
                        maxPct={maxPct}
                        excelMode={excelMode}
                        rowIndex={idx + 1}
                        selectedCell={selectedCell}
                        editingCell={editingCell}
                        onSelectCell={(rId, cKey) => {
                          setSelectedCell({ rowId: rId, colKey: cKey });
                          setEditingCell(null);
                        }}
                        onDoubleClickCell={(rId, cKey) => {
                          const r = visibleRows.find(x => x.id === rId);
                          if (r) {
                            const rawVal = (r[cKey + '_formula'] as string) || String(r[cKey] ?? '');
                            setEditingCell({ rowId: rId, colKey: cKey, val: rawVal });
                          }
                        }}
                        onChangeEditingVal={(val) => setEditingCell(prev => prev ? { ...prev, val } : null)}
                        onSaveCell={saveCellEdit}
                        expandedRows={expandedRows}
                        toggleRowExpanded={toggleRowExpanded}
                        getHeatmapStyle={getHeatmapStyle}
                      />
                    ))}
              {!isLoading && showTotalsRow && sorted.length > 0 && (
                <TotalsRow
                  rows={sorted}
                  columns={activeColumns}
                  isLoading={isLoading}
                  excelMode={excelMode}
                  selectedCell={selectedCell}
                />
              )}
            </tbody>
          </table>
        )}
      </div>
    )}
    </div>
  );
}


