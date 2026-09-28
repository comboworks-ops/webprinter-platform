import type { BrandingData } from '@/hooks/useBrandingDraft';

export function SiteDesignHeroCopy({ hero, onChange }: {
  hero: BrandingData['hero']; onChange: (hero: BrandingData['hero']) => void;
}) {
  return <div className="sd-hero-copy-fields">
    <p>Hold budskabet kort og tydeligt. Du ser teksten direkte i previewet.</p>
    <label htmlFor="sd-hero-title">Overskrift</label>
    <textarea id="sd-hero-title" rows={3} value={hero.overlay.title} onChange={event => onChange({ ...hero, overlay: { ...hero.overlay, title: event.target.value } })} />
    <label htmlFor="sd-hero-subtitle">Undertekst</label>
    <textarea id="sd-hero-subtitle" rows={4} value={hero.overlay.subtitle} onChange={event => onChange({ ...hero, overlay: { ...hero.overlay, subtitle: event.target.value } })} />
  </div>;
}
