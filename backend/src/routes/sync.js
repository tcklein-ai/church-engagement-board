import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { defaultColumnForStep } from '../lib/columnMapping.js';

export const syncRouter = Router();

async function fetchPco(endpoint) {
  const authHeader = 'Basic ' + Buffer.from(`${process.env.PCO_APP_ID}:${process.env.PCO_SECRET}`).toString('base64');
  const url = `https://api.planningcenteronline.com/people/v2${endpoint}`;
  
  const response = await fetch(url, { headers: { Authorization: authHeader } });
  if (!response.ok) throw new Error(`PCO API error: ${response.status}`);
  return response.json();
}

syncRouter.post('/', async (req, res) => {
  try {
    const wfRes = await fetchPco('/workflows');
    const workflows = wfRes.data;
    
    for (const wf of workflows) {
      const { data: dbWf } = await supabase
        .from('pc_workflow_workflows')
        .upsert({
          pco_id: wf.id,
          name: wf.attributes.name,
          is_active: true
        }, { onConflict: 'pco_id' })
        .select().single();

      const stepsRes = await fetchPco(`/workflows/${wf.id}/steps`);
      for (const step of stepsRes.data) {
        const stepName = step.attributes.name;
        const stepPosition = step.attributes.sequence || 0;
        const boardColumn = defaultColumnForStep({ name: stepName, position: stepPosition });

        await supabase
          .from('pc_workflow_steps')
          .upsert({
            workflow_id: dbWf.id,
            pco_id: step.id,
            name: stepName,
            position: stepPosition,
            boardColumn: boardColumn
          }, { onConflict: 'workflow_id, pco_id' });
      }

      const cardsRes = await fetchPco(`/workflows/${wf.id}/cards?include=person,assignee`);
      const included = cardsRes.included || [];
      
      for (const card of cardsRes.data) {
        const stepPcoId = card.relationships?.current_step?.data?.id ?? card.relationships?.step?.data?.id;
        const personPcoId = card.relationships?.person?.data?.id;
        const assigneePcoId = card.relationships?.assignee?.data?.id;

        let stepRowId = null;
        let boardColumn = 'new';
        
        if (stepPcoId) {
            const { data: st } = await supabase
              .from('pc_workflow_steps')
              .select('*')
              .eq('workflow_id', dbWf.id)
              .eq('pco_id', stepPcoId)
              .maybeSingle();
              
            if (st) {
                stepRowId = st.id;
                boardColumn = st.board_column;
            }
        } else if (card.attributes?.completed_at) {
            boardColumn = 'completed';
        }

        const personInc = included.find(i => i.type === 'Person' && i.id === personPcoId);
        const assigneeInc = included.find(i => i.type === 'Person' && i.id === assigneePcoId);

        await supabase.from('pc_workflow_cards').upsert({
          pco_id: card.id,
          workflow_id: dbWf.id,
          step_id: stepRowId,
          board_column: boardColumn,
          person_pco_id: personPcoId,
          person_name: personInc?.attributes?.name ?? 'Unknown',
          person_avatar_url: personInc?.attributes?.avatar ?? null,
          assignee_pco_id: assigneePcoId,
          assignee_name: assigneeInc?.attributes?.name ?? null,
          note: card.attributes?.note ?? null,
          snoozed_until: card.attributes?.snooze_until ?? null,
          flagged: card.attributes?.flagged ?? false,
          is_overdue: card.attributes?.overdue ?? false,
          pco_created_at: card.attributes?.created_at ?? null,
          pco_updated_at: card.attributes?.updated_at ?? null,
        }, { onConflict: 'pco_id', ignoreDuplicates: false });
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Full sync failed:", error);
    res.status(500).json({ error: error.message });
  }
});