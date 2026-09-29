import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

export function Attendance() {
  const { user } = useOutletContext();
  const [attendees, setAttendees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleCheck = async (personId, classNumber, isChecked) => {
    // 1. Optimistic UI update (feels instant)
    setAttendees(prev => prev.map(p => {
      if (p.id === personId) {
        return { ...p, [`connect${classNumber}`]: isChecked };
      }
      return p;
    }));

    // 2. Fire the network request
    try {
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/attendance/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ personId, classNumber, isChecked })
      });
    } catch (err) {
      console.error('Failed to save checkmark:', err);
    }
  };

  if (isLoading) {
    return <div className="flex h-full items-center justify-center font-bold text-slate-500 dark:text-slate-400">Loading Connect Track data...</div>;
  }

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mt-4 transition-colors duration-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-sm uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold transition-colors duration-200">
                <th className="p-4 w-full">Name</th>
                <th className="p-4 text-center whitespace-nowrap">Connect 1</th>
                <th className="p-4 text-center whitespace-nowrap">Connect 2</th>
                <th className="p-4 text-center whitespace-nowrap">Connect 3</th>
                <th className="p-4 text-center whitespace-nowrap">Connect 4</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              
              {attendees.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">
                    No attendees currently in the Connect Track workflow.
                  </td>
                </tr>
              ) : (
                attendees.map(person => (
                  <tr key={person.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors duration-150">
                    <td className="p-4 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                      {person.avatar ? (
                        <img src={person.avatar} alt={person.name} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-600" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                          {person.name.charAt(0)}
                        </div>
                      )}
                      {person.name}
                    </td>
                    {[1, 2, 3, 4].map(num => (
                      <td key={num} className="p-4 text-center">
                        <input 
                          type="checkbox" 
                          checked={person[`connect${num}`] || false}
                          onChange={(e) => handleCheck(person.id, num, e.target.checked)}
                          className="w-6 h-6 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-500 dark:ring-offset-slate-800 cursor-pointer shadow-sm transition-all"
                        />
                      </td>
                    ))}
                  </tr>
                ))
              )}

            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}