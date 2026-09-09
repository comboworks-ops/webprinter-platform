import { useState, type ReactNode } from 'react';
import { Home, LayoutTemplate, PanelsTopLeft, ShoppingBag, Palette, Type, PanelTop, PanelBottom, Image, SlidersHorizontal, ChevronDown, X, PanelRightOpen } from 'lucide-react';
import '@/styles/siteDesignWorkspace.css';

export function SiteDesignWorkspace({ title = 'Site Design', description, status, actions, moreActions, navigation, inspector, inspectorTitle, inspectorOpen, onInspectorClose, onInspectorOpen, children }: {
  title?: string; description: string; status: string; actions: ReactNode; moreActions?: ReactNode;
  navigation: ReactNode; inspector: ReactNode; inspectorTitle: string; inspectorOpen: boolean;
  onInspectorClose: () => void; onInspectorOpen: () => void; children: ReactNode;
}) {
  return <section className="site-design-workspace" data-inspector-open={inspectorOpen}>
    <header className="sd-workspace-heading">
      <div><h1>{title}</h1><p>{description}</p></div>
      <div className="sd-workspace-actions"><div className="sd-workspace-action-buttons">
        {moreActions && <details className="sd-workspace-more"><summary>Flere handlinger <ChevronDown size={14} /></summary><div>{moreActions}</div></details>}
        {actions}
      </div><p role="status">{status}</p></div>
    </header>
    <div className="sd-workspace-body">
      <aside className="sd-workspace-navigation">{navigation}</aside>
      <div className="sd-workspace-preview">{children}
        {!inspectorOpen && <button type="button" className="sd-open-inspector" onClick={onInspectorOpen}><PanelRightOpen size={16} /> Vis egenskaber</button>}
      </div>
      <aside className="sd-workspace-inspector" aria-label="Egenskaber" hidden={!inspectorOpen}>
        <header><div><span>Egenskaber</span><h2>{inspectorTitle}</h2></div><button type="button" aria-label="Luk egenskaber" onClick={onInspectorClose}><X size={18} /></button></header>
        <div className="sd-workspace-inspector-content">{inspector}</div>
      </aside>
    </div>
  </section>;
}

const primarySections = [
  { id: 'theme', label: 'Shopdesign', icon: LayoutTemplate },
  { id: 'order-flow', label: 'Bestillingsflow', icon: ShoppingBag },
  { id: 'banner', label: 'Forsidens banner', icon: Image },
  { id: 'header', label: 'Header & menu', icon: PanelTop },
  { id: 'footer', label: 'Footer', icon: PanelBottom },
  { id: 'logo', label: 'Logo & favicon', icon: Image },
  { id: 'colors', label: 'Farver', icon: Palette },
  { id: 'typography', label: 'Typografi', icon: Type },
];

export function SiteDesignNavigation({ currentPage, activeSection, sections, onNavigate, onSectionChange, productSelect }: {
  currentPage: string; activeSection: string | null; sections: Array<{id: string; label: string}>;
  onNavigate: (path: string) => void; onSectionChange: (section: string) => void; productSelect?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const advanced = sections.filter(section => !primarySections.some(item => item.id === section.id));
  return <nav aria-label="Sider og designindstillinger">
    <h2>Sider</h2>
    <div className="sd-nav-pages">{[
      { path: '/', label: 'Forside', icon: Home }, { path: '/produkt', label: 'Produktside', icon: PanelsTopLeft }, { path: '/checkout', label: 'Checkout', icon: ShoppingBag },
    ].map(({path,label,icon:Icon}) => <button type="button" key={path} aria-current={(path === '/' ? currentPage === '/' || currentPage === '/shop' : path === '/produkt' ? currentPage.startsWith('/produkt/') : currentPage.startsWith(path)) ? 'page' : undefined} onClick={() => onNavigate(path)}><Icon size={17} />{label}</button>)}</div>
    {productSelect && <div className="sd-nav-product">{productSelect}</div>}
    <details className="sd-nav-other-pages"><summary>Flere sider <ChevronDown size={13} /></summary>{[
      { path: '/produkter', label: 'Produktoversigt' }, { path: '/grafisk-vejledning', label: 'Grafisk vejledning' }, { path: '/kontakt', label: 'Kontakt' }, { path: '/om-os', label: 'Om os' },
    ].map(page => <button type="button" key={page.path} aria-current={currentPage === page.path ? 'page' : undefined} onClick={() => onNavigate(page.path)}>{page.label}</button>)}</details>
    <h2>Tilpas design</h2>
    {primarySections.filter(section => sections.some(item => item.id === section.id)).map(({id,label,icon:Icon}) => <button type="button" key={id} aria-pressed={activeSection === id} onClick={() => onSectionChange(id)}><Icon size={17} />{label}</button>)}
    {advanced.length > 0 && <><button type="button" className="sd-nav-advanced" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={17} /> Flere indstillinger <ChevronDown size={13} /></button>
      {expanded && <div className="sd-nav-advanced-items">{advanced.map(section => <button type="button" key={section.id} aria-pressed={activeSection === section.id} onClick={() => onSectionChange(section.id)}>{section.label}</button>)}</div>}</>}
  </nav>;
}
