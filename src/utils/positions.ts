// Helpers to normalise sample positions and IDs for UI matching
export function normaliseSampleId(raw: any): string {
  try {
    return String(raw || '').trim().toUpperCase();
  } catch {
    return '';
  }
}

// Normalise a position string to the canonical format used in the UI: Letter(s) then number(s), uppercased.
// For IDT plates (columns A..G, rows 14..1) we expect formats like 'A14'. Some imports/tools may produce '14A' -> handle it.
export function normalisePosition(raw: any, containerType?: string): string {
  if (raw === undefined || raw === null) return '';
  let s = String(raw).trim().toUpperCase();
  if (!s) return '';

  // Remove any surrounding quotes
  if ((s.startsWith("\"") && s.endsWith("\"")) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }

  // Normalize common separators (space, dash, underscore)
  s = s.replace(/[-_\s]+/g, '');

  // If already Letter(s) then Number(s), that's canonical (e.g., A14, B1, AA10)
  if (/^[A-Z]+\d+$/.test(s)) {
    // Trim leading zeros in numeric part (A01 -> A1)
    return s.replace(/([A-Z]+)0+(\d+)$/i, (_m, letters, nums) => `${letters}${String(Number(nums))}`);
  }

  // If it's Number(s) then Letter(s) (e.g., 14A) - flip to canonical form
  if (/^\d+[A-Z]+$/.test(s)) {
    const m = s.match(/^(\d+)([A-Z]+)$/);
    if (m) {
      const [, num, letters] = m;
      return `${letters}${String(Number(num))}`;
    }
  }

  // If it's purely numeric or purely alphabetic, return as-is (after trimming)
  if (/^\d+$/.test(s) || /^[A-Z]+$/.test(s)) return s;

  // Fallback: return trimmed upper-case string
  return s;
}
