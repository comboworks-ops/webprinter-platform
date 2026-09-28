import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, ImageIcon, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FolderPreviewSurface } from './FolderPreviewSurface';
import { folderPreviewColor, folderPrintLabel, type ProductFolderPreview } from '@/lib/mockup/productFolderPreview';
import type { FolderDefinition } from '@/lib/mockup/folderDefinition';
import type { SiteCheckoutUpload } from '@/lib/checkout/siteCheckoutSession';
import { prepareFolderUpload } from '@/lib/mockup/prepareFolderUpload';
import { composeFolderArtwork } from '@/lib/mockup/artwork';
import { uploadCheckoutFile, MAX_CHECKOUT_UPLOAD_BYTES, CHECKOUT_UPLOAD_LIMIT_LABEL } from '@/lib/checkout/privateUploads';
import { supabase } from '@/integrations/supabase/client';
import { FolderUploadLogin } from './FolderUploadLogin';

export interface ProductFolderUpload { templateHash: string; upload: SiteCheckoutUpload }
interface ArtworkContext { definition: FolderDefinition; templateHash: string; tenantId: string; productId: string }

/** Reuses the product gallery slot above the price matrix. Does not own order state. */
export function ProductFolderMedia({ gallery, preview, color, artworkContext, onArtworkUploaded }: {
  gallery: ReactNode;
  preview: ProductFolderPreview | null;
  color?: string;
  artworkContext?: ArtworkContext;
  onArtworkUploaded?: (draft: ProductFolderUpload | null) => void;
}) {
  const [view, setView] = useState('photo');
  const [artwork, setArtwork] = useState<string>();
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef({ version: 0 });
  const account = useRef<string | null>(null);
  const contextKey = artworkContext ? `${artworkContext.tenantId}:${artworkContext.productId}:${artworkContext.templateHash}` : '';
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const authenticated = !!session?.user && !session.user.is_anonymous;
      const accountId = authenticated ? session.user.id : null;
      setSignedIn(authenticated); setAuthReady(true);
      if (!authenticated || (account.current && account.current !== accountId)) {
        request.current.version++; setArtwork(undefined); setFileName(''); setBusy(false); onArtworkUploaded?.(null);
      }
      account.current = accountId;
    });
    return () => subscription.unsubscribe();
  }, [onArtworkUploaded]);
  useEffect(() => {
    const generation = request.current;
    generation.version++;
    setArtwork(undefined); setFileName(''); setError(''); setBusy(false);
    onArtworkUploaded?.(null);
    return () => { generation.version++; };
  }, [contextKey, onArtworkUploaded]);

  async function upload(file: File | undefined) {
    if (!file || !artworkContext || busy) return;
    const version = ++request.current.version;
    setBusy(true); setError(''); setProgress('Forbereder fil…');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user || user.is_anonymous) { setSignedIn(false); setLoginOpen(true); return; }
      if (request.current.version !== version) return;
      if (!file.size || file.size > MAX_CHECKOUT_UPLOAD_BYTES) throw new Error(`Vælg en fil på højst ${CHECKOUT_UPLOAD_LIMIT_LABEL}.`);
      const prepared = await prepareFolderUpload(file, artworkContext.definition);
      const texture = await composeFolderArtwork(prepared.previewDataUrl!, {
        physicalWidthMm: prepared.physicalWidthMm!, physicalHeightMm: prepared.physicalHeightMm!,
        scale: 1, offsetXPercent: 0, offsetYPercent: 0,
      }, artworkContext.definition);
      if (request.current.version !== version) return;
      const saved = await uploadCheckoutFile(supabase, artworkContext.tenantId, file, file.name,
        `order-files/${artworkContext.productId}-preview-${crypto.randomUUID()}.${file.name.split('.').pop()}`, update => {
          if (request.current.version === version) setProgress(update.phase === 'uploading'
            ? `Uploader ${Math.round(update.loaded / update.total * 100)} %` : 'Kontrollerer fil…');
        });
      if (request.current.version !== version) return;
      setArtwork(texture); setFileName(file.name);
      onArtworkUploaded?.({ templateHash: artworkContext.templateHash, upload: {
        ...prepared, fileUrl: saved.url, filePath: saved.path, sha256: saved.sha256,
      } });
    } catch (e) {
      if (request.current.version === version) setError(e instanceof Error ? e.message : 'Filen kunne ikke uploades. Prøv igen.');
    } finally { if (request.current.version === version) setBusy(false); }
  }
  const activeView = preview ? view : 'photo';
  return <Tabs className="product-folder-media" value={activeView} onValueChange={setView}>
    <TabsList aria-label="Produktvisning" className="product-folder-media-switch">
      <TabsTrigger value="photo"><ImageIcon size={16} /> Produktbillede</TabsTrigger>
      <TabsTrigger value="3d" disabled={!preview}><Box size={16} /> Se mappen i 3D</TabsTrigger>
    </TabsList>
    <TabsContent value="photo">{gallery}</TabsContent>
    <TabsContent value="3d">
      {preview && <div className="product-folder-inline">
        <p className="product-folder-variant" title={`${preview.definition.label} · ${folderPrintLabel(preview.print)}`}>
          {preview.definition.label} · {preview.print}
        </p>
        <FolderPreviewSurface key={`${preview.definition.id}:${preview.print}`} definition={preview.definition}
          compactControls artwork={artwork} productPreview={artwork ? undefined : { color: folderPreviewColor(color), print: preview.print }} />
        {artworkContext && <>
          <input ref={input} type="file" accept="application/pdf,image/png,image/jpeg" className="sr-only" tabIndex={-1}
            aria-label="Upload artwork til 3D-mappen" disabled={busy || !signedIn}
            onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void upload(file); }} />
          <div className="product-folder-artwork">
            <p title={fileName || undefined} aria-live="polite">{busy ? progress : fileName || 'Se dit eget design på mappen i 3D.'}</p>
            <div className="product-folder-file-actions">
              <Button type="button" variant="link" onClick={() => signedIn ? input.current?.click() : setLoginOpen(true)} disabled={busy || !authReady}
                title="Upload PDF, PNG eller JPG og se filen her på mappen"><Upload size={13} />{fileName ? 'Skift fil' : 'Upload fil'}</Button>
              {fileName && <Button type="button" variant="link" disabled={busy} onClick={() => {
                request.current.version++; setArtwork(undefined); setFileName(''); setError(''); onArtworkUploaded?.(null);
              }}>Fjern</Button>}
            </div>
          </div>
          {error && <p role="alert" className="product-folder-upload-error">{error}</p>}
          <FolderUploadLogin open={loginOpen} onOpenChange={setLoginOpen} onSignedIn={() => setSignedIn(true)} />
        </>}
      </div>}
    </TabsContent>
    {!preview && <p className="product-folder-unavailable">3D-visning er endnu ikke klar til denne variant.</p>}
  </Tabs>;
}
