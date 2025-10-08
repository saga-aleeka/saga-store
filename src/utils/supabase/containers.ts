// Helper to get current user context from localStorage or default
function getCurrentUserContext() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { id: 'system', name: 'System' };
  }
  try {
    const storedInfo = localStorage.getItem('saga-user-info');
    if (storedInfo) {
      const parsed = JSON.parse(storedInfo);
      if (parsed && typeof parsed === 'object') {
        const id = parsed.id || parsed.initials || 'anonymous';
        const name = parsed.name || parsed.fullName || parsed.initials || id;
        return { id, name };
      }
    }
  } catch (error) {
    // ignore
  }
  return { id: 'anonymous', name: 'Anonymous User' };
}
const totalSlotToDbType: Record<number, string> = {
  81: 'box_9x9',
  25: 'box_5x5',
  20: 'rack_5x4',
  63: 'rack_7x14',
};

function resolveDbType(container: any): string | undefined {
  const rawType = container?.containerType ?? container?.type;
  if (typeof rawType === 'string' && rawType) {
    return frontendToDbType[rawType] || rawType;
  }

  const totalSlots = Number(container?.totalSlots ?? container?.total_slots);
  if (!Number.isNaN(totalSlots) && totalSlotToDbType[totalSlots]) {
    return totalSlotToDbType[totalSlots];
  }

  const occupiedSlots = Number(
    container?.occupiedSlots ??
      container?.occupied_slots ??
      (Array.isArray(container?.samples) ? container.samples.length : undefined)
  );
  if (!Number.isNaN(occupiedSlots) && totalSlotToDbType[occupiedSlots]) {
    return totalSlotToDbType[occupiedSlots];
  }

  return undefined;
}
import { supabase } from './client';
// ...existing code...
// Ensure getCurrentUserContext is defined above or here


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
  console.log('[fetchContainers] Supabase response:', { data, error });
  if (error) throw error;
  return (data || []).map(mapContainerFromDb);
}


// Map frontend fields to DB fields for upsert
function mapContainerToDb(container: any) {
  const dbType = resolveDbType(container);
  if (!dbType) {
    throw new Error('Unable to determine container type for Supabase upsert');
  }

  const dbContainer: Record<string, any> = {
    id: container.id,
    name: container.name,
    type: dbType,
    sample_type: container.sampleType,
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

  const user = getCurrentUserContext();
  if (user.id) {
    dbContainer.updated_by = user.id;
    if (!dbContainer.id && !dbContainer.created_by) {
      dbContainer.created_by = user.id;
    }
  }

  const now = new Date().toISOString();
  if (!dbContainer.updated_at) {
    dbContainer.updated_at = now;
  }
  if (!dbContainer.id && !dbContainer.created_at) {
    dbContainer.created_at = now;
  }

  return dbContainer;
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
