import { useEffect, useRef, useState } from 'react';
import { Trash2, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import type { OcrLineItem } from '@/types/api';

export type LineItemState = OcrLineItem;

export interface LineItemValidationState {
  hasMismatch: boolean;
  mismatchAcknowledged: boolean;
  isBlocking: boolean;
}

interface LineItemEditorProps {
  initialItems: OcrLineItem[];
  extractedTotal: string;
  onItemsChange: (items: LineItemState[], includedTotal: number, validation: LineItemValidationState) => void;
}

const CATEGORIES = [
  'Meals', 'Travel', 'Accommodation', 'Transport', 'Office Supplies',
  'Software', 'Hardware', 'Training', 'Marketing', 'Other',
];

export function LineItemEditor({ initialItems, extractedTotal, onItemsChange }: LineItemEditorProps) {
  const [items, setItems] = useState<LineItemState[]>(initialItems);
  const [expandedId, setExpandedId] = useState<string | null>(initialItems[0]?.id ?? null);
  const [mismatchAcknowledged, setMismatchAcknowledged] = useState(false);
  const onItemsChangeRef = useRef(onItemsChange);

  useEffect(() => {
    onItemsChangeRef.current = onItemsChange;
  }, [onItemsChange]);

  const extractedTotalNum = Number.parseFloat(extractedTotal || '0');
  const includedTotal = items
    .filter(item => item.included)
    .reduce((sum, item) => sum + Number.parseFloat(item.amount || '0'), 0);
  const hasMismatch = extractedTotalNum > 0 && Math.abs(includedTotal - extractedTotalNum) > 0.01;
  const effectiveMismatchAcknowledged = hasMismatch ? mismatchAcknowledged : false;
  const isBlocking = hasMismatch && !effectiveMismatchAcknowledged;

  useEffect(() => {
    onItemsChangeRef.current(items, includedTotal, {
      hasMismatch,
      mismatchAcknowledged: effectiveMismatchAcknowledged,
      isBlocking,
    });
  }, [items, includedTotal, hasMismatch, effectiveMismatchAcknowledged, isBlocking]);

  const updateItem = (id: string, changes: Partial<LineItemState>) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...changes } : item)));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const toggleInclude = (id: string) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, included: !item.included } : item)));
  };

  if (items.length === 0) {
    return (
      <div
        className="rounded-[24px] p-6 text-center space-y-3"
        style={{
          background: 'rgba(255,255,255,0.56)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          No line items were extracted
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          You can continue with the bill-level fields only, or reprocess the receipt if the OCR result looks incomplete.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
            Line review
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Include only the rows that belong in the submitted expense.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
            Included total
          </p>
          <p className="text-[18px] font-bold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            {includedTotal.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <div
              key={item.id}
              className="overflow-hidden rounded-[22px] transition-all duration-200"
              style={{
                background: item.included ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.52)',
                border: `1px solid ${item.included ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                boxShadow: item.included ? 'var(--shadow-sm)' : 'none',
                opacity: item.included ? 1 : 0.82,
              }}
            >
              <div className="flex items-start gap-3 p-4">
                <button
                  type="button"
                  onClick={() => toggleInclude(item.id)}
                  className="flex-shrink-0 mt-0.5 transition-transform hover:scale-105"
                  title={item.included ? 'Exclude this line' : 'Include this line'}
                >
                  {item.included
                    ? <ToggleRight size={26} style={{ color: 'var(--accent-emerald)' }} />
                    : <ToggleLeft size={26} style={{ color: 'var(--text-tertiary)' }} />
                  }
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical size={14} style={{ color: 'var(--text-tertiary)' }} />
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {item.name || 'Unnamed item'}
                        </p>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span className="px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-inset)' }}>
                          {item.category || 'Expense category'}
                        </span>
                        {item.quantity && (
                          <span className="px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-inset)' }}>
                            Qty {item.quantity}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                        {item.amount}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: item.included ? 'var(--accent-emerald)' : 'var(--text-tertiary)' }}>
                        {item.included ? 'Included' : 'Excluded'}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="p-2 rounded-xl transition-colors"
                  style={{ color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  aria-label={isExpanded ? 'Collapse line item' : 'Expand line item'}
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="p-2 rounded-xl transition-colors"
                  style={{ color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  aria-label="Remove line item"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="grid gap-3 md:grid-cols-2 mt-3">
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                        Name
                      </span>
                      <input
                        type="text"
                        value={item.name}
                        onChange={e => updateItem(item.id, { name: e.target.value })}
                        className="input-field text-sm py-2"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                        Amount
                      </span>
                      <input
                        type="text"
                        value={item.amount}
                        onChange={e => updateItem(item.id, { amount: e.target.value })}
                        className="input-field text-sm py-2"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                        Quantity
                      </span>
                      <input
                        type="text"
                        value={item.quantity || ''}
                        onChange={e => updateItem(item.id, { quantity: e.target.value })}
                        className="input-field text-sm py-2"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                        Category
                      </span>
                      <select
                        className="input-field text-sm py-2"
                        value={item.category || ''}
                        onChange={e => updateItem(item.id, { category: e.target.value })}
                      >
                        <option value="">Inherit from expense</option>
                        {CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="glass-card p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Included lines total
            </p>
            <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              {includedTotal.toFixed(2)}
            </p>
          </div>
          <div className="space-y-1 md:text-right">
            <p className="text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Extracted bill total
            </p>
            <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              {extractedTotalNum > 0 ? extractedTotalNum.toFixed(2) : '—'}
            </p>
          </div>
        </div>

        {hasMismatch ? (
          <div className="space-y-3 rounded-2xl p-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.16)' }}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-amber)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Totals do not match
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  The included lines total {includedTotal.toFixed(2)} and the extracted bill total is {extractedTotalNum.toFixed(2)}. Confirm the mismatch if this is intentional.
                </p>
              </div>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={effectiveMismatchAcknowledged}
                onChange={e => setMismatchAcknowledged(e.target.checked)}
                className="mt-1 rounded border-[var(--border-default)]"
              />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                I confirm the included total is correct and should be submitted as the final amount.
              </span>
            </label>
            {isBlocking && (
              <p className="text-xs" style={{ color: 'var(--accent-amber)' }}>
                Confirm the mismatch before submitting the expense.
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl px-4 py-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.16)' }}>
            <CheckCircle size={14} style={{ color: 'var(--accent-emerald)' }} />
            <span className="text-sm" style={{ color: 'var(--accent-emerald)' }}>
              Line total matches the extracted bill total.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
