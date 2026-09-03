import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PCO_BASE_URL = 'https://api.planningcenteronline.com/people/v2';
const authHeader = 'Basic ' + Buffer.from(`${process.env.PCO_APP_ID}:${process.env.PCO_SECRET}`).toString('base64');

async function syncPCO() {
  console.log('Fetching workflows from Planning Center...');
  
  try {
    const wfRes = await fetch(`${PCO_BASE_URL}/workflows`, { headers: { Authorization: authHeader } });
    if (!wfRes.ok) throw new Error(`PCO API Error: ${wfRes.status}`);
    const wfData = await wfRes.json();

    for (const wf of wfData.data) {
      console.log(`Saving Workflow: ${wf.attributes.name}`);
      
      const { data: dbWf, error: wfError } = await supabase
        .from('pc_workflow_workflows')
        .upsert({
          pco_id: wf.id,
          name: wf.attributes.name,
          is_active: true
        }, { onConflict: 'pco_id' })
        .select()
        .single();

      if (wfError) {
        console.error('Database error on workflow:', wfError.message);
        continue;
      }

      const stepsRes = await fetch(`${PCO_BASE_URL}/workflows/${wf.id}/steps`, { headers: { Authorization: authHeader } });
      const stepsData = await stepsRes.json();

      for (const step of stepsData.data) {
        console.log(`  -> Saving Step: ${step.attributes.name}`);
        const { error: stepError } = await supabase
          .from('pc_workflow_steps')
          .upsert({
            workflow_id: dbWf.id,
            pco_id: step.id,
            name: step.attributes.name,
            position: step.attributes.sequence || 0
          }, { onConflict: 'workflow_id, pco_id' });

        if (stepError) console.error('Database error on step:', stepError.message);
      }
    }
    console.log('Sync complete! Your database is ready.');
  } catch (error) {
    console.error('Sync failed:', error.message);
  }
}

syncPCO();