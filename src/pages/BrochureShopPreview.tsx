import { useEffect, useState } from 'react';
import ProductPrice from './ProductPrice';
import { WorkspaceSourcesContext } from '@/components/product-price-page/workspacePreviewContext';
import type { BrochureSavedPreview } from '@/dev/brochureSavedPreview';

/** Local-only preview of the saved, unpublished product in the real shop. */
export default function BrochureShopPreview() {
  const [saved,setSaved]=useState<BrochureSavedPreview|null>(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;
    fetch('/brochure/saved-product.json').then(async response=>{
      if(!response.ok)throw Error('Produktets forhåndsvisning kunne ikke åbnes.');
      return response.json() as Promise<BrochureSavedPreview>;
    }).then(data=>{if(active)setSaved(data);}).catch(failure=>{if(active)setError(failure.message);});
    return()=>{active=false;};
  },[]);
  if(!saved)return <main className="brochure-product-main"><p role="status">{error||'Åbner brochuren…'}</p></main>;
  return <div data-brochure-saved-product={saved.product.id} data-brochure-import-complete={String(saved.completed)}>
    <WorkspaceSourcesContext.Provider value={{productId:saved.product.id,sourceGroups:saved.sourceGroups}}>
      <ProductPrice previewSlug={saved.product.slug} localBrochurePreview={saved}/>
    </WorkspaceSourcesContext.Provider>
  </div>;
}
