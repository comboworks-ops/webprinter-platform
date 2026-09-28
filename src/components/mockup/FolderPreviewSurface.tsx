import { Component, lazy, Suspense, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import type { FolderDefinition } from '@/lib/mockup/folderDefinition';
import type { FolderPrintMode } from '@/lib/mockup/productFolderPreview';
import './folderMockup.css';

const FolderViewer = lazy(() => import('./FolderViewer'));

/** Shared renderer for the product gallery and customer-artwork dialogs. */
export function FolderPreviewSurface(props: {
  definition: FolderDefinition;
  artwork?: string;
  compactControls?: boolean;
  productPreview?: { color: string; print: FolderPrintMode };
}) {
  return <ViewerBoundary artwork={props.artwork}><Suspense fallback={<FolderPreviewLoading />}>
    <FolderViewer {...props} />
  </Suspense></ViewerBoundary>;
}

export function FolderPreviewLoading() {
  return <div className="folder-mockup-message" role="status"><Loader2 className="h-5 w-5 animate-spin" /> Åbner 3D-visningen…</div>;
}

class ViewerBoundary extends Component<{ artwork?: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="folder-mockup-stage-wrap"><div className="folder-mockup-stage" />
      <div className="folder-mockup-fallback"><p role="alert">3D-visningen kunne ikke åbnes.</p>{this.props.artwork && <img src={this.props.artwork} alt="Din udfoldede trykflade" />}</div>
    </div>;
  }
}
