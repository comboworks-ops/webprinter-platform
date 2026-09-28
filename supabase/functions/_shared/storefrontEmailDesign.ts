/** Email-safe presentation of a shop's published design. No credentials or delivery logic. */
export interface EmailTenant { id: string; name: string; settings: Record<string, unknown> | null }
export interface EmailBrand {
  name: string; primary: string; buttonText: string; background: string; heading: string; body: string;
  headingFont: string; bodyFont: string; logoUrl: string | null; logoBackground: string;
  companyName: string; companyAddress: string; companyCvr: string;
}
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const clean = (value: unknown, max = 180) => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, max) : '';
export const escapeEmailHtml = (value: unknown) => String(value ?? '').slice(0, 4000).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const hex = (value: unknown, fallback: string): string => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value) ? value.toUpperCase() : fallback;
function luminance(color: string): number {
  const values = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}
export function emailContrast(a: string, b: string): number { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
const readable = (value: unknown, background: string, fallback: string) => { const candidate = hex(value, fallback); return emailContrast(candidate, background) >= 4.5 ? candidate : fallback; };
const onColor = (color: string) => emailContrast('#FFFFFF', color) >= 4.5 ? '#FFFFFF' : '#000000';
function tint(color: string): string { return '#' + [1, 3, 5].map(i => Math.round(parseInt(color.slice(i, i + 2), 16) * .06 + 255 * .94).toString(16).padStart(2, '0')).join('').toUpperCase(); }
function font(value: unknown): string {
  const name = clean(value, 60);
  if (['Georgia', 'Times New Roman', 'Playfair Display', 'Merriweather', 'Lora', 'Libre Baskerville'].includes(name)) return `'${name}',Georgia,'Times New Roman',serif`;
  if (['Roboto Mono', 'IBM Plex Mono', 'Courier New'].includes(name)) return `'${name}','Courier New',monospace`;
  if (['Inter', 'Poppins', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'DM Sans', 'Arial', 'Helvetica', 'Verdana', 'Trebuchet MS', 'Nunito', 'Source Sans 3'].includes(name)) return `'${name}',Arial,Helvetica,sans-serif`;
  return 'Arial,Helvetica,sans-serif';
}
/** Mirrors the storefront publication precedence; parity tests protect legacy/null/draft cases. */
export function publishedEmailBranding(settings: Record<string, unknown>): Record<string, unknown> {
  const container = object(settings.branding);
  if (Object.hasOwn(container, 'published')) return object(container.published);
  if (settings.branding_published && typeof settings.branding_published === 'object' && !Array.isArray(settings.branding_published)) return object(settings.branding_published);
  const { draft: _draft, published: _published, history: _history, savedDesigns: _saved, ...flat } = container;
  return flat;
}
function safeLogo(value: unknown, origin: string): string | null {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\x00-\x20\\]/.test(value) || value.startsWith('//')) return null;
  try {
    const url = new URL(value, origin);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.)/i.test(url.hostname)) return null;
    return url.toString();
  } catch { return null; }
}
export function resolveEmailBrand(tenant: EmailTenant | null, fallbackName: string, siteUrl: string): EmailBrand {
  const settings = object(tenant?.settings), brand = publishedEmailBranding(settings);
  const colors = object(brand.colors), fonts = object(brand.fonts), header = object(brand.header), company = object(settings.company);
  const theme = object(brand.themeSettings);
  // Uncustomized legacy shops inherit Refined Familiar on the homepage. Preserve authored colors/fonts.
  const legacy = (!brand.themeId || brand.themeId === 'classic' || brand.themeId === 'print-familiar') && !theme.visualStyleId && !theme.visualThemePresetId && !theme.inheritedPrintDesignId;
  const primary = hex(legacy && (!colors.primary || colors.primary === '#0EA5E9') ? '#087FC5' : colors.primary, '#087FC5');
  const name = tenant?.id === '00000000-0000-0000-0000-000000000000' ? 'Webprinter' : clean(tenant?.name) || clean(fallbackName) || 'Din printbutik';
  const background = tint(primary);
  return {
    name, primary, buttonText: onColor(primary), background,
    heading: readable(colors.headingText, '#FFFFFF', '#172033'), body: readable(colors.bodyText, '#FFFFFF', '#4B5563'),
    headingFont: font(legacy && (!fonts.heading || fonts.heading === 'Poppins') ? 'Inter' : fonts.heading),
    bodyFont: font(fonts.body || 'Inter'),
    logoUrl: header.logoType === 'text' ? null : safeLogo(brand.logo_url, siteUrl),
    logoBackground: hex(header.bgColor, '#FFFFFF'),
    companyName: clean(company.name).toLowerCase() === clean(tenant?.name).toLowerCase() ? '' : clean(company.name),
    companyAddress: clean(company.address, 400), companyCvr: /^\d{8}$/.test(clean(company.cvr)) ? clean(company.cvr) : '',
  };
}
/** Display identity varies by shop; the actual sender mailbox stays server-configured/verified. */
export function brandedEmailFrom(from: string, name: string): string {
  const mailbox = from.match(/<([^<>]+)>$/)?.[1] || from;
  const display = clean(name).replace(/[<>"\\]/g, '') || 'Din printbutik';
  return `${/[(),:;@\[\]]/.test(display) ? `"${display}"` : display} <${mailbox}>`;
}
export interface EmailLetter {
  label: string; headline: string; introduction: string; greeting?: string; orderNumber: string;
  fields: string[][]; total?: string; support: string | null; action?: { label: string; url: string };
  note: string; warning?: string;
}
export function renderEmailLetter(brand: EmailBrand, letter: EmailLetter): string {
  const e = escapeEmailHtml;
  const fields = letter.fields.filter(([, value]) => value).map(([label, value]) => `<tr><th scope="row" align="left" valign="top" width="38%" style="padding:12px 14px 12px 0;border-bottom:1px solid #E7EBEF;font-size:14px;font-weight:400;color:${brand.body};overflow-wrap:anywhere;hyphens:auto">${e(label)}</th><td valign="top" style="padding:12px 0;border-bottom:1px solid #E7EBEF;font-size:15px;font-weight:600;color:${brand.heading};overflow-wrap:anywhere;word-break:break-word">${e(value)}</td></tr>`).join('');
  const company = [brand.companyName && brand.companyName.toLowerCase() !== brand.name.toLowerCase() ? brand.companyName : '', brand.companyAddress, brand.companyCvr ? `CVR ${brand.companyCvr}` : ''].filter(Boolean);
  // Tables/inline styles keep the core readable when clients strip <style>, web fonts or images.
  return `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(letter.label)} · ${e(brand.name)}</title><style>@media only screen and (max-width:480px){.mail-shell{width:100%!important}.mail-pad{padding:26px 22px!important}.mail-title{font-size:28px!important;line-height:1.2!important}.mail-outer{padding:12px 8px!important}}</style></head>
<body style="margin:0;padding:0;background-color:${brand.background};color:${brand.body};font-family:${brand.bodyFont};-webkit-text-size-adjust:100%">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${e(letter.introduction)} · ${e(letter.orderNumber)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${brand.background}"><tr><td class="mail-outer" align="center" style="padding:36px 16px">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" class="mail-shell" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid #E7EBEF;border-radius:10px;overflow:hidden">
<tr><td height="6" style="height:6px;line-height:6px;font-size:1px;background:${brand.primary}">&nbsp;</td></tr>
<tr><td class="mail-pad" style="padding:30px 36px 26px;border-bottom:1px solid #E7EBEF">${brand.logoUrl ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding:10px 14px;background:${brand.logoBackground};border-radius:4px"><img src="${e(brand.logoUrl)}" alt="${e(brand.name)}" width="180" style="display:block;width:180px;max-width:100%;height:auto;border:0"></td></tr></table><p style="margin:12px 0 0;font-size:14px;color:${brand.heading}">${e(brand.name)}</p>` : `<p style="margin:0;font:700 25px/1.2 ${brand.headingFont};letter-spacing:-.6px;color:${brand.heading}">${e(brand.name)}</p>`}</td></tr>
<tr><td class="mail-pad" style="padding:32px 36px">
<p style="margin:0 0 18px;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${brand.body}">${e(letter.label)}</p>
${letter.greeting ? `<p style="margin:0 0 10px;font-size:16px;line-height:1.6">${e(letter.greeting)}</p>` : ''}
<h1 class="mail-title" style="margin:0 0 16px;font:700 34px/1.16 ${brand.headingFont};letter-spacing:-.8px;color:${brand.heading};overflow-wrap:anywhere">${e(letter.headline)}</h1>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7">${e(letter.introduction)}</p>
${letter.warning ? `<table role="presentation" width="100%"><tr><td style="padding:18px;border-left:3px solid ${brand.primary};background:${brand.background};font-size:15px;line-height:1.6;color:${brand.heading};overflow-wrap:anywhere">${e(letter.warning)}</td></tr></table>` : ''}
<p style="margin:26px 0 6px;font-size:12px;font-weight:700;letter-spacing:1px;color:${brand.body}">ORDRE ${e(letter.orderNumber)}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border-collapse:collapse">${fields}</table>
${letter.total ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px 0;font-size:15px;color:${brand.heading}">Samlet beløb</td><td align="right" style="padding:20px 0;font:700 24px/1.3 ${brand.headingFont};color:${brand.heading}">${e(letter.total)}</td></tr></table>` : ''}
${letter.action ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0"><tr><td align="center" bgcolor="${brand.primary}" style="border-radius:5px;mso-padding-alt:15px 26px"><a href="${e(letter.action.url)}" style="display:inline-block;padding:15px 26px;border:1px solid ${brand.primary};border-radius:5px;color:${brand.buttonText};font:700 15px/1.3 ${brand.bodyFont};text-decoration:none;mso-padding-alt:0">${e(letter.action.label)}</a></td></tr></table>` : ''}
<p style="margin:22px 0 0;font-size:14px;line-height:1.65">${e(letter.note)}</p>
</td></tr>
<tr><td class="mail-pad" style="padding:26px 36px;background:#F8FAFC;border-top:1px solid #E7EBEF;color:#4B5563">
<p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#172033">Har du spørgsmål?</p>
<p style="margin:0;font-size:14px;line-height:1.7">${letter.support ? `Svar på denne mail, eller skriv til <a style="color:#172033;text-decoration:underline;overflow-wrap:anywhere" href="mailto:${e(letter.support)}">${e(letter.support)}</a>.` : `Kontakt ${e(brand.name)}, og oplys dit ordrenummer.`}</p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
<p style="max-width:560px;margin:20px 0 0;font:12px/1.7 ${brand.bodyFont};color:#4B5563">${e(brand.name)}${company.length ? '<br>' + company.map(e).join(' · ') : ''}</p>
</td></tr></table></body></html>`;
}
