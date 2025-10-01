import { supabase } from './client';

// Save a backup (all containers and samples) to Supabase
export async function saveBackup(data: any, createdBy: string) {
  const { error } = await supabase.from('backups').insert({
    data,
    created_by: createdBy,
  });
  if (error) throw error;
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
