export interface HeaderFitMeasurements {
  viewportWidth: number;
  availableWidth: number;
  logoWidth: number;
  navigationWidth: number;
  actionsWidth: number;
  centered?: boolean;
  wasCompact?: boolean;
  minimumDesktopWidth?: number;
  clearance?: number;
}

export type HeaderMode = 'desktop' | 'stacked' | 'compact';

export interface HeaderModeMeasurements extends HeaderFitMeasurements {
  /** Storefronts may keep a single-line navigation row below logo/actions. */
  allowStackedDesktop?: boolean;
  previousMode?: HeaderMode;
}

/** Prefer one row, then two measured desktop rows, before using the phone menu. */
export function resolveHeaderMode({ viewportWidth, availableWidth, logoWidth, navigationWidth, actionsWidth, centered = false, minimumDesktopWidth = 1200, clearance = 24, allowStackedDesktop = false, previousMode = 'desktop' }: HeaderModeMeasurements): HeaderMode {
  if (![viewportWidth, availableWidth, logoWidth, navigationWidth, actionsWidth].every(value => Number.isFinite(value) && value >= 0)) return 'compact';
  if (viewportWidth < minimumDesktopWidth || availableWidth <= 0) return 'compact';
  const singleRowWidth = centered
    ? navigationWidth + 2 * Math.max(logoWidth, actionsWidth) + 2 * clearance
    : logoWidth + navigationWidth + actionsWidth + 2 * clearance;
  const releaseMargin = 16;
  if (availableWidth >= singleRowWidth + (previousMode === 'desktop' ? 0 : releaseMargin)) return 'desktop';
  // The navigation remains one unwrapped group; only the group changes rows.
  const stackedWidth = Math.max(navigationWidth, logoWidth + actionsWidth + clearance);
  if (allowStackedDesktop && availableWidth >= stackedWidth + (previousMode === 'compact' ? releaseMargin : 0)) return 'stacked';
  return 'compact';
}

/** Reserve breathing room before any label or action could collide. */
export function shouldUseCompactHeader({ viewportWidth, availableWidth, logoWidth, navigationWidth, actionsWidth, centered = false, wasCompact = false, minimumDesktopWidth = 1200, clearance = 24 }: HeaderFitMeasurements): boolean {
  return resolveHeaderMode({ viewportWidth, availableWidth, logoWidth, navigationWidth, actionsWidth, centered, minimumDesktopWidth, clearance, previousMode: wasCompact ? 'compact' : 'desktop' }) === 'compact';
}
