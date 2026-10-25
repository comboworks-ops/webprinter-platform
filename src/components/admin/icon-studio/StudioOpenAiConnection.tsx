import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getStudioCapabilities, invokeStudio, type StudioCapabilities } from '@/lib/icon-studio/connection';

export function StudioOpenAiConnection({tenantId,disabled}:{tenantId:string;disabled:boolean}) {
  const [status,setStatus]=useState<StudioCapabilities|null>(null);
  const [key,setKey]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [notice,setNotice]=useState('');
  const [remove,setRemove]=useState(false);
  useEffect(()=>{
    let alive=true;
    getStudioCapabilities(tenantId).then(data=>{if(alive)setStatus(data);}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'Forbindelsen kunne ikke læses.');});
    return ()=>{alive=false;};
  },[tenantId]);
  async function refresh() {
    setBusy(true);setError(null);
    try {setStatus(await getStudioCapabilities(tenantId));} catch(e){setStatus(null);setError(e instanceof Error?e.message:'Forbindelsen kunne ikke læses.');} finally {setBusy(false);}
  }
  async function change(action:'connect'|'disconnect') {
    if (!status || busy) return;
    const submittedKey=key.trim();setKey('');setBusy(true);setError(null);setNotice('');
    try {
      await invokeStudio({tenantId,action,expectedVersion:status.connection.version,...(action==='connect'?{apiKey:submittedKey}:{})});
      setStatus(await getStudioCapabilities(tenantId));setRemove(false);
      setNotice(action==='connect'?'OpenAI er tilsluttet. Nøglen og modeladgangen er kontrolleret.':'Forbindelsen er fjernet. Dine billeder og opskrifter er bevaret.');
    } catch(e){setError(e instanceof Error?e.message:'Forbindelsen kunne ikke gemmes.');}
    finally {setBusy(false);}
  }
  return <section className="studio-section studio-connection" aria-label="OpenAI-forbindelse">
    <div className="studio-section-heading"><h2>Din billedmotor</h2><Button variant="ghost" disabled={disabled||busy} onClick={()=>void refresh()}>Opdater status</Button></div>
    <p>{status ? status.connection.connected ? `Egen OpenAI-konto er tilsluttet · nøgle slutter på ${status.connection.lastFour}. OpenAI-forbrug betales af denne konto.` : status.providers.includes('openai') ? 'Webprinters OpenAI-forbindelse er tilgængelig. Tilslut din egen nøgle for at bruge din egen OpenAI-konto.' : 'Tilslut en OpenAI API-nøgle for at skabe rigtige produktbilleder.' : error ? 'Forbindelsesstatus er ikke tilgængelig.' : 'Henter forbindelsesstatus…'}</p>
    {status?.canManageConnection && <details>
      <summary>{status.connection.connected?'Administrer OpenAI-forbindelse':'Tilslut din egen OpenAI API-nøgle'}</summary>
      <p>Et ChatGPT-abonnement og OpenAI API-forbrug afregnes separat. Din nøgle gemmes krypteret og deles kun med OpenAI via serveren. Shoppens medarbejdere kan generere billeder med forbindelsen.</p>
      <form onSubmit={event=>{event.preventDefault();void change('connect');}}>
        <label className="studio-field">OpenAI API-nøgle<Input type="password" autoComplete="new-password" spellCheck={false} value={key} maxLength={303} placeholder="sk-…" disabled={disabled||busy} onChange={event=>setKey(event.target.value)}/></label>
        <div className="studio-result-actions"><Button type="submit" disabled={disabled||busy||!key.trim()}>{busy?'Kontrollerer…':status.connection.connected?'Erstat nøgle':'Kontrollér og tilslut'}</Button><a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">Opret en API-nøgle hos OpenAI</a></div>
      </form>
      <p>Nøglen skal have adgang til modeller og billedgenerering. OpenAI kan kræve aktiveret fakturering og organisationsverificering. Der genereres ikke billeder, når du tilslutter nøglen.</p>
      {status.connection.connected && (remove ? <div className="studio-result-actions"><p>Fjern nøglen fra denne shop? Ventende opgaver med nøglen stopper.</p><Button variant="destructive" disabled={disabled||busy} onClick={()=>void change('disconnect')}>Ja, fjern forbindelsen</Button><Button variant="outline" disabled={busy} onClick={()=>setRemove(false)}>Behold forbindelsen</Button></div> : <Button variant="outline" disabled={disabled||busy} onClick={()=>setRemove(true)}>Fjern forbindelse</Button>)}
    </details>}
    {status && !status.canManageConnection && <p>Shoppens ejer eller administrator kan administrere API-nøglen.</p>}
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="studio-error">{error}</p>}
  </section>;
}
