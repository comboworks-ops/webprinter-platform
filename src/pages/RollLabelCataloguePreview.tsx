import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { StorefrontProductTabsView } from '@/components/StorefrontProductTabs';
import { MatrixLayoutV1Renderer } from '@/components/product-price-page/MatrixLayoutV1Renderer';
import { WorkspaceSourcesContext } from '@/components/product-price-page/workspacePreviewContext';
import { RollLabelConfiguration } from '@/components/product-price-page/RollLabelConfiguration';
import { ProductFormatGuidePanel } from '@/components/product-price-page/ProductFormatGuide';
import { buildStorefrontProductHref } from '@/lib/catalog/categoryLanding';
import { resolveRollLabelReviewProfile, rollLabelBlockerText, type RollLabelReviewIndex,
  type RollLabelReviewFamily } from '@/lib/products/rollLabelReview';
import '@/styles/rollLabelReview.css';
import type {RollLabelSelection} from '@/lib/products/rollLabelConfiguration';
import {rollLabelPriceInitialSelection,rollLabelPriceSelectionKey,type RollLabelPricePreview} from '@/lib/products/rollLabelPricePreview';
import {RollLabelPricePreviewPanel} from '@/components/product-price-page/RollLabelPricePreview';
import {RollLabelPriceMatrix} from '@/components/product-price-page/RollLabelPriceMatrix';

async function readReview<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  if (!response.ok) throw Error('Den lokale katalogprøve kunne ikke åbnes.');
  return response.json();
}

function FamilyReview({ family, slug }: { family: RollLabelReviewFamily; slug: string }) {
  const [selection, setSelection] = useState(family.initialSelection);
  const [prices,setPrices]=useState<RollLabelPricePreview|null>(null),[priceError,setPriceError]=useState('');
  const [rollSelection,setRollSelection]=useState<RollLabelSelection|null>(null),[seed,setSeed]=useState<RollLabelSelection|null>(null);
  const changed = useCallback((values: Record<string, string | null>) => setSelection(values), []);
  const profile = resolveRollLabelReviewProfile(family, selection);
  useEffect(()=>{
    const controller=new AbortController();
    readReview<RollLabelPricePreview>(`/roll-label-review/prices/${family.familyId}.json`,controller.signal).then(setPrices)
      .catch(failure=>{if(!controller.signal.aborted)setPriceError(failure.message);});
    return()=>controller.abort();
  },[family.familyId]);
  const initial=profile?(seed?.profileKey===profile.key?seed:rollLabelPriceInitialSelection(prices,profile.key,profile.optionStates?.initialStateId)):null;
  const matchingSelection=rollSelection?.profileKey===profile?.key?rollSelection:null;
  const choose=useCallback((value:RollLabelSelection)=>{setSeed(value);setRollSelection(value);},[]);
  const source = { productId: family.productId, sourceGroups: family.sourceGroups, configurationOnly: true };
  return <section data-roll-family={family.familyId} data-roll-selected-profile={profile?.key || ''}>
    <h1>{family.name}</h1><p className="roll-label-description">{family.description}</p>
    <Link to={`/produkt/${encodeURIComponent(slug)}?rollLabelPreview=${family.familyId}`}>Åbn produktet i det eksisterende system</Link>
    <p className="roll-label-status">Lokal gennemgang · {family.counts.articles} kildeartikler · produktet kan endnu ikke bestilles.</p>
    {family.existingProductToPreserve && <p className="roll-label-status">Det eksisterende Rullelabels-produkt bevares. Denne familie skal afstemmes med det inden import.</p>}
    {family.exactSelections.length > 0 ? <WorkspaceSourcesContext.Provider value={source}>
      <MatrixLayoutV1Renderer key={family.productId} productId={family.productId} pricingStructure={family.pricingStructure}
        rollLabelMatrix={<RollLabelPriceMatrix packet={prices} profile={profile} selection={matchingSelection} onChoose={choose}
          materialLabel={family.sourceGroups.flatMap(group=>group.values).find(value=>value.id===profile?.materialValueId)?.name || 'Valgt materiale'} />}
        exactCombinationSelections={family.exactSelections} initialSelection={family.initialSelection} onSelectionChange={changed}
        layout={{ design: 1, intro: <><h2>Form, format og materiale</h2><p>Valgene følger konkrete artikel- og materialepar fra kilden.</p></>,
          extras: profile ? <><RollLabelConfiguration key={family.productId}
            profile={profile} productId={family.productId} familyId={family.familyId} initialSelection={initial} onChange={setRollSelection} pricePreview />
            {profile.nativeGuide ? <ProductFormatGuidePanel data={profile.nativeGuide} /> : profile.customerArtworkRequired && !profile.sizeGeometry
              ? <p role="status">Den præcise filguide er endnu ikke klar for dette valg.</p> : null}</> : <p role="alert">Denne kombination er ikke dokumenteret.</p>,
          summary: <RollLabelPricePreviewPanel packet={prices} profile={profile} selection={matchingSelection} error={priceError} /> }} />
    </WorkspaceSourcesContext.Provider> : <p role="status">Familiens varianter afventer afklaring og er blokerede.</p>}
    <details className="roll-label-inventory"><summary>Alle {family.counts.articles} kildeartikler og blokerede varianter</summary>
      <ul>{family.articles.map(article => <li key={article.articleId} data-roll-article={article.articleId} data-roll-blocked={article.blockers.length > 0}>
        <strong>{article.name}</strong><small>Kildeartikel {article.articleId}</small>
        {article.blockers.map(reason => <p key={reason}>{rollLabelBlockerText(reason)}</p>)}
      </li>)}</ul>
    </details>
  </section>;
}

/** Development-only, read-only acceptance route over shared catalogue controls. */
export default function RollLabelCataloguePreview() {
  const [params, setParams] = useSearchParams();
  const familyId = params.get('family');
  const nativeNavigation = params.get('navigation') === 'native';
  const [index, setIndex] = useState<RollLabelReviewIndex | null>(null);
  const [family, setFamily] = useState<RollLabelReviewFamily | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    readReview<RollLabelReviewIndex>(`/roll-label-review/${nativeNavigation ? 'native-' : ''}catalogue.json`, controller.signal).then(setIndex)
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [nativeNavigation]);
  useEffect(() => {
    setFamily(null); setError('');
    if (!familyId || !index) return;
    if (!index.families.some(item => item.familyId === familyId)) { setError('Produktfamilien findes ikke i den lokale prøve.'); return; }
    const controller = new AbortController();
    readReview<RollLabelReviewFamily>(`/roll-label-review/families/${familyId}.json`, controller.signal).then(setFamily)
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [familyId, index]);
  const backParams = new URLSearchParams(params); backParams.delete('family');
  const catalog = index && { products: index.products, categories: [], categoryRecords: index.hierarchy.categories,
    overviews: [index.hierarchy.overview], loading: false, errorMessage: null, warningMessage: null };
  return <main className="roll-label-review">
    <header><Link to={`/roll-labels-preview?${backParams}`}>Klistermærker → Etiketter på rulle</Link><span>Lokal katalogprøve</span></header>
    {index && <label className="roll-label-family-picker"><span>Gå til produktfamilie</span><select value={familyId || ''} onChange={event => {
      const next = new URLSearchParams(params); if (event.target.value) next.set('family', event.target.value); else next.delete('family'); setParams(next);
    }}><option value="">Katalog · {index.counts.families} familier</option>{index.families.map(item => <option key={item.familyId} value={item.familyId}>{item.name}</option>)}</select></label>}
    {error ? <p role="alert">{error}</p> : !index || (familyId && !family) ? <p role="status">Åbner kataloget…</p> : familyId && family ? <FamilyReview key={familyId} family={family} slug={index.families.find(item=>item.familyId===familyId)?.slug || ''} /> : <>
      <h1>Etiketter på rulle</h1><p>Vælg produktgruppe og familie. {index.counts.families} familier med {index.counts.articles} kildeartikler.</p>
      <p className="roll-label-status">Lokal gennemgang med prisforslag for dokumenterede valg. Sortiment, moms og fragt er under klargøring; bestilling er endnu ikke åbnet.</p>
      {nativeNavigation && <p className="roll-label-status">Prøve med den eksisterende Klistermærker-kategori. Butik er ikke valgt, og eksisterende butiksprodukter er ikke indlæst i denne prøve.</p>}
      {catalog && <StorefrontProductTabsView catalog={catalog} pathnameOverride="/produkter" columns={3} productHref={product => {
        const target = buildStorefrontProductHref(product);
        if (target.startsWith('/produkter')) {
          const url = new URL(target, window.location.origin);
          if (nativeNavigation) url.searchParams.set('navigation', 'native');
          return `/roll-labels-preview?${url.searchParams}`;
        }
        const next = new URLSearchParams(params); next.set('family', String(product.technical_specs.local_review_family_id));
        return `/roll-labels-preview?${next}`;
      }} />}
    </>}
  </main>;
}
