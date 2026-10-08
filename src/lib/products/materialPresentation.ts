import type { TooltipConfig } from '../../components/ProductTooltipIcon';

export type MaterialSource = { name: string; sourceName?: string; description?: string; meta?: { descriptionDa?: string; description?: string } | null };
export const materialTooltipAnchor = (sectionId: string, valueId: string) => `material:${sectionId}:${valueId}`;
// Exact supplier labels reviewed in the public Webprinter catalogue. Keep all
// selection-critical properties; retain the original wording in the help text.
const reviewedMaterialNames: Record<string,string> = {
  'Matt Monomeric Self-Adhesive Vinyl':'Mat monomerfolie',
  'Gloss Monomeric Self-Adhesive Vinyl':'Blank monomerfolie',
  'Matt Monomeric Self-Adhesive Vinyl with Grey Back':'Mat monomerfolie, grå bagside',
  'Gloss Polymeric Self-Adhesive Vinyl with grey back':'Blank polymerfolie, grå bagside',
  'Transparent Self-Adhesive Vinyl':'Transparent klæbefolie',
  'Matt PVC-Free Film with Grey Back':'Mat PVC-fri folie, grå bagside',
  'White PVC-Free EasyWall':'Hvid PVC-fri EasyWall',
};

/** Presentation only: never use the shortened label as a price/selection key. */
export function materialPresentation(source: MaterialSource) {
  const original = source.name.trim();
  const description = source.description || source.meta?.descriptionDa || source.meta?.description || '';
  // Keep unfamiliar material names intact rather than guessing their specification.
  const paper = /papir|paper|karton|cardstock|silk|offset|chromo|bestrøget|coated|kvalitetstryk/i.test(original);
  let label = reviewedMaterialNames[original] || original;
  if (paper) {
    const noteStart = label.indexOf('(');
    const notes = noteStart >= 0 ? label.slice(noteStart) : '';
    const withoutNotes = noteStart >= 0 ? label.slice(0,noteStart).trim() : label;
    if (/FSC|PEFC|preprint|standardpapir|ekstra kraftigt|skrivebart|egnet til|suitable for/i.test(notes)
      && /\d\s*(?:g|gsm)\b/i.test(withoutNotes) && /papir|paper|karton|silk|offset|chromo/i.test(withoutNotes)) label = withoutNotes;
    label = label.replace(/[,;·|\s–-]*(?:FSC|PEFC)[®™]?[ -]*(?:certificeret|certified)\b/gi, '');
    const first = label.split(/\s+[–—|]\s+|[;\n]|\.(?:\s|$)|,\s*(?=egnet|velegnet|anbefalet|suitable)|\s+(?=egnet til|velegnet til|suitable for)/i)[0].trim();
    if (/\d\s*(?:g(?:ram)?(?:\s*\/\s*m[²2])?|gsm)\b/i.test(first) && /papir|paper|karton|cardstock|silk|offset|chromo|bestrøget|coated/i.test(first)) label = first;
    label = label.replace(/^[,;·\s–-]+|[,;·\s–-]+$/g, '').trim() || original;
    const categoryAndSpec = label.match(/^[^:]+:\s*(.+)$/);
    if (categoryAndSpec && /papir|paper|karton|silk|offset|chromo/i.test(categoryAndSpec[1])) label = categoryAndSpec[1];
    label = label.replace(/(\d)\s*g\b/gi, '$1 g');
    label = label.replace(/\bkvalitetstryk på\s+/gi,'').replace(/\bkvalitetstryk\b/gi,'papir');
  }
  // A spacing-only adjustment is not additional information needing an icon.
  const normalized = (name: string) => name.trim().replace(/(\d)\s*g\b/gi, '$1 g');
  const text = [...new Set([normalized(original) !== normalized(label) ? original : '', source.sourceName && normalized(source.sourceName) !== normalized(original) ? source.sourceName : '', description.trim()].filter(Boolean))].join('\n\n');
  // Only show a certification badge for an explicit positive source statement.
  const claim = `${original}\n${source.sourceName || ''}\n${description}`;
  const fsc = /\bFSC[®™]?[ -]*(?:certificeret|certified)\b/i.test(claim)
    && !/(?:ikke|not|uden|non)[ -]*(?:FSC|certificeret|certified)|(?:ikke|not)[^.!\n]{0,30}\bFSC/i.test(claim);
  const recycled = /\bgenbrugspapir\b|\brecycled paper\b/i.test(claim)
    && !/(?:ikke|not|uden|non)[ -]*(?:genbrug|recycled)/i.test(claim);
  return { label, text, fsc, recycled };
}

export function materialTooltipDefaults(source: MaterialSource, sectionId: string, valueId: string): TooltipConfig[] {
  const presentation = materialPresentation(source);
  const anchor = materialTooltipAnchor(sectionId, valueId);
  const defaults: TooltipConfig[] = [];
  if (presentation.text) defaults.push({anchor, title: `Om ${presentation.label}`, icon:'question', color:'#64748b', animation:'fade', text:presentation.text});
  if (presentation.fsc) defaults.push({anchor:`${anchor}:fsc`, title:'FSC-certificeret', icon:'leaf', color:'#47755b', animation:'fade', text:'Materialet er angivet som FSC-certificeret i materialebeskrivelsen. FSC er en certificeringsordning for ansvarlig skovdrift og sporbarhed af skovbaserede materialer.', link:'https://fsc.org/en/what-the-fsc-labels-mean'});
  if (presentation.recycled) defaults.push({anchor:`${anchor}:recycled`, title:'Genbrugspapir',icon:'recycle',color:'#47755b',animation:'fade',text:'Materialebeskrivelsen angiver genbrugspapir. Den angivne genbrugsandel fremgår af materialets navn eller beskrivelse.'});
  return defaults;
}
