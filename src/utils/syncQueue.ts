// Simple persistent sync queue for sample upserts/moves with automatic retry
// Stores queue in localStorage under 'saga-sync-queue'

import { upsertSample } from './supabase/samples';

type QueueItem = {
  id: string; // unique id for this queued op
  payload: any;
  attempts?: number;
  createdAt?: string;
};

const KEY = 'saga-sync-queue';
const MAX_ATTEMPTS = 5;

function readQueue(): QueueItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(q: QueueItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
    // notify listeners
    try { window.dispatchEvent(new CustomEvent('saga-sync-queue-updated')); } catch {};
  } catch (e) {
    console.error('Failed to write sync queue', e);
  }
}

export function enqueueSync(payload: any) {
  const q = readQueue();
  const item: QueueItem = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2,9)}`,
    payload,
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  q.push(item);
  writeQueue(q);
  return item.id;
}

export function getQueueLength() {
  return readQueue().length;
}

let isProcessing = false;

export async function startSyncProcessor() {
  if (isProcessing) return;
  isProcessing = true;
  while (isProcessing) {
    const q = readQueue();
    if (!q || q.length === 0) {
      // sleep for a while
      await new Promise(res => setTimeout(res, 1000));
      continue;
    }
    const item = q[0];
    try {
      // attempt upsert
      await upsertSample(item.payload);
      // success: remove from queue
      const next = readQueue().filter(i => i.id !== item.id);
      writeQueue(next);
    } catch (err) {
      // increment attempts and requeue or drop
      const cur = readQueue();
      const idx = cur.findIndex(i => i.id === item.id);
      if (idx !== -1) {
        cur[idx].attempts = (cur[idx].attempts || 0) + 1;
        if (cur[idx].attempts >= MAX_ATTEMPTS) {
          // drop after max attempts but keep a console error
          console.error('[syncQueue] dropping item after max attempts', cur[idx], err);
          cur.splice(idx, 1);
        }
        writeQueue(cur);
      }
      // backoff before next attempt
      await new Promise(res => setTimeout(res, 500 * (item.attempts ? item.attempts : 1)));
    }
  }
}

export function stopSyncProcessor() {
  isProcessing = false;
}

export function getQueueItems() {
  return readQueue();
}
