import { supabase } from './client';


// Map between DB and frontend containerType values
const dbToFrontendType: Record<string, string> = {
  'box_9x9': '9x9-box',
  'box_5x5': '5x5-box',
  'rack_5x4': '5x4-rack',
  'rack_9x9': '9x9-rack',
  'rack_7x14': '7x14-rack',
};
const frontendToDbType: Record<string, string> = {
  '9x9-box': 'box_9x9',
  '5x5-box': 'box_5x5',
  '5x4-rack': 'rack_5x4',
  '9x9-rack': 'rack_9x9',
  '7x14-rack': 'rack_7x14',
};

function mapContainerFromDb(db: any) {
  return {
    id: db.id,
    name: db.name,
    containerType: dbToFrontendType[db.type] || db.type, // map DB to frontend
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
  console.log('[fetchContainers] Raw data from Supabase:', data);
  return (data || []).map(mapContainerFromDb);
}


// Map frontend fields to DB fields for upsert
function mapContainerToDb(container: any) {
  return {
    id: container.id,
    name: container.name,
    type: frontendToDbType[container.containerType] || container.containerType, // map frontend to DB
    sample_type: container.sampleType, // e.g. 'cfDNA Tubes'
    status: container.status,
    location_freezer: container.location,
    occupied_slots: container.occupiedSlots,
    total_slots: container.totalSlots,
    last_updated: container.lastUpdated,
    temperature: container.temperature,
    is_training: container.isTraining,
    is_archived: container.isArchived,
    history: container.history,
    // add any other fields as needed
  };
}

export async function upsertContainer(container: any) {
  const dbContainer = mapContainerToDb(container);
  const { data, error } = await supabase.from('containers').upsert(dbContainer).select();
  if (error) throw error;
  return data;
}

export async function deleteContainer(id: string) {
  const { error } = await supabase.from('containers').delete().eq('id', id);
  if (error) throw error;
}
