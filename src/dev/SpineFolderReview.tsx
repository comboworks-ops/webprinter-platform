import { useEffect, useMemo, useRef, useState } from 'react';
import { PrintPreviewSurface } from '@/components/mockup/PrintPreviewSurface';
import { resolveApprovedPrintModel } from '@/lib/mockup/approvedPrintModels';
import { preparePrintModelPdf } from '@/lib/mockup/printModelArtwork';
import SpineFolderViewer from '@/components/mockup/SpineFolderViewer';
import { A4_THREE_MM_FOLDER, type SpineFolderDefinition } from '@/lib/mockup/spineFolderDefinition';
import { createSpineFolderArtwork, prepareSpineFolderArtwork } from '@/lib/mockup/spineFolderArtwork';
import '@/components/mockup/printPreview.css';
import '@/styles/layoutRhythm.css';
import './flatPrintReview.css';
import './halfFoldReview.css';
import './spineFolderReview.css';

export function SpineFolderReview({ definition = A4_THREE_MM_FOLDER }: { definition?: SpineFolderDefinition }) {
  const approvedModel = resolveApprovedPrintModel(definition.templateHash);
  const approved = Boolean(approvedModel);
  const number = ({ 3: '005', 5: '006', 10: '007' } as Record<number, string>)[definition.nominalSpineMm];
  const nextCapacity = definition.nominalSpineMm === 3 ? 5 : 10;
  const capacity = definition.nominalSpineMm;
  const sheet = `${Math.round(definition.sheetWidthMm)} × ${Math.round(definition.sheetHeightMm)}`;
  const depth = definition.spineMm.toFixed(2).replace('.', ',');
  const gusset = (definition.panels.find(p => p.id === 'bottom')!.hinge[1] - definition.panels.find(p => p.id === 'bottom-spine')!.hinge[1]).toFixed(2).replace('.', ',');
  const numbered = useMemo(() => createSpineFolderArtwork(definition), [definition]);
  const [artwork, setArtwork] = useState(numbered), [name, setName] = useState('Sidenumre · 1 Forside / 4 Bagside');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null), request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  async function read(file: File) {
    const version = ++request.current; setBusy(true); setError('');
    try { const next = approvedModel ? (await preparePrintModelPdf(file, approvedModel)).outside : await prepareSpineFolderArtwork(file, definition); if (version === request.current) { setArtwork(next); setName(file.name); } }
    catch (e) { if (version === request.current) setError(e instanceof Error ? e.message : 'Filen kunne ikke læses.'); }
    finally { if (version === request.current) setBusy(false); }
  }
  return <main className="flat-review spine-folder-review">
    <header><a href="/output/3d-review-queue/index.html#queue" target="_blank" rel="noopener">← Fremdriftsliste</a><span className="flat-review-badge">{number} · {approved ? 'Godkendt' : 'Kandidat r1 · Afventer din vurdering'}</span></header>
    <div className="flat-review-heading"><div><p className="flat-review-kicker">WEBPRINTER · 3D PRODUKTREVIEW</p><h1>A4 salgsmappe · {capacity} mm ryg</h1><p>To klapper · 4+0 · tryk på ydersiden</p></div><div className="flat-review-note">Åbn forsiden og fold begge klapper ud. Se ryggen tæt på, eller følg hele foldningen.</div></div>
    <div className="flat-review-workspace">
      <section className="flat-review-model print-preview-surface" aria-label={`A4 salgsmappe med ${capacity} mm ryg i 3D`}>{approvedModel ? <PrintPreviewSurface model={approvedModel} artwork={{ outside: artwork }} /> : <SpineFolderViewer definition={definition} artwork={artwork} />}<p className="flat-review-caption">Træk for at dreje · rul for at zoome.<br />Kartonens tykkelse på 0,30 mm er illustrativ.</p></section>
      <aside className="flat-review-aside"><h2>Fra trykark til mappe</h2>
        <p className="flat-review-small">Side 1 er forsiden, side 4 er bagsiden. Indersiderne 2 og 3 er hvide uden tryk. De blå klapper er en del af det samme trykark og foldes ind i mappen.</p>
        <button aria-pressed={artwork === numbered} onClick={() => { request.current++; setArtwork(numbered); setName('Sidenumre · 1 Forside / 4 Bagside'); setBusy(false); setError(''); }}>Sidenumre</button>
        <figure className="spine-folder-sheet"><svg viewBox={`0 0 ${definition.sheetWidthMm} ${definition.sheetHeightMm}`} role="img" aria-label="Udskåret yderside med sideklap, bagside 4, forside 1 og bundklap">
          <defs><clipPath id="spine-folder-cut">{definition.panels.map(p => <polygon key={p.id} points={p.outline.map(point => point.join(',')).join(' ')} />)}</clipPath></defs>
          <image href={artwork} width={definition.sheetWidthMm} height={definition.sheetHeightMm} clipPath="url(#spine-folder-cut)" />
          {definition.panels.map(p => <polygon key={p.id} points={p.outline.map(point => point.join(',')).join(' ')} fill="none" stroke="#33536b" strokeWidth=".5" />)}
        </svg><figcaption>Yderside · {sheet} mm inkl. udfald</figcaption></figure>
        <p className="flat-review-small">Ryg og klapper har hver to foldelinjer. De danner mappens dybde, når kartonen foldes.</p>
        <input ref={input} className="flat-review-file" type="file" aria-label="Vælg lokal PDF med én trykside" accept="application/pdf" onChange={e => { const file = e.target.files?.[0]; if (file) void read(file); e.target.value = ''; }} />
        <button className="flat-review-upload" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Læser trykfil…' : 'Prøv din egen PDF · yderside'}</button>
        <p className="flat-review-small">Én trykside, {sheet} mm inklusive 5 mm udfald. Skabelonens grå inderside er kun en reference. Filen bliver i browseren.</p>
        {error && <p role="alert" className="flat-review-error">{error} Den tidligere grafik er bevaret.</p>}
        <p className="flat-review-filename" role="status">{name}</p>
      </aside>
    </div>
    <section className="flat-review-checklist"><h2>Det skal vi godkende</h2><ul><li>Forside 1 og bagside 4 vender rigtigt, når mappen er lukket.</li><li>Ryggen har synlig dybde. Begge klapper foldes ind, før forsiden lukkes.</li><li>Sideklappens slids og bundklappens låsetunge sidder korrekt.</li><li>Indersiderne er hvide. De trykte klapper vender ind mod indholdet.</li></ul><p>{approved ? <>Du har godkendt denne konstruktion. <a href={capacity === 10 ? "/sales-folders-review.html" : `/spine-folder-${nextCapacity}mm-review.html`}>{capacity === 10 ? 'Se alle salgsmapper →' : `Se næste: ${nextCapacity} mm ryg →`}</a></> : <>Skriv <strong>“Godkend {number}”</strong> eller dine rettelser i chatten. Derefter går vi videre til næste konstruktion i fremdriftslisten.</>}</p></section>
    <details className="flat-review-evidence"><summary>Skabelon, mål og kontrolgrundlag</summary>
      <p>Denne prøve følger den verificerede skabelon for A4 med to klapper, {capacity} mm ryg, 255g Chromo mappekarton og ingen efterbehandling. De øvrige materialer og efterbehandlinger er endnu ikke omfattet af denne modelgodkendelse.</p>
      <p>PDF-ark: {sheet} mm. For- og bagside ca. 215 × 302 mm. Det nominelle rygmål er {capacity} mm; der er {depth} mm mellem ryggens to foldelinjer i denne skabelon. Klappernes foldelinjer ligger {gusset} mm fra hinanden. Det er disse mål, modellen følger.</p>
      <p><a href={`/output/3d-review-queue/a4-two-flap-${capacity}mm/source-template.pdf`} target="_blank" rel="noopener">Åbn den kontrollerede PDF-skabelon</a></p><p className="flat-review-small">SHA-256: {definition.templateHash}</p>
      <p className="flat-review-small">Klippekonturen følger PDF’ens magenta stanselinjer. Små rundinger er tilnærmet med korte linjestykker. Kartonens tykkelse, bukkeradius og papirfriktion er illustrative; modellen simulerer ikke indlåsning af tungen eller materialets fleksibilitet. {approved ? 'Godkendt konstruktion · tilknyttet den præcise produktvariant lokalt.' : 'Lokal reviewmodel · afventer godkendelse før produkttilknytning.'}</p>
    </details>
  </main>;
}
