import * as React from "react";

import { Input } from "@/components/ui/input";

export type NumberInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "defaultValue" | "type" | "onChange"> & {
  value: number;
  onValueChange: (value: number) => void;
  /** Numeric value used by calculations while the editable field is empty. */
  emptyValue?: number;
};

/** Keeps the user's editable text separate from the numeric calculation value. */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onValueChange, emptyValue = 0, onBlur, ...props }, ref) => {
    const [draft, setDraft] = React.useState<{ text: string; numericValue: number } | null>(null);
    const numericValue = Number.isFinite(value) ? value : emptyValue;
    const draftMatchesValue = draft !== null && Object.is(draft.numericValue, numericValue);

    // External resets and switching records must replace the previous draft.
    React.useEffect(() => {
      setDraft((current) => current && !Object.is(current.numericValue, numericValue) ? null : current);
    }, [numericValue]);

    return (
      <Input
        {...props}
        ref={ref}
        type="number"
        inputMode={props.inputMode ?? "decimal"}
        value={draftMatchesValue ? draft.text : numericValue}
        onChange={(event) => {
          const text = event.target.value;
          const parsed = text === "" ? emptyValue : Number(text);
          const nextValue = Number.isFinite(parsed) ? parsed : emptyValue;
          setDraft({ text, numericValue: nextValue });
          onValueChange(nextValue);
        }}
        onBlur={(event) => {
          setDraft(null);
          onBlur?.(event);
        }}
      />
    );
  },
);
NumberInput.displayName = "NumberInput";

export { NumberInput };
