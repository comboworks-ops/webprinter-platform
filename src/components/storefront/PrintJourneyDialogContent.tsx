import { forwardRef, useContext, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { DialogContent } from '@/components/ui/dialog';
import { buildBrandingCssVariables } from '@/lib/branding';
import { printJourneyAttributes } from '@/lib/branding/printJourney';
import { SharedButtonContext } from './SharedButtonContext';

/** Radix portals preserve React context but need their own CSS inheritance root. */
export const PrintJourneyDialogContent = forwardRef<
  ElementRef<typeof DialogContent>, ComponentPropsWithoutRef<typeof DialogContent>
>(({ style, ...props }, ref) => {
  const branding = useContext(SharedButtonContext);
  const journey = printJourneyAttributes(branding);
  return <DialogContent {...props} {...journey} ref={ref}
    style={{ ...(journey['data-print-journey'] ? buildBrandingCssVariables(branding) : {}), ...journey.style, ...style }} />;
});
PrintJourneyDialogContent.displayName = 'PrintJourneyDialogContent';
