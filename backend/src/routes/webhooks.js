import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { defaultColumnForStep } from '../lib/columnMapping.js';

export const webhooksRouter = Router();

webhooksRouter.post('/pco', async (req, res) => {
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
  const payload = event?.attributes?.payload;

  if (!payload || !eventName?.startsWith('workflow_card.')) {
    return; 
  }

  switch (eventName) {
    case 'workflow_card.created':
    case 'workflow_card.updated':
    case 'workflow_card.completed':
    case 'workflow_card.moved':
      return upsertCardFromPayload(payload);

    case 'workflow_card.deleted':
      return deleteCardFromPayload(payload);

    default:
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
}

async function deleteCardFromPayload(payload) {
  const cardPcoId = payload.data?.id;
  if (!cardPcoId) return;
  const { error } = await supabase.from('pc_workflow_cards').delete().eq('pco_id', cardPcoId);
  if (error) throw error;
}