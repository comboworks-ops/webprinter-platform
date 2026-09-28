import {Loader2} from 'lucide-react';
import type {FileTransferProgress} from '@/lib/storage/resumableUpload';

export function FileUploadProgress({progress}: {progress: FileTransferProgress}) {
  const percent = progress.total ? Math.min(100, Math.floor(progress.loaded / progress.total * 100)) : 0;
  const uploading = progress.phase === 'uploading';
  const label = progress.phase === 'verifying' ? 'Kontrollerer fil…' : 'Uploader fil…';
  return <div className="mx-auto w-full max-w-sm py-4 text-left" aria-busy="true">
    <div className="flex items-center gap-3">
      <div className="rounded-full bg-primary/10 p-2 "><Loader2 className="h-5 w-5 text-primary motion-safe:animate-spin" aria-hidden="true" /></div>
      <div className="min-w-0 flex-1"><p role="status" className="text-sm font-medium">{label}</p>
        {uploading && <p className="text-xs text-muted-foreground tabular-nums">{(progress.loaded / 1024 / 1024).toFixed(1)} af {(progress.total / 1024 / 1024).toFixed(1)} MB</p>}
      </div>
      {uploading && <span className="text-sm tabular-nums">{percent}%</span>}
    </div>
    {uploading && <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
      className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary/10">
      <div className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-200" style={{width:`${percent}%`}} />
    </div>}
  </div>;
}
