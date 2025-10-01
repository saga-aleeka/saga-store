import { supabase } from './client';

export async function fetchSamples() {
  const { data, error } = await supabase.from('samples').select('*');
  if (error) throw error;
  return data;
}

export async function upsertSample(sample: any) {
  const { data, error } = await supabase.from('samples').upsert(sample).select();
  if (error) throw error;
  return data;
}

export async function deleteSample(id: string) {
  const { error } = await supabase.from('samples').delete().eq('id', id);
  if (error) throw error;
}
