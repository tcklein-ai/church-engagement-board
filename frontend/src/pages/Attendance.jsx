import { useOutletContext } from 'react-router-dom';

export function Attendance() {
  // Grab the authenticated user data passed down from the GlobalLayout
  const { user } = useOutletContext();

  const handleCheck = (personId, classNumber) => {
    // We will wire this to the backend API next
    console.log(`Marking Connect ${classNumber} complete for person ${personId} by ${user.name}`);
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-4">
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
      </div>
    </div>
  );
}