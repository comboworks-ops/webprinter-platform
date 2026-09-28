import type {ReactNode} from 'react';
import {toast} from 'sonner';
import {supabase} from '@/integrations/supabase/client';
import {authorizedOrderFileUrl} from '@/lib/account/orderFileAccess';

export function OrderFileLink({url,children,className,label}:{url:string;children:ReactNode;className?:string;label?:string}) {
  return <a href="#" className={className} aria-label={label} onClick={async event=>{
    event.preventDefault();
    // Open synchronously during the click so browsers do not block the PDF tab.
    const tab=window.open('about:blank','_blank');
    if(!tab){toast.error('Tillad et nyt vindue for at åbne filen.');return;}
    tab.opener=null;
    try{tab.location.href=await authorizedOrderFileUrl(supabase,url,import.meta.env.VITE_SUPABASE_URL);}
    catch(error){tab.close();toast.error(error instanceof Error?error.message:'Filen kunne ikke åbnes.');}
  }}>{children}</a>;
}
