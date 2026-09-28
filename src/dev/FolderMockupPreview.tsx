/** Local feature review. Files stay in this browser; no order/storage client is imported. */
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Box, Upload } from 'lucide-react';
import { FolderMockupButton } from '@/components/mockup/FolderMockupButton';
import { ProductFolderPreviewButton } from '@/components/mockup/ProductFolderPreviewButton';
import { A4_FOLDER_BOTH_SIDES_HASH, type FolderPrintMode } from '@/lib/mockup/productFolderPreview';
import { Button } from '@/components/ui/button';
import { DEFAULT_BRANDING } from '@/lib/branding/types';
import { A4_FOLDER, A4_FOLDER_OUTSIDE_HASH } from '@/lib/mockup/folderDefinition';
import { composeFolderArtwork } from '@/lib/mockup/artwork';
import { openLocalPdf } from '@/lib/localPdf';
import '@/index.css';
import './folderMockupPreview.css';

function sampleArtwork() {
  const canvas = document.createElement('canvas'); canvas.width = 1976; canvas.height = 1464;
  const context = canvas.getContext('2d')!;
  context.scale(4, 4);
  context.fillStyle = '#183e49'; context.fillRect(0, 0, 494, 366);
  context.fillStyle = '#ec754e'; context.fillRect(274, 0, 220, 366);
  context.fillStyle = '#e9c875'; context.fillRect(0, 0, 59, 366); context.fillRect(59, 307, 215, 59);
  context.fillStyle = '#f9f3de';
  context.beginPath(); context.arc(452, 220, 83, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#ec754e'; context.beginPath(); context.arc(452, 220, 49, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#183e49'; context.font = 'bold 11px sans-serif'; context.fillText('NORD / STUDIO', 292, 35);
  context.font = 'bold 34px sans-serif'; context.fillText('Gode idéer.', 292, 94); context.fillText('Samlet.', 292, 135);
  context.font = '9px sans-serif'; context.fillText('DESIGN · PAPIR · MULIGHEDER', 292, 286);
  context.fillStyle = '#f9f3de'; context.font = 'bold 11px sans-serif'; context.fillText('PLADS TIL DET NÆSTE.', 79, 38);
  context.font = '10px sans-serif'; context.fillText('En mappe med dit eget udtryk.', 79, 262); context.fillText('nord.example / Eksempelgrafik', 79, 281);
  // Folded pockets rotate into the inside. Their print is deliberately oriented for that view.
  context.save(); context.translate(170, 337); context.rotate(Math.PI);
  context.fillStyle = '#183e49'; context.font = 'bold 9px sans-serif'; context.textAlign = 'center'; context.fillText('HER BEGYNDER DET.', 0, 0); context.restore();
  context.save(); context.translate(31, 155); context.rotate(Math.PI / 2);
  context.fillStyle = '#183e49'; context.font = 'bold 8px sans-serif'; context.textAlign = 'center'; context.fillText('NORD / STUDIO', 0, 0); context.restore();
  return canvas.toDataURL('image/png');
}
export function Preview() {
  const [view, setView] = useState<'product' | 'artwork'>('product');
  const [print, setPrint] = useState<FolderPrintMode>('4+0');
  const [artwork, setArtwork] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  async function read(file: File) {
    const version = ++request.current;
    setBusy(true); setError(''); setArtwork(null); setName(file.name);
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('Vælg en fil under 50 MB til denne lokale prøve.');
      let url: string;
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const pdf = await openLocalPdf(file);
        try {
          const page = await pdf.getPage(1); const original = page.getViewport({ scale: 1 });
          if (Math.abs(original.width * 25.4 / 72 - 494) > 0.2 || Math.abs(original.height * 25.4 / 72 - 366) > 0.2) {
            throw new Error('Denne mappe kræver en trykflade på 494 × 366 mm inklusive 5 mm udfald. Brug en PDF i dette format.');
          }
          const viewport = page.getViewport({ scale: 2048 / original.width });
          const canvas = document.createElement('canvas'); canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport, background: '#ffffff' }).promise;
          url = canvas.toDataURL('image/png');
        } finally { await pdf.destroy(); }
      } else if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        const objectUrl = URL.createObjectURL(file);
        try { url = await composeFolderArtwork(objectUrl, { physicalWidthMm: 494, physicalHeightMm: 366, scale: 1, offsetXPercent: 0, offsetYPercent: 0 }, A4_FOLDER); }
        finally { URL.revokeObjectURL(objectUrl); }
      } else throw new Error('Vælg PDF, PNG, JPG eller WebP.');
      if (request.current === version) setArtwork(url);
    } catch (e) { if (request.current === version) setError(e instanceof Error ? e.message : 'Filen kunne ikke læses.'); }
    finally { if (request.current === version) setBusy(false); }
  }
  return <main className="folder-lab">
    <div className="folder-lab-kicker"><Box size={18} /> WEBPRINTER · PRODUKTPREVIEW</div>
    <h1>{view === 'product' ? <>Se mappen.<br />Forstå folderne.</> : <>Fra din fil.<br />Til din færdige mappe.</>}</h1>
    <p className="folder-lab-intro">{view === 'product' ? 'En enkel produktvisning med butikkens farve. Åbn mappen og se, hvilke sider der trykkes.' : 'Prøv dit eget design på en A4-salgsmappe. Drej den, åbn forsiden og fold klapperne ud.'}</p>
    <div className="folder-lab-tabs" aria-label="Vælg forhåndsvisning">
      <Button variant={view === 'product' ? 'default' : 'outline'} aria-pressed={view === 'product'} onClick={() => setView('product')}>På produktsiden</Button>
      <Button variant={view === 'artwork' ? 'default' : 'outline'} aria-pressed={view === 'artwork'} onClick={() => setView('artwork')}>Med din egen fil</Button>
    </div>
    {view === 'product' ? <section className="folder-lab-product">
      <span className="folder-lab-step">PRODUKTVISNING · A4 / 1 MM RYG</span><h2>Hvordan skal mappen trykkes?</h2>
      <div className="folder-lab-print" aria-label="Vælg tryksider til eksemplet">
        <Button variant={print === '4+0' ? 'default' : 'outline'} aria-pressed={print === '4+0'} onClick={() => setPrint('4+0')}>Yderside · 4+0</Button>
        <Button variant={print === '4+4' ? 'default' : 'outline'} aria-pressed={print === '4+4'} onClick={() => setPrint('4+4')}>Yder- og inderside · 4+4</Button>
      </div>
      <div className="folder-lab-product-action"><p>{print === '4+4' ? 'Tryk på begge sider af kartonen.' : 'Tryk på ydersiden. Indersiden er hvid.'}</p>
        <ProductFolderPreviewButton branding={{ colors: { ...DEFAULT_BRANDING.colors, primary: '#087FC5' } }} template={{ name: 'A4 · 1 mm', pdfUrl: '', templatePdfSha256: print === '4+4' ? A4_FOLDER_BOTH_SIDES_HASH : A4_FOLDER_OUTSIDE_HASH }} />
      </div><p className="folder-lab-private">Eksempel på valget i bestillingen. Ingen ordre oprettes her.</p>
    </section> : <>
    <div className="folder-lab-card">
      <div><span className="folder-lab-step">01 / DIT DESIGN</span><h2>Vælg din trykfil</h2>
        <p>A4 med to klapper og 1 mm ryg. Tryk på ydersiden, 4+0. PDF: 494 × 366 mm inkl. udfald. Billeder tilpasses hele trykfladen.</p>
        <input ref={input} type="file" aria-label="Vælg din trykfil" accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void read(file); event.target.value = ''; }} />
        <div className="folder-lab-actions"><Button disabled={busy} onClick={() => input.current?.click()}><Upload size={16} />{busy ? 'Læser fil…' : 'Vælg PDF eller billede'}</Button>
          <Button variant="ghost" disabled={busy} onClick={() => { request.current++; setArtwork(sampleArtwork()); setName('NORD / STUDIO · eksempelgrafik'); setError(''); }}>Prøv med eksempelgrafik</Button></div>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <p className="folder-lab-private">Lokal prøve · din fil bliver i denne browser.</p>
      </div>
      <div className="folder-lab-artwork">{artwork ? <img src={artwork} alt="Din udfoldede trykflade" /> : <div className="folder-lab-placeholder"><Box size={48} strokeWidth={1} /><p>Dit design vises her</p></div>}</div>
    </div>
    {artwork && <div className="folder-lab-next"><div><span className="folder-lab-step">02 / DIN MAPPE</span><p>{name}</p></div><FolderMockupButton key={artwork} definition={A4_FOLDER} getArtwork={async () => artwork} /></div>}
    </>}
    <p className="folder-lab-note">Produktvisningen følger det valgte tryk og butikkens farve. Upload og designer viser dit eget design. Denne prøve med egen fil understøtter 4+0.</p>
  </main>;
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Preview />);
