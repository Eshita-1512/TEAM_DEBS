import { useState } from 'react';
import { AlertTriangle, CheckCircle, Edit2, ScanText, FileText } from 'lucide-react';
import { ConfidenceIndicator } from '@/components/shared/ConfidenceIndicator';
import type { OcrResult, OcrStructuredFields } from '@/types/api';

interface EditableOcrFields extends OcrStructuredFields {
  [key: string]: string;
}

interface OcrDraftReviewProps {
  ocrResult: OcrResult;
  onFieldsConfirmed: (fields: EditableOcrFields) => void;
}

const FIELD_LABELS: Record<keyof OcrStructuredFields, string> = {
  merchant_name: 'Merchant / Vendor',
  expense_date: 'Date',
  currency: 'Currency',
  total_amount: 'Total Amount',
  description_hint: 'Description',
};

const FIELD_TYPES: Record<keyof OcrStructuredFields, string> = {
  merchant_name: 'text',
  expense_date: 'date',
  currency: 'text',
  total_amount: 'text',
  description_hint: 'text',
};

export function OcrDraftReview({ ocrResult, onFieldsConfirmed }: OcrDraftReviewProps) {
  const [fields, setFields] = useState<EditableOcrFields>(() => ({ ...ocrResult.structured_fields }));
  const confidence = parseFloat(ocrResult.confidence);
  const isLowConfidence = confidence < 0.6;

  const handleChange = (key: string, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  const handleConfirm = () => {
    onFieldsConfirmed(fields);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] animate-fade-in">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)' }}>
              OCR draft
            </p>
            <h3 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Review the extracted receipt fields
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              This is a suggested draft, not the final expense. Correct anything that looks off before continuing.
            </p>
          </div>
          <ConfidenceIndicator confidence={confidence} />
        </div>

        {ocrResult.warnings.length > 0 && (
          <div className="space-y-2">
            {ocrResult.warnings.map((warning, index) => (
              <div
                key={index}
                className="flex items-start gap-2 px-4 py-3 rounded-2xl"
                style={{
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.18)',
                }}
              >
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-amber)' }} />
                <span className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {warning}
                </span>
              </div>
            ))}
          </div>
        )}

        {isLowConfidence && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-2xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.16)' }}>
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-rose)' }} />
            <p className="text-sm leading-relaxed" style={{ color: 'var(--accent-rose)' }}>
              Low-confidence extraction. Treat every field as editable evidence before you move to line review.
            </p>
          </div>
        )}

        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ScanText size={16} style={{ color: 'var(--primary)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Extracted fields
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Merchant, date, currency, total, and description are the key draft inputs.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {(Object.keys(FIELD_LABELS) as (keyof OcrStructuredFields)[]).map((key) => {
              const isEmpty = !fields[key];
              return (
                <label key={key} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                      {FIELD_LABELS[key]}
                    </span>
                    {isEmpty && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ color: 'var(--accent-amber)', background: 'rgba(245,158,11,0.10)' }}>
                        missing
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={FIELD_TYPES[key]}
                      value={fields[key] || ''}
                      onChange={e => handleChange(key as string, e.target.value)}
                      placeholder={isEmpty ? 'Enter manually' : undefined}
                      className={`input-field pr-9 ${isEmpty ? 'border-[var(--color-accent-amber)]/40' : ''}`}
                    />
                    <Edit2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleConfirm}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <CheckCircle size={16} />
          Use these fields
        </button>
      </div>

      <div className="space-y-4">
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FileText size={16} style={{ color: 'var(--primary)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Evidence snapshot
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Keep the source visible while you edit the draft.
              </p>
            </div>
          </div>
          <div className="space-y-3 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.56)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                Merchant
              </span>
              <span className="text-sm font-medium text-right" style={{ color: 'var(--text-primary)' }}>
                {fields.merchant_name || 'Not detected'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                Total
              </span>
              <span className="text-sm font-medium text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {fields.currency || '---'} {fields.total_amount || '0.00'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                Date
              </span>
              <span className="text-sm font-medium text-right" style={{ color: 'var(--text-primary)' }}>
                {fields.expense_date || 'Not detected'}
              </span>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 space-y-3">
          <p className="text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
            Raw OCR text
          </p>
          <pre
            className="text-xs leading-relaxed whitespace-pre-wrap rounded-2xl p-4 max-h-72 overflow-auto"
            style={{
              color: 'var(--text-secondary)',
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {ocrResult.raw_text || 'No raw text was returned by the OCR pipeline.'}
          </pre>
        </div>
      </div>
    </div>
  );
}

export type { EditableOcrFields };
