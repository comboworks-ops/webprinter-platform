import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_PRINT_STUDIO_BACKGROUND } from '@/lib/branding/productPresentations';

interface Props {
  imageUrl?: string;
  revision: object;
  onChange: (url: string) => void;
  uploadImage: (file: File) => Promise<string>;
}

export function PrintStudioBackgroundControl(props: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(props);
  const mounted = useRef(false);
  latest.current = props;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Vælg en billedfil.');
      return;
    }
    const revision = props.revision;
    setUploading(true);
    setError('');
    try {
      const url = await props.uploadImage(file);
      if (!mounted.current) return;
      if (latest.current.revision !== revision) {
        setError('Designet blev ændret under upload. Vælg billedet igen for at bruge det her.');
      } else {
        latest.current.onChange(url);
      }
    } catch {
      if (mounted.current) setError('Billedet kunne ikke uploades. Din nuværende baggrund er bevaret.');
    } finally {
      if (mounted.current) setUploading(false);
    }
  };

  return <div className="space-y-3 rounded-lg border p-3">
    <div>
      <h4 className="text-sm font-medium">Printstudio · Baggrund bag produkterne</h4>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Billedet dækker bordet bag produkterne på forsiden og i produktoversigten.</p>
    </div>
    <img className="aspect-video w-full rounded-md object-cover" src={props.imageUrl?.trim() || DEFAULT_PRINT_STUDIO_BACKGROUND} alt="Printstudios valgte baggrund" />
    <div className="space-y-2">
      <Label htmlFor="studio-background-upload">Upload baggrundsbillede</Label>
      <Input id="studio-background-upload" type="file" accept="image/*" disabled={uploading} onChange={upload} />
    </div>
    <div className="space-y-2">
      <Label htmlFor="studio-background-url">Billedadresse</Label>
      <Input id="studio-background-url" type="url" value={props.imageUrl || ''} placeholder="https://…" disabled={uploading} onChange={event => { setError(''); props.onChange(event.target.value); }} />
    </div>
    {uploading && <p role="status" className="text-xs text-muted-foreground">Uploader billede…</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <Button type="button" variant="outline" size="sm" disabled={uploading || !props.imageUrl} onClick={() => { setError(''); props.onChange(''); }}>Brug standardbaggrund</Button>
  </div>;
}
