import { localOptionButtonStyle, sharedButtonAttributes } from '@/lib/branding/sharedButtons';
import { useSharedButtonStyles } from '@/components/storefront/SharedButtonContext';
import { forwardRef, useState, type ButtonHTMLAttributes } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MaterialInfoIcons } from './MaterialLabel';
import { useMaterialOptionInfo } from './materialOptionInfoContext';
import { cn } from '@/lib/utils';
import { useWorkspaceOptionEditing } from './workspacePreviewContext';

export interface OptionAvailabilityHint { text: string; alternatives: string[] }

/** Unavailable options remain focusable and explain themselves without selecting. */
export const ProductOptionButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  availabilityHint?: OptionAvailabilityHint;
  lockFromSharedButtons?: boolean;
  localAppearance?: unknown;
}>(({ availabilityHint, lockFromSharedButtons, localAppearance, onClick, className, children, ...props }, ref) => {
  const getShared = useSharedButtonStyles();
  const shared = className?.includes('workspace-matrix-edit-value') ? {} : lockFromSharedButtons ? sharedButtonAttributes(localOptionButtonStyle(localAppearance), 'selection') : getShared('selection', (props as Record<string, unknown>)['data-site-design-target'] as string | undefined);
  const [open, setOpen] = useState(false);
  const editing = useWorkspaceOptionEditing((props as Record<string, unknown>)['data-site-design-target'] as string | undefined);
  const button = <button {...props} {...shared} style={{ ...props.style, ...shared.style }} {...editing} ref={ref} type="button" className={cn(className, availabilityHint && !editing.onClick && 'opacity-50 grayscale cursor-help')}
    aria-disabled={editing.onPointerDown ? undefined : availabilityHint ? true : props['aria-disabled']}
    onClick={event => {
      if (editing.onClick) { editing.onClick(event); return; }
      if (availabilityHint) { event.preventDefault(); event.stopPropagation(); setOpen(value => !value); }
      else onClick?.(event);
    }}>{children}</button>;
  const materialInfo = useMaterialOptionInfo((props as Record<string, unknown>)['data-site-design-target'] as string | undefined);
  const withInformation = (control: React.ReactNode) => materialInfo?.length
    ? <span className="relative flex min-w-0 flex-col gap-1">{control}<span className="flex justify-end"><MaterialInfoIcons configs={materialInfo}/></span></span>
    : control;
  if (!availabilityHint) return withInformation(button);
  return withInformation(<Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>{button}</PopoverTrigger>
    <PopoverContent side="top" className="max-w-[calc(100vw-2rem)] text-sm" aria-label="Sådan bliver valget tilgængeligt">
      <p>{availabilityHint.text}</p>
      {availabilityHint.alternatives.length ? <>
        <p className="mt-2 font-medium">Vælg først en af disse kombinationer:</p>
        <ul className="mt-1 list-disc space-y-1 pl-4">{availabilityHint.alternatives.map(text => <li key={text}>{text}</li>)}</ul>
      </> : <p className="mt-2 text-muted-foreground">Der er ingen bekræftet kombination for dette valg i produktets aktuelle muligheder.</p>}
    </PopoverContent>
  </Popover>);
});
ProductOptionButton.displayName = 'ProductOptionButton';
