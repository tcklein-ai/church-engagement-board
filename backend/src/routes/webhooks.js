import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { defaultColumnForStep } from '../lib/columnMapping.js';

export const webhooksRouter = Router();

// Updated to return the full JSON object to match sync.js
async function fetchPco(endpoint) {
  const authHeader = 'Basic ' + Buffer.from(`${process.env.PCO_APP_ID}:${process.env.PCO_SECRET}`).toString('base64');
  const url = `https://api.planningcenteronline.com/people/v2${endpoint}`;
  try {
    const res = await fetch(url, { headers: { Authorization: authHeader } });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`Error fetching PCO data from ${endpoint}:`, err);
    return null;
  }
}

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
  let rawPayload = event?.attributes?.payload;

  let payload;
  if (typeof rawPayload === 'string') {
    try { payload = JSON.parse(rawPayload); } 
    catch (e) { return; }
  } else { payload = rawPayload; }

  if (!payload) return; 

  switch (eventName) {
    // --- CARD EVENTS ---
    case 'people.v2.events.workflow_card.created':
    case 'people.v2.events.workflow_card.updated':
    case 'people.v2.events.workflow_card.step_ready':
      return upsertCardFromPayload(payload);
    case 'people.v2.events.workflow_card.destroyed':
      return deleteCardFromPayload(payload);
      
    // --- WORKFLOW STRUCTURE EVENTS ---
    case 'people.v2.events.workflow.created':
    case 'people.v2.events.workflow.updated':
      return upsertWorkflowFromPayload(payload);
    case 'people.v2.events.workflow.destroyed':
      return deleteWorkflowFromPayload(payload);
      
    // --- STEP STRUCTURE EVENTS ---
    case 'people.v2.events.workflow_step.created':
    case 'people.v2.events.workflow_step.updated':
      return upsertStepFromPayload(payload);
    case 'people.v2.events.workflow_step.destroyed':
      return deleteStepFromPayload(payload);

    // --- PERSON PROFILE EVENTS ---
    case 'people.v2.events.person.updated':
      return updatePersonFromPayload(payload);
      
    default:
      return;
  }
}

// ---------------------------------------------------------
// CARD HANDLERS
// ---------------------------------------------------------

async function upsertCardFromPayload(payload) {
  let card = payload.data;
  
  // Banish Removed Cards (Early check from webhook payload)
  if (card.attributes?.removed_at) {
    await supabase.from('pc_workflow_cards').delete().eq('pco_id', card.id);
    return;
  }
  
  const workflowPcoId = card.relationships?.workflow?.data?.id;
  if (!workflowPcoId) throw new Error(`Payload missing workflow relationship`);

  // FETCH FRESH CARD TO GUARANTEE COMPLETION STATUS AND AVOID SPARSE PAYLOADS
  const freshRes = await fetchPco(`/workflows/${workflowPcoId}/cards/${card.id}?include=person,assignee`);
  if (freshRes && freshRes.data) {
    card = freshRes.data; // OVERRIDE WEBHOOK PAYLOAD WITH ABSOLUTE TRUTH FROM PCO
  }
  
  // Check again in case it was removed right as the webhook fired
  if (card.attributes?.removed_at) {
    await supabase.from('pc_workflow_cards').delete().eq('pco_id', card.id);
    return;
  }

  const included = freshRes?.included || [];
  const stepPcoId = card.relationships?.current_step?.data?.id ?? card.relationships?.step?.data?.id;
  const personPcoId = card.relationships?.person?.data?.id;
  const assigneePcoId = card.relationships?.assignee?.data?.id;

  let { data: workflow } = await supabase.from('pc_workflow_workflows').select('*').eq('pco_id', workflowPcoId).maybeSingle();
  if (!workflow) {
    const pcoWfRes = await fetchPco(`/workflows/${workflowPcoId}`);
    const { data: newWf, error: wfErr } = await supabase.from('pc_workflow_workflows').insert({
      pco_id: workflowPcoId,
      name: pcoWfRes?.data?.attributes?.name ?? `Workflow ${workflowPcoId}`,
      is_active: true
    }).select().single();
    if (wfErr) throw wfErr;
    workflow = newWf;
  }

  let stepRowId = null;
  let boardColumn = 'new';
  
  if (stepPcoId) {
    let { data: existingStep } = await supabase.from('pc_workflow_steps').select('*').eq('workflow_id', workflow.id).eq('pco_id', stepPcoId).maybeSingle();
    
    if (existingStep) {
      stepRowId = existingStep.id;
      boardColumn = existingStep.board_column;
    } else {
      const pcoStepRes = await fetchPco(`/workflows/${workflowPcoId}/steps/${stepPcoId}`);
      const stepName = pcoStepRes?.data?.attributes?.name ?? `Step ${stepPcoId}`;
      const stepPosition = pcoStepRes?.data?.attributes?.sequence ?? 0;
      boardColumn = defaultColumnForStep({ name: stepName, position: stepPosition });
      
      const { data: newStep, error: stepErr } = await supabase.from('pc_workflow_steps').insert({
        workflow_id: workflow.id,
        pco_id: stepPcoId,
        name: stepName,
        position: stepPosition,
        board_column: boardColumn,
      }).select().single();
      if (stepErr) throw stepErr;
      stepRowId = newStep.id;
    }
  } 
  
  // Enforce completed state
  if (card.attributes?.completed_at) {
    boardColumn = 'completed';
  }

  // Use the included data from the fresh fetch to avoid extra API hits
  const personInc = included.find(i => i.type === 'Person' && i.id === personPcoId);
  let personName = personInc?.attributes?.name;
  let personAvatar = personInc?.attributes?.avatar;
  
  if (!personName && personPcoId) {
    const pcoPersonRes = await fetchPco(`/people/${personPcoId}`);
    if (pcoPersonRes?.data) {
      personName = pcoPersonRes.data.attributes?.name ?? `${pcoPersonRes.data.attributes?.first_name} ${pcoPersonRes.data.attributes?.last_name}`;
      personAvatar = pcoPersonRes.data.attributes?.avatar ?? null;
    } else {
      personName = 'Unknown';
    }
  }

  const assigneeInc = included.find(i => i.type === 'Person' && i.id === assigneePcoId);
  let assigneeName = assigneeInc?.attributes?.name;

  if (!assigneeName && assigneePcoId) {
    const pcoAssigneeRes = await fetchPco(`/people/${assigneePcoId}`);
    if (pcoAssigneeRes?.data) {
      assigneeName = pcoAssigneeRes.data.attributes?.name ?? `${pcoAssigneeRes.data.attributes?.first_name} ${pcoAssigneeRes.data.attributes?.last_name}`;
    }
  }

  const { error: cardErr } = await supabase.from('pc_workflow_cards').upsert({
    pco_id: card.id,
    workflow_id: workflow.id,
    step_id: stepRowId,
    boardColumn: boardColumn, // Fixed naming here previously
    board_column: boardColumn,
    person_pco_id: personPcoId,
    person_name: personName || 'Unknown',
    person_avatar_url: personAvatar || null,
    assignee_pco_id: assigneePcoId,
    assignee_name: assigneeName || null,
    note: card.attributes?.note ?? null,
    snoozed_until: card.attributes?.snooze_until ?? null,
    flagged: card.attributes?.flagged ?? false,
    is_overdue: card.attributes?.overdue ?? false,
    pco_created_at: card.attributes?.created_at ?? null,
    pco_updated_at: card.attributes?.updated_at ?? null,
  }, { onConflict: 'pco_id', ignoreDuplicates: false });
  
  if (cardErr) throw cardErr;
}

async function deleteCardFromPayload(payload) {
  const cardPcoId = payload.data?.id;
  if (!cardPcoId) return;
  await supabase.from('pc_workflow_cards').delete().eq('pco_id', cardPcoId);
}

// ---------------------------------------------------------
// WORKFLOW STRUCTURE HANDLERS
// ---------------------------------------------------------

async function upsertWorkflowFromPayload(payload) {
  const wf = payload.data;
  const { error } = await supabase.from('pc_workflow_workflows').upsert({
    pco_id: wf.id,
    name: wf.attributes?.name ?? `Workflow ${wf.id}`,
    is_active: true
  }, { onConflict: 'pco_id' });
  if (error) throw error;
}

async function deleteWorkflowFromPayload(payload) {
  const wfId = payload.data?.id;
  if (!wfId) return;
  await supabase.from('pc_workflow_workflows').delete().eq('pco_id', wfId);
}

// ---------------------------------------------------------
// STEP STRUCTURE HANDLERS
// ---------------------------------------------------------

async function upsertStepFromPayload(payload) {
  const step = payload.data;
  const workflowPcoId = step.relationships?.workflow?.data?.id;
  if (!workflowPcoId) return;

  const { data: dbWf } = await supabase.from('pc_workflow_workflows').select('id').eq('pco_id', workflowPcoId).maybeSingle();
  if (!dbWf) return; 

  const stepName = step.attributes?.name ?? `Step ${step.id}`;
  const stepPosition = step.attributes?.sequence ?? 0;
  const boardColumn = defaultColumnForStep({ name: stepName, position: stepPosition });

  const { error } = await supabase.from('pc_workflow_steps').upsert({
    workflow_id: dbWf.id,
    pco_id: step.id,
    name: stepName,
    position: stepPosition,
    board_column: boardColumn
  }, { onConflict: 'workflow_id, pco_id' });
  
  if (error) throw error;
}

async function deleteStepFromPayload(payload) {
  const stepId = payload.data?.id;
  if (!stepId) return;
  await supabase.from('pc_workflow_steps').delete().eq('pco_id', stepId);
}

// ---------------------------------------------------------
// PERSON PROFILE HANDLERS
// ---------------------------------------------------------

async function updatePersonFromPayload(payload) {
  const person = payload.data;
  if (!person) return;

  const personPcoId = person.id;
  const personName = person.attributes?.name ?? `${person.attributes?.first_name} ${person.attributes?.last_name}`;
  const personAvatar = person.attributes?.avatar ?? null;

  await supabase
    .from('pc_workflow_cards')
    .update({ person_name: personName, person_avatar_url: personAvatar })
    .eq('person_pco_id', personPcoId);

  await supabase
    .from('pc_workflow_cards')
    .update({ assignee_name: personName })
    .eq('assignee_pco_id', personPcoId);
}