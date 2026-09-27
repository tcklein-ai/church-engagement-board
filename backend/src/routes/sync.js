import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { defaultColumnForStep } from '../lib/columnMapping.js';

export const syncRouter = Router();

async function fetchPco(endpoint) {
  const authHeader = 'Basic ' + Buffer.from(`${process.env.PCO_APP_ID}:${process.env.PCO_SECRET}`).toString('base64');
  const url = `https://api.planningcenteronline.com/people/v2${endpoint}`;
  
  console.log(`[SYNC] Fetching PCO URL: ${url}`);
  
  const response = await fetch(url, { headers: { Authorization: authHeader } });
  if (!response.ok) {
    const errText = await response.text();
    console.error(`[SYNC] PCO API Error (${response.status}): ${errText}`);
    throw new Error(`PCO API error: ${response.status}`);
  }
  return response.json();
}

syncRouter.post('/', async (req, res) => {
  console.log('\n=======================================');
  console.log('[SYNC] /api/sync endpoint hit! Starting manual sync...');
  console.log('=======================================\n');
  
  try {
    const wfRes = await fetchPco('/workflows');
    const workflows = wfRes.data;
    console.log(`[SYNC] Found ${workflows.length} workflows in PCO.`);
    
    for (const wf of workflows) {
      console.log(`\n[SYNC] --- Processing Workflow: ${wf.attributes.name} (ID: ${wf.id}) ---`);
      
      const { data: dbWf, error: wfErr } = await supabase
        .from('pc_workflow_workflows')
        .upsert({
          pco_id: wf.id,
          name: wf.attributes.name,
          is_active: true
        }, { onConflict: 'pco_id' })
        .select().single();

      if (wfErr) {
        console.error(`[SYNC DB ERROR] Failed to upsert workflow ${wf.id}:`, wfErr);
        continue; 
      }

      const stepsRes = await fetchPco(`/workflows/${wf.id}/steps`);
      console.log(`[SYNC] Found ${stepsRes.data.length} steps for Workflow ${wf.id}`);
      
      for (const step of stepsRes.data) {
        const stepName = step.attributes.name;
        const stepPosition = step.attributes.sequence || 0;
        const boardColumn = defaultColumnForStep({ name: stepName, position: stepPosition });

        const { error: stepErr } = await supabase
          .from('pc_workflow_steps')
          .upsert({
            workflow_id: dbWf.id,
            pco_id: step.id,
            name: stepName,
            position: stepPosition,
            board_column: boardColumn
          }, { onConflict: 'workflow_id, pco_id' });
          
        if (stepErr) console.error(`[SYNC DB ERROR] Failed to upsert step ${step.id}:`, stepErr);
      }

      const cardsRes = await fetchPco(`/workflows/${wf.id}/cards?include=person,assignee`);
      const included = cardsRes.included || [];
      console.log(`[SYNC] Found ${cardsRes.data.length} cards for Workflow ${wf.id}`);
      
      const activeCardPcoIds = [];

      for (const card of cardsRes.data) {
        // --- NEW FIX: Banish Removed Cards ---
        if (card.attributes?.removed_at) {
          console.log(`[SYNC] Card ${card.id} is removed in PCO. Skipping.`);
          continue;
        }

        activeCardPcoIds.push(card.id);
        const stepPcoId = card.relationships?.current_step?.data?.id ?? card.relationships?.step?.data?.id;
        const personPcoId = card.relationships?.person?.data?.id;
        const assigneePcoId = card.relationships?.assignee?.data?.id;

        let stepRowId = null;
        let boardColumn = 'new';
        
        if (stepPcoId) {
            const { data: st, error: stErr } = await supabase
              .from('pc_workflow_steps')
              .select('*')
              .eq('workflow_id', dbWf.id)
              .eq('pco_id', stepPcoId)
              .maybeSingle();
              
            if (stErr) console.error(`[SYNC DB ERROR] Error fetching step ${stepPcoId}:`, stErr);
              
            if (st) {
                stepRowId = st.id;
                boardColumn = st.board_column;
            }
        } 
        
        if (card.attributes?.completed_at) {
            boardColumn = 'completed';
        }

        const personInc = included.find(i => i.type === 'Person' && i.id === personPcoId);
        const assigneeInc = included.find(i => i.type === 'Person' && i.id === assigneePcoId);

        const { error: cardErr } = await supabase.from('pc_workflow_cards').upsert({
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
        
        if (cardErr) console.error(`[SYNC DB ERROR] Failed to upsert card ${card.id}:`, cardErr);
      }

      // CLEANUP ORPHANED CARDS
      console.log(`[SYNC] Cleaning up orphaned cards for Workflow ${wf.id}...`);
      if (activeCardPcoIds.length > 0) {
        const { error: cleanupErr } = await supabase
          .from('pc_workflow_cards')
          .delete()
          .eq('workflow_id', dbWf.id)
          .not('pco_id', 'in', `(${activeCardPcoIds.join(',')})`);
        
        if (cleanupErr) console.error(`[SYNC DB ERROR] Failed to clean up cards:`, cleanupErr);
      } else {
        const { error: cleanupErr } = await supabase
          .from('pc_workflow_cards')
          .delete()
          .eq('workflow_id', dbWf.id);
          
        if (cleanupErr) console.error(`[SYNC DB ERROR] Failed to clean up cards:`, cleanupErr);
      }
    }
    
    console.log('\n[SYNC] Full manual sync completed successfully!');
    res.json({ success: true });
  } catch (error) {
    console.error("\n[SYNC FATAL ERROR] Full sync failed:", error);
    res.status(500).json({ error: error.message });
  }
});