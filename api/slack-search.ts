import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  const allowedOrigins = ['https://scout-green-three.vercel.app', 'http://localhost:5173'];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, token } = req.body;

  if (!query || !token) {
    return res.status(400).json({ error: 'Missing query or token' });
  }

  try {
    const searchRes = await fetch(
      `https://slack.com/api/search.messages?query=${encodeURIComponent(query)}&count=50`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await searchRes.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Slack search error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
