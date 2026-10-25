import { STUDIO_UUID } from './iconStudioRecipe.ts';

export interface StudioConnectionBinding { source: 'platform' | 'tenant'; version: string | null }
export interface StudioConnectionStatus { connected: boolean; version: string | null; lastFour: string | null; updatedAt: string | null }
export function parseStudioConnection(value: unknown): StudioConnectionBinding {
  const c = value as StudioConnectionBinding;
  if (!c || !['platform','tenant'].includes(c.source) || (c.version !== null && (typeof c.version !== 'string' || !STUDIO_UUID.test(c.version))) || (c.source === 'tenant' && !c.version)) throw new Error('Ugyldig OpenAI-forbindelse.');
  return {source:c.source,version:c.version};
}
export function sameStudioConnection(a?: StudioConnectionBinding,b?: StudioConnectionBinding) {
  return (a?.source || 'platform') === (b?.source || 'platform') && (a?.version || null) === (b?.version || null);
}
// Restricted to the backend's service client. Never forward the secret response.
export interface StudioConnectionClient { rpc(name: string, args: Record<string, unknown>): PromiseLike<{data: unknown; error: unknown}> }
export async function studioConnectionRpc(client: StudioConnectionClient,tenantId:string,action:string,extra:Record<string,unknown>={}) {
  const result = await client.rpc('icon_studio_connection',{p_tenant_id:tenantId,p_action:action,...extra});
  if (result.error || !result.data) throw new Error('OpenAI-forbindelsen kunne ikke læses eller er ændret. Opdater siden.');
  return result.data as StudioConnectionStatus & {apiKey?:string};
}
export function publicStudioConnection(status: StudioConnectionStatus) {
  return {connected:status.connected,version:status.version,lastFour:status.lastFour,updatedAt:status.updatedAt};
}
