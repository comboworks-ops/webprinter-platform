import { EditableNumberInput } from "@/components/ui/editable-number-input";
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { generateWideFormatTemplate } from '@/lib/designer/generateWideFormatTemplate';
import { rectangleShape, wideFormatTemplateLaunch } from '@/lib/designer/wideFormatGeometry';
import { readBrochureFreePriceResponse, validBrochureFreeSize, type BrochureFreeMatrixMeta, type BrochureFreeSelection, type BrochureFreeSizeConfig } from '@/lib/pricing/brochureFreePricing';
import '@/styles/brochureProduct.css';

type Props = {
  config: BrochureFreeSizeConfig; selectedSectionValues: Record<string, string | null>;
  valueNames: Record<string, string>; initialSelection?: BrochureFreeSelection | null; initialQuantity?: number;
  onSelectionChange?: (selections: Record<string, string | null>, formatId?: string, materialId?: string, meta?: BrochureFreeMatrixMeta) => void;
  onCellClick?: (row: string, quantity: number, price: number) => void;
  onQuantityTiers?: (tiers: Array<{ quantity: number; price: number }>) => void;
};
const money = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });
/** Exact source quotes opt in only for the brochure's free format. Existing
 * matrix selectors, order summary, tenant branding and checkout remain shared. */
export default function BrochureFreeSizeMatrix(props: Props) {
  const { config, selectedSectionValues, valueNames } = props;
  const article = config.articles.find(value => value.pageCountValueId === selectedSectionValues[config.axisSections.pageCount]);
  const [width, setWidth] = useState(props.initialSelection?.widthMm ?? 148);
  const [height, setHeight] = useState(props.initialSelection?.heightMm ?? 210);
  const [quotes, setQuotes] = useState<Record<string, Array<[number, number]>>>({});
  const [selected, setSelected] = useState<{ materialId: string; quantity: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState('');
  const [query, setQuery] = useState(''), [visible, setVisible] = useState(12);
  const callbacks = useRef(props); callbacks.current = props;
  const scope = `${article?.articleId}:${width}x${height}`;
  const currentScope = useRef(scope); currentScope.current = scope;
  const template = useRef<BrochureFreeMatrixMeta['brochureTemplate']>(null);
  const pricedChoice = useRef<{ materialId: string; quantity: number; price: number; prices: Array<[number, number]> } | null>(null);
  const valid = validBrochureFreeSize(width, height);
  const initialRequote = useRef(false);
  const selectionFor = (nativePaperId: string): BrochureFreeSelection | null => article && valid
    ? { articleId: article.articleId, nativePaperId, pageCount: article.pageCount, widthMm: width, heightMm: height } : null;
  const emit = (materialId: string | null, quantity = 0, price = 0, prices: Array<[number, number]> = []) => {
    const material = article?.materials.find(value => value.materialValueId === materialId);
    const selections = { ...selectedSectionValues, [config.axisSections.paperCover]: materialId };
    const variantKey = Object.entries(selections).filter(([key]) => key !== config.axisSections.paperCover)
      .map(([, value]) => value).filter(Boolean).sort().join('|');
    callbacks.current.onSelectionChange?.(selections, config.formatValueId, materialId || undefined,
      { variantKey, verticalValueId: materialId || undefined, brochureFree: material ? selectionFor(material.nativePaperId) : null,
        brochureTemplate: valid ? template.current : null });
    callbacks.current.onQuantityTiers?.(prices.map(([quantity, price]) => ({ quantity, price })));
    callbacks.current.onCellClick?.(materialId ? valueNames[materialId] || '' : '', quantity, price);
  };
  useEffect(() => {
    const expectedScope = scope;
    setQuotes({}); setSelected(null); setBusy(null); setError(''); setVisible(12); template.current = null; pricedChoice.current = null;
    emit(null);
    if (!article || !valid) return;
    const launch = wideFormatTemplateLaunch(rectangleShape, width, height)!;
    void generateWideFormatTemplate(launch.pdfUrl).then(async bytes => {
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice().buffer)))
        .map(value => value.toString(16).padStart(2, '0')).join('');
      if (currentScope.current !== expectedScope) return;
      template.current = { ...launch, templatePdfSha256: hash };
      // No priced cell is selected until its fresh exact quote is available.
      const choice = pricedChoice.current;
      if (choice) emit(choice.materialId, choice.quantity, choice.price, choice.prices);
      else emit(article.materials[0]?.materialValueId || null);
    }).catch(failure => { if (currentScope.current === expectedScope) setError((failure as Error).message); });
    // Callback refs keep parent changes from invalidating a verified source quote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  const fetchPrices = async (materialId: string, restoreQuantity?: number) => {
    const material = article?.materials.find(value => value.materialValueId === materialId);
    const source = material && selectionFor(material.nativePaperId);
    if (!source || busy) return;
    if (pricedChoice.current?.materialId === materialId) {
      pricedChoice.current = null; setSelected(null); emit(materialId);
    }
    setQuotes(previous => { const next = { ...previous }; delete next[materialId]; return next; });
    const expectedScope = scope; setBusy(materialId); setError('');
    try {
      const params = new URLSearchParams({ articleId: source.articleId, substrateId: source.nativePaperId,
        widthMm: String(width), heightMm: String(height) });
      const response = await fetch(`${config.quoteEndpoint}?${params}`);
      const payload = await response.json();
      if (currentScope.current !== expectedScope) return;
      if (!response.ok) throw Error(payload.error || 'Prisen kunne ikke hentes.');
      const prices = readBrochureFreePriceResponse(payload, source);
      setQuotes(previous => ({ ...previous, [materialId]: prices }));
      const restored = restoreQuantity && prices.find(([quantity]) => quantity === restoreQuantity);
      if (restored) { pricedChoice.current = { materialId, quantity: restored[0], price: restored[1], prices }; setSelected({ materialId, quantity: restored[0] }); emit(materialId, restored[0], restored[1], prices); }
    } catch (failure) { if (currentScope.current === expectedScope) setError((failure as Error).message); }
    finally { if (currentScope.current === expectedScope) setBusy(null); }
  };
  useEffect(() => {
    const initial = callbacks.current.initialSelection;
    if (initialRequote.current || !article || !valid || !initial || initial.articleId !== article.articleId
      || initial.pageCount !== article.pageCount || initial.widthMm !== width || initial.heightMm !== height) return;
    const material = article.materials.find(value => value.nativePaperId === initial.nativePaperId);
    if (!material) return;
    initialRequote.current = true; void fetchPrices(material.materialValueId, callbacks.current.initialQuantity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  const quantities = [...new Set(Object.values(quotes).flatMap(prices => prices.map(([quantity]) => quantity)))].sort((a, b) => a - b);
  const materials = article?.materials.filter(value => (valueNames[value.materialValueId] || '').toLocaleLowerCase('da').includes(query.toLocaleLowerCase('da'))) || [];
  return <section className="brochure-native-free" aria-label="Fri størrelse, papir og antal">
    <div className="brochure-size-inputs">
      <label>Bredde, mm<EditableNumberInput type="number" min={98} max={297} step={.1} value={width} onChange={event => setWidth(Number(event.target.value))} /></label>
      <span aria-hidden="true">×</span>
      <label>Højde, mm<EditableNumberInput type="number" min={98} max={297} step={.1} value={height} onChange={event => setHeight(Number(event.target.value))} /></label>
    </div>
    <p>Begge mål skal være 98–297 mm. Papir og omslag står sammen i tabellen. Priserne gælder de præcise mål og er ekskl. moms.</p>
    {!valid && <p role="alert">Vælg mål fra 98 til 297 mm i trin på 0,1 mm.</p>}
    {error && <p role="alert">{error}</p>}
    <label>Søg papir<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Fx 135 g eller naturpapir" /></label>
    <div className="brochure-matrix-scroll"><table><thead><tr><th scope="col">Indhold og omslag</th>
      {quantities.map(quantity => <th key={quantity} scope="col">{money.format(quantity)} stk.</th>)}</tr></thead>
      <tbody>{materials.slice(0, visible).map(material => <tr key={material.materialValueId}><th scope="row">
        {(valueNames[material.materialValueId] || '').split('||').map((part, index) => <span key={index}>{part.trim()}</span>)}
        <Button variant="outline" disabled={!valid || Boolean(busy)} onClick={() => void fetchPrices(material.materialValueId)}>
          {busy === material.materialValueId ? 'Henter priser…' : quotes[material.materialValueId] ? 'Opdatér priser' : 'Hent priser'}</Button></th>
        {quantities.map(quantity => { const price = quotes[material.materialValueId]?.find(([value]) => value === quantity)?.[1];
          return <td key={quantity}><button disabled={!price} aria-pressed={selected?.materialId === material.materialValueId && selected.quantity === quantity}
            aria-label={`${valueNames[material.materialValueId]}, ${quantity} stk.${price ? `, ${price} kroner` : ', ikke tilgængelig'}`}
            onClick={() => { if (!price) return; pricedChoice.current = { materialId: material.materialValueId, quantity, price, prices: quotes[material.materialValueId] }; setSelected({ materialId: material.materialValueId, quantity }); emit(material.materialValueId, quantity, price, quotes[material.materialValueId]); }}>
            {price ? `${money.format(price)} kr.` : '—'}</button></td>; })}</tr>)}</tbody></table></div>
    {materials.length > visible && <Button variant="outline" onClick={() => setVisible(value => value + 20)}>Vis flere papirtyper ({materials.length - visible})</Button>}
  </section>;
}
