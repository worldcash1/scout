import type { VercelRequest, VercelResponse } from '@vercel/node';

const DROPBOX_CLIENT_ID = "3b2bjbmi8dml44w";
const DROPBOX_CLIENT_SECRET = "u4l4im2y3i3i1v4";

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirect_uri || '',
        client_id: DROPBOX_CLIENT_ID,
        client_secret: DROPBOX_CLIENT_SECRET,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(400).json({ error: tokenData.error_description || 'Auth failed' });
    }

    // Get user info
    const userRes = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      body: null,
    });

    if (!userRes.ok) {
      const errData = await userRes.json().catch(() => ({}));
      return res.status(400).json({ error: errData.error_summary || 'Failed to get user info' });
    }

    const user = await userRes.json();

    return res.status(200).json({
      access_token: tokenData.access_token,
      email: user.email,
    });
  } catch (error) {
    console.error('Dropbox OAuth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
