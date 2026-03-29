import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, Loader2, PenLine, Receipt } from 'lucide-react';
import { expenses, reference } from '@/api/client';
import { LineItemEditor, type LineItemState, type LineItemValidationState } from '@/components/expenses/LineItemEditor';
import { OcrDraftReview, type EditableOcrFields } from '@/components/expenses/OcrDraftReview';
import { OcrProcessingState } from '@/components/expenses/OcrProcessingState';
import { ReceiptUpload } from '@/components/expenses/ReceiptUpload';
import { useAuth } from '@/hooks/useAuth';
import type { CreateExpenseRequest, OcrLineItem, OcrResult } from '@/types/api';

type EntryMode = 'choose' | 'manual' | 'receipt';
type ReceiptStep = 'upload' | 'processing' | 'review' | 'lines';

const CATEGORIES = [
  'Meals',
  'Travel',
  'Accommodation',
  'Transport',
  'Office Supplies',
  'Software',
  'Hardware',
  'Training',
  'Marketing',
  'Other',
];

interface FormState {
  category: string;
  description: string;
  expense_date: string;
  original_currency: string;
  original_amount: string;
  receipt_id: string;
}

const initialFormState = (): FormState => ({
  category: '',
  description: '',
  expense_date: new Date().toISOString().split('T')[0],
  original_currency: 'USD',
  original_amount: '',
  receipt_id: '',
});

const MANUAL_STEPS = ['Details', 'Line items', 'Submit'];
const RECEIPT_STEPS = ['Upload', 'Review', 'Line items', 'Submit'];

function buildLineItemsPayload(items: LineItemState[], category: string): CreateExpenseRequest['line_items'] {
  return items.map((line: OcrLineItem) => ({
    source_line_id: line.id,
    name: line.name,
    amount: line.amount,
    category: line.category || category,
    included: line.included,
  }));
}

function formatAmount(currency: string, value: string) {
  const parsed = Number.parseFloat(value || '0');
  if (Number.isNaN(parsed)) return `${currency} 0.00`;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(parsed);
  } catch {
    return `${currency} ${parsed.toFixed(2)}`;
  }
}

export function NewExpensePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const companyCurrency = user?.company.default_currency ?? 'USD';

  const [mode, setMode] = useState<EntryMode>('choose');
  const [receiptStep, setReceiptStep] = useState<ReceiptStep>('upload');
  const [form, setForm] = useState<FormState>(() => initialFormState());
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'line_items', string>>>({});
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [lineItems, setLineItems] = useState<LineItemState[]>([]);
  const [lineValidation, setLineValidation] = useState<LineItemValidationState>({
    hasMismatch: false,
    mismatchAcknowledged: false,
    isBlocking: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const derivedConversion = useMemo(() => {
    const amount = Number.parseFloat(form.original_amount || '0');
    if (Number.isNaN(amount)) {
      return null;
    }

    if (form.original_currency === companyCurrency) {
      return {
        convertedAmount: amount.toFixed(2),
        conversionRate: '1.000000',
      };
    }

    return null;
  }, [companyCurrency, form.original_amount, form.original_currency]);

  const updateField = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleModeChange = (nextMode: EntryMode) => {
    setMode(nextMode);
    setSubmitError(null);
  };

  const handleUploadComplete = (id: string) => {
    setReceiptId(id);
    setForm(prev => ({ ...prev, receipt_id: id }));
    setReceiptStep('processing');
  };

  const handleOcrCompleted = useCallback((result: OcrResult) => {
    setOcrResult(result);
    setReceiptStep('review');
  }, []);

  const handleOcrFailed = useCallback(() => {
    setReceiptStep('upload');
    setMode('manual');
  }, []);

  const handleFieldsConfirmed = (fields: EditableOcrFields) => {
    setForm(prev => ({
      ...prev,
      description: fields.description_hint || prev.description,
      expense_date: fields.expense_date || prev.expense_date,
      original_currency: fields.currency || prev.original_currency,
      original_amount: fields.total_amount || prev.original_amount,
    }));
    setLineItems(ocrResult?.line_items ?? []);
    setReceiptStep('lines');
  };

  const handleItemsChange = useCallback(
    (items: LineItemState[], _includedTotal: number, validation: LineItemValidationState) => {
      setLineItems(items);
      setLineValidation(validation);
      setErrors(prev => ({
        ...prev,
        line_items: validation.isBlocking ? 'Confirm the line-item mismatch before submitting.' : '',
      }));
    },
    [],
  );

  const validate = () => {
    const nextErrors: Partial<Record<keyof FormState | 'line_items', string>> = {};

    if (!form.category) nextErrors.category = 'Category is required.';
    if (!form.description.trim()) nextErrors.description = 'Description is required.';
    if (!form.expense_date) nextErrors.expense_date = 'Expense date is required.';
    if (!form.original_currency.trim()) nextErrors.original_currency = 'Currency is required.';

    const amount = Number.parseFloat(form.original_amount || '');
    if (Number.isNaN(amount) || amount <= 0) {
      nextErrors.original_amount = 'Enter a valid amount.';
    }

    if (lineValidation.isBlocking) {
      nextErrors.line_items = 'Confirm the line-item mismatch before submitting.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (submitting || !validate()) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload: CreateExpenseRequest = {
        category: form.category,
        description: form.description.trim(),
        expense_date: form.expense_date,
        original_currency: form.original_currency.trim().toUpperCase(),
        original_amount: form.original_amount,
        receipt_id: form.receipt_id || undefined,
        line_items: lineItems.length > 0 ? buildLineItemsPayload(lineItems, form.category) : undefined,
      };

      const created = await expenses.create(payload);
      navigate(`/app/expenses/${created.data.id}`);
    } catch (error) {
      const message =
        (error as { error?: { message?: string } })?.error?.message ||
        'Expense submission failed. Fix the input and try again.';
      setSubmitError(message);
      setSubmitting(false);
    }
  };

  const fetchPreviewConversion = async () => {
    if (!form.original_currency || form.original_currency === companyCurrency) {
      return;
    }

    try {
      await reference.exchangeRates(form.original_currency);
    } catch {
      // Preview only. Submission does not depend on rates here.
    }
  };

  const receiptReviewKey = receiptId ?? ocrResult?.raw_text ?? 'receipt-review';
  const lineEditorKey = `${receiptId ?? 'manual'}:${lineItems.map(item => item.id).join(',')}`;
  const activeSteps = mode === 'receipt' ? RECEIPT_STEPS : MANUAL_STEPS;
  const activeStepIndex =
    mode === 'manual'
      ? 1
      : receiptStep === 'upload'
        ? 1
        : receiptStep === 'processing' || receiptStep === 'review'
          ? 2
          : 3;

  if (mode === 'choose') {
    return (
      <div className="mx-auto max-w-6xl space-y-8 animate-fade-in">
        <section className="page-hero">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <button
                type="button"
                onClick={() => navigate('/app/expenses')}
                className="btn-secondary mb-5 inline-flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                Back to expenses
              </button>
              <div className="section-kicker">Expense creation</div>
              <h1 className="mt-3 text-[2.2rem] font-semibold tracking-[-0.04em] text-[var(--text-primary)] [font-family:var(--font-display)]">
                Start with the clearest entry path.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
                Use receipt-driven entry when OCR will save time, and use manual entry when the numbers are already known. The goal is a clean claim, not extra interface work.
              </p>
            </div>

            <div className="aside-surface max-w-sm p-5">
              <div className="section-kicker">Before you choose</div>
              <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
                <p>Receipt upload works best when the document is clear and itemized.</p>
                <p>Manual entry is faster for simple claims or poor-quality receipts.</p>
                <p>Both paths lead to the same final review standard.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <button
            type="button"
            onClick={() => handleModeChange('receipt')}
            className="narrative-panel p-7 text-left transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-md">
                <div className="section-kicker">Recommended when a receipt is available</div>
                <p className="mt-3 text-[1.4rem] font-semibold tracking-[-0.03em] text-[var(--text-primary)] [font-family:var(--font-display)]">
                  Upload a receipt and confirm the draft.
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                  OCR proposes the fields and line items, but you stay in control of what gets submitted.
                </p>
              </div>
              <div className="rounded-[1rem] p-3" style={{ background: 'rgba(37,99,235,0.08)' }}>
                <Receipt size={22} style={{ color: 'var(--primary)' }} />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-5 text-sm font-medium text-[var(--text-primary)]">
              <span>Upload, review, line check, submit</span>
              <ChevronRight size={16} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('manual')}
            className="narrative-panel p-7 text-left transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-md">
                <div className="section-kicker">Best for known amounts</div>
                <p className="mt-3 text-[1.4rem] font-semibold tracking-[-0.03em] text-[var(--text-primary)] [font-family:var(--font-display)]">
                  Enter the expense manually.
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                  Go straight to the required fields when the receipt quality is weak or the numbers are already known.
                </p>
              </div>
              <div className="rounded-[1rem] p-3" style={{ background: 'rgba(34,197,94,0.08)' }}>
                <PenLine size={22} style={{ color: 'var(--accent-emerald)' }} />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-5 text-sm font-medium text-[var(--text-primary)]">
              <span>Details, line items, submit</span>
              <ChevronRight size={16} />
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <section className="page-hero">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <button type="button" onClick={() => handleModeChange('choose')} className="text-sm font-medium text-[var(--text-secondary)]">
              Back to entry options
            </button>
            <div className="section-kicker mt-4">{mode === 'receipt' ? 'Receipt-assisted flow' : 'Manual flow'}</div>
            <h1 className="mt-3 text-[2.2rem] font-semibold tracking-[-0.04em] text-[var(--text-primary)] [font-family:var(--font-display)]">
              {mode === 'receipt' ? 'Review the draft, then send a clean claim.' : 'Build the claim with only the fields that matter.'}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
              {mode === 'receipt'
                ? 'OCR stays in a supporting role. You confirm the extracted fields, review the lines, and only then submit.'
                : 'Manual entry stays compact: enter the essentials, verify line items where needed, and submit without extra interface work.'}
            </p>
          </div>

          <button type="button" onClick={() => navigate('/app/expenses')} className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft size={14} />
            Exit
          </button>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-4">
          {activeSteps.map((step, index) => {
            const done = index + 1 < activeStepIndex;
            const active = index + 1 === activeStepIndex;
            return (
              <div
                key={step}
                className="rounded-[1rem] border px-4 py-3"
                style={{
                  borderColor: active ? 'var(--border-strong)' : 'var(--border)',
                  background: active ? 'rgba(37,99,235,0.08)' : '#ffffff',
                }}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {done ? <CheckCircle2 size={13} className="text-[var(--success)]" /> : <span>{index + 1}</span>}
                  Step
                </div>
                <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">{step}</div>
              </div>
            );
          })}
        </div>
      </section>

      {mode === 'receipt' && receiptStep === 'upload' && (
        <ReceiptUpload onUploadComplete={handleUploadComplete} disabled={submitting} />
      )}

      {mode === 'receipt' && receiptId && receiptStep === 'processing' && (
        <OcrProcessingState receiptId={receiptId} onCompleted={handleOcrCompleted} onFailed={handleOcrFailed} />
      )}

      {mode === 'receipt' && ocrResult && receiptStep === 'review' && (
        <OcrDraftReview key={receiptReviewKey} ocrResult={ocrResult} onFieldsConfirmed={handleFieldsConfirmed} />
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="narrative-panel p-6 space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Expense details
            </p>
            <h2 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--text-primary)] [font-family:var(--font-display)]">
              Check the essentials before you submit.
            </h2>
          </div>

          <div className="grid gap-4 border-b border-[var(--border)] pb-6 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                Category
              </span>
              <select
                value={form.category}
                onChange={event => updateField('category', event.target.value)}
                className="input-field"
              >
                <option value="">Select a category</option>
                {CATEGORIES.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {errors.category && <p className="text-xs text-[var(--accent-rose)]">{errors.category}</p>}
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                Expense date
              </span>
              <input
                type="date"
                value={form.expense_date}
                onChange={event => updateField('expense_date', event.target.value)}
                className="input-field"
              />
              {errors.expense_date && <p className="text-xs text-[var(--accent-rose)]">{errors.expense_date}</p>}
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                Description
              </span>
              <textarea
                value={form.description}
                onChange={event => updateField('description', event.target.value)}
                className="input-field min-h-28"
                placeholder="What was this expense for?"
              />
              {errors.description && <p className="text-xs text-[var(--accent-rose)]">{errors.description}</p>}
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                Currency
              </span>
              <input
                type="text"
                value={form.original_currency}
                onChange={event => updateField('original_currency', event.target.value.toUpperCase())}
                onBlur={fetchPreviewConversion}
                className="input-field"
                placeholder="USD"
              />
              {errors.original_currency && <p className="text-xs text-[var(--accent-rose)]">{errors.original_currency}</p>}
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                Amount
              </span>
              <input
                type="text"
                value={form.original_amount}
                onChange={event => updateField('original_amount', event.target.value)}
                className="input-field"
                placeholder="0.00"
              />
              {errors.original_amount && <p className="text-xs text-[var(--accent-rose)]">{errors.original_amount}</p>}
            </label>
          </div>

          {(mode === 'manual' || receiptStep === 'lines') && (
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Line items
                </p>
                <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  Exclusions without confirmation are blocked. That guardrail is intentional.
                </p>
              </div>
              <LineItemEditor
                key={lineEditorKey}
                initialItems={lineItems}
                extractedTotal={form.original_amount}
                onItemsChange={handleItemsChange}
              />
              {errors.line_items && <p className="text-xs text-[var(--accent-rose)]">{errors.line_items}</p>}
            </div>
          )}
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="aside-surface p-5">
            <div className="section-kicker">Submission standard</div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
              <p>Use a category that matches the primary expense purpose.</p>
              <p>Make the description explain the business context, not just the merchant name.</p>
              <p>Confirm the total and included line items before sending the record forward.</p>
            </div>
          </div>

          <div className="aside-surface p-6 space-y-4">
            <div>
            <p className="text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Submission summary
            </p>
            <h2 className="text-[18px] font-bold mt-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              What will be sent
            </h2>
          </div>

          <div className="space-y-3 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.56)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Original total</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {formatAmount(form.original_currency || companyCurrency, form.original_amount || '0')}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Company currency</span>
              <strong style={{ color: 'var(--text-primary)' }}>{companyCurrency}</strong>
            </div>
            {derivedConversion && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Converted preview</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {formatAmount(companyCurrency, derivedConversion.convertedAmount)}
                </strong>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Receipt attached</span>
              <strong style={{ color: 'var(--text-primary)' }}>{form.receipt_id ? 'Yes' : 'No'}</strong>
            </div>
          </div>

          {submitError && (
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'rgba(239,68,68,0.16)', background: 'rgba(239,68,68,0.08)' }}>
              <div className="flex items-start gap-2">
                <AlertCircle size={15} className="mt-0.5" style={{ color: 'var(--accent-rose)' }} />
                <p className="text-sm leading-6" style={{ color: 'var(--accent-rose)' }}>
                  {submitError}
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || (mode === 'receipt' && receiptStep === 'processing')}
            className="btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            Submit expense
          </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
