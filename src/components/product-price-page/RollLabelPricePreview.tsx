import {useEffect,useState} from 'react';
import type {RollLabelSelection} from '@/lib/products/rollLabelConfiguration';
import type {RollLabelReviewProfile} from '@/lib/products/rollLabelReview';
import {rollLabelPriceSelectionKey,type RollLabelPricePoint,type RollLabelPricePreview} from '@/lib/products/rollLabelPricePreview';
import {rollLabelSizeGuide} from '@/lib/products/rollLabelSizeGeometry';

const money=(value:number)=>value.toLocaleString('da-DK')+' kr.';
export function RollLabelPricePreviewPanel({packet,profile,selection,error}:{packet:RollLabelPricePreview|null;
  profile:RollLabelReviewProfile|null;selection:RollLabelSelection|null;error:string}){
  const [quote,setQuote]=useState<{key:string;point:RollLabelPricePoint|null;error:string}|null>(null);
  const selectionKey=selection?rollLabelPriceSelectionKey(selection):'';
  const key=selectionKey?packet?.ruleKey+':'+selectionKey:'';
  useEffect(()=>{
    if(!selection||!packet)return;
    const controller=new AbortController();
    const query=new URLSearchParams({rule:packet.ruleKey,selection:JSON.stringify(selection)});
    fetch(`/roll-label-review/price/${packet.familyId}.json?${query}`,{signal:controller.signal}).then(async response=>{
      if(!response.ok)throw Error('Prisforslaget kunne ikke kontrolleres.');
      const data=await response.json();
      if(data.commercialApproved!==false||data.orderReady!==false||data.ruleKey!==packet.ruleKey
        ||(data.point&&rollLabelPriceSelectionKey(data.point.selection)!==selectionKey))throw Error('Prisen passer ikke til det valgte produkt.');
      if(!controller.signal.aborted)setQuote({key,point:data.point,error:''});
    }).catch(failure=>{if(!controller.signal.aborted)setQuote({key,point:null,error:failure.message});});
    return()=>controller.abort();
  },[key,selectionKey,selection,packet]);
  const current=quote?.key===key?quote:null;
  const unit=profile?.customerArtworkRequired===false?'kildeantal':'stk.';
  const guide=profile&&selection&&selection.widthMm!==null&&selection.heightMm!==null
    ?rollLabelSizeGuide(profile,selection.widthMm,selection.heightMm,selection.optionStateId):null;
  const download=guide?.vectorGuide&&profile?.sizeGeometry&&selection
    ?`/roll-label-review/dimension-template/${packet?.familyId}/${profile.articleId}-${profile.sourceMaterialId}.pdf?${new URLSearchParams({
      widthMm:String(selection.widthMm),heightMm:String(selection.heightMm),contract:profile.sizeGeometry.sha256})}`:null;
  return <section className="roll-label-price-panel" aria-label="Prisforslag" data-roll-price-status={current?.point?'captured':key?'unavailable':'incomplete'}>
    <h2>Pris for dit valg</h2>
    <div aria-live="polite">
      {error?<p role="alert">{error}</p>:!packet?<p role="status">Åbner prisforslag…</p>:!selection?<p>Vælg form, materiale, mål og antal for at se prisen.</p>
        :!current?<p role="status">Kontrollerer prisen…</p>:current.error?<p role="alert">{current.error}</p>
        :current.point?<><p className="roll-label-total" data-roll-price-dkk={current.point.priceDkk}>{money(current.point.priceDkk)}</p>
          <p>{selection.quantity.toLocaleString('da-DK')} {unit} · {money(current.point.priceDkk/selection.quantity)} pr. {unit}</p>
          <p className="roll-label-status">Prisforslag baseret på et gemt tilbud fra {new Date(current.point.capturedAt).toLocaleDateString('da-DK')}.</p></>
          :<p>Der er endnu ikke en kontrolleret pris for præcis disse mål, antal og valg.</p>}
    </div>
    <p className="roll-label-status">Priserne er under klargøring. Moms, fragt og levering til Danmark skal afklares før bestilling.</p>
    {download&&<a className="roll-label-template-download" href={download}>Hent skabelon til {selection?.widthMm} × {selection?.heightMm} mm</a>}
    <button disabled type="button">Bestilling afventer klargøring</button>
  </section>;
}
