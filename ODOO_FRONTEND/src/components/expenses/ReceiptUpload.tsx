import { useEffect, useState, useCallback } from 'react';
import { receipts } from '@/api/client';
import { Upload, FileImage, FileText, X, AlertCircle, Loader2 } from 'lucide-react';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_SIZE_MB = 10;

interface ReceiptUploadProps {
  onUploadComplete: (receiptId: string) => void;
  disabled?: boolean;
}

export function ReceiptUpload({ onUploadComplete, disabled }: ReceiptUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Only JPEG, PNG, or PDF receipts are accepted.';
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File is too large. Maximum size is ${MAX_SIZE_MB}MB.`;
    }
    return null;
  };

  const handleFile = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setFileName(file.name);
    setFileSize(file.size);
    setPreviewType(file.type);

    let objectUrl: string | null = null;
    if (file.type.startsWith('image/')) {
      objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    } else {
      setPreviewUrl(null);
    }

    setUploading(true);
    try {
      const res = await receipts.upload(file);
      onUploadComplete(res.data.id);
    } catch (err) {
      const msg = (err as { error?: { message?: string } })?.error?.message || 'Upload failed. Please try again.';
      setError(msg);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setPreviewUrl(null);
      setPreviewType(null);
      setFileName(null);
      setFileSize(null);
    } finally {
      setUploading(false);
    }
  }, [onUploadComplete]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const clearPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewType(null);
    setFileName(null);
    setFileSize(null);
    setError(null);
  };

  const isPdf = previewType === 'application/pdf';

  return (
    <div className="space-y-4">
      {!fileName ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`relative overflow-hidden border-2 border-dashed rounded-[24px] p-8 md:p-10 flex flex-col items-center justify-center gap-4 transition-all duration-300 cursor-pointer ${disabled || uploading ? 'opacity-60 pointer-events-none' : ''}`}
          style={{
            borderColor: dragActive ? 'var(--primary)' : 'var(--border-default)',
            background: dragActive
              ? 'linear-gradient(135deg, rgba(74,124,255,0.08), rgba(139,92,246,0.05))'
              : 'rgba(255,255,255,0.5)',
            boxShadow: dragActive ? '0 16px 40px rgba(74,124,255,0.08)' : 'var(--shadow-sm)',
          }}
        >
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at top left, rgba(74,124,255,0.12), transparent 34%), radial-gradient(circle at bottom right, rgba(16,185,129,0.10), transparent 28%)',
            }}
          />
          <div className="relative p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.72)', border: '1px solid var(--border-subtle)' }}>
            <Upload size={24} style={{ color: 'var(--primary)' }} />
          </div>
          <div className="relative text-center max-w-sm space-y-2">
            <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Drop a receipt here, or browse files
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              JPEG, PNG, or PDF. The upload stays attached to the expense draft and feeds the OCR review step.
            </p>
            <label
              className="inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-full text-sm font-semibold transition-colors"
              style={{ color: 'var(--primary)', background: 'rgba(74,124,255,0.08)', border: '1px solid rgba(74,124,255,0.16)' }}
            >
              <FileImage size={14} />
              Choose file
              <input
                type="file"
                accept={ALLOWED_TYPES.join(',')}
                onChange={handleInputChange}
                className="hidden"
                disabled={disabled || uploading}
              />
            </label>
            <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Max {MAX_SIZE_MB}MB
            </p>
          </div>
        </div>
      ) : (
        <div
          className="relative overflow-hidden p-4 md:p-5"
          style={{
            background: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(16px) saturate(1.3)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="relative flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden"
              style={{ border: '1px solid var(--border-default)', background: 'var(--bg-inset)' }}
            >
              {previewUrl && !isPdf ? (
                <img src={previewUrl} alt="Receipt preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-center">
                  <FileText size={22} style={{ color: 'var(--primary)' }} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                    PDF
                  </span>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--primary)' }} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                    {fileName}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {isPdf ? 'PDF receipt' : 'Image receipt'}
                    {fileSize ? ` · ${(fileSize / (1024 * 1024)).toFixed(1)}MB` : ''}
                  </p>
                </div>
                {!uploading && (
                  <button
                    onClick={clearPreview}
                    className="p-1.5 rounded-xl transition-colors"
                    style={{ color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    aria-label="Remove receipt"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {uploading ? (
                <div className="space-y-2">
                  <div className="progress-bar w-full overflow-hidden">
                    <div className="progress-bar-fill animate-pulse" style={{ width: '100%' }} />
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Uploading securely and preparing OCR intake...
                  </p>
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  The file is attached and ready for extraction.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {fileName && !uploading && (
        <button
          onClick={clearPreview}
          className="inline-flex items-center gap-2 text-xs font-semibold transition-colors"
          style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <X size={13} />
          Replace file
        </button>
      )}

      {error && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-xl animate-fade-in"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.16)',
          }}
        >
          <AlertCircle size={14} style={{ color: 'var(--accent-rose)' }} className="flex-shrink-0 mt-0.5" />
          <span className="text-xs leading-relaxed" style={{ color: 'var(--accent-rose)' }}>
            {error}
          </span>
        </div>
      )}
    </div>
  );
}
