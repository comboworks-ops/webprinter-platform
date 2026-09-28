import type { BrandingData } from '@/hooks/useBrandingDraft';

export type SharedButtonRole = 'cta' | 'selection';
export const BUTTON_EFFECTS = [
  { id: 'none', name: 'Ingen effekt', description: 'Farver og form uden bevægelse.' },
  { id: 'water', name: 'Vandfyld', description: 'En blød bølge fylder knappen ved hover.' },
  { id: 'sheen', name: 'Lysstrejf', description: 'Et smalt lys glider over overfladen.' },
  { id: 'jelly', name: 'Gelé', description: 'Knappen buler blødt ud ved hover.' },
  { id: 'lift', name: 'Svæv', description: 'Et lille løft med en blød skygge.' },
  { id: 'glow', name: 'Neonglød', description: 'En farvet glød følger knappens kant.' },
  { id: 'ripple', name: 'Ringbølge', description: 'En blød ring breder sig fra midten.' },
  { id: 'sweep', name: 'Farveskub', description: 'Hoverfarven glider ind fra venstre.' },
  { id: 'aurora', name: 'Nordlys', description: 'Langsomt farvespil inde i knappen.' },
  { id: 'orbit', name: 'Lyskreds', description: 'Et lyspunkt rejser langs kanten.' },
  { id: 'breathe', name: 'Åndedrag', description: 'En rolig, pulserende skygge.' },
] as const;
export type ButtonEffect = typeof BUTTON_EFFECTS[number]['id'];
export interface SharedButtonStyle {
  bgColor: string; textColor: string; hoverBgColor: string; hoverTextColor: string;
  selectedBgColor: string; selectedTextColor: string; borderColor: string;
  radiusPx: number; fontSizePx: number; paddingYPx: number;
  effect: ButtonEffect; idleMotion: boolean;
}
export interface ButtonBankEntry { id: string; name: string; role: SharedButtonRole; style: SharedButtonStyle }
export interface SharedButtons {
  version: 1;
  cta?: SharedButtonStyle;
  selection?: SharedButtonStyle;
  bank: ButtonBankEntry[];
  overrides: Record<string, { role: SharedButtonRole; style: SharedButtonStyle }>;
}
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const color = (value: unknown, fallback: string) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
const number = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export function normalizeButtonStyle(value: unknown, fallback: SharedButtonStyle): SharedButtonStyle {
  const raw = object(value);
  return {
    bgColor: color(raw.bgColor, fallback.bgColor), textColor: color(raw.textColor, fallback.textColor),
    hoverBgColor: color(raw.hoverBgColor, fallback.hoverBgColor), hoverTextColor: color(raw.hoverTextColor, fallback.hoverTextColor),
    selectedBgColor: color(raw.selectedBgColor, fallback.selectedBgColor), selectedTextColor: color(raw.selectedTextColor, fallback.selectedTextColor),
    borderColor: color(raw.borderColor, fallback.borderColor),
    radiusPx: number(raw.radiusPx, fallback.radiusPx, 0, 48), fontSizePx: number(raw.fontSizePx, fallback.fontSizePx, 12, 24),
    paddingYPx: number(raw.paddingYPx, fallback.paddingYPx, 6, 24),
    effect: BUTTON_EFFECTS.some(effect => effect.id === raw.effect) ? raw.effect as ButtonEffect : fallback.effect,
    idleMotion: typeof raw.idleMotion === 'boolean' ? raw.idleMotion : fallback.idleMotion,
  };
}

/** Reads the existing visual fields, without enabling master inheritance on old designs. */
export function legacyButtonStyle(branding: Partial<BrandingData> | null | undefined, role: SharedButtonRole): SharedButtonStyle {
  const primary = color(branding?.colors?.primary, '#087FC5');
  const cta = branding?.productPage?.orderButtons;
  const option = branding?.productPage?.matrix?.textButtons;
  const raw = role === 'cta' ? {
    bgColor: cta?.primary.bgColor || primary, textColor: cta?.primary.textColor || '#FFFFFF',
    hoverBgColor: cta?.primary.hoverBgColor || branding?.colors?.hover || primary,
    hoverTextColor: cta?.primary.hoverTextColor || cta?.primary.textColor || '#FFFFFF',
    radiusPx: cta?.radiusPx, fontSizePx: cta?.fontSizePx, paddingYPx: cta?.paddingYPx,
  } : {
    bgColor: option?.backgroundColor, textColor: option?.textColor, hoverBgColor: option?.hoverBackgroundColor,
    hoverTextColor: option?.hoverTextColor, selectedBgColor: option?.selectedBackgroundColor,
    selectedTextColor: option?.selectedTextColor, borderColor: option?.borderColor,
    radiusPx: option?.borderRadiusPx, fontSizePx: option?.fontSizePx, paddingYPx: option?.paddingPx,
  };
  return normalizeButtonStyle(raw, {
    bgColor: role === 'cta' ? primary : '#FFFFFF', textColor: role === 'cta' ? '#FFFFFF' : '#1F2937',
    hoverBgColor: role === 'cta' ? '#066BA8' : '#EFF6FC', hoverTextColor: role === 'cta' ? '#FFFFFF' : '#0B1933',
    selectedBgColor: primary, selectedTextColor: '#FFFFFF', borderColor: role === 'cta' ? primary : '#CBD5E1',
    radiusPx: 6, fontSizePx: role === 'cta' ? 16 : 14, paddingYPx: role === 'cta' ? 14 : 10, effect: 'none', idleMotion: false,
  });
}
/** Capture the section's current authored appearance when locking before master styling is enabled. */
export function legacyLocalButtonStyle(branding: BrandingData, role: SharedButtonRole, key: string): SharedButtonStyle {
  const fallback = legacyButtonStyle(branding, role);
  if (role !== 'cta') return fallback;
  const group = key.split(':')[0];
  if (group === 'hero') {
    const id = key.split(':')[1];
    const buttons = [...branding.hero.overlay.buttons, ...branding.hero.images.flatMap(image => image.buttons || [])];
    const button = id ? buttons.find(item => item.id === id) : buttons.find(item => item.variant !== 'secondary');
    return normalizeButtonStyle({ bgColor: button?.bgColor, hoverBgColor: button?.bgHoverColor, textColor: button?.textColor, hoverTextColor: button?.textColor }, fallback);
  }
  if (group === 'catalogue') {
    const button = branding.forside.productsSection.button;
    return normalizeButtonStyle({ ...button, radiusPx: button.borderRadiusPx }, fallback);
  }
  if (group === 'featured') {
    const button = branding.forside.productsSection.featuredProductConfig;
    return normalizeButtonStyle({ bgColor: button.ctaColor, hoverBgColor: button.ctaHoverColor, textColor: button.ctaTextColor, hoverTextColor: button.ctaTextColor, radiusPx: button.ctaBorderRadiusPx, fontSizePx: button.ctaFontSizePx, paddingYPx: button.ctaPaddingYPx }, fallback);
  }
  if (group === 'header') return normalizeButtonStyle(branding.header.cta, fallback);
  return fallback;
}
export function readSharedButtons(branding?: Partial<BrandingData> | null): SharedButtons {
  const raw = object(branding?.themeSettings?.sharedButtons);
  const fallback = { cta: legacyButtonStyle(branding, 'cta'), selection: legacyButtonStyle(branding, 'selection') };
  const overrides: SharedButtons['overrides'] = {};
  for (const [key, value] of Object.entries(object(raw.overrides)).slice(0, 1000)) {
    const entry = object(value);
    if ((entry.role === 'cta' || entry.role === 'selection') && key !== '__proto__' && key !== 'constructor') {
      overrides[key] = { role: entry.role, style: normalizeButtonStyle(entry.style, fallback[entry.role]) };
    }
  }
  const bank: ButtonBankEntry[] = [];
  for (const value of (Array.isArray(raw.bank) ? raw.bank : []).slice(0, 100)) {
    const entry = object(value);
    if (typeof entry.id !== 'string' || typeof entry.name !== 'string' || (entry.role !== 'cta' && entry.role !== 'selection')) continue;
    bank.push({ id: entry.id, name: entry.name.slice(0, 80), role: entry.role, style: normalizeButtonStyle(entry.style, fallback[entry.role]) });
  }
  return { version: 1, bank, overrides,
    ...(raw.cta ? { cta: normalizeButtonStyle(raw.cta, fallback.cta) } : {}),
    ...(raw.selection ? { selection: normalizeButtonStyle(raw.selection, fallback.selection) } : {}),
  };
}
export function sharedButtonsPatch(draft: BrandingData, settings: SharedButtons): Partial<BrandingData> {
  return { themeSettings: { ...draft.themeSettings, sharedButtons: settings } };
}
/** Contextual option names may change; product/section/value identity must not. */
export function canonicalButtonKey(key: string): string {
  return key.startsWith('product-option.') ? key.split('.').slice(0, 4).join('.') : key;
}
export function resolveSharedButton(branding: Partial<BrandingData> | null | undefined, role: SharedButtonRole, key?: string): SharedButtonStyle | undefined {
  const settings = readSharedButtons(branding);
  const canonical = key ? canonicalButtonKey(key) : '';
  const exact = settings.overrides[canonical];
  if (exact?.role === role) return exact.style;
  const group = settings.overrides[canonical.split(':')[0]];
  if (group?.role === role) return group.style;
  return settings[role];
}
export function buttonStyleVariables(style: SharedButtonStyle): Record<string, string> {
  return {
    '--sb-bg': style.bgColor, '--sb-text': style.textColor, '--sb-hover': style.hoverBgColor, '--sb-hover-text': style.hoverTextColor,
    '--sb-selected': style.selectedBgColor, '--sb-selected-text': style.selectedTextColor, '--sb-border': style.borderColor,
    '--sb-radius': `${style.radiusPx}px`, '--sb-font': `${style.fontSizePx}px`, '--sb-padding': `${style.paddingYPx}px`,
  };
}
export function sharedButtonAttributes(style: SharedButtonStyle | undefined, role: SharedButtonRole) {
  return style ? { 'data-shared-button': role, 'data-button-effect': style.effect, 'data-button-idle': style.idleMotion ? 'true' : 'false', style: buttonStyleVariables(style) } : {};
}

/** Product-specific appearance lives in the existing styling metadata, never price cells. */
export function localOptionButtonStyle(value: unknown): SharedButtonStyle {
  const local = object(value);
  return normalizeButtonStyle({
    bgColor: local.backgroundColor, hoverBgColor: local.hoverBackgroundColor,
    textColor: local.textColor, hoverTextColor: local.hoverTextColor,
    selectedBgColor: local.selectedBackgroundColor, selectedTextColor: local.selectedTextColor,
    borderColor: local.borderColor, radiusPx: local.borderRadiusPx,
    fontSizePx: local.fontSizePx, paddingYPx: local.paddingPx,
    effect: local.buttonEffect, idleMotion: local.idleMotion,
  }, legacyButtonStyle(undefined, 'selection'));
}
