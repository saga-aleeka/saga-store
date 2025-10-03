
// Accepts a sample array (or count) for the container, returns the count
export function getLiveOccupiedSlots(samples: any[] | undefined | null): number {
  if (Array.isArray(samples)) return samples.length;
  return 0;
}
