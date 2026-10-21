import { supabase } from '@/integrations/supabase/client';
import { uploadCheckoutFile } from '@/lib/checkout/privateUploads';
import type { SiteCheckoutState } from '@/lib/checkout/siteCheckoutSession';

export type CanvaDraft = { id: string; templateKey: string; status: string; message?: string; checkout?: SiteCheckoutState };
export type WorkflowResult = { id?: string; url?: string; connected?: boolean; ready?: boolean; drafts?: CanvaDraft[]; templateKeys?: string[] } & Partial<CanvaDraft>;

export async function canvaWorkflow(tenantId: string, input: Record<string,unknown>, photo?: File): Promise<WorkflowResult> {
  const payload = { ...input, tenantId };
  let body: Record<string,unknown> | FormData = payload;
  if (photo) { const form = new FormData(); form.set('input', JSON.stringify(payload)); form.set('photo', photo); body = form; }
  const { data, error } = await supabase.functions.invoke('canva-workflow', { body });
  if (error) {
    let message = 'Canva kunne ikke kontaktes. Prøv igen.';
    try { const response = await error.context?.json(); if (typeof response?.error === 'string') message = response.error; } catch { /* transport failure */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as WorkflowResult;
}

export async function importCanvaPdf(tenantId: string, id: string, exportRequestId: string, checkout: SiteCheckoutState): Promise<SiteCheckoutState> {
  const { data, error } = await supabase.functions.invoke('canva-workflow', { body: { action: 'download', tenantId, id, exportRequestId } });
  if (error || !(data instanceof Blob) || data.type !== 'application/pdf') throw new Error('PDF-filen kunne ikke hentes. Prøv igen.');
  const uploaded = await uploadCheckoutFile(supabase, tenantId, data, 'Mit Canva-design.pdf', `canva/${id}/${crypto.randomUUID()}.pdf`);
  return {
    ...checkout,
    // Imported artwork is always unapproved; existing checkout does the print check.
    proofApprovalRequired: true,
    designerExport: null,
    siteUpload: { name: uploaded.name, filePath: uploaded.path, fileUrl: uploaded.url, mimeType: 'application/pdf', sha256: uploaded.sha256 },
    createdAt: new Date().toISOString(),
  };
}
