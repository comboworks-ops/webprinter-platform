import '@/components/mockup/printPreview.css';
import { createNumberedPrintSpread } from '@/lib/mockup/numberedPrintArtwork';
/** Candidate 002. Review only; no live product assignment or file storage. */
import { useEffect, useRef, useState } from 'react';
import HalfFoldViewer from '@/components/mockup/HalfFoldViewer';
import { DIN_LANG_HALF_FOLD as definition, type HalfFoldArtwork, type SpreadSide } from '@/lib/mockup/halfFoldDefinition';
import { prepareHalfFoldArtwork } from '@/lib/mockup/halfFoldArtwork';
import '@/styles/layoutRhythm.css';
import './flatPrintReview.css';
import './halfFoldReview.css';

function exampleSpread(side: SpreadSide, mode: 'labels' | 'design') {
  if (mode === 'labels') return createNumberedPrintSpread({ kind: 'half', definition }, side);
  const canvas = document.createElement('canvas'); canvas.width = 1224; canvas.height = 1296;
  const c = canvas.getContext('2d')!; c.scale(6, 6);
  c.fillStyle = '#ed55a0'; c.fillRect(0, 0, 204, 216);
  const panels = side === 'outside' ? [4, 1] : [2, 3];
  const colours = ['#193f37', '#e4e9cf', '#eeb28c', '#527c72'];
  panels.forEach((page, i) => {
    const x = 3 + 99 * i, light = page === 1 || page === 4;
    c.fillStyle = colours[page - 1]; c.fillRect(x, 3, 99, 210);
    c.fillStyle = light ? '#f2f0d8' : '#193f37'; c.textAlign = 'left';
    c.font = 'bold 3.2px sans-serif'; c.fillText(`VENSTRE · ${page}A`, x + 6, 15);
    c.textAlign = 'right'; c.fillText(`${page}B · HØJRE`, x + 93, 15);
    c.textAlign = 'center'; c.font = 'bold 4px sans-serif'; c.fillText('TOP ↑', x + 49.5, 31);
    c.textAlign = 'left'; c.font = 'bold 5px sans-serif'; c.fillText('PAPIR / FORMAT', x + 8, 54);
    c.font = 'bold 11px sans-serif';
    const lines = page === 1 ? ['En lille', 'folder.', 'En stor', 'historie.'] : page === 2 ? ['Plads til', 'det første', 'indtryk.'] : page === 3 ? ['Og alt', 'det, der', 'følger med.'] : ['Fold', 'historien', 'sammen.'];
    lines.forEach((line, n) => c.fillText(line, x + 8, 78 + n * 14));
    c.fillStyle = page % 2 ? '#df7752' : '#cbd4b5'; c.beginPath(); c.arc(x + 68, 170, 24, 0, Math.PI * 2); c.fill();
    c.fillStyle = light ? '#f2f0d8' : '#193f37';
    c.textAlign = 'left'; c.font = 'bold 3.2px sans-serif'; c.fillText(`${page}C · BUND`, x + 6, 204);
    c.textAlign = 'right'; c.fillText(`SIDE ${page} · ${page}D`, x + 93, 204);
  });
  return canvas.toDataURL('image/png');
}
function examples(mode: 'labels' | 'design'): HalfFoldArtwork { return { outside: exampleSpread('outside', mode), inside: exampleSpread('inside', mode) }; }

export function HalfFoldReview() {
  const [artwork, setArtwork] = useState(() => examples('labels'));
  const [mode, setMode] = useState<'labels' | 'design' | 'file'>('labels');
  const [name, setName] = useState('Sidenumre · 1 Forside / 4 Bagside');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null), request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  function sample(next: 'labels' | 'design') { request.current++; setMode(next); setArtwork(examples(next)); setName(next === 'labels' ? 'Sidenumre · 1 Forside / 4 Bagside' : 'PAPIR / FORMAT · eksempelgrafik'); setBusy(false); setError(''); }
  async function read(file: File) {
    const version = ++request.current; setBusy(true); setError('');
    try { const next = await prepareHalfFoldArtwork(file, definition); if (version === request.current) { setArtwork(next); setMode('file'); setName(file.name); } }
    catch (e) { if (version === request.current) setError(e instanceof Error ? e.message : 'Filen kunne ikke læses.'); }
    finally { if (version === request.current) setBusy(false); }
  }
  return <main className="flat-review half-fold-review">
    <header><a href="/output/3d-review-queue/index.html#queue" target="_blank" rel="noopener">← Fremdriftsliste · 4 godkendt</a><span className="flat-review-badge">002 · r1 · Godkendt</span></header>
    <div className="flat-review-heading"><div><p className="flat-review-kicker">WEBPRINTER · 3D PRODUKTREVIEW</p><h1>DIN Lang · midterfals</h1><p>4 sider · én fold · 99 × 210 mm, når den er lukket</p></div><div className="flat-review-note">Åbn folderen, følg forsiden og se, hvor hver side ender.</div></div>
    <div className="flat-review-workspace">
      <section className="flat-review-model print-preview-surface" aria-label="Midterfalset folder i 3D"><HalfFoldViewer definition={definition} artwork={artwork} /><p className="flat-review-caption">Træk for at dreje · brug skyderen til at folde · rul for at zoome.<br />Papirtykkelsen på 0,15 mm er illustrativ.</p></section>
      <aside className="flat-review-aside"><h2>Fra trykark til folder</h2>
        <div className="flat-review-actions"><button aria-pressed={mode === 'labels'} onClick={() => sample('labels')}>Sidenumre</button><button aria-pressed={mode === 'design'} onClick={() => sample('design')}>Eksempelgrafik</button></div>
        <div className="half-fold-spreads">{(['outside', 'inside'] as const).map(side => <figure key={side}><img src={artwork[side]} alt={side === 'outside' ? 'PDF-side 1: bagside 4 til venstre, forside 1 til højre' : 'PDF-side 2: inderside 2 til venstre, inderside 3 til højre'} /><figcaption>{side === 'outside' ? 'PDF 1 · yderside: 4 | 1' : 'PDF 2 · inderside: 2 | 3'}</figcaption></figure>)}</div>
        <p className="flat-review-small">Forsiden ligger til højre på ydersiden. De to indersider mødes, når folderen lukkes. De yderste 3 mm er udfald og beskæres væk.</p>
        <input ref={input} className="flat-review-file" type="file" aria-label="Vælg lokal PDF med to opslag" accept="application/pdf" onChange={e => { const file = e.target.files?.[0]; if (file) void read(file); e.target.value = ''; }} />
        <button className="flat-review-upload" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Læser begge opslag…' : 'Prøv din egen PDF · 2 opslag'}</button>
        <p className="flat-review-small">Begge PDF-sider: 204 × 216 mm inkl. udfald. Først ydersiden, så indersiden. Filen bliver i browseren.</p>
        {error && <p role="alert" className="flat-review-error">{error} Den tidligere grafik er bevaret.</p>}
        <p className="flat-review-filename" role="status">{name}</p>
      </aside>
    </div>
    <section className="flat-review-checklist"><h2>Godkendt konstruktion</h2><ul><li>Side 1 er forsiden; side 4 er bagsiden.</li><li>Folderen åbner som en bog til side 2 og 3.</li><li>Teksten står korrekt på alle fire sider.</li><li>Folden, bevægelsen og det smalle format ser rigtige ud.</li></ul><p>Godkendt af Thomas. Modellen er integreret i den lokale produktvisning. <a href="/produkt/wmd-folder-bank-891a5cf1" target="_blank" rel="noopener">Åbn produktet i WebPrinter →</a></p></section>
    <details className="flat-review-evidence"><summary>Skabelon og kontrolgrundlag</summary><p>Den hentede PDF har to opslag med bogmærkerne Yderside og Inderside, 204 × 216 mm ark, 198 × 210 mm efter beskæring og midterfals ved 102 mm fra arkets venstre kant. Hvert panel er 99 mm bredt.</p><p><a href="/output/3d-review-queue/din-lang-half/source-template.pdf" target="_blank" rel="noopener">Åbn den kontrollerede skabelon</a> · <a href="https://www.onlineprinters.ie/c/data/leserichtung" target="_blank" rel="noopener">Reference for sidefølge og læseretning</a></p><p className="flat-review-small">SHA-256: {definition.templateHash}</p><p className="flat-review-small">Lokal modelprøve. Papirtykkelse, foldradius og farver er vejledende. Skabelonens tekniske hjælpelinjer indgår ikke i eksempelgrafikken.</p></details>
  </main>;
}
