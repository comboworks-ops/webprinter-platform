import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StorefrontPrimaryButton } from '@/components/storefront/StorefrontPrimaryButton';

/** Actions live above the preview; eligibility comes from the production-file checks. */
export function FileProofActions({ approved, canReview, quickApproveAvailable, canApprove = quickApproveAvailable, issues = [], busy = false, onApprove, onReview, onContinue }: {
  approved: boolean;
  canReview: boolean;
  quickApproveAvailable: boolean;
  canApprove?: boolean;
  issues?: string[];
  busy?: boolean;
  onApprove: () => void;
  onReview: () => void;
  onContinue: () => void;
}) {
  const [acceptedIssues, setAcceptedIssues] = useState('');
  const issueKey = JSON.stringify(issues);
  return <div className="checkout-proof-actions mb-4 space-y-3">
    <div aria-live="polite" className="space-y-1">
      <p className="flex items-center gap-2 text-sm font-semibold">
        {approved && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
        {approved ? 'Din trykfil er godkendt' : 'Godkend din trykfil'}
      </p>
      <p className="text-sm text-muted-foreground">
        {approved
          ? 'Du kan nu færdiggøre din bestilling på denne side.'
          : !canReview
            ? 'Vent, mens filen uploades og tjekkes.'
            : canApprove
              ? 'Kontrollér billedet nedenfor, og godkend filen. Åbn korrektur, hvis du vil se nærmere på den.'
              : 'Åbn korrektur for at kontrollere filen og eventuelle bemærkninger, før du godkender.'}
      </p>
    </div>
    {!approved && issues.length > 0 && <div className="space-y-2 text-sm text-amber-900">
      <p className="font-medium">Bemærkninger til filen</p>
      <ul className="list-disc space-y-1 pl-5">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
      {canApprove && <label className="flex min-h-11 items-start gap-2 py-2">
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={acceptedIssues === issueKey} onChange={event => setAcceptedIssues(event.target.checked ? issueKey : '')} />
        <span>Jeg har set previewet og accepterer bemærkningerne.</span>
      </label>}
    </div>}
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {approved ? (
        <StorefrontPrimaryButton type="button" className="min-h-11 whitespace-normal" onClick={onContinue}>
          Fortsæt til bestilling
        </StorefrontPrimaryButton>
      ) : canApprove || busy ? (
        <StorefrontPrimaryButton type="button" className="min-h-11 whitespace-normal" disabled={busy || !canReview || (issues.length > 0 && acceptedIssues !== issueKey)} onClick={onApprove}>
          {busy ? 'Klargør trykfil…' : 'Godkend fil og fortsæt'}
        </StorefrontPrimaryButton>
      ) : null}
      <Button type="button" variant="outline" className="min-h-11 whitespace-normal" disabled={!canReview} onClick={onReview}>
        Åbn korrektur
      </Button>
    </div>
  </div>;
}
