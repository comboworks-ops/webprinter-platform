import { usesWideFormat } from '@/lib/branding/wideFormatDesigns';
import type { BrandingData } from '@/hooks/useBrandingDraft';

/** Both shop families share the editor and its draft; switching never applies a preset. */
export function WideFormatShopPicker({branding,tenantId,onChange,disabled=false}: {branding:BrandingData;tenantId:string;onChange:(patch:Partial<BrandingData>)=>void;disabled?:boolean}) {
  return <div className="sd-shop-family">
    <label htmlFor="sd-shop-family">Shoptype</label>
    <select id="sd-shop-family" disabled={disabled} value={usesWideFormat(branding,tenantId)?'wide-format':'webprinter'} onChange={e=>onChange({themeSettings:{...branding.themeSettings,shopFamily:e.target.value}})}>
      <option value="webprinter">Webprinter · Printshop</option>
      <option value="wide-format">Storformat · Storefront</option>
    </select>
  </div>;
}
