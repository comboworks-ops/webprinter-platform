import type {SupabaseClient} from '@supabase/supabase-js';
import {orderFileStoragePath} from '../../../supabase/functions/_shared/orderFileLocator.ts';
export {orderFileStoragePath};

/** Authorize on every click. Stored URLs remain stable locators, never expiring credentials. */
export async function authorizedOrderFileUrl(client:SupabaseClient,raw:string,backendUrl:string):Promise<string> {
  const path=orderFileStoragePath(raw,backendUrl);
  if(!path){const url=new URL(raw);if(url.protocol!=='https:')throw new Error('Ugyldigt fillink.');return raw;}
  const {data,error}=await client.storage.from('order-files').createSignedUrl(path,60);
  if(error||!data?.signedUrl)throw new Error('Filen kunne ikke åbnes. Genindlæs ordren, eller kontakt butikken.');
  return data.signedUrl;
}
