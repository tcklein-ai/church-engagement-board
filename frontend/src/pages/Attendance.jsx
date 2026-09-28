import { useState, useEffect } from 'react';

export function Attendance() {
  const [user, setUser] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Verify the leader is logged in via the secure HTTP-only cookie
  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/me`, { credentials: 'omit' }) // We use include in production, but let's test the endpoint first
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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between text-white">
          <h1 className="text-xl font-black uppercase tracking-wider">Connect Track Attendance</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold opacity-90">{user?.name}</span>
            {user?.avatar && <img src={user.avatar} alt="Profile" className="w-8 h-8 rounded-full border-2 border-indigo-400" />}
          </div>
        </div>

        {/* Spreadsheet Grid */}
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
              
              {/* Dummy Data Row (We will replace this with live PCO data) */}
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
        
      </div>
    </div>
  );
}