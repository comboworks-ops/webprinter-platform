import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {RollLabelReviewProfile} from '@/lib/products/rollLabelReview';
import type {RollLabelSelection} from '@/lib/products/rollLabelConfiguration';
import {bindRollLabelMotifPdf,reviewRollLabelMotifPdf,rollLabelMotifPdfConfigurationKey,type RollLabelMotifPdfInspection} from '@/lib/products/rollLabelMotifPdf';
import {safePdfDocumentOptions} from '@/lib/pdfDocumentOptions';

type Preview = {pageNumber:number;url:string;width:number;height:number};
type Result = {key:string;message:string;fileName?:string;binding?:ReturnType<typeof bindRollLabelMotifPdf>;previews?:Preview[];reviewedPages?:number[]};

/** Inspect and render local bytes only. No Storage request or order state is created. */
export function RollLabelMotifPdfCheck({profile,selection}:{profile:RollLabelReviewProfile;selection:RollLabelSelection|null}) {
  const key=rollLabelMotifPdfConfigurationKey(profile,selection), latest=useRef(key), serial=useRef(0);
  const cancel=useRef<(()=>void)|undefined>();
  latest.current=key;
  const [result,setResult]=useState<Result>();
  // Clear before the next interaction can restore an earlier configuration;
  // passive-effect state updates can otherwise leave its old receipt visible.
  useLayoutEffect(()=>{serial.current++;cancel.current?.();setResult(undefined);},[key]);
  useEffect(()=>()=>{serial.current++;cancel.current?.();},[]);
  const current=result?.key===key ? result : undefined;
  const binding=current?.binding?.valid ? current.binding : null;
  const review=binding && current?.previews?.length===binding.pages.length ? reviewRollLabelMotifPdf(binding,{
    configurationKey:binding.configurationKey,sourceEvidenceSha256:binding.sourceEvidenceSha256,
    pdfSha256:binding.pdfSha256,pageNumbers:current.reviewedPages || []}) : null;
  async function inspect(file:File) {
    const request=++serial.current, capturedKey=key;
    cancel.current?.();
    const active=()=>serial.current===request&&latest.current===capturedKey;
    setResult({key:capturedKey,message:'Kontrollerer PDF-siderne…'});
    let document:import('pdfjs-dist').PDFDocumentProxy|undefined;
    let task:import('pdfjs-dist').PDFDocumentLoadingTask|undefined;
    let localIssue:string|undefined;
    try {
      if(file.size>50*1024*1024 || file.size===0) {localIssue='Den lokale kontrol kan læse PDF-filer på op til 50 MB.';throw Error(localIssue);}
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-') {localIssue='Vælg en PDF-fil.';throw Error(localIssue);}
      const digest=await crypto.subtle.digest('SHA-256',bytes);
      const sha256=Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');
      if(!active()) return;
      const imported=await import('pdfjs-dist');
      const pdfjs='GlobalWorkerOptions' in imported ? imported : (imported as unknown as {default:typeof imported}).default;
      const worker=await import('pdfjs-dist/build/pdf.worker.min.js?url');
      pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
      task=pdfjs.getDocument(safePdfDocumentOptions({data:bytes,disableAutoFetch:true,disableStream:true}));
      const loadingTask=task;
      const stop=()=>{void loadingTask.destroy().catch(()=>{});};
      cancel.current=stop;
      task.onPassword=stop;
      document=await task.promise;
      if(!active()) return;
      if(document.numPages!==profile.format.motifCount) {localIssue=`PDF-filen skal have præcis ${profile.format.motifCount} sider, én pr. motiv.`;throw Error(localIssue);}
      const pages:RollLabelMotifPdfInspection['pages']=[];
      for(let pageNumber=1;pageNumber<=document.numPages;pageNumber++) {
        if(!active()) return;
        const page=await document.getPage(pageNumber), [x1,y1,x2,y2]=page.view;
        pages.push({pageNumber,widthMm:(x2-x1)*page.userUnit*25.4/72,heightMm:(y2-y1)*page.userUnit*25.4/72,rotation:page.rotate});
        page.cleanup();
      }
      const binding=bindRollLabelMotifPdf(profile,selection,{sha256,pages});
      if(!active()) return;
      if(!binding.valid) {setResult({key:capturedKey,message:binding.reason,binding});return;}
      setResult({key:capturedKey,message:'Danner forhåndsvisning af PDF-siderne…'});
      const previews:Preview[]=[];
      for(const boundPage of binding.pages) {
        if(!active()) return;
        const page=await document.getPage(boundPage.pageNumber),original=page.getViewport({scale:1});
        const viewport=page.getViewport({scale:720/Math.max(original.width,original.height)});
        const canvas=window.document.createElement('canvas');
        canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));
        try {
          const context=canvas.getContext('2d');
          if(!context) throw Error('Canvas unavailable');
          await page.render({canvasContext:context,viewport,background:'#ffffff'}).promise;
          if(!active()) return;
          previews.push({pageNumber:boundPage.pageNumber,url:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height});
        } finally {canvas.width=0;canvas.height=0;page.cleanup();}
      }
      if(active()) setResult({key:capturedKey,message:'PDF-siderne er knyttet til den aktuelle fordeling.',fileName:file.name,binding,previews,reviewedPages:[]});
    } catch {
      if(active()) setResult({key:capturedKey,message:localIssue || 'PDF-kontrollen kunne ikke gennemføres. Kontrollér sidetal, mål og at filen kan åbnes uden adgangskode.'});
    }
    finally {
      if(active()) cancel.current=undefined;
      if(document) await document.destroy().catch(()=>{}); else if(task) await task.destroy().catch(()=>{});
    }
  }
  function acknowledge(pageNumber:number,checked:boolean) {
    setResult(previous=>{
      if(previous!==current || previous?.key!==key || !previous.previews?.some(p=>p.pageNumber===pageNumber)) return previous;
      const pages=new Set(previous.reviewedPages);
      if(checked) pages.add(pageNumber); else pages.delete(pageNumber);
      return {...previous,reviewedPages:[...pages].sort((a,b)=>a-b)};
    });
  }
  return <div className="roll-label-motif-pdf-check" data-roll-motif-pdf-check={profile.key} data-roll-motif-pdf-valid={Boolean(binding)} data-roll-motif-reviewed={Boolean(review)}>
    <label><span>Kontrollér PDF med {profile.format.motifCount} motiver</span>
      <input key={key} type="file" accept="application/pdf,.pdf" disabled={!selection} aria-label="Kontrollér motiv-PDF lokalt"
        onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file) void inspect(file);}} /></label>
    <p>Filen læses lokalt og bliver ikke uploadet. Ændrer du valget eller fordelingen, skal PDF-filen kontrolleres igen.</p>
    {!selection && <p>Udfyld mål, antal og fordeling for at kontrollere PDF-siderne.</p>}
    {current && <p role="status">{current.message}</p>}
    {binding && <>
      <p>{current?.fileName}</p>
      <p>{binding.sizeChecked ? 'Alle sider har de dokumenterede datamål.' : 'Præcise datamål og kontur afventer dokumentation for dette format.'}</p>
      <p>Se hvert motiv igennem, og bekræft, at det står på den rigtige PDF-side. Visningen viser indholdet, men er ikke et farvekorrektur.</p>
      <ol className="roll-label-motif-page-grid">{binding.pages.map(page=>{
        const preview=current?.previews?.find(p=>p.pageNumber===page.pageNumber);
        return <li key={page.pageNumber}><figure>
          {preview && <img src={preview.url} width={preview.width} height={preview.height} alt={`Forhåndsvisning af PDF-side ${page.pageNumber}, motiv ${page.motifNumber}`} />}
          <figcaption>PDF-side {page.pageNumber} → motiv {page.motifNumber} · {page.quantity.toLocaleString('da-DK')} stk.</figcaption>
        </figure><label className="roll-label-motif-confirm"><input type="checkbox" disabled={!preview}
          checked={current?.reviewedPages?.includes(page.pageNumber) || false} onChange={event=>acknowledge(page.pageNumber,event.target.checked)} />
          <span>Motiv {page.motifNumber} står på den rigtige side</span></label></li>;
      })}</ol>
      <p role="status">{review ? 'Du har bekræftet rækkefølgen af alle motiver i denne fil.' : `Bekræftet ${current?.reviewedPages?.length || 0} af ${binding.pages.length} motiver.`}</p>
      <p>Bekræftelsen gælder denne fil og fordeling, så længe siden er åben. En enkeltsidet Designer-skabelon erstatter ikke PDF-filen med alle motiver. Farver, særfarver, kontur og trykegnethed er endnu ikke godkendt. Bestilling og Designer for flere motiver er endnu ikke åbnet.</p>
    </>}
  </div>;
}
