import type { SupabaseClient } from '@supabase/supabase-js';

/** Require readback: a denied UPDATE can otherwise succeed with zero rows. */
export async function saveProductImageReference(client: SupabaseClient, productId: string, url: string | null) {
  const {data, error} = await client.from('products').update({image_url: url})
    .eq('id', productId).select('id,image_url').single();
  if (error || data?.id !== productId || data.image_url !== url) {
    throw new Error('Billedet kunne ikke gemmes på produktet. Kontrollér din adgang og prøv igen.');
  }
}
