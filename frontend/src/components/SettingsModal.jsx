import { useState, useEffect } from 'react';

export function SettingsModal({ isOpen, onClose, darkMode }) {
  const [lookback, setLookback] = useState(30);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('pco_kanban_lookbackDays');
      setLookback(saved !== null ? parseInt(saved, 10) : 30);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem('pco_kanban_lookbackDays', lookback.toString());
    window.dispatchEvent(new Event('pco_settings_changed'));
    onClose();
  };

  const overlayBg = darkMode ? 'bg-slate-900/80' : 'bg-gray-500/50';
  const modalBg = darkMode ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-white text-gray-800 border-gray-200';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${overlayBg} backdrop-blur-sm transition-opacity`}>
      <div className={`w-full max-w-md p-6 rounded-lg shadow-2xl border ${modalBg}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            Board Settings
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-bold mb-2">Completed Card History</label>
          <select 
            value={lookback} 
            onChange={(e) => setLookback(Number(e.target.value))}
            className={`w-full p-2.5 rounded border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${darkMode ? 'bg-slate-900 border-slate-600 text-slate-200' : 'bg-gray-50 border-gray-300 text-gray-800'}`}
          >
            <option value={14}>14 Days</option>
            <option value={30}>30 Days (Default)</option>
            <option value={60}>60 Days</option>
            <option value={90}>90 Days</option>
            <option value={120}>120 Days</option>
            <option value={180}>180 Days</option>
          </select>
          <p className="text-xs mt-3 text-gray-500 dark:text-slate-400 leading-relaxed">
            Only completed cards within this timeframe will be loaded from the database. Keeping this window small ensures your board remains blazing fast as your church grows. (Active cards are always loaded).
          </p>
        </div>

        <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-200 dark:border-slate-700">
          <div className="text-xs text-gray-400 font-mono">v1.1.0</div>
          <div className="flex gap-3">
            <button onClick={onClose} className={`px-4 py-2 text-sm font-bold rounded transition-colors ${darkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-gray-100 text-gray-600'}`}>
              Cancel
            </button>
            <button onClick={handleSave} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded shadow-md transition-colors">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}