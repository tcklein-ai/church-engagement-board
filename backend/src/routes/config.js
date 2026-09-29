import express from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

export const configRouter = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware to protect routes and extract the user's PCO token
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

// 1. Get current configuration from Supabase
configRouter.get('/', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from('pc_app_config').select('*').eq('id', 1).single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Save new configuration to Supabase
configRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const { workflow_id, custom_tab_id, connect_1_field_id, connect_2_field_id, connect_3_field_id, connect_4_field_id } = req.body;
    
    const { error } = await supabase
      .from('pc_app_config')
      .update({
        workflow_id,
        custom_tab_id,
        connect_1_field_id,
        connect_2_field_id,
        connect_3_field_id,
        connect_4_field_id,
        updated_at: new Date()
      })
      .eq('id', 1);
      
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. PCO Discovery: Fetch all Workflows
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

// 4. PCO Discovery: Fetch Field Tabs and embedded Field Definitions
configRouter.get('/pco/field-tabs', requireAdmin, async (req, res) => {
  try {
    // We append ?include=field_definitions so PCO sends the fields nested inside the tabs in one query
    const response = await fetch('https://api.planningcenteronline.com/people/v2/field_tabs?include=field_definitions&per_page=100', {
      headers: { Authorization: `Bearer ${req.user.pco_access_token}` }
    });
    const data = await response.json();
    res.json({
      tabs: data.data || [],
      fields: data.included || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch PCO field tabs' });
  }
});