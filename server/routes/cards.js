import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

export const cardsRouter = Router();

cardsRouter.post('/:id/move', async (req, res) => {
  const { id } = req.params; 
  const { targetStepPcoId, targetBoardColumn } = req.body ?? {};

  if (!targetStepPcoId || !targetBoardColumn) {
    return res.status(400).json({ error: 'targetStepPcoId and targetBoardColumn are required' });
  }

  // Fetch the card and join the parent workflow table to get the workflow's PCO ID
  const { data: card, error: fetchErr } = await supabase
    .from('pc_workflow_cards')
    .select('*, pc_workflow_workflows(pco_id)')
    .eq('id', id)
    .single();
    
  if (fetchErr || !card) {
    return res.status(404).json({ error: 'Card not found in database' });
  }

  // Extract the parent workflow ID securely
  const workflowPcoId = card.pc_workflow_workflows?.pco_id;

  try {
    await movePcoWorkflowCard({
      workflowPcoId,
      cardPcoId: card.pco_id,
      targetStepPcoId,
    });
  } catch (err) {
    console.error('PCO move failed:', err);
    return res.status(502).json({ error: 'Failed to update Planning Center' });
  }

  const { data: targetStep } = await supabase
    .from('pc_workflow_steps')
    .select('id')
    .eq('workflow_id', card.workflow_id)
    .eq('pco_id', targetStepPcoId)
    .maybeSingle();

  const { error: updateErr } = await supabase
    .from('pc_workflow_cards')
    .update({
      step_id: targetStep?.id ?? null,
      board_column: targetBoardColumn,
    })
    .eq('id', id);
    
  if (updateErr) {
    console.error('Optimistic Supabase update failed:', updateErr);
  }

  res.json({ ok: true });
});

async function movePcoWorkflowCard({ workflowPcoId, cardPcoId, targetStepPcoId }) {
  const appId = process.env.PCO_APP_ID;
  const secret = process.env.PCO_SECRET;

  if (!workflowPcoId) {
    throw new Error('Missing workflowPcoId. Cannot build PCO URL.');
  }

  // The correct nested URL structure required by Planning Center
  const url = `https://api.planningcenteronline.com/people/v2/workflows/${workflowPcoId}/cards/${cardPcoId}`;
  console.log(`Sending PATCH to: ${url}`);
  console.log(`Targeting Step ID: ${targetStepPcoId}`);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${appId}:${secret}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        type: "WorkflowCard",
        id: String(cardPcoId),
        relationships: {
          step: {
            data: { 
              type: "Step", 
              id: String(targetStepPcoId) 
            }
          }
        }
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PCO API ${response.status}: ${text}`);
  }
}