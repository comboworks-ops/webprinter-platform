import { FolderMockupButton } from './FolderMockupButton';
import { folderPreviewColor, resolveProductFolderPreview, type FolderProductSelection } from '@/lib/mockup/productFolderPreview';
import type { DesignerTemplateLaunch } from '@/lib/designer/productTemplateLinks';
import type { BrandingData } from '@/lib/branding/types';

/** A small action in the order section; reads the selected template, never changes the order. */
export function ProductFolderPreviewButton({ template, branding, ...selection }: FolderProductSelection & {
  template?: DesignerTemplateLaunch | null;
  branding?: Partial<BrandingData> | null;
}) {
  const preview = resolveProductFolderPreview(template?.templatePdfSha256, selection);
  if (!preview) return null;
  return <FolderMockupButton key={`${preview.definition.id}:${preview.print}`} definition={preview.definition}
    productPreview={{ color: folderPreviewColor(branding?.colors?.primary), print: preview.print }} brandingOverride={branding} />;
}
