import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { standardUpload } from '@/lib/storage/standardUpload';
import { readLocalImage } from '@/lib/storage/readLocalImage';

/** Append-only upload: replacing a draft image must never delete a live asset. */
export function WorkspaceImageInput({ label, value, onChange, tenantId, productId }: {
  label: string; value: string; onChange: (url: string) => void; tenantId: string; productId: string;
}) {
  const inputId = useId(); const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const latestChange = useRef(onChange);
  useEffect(() => { latestChange.current = onChange; }, [onChange]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const upload = async (file?: File) => {
    if (!file || busy.current) return;
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const ext = extensions[file.type];
    if (!ext || file.size > 5 * 1024 * 1024) { toast.error('Vælg JPG, PNG eller WebP på højst 5 MB.'); return; }
    busy.current = true; setUploading(true); setProgress(0); setPreparing(true);
    try {
      const localFile = await readLocalImage(file);
      const path = `${tenantId}/${productId}/workspace-${crypto.randomUUID()}.${ext}`;
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) throw new Error('Log ind igen for at uploade et billede.');
      setPreparing(false);
      await standardUpload({
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL, bucket: 'product-images', path, file: localFile,
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${data.session.access_token}` },
        onProgress: ({ loaded, total }) => setProgress(Math.round(loaded / total * 100)),
      });
      // Preserve text/rule edits made during the transfer; removed entries stay removed.
      if (mounted.current) latestChange.current(supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Billedet kunne ikke uploades.'); }
    finally { busy.current = false; setUploading(false); setPreparing(false); }
  };
  return <div className="pw-image-input">
    <span>{label}</span>
    <div className="pw-image-drop" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!uploading) void upload(event.dataTransfer.files[0]); }}>
      {value ? <img src={value} alt={label} /> : <ImagePlus size={24} />}
      <label htmlFor={inputId}>{uploading ? <span role="status"><Loader2 size={14} className="motion-safe:animate-spin" />{preparing ? 'Klargør fil…' : `Uploader ${progress}%`}</span> : value ? 'Skift billede' : 'Vælg eller træk et billede'}</label>
      <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} className="sr-only" onChange={event => { void upload(event.target.files?.[0]); event.currentTarget.value = ''; }} />
      {value && <button type="button" disabled={uploading} aria-label={`Fjern ${label.toLowerCase()} fra kladden`} onClick={() => onChange('')}><X size={14} /></button>}
    </div>
    <details><summary>Brug et billedlink</summary><input type="url" disabled={uploading} aria-label={`${label} (URL)`} value={value} placeholder="https://…" onChange={event => onChange(event.target.value)} /></details>
  </div>;
}
