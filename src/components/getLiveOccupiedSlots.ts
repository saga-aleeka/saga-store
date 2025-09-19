import { useRealtimeSamples } from './useRealtimeSamples';
import { PlasmaContainer } from './PlasmaContainerList';

export function getLiveOccupiedSlots(container: PlasmaContainer): number {
  // Defensive: fallback to occupiedSlots if localStorage is unavailable
  try {
    const storageKey = `samples-${container.id}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.length;
      } else if (typeof parsed === 'object' && parsed !== null) {
        return Object.keys(parsed).length;
      }
    }
  } catch (e) {
    // fallback
  }
  return container.occupiedSlots || 0;
}
