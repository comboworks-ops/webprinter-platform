import { Component, lazy, Suspense, useMemo, type ReactNode } from 'react';
import { createBrandedPrintArtwork } from '@/lib/mockup/printModelArtwork';
import type { ApprovedPrintModel, PrintArtwork } from '@/lib/mockup/approvedPrintModels';
import './printPreview.css';
const Flat = lazy(() => import('./FlatPrintViewer'));
const Half = lazy(() => import('./HalfFoldViewer'));
const Roll = lazy(() => import('./RollFoldViewer'));
const Zigzag = lazy(() => import('./ZigzagFoldViewer'));
const SalesFolder = lazy(() => import('./SalesFolderViewer'));
const Spine = lazy(() => import('./SpineFolderViewer'));

export function PrintPreviewSurface({ model, artwork, color, compact }: {
  model: ApprovedPrintModel; artwork?: PrintArtwork; color?: string; compact?: boolean;
}) {
  const textures = useMemo(() => artwork ?? createBrandedPrintArtwork(model, color), [artwork, model, color]);
  return <div className={`print-preview-surface${compact ? ' print-preview-compact' : ''}`}>
    <PrintBoundary key={model.definition.id}><Suspense fallback={<p className="folder-mockup-message" role="status">Åbner 3D-visningen…</p>}>
      {model.kind === 'flat' ? <Flat definition={model.definition} artwork={textures.outside} />
        : model.kind === 'sales-folder' ? model.pages === 2 && !textures.inside
          ? <p role="alert">Begge tryksider skal være klar, før 3D-visningen kan åbnes.</p>
          : <SalesFolder definition={model.definition} artwork={textures} />
        : model.kind === 'spine' ? <Spine definition={model.definition} artwork={textures.outside} />
        : !textures.inside ? <p role="alert">Begge opslag skal være klar, før 3D-visningen kan åbnes.</p>
          : model.kind === 'half' ? <Half definition={model.definition} artwork={{ outside: textures.outside, inside: textures.inside }} />
            : model.kind === 'roll' ? <Roll definition={model.definition} artwork={{ outside: textures.outside, inside: textures.inside }} />
              : <Zigzag definition={model.definition} artwork={{ outside: textures.outside, inside: textures.inside }} />}
    </Suspense></PrintBoundary>
  </div>;
}
class PrintBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p role="alert">3D-visningen kunne ikke åbnes. Du kan fortsat se og bestille produktet.</p> : this.props.children; }
}
