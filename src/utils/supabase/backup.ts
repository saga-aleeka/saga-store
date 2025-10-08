import { supabase } from './client';
import { supabaseUrl, supabaseAnonKey } from './info';
import { API_BASE_URL } from './database';

// Save a backup (all containers and samples) to Supabase
export async function saveBackup(data: any, createdBy: string) {
  try {
    const { error } = await supabase.from('backups').insert({
      data,
      created_by: createdBy,
    });
    if (!error) return;
    // If we get here, supabase returned an error - fall through to server fallback
    console.warn('[saveBackup] Direct insert failed, falling back to server function:', error.message || error);
  } catch (err) {
    console.warn('[saveBackup] Direct insert threw, falling back to server function:', err instanceof Error ? err.message : err);
  }

  // Fallback: call server functions endpoint which uses the service-role key
  try {
    const resp = await fetch(`${API_BASE_URL}/backups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({ data, createdBy })
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => 'no body');
      throw new Error(`Server backup failed: ${resp.status} ${resp.statusText} ${text}`);
    }
    return;
  } catch (err) {
    console.error('[saveBackup] Server backup failed:', err);
    throw err;
  }
}

// Get the latest backup
export async function getLatestBackup() {
  const { data, error } = await supabase
    .from('backups')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}
