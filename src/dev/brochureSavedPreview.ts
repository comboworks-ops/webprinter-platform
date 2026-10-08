import type { ProductAttributeGroup } from '@/hooks/useProductAttributes';
export interface BrochureSavedPreview {
  product: Record<string, unknown> & {id:string;slug:string;tenant_id:string};
  sourceGroups: ProductAttributeGroup[];
  completed: boolean;
  verifiedPriceRows: number;
}
