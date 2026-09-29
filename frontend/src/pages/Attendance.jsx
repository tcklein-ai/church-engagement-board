import { useState, useEffect } from 'react';

export function Attendance() {
  const [user, setUser] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Verify the leader is logged in via the secure HTTP-only cookie
  useEffect(() => {
    // Changed credentials to 'include' to pass the secure cookie
    fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/me`, { credentials: 'include' }) 
      .then(res => res.json())
      .then(data => {
        if (data.error) window.location.href = `${import.meta.env.VITE_BACKEND_URL}/auth/login`;
        else setUser(data);
        setIsLoading(false);
      })
      .catch(() => window.location.href = `${import.meta.env.VITE_BACKEND_URL}/auth/login`);
  }, []);

  const handleCheck = (personId, classNumber) => {
    // We will wire this to the backend API next
    console.log(`Marking Connect ${classNumber} complete for person ${personId}`);
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center font-bold text-gray-500">Authenticating...</div>;

  // The visual color mapping for different permission tiers
  const permissionColors = {
    Administrator: 'bg-red-100 text-red-800 border-red-200',
    Manager: 'bg-orange-100 text-orange-800 border-orange-200',
    Editor: 'bg-green-100 text-green-800 border-green-200',
    Viewer: 'bg-blue-100 text-blue-800 border-blue-200',
    None: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  const badgeColor = permissionColors[user?.pcoPermission] || permissionColors.None;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between text-white">
          <h1 className="text-xl font-black uppercase tracking-wider">Connect Track Attendance</h1>
          
          <div className="flex items-center gap-4">
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
        </div>

        {/* Security Gate: Block UI if they have no PCO access */}
        {user?.pcoPermission === 'None' ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <span className="text-2xl">🔒</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Your Planning Center profile does not have permission to view or edit People data. Please contact a system administrator to request access.
            </p>
          </div>
        ) : (
          /* Spreadsheet Grid for Authorized Users */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 text-sm uppercase tracking-wider text-gray-600 font-bold">
                  <th className="p-4 w-full">Name</th>
                  <th className="p-4 text-center whitespace-nowrap">Connect 1</th>
                  <th className="p-4 text-center whitespace-nowrap">Connect 2</th>
                  <th className="p-4 text-center whitespace-nowrap">Connect 3</th>
                  <th className="p-4 text-center whitespace-nowrap">Connect 4</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                
                {/* Dummy Data Row */}
                <tr className="hover:bg-indigo-50/50 transition-colors">
                  <td className="p-4 font-semibold text-gray-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0"></div>
                    John Doe
                  </td>
                  {[1, 2, 3, 4].map(num => (
                    <td key={num} className="p-4 text-center">
                      <input 
                        type="checkbox" 
                        onChange={() => handleCheck('123', num)}
                        className="w-6 h-6 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shadow-sm"
                      />
                    </td>
                  ))}
                </tr>

              </tbody>
            </table>
          </div>
        )}
        
      </div>
    </div>
  );
}