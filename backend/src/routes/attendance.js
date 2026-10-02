import express from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

export const attendanceRouter = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware to ensure they are authenticated and authorized
const requireAdmin = (req, res, next) => {
  const token = req.cookies.pco_auth;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isAppAdmin) return res.status(403).json({ error: 'Access denied. App Admin required.' });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid session' });
  }
};

// GET: Fetch all attendees in the workflow and their field statuses
attendanceRouter.get('/', requireAdmin, async (req, res) => {
  try {
    const { data: config, error } = await supabase.from('pc_app_config').select('*').eq('id', 1).single();
    
    if (error || !config.workflow_id) {
      return res.json({ attendees: [] });
    }

    // 1. Get everyone in the workflow
    const cardsRes = await fetch(`https://api.planningcenteronline.com/people/v2/workflows/${config.workflow_id}/cards?include=person&per_page=100`, {
      headers: { Authorization: `Bearer ${req.user.pco_access_token}` }
    });
    const cardsData = await cardsRes.json();
    
    const people = (cardsData.included || []).filter(inc => inc.type === 'Person');

    // 2. Fetch the custom field data for each person
    const attendees = await Promise.all(people.map(async (person) => {
      const fieldDataRes = await fetch(`https://api.planningcenteronline.com/people/v2/people/${person.id}/field_data`, {
        headers: { Authorization: `Bearer ${req.user.pco_access_token}` }
      });
      const fieldData = await fieldDataRes.json();
      const fields = fieldData.data || [];

      // Helper to determine if a field has been filled out
      const hasValue = (fieldId) => {
        if (!fieldId) return false;
        const field = fields.find(f => f.relationships?.field_definition?.data?.id === String(fieldId));
        return field && field.attributes && field.attributes.value ? true : false;
      };

      return {
        id: person.id,
        name: person.attributes.name,
        avatar: person.attributes.avatar,
        connect1: hasValue(config.connect_1_field_id),
        connect2: hasValue(config.connect_2_field_id),
        connect3: hasValue(config.connect_3_field_id),
        connect4: hasValue(config.connect_4_field_id),
      };
    }));

    res.json({ attendees });
  } catch (err) {
    console.error('Attendance fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance data' });
  }
});

// POST: Write a checkbox interaction back to Planning Center and Auto-Complete
attendanceRouter.post('/mark', requireAdmin, async (req, res) => {
  try {
    const { personId, classNumber, isChecked } = req.body;
    
    const { data: config } = await supabase.from('pc_app_config').select('*').eq('id', 1).single();
    const targetFieldDefId = config[`connect_${classNumber}_field_id`];

    if (!targetFieldDefId) return res.status(400).json({ error: 'Custom field not configured' });

    // See if the field already exists for this person, and grab all their other fields simultaneously
    const existingRes = await fetch(`https://api.planningcenteronline.com/people/v2/people/${personId}/field_data`, {
      headers: { Authorization: `Bearer ${req.user.pco_access_token}` }
    });
    const existingData = await existingRes.json();
    const existingFields = existingData.data || [];
    
    const existingTargetField = existingFields.find(f => f.relationships?.field_definition?.data?.id === String(targetFieldDefId));

    const today = new Date().toISOString().split('T')[0]; // Clean YYYY-MM-DD format

    if (isChecked) {
      // 1. Update or Create the specific Connect Class field
      if (existingTargetField) {
        await fetch(`https://api.planningcenteronline.com/people/v2/field_data/${existingTargetField.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${req.user.pco_access_token}` },
          body: JSON.stringify({ data: { type: "FieldData", attributes: { value: today } } })
        });
      } else {
        await fetch(`https://api.planningcenteronline.com/people/v2/people/${personId}/field_data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${req.user.pco_access_token}` },
          body: JSON.stringify({
            data: { type: "FieldData", attributes: { value: today, field_definition_id: targetFieldDefId } }
          })
        });
      }

      // 2. THE AUTO-COMPLETE LOGIC
      const requiredIds = [
        config.connect_1_field_id,
        config.connect_2_field_id,
        config.connect_3_field_id,
        config.connect_4_field_id
      ];

      // Filter out the class we JUST checked, so we are only looking at the other 3
      const otherIds = requiredIds.filter(id => id && String(id) !== String(targetFieldDefId));

      // Verify that every single one of those other 3 fields has a value in PCO
      const allOthersCompleted = otherIds.every(id => {
        const f = existingFields.find(ef => ef.relationships?.field_definition?.data?.id === String(id));
        return f && f.attributes && f.attributes.value;
      });

      if (allOthersCompleted && otherIds.length === 3) {
        console.log(`Person ${personId} has completed all 4 classes. Locating workflow card...`);
        
        // Find their specific card in the Connect Track workflow
        const cardsRes = await fetch(`https://api.planningcenteronline.com/people/v2/workflows/${config.workflow_id}/cards?where[person_id]=${personId}`, {
          headers: { Authorization: `Bearer ${req.user.pco_access_token}` }
        });
        const cardsData = await cardsRes.json();
        
        const activeCard = (cardsData.data || []).find(c => c.attributes.stage !== 'completed');

        if (activeCard) {
          // Remove the card from its current step to trigger PCO's auto-completion
          const completeRes = await fetch(`https://api.planningcenteronline.com/people/v2/workflows/${config.workflow_id}/cards/${activeCard.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${req.user.pco_access_token}` },
            body: JSON.stringify({
              data: {
                type: "WorkflowCard",
                attributes: { step_id: null }
              }
            })
          });
          
          if (!completeRes.ok) {
            const errText = await completeRes.text();
            console.error(`PCO rejected the completion command for card ${activeCard.id}:`, errText);
          } else {
            console.log(`Successfully completed workflow card ${activeCard.id} for person ${personId}`);
          }
        }
      }

    } else {
      // If unchecked, delete the field data entirely
      if (existingTargetField) {
         await fetch(`https://api.planningcenteronline.com/people/v2/field_data/${existingTargetField.id}`, {
           method: 'DELETE',
           headers: { Authorization: `Bearer ${req.user.pco_access_token}` }
         });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking attendance:', err);
    res.status(500).json({ error: 'Failed to update attendance' });
  }
});