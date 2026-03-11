# Site Design Follow-ups

This file tracks Site Designer / Branding items that are intentionally logged for later implementation.

## 1. Global Color Picker

### Domain

- Site Designer / Branding
- UI hardening
- safe additive improvement

### Request

Replace the current fragmented color-picking behavior with one shared global color picker component used everywhere a page color is selected.

### Required Behavior

- one global color picker for all page-level color selections
- same picker UI across the entire Site Designer
- include a full color gradient circle / color spectrum picker
- include direct color value editing
- include the ability to save colors as brand colors
- saved brand colors should be reusable across the whole Site Designer
- saved brand colors must persist across refresh, page changes, logout/login, and later sessions until they are explicitly deleted

### Intent

The color picker should feel like the single source of truth for branding colors, instead of separate smaller color controls that behave differently from place to place.

### Acceptance Criteria

- every relevant Site Designer color field uses the same picker component
- the picker supports visual color selection, not only swatches or text input
- saved brand colors are visible from all Site Designer color fields
- brand-color saving is persistent with branding data
- saved brand colors remain available after refresh, route changes, and a new login session
- saved brand colors are removed only by explicit user deletion
- existing saved swatches / colors are not lost during migration

### Notes

- current related component: `src/components/ui/ColorPickerWithSwatches.tsx`
- this should be treated as a global branding control improvement, not a one-off fix inside a single section
