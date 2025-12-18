# Strict Design Protection Rules

This document defines non-negotiable visual and structural constraints for this project. **AI Assistants must follow these rules strictly** unless the user explicitly grants permission to "break the design rules."

## 1. Banner & Hero Section (`HeroSlider.tsx`)
- **Layout Integrity**: Do NOT change the layout structure, alignment, or padding of the hero content (`container mx-auto`, `max-w-2xl`, etc.).
- **CSS Classes**: Do NOT modify or remove the tailwind classes defining its vertical and horizontal positioning (e.g., `mt-16 md:mt-20`, `ml-4 md:ml-8`).
- **Button Logic**: Maintain the current implementation of custom button colors and hover effects. Do not simplify this logic.

## 2. Admin Side Menu & Branding Editors
- **Compact Aesthetics**: The "Indholdsblokke" and "Banner" sections in the admin area must remain **compact and boxed**.
- **Inline Controls**: Always use the `inline` prop for `FontSelector` and `ColorPickerWithSwatches` to keep labels and controls on the same line.
- **Labels**: Keep the small, uppercase, muted-foreground labels (e.g., `text-[10px] uppercase tracking-wider`).

## 3. General Polish
- **Premium Feel**: Any new branding controls added must follow the "boxed" pattern (using a border/rounded-md container) established in the Banner and Content Block sections.

## How to Override
To modify these layouts, the user must explicitly state: *"You are authorized to change the site layout/CSS"* or *"Break the design rules for [specific section]"*.
