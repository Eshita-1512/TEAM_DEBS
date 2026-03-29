import type { TimelineEvent } from '@/types/api';
import { StatusBadge } from './StatusBadge';
import { Check, X, PauseCircle, PlayCircle, MessageSquare, Send, FileText } from 'lucide-react';
import { formatDateTime, formatLabel } from '@/lib/formatters';

const actionIcons: Record<string, React.ReactNode> = {
  approve: <Check size={16} style={{ color: '#10B981' }} />,
  reject: <X size={16} style={{ color: '#EF4444' }} />,
  hold: <PauseCircle size={16} style={{ color: '#F59E0B' }} />,
  resume: <PlayCircle size={16} style={{ color: '#4A7CFF' }} />,
  comment: <MessageSquare size={16} style={{ color: 'var(--text-secondary)' }} />,
  submit: <Send size={16} style={{ color: '#4A7CFF' }} />,
  submission: <Send size={16} style={{ color: '#4A7CFF' }} />,
  reimburse: <FileText size={16} style={{ color: '#06B6D4' }} />,
};

const actionColors: Record<string, string> = {
  approve: 'rgba(16,185,129,0.1)',
  reject: 'rgba(239,68,68,0.1)',
  hold: 'rgba(245,158,11,0.1)',
  resume: 'rgba(74,124,255,0.1)',
  submit: 'rgba(74,124,255,0.1)',
  submission: 'rgba(74,124,255,0.1)',
  reimburse: 'rgba(6,182,212,0.1)',
  comment: 'var(--bg-inset)',
};

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    approve: 'Approved',
    reject: 'Rejected',
    hold: 'Put On Hold',
    resume: 'Resumed',
    comment: 'Commented',
    submit: 'Submitted',
    submission: 'Submitted',
    reimburse: 'Reimbursed',
    ocr_confirmation: 'OCR Confirmed',
    role_change: 'Role Changed',
    policy_change: 'Policy Updated',
  };
  return labels[action] || formatLabel(action);
}

interface TimelineProps {
  events: TimelineEvent[];
  loading?: boolean;
}

export function Timeline({ events, loading }: TimelineProps) {
  if (loading) {
    return (
      <div className="space-y-4 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="shimmer h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="shimmer h-4 w-48" />
              <div className="shimmer h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
        No workflow events yet
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical connector line */}
      <div
        className="absolute left-5 top-0 bottom-0 w-px"
        style={{
          background: 'linear-gradient(to bottom, var(--border-default), transparent)',
        }}
      />

      <div className="space-y-0 stagger-children">
        {events.map((event) => (
          <div
            key={event.id}
            className="relative flex gap-4 py-4 pl-1"
          >
            {/* Step dot */}
            <div
              className="relative z-10 flex items-center justify-center h-10 w-10 rounded-full flex-shrink-0 transition-transform duration-200 hover:scale-110"
              style={{
                background: actionColors[event.action] || 'var(--bg-inset)',
                border: '2px solid var(--bg-base)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {actionIcons[event.action] || <MessageSquare size={14} style={{ color: 'var(--text-tertiary)' }} />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="font-semibold text-sm"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                >
                  {event.actor_name}
                </span>
                <StatusBadge status={event.action} size="sm" />
                {event.step_sequence !== null && (
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      color: 'var(--text-tertiary)',
                      background: 'var(--bg-inset)',
                    }}
                  >
                    Step {event.step_sequence}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                {getActionLabel(event.action)} · {formatDateTime(event.timestamp)}
              </p>
              {event.comment && (
                <div
                  className="mt-2 px-3 py-2.5 rounded-xl text-sm"
                  style={{
                    background: 'var(--surface-sunken)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontStyle: 'italic',
                  }}
                >
                  "{event.comment}"
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
