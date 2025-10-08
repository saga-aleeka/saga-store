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
  try {
    const { data: row, error } = await supabase
      .from('backups')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) throw error;
    // The backups table stores the snapshot payload in the `data` column.
    // Return an object with a `data` property so callers that expect `{ data: [...] }` work.
    return { data: row?.data ?? null };
  } catch (err) {
    console.warn('[getLatestBackup] supabase.from("backups") failed, attempting REST fallback:', err instanceof Error ? err.message : err);
    // Fallback: call the Supabase REST endpoint directly with explicit headers
    try {
      const url = `${supabaseUrl}/rest/v1/backups?select=*&order=created_at.desc&limit=1`;
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      });
      const text = await resp.text();
      // If PostgREST returned an error indicating zero rows (PGRST116), treat it as empty result
      if (!resp.ok) {
        try {
          const maybeJson = JSON.parse(text || '{}');
          if (maybeJson && maybeJson.code === 'PGRST116') {
            console.warn('[getLatestBackup] REST fallback returned PGRST116 (no rows) - treating as empty result');
            return { data: null };
          }
        } catch (parseErr) {
          // ignore parse error and fall through to throwing
        }
        console.error('[getLatestBackup] REST fallback failed:', resp.status, resp.statusText, text);
        throw new Error(`REST fallback failed: ${resp.status} ${resp.statusText} ${text}`);
      }
      // The REST endpoint returns an array
      const json = JSON.parse(text || 'null');
      const row = Array.isArray(json) && json.length > 0 ? json[0] : null;
      return { data: row?.data ?? null };
    } catch (fallbackErr) {
      console.error('[getLatestBackup] REST fallback threw:', fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
      throw fallbackErr;
    }
  }
}
