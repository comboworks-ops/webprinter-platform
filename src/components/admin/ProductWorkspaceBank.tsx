import { lazy, Suspense, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { prepareProductLayoutSave } from '@/lib/products/productLayoutSave';
import { liveWorkspaceStructure, type WorkspaceStructure } from '@/lib/products/productWorkspace';

const SourceEditor = lazy(() => import('./ProductAttributeBuilder').then(module => ({ default: module.ProductAttributeBuilder })));

/** The existing bank edits the open workspace snapshot; applying returns to the
 * same draft instead of saving a competing product structure behind it. */
export function ProductWorkspaceBank({ product, draft, sectionId, onApply, onClose }: {
  product: { id: string; tenant_id: string; name: string; slug: string };
  draft: WorkspaceStructure;
  sectionId?: string;
  onApply: (structure: WorkspaceStructure) => void;
  onClose: () => void;
}) {
  const [snapshot] = useState(() => liveWorkspaceStructure(draft));
  const [dirty, setDirty] = useState(false);
  const close = () => { if (!dirty || window.confirm('Luk banken uden at bruge ændringerne på produktsiden?')) onClose(); };
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="pw-bank-dialog max-w-6xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Format- og materialebank</DialogTitle><DialogDescription>Vælg formater, materialer og efterbehandling til produktet. Brug valgene i din åbne kladde og se resultatet på produktsiden.</DialogDescription></DialogHeader>
      <Suspense fallback={<p role="status">Henter produktets bank…</p>}>
        <SourceEditor productId={product.id} tenantId={product.tenant_id} productName={product.name} productSlug={product.slug} tableName="generic_product_prices" surface="product"
          workspaceDraft={snapshot} workspaceSectionId={sectionId} onWorkspaceDirtyChange={setDirty}
          onWorkspaceApply={candidate => { onApply(prepareProductLayoutSave(snapshot, snapshot, candidate)); onClose(); }} />
      </Suspense>
    </DialogContent>
  </Dialog>;
}
