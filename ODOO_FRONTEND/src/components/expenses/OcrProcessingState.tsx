import { Loader2, AlertCircle, RefreshCw, ScanLine, Sparkles, FileText, ShieldCheck } from 'lucide-react';
import { receipts } from '@/api/client';
import { useOcrPolling } from '@/hooks/useOcrPolling';
import type { OcrResult } from '@/types/api';

interface OcrProcessingStateProps {
  receiptId: string;
  onCompleted: (result: OcrResult) => void;
  onFailed: () => void;
}

const pipelineSteps = [
  { label: 'Receipt intake', icon: ScanLine },
  { label: 'OCR text extraction', icon: FileText },
  { label: 'Field normalization', icon: Sparkles },
  { label: 'Draft handoff', icon: ShieldCheck },
];

export function OcrProcessingState({ receiptId, onCompleted, onFailed }: OcrProcessingStateProps) {
  const { ocrResult, isPolling, error } = useOcrPolling({
    receiptId,
    enabled: true,
    onCompleted,
    onFailed,
  });

  const handleReprocess = async () => {
    try {
      await receipts.reprocess(receiptId);
    } catch {
      // Polling will continue and surface backend state when available.
    }
  };

  if (error && !isPolling && !ocrResult) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 animate-fade-in">
        <div
          className="p-4 rounded-2xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.16)' }}
        >
          <AlertCircle size={28} style={{ color: 'var(--accent-rose)' }} />
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            OCR intake could not start
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            The extraction service was unavailable. You can retry or switch to manual entry.
          </p>
        </div>
        <button onClick={handleReprocess} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} />
          Retry extraction
        </button>
      </div>
    );
  }

  if (ocrResult?.status === 'failed') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 animate-fade-in">
        <div
          className="p-4 rounded-2xl"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.16)' }}
        >
          <AlertCircle size={28} style={{ color: 'var(--accent-amber)' }} />
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Extraction finished, but the draft was incomplete
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            You can retry the receipt or continue manually without losing the upload.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={onFailed} className="btn-secondary text-sm">
            Enter manually
          </button>
          <button onClick={handleReprocess} className="btn-primary flex items-center gap-2 text-sm">
            <RefreshCw size={14} />
            Retry extraction
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] animate-fade-in">
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <div
            className="relative flex-shrink-0 p-4 rounded-[24px] overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(74,124,255,0.12), rgba(139,92,246,0.08))',
              border: '1px solid rgba(74,124,255,0.16)',
            }}
          >
            <div className="absolute inset-0 animate-pulse" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.35), transparent 55%)' }} />
            <Loader2 size={30} className="relative animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)' }}>
              OCR pipeline
            </p>
            <h3 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Extracting receipt data
            </h3>
            <p className="text-sm leading-relaxed max-w-xl" style={{ color: 'var(--text-secondary)' }}>
              The file is being read, normalized, and converted into an editable expense draft. Keep this screen open; the review form appears automatically when extraction completes.
            </p>
          </div>
        </div>

        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                Processing stages
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                The pipeline is sequential and audit-safe.
              </p>
            </div>
            {ocrResult?.status && (
              <span className="text-[11px] font-semibold px-3 py-1 rounded-full" style={{ color: 'var(--primary)', background: 'rgba(74,124,255,0.08)', border: '1px solid rgba(74,124,255,0.16)' }}>
                {ocrResult.status}
              </span>
            )}
          </div>

          <div className="grid gap-3 stagger-children">
            {pipelineSteps.map((step, index) => {
              const Icon = step.icon;
              const active = index === 0 || isPolling;
              return (
                <div
                  key={step.label}
                  className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{
                    background: active ? 'rgba(74,124,255,0.05)' : 'var(--bg-inset)',
                    border: `1px solid ${active ? 'rgba(74,124,255,0.14)' : 'var(--border-subtle)'}`,
                  }}
                >
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: active ? 'rgba(74,124,255,0.10)' : 'rgba(156,163,175,0.08)' }}>
                    <Icon size={16} style={{ color: active ? 'var(--primary)' : 'var(--text-tertiary)' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {step.label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: active ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                      {active ? 'In progress or queued' : 'Waiting'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="glass-card p-5 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
            What happens next
          </p>
          <h4 className="mt-1 text-[16px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            The draft will open with review-ready fields
          </h4>
        </div>
        <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <p>The merchant, date, total, and currency are lifted into editable fields.</p>
          <p>Any extracted line items appear as a ledger so you can include, exclude, or correct them before submission.</p>
          <p>Low-confidence reads and warnings stay visible so the audit trail is explicit.</p>
        </div>
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'rgba(255,255,255,0.56)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
            OCR status
          </p>
          <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {ocrResult?.status === 'processing' || !ocrResult ? 'Working through the receipt now' : 'Draft ready'}
          </p>
        </div>
      </div>
    </div>
  );
}
