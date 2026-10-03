import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SettingsModal } from './SettingsModal';

const COLUMNS = [
  { key: 'new', label: 'New / Triggered' },
  { key: 'action_required', label: 'Action Required' },
  { key: 'waiting', label: 'Waiting / Snoozed' },
];

export function getCardStatus(card) {
  const now = new Date();
  
  if (card.is_overdue || card.flagged) return { isOverdue: true, isSnoozed: false };

  if (card.snoozed_until) {
    if (new Date(card.snoozed_until) < now) return { isOverdue: true, isSnoozed: false };
    return { isOverdue: false, isSnoozed: true }; 
  }

  return { isOverdue: false, isSnoozed: false };
}

export function SwimlaneBoard({ workflows, steps, cards, interactive = false }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGlobalDrawerOpen, setIsGlobalDrawerOpen] = useState(false);

  const [hideEmpty, setHideEmpty] = useState(() => {
    const saved = localStorage.getItem('pco_kanban_hideEmpty');
    return saved !== null ? JSON.parse(saved) : !interactive;
  }); 

  // New state for explicitly sorting cards
  const [cardSort, setCardSort] = useState(() => {
    return localStorage.getItem('pco_kanban_cardSort') || 'oldest';
  });
  
  useEffect(() => localStorage.setItem('pco_kanban_hideEmpty', JSON.stringify(hideEmpty)), [hideEmpty]);
  useEffect(() => localStorage.setItem('pco_kanban_cardSort', cardSort), [cardSort]);

  const cardsByWorkflowAndColumn = useMemo(() => {
    const map = {};
    for (const card of cards) {
      const key = `${card.workflow_id}:${card.board_column}`;
      (map[key] ??= []).push(card);
    }
    return map;
  }, [cards]);

  const globalCompletedCards = useMemo(() => {
    return cards
      .filter(c => c.board_column === 'completed')
      .sort((a, b) => new Date(b.pco_updated_at || 0) - new Date(a.pco_updated_at || 0));
  }, [cards]);

  const sortedWorkflows = useMemo(() => {
    let wfs = workflows;
    // We removed the confusing column sorting logic here so workflows stay strictly in PCO order
    if (hideEmpty) wfs = wfs.filter(wf => cards.some(c => c.workflow_id === wf.id && c.board_column !== 'completed'));
    return wfs;
  }, [workflows, cards, hideEmpty]);

  return (
    <div className="w-full h-full min-h-screen overflow-y-auto bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Global Completed Drawer */}
      {isGlobalDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={() => setIsGlobalDrawerOpen(false)}></div>
          <div className="relative w-[400px] h-full shadow-2xl flex flex-col transform transition-transform duration-300 bg-gray-50 dark:bg-slate-900 border-l border-gray-300 dark:border-slate-700">
            <div className="p-5 border-b flex items-center justify-between bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800 dark:text-slate-200">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                Global Archive
              </h2>
              <button onClick={() => setIsGlobalDrawerOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 custom-scrollbar">
              {globalCompletedCards.length === 0 ? (
                <div className="text-center text-gray-500 mt-10">No completed cards in the history timeframe.</div>
              ) : (
                globalCompletedCards.map(card => {
                  const wf = workflows.find(w => w.id === card.workflow_id);
                  return (
                    <div key={card.id} className="relative">
                      <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: wf?.color ?? '#6366f1' }}></div>
                        {wf?.name}
                      </div>
                      <KanbanCard card={card} steps={steps} interactive={interactive} workflowPcoId={wf?.pco_id} />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {interactive && (
        <div className="flex items-center justify-between p-4 border-b shadow-sm transition-colors bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-800 dark:text-slate-200">
          <div className="flex items-center gap-8">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold select-none hover:text-indigo-500 transition-colors">
              <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="rounded w-4 h-4 text-indigo-600 focus:ring-indigo-500 bg-transparent border-gray-400" />
              Hide Empty Workflows
            </label>

            <div className="flex items-center gap-2 border-l border-gray-300 dark:border-slate-700 pl-8">
              <span className="text-sm font-semibold text-gray-500 dark:text-slate-400">Sort Cards:</span>
              <select 
                value={cardSort} 
                onChange={(e) => setCardSort(e.target.value)} 
                className="text-sm border-gray-300 rounded-md focus:ring-indigo-500 py-1 pl-2 pr-8 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
              >
                <option value="oldest">Oldest First</option>
                <option value="newest">Newest First</option>
                <option value="alphabetical">A-Z Name</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => setIsGlobalDrawerOpen(true)} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-900/70 border border-emerald-200 dark:border-emerald-800 rounded-full text-sm font-bold shadow-sm transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
              {globalCompletedCards.length} Completed
            </button>

            <button onClick={() => setIsSettingsOpen(true)} className="text-gray-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors border-l border-gray-300 dark:border-slate-700 pl-4" title="Board Settings">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </button>

            <button
              onClick={async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = 'Syncing...';
                try { await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/sync`, { method: 'POST' }); } 
                catch (err) { console.error(err); } 
                finally { btn.disabled = false; btn.innerHTML = 'Force PCO Sync'; }
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded shadow transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ml-2"
            >
              Force PCO Sync
            </button>
          </div>
        </div>
      )}

      <div className="grid sticky top-0 z-20 shadow-sm" style={{ gridTemplateColumns: `250px repeat(${COLUMNS.length}, 1fr)` }}>
        <div className="px-4 py-3 font-bold text-sm uppercase tracking-wide border-b-2 border-r flex items-center shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)] bg-gray-200 dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300">
          Workflows
        </div>
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className="px-4 py-3 font-bold text-sm uppercase tracking-wide border-b-2 border-gray-300 dark:border-slate-700 bg-gray-200 dark:bg-slate-900 text-gray-700 dark:text-slate-300"
          >
            {col.label}
          </div>
        ))}
      </div>

      <div className="pb-20">
        {sortedWorkflows.map((workflow, index) => {
          const isEven = index % 2 === 0;
          const rowBg = isEven ? 'bg-white dark:bg-slate-800/40' : 'bg-gray-100/50 dark:bg-slate-900/40';
          const completedForThisWf = cardsByWorkflowAndColumn[`${workflow.id}:completed`] || [];
          
          return (
            <div key={workflow.id} className="grid items-stretch border-b border-gray-200 dark:border-slate-700" style={{ gridTemplateColumns: `250px repeat(${COLUMNS.length}, 1fr)` }}>
              <div className="px-5 py-4 flex flex-col justify-center border-r border-gray-200 dark:border-slate-700 transition-colors shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] bg-gray-100/80 dark:bg-slate-950/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/40" style={{ borderLeft: `6px solid ${workflow.color ?? '#6366f1'}` }}>
                {interactive ? (
                  <Link to={`/board/default/workflow/${workflow.pco_id}`} className="font-semibold hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer block w-full leading-snug">
                    {workflow.name}
                  </Link>
                ) : (
                  <span className="font-semibold leading-snug">{workflow.name}</span>
                )}
                
                {completedForThisWf.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-500">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    {completedForThisWf.length} Completed
                  </div>
                )}
              </div>
              {COLUMNS.map((col) => (
                <SwimlaneCell key={col.key} cardsList={cardsByWorkflowAndColumn[`${workflow.id}:${col.key}`] ?? []} interactive={interactive} rowBg={rowBg} steps={steps} workflowPcoId={workflow.pco_id} cardSort={cardSort} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SwimlaneCell({ cardsList, interactive, rowBg, steps, workflowPcoId, cardSort }) {
  const sortedCards = useMemo(() => {
    return [...cardsList].sort((a, b) => {
      const aStatus = getCardStatus(a);
      const bStatus = getCardStatus(b);
      
      // Always bubble overdue cards to the top
      if (aStatus.isOverdue !== bStatus.isOverdue) return bStatus.isOverdue ? 1 : -1; 
      
      // Apply user's chosen sort order
      if (cardSort === 'alphabetical') {
        return (a.person_name || '').localeCompare(b.person_name || '');
      } else if (cardSort === 'newest') {
        const aTime = a.pco_created_at ? new Date(a.pco_created_at).getTime() : 0;
        const bTime = b.pco_created_at ? new Date(b.pco_created_at).getTime() : 0;
        return bTime - aTime;
      } else {
        // Default to oldest
        const aTime = a.pco_created_at ? new Date(a.pco_created_at).getTime() : 0;
        const bTime = b.pco_created_at ? new Date(b.pco_created_at).getTime() : 0;
        return aTime - bTime; 
      }
    });
  }, [cardsList, cardSort]);

  return (
    <div className={`px-3 py-4 border-r border-gray-200 dark:border-slate-700 flex flex-col gap-4 ${rowBg}`}>
      {sortedCards.map((card) => (
        <KanbanCard key={card.id} card={card} steps={steps} interactive={interactive} workflowPcoId={workflowPcoId} />
      ))}
    </div>
  );
}

function KanbanCard({ card, steps, interactive, workflowPcoId }) {
  const stepName = steps.find((s) => s.id === card.step_id)?.name;
  const charCode = card.id.charCodeAt(0) + card.id.charCodeAt(card.id.length - 1);
  const tilt = charCode % 3 === 0 ? '-rotate-1' : charCode % 3 === 1 ? 'rotate-2' : 'rotate-1';
  
  const { isOverdue, isSnoozed } = getCardStatus(card);

  let colorClasses = "bg-[#fefce8] text-gray-800 border-[#fde047]/60 dark:bg-yellow-900/20 dark:text-yellow-100 dark:border-yellow-700/50"; 
  if (card.board_column === 'completed') colorClasses = "bg-emerald-50 text-emerald-950 border-emerald-300/80 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-800/50"; 
  else if (isOverdue) colorClasses = "bg-rose-50 text-rose-950 border-rose-300/80 dark:bg-rose-900/30 dark:text-rose-100 dark:border-rose-800/50"; 
  else if (isSnoozed) colorClasses = "bg-slate-100 text-slate-600 border-slate-300/80 opacity-80 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"; 

  const baseClasses = `relative rounded-sm px-4 py-3 shadow-md ${tilt} transition-all duration-200 border-t border-l border-white/60 dark:border-white/10 border-b border-r`;
  const hoverClasses = interactive ? "hover:scale-105 hover:shadow-xl hover:z-10 cursor-pointer" : "";
  const flaggedClasses = card.flagged ? "ring-2 ring-red-500 ring-offset-2 ring-offset-transparent" : "";
  const pcoUrl = `https://people.planningcenteronline.com/workflows/${workflowPcoId}/cards/${card.pco_id}`;

  const CardContent = (
    <div className={`${baseClasses} ${colorClasses} ${hoverClasses} ${flaggedClasses}`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`font-bold text-[15px] leading-tight pt-1 ${isOverdue && card.board_column !== 'completed' ? 'text-rose-950 dark:text-rose-100' : isSnoozed && card.board_column !== 'completed' ? 'text-slate-700 dark:text-slate-300' : 'text-gray-900 dark:text-gray-100'}`}>
          {card.person_name}
        </div>
        {card.person_avatar_url && (
          <img src={card.person_avatar_url} alt={card.person_name} className={`w-9 h-9 rounded-full border shadow-sm shrink-0 object-cover ${isOverdue && card.board_column !== 'completed' ? 'border-rose-200 dark:border-rose-700' : isSnoozed && card.board_column !== 'completed' ? 'border-slate-300 dark:border-slate-600 grayscale opacity-70' : 'border-gray-300 dark:border-slate-600'}`} />
        )}
      </div>
      
      {stepName && (
        <div className={`text-[11px] font-bold mt-1 uppercase tracking-wider ${isOverdue && card.board_column !== 'completed' ? 'text-rose-700/80 dark:text-rose-400' : isSnoozed && card.board_column !== 'completed' ? 'text-slate-500 dark:text-slate-400' : card.board_column === 'completed' ? 'text-emerald-700/80 dark:text-emerald-400' : 'text-indigo-700/80 dark:text-indigo-400'}`}>
          {stepName}
        </div>
      )}

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className={`flex-1 flex items-center gap-1.5 text-xs font-semibold ${isOverdue && card.board_column !== 'completed' ? 'text-rose-800/70 dark:text-rose-300' : isSnoozed && card.board_column !== 'completed' ? 'text-slate-500 dark:text-slate-400' : 'text-gray-600 dark:text-gray-400'}`}>
          {card.assignee_name && (
            <>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              <span className="truncate">{card.assignee_name}</span>
            </>
          )}
        </div>
        
        {((isOverdue || isSnoozed) && card.board_column !== 'completed') && (
          <div className={`text-[10px] font-black tracking-widest uppercase px-2 py-1 rounded shadow-sm shrink-0 ${
            isOverdue ? 'text-rose-100 bg-rose-600 dark:bg-rose-700' : 'text-slate-500 bg-slate-200/80 dark:text-slate-300 dark:bg-slate-700/80'
          }`}>
            {isOverdue ? 'OVERDUE' : 'SNOOZED'}
          </div>
        )}
      </div>
    </div>
  );

  if (interactive) return <a href={pcoUrl} target="_blank" rel="noopener noreferrer" className="block focus:outline-none outline-none">{CardContent}</a>;
  return CardContent;
}