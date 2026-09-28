import '@/components/mockup/printPreview.css';
import { createNumberedPrintSpread } from '@/lib/mockup/numberedPrintArtwork';
/** Candidate 004. Review only; no live product assignment or file storage. */
import { useEffect, useRef, useState } from 'react';
import ZigzagFoldViewer from '@/components/mockup/ZigzagFoldViewer';
import { DIN_LANG_ZIGZAG_FOLD as definition, type ZigzagFoldArtwork, type ZigzagSpreadSide } from '@/lib/mockup/zigzagFoldDefinition';
import { prepareZigzagFoldArtwork } from '@/lib/mockup/zigzagFoldArtwork';
import '@/styles/layoutRhythm.css';
import './flatPrintReview.css';
import './halfFoldReview.css';
import './rollFoldReview.css';

function exampleSpread(side: ZigzagSpreadSide, mode: 'labels' | 'design') {
  if (mode === 'labels') return createNumberedPrintSpread({ kind: 'zigzag', definition }, side);
  const canvas = document.createElement('canvas'); canvas.width = 1818; canvas.height = 1296;
  const c = canvas.getContext('2d')!; c.scale(6, 6);
  c.fillStyle = '#ed55a0'; c.fillRect(0, 0, 303, 216);
  const panels = side === 'outside' ? [4, 5, 1] : [2, 3, 6];
  const widths = [99, 99, 99];
  const colours = ['#21483e', '#e1e7d2', '#e9e3d5', '#cee0de', '#d8b889', '#698075'];
  let x = 3;
  panels.forEach((page, i) => {
    const w = widths[i], light = page === 1 || page === 6;
    c.fillStyle = colours[page - 1]; c.fillRect(x, 3, w, 210);
    c.fillStyle = light ? '#f4f2df' : '#243f36'; c.textAlign = 'left';
    c.font = 'bold 3.3px sans-serif'; c.fillText(`VENSTRE · ${page}A`, x + 6, 15);
    c.textAlign = 'right'; c.fillText(`${page}B · HØJRE`, x + w - 6, 15);
    c.textAlign = 'center'; c.font = 'bold 4px sans-serif'; c.fillText('TOP ↑', x + w / 2, 30);
    c.textAlign = 'left'; c.font = 'bold 4.5px sans-serif'; c.fillText('PAPIR / FORMAT', x + 8, 53);
    c.font = 'bold 11px sans-serif';
    const lines = page === 1 ? ['En historie', 'i tre', 'dele.'] : page === 2 ? ['Åbn for', 'det næste.'] : page === 3 ? ['Plads til', 'de store', 'idéer.'] : page === 4 ? ['Det hele', 'hænger', 'sammen.'] : page === 5 ? ['Åbn', 'historien', 'helt.'] : ['Tag', 'historien', 'med.'];
    lines.forEach((line, n) => c.fillText(line, x + 8, 78 + n * 14));
    c.fillStyle = page % 2 ? '#c18b55' : '#a4b9a5'; c.beginPath(); c.arc(x + 68, 171, 23, 0, Math.PI * 2); c.fill();
    c.fillStyle = light ? '#f4f2df' : '#243f36';
    c.textAlign = 'left'; c.font = 'bold 3.3px sans-serif'; c.fillText(`${page}C · BUND`, x + 6, 204);
    c.textAlign = 'right'; c.fillText(`SIDE ${page} · ${page}D`, x + w - 6, 204);
    x += w;
  });
  return canvas.toDataURL('image/png');
}
function examples(mode: 'labels' | 'design'): ZigzagFoldArtwork { return { outside: exampleSpread('outside', mode), inside: exampleSpread('inside', mode) }; }

export function ZigzagFoldReview() {
  const [artwork, setArtwork] = useState(() => examples('labels'));
  const [mode, setMode] = useState<'labels' | 'design' | 'file'>('labels');
  const [name, setName] = useState('Sidenumre · 1 Forside / 6 Bagside');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null), request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  function sample(next: 'labels' | 'design') { request.current++; setMode(next); setArtwork(examples(next)); setName(next === 'labels' ? 'Sidenumre · 1 Forside / 6 Bagside' : 'PAPIR / FORMAT · eksempelgrafik'); setBusy(false); setError(''); }
  async function read(file: File) {
    const version = ++request.current; setBusy(true); setError('');
    try { const next = await prepareZigzagFoldArtwork(file, definition); if (version === request.current) { setArtwork(next); setMode('file'); setName(file.name); } }
    catch (e) { if (version === request.current) setError(e instanceof Error ? e.message : 'Filen kunne ikke læses.'); }
    finally { if (version === request.current) setBusy(false); }
  }
  return <main className="flat-review half-fold-review roll-fold-review">
    <header><a href="/output/3d-review-queue/index.html#queue" target="_blank" rel="noopener">← Fremdriftsliste · 4 godkendt</a><span className="flat-review-badge">004 · r1 · Godkendt</span></header>
    <div className="flat-review-heading"><div><p className="flat-review-kicker">WEBPRINTER · 3D PRODUKTREVIEW</p><h1>DIN Lang · zigzagfals</h1><p>6 sider · to fold · 99 × 210 mm, når den er lukket</p></div><div className="flat-review-note">Tre lige brede paneler. To fold i hver sin retning — som en harmonika.</div></div>
    <div className="flat-review-workspace">
      <section className="flat-review-model print-preview-surface" aria-label="Zigzagfalset folder i 3D"><ZigzagFoldViewer definition={definition} artwork={artwork} /><p className="flat-review-caption">Træk for at dreje · brug skyderen til at folde · rul for at zoome.<br />Papirtykkelsen på 0,15 mm er illustrativ.</p></section>
      <aside className="flat-review-aside"><h2>Fra trykark til folder</h2><p className="flat-review-small">Store hvide sidenumre på WebPrinter-blå. Side 1 er forsiden, og side 6 er bagsiden.</p>
        <div className="flat-review-actions"><button aria-pressed={mode === 'labels'} onClick={() => sample('labels')}>Sidenumre</button><button aria-pressed={mode === 'design'} onClick={() => sample('design')}>Eksempelgrafik</button></div>
        <div className="half-fold-spreads">{(['outside', 'inside'] as const).map(side => <figure key={side}><img src={artwork[side]} alt={side === 'outside' ? 'PDF-side 1: side 4, side 5 og forside 1' : 'PDF-side 2: side 2, side 3 og bagside 6'} /><figcaption>{side === 'outside' ? 'PDF 1 · side 4 | 5 | forside 1' : 'PDF 2 · side 2 | 3 | bagside 6'}</figcaption></figure>)}</div>
        <p className="flat-review-small">Alle paneler er 99 mm. Forsiden er til højre på PDF 1; bagsiden er til højre på PDF 2. Foldene går skiftevis frem og tilbage. De yderste 3 mm er udfald og beskæres væk.</p>
        <input ref={input} className="flat-review-file" type="file" aria-label="Vælg lokal PDF med to opslag" accept="application/pdf" onChange={e => { const file = e.target.files?.[0]; if (file) void read(file); e.target.value = ''; }} />
        <button className="flat-review-upload" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Læser begge opslag…' : 'Prøv din egen PDF · 2 opslag'}</button>
        <p className="flat-review-small">Begge PDF-sider: 303 × 216 mm inkl. udfald. Sidefølge: 4–5–1, derefter 2–3–6. Brug zigzag-skabelonen. Filen bliver i browseren.</p>
        {error && <p role="alert" className="flat-review-error">{error} Den tidligere grafik er bevaret.</p>}
        <p className="flat-review-filename" role="status">{name}</p>
      </aside>
    </div>
    <section className="flat-review-checklist"><h2>Godkendt konstruktion</h2><ul><li>De to fold vender hver sin vej og danner et Z set ovenfra.</li><li>Alle tre paneler er lige brede: 99 mm.</li><li>Side 1 er forsiden; side 6 fra PDF 2 er bagsiden.</li><li>Alle seks sider står rigtigt uden spejlvendt tekst.</li></ul><p>Godkendt af Thomas. <a href="/produkt/wmd-folder-bank-891a5cf1" target="_blank" rel="noopener">Åbn produktet i WebPrinter →</a></p></section>
    <details className="flat-review-evidence"><summary>Skabelon og kontrolgrundlag</summary><p>Den hentede PDF har to opslag på 303 × 216 mm. Efter beskæring: 297 × 210 mm. Begge opslag har tre paneler på 99 mm, med foldelinjer ved 102 og 201 mm fra arkets venstre kant. Lukket format: 99 × 210 mm.</p><p><a href="/output/3d-review-queue/din-lang-zigzag/source-template.pdf" target="_blank" rel="noopener">Åbn den kontrollerede skabelon</a> · <a href="https://www.onlineprinters.ie/c/data/leserichtung" target="_blank" rel="noopener">Reference for zigzag-sidefølge og læseretning</a></p><p className="flat-review-small">SHA-256: {definition.templateHash}</p><p className="flat-review-small">Lokal modelprøve. Papirtykkelse, foldradius og farver er vejledende. Skabelonens tekniske hjælpelinjer indgår ikke i eksempelgrafikken.</p></details>
  </main>;
}
