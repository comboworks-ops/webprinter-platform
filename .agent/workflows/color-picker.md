---
description: how to add color pickers in the branding/admin UI
---

# STRICT RULE: Always Use ColorPickerWithSwatches

When adding any color picker in the admin panel or branding settings, you MUST use the `ColorPickerWithSwatches` component.

## Usage

```tsx
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";

<ColorPickerWithSwatches
    label="Label Text"
    value={colorValue}
    onChange={(color) => handleColorChange(color)}
    savedSwatches={savedSwatches}
    onSaveSwatch={onSaveSwatch}
    onRemoveSwatch={onRemoveSwatch}
/>
```

## Required Props
- `label` - The label for the color picker
- `value` - Current color value (hex string)
- `onChange` - Callback when color changes
- `savedSwatches` - Array of saved swatch colors (from draft.savedSwatches)
- `onSaveSwatch` - Callback to save a new swatch
- `onRemoveSwatch` - Callback to remove a swatch

## DO NOT USE
- Basic HTML `<input type="color">` - NOT allowed
- Any other color picker components - NOT allowed unless explicitly approved

This ensures consistent UX and enables the swatch saving feature across the entire application.
