
import { serve } from '@hono/node-server';
import { createClient } from '@supabase/supabase-js';

// Environment variables set in Node.js
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function nightlyBackup() {
  // Fetch all containers
  const { data: containers, error: containersError } = await supabase
    .from('containers')
    .select('*');
  if (containersError) throw containersError;

  // Fetch all samples
  const { data: samples, error: samplesError } = await supabase
    .from('samples')
    .select('*');
  if (samplesError) throw samplesError;

  // Compose backup object
  const backupData = {
    containers,
    samples,
    timestamp: new Date().toISOString(),
  };

  // Insert backup into backups table
  const { error: backupError } = await supabase
    .from('backups')
    .insert([{ data: backupData, created_at: new Date().toISOString() }]);
  if (backupError) throw backupError;

  // Delete backups older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from('backups')
    .delete()
    .lt('created_at', sevenDaysAgo);
}

// Simple HTTP server for Node.js
const port = process.env.PORT || 3001;
serve({
  fetch: async (req) => {
    try {
      await nightlyBackup();
      return new Response('Nightly backup completed', { status: 200 });
    } catch (e: any) {
      return new Response(`Backup failed: ${e.message || e}`, { status: 500 });
    }
  },
  port: Number(port),
});
console.log(`Nightly backup server running on http://localhost:${port}`);
