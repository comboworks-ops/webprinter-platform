export const IMAGE_HOVER_EFFECTS = [
  ['none', 'Ingen'], ['zoom', 'Zoom ind'], ['lift', 'Løft billede'],
  ['tilt', 'Let drejning'], ['brighten', 'Lysere billede'], ['grayscale', 'Fra grå til farve'],
] as const;
export const CARD_HOVER_EFFECTS = [
  ['none', 'Ingen'], ['shadow', 'Blød skygge'], ['lift', 'Løft kort'],
  ['glow', 'Glød'], ['outline', 'Farvet kant'], ['scale', 'Let forstørrelse'],
] as const;
export type ImageHoverEffect = typeof IMAGE_HOVER_EFFECTS[number][0];
export type CardHoverEffect = typeof CARD_HOVER_EFFECTS[number][0];

/** Images/links are rendered as URLs, never interpreted as markup. */
export function safePresentationUrl(value?: string): string | undefined {
  const url = value?.trim();
  if (!url || [...url].some(char => char.charCodeAt(0) <= 32 || char === '\\')) return undefined;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? url : undefined; }
  catch { return undefined; }
}
