import type { VercelRequest, VercelResponse } from '@vercel/node';

const SLACK_CLIENT_ID = "10398366226727.10442113554736";
const SLACK_CLIENT_SECRET = "e634eb8ae400f133bae91e568930976d";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, redirect_uri } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Missing code' });
  }

  try {
    // Exchange code for token
    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        redirect_uri: redirect_uri || '',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.ok) {
      return res.status(400).json({ error: tokenData.error, details: tokenData });
    }

    const userToken = tokenData.authed_user?.access_token;
    if (!userToken) {
      return res.status(400).json({ error: 'No user token received' });
    }

    // Get user identity
    const userRes = await fetch('https://slack.com/api/users.identity', {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    const userData = await userRes.json();

    return res.status(200).json({
      ok: true,
      access_token: userToken,
      user: userData.user,
      team: userData.team,
    });
  } catch (error) {
    console.error('Slack OAuth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
