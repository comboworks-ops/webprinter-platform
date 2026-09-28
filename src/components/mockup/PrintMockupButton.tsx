import { useContext, useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SharedButtonContext } from '@/components/storefront/SharedButtonContext';
import { buildBrandingCssVariables } from '@/lib/branding/themeVariables';
import { printJourneyAttributes } from '@/lib/branding/printJourney';
import type { BrandingData } from '@/lib/branding/types';
import type { ApprovedPrintModel, PrintArtwork } from '@/lib/mockup/approvedPrintModels';
import { PrintPreviewSurface } from './PrintPreviewSurface';
import './folderMockup.css';

export function PrintMockupButton({ model, getArtwork, disabled, compact, brandingOverride }: {
  model: ApprovedPrintModel | null; getArtwork: () => Promise<PrintArtwork>; disabled?: boolean; compact?: boolean;
  brandingOverride?: Partial<BrandingData> | null;
}) {
  const inherited = useContext(SharedButtonContext), branding = brandingOverride ?? inherited;
  const journey = printJourneyAttributes(branding);
  const [open, setOpen] = useState(false), [error, setError] = useState('');
  const [artwork, setArtwork] = useState<PrintArtwork>();
  const capture = useRef(getArtwork); capture.current = getArtwork;
  useEffect(() => {
    let cancelled = false;
    setArtwork(undefined); setError('');
    if (open && model) void capture.current().then(result => { if (!cancelled) setArtwork(result); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Forhåndsvisningen kunne ikke åbnes.'); });
    return () => { cancelled = true; };
  }, [open, model]);
  if (!model) return null;
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" variant="outline" disabled={disabled}
      className={compact ? 'h-11 w-11 shrink-0 px-0 xl:w-auto xl:px-3' : 'min-h-11 gap-2'}
      title="Se dit design i 3D" aria-label="Se dit design i 3D">
      <Box className={compact ? 'h-4 w-4 xl:mr-2' : 'h-4 w-4'} /><span className={compact ? 'hidden whitespace-nowrap xl:inline' : ''}>Se dit design i 3D</span>
    </Button></DialogTrigger>
    <DialogContent className="folder-mockup-dialog" {...journey}
      style={{ ...(branding ? buildBrandingCssVariables(branding) : {}), ...journey.style }}
      onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation(); }}>
      <DialogHeader className="folder-mockup-heading"><DialogTitle>Dit design. Fra alle sider.</DialogTitle><DialogDescription>{model.label}</DialogDescription></DialogHeader>
      {error ? <p role="alert" className="folder-mockup-message">{error}</p> : artwork
        ? <PrintPreviewSurface model={model} artwork={artwork} /> : <p role="status" className="folder-mockup-message">Forbereder dit design…</p>}
      <p className="folder-mockup-footnote">3D viser placering og foldning. Kontrollér den færdige trykfil i korrekturen.</p>
    </DialogContent>
  </Dialog>;
}
