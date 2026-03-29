import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ActionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  title: string;
  description?: string;
  actionLabel: string;
  actionVariant: 'success' | 'danger' | 'warning' | 'primary';
  requireComment?: boolean;
  loading?: boolean;
}

export function ActionConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  actionLabel,
  actionVariant,
  requireComment = false,
  loading = false,
}: ActionConfirmModalProps) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireComment && !comment.trim()) {
      setError('A comment is required for this action');
      return;
    }
    onConfirm(comment);
    setComment('');
    setError('');
  };

  const handleClose = () => {
    setComment('');
    setError('');
    onClose();
  };

  const btnClass = {
    success: 'btn-success',
    danger: 'btn-danger',
    warning: 'btn-warning',
    primary: 'btn-primary',
  }[actionVariant];

  const iconBg = {
    danger: 'rgba(239,68,68,0.08)',
    warning: 'rgba(245,158,11,0.08)',
    success: 'rgba(16,185,129,0.08)',
    primary: 'rgba(74,124,255,0.08)',
  }[actionVariant];

  const iconColor = {
    danger: '#EF4444',
    warning: '#F59E0B',
    success: '#10B981',
    primary: '#4A7CFF',
  }[actionVariant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in"
        style={{
          background: 'rgba(0,0,0,0.2)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className="surface-panel relative w-full max-w-md p-7 animate-fade-in-scale"
        style={{
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 p-1 rounded-lg transition-all duration-150"
          style={{ 
            color: 'var(--text-tertiary)', 
            background: 'transparent', 
            border: 'none', 
            cursor: 'pointer' 
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-inset)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-4 mb-5">
          {(actionVariant === 'danger' || actionVariant === 'warning') && (
            <div
              className="p-2.5 rounded-xl flex-shrink-0"
              style={{ background: iconBg }}
            >
              <AlertTriangle size={20} style={{ color: iconColor }} />
            </div>
          )}
          <div>
            <h3
              className="font-display text-lg font-semibold"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
            >
              {title}
            </h3>
            {description && (
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Comment input */}
        <div className="mb-5">
          <label
            className="block text-xs font-semibold mb-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            Comment {requireComment ? <span style={{ color: 'var(--accent-rose)' }}>*</span> : '(optional)'}
          </label>
          <textarea
            value={comment}
            onChange={e => { setComment(e.target.value); setError(''); }}
            placeholder={requireComment ? 'Please provide a reason...' : 'Add a comment...'}
            className="input-field text-sm"
            rows={3}
          />
          {error && (
            <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--accent-rose)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <button onClick={handleClose} className="btn-secondary text-sm">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`${btnClass} text-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Processing...' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
