# Grafisk vejledning editor QA — 26 September 2026

- The admin editor is at `/admin/grafisk-vejledning` under Shop moduler. It reads and saves only the selected tenant's `settings.graphicGuide`; the storefront uses the saved content with the existing illustrations and wording as defaults.
- Browser checked the authenticated editor and public `/grafisk-vejledning` on local port 8113 at desktop width 1280. The customer illustration and both routes rendered after restarting Vite in detached `screen` session `graphic-guide-preview`.
- Visually checked the editor at 390 px and 320 px widths. The fields and actions remained readable without visible horizontal overflow. The viewport override was reset.
- Edited the heading locally in the browser: Save enabled for the unsaved change and disabled again after restoring the original text. No save request was made.
- TypeScript, focused ESLint, `git diff --check`, and production Vite build passed.
- No form was saved, no image was uploaded, and no production deployment was made. Authenticated save, replacement image delivery, and cross-tenant persistence still need an intentional acceptance check on the deployed release.
