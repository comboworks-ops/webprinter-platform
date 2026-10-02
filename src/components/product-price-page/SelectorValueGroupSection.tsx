import { useState, type ReactNode } from "react";

type SelectorValueGroupSectionProps = {
  group: { id: string; label: string; collapsible?: boolean; initiallyExpanded?: boolean };
  selectedLabel?: string;
  children: ReactNode;
};

/** Presentation only: closing a group never clears its selected option. */
export function SelectorValueGroupSection({ group, selectedLabel, children }: SelectorValueGroupSectionProps) {
  const [open, setOpen] = useState(group.initiallyExpanded === true || Boolean(selectedLabel));

  if (!group.collapsible) {
    return (
      <section className="space-y-2" data-selector-value-group={group.id}>
        <h4 className="text-xs font-semibold text-foreground">{group.label}</h4>
        {children}
      </section>
    );
  }

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group rounded-lg border border-border bg-background"
      data-selector-value-group={group.id}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 break-words">{group.label}</span>
        <span className="flex min-w-0 items-center gap-2">
          {selectedLabel && <span className="break-words text-primary">{selectedLabel}</span>}
          <span aria-hidden="true" className="shrink-0 group-open:rotate-180">⌄</span>
        </span>
      </summary>
      <div className="border-t border-border p-3">{children}</div>
    </details>
  );
}
