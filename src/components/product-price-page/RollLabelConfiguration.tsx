import { EditableNumberInput } from "@/components/ui/editable-number-input";
import { useEffect, useMemo, useState } from 'react';
import type { RollLabelReviewProfile } from '@/lib/products/rollLabelReview';
import { rollLabelArtworkForState } from '@/lib/products/rollLabelArtworkInstructions';
import { rollLabelSizeGuide } from '@/lib/products/rollLabelSizeGeometry';
import { readRollLabelStockDisplay, rollLabelStockPackagingLines } from '@/lib/products/rollLabelStockDisplay';
import {readRollLabelStockFormatDisplay,rollLabelStockFormatLine} from '@/lib/products/rollLabelStockFormatDisplay';
import { readRollLabelMotifDelivery } from '@/lib/products/rollLabelMotifDelivery';
import { readRollLabelCodingDelivery } from '@/lib/products/rollLabelCodingDelivery';
import { rollLabelCodingOptionReference } from '@/lib/products/rollLabelCodingOptions';
import {rollLabelCutContourInstructions} from '@/lib/products/rollLabelCutContourContract';
import { RollLabelMotifPdfCheck } from './RollLabelMotifPdfCheck';
import { ProductFormatGuidePanel } from './ProductFormatGuide';
import { rollLabelInitialDraft, rollLabelOptionTransition, validateRollLabelConfiguration,
  type RollLabelSelection } from '@/lib/products/rollLabelConfiguration';
import { rollLabelDraftForProfileChange } from '@/lib/products/rollLabelDraftRetention';

/** Customer inputs survive profile changes; only witnessed complete
 * source vectors can be selected. Prices and sales keep their independent gate. */
export function RollLabelConfiguration({ profile, productId = '', familyId = '', initialSelection, quantity: matrixQuantity, onChange, pricePreview=false }: {
  profile: RollLabelReviewProfile; productId?: string; familyId?: string; initialSelection?: RollLabelSelection | null;
  quantity?: number; onChange?: (selection: RollLabelSelection | null) => void; pricePreview?:boolean;
}) {
  const seedKey = JSON.stringify([productId, familyId, initialSelection || null]);
  const [stateDraft, setStateDraft] = useState(() => ({profile, seedKey, draft: rollLabelInitialDraft(profile, initialSelection,{productId,familyId})}));
  let draft = stateDraft.draft;
  if (stateDraft.profile.key !== profile.key || stateDraft.seedKey !== seedKey) {
    draft = stateDraft.profile.key !== profile.key
      ? rollLabelDraftForProfileChange(profile, stateDraft.profile, stateDraft.draft)
      : rollLabelInitialDraft(profile, initialSelection, {productId,familyId});
    setStateDraft({profile, seedKey, draft});
  }
  const setDraft = (update: (current: typeof draft) => typeof draft) => setStateDraft(current => ({...current, draft:update(current.draft)}));
  const effective = useMemo(() => ({...draft, quantity: matrixQuantity === undefined ? draft.quantity : String(matrixQuantity)}), [draft,matrixQuantity]);
  const validation = useMemo(() => validateRollLabelConfiguration(profile,effective,{productId,familyId}), [profile,effective,productId,familyId]);
  useEffect(() => { onChange?.(validation.selection); }, [validation.selection,onChange]);
  const state = profile.optionStates?.states.find(state=>state.id===draft.optionStateId);
  const artworkRequirements = rollLabelArtworkForState(profile,draft.optionStateId);
  const sizeGuide = useMemo(()=>{
    if (!validation.sizeValid) return null;
    const width = Number((effective.dimensions.width || '').replace(',','.'));
    const height = profile.sizeContract?.heightFromWidth ? width : Number((effective.dimensions.height || '').replace(',','.'));
    return rollLabelSizeGuide(profile,width,height,draft.optionStateId);
  },[profile,validation.sizeValid,effective.dimensions,draft.optionStateId]);
  const axes = profile.sizeContract?.axes || [];
  const stockDisplay = readRollLabelStockDisplay(profile,productId,familyId);
  const stockFormat = readRollLabelStockFormatDisplay(profile,productId,familyId);
  const motifDelivery = readRollLabelMotifDelivery(profile);
  const codingDelivery = readRollLabelCodingDelivery(profile);
  const codingReference = rollLabelCodingOptionReference(profile, validation.selection);
  const cutInstructions=rollLabelCutContourInstructions(profile,familyId);
  const codingChoiceLabel = profile.optionFields.some(f => f.sourceFieldId === '2058')
    ? 'kode, skrifttype og udløbsretning' : 'kode og udløbsretning';
  const quantityLabel = profile.customerArtworkRequired ? 'Oplag · samlet antal'
    : stockDisplay?.sourceQuantityUnit==='rolls' ? 'Antal ruller' : 'Antal · kildeantal';
  const quantitySuffix = profile.customerArtworkRequired ? ' stk.'
    : stockDisplay?.sourceQuantityUnit==='rolls' ? ' ruller' : ' kildeantal';
  const quantityInput = profile.quantityInputs.find(input=>input.name==='menge');
  return <section className="roll-label-captured" data-roll-profile={profile.key} data-roll-size-valid={validation.sizeValid}
    data-roll-configuration-valid={validation.valid} data-roll-option-state={state?.id || ''}>
    {profile.format.customSize && <fieldset className="roll-label-dimensions"><legend>Egne mål</legend>
      {axes.length ? <div className="roll-label-field-grid">{axes.map(axis=><label key={axis.axis}>
        <span>{profile.format.shape==='circle' ? 'Diameter' : axis.axis==='width' ? 'Bredde' : 'Højde'} · mm</span>
        <input type="text" inputMode="decimal" value={draft.dimensions[axis.axis] || ''} data-roll-axis={axis.axis}
          aria-invalid={Boolean(draft.dimensions[axis.axis]) && (!Number.isFinite(Number(draft.dimensions[axis.axis].replace(',','.')))
            || Number(draft.dimensions[axis.axis].replace(',','.'))<axis.minMm || Number(draft.dimensions[axis.axis].replace(',','.'))>axis.maxMm)}
          onChange={event=>setDraft(current=>({...current,dimensions:{...current.dimensions,[axis.axis]:event.target.value}}))} />
        <small>{axis.minMm}–{axis.maxMm} mm</small>
      </label>)}</div> : <p role="alert">Målgrænserne kræver afklaring.</p>}
      {!validation.sizeValid && <p role="status">Angiv mål inden for de viste grænser.</p>}
    </fieldset>}
    {stockDisplay && <div data-roll-stock-display={profile.key}>
      <h2>Indhold og emballage</h2>
      {stockFormat && <p data-roll-stock-format={profile.key}>{rollLabelStockFormatLine(stockFormat)}</p>}
      {rollLabelStockPackagingLines(stockDisplay).map(line=><p key={line}>{line}</p>)}
      {stockDisplay.sourceQuantityUnit==='source_items' && <p>Antallet følger leverandørens kildeantal. Enheden pr. kildeantal afventer afklaring.</p>}
      <p>Indholdet beskriver emballagen og omregner ikke det valgte antal.</p>
    </div>}
    <h2>{stockDisplay ? 'Antal og valg' : 'Rulle og efterbehandling'}</h2>
    <p>Valgene følger den dokumenterede kombination. Andre kombinationer afventer kontrol.</p>
    <div className="roll-label-field-grid">
      {profile.optionFields.filter(field=>field.visible && field.labelDa!=='Antal motiver').map(field=><label key={field.sourceFieldId}>
        <span>{field.labelDa}</span>
        <select data-roll-field={field.sourceFieldId} disabled={!state || !Object.prototype.hasOwnProperty.call(state.options,field.sourceFieldId)}
          value={state?.options[field.sourceFieldId] || ''} onChange={event=>{
            const next=rollLabelOptionTransition(profile,draft.optionStateId,field.sourceFieldId,event.target.value);
            if(next) setDraft(current=>({...current,optionStateId:next.id}));
          }}>
          {!state?.options[field.sourceFieldId] && <option value="">Valget er ikke bekræftet</option>}
          {field.values.map(value=><option key={value.sourceValueId} value={value.sourceValueId}
            disabled={!rollLabelOptionTransition(profile,draft.optionStateId,field.sourceFieldId,value.sourceValueId)}>{value.labelDa}</option>)}
        </select>
      </label>)}
      <label><span>{quantityLabel}</span>
        {matrixQuantity!==undefined ? <output>{matrixQuantity.toLocaleString('da-DK')}{quantitySuffix}</output>
          : quantityInput ? <EditableNumberInput type="number" inputMode="numeric" min={quantityInput.min || 1} max={quantityInput.max}
            value={draft.quantity} onChange={event=>setDraft(current=>({...current,quantity:event.target.value}))} />
          : profile.sourceQuantities.length ? <select value={draft.quantity} onChange={event=>setDraft(current=>({...current,quantity:event.target.value}))}>
            {profile.sourceQuantities.map(value=><option key={value} value={value}>{value.toLocaleString('da-DK')}</option>)}
          </select> : <EditableNumberInput type="number" inputMode="numeric" min={1} value={draft.quantity}
            onChange={event=>setDraft(current=>({...current,quantity:event.target.value}))} />}
        <small>{pricePreview?'Se prisforslag for dokumenterede oplag. Bestilling er under klargøring.':'Pris og bestilling er endnu ikke åbnet.'}</small>
      </label>
    </div>
    {codingDelivery && <p data-roll-coding-source-point={codingReference}>
      {codingReference === 'documented'
        ? `Kombinationen af ${codingChoiceLabel} er dokumenteret ved disse mål og dette antal.`
        : `Valgene for ${codingChoiceLabel} er dokumenteret ved 50 × 50 mm og 1.000 stk. Andre mål og antal afventer kontrol.`}
      {' '}Pris, filkontrol og bestilling afventer godkendelse.
    </p>}
    {!validation.quantityValid && <p role="status">Angiv et gyldigt helt antal{quantityInput?.max ? ` op til ${Number(quantityInput.max).toLocaleString('da-DK')}` : ''}.</p>}
    {profile.format.motifCount>1 && <fieldset className="roll-label-dimensions" data-roll-allocation-valid={validation.allocationValid}>
      <legend>Fordeling på {profile.format.motifCount} motiver</legend>
      <p>Hvert motiv skal have et positivt antal. Fordelingen skal summere til totaloplaget. PDF-side 1 svarer til motiv 1 og så fremdeles.</p>
      {motifDelivery && <p data-roll-motif-delivery={profile.key}>{motifDelivery.deliveryInstructionDa}</p>}
      <div className="roll-label-field-grid">{draft.allocations.map((value,index)=><label key={index}>
        <span>Motiv {index+1} · antal</span><EditableNumberInput type="number" inputMode="numeric" min={1} step={1} value={value}
          onChange={event=>setDraft(current=>({...current,allocations:current.allocations.map((item,i)=>i===index?event.target.value:item)}))} />
      </label>)}</div>
      {!validation.allocationValid && <p role="status">Fordelingen skal indeholde {profile.format.motifCount} positive antal og summere til {effective.quantity || 'totaloplaget'}.</p>}
      {motifDelivery && <RollLabelMotifPdfCheck profile={profile} selection={validation.selection} />}
    </fieldset>}
    {!profile.customerArtworkRequired && <p>Denne vare kræver ikke upload af eget design.</p>}
    {codingDelivery && <details data-roll-coding-delivery={profile.key}>
      <summary>Filer til nummerering og koder</summary>
      <ul>{codingDelivery.instructionsDa.map(line => <li key={line}>{line}</li>)}</ul>
      <p>Excel-listen og JPG-eksemplet skal kontrolleres sammen med det valgte antal og design. Denne levering er endnu ikke åbnet.</p>
    </details>}
    {sizeGuide && <div data-roll-size-guide={profile.key}><ProductFormatGuidePanel data={sizeGuide} /></div>}
    {cutInstructions.length>0 && <details data-roll-cut-requirements={profile.key}>
      <summary>Skærelinje i produktionsfilen</summary>
      <ul>{cutInstructions.map(text=><li key={text}>{text}</li>)}</ul>
      <p>Kravene beskriver filens skærelinje. Form, mål, særfarver og trykegnethed er endnu ikke kontrolleret. Designer og bestilling afventer godkendelse.</p>
    </details>}
    {artworkRequirements.length>0 && <details data-roll-artwork-requirements={profile.key}>
      <summary>Særlige filkrav til dette valg</summary>
      <ul>{artworkRequirements.flatMap((requirement,index)=>requirement.instructionsDa.map((text,line)=><li
        key={`${index}-${line}`} data-roll-mask={requirement.kind} data-roll-mask-documented={requirement.documented}>{text}</li>))}</ul>
      <p>Brug en produktionsfil med de krævede særfarver. Online Designerens eksport af disse lag afventer kontrol.</p>
    </details>}
  </section>;
}
