import { supabase } from '@/integrations/supabase/client';
import type { StudioConnectionStatus } from '../../../supabase/functions/_shared/iconStudioConnection.ts';
export interface StudioCapabilities {
  success:true; productLibraryVersion?:1; productLibrarySaveVersion?:1; folderGuideVersion?:1|2; referencePackVersion?:1; recipeVersion:1; connectionVersion:1; providers:('openai'|'gemini')[];
  connection:StudioConnectionStatus; canManageConnection:boolean; model:string;
}
export async function invokeStudio<T>(body:Record<string,unknown>):Promise<T> {
  const {data,error} = await supabase.functions.invoke('icon-studio-generate',{body});
  if (error) {
    let message = 'Billedmotoren kunne ikke kontaktes. Opdater status før et nyt forsøg.';
    try { const response = await error.context?.json(); if (typeof response?.error === 'string') message=response.error; } catch { /* No provider details or request bodies are logged. */ }
    throw new Error(message);
  }
  if (data?.success !== true) throw new Error(data?.error || 'Billedmotoren kunne ikke afslutte handlingen.');
  return data as T;
}
export async function getStudioCapabilities(tenantId:string) {
  const data = await invokeStudio<StudioCapabilities>({tenantId,action:'capabilities'});
  if (data.recipeVersion !== 1 || data.connectionVersion !== 1 || !Array.isArray(data.providers) || !data.connection) throw new Error('Billedmotoren skal opdateres, før OpenAI kan tilsluttes.');
  return data;
}
