//frontend
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

export function Attendance() {
  const { user } = useOutletContext();
  const [attendees, setAttendees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'completed'

  // Fetch live Connect Track attendees
  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/attendance`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setAttendees(data.attendees || []); 
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch attendance:', err);
        setIsLoading(false);
      });
  }, []);

  const showToast = (message, type, duration = 4000) => {
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    setToast({ message, type });
    if (type !== 'loading') {
      window.toastTimeout = setTimeout(() => setToast(null), duration);
    }
  };

  const handleCheck = async (personId, classNumber, isChecked) => {
    const previousAttendees = [...attendees];
    const today = new Date().toISOString().split('T')[0];

    // Optimistic UI update: convert to date string if checked, or null if unchecked
    setAttendees(prev => prev.map(p => {
      if (p.id === personId) {
        return { ...p, [`connect${classNumber}`]: isChecked ? today : null };
      }
      return p;
    }));

    showToast('Syncing with Planning Center...', 'loading');

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/attendance/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ personId, classNumber, isChecked })
      });
      
      const data = await res.json();

      if (data.success) {
        if (data.cardStatus?.attempted && !data.cardStatus?.success) {
          showToast('Class saved, but failed to auto-complete workflow card.', 'warning', 6000);
        } else if (data.cardStatus?.attempted && data.cardStatus?.success) {
          showToast('Class saved & workflow card completed!', 'success');
          // Move them to the completed tab visually
          setAttendees(prev => prev.map(p => p.id === personId ? { ...p, stage: 'completed' } : p));
        } else {
          showToast('Attendance saved.', 'success', 2500);
        }
      } else {
        setAttendees(previousAttendees);
        showToast(data.error || 'Failed to save attendance.', 'error');
      }
    } catch (err) {
      console.error('Failed to save checkmark:', err);
      setAttendees(previousAttendees);
      showToast('Network error. Please try again.', 'error');
    }
  };

  // Date formatter for the completed view
  const formatDate = (dateString) => {
    if (!dateString) return <span className="text-slate-400 dark:text-slate-500">-</span>;
    // Fix timezone shifting by manually parsing the parts
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Filter lists based on workflow stage
  const activeAttendees = attendees.filter(a => a.stage !== 'completed' && a.stage !== 'removed');
  const completedAttendees = attendees.filter(a => a.stage === 'completed');
  
  const displayedAttendees = activeTab === 'active' ? activeAttendees : completedAttendees;

  if (isLoading) {
    return <div className="flex h-full items-center justify-center font-bold text-slate-500 dark:text-slate-400">Loading Connect Track data...</div>;
  }

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 transition-colors duration-200 relative">
      
      {/* Header & Tabs */}
      <div className="max-w-4xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Connect Track Attendance</h1>
        
        <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg shadow-inner w-fit">
          <button 
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${
              activeTab === 'active' 
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            In Progress ({activeAttendees.length})
          </button>
          <button 
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${
              activeTab === 'completed' 
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Completed ({completedAttendees.length})
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-sm uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold transition-colors duration-200">
                <th className="p-4 min-w-[200px]">Name</th>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                  <th key={`header-${num}`} className="p-4 text-center whitespace-nowrap">Connect {num}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              
              {displayedAttendees.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">
                    {activeTab === 'active' ? 'No attendees currently in progress.' : 'No completed attendees found.'}
                  </td>
                </tr>
              ) : (
                displayedAttendees.map(person => (
                  <tr key={person.id} className="hover:bg-indigo-50/50 dark:hover:bg-slate-700/30 transition-colors duration-150">
                    <td className="p-4 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-3 min-w-[200px]">
                      {person.avatar ? (
                        <img src={person.avatar} alt={person.name} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-600 shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                          {person.name.charAt(0)}
                        </div>
                      )}
                      <span className="truncate">{person.name}</span>
                    </td>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                      <td key={`check-${num}`} className="p-4 text-center text-sm text-slate-600 dark:text-slate-300">
                        {activeTab === 'active' ? (
                          <input 
                            type="checkbox" 
                            checked={!!person[`connect${num}`]}
                            onChange={(e) => handleCheck(person.id, num, e.target.checked)}
                            className="w-6 h-6 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-500 dark:ring-offset-slate-800 cursor-pointer shadow-sm transition-all"
                          />
                        ) : (
                          <div className="whitespace-nowrap font-medium text-xs">
                            {formatDate(person[`connect${num}`])}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}

            </tbody>
          </table>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-0 left-0 w-full md:bottom-6 md:left-auto md:right-6 md:w-auto md:min-w-[300px] md:rounded-lg shadow-[0_-4px_10px_rgba(0,0,0,0.1)] md:shadow-xl p-4 z-50 flex items-center gap-3 transition-colors duration-300 ${
          toast.type === 'loading' ? 'bg-indigo-600 text-white' :
          toast.type === 'success' ? 'bg-emerald-600 text-white' :
          toast.type === 'warning' ? 'bg-amber-500 text-white' :
          'bg-rose-600 text-white'
        }`}>
          {toast.type === 'loading' && (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          )}
          {toast.type === 'success' && (
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
          )}
          {toast.type === 'warning' && (
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          )}
          {toast.type === 'error' && (
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          )}
          <span className="font-bold text-sm tracking-wide">{toast.message}</span>
        </div>
      )}
    </div>
  );
}