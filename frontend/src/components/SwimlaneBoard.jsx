import { useMemo, useState } from 'react';

const COLUMNS = [
  { key: 'new', label: 'New / Triggered' },
  { key: 'action_required', label: 'Action Required' },
  { key: 'waiting', label: 'Waiting / Snoozed' },
  { key: 'completed', label: 'Completed' },
];

export function SwimlaneBoard({ workflows, steps, cards, interactive = false }) {
  // TV defaults to dark mode and hidden empty rows. Admin has toggles.
  const [hideEmpty, setHideEmpty] = useState(!interactive); 
  const [darkMode, setDarkMode] = useState(!interactive); 

  const cardsByWorkflowAndColumn = useMemo(() => {
    const map = {};
    for (const card of cards) {
      const key = `${card.workflow_id}:${card.board_column}`;
      (map[key] ??= []).push(card);
    }
    return map;
  }, [cards]);

  const visibleWorkflows = useMemo(() => {
    if (!hideEmpty) return workflows;
    return workflows.filter(wf => cards.some(c => c.workflow_id === wf.id));
  }, [workflows, cards, hideEmpty]);

  // Dynamic Theme Styling
  const bgMain = darkMode ? 'bg-[#0f172a] text-gray-100' : 'bg-gray-50 text-gray-900';
  const bgHeader = darkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-gray-200 border-gray-300 text-gray-700';
  const borderGrid = darkMode ? '#334155' : '#e5e7eb';

  return (
    <div className={`w-full h-full min-h-screen overflow-y-auto ${bgMain}`}>
      
      {/* Top Toolbar for Admin */}
      {interactive && (
        <div className={`flex items-center justify-between p-4 border-b shadow-sm transition-colors ${
          darkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-gray-300 text-gray-800'
        }`}>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold select-none hover:text-indigo-500 transition-colors">
              <input 
                type="checkbox" 
                checked={hideEmpty} 
                onChange={(e) => setHideEmpty(e.target.checked)} 
                className="rounded w-4 h-4 text-indigo-600 focus:ring-indigo-500 bg-transparent border-gray-400" 
              />
              Hide Empty Workflows
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold select-none hover:text-indigo-500 transition-colors">
              <input 
                type="checkbox" 
                checked={darkMode} 
                onChange={(e) => setDarkMode(e.target.checked)} 
                className="rounded w-4 h-4 text-indigo-600 focus:ring-indigo-500 bg-transparent border-gray-400" 
              />
              Dark Mode
            </label>
          </div>
          
          <button
            onClick={async (e) => {
              const btn = e.currentTarget;
              btn.disabled = true;
              btn.innerHTML = 'Syncing...';
              try {
                await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/sync`, { method: 'POST' });
              } catch (err) {
                console.error(err);
              } finally {
                btn.disabled = false;
                btn.innerHTML = 'Force PCO Sync';
              }
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded shadow transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Force PCO Sync
          </button>
        </div>
      )}

      {/* Column header row */}
      <div
        className="grid sticky top-0 z-10 shadow-sm"
        style={{ gridTemplateColumns: `220px repeat(${COLUMNS.length}, 1fr)` }}
      >
        <div className={bgHeader} />
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={`px-4 py-3 font-bold text-sm uppercase tracking-wide border-b-2 ${bgHeader}`}
          >
            {col.label}
          </div>
        ))}
      </div>

      <div className="pb-20">
        {visibleWorkflows.map((workflow, index) => {
          const isEven = index % 2 === 0;
          const rowBg = darkMode 
            ? (isEven ? 'bg-slate-800/40' : 'bg-slate-900/40')
            : (isEven ? 'bg-white' : 'bg-gray-100/50');
          
          return (
            <div
              key={workflow.id}
              className="grid items-stretch border-b"
              style={{
                gridTemplateColumns: `220px repeat(${COLUMNS.length}, 1fr)`,
                borderColor: borderGrid,
              }}
            >
              <div
                className={`px-4 py-4 font-semibold flex items-center border-r ${rowBg}`}
                style={{ 
                  borderLeft: `6px solid ${workflow.color ?? '#6366f1'}`,
                  borderColor: borderGrid 
                }}
              >
                {workflow.name}
              </div>

              {COLUMNS.map((col) => (
                <SwimlaneCell
                  key={col.key}
                  cardsList={cardsByWorkflowAndColumn[`${workflow.id}:${col.key}`] ?? []}
                  interactive={interactive}
                  rowBg={rowBg}
                  borderGrid={borderGrid}
                  steps={steps}
                  workflowPcoId={workflow.pco_id}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SwimlaneCell({ cardsList, interactive, rowBg, borderGrid, steps, workflowPcoId }) {
  return (
    <div
      className={`px-3 py-4 border-r flex flex-col gap-4 ${rowBg}`}
      style={{ borderColor: borderGrid }}
    >
      {cardsList.map((card) => (
        <KanbanCard 
          key={card.id} 
          card={card} 
          steps={steps} 
          interactive={interactive} 
          workflowPcoId={workflowPcoId} 
        />
      ))}
    </div>
  );
}

function KanbanCard({ card, steps, interactive, workflowPcoId }) {
  const stepName = steps.find((s) => s.id === card.step_id)?.name;
  
  // Deterministic subtle tilt based on the card's UUID
  const charCode = card.id.charCodeAt(0) + card.id.charCodeAt(card.id.length - 1);
  const tilt = charCode % 3 === 0 ? '-rotate-1' : charCode % 3 === 1 ? 'rotate-2' : 'rotate-1';
  
  // Post-it physical styling
  const baseClasses = `relative rounded-sm px-4 py-3 shadow-md ${tilt} transition-all duration-200`;
  const colorClasses = "bg-[#fefce8] text-gray-800 border-t border-l border-white/60 border-b border-r border-[#fde047]/60";
  const hoverClasses = interactive ? "hover:scale-105 hover:shadow-xl hover:z-10 cursor-pointer" : "";
  const flaggedClasses = card.flagged ? "ring-2 ring-red-500 ring-offset-2 ring-offset-[#fefce8]" : "";

  // Deep link to the specific workflow profile in Planning Center
  const pcoUrl = `https://people.planningcenteronline.com/workflows/${workflowPcoId}/cards/${card.pco_id}`;

  const CardContent = (
    <div className={`${baseClasses} ${colorClasses} ${hoverClasses} ${flaggedClasses}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold text-[15px] leading-tight pt-1">
          {card.person_name}
        </div>
        {card.person_avatar_url && (
          <img 
            src={card.person_avatar_url} 
            alt={card.person_name} 
            className="w-9 h-9 rounded-full border border-gray-300 shadow-sm shrink-0 object-cover" 
          />
        )}
      </div>
      
      {stepName && (
        <div className="text-[11px] font-bold mt-1 text-indigo-700/80 uppercase tracking-wider">
          {stepName}
        </div>
      )}

      {card.assignee_name && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          {card.assignee_name}
        </div>
      )}
      
      {card.snoozed_until && (
        <div className="text-xs mt-2 font-bold text-amber-800 bg-amber-200/60 inline-block px-1.5 py-0.5 rounded shadow-sm">
          Snoozed: {new Date(card.snoozed_until).toLocaleDateString()}
        </div>
      )}
    </div>
  );

  if (interactive) {
    return (
      <a href={pcoUrl} target="_blank" rel="noopener noreferrer" className="block focus:outline-none outline-none">
        {CardContent}
      </a>
    );
  }

  return CardContent;
}