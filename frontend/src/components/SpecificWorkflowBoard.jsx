import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCardStatus } from './SwimlaneBoard'; 
import { SettingsModal } from './SettingsModal';

export function SpecificWorkflowBoard({ workflows, steps, cards, workflowPcoId }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const workflow = useMemo(() => workflows.find((w) => String(w.pco_id) === String(workflowPcoId)), [workflows, workflowPcoId]);

  const activeSteps = useMemo(() => {
    if (!workflow) return [];
    return steps.filter((s) => s.workflow_id === workflow.id).sort((a, b) => a.position - b.position);
  }, [steps, workflow]);

  const { activeCardsByStep, completedCards } = useMemo(() => {
    const activeMap = {};
    const completedList = [];
    if (!workflow) return { activeCardsByStep: activeMap, completedCards: completedList };
    
    const wfCards = cards.filter((c) => c.workflow_id === workflow.id);
    for (const card of wfCards) {
      if (card.board_column === 'completed') {
        completedList.push(card);
      } else {
        const key = card.step_id || 'unassigned';
        (activeMap[key] ??= []).push(card);
      }
    }
    
    completedList.sort((a, b) => new Date(b.pco_updated_at || 0) - new Date(a.pco_updated_at || 0));
    
    return { activeCardsByStep: activeMap, completedCards: completedList };
  }, [cards, workflow]);

  if (!workflow) {
    return (
      <div className="p-10 text-xl font-bold text-slate-500 dark:text-slate-400">
        Workflow not found. <Link to="/board/default/admin" className="text-indigo-500 dark:text-indigo-400 underline">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Drawer Overlay */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={() => setIsDrawerOpen(false)}></div>
          <div className="relative w-[400px] h-full shadow-2xl flex flex-col transform transition-transform duration-300 bg-gray-50 dark:bg-slate-900 border-l border-gray-300 dark:border-slate-700">
            <div className="p-5 border-b flex items-center justify-between bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800 dark:text-slate-200">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                Completed Archive
              </h2>
              <button onClick={() => setIsDrawerOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
              {completedCards.length === 0 ? (
                <div className="text-center text-gray-500 mt-10">No completed cards in the history timeframe.</div>
              ) : (
                completedCards.map(card => <SpecificKanbanCard key={card.id} card={card} steps={steps} workflowPcoId={workflowPcoId} />)
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-shrink-0 items-center justify-between p-4 border-b shadow-sm transition-colors bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-800 dark:text-slate-200">
        <div className="flex items-center gap-6">
          <Link to="/board/default/admin" className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Master Board
          </Link>
          <div className="h-6 w-px bg-gray-300 dark:bg-slate-700"></div>
          <h1 className="text-lg font-black uppercase tracking-wider flex items-center gap-3">
            <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: workflow.color ?? '#6366f1' }}></div>
            {workflow.name}
          </h1>
        </div>
        
        <div className="flex items-center gap-6">
          <button onClick={() => setIsDrawerOpen(true)} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-900/70 border border-emerald-200 dark:border-emerald-800 rounded-full text-sm font-bold shadow-sm transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            {completedCards.length} Completed
          </button>
          
          <button onClick={() => setIsSettingsOpen(true)} className="text-gray-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors border-l border-gray-300 dark:border-slate-700 pl-6" title="Board Settings">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max">
          {activeSteps.map((step) => (
            <div key={step.id} className="flex flex-col w-[320px] flex-shrink-0 border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/40">
              <div className="px-4 py-3 font-bold text-sm uppercase tracking-wide border-b-2 border-gray-300 dark:border-slate-700 shadow-sm bg-gray-200 dark:bg-slate-900 text-gray-700 dark:text-slate-300">
                {step.name}
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4 custom-scrollbar">
                <SpecificBoardCell cardsList={activeCardsByStep[step.id] ?? []} workflowPcoId={workflow.pco_id} steps={steps} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SpecificBoardCell({ cardsList, workflowPcoId, steps }) {
  const sortedCards = useMemo(() => {
    return [...cardsList].sort((a, b) => {
      const aStatus = getCardStatus(a);
      const bStatus = getCardStatus(b);
      
      if (aStatus.isOverdue !== bStatus.isOverdue) return bStatus.isOverdue ? 1 : -1; 
      
      const aTime = a.pco_created_at ? new Date(a.pco_created_at).getTime() : 0;
      const bTime = b.pco_created_at ? new Date(b.pco_created_at).getTime() : 0;
      return aTime - bTime; 
    });
  }, [cardsList]);

  if (sortedCards.length === 0) return <div className="h-full w-full flex items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-lg text-gray-400 dark:text-slate-500 text-sm font-semibold text-center opacity-50">Drop cards here</div>;

  return sortedCards.map((card) => <SpecificKanbanCard key={card.id} card={card} steps={steps} workflowPcoId={workflowPcoId} />);
}

function SpecificKanbanCard({ card, steps, workflowPcoId }) {
  const charCode = card.id.charCodeAt(0) + card.id.charCodeAt(card.id.length - 1);
  const tilt = charCode % 3 === 0 ? '-rotate-1' : charCode % 3 === 1 ? 'rotate-2' : 'rotate-1';
  
  const { isOverdue, isSnoozed } = getCardStatus(card);

  let colorClasses = "bg-[#fefce8] text-gray-800 border-[#fde047]/60 dark:bg-yellow-900/20 dark:text-yellow-100 dark:border-yellow-700/50"; 
  if (card.board_column === 'completed') colorClasses = "bg-emerald-50 text-emerald-950 border-emerald-300/80 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-800/50"; 
  else if (isOverdue) colorClasses = "bg-rose-50 text-rose-950 border-rose-300/80 dark:bg-rose-900/30 dark:text-rose-100 dark:border-rose-800/50"; 
  else if (isSnoozed) colorClasses = "bg-slate-100 text-slate-600 border-slate-300/80 opacity-80 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"; 

  const baseClasses = `relative rounded-sm px-4 py-3 shadow-md ${tilt} transition-all duration-200 border-t border-l border-white/60 dark:border-white/10 border-b border-r block focus:outline-none outline-none`;
  const hoverClasses = "hover:scale-105 hover:shadow-xl hover:z-10 cursor-pointer";
  const flaggedClasses = card.flagged ? "ring-2 ring-red-500 ring-offset-2 ring-offset-transparent" : "";
  const pcoUrl = `https://people.planningcenteronline.com/workflows/${workflowPcoId}/cards/${card.pco_id}`;

  return (
    <a href={pcoUrl} target="_blank" rel="noopener noreferrer" className={`${baseClasses} ${colorClasses} ${hoverClasses} ${flaggedClasses}`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`font-bold text-[15px] leading-tight pt-1 ${isOverdue && card.board_column !== 'completed' ? 'text-rose-950 dark:text-rose-100' : isSnoozed && card.board_column !== 'completed' ? 'text-slate-700 dark:text-slate-300' : 'text-gray-900 dark:text-gray-100'}`}>
          {card.person_name}
        </div>
        {card.person_avatar_url && (
          <img src={card.person_avatar_url} alt={card.person_name} className={`w-9 h-9 rounded-full border shadow-sm shrink-0 object-cover ${isOverdue && card.board_column !== 'completed' ? 'border-rose-200 dark:border-rose-700' : isSnoozed && card.board_column !== 'completed' ? 'border-slate-300 dark:border-slate-600 grayscale opacity-70' : 'border-gray-300 dark:border-slate-600'}`} />
        )}
      </div>

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
    </a>
  );
}