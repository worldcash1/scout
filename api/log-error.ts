import type { VercelRequest, VercelResponse } from '@vercel/node';

// Discord webhook for #scout-app channel
const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1467148500973273118/placeholder";

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

  const { message, stack, url, userAgent, timestamp } = req.body;

  try {
    // Log to Vercel console (visible in dashboard)
    console.error('[Scout Error]', { message, stack, url, timestamp });

    // Send to Discord (optional - uncomment when webhook is set)
    /*
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `🚨 **Scout Error**\n\`\`\`${message}\`\`\`\n**URL:** ${url}\n**Time:** ${timestamp}`,
      }),
    });
    */

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Failed to log error:', error);
    return res.status(500).json({ error: 'Failed to log' });
  }
}
