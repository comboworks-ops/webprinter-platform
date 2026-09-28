export interface TooltipTarget {
  page: string;
  productId?: string;
  rootAttribute?: 'data-tooltip-product' | 'data-tooltip-anchor' | 'data-site-design-target' | 'data-branding-id' | 'id';
  rootValue?: string;
  tag?: string;
  text?: string;
  label: string;
  x?: number;
  y?: number;
}
const rootAttributes = ['data-tooltip-anchor', 'data-tooltip-product', 'data-site-design-target', 'data-branding-id', 'id'] as const;
const leafSelector = 'button,a,img,h1,h2,h3,h4,p,label,span,strong,small,th,td';
const normalize = (text: string | null) => (text || '').replace(/\s+/g, ' ').trim();
export function captureTooltipTarget(element: Element, page: string): TooltipTarget | null {
  const leaf = element.closest(leafSelector) || element;
  if (leaf.closest('[data-tooltip-overlay],input,textarea,select')) return null;
  let root: Element | null = null;
  let rootAttribute: typeof rootAttributes[number] | undefined;
  for (let node: Element | null = leaf; node; node = node.parentElement) {
    const attribute = rootAttributes.find(attr => {
      const value = node?.getAttribute(attr);
      return value && !(attr === 'id' && /^(radix-|:r|headlessui-)/.test(value));
    });
    if (attribute) { root = node; rootAttribute = attribute; break; }
  }
  const text = normalize(leaf.textContent).slice(0, 500);
  if (!root && !text) return null;
  return {
    page: page.split('?')[0], productId: leaf.closest('[data-tooltip-product]')?.getAttribute('data-tooltip-product') || undefined,
    rootAttribute, rootValue: rootAttribute ? root?.getAttribute(rootAttribute) || undefined : undefined,
    ...(root === leaf ? {} : { tag: leaf.tagName.toLowerCase(), text }),
    label: (leaf.getAttribute('aria-label') || leaf.getAttribute('alt') || text || root?.getAttribute(rootAttribute!) || 'Element').slice(0, 100), x: 100, y: 0,
  };
}
export function findTooltipTarget(doc: Document, target: TooltipTarget): Element | null {
  let scopes: Element[] = [doc.body];
  if (target.productId) scopes = Array.from(doc.querySelectorAll('[data-tooltip-product]')).filter(el => el.getAttribute('data-tooltip-product') === target.productId);
  let roots = scopes;
  if (target.rootAttribute && rootAttributes.includes(target.rootAttribute) && target.rootValue) {
    roots = scopes.flatMap(scope => [scope, ...scope.querySelectorAll(`[${target.rootAttribute}]`)]).filter(el => el.getAttribute(target.rootAttribute!) === target.rootValue);
  }
  if (target.tag) {
    if (!/^[a-z][a-z0-9]*$/.test(target.tag)) return null;
    roots = roots.flatMap(root => [...root.querySelectorAll(target.tag!)]).filter(el => normalize(el.textContent) === target.text);
  }
  const visible = [...new Set(roots)].filter(el => !el.closest('[data-tooltip-overlay]') && el.getClientRects().length > 0);
  // Do not silently attach to a different occurrence of duplicated text.
  return visible.length === 1 ? visible[0] : null;
}
