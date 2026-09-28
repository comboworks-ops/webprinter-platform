import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AnchorZone, TooltipConfig } from './ProductPagePreview';
import { UNAVAILABLE_OPTION_ANCHOR } from '@/lib/products/optionAvailability';

export function AvailabilityTooltipEditor({ anchors, tooltips, onChange }: {
  anchors: AnchorZone[];
  tooltips: TooltipConfig[];
  onChange: (tooltips: TooltipConfig[]) => void;
}) {
  const [anchor, setAnchor] = useState(UNAVAILABLE_OPTION_ANCHOR);
  const existing = tooltips.find(tooltip => tooltip.anchor === anchor);
  return <Card>
    <CardHeader><CardTitle>Utilgængelige valg</CardTitle>
      <p className="text-sm text-muted-foreground">Alle produktets valgmuligheder bliver stående. Grå valg kan trykkes på for at se, hvilke andre valg der gør dem tilgængelige.</p>
    </CardHeader>
    <CardContent className="space-y-4">
      <Label htmlFor="availability-tooltip-anchor">Hjælpetekst til</Label>
      <select id="availability-tooltip-anchor" value={anchor} onChange={event => setAnchor(event.target.value)} className="min-h-11 w-full rounded-md border bg-background px-3 text-sm">
        <option value={UNAVAILABLE_OPTION_ANCHOR}>Standard for alle utilgængelige valg</option>
        {anchors.filter(zone => zone.id.startsWith(`${UNAVAILABLE_OPTION_ANCHOR}:`)).map(zone =>
          <option key={zone.id} value={zone.id}>{zone.labelDa}</option>)}
      </select>
      <AvailabilityTextForm key={`${anchor}:${existing?.text || ''}`} anchor={anchor} existing={existing}
        onSave={text => onChange([...tooltips.filter(tooltip => tooltip.anchor !== anchor), {
          ...existing, anchor, text, icon: existing?.icon || 'info', color: existing?.color || '#0EA5E9', animation: existing?.animation || 'fade',
        }])}
        onReset={() => onChange(tooltips.filter(tooltip => tooltip.anchor !== anchor))} />
    </CardContent>
  </Card>;
}

function AvailabilityTextForm({ anchor, existing, onSave, onReset }: {
  anchor: string; existing?: TooltipConfig; onSave: (text: string) => void; onReset: () => void;
}) {
  const [text, setText] = useState(existing?.text || '');
  return <div className="space-y-3">
    <Label htmlFor="availability-tooltip-text">Forklaring</Label>
    <Textarea id="availability-tooltip-text" value={text} onChange={event => setText(event.target.value)} maxLength={1200}
      placeholder="{option} er ikke tilgængelig med dine nuværende valg." />
    <p className="text-sm text-muted-foreground">Brug {'{option}'} for navnet på valget. De mulige kombinationer tilføjes automatisk nedenunder ud fra produktets data.</p>
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={!text.trim() || text.trim() === existing?.text} onClick={() => onSave(text.trim())}>Gem hjælpetekst</Button>
      <Button type="button" variant="outline" disabled={!existing} onClick={onReset}>{anchor === UNAVAILABLE_OPTION_ANCHOR ? 'Brug automatisk tekst' : 'Brug produktets standardtekst'}</Button>
    </div>
  </div>;
}
