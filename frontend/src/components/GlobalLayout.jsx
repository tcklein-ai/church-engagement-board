import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { AppConfigModal } from './AppConfigModal';

export function GlobalLayout() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const location = useLocation();

  // Authentication Check
  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/me`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.error) window.location.href = `${import.meta.env.VITE_BACKEND_URL}/auth/login`;
        else {
          setUser(data);
          setIsLoading(false);
        }
      })
      .catch(() => window.location.href = `${import.meta.env.VITE_BACKEND_URL}/auth/login`);
  }, []);

  // Theme Initialization
  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setIsDarkMode(true);
    }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900">Authenticating...</div>;

  const isTvMode = location.pathname.endsWith('/tv');

  const permissionColors = {
    Administrator: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50',
    Manager: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/50',
    Editor: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50',
    Viewer: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50',
    None: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  };

  const badgeColor = permissionColors[user?.pcoPermission] || permissionColors.None;

  if (user?.pcoPermission === 'None') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 p-8 transition-colors duration-200">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Access Denied</h2>
          <p className="text-slate-600 dark:text-slate-400">Your Planning Center profile does not have permission to view or edit People data. Please contact a system administrator to request access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col transition-colors duration-200">
      {!isTvMode && (
        <header className="bg-indigo-600 dark:bg-slate-800 px-6 py-4 flex flex-wrap items-center justify-between text-white shadow-md z-50 gap-4 border-b dark:border-slate-700 transition-colors duration-200">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-200 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <h1 className="text-xl font-black uppercase tracking-wider">Passion Kanban</h1>
            </div>
            
            <nav className="flex gap-2">
              <Link 
                to="/board/default/admin" 
                className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors ${location.pathname.includes('/board') ? 'bg-indigo-800 dark:bg-indigo-500/20 text-white dark:text-indigo-300' : 'text-indigo-100 hover:bg-indigo-500 dark:text-slate-300 dark:hover:bg-slate-700 hover:text-white'}`}
              >
                Kanban Board
              </Link>
              <Link 
                to="/attendance" 
                className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors ${location.pathname.includes('/attendance') ? 'bg-indigo-800 dark:bg-indigo-500/20 text-white dark:text-indigo-300' : 'text-indigo-100 hover:bg-indigo-500 dark:text-slate-300 dark:hover:bg-slate-700 hover:text-white'}`}
              >
                Connect Track
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            {/* Dark Mode Toggle */}
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full hover:bg-indigo-500 dark:hover:bg-slate-700 transition-colors text-indigo-100 dark:text-slate-300"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
              )}
            </button>

            {user?.isAppAdmin && (
              <button 
                onClick={() => setIsConfigOpen(true)}
                className="px-2 py-1 text-xs font-bold bg-indigo-800 dark:bg-indigo-900/50 text-indigo-100 dark:text-indigo-300 rounded border border-indigo-700 dark:border-indigo-800 hover:bg-indigo-700 dark:hover:bg-indigo-900 transition-colors"
              >
                App Admin
              </button>
            )}
            
            <div className="text-right">
              <div className="text-sm font-bold text-white dark:text-slate-100">{user?.name}</div>
              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded border ${badgeColor}`}>
                PCO: {user?.pcoPermission}
              </span>
            </div>
            {user?.avatar && <img src={user.avatar} alt="Profile" className="w-10 h-10 rounded-full border-2 border-indigo-400 dark:border-slate-600" />}
          </div>
        </header>
      )}

      <main className="flex-1 overflow-hidden relative">
        <Outlet context={{ user }} />
      </main>

      <AppConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
    </div>
  );
}