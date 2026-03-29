import { clsx } from 'clsx';

interface ConfidenceIndicatorProps {
  confidence: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

function getLevel(confidence: number): { label: string; color: string } {
  if (confidence >= 0.85) return { label: 'High', color: '#10B981' };
  if (confidence >= 0.6) return { label: 'Medium', color: '#F59E0B' };
  return { label: 'Low', color: '#EF4444' };
}

export function ConfidenceIndicator({ confidence, showLabel = true, size = 'md' }: ConfidenceIndicatorProps) {
  const level = getLevel(confidence);
  const pct = Math.round(confidence * 100);

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-semibold',
        size === 'sm' ? 'text-[10px]' : 'text-xs'
      )}
      title={`Confidence: ${pct}%`}
    >
      {/* Mini bar */}
      <span className="inline-flex gap-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={clsx(
              'rounded-full transition-all duration-300',
              size === 'sm' ? 'h-1 w-2.5' : 'h-1.5 w-3',
            )}
            style={{
              background: i < Math.ceil(confidence * 4) ? level.color : 'var(--bg-inset)',
            }}
          />
        ))}
      </span>
      {showLabel && (
        <span style={{ color: level.color }}>
          {level.label} ({pct}%)
        </span>
      )}
    </span>
  );
}
