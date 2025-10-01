// pages/api/cron.ts (for Next.js) or api/cron.ts (for Vercel Serverless Functions)

import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const response = await fetch('https://epsaukgvgadnaeplsgcr.supabase.co/functions/v1/nightly-backup', {
      method: 'POST',
    });
    const text = await response.text();
    res.status(response.status).send(text);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: String(error) });
    }
  }
}
