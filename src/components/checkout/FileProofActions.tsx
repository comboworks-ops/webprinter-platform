import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StorefrontPrimaryButton } from '@/components/storefront/StorefrontPrimaryButton';
import { PrintWarningAcknowledgement } from './PrintWarningAcknowledgement';

/** Actions live above the preview; eligibility comes from the production-file checks. */
export function FileProofActions({ approved, canReview, quickApproveAvailable, canApprove = quickApproveAvailable, issues = [], busy = false, warningsAccepted, onWarningsAcceptedChange, acknowledgementLabel, onApprove, onReview, onContinue }: {
  approved: boolean;
  canReview: boolean;
  quickApproveAvailable: boolean;
  canApprove?: boolean;
  issues?: string[];
  busy?: boolean;
  warningsAccepted: boolean;
  onWarningsAcceptedChange: (accepted: boolean) => void;
  acknowledgementLabel: string;
  onApprove: () => void;
  onReview: () => void;
  onContinue: () => void;
}) {
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
    {!approved && <PrintWarningAcknowledgement issues={issues} accepted={warningsAccepted}
      onChange={onWarningsAcceptedChange} label={acknowledgementLabel} />}
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {approved ? (
        <StorefrontPrimaryButton type="button" className="min-h-11 whitespace-normal" onClick={onContinue}>
          Fortsæt til bestilling
        </StorefrontPrimaryButton>
      ) : canApprove || busy ? (
        <StorefrontPrimaryButton type="button" className="min-h-11 whitespace-normal" disabled={busy || !canReview || !warningsAccepted} onClick={onApprove}>
          {busy ? 'Klargør trykfil…' : 'Godkend fil og fortsæt'}
        </StorefrontPrimaryButton>
      ) : null}
      <Button type="button" variant="outline" className="min-h-11 whitespace-normal" disabled={!canReview} onClick={onReview}>
        Åbn korrektur
      </Button>
    </div>
  </div>;
}
