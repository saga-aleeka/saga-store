// Defensive string utility for safe .replace and .trim usage
export function safeString(str: any): string {
  return typeof str === 'string' ? str : '';
}

export function safeReplace(str: any, searchValue: string | RegExp, replaceValue: string): string {
  return safeString(str).replace(searchValue, replaceValue);
}

export function safeTrim(str: any): string {
  return safeString(str).trim();
}
