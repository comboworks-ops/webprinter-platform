import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import type { TooltipConfig } from '@/components/ProductTooltipIcon';

export async function saveProductTooltips(client: Pick<SupabaseClient<Database>, 'from'>, tenantId: string, productId: string, expected: TooltipConfig[], next: TooltipConfig[]) {
  const {data:product,error:readError} = await client.from('products').select('id,banner_config,updated_at').eq('id',productId).eq('tenant_id',tenantId).single();
  if(readError) throw readError;
  const config = (product.banner_config || {}) as Record<string, Json>;
  if(JSON.stringify(config.visual_tooltips || []) !== JSON.stringify(expected)) throw new Error('Tooltips er ændret i et andet vindue. Genindlæs før du gemmer.');
  const {data,error} = await client.from('products').update({banner_config:{...config,visual_tooltips:next as unknown as Json}}).eq('id',productId).eq('tenant_id',tenantId).eq('updated_at',product.updated_at).select('id').maybeSingle();
  if(error) throw error;
  if(!data) throw new Error('Produktet blev ændret samtidig. Genindlæs og prøv igen.');
}
