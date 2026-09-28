/** Visual continuity only. Page layouts and ordering settings remain independent. */
export const PRINT_JOURNEY_IDS = ['print-atelier', 'print-signal', 'print-form', 'print-partner'] as const;
export type PrintJourneyId = typeof PRINT_JOURNEY_IDS[number];

type JourneyBranding = {
  themeId?: string;
  colors?: { primary?: string; secondary?: string; background?: string; card?: string; headingText?: string; bodyText?: string };
  fonts?: { heading?: string; body?: string; pricing?: string };
  header?: { bgColor?: string; textColor?: string; logoFont?: string };
};

export function resolvePrintJourney(branding?: JourneyBranding | null): PrintJourneyId | undefined {
  return PRINT_JOURNEY_IDS.find(id => id === branding?.themeId);
}

/** Carry the same tenant palette and fonts into portalled checkout surfaces. */
export function printJourneyAttributes(branding?: JourneyBranding | null) {
  const journey = resolvePrintJourney(branding);
  if (!journey) return {};
  const colors = branding?.colors;
  const fonts = branding?.fonts;
  const style: Record<`--${string}`, string> = {
    '--journey-primary': colors?.primary || '#087FC5',
    '--journey-ink': colors?.headingText || '#18242D',
    '--journey-muted': colors?.bodyText || '#4B5565',
    '--journey-paper': colors?.background || '#FFFFFF',
    '--journey-card': colors?.card || '#FFFFFF',
    '--journey-surface': colors?.secondary || '#EFF6FC',
    '--journey-heading-font': `'${fonts?.heading || 'Inter'}', sans-serif`,
    '--journey-body-font': `'${fonts?.body || 'Inter'}', sans-serif`,
    '--journey-pricing-font': `'${fonts?.pricing || 'Inter'}', monospace`,
    '--journey-header-bg': branding?.header?.bgColor || '#FFFFFF',
    '--journey-header-text': branding?.header?.textColor || colors?.headingText || '#18242D',
    '--journey-logo-font': `'${branding?.header?.logoFont || fonts?.heading || 'Inter'}', sans-serif`,
  };
  return { 'data-print-journey': journey, style };
}
