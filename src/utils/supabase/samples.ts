

import { supabase } from './client';
import { fetchContainers } from './containers';
import { API_BASE_URL } from './database';
import { supabaseAnonKey } from './info';

function mergeMetadata(sample: any) {
  const data = sample?.data;
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

function normaliseSample(sample: any) {
  const metadata = mergeMetadata(sample);
  return {
    ...sample,
    history: metadata.history ?? sample.history ?? [],
    status: metadata.status ?? sample.status,
    storage_date: metadata.storageDate ?? sample.storage_date ?? sample.created_at,
    last_accessed: metadata.lastAccessed ?? sample.last_accessed ?? sample.updated_at,
  };
}

export async function fetchSamples(containerId?: string) {
  // If a containerId is provided, fetch only samples for that container to avoid large client-side filtering.
  let query = supabase.from('samples').select('*');
  if (containerId) {
    query = query.eq('container_id', containerId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normaliseSample);
}


function buildSamplePayload(sample: any) {
  const allowedColumns = new Set([
    'id',
    'container_id',
    'sample_id',
    'position',
    'created_at',
    'updated_at',
  ]);

  const normalised: Record<string, any> = { ...sample };

  // Normalize common fields to canonical forms before building payload
  if (normalised.position !== undefined && normalised.position !== null) {
    try {
      normalised.position = String(normalised.position).trim().toUpperCase();
    } catch {
      normalised.position = normalised.position;
    }
  }

  // Ensure sample_id is present in snake_case and trimmed
  if (normalised.sampleId && !normalised.sample_id) {
    normalised.sample_id = normalised.sampleId;
  }
  if (normalised.sample_id !== undefined && normalised.sample_id !== null) {
    normalised.sample_id = String(normalised.sample_id).trim();
  }

  // Remove fields that should never be persisted directly
  delete normalised.container_name;

  // Normalise camelCase identifiers into snake_case variants
  delete normalised.sampleId;

  if (normalised.containerId && !normalised.container_id) {
    normalised.container_id = normalised.containerId;
  }
  delete normalised.containerId;

  const storageDate = normalised.storage_date ?? normalised.storageDate;
  if (storageDate && !normalised.created_at) {
    normalised.created_at = storageDate;
  }
  delete normalised.storage_date;
  delete normalised.storageDate;

  const lastAccessed = normalised.last_accessed ?? normalised.lastAccessed;
  if (lastAccessed && !normalised.updated_at) {
    normalised.updated_at = lastAccessed;
  }
  delete normalised.last_accessed;
  delete normalised.lastAccessed;

  const rawData = mergeMetadata(sample);

  const payload: Record<string, any> = {};
  const metadata: Record<string, any> = { ...rawData };

  if (storageDate) {
    metadata.storageDate = storageDate;
  }
  if (lastAccessed) {
    metadata.lastAccessed = lastAccessed;
  }

  delete normalised.data;

  for (const [key, value] of Object.entries(normalised)) {
    if (value === undefined || value === null) continue;

    if (allowedColumns.has(key)) {
      payload[key] = value instanceof Date ? value.toISOString() : value;
    } else if (key !== 'data') {
      metadata[key] = value;
    }
  }

  if (Object.keys(metadata).length > 0) {
    payload.data = metadata;
  }

  return payload;
}

export async function upsertSample(sample: any) {
  // Fetch all containers to determine status
  const containers = await fetchContainers();
  const thisContainer = containers.find((c: any) => c.id === sample.container_id || c.id === sample.containerId);
  const isArchive = thisContainer?.isArchived || thisContainer?.status === 'archived';

  const sampleToSave = buildSamplePayload(sample);

  // Only enforce uniqueness if not archive
  if (!isArchive) {
    const targetSampleId = sampleToSave.sample_id;
    if (targetSampleId) {
      // Find all samples with this sample_id
      const { data: existingSamples, error: fetchError } = await supabase
        .from('samples')
        .select('id, container_id')
        .eq('sample_id', targetSampleId);
      if (fetchError) throw fetchError;

      // Find if any are in a non-archive container (other than this one)
      for (const s of existingSamples || []) {
        if (s.container_id !== sampleToSave.container_id) {
          const otherContainer = containers.find((c: any) => c.id === s.container_id);
          const otherIsArchive = otherContainer?.isArchived || otherContainer?.status === 'archived';
          if (!otherIsArchive) {
            await supabase.from('samples').delete().eq('id', s.id);
          }
        }
      }
      // If a sample with this sample_id already exists in this container, include its id for upsert
      const existingInThisContainer = (existingSamples || []).find(s => s.container_id === sampleToSave.container_id);
      if (existingInThisContainer && existingInThisContainer.id) {
        sampleToSave.id = existingInThisContainer.id;
      }
    }
  }
  // Upsert the sample (insert or update)
  try {
    const { data, error } = await supabase.from('samples').upsert(sampleToSave).select();
    if (!error) return data;

    // If error appears to be an RLS/permission error, fall back to calling server function
    const message = String(error?.message || error || '').toLowerCase();
    if (message.includes('row-level security') || message.includes('permission') || message.includes('policy')) {
      console.warn('[upsertSample] Direct upsert blocked by RLS - falling back to server function', message);
      try {
        const resp = await fetch(`${API_BASE_URL}/samples`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ sample: sampleToSave }),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => 'no body');
          throw new Error(`Server samples upsert failed: ${resp.status} ${resp.statusText} ${text}`);
        }
        const result = await resp.json();
        return result.data;
      } catch (serverErr) {
        throw serverErr;
      }
    }

    throw error;
  } catch (finalErr) {
    throw finalErr;
  }
}


export async function deleteSample(id: string) {
  const { error } = await supabase.from('samples').delete().eq('id', id);
  if (error) throw error;
}
