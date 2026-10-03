import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useRealtimeBoard(_boardId) {
  const [workflows, setWorkflows] = useState([]);
  const [steps, setSteps] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Track this state so we can force a re-fetch if settings change
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const channelRef = useRef(null);

  // Listen for a custom event from the Settings Modal to reload data
  useEffect(() => {
    const handleSettingsChange = () => setRefreshTrigger(prev => prev + 1);
    window.addEventListener('pco_settings_changed', handleSettingsChange);
    return () => window.removeEventListener('pco_settings_changed', handleSettingsChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      setLoading(true);

      // 1. Get the lookback days from storage, default to 30
      const savedDays = localStorage.getItem('pco_kanban_lookbackDays');
      const lookbackDays = savedDays !== null ? parseInt(savedDays, 10) : 30;

      // 2. Calculate the cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      const cutoffIso = cutoffDate.toISOString();

      // 3. The .or() query ensures active cards are ALWAYS fetched, but completed cards are filtered by date
      const [{ data: wf, error: wfErr }, { data: st, error: stErr }, { data: cd, error: cdErr }] =
        await Promise.all([
          supabase.from('pc_workflow_workflows').select('*').eq('is_active', true).order('position'),
          supabase.from('pc_workflow_steps').select('*').order('position'),
          supabase.from('pc_workflow_cards')
            .select('*')
            .or(`board_column.neq.completed,pco_updated_at.gte.${cutoffIso}`)
        ]);

      if (cancelled) return;

      const firstError = wfErr || stErr || cdErr;
      if (firstError) {
        setError(firstError);
      } else {
        setWorkflows(wf ?? []);
        setSteps(st ?? []);
        setCards(cd ?? []);
      }
      setLoading(false);
    }

    loadInitial();

    // Open a single Realtime channel and attach listeners for all three tables
    const channel = supabase
      .channel('pc-board-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pc_workflow_cards' },
        (payload) => setCards((current) => applyDatabaseChange(current, payload))
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pc_workflow_workflows' },
        (payload) => setWorkflows((current) => applyDatabaseChange(current, payload))
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pc_workflow_steps' },
        (payload) => setSteps((current) => applyDatabaseChange(current, payload))
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      cancelled = true;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [_boardId, refreshTrigger]); // Re-run if board ID or settings change

  return { workflows, steps, cards, loading, error };
}

// Unified function to handle inserts, updates, and deletes for any table array
function applyDatabaseChange(current, payload) {
  switch (payload.eventType) {
    case 'INSERT':
      if (current.some((item) => item.id === payload.new.id)) {
        return current.map((item) => (item.id === payload.new.id ? payload.new : item));
      }
      return [...current, payload.new];

    case 'UPDATE':
      return current.map((item) => (item.id === payload.new.id ? payload.new : item));

    case 'DELETE':
      return current.filter((item) => item.id !== payload.old.id);

    default:
      return current;
  }
}