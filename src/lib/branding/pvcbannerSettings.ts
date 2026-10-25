import { wideFormatDesign, WIDE_FORMAT_DEFAULTS } from './wideFormatDesigns.ts';
import { APPROVED_DROPDOWN_PRESETS } from './dropdownPresets.ts';
/** Signal content lives inside the existing versioned branding draft/published data. */
export const PVCBANNER_TENANT_ID = 'cd3c7d7b-2220-46b8-93cf-096de23e93d8';
export const SIGNAL_DEFAULTS = {
  designId: 'signal', sharedCalculatorLayout: false, configurationStyle: 'fields', checkoutStyle: 'standard', contactLayout: 'standard',
  menuBanners: 'Bannere', menuSigns: 'Skilte & folie', menuDisplay: 'Messe & display', menuPrint: 'Tryksager',
  brand: 'PVCbanner.dk', logo: '/site-previews/pvcbanner-signal/assets/signal-mark.png',
  primary: '#1748ff', accent: '#fff36a', ink: '#101522', background: '#ffffff',
  headingFont: 'Anton', bodyFont: 'Inter',
  heroEyebrow: 'STORE IDÉER BEGYNDER HER', heroTitle: 'DIT BUDSKAB.\nSTORT FORMAT.',
  heroDescription: 'Bannere, skilte og messematerialer i professionel kvalitet.\nEnkelt at bestille. Skabt til at blive set.',
  heroImage: '/site-previews/pvcbanner-signal/assets/signal-hero.png',
  heroButton: 'Byg dit banner', heroLink: '/produkt/pvc-banner', secondaryButton: 'Find dit format',
  storyEyebrow: 'FRA FACADE TIL MESSEGULV', storyTitle: 'ÉT BRAND.\nMANGE MÅDER\nAT BLIVE SET.',
  storyText: 'Giv dine idéer plads. Sæt dit præg på facaden, skab et samlingspunkt på messen, eller send dit budskab med hjem på papir.',
  storyImage: '/site-previews/pvcbanner-signal/assets/signal-stand.png', storyButton: 'Find dit messeudtryk',
  storyLink: '/produkter?gruppe=Messe%20%26%20display',
  stepsTitle: 'Fra idé til stort format.',
  step1Title: 'Vælg dit format', step1Text: 'Start med produktet og de mål, der passer til din opgave.',
  step2Title: 'Gør det til dit', step2Text: 'Tilføj dit design, vælg finish, og se dit banner tage form.',
  step3Title: 'Få overblikket', step3Text: 'Se dine valg samlet, inden du går videre.',
  footerText: 'Små idéer. Store budskaber.', footerNote: 'En del af Webprinter.', footerSlogan: 'DIT BUDSKAB. STORT FORMAT.',
  catalogueTitle: 'FIND DIT FORMAT.', catalogueDescription: 'Fra det første banner til en hel messestand.',
  showHero: true, showStory: true, showSteps: true,
  heroImageAlt: 'Bannere og skilte i et lyst showroom', storyImageAlt: 'Samlet messeudtryk',
  heroLayout: 'overlap', heroSize: 104, heroMobileSize: 54, heroTextSize: 16,
  heroHeight: 560, heroImagePosition: 80, heroTextColor: '#101522', heroBackground: '#ffffff',
  storySize: 68, storyTextSize: 16, storyBackground: '#ffffff', storyTextColor: '#101522', storyLayout: 'image-left',
  bodySize: 16, headingSize: 28, lineHeight: 1.6, contentWidth: 1440, sectionSpacing: 64,
  logoSize: 44, brandSize: 25, headerHeight: 90, menuSize: 13,
  headerBackground: '#ffffff', headerTextColor: '#101522', dropdownBackground: '#ffffff', dropdownTextColor: '#101522',
  dropdownStyle: 'cards', menuTrigger: 'click', motion: 'subtle',
  buttonSize: 14, buttonRadius: 4, buttonPadding: 22, buttonBackground: '#1748ff', buttonTextColor: '#ffffff', buttonStyle: 'solid',
  secondaryLink: '/produkter', showSecondaryButton: true,
  ribbonText1: 'Bannere på mål', ribbonLink1: '/produkter?gruppe=Bannere',
  ribbonText2: 'Skilte til dit rum', ribbonLink2: '/produkter?gruppe=Skilte%20%26%20folie',
  ribbonText3: 'Klar til messe', ribbonLink3: '/produkter?gruppe=Messe%20%26%20display',
  showRibbon: true, ribbonMode: 'links', ribbonBackground: '#1748ff', ribbonColor: '#ffffff', ribbonSize: 16, ribbonHeight: 64,
  ribbonImage: '/site-previews/pvcbanner-signal/assets/signal-stand.png', ribbonImageAlt: 'Bannere, skilte og display',
  showProducts: true, featuredTitle: '', productColumns: 4, productTitleSize: 20, productImageRatio: 'landscape',
  catalogueSize: 72, catalogueEyebrow: 'SMÅ IDÉER. STORE MULIGHEDER.',
  stepsBackground: '#ffffff', stepsTextColor: '#101522',
  pageTitleSize: 64, contactTitle: 'Kontakt os', contactIntro: 'Har du spørgsmål til format, materiale eller din trykfil? Kontakt os, så hjælper vi dig videre.',
  aboutTitle: 'STORE IDÉER. PERSONLIG SERVICE.', aboutIntro: 'Fra det første banner til en samlet messestand. Hos PVCbanner.dk gør vi det enkelt at vælge format, tilføje design og bestille print.',
  guideTitle: '', guideIntro: '',
  footerBackground: '#fafbfc', footerTextColor: '#525d6e', footerSize: 13,

};
export type SignalSettings = typeof SIGNAL_DEFAULTS;
export const SIGNAL_NUMBERS: Partial<Record<keyof SignalSettings, [number, number, number?]>> = {
  pageTitleSize:[32,100],heroSize:[36,140],heroMobileSize:[28,80],heroTextSize:[12,28],heroHeight:[360,800],heroImagePosition:[0,100],
  storySize:[28,100],storyTextSize:[12,28],bodySize:[12,24],headingSize:[20,64],lineHeight:[1.2,2,0.1],contentWidth:[960,1800],sectionSpacing:[24,120],
  logoSize:[24,80],brandSize:[16,36],headerHeight:[64,140],menuSize:[12,22],buttonSize:[12,24],buttonRadius:[0,32],buttonPadding:[12,40],
  ribbonSize:[12,28],ribbonHeight:[48,240],productColumns:[2,4],productTitleSize:[14,32],catalogueSize:[32,100],footerSize:[12,22],
};
export const SIGNAL_CHOICES: Partial<Record<keyof SignalSettings, [string,string][]>> = {
  headingFont:[['Anton','Anton'],['Inter','Inter'],['Arial','Arial'],['Georgia','Georgia']], bodyFont:[['Inter','Inter'],['Arial','Arial'],['Georgia','Georgia']],
  designId:[['signal','Standard · Signal Studio'],['nordic-atelier','Nordic Atelier'],['format-express','Format Express'],['after-hours','After Hours'],['fieldwork','Fieldwork']],
  configurationStyle:[['fields','Præcise felter'],['sliders','Skydere og felter'],['buttons','Størrelsesknapper'],['specification','Specifikationer']],
  checkoutStyle:[['standard','Standard'],['editorial','To kolonner'],['steps','Tydelige trin'],['cinematic','Lyst bestillingsfelt'],['document','Ordreark']],
  contactLayout:[['standard','Standard'],['editorial','Billede og formular'],['topics','Emner og formular'],['cinematic','Mørk introduktion'],['project','Projektformular']],
  heroLayout:[['immersive','Fuldt billede'],['project','Projekt'],['overlap','Billede til højre'],['split','To kolonner'],['image-left','Billede til venstre']],
  storyLayout:[['image-left','Billede til venstre'],['image-right','Billede til højre']],
  dropdownStyle:[['cards','Billedkort'],['list','Overskuelig liste'],['compact','Kompakt menu'],...APPROVED_DROPDOWN_PRESETS.map(p=>[p.id,p.name] as [string,string])],
  menuTrigger:[['click','Klik'],['hover','Peg og klik']],motion:[['subtle','Bløde overgange'],['none','Ingen bevægelse']],
  buttonStyle:[['solid','Fyldt'],['outline','Kontur']],ribbonMode:[['links','Tre kategorilinks'],['image','Billedbanner med tekst']],
  productImageRatio:[['landscape','Bredformat'],['square','Kvadrat']],
};
export function safeSignalUrl(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  if (/^\/(?!\/)/.test(value) && !/[\\\r\n]/.test(value)) return value;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : fallback; } catch { return fallback; }
}
export function signalSettings(branding?: { themeSettings?: Record<string, unknown>; shop_name?: string; logo_url?: string; header?: {logoText?: string} } | null): SignalSettings {
  const raw = branding?.themeSettings?.pvcbannerSignal;
  const legacy = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const recipe = wideFormatDesign(branding?.themeSettings?.wideFormatDesign);
  const all = branding?.themeSettings?.wideFormatOverrides as Record<string,Record<string,unknown>> | undefined;
  const inherited = Object.fromEntries(Object.entries(legacy).filter(([key]) => /^(brand|logo|menuBanners|menuSigns|menuDisplay|menuPrint|heroDescription|heroLink|secondaryLink|storyText|storyLink|footerText|footerNote)$/.test(key)));
  const explicit = recipe.id === 'signal' ? legacy : all?.[recipe.id] || {};
  const data = recipe.id === 'signal' ? {...legacy} : {...WIDE_FORMAT_DEFAULTS[recipe.id],...inherited,...all?.[recipe.id]};
  if (branding?.themeSettings?.shopFamily === 'wide-format') {
    data.brand ??= branding.shop_name || branding.header?.logoText || SIGNAL_DEFAULTS.brand;
    if (!data.logo && branding.logo_url) data.logo = branding.logo_url;
    if (data.brand !== SIGNAL_DEFAULTS.brand) { data.heroLink ??= '/produkter'; data.aboutIntro ??= `Hos ${data.brand} gør vi det enkelt at vælge format, tilføje design og bestille print.`; }
  }
  data.designId = recipe.id;
  data.configurationStyle ??= recipe.configuration; data.checkoutStyle ??= recipe.checkout;
  data.contactLayout ??= ({'nordic-atelier':'editorial','format-express':'topics','after-hours':'cinematic','fieldwork':'project'} as Record<string,string>)[recipe.id] || 'standard';
  data.dropdownStyle = branding?.themeSettings?.wideFormatMenu || data.dropdownStyle || recipe.menu;
  const result = { ...SIGNAL_DEFAULTS };
  for (const key of Object.keys(result) as (keyof SignalSettings)[]) {
    if (typeof data[key] === typeof result[key]) (result as Record<string, unknown>)[key] = data[key];
  }
  for (const key of Object.keys(result) as (keyof SignalSettings)[]) {
    const value = result[key];
    if (/Image$|^logo$|Link\d*$/.test(key)) {
      (result as Record<string, unknown>)[key] = safeSignalUrl(value, String(SIGNAL_DEFAULTS[key]));
      if (/Link\d*$/.test(key) && !/^\/(?!\/)/.test(String(result[key]))) (result as Record<string, unknown>)[key] = SIGNAL_DEFAULTS[key];
    }
    if (/Color$|Background$|^primary$|^accent$|^ink$|^background$/.test(key) && !/^#[\da-f]{6}$/i.test(String(value))) (result as Record<string, unknown>)[key] = SIGNAL_DEFAULTS[key];
    const bounds = SIGNAL_NUMBERS[key];
    if (bounds) (result as Record<string, unknown>)[key] = typeof value === 'number' && Number.isFinite(value) ? Math.min(bounds[1],Math.max(bounds[0],value)) : SIGNAL_DEFAULTS[key];
    const choices = SIGNAL_CHOICES[key];
    if (choices && !choices.some(([choice]) => choice === value)) (result as Record<string, unknown>)[key] = SIGNAL_DEFAULTS[key];
  }
  // Global palette remains the default until a section receives an explicit colour.
  for (const [key, source] of [['buttonBackground','primary'],['ribbonBackground','primary'],['heroTextColor','ink'],['storyTextColor','ink'],['headerTextColor','ink'],['stepsTextColor','ink'],['heroBackground','background'],['storyBackground','background'],['stepsBackground','background']] as const) {
    if (!(key in data) || (source in explicit && !(key in explicit))) result[key] = result[source];
  }
  // The full editor palette and font panels also drive the recipe's own components.
  const editorBank = branding?.themeSettings?.wideFormatEditor as Record<string, {patch?: {colors?: Record<string,string>; fonts?: Record<string,string>}}> | undefined;
  const shared = editorBank?.[recipe.id]?.patch;
  if (shared?.colors) {
    const c = shared.colors;
    for (const [key, value] of Object.entries({primary:c.primary, background:c.background, ink:c.headingText, buttonBackground:c.primary, ribbonBackground:c.primary, heroBackground:c.background, storyBackground:c.background, stepsBackground:c.background, heroTextColor:c.headingText, storyTextColor:c.bodyText, stepsTextColor:c.bodyText})) {
      if (value && /^#[\da-f]{6}$/i.test(value)) (result as Record<string, unknown>)[key] = value;
    }
  }
  if (shared?.fonts?.heading && /^[a-z0-9 .-]{1,80}$/i.test(shared.fonts.heading)) result.headingFont = shared.fonts.heading;
  if (shared?.fonts?.body && /^[a-z0-9 .-]{1,80}$/i.test(shared.fonts.body)) result.bodyFont = shared.fonts.body;
  return result;
}
export function withSignalSettings<T extends {themeSettings?: Record<string, unknown>}>(branding: T, patch: Partial<SignalSettings>): T {
  const design=wideFormatDesign(branding.themeSettings?.wideFormatDesign).id;
  const themeSettings={...branding.themeSettings};
  if (patch.dropdownStyle) themeSettings.wideFormatMenu=patch.dropdownStyle;
  if(design==='signal') themeSettings.pvcbannerSignal={...(themeSettings.pvcbannerSignal as Record<string,unknown> || {}),...patch};
  else { const overrides=themeSettings.wideFormatOverrides as Record<string,unknown> || {}; themeSettings.wideFormatOverrides={...overrides,[design]:{...(overrides[design] as Record<string,unknown> || {}),...patch}}; }
  return {...branding,themeSettings};
}
