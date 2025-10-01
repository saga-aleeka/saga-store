// pages/api/cron.ts (for Next.js) or api/cron.ts (for Vercel Serverless Functions)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const response = await fetch('https://epsaukgvgadnaeplsgcr.supabase.co/functions/v1/nightly-backup', {
      method: 'POST',
    });
    const text = await response.text();
    res.status(response.status).send(text);
  } catch (error) {
    res.status(500).json({ error: error.message || error.toString() });
  }
}
