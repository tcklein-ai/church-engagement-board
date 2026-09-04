import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { SwimlaneBoard } from './components/SwimlaneBoard';
import { SpecificWorkflowBoard } from './components/SpecificWorkflowBoard';
import { useRealtimeBoard } from './hooks/useRealtimeBoard';

function MasterBoardView({ interactive }) {
  const { workflows, steps, cards, loading, error } = useRealtimeBoard();

  if (loading) return <div className="p-10 text-xl font-bold text-slate-500">Loading board data...</div>;
  if (error) return <div className="p-10 text-xl font-bold text-red-500">Error loading data: {error.message}</div>;

  return (
    <SwimlaneBoard 
      workflows={workflows} 
      steps={steps} 
      cards={cards} 
      interactive={interactive} 
    />
  );
}

function SpecificWorkflowView() {
  const { workflows, steps, cards, loading, error } = useRealtimeBoard();
  const { workflowPcoId } = useParams();

  if (loading) return <div className="p-10 text-xl font-bold text-slate-500">Loading workflow data...</div>;
  if (error) return <div className="p-10 text-xl font-bold text-red-500">Error loading data: {error.message}</div>;

  return (
    <SpecificWorkflowBoard 
      workflows={workflows} 
      steps={steps} 
      cards={cards} 
      workflowPcoId={workflowPcoId} 
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/board/:id/tv" element={<MasterBoardView interactive={false} />} />
        <Route path="/board/:id/admin" element={<MasterBoardView interactive={true} />} />
        <Route path="/board/:id/workflow/:workflowPcoId" element={<SpecificWorkflowView />} />
        <Route path="*" element={<Navigate to="/board/default/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}