import { resolveSharedButton } from './sharedButtons.ts';
import type { BrandingData } from '@/hooks/useBrandingDraft';

/** Visual tokens only. Buttons keep their own handlers, disabled state and purpose. */
export function primaryButtonStyle(branding?: Partial<BrandingData> | null): Record<string, string> {
  const shared = resolveSharedButton(branding, 'cta', 'order');
  const config = branding?.productPage?.orderButtons;
  const primary = config?.primary;
  const bg = primary?.bgColor || branding?.colors?.primary || '#087FC5';
  const hover = primary?.hoverBgColor || bg;
  const surface = (start?: string, end?: string, fallback?: string) => start && end
    ? `linear-gradient(135deg, ${start}, ${end})` : fallback!;
  const legacy = {
    '--shop-action-bg': surface(primary?.gradientStart, primary?.gradientEnd, bg),
    '--shop-action-hover': surface(primary?.hoverGradientStart, primary?.hoverGradientEnd, hover),
    '--shop-action-text': primary?.textColor || '#FFFFFF',
    '--shop-action-hover-text': primary?.hoverTextColor || primary?.textColor || '#FFFFFF',
    '--shop-action-border': primary?.borderColor || bg,
    '--shop-action-hover-border': primary?.hoverBorderColor || hover,
    '--storefront-tight-radius': `${config?.radiusPx ?? 6}px`,
    '--shop-action-radius': `${config?.radiusPx ?? 6}px`,
    '--shop-action-font': `${config?.fontSizePx ?? 16}px`,
    '--shop-action-padding': `${config?.paddingYPx ?? 14}px`,
  };
  if (!shared) return legacy;
  return { ...legacy, '--shop-action-bg': shared.bgColor, '--shop-action-hover': shared.hoverBgColor, '--shop-action-text': shared.textColor, '--shop-action-hover-text': shared.hoverTextColor, '--shop-action-border': shared.borderColor, '--shop-action-hover-border': shared.hoverBgColor, '--shop-action-radius': `${shared.radiusPx}px`, '--shop-action-font': `${shared.fontSizePx}px`, '--shop-action-padding': `${shared.paddingYPx}px` };
}
