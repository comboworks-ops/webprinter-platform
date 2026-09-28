import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileImage, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AccountState } from '@/components/account/AccountShell';
import '@/styles/customerOverview.css';

export interface CustomerSavedDesign {
  id: string;
  name: string;
  width_mm: number;
  height_mm: number;
  preview_thumbnail_url: string | null;
  updated_at: string;
  product_id?: string | null;
}
export interface CustomerDesignsViewProps {
  designs: CustomerSavedDesign[];
  state: 'loading' | 'ready' | 'error';
  error?: string;
  onRetry?: () => void;
  link: (path: string) => string;
}

function DesignThumbnail({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="customer-design-thumbnail">{url && !failed ? <img src={url} alt={name} loading="lazy" onError={() => setFailed(true)} /> : <span className="customer-design-no-preview"><FileImage size={32} strokeWidth={1.3} aria-hidden="true" /><span>Forhåndsvisning mangler</span></span>}</div>;
}

export function CustomerDesignsView({ designs, state, error, onRetry, link }: CustomerDesignsViewProps) {
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLocaleLowerCase('da-DK');
  const filteredDesigns = designs.filter(design => design.name.toLocaleLowerCase('da-DK').includes(normalizedSearch));

  if (state === 'loading') return <AccountState kind="loading" title="Henter dine designs" />;
  if (state === 'error') return <AccountState kind="error" title="Vi kunne ikke hente dine designs" description={error || 'Prøv igen om et øjeblik. Dine gemte designs er ikke ændret.'} onRetry={onRetry} />;
  if (designs.length === 0) return <AccountState kind="empty" title="Her finder du dine gemte designs" description="Vælg et produkt i shoppen, åbn designeren, og gem dit design. Så kan du fortsætte herfra næste gang."><Button asChild className="customer-button"><Link to={link('/')}>Find et produkt <ArrowRight size={16} className="ml-2" /></Link></Button></AccountState>;

  return <div className="customer-designs">
    <div className="customer-designs-toolbar"><label className="customer-design-search"><Search size={20} aria-hidden="true" /><span className="sr-only">Søg i dine designs</span><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Søg i dine designs…" /></label><p>{filteredDesigns.length} {filteredDesigns.length === 1 ? 'design' : 'designs'}</p></div>
    {filteredDesigns.length === 0 ? <AccountState kind="empty" title="Ingen designs matcher din søgning" description="Prøv et andet navn, eller vis alle dine designs."><Button className="customer-button secondary" variant="outline" onClick={() => setSearch('')}>Ryd søgning</Button></AccountState> : <div className="customer-design-grid">{filteredDesigns.map(design => {
      const date = new Date(design.updated_at);
      const params = new URLSearchParams({ designId: design.id });
      if (design.product_id) params.set('productId', design.product_id);
      return <Link key={design.id} className="customer-design-item" to={link(`/designer?${params.toString()}`)}>
        <DesignThumbnail key={`${design.id}:${design.preview_thumbnail_url}`} url={design.preview_thumbnail_url} name={design.name} />
        <div className="customer-design-caption"><h2>{design.name}</h2><p>{design.width_mm.toLocaleString('da-DK')} × {design.height_mm.toLocaleString('da-DK')} mm</p>{!Number.isNaN(date.getTime()) && <p>Gemt {date.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}<span>Åbn design <ArrowRight size={16} aria-hidden="true" /></span></div>
      </Link>;
    })}</div>}
  </div>;
}
