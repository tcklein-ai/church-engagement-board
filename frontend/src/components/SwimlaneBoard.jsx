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

    const targetStep = steps.find(
      (s) => s.workflow_id === workflowId && s.board_column === targetColumn
    );

    onMoveCard({ cardId, targetStepPcoId: targetStep?.pco_id, targetBoardColumn: targetColumn });
  }

  const Wrapper = interactive ? DndContext : 'div';
  const wrapperProps = interactive ? { sensors, onDragEnd: handleDragEnd } : {};

  return (
    <div className={`w-full h-full ${interactive ? '' : 'bg-black text-white'} overflow-y-auto`}>
      <div
        className="grid sticky top-0 z-10 shadow-sm"
        style={{ gridTemplateColumns: `220px repeat(${COLUMNS.length}, 1fr)` }}
      >
        <div className={interactive ? 'bg-gray-200' : 'bg-gray-900'} />
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={`px-4 py-3 font-bold text-sm uppercase tracking-wide border-b-2 ${
              interactive
                ? 'bg-gray-200 text-gray-700 border-gray-300'
                : 'bg-gray-900 text-gray-300 border-gray-700 text-lg'
            }`}
          >
            {col.label}
          </div>
        ))}
      </div>

      <Wrapper {...wrapperProps}>
        {workflows.map((workflow, index) => {
          // Zebra striping logic for alternating row colors
          const isEven = index % 2 === 0;
          const headerBg = interactive 
            ? (isEven ? 'bg-white' : 'bg-gray-50') 
            : (isEven ? 'bg-gray-950' : 'bg-[#111827]'); // slight contrast for dark mode
          
          return (
            <div
              key={workflow.id}
              className="grid items-stretch border-b"
              style={{
                gridTemplateColumns: `220px repeat(${COLUMNS.length}, 1fr)`,
                borderColor: interactive ? '#e5e7eb' : '#374151',
              }}
            >
              <div
                className={`px-4 py-4 font-semibold flex items-center border-r ${headerBg} ${
                  interactive ? 'border-gray-200 text-gray-900' : 'border-gray-700 text-gray-100 text-xl'
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
                  isEven={isEven}
                  steps={steps}
                />
              ))}
            </div>
          );
        })}
      </Wrapper>
    </div>
  );
}

function SwimlaneCell({ workflowId, columnKey, cardsList, interactive, isEven, steps }) {
  const droppableId = `cell::${columnKey}::${workflowId}`;
  const { setNodeRef, isOver } = interactive
    ? useDroppable({ id: droppableId })
    : { setNodeRef: null, isOver: false };

  // Apply the zebra striping background to the cells too
  const cellBg = interactive 
    ? (isEven ? 'bg-white' : 'bg-gray-50') 
    : (isEven ? 'bg-gray-950' : 'bg-[#111827]');

  return (
    <div
      ref={setNodeRef}
      className={`px-2 py-3 border-r flex flex-col gap-2 ${cellBg} ${
        interactive ? 'border-gray-200' : 'border-gray-700'
      } ${isOver ? (interactive ? 'bg-indigo-50' : 'bg-indigo-900/30') : ''}`}
    >
      {cardsList.map((card) => (
        <KanbanCard key={card.id} card={card} steps={steps} interactive={interactive} />
      ))}
    </div>
  );
}

function KanbanCard({ card, steps, interactive }) {
  const { attributes, listeners, setNodeRef, transform } = interactive
    ? useDraggable({ id: card.id })
    : { attributes: {}, listeners: {}, setNodeRef: null, transform: null };

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  // Find the exact step name for this card
  const stepName = steps.find((s) => s.id === card.step_id)?.name;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(interactive ? { ...attributes, ...listeners } : {})}
      className={`rounded-lg px-3 py-2 shadow-sm ${
        interactive
          ? 'bg-white border border-gray-200 cursor-grab active:cursor-grabbing hover:border-indigo-300'
          : 'bg-gray-800 border border-gray-600'
      } ${card.flagged ? (interactive ? 'ring-2 ring-red-400' : 'ring-2 ring-red-500') : ''}`}
    >
      <div className={`font-bold ${interactive ? 'text-sm text-gray-900' : 'text-lg text-white'}`}>
        {card.person_name}
      </div>
      
      {/* Newly Added: The Workflow Step Name */}
      {stepName && (
        <div className={`text-xs font-semibold mt-0.5 leading-tight ${interactive ? 'text-indigo-600' : 'text-indigo-400'}`}>
          {stepName}
        </div>
      )}

      {card.assignee_name && (
        <div className={`mt-1.5 flex items-center gap-1 ${interactive ? 'text-xs text-gray-500' : 'text-sm text-gray-300'}`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          {card.assignee_name}
        </div>
      )}
      
      {card.snoozed_until && (
        <div className={`text-xs mt-1 font-medium ${interactive ? 'text-amber-600' : 'text-amber-400'}`}>
          Snoozed: {new Date(card.snoozed_until).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}