import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { defaultColumnForStep } from '../lib/columnMapping.js';

export const webhooksRouter = Router();

webhooksRouter.post('/pco', async (req, res) => {
  // 1. Immediately return 200 OK so PCO doesn't timeout
  res.status(200).send('ok');

  const events = req.body?.data ?? [];

  for (const event of events) {
    try {
      await handlePcoEvent(event);
    } catch (err) {
      console.error(`Failed to process PCO event ${event?.id}:`, err);
    }
  }
});

async function handlePcoEvent(event) {
  const eventName = event?.attributes?.name;
  let rawPayload = event?.attributes?.payload;

  // 2. Parse the payload if PCO sent it as a string
  let payload;
  if (typeof rawPayload === 'string') {
    try {
      payload = JSON.parse(rawPayload);
    } catch (e) {
      console.error(`Error parsing JSON payload for ${eventName}:`, e);
      return;
    }
  } else {
    payload = rawPayload;
  }

  // 3. Fix the filter to look for 'workflow_card' anywhere in the string
  if (!payload || !eventName?.includes('workflow_card')) {
    return; 
  }

  console.log(`Incoming PCO Webhook: ${eventName}`);

  // 4. Use the exact event names PCO actually sends
  switch (eventName) {
    case 'people.v2.events.workflow_card.created':
    case 'people.v2.events.workflow_card.updated':
    case 'people.v2.events.workflow_card.step_ready':
      return upsertCardFromPayload(payload);

    case 'people.v2.events.workflow_card.destroyed':
      return deleteCardFromPayload(payload);

    default:
      console.log(`Unhandled card event type: ${eventName}`);
      return;
  }
}

async function upsertCardFromPayload(payload) {
  const card = payload.data;
  const included = payload.included ?? [];

  const workflowPcoId = card.relationships?.workflow?.data?.id;
  const stepPcoId = card.relationships?.current_step?.data?.id ?? card.relationships?.step?.data?.id;
  const personIncluded = included.find((i) => i.type === 'Person');
  const stepIncluded = included.find((i) => i.type === 'WorkflowStep' && i.id === stepPcoId);
  const assigneeIncluded = included.find((i) => i.type === 'Person' && i.id === card.relationships?.assignee?.data?.id);

  if (!workflowPcoId) {
    throw new Error(`workflow_card ${card.id} payload missing workflow relationship`);
  }

  const workflowIncluded = included.find((i) => i.type === 'Workflow' && i.id === workflowPcoId);
  
  const { data: workflow, error: workflowErr } = await supabase
    .from('pc_workflow_workflows')
    .upsert(
      {
        pco_id: workflowPcoId,
        name: workflowIncluded?.attributes?.name ?? `Workflow ${workflowPcoId}`,
        is_active: true // Ensure active status is set
      },
      { onConflict: 'pco_id', ignoreDuplicates: false }
    )
    .select()
    .single();
    
  if (workflowErr) throw workflowErr;

  let stepRowId = null;
  let boardColumn = 'new';

  if (stepPcoId) {
    const { data: existingStep } = await supabase
      .from('pc_workflow_steps')
      .select('*')
      .eq('workflow_id', workflow.id)
      .eq('pco_id', stepPcoId)
      .maybeSingle();

    if (existingStep) {
      stepRowId = existingStep.id;
      boardColumn = existingStep.board_column;
    } else {
      const stepName = stepIncluded?.attributes?.name ?? `Step ${stepPcoId}`;
      const stepPosition = stepIncluded?.attributes?.sequence ?? 0;
      boardColumn = defaultColumnForStep({ name: stepName, position: stepPosition });

      const { data: newStep, error: stepErr } = await supabase
        .from('pc_workflow_steps')
        .insert({
          workflow_id: workflow.id,
          pco_id: stepPcoId,
          name: stepName,
          position: stepPosition,
          board_column: boardColumn,
        })
        .select()
        .single();
      if (stepErr) throw stepErr;
      stepRowId = newStep.id;
    }
  }

  if (!stepPcoId && card.attributes?.completed_at) {
    boardColumn = 'completed';
  }

  const { error: cardErr } = await supabase.from('pc_workflow_cards').upsert(
    {
      pco_id: card.id,
      workflow_id: workflow.id,
      step_id: stepRowId,
      board_column: boardColumn,
      person_name: personIncluded?.attributes?.name ?? 'Unknown',
      person_avatar_url: personIncluded?.attributes?.avatar ?? null,
      assignee_name: assigneeIncluded?.attributes?.name ?? null,
      note: card.attributes?.note ?? null,
      snoozed_until: card.attributes?.snooze_until ?? null,
      flagged: card.attributes?.flagged ?? false,
      pco_created_at: card.attributes?.created_at ?? null,
      pco_updated_at: card.attributes?.updated_at ?? null,
    },
    { onConflict: 'pco_id', ignoreDuplicates: false }
  );
  if (cardErr) throw cardErr;
  
  console.log(`Successfully wrote card ${card.id} to Supabase.`);
}

async function deleteCardFromPayload(payload) {
  const cardPcoId = payload.data?.id;
  if (!cardPcoId) return;
  const { error } = await supabase.from('pc_workflow_cards').delete().eq('pco_id', cardPcoId);
  if (error) throw error;
  console.log(`Successfully deleted card ${cardPcoId} from Supabase.`);
}