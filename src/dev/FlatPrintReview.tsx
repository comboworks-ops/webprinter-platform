import '@/components/mockup/printPreview.css';
import { createNumberedPrintSpread } from '@/lib/mockup/numberedPrintArtwork';
/** Candidate 001 review surface. No live product assignment or file storage. */
import { useEffect, useRef, useState } from 'react';
import FlatPrintViewer from '@/components/mockup/FlatPrintViewer';
import { A7_FLYER_CANDIDATE as definition } from '@/lib/mockup/flatPrintDefinition';
import { prepareFlatPrintArtwork } from '@/lib/mockup/flatPrintArtwork';
import '@/styles/layoutRhythm.css';
import './flatPrintReview.css';

function exampleArtwork(mode: 'labels'|'design') {
  if (mode === 'labels') return createNumberedPrintSpread({ kind: 'flat', definition }, 'outside');
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=1110;
  const c=canvas.getContext('2d')!;c.scale(10,10);
  // The pink outer 3 mm is an intentional crop check, excluded from the finished model.
  c.fillStyle='#ed55a0';c.fillRect(0,0,80,111);
  c.fillStyle='#173f38';c.fillRect(3,3,74,105);
  c.fillStyle='#eff0d5';c.font='bold 3px sans-serif';c.fillText('PAPIR / FORMAT',9,16);c.font='bold 12px sans-serif';c.fillText('Små',9,35);c.fillText('formater.',9,48);c.fillStyle='#df7752';c.beginPath();c.arc(57,71,22,0,Math.PI*2);c.fill();c.fillStyle='#edebbc';c.beginPath();c.arc(57,71,12,0,Math.PI*2);c.fill();c.fillStyle='#eff0d5';c.font='3px sans-serif';c.fillText('Store muligheder.',9,99);
  return canvas.toDataURL('image/png');
}

export function Review() {
  const [artwork,setArtwork]=useState(()=>exampleArtwork('labels'));
  const [name,setName]=useState('Sidenummer 1 · Forside · uden tryk på bagsiden');
  const [mode,setMode]=useState<'labels'|'design'|'file'>('labels');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const request=useRef(0);const input=useRef<HTMLInputElement>(null);
  useEffect(()=>()=>{request.current++;},[]);
  function sample(next:'labels'|'design') {request.current++;setMode(next);setArtwork(exampleArtwork(next));setName(next==='labels'?'Sidenummer 1 · Forside · uden tryk på bagsiden':'PAPIR / FORMAT · eksempelgrafik');setError('');setBusy(false);}
  async function read(file:File) {
    const version=++request.current;setBusy(true);setError('');
    try {const url=await prepareFlatPrintArtwork(file,definition);if(version===request.current){setArtwork(url);setName(file.name);setMode('file');}}
    catch(e){if(version===request.current)setError(e instanceof Error?e.message:'Filen kunne ikke læses.');}
    finally{if(version===request.current)setBusy(false);}
  }
  return <main className="flat-review">
    <header><a href="/output/3d-review-queue/index.html#queue" target="_blank" rel="noopener">← Fremdriftsliste</a><span className="flat-review-badge">001 · r1 · Godkendt</span></header>
    <div className="flat-review-heading"><div><p className="flat-review-kicker">WEBPRINTER · 3D PRODUKTREVIEW</p><h1>A7 flyer</h1><p>74 × 105 mm · tryk på forsiden · hvid bagside</p></div><div className="flat-review-note">Træk for at dreje. Se forsiden, vend papiret og prøv din egen grafik.</div></div>
    <div className="flat-review-workspace">
      <section className="flat-review-model print-preview-surface" aria-label="Færdig flyer i 3D"><FlatPrintViewer definition={definition} artwork={artwork}/><p className="flat-review-caption">Færdigt format uden udfald. Papirtykkelsen er illustrativ (0,15 mm).</p></section>
      <aside className="flat-review-aside"><h2>Grafik til prøven</h2><div className="flat-review-actions"><button type="button" aria-pressed={mode==='labels'} onClick={()=>sample('labels')}>Sidenumre</button><button type="button" aria-pressed={mode==='design'} onClick={()=>sample('design')}>Eksempelgrafik</button></div>
        <input ref={input} className="flat-review-file" type="file" aria-label="Vælg lokal trykfil" accept="application/pdf,image/png,image/jpeg" onChange={e=>{const file=e.target.files?.[0];if(file)void read(file);e.target.value='';}}/>
        <button type="button" className="flat-review-upload" disabled={busy} onClick={()=>input.current?.click()}>{busy?'Læser fil…':'Prøv en lokal PDF / PNG / JPG'}</button>
        <p className="flat-review-small">PDF: én side, 80 × 111 mm inkl. 3 mm udfald. Billeder tilpasses hele trykfladen uden at blive strakt. Filen bliver i browseren.</p>
        {error&&<p role="alert" className="flat-review-error">{error} Den tidligere grafik er bevaret.</p>}
        <div className="flat-review-sheet"><img src={artwork} alt="Fuld trykflade før beskæring"/><span className="flat-review-trim" aria-hidden="true"/></div><p className="flat-review-filename" role="status">{name}</p><p className="flat-review-small">Den stiplede kant er beskæringen. De yderste 3 mm er udfald og beskæres væk på den færdige flyer.</p>
      </aside>
    </div>
    <section className="flat-review-checklist"><h2>Godkendt konstruktion</h2><ul><li>Forsiden vender rigtigt, og teksten læses korrekt.</li><li>Bagsiden er hvid uden gennemskinnet eller spejlet grafik.</li><li>Det færdige format er A7. Udfaldet beskæres korrekt.</li><li>Drejning, zoom og skift af grafik fungerer.</li></ul><p>Godkendt af Thomas. Modellen er integreret i den lokale produktvisning. <a href="/produkt/flyer-demand" target="_blank" rel="noopener">Åbn produktet i WebPrinter →</a></p></section>
    <details className="flat-review-evidence"><summary>Skabelon og kontrolgrundlag</summary><p>Den faktiske PDF er hentet og kontrolleret: én side, 80 × 111 mm, TrimBox 3 / 3 / 77 / 108 mm. PDF’ens tekniske hjælpelinjer er ikke lagt oven på eksempelgrafikken.</p><p><a href="/output/3d-review-queue/a7/source-template.pdf" target="_blank" rel="noopener">Åbn den kontrollerede skabelon</a></p><p className="flat-review-small">SHA-256: {definition.templateHash}</p><p className="flat-review-small">Lokal modelprøve. Farvegengivelse og papirtykkelse er vejledende. Godkendelse af trykfilen sker fortsat i det eksisterende bestillingsflow.</p></details>
  </main>;
}
