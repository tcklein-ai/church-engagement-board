import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

export function GlobalLayout() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

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

  if (isLoading) return <div className="flex h-screen items-center justify-center font-bold text-gray-500">Authenticating...</div>;

  const isTvMode = location.pathname.endsWith('/tv');

  const permissionColors = {
    Administrator: 'bg-red-100 text-red-800 border-red-200',
    Manager: 'bg-orange-100 text-orange-800 border-orange-200',
    Editor: 'bg-green-100 text-green-800 border-green-200',
    Viewer: 'bg-blue-100 text-blue-800 border-blue-200',
    None: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  const badgeColor = permissionColors[user?.pcoPermission] || permissionColors.None;

  if (user?.pcoPermission === 'None') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-8">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">Your Planning Center profile does not have permission to view or edit People data. Please contact a system administrator to request access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hide header completely if viewing on an unattended TV display */}
      {!isTvMode && (
        <header className="bg-indigo-600 px-6 py-4 flex flex-wrap items-center justify-between text-white shadow-md z-50 gap-4">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <h1 className="text-xl font-black uppercase tracking-wider">Passion Kanban</h1>
            </div>
            
            <nav className="flex gap-2">
              <Link 
                to="/board/default/admin" 
                className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors ${location.pathname.includes('/board') ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-500 hover:text-white'}`}
              >
                Kanban Board
              </Link>
              <Link 
                to="/attendance" 
                className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors ${location.pathname.includes('/attendance') ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-500 hover:text-white'}`}
              >
                Connect Track
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            {user?.isAppAdmin && (
               <span className="px-2 py-1 text-xs font-bold bg-indigo-800 text-indigo-100 rounded border border-indigo-700">App Admin</span>
            )}
            <div className="text-right">
              <div className="text-sm font-bold">{user?.name}</div>
              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded border ${badgeColor}`}>
                PCO: {user?.pcoPermission}
              </span>
            </div>
            {user?.avatar && <img src={user.avatar} alt="Profile" className="w-10 h-10 rounded-full border-2 border-indigo-400" />}
          </div>
        </header>
      )}

      {/* Outlet renders the specific page content (Board or Attendance) below the header */}
      <main className="flex-1 overflow-hidden relative">
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}