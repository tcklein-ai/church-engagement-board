import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useRealtimeBoard(_boardId) {
  const [workflows, setWorkflows] = useState([]);
  const [steps, setSteps] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const channelRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      setLoading(true);
      const [{ data: wf, error: wfErr }, { data: st, error: stErr }, { data: cd, error: cdErr }] =
        await Promise.all([
          supabase.from('pc_workflow_workflows').select('*').eq('is_active', true).order('position'),
          supabase.from('pc_workflow_steps').select('*').order('position'),
          supabase.from('pc_workflow_cards').select('*'),
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
  }, [_boardId]);

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