import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRight, GripVertical, Trash2 } from 'lucide-react';
import { PolicyCanvasBlock } from '@/features/policy-builder/components/PolicyCanvasBlock';
import type {
  BlockSelection,
  PolicyDefinition,
  PolicyRuleBlock,
  SequentialStageBlock,
} from '@/features/policy-builder/types/policy';

function DroppableZone({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-3xl border border-dashed p-4 transition ${isOver ? 'border-[var(--primary)] bg-sky-50/60' : 'border-[var(--border-default)] bg-white/45'}`}
    >
      <div className="mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          {title}
        </div>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
      </div>
      {children}
    </div>
  );
}

function SortableStage({
  stage,
  selected,
  onSelect,
  onRemove,
}: {
  stage: SequentialStageBlock;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: stage.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="relative"
    >
      <PolicyCanvasBlock
        title={stage.name}
        subtitle={
          stage.approver.type === 'manager_approver'
            ? 'Runtime-resolved manager'
            : stage.approver.type === 'fixed_approver'
              ? stage.approver.label
              : `${stage.approver.label} (${stage.approver.role})`
        }
        family="sequence"
        selected={selected}
        onClick={onSelect}
        rightSlot={
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-white"
              {...attributes}
              {...listeners}
            >
              <GripVertical size={14} />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-[var(--accent-rose)] hover:bg-white"
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        }
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          <span>Stage {stage.order}</span>
          <ArrowRight size={12} />
          <span>{stage.approver.type.replaceAll('_', ' ')}</span>
        </div>
      </PolicyCanvasBlock>
    </div>
  );
}

function SortableRule({
  rule,
  selected,
  onSelect,
  onRemove,
}: {
  rule: PolicyRuleBlock;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: rule.id,
  });

  const subtitle =
    rule.type === 'percentage_rule'
      ? `${rule.threshold}% threshold`
      : rule.type === 'specific_approver_rule'
        ? rule.label
        : `${rule.operator} override`;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="relative"
    >
      <PolicyCanvasBlock
        title={rule.type.replaceAll('_', ' ')}
        subtitle={subtitle}
        family="rule"
        selected={selected}
        onClick={onSelect}
        rightSlot={
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-white"
              {...attributes}
              {...listeners}
            >
              <GripVertical size={14} />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-[var(--accent-rose)] hover:bg-white"
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        }
      >
        {rule.type === 'hybrid_or_rule' ? (
          <div className="flex flex-wrap gap-2">
            {rule.conditions.map((condition) => (
              <span
                key={condition.id}
                className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]"
              >
                {condition.type === 'percentage_rule'
                  ? `${condition.threshold}%`
                  : condition.label}
              </span>
            ))}
          </div>
        ) : null}
      </PolicyCanvasBlock>
    </div>
  );
}

export function PolicyCanvas({
  policy,
  selectedBlock,
  onSelectBlock,
  onRemoveStage,
  onRemoveRule,
}: {
  policy: PolicyDefinition;
  selectedBlock: BlockSelection;
  onSelectBlock: (selection: BlockSelection) => void;
  onRemoveStage: (id: string) => void;
  onRemoveRule: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <PolicyCanvasBlock
        title={policy.start.label}
        subtitle="Every policy begins with a submitted reimbursement request."
        family="start"
        selected={selectedBlock.kind === 'policy'}
        onClick={() => onSelectBlock({ kind: 'policy' })}
      />

      <DroppableZone
        id="canvas:sequence"
        title="Sequential Approval Flow"
        description="Drag manager, fixed, or role approvers here. Reorder stages to reflect the exact runtime chain."
      >
        <SortableContext
          items={policy.sequence.map((stage) => stage.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {policy.sequence.length ? (
              policy.sequence.map((stage) => (
                <SortableStage
                  key={stage.id}
                  stage={stage}
                  selected={selectedBlock.kind === 'stage' && selectedBlock.id === stage.id}
                  onSelect={() => onSelectBlock({ kind: 'stage', id: stage.id })}
                  onRemove={() => onRemoveStage(stage.id)}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-white/60 px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                Drop approver stages here to build the required approval path.
              </div>
            )}
          </div>
        </SortableContext>
      </DroppableZone>

      <DroppableZone
        id="canvas:rules"
        title="Conditional Auto-Approval Rules"
        description="Add optional overrides for threshold-based or named approver shortcuts."
      >
        <SortableContext
          items={policy.rules.map((rule) => rule.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {policy.rules.length ? (
              policy.rules.map((rule) => (
                <SortableRule
                  key={rule.id}
                  rule={rule}
                  selected={selectedBlock.kind === 'rule' && selectedBlock.id === rule.id}
                  onSelect={() => onSelectBlock({ kind: 'rule', id: rule.id })}
                  onRemove={() => onRemoveRule(rule.id)}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-white/60 px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                Drop rule blocks here if this policy needs auto-approve conditions.
              </div>
            )}
          </div>
        </SortableContext>
      </DroppableZone>

      <PolicyCanvasBlock
        title="Approval outcome"
        subtitle="When a rule passes or the sequence completes, the expense moves into the approved state."
        family="outcome"
      />

      <PolicyCanvasBlock
        title="Policy notes"
        subtitle={policy.notes.notes || 'Document admin-only guidance, audit notes, or rollout caveats.'}
        family="notes"
        selected={selectedBlock.kind === 'notes'}
        onClick={() => onSelectBlock({ kind: 'notes' })}
      />
    </div>
  );
}
