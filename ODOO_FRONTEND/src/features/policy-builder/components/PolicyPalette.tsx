import { useDraggable } from '@dnd-kit/core';
import {
  BadgeCheck,
  BriefcaseBusiness,
  Percent,
  Route,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';

type PaletteBlockType =
  | 'manager_approver'
  | 'fixed_approver'
  | 'role_approver'
  | 'percentage_rule'
  | 'specific_approver_rule'
  | 'hybrid_or_rule';

interface PaletteBlockDefinition {
  type: PaletteBlockType;
  label: string;
  description: string;
  target: 'sequence' | 'rules';
  icon: React.ReactNode;
}

const paletteBlocks: PaletteBlockDefinition[] = [
  {
    type: 'manager_approver',
    label: 'Manager Approver',
    description: 'Resolve the submitter’s current manager at runtime.',
    target: 'sequence',
    icon: <Users size={16} />,
  },
  {
    type: 'fixed_approver',
    label: 'Fixed Approver',
    description: 'Route a stage to one specific user.',
    target: 'sequence',
    icon: <UserRound size={16} />,
  },
  {
    type: 'role_approver',
    label: 'Role Approver',
    description: 'Send a stage to a reusable finance or director role.',
    target: 'sequence',
    icon: <BriefcaseBusiness size={16} />,
  },
  {
    type: 'percentage_rule',
    label: 'Percentage Rule',
    description: 'Auto-approve after a configured share of approvers approve.',
    target: 'rules',
    icon: <Percent size={16} />,
  },
  {
    type: 'specific_approver_rule',
    label: 'Specific Approver Rule',
    description: 'Auto-approve when one named approver signs off.',
    target: 'rules',
    icon: <ShieldCheck size={16} />,
  },
  {
    type: 'hybrid_or_rule',
    label: 'Hybrid OR Rule',
    description: 'Combine threshold and named-approver rules into one override.',
    target: 'rules',
    icon: <Route size={16} />,
  },
];

function DraggablePaletteItem({
  block,
  onAdd,
}: {
  block: PaletteBlockDefinition;
  onAdd: (type: PaletteBlockType) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette:${block.type}`,
    data: {
      source: 'palette',
      blockType: block.type,
      target: block.target,
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={
        transform
          ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
            }
          : undefined
      }
      className={`rounded-2xl border border-white/70 bg-white/80 p-3 shadow-sm transition ${isDragging ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onAdd(block.type)}
          className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-inset)] text-[var(--primary)]"
        >
          {block.icon}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[var(--text-primary)]">{block.label}</div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
              {block.target}
            </span>
          </div>
          <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
            {block.description}
          </p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]"
            {...listeners}
            {...attributes}
          >
            <BadgeCheck size={13} />
            Drag into canvas
          </button>
        </div>
      </div>
    </div>
  );
}

export function PolicyPalette({
  onAddBlock,
}: {
  onAddBlock: (type: PaletteBlockType) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          Component Palette
        </div>
        <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
          Compose a policy from constrained business blocks
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          Drag reusable sequence and rule blocks into the canvas. The builder only
          exposes policy shapes the backend can execute safely.
        </p>
      </div>
      {paletteBlocks.map((block) => (
        <DraggablePaletteItem key={block.type} block={block} onAdd={onAddBlock} />
      ))}
    </div>
  );
}
