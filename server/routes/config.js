import express from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

export const configRouter = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

configRouter.get('/', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from('pc_app_config').select('*').eq('id', 1).single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

configRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const { 
      workflow_id, 
      connect_1_field_id, 
      connect_2_field_id, 
      connect_3_field_id, 
      connect_4_field_id,
      connect_5_field_id,
      connect_6_field_id,
      connect_7_field_id,
      connect_8_field_id
    } = req.body;
    
    const { error } = await supabase
      .from('pc_app_config')
      .update({
        workflow_id,
        connect_1_field_id,
        connect_2_field_id,
        connect_3_field_id,
        connect_4_field_id,
        connect_5_field_id,
        connect_6_field_id,
        connect_7_field_id,
        connect_8_field_id,
        updated_at: new Date()
      })
      .eq('id', 1);
      
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

configRouter.get('/pco/workflows', requireAdmin, async (req, res) => {
  try {
    const response = await fetch('https://api.planningcenteronline.com/people/v2/workflows?per_page=100', {
      headers: { Authorization: `Bearer ${req.user.pco_access_token}` }
    });
    const data = await response.json();
    res.json(data.data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch PCO workflows' });
  }
});

// UPGRADED: Fetch all custom fields directly, bypassing the need for tabs
configRouter.get('/pco/field-definitions', requireAdmin, async (req, res) => {
  try {
    const response = await fetch('https://api.planningcenteronline.com/people/v2/field_definitions?per_page=100', {
      headers: { Authorization: `Bearer ${req.user.pco_access_token}` }
    });
    const data = await response.json();
    res.json(data.data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch PCO field definitions' });
  }
});