import * as React from "react";

/** Native input styling and numeric handlers are preserved; clearing is an edit state. */
const EditableNumberInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ value, onChange, ...props }, ref) => {
    const [blank, setBlank] = React.useState<{ value: typeof value; pending: boolean } | null>(null);
    const controlled = value !== undefined;

    // Remember the value returned by the existing handler (often 0 or a minimum).
    // A later external value change replaces the blank; unrelated renders do not.
    React.useLayoutEffect(() => {
      if (blank?.pending) setBlank({ value, pending: false });
      else if (blank && !Object.is(blank.value, value)) setBlank(null);
    }, [blank, value]);

    const showBlank = controlled && blank !== null && (blank.pending || Object.is(blank.value, value));
    return (
      <input
        {...props}
        type="number"
        ref={ref}
        value={showBlank ? "" : value}
        onChange={(event) => {
          setBlank(controlled && event.currentTarget.value === "" ? { value, pending: true } : null);
          onChange?.(event);
        }}
      />
    );
  },
);
EditableNumberInput.displayName = "EditableNumberInput";

export { EditableNumberInput };
