import type { VercelRequest, VercelResponse } from '@vercel/node';

const GMAIL_CLIENT_ID = "1063241264534-20soj16a1sv7u78212f4k3qn4khcbf05.apps.googleusercontent.com";
const GMAIL_CLIENT_SECRET = "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";

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

  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh_token' });
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(400).json({ error: tokenData.error_description || 'Refresh failed' });
    }

    return res.status(200).json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
    });
  } catch (error) {
    console.error('Google refresh error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
