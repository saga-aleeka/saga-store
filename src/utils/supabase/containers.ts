import { supabase } from './client';

export async function fetchContainers() {
  const { data, error } = await supabase.from('containers').select('*');
  if (error) throw error;
  return data;
}

export async function upsertContainer(container: any) {
  const { data, error } = await supabase.from('containers').upsert(container).select();
  if (error) throw error;
  return data;
}

export async function deleteContainer(id: string) {
  const { error } = await supabase.from('containers').delete().eq('id', id);
  if (error) throw error;
}
