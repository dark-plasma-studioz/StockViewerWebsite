/**
 * Normalize user-entered ticker symbols to a consistent format.
 * Handles common patterns like XSP, XSP.TO, XSP:CA.
 */
export function normalizeSymbol(input: string): string {
  return input.trim().toUpperCase().replace(/:CA$/, '.TO');
}
