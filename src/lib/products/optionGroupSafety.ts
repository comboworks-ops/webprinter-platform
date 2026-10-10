import type { SupabaseClient } from '@supabase/supabase-js';

type Client = Pick<SupabaseClient, 'from'>;
type GroupInput = {
  tenantId: string;
  productId: string;
  name: string;
  label: string;
  displayType: string;
  description?: string;
  sortOrder: number;
};

async function requireProductShop(client: Client, tenantId: string, productId: string) {
  if (!tenantId || !productId) throw new Error('Vælg en shop og et produkt først.');
  const { data, error } = await client.from('products').select('id')
    .eq('id', productId).eq('tenant_id', tenantId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Produktet tilhører ikke den valgte shop. Genåbn produktet.');
}

export async function createProductOptionGroup(client: Client, input: GroupInput) {
  const name = input.name.trim().toLowerCase().replace(/\s+/g, '_');
  const label = input.label.trim();
  if (!name || !label) throw new Error('Udfyld både navn og visningsnavn.');
  await requireProductShop(client, input.tenantId, input.productId);

  // Names are globally unique. A collision must never edit another shop's data.
  const { data: existing, error: lookupError } = await client.from('product_option_groups')
    .select('id, tenant_id').eq('name', name).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing && existing.tenant_id !== input.tenantId) {
    throw new Error('Det interne navn er i brug i en anden shop. Vælg et andet navn.');
  }
  let groupId = existing?.id as string | undefined;
  if (groupId) {
    const { data: assignment, error } = await client.from('product_option_group_assignments')
      .select('id').eq('tenant_id', input.tenantId).eq('product_id', input.productId)
      .eq('option_group_id', groupId).maybeSingle();
    if (error) throw error;
    if (assignment) throw new Error('Denne gruppe er allerede tilføjet til produktet.');
  } else {
    const { data, error } = await client.from('product_option_groups').insert({
      name, label, display_type: input.displayType,
      description: input.description?.trim() || null, tenant_id: input.tenantId,
    }).select('id').single();
    if (error?.code === '23505') throw new Error('Det interne navn er netop taget i brug. Vælg et andet navn.');
    if (error) throw error;
    groupId = data.id;
  }

  // Reusing a definition only adds the link; label/type/options stay unchanged.
  const { error } = await client.from('product_option_group_assignments').insert({
    product_id: input.productId, option_group_id: groupId,
    tenant_id: input.tenantId, sort_order: input.sortOrder,
  });
  if (error) throw error;
  return { groupId, reused: !!existing };
}

export async function detachProductOptionGroup(client: Client, tenantId: string, productId: string, groupId: string) {
  await requireProductShop(client, tenantId, productId);
  const { error } = await client.from('product_option_group_assignments').delete()
    .eq('tenant_id', tenantId).eq('product_id', productId).eq('option_group_id', groupId);
  if (error) throw error;
  // Keep the group and all options, including links from other products.
}

export function tenantReleaseConfirmation(name: string, missingPrices: boolean) {
  return `Frigiv "${name}" til alle lejershops? Alle andre shops modtager en besked om produktet. Der kopieres ingen produkter eller priser ved denne handling.${missingPrices ? '\n\nProduktet har ingen Matrix-prisrækker. Importerede kopier kan derfor mangle pris-preview.' : ''}`;
}
