import { useContext, useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { FolderDefinition } from '@/lib/mockup/folderDefinition';
import { SharedButtonContext } from '@/components/storefront/SharedButtonContext';
import { buildBrandingCssVariables } from '@/lib/branding/themeVariables';
import { printJourneyAttributes } from '@/lib/branding/printJourney';
import { folderPrintLabel, type FolderPrintMode } from '@/lib/mockup/productFolderPreview';
import type { BrandingData } from '@/lib/branding/types';
import { FolderPreviewLoading, FolderPreviewSurface } from './FolderPreviewSurface';
import './folderMockup.css';

interface Props {
  definition: FolderDefinition | null;
  getArtwork?: () => Promise<string>;
  productPreview?: { color: string; print: FolderPrintMode };
  brandingOverride?: Partial<BrandingData> | null;
  disabled?: boolean;
  compact?: boolean;
}
export function FolderMockupButton({ definition, getArtwork, productPreview, brandingOverride, disabled, compact }: Props) {
  const inheritedBranding = useContext(SharedButtonContext);
  const branding = brandingOverride ?? inheritedBranding;
  const journey = printJourneyAttributes(branding);
  const [open, setOpen] = useState(false);
  const [artwork, setArtwork] = useState<string | null>(null);
  const [error, setError] = useState('');
  const getArtworkRef = useRef(getArtwork);
  getArtworkRef.current = getArtwork;
  const isProduct = !!productPreview;
  const printMode = productPreview?.print ?? definition?.print ?? '4+0';
  const label = isProduct ? 'Se mappen i 3D' : 'Se dit design i 3D';
  useEffect(() => {
    let cancelled = false;
    setArtwork(null); setError('');
    if (open && definition && !isProduct && getArtworkRef.current) {
      void getArtworkRef.current().then(url => {
        if (!cancelled) setArtwork(url);
      }).catch(() => {
        if (!cancelled) setError('Forhåndsvisningen kunne ikke indlæses. Luk den og prøv igen.');
      });
    }
    return () => { cancelled = true; };
  }, [open, definition, isProduct]);
  if (!definition) return null;
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" variant="outline" disabled={disabled}
      className={compact ? 'h-11 w-11 shrink-0 px-0 xl:w-auto xl:px-3' : 'min-h-11 gap-2'}
      title={label} aria-label={label}>
      <Box className={compact ? 'h-4 w-4 xl:mr-2' : 'h-4 w-4'} />
      <span className={compact ? 'hidden whitespace-nowrap xl:inline' : ''}>{label}</span>
    </Button></DialogTrigger>
    <DialogContent className="folder-mockup-dialog" {...journey}
      style={{ ...(branding ? buildBrandingCssVariables(branding) : {}), ...journey.style }} onKeyDown={event => {
      // Keep editor shortcuts from modifying artwork while the preview has focus.
      // Escape must reach Radix's dismiss handler.
      if (event.key !== 'Escape') event.stopPropagation();
    }}>
      <DialogHeader className="folder-mockup-heading"><DialogTitle>{isProduct ? 'Se mappens folder' : 'Dit design. Fra alle sider.'}</DialogTitle>
        <DialogDescription>{definition.label} · {folderPrintLabel(printMode)}</DialogDescription>
      </DialogHeader>
      {error ? <p role="alert" className="folder-mockup-message">{error}</p> : isProduct || artwork ?
        <FolderPreviewSurface definition={definition} artwork={artwork ?? undefined} productPreview={productPreview} /> : <FolderPreviewLoading />}
      <p className="folder-mockup-footnote">{isProduct
        ? 'Farven viser trykfladerne. Dit eget design tilføjes ved upload eller i designeren.'
        : 'Indersiden er utrykt. Farver og de små låsesnit er vejledende. Kontrollér trykfilen i korrekturvisningen.'}</p>
    </DialogContent>
  </Dialog>;
}
