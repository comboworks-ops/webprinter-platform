/** Reject unsafe Fabric SVG before it reaches the live document or svg2pdf. */
export function validateProductionSvg(parsed:Document):SVGSVGElement {
  if(parsed.querySelector('parsererror')) throw new Error('Objektets SVG kunne ikke læses.');
  const allowed=new Set(['svg','g','path','rect','circle','ellipse','polygon','polyline','line','defs','clippath','text','tspan']);
  for(const element of Array.from(parsed.querySelectorAll('*'))){
    if(element.namespaceURI!=='http://www.w3.org/2000/svg'||!allowed.has(element.localName.toLowerCase())) throw new Error(`SVG-effekten ${element.localName} kræver rasterisering.`);
    for(const attribute of Array.from(element.attributes)){
      if(/^on/i.test(attribute.name)||/href$/i.test(attribute.name)||/url\(\s*['"]?(?!#)/i.test(attribute.value)) throw new Error('Eksterne SVG-referencer understøttes ikke i vektoreksport.');
    }
  }
  return parsed.documentElement as unknown as SVGSVGElement;
}
