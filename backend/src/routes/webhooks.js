import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { defaultColumnForStep } from '../lib/columnMapping.js';

export const webhooksRouter = Router();

// Helper function to fetch data directly from PCO API
async function fetchPco(endpoint) {
  const authHeader = 'Basic ' + Buffer.from(`${process.env.PCO_APP_ID}:${process.env.PCO_SECRET}`).toString('base64');
  const url = `https://api.planningcenteronline.com/people/v2${endpoint}`;
  try {
    const res = await fetch(url, { headers: { Authorization: authHeader } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
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

  if (!payload || !eventName?.includes('workflow_card')) return; 

  switch (eventName) {
    case 'people.v2.events.workflow_card.created':
    case 'people.v2.events.workflow_card.updated':
    case 'people.v2.events.workflow_card.step_ready':
      return upsertCardFromPayload(payload);
    case 'people.v2.events.workflow_card.destroyed':
      return deleteCardFromPayload(payload);
    default:
      return;
  }
}

async function upsertCardFromPayload(payload) {
  const card = payload.data;
  
  // Extract IDs from PCO's relationship payload
  const workflowPcoId = card.relationships?.workflow?.data?.id;
  const stepPcoId = card.relationships?.current_step?.data?.id ?? card.relationships?.step?.data?.id;
  const personPcoId = card.relationships?.person?.data?.id;
  const assigneePcoId = card.relationships?.assignee?.data?.id;

  if (!workflowPcoId) throw new Error(`Payload missing workflow relationship`);

  // JIT SYNC: Find Workflow or fetch from PCO if missing
  let { data: workflow } = await supabase.from('pc_workflow_workflows').select('*').eq('pco_id', workflowPcoId).maybeSingle();
  if (!workflow) {
    const pcoWf = await fetchPco(`/workflows/${workflowPcoId}`);
    const { data: newWf, error: wfErr } = await supabase.from('pc_workflow_workflows').insert({
      pco_id: workflowPcoId,
      name: pcoWf?.attributes?.name ?? `Workflow ${workflowPcoId}`,
      is_active: true
    }).select().single();
    if (wfErr) throw wfErr;
    workflow = newWf;
  }

  // JIT SYNC: Find Step or fetch from PCO if missing
  let stepRowId = null;
  let boardColumn = 'new';
  if (stepPcoId) {
    let { data: existingStep } = await supabase.from('pc_workflow_steps').select('*').eq('workflow_id', workflow.id).eq('pco_id', stepPcoId).maybeSingle();
    
    if (existingStep) {
      stepRowId = existingStep.id;
      boardColumn = existingStep.board_column;
    } else {
      const pcoStep = await fetchPco(`/workflows/${workflowPcoId}/steps/${stepPcoId}`);
      const stepName = pcoStep?.attributes?.name ?? `Step ${stepPcoId}`;
      const stepPosition = pcoStep?.attributes?.sequence ?? 0;
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
  } else if (card.attributes?.completed_at) {
    boardColumn = 'completed';
  }

  // JIT SYNC: Fetch real Person Name
  let personName = 'Unknown';
  let personAvatar = null;
  if (personPcoId) {
    const pcoPerson = await fetchPco(`/people/${personPcoId}`);
    if (pcoPerson) {
      personName = pcoPerson.attributes?.name ?? `${pcoPerson.attributes?.first_name} ${pcoPerson.attributes?.last_name}`;
      personAvatar = pcoPerson.attributes?.avatar ?? null;
    }
  }

  // JIT SYNC: Fetch real Assignee Name
  let assigneeName = null;
  if (assigneePcoId) {
    const pcoAssignee = await fetchPco(`/people/${assigneePcoId}`);
    if (pcoAssignee) {
      assigneeName = pcoAssignee.attributes?.name ?? `${pcoAssignee.attributes?.first_name} ${pcoAssignee.attributes?.last_name}`;
    }
  }

  // Insert the Card with actual data
  const { error: cardErr } = await supabase.from('pc_workflow_cards').upsert({
    pco_id: card.id,
    workflow_id: workflow.id,
    step_id: stepRowId,
    board_column: boardColumn,
    person_name: personName,
    person_avatar_url: personAvatar,
    assignee_name: assigneeName,
    note: card.attributes?.note ?? null,
    snoozed_until: card.attributes?.snooze_until ?? null,
    flagged: card.attributes?.flagged ?? false,
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