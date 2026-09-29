import express from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

export const authRouter = express.Router();

// Initialize Supabase client for database checks
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PCO_AUTH_URL = 'https://api.planningcenteronline.com/oauth/authorize';
const PCO_TOKEN_URL = 'https://api.planningcenteronline.com/oauth/token';

authRouter.get('/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.PCO_CLIENT_ID,
    redirect_uri: process.env.PCO_REDIRECT_URI,
    response_type: 'code',
    scope: 'people'
  });
  res.redirect(`${PCO_AUTH_URL}?${params.toString()}`);
});

authRouter.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No authorization code provided');

  try {
    // 1. Exchange the code for the user's access token
    const tokenResponse = await fetch(PCO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.PCO_CLIENT_ID,
        client_secret: process.env.PCO_CLIENT_SECRET,
        redirect_uri: process.env.PCO_REDIRECT_URI
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) return res.status(500).send('Failed to authenticate with Planning Center');

    // 2. Fetch the user's profile AND their emails
    const userResponse = await fetch('https://api.planningcenteronline.com/people/v2/me?include=emails', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    
    const userData = await userResponse.json();
    const user = userData.data;
    
    // 3. Extract the primary email from the included data
    const emails = userData.included?.filter(inc => inc.type === 'Email') || [];
    const primaryEmailObj = emails.find(e => e.attributes.primary) || emails[0];
    const userEmail = primaryEmailObj ? primaryEmailObj.attributes.address : null;

    // Grab their exact Planning Center permission level
    const pcoPermission = user.attributes.people_permissions || 'None';

    // 4. Verify Super Admin status or check Supabase for delegated admins
    let isAppAdmin = userEmail && userEmail.toLowerCase() === process.env.SUPER_ADMIN_EMAIL?.toLowerCase();

    if (!isAppAdmin && userEmail) {
      const { data: adminRecord } = await supabase
        .from('pc_app_admins')
        .select('email')
        .eq('email', userEmail)
        .single();
      
      if (adminRecord) isAppAdmin = true;
    }

    // 5. Create our secure JWT token with the new credentials
    const sessionToken = jwt.sign(
      { 
        id: user.id, 
        name: user.attributes.name, 
        avatar: user.attributes.avatar,
        email: userEmail,
        isAppAdmin: isAppAdmin,
        pcoPermission: pcoPermission,
        pco_access_token: tokenData.access_token 
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.cookie('pco_auth', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000 
    });

    res.redirect(`${process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}/attendance`);

  } catch (err) {
    console.error('Auth Callback Error:', err);
    res.status(500).send('Internal Server Error during authentication');
  }
});

authRouter.get('/logout', (req, res) => {
  res.clearCookie('pco_auth');
  res.redirect(process.env.FRONTEND_ORIGIN || 'http://localhost:5173');
});

authRouter.get('/me', (req, res) => {
  const token = req.cookies.pco_auth;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ 
      id: decoded.id, 
      name: decoded.name, 
      avatar: decoded.avatar,
      email: decoded.email,
      isAppAdmin: decoded.isAppAdmin,
      pcoPermission: decoded.pcoPermission
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
});