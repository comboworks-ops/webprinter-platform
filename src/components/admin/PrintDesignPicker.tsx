import { Check } from 'lucide-react';
import { DEFAULT_PRINT_DESIGN_ID, PRINT_DESIGN_PRESETS } from '@/lib/branding/printDesignPresets';

export function PrintDesignPicker({ value, onChange, compact = false }: { value?: string; onChange: (id: string) => void; compact?: boolean }) {
  return <section aria-label="Webprinter design" className={compact ? 'sd-design-picker' : undefined}>
    <h4 className="text-sm font-semibold">Vælg dit design</h4>
    <p className="mt-1 mb-4 text-xs leading-relaxed text-muted-foreground">Start med standarddesignet, eller vælg en af de fire variationer. Du kan tilpasse designet bagefter.</p>
    <div className="space-y-3">
      {PRINT_DESIGN_PRESETS.map(preset => <button key={preset.id} type="button" aria-pressed={value === preset.id} onClick={() => onChange(preset.id)} className={`group w-full overflow-hidden rounded-lg border text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 ${value === preset.id ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/60'}`}>
        <img src={preset.previewImage} alt={`${preset.name} – forhåndsvisning`} className="aspect-[1.406] w-full object-cover object-top" loading="lazy" />
        <span className="block border-t bg-background p-3">
          <span className="flex items-center gap-2 text-xs font-semibold"><span>{preset.number}. {preset.name}</span>{preset.id === DEFAULT_PRINT_DESIGN_ID && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">Standard</span>}{value === preset.id && <Check className="ml-auto h-4 w-4 text-primary" />}</span>
          <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{preset.description}</span>
        </span>
      </button>)}
    </div>
  </section>;
}
