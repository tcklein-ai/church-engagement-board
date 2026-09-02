/**
 * PCO workflows don't natively know about our four universal board columns
 * (new / action_required / waiting / completed) — that's a mapping WE define
 * per-step. This gives a sane default the first time we ever see a step, and
 * `steps.board_column` remains editable afterwards (e.g. from an admin
 * settings screen) without this code needing to change.
 *
 * Default heuristic:
 *   - first step in the workflow            -> 'new'
 *   - a step whose name suggests waiting     -> 'waiting'
 *   - a step whose name suggests done        -> 'completed'
 *   - everything else                        -> 'action_required'
 */
const WAITING_HINTS = ['wait', 'snooze', 'follow up', 'follow-up', 'pending'];
const COMPLETED_HINTS = ['complete', 'done', 'closed', 'finished', 'archiv'];

export function defaultColumnForStep({ name, position }) {
  const lower = (name || '').toLowerCase();

  if (position === 0) return 'new';
  if (COMPLETED_HINTS.some((hint) => lower.includes(hint))) return 'completed';
  if (WAITING_HINTS.some((hint) => lower.includes(hint))) return 'waiting';
  return 'action_required';
}
