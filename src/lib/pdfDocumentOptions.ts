/** PDF.js 3.x must never evaluate embedded font programs (GHSA-wgrm-67xf-hhpq).
 * Keep original bytes and rendering settings while enforcing the documented mitigation.
 */
export function safePdfDocumentOptions<T extends Record<string, unknown>>(options: T): Omit<T, 'isEvalSupported'> & {isEvalSupported: false} {
  return {...options, isEvalSupported: false};
}
