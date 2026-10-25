import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveIconStudioOutputToLibrary } from '@/lib/icon-studio/librarySave';

interface Props {
  tenantId:string; outputId:string; suggestedName:string; saved:boolean;
  onSaved:()=>Promise<void>; openLibrary:()=>void;
}
export function StudioSaveToLibrary({tenantId,outputId,suggestedName,saved,onSaved,openLibrary}:Props) {
  const nameId=useId();
  const [editing,setEditing]=useState(false);
  const [name,setName]=useState(suggestedName.slice(0,120));
  const [busy,setBusy]=useState(false);
  const [completed,setCompleted]=useState(false);
  const [error,setError]=useState<string|null>(null);
  if (saved || completed) return <div className="space-y-2 border-t pt-3">
    <p role="status" className="text-sm">Gemt i billedbibliotek</p>
    <Button type="button" variant="outline" className="min-h-11 w-full" onClick={openLibrary}>Åbn billedbibliotek</Button>
  </div>;
  async function save() {
    if (busy) return;
    setBusy(true);setError(null);
    try {
      await saveIconStudioOutputToLibrary(tenantId,outputId,name);
      setCompleted(true);setEditing(false);
      await onSaved();toast.success('Billedet er gemt og kan vælges som reference.');
    } catch(e) {setError(e instanceof Error?e.message:'Billedet kunne ikke gemmes. Prøv igen.');}
    finally {setBusy(false);}
  }
  return <div className="space-y-2 border-t pt-3">
    {editing ? <>
      <label htmlFor={nameId} className="text-sm font-medium">Navn i billedbibliotek</label>
      <Input id={nameId} value={name} maxLength={120} disabled={busy} onChange={e=>setName(e.target.value)} className="min-h-11 text-base"/>
      <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy||!name.trim()} onClick={()=>void save()}>{busy?'Gemmer…':'Gem billede'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>{setEditing(false);setError(null);}}>Annuller</Button></div>
    </> : <Button type="button" variant="outline" className="min-h-11 w-full" onClick={()=>setEditing(true)}>Gem i billedbibliotek</Button>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
