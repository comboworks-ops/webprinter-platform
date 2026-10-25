import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getIconStudioProductLabel } from '@/lib/icon-studio/catalog';
import { uploadIconStudioReferenceAsset } from '@/lib/icon-studio/service';
import type { IconStudioReferenceAssetRow } from '@/lib/icon-studio/types';
import { ONLINETRYKSAGER_ENTRIES, ONLINETRYKSAGER_PACK_ID, type StudioPackEntry } from '../../../../supabase/functions/_shared/iconStudioOnlinetryksager.ts';

interface Props { tenantId:string; references:IconStudioReferenceAssetRow[]; refresh:()=>Promise<void>; onBusyChange:(busy:boolean)=>void }
interface Candidate { file:File; hash:string; entry?:StudioPackEntry }
const byHash = new Map([...ONLINETRYKSAGER_ENTRIES].sort((a,b)=>Number(a.role==='product')-Number(b.role==='product')).map(e=>[e.sha256,e]));
const curated = ONLINETRYKSAGER_ENTRIES.filter(e=>e.role==='product');

export function StudioReferencePackImport({tenantId,references,refresh,onBusyChange}:Props) {
  const input=useRef<HTMLInputElement>(null);
  const [candidates,setCandidates]=useState<Candidate[]>([]);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const imported=useRef(new Set<string>());
  const stop=useRef(false);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop.current=true;};},[]);
  const existing=new Set(references.filter(a=>a.metadata?.referencePackId===ONLINETRYKSAGER_PACK_ID).map(a=>a.metadata.sourceSha256));
  const ready=candidates.map(c=>({...c,entry:byHash.get(c.hash)})).filter(c=>c.entry?.productKey && c.entry.role==='product' && !existing.has(c.hash) && !imported.current.has(c.hash));
  async function inspect(files:File[]) {
    setBusy(true);onBusyChange(true);setError('');setStatus('Kontrollerer filernes indhold…');
    try {
      const found:Candidate[]=[];const seen=new Set<string>();
      for (const file of files) {
        if (file.size>20*1024*1024 || !/\.png$/i.test(file.name)) continue;
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
        if (seen.has(hash)) continue;
        seen.add(hash);found.push({file,hash,entry:byHash.get(hash)});
      }
      if(mounted.current){setCandidates(found);setStatus(`${found.length} forskellige PNG-filer kontrolleret. Ukendte filer og review-filer importeres ikke.`);}
    } catch {if(mounted.current)setError('Filerne kunne ikke læses. Vælg dem igen.');}
    finally{if(mounted.current)setBusy(false);onBusyChange(false);}
  }
  async function importPack() {
    setBusy(true);onBusyChange(true);stop.current=false;setError('');
    let done=0;
    try {
      for(const candidate of ready) {
        if(stop.current)break;
        const e=candidate.entry!;
        if(!e.productKey)continue;
        setStatus(`Importerer ${done+1} af ${ready.length}: ${e.label}`);
        await uploadIconStudioReferenceAsset({tenantId,file:candidate.file,name:e.label,productKey:e.productKey,styleKey:null,usageTags:['onlinetryksager','reviewed-product'],priority:e.preferred?100:50,isActive:true,metadata:{referencePackId:ONLINETRYKSAGER_PACK_ID,sourceSha256:candidate.hash,sourcePath:e.relativePath,referenceRole:'product',reviewedAt:'2026-10-18'}});
        imported.current.add(candidate.hash);done++;
      }
      if(mounted.current)setStatus(`${done} referencer importeret${stop.current?' · import sat på pause':''}. Originalerne er bevaret.`);
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Importen blev afbrudt. Allerede importerede filer er bevaret; prøv de resterende igen.');}
    finally{await refresh();if(mounted.current)setBusy(false);onBusyChange(false);}
  }
  return <Card>
    <CardHeader><CardTitle>Onlinetryksager · referencepakke</CardTitle><CardDescription>{curated.length} kontrollerede referencer · {new Set(curated.map(e=>e.productKey)).size} produkttyper. Logo og farver vælges uafhængigt i generatoren.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Vælg PNG-filerne fra kildefolderen. Hver fil genkendes på sit indhold og får den gennemgåede produktmatch. Billeder gemmes privat i denne shop; eksisterende referencer springes over.</p>
      <input ref={input} type="file" multiple accept="image/png" className="sr-only" aria-label="Onlinetryksager PNG-filer" disabled={busy} onChange={e=>void inspect(Array.from(e.target.files||[]))}/>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={()=>input.current?.click()}>Vælg referencefiler</Button><Button disabled={busy||!ready.length} onClick={()=>void importPack()}>Importér {ready.length} nye referencer</Button>{busy&&<Button variant="outline" onClick={()=>{stop.current=true;}}>Pause efter denne fil</Button>}</div>
      <p className="text-sm" role="status">{status || `${existing.size} referencer fra pakken findes i denne shop.`}</p>
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      <details><summary className="cursor-pointer text-sm font-medium">Se produktmatch og filer til review ({ONLINETRYKSAGER_ENTRIES.length})</summary>
        <div className="mt-3 max-h-96 overflow-auto rounded-md border"><table className="w-full text-left text-sm"><caption className="sr-only">Gennemgåede produktmatches</caption><thead><tr><th className="p-2">Kildefil</th><th className="p-2">Produkt og status</th></tr></thead><tbody>{ONLINETRYKSAGER_ENTRIES.map(e=><tr key={e.sha256+e.index} className="border-t"><td className="max-w-48 break-words p-2">{e.relativePath}</td><td className="max-w-56 break-words p-2">{e.productKey?`${getIconStudioProductLabel(e.productKey)} · ${e.label}`:e.note}{existing.has(e.sha256)?' · Importeret':''}</td></tr>)}</tbody></table></div>
      </details>
    </CardContent>
  </Card>;
}
