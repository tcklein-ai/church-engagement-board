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

    const existingRes = await fetch(`https://api.planningcenteronline.com/people/v2/people/${personId}/field_data`, {
      headers: { Authorization: `Bearer ${req.user.pco_access_token}` }
    });
    const existingData = await existingRes.json();
    const existingFields = existingData.data || [];
    
    const existingTargetField = existingFields.find(f => f.relationships?.field_definition?.data?.id === String(targetFieldDefId));

    const today = new Date().toISOString().split('T')[0]; 
    
    let cardStatus = { attempted: false, success: false, error: null };

    if (isChecked) {
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

      const requiredIds = [
        config.connect_1_field_id,
        config.connect_2_field_id,
        config.connect_3_field_id,
        config.connect_4_field_id
      ];

      const otherIds = requiredIds.filter(id => id && String(id) !== String(targetFieldDefId));

      const allOthersCompleted = otherIds.every(id => {
        const f = existingFields.find(ef => ef.relationships?.field_definition?.data?.id === String(id));
        return f && f.attributes && f.attributes.value;
      });

      if (allOthersCompleted && otherIds.length === 3) {
        cardStatus.attempted = true;
        console.log(`Person ${personId} has completed all 4 classes. Locating workflow card...`);
        
        // We keep the filter just in case PCO ever fixes it, but rely on the local .find() for safety
        const cardsRes = await fetch(`https://api.planningcenteronline.com/people/v2/workflows/${config.workflow_id}/cards?where[person_id]=${personId}`, {
          headers: { Authorization: `Bearer ${req.user.pco_access_token}` }
        });
        const cardsData = await cardsRes.json();
        
        // STRICT LOCAL FILTER: Guarantee the card actually belongs to the person we clicked
        const activeCard = (cardsData.data || []).find(c => {
          const cardOwnerId = c.relationships?.person?.data?.id;
          const isOwnerMatch = String(cardOwnerId) === String(personId);
          const isNotCompleted = c.attributes?.stage !== 'completed';
          return isOwnerMatch && isNotCompleted;
        });

        if (activeCard) {
          console.log(`Found active card ${activeCard.id} belonging to person ${personId}. Initiating promotion loop...`);
          
          let isCompleted = false;
          let attempts = 0;
          const maxAttempts = 10; 

          while (!isCompleted && attempts < maxAttempts) {
            attempts++;
            
            const promoteRes = await fetch(`https://api.planningcenteronline.com/people/v2/people/${personId}/workflow_cards/${activeCard.id}/promote`, {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${req.user.pco_access_token}`,
                'Content-Length': '0'
              }
            });

            if (!promoteRes.ok) {
              cardStatus.error = await promoteRes.text();
              console.error(`[PROMOTE FAILED] PCO rejected the promote command:`, cardStatus.error);
              break; 
            }

            const checkRes = await fetch(`https://api.planningcenteronline.com/people/v2/workflows/${config.workflow_id}/cards/${activeCard.id}`, {
              headers: { Authorization: `Bearer ${req.user.pco_access_token}` }
            });

            if (!checkRes.ok) {
              isCompleted = true;
              cardStatus.success = true;
              break;
            }

            const checkData = await checkRes.json();
            const currentStage = checkData.data?.attributes?.stage;

            if (currentStage === 'completed' || currentStage === 'removed') {
              isCompleted = true;
              cardStatus.success = true;
              console.log(`Successfully completed workflow card ${activeCard.id} for person ${personId} after ${attempts} promotion(s).`);
            }
          }

          if (!isCompleted && attempts >= maxAttempts) {
             console.log(`Max promotion attempts reached for card ${activeCard.id} without completion.`);
             cardStatus.error = "Max promotion attempts reached.";
          }

        } else {
          cardStatus.success = true; 
        }
      }

    } else {
      if (existingTargetField) {
         await fetch(`https://api.planningcenteronline.com/people/v2/field_data/${existingTargetField.id}`, {
           method: 'DELETE',
           headers: { Authorization: `Bearer ${req.user.pco_access_token}` }
         });
      }
    }

    res.json({ success: true, cardStatus });
  } catch (err) {
    console.error('Error marking attendance:', err);
    res.status(500).json({ error: 'Failed to update attendance' });
  }
});