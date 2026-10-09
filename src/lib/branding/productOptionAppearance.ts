import type { BrandingData } from '@/hooks/useBrandingDraft';
import { DEFAULT_TEXT_BUTTON_STYLING } from '../../types/pricingStructure.ts';
import { localOptionButtonStyle, resolveSharedButton, type SharedButtonStyle } from './sharedButtons.ts';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

/** Read appearance without copying inherited colors into the product's saved overrides. */
export function resolveProductOptionAppearance(branding: Partial<BrandingData> | undefined, structure: unknown, productId: string, sectionId: string, valueId: string, localOverride?: Record<string, unknown>) {
  const product = object(structure);
  const axis = object(product.vertical_axis);
  const section = axis.sectionId === sectionId ? axis
    : object(array(product.layout_rows).flatMap(row => array(object(row).columns)).find(column => object(column).id === sectionId));
  const local = localOverride ?? object(object(section.valueSettings)[valueId]);
  const shared = resolveSharedButton(branding, 'selection', `product-option.${productId}.${sectionId}.${valueId}`);
  const style = local.lockFromSharedButtons === true ? localOptionButtonStyle(local) : shared;
  if (style) {
    return { source: local.lockFromSharedButtons === true ? 'locked' as const : 'shared' as const, sharedStyle: style, ...optionAppearanceSettings(style) };
  }
  const inherited = { ...DEFAULT_TEXT_BUTTON_STYLING, ...branding?.productPage?.matrix?.textButtons, ...object(object(product.buttonStyling).textButtons), ...object(object(section.selectorStyling).textButtons) };
  return {
    source: 'product' as const, sharedStyle: undefined,
    ...inherited, ...local,
    // The renderer uses section selection colors until a value is explicitly locked.
    selectedBackgroundColor: inherited.selectedBackgroundColor,
    selectedTextColor: inherited.selectedTextColor,
    buttonEffect: 'none' as const, idleMotion: false,
  };
}

/** Shared/locked buttons use the same border and hover rules as sharedButtons.css. */
export function optionAppearanceSettings(style: SharedButtonStyle) {
  return {
    backgroundColor: style.bgColor, textColor: style.textColor,
    hoverBackgroundColor: style.hoverBgColor, hoverTextColor: style.hoverTextColor,
    selectedBackgroundColor: style.selectedBgColor, selectedTextColor: style.selectedTextColor,
    borderColor: style.borderColor, hoverBorderColor: style.hoverBgColor,
    borderRadiusPx: style.radiusPx, borderWidthPx: 1,
    paddingPx: style.paddingYPx, fontSizePx: style.fontSizePx, minHeightPx: 44,
    buttonEffect: style.effect, idleMotion: style.idleMotion,
  };
}
