import { Check } from 'lucide-react';
import { DEFAULT_PRINT_DESIGN_ID, PRINT_HOME_DESIGN_CHOICES } from '@/lib/branding/printDesignPresets';

export function PrintDesignPicker({ value, presentation, onChange, compact = false }: { value?: string; presentation?: unknown; onChange: (id: string) => void; compact?: boolean }) {
  const previewLabels: Record<string,string[]> = { 'print-atelier': ['Fotokrus','Fotobøger','Gaver'], 'print-signal': ['Bannere','Roll-ups','Skilte'], 'print-form': ['T-shirts','Hoodies','Merch'], 'print-partner': ['Tryksager','Søg produkt','Bestil'] };
  const selected = presentation === 'print-studio' ? 'print-studio' : value;
  return <section aria-label="Webprinter design" className={compact ? 'sd-design-picker' : undefined}>
    <h4 className="text-sm font-semibold">Vælg dit design</h4>
    <p className="mt-1 mb-4 text-xs leading-relaxed text-muted-foreground">Vælg et design til forsiden. Printstudio viser dit katalog på et fælles bord. De øvrige designs bruger deres egen produktopstilling.</p>
    <div className="space-y-3">
      {PRINT_HOME_DESIGN_CHOICES.map(preset => <button key={preset.id} type="button" aria-pressed={selected === preset.id} onClick={() => onChange(preset.id)} className={`group w-full overflow-hidden rounded-lg border text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 ${selected === preset.id ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/60'}`}>
        {preset.number > 5 && preset.id !== 'print-studio' ? <span className={`print-preset-preview print-preset-preview--${preset.id}`} aria-hidden="true"><span className="print-preset-preview-nav">webprinter <span>Produkter · Kontakt</span></span><span className="print-preset-preview-hero"><span>{preset.title}<i /></span><img src={preset.previewImage} alt="" loading="lazy" /></span><span className="print-preset-preview-categories">{(previewLabels[preset.id] || []).map(name=><span key={name}>{name}</span>)}</span></span> : <img src={preset.previewImage} alt={`${preset.name} – forhåndsvisning`} className="aspect-[1.406] w-full object-cover object-top" loading="lazy" />}
        <span className="block border-t bg-background p-3">
          <span className="flex flex-wrap items-center gap-2 text-xs font-semibold"><span className="min-w-0 break-words">{preset.number}. {preset.name}</span>{preset.id === DEFAULT_PRINT_DESIGN_ID && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">Standard</span>}{selected === preset.id && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}</span>
          <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{preset.description}</span>
        </span>
      </button>)}
    </div>
  </section>;
}
