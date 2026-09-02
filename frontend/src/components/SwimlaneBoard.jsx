import { useMemo } from 'react';
import {
  DndContext,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

const COLUMNS = [
  { key: 'new', label: 'New / Triggered' },
  { key: 'action_required', label: 'Action Required' },
  { key: 'waiting', label: 'Waiting / Snoozed' },
  { key: 'completed', label: 'Completed' },
];

/**
 * `interactive` toggles drag-and-drop + toolbars for /admin, vs the
 * headless, high-contrast, read-only /tv rendering.
 *
 * Layout: CSS Grid, `grid-template-rows: auto` per swimlane row and
 * `align-items: start` on the row so each row's height is driven purely
 * by its tallest column's stacked cards — no fixed row height, no
 * scrollbars, no "view more". A row with 6 stacked cards in one column
 * simply pushes every row below it down the page.
 */
export function SwimlaneBoard({ workflows, steps, cards, interactive = false, onMoveCard }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const cardsByWorkflowAndColumn = useMemo(() => {
    const map = {};
    for (const card of cards) {
      const key = `${card.workflow_id}:${card.board_column}`;
      (map[key] ??= []).push(card);
    }
    return map;
  }, [cards]);

  function handleDragEnd(event) {
    if (!interactive || !onMoveCard) return;
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id;
    const [, targetColumn, workflowId] = over.id.split('::');
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.board_column === targetColumn) return;

    // Pick the first step in the target column for this workflow as the
    // default landing step — a real admin UI might let staff choose a
    // specific step if a column maps to more than one.
    const targetStep = steps.find(
      (s) => s.workflow_id === workflowId && s.board_column === targetColumn
    );

    onMoveCard({ cardId, targetStepPcoId: targetStep?.pco_id, targetBoardColumn: targetColumn });
  }

  const Wrapper = interactive ? DndContext : 'div';
  const wrapperProps = interactive ? { sensors, onDragEnd: handleDragEnd } : {};

  return (
    <div className={`w-full h-full ${interactive ? '' : 'bg-black text-white'} overflow-y-auto`}>
      {/* Column header row */}
      <div
        className="grid sticky top-0 z-10"
        style={{ gridTemplateColumns: `220px repeat(${COLUMNS.length}, 1fr)` }}
      >
        <div className={interactive ? 'bg-gray-100' : 'bg-gray-900'} />
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={`px-4 py-3 font-bold text-sm uppercase tracking-wide border-b-2 ${
              interactive
                ? 'bg-gray-100 text-gray-700 border-gray-300'
                : 'bg-gray-900 text-white border-gray-700 text-lg'
            }`}
          >
            {col.label}
          </div>
        ))}
      </div>

      <Wrapper {...wrapperProps}>
        {/* One swimlane row per workflow */}
        {workflows.map((workflow) => (
          <div
            key={workflow.id}
            className="grid items-stretch border-b"
            style={{
              gridTemplateColumns: `220px repeat(${COLUMNS.length}, 1fr)`,
              borderColor: interactive ? '#e5e7eb' : '#374151',
            }}
          >
            <div
              className={`px-4 py-3 font-semibold flex items-center border-r ${
                interactive ? 'bg-white border-gray-200' : 'bg-gray-950 border-gray-700 text-xl'
              }`}
              style={{ borderLeft: `6px solid ${workflow.color ?? '#6366f1'}` }}
            >
              {workflow.name}
            </div>

            {COLUMNS.map((col) => (
              <SwimlaneCell
                key={col.key}
                workflowId={workflow.id}
                columnKey={col.key}
                cardsList={cardsByWorkflowAndColumn[`${workflow.id}:${col.key}`] ?? []}
                interactive={interactive}
              />
            ))}
          </div>
        ))}
      </Wrapper>
    </div>
  );
}

function SwimlaneCell({ workflowId, columnKey, cardsList, interactive }) {
  const droppableId = `cell::${columnKey}::${workflowId}`;
  const { setNodeRef, isOver } = interactive
    ? useDroppable({ id: droppableId })
    : { setNodeRef: null, isOver: false };

  return (
    <div
      ref={setNodeRef}
      className={`px-2 py-2 border-r flex flex-col gap-2 ${
        interactive ? 'border-gray-200' : 'border-gray-700'
      } ${isOver ? 'bg-blue-50' : ''}`}
      // KEY BEHAVIOR: no max-height, no overflow-y here. The cell (and the
      // grid row it lives in) grows to fit however many cards stack inside
      // it — that's what keeps the TV view from ever hiding a card behind
      // a scrollbar.
    >
      {cardsList.map((card) => (
        <KanbanCard key={card.id} card={card} interactive={interactive} />
      ))}
    </div>
  );
}

function KanbanCard({ card, interactive }) {
  const { attributes, listeners, setNodeRef, transform } = interactive
    ? useDraggable({ id: card.id })
    : { attributes: {}, listeners: {}, setNodeRef: null, transform: null };

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(interactive ? { ...attributes, ...listeners } : {})}
      className={`rounded-lg px-3 py-2 shadow-sm ${
        interactive
          ? 'bg-white border border-gray-200 cursor-grab active:cursor-grabbing'
          : 'bg-gray-800 border border-gray-600'
      } ${card.flagged ? (interactive ? 'ring-2 ring-red-400' : 'ring-2 ring-red-500') : ''}`}
    >
      <div className={`font-medium ${interactive ? 'text-sm text-gray-900' : 'text-base'}`}>
        {card.person_name}
      </div>
      {card.assignee_name && (
        <div className={`${interactive ? 'text-xs text-gray-500' : 'text-sm text-gray-400'}`}>
          {card.assignee_name}
        </div>
      )}
      {card.snoozed_until && (
        <div className={`text-xs mt-1 ${interactive ? 'text-amber-600' : 'text-amber-400'}`}>
          Snoozed until {new Date(card.snoozed_until).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
