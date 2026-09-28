import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import { prepareWorkspaceSave, type WorkspaceStructure } from './productWorkspace.ts';

export async function saveProductWorkspace(client: Pick<SupabaseClient<Database>, 'from'>, tenantId: string, productId: string,
  expected: WorkspaceStructure, draft: WorkspaceStructure, publish = false,
  expectedContent?: { name: string; description?: string; image_url?: string }): Promise<WorkspaceStructure> {
  const { data: product, error: readError } = await client.from('products').select('id, pricing_structure, updated_at, name, description, image_url')
    .eq('id', productId).eq('tenant_id', tenantId).single();
  if (readError || product?.id !== productId) throw readError || new Error('Produktet findes ikke i denne shop.');
  const updated = prepareWorkspaceSave(product.pricing_structure as WorkspaceStructure, expected, draft, publish);
  const content: Record<string, string> = {};
  if (publish) {
    for (const key of ['name', 'description', 'image_url'] as const) {
      if (typeof draft.workspaceContent?.[key] !== 'string') continue;
      if (!expectedContent || (product[key] || '') !== (expectedContent[key] || '')) throw new Error('Produktteksten eller billedet er ændret i et andet vindue. Genindlæs produktet før du anvender kladden.');
      content[key] = draft.workspaceContent[key];
      // Canonical product fields are also used by cards, search and the catalogue.
      delete updated.workspaceContent[key];
    }
  }
  const { data, error } = await client.from('products').update({ ...content, pricing_structure: updated as Json })
    .eq('id', productId).eq('tenant_id', tenantId).eq('updated_at', product.updated_at)
    .select('id, pricing_structure').maybeSingle();
  if (error) throw error;
  if (data?.id !== productId) throw new Error('En anden ændring blev gemt samtidig. Genindlæs produktet og prøv igen.');
  return data.pricing_structure as WorkspaceStructure;
}
