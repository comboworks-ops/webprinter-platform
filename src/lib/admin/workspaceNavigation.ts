export interface AdminWorkspaceLink {
  label: string;
  path: string;
  masterOnly?: boolean;
  tenantOnly?: boolean;
  iconStudio?: boolean;
  advanced?: boolean;
}

export interface AdminWorkspaceGroup {
  id: string;
  label: string;
  links: AdminWorkspaceLink[];
}

// Presentation only. The existing route and server authorization remains authoritative.
const groups: AdminWorkspaceGroup[] = [
  { id: 'overview', label: 'Overblik', links: [
    { label: 'Overblik', path: '/admin' },
    { label: 'Driftsklarhed', path: '/admin/commercial-readiness' },
  ] },
  { id: 'products', label: 'Produkter', links: [
    { label: 'Alle produkter', path: '/admin/products' },
    { label: 'Opret produkt', path: '/admin/create-product' },
    { label: 'Prismoduler', path: '/admin/prismoduler' },
    { label: 'Maskin-beregning', path: '/admin/machine-pricing' },
  ] },
  { id: 'orders', label: 'Ordrer', links: [
    { label: 'Ordreoversigt', path: '/admin/kunder' },
    { label: 'Printproduktion', path: '/admin/printproduktion', masterOnly: true },
  ] },
  { id: 'customers', label: 'Kunder', links: [
    { label: 'Beskeder', path: '/admin/beskeder' },
    { label: 'Firmahub', path: '/admin/companyhub' },
  ] },
  { id: 'shop', label: 'Shop moduler', links: [
    { label: 'Shop moduler', path: '/admin/moduler' },
    { label: 'Site Design V2', path: '/admin/site-design-v2' },
    { label: 'Branding', path: '/admin/branding-v2' },
    { label: 'Klassisk branding', path: '/admin/branding-classic' },
    { label: 'Produktbilleder', path: '/admin/icon-studio', iconStudio: true },
    { label: 'Sites', path: '/admin/sites' },
    { label: 'Print Designer', path: '/admin/print-designer' },
    { label: 'Design Bibliotek', path: '/admin/ressourcer/designs' },
    { label: 'Templatebibliotek', path: '/admin/designer-templates' },
    { label: 'Farveprofiler', path: '/admin/farveprofiler' },
  ] },
  { id: 'marketing', label: 'Marketing', links: [
    { label: 'SEO Manager', path: '/admin/seo' },
    { label: 'AI SEO', path: '/admin/ai-seo' },
  ] },
  { id: 'account', label: 'Min konto', links: [
    { label: 'Indstillinger', path: '/admin/indstillinger' },
    { label: 'Domæne', path: '/admin/domaene' },
    { label: 'Betaling', path: '/admin/indstillinger/betaling' },
    { label: 'Abonnement', path: '/admin/abonnement', tenantOnly: true },
    { label: 'Skabeloner', path: '/admin/skabeloner' },
    { label: 'Indbakke', path: '/admin/tenant-updates', tenantOnly: true },
  ] },
  { id: 'platform', label: 'Platform', links: [
    { label: 'Lejere', path: '/admin/tenants', masterOnly: true },
    { label: 'Supplier Bank', path: '/admin/supplier-bank', masterOnly: true },
    { label: 'Systemopdateringer', path: '/admin/updates', masterOnly: true },
    { label: 'Ressourcer', path: '/admin/resources', masterOnly: true },
    { label: 'Ikonbibliotek', path: '/admin/assets', masterOnly: true },
    { label: 'Platform Master Design', path: '/admin/branding-template', masterOnly: true },
    { label: 'Master skabeloner', path: '/admin/master-skabeloner', masterOnly: true },
    { label: 'Platform SEO', path: '/admin/platform-seo', masterOnly: true },
    { label: 'POD v1 administration', path: '/admin/pod', masterOnly: true, advanced: true },
    { label: 'POD v1 katalog', path: '/admin/pod-katalog', masterOnly: true, advanced: true },
    { label: 'POD v1 ordrer', path: '/admin/pod-ordrer', masterOnly: true, advanced: true },
    { label: 'POD v1 betaling', path: '/admin/pod-betaling', masterOnly: true, advanced: true },
    { label: 'POD v2 administration', path: '/admin/pod2', masterOnly: true, advanced: true },
    { label: 'POD v2 katalog', path: '/admin/pod2-katalog', masterOnly: true, advanced: true },
    { label: 'POD v2 ordrer', path: '/admin/pod2-ordrer', masterOnly: true, advanced: true },
    { label: 'POD v2 betaling', path: '/admin/pod2-betaling', masterOnly: true, advanced: true },
    { label: 'Flyer Alarm POD3', path: '/admin/pod3', masterOnly: true, advanced: true },
  ] },
];

export function getAdminWorkspaceGroups(access: { isMasterContext: boolean; hasIconStudio: boolean }) {
  return groups.map(group => ({ ...group, links: group.links.filter(link =>
    (!link.masterOnly || access.isMasterContext)
    && (!link.tenantOnly || !access.isMasterContext)
    && (!link.iconStudio || access.hasIconStudio),
  ) })).filter(group => group.links.length > 0);
}

export function withAdminWorkspaceContext(path: string, search: string): string {
  if (!/^\/admin(?:\/|\?|#|$)/.test(path)) return path;
  const context = new URLSearchParams(search).get('force_domain');
  if (!context) return path;
  const [withoutHash, hash] = path.split('#');
  const [pathname, query] = withoutHash.split('?');
  const params = new URLSearchParams(query);
  if (!params.has('force_domain')) params.set('force_domain', context);
  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ''}`;
}

export function getActiveAdminWorkspaceGroup(pathname: string): string | undefined {
  if (pathname.startsWith('/admin/product/')) return 'products';
  const candidates = groups.flatMap(group => group.links.map(link => ({ group: group.id, path: link.path })));
  return candidates.sort((a, b) => b.path.length - a.path.length).find(item =>
    pathname === item.path || (item.path !== '/admin' && pathname.startsWith(`${item.path}/`)),
  )?.group;
}
