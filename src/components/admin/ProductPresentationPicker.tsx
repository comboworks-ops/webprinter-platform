import { Check, LayoutGrid } from 'lucide-react';
import { PRODUCT_PRESENTATIONS, resolveProductPresentation, type ProductPresentationId } from '@/lib/branding/productPresentations';

export function ProductPresentationPicker({ value, onChange }: { value: unknown; onChange: (value: ProductPresentationId) => void }) {
  const selected = resolveProductPresentation(value);
  return <section className="space-y-3" aria-label="Produktvisning">
    <div><h3 className="text-sm font-semibold">Produktvisning</h3><p className="mt-1 text-xs text-muted-foreground">Vælg en visning til forsiden og produktoversigten. Produktsektionen flyttes øverst på forsiden.</p></div>
    <div className="product-presentation-options grid grid-cols-1 gap-3 sm:grid-cols-2">
      {PRODUCT_PRESENTATIONS.map(item => <button type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => onChange(item.id)} className={`overflow-hidden rounded-lg border text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${selected === item.id ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary'}`}>
        <img src={item.image} alt="" loading="lazy" className="aspect-[1487/1058] w-full object-cover" />
        <span className="block p-3"><span className="flex items-center justify-between gap-2 text-sm font-semibold">{item.number}. {item.name}{selected === item.id && <Check size={16} aria-hidden="true" />}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.description}</span></span>
      </button>)}
    </div>
    <button type="button" className="flex min-h-11 items-center gap-2 text-xs underline underline-offset-4" onClick={() => onChange('standard')} aria-pressed={selected === 'standard'}><LayoutGrid size={15} aria-hidden="true" />Brug temaets oprindelige produktvisning{selected === 'standard' && <Check size={15} aria-hidden="true" />}</button>
  </section>;
}
