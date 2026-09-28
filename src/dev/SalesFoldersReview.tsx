import { useMemo, useRef, useState } from 'react';
import { PrintPreviewSurface } from '@/components/mockup/PrintPreviewSurface';
import { SALES_FOLDER_MODELS } from '@/lib/mockup/salesFolderModels.generated';
import { resolveApprovedPrintModel, type ApprovedPrintModel, type PrintArtwork } from '@/lib/mockup/approvedPrintModels';
import { createBrandedPrintArtwork, preparePrintModelPdf } from '@/lib/mockup/printModelArtwork';
import '@/styles/layoutRhythm.css';
import './flatPrintReview.css';
import './salesFoldersReview.css';

const tickets = Array.from(new Map(SALES_FOLDER_MODELS.map(m => [m.ticket, m])).values());
const formats = ['Alle', 'A4', 'A5', 'A6', 'M65', '21 × 21 cm'];
export function SalesFoldersReview() {
  const requested = new URLSearchParams(location.search).get('model');
  const [ticket, setTicket] = useState(tickets.find(m => m.ticket === requested)?.ticket ?? tickets[0].ticket);
  const [format, setFormat] = useState('Alle');
  const [variant, setVariant] = useState(3);
  const visible = tickets.filter(m => format === 'Alle' || m.label.startsWith(format + ' ·'));
  const variants = SALES_FOLDER_MODELS.filter(m => m.ticket === ticket);
  const selected = variants[Math.min(variant, variants.length - 1)];
  const model = resolveApprovedPrintModel(selected.definition.templateHash) ?? selected;
  function changeTicket(value: string) {
    setTicket(value); setVariant(Math.max(0, SALES_FOLDER_MODELS.filter(m => m.ticket === value).findIndex(m => m.variantLabel.includes('Ingen efterbehandling'))));
    const url = new URL(location.href); url.searchParams.set('model', value); history.replaceState(null, '', url);
  }
  return <main className="flat-review sales-folders-review">
    <header><a href="/output/3d-review-queue/index.html#queue">← Fremdriftsliste</a><span className="flat-review-badge">Samlet modelserie · lokal visning</span></header>
    <div className="flat-review-heading"><div><p className="flat-review-kicker">WEBPRINTER · SALGSMAPPER I 3D</p><h1>Alle salgsmapper</h1><p>A4, A5, A6, M65 og 21 × 21 cm · 1, 3, 5 og 10 mm ryg</p></div></div>
    <div className="sales-folder-selectors">
      <label>Format<select value={format} onChange={e => { const f = e.target.value; setFormat(f); const next = tickets.find(m => f === 'Alle' || m.label.startsWith(f + ' ·')); if (next) changeTicket(next.ticket); }}>{formats.map(f => <option key={f}>{f}</option>)}</select></label>
      <label>Mappe og tryk<select aria-label="Mappe og tryk" value={ticket} onChange={e => changeTicket(e.target.value)}>{visible.map(m => <option key={m.ticket} value={m.ticket}>{m.label}</option>)}</select></label>
      <label>Materiale og finish<select value={variant} onChange={e => setVariant(Number(e.target.value))}>{variants.map((m, i) => <option key={m.definition.templateHash} value={i}>{m.variantLabel}</option>)}</select></label>
    </div>
    {selected.artworkMode === 'review_only' && <p className="flat-review-small">Denne ældre skabelon er bygget til review. Produktets format- og rygtilknytning mangler, så den aktiveres ikke automatisk på produktsiden.</p>}
    <ReviewModel key={selected.definition.templateHash} model={model} />
    <p className="flat-review-small">{tickets.length} modelvarianter · {SALES_FOLDER_MODELS.length.toLocaleString('da-DK')} kontrollerede PDF-skabeloner. Skabelonens mål, klapper og vinduer følger den valgte variant. Kartonens tykkelse og bøjning er illustrative; låsetunger simulerer ikke fysisk indlåsning.</p>
  </main>;
}
function ReviewModel({ model }: { model: ApprovedPrintModel }) {
  const [artwork, setArtwork] = useState<PrintArtwork>();
  const [name, setName] = useState('Sidenumre i Webprinters farve');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null), request = useRef(0);
  const defaultArt = useMemo(() => createBrandedPrintArtwork(model), [model]);
  const d = model.definition;
  async function read(file: File) {
    const version = ++request.current; setBusy(true); setError('');
    try { const next = await preparePrintModelPdf(file, model); if (version === request.current) { setArtwork(next); setName(file.name); } }
    catch (e) { if (version === request.current) setError(e instanceof Error ? e.message : 'Filen kunne ikke læses.'); }
    finally { if (version === request.current) setBusy(false); }
  }
  return <>
    <h2 className="sales-folder-title">{model.label}</h2>
    <div className="flat-review-workspace">
      <section className="flat-review-model" aria-label="Den valgte salgsmappe i 3D"><PrintPreviewSurface model={model} artwork={artwork} /><p className="flat-review-caption">Træk for at dreje · rul for at zoome · brug knapperne til at folde mappen</p></section>
      <aside className="flat-review-aside"><h2>Prøv din egen grafik</h2>
        <p>{model.pages === 1 ? 'Tryk på ydersiden. Indersiden er hvid.' : 'Tryk på både yder- og indersiden. PDF-side 1 er ydersiden, side 2 er indersiden.'}</p>
        <p className="flat-review-small">Trykark: {d.sheetWidthMm.toLocaleString('da-DK')} × {d.sheetHeightMm.toLocaleString('da-DK')} mm inklusive {'bleedMm' in d ? d.bleedMm : 3} mm udfald.</p>
        <input ref={input} className="flat-review-file" type="file" accept="application/pdf" aria-label="Vælg lokal tryk-PDF" onChange={e => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ''; }} />
        <button className="flat-review-upload" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Læser trykfil…' : `Prøv PDF · ${model.pages} ${model.pages === 1 ? 'trykside' : 'tryksider'}`}</button>
        <button onClick={() => { request.current++; setArtwork(undefined); setName('Sidenumre i Webprinters farve'); setBusy(false); setError(''); }}>Vis sidenumre igen</button>
        {error && <p role="alert" className="flat-review-error">{error} Den tidligere grafik er bevaret.</p>}
        <p className="flat-review-filename" role="status">{name}</p>
        <p className="flat-review-small">Filen bliver i browseren. Tekniske hjælpelinjer skal fjernes fra din trykfil.</p>
        <details><summary>Trykflader og skabelon</summary><p><a href={model.templateUrl} target="_blank" rel="noopener">Åbn den præcise PDF-skabelon</a></p><img className="sales-folder-artwork" src={(artwork ?? defaultArt).outside} alt="Ydersidens trykark" />{model.pages === 2 && <img className="sales-folder-artwork" src={(artwork ?? defaultArt).inside} alt="Indersidens trykark" />}</details>
      </aside>
    </div>
  </>;
}
