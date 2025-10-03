import { supabase } from './client';


// Map Supabase DB fields to frontend fields
function mapContainerFromDb(db: any) {
  return {
    id: db.id,
    name: db.name,
    containerType: db.type, // e.g. 'box_9x9'
    sampleType: db.sample_type, // e.g. 'cfDNA Tubes'
    status: db.status, // 'active' | 'inactive'
    location: db.location_freezer, // storage rack name
    occupiedSlots: db.occupied_slots ?? 0,
    totalSlots: db.total_slots ?? 0,
    lastUpdated: db.last_updated,
    temperature: db.temperature,
    isTraining: db.is_training,
    isArchived: db.status === 'inactive' || db.is_archived,
    history: db.history,
    // add any other fields as needed
  };
}

export async function fetchContainers() {
  const { data, error } = await supabase.from('containers').select('*');
  if (error) throw error;
  return (data || []).map(mapContainerFromDb);
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
