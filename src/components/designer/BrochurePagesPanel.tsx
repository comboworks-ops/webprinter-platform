import { brochureFacingPages, brochurePageLabel, type BrochureDocument } from '@/lib/designer/brochureDocument';
import { Button } from '@/components/ui/button';
import { FileUp, Link2, Unlink2 } from 'lucide-react';

interface Props {
  document: BrochureDocument;
  activePage: number;
  busy: boolean;
  onSelect: (number: number) => void;
  onUploadPage: (number: number) => void;
  onJoin: (left: number, right: number) => void;
  onUnlink: (left: number) => void;
}
export default function BrochurePagesPanel({ document, activePage, busy, onSelect, onUploadPage, onJoin, onUnlink }: Props) {
  const facing = brochureFacingPages(activePage, document.pageCount);
  const spread = facing && document.spreads.find(s => s.left === facing[0]);
  return <aside className="brochure-pages" aria-label="Brochurens sider">
    <div className="brochure-pages-heading"><strong>Sider</strong><span>{document.pageCount} inkl. omslag</span></div>
    <div className="brochure-spread-controls">
      {facing && <Button variant="outline" disabled={busy} onClick={() => spread ? onUnlink(spread.left) : onJoin(...facing)}>
        {spread ? <Unlink2 size={16} /> : <Link2 size={16} />}{spread ? 'Adskil' : 'Forbind'} {facing[0]}–{facing[1]}
      </Button>}
      <p>{spread ? 'Du designer begge sider som ét opslag.' : facing ? 'Forbind siderne for et design hen over midten.' : 'Omslaget vises som en enkeltside.'}</p>
    </div>
    <div className="brochure-page-list">
      {document.pages.map(page => {
        const pageSpread = document.spreads.find(s => s.left === page.number || s.right === page.number);
        const active = page.number === activePage || Boolean(pageSpread && (pageSpread.left === activePage || pageSpread.right === activePage));
        return <div className="brochure-page-item" key={page.number}>
          <button className="brochure-page-thumb" type="button" disabled={busy} onClick={() => onSelect(page.number)} aria-pressed={active}
            aria-label={`Åbn ${brochurePageLabel(page.number, document.pageCount).toLowerCase()}, side ${page.number}`}>
            <span className="brochure-thumb-paper" style={{ aspectRatio: `${document.widthMm}/${document.heightMm}` }}>
              {page.thumbnail ? <img src={page.thumbnail} alt="" /> : <span>{page.number}</span>}
            </span>
            <span className="brochure-thumb-label">{brochurePageLabel(page.number, document.pageCount)}{pageSpread && <Link2 size={13} aria-label={`Forbundet med side ${pageSpread.left === page.number ? pageSpread.right : pageSpread.left}`} />}</span>
          </button>
          <button className="brochure-page-upload" type="button" disabled={busy} onClick={() => onUploadPage(page.number)} aria-label={`Upload artwork til side ${page.number}`} title={`Upload til side ${page.number}`}><FileUp size={15} /></button>
        </div>;
      })}
    </div>
  </aside>;
}
