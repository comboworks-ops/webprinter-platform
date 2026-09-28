import { Button } from '@/components/ui/button';
import { quantityValueOptions, type QuantityTier } from '@/lib/checkout/quantityValue';

const money = (value: number) => value.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CheckoutProductValue({ name, imageUrl, settings, quantity, price, tiers, onEdit, onSelect }: {
  name: string; imageUrl?: string; settings: string[]; quantity: number; price: number;
  tiers: QuantityTier[]; onEdit: () => void; onSelect: (quantity: number, price: number) => void;
}) {
  const options = quantityValueOptions(tiers, quantity, price);
  return <section className="checkout-product-value space-y-5" aria-label="Dit produkt og mængderabat">
    <div className="flex items-start gap-4">
      {imageUrl && <img src={imageUrl} alt={name} className="h-20 w-20 shrink-0 object-contain" />}
      <div className="min-w-0 space-y-2">
        <h3 className="text-xl font-semibold">Dit produkt</h3>
        <p className="font-medium break-words">{name}</p>
        <p className="text-sm text-muted-foreground break-words">{settings.join(' · ')}</p>
        <Button type="button" variant="outline" className="min-h-11 h-auto whitespace-normal" onClick={onEdit}>Skift papir og tilvalg</Button>
      </div>
    </div>
    <div className="bg-primary/5 p-4 space-y-1" aria-label="Valgt antal og pris">
      <p className="text-sm font-semibold text-primary">Valgt</p>
      <div className="flex flex-wrap justify-between gap-2 font-semibold"><span>{quantity.toLocaleString('da-DK')} stk.</span><span>{money(price)} kr.</span></div>
      <p className="text-sm text-muted-foreground">{quantity > 0 ? money(price / quantity) : '—'} kr. pr. stk. · ekskl. moms</p>
    </div>
    {options.length > 0 ? <div className="space-y-3">
      <h4 className="font-semibold">Flere eksemplarer – samme indstillinger</h4>
      {options.map(option => <div key={option.quantity} className="space-y-2 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap justify-between gap-2 font-semibold"><span>{option.quantity.toLocaleString('da-DK')} stk.</span><span>{money(option.price)} kr.</span></div>
        <p className="text-sm text-muted-foreground">{money(option.unitPrice)} kr. pr. stk. · ekskl. moms</p>
        <p className="text-sm">{option.difference >= 0 ? `${money(option.difference)} kr. mere i alt` : `${money(-option.difference)} kr. mindre i alt`}
          {option.savingPercent > 0 && <span className="block font-medium text-primary">Spar {option.savingPercent}% pr. stk.</span>}</p>
        <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => onSelect(option.quantity, option.price)}>Vælg {option.quantity.toLocaleString('da-DK')} stk.</Button>
      </div>)}
    </div> : <p className="text-sm text-muted-foreground">Se andre antal, papir og priser under “Skift papir og tilvalg”.</p>}
  </section>;
}
