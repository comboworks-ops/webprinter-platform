import { EditableNumberInput } from "@/components/ui/editable-number-input";
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, Settings2, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { locatorUrl } from '@/lib/products/productLocator';
import { usesStorformatSourceQuotes } from '@/lib/pricing/storformatQuoteUi';
import { tryCalculateStorformatPrice, type StorformatConfig, type StorformatMaterial, type StorformatFinish, type StorformatProduct } from '@/utils/storformatPricing';
import '@/styles/productionWorkspaces.css';

type ChoiceSection = { id: string; sectionType: 'materials' | 'finishes' | 'products'; title?: string; selection_mode?: string; valueIds?: string[] };
type Props = {
  productName: string; imageUrl?: string | null; config: StorformatConfig;
  materials: StorformatMaterial[]; finishes: StorformatFinish[]; products: StorformatProduct[];
  sections: ChoiceSection[]; saving: boolean;
  onConfig: (patch: Partial<StorformatConfig>) => void;
  onMaterial: (id: string, patch: Partial<StorformatMaterial>) => void;
  onSave: () => void; onAdvanced: () => void;
};
const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 });
export function WorkspaceNumber({ label, value, onChange, unit, min = 0, step = 1 }: {
  label: string; value: number; onChange: (value: number) => void; unit?: string; min?: number; step?: number;
}) {
  return <label className="pw-field"><span>{label}</span><div><NumberInput aria-label={label} value={value} min={min} step={step} emptyValue={min} onValueChange={value => onChange(Math.max(min, value))}/>{unit && <small>{unit}</small>}</div></label>;
}
export function StorformatPriceWorkspace({ productName, imageUrl, config, materials, finishes, products, sections, saving, onConfig, onMaterial, onSave, onAdvanced }: Props) {
  const location = useLocation();
  const [materialId, setMaterialId] = useState('');
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [width, setWidth] = useState(100);
  const [height, setHeight] = useState(200);
  const [quantity, setQuantity] = useState(config.quantities?.[0] || 1);
  const material = materials.find(item => item.id === materialId) || materials[0];
  const sourceQuotes = usesStorformatSourceQuotes(config);
  const optionSections = sections.filter(section => section.sectionType !== 'materials' && section.selection_mode !== 'free');
  const optionsFor = (section: ChoiceSection) => (section.sectionType === 'finishes' ? finishes : products).filter(item => !section.valueIds || section.valueIds.includes(item.id!));
  const selectedId = (section: ChoiceSection) => selected[section.id] ?? (section.selection_mode === 'optional' ? '' : optionsFor(section)[0]?.id || '');
  const selectedFinishes = finishes.filter(item => optionSections.some(section => section.sectionType === 'finishes' && selectedId(section) === item.id));
  const selectedProducts = products.filter(item => optionSections.some(section => section.sectionType === 'products' && selectedId(section) === item.id));
  const calculate = (w: number, h: number) => material && w > 0 && h > 0 && quantity > 0 ? tryCalculateStorformatPrice({ widthMm: w * 10, heightMm: h * 10, quantity, material, finishes: selectedFinishes, products: selectedProducts, config }) : null;
  const result = calculate(width, height);
  const tiers = material?.tiers || [];
  // Chart values use the same quote engine and current option combination as the test price.
  const chart = (() => {
    if (!material) return [];
    const maxArea = Math.max(10, ...tiers.map(tier => tier.from_m2));
    return Array.from({ length: 51 }, (_, index) => {
      const area = Math.max(0.1, index * maxArea / 50);
      const quote = calculate(width || 100, area * 10000 / (width || 100) / quantity);
      return { area: Number(area.toFixed(2)), price: quote ? quote.totalPrice / area : null };
    });
  })();
  const invalidTiers = !sourceQuotes && tiers.some(tier => !Number.isFinite(tier.from_m2) || tier.from_m2 < 0 || !Number.isFinite(tier.price_per_m2) || tier.price_per_m2 < 0 || (tier.to_m2 != null && tier.to_m2 < tier.from_m2));
  const patchTier = (index: number, patch: Partial<typeof tiers[number]>) => onMaterial(material!.id!, { tiers: tiers.map((tier, i) => i === index ? { ...tier, ...patch } : tier) });
  return <section className="production-workspace wide-price-workspace">
    <header className="pw-heading"><Link className="pw-back" to={locatorUrl('/admin/products', location.search)}><ArrowLeft size={16}/>Find produkter</Link><div><h1>Enkle priser på storformat</h1><Button variant="outline" onClick={onAdvanced}><Settings2 size={16}/>Alle værktøjer</Button></div><p>Angiv dine prisintervaller, og se resultatet med det samme.</p></header>
    <div className="pw-columns"><div className="pw-editor">
      <section className="pw-product-strip">{imageUrl && <img src={imageUrl} alt={productName}/>}<div><span>Produkt</span><strong>{productName}</strong></div><label className="pw-field"><span>Materiale</span><select aria-label="Materiale" value={material?.id || ''} onChange={event => setMaterialId(event.target.value)}>{materials.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></section>
      {!material ? <div className="pw-empty"><h2>Tilføj dit første materiale</h2><p>Brug materialebiblioteket til at oprette materiale og prisgrundlag.</p><Button onClick={onAdvanced}>Åbn materialer og værktøjer<ArrowRight size={16}/></Button></div> : <>
        <section className="pw-price-points"><h2>{sourceQuotes ? 'Leverandørens prisgrundlag' : 'Dine prisintervaller'}</h2><p>{sourceQuotes ? 'Dette produkt bruger indlæste tilbud pr. emne og antal. Test den valgte kombination til højre.' : 'Priserne beregnes ud fra det samlede areal. Alle eksisterende intervaller og tillæg bevares.'}</p>
          {sourceQuotes ? <Button variant="outline" onClick={onAdvanced}>Se tilbud og dækning</Button> : <><div className="pw-tier-heading"><span>Fra m²</span><span>Til m²</span><span>Pris pr. m²</span><span>Prispunkt</span><span/></div>{tiers.map((tier, index) => <div className="pw-tier" key={tier.id || index}>
            <NumberInput aria-label={`Fra m² ${index + 1}`} min={0} step={0.1} value={tier.from_m2} emptyValue={0} onValueChange={value => patchTier(index, { from_m2: value })}/>
            <EditableNumberInput aria-label={`Til m² ${index + 1}`} type="number" min={tier.from_m2} step="0.1" placeholder="Ubegrænset" value={tier.to_m2 ?? ''} onChange={event => patchTier(index, { to_m2: event.target.value === '' ? null : Number(event.target.value) })}/>
            <NumberInput aria-label={`Pris pr. m² ${index + 1}`} min={0} step={0.01} value={tier.price_per_m2} emptyValue={0} onValueChange={value => patchTier(index, { price_per_m2: value })}/>
            <label className="pw-anchor"><input aria-label={`Brug interval ${index + 1} som prispunkt`} type="checkbox" checked={!!tier.is_anchor} onChange={event => patchTier(index, { is_anchor: event.target.checked })}/><span>{tier.markup_pct ? `+${tier.markup_pct}%` : 'Fast'}</span></label>
            <button className="pw-icon" aria-label={`Fjern interval ${index + 1}`} onClick={() => onMaterial(material.id!, { tiers: tiers.filter((_, i) => i !== index) })} disabled={tiers.length < 2}><Trash2 size={16}/></button>
          </div>)}<Button variant="ghost" className="pw-add" onClick={() => onMaterial(material.id!, { tiers: [...tiers, { id: crypto.randomUUID(), from_m2: Math.max(0, ...tiers.map(tier => tier.to_m2 ?? tier.from_m2)) + 1, to_m2: null, price_per_m2: tiers[tiers.length - 1]?.price_per_m2 || 0, is_anchor: false, markup_pct: 0 }] })}><Plus size={16}/>Tilføj interval</Button></>}
        </section>
        {!sourceQuotes && <section className="pw-settings"><fieldset className="pw-inline-choice"><legend>Mellem prispunkterne</legend><label><input type="radio" name="wide-interpolation" checked={!material.interpolation_enabled} onChange={() => onMaterial(material.id!, { interpolation_enabled: false })}/>Faste intervaller</label><label><input type="radio" name="wide-interpolation" checked={!!material.interpolation_enabled} onChange={() => onMaterial(material.id!, { interpolation_enabled: true })}/>Lige linjer</label></fieldset><p className="pw-note">Lige linjer bruger de markerede prispunkter. Afrunding følger den fælles prisberegning.</p></section>}
        <section className="pw-settings pw-fields"><WorkspaceNumber label="Maks. bredde" value={(material.max_width_mm || 0) / 10} unit="cm" onChange={value => onMaterial(material.id!, { max_width_mm: value ? value * 10 : null })}/><WorkspaceNumber label="Maks. højde" value={(material.max_height_mm || 0) / 10} unit="cm" onChange={value => onMaterial(material.id!, { max_height_mm: value ? value * 10 : null })}/><label className="pw-field"><span>Afrund til nærmeste</span><select aria-label="Afrund til nærmeste" value={config.rounding_step} onChange={event => onConfig({ rounding_step: Number(event.target.value) })}>{[...new Set([1, 5, 10, 50, 100, config.rounding_step])].sort((a,b)=>a-b).map(value => <option key={value} value={value}>{value} kr.</option>)}</select></label><WorkspaceNumber label="Samlet pristillæg" min={-100} value={config.global_markup_pct} unit="%" onChange={value => onConfig({ global_markup_pct: value })}/></section><p className="pw-note">0 cm betyder ingen størrelsesgrænse. Materialets eksisterende opdeling, tillæg og filkrav findes under Alle værktøjer.</p>
      </>}
    </div><aside className="pw-preview"><h2>Pris pr. m²</h2><p className="pw-note">Samlet pris pr. m² med de valgte tilvalg og afrunding.</p><div className="pw-chart" role="img" aria-label="Pris pr. kvadratmeter beregnet med produktets prisgrundlag"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{top:12,right:12,bottom:10,left:0}}><CartesianGrid vertical={false} stroke="#edf0f5"/><XAxis dataKey="area" unit=" m²" tick={{fontSize:11}} tickLine={false}/><YAxis tick={{fontSize:11}} tickLine={false} width={48}/><Tooltip formatter={(value:number)=>`${number.format(value)} kr./m²`}/><Line type="linear" dataKey="price" stroke="var(--primary-color, #0085ca)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>
      {imageUrl && <img className="pw-hero-image" src={imageUrl} alt={productName}/>}
      <h3>Test din pris</h3><div className="pw-test-fields"><WorkspaceNumber label="Bredde" value={width} min={0.1} step={0.1} unit="cm" onChange={setWidth}/><WorkspaceNumber label="Højde" value={height} min={0.1} step={0.1} unit="cm" onChange={setHeight}/><WorkspaceNumber label="Antal" value={quantity} min={1} onChange={value => setQuantity(Math.max(1, Math.floor(value)))}/></div>
      <div className="pw-option-fields">{optionSections.map(section => <label className="pw-field" key={section.id}><span>{section.title || (section.sectionType === 'finishes' ? 'Efterbehandling' : 'Produkttilvalg')}</span><select aria-label={section.title || section.sectionType} value={selectedId(section)} onChange={event => setSelected(current => ({ ...current, [section.id]: event.target.value }))}>{section.selection_mode === 'optional' && <option value="">Ingen</option>}{optionsFor(section).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>)}</div>
      <div className="pw-price-result" aria-live="polite"><span>Samlet areal · {number.format(width * height / 10000 * quantity)} m²</span>{result ? <strong>{number.format(result.totalPrice)} kr. <small>ekskl. moms</small></strong> : <p>Ingen pris for denne kombination. Kontrollér størrelse, antal og prisgrundlag.</p>}</div>
      {invalidTiers && <p role="alert" className="pw-error">Kontrollér intervallerne: slutarealet skal være mindst startarealet, og priser må ikke være negative.</p>}
      <Button className="pw-save" onClick={onSave} disabled={saving || !material || invalidTiers}>{saving ? 'Gemmer…' : 'Gem prisopsætning'}</Button><p className="pw-note">Gem opdaterer dette produkts eksisterende prisopsætning.</p>
    </aside></div>
  </section>;
}
