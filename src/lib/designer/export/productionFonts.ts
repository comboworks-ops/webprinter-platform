import fontkit from '@pdf-lib/fontkit';

const SVG_NS = 'http://www.w3.org/2000/svg';
interface FontSource { family: string; weight: string; italic: boolean; url: string }
const downloadedFonts = new Map<string, Promise<any>>();

function fontWeight(value: string) { return value === 'bold' ? 700 : value === 'normal' ? 400 : Number(value) || 400; }
function permittedFontUrl(raw: string, base = document.baseURI) {
  const url = new URL(raw, base);
  if (url.protocol !== 'https:' && url.origin !== location.origin) throw new Error('Unsupported font source');
  if (url.origin !== location.origin && url.hostname !== 'fonts.gstatic.com') throw new Error('Unsupported font source');
  return url.href;
}

function readFontFaces(css: string, base: string): FontSource[] {
  const sources: FontSource[] = [];
  for (const block of css.matchAll(/@font-face\s*\{([^}]+)\}/gi)) {
    const declaration = document.createElement('span').style;
    declaration.cssText = block[1];
    const family = declaration.getPropertyValue('font-family').replace(/["']/g, '').trim();
    const src = block[1].match(/src\s*:\s*([^;]+)/i)?.[1] || '';
    for (const match of src.matchAll(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/gi)) {
      try { sources.push({ family, weight: declaration.getPropertyValue('font-weight') || '400',
        italic: declaration.getPropertyValue('font-style') === 'italic', url: permittedFontUrl(match[1], base) }); }
      catch { /* Untrusted/unsupported external font sources do not enter the exporter. */ }
    }
  }
  return sources;
}

export async function discoverProductionFonts(): Promise<FontSource[]> {
  const sources: FontSource[] = [];
  const visited = new Set<string>();
  for (const sheet of Array.from(document.styleSheets)) {
    try { sources.push(...readFontFaces(Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n'), sheet.href || document.baseURI)); }
    catch {
      if (!sheet.href || visited.has(sheet.href)) continue;
      const url = new URL(sheet.href, document.baseURI);
      // Only already-linked stylesheets, and only the established font provider.
      if (url.origin !== location.origin && url.hostname !== 'fonts.googleapis.com') continue;
      visited.add(sheet.href);
      try {
        const response = await fetch(url.href);
        if (response.ok) sources.push(...readFontFaces(await response.text(), url.href));
      } catch { /* Offline fonts lead to an explicit per-object fallback, not a substituted font. */ }
    }
  }
  return sources;
}

async function resolveFont(sources: FontSource[], familyList: string, weight: string, italic: boolean, text: string) {
  const family = familyList.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
  const requestedWeight = fontWeight(weight);
  // Later @font-face declarations win matching-family ties in the browser;
  // this also prefers the Designer's local Inter over an earlier Google sheet.
  const candidates = sources.filter(source => {
    const weights = source.weight.split(/\s+/).map(fontWeight);
    const matchesWeight = weights.length === 2 ? requestedWeight >= weights[0] && requestedWeight <= weights[1] : requestedWeight === weights[0];
    return source.family.toLowerCase() === family && source.italic === italic && matchesWeight;
  }).reverse();
  for (const candidate of candidates) {
    let promise = downloadedFonts.get(candidate.url);
    if (!promise) {
      promise = fetch(candidate.url).then(async response => {
        if (!response.ok) throw new Error('Font download failed');
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > 15_000_000) throw new Error('Font exceeds export size limit');
        return fontkit.create(new Uint8Array(bytes));
      });
      downloadedFonts.set(candidate.url, promise);
      promise.catch(() => downloadedFonts.delete(candidate.url));
    }
    try {
      let font = await promise;
      if (font.variationAxes?.wght) font = font.getVariation({ wght: requestedWeight });
      if (Array.from(text).every(char => /\s/.test(char) || font.hasGlyphForCodePoint(char.codePointAt(0)))) return font;
    } catch { /* Try the next actually declared font subset/format. */ }
  }
  throw new Error(`Skriftdata mangler til ${familyList} (${weight}${italic ? ', kursiv' : ''}).`);
}

function numericPosition(element: Element, attribute: string, fallback = 0): number {
  const raw = element.getAttribute(attribute);
  if (raw === null) return fallback;
  if (!/^-?[\d.]+(?:px)?$/.test(raw)) throw new Error('Complex SVG text positioning requires raster fallback');
  return parseFloat(raw);
}

/** Outline only Fabric-generated SVG text, using the exact declared font bytes.
 * No substituted font and no browser/system-font extraction is attempted.
 */
export async function outlineProductionSvgText(svg: SVGSVGElement, sources: FontSource[]): Promise<number> {
  if (svg.querySelector('textPath')) throw new Error('Tekst på kurve kræver rasterisering af tekstobjektet.');
  let count = 0;
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-100000px;top:0;opacity:0;pointer-events:none';
  container.append(svg);
  document.body.append(container);
  try {
    for (const textElement of Array.from(svg.querySelectorAll('text'))) {
      const spans = Array.from(textElement.querySelectorAll('tspan'));
      const leaves = spans.length ? spans.filter(span => !span.querySelector('tspan')) : [textElement];
      if (spans.length && Array.from(textElement.childNodes).some(node => node.nodeType === 3 && node.textContent?.trim())) throw new Error('Mixed SVG text runs require raster fallback');
      const group = document.createElementNS(SVG_NS, 'g');
      for (const attr of Array.from(textElement.attributes)) {
        if (!['x', 'y', 'dx', 'dy'].includes(attr.name)) group.setAttribute(attr.name, attr.value);
      }
      for (const element of leaves) {
        const text = element.textContent || '';
        if (!text) continue;
        const style = getComputedStyle(element);
        const size = parseFloat(style.fontSize);
        const font = await resolveFont(sources, style.fontFamily, style.fontWeight, style.fontStyle === 'italic', text);
        const run = font.layout(text);
        const scale = size / font.unitsPerEm;
        const spacing = style.letterSpacing === 'normal' ? 0 : parseFloat(style.letterSpacing) || 0;
        let x = numericPosition(element, 'x', numericPosition(textElement, 'x')) + numericPosition(element, 'dx');
        const y = numericPosition(element, 'y', numericPosition(textElement, 'y')) + numericPosition(element, 'dy');
        const anchor = style.textAnchor;
        const advance = run.positions.reduce((sum: number, p: any) => sum + p.xAdvance * scale, 0) + Math.max(0, run.glyphs.length - 1) * spacing;
        if (anchor === 'middle') x -= advance / 2;
        if (anchor === 'end') x -= advance;
        for (let i = 0; i < run.glyphs.length; i++) {
          const position = run.positions[i];
          const path = document.createElementNS(SVG_NS, 'path');
          path.setAttribute('d', run.glyphs[i].path.toSVG());
          path.setAttribute('transform', `translate(${x + position.xOffset * scale} ${y - position.yOffset * scale}) scale(${scale} ${-scale})`);
          // Computed paint retains per-character Fabric styles, including alpha.
          path.setAttribute('fill', style.fill);
          path.setAttribute('fill-opacity', style.fillOpacity);
          path.setAttribute('stroke', style.stroke);
          path.setAttribute('stroke-width', String((parseFloat(style.strokeWidth) || 0) / scale));
          path.setAttribute('stroke-opacity', style.strokeOpacity);
          group.append(path);
          x += position.xAdvance * scale + spacing;
        }
        count++;
      }
      textElement.replaceWith(group);
    }
    return count;
  } finally { svg.remove(); container.remove(); }
}
