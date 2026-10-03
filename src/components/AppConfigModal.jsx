import { useState, useEffect } from 'react';

export function AppConfigModal({ isOpen, onClose }) {
  const [config, setConfig] = useState({
    workflow_id: '',
    connect_1_field_id: '',
    connect_2_field_id: '',
    connect_3_field_id: '',
    connect_4_field_id: ''
  });
  
  const [workflows, setWorkflows] = useState([]);
  const [fields, setFields] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    
    Promise.all([
      fetch(`${import.meta.env.VITE_BACKEND_URL}/api/config`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${import.meta.env.VITE_BACKEND_URL}/api/config/pco/workflows`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${import.meta.env.VITE_BACKEND_URL}/api/config/pco/field-definitions`, { credentials: 'include' }).then(r => r.json())
    ]).then(([confData, wfData, fieldData]) => {
      if (confData && !confData.error) {
        setConfig(prev => ({ ...prev, ...confData }));
      }
      if (wfData && !wfData.error) setWorkflows(wfData);
      if (fieldData && !fieldData.error) setFields(fieldData);
      
      setIsLoading(false);
    }).catch(err => {
      console.error('Failed to load config data:', err);
      setIsLoading(false);
    });
  }, [isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config)
      });
      // Force a page reload so the Attendance grid picks up the new IDs immediately
      window.location.reload(); 
    } catch (err) {
      console.error('Failed to save config:', err);
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const selectClasses = "w-full mt-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors";
  const labelClasses = "block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden transition-colors duration-200">
        
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <h2 className="text-lg font-black tracking-wide text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            System Configuration
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-12 text-slate-500 font-bold">Connecting to Planning Center API...</div>
          ) : (
            <>
              {/* Workflows */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <label className={labelClasses}>Target Workflow</label>
                <select 
                  value={config.workflow_id || ''} 
                  onChange={e => setConfig({...config, workflow_id: e.target.value})}
                  className={selectClasses}
                >
                  <option value="">-- Select Connect Track Workflow --</option>
                  {workflows.map(wf => (
                    <option key={wf.id} value={wf.id}>{wf.attributes.name}</option>
                  ))}
                </select>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">The workflow that holds your current Connect Track attendees.</p>
              </div>

              {/* Custom Fields Mapping */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">Connect Track Milestones</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(num => (
                    <div key={num}>
                      <label className={labelClasses}>Connect {num} Field</label>
                      <select 
                        value={config[`connect_${num}_field_id`] || ''} 
                        onChange={e => setConfig({...config, [`connect_${num}_field_id`]: e.target.value})}
                        className={selectClasses}
                      >
                        <option value="">-- Select Field --</option>
                        {fields.map(field => (
                          <option key={field.id} value={field.id}>{field.attributes.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition-colors">Cancel</button>
          <button 
            onClick={handleSave} 
            disabled={isLoading || isSaving}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
        
      </div>
    </div>
  );
}