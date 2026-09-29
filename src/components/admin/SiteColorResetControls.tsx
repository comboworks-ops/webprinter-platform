import { useState } from 'react';
import type { BrandingData } from '@/hooks/useBrandingDraft';
import { resetSiteColors } from '@/lib/branding/siteColors';
import { readSharedButtons } from '@/lib/branding/sharedButtons';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export function SiteColorResetControls({ draft, updateDraft }: { draft: BrandingData; updateDraft: (patch: Partial<BrandingData>) => void }) {
  const [releaseLocks, setReleaseLocks] = useState(false);
  const locked = Object.keys(readSharedButtons(draft).overrides).length;
  return <div className="space-y-2 rounded-md border bg-muted/25 p-2.5 text-xs">
    <p className="leading-5 text-muted-foreground">{locked
      ? `${locked} knapindstillinger er låst med egne farver. De følger ikke de fælles farver. Lås dem op i knappens indstillinger, eller medtag dem i nulstillingen.`
      : 'Alle ulåste knapper følger farverne her. Brug Fælles knapper til form, effekter og særlige knapfarver.'}</p>
    <AlertDialog onOpenChange={() => setReleaseLocks(false)}>
      <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="h-8 text-xs">Nulstil kun farver</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Nulstil kun farver?</AlertDialogTitle><AlertDialogDescription>
          Det blå standardfarvesæt erstatter sidens farver og farvede baggrunde. Sidebaggrundens billede eller gradient erstattes af en ensfarvet baggrund. Dit valgte shopdesign, layout, skrifttyper, tekster, banner- og produktbilleder samt priser bevares. Gemte farvesæt og knapdesign bevares også. Ændringen kan fortrydes og vises først for kunderne efter Publicér.
        </AlertDialogDescription></AlertDialogHeader>
        {locked > 0 && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={releaseLocks} onChange={event => setReleaseLocks(event.target.checked)} /><span>Fjern også de {locked} lokale knaplåse, så alle knapper følger fælles farver</span></label>}
        <AlertDialogFooter><AlertDialogCancel>Annuller</AlertDialogCancel><AlertDialogAction onClick={() => updateDraft(resetSiteColors(draft, releaseLocks))}>Nulstil farver</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
