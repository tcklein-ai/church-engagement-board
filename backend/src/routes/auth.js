import express from 'express';
import jwt from 'jsonwebtoken';

export const authRouter = express.Router();

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
    // 1. Exchange the code for the user's unique access token
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

    if (!tokenResponse.ok) {
      console.error('PCO Token Error:', tokenData);
      return res.status(500).send('Failed to authenticate with Planning Center');
    }

    // 2. Fetch the user's profile to verify their identity
    const userResponse = await fetch('https://api.planningcenteronline.com/people/v2/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    
    const userData = await userResponse.json();
    const user = userData.data;

    // 3. Create our own secure JWT token holding their PCO access_token
    const sessionToken = jwt.sign(
      { 
        id: user.id, 
        name: user.attributes.name, 
        avatar: user.attributes.avatar,
        pco_access_token: tokenData.access_token 
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' } // PCO tokens expire in 2 hours
    );

    // 4. Drop it into an HTTP-only cookie
    res.cookie('pco_auth', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000 
    });

    // 5. Send them back to the frontend attendance page
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

// The frontend will hit this route to check if someone is logged in
authRouter.get('/me', (req, res) => {
  const token = req.cookies.pco_auth;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Send the name and avatar for the UI, but NEVER send the API token itself
    res.json({ id: decoded.id, name: decoded.name, avatar: decoded.avatar });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
});