import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MatrixLayoutV1Renderer } from '@/components/product-price-page/MatrixLayoutV1Renderer';
import { ProductPricePanel } from '@/components/product-price-page/ProductPricePanel';
import { WorkspaceSourcesContext } from '@/components/product-price-page/workspacePreviewContext';
import { resolveStorefrontProductFlow } from '@/lib/sites/storefrontProductFlow';
import { readSiteCheckoutSession } from '@/lib/checkout/siteCheckoutSession';
import type { BrochureFreeSizeConfig, BrochureFreeMatrixMeta } from '@/lib/pricing/brochureFreePricing';

import type { ProductAttributeGroup, ProductAttributeValue } from '@/hooks/useProductAttributes';
import type { ComponentProps } from 'react';
type PreviewPlan = { proposedProductId: string; freeSize: BrochureFreeSizeConfig; productGroups: ProductAttributeGroup[]; productValues: ProductAttributeValue[]; pricingStructure: ComponentProps<typeof MatrixLayoutV1Renderer>['pricingStructure'] & { brochureCompatibility: { version: 1; selections: Array<Record<string, string>> } } };

/** DEV-only acceptance harness for real storefront components with proposed
 * local catalogue IDs. No product provisioning or order/payment is enabled. */
export default function BrochureNativeProductPreview() {
  const [plan, setPlan] = useState<PreviewPlan | null>(null), [error, setError] = useState('');
  const [selection, setSelection] = useState<Record<string, string | null>>({});
  const [meta, setMeta] = useState<BrochureFreeMatrixMeta & { formatId?: string; materialId?: string }>({});
  const [cell, setCell] = useState<{ row: string; quantity: number; price: number } | null>(null);
  const [tiers, setTiers] = useState<Array<{ quantity: number; price: number }>>([]);
  const [summary, setSummary] = useState<string[]>([]);
  const changed = useCallback((values: Record<string, string | null>, formatId?: string, materialId?: string, details?: BrochureFreeMatrixMeta) => {
    setSelection(values); setMeta({ ...details, formatId, materialId });
  }, []);
  const clicked = useCallback((row: string, quantity: number, price: number) => setCell({ row, quantity, price }), []);
  useEffect(() => { let active = true;
    fetch('/brochure/product-resolution.json').then(response => { if (!response.ok) throw Error('Den lokale importplan kunne ikke åbnes.'); return response.json(); })
      .then(value => { if (active) setPlan(value); }).catch(failure => setError(failure.message));
    return () => { active = false; };
  }, []);
  if (!plan) return <main className="brochure-product-main"><p role="status">{error || 'Åbner lokal produktintegration…'}</p></main>;
  const config = plan.freeSize, first = config.articles.find((article) => article.pageCount === 8);
  if (!first) return <p role="alert">Brochureplanen mangler et gyldigt sidetal.</p>;
  const restored = readSiteCheckoutSession();
  const previous = restored?.productId === plan.proposedProductId ? restored : null;
  const initial = previous?.pricingQuote?.selectedSectionValues || {
    [config.axisSections.orientation]: config.orientationValueId, [config.axisSections.format]: config.formatValueId,
    [config.axisSections.pageCount]: first.pageCountValueId, [config.axisSections.cover]: config.neutralSelectionIds.cover,
    [config.axisSections.varnish]: config.neutralSelectionIds.varnish,
  };
  const sourceGroups = plan.productGroups.map((group) => ({ ...group, values: plan.productValues.filter((value) => value.group_id === group.id) }));
  const flow = resolveStorefrontProductFlow({ name: 'Brochurer med trådhæftning', pricing_type: 'matrix',
    technical_specs: { site_modes: { designer_mode: 'brochure', pricing_model: 'matrix' } } });
  const pricingQuote = cell?.quantity ? { productId: plan.proposedProductId, quantity: cell.quantity,
    formatId: meta.formatId, materialId: meta.materialId, verticalValueId: meta.verticalValueId,
    variantKey: meta.variantKey, selectedSectionValues: selection, brochureFree: meta.brochureFree,
    widthMm: meta.brochureFree?.widthMm, heightMm: meta.brochureFree?.heightMm, quantityTiers: tiers } : null;
  return <div className="brochure-product" data-native-brochure-quantity={cell?.quantity || 0} data-native-brochure-price={cell?.price || 0}
    data-native-brochure-width={meta.brochureFree?.widthMm || 0} data-native-brochure-height={meta.brochureFree?.heightMm || 0}
    data-native-brochure-template-hash={meta.brochureTemplate?.templatePdfSha256 || ''}>
    <header className="brochure-product-top"><Link to="/brochure-preview">Brochureforhåndsvisning</Link><span>Lokal prøve · produktet er endnu ikke importeret</span></header>
    <main className="brochure-product-main"><WorkspaceSourcesContext.Provider value={{ productId: plan.proposedProductId, sourceGroups }}>
      <MatrixLayoutV1Renderer productId={plan.proposedProductId} pricingStructure={plan.pricingStructure}
        exactCombinationSelections={plan.pricingStructure.brochureCompatibility.selections}
        initialSelection={initial} initialBrochureFree={previous?.pricingQuote?.brochureFree}
        initialSelectedQuantity={previous?.quantity || undefined}
        onSelectionChange={changed} onCellClick={clicked} onQuantityTiers={setTiers} onSelectionSummary={setSummary}
        layout={{ design: 1, intro: <><h1>Brochure · fri størrelse</h1><p>Prøve af de normale produkt-, pris- og Designerkomponenter med lokale produktreferencer.</p></>,
          summary: <ProductPricePanel presentation="order-flow" productId={plan.proposedProductId} productSlug="brochure-native-preview"
            productName="Brochure · lokal prøve" quantity={cell?.quantity || 0} productPrice={cell?.price || 0} extraPrice={0}
            selectedVariant={cell?.row} selectedFormat={meta.formatId} pricingQuote={pricingQuote}
            productFlow={{ ...flow, showDesignerButton: Boolean(meta.brochureTemplate) }} brochurePageCount={meta.brochureFree?.pageCount}
            designWidthMm={meta.brochureFree?.widthMm} designHeightMm={meta.brochureFree?.heightMm} designBleedMm={3} designSafeAreaMm={3}
            designerTemplateLaunch={meta.brochureTemplate} optionSelections={{}} summary={summary.join(' · ')}
            orderValidationError="Dette er en lokal integrationsprøve. Produktet kan først bestilles efter import og godkendelse." /> }} />
    </WorkspaceSourcesContext.Provider></main>
  </div>;
}
