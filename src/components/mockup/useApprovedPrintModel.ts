import { useEffect, useState } from 'react';
import { approvedTemplateCandidate, isPrintModelEnabled, verifyPrintTemplate, type ApprovedPrintModel, type PrintTemplateIdentity } from '@/lib/mockup/approvedPrintModels';

/** Key the result to the current selection so a previous model cannot flash or
 * hand its artwork to another format while an asynchronous PDF read finishes. */
export function useApprovedPrintModel(template?: PrintTemplateIdentity | null, workspaceContent?: unknown, selections?: Record<string, string | null>) {
  const candidate = approvedTemplateCandidate(template);
  const allowed = candidate && isPrintModelEnabled(candidate, workspaceContent, selections);
  const key = allowed ? `${template?.pdfUrl ?? ''}:${template?.templatePdfSha256 ?? ''}` : '';
  const [verified, setVerified] = useState<{ key: string; model: ApprovedPrintModel | null }>();
  const pdfUrl = template?.pdfUrl, templatePdfSha256 = template?.templatePdfSha256;
  useEffect(() => {
    let cancelled = false;
    if (key) void verifyPrintTemplate({ pdfUrl, templatePdfSha256 }).then(model => {
      if (!cancelled) setVerified({ key, model });
    }).catch(() => { if (!cancelled) setVerified({ key, model: null }); });
    return () => { cancelled = true; };
  }, [key, pdfUrl, templatePdfSha256]);
  return key && verified?.key === key ? verified.model : null;
}
