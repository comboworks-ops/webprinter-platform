import type { CSSProperties } from 'react';

/** Optional overrides: old designs keep their existing theme and overlap settings. */
export interface FeaturedProductLayout {
  alignment?: 'left' | 'center' | 'right';
  widthPct?: number;
  edgeInsetPx?: number;
  offsetYPx?: number;
  bottomGapPx?: number;
}

const bounded = (value: number | undefined, fallback: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value!)) : fallback;

export function resolveFeaturedLayout(layout?: FeaturedProductLayout): CSSProperties {
  const edge = `min(${bounded(layout?.edgeInsetPx, 0, 0, 120)}px, 10%)`;
  return {
    width: `${bounded(layout?.widthPct, 100, 40, 100)}%`,
    maxWidth: `calc(100% - 2 * ${edge})`,
    marginLeft: layout?.alignment === 'left' ? edge : 'auto',
    marginRight: layout?.alignment === 'right' ? edge : 'auto',
    marginTop: layout?.offsetYPx === undefined ? undefined : `${bounded(layout.offsetYPx, 0, -160, 240)}px`,
    marginBottom: `${bounded(layout?.bottomGapPx, 0, 0, 160)}px`,
  };
}
