# Account admin shortcut QA — 26 September 2026

- Added a role-gated **Adminpanel** action to `/min-konto/indstillinger`, using the same verified `useUserRole().isAdmin` signal as the storefront header.
- The shortcut blocks navigation while profile saving is in progress and asks before leaving unsaved profile changes.
- Browser checked the signed-in settings page on local port 8113. The action appeared beside the page heading and opened the `/admin` dashboard. No account form was submitted.
- Checked 1280 px, 390 px, and 320 px views. At 320 px, `innerWidth`, body width, root width, and document scroll width were all 320 px; the shortcut remained visible. The temporary viewport override was reset.
- Ordinary customer visibility is enforced by the shared role check, but a separate customer session was not used for browser acceptance. No deployment was made.
