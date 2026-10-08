/** Preserve source distinctions while presenting paper combinations in Danish. */
export function brochurePaperLabelDa(original) {
  return original.replaceAll('Inhalt:', 'Indhold:').replaceAll('Innenteil', 'Indhold').replaceAll('Umschlag', 'Omslag')
    .replaceAll('mattgestrichenes Recyclingpapier weiß', 'matbestrøget genbrugspapir, hvidt')
    .replaceAll('Bilderdruck matt', 'bestrøget papir, mat').replaceAll('Bilderdruck glänzend', 'bestrøget papir, blank')
    .replaceAll('Offset/Naturpapier weiß', 'offset-/naturpapir, hvid').replaceAll('Recyclingpapier weiß', 'genbrugspapir, hvid')
    .replaceAll('mit allen Exklusiv-Veredelungen (wählbar)', 'med valgfri specialfinish')
    .replaceAll('mit einfacher Veredelungsoption (wählbar)', 'med valgfri overfladebehandling')
    .replaceAll('wählbar', 'valgfrit papir').replaceAll('hochweiß', 'ekstra hvidt').replaceAll('hochglänzend', 'højblank')
    .replaceAll('Hochglanz', 'højblank').replaceAll('glänzend', 'blank').replaceAll('UV-Lack', 'UV-lak').replaceAll('matt', 'mat');
}
