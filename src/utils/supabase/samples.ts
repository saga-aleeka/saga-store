
import { supabase } from './client';
import { fetchContainers } from './containers';

export async function fetchSamples() {
  const { data, error } = await supabase.from('samples').select('*');
  if (error) throw error;
  return data;
}


// Upsert sample with uniqueness enforcement for general population

// Upsert sample with correct container_name and uniqueness enforcement
export async function upsertSample(sample: any) {
  // Fetch all containers to determine status
  const containers = await fetchContainers();
  const thisContainer = containers.find((c: any) => c.id === sample.container_id);
  const isArchive = thisContainer?.isArchived || thisContainer?.status === 'archived';
  // Only include fields that exist in the Supabase schema
  const { container_name, storage_date, last_accessed, ...sampleToSave } = sample;
  // Only include status if present
  if ('status' in sample) {
    sampleToSave.status = sample.status;
  }

  // Only enforce uniqueness if not archive
  if (!isArchive) {
    // Find all samples with this sample_id
    const { data: existingSamples, error: fetchError } = await supabase
      .from('samples')
      .select('id, container_id')
      .eq('sample_id', sample.sample_id);
    if (fetchError) throw fetchError;

    // Find if any are in a non-archive container (other than this one)
    for (const s of existingSamples || []) {
      if (s.container_id !== sample.container_id) {
        const otherContainer = containers.find((c: any) => c.id === s.container_id);
        const otherIsArchive = otherContainer?.isArchived || otherContainer?.status === 'archived';
        if (!otherIsArchive) {
          // Move: delete from old, insert into new
          await supabase.from('samples').delete().eq('id', s.id);
        }
      }
    }
  }
  // Upsert the sample (insert or update)
  const { data, error } = await supabase.from('samples').upsert(sampleToSave).select();
  if (error) throw error;
  return data;
}

export async function deleteSample(id: string) {
  const { error } = await supabase.from('samples').delete().eq('id', id);
  if (error) throw error;
}
