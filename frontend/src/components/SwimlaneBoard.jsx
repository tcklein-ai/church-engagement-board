import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const COLUMNS = [
  { key: 'new', label: 'New / Triggered' },
  { key: 'action_required', label: 'Action Required' },
  { key: 'waiting', label: 'Waiting / Snoozed' },
  { key: 'completed', label: 'Completed' },
];

export function SwimlaneBoard({ workflows, steps, cards, interactive = false }) {
  const [hideEmpty, setHideEmpty] = useState(!interactive); 
  const [darkMode, setDarkMode] = useState(!interactive); 
  
  // Row Sorting State
  const [sortCol, setSortCol] = useState(null);
  const [sortDesc, setSortDesc] = useState(true);

  const cardsByWorkflowAndColumn = useMemo(() => {
    const map = {};
    for (const card of cards) {
      const key = `${card.workflow_id}:${card.board_column}`;
      (map[key] ??= []).push(card);
    }
    return map;
  }, [cards]);

  const sortedWorkflows = useMemo(() => {
    let wfs = workflows;
    
    // Filter empty if toggled
    if (hideEmpty) {
      wfs = wfs.filter(wf => cards.some(c => c.workflow_id === wf.id));
    }

    // Sort rows based on column click
    if (sortCol) {
      wfs = [...wfs].sort((a, b) => {
        const aCount = (cardsByWorkflowAndColumn[`${a.id}:${sortCol}`] || []).length;
        const bCount = (cardsByWorkflowAndColumn[`${b.id}:${sortCol}`] || []).length;
        return sortDesc ? bCount - aCount : aCount - bCount;
      });
    }

    return wfs;
  }, [workflows, cards, hideEmpty, cardsByWorkflowAndColumn, sortCol, sortDesc]);

  const handleSort = (colKey) => {
    if (sortCol === colKey) {
      setSortDesc(!sortDesc); // Toggle direction
    } else {
      setSortCol(colKey);
      setSortDesc(true); // Default to most first
    }
  };

  const bgMain = darkMode ? 'bg-[#0f172a] text-gray-100' : 'bg-gray-50 text-gray-900';
  const bgHeader = darkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-gray-200 border-gray-300 text-gray-700';
  const bgLeftCol = darkMode ? 'bg-slate-950/50' : 'bg-gray-100/80';
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
        className="grid sticky top-0 z-20 shadow-sm"
        style={{ gridTemplateColumns: `250px repeat(${COLUMNS.length}, 1fr)` }}
      >
        <div className={`px-4 py-3 font-bold text-sm uppercase tracking-wide border-b-2 border-r flex items-center shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)] ${bgHeader} ${bgLeftCol}`} style={{ borderColor: borderGrid }}>
          Workflows
        </div>
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            onClick={() => handleSort(col.key)}
            className={`px-4 py-3 font-bold text-sm uppercase tracking-wide border-b-2 cursor-pointer select-none group transition-colors hover:bg-indigo-50/10 flex items-center justify-between ${bgHeader}`}
            style={{ borderColor: borderGrid }}
          >
            <span>{col.label}</span>
            <span className={`text-[10px] ${sortCol === col.key ? 'opacity-100 text-indigo-500' : 'opacity-0 group-hover:opacity-30'}`}>
              {sortCol === col.key ? (sortDesc ? '▼' : '▲') : '▼'}
            </span>
          </div>
        ))}
      </div>

      <div className="pb-20">
        {sortedWorkflows.map((workflow, index) => {
          const isEven = index % 2 === 0;
          const rowBg = darkMode 
            ? (isEven ? 'bg-slate-800/40' : 'bg-slate-900/40')
            : (isEven ? 'bg-white' : 'bg-gray-100/50');
          
          return (
            <div
              key={workflow.id}
              className="grid items-stretch border-b"
              style={{
                gridTemplateColumns: `250px repeat(${COLUMNS.length}, 1fr)`,
                borderColor: borderGrid,
              }}
            >
              <div
                className={`px-5 py-4 font-semibold flex items-center border-r transition-colors shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] ${bgLeftCol} hover:bg-indigo-50 dark:hover:bg-indigo-900/40`}
                style={{ 
                  borderLeft: `6px solid ${workflow.color ?? '#6366f1'}`,
                  borderColor: borderGrid 
                }}
              >
                {interactive ? (
                  <Link 
                    to={`/board/default/workflow/${workflow.pco_id}`} 
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer block w-full leading-snug"
                  >
                    {workflow.name}
                  </Link>
                ) : (
                  <span className="leading-snug">{workflow.name}</span>
                )}
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
  // Option 3B: Always sort Overdue First, then Oldest to Newest
  const sortedCards = useMemo(() => {
    return [...cardsList].sort((a, b) => {
      const now = new Date();
      
      const aIsOverdue = a.flagged || (a.snoozed_until && new Date(a.snoozed_until) < now) ? 1 : 0;
      const bIsOverdue = b.flagged || (b.snoozed_until && new Date(b.snoozed_until) < now) ? 1 : 0;
      
      if (aIsOverdue !== bIsOverdue) return bIsOverdue - aIsOverdue; 

      const aTime = a.pco_created_at ? new Date(a.pco_created_at).getTime() : 0;
      const bTime = b.pco_created_at ? new Date(b.pco_created_at).getTime() : 0;
      
      return aTime - bTime; 
    });
  }, [cardsList]);

  return (
    <div
      className={`px-3 py-4 border-r flex flex-col gap-4 ${rowBg}`}
      style={{ borderColor: borderGrid }}
    >
      {sortedCards.map((card) => (
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
  
  const charCode = card.id.charCodeAt(0) + card.id.charCodeAt(card.id.length - 1);
  const tilt = charCode % 3 === 0 ? '-rotate-1' : charCode % 3 === 1 ? 'rotate-2' : 'rotate-1';
  
  const now = new Date();
  let isSnoozed = false;
  let isOverdue = false;

  if (card.snoozed_until) {
    const snoozeDate = new Date(card.snoozed_until);
    if (snoozeDate < now) {
      isOverdue = true;
    } else {
      isSnoozed = true;
    }
  }

  if (card.flagged) {
    isOverdue = true;
  }

  let colorClasses = "bg-[#fefce8] text-gray-800 border-[#fde047]/60"; 
  
  if (isOverdue) {
    colorClasses = "bg-rose-50 text-rose-950 border-rose-300/80"; 
  } else if (isSnoozed) {
    colorClasses = "bg-slate-100 text-slate-600 border-slate-300/80 opacity-80"; 
  }

  const baseClasses = `relative rounded-sm px-4 py-3 shadow-md ${tilt} transition-all duration-200 border-t border-l border-white/60 border-b border-r`;
  const hoverClasses = interactive ? "hover:scale-105 hover:shadow-xl hover:z-10 cursor-pointer" : "";
  const flaggedClasses = card.flagged ? "ring-2 ring-red-500 ring-offset-2 ring-offset-transparent" : "";
  const pcoUrl = `https://people.planningcenteronline.com/workflows/${workflowPcoId}/cards/${card.pco_id}`;

  const CardContent = (
    <div className={`${baseClasses} ${colorClasses} ${hoverClasses} ${flaggedClasses}`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`font-bold text-[15px] leading-tight pt-1 ${isOverdue ? 'text-rose-950' : isSnoozed ? 'text-slate-700' : 'text-gray-900'}`}>
          {card.person_name}
        </div>
        {card.person_avatar_url && (
          <img 
            src={card.person_avatar_url} 
            alt={card.person_name} 
            className={`w-9 h-9 rounded-full border shadow-sm shrink-0 object-cover ${isOverdue ? 'border-rose-200' : isSnoozed ? 'border-slate-300 grayscale opacity-70' : 'border-gray-300'}`} 
          />
        )}
      </div>
      
      {stepName && (
        <div className={`text-[11px] font-bold mt-1 uppercase tracking-wider ${isOverdue ? 'text-rose-700/80' : isSnoozed ? 'text-slate-500' : 'text-indigo-700/80'}`}>
          {stepName}
        </div>
      )}

      {card.assignee_name && (
        <div className={`mt-2.5 flex items-center gap-1.5 text-xs font-semibold ${isOverdue ? 'text-rose-800/70' : isSnoozed ? 'text-slate-500' : 'text-gray-600'}`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          {card.assignee_name}
        </div>
      )}
      
      {card.snoozed_until && (
        <div className={`text-xs mt-2 font-bold inline-block px-1.5 py-0.5 rounded shadow-sm ${
          isOverdue 
            ? 'text-rose-100 bg-rose-700' 
            : 'text-slate-600 bg-slate-200/80'
        }`}>
          {isOverdue ? 'Overdue:' : 'Snoozed:'} {new Date(card.snoozed_until).toLocaleDateString()}
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