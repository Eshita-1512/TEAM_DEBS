import { useEffect } from 'react';

const REACTIVE_SELECTOR = [
  '.surface-panel',
  '.page-hero',
  '.editorial-form-shell',
  '.editorial-feature',
  '.editorial-chip',
  '.ops-info-card',
  '.btn-primary',
  '.btn-secondary',
  '.btn-ghost',
  '.input-field',
].join(', ');

function clearSurface(surface: HTMLElement | null) {
  if (!surface) return;
  surface.style.removeProperty('--cursor-local-x');
  surface.style.removeProperty('--cursor-local-y');
  surface.style.removeProperty('--cursor-hover');
  surface.style.removeProperty('transform');
}

export function CursorField() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const canTrack = window.matchMedia('(pointer: fine)').matches
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!canTrack) {
      root.style.setProperty('--cursor-active', '0');
      return;
    }

    let frame = 0;
    let activeSurface: HTMLElement | null = null;

    const onPointerMove = (event: PointerEvent) => {
      if (frame) cancelAnimationFrame(frame);

      frame = window.requestAnimationFrame(() => {
        root.style.setProperty('--cursor-x', `${event.clientX}`);
        root.style.setProperty('--cursor-y', `${event.clientY}`);
        root.style.setProperty('--cursor-active', '1');

        const nextSurface = (event.target as HTMLElement | null)?.closest(REACTIVE_SELECTOR) as HTMLElement | null;
        if (activeSurface !== nextSurface) {
          clearSurface(activeSurface);
          activeSurface = nextSurface;
        }

        if (!activeSurface) return;

        const rect = activeSurface.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        const rotateX = (y - 50) / -18;
        const rotateY = (x - 50) / 16;

        activeSurface.style.setProperty('--cursor-local-x', `${x}%`);
        activeSurface.style.setProperty('--cursor-local-y', `${y}%`);
        activeSurface.style.setProperty('--cursor-hover', '1');
        activeSurface.style.transform = `perspective(1100px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
      });
    };

    const onPointerLeave = () => {
      if (frame) cancelAnimationFrame(frame);
      root.style.setProperty('--cursor-active', '0');
      clearSurface(activeSurface);
      activeSurface = null;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('blur', onPointerLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      clearSurface(activeSurface);
      root.style.setProperty('--cursor-active', '0');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('blur', onPointerLeave);
    };
  }, []);

  return (
    <>
      <style>{`
        :root {
          --cursor-x: 50vw;
          --cursor-y: 30vh;
          --cursor-active: 0;
        }

        body {
          overflow-x: hidden;
        }

        .cursor-field {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: calc(0.45 + (var(--cursor-active) * 0.35));
          background:
            radial-gradient(32rem circle at calc(var(--cursor-x) * 1px) calc(var(--cursor-y) * 1px), rgba(15, 96, 106, 0.18), transparent 58%),
            radial-gradient(18rem circle at calc(var(--cursor-x) * 1px) calc(var(--cursor-y) * 1px), rgba(214, 180, 104, 0.12), transparent 52%);
          transition: opacity 220ms ease;
        }

        .cursor-grid {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.18;
          background-image:
            linear-gradient(rgba(15, 23, 24, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15, 23, 24, 0.05) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at calc(var(--cursor-x) * 1px) calc(var(--cursor-y) * 1px), black 0%, transparent 70%);
          -webkit-mask-image: radial-gradient(circle at calc(var(--cursor-x) * 1px) calc(var(--cursor-y) * 1px), black 0%, transparent 70%);
        }

        .surface-panel,
        .page-hero,
        .editorial-form-shell,
        .editorial-feature,
        .editorial-chip,
        .ops-info-card,
        .btn-primary,
        .btn-secondary,
        .btn-ghost,
        .input-field {
          position: relative;
          transform-style: preserve-3d;
          will-change: transform;
          transition:
            transform 180ms ease,
            box-shadow 220ms ease,
            border-color 220ms ease,
            background-color 220ms ease;
        }

        .surface-panel::before,
        .page-hero::before,
        .editorial-form-shell::before,
        .editorial-feature::before,
        .editorial-chip::before,
        .ops-info-card::before,
        .btn-primary::before,
        .btn-secondary::before,
        .btn-ghost::before,
        .input-field::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background: radial-gradient(220px circle at var(--cursor-local-x, 50%) var(--cursor-local-y, 50%), rgba(255, 255, 255, 0.26), transparent 62%);
          opacity: var(--cursor-hover, 0);
          transition: opacity 180ms ease;
        }

        .surface-panel:hover,
        .page-hero:hover,
        .editorial-form-shell:hover,
        .editorial-feature:hover,
        .editorial-chip:hover,
        .ops-info-card:hover,
        .input-field:hover {
          box-shadow: 0 18px 36px rgba(15, 23, 24, 0.08);
        }

        @media (pointer: coarse), (prefers-reduced-motion: reduce) {
          .cursor-field,
          .cursor-grid {
            display: none;
          }
        }
      `}</style>
      <div className="cursor-field" />
      <div className="cursor-grid" />
    </>
  );
}
