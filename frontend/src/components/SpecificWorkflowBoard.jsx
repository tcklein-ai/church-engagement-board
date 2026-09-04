import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export function SpecificWorkflowBoard({ workflows, steps, cards, workflowPcoId }) {
  // Pull dark mode preference from localStorage
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('pco_kanban_darkMode');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Save changes back to localStorage
  useEffect(() => {
    localStorage.setItem('pco_kanban_darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const workflow = useMemo(() => {
    return workflows.find((w) => String(w.pco_id) === String(workflowPcoId));
  }, [workflows, workflowPcoId]);

  const activeSteps = useMemo(() => {
    if (!workflow) return [];
    return steps
      .filter((s) => s.workflow_id === workflow.id)
      .sort((a, b) => a.position - b.position);
  }, [steps, workflow]);

  const cardsByStep = useMemo(() => {
    const map = {};
    if (!workflow) return map;
    
    const wfCards = cards.filter((c) => c.workflow_id === workflow.id);
    for (const card of wfCards) {
      const key = card.step_id || 'unassigned';
      (map[key] ??= []).push(card);
    }
    return map;
  }, [cards, workflow]);

  if (!workflow) {
    return (
      <div className="p-10 text-xl font-bold text-slate-500">
        Workflow not found. <Link to="/board/default/admin" className="text-indigo-500 underline">Return to Dashboard</Link>
      </div>
    );
  }

  const bgMain = darkMode ? 'bg-[#0f172a] text-gray-100' : 'bg-gray-50 text-gray-900';
  const bgHeader = darkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-gray-200 border-gray-300 text-gray-700';
  const bgColumn = darkMode ? 'bg-slate-800/40' : 'bg-white';
  const borderGrid = darkMode ? '#334155' : '#e5e7eb';

  return (
    <div className={`w-full h-full min-h-screen flex flex-col overflow-hidden ${bgMain}`}>
      
      {/* Top Navigation Toolbar */}
      <div className={`flex flex-shrink-0 items-center justify-between p-4 border-b shadow-sm transition-colors ${
        darkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-gray-300 text-gray-800'
      }`}>
        <div className="flex items-center gap-6">
          <Link 
            to="/board/default/admin" 
            className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Master Board
          </Link>
          <div className="h-6 w-px bg-gray-300 dark:bg-slate-700"></div>
          <h1 className="text-lg font-black uppercase tracking-wider flex items-center gap-3">
            <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: workflow.color ?? '#6366f1' }}></div>
            {workflow.name}
          </h1>
        </div>
        
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

      {/* Horizontal Scrolling Kanban Canvas */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max">
          
          {activeSteps.map((step) => (
            <div 
              key={step.id} 
              className={`flex flex-col w-[320px] flex-shrink-0 border-r ${bgColumn}`} 
              style={{ borderColor: borderGrid }}
            >
              <div className={`px-4 py-3 font-bold text-sm uppercase tracking-wide border-b-2 shadow-sm ${bgHeader}`} style={{ borderColor: borderGrid }}>
                {step.name}
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4 custom-scrollbar">
                <SpecificBoardCell 
                  cardsList={cardsByStep[step.id] ?? []} 
                  workflowPcoId={workflow.pco_id} 
                  steps={steps} 
                />
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
      const now = new Date();
      
      const aIsOverdue = a.flagged || (a.snoozed_until && new Date(a.snoozed_until) < now) ? 1 : 0;
      const bIsOverdue = b.flagged || (b.snoozed_until && new Date(b.snoozed_until) < now) ? 1 : 0;
      
      if (aIsOverdue !== bIsOverdue) return bIsOverdue - aIsOverdue; 

      const aTime = a.pco_created_at ? new Date(a.pco_created_at).getTime() : 0;
      const bTime = b.pco_created_at ? new Date(b.pco_created_at).getTime() : 0;
      
      return aTime - bTime; 
    });
  }, [cardsList]);

  if (sortedCards.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-lg text-gray-400 dark:text-slate-500 text-sm font-semibold text-center opacity-50">
        Drop cards here
      </div>
    );
  }

  return sortedCards.map((card) => (
    <SpecificKanbanCard 
      key={card.id} 
      card={card} 
      steps={steps} 
      workflowPcoId={workflowPcoId} 
    />
  ));
}

function SpecificKanbanCard({ card, steps, workflowPcoId }) {
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

  const baseClasses = `relative rounded-sm px-4 py-3 shadow-md ${tilt} transition-all duration-200 border-t border-l border-white/60 border-b border-r block focus:outline-none outline-none`;
  const hoverClasses = "hover:scale-105 hover:shadow-xl hover:z-10 cursor-pointer";
  const flaggedClasses = card.flagged ? "ring-2 ring-red-500 ring-offset-2 ring-offset-transparent" : "";
  const pcoUrl = `https://people.planningcenteronline.com/workflows/${workflowPcoId}/cards/${card.pco_id}`;

  return (
    <a href={pcoUrl} target="_blank" rel="noopener noreferrer" className={`${baseClasses} ${colorClasses} ${hoverClasses} ${flaggedClasses}`}>
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

      {card.assignee_name && (
        <div className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${isOverdue ? 'text-rose-800/70' : isSnoozed ? 'text-slate-500' : 'text-gray-600'}`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          {card.assignee_name}
        </div>
      )}
      
      {card.snoozed_until && (
        <div className={`text-xs mt-2 font-bold inline-block px-1.5 py-0.5 rounded shadow-sm ${
          isOverdue ? 'text-rose-100 bg-rose-700' : 'text-slate-600 bg-slate-200/80'
        }`}>
          {isOverdue ? 'Overdue:' : 'Snoozed:'} {new Date(card.snoozed_until).toLocaleDateString()}
        </div>
      )}
    </a>
  );
}