import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SwimlaneBoard } from './components/SwimlaneBoard';
import { useRealtimeBoard } from './hooks/useRealtimeBoard';

function BoardView({ interactive }) {
  const { workflows, steps, cards, loading, error } = useRealtimeBoard();

  if (loading) return <div className="p-10 text-xl font-bold text-slate-500">Loading board data...</div>;
  if (error) return <div className="p-10 text-xl font-bold text-red-500">Error loading data: {error.message}</div>;

  return (
    <SwimlaneBoard 
      workflows={workflows} 
      steps={steps} 
      cards={cards} 
      interactive={interactive} 
      onMoveCard={async ({ cardId, targetStepPcoId, targetBoardColumn }) => {
        // Optimistic UI update handled by backend
        await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/cards/${cardId}/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetStepPcoId, targetBoardColumn })
        });
      }}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/board/:id/tv" element={<BoardView interactive={false} />} />
        <Route path="/board/:id/admin" element={<BoardView interactive={true} />} />
        <Route path="*" element={<Navigate to="/board/default/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}